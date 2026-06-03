const STORE_ADAPTERS = Object.freeze({
  file: () => require("./adapters/file-adapter"),
  firebase: () => require("./adapters/firebase-admin-adapter"),
  "firebase-admin": () => require("./adapters/firebase-admin-adapter"),
  firestore: () => require("./adapters/firebase-admin-adapter"),
  postgres: () => require("./adapters/postgres-adapter"),
});

function getStorageAdapter() {
  const adapterName = String(process.env.BANIK_STORAGE_ADAPTER || "file").trim().toLowerCase();
  const adapterFactory = STORE_ADAPTERS[adapterName];

  if (!adapterFactory) {
    const error = new Error(
      `Unsupported BANIK_STORAGE_ADAPTER "${adapterName}". Available adapters: ${Object.keys(
        STORE_ADAPTERS
      ).join(", ")}.`
    );
    error.statusCode = 500;
    throw error;
  }

  return adapterFactory();
}

module.exports = {
  getStorageAdapter,
};
