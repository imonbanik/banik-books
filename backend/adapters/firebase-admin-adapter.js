const { getFirebaseAdminFirestore } = require("../firebase-admin-client");

const BACKUP_COLLECTIONS = Object.freeze([
  "journals",
  "parties",
  "chartOfAccounts",
  "challans",
  "settings",
]);
const ARRAY_DOCUMENT_COLLECTIONS = new Set(["chartOfAccounts"]);
const FIRESTORE_BATCH_LIMIT = 450;

function getItemId(item) {
  if (!item || typeof item !== "object") {
    return "";
  }

  return String(item.id || item.number || "").trim();
}

function getScopeId(authContext) {
  const userId = String((authContext && authContext.userId) || "local-dev").trim() || "local-dev";
  const workspaceId = String((authContext && authContext.workspaceId) || "default").trim() || "default";
  return Buffer.from(`${userId}::${workspaceId}`).toString("base64url");
}

function sanitizeObject(value) {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeObject(item));
  }

  if (value && typeof value === "object") {
    return Object.entries(value).reduce((cleanValue, [key, item]) => {
      if (item !== undefined) {
        cleanValue[key] = sanitizeObject(item);
      }

      return cleanValue;
    }, {});
  }

  return value;
}

function getRootCollection() {
  const collectionName =
    String(process.env.BANIK_FIRESTORE_ROOT_COLLECTION || "").trim() ||
    "banikWorkspaceData";
  return getFirebaseAdminFirestore().collection(collectionName);
}

function getScopeRef(authContext) {
  return getRootCollection().doc(getScopeId(authContext));
}

function getArrayDocRef(collectionName, authContext) {
  return getScopeRef(authContext).collection("_collections").doc(collectionName);
}

function getItemCollectionRef(collectionName, authContext) {
  return getScopeRef(authContext).collection(collectionName);
}

async function writeScopeMetadata(authContext) {
  await getScopeRef(authContext).set(
    sanitizeObject({
      userId: authContext.userId,
      workspaceId: authContext.workspaceId,
      updatedAt: new Date().toISOString(),
    }),
    { merge: true }
  );
}

async function commitBatch(db, operations) {
  for (let index = 0; index < operations.length; index += FIRESTORE_BATCH_LIMIT) {
    const batch = db.batch();
    operations.slice(index, index + FIRESTORE_BATCH_LIMIT).forEach((operation) => {
      operation(batch);
    });
    await batch.commit();
  }
}

async function listArrayDocumentCollection(collectionName, authContext) {
  const snapshot = await getArrayDocRef(collectionName, authContext).get();

  if (!snapshot.exists) {
    return [];
  }

  const data = snapshot.data() || {};
  return Array.isArray(data.items) ? data.items : [];
}

async function replaceArrayDocumentCollection(collectionName, items, authContext) {
  const nextItems = Array.isArray(items) ? sanitizeObject(items) : [];
  await writeScopeMetadata(authContext);
  await getArrayDocRef(collectionName, authContext).set({
    items: nextItems,
    updatedAt: new Date().toISOString(),
  });
  return nextItems;
}

async function listCollection(collectionName, authContext) {
  if (ARRAY_DOCUMENT_COLLECTIONS.has(collectionName)) {
    return listArrayDocumentCollection(collectionName, authContext);
  }

  const snapshot = await getItemCollectionRef(collectionName, authContext).get();
  return snapshot.docs.map((doc) => doc.data() || {});
}

async function getItem(collectionName, itemId, authContext) {
  const normalizedId = String(itemId || "").trim();

  if (!normalizedId) {
    const error = new Error("Missing item id.");
    error.statusCode = 400;
    throw error;
  }

  if (ARRAY_DOCUMENT_COLLECTIONS.has(collectionName)) {
    const items = await listCollection(collectionName, authContext);
    return items.find((entry) => getItemId(entry) === normalizedId) || null;
  }

  const snapshot = await getItemCollectionRef(collectionName, authContext).doc(normalizedId).get();
  return snapshot.exists ? snapshot.data() || null : null;
}

async function replaceCollection(collectionName, items, authContext) {
  if (ARRAY_DOCUMENT_COLLECTIONS.has(collectionName)) {
    return replaceArrayDocumentCollection(collectionName, items, authContext);
  }

  const db = getFirebaseAdminFirestore();
  const collectionRef = getItemCollectionRef(collectionName, authContext);
  const existingSnapshot = await collectionRef.get();
  const nextItems = Array.isArray(items) ? items : [];
  const operations = [];

  existingSnapshot.docs.forEach((doc) => {
    operations.push((batch) => batch.delete(doc.ref));
  });

  nextItems.forEach((item) => {
    const itemId = getItemId(item);

    if (!itemId) {
      const error = new Error("Missing item id.");
      error.statusCode = 400;
      throw error;
    }

    operations.push((batch) =>
      batch.set(collectionRef.doc(itemId), {
        ...sanitizeObject(item),
        updatedAt: item.updatedAt || new Date().toISOString(),
      })
    );
  });

  await writeScopeMetadata(authContext);
  await commitBatch(db, operations);
  return nextItems;
}

async function upsertItem(collectionName, itemId, item, authContext) {
  const normalizedId = String(itemId || getItemId(item)).trim();

  if (!normalizedId) {
    const error = new Error("Missing item id.");
    error.statusCode = 400;
    throw error;
  }

  if (ARRAY_DOCUMENT_COLLECTIONS.has(collectionName)) {
    const items = await listCollection(collectionName, authContext);
    const nextItem = sanitizeObject(item && typeof item === "object" ? item : {});
    const existingIndex = items.findIndex((entry) => getItemId(entry) === normalizedId);
    const nextItems = [...items];

    if (existingIndex >= 0) {
      nextItems[existingIndex] = {
        ...nextItems[existingIndex],
        ...nextItem,
      };
    } else {
      nextItems.push(nextItem);
    }

    await replaceCollection(collectionName, nextItems, authContext);
    return nextItems.find((entry) => getItemId(entry) === normalizedId) || nextItem;
  }

  const cleanItem = item && typeof item === "object" ? sanitizeObject(item) : {};
  const nextItem = {
    ...cleanItem,
    updatedAt: cleanItem.updatedAt || new Date().toISOString(),
  };
  await writeScopeMetadata(authContext);
  await getItemCollectionRef(collectionName, authContext).doc(normalizedId).set(nextItem, {
    merge: true,
  });
  return nextItem;
}

async function deleteItem(collectionName, itemId, authContext) {
  const normalizedId = String(itemId || "").trim();

  if (!normalizedId) {
    const error = new Error("Missing item id.");
    error.statusCode = 400;
    throw error;
  }

  if (ARRAY_DOCUMENT_COLLECTIONS.has(collectionName)) {
    const items = await listCollection(collectionName, authContext);
    const nextItems = items.filter((entry) => getItemId(entry) !== normalizedId);
    await replaceCollection(collectionName, nextItems, authContext);
    return nextItems;
  }

  await writeScopeMetadata(authContext);
  await getItemCollectionRef(collectionName, authContext).doc(normalizedId).delete();
  return listCollection(collectionName, authContext);
}

async function exportScope(authContext) {
  const backupData = {};

  for (const collectionName of BACKUP_COLLECTIONS) {
    backupData[collectionName] = await listCollection(collectionName, authContext);
  }

  return backupData;
}

async function importScope(scopedData, authContext) {
  for (const collectionName of BACKUP_COLLECTIONS) {
    await replaceCollection(
      collectionName,
      Array.isArray(scopedData[collectionName]) ? scopedData[collectionName] : [],
      authContext
    );
  }

  return exportScope(authContext);
}

module.exports = {
  deleteItem,
  exportScope,
  getItem,
  importScope,
  listCollection,
  replaceCollection,
  upsertItem,
};
