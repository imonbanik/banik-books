const { getStorageAdapter } = require("./storage-adapter");
const { validateCollection } = require("./validators");
const { createActivity } = require("./audit-service");
const { contentFrom, assertBalanced } = require("./journal-service");
const { companyError } = require("./company-permissions");
const BACKUP_VERSION = 1;
const BACKUP_COLLECTIONS = Object.freeze(["journals", "parties", "chartOfAccounts", "challans", "settings"]);
function normalizeBackupPayload(payload) {
  const source = payload && typeof payload === "object" ? payload : {};
  const data = source.data && typeof source.data === "object" ? source.data : source;
  return Object.fromEntries(BACKUP_COLLECTIONS.map((name) => [name, Array.isArray(data[name]) ? data[name] : []]));
}
async function exportBackup(context) {
  const adapter = getStorageAdapter();
  const data = await adapter.exportScope(context);
  return { version: BACKUP_VERSION, exportedAt: new Date().toISOString(), workspaceId: context.workspaceId,
    ...(context.companyId ? { companyId: context.companyId, companyName: context.companyName, activity: await adapter.listCollection("activity", context) } : {}), data: normalizeBackupPayload(data) };
}
function normalizeRestoredData(data, before, context) {
  const now = new Date().toISOString();
  const journals = data.journals.map((source) => {
    const old = before.journals.find((item) => (item.id || item.number) === (source.id || source.number));
    const content = contentFrom(source);
    const status = source.status === undefined ? "posted" : source.status;
    if (!["draft", "submitted", "returned", "posted", "archived"].includes(status)) throw companyError(400, "Backup contains an invalid journal status.");
    if (["posted", "submitted"].includes(status)) assertBalanced(content);
    const numericNumber = /^JV[-_]?(\d+)$/i.exec(String(source.number));
    if (numericNumber && (!Number.isSafeInteger(Number(numericNumber[1])) || Number(numericNumber[1]) >= 999999999999)) throw companyError(400, "Backup journal number is outside the supported range.");
    const next = { ...content, number: source.number, id: source.id || source.number, companyId: context.companyId };
    for (const key of Object.keys(next)) {
      if (/^(created|updated|submitted|approved|posted|returned|archived|reversed)(By|At)|RequestId|lastAction|^version$/.test(key)) delete next[key];
    }
    for (const key of ["reversalJournalId", "reversalJournalNumber", "reversalReason", "reversedBy", "reversedByName", "reversedAt", "reversalOf", "reversalOfId"]) {
      if (old && Object.hasOwn(old, key)) next[key] = old[key];
    }
    for (const key of ["createdBy", "createdByName", "createdAt", "submittedBy", "submittedByName", "submittedAt", "approvedBy", "approvedByName", "approvedAt", "postedBy", "postedByName", "postedAt"]) {
      if (old && Object.hasOwn(old, key)) next[key] = old[key];
    }
    if (!old?.createdBy) { next.createdBy = null; next.createdByName = "Imported record — historical creator unavailable"; next.legacy = true; }
    next.status = status;
    next.version = Number(old?.version || 0) + 1;
    next.importedBy = context.userId; next.importedAt = now;
    next.updatedBy = context.userId; next.updatedByName = context.fullName || context.email || context.userId; next.updatedAt = now;
    return next;
  });
  const ids = journals.map((item) => item.id);
  const numbers = journals.map((item) => item.number);
  if (new Set(ids).size !== ids.length || new Set(numbers).size !== numbers.length) throw companyError(400, "Backup contains duplicate journal ids or numbers.");
  const result = { ...data, journals };
  for (const collection of ["parties", "challans", "settings"]) {
    result[collection] = data[collection].map((source) => {
      const old = before[collection].find((item) => item.id === source.id);
      const clean = { ...source };
      for (const key of Object.keys(clean)) {
        if (/^(created|updated|submitted|approved|posted|returned|archived|reversed)(By|At)|RequestId|lastAction|^version$/.test(key)) delete clean[key];
      }
      return { ...clean, companyId: context.companyId, createdBy: old?.createdBy || null,
        createdByName: old?.createdByName || "Imported record — historical creator unavailable", createdAt: old?.createdAt || null,
        version: Number(old?.version || 0) + 1, importedBy: context.userId, importedAt: now,
        updatedBy: context.userId, updatedByName: context.fullName || context.email || context.userId, updatedAt: now };
    });
  }
  return result;
}
async function importBackup(payload, context) {
  const adapter = getStorageAdapter();
  const data = normalizeBackupPayload(payload);
  if (context.companyId) {
    if (context.companyRole !== "owner") throw companyError(403, "Only the company owner can restore a backup.");
    if (!payload?.data || BACKUP_COLLECTIONS.some((name) => !Array.isArray(payload.data[name]))) throw companyError(400, "A complete company backup is required. All five collections must be present.");
    if (payload.companyId && payload.companyId !== context.companyId) throw companyError(400, "This backup belongs to another company.");
  }
  for (const name of BACKUP_COLLECTIONS) validateCollection(name, data[name]);
  if (context.companyId) {
    await adapter.importScope((before) => normalizeRestoredData(data, before, context), context,
      (before, after) => createActivity(context, "backup", context.companyId, "backup.restored", before, after));
  } else await adapter.importScope(data, context);
  return exportBackup(context);
}
module.exports = { BACKUP_COLLECTIONS, exportBackup, importBackup };
