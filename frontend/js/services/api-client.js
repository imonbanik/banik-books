(function () {
  if (window.BanikApi) return;
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
  const collectionRevisions = new Map();
  const itemCache = new Map();
  const itemVersions = new Map();
  const itemRequests = new Map();
  let authHeadersRequest = null;
  let workspaceContext = null;
  let contextGeneration = 0;
  const CONTEXT_KEY = "banikBooksActiveContext";

  function clearBusinessCache({ preserve = true, ownerId = "", companyId = "" } = {}) {
    let previous = {};
    try { previous = JSON.parse(localStorage.getItem(CONTEXT_KEY) || "null") || {}; } catch {}
    const keys = Object.keys(localStorage).filter((key) =>
      /^banikBooks/i.test(key) && ![CONTEXT_KEY, "banikBooksWorkspaceId"].includes(key) && !key.startsWith("banikBooksRecovery:"));
    const verified = Boolean(previous.userId && previous.companyId);
    // Verified accounting caches are read from the server. Keep only browser-only drafts/options on later switches.
    // Untagged legacy records still receive a full recovery copy before any cache is removed.
    const serverCacheKeys = new Set(["banikBooksJournals", "banikBooksPostedJournals", "banikBooksParties", "banikBooksChartOfAccounts", "banikBooksLedgers", "banikBooksAccountingPreferences", "banikBooksChallans", "banikBooksChallanRegisterEntries"]);
    const recoveryKeys = keys.filter((key) => key !== "banikBooksSettings" && (!verified || !serverCacheKeys.has(key)));
    try {
      if (preserve && recoveryKeys.length) {
        const snapshot = { ownerId: previous.userId || ownerId || "unknown", ownershipVerified: verified, originalOwnerId: previous.userId || "unknown", companyId: previous.companyId || companyId || "unknown", capturedAt: new Date().toISOString(), items: {} };
        const latestKey = `banikBooksRecovery:${snapshot.ownerId}:${encodeURIComponent(snapshot.companyId)}:latest`;
        let existing = null;
        if (verified) {
          try { existing = JSON.parse(localStorage.getItem(latestKey) || "null"); } catch {}
          Object.assign(snapshot.items, existing && existing.items || {});
        }
        recoveryKeys.sort().forEach((key) => { snapshot.items[key] = localStorage.getItem(key); });
        const content = JSON.stringify(snapshot.items);
        const duplicate = existing && JSON.stringify(existing.items) === content || !verified && Object.keys(localStorage).some((key) => {
          if (!key.startsWith(`banikBooksRecovery:${snapshot.ownerId}:`)) return false;
          try { const saved = JSON.parse(localStorage.getItem(key)); return !saved.ownershipVerified && JSON.stringify(saved.items) === content; } catch { return false; }
        });
        if (!duplicate) {
          // Never discard an unknown legacy copy. Known companies keep one latest browser-draft recovery copy.
          try { localStorage.setItem(verified ? latestKey : `banikBooksRecovery:${snapshot.ownerId}:${Date.now()}`, JSON.stringify(snapshot)); }
          catch { throw new Error("Browser recovery storage is full. Your existing data has been preserved. Download and remove old recovery copies in Team & Access before switching companies."); }
        }
      }
      keys.forEach((key) => localStorage.removeItem(key));
    } finally {
      // A full browser store must never keep a revoked permission or an in-flight request alive.
      contextGeneration += 1;
      collectionCache.clear(); collectionRequests.clear(); collectionCacheVersions.clear(); collectionRevisions.clear();
      itemCache.clear(); itemVersions.clear(); itemRequests.clear();
      authHeadersRequest = null;
      workspaceContext = null;
      window.dispatchEvent(new Event("banik-cache-cleared"));
    }
  }

  function setIdentity(userId) {
    let previous = {};
    try { previous = JSON.parse(localStorage.getItem(CONTEXT_KEY) || "{}"); } catch {}
    if (previous.userId !== userId) {
      clearBusinessCache({ ownerId: previous.userId || userId });
      localStorage.setItem(CONTEXT_KEY, JSON.stringify({ userId, companyId: "" }));
      return true;
    }
    return false;
  }

  function setWorkspaceContext(context) {
    workspaceContext = context;
    window.dispatchEvent(new CustomEvent("banik-company-ready", { detail: context }));
    return context;
  }

  function getContext() { return workspaceContext; }
  function can(permission) { return Boolean(workspaceContext && workspaceContext.permissions && workspaceContext.permissions[permission] === true); }

  async function getCompanies() {
    const payload = await requestJson("/api/companies");
    return Array.isArray(payload.companies) ? payload.companies : [];
  }

  async function selectCompany(companyId, { reload = true } = {}) {
    const companies = await getCompanies();
    if (!companies.some((company) => company.id === companyId)) throw new Error("Company access is not available.");
    let previous = {};
    try { previous = JSON.parse(localStorage.getItem(CONTEXT_KEY) || "{}"); } catch {}
    if (previous.companyId !== companyId) {
      clearBusinessCache({ ownerId: previous.userId, companyId: previous.companyId });
      localStorage.setItem(CONTEXT_KEY, JSON.stringify({ userId: previous.userId, companyId }));
    }
    const context = await getWorkspace();
    if (reload) window.location.assign("/workspace.html");
    return context;
  }

  window.addEventListener("storage", (event) => {
    if (event.key === CONTEXT_KEY) {
      // All legacy pages share browser business keys. Reload other tabs before they can use a different company's cache.
      window.location.reload();
    }
  });

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
    collectionRevisions.delete(collectionName);
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
    itemVersions.set(getItemCacheKey(collectionName, itemId), item ? Number(item.version || 0) : null);
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

    let selected = {};
    try { selected = JSON.parse(localStorage.getItem(CONTEXT_KEY) || "{}"); } catch {}
    return {
      "X-Banik-Workspace-Id": workspaceId,
      ...(selected.companyId ? { "X-Banik-Company-Id": selected.companyId } : {}),
    };
  }

  async function getApiErrorDetails(response) {
    try {
      const contentType = response.headers.get("content-type") || "";

      if (contentType.includes("application/json")) {
        const payload = await response.json();
        return { message: payload && (payload.error || payload.message) || "", code: payload && payload.code || "" };
      }

      return { message: (await response.text()).trim(), code: "" };
    } catch {
      return { message: "", code: "" };
    }
  }

  function fetchJson(url, options, authHeaders) {
    return fetch(url, {
      ...options,
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders,
        ...getWorkspaceHeaders(),
        ...(options.headers || {}),
      },
    });
  }

  async function requestJson(url, options = {}) {
    const startedAt = now();
    const method = options.method || "GET";
    const initialGeneration = contextGeneration;
    const hadContext = Boolean(workspaceContext);
    const initializationRoute = /^\/api\/(companies(?:\?|$)|workspace(?:\?|$)|invitations(?:\/|$)|admin(?:\/|$))/.test(url);
    if (!initializationRoute) {
      const authService = await waitForBanikAuth();
      const user = authService && typeof authService.getCurrentUser === "function" ? await authService.getCurrentUser() : null;
      if (!user || !(user.companyId || workspaceContext && workspaceContext.companyId)) {
        const error = new Error("Sign in and select a company before accessing its data."); error.status = 401; throw error;
      }
      let selected = {};
      try { selected = JSON.parse(localStorage.getItem(CONTEXT_KEY) || "{}"); } catch {}
      if (user.companyId && selected.companyId && user.companyId !== selected.companyId) throw new Error("Company changed. Please open the company again before saving.");
      if (hadContext && initialGeneration !== contextGeneration) throw new Error("Company changed while the request was waiting. Please try again.");
    }
    const generation = contextGeneration;
    if (options.body && typeof options.body === "object") options = { ...options, body: JSON.stringify(options.body) };
    let authHeaders = await getAuthHeaders();
    if (!authHeaders.Authorization) {
      const error = new Error("Please sign in with a verified account before accessing company data.");
      error.status = 401;
      throw error;
    }
    if (generation !== contextGeneration) throw new Error("Company changed while the request was waiting. Please try again.");
    let response = await fetchJson(url, options, authHeaders);

    if (response.status === 401) {
      authHeaders = await getAuthHeaders({ forceRefresh: true });
      if (generation !== contextGeneration) throw new Error("Company changed while the request was waiting. Please try again.");
      if (authHeaders.Authorization) response = await fetchJson(url, options, authHeaders);
    }

    if (!response.ok) {
      const details = await getApiErrorDetails(response);
      const errorMessage = details.message;
      logPerf(`${method} ${url}`, startedAt, { status: response.status, ok: false });
      const error = new Error(errorMessage || `API request failed: ${response.status}`);
      error.status = response.status;
      error.code = details.code;
      if (response.status === 401 || details.code === "COMPANY_ACCESS_DENIED" || response.status === 403 && url === "/api/workspace") {
        try { clearBusinessCache(); }
        catch (cacheError) { collectionCache.clear(); itemCache.clear(); workspaceContext = null; console.warn(cacheError.message); }
        window.dispatchEvent(new CustomEvent("banik-access-denied", { detail: { status: response.status } }));
      } else if (response.status === 403) {
        const entry = Object.entries(ENDPOINTS).find(([, endpoint]) => url === endpoint || url.startsWith(`${endpoint}/`) || url.startsWith(`${endpoint}?`));
        if (entry) clearCollectionCache(entry[0]);
      }
      throw error;
    }

    const payload = response.status === 204 ? {} : await response.json();
    if (generation !== contextGeneration) throw new Error("Company changed while the request was running. Please try again.");
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
              if (payload.revision) collectionRevisions.set(collectionName, payload.revision);
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

    if (!collectionRevisions.has(collectionName)) {
      const current = await requestJson(endpoint);
      if (!current.revision) throw new Error("Could not verify the current company data version. Refresh before saving.");
      collectionRevisions.set(collectionName, current.revision);
    }
    const payload = await requestJson(endpoint, {
      method: "PUT",
      body: JSON.stringify({ items: Array.isArray(items) ? items : [], expectedRevision: collectionRevisions.get(collectionName) }),
    });
    if (payload.revision) collectionRevisions.set(collectionName, payload.revision);
    else collectionRevisions.delete(collectionName);
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

    let saveItem = item;
    if (!Number.isInteger(item && item.version)) {
      const versionKey = getItemCacheKey(collectionName, itemId);
      if (!itemVersions.has(versionKey)) await getItem(collectionName, itemId);
      const version = itemVersions.get(versionKey);
      if (Number.isInteger(version)) saveItem = { ...item, version };
    }
    const payload = await requestJson(`${endpoint}/${encodeURIComponent(itemId)}`, {
      method: "PUT",
      body: JSON.stringify({ item: saveItem }),
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

    const versionKey = getItemCacheKey(collectionName, itemId);
    if (!itemVersions.has(versionKey)) await getItem(collectionName, itemId);
    const payload = await requestJson(`${endpoint}/${encodeURIComponent(itemId)}`, {
      method: "DELETE",
      body: JSON.stringify({ expectedVersion: Number(itemVersions.get(versionKey) || 0) }),
    });
    const savedItems = Array.isArray(payload.items) ? payload.items : [];
    writeCollectionCache(collectionName, savedItems);
    collectionRevisions.delete(collectionName);
    itemCache.delete(getItemCacheKey(collectionName, itemId));
    itemVersions.delete(getItemCacheKey(collectionName, itemId));
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
    const remoteItems = filterItems(await list(collectionName));
    localStorage.setItem(storageKey, JSON.stringify(remoteItems));
    return remoteItems;
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
    return setWorkspaceContext(await requestJson("/api/workspace"));
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
    request: requestJson,
    can,
    getContext,
    getCompanies,
    selectCompany,
    setIdentity,
    clearBusinessCache,
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
