import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const apiSource = fs.readFileSync(new URL("../frontend/js/services/api-client.js", import.meta.url), "utf8");
const completeAuthSource = fs.readFileSync(new URL("../frontend/js/core/auth.js", import.meta.url), "utf8");
const authSource = completeAuthSource.slice(completeAuthSource.indexOf("const LETTERHEAD_CHUNK_SIZE")).replace("import(FIRESTORE_SDK_URL)", "loadFirestoreFixture()");
const invitationSource = fs.readFileSync(new URL("../frontend/js/pages/accept-invite.js", import.meta.url), "utf8");
const delay = () => new Promise((resolve) => setImmediate(resolve));
const FIRESTORE_ONLY = new Set(["getFirestore", "doc", "collection", "serverTimestamp", "getDoc", "setDoc", "updateDoc", "getDocs", "writeBatch"]);
async function finishes(promise, label) {
  let timeout;
  try { return await Promise.race([promise, new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error(`Auth initialization timed out: ${label}`)), 2000); })]); }
  finally { clearTimeout(timeout); }
}
const permission = (enabled = true) => ({ "journal-entry": enabled, reports: enabled, "party-management": enabled, "chart-of-accounts": enabled });
const ownerProfile = (email, extra = {}) => ({ email, fullName: "Original Owner", companyName: "Original Company", role: "user", profileCompleted: true, emailVerified: true, permissions: permission(), ...extra });
function firebaseUser(uid, email, verified = true) {
  return { uid, email, emailVerified: verified, displayName: uid, async reload() {}, async getIdToken() { return `token:${uid}`; } };
}
function fixture({ initialUser = null, profiles = {}, memberships = {}, pathname = "/index.html", legacyStorage = {}, session: initialSession = {} } = {}) {
  const stored = { ...legacyStorage };
  const session = { ...initialSession };
  const sessionStorage = { getItem: (key) => session[key] ?? null, setItem: (key, value) => { session[key] = String(value); }, removeItem: (key) => { delete session[key]; } };
  let firestoreLoads = 0;
  const localStorage = new Proxy({ getItem: (key) => stored[key] ?? null, setItem: (key, value) => { stored[key] = String(value); }, removeItem: (key) => { delete stored[key]; } }, { ownKeys: () => Object.keys(stored), getOwnPropertyDescriptor: (_object, key) => key in stored ? { enumerable: true, configurable: true } : undefined });
  const documents = new Map(Object.entries(profiles).map(([uid, profile]) => [`users/${uid}`, structuredClone(profile)]));
  const users = new Map(initialUser ? [[initialUser.email, initialUser]] : []);
  const calls = [];
  const verifications = [];
  const writes = [];
  const elements = new Map();
  const domEvents = new Map();
  const windowEvents = new Map();
  let authListener;
  let reloads = 0;
  let readHook = null;
  const auth = { currentUser: initialUser };
  const emit = (user) => { auth.currentUser = user; queueMicrotask(() => { Promise.resolve(authListener(user)).catch(() => {}); }); };
  function element(id) {
    if (!elements.has(id)) elements.set(id, { id, hidden: true, disabled: false, value: "", textContent: "", className: "", required: false, listeners: {}, addEventListener(type, listener) { this.listeners[type] = listener; }, matches() { return false; } });
    return elements.get(id);
  }
  const document = {
    documentElement: { dataset: {}, style: {}, removeAttribute() {} }, body: { innerHTML: "" },
    querySelectorAll() { return []; }, getElementById: element,
    addEventListener(type, listener) { if (!domEvents.has(type)) domEvents.set(type, []); domEvents.get(type).push(listener); },
  };
  const location = { pathname, origin: "https://example.test", search: pathname === "/accept-invite.html" ? "?token=invite.secret" : "", href: `https://example.test${pathname}`, hostname: "example.test", reload() { reloads += 1; }, assign(value) { this.href = value; }, replace(value) { this.href = value; } };
  const window = { document, location, performance, setTimeout, clearTimeout,
    addEventListener(type, listener) { if (!windowEvents.has(type)) windowEvents.set(type, []); windowEvents.get(type).push(listener); },
    removeEventListener(type, listener) { windowEvents.set(type, (windowEvents.get(type) || []).filter((entry) => entry !== listener)); },
    dispatchEvent(event) { for (const listener of [...windowEvents.get(event.type) || []]) listener(event); },
  };
  const sdk = {
    firebaseConfig: { apiKey: "fixture", projectId: "fixture" }, BANIK_FOUNDER_ADMIN_EMAIL: "founder@example.test",
    getApps: () => [], initializeApp: () => ({}), getApp: () => ({}), getAuth: () => auth, getFirestore: () => ({}),
    onAuthStateChanged(_auth, callback) { authListener = callback; emit(initialUser); },
    doc: (_db, ...parts) => parts.join("/"), collection: (_db, ...parts) => parts.join("/"), serverTimestamp: () => new Date().toISOString(),
    async getDoc(reference) { if (readHook) await readHook(reference); const value = documents.get(reference); return { exists: () => Boolean(value), data: () => structuredClone(value) }; },
    async setDoc(reference, data) { documents.set(reference, structuredClone(data)); writes.push({ reference, data: structuredClone(data), verified: auth.currentUser?.emailVerified }); },
    async updateDoc(reference, data) { if (!documents.has(reference)) throw new Error("Missing profile"); documents.set(reference, { ...documents.get(reference), ...structuredClone(data) }); },
    async getDocs() { return { docs: [] }; }, writeBatch() { return { set() {}, delete() {}, async commit() {} }; },
    async createUserWithEmailAndPassword(_auth, email) { if (users.has(email)) throw Object.assign(new Error("Already registered"), { code: "auth/email-already-in-use" }); const user = firebaseUser(`new-${users.size + 1}`, email, false); users.set(email, user); emit(user); return { user }; },
    async signInWithEmailAndPassword(_auth, email) { const user = users.get(email); if (!user) throw Object.assign(new Error("Invalid login"), { code: "auth/invalid-credential" }); emit(user); return { user }; },
    async updateProfile(user, update) { Object.assign(user, update); },
    async sendEmailVerification(user, settings) { verifications.push({ uid: user.uid, settings, profile: structuredClone(documents.get(`users/${user.uid}`)) }); },
    async sendPasswordResetEmail() {}, async signOut() { emit(null); },
  };
  async function fetch(url, options = {}) {
    calls.push({ url, options });
    const actor = auth.currentUser;
    const response = (body, status = 200) => ({ status, ok: status < 400, headers: { get: () => "application/json" }, async json() { return body; } });
    if (url === "/api/invitations/invite.secret" && !options.method) return response({ invitation: { invitedEmail: "junior@example.test", fullName: "Junior Accountant", companyName: "Employer Company", role: "junior", status: "pending", expiresAt: "2099-01-01T00:00:00Z" } });
    assert.equal(options.headers.Authorization, `Bearer token:${actor?.uid}`, "API requires the current verified actor's own token");
    if (url === "/api/companies") {
      const profile = documents.get(`users/${actor.uid}`);
      if (!Object.hasOwn(memberships, actor.uid)) memberships[actor.uid] = profile.accountType === "invited" ? [] : [{ id: `company-${actor.uid}`, name: profile.companyName || "New Company", role: "owner" }];
      return response({ companies: memberships[actor.uid] });
    }
    if (url === "/api/workspace") {
      const selected = options.headers["X-Banik-Company-Id"];
      const company = (memberships[actor.uid] || []).find((entry) => entry.id === selected);
      if (!company) return response({ code: "COMPANY_ACCESS_DENIED", error: "Membership unavailable" }, 403);
      return response({ userId: actor.uid, companyId: company.id, companyRole: company.role, companyName: company.name,
        companyProfile: { companyName: company.name, companyAddress: "Employer office", fullName: "Must not replace actor", email: "must-not-replace@example.test", id: "owner-id" },
        companyModules: permission(), permissions: { "journals.create": true, "journals.editOwn": true, "journals.submit": true, "reports.view": company.role === "owner", "team.manage": company.role === "owner", "exports.download": company.role === "owner" } });
    }
    if (url === "/api/invitations/invite.secret/accept") {
      assert.equal(actor.email, "junior@example.test");
      memberships[actor.uid] = [...memberships[actor.uid] || [], { id: "employer", name: "Employer Company", role: "junior" }];
      return response({ companyId: "employer" });
    }
    if (url.startsWith("/api/settings/")) return response({ item: null });
    if (url === "/api/journals") return response({ item: {} });
    if (url === "/api/team/members") return response({ ok: true });
    if (url === "/api/team/forbidden") return response({ error: "Not allowed" }, 403);
    throw new Error(`Unexpected fixture request ${url}`);
  }
  const loadFirestoreFixture = async () => { firestoreLoads += 1; return sdk; };
  const context = vm.createContext({ ...Object.fromEntries(Object.entries(sdk).filter(([key]) => !FIRESTORE_ONLY.has(key))), loadFirestoreFixture, window, document, localStorage, sessionStorage, fetch, console: { debug() {}, warn() {}, error() {} }, URL, URLSearchParams, Event, MutationObserver: class { observe() {} }, CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options?.detail; } } });
  vm.runInContext(apiSource, context);
  vm.runInContext(authSource, context);
  return { window, auth, documents, users, memberships, calls, verifications, writes, localStorage, stored, session, element, context, firestoreLoads: () => firestoreLoads, setReadHook(value) { readHook = value; }, reloads: () => reloads,
    async openInvitation() { vm.runInContext(invitationSource, context); for (const listener of domEvents.get("DOMContentLoaded") || []) await listener(); },
    async submitInvitation() { await element("invite-auth-form").listeners.submit({ preventDefault() {} }); },
  };
}
{
  const owner = firebaseUser("legacy-owner", "owner@example.test");
  const app = fixture({ initialUser: owner, profiles: { [owner.uid]: ownerProfile(owner.email) }, pathname: "/workspace.html", legacyStorage: { banikBooksJournals: '[{"id":"legacy-browser-only"}]' } });
  const user = await finishes(app.window.BanikAuth.getCurrentUser(), "cold legacy owner");
  assert.equal(user.id, owner.uid); assert.equal(user.fullName, "Original Owner"); assert.equal(user.email, owner.email);
  assert.equal(user.companyRole, "owner"); assert.equal(app.reloads(), 1);
  assert.equal(app.localStorage.getItem("banikBooksJournals"), null);
  assert.ok(Object.keys(app.localStorage).some((key) => key.startsWith("banikBooksRecovery:")));
  assert.equal(await app.window.BanikAuth.getIdToken(), `token:${owner.uid}`);
}
{
  const app = fixture({ pathname: "/accept-invite.html" });
  await finishes(app.openInvitation(), "invitation preview");
  assert.equal(app.element("invite-email").value, "junior@example.test");
  assert.equal(app.element("invite-auth-form").hidden, false);
  app.element("invite-mode").listeners.click();
  app.element("invite-name").value = "Junior Accountant";
  app.element("invite-password").value = "fixture-password";
  await finishes(app.submitInvitation(), "unverified invited registration");
  const created = app.users.get("junior@example.test");
  const marker = app.documents.get(`users/${created.uid}`);
  assert.equal(marker.accountType, "invited"); assert.equal(marker.role, "user"); assert.equal(marker.profileCompleted, false);
  assert.ok(Object.values(marker.permissions).every((value) => value === false));
  assert.equal(app.writes[0].verified, false, "safe invited marker is written before email verification");
  assert.equal(app.verifications[0].profile.accountType, "invited", "marker must exist before verification mail is sent");
  assert.equal(new URL(app.verifications[0].settings.url).searchParams.get("token"), "invite.secret");
  assert.equal(app.auth.currentUser, null); assert.match(app.element("invite-status").textContent, /Verify your email/);
  assert.equal(app.calls.some(({ url }) => url === "/api/companies"), false, "unverified signup must not provision a company");
  created.emailVerified = true;
  app.element("invite-password").value = "fixture-password";
  await finishes(app.submitInvitation(), "verified invitation acceptance and company switch");
  const user = await app.window.BanikAuth.getCurrentUser();
  assert.equal(user.id, created.uid); assert.equal(user.fullName, "Junior Accountant"); assert.equal(user.companyId, "employer");
  assert.equal(user.companyName, "Employer Company"); assert.equal(user.companyAddress, "Employer office"); assert.equal(user.profileCompleted, true);
  assert.equal(app.window.location.href, "/workspace.html");
  assert.deepEqual(app.memberships[created.uid].map((company) => company.id), ["employer"], "invited staff must not acquire a personal company during onboarding");
  assert.equal(user.permissions.reports, false);
}
{
  const app = fixture();
  await app.window.BanikAuth.getCurrentUser();
  const registration = await app.window.BanikAuth.register({ email: "new-owner@example.test", password: "fixture-password" });
  assert.equal(registration.requiresVerification, true);
  const created = app.users.get("new-owner@example.test");
  assert.equal(app.documents.has(`users/${created.uid}`), false);
  created.emailVerified = true;
  const result = await finishes(app.window.BanikAuth.login(created.email, "fixture-password"), "normal owner signup");
  assert.equal(result.ok, true); assert.equal(result.user.companyRole, "owner"); assert.equal(result.user.profileCompleted, false);
  assert.equal(vm.runInContext("canUserAccessPage(cachedCurrentUser, 'signup.html')", app.context), true);
  assert.equal(vm.runInContext("canUserAccessPage(cachedCurrentUser, 'journal-entry.html')", app.context), false);
}
{
  const owner = firebaseUser("multi-owner", "owner@example.test");
  const app = fixture({ initialUser: owner, profiles: { [owner.uid]: ownerProfile(owner.email) }, memberships: { [owner.uid]: [{ id: "own-company", name: "My Company", role: "owner" }, { id: "other-company", name: "Other Company", role: "junior" }] } });
  await finishes(app.window.BanikAuth.getCurrentUser(), "multiple company initialization");
  const login = await app.window.BanikAuth.login(owner.email, "fixture-password");
  assert.equal(login.companies.length, 2);
  await app.window.BanikApi.selectCompany("other-company", { reload: false });
  const staff = await finishes(app.window.BanikAuth.refreshCompany(), "switch to company membership");
  assert.equal(staff.companyId, "other-company"); assert.equal(staff.id, owner.uid); assert.equal(staff.fullName, "Original Owner");
  app.localStorage.setItem("banikBooksJournals", '[{"id":"previous-access"}]');
  app.memberships[owner.uid] = [];
  const revoked = await app.window.BanikAuth.refreshCompany();
  assert.equal(revoked.companyId, ""); assert.equal(app.window.BanikApi.getContext(), null);
  assert.equal(app.localStorage.getItem("banikBooksJournals"), null);
  assert.equal(vm.runInContext("canUserAccessPage(cachedCurrentUser, 'workspace.html')", app.context), false);
}
{
  const owner = firebaseUser("slow-owner", "slow@example.test");
  const app = fixture({ initialUser: owner, profiles: { [owner.uid]: ownerProfile(owner.email) } });
  let release;
  const held = new Promise((resolve) => { release = resolve; });
  app.setReadHook(async () => held);
  assert.equal(await finishes(app.window.BanikAuth.getIdToken(), "token while profile waits"), `token:${owner.uid}`);
  release();
  assert.equal((await finishes(app.window.BanikAuth.getCurrentUser(), "profile after token readiness")).id, owner.uid);
}
{
  const owner = firebaseUser("denied-owner", "denied@example.test");
  const app = fixture({ initialUser: owner, profiles: { [owner.uid]: ownerProfile(owner.email) } });
  app.setReadHook(async () => { throw new Error("Profile access denied"); });
  assert.equal(await finishes(app.window.BanikAuth.getCurrentUser(), "profile error fails closed"), null);
  assert.equal(app.calls.length, 0, "failed profile read cannot grant default permissions or a company");
}
{
  const oldUser = firebaseUser("old-user", "old@example.test");
  const newUser = firebaseUser("new-user", "new@example.test");
  const app = fixture({ initialUser: oldUser, profiles: { [oldUser.uid]: ownerProfile(oldUser.email), [newUser.uid]: ownerProfile(newUser.email, { fullName: "New User" }) } });
  app.users.set(newUser.email, newUser);
  let release;
  const held = new Promise((resolve) => { release = resolve; });
  app.setReadHook(async (reference) => { if (reference === `users/${oldUser.uid}`) await held; });
  await delay();
  const loggedIn = await finishes(app.window.BanikAuth.login(newUser.email, "fixture-password"), "identity changed during old profile request");
  assert.equal(loggedIn.user.id, newUser.uid);
  release(); await delay();
  assert.equal((await app.window.BanikAuth.getCurrentUser()).id, newUser.uid, "late previous-user profile response cannot overwrite the current actor");
}
{
  const SNAPSHOT = "banikBooksSessionSnapshot";
  const apiCalls = (app, url) => app.calls.filter((call) => call.url === url).length;
  const owner = firebaseUser("snapshot-owner", "snapshot@example.test");
  const profiles = { [owner.uid]: ownerProfile(owner.email) };
  const open = (previous, overrides = {}) => fixture({ initialUser: owner, profiles, memberships: previous.memberships, pathname: "/workspace.html", legacyStorage: previous.stored, session: previous.session, ...overrides });
  const signedIn = async (app, label) => finishes(app.window.BanikAuth.getCurrentUser(), label);

  const first = fixture({ initialUser: owner, profiles, pathname: "/workspace.html" });
  await signedIn(first, "first page open");
  assert.equal(first.firestoreLoads(), 1, "the first page open performs the full check");
  assert.equal(apiCalls(first, "/api/companies"), 1, "the company list is requested once");
  assert.equal(apiCalls(first, "/api/workspace"), 1);

  const next = open(first);
  const restored = await signedIn(next, "next page open");
  assert.equal(restored.id, owner.uid); assert.equal(restored.companyId, `company-${owner.uid}`);
  assert.equal(next.calls.length, 0, "the next page open makes no sign-in or company calls");
  assert.equal(next.firestoreLoads(), 0, "the next page open does not download the database library");
  assert.equal(next.window.BanikApi.can("team.manage"), true, "permissions are restored with the snapshot");
  assert.equal(next.reloads(), 0);

  const saved = JSON.parse(next.session[SNAPSHOT]);
  const expired = open(next, { session: { [SNAPSHOT]: JSON.stringify({ ...saved, savedAt: Date.now() - 6 * 60 * 1000 }) } });
  await signedIn(expired, "expired snapshot");
  assert.equal(apiCalls(expired, "/api/workspace"), 1, "an expired snapshot repeats the full check");

  const other = firebaseUser("snapshot-other", "other@example.test");
  const otherApp = fixture({ initialUser: other, profiles: { [other.uid]: ownerProfile(other.email) }, pathname: "/workspace.html", legacyStorage: next.stored, session: next.session });
  const otherUser = await signedIn(otherApp, "different user in the same tab");
  assert.equal(otherUser.id, other.uid); assert.equal(otherUser.companyId, `company-${other.uid}`, "another user's snapshot is never used");

  const switched = open(next, { legacyStorage: { ...next.stored, banikBooksActiveContext: JSON.stringify({ userId: owner.uid, companyId: "another-company" }) } });
  await signedIn(switched, "company changed in another tab");
  assert.equal(apiCalls(switched, "/api/workspace"), 1, "a company change ignores the snapshot");

  const worker = open(next);
  await signedIn(worker, "daily data entry");
  await worker.window.BanikApi.request("/api/journals", { method: "POST", body: {} });
  assert.ok(worker.session[SNAPSHOT], "saving accounting data does not repeat the sign-in check");
  await worker.window.BanikApi.request("/api/team/members", { method: "POST", body: {} });
  assert.equal(worker.session[SNAPSHOT], undefined, "team changes force a full check");

  const denied = open(next);
  await signedIn(denied, "access removed");
  await assert.rejects(denied.window.BanikApi.request("/api/team/forbidden"), /Not allowed/);
  assert.equal(denied.session[SNAPSHOT], undefined, "a refused request forces a full check");

  const profileEditor = open(next);
  await signedIn(profileEditor, "profile change");
  assert.equal((await profileEditor.window.BanikAuth.removeProfilePhoto()).ok, true);
  assert.equal(profileEditor.firestoreLoads(), 1, "profile changes still load the database library");
  assert.equal(profileEditor.session[SNAPSHOT], undefined, "profile changes force a full check");

  const refreshed = open(next);
  await signedIn(refreshed, "manual refresh");
  await refreshed.window.BanikAuth.refreshCompany();
  assert.equal(apiCalls(refreshed, "/api/workspace"), 1, "refreshCompany always asks the server");

  const leaving = open(next);
  await signedIn(leaving, "sign-out");
  await leaving.window.BanikAuth.logout({ redirect: false });
  assert.equal(leaving.session[SNAPSHOT], undefined, "signing out removes the snapshot");
}
console.log("Authentication and invitation onboarding regression checks passed.");
