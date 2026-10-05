const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const { getFirebaseAdminFirestore } = require("./firebase-admin-client");

const COLLECTIONS = Object.freeze({
  companies: "companies",
  memberships: "memberships",
  invitations: "invitations",
  events: "events",
});
let fileQueue = Promise.resolve();

function useFirebase() {
  const adapter = String(process.env.BANIK_TEAM_STORAGE_ADAPTER || process.env.BANIK_STORAGE_ADAPTER || "file").toLowerCase();
  return ["firebase", "firebase-admin", "firestore"].includes(adapter);
}

function getFilePath() {
  return process.env.BANIK_TEAM_DATA_FILE || (process.env.BANIK_DATA_FILE
    ? `${process.env.BANIK_DATA_FILE}.team.json`
    : path.join(__dirname, "..", "data", "company-team-data.json"));
}

function clone(value) {
  return value == null ? null : JSON.parse(JSON.stringify(value));
}

function assertCollection(collection) {
  if (!Object.hasOwn(COLLECTIONS, collection)) throw new Error("Unknown team collection.");
}

function firebaseCollectionName(collection) {
  assertCollection(collection);
  const prefix = String(process.env.BANIK_TEAM_COLLECTION_PREFIX || `${process.env.BANIK_FIRESTORE_ROOT_COLLECTION || "banikWorkspaceData"}_team`).trim();
  // Reject invalid namespaces rather than silently collapsing different staging
  // and production names onto the same collection after character replacement.
  if (!/^[A-Za-z0-9_-]{1,110}$/.test(prefix)) {
    throw Object.assign(new Error("BANIK_TEAM_COLLECTION_PREFIX must contain only letters, digits, underscores or hyphens (up to 110 characters)."), { statusCode: 500 });
  }
  return `${prefix}_${COLLECTIONS[collection]}`;
}

function matches(document, filters) {
  return Object.entries(filters || {}).every(([key, value]) => document[key] === value);
}

function firebaseRef(collection, id) {
  assertCollection(collection);
  return getFirebaseAdminFirestore().collection(firebaseCollectionName(collection)).doc(id);
}

function firebaseQuery(collection, filters) {
  assertCollection(collection);
  let query = getFirebaseAdminFirestore().collection(firebaseCollectionName(collection));
  for (const [key, value] of Object.entries(filters || {})) query = query.where(key, "==", value);
  return query;
}

async function readFileState() {
  try {
    const state = JSON.parse(await fs.readFile(getFilePath(), "utf8"));
    if (!state || state.version !== 1 || !state.collections) throw new Error("Invalid company store format.");
    return state;
  } catch (error) {
    if (error.code === "ENOENT") return { version: 1, collections: {} };
    // Corrupt authorization data must never silently become a new empty store.
    throw error;
  }
}

async function withFileLock(callback) {
  const file = getFilePath();
  const lockPath = `${file}.lock`;
  await fs.mkdir(path.dirname(file), { recursive: true });
  const deadline = Date.now() + 10000;
  let lock;
  while (!lock) {
    try {
      lock = await fs.open(lockPath, "wx", 0o600);
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      // A crashed process may leave its lock behind; live transactions are short
      // and must never perform network calls inside this file-store transaction.
      const stat = await fs.stat(lockPath).catch(() => null);
      if (stat && Date.now() - stat.mtimeMs > 60000) {
        await fs.unlink(lockPath).catch(() => {});
        continue;
      }
      if (Date.now() >= deadline) {
        const busy = new Error("Company access is busy. Please retry.");
        busy.statusCode = 503;
        throw busy;
      }
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }
  try {
    return await callback(file);
  } finally {
    await lock.close();
    await fs.unlink(lockPath).catch(() => {});
  }
}

async function getTeamDocument(collection, id) {
  assertCollection(collection);
  if (useFirebase()) {
    const snapshot = await firebaseRef(collection, id).get();
    return snapshot.exists ? snapshot.data() : null;
  }
  const state = await readFileState();
  return clone((state.collections[collection] || {})[id]);
}

async function queryTeamDocuments(collection, filters = {}) {
  assertCollection(collection);
  if (useFirebase()) {
    const snapshot = await firebaseQuery(collection, filters).get();
    return snapshot.docs.map((document) => document.data());
  }
  const state = await readFileState();
  return Object.values(state.collections[collection] || {}).filter((document) => matches(document, filters)).map(clone);
}

async function runTeamTransaction(callback) {
  if (useFirebase()) {
    return getFirebaseAdminFirestore().runTransaction(async (transaction) => callback({
      async get(collection, id) {
        const snapshot = await transaction.get(firebaseRef(collection, id));
        return snapshot.exists ? snapshot.data() : null;
      },
      async query(collection, filters = {}) {
        const snapshot = await transaction.get(firebaseQuery(collection, filters));
        return snapshot.docs.map((document) => document.data());
      },
      set(collection, id, value) { transaction.set(firebaseRef(collection, id), value); },
      delete(collection, id) { transaction.delete(firebaseRef(collection, id)); },
    }));
  }
  const operation = fileQueue.catch(() => {}).then(() => withFileLock(async (file) => {
    const state = await readFileState();
    let dirty = false;
    const result = await callback({
      async get(collection, id) {
        assertCollection(collection);
        return clone((state.collections[collection] || {})[id]);
      },
      async query(collection, filters = {}) {
        assertCollection(collection);
        return Object.values(state.collections[collection] || {}).filter((document) => matches(document, filters)).map(clone);
      },
      set(collection, id, value) {
        assertCollection(collection);
        if (!state.collections[collection]) state.collections[collection] = {};
        state.collections[collection][id] = clone(value);
        dirty = true;
      },
      delete(collection, id) {
        assertCollection(collection);
        delete (state.collections[collection] || {})[id];
        dirty = true;
      },
    });
    if (dirty) {
      const temporaryFile = `${file}.${process.pid}.${crypto.randomBytes(8).toString("hex")}.tmp`;
      try {
        const handle = await fs.open(temporaryFile, "wx", 0o600);
        try {
          await handle.writeFile(JSON.stringify(state));
          await handle.sync();
        } finally {
          await handle.close();
        }
        await fs.rename(temporaryFile, file);
      } finally {
        await fs.unlink(temporaryFile).catch(() => {});
      }
    }
    return result;
  }));
  fileQueue = operation.then(() => undefined, () => undefined);
  return operation;
}

module.exports = { getTeamDocument, queryTeamDocuments, runTeamTransaction, useFirebase };
