const {
  getStorageAdapter,
} = require("./storage-adapter");
const { validateCollection, validateItem } = require("./validators");

async function listItems(collectionName, authContext) {
  return getStorageAdapter().listCollection(collectionName, authContext);
}

async function getItem(collectionName, itemId, authContext) {
  const adapter = getStorageAdapter();
  if (typeof adapter.getItem === "function") {
    return adapter.getItem(collectionName, itemId, authContext);
  }

  const items = await adapter.listCollection(collectionName, authContext);
  return items.find((item) => item && item.id === itemId) || null;
}

async function replaceItems(collectionName, items, authContext) {
  validateCollection(collectionName, items);
  return getStorageAdapter().replaceCollection(collectionName, items, authContext);
}

async function saveItem(collectionName, itemId, item, authContext) {
  validateItem(collectionName, item);
  return getStorageAdapter().upsertItem(collectionName, itemId, item, authContext);
}

async function removeItem(collectionName, itemId, authContext) {
  return getStorageAdapter().deleteItem(collectionName, itemId, authContext);
}

module.exports = {
  getItem,
  listItems,
  removeItem,
  replaceItems,
  saveItem,
};
