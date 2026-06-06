(function () {
  const ENDPOINTS = Object.freeze({
    journals: "/api/journals",
    parties: "/api/parties",
    chartOfAccounts: "/api/chart-of-accounts",
    challans: "/api/challans",
    settings: "/api/settings",
  });
  const AUTH_READY_TIMEOUT_MS = 15000;

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

  async function getAuthHeaders({ forceRefresh = false } = {}) {
    const authService = await waitForBanikAuth();

    if (!authService || typeof authService.getIdToken !== "function") {
      return {};
    }

    try {
      if (typeof authService.getCurrentUser === "function") {
        await authService.getCurrentUser();
      }

      const token = await authService.getIdToken(forceRefresh);
      return token ? { Authorization: `Bearer ${token}` } : {};
    } catch {
      return {};
    }
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
    let authHeaders = await getAuthHeaders();
    let response = await fetchJson(url, options, authHeaders);

    if (response.status === 401) {
      authHeaders = await getAuthHeaders({ forceRefresh: true });
      response = await fetchJson(url, options, authHeaders);
    }

    if (!response.ok) {
      const errorMessage = await getApiErrorMessage(response);
      throw new Error(
        `API request failed: ${response.status}${errorMessage ? ` - ${errorMessage}` : ""}`
      );
    }

    return response.json();
  }

  async function list(collectionName) {
    const endpoint = ENDPOINTS[collectionName];

    if (!endpoint) {
      throw new Error(`Unknown API collection: ${collectionName}`);
    }

    const payload = await requestJson(endpoint);
    return Array.isArray(payload.items) ? payload.items : [];
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
    return Array.isArray(payload.items) ? payload.items : [];
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
    return Array.isArray(payload.items) ? payload.items : [];
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
    const settings = await list("settings");
    const setting = settings.find((item) => item && item.id === settingId);
    return setting && setting.value && typeof setting.value === "object" ? setting.value : null;
  }

  async function saveSetting(settingId, value) {
    return upsert("settings", settingId, {
      id: settingId,
      value: value && typeof value === "object" ? value : {},
      updatedAt: new Date().toISOString(),
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
    remove,
    replace,
    saveSetting,
    upsert,
  };
})();
