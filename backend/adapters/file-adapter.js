const fs = require("node:fs/promises");
const path = require("node:path");

const DATA_DIR = path.join(__dirname, "..", "..", "data");
const DATA_FILE = process.env.BANIK_DATA_FILE || path.join(DATA_DIR, "app-data.json");
const DEFAULT_DATA = Object.freeze({
  journals: [],
  parties: [],
  chartOfAccounts: [],
  challans: [],
  settings: [],
  scopes: {},
  updatedAt: "",
});

let writeQueue = Promise.resolve();

async function ensureDataFile() {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });

  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.writeFile(DATA_FILE, JSON.stringify(DEFAULT_DATA, null, 2));
  }
}

async function readData() {
  await ensureDataFile();

  try {
    const parsed = JSON.parse(await fs.readFile(DATA_FILE, "utf8"));
    return {
      ...DEFAULT_DATA,
      ...(parsed && typeof parsed === "object" ? parsed : {}),
    };
  } catch {
    return { ...DEFAULT_DATA };
  }
}

function getScopeKey(authContext) {
  const userId = String((authContext && authContext.userId) || "local-dev").trim() || "local-dev";
  const workspaceId = String((authContext && authContext.workspaceId) || "default").trim() || "default";
  return `${userId}::${workspaceId}`;
}

function getScopedData(data, authContext) {
  const scopeKey = getScopeKey(authContext);
  const scopes = data.scopes && typeof data.scopes === "object" ? data.scopes : {};
  const scopedData = scopes[scopeKey];

  if (scopedData && typeof scopedData === "object") {
    return {
      ...DEFAULT_DATA,
      ...scopedData,
    };
  }

  if (scopeKey === "local-dev::default") {
    return data;
  }

  return { ...DEFAULT_DATA };
}

function setScopedData(data, authContext, scopedData) {
  const scopeKey = getScopeKey(authContext);
  const scopes = data.scopes && typeof data.scopes === "object" ? data.scopes : {};
  const cleanScopedData = {
    journals: Array.isArray(scopedData.journals) ? scopedData.journals : [],
    parties: Array.isArray(scopedData.parties) ? scopedData.parties : [],
    chartOfAccounts: Array.isArray(scopedData.chartOfAccounts) ? scopedData.chartOfAccounts : [],
    challans: Array.isArray(scopedData.challans) ? scopedData.challans : [],
    settings: Array.isArray(scopedData.settings) ? scopedData.settings : [],
  };

  return {
    ...data,
    scopes: {
      ...scopes,
      [scopeKey]: cleanScopedData,
    },
  };
}

async function writeData(nextData) {
  await ensureDataFile();

  const payload = {
    ...DEFAULT_DATA,
    ...nextData,
    updatedAt: new Date().toISOString(),
  };

  writeQueue = writeQueue.then(() =>
    fs.writeFile(DATA_FILE, JSON.stringify(payload, null, 2))
  );
  await writeQueue;
  return payload;
}

async function listCollection(collectionName, authContext) {
  const data = await readData();
  const scopedData = getScopedData(data, authContext);
  return Array.isArray(scopedData[collectionName]) ? scopedData[collectionName] : [];
}

async function replaceCollection(collectionName, items, authContext) {
  const data = await readData();
  const scopedData = getScopedData(data, authContext);
  const nextItems = Array.isArray(items) ? items : [];
  await writeData(
    setScopedData(data, authContext, {
      ...scopedData,
      [collectionName]: nextItems,
    })
  );
  return nextItems;
}

function getItemId(item) {
  if (!item || typeof item !== "object") {
    return "";
  }

  return String(item.id || item.number || "").trim();
}

async function upsertItem(collectionName, itemId, item, authContext) {
  const data = await readData();
  const scopedData = getScopedData(data, authContext);
  const items = Array.isArray(scopedData[collectionName]) ? scopedData[collectionName] : [];
  const normalizedId = String(itemId || getItemId(item)).trim();

  if (!normalizedId) {
    throw new Error("Missing item id.");
  }

  const nextItem = {
    ...(item && typeof item === "object" ? item : {}),
  };
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

  await writeData(
    setScopedData(data, authContext, {
      ...scopedData,
      [collectionName]: nextItems,
    })
  );

  return nextItems.find((entry) => getItemId(entry) === normalizedId) || nextItem;
}

async function deleteItem(collectionName, itemId, authContext) {
  const data = await readData();
  const scopedData = getScopedData(data, authContext);
  const items = Array.isArray(scopedData[collectionName]) ? scopedData[collectionName] : [];
  const normalizedId = String(itemId || "").trim();

  if (!normalizedId) {
    throw new Error("Missing item id.");
  }

  const nextItems = items.filter((entry) => getItemId(entry) !== normalizedId);
  await writeData(
    setScopedData(data, authContext, {
      ...scopedData,
      [collectionName]: nextItems,
    })
  );
  return nextItems;
}

async function exportScope(authContext) {
  const data = await readData();
  const scopedData = getScopedData(data, authContext);

  return {
    journals: Array.isArray(scopedData.journals) ? scopedData.journals : [],
    parties: Array.isArray(scopedData.parties) ? scopedData.parties : [],
    chartOfAccounts: Array.isArray(scopedData.chartOfAccounts) ? scopedData.chartOfAccounts : [],
    challans: Array.isArray(scopedData.challans) ? scopedData.challans : [],
    settings: Array.isArray(scopedData.settings) ? scopedData.settings : [],
  };
}

async function importScope(scopedData, authContext) {
  const data = await readData();
  await writeData(setScopedData(data, authContext, scopedData));
  return exportScope(authContext);
}

module.exports = {
  deleteItem,
  exportScope,
  importScope,
  listCollection,
  replaceCollection,
  upsertItem,
};
