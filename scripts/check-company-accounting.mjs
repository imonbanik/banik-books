import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const directory = await fs.mkdtemp(path.join(os.tmpdir(), "banik-company-accounting-"));
process.env.BANIK_STORAGE_ADAPTER = "file";
process.env.BANIK_TEAM_STORAGE_ADAPTER = "file";
process.env.BANIK_DATA_FILE = path.join(directory, "ledger.json");
process.env.BANIK_TEAM_DATA_FILE = path.join(directory, "team.json");
process.env.BANIK_INVITE_EMAIL_API_URL = "";
const require = createRequire(import.meta.url);
const company = require("../backend/company-service.js");
const journals = require("../backend/journal-service.js");
const collections = require("../backend/collection-service.js");
const backups = require("../backend/backup-service.js");
const adapter = require("../backend/adapters/file-adapter.js");

const identity = (userId, email, profile = {}) => ({ userId, email, emailVerified: true, fullName: userId, source: "local-dev-test", role: "user", workspaceId: "default", profile });
const ownerIdentity = identity("owner", "owner@example.com", { companyName: "Accounting test company", profileCompleted: true });
const juniorIdentity = identity("junior", "junior@example.com", { accountType: "invited" });
const headersFor = (companyId) => ({ headers: { "x-banik-company-id": companyId } });
const balanced = { journalDate: "2026-10-05", description: "A balanced transaction", lines: [{ account: "Cash", debit: 125, credit: 0 }, { account: "Capital", debit: 0, credit: 125 }] };
const eventCount = async (context) => (await adapter.listCollection("activity", context)).length;
const rejectStatus = (callback, status) => assert.rejects(callback, (error) => error.statusCode === status);

try {
  // Existing records keep their original storage scope and are explicitly historical.
  await adapter.replaceCollection("journals", [{ ...balanced, number: "JV-00000100" }], ownerIdentity);
  const owner = await company.resolveCompanyContext(ownerIdentity);
  const legacy = await journals.getJournal(owner, "JV-00000100");
  assert.equal(legacy.legacy, true);
  assert.equal(legacy.createdBy, null);
  assert.equal(legacy.status, "posted");
  const invitation = await company.createInvitation(owner, { email: juniorIdentity.email, role: "junior" });
  const token = new URL(invitation.inviteUrl, "https://example.com").searchParams.get("token");
  await company.acceptInvitation(juniorIdentity, token);
  const junior = await company.resolveCompanyContext(juniorIdentity, headersFor(owner.companyId));
  const otherOwner = await company.resolveCompanyContext(identity("other-owner", "other@example.com", { profileCompleted: true }));

  const first = await journals.createJournal(junior, { ...balanced, status: "draft", createdBy: owner.userId, createdAt: "1900-01-01", companyId: otherOwner.companyId, number: "HACKED" });
  assert.equal(first.createdBy, junior.userId);
  assert.equal(first.companyId, owner.companyId);
  assert.notEqual(first.createdAt, "1900-01-01");
  assert.notEqual(first.number, "HACKED");
  assert.equal((await journals.listJournals(otherOwner)).length, 0);
  assert.equal((await journals.listJournals(junior)).length, 1);
  await rejectStatus(() => journals.getJournal(junior, legacy.id), 403);
  const beforeFailure = await eventCount(owner);
  await rejectStatus(() => journals.createJournal(junior, { ...balanced, status: "posted" }), 403);
  assert.equal(await eventCount(owner), beforeFailure);

  // Allocation must remain unique when several people submit at the same time.
  const simultaneous = await Promise.all(Array.from({ length: 12 }, (_, index) => journals.createJournal(index % 2 ? owner : junior, { ...balanced, requestId: `concurrent-${index}` })));
  assert.equal(new Set(simultaneous.map((item) => item.number)).size, 12);
  assert.equal(new Set(simultaneous.map((item) => item.id)).size, 12);
  const requestCount = await eventCount(owner);
  const repeated = await Promise.all([journals.createJournal(junior, { ...balanced, requestId: "same-create" }), journals.createJournal(junior, { ...balanced, requestId: "same-create" })]);
  assert.equal(repeated[0].id, repeated[1].id);
  assert.equal(await eventCount(owner), requestCount + 1);

  // Exactly one stale competing edit may win; protected actor fields are ignored.
  const edits = await Promise.allSettled([
    journals.updateJournal(junior, first.id, { expectedVersion: first.version, item: { description: "Edit one", createdBy: owner.userId } }),
    journals.updateJournal(junior, first.id, { expectedVersion: first.version, item: { description: "Edit two" } }),
  ]);
  assert.equal(edits.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(edits.filter((result) => result.status === "rejected" && result.reason.statusCode === 409).length, 1);
  let current = await journals.getJournal(junior, first.id);
  assert.equal(current.createdBy, junior.userId);
  const submitted = await journals.actOnJournal(junior, first.id, { action: "submit", expectedVersion: current.version });
  assert.equal(submitted.item.status, "submitted");
  assert.equal((await journals.listJournals(owner, { reports: true })).some((entry) => entry.id === first.id), false);
  await rejectStatus(() => journals.updateJournal(junior, first.id, { expectedVersion: submitted.item.version, item: { description: "Change after submission" } }), 409);
  const posted = await journals.actOnJournal(owner, first.id, { action: "post", expectedVersion: submitted.item.version, requestId: "approve-one" });
  assert.equal(posted.item.createdBy, junior.userId);
  assert.equal(posted.item.approvedBy, owner.userId);
  assert.equal(posted.item.postedBy, owner.userId);
  const approvedEvents = await eventCount(owner);
  const repeatedApproval = await journals.actOnJournal(owner, first.id, { action: "post", expectedVersion: submitted.item.version, requestId: "approve-one" });
  assert.equal(repeatedApproval.item.version, posted.item.version);
  assert.equal(await eventCount(owner), approvedEvents);
  assert.equal((await journals.listJournals(owner, { reports: true })).some((entry) => entry.id === first.id), true);
  await rejectStatus(() => journals.updateJournal(owner, first.id, { expectedVersion: posted.item.version, item: { description: "Tamper with posted entry" } }), 409);

  const reversal = await journals.actOnJournal(owner, first.id, { action: "reverse", expectedVersion: posted.item.version, reason: "Correction", journalDate: "2026-10-06" });
  assert.equal(reversal.item.status, "posted");
  assert.equal(reversal.reversal.reversalOfId, first.id);
  const netByAccount = {};
  for (const item of [reversal.item, reversal.reversal]) for (const line of item.lines) netByAccount[line.account] = (netByAccount[line.account] || 0) + line.debit - line.credit;
  assert.ok(Object.values(netByAccount).every((value) => value === 0));
  await rejectStatus(() => journals.actOnJournal(owner, first.id, { action: "reverse", expectedVersion: reversal.item.version, reason: "Duplicate reversal" }), 409);

  const ownSubmittedDraft = await journals.createJournal(owner, balanced);
  const ownSubmitted = await journals.actOnJournal(owner, ownSubmittedDraft.id, { action: "submit", expectedVersion: ownSubmittedDraft.version });
  await rejectStatus(() => journals.actOnJournal(owner, ownSubmittedDraft.id, { action: "post", expectedVersion: ownSubmitted.item.version }), 403);

  // A persistence failure must commit neither a business record nor its event.
  const persistedJournals = await adapter.listCollection("journals", owner);
  const persistedActivity = await adapter.listCollection("activity", owner);
  const originalRename = fs.rename;
  fs.rename = async () => { throw Object.assign(new Error("Injected atomic-write failure"), { code: "EIO" }); };
  try { await assert.rejects(() => journals.createJournal(owner, { ...balanced, requestId: "failed-disk-write" }), /Injected atomic-write failure/); }
  finally { fs.rename = originalRename; }
  assert.deepEqual(await adapter.listCollection("journals", owner), persistedJournals);
  assert.deepEqual(await adapter.listCollection("activity", owner), persistedActivity);
  await journals.createJournal(owner, { ...balanced, requestId: "works-after-failure" });

  const party = await collections.saveItem("parties", "party-a", { id: "party-a", type: "Customer", fields: { customerName: "Example" }, createdBy: "forged" }, owner);
  assert.equal(party.createdBy, owner.userId);
  await rejectStatus(() => collections.saveItem("parties", party.id, { ...party, version: party.version - 1 }, owner), 409);
  const unversionedParty = { ...party }; delete unversionedParty.version;
  await rejectStatus(() => collections.saveItem("parties", party.id, unversionedParty, owner), 409);
  const partyRevision = collections.revisionOf(await collections.listItems("parties", owner));
  await collections.saveItem("parties", "party-b", { id: "party-b", type: "Supplier", fields: {} }, owner);
  await rejectStatus(() => collections.replaceItems("parties", [party], owner, partyRevision), 409);

  const exported = await backups.exportBackup(owner);
  const retainedEvents = (await adapter.listCollection("activity", owner)).map((event) => event.id);
  const changed = structuredClone(exported);
  changed.activity = [{ id: "forged-event", actorId: "forged" }];
  changed.data.journals.push({ ...balanced, id: "restored-new", number: "JV-00007000", status: "posted", createdBy: "forged", postedBy: "forged", approvedBy: "forged", updatedBy: "forged", reversalJournalId: "forged-reversal", reversedBy: "forged", version: 999 });
  changed.data.parties.push({ id: "restored-party", type: "Customer", fields: {}, createdBy: "forged", updatedBy: "forged", approvedBy: "forged", companyId: otherOwner.companyId });
  changed.data.challans.push({ id: "restored-challan", challanNumber: "CH-01", createdBy: "forged", updatedBy: "forged" });
  changed.data.settings.push({ id: "restored-setting", value: {}, createdBy: "forged", updatedBy: "forged" });
  await backups.importBackup(changed, owner);
  const restored = await journals.getJournal(owner, "restored-new");
  assert.equal(restored.createdBy, null);
  assert.notEqual(restored.postedBy, "forged");
  assert.notEqual(restored.approvedBy, "forged");
  assert.equal(restored.updatedBy, owner.userId);
  assert.equal(restored.version, 1);
  assert.equal(restored.reversalJournalId, undefined);
  assert.equal(restored.reversedBy, undefined);
  assert.equal((await journals.getJournal(owner, first.id)).reversedBy, owner.userId);
  for (const [name, id] of [["parties", "restored-party"], ["challans", "restored-challan"], ["settings", "restored-setting"]]) {
    const record = await collections.getItem(name, id, owner);
    assert.equal(record.createdBy, null);
    assert.equal(record.updatedBy, owner.userId);
    assert.equal(record.companyId, owner.companyId);
    assert.notEqual(record.approvedBy, "forged");
  }
  const afterRestoreEvents = await adapter.listCollection("activity", owner);
  assert.ok(retainedEvents.every((id) => afterRestoreEvents.some((event) => event.id === id)));
  assert.ok(!afterRestoreEvents.some((event) => event.id === "forged-event"));
  assert.equal(afterRestoreEvents.at(-1).action, "backup.restored");
  await rejectStatus(() => backups.importBackup(changed, junior), 403);
  await rejectStatus(() => backups.importBackup(changed, otherOwner), 400);
  const restoredCount = await eventCount(owner);
  for (const invalid of [
    { status: "unknown", lines: [{ account: "Cash", debit: 5, credit: 0 }] },
    { status: "posted", lines: [{ account: "Cash", debit: 5, credit: 0 }] },
    { status: "submitted", lines: [{ account: "Cash", debit: 5, credit: 0 }] },
    { status: "posted", lines: [{ account: "Cash", debit: -5, credit: 0 }, { account: "Capital", debit: 0, credit: -5 }] },
    { number: `JV-${"9".repeat(400)}` },
  ]) {
    const invalidBackup = structuredClone(changed);
    Object.assign(invalidBackup.data.journals.at(-1), invalid);
    await rejectStatus(() => backups.importBackup(invalidBackup, owner), 400);
    assert.equal(await eventCount(owner), restoredCount);
  }
  // Unsafe legacy numbering cannot cause an infinite allocator loop.
  await adapter.replaceCollection("journals", [{ ...balanced, id: "unsafe-number", number: `JV-${"9".repeat(400)}` }], otherOwner);
  await rejectStatus(() => journals.createJournal(otherOwner, balanced), 409);
  assert.ok((await journals.listJournals(owner, { reports: true })).every((entry) => entry.status === "posted"));
  console.log("Company accounting checks passed: preserved legacy scope, isolated actors, concurrency, approvals, reversal, atomic failure and audited restore.");
} finally {
  await fs.rm(directory, { recursive: true, force: true });
}
