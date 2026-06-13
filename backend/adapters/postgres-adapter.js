function notImplemented() {
  const error = new Error(
    "Postgres storage adapter is not implemented yet. Use BANIK_STORAGE_ADAPTER=file until it is wired."
  );
  error.statusCode = 501;
  throw error;
}

module.exports = {
  deleteItem: notImplemented,
  exportScope: notImplemented,
  getItem: notImplemented,
  importScope: notImplemented,
  listCollection: notImplemented,
  replaceCollection: notImplemented,
  upsertItem: notImplemented,
};
