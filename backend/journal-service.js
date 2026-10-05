const { randomUUID } = require("node:crypto");
const { getStorageAdapter } = require("./storage-adapter");
const { hasCompanyPermission: can, assertCompanyPermission: requirePermission, companyError } = require("./company-permissions");
const { createActivity } = require("./audit-service");

const idOf = (journal) => journal.id || journal.number;
const statusOf = (journal) => journal.status || "posted";
const actorName = (context) => context.name || context.fullName || context.email || context.userId;
function normalized(journal) {
  return { ...journal, id: idOf(journal), status: statusOf(journal), version: Number(journal.version || 0),
    ...(!journal.createdBy ? { legacy: true, createdBy: null, createdByName: "Legacy record — creator unavailable" } : {}) };
}
function canRead(context, journal, reports = false) {
  if (reports) return statusOf(journal) === "posted";
  return can(context, "journals.viewAll") || can(context, "journals.approve") ||
    ((can(context, "journals.create") || can(context, "journals.editOwn") || can(context, "journals.submit")) && journal.createdBy === context.userId);
}
function assertReadable(context, journal) {
  if (!canRead(context, journal)) throw companyError(403, "You cannot access this journal.");
}
function assertEditable(context, journal) {
  if (!["draft", "returned"].includes(statusOf(journal))) throw companyError(409, "Only draft or returned journals can be edited. Posted journals require a reversal.");
  if (!can(context, "journals.editAll") && !(journal.createdBy === context.userId && can(context, "journals.editOwn"))) {
    throw companyError(403, "You cannot edit this journal.");
  }
}
function assertVersion(journal, expectedVersion) {
  if (!Number.isInteger(expectedVersion) || expectedVersion !== Number(journal.version || 0)) {
    throw companyError(409, "This journal has changed. Reload it before saving your changes.");
  }
}
function contentFrom(item = {}) {
  const result = {};
  for (const key of ["journalDate", "accountingBasis", "description", "reference", "lines", "attachments", "currency"]) {
    if (Object.hasOwn(item, key)) result[key] = item[key];
  }
  if (result.description && String(result.description).length > 10000) throw companyError(400, "Journal description is too long.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result.journalDate || "") || !Number.isFinite(Date.parse(`${result.journalDate}T00:00:00Z`)) || new Date(`${result.journalDate}T00:00:00Z`).toISOString().slice(0, 10) !== result.journalDate) throw companyError(400, "A valid journal date is required.");
  if (!Array.isArray(result.lines) || result.lines.length > 500) throw companyError(400, "Journal lines must be an array with at most 500 lines.");
  result.lines = result.lines.map((line) => {
    if (!line || typeof line !== "object") throw companyError(400, "Invalid journal line.");
    const debit = Number(line.debit || 0);
    const credit = Number(line.credit || 0);
    if (![debit, credit].every((amount) => Number.isFinite(amount) && amount >= 0 && amount <= 1e12)) throw companyError(400, "Journal amounts must be valid non-negative numbers.");
    if ([debit, credit].some((amount) => Math.abs(amount * 100 - Math.round(amount * 100)) > 0.001)) throw companyError(400, "Journal amounts support at most two decimal places.");
    if (debit && credit) throw companyError(400, "A journal line can have a debit or credit, not both.");
    return { account: String(line.account || "").trim(), debit, credit, description: String(line.description || ""), name: String(line.name || ""), partyId: String(line.partyId || "") };
  });
  return result;
}
function assertBalanced(journal) {
  const lines = journal.lines || [];
  if (lines.length < 2 || lines.some((line) => !line.account || !(line.debit || line.credit))) throw companyError(400, "Posting requires at least two complete journal lines.");
  const debit = lines.reduce((sum, line) => sum + Math.round(line.debit * 100), 0);
  const credit = lines.reduce((sum, line) => sum + Math.round(line.credit * 100), 0);
  if (!Number.isSafeInteger(debit) || !Number.isSafeInteger(credit) || debit <= 0 || debit !== credit) throw companyError(400, "Debits and credits must balance before submission or posting.");
}
function nextNumber(items) {
  let next = items.reduce((max, item) => {
    const match = /^JV[-_]?(\d+)$/i.exec(String(item.number || ""));
    if (!match) return max;
    const sequence = Number(match[1]);
    if (!Number.isSafeInteger(sequence) || sequence >= 999999999999) throw companyError(409, "The journal sequence is outside the supported range. Review the imported journal numbers.");
    return Math.max(max, sequence);
  }, 0) + 1;
  const used = new Set(items.map((item) => item.number));
  while (used.has(`JV-${String(next).padStart(8, "0")}`)) next += 1;
  return `JV-${String(next).padStart(8, "0")}`;
}
function timestampFields(context, prefix, now) {
  return { [`${prefix}By`]: context.userId, [`${prefix}ByName`]: actorName(context), [`${prefix}At`]: now };
}
async function listJournals(context, { reports = false, report = "" } = {}) {
  if (reports && !can(context, "reports.view")) {
    if (!report || !can(context, `reports.${report}`)) throw companyError(403, "You do not have access to this report.");
  }
  if (!reports && !["journals.viewAll", "journals.create", "journals.editOwn", "journals.submit", "journals.approve"].some((key) => can(context, key))) throw companyError(403, "Journal access is not enabled for this company member.");
  const items = await getStorageAdapter().listCollection("journals", context);
  return items.filter((journal) => statusOf(journal) !== "archived" && canRead(context, journal, reports)).map(normalized);
}
async function getJournal(context, id) {
  const journal = await getStorageAdapter().getItem("journals", id, context);
  if (!journal) throw companyError(404, "Journal not found.");
  assertReadable(context, journal);
  return normalized(journal);
}
async function createJournal(context, payload) {
  requirePermission(context, "journals.create");
  const content = contentFrom(payload.item || payload);
  const status = (payload.item || payload).status === "posted" ? "posted" : "draft";
  if (status === "posted") { requirePermission(context, "journals.post"); assertBalanced(content); }
  const requestId = String(payload.requestId || randomUUID()).slice(0, 128);
  return getStorageAdapter().mutateCollection("journals", context, (items) => {
    const existing = items.find((item) => item.creationRequestId === requestId && item.createdBy === context.userId);
    if (existing) return { items, result: normalized(existing) };
    const now = new Date().toISOString();
    const journal = { ...content, id: randomUUID(), number: nextNumber(items), companyId: context.companyId,
      status, version: 1, creationRequestId: requestId,
      ...timestampFields(context, "created", now), ...timestampFields(context, "updated", now),
      ...(status === "posted" ? timestampFields(context, "posted", now) : {}),
    };
    items.push(journal);
    return { items, result: journal, event: createActivity(context, "journals", journal.id, status === "posted" ? "journal.created-and-posted" : "journal.created", null, journal, { requestId }) };
  });
}
async function updateJournal(context, id, payload) {
  return getStorageAdapter().mutateCollection("journals", context, (items) => {
    const index = items.findIndex((item) => idOf(item) === id);
    if (index < 0) throw companyError(404, "Journal not found.");
    const before = items[index];
    assertEditable(context, before);
    assertVersion(before, payload.expectedVersion);
    const content = contentFrom({ ...before, ...(payload.item || {}) });
    const journal = { ...before, ...content, ...timestampFields(context, "updated", new Date().toISOString()), version: Number(before.version || 0) + 1 };
    items[index] = journal;
    return { items, result: normalized(journal), event: createActivity(context, "journals", id, "journal.updated", before, journal) };
  });
}
async function actOnJournal(context, id, payload) {
  const action = String(payload.action || "");
  if (!["submit", "post", "return", "reverse", "archive"].includes(action)) throw companyError(400, "Unknown journal action.");
  return getStorageAdapter().mutateCollection("journals", context, (items) => {
    const index = items.findIndex((item) => idOf(item) === id);
    if (index < 0) throw companyError(404, "Journal not found.");
    const before = items[index];
    assertReadable(context, before);
    if (payload.requestId && before.lastActionRequestId === payload.requestId && before.lastActionBy === context.userId && before.lastAction === action) {
      return { items, result: { item: normalized(before), ...(before.reversalJournalId ? { reversal: items.find((item) => idOf(item) === before.reversalJournalId) } : {}) } };
    }
    assertVersion(before, payload.expectedVersion);
    const now = new Date().toISOString();
    const journal = { ...before, ...timestampFields(context, "updated", now), version: Number(before.version || 0) + 1,
      lastAction: action, lastActionBy: context.userId, lastActionRequestId: String(payload.requestId || randomUUID()).slice(0, 128) };
    const reason = String(payload.reason || "").trim().slice(0, 2000);
    let reversal;
    if (action === "submit") {
      requirePermission(context, "journals.submit"); assertEditable(context, before); assertBalanced(journal);
      journal.status = "submitted"; Object.assign(journal, timestampFields(context, "submitted", now));
    } else if (action === "post" || action === "return") {
      if (statusOf(before) === "submitted") {
        requirePermission(context, "journals.approve");
        if ([before.createdBy, before.submittedBy].includes(context.userId)) throw companyError(403, "A submitted journal must be reviewed by a different person.");
        if (action === "post") Object.assign(journal, timestampFields(context, "approved", now));
      } else {
        if (action === "return") throw companyError(409, "Only submitted journals can be returned.");
        requirePermission(context, "journals.post"); assertEditable(context, before);
      }
      if (action === "post") {
        assertBalanced(journal); journal.status = "posted"; Object.assign(journal, timestampFields(context, "posted", now));
      } else {
        if (!reason) throw companyError(400, "A reason is required when returning a journal.");
        journal.status = "returned"; journal.returnReason = reason; Object.assign(journal, timestampFields(context, "returned", now));
      }
    } else if (action === "archive") {
      assertEditable(context, before); journal.status = "archived"; Object.assign(journal, timestampFields(context, "archived", now));
    } else {
      requirePermission(context, "journals.reverse");
      if (statusOf(before) !== "posted" || before.reversalJournalId) throw companyError(409, "This journal cannot be reversed again.");
      if (!reason) throw companyError(400, "A reason is required for reversal.");
      const date = payload.journalDate || new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(new Date());
      const content = contentFrom({ ...before, journalDate: date, description: `Reversal of ${before.number}: ${reason}`, attachments: [], lines: (before.lines || []).map((line) => ({ ...line, debit: line.credit, credit: line.debit })) });
      assertBalanced(content);
      reversal = { ...content, id: randomUUID(), number: nextNumber(items), companyId: context.companyId, status: "posted", version: 1, reversalOf: before.number, reversalOfId: id,
        ...timestampFields(context, "created", now), ...timestampFields(context, "updated", now), ...timestampFields(context, "posted", now) };
      journal.reversalJournalId = reversal.id; journal.reversalJournalNumber = reversal.number; journal.reversalReason = reason;
      Object.assign(journal, timestampFields(context, "reversed", now));
      items.push(reversal);
    }
    items[index] = journal;
    const event = createActivity(context, "journals", id, `journal.${action === "post" ? "posted" : action === "submit" ? "submitted" : action === "return" ? "returned" : action === "archive" ? "archived" : "reversed"}`, before, journal, { reason, requestId: journal.lastActionRequestId });
    const events = [event];
    if (reversal) events.push(createActivity(context, "journals", reversal.id, "journal.reversal-created", null, reversal, { reason }));
    return { items, result: { item: normalized(journal), ...(reversal ? { reversal } : {}) }, events };
  });
}

module.exports = { listJournals, getJournal, createJournal, updateJournal, actOnJournal, normalized, canRead, assertBalanced, contentFrom };
