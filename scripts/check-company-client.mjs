import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../frontend/js/services/api-client.js", import.meta.url), "utf8");
function browser() {
  const values = {};
  const localStorage = new Proxy({ getItem: (key) => values[key] ?? null, setItem: (key, value) => { values[key] = String(value); }, removeItem: (key) => { delete values[key]; } }, {
    ownKeys: () => Object.keys(values),
    getOwnPropertyDescriptor: (_target, key) => key in values ? { enumerable: true, configurable: true } : undefined,
  });
  const requests = [];
  let responder = () => ({ items: [] });
  const window = {
    performance, setTimeout, clearTimeout, addEventListener() {}, removeEventListener() {}, dispatchEvent() {},
    location: { assign() {}, reload() {} },
    BanikAuth: { async getIdToken() { return "test-token"; }, async getCurrentUser() { return { id: "test-user", companyId: "company-two" }; } },
  };
  const context = vm.createContext({ window, localStorage, document: { documentElement: { dataset: {} } }, Event, CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options?.detail; } }, console: { debug() {}, warn() {} }, fetch: async (url, options) => {
    requests.push({ url, options });
    const payload = await responder(url, options);
    return { status: payload.status || 200, ok: !payload.status || payload.status < 400, headers: { get() { return "application/json"; } }, async json() { return payload.body || payload; } };
  } });
  vm.runInContext(source, context);
  return { api: window.BanikApi, window, localStorage, requests, respond(handler) { responder = handler; } };
}
{
  const { api, localStorage, requests } = browser();
  localStorage.setItem("banikBooksJournals", JSON.stringify([{ id: "browser-only" }]));
  api.setIdentity("owner-one");
  assert.equal(localStorage.getItem("banikBooksJournals"), null);
  const recovery = Object.keys(localStorage).find((key) => key.startsWith("banikBooksRecovery:owner-one:"));
  assert.ok(recovery, "unattributed legacy browser data has a tagged recovery copy");
  assert.equal(JSON.parse(localStorage.getItem(recovery)).items.banikBooksJournals, '[{"id":"browser-only"}]');
  localStorage.setItem("banikBooksJournals", '[{"id":"stale"}]');
  assert.equal((await api.hydrate("journals", "banikBooksJournals")).length, 0);
  assert.equal(localStorage.getItem("banikBooksJournals"), "[]");
  assert.equal(requests.filter(({ options }) => options.method && options.method !== "GET").length, 0, "empty remote storage must never auto-upload browser caches");
}
{
  const { api, localStorage, requests, respond } = browser();
  api.setIdentity("owner-one");
  respond((url) => url === "/api/companies" ? { companies: [{ id: "company-one" }, { id: "company-two" }] } : { companyId: "company-two", permissions: { "journals.create": true } });
  await api.selectCompany("company-two", { reload: false });
  assert.equal(requests.at(-1).options.headers["X-Banik-Company-Id"], "company-two");
  assert.equal(requests.at(-1).options.headers.Authorization, "Bearer test-token");
  assert.equal(api.can("journals.create"), true);
  assert.equal(api.can("journals.post"), false);
  localStorage.setItem("banikBooksPostedJournals", '[{"id":"private"}]');
  api.setIdentity("owner-two");
  assert.equal(localStorage.getItem("banikBooksPostedJournals"), null);
  assert.equal(api.can("journals.create"), false);
  assert.equal(JSON.parse(localStorage.getItem("banikBooksActiveContext")).companyId, "");
}
{
  const { api, respond } = browser();
  let finish;
  respond(() => new Promise((resolve) => { finish = resolve; }));
  const pending = api.list("journals");
  await new Promise((resolve) => setImmediate(resolve));
  api.clearBusinessCache();
  finish({ items: [{ id: "wrong-company" }] });
  await assert.rejects(pending, /Company changed/);
}
{
  const { api, respond, requests } = browser();
  respond(() => ({ ok: true }));
  await api.request("/api/team/invitations", { method: "POST", headers: { "X-Test": "yes" }, body: { email: "junior@example.com" } });
  assert.equal(requests[0].options.headers.Authorization, "Bearer test-token", "custom headers cannot drop authentication");
  assert.equal(requests[0].options.body, '{"email":"junior@example.com"}');
  respond(() => ({ status: 403, body: { error: "Permission removed" } }));
  await assert.rejects(api.hydrate("parties", "banikBooksParties"), /Permission removed/, "permission failures cannot fall back to cached data");
}
{
  const { api, respond, requests } = browser();
  respond((_url, options) => options.method === "PUT" ? { items: [{ id: "saved" }], revision: "revision-two" } : { items: [{ id: "existing" }], revision: "revision-one" });
  await api.list("parties");
  await api.replace("parties", [{ id: "saved" }]);
  assert.equal(JSON.parse(requests.at(-1).options.body).expectedRevision, "revision-one");
  await api.replace("parties", [{ id: "saved" }]);
  assert.equal(JSON.parse(requests.at(-1).options.body).expectedRevision, "revision-two");
  respond(() => ({ status: 409, body: { error: "Data changed. Refresh before saving." } }));
  await assert.rejects(api.replace("parties", []), /Data changed/, "stale bulk saves must surface a conflict");
}
{
  const { api, respond, requests } = browser();
  respond((_url, options) => {
    if (options.method === "PUT") return { item: { id: "accountingPreferences", value: { currency: "BDT" }, version: 4 } };
    if (options.method === "DELETE") return { items: [] };
    return { item: { id: "accountingPreferences", value: {}, version: 3 } };
  });
  await api.getSetting("accountingPreferences");
  await api.saveSetting("accountingPreferences", { currency: "BDT" });
  assert.equal(JSON.parse(requests.at(-1).options.body).item.version, 3, "setting writes retain the revision that was read");
  await api.remove("settings", "accountingPreferences");
  assert.equal(JSON.parse(requests.at(-1).options.body).expectedVersion, 4, "deletions use the last saved record revision");
}
{
  const { api, window, requests } = browser();
  window.BanikAuth.getIdToken = async () => "";
  await assert.rejects(api.list("parties"), /verified account/);
  assert.equal(requests.length, 0, "missing Firebase token must never fall through to a development workspace");
}
{
  const { api, window, requests, respond } = browser();
  window.BanikAuth.getIdToken = async (forceRefresh) => forceRefresh ? "" : "expired-token";
  respond(() => ({ status: 401, body: { error: "Token expired" } }));
  await assert.rejects(api.list("parties"), /Token expired/);
  assert.equal(requests.length, 1, "failed token refresh must never retry without authentication");
}
{
  const { api, window, requests } = browser();
  let resolveUser;
  window.BanikAuth.getCurrentUser = () => new Promise((resolve) => { resolveUser = resolve; });
  const pending = api.list("parties");
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(requests.length, 0, "business requests wait for verified company initialization");
  resolveUser({ id: "test-user", companyId: "company-two" });
  await pending;
  assert.equal(requests.length, 1);
}
{
  const { api, window, requests } = browser();
  let resolveToken;
  window.BanikAuth.getIdToken = () => new Promise((resolve) => { resolveToken = resolve; });
  const pending = api.request("/api/team/invitations", { method: "POST", body: { email: "junior@example.com" } });
  await new Promise((resolve) => setImmediate(resolve));
  api.clearBusinessCache();
  resolveToken("test-token");
  await assert.rejects(pending, /Company changed/);
  assert.equal(requests.length, 0, "a queued write cannot be sent after the company changes");
}
{
  const { api, localStorage } = browser();
  localStorage.setItem("banikBooksActiveContext", JSON.stringify({ userId: "owner-one", companyId: "company-two" }));
  localStorage.setItem("banikBooksJournals", '[{"id":"server-backed"}]');
  localStorage.setItem("banikBooksParties", '[{"id":"server-backed-party"}]');
  api.clearBusinessCache();
  assert.equal(Object.keys(localStorage).filter((key) => key.startsWith("banikBooksRecovery:")).length, 0, "routine logout must not duplicate server-backed collections");
  localStorage.setItem("banikBooksRecovery:owner-one:legacy", JSON.stringify({ ownerId: "owner-one", ownershipVerified: false, items: { banikBooksJournals: "legacy-original" } }));
  for (let day = 0; day < 10; day += 1) {
    localStorage.setItem("banikBooksChartFormDraft", JSON.stringify({ name: `Draft ${day}` }));
    api.clearBusinessCache();
  }
  const keys = Object.keys(localStorage).filter((key) => key.startsWith("banikBooksRecovery:"));
  assert.equal(keys.length, 2, "known companies retain one latest browser-draft copy without deleting unknown legacy copies");
  assert.equal(JSON.parse(localStorage.getItem("banikBooksRecovery:owner-one:company-two:latest")).items.banikBooksChartFormDraft, '{"name":"Draft 9"}');
  assert.equal(JSON.parse(localStorage.getItem("banikBooksRecovery:owner-one:legacy")).items.banikBooksJournals, "legacy-original");
}
{
  const { api, localStorage, respond } = browser();
  localStorage.setItem("banikBooksActiveContext", JSON.stringify({ userId: "owner-one", companyId: "company-two" }));
  respond(() => ({ companyId: "company-two", permissions: { "exports.download": true } }));
  await api.getWorkspace();
  assert.equal(api.can("exports.download"), true);
  localStorage.setItem("banikBooksChartFormDraft", '{"name":"unsaved"}');
  const originalSetItem = localStorage.setItem;
  localStorage.setItem = (key, value) => { if (key.startsWith("banikBooksRecovery:")) throw new Error("QuotaExceededError"); originalSetItem(key, value); };
  assert.throws(() => api.clearBusinessCache(), /storage is full/);
  assert.equal(localStorage.getItem("banikBooksChartFormDraft"), '{"name":"unsaved"}', "quota errors cannot discard the only local copy");
  assert.equal(api.getContext(), null, "quota errors must still invalidate the company permission context");
  assert.equal(api.can("exports.download"), false);
}
console.log("Company client isolation checks passed.");
