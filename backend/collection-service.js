const { createHash } = require("node:crypto");
const { getStorageAdapter } = require("./storage-adapter");
const { validateCollection, validateItem } = require("./validators");
const { createActivity } = require("./audit-service");
const { companyError } = require("./company-permissions");

const idOf = (item) => item?.id || item?.number;
const revisionOf = (items) => createHash("sha256").update(JSON.stringify(items)).digest("hex");
async function listItems(name, context) { return getStorageAdapter().listCollection(name, context); }
async function getItem(name, id, context) { return getStorageAdapter().getItem(name, id, context); }

function trustedItem(input, before, context) {
  const clean = { ...input };
  for (const key of ["createdBy", "createdByName", "createdAt", "updatedBy", "updatedByName", "updatedAt", "companyId", "version"]) delete clean[key];
  const now = new Date().toISOString();
  return { ...clean, companyId: context.companyId,
    createdBy: before ? before.createdBy || null : context.userId,
    createdByName: before ? before.createdByName || "Legacy record — creator unavailable" : context.name || context.email || context.userId,
    createdAt: before ? before.createdAt || null : now,
    updatedBy: context.userId, updatedByName: context.name || context.email || context.userId, updatedAt: now,
    version: Number(before?.version || 0) + 1 };
}

async function replaceItems(name, items, context, expectedRevision) {
  validateCollection(name, items);
  const adapter = getStorageAdapter();
  if (!context.companyId) return adapter.replaceCollection(name, items, context);
  return adapter.mutateCollection(name, context, (before) => {
    if (!expectedRevision || revisionOf(before) !== expectedRevision) throw companyError(409, "This company data has changed. Reload before saving.");
    const next = name === "chartOfAccounts" ? items : items.map((item) => trustedItem(item, before.find((old) => idOf(old) === idOf(item)), context));
    return { items: next, result: next, event: createActivity(context, name, name, `${name}.replaced`, before, next) };
  });
}
async function saveItem(name, id, item, context) {
  validateItem(name, item);
  if (item.id && item.id !== id) throw companyError(400, "Item id does not match the request.");
  const adapter = getStorageAdapter();
  if (!context.companyId) return adapter.upsertItem(name, id, item, context);
  return adapter.mutateCollection(name, context, (items) => {
    const index = items.findIndex((entry) => idOf(entry) === id);
    const before = index >= 0 ? items[index] : null;
    if (!before && item.version !== undefined) throw companyError(409, "This record was removed. Reload before creating a new record.");
    if (before && item.version !== Number(before.version || 0)) throw companyError(409, "This record has changed. Reload before saving.");
    const next = trustedItem({ ...before, ...item, id }, before, context);
    if (index >= 0) items[index] = next; else items.push(next);
    return { items, result: next, event: createActivity(context, name, id, `${name}.${before ? "updated" : "created"}`, before, next) };
  });
}
async function removeItem(name, id, context, expectedVersion) {
  const adapter = getStorageAdapter();
  if (!context.companyId) return adapter.deleteItem(name, id, context);
  return adapter.mutateCollection(name, context, (items) => {
    const before = items.find((entry) => idOf(entry) === id);
    if (!before) throw companyError(404, "Record not found.");
    if (expectedVersion !== Number(before.version || 0)) throw companyError(409, "This record has changed. Reload before deleting.");
    const next = items.filter((entry) => idOf(entry) !== id);
    return { items: next, result: next, event: createActivity(context, name, id, `${name}.deleted`, before, null) };
  });
}
module.exports = { getItem, listItems, removeItem, replaceItems, saveItem, revisionOf };
