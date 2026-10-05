const { getFirebaseAdminFirestore } = require("../firebase-admin-client");
const { randomUUID } = require("node:crypto");
const COLLECTIONS = ["journals", "parties", "chartOfAccounts", "challans", "settings"];
const ARRAY_COLLECTIONS = new Set(["chartOfAccounts"]);
const getItemId = (item) => String(item?.id || item?.number || "").trim();
const sanitize = (value) => JSON.parse(JSON.stringify(value));

function getScopeRef(context = {}) {
  const userId = context.storageUserId || context.userId || "local-dev";
  const workspaceId = context.storageWorkspaceId || context.workspaceId || "default";
  const id = Buffer.from(`${userId}::${workspaceId}`).toString("base64url");
  const root = process.env.BANIK_FIRESTORE_ROOT_COLLECTION || "banikWorkspaceData";
  return getFirebaseAdminFirestore().collection(root).doc(id);
}

function arrayRef(scope, name) {
  return scope.collection("_collections").doc(name);
}

async function readCollection(tx, scope, name) {
  if (ARRAY_COLLECTIONS.has(name)) {
    const snapshot = await tx.get(arrayRef(scope, name));
    return snapshot.exists && Array.isArray(snapshot.data().items) ? snapshot.data().items : [];
  }
  const snapshot = await tx.get(scope.collection(name));
  return snapshot.docs.map((document) => ({ ...document.data(), ...(name === "journals" && !document.data().id ? { id: document.id } : {}) }));
}

// Legacy Firestore data was written directly under the owner UID. Import it once,
// on the server, before closing those client write paths; existing backend items win.
async function migrateLegacyCollection(name, context) {
  if (!context.companyId || !["chartOfAccounts", "challans"].includes(name) || (context.storageWorkspaceId || "default") !== "default") return;
  const db = getFirebaseAdminFirestore();
  const scope = getScopeRef(context);
  const marker = scope.collection("_migrations").doc(`legacy-${name}`);
  const existingMarker = await marker.get();
  if (existingMarker.exists && existingMarker.data().status !== "in_progress") return;
  let complete = false;
  while (!complete) {
    complete = await db.runTransaction(async (tx) => {
      const currentMarker = await tx.get(marker);
      if (currentMarker.exists && currentMarker.data().status !== "in_progress") return true;
      await tx.get(scope);
      const items = await readCollection(tx, scope, name);
      const userRef = db.collection("userData").doc(context.storageUserId || context.userId);
      const legacy = name === "chartOfAccounts"
        ? await tx.get(userRef.collection("settings").doc("chartOfAccounts"))
        : await tx.get(userRef.collection("challans"));
      const legacyItems = name === "chartOfAccounts"
        ? (legacy.exists && Array.isArray(legacy.data().items) ? legacy.data().items : [])
        : legacy.docs.map((doc) => ({ ...doc.data(), id: doc.id }));
      const now = new Date().toISOString();
      let finished = true;
      if (name === "chartOfAccounts" && !items.length && legacyItems.length) {
        tx.set(arrayRef(scope, name), sanitize({ items: legacyItems, updatedAt: now }));
      } else if (name === "challans") {
        const ids = new Set(items.map(getItemId));
        const missing = legacyItems.filter((item) => !ids.has(getItemId(item)));
        // Chunked migration resumes after interruption. No accounting request can
        // use this collection until all chunks finish, and source data is retained.
        for (const item of missing.slice(0, 440)) tx.set(scope.collection(name).doc(getItemId(item)), sanitize(item));
        finished = missing.length <= 440;
      }
      tx.set(marker, { importedAt: now, sourceCount: legacyItems.length, status: finished ? "complete" : "in_progress" });
      tx.set(scope, { updatedAt: now }, { merge: true });
      return finished;
    });
  }
}

async function listCollection(name, context) {
  await migrateLegacyCollection(name, context);
  const scope = getScopeRef(context);
  if (ARRAY_COLLECTIONS.has(name)) {
    const snapshot = await arrayRef(scope, name).get();
    return snapshot.exists && Array.isArray(snapshot.data().items) ? snapshot.data().items : [];
  }
  const snapshot = await scope.collection(name).get();
  return snapshot.docs.map((doc) => ({ ...doc.data(), ...(name === "journals" && !doc.data().id ? { id: doc.id } : {}) }));
}

async function getItem(name, itemId, context) {
  if (ARRAY_COLLECTIONS.has(name)) return (await listCollection(name, context)).find((item) => getItemId(item) === itemId) || null;
  await migrateLegacyCollection(name, context);
  const snapshot = await getScopeRef(context).collection(name).doc(itemId).get();
  return snapshot.exists ? { ...snapshot.data(), ...(name === "journals" ? { id: snapshot.id } : {}) } : null;
}

function writeChanges(tx, scope, name, before, after) {
  if (ARRAY_COLLECTIONS.has(name)) {
    tx.set(arrayRef(scope, name), sanitize({ items: after, updatedAt: new Date().toISOString() }));
    return 1;
  }
  const previous = new Map(before.map((item) => [getItemId(item), item]));
  const next = new Map(after.map((item) => [getItemId(item), item]));
  let writes = 0;
  for (const [id, item] of next) {
    if (!id || id.includes("/")) throw Object.assign(new Error("Invalid item id."), { statusCode: 400 });
    if (JSON.stringify(previous.get(id)) !== JSON.stringify(item)) {
      tx.set(scope.collection(name).doc(id), sanitize(item));
      writes += 1;
    }
  }
  for (const id of previous.keys()) {
    if (!next.has(id)) { tx.delete(scope.collection(name).doc(id)); writes += 1; }
  }
  return writes;
}

async function mutateCollection(name, context, mutate) {
  await migrateLegacyCollection(name, context);
  const db = getFirebaseAdminFirestore();
  const scope = getScopeRef(context);
  return db.runTransaction(async (tx) => {
    // All writers touch this document, serializing number allocation and collection changes.
    await tx.get(scope);
    const before = await readCollection(tx, scope, name);
    const change = await mutate(structuredClone(before));
    const writes = writeChanges(tx, scope, name, before, change.items);
    const events = [...(change.events || []), ...(change.event ? [change.event] : [])];
    if (writes + events.length > 450) throw Object.assign(new Error("This change is too large for an atomic save. Split the import into smaller batches."), { statusCode: 413 });
    for (const event of events) tx.create(scope.collection("activity").doc(event.id || randomUUID()), sanitize(event));
    tx.set(scope, {
      userId: context.storageUserId || context.userId,
      workspaceId: context.storageWorkspaceId || context.workspaceId,
      ...(context.companyId ? { companyId: context.companyId } : {}),
      updatedAt: new Date().toISOString(),
    }, { merge: true });
    return change.result;
  });
}

async function replaceCollection(name, items, context) {
  return mutateCollection(name, context, () => ({ items, result: items }));
}
async function upsertItem(name, id, item, context) {
  return mutateCollection(name, context, (items) => {
    const index = items.findIndex((entry) => getItemId(entry) === id);
    const next = { ...(index >= 0 ? items[index] : {}), ...item };
    if (index >= 0) items[index] = next; else items.push(next);
    return { items, result: next };
  });
}
async function deleteItem(name, id, context) {
  return mutateCollection(name, context, (items) => {
    const next = items.filter((item) => getItemId(item) !== id);
    return { items: next, result: next };
  });
}
async function exportScope(context) {
  for (const name of COLLECTIONS) await migrateLegacyCollection(name, context);
  const scope = getScopeRef(context);
  return getFirebaseAdminFirestore().runTransaction(async (tx) => {
    await tx.get(scope);
    const data = {};
    for (const name of COLLECTIONS) data[name] = await readCollection(tx, scope, name);
    return data;
  });
}
async function importScope(data, context, event) {
  for (const name of COLLECTIONS) await migrateLegacyCollection(name, context);
  const db = getFirebaseAdminFirestore();
  const scope = getScopeRef(context);
  await db.runTransaction(async (tx) => {
    await tx.get(scope);
    const before = {};
    for (const name of COLLECTIONS) before[name] = await readCollection(tx, scope, name);
    const nextData = typeof data === "function" ? data(before) : data;
    let writes = 0;
    for (const name of COLLECTIONS) writes += writeChanges(tx, scope, name, before[name], nextData[name] || []);
    if (writes > 445) throw Object.assign(new Error("Backup restore exceeds the atomic restore limit. Use a staged migration; no data was changed."), { statusCode: 413 });
    if (event) {
      const activity = typeof event === "function" ? event(before, nextData) : event;
      tx.create(scope.collection("activity").doc(activity.id), sanitize(activity));
    }
    tx.set(scope, { updatedAt: new Date().toISOString() }, { merge: true });
  });
  return exportScope(context);
}
module.exports = { deleteItem, exportScope, getItem, importScope, listCollection, replaceCollection, upsertItem, mutateCollection };
