// This is a transaction/API contract fake, not a replacement for emulator or
// live Firebase tests. It rejects reads after writes and commits buffered writes
// atomically so migration and audit ordering regressions are caught offline.
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const copy = (value) => value === undefined ? undefined : structuredClone(value);
class FakeReference {
  constructor(database, pathname, kind = "document", filters = []) { this.database = database; this.path = pathname; this.kind = kind; this.filters = filters; this.id = pathname.split("/").at(-1); }
  collection(name) { return new FakeReference(this.database, `${this.path}/${name}`, "collection"); }
  doc(id) { return new FakeReference(this.database, `${this.path}/${id}`); }
  where(key, operator, value) { assert.equal(operator, "=="); return new FakeReference(this.database, this.path, "collection", [...this.filters, [key, value]]); }
  async get() { return this.database.snapshot(this); }
}
class FakeFirestore {
  documents = new Map();
  transactions = [];
  failNextCommit = false;
  collection(name) { return new FakeReference(this, name, "collection"); }
  snapshot(reference) {
    if (reference.kind === "document") {
      const value = copy(this.documents.get(reference.path));
      return { exists: value !== undefined, id: reference.id, ref: reference, data: () => copy(value) };
    }
    const depth = reference.path.split("/").length + 1;
    const docs = [...this.documents.entries()].filter(([pathname, value]) => pathname.startsWith(`${reference.path}/`) && pathname.split("/").length === depth && reference.filters.every(([key, match]) => value[key] === match))
      .map(([pathname]) => this.snapshot(new FakeReference(this, pathname)));
    return { docs, empty: !docs.length, size: docs.length };
  }
  async runTransaction(callback) {
    const operations = [];
    const reads = [];
    const transaction = {
      get: async (reference) => {
        assert.equal(operations.length, 0, `Firestore transaction read after write: ${reference.path}`);
        reads.push(reference.path);
        return this.snapshot(reference);
      },
      set: (reference, value, options = {}) => { operations.push({ type: "set", reference, value: copy(value), merge: options.merge }); },
      create: (reference, value) => { operations.push({ type: "create", reference, value: copy(value) }); },
      delete: (reference) => { operations.push({ type: "delete", reference }); },
    };
    const result = await callback(transaction);
    if (this.failNextCommit) { this.failNextCommit = false; throw new Error("Injected Firestore commit failure"); }
    const next = new Map([...this.documents.entries()].map(([key, value]) => [key, copy(value)]));
    for (const operation of operations) {
      const pathname = operation.reference.path;
      if (operation.type === "delete") next.delete(pathname);
      else {
        if (operation.type === "create") assert.equal(next.has(pathname), false, "Duplicate Firestore create");
        next.set(pathname, operation.merge ? { ...next.get(pathname), ...operation.value } : operation.value);
      }
    }
    this.documents = next;
    this.transactions.push({ reads, writes: operations.map((operation) => operation.reference.path) });
    return result;
  }
}

process.env.BANIK_STORAGE_ADAPTER = "firebase";
process.env.BANIK_TEAM_STORAGE_ADAPTER = "firebase";
process.env.BANIK_INVITE_EMAIL_API_URL = "";
const database = new FakeFirestore();
const require = createRequire(import.meta.url);
const client = require.resolve("../backend/firebase-admin-client.js");
require.cache[client] = { id: client, filename: client, loaded: true, exports: { getFirebaseAdminFirestore: () => database } };
const company = require("../backend/company-service.js");
const permission = require("../backend/company-permissions.js");
const journals = require("../backend/journal-service.js");
const adapter = require("../backend/adapters/firebase-admin-adapter.js");
const modules = Object.fromEntries(permission.MODULE_KEYS.map((key) => [key, true]));
const identity = (userId, email) => ({ userId, email, emailVerified: true, source: "firebase-admin", role: "user", workspaceId: "default" });
const ownerIdentity = identity("firebase-owner", "owner@example.com");
const juniorIdentity = identity("firebase-junior", "junior@example.com");
database.documents.set("users/firebase-owner", { email: ownerIdentity.email, companyName: "Firebase company", profileCompleted: true, permissions: modules });
database.documents.set("users/firebase-junior", { email: juniorIdentity.email, fullName: "Firebase Junior", accountType: "invited", profileCompleted: false, permissions: {} });
const owner = await company.resolveCompanyContext(ownerIdentity);
assert.deepEqual(await company.listCompanies(juniorIdentity), []);
const invitation = await company.createInvitation(owner, { email: juniorIdentity.email });
const token = new URL(invitation.inviteUrl, "https://example.com").searchParams.get("token");
await company.acceptInvitation(juniorIdentity, token);
const junior = await company.resolveCompanyContext(juniorIdentity, { headers: { "x-banik-company-id": owner.companyId } });
assert.equal(junior.userId, juniorIdentity.userId);
assert.equal(junior.storageUserId, ownerIdentity.userId);

database.documents.set("userData/firebase-owner/profile/companyLogo", { name: "logo.png", type: "image/png", chunkCount: 2 });
database.documents.set("userData/firebase-owner/profile/companyLogo/chunks/0001", { order: 1, data: "QUJD" });
database.documents.set("userData/firebase-owner/profile/companyLogo/chunks/0000", { order: 0, data: "data:image/png;base64," });
assert.equal((await company.getCompanyAsset(junior, "companyLogo")).dataUrl, "data:image/png;base64,QUJD");
await assert.rejects(() => company.getCompanyAsset(junior, "eSign"), (error) => error.statusCode === 404);

// Different ledger roots in the same Firebase project must not share teams.
const defaultCompanyDocument = [...database.documents.keys()].find((pathname) => pathname.startsWith("banikWorkspaceData_team_companies/"));
assert.ok(defaultCompanyDocument);
const originalCompany = copy(database.documents.get(defaultCompanyDocument));
process.env.BANIK_FIRESTORE_ROOT_COLLECTION = "stagingWorkspaceData";
const stagingOwner = await company.resolveCompanyContext(ownerIdentity);
assert.equal(stagingOwner.companyRole, "owner");
assert.deepEqual(await company.listCompanies(juniorIdentity), []);
assert.ok([...database.documents.keys()].some((pathname) => pathname.startsWith("stagingWorkspaceData_team_companies/")));
assert.deepEqual(database.documents.get(defaultCompanyDocument), originalCompany);
delete process.env.BANIK_FIRESTORE_ROOT_COLLECTION;
process.env.BANIK_TEAM_COLLECTION_PREFIX = "../invalid";
await assert.rejects(() => company.listCompanies(ownerIdentity), /BANIK_TEAM_COLLECTION_PREFIX/);
delete process.env.BANIK_TEAM_COLLECTION_PREFIX;
assert.equal((await company.listCompanies(juniorIdentity)).length, 1);

const scopePath = `banikWorkspaceData/${Buffer.from("firebase-owner::default").toString("base64url")}`;
const legacyChartPath = "userData/firebase-owner/settings/chartOfAccounts";
database.documents.set(legacyChartPath, { items: [{ id: "cash", type: "ledger", name: "Cash", openingBalance: 100 }] });
assert.equal((await adapter.listCollection("chartOfAccounts", junior))[0].name, "Cash");
assert.ok(database.documents.has(legacyChartPath));
assert.ok(database.documents.has(`${scopePath}/_migrations/legacy-chartOfAccounts`));
const migration = database.transactions.find((transaction) => transaction.writes.includes(`${scopePath}/_migrations/legacy-chartOfAccounts`));
assert.ok(migration.reads.includes(scopePath));
assert.ok(migration.writes.includes(scopePath));

const balanced = { journalDate: "2026-10-05", lines: [{ account: "Cash", debit: 10, credit: 0 }, { account: "Capital", debit: 0, credit: 10 }] };
const first = await journals.createJournal(junior, balanced);
assert.equal(first.createdBy, juniorIdentity.userId);
assert.ok(database.documents.has(`${scopePath}/journals/${first.id}`));
assert.equal((await adapter.listCollection("activity", owner)).length, 1);
const beforeFailure = copy([...database.documents.entries()]);
database.failNextCommit = true;
await assert.rejects(() => journals.createJournal(junior, balanced), /Injected Firestore commit failure/);
assert.deepEqual([...database.documents.entries()], beforeFailure);
await journals.createJournal(junior, balanced);

const restoreIdentity = identity("firebase-restore-owner", "restore@example.com");
database.documents.set("users/firebase-restore-owner", { email: restoreIdentity.email, companyName: "Restore company", profileCompleted: true, permissions: modules });
database.documents.set("userData/firebase-restore-owner/settings/chartOfAccounts", { items: [{ id: "legacy-account", type: "ledger", name: "Legacy account" }] });
database.documents.set("userData/firebase-restore-owner/challans/legacy-challan", { challanNumber: "LEGACY-01" });
const restoreContext = await company.resolveCompanyContext(restoreIdentity);
let seenBefore;
await adapter.importScope((before) => {
  seenBefore = before;
  return { journals: [], parties: [], chartOfAccounts: [], challans: [], settings: [] };
}, restoreContext);
assert.equal(seenBefore.chartOfAccounts.length, 1);
assert.equal(seenBefore.challans.length, 1);
assert.equal((await adapter.listCollection("chartOfAccounts", restoreContext)).length, 0);
assert.equal((await adapter.listCollection("challans", restoreContext)).length, 0);
assert.ok(database.documents.has("userData/firebase-restore-owner/challans/legacy-challan"));
assert.equal((await adapter.listCollection("journals", restoreContext)).length, 0);

// Entitlement changes are re-read, even for a company owner and existing member.
database.documents.set("users/firebase-owner", { ...database.documents.get("users/firebase-owner"), permissions: { ...modules, "journal-entry": false } });
const restrictedOwner = await company.resolveCompanyContext(ownerIdentity, { headers: { "x-banik-company-id": owner.companyId } });
const restrictedJunior = await company.resolveCompanyContext(juniorIdentity, { headers: { "x-banik-company-id": owner.companyId } });
assert.equal(restrictedOwner.permissions["journals.create"], false);
assert.equal(restrictedOwner.permissions["team.manage"], true);
assert.equal(restrictedJunior.permissions["journals.create"], false);
await company.updateMember(restrictedOwner, juniorIdentity.userId, { status: "suspended" });
await assert.rejects(() => company.resolveCompanyContext(juniorIdentity, { headers: { "x-banik-company-id": owner.companyId } }), (error) => error.statusCode === 403);
console.log("Firebase contract checks passed: transaction read ordering, scope paths, legacy migration, atomic failure, restore and permission refresh (offline fake, not emulator).");
