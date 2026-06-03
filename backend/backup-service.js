const { getStorageAdapter } = require("./storage-adapter");
const { validateCollection } = require("./validators");

const BACKUP_VERSION = 1;
const BACKUP_COLLECTIONS = Object.freeze([
  "journals",
  "parties",
  "chartOfAccounts",
  "challans",
  "settings",
]);

function normalizeBackupPayload(payload) {
  const source = payload && typeof payload === "object" ? payload : {};
  const data = source.data && typeof source.data === "object" ? source.data : source;

  return BACKUP_COLLECTIONS.reduce((backupData, collectionName) => {
    backupData[collectionName] = Array.isArray(data[collectionName]) ? data[collectionName] : [];
    return backupData;
  }, {});
}

async function exportBackup(authContext) {
  const adapter = getStorageAdapter();
  const data =
    typeof adapter.exportScope === "function"
      ? await adapter.exportScope(authContext)
      : await BACKUP_COLLECTIONS.reduce(async (dataPromise, collectionName) => {
          const backupData = await dataPromise;
          backupData[collectionName] = await adapter.listCollection(collectionName, authContext);
          return backupData;
        }, Promise.resolve({}));

  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    workspaceId: authContext.workspaceId,
    data: normalizeBackupPayload(data),
  };
}

async function importBackup(payload, authContext) {
  const adapter = getStorageAdapter();
  const backupData = normalizeBackupPayload(payload);

  BACKUP_COLLECTIONS.forEach((collectionName) => {
    validateCollection(collectionName, backupData[collectionName]);
  });

  if (typeof adapter.importScope === "function") {
    await adapter.importScope(backupData, authContext);
  } else {
    await BACKUP_COLLECTIONS.reduce(async (previousWrite, collectionName) => {
      await previousWrite;
      await adapter.replaceCollection(collectionName, backupData[collectionName], authContext);
    }, Promise.resolve());
  }

  return exportBackup(authContext);
}

module.exports = {
  BACKUP_COLLECTIONS,
  exportBackup,
  importBackup,
};
