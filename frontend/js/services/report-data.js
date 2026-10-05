(function () {
  const POSTED_JOURNALS_KEY = "banikBooksPostedJournals";
  localStorage.removeItem(POSTED_JOURNALS_KEY);
  localStorage.removeItem("banikBooksLedgers");

  function isPostedJournal(journal) {
    return Boolean(journal) && (!journal.status || journal.status === "posted");
  }

  function readArray(storageKey) {
    try {
      const parsed = JSON.parse(localStorage.getItem(storageKey) || "[]");
      const items = Array.isArray(parsed) ? parsed : [];
      return storageKey === POSTED_JOURNALS_KEY ? items.filter(isPostedJournal) : items;
    } catch {
      return [];
    }
  }

  async function hydrate(collectionName, storageKey) {
    // A failed read must never display another company's cached totals or upload
    // a browser snapshot over the company's records.
    localStorage.removeItem(storageKey);
    try {
      if (!window.BanikApi) throw new Error("The company data service is unavailable. Please refresh.");
      if (collectionName === "journals") {
        const report = String(window.location.pathname).split("/").pop().replace(/\.html$/, "");
        const payload = await window.BanikApi.request(`/api/journals?purpose=reports&report=${encodeURIComponent(report)}`);
        const items = (Array.isArray(payload.items) ? payload.items : []).filter(isPostedJournal);
        localStorage.setItem(storageKey, JSON.stringify(items));
        return items;
      }
      return await window.BanikApi.hydrate(collectionName, storageKey);
    } catch (error) {
      showError(error);
      throw error;
    }
  }

  function showError(error) {
    let message = document.querySelector("#report-data-error");
    if (!message) {
      message = document.createElement("p");
      message.id = "report-data-error";
      message.setAttribute("role", "alert");
      message.style.cssText = "padding:16px;border:1px solid #b91c1c;background:#fff1f2;color:#991b1b";
      (document.querySelector("main") || document.body).prepend(message);
    }
    message.textContent = `Report could not be loaded. ${error.message || "Please try again."}`;
  }

  async function hydrateCollections(collections) {
    collections.forEach((collection) => localStorage.removeItem(collection.storageKey));
    for (const collection of collections) {
      await hydrate(collection.name, collection.storageKey);
    }
  }

  window.BanikReportData = {
    hydrate,
    hydrateCollections,
    readArray,
    isPostedJournal,
  };
})();
