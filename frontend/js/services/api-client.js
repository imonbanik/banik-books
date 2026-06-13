(function () {
  const ENDPOINTS = Object.freeze({
    journals: "/api/journals",
    parties: "/api/parties",
    chartOfAccounts: "/api/chart-of-accounts",
    challans: "/api/challans",
    settings: "/api/settings",
  });
  const AUTH_READY_TIMEOUT_MS = 15000;
  const COLLECTION_CACHE_TTL_MS = 10000;
  const SLOW_REQUEST_MS = 700;
  const collectionCache = new Map();
  const collectionRequests = new Map();
  const collectionCacheVersions = new Map();
  const itemCache = new Map();
  const itemRequests = new Map();
  let authHeadersRequest = null;

  function now() {
    return window.performance && typeof window.performance.now === "function"
      ? window.performance.now()
      : Date.now();
  }

  function isPerfLoggingEnabled() {
    try {
      return localStorage.getItem("banikPerfLogging") !== "off";
    } catch {
      return true;
    }
  }

  function logPerf(label, startedAt, details = {}) {
    if (!isPerfLoggingEnabled()) {
      return;
    }

    const elapsedMs = Math.round(now() - startedAt);
    const logMethod = elapsedMs >= SLOW_REQUEST_MS ? "warn" : "debug";
    console[logMethod]("[Banik perf]", label, `${elapsedMs}ms`, details);
  }

  function cloneItems(items) {
    return Array.isArray(items)
      ? items.map((item) => (item && typeof item === "object" ? { ...item } : item))
      : [];
  }

  function readCollectionCache(collectionName) {
    const cached = collectionCache.get(collectionName);
    if (!cached || now() - cached.cachedAt > COLLECTION_CACHE_TTL_MS) {
      return null;
    }

    return cloneItems(cached.items);
  }

  function writeCollectionCache(collectionName, items) {
    collectionCache.set(collectionName, {
      cachedAt: now(),
      items: cloneItems(items),
    });
  }

  function clearCollectionCache(collectionName) {
    collectionCache.delete(collectionName);
    collectionRequests.delete(collectionName);
    collectionCacheVersions.set(
      collectionName,
      (collectionCacheVersions.get(collectionName) || 0) + 1
    );
    Array.from(itemCache.keys()).forEach((cacheKey) => {
      if (cacheKey.startsWith(`${collectionName}:`)) {
        itemCache.delete(cacheKey);
      }
    });
    Array.from(itemRequests.keys()).forEach((cacheKey) => {
      if (cacheKey.startsWith(`${collectionName}:`)) {
        itemRequests.delete(cacheKey);
      }
    });
  }

  function getItemCacheKey(collectionName, itemId) {
    return `${collectionName}:${itemId}`;
  }

  function cloneItem(item) {
    return item && typeof item === "object" ? { ...item } : item || null;
  }

  function readItemCache(collectionName, itemId) {
    const cached = itemCache.get(getItemCacheKey(collectionName, itemId));
    if (!cached || now() - cached.cachedAt > COLLECTION_CACHE_TTL_MS) {
      return null;
    }

    return cloneItem(cached.item);
  }

  function writeItemCache(collectionName, itemId, item) {
    itemCache.set(getItemCacheKey(collectionName, itemId), {
      cachedAt: now(),
      item: cloneItem(item),
    });
  }

  function waitForBanikAuth() {
    if (window.BanikAuth && typeof window.BanikAuth.getIdToken === "function") {
      return Promise.resolve(window.BanikAuth);
    }

    return new Promise((resolve) => {
      let timeoutId = 0;

      const finish = () => {
        window.clearTimeout(timeoutId);
        window.removeEventListener("banik-auth-ready", finish);
        resolve(window.BanikAuth || null);
      };

      window.addEventListener("banik-auth-ready", finish, { once: true });
      timeoutId = window.setTimeout(finish, AUTH_READY_TIMEOUT_MS);
    });
  }

  async function readAuthHeaders({ forceRefresh = false } = {}) {
    const startedAt = now();
    const authService = await waitForBanikAuth();

    if (!authService || typeof authService.getIdToken !== "function") {
      logPerf("auth headers skipped", startedAt, { reason: "auth service unavailable" });
      return {};
    }

    try {
      if (typeof authService.getCurrentUser === "function") {
        await authService.getCurrentUser();
      }

      const token = await authService.getIdToken(forceRefresh);
      logPerf("auth headers", startedAt, { forceRefresh, hasToken: Boolean(token) });
      return token ? { Authorization: `Bearer ${token}` } : {};
    } catch {
      logPerf("auth headers failed", startedAt, { forceRefresh });
      return {};
    }
  }

  async function getAuthHeaders({ forceRefresh = false } = {}) {
    if (forceRefresh) {
      return readAuthHeaders({ forceRefresh });
    }

    if (!authHeadersRequest) {
      authHeadersRequest = readAuthHeaders().finally(() => {
        authHeadersRequest = null;
      });
    }

    return authHeadersRequest;
  }

  function getWorkspaceHeaders() {
    const workspaceId =
      String(localStorage.getItem("banikBooksWorkspaceId") || "").trim() ||
      document.documentElement.dataset.workspaceId ||
      "default";

    return {
      "X-Banik-Workspace-Id": workspaceId,
    };
  }

  async function getApiErrorMessage(response) {
    try {
      const contentType = response.headers.get("content-type") || "";

      if (contentType.includes("application/json")) {
        const payload = await response.json();
        return payload && (payload.error || payload.message) ? payload.error || payload.message : "";
      }

      return (await response.text()).trim();
    } catch {
      return "";
    }
  }

  function fetchJson(url, options, authHeaders) {
    return fetch(url, {
      headers: {
        "Content-Type": "application/json",
        ...authHeaders,
        ...getWorkspaceHeaders(),
        ...(options.headers || {}),
      },
      ...options,
    });
  }

  async function requestJson(url, options = {}) {
    const startedAt = now();
    const method = options.method || "GET";
    let authHeaders = await getAuthHeaders();
    let response = await fetchJson(url, options, authHeaders);

    if (response.status === 401) {
      authHeaders = await getAuthHeaders({ forceRefresh: true });
      response = await fetchJson(url, options, authHeaders);
    }

    if (!response.ok) {
      const errorMessage = await getApiErrorMessage(response);
      logPerf(`${method} ${url}`, startedAt, { status: response.status, ok: false });
      throw new Error(
        `API request failed: ${response.status}${errorMessage ? ` - ${errorMessage}` : ""}`
      );
    }

    const payload = await response.json();
    logPerf(`${method} ${url}`, startedAt, { status: response.status, ok: true });
    return payload;
  }

  async function list(collectionName) {
    const endpoint = ENDPOINTS[collectionName];

    if (!endpoint) {
      throw new Error(`Unknown API collection: ${collectionName}`);
    }

    const cachedItems = readCollectionCache(collectionName);
    if (cachedItems) {
      return cachedItems;
    }

    if (!collectionRequests.has(collectionName)) {
      const cacheVersion = collectionCacheVersions.get(collectionName) || 0;
      collectionRequests.set(
        collectionName,
        requestJson(endpoint)
          .then((payload) => {
            const items = Array.isArray(payload.items) ? payload.items : [];
            if ((collectionCacheVersions.get(collectionName) || 0) === cacheVersion) {
              writeCollectionCache(collectionName, items);
              items.forEach((item) => {
                if (item && item.id) {
                  writeItemCache(collectionName, item.id, item);
                }
              });
            }
            return cloneItems(items);
          })
          .finally(() => {
            collectionRequests.delete(collectionName);
          })
      );
    }

    return cloneItems(await collectionRequests.get(collectionName));
  }

  async function getItem(collectionName, itemId) {
    const endpoint = ENDPOINTS[collectionName];

    if (!endpoint) {
      throw new Error(`Unknown API collection: ${collectionName}`);
    }

    if (!itemId) {
      throw new Error("Missing API item id.");
    }

    const cachedItem = readItemCache(collectionName, itemId);
    if (cachedItem) {
      return cachedItem;
    }

    const cacheKey = getItemCacheKey(collectionName, itemId);
    if (!itemRequests.has(cacheKey)) {
      itemRequests.set(
        cacheKey,
        requestJson(`${endpoint}/${encodeURIComponent(itemId)}`)
          .then((payload) => {
            const item = payload.item || null;
            writeItemCache(collectionName, itemId, item);
            return cloneItem(item);
          })
          .finally(() => {
            itemRequests.delete(cacheKey);
          })
      );
    }

    return cloneItem(await itemRequests.get(cacheKey));
  }

  async function replace(collectionName, items) {
    const endpoint = ENDPOINTS[collectionName];

    if (!endpoint) {
      throw new Error(`Unknown API collection: ${collectionName}`);
    }

    const payload = await requestJson(endpoint, {
      method: "PUT",
      body: JSON.stringify({ items: Array.isArray(items) ? items : [] }),
    });
    const savedItems = Array.isArray(payload.items) ? payload.items : [];
    writeCollectionCache(collectionName, savedItems);
    savedItems.forEach((item) => {
      if (item && item.id) {
        writeItemCache(collectionName, item.id, item);
      }
    });
    return cloneItems(savedItems);
  }

  async function upsert(collectionName, itemId, item) {
    const endpoint = ENDPOINTS[collectionName];

    if (!endpoint) {
      throw new Error(`Unknown API collection: ${collectionName}`);
    }

    if (!itemId) {
      throw new Error("Missing API item id.");
    }

    const payload = await requestJson(`${endpoint}/${encodeURIComponent(itemId)}`, {
      method: "PUT",
      body: JSON.stringify({ item }),
    });
    clearCollectionCache(collectionName);
    writeItemCache(collectionName, itemId, payload.item || item);
    return payload.item || item;
  }

  async function remove(collectionName, itemId) {
    const endpoint = ENDPOINTS[collectionName];

    if (!endpoint) {
      throw new Error(`Unknown API collection: ${collectionName}`);
    }

    if (!itemId) {
      throw new Error("Missing API item id.");
    }

    const payload = await requestJson(`${endpoint}/${encodeURIComponent(itemId)}`, {
      method: "DELETE",
    });
    const savedItems = Array.isArray(payload.items) ? payload.items : [];
    writeCollectionCache(collectionName, savedItems);
    itemCache.delete(getItemCacheKey(collectionName, itemId));
    return cloneItems(savedItems);
  }

  function readLocalArray(storageKey) {
    try {
      const parsed = JSON.parse(localStorage.getItem(storageKey) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  async function hydrate(collectionName, storageKey, filterItems = (items) => items) {
    try {
      const remoteItems = filterItems(await list(collectionName));
      const localItems = filterItems(readLocalArray(storageKey));

      if (remoteItems.length) {
        localStorage.setItem(storageKey, JSON.stringify(remoteItems));
        return remoteItems;
      }

      if (localItems.length) {
        await replace(collectionName, localItems);
      }

      return localItems;
    } catch (error) {
      console.warn(`Could not hydrate ${collectionName}.`, error);
      return readLocalArray(storageKey);
    }
  }

  async function getSetting(settingId) {
    const setting = await getItem("settings", settingId);
    return setting && setting.value && typeof setting.value === "object" ? setting.value : null;
  }

  async function saveSetting(settingId, value) {
    return upsert("settings", settingId, {
      id: settingId,
      value: value && typeof value === "object" ? value : {},
      updatedAt: new Date().toISOString(),
    });
  }

  async function prepareAChallan(payload) {
    return requestJson("/api/achallan/prepare", {
      method: "POST",
      body: JSON.stringify(payload && typeof payload === "object" ? payload : {}),
    });
  }

  async function getWorkspace() {
    return requestJson("/api/workspace");
  }

  async function exportBackup() {
    return requestJson("/api/backups/export");
  }

  async function importBackup(backupPayload) {
    return requestJson("/api/backups/import", {
      method: "PUT",
      body: JSON.stringify(backupPayload || {}),
    });
  }

  async function setAdminUserDisabled(userId, disabled) {
    const normalizedUserId = String(userId || "").trim();

    if (!normalizedUserId) {
      throw new Error("Missing user id.");
    }

    const payload = await requestJson(`/api/admin/users/${encodeURIComponent(normalizedUserId)}`, {
      method: "PATCH",
      body: JSON.stringify({ disabled: Boolean(disabled) }),
    });
    return payload.user || { id: normalizedUserId, disabled: Boolean(disabled) };
  }

  async function deleteAdminUser(userId) {
    const normalizedUserId = String(userId || "").trim();

    if (!normalizedUserId) {
      throw new Error("Missing user id.");
    }

    const payload = await requestJson(`/api/admin/users/${encodeURIComponent(normalizedUserId)}`, {
      method: "DELETE",
    });
    return payload.user || { id: normalizedUserId };
  }

  window.BanikApi = {
    deleteAdminUser,
    setAdminUserDisabled,
    hydrate,
    exportBackup,
    getSetting,
    getWorkspace,
    importBackup,
    list,
    prepareAChallan,
    remove,
    replace,
    saveSetting,
    upsert,
  };
})();
