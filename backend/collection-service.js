const {
  getStorageAdapter,
} = require("./storage-adapter");
const { validateCollection, validateItem } = require("./validators");

async function listItems(collectionName, authContext) {
  return getStorageAdapter().listCollection(collectionName, authContext);
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
  listItems,
  removeItem,
  replaceItems,
  saveItem,
};
