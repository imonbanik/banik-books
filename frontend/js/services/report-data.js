(function () {
  function readArray(storageKey) {
    try {
      const parsed = JSON.parse(localStorage.getItem(storageKey) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  async function hydrate(collectionName, storageKey) {
    if (!window.BanikApi || typeof window.BanikApi.hydrate !== "function") {
      return readArray(storageKey);
    }

    return window.BanikApi.hydrate(collectionName, storageKey);
  }

  async function hydrateCollections(collections) {
    for (const collection of collections) {
      await hydrate(collection.name, collection.storageKey);
    }
  }

  window.BanikReportData = {
    hydrate,
    hydrateCollections,
    readArray,
  };
})();
