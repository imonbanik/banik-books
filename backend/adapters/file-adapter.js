const fs = require("node:fs/promises");
const path = require("node:path");
const { randomUUID } = require("node:crypto");

const DATA_FILE = process.env.BANIK_DATA_FILE || path.join(__dirname, "..", "..", "data", "app-data.json");
const COLLECTIONS = ["journals", "parties", "chartOfAccounts", "challans", "settings"];
const emptyScope = () => Object.fromEntries([...COLLECTIONS, "activity"].map((key) => [key, []]));
let writeQueue = Promise.resolve();

async function readData() {
  try {
    return JSON.parse(await fs.readFile(DATA_FILE, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return { ...emptyScope(), scopes: {} };
    throw error; // Never replace an unreadable ledger with an empty database.
  }
}

function getScopeKey(context = {}) {
  return `${context.storageUserId || context.userId || "local-dev"}::${context.storageWorkspaceId || context.workspaceId || "default"}`;
}

function getScopedData(data, context) {
  const key = getScopeKey(context);
  return { ...emptyScope(), ...(data.scopes?.[key] || (key === "local-dev::default" ? data : {})) };
}

async function transaction(context, mutate) {
  const operation = writeQueue.then(async () => {
    const data = await readData();
    const scope = getScopedData(data, context);
    const result = await mutate(scope);
    const next = { ...data, scopes: { ...data.scopes, [getScopeKey(context)]: scope }, updatedAt: new Date().toISOString() };
    await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
    const temporaryPath = `${DATA_FILE}.${randomUUID()}.tmp`;
    try {
      await fs.writeFile(temporaryPath, JSON.stringify(next, null, 2), { mode: 0o600 });
      await fs.rename(temporaryPath, DATA_FILE);
    } finally {
      await fs.rm(temporaryPath, { force: true });
    }
    return result;
  });
  writeQueue = operation.catch(() => {});
  return operation;
}

const getItemId = (item) => String(item?.id || item?.number || "").trim();

async function listCollection(collectionName, context) {
  await writeQueue;
  return getScopedData(await readData(), context)[collectionName] || [];
}

async function getItem(collectionName, itemId, context) {
  return (await listCollection(collectionName, context)).find((item) => getItemId(item) === itemId) || null;
}

// Mutation and append-only event commit in one atomic file replacement.
async function mutateCollection(collectionName, context, mutate) {
  return transaction(context, async (scope) => {
    const change = await mutate(structuredClone(scope[collectionName] || []));
    scope[collectionName] = change.items;
    if (change.event) scope.activity.push(change.event);
    if (change.events) scope.activity.push(...change.events);
    return change.result;
  });
}

async function replaceCollection(collectionName, items, context) {
  return mutateCollection(collectionName, context, () => ({ items, result: items }));
}

async function upsertItem(collectionName, itemId, item, context) {
  return mutateCollection(collectionName, context, (items) => {
    const index = items.findIndex((entry) => getItemId(entry) === itemId);
    const next = { ...(index >= 0 ? items[index] : {}), ...item };
    if (index >= 0) items[index] = next;
    else items.push(next);
    return { items, result: next };
  });
}

async function deleteItem(collectionName, itemId, context) {
  return mutateCollection(collectionName, context, (items) => {
    const next = items.filter((item) => getItemId(item) !== itemId);
    return { items: next, result: next };
  });
}

async function exportScope(context) {
  await writeQueue;
  const scope = getScopedData(await readData(), context);
  return Object.fromEntries(COLLECTIONS.map((key) => [key, scope[key] || []]));
}

async function importScope(data, context, event) {
  return transaction(context, (scope) => {
    const before = Object.fromEntries(COLLECTIONS.map((key) => [key, structuredClone(scope[key] || [])]));
    const nextData = typeof data === "function" ? data(before) : data;
    for (const key of COLLECTIONS) scope[key] = Array.isArray(nextData[key]) ? nextData[key] : [];
    if (event) scope.activity.push(typeof event === "function" ? event(before, nextData) : event);
    return Object.fromEntries(COLLECTIONS.map((key) => [key, scope[key]]));
  });
}

module.exports = { deleteItem, exportScope, getItem, importScope, listCollection, replaceCollection, upsertItem, mutateCollection };
