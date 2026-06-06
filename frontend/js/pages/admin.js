document.addEventListener("DOMContentLoaded", async () => {
  const authService = await waitForAuthService();
  const summary = document.getElementById("adminSummary");
  const tableHead = document.getElementById("adminTableHead");
  const tableBody = document.getElementById("adminTableBody");
  const workspaceStatus = document.getElementById("adminWorkspaceStatus");
  const backupStatus = document.getElementById("adminBackupStatus");
  const exportBackupButton = document.getElementById("adminExportBackup");
  const importBackupInput = document.getElementById("adminImportBackup");
  const exportUsersButton = document.getElementById("adminExportUsers");
  const userSortSelect = document.getElementById("adminUserSort");
  const userCount = document.getElementById("adminUserCount");
  const userStatus = document.getElementById("adminUserStatus");
  let usersCache = [];

  if (!authService) {
    return;
  }

  const currentUser = await authService.getCurrentUser();

  if (!currentUser || currentUser.role !== "admin") {
    return;
  }

  function waitForAuthService() {
    if (window.BanikAuth) {
      return Promise.resolve(window.BanikAuth);
    }

    return new Promise((resolve) => {
      const startedAt = Date.now();
      const timer = window.setInterval(() => {
        if (window.BanikAuth || Date.now() - startedAt > 12000) {
          window.clearInterval(timer);
          resolve(window.BanikAuth || null);
        }
      }, 80);
    });
  }

  function formatDate(value) {
    if (!value) {
      return "Never";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "Never";
    }

    return new Intl.DateTimeFormat("en-BD", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function getDisplayName(user) {
    return String(user.fullName || user.companyName || user.email || "Unnamed user").trim();
  }

  function getAccountName(user) {
    return String(user.companyName || user.fullName || "-").trim();
  }

  function getUserSerial(user) {
    return String(user.accountSerial || "Pending");
  }

  function getFirebaseUid(user) {
    return String(user.id || "-");
  }

  function getShortFirebaseUid(user) {
    const uid = getFirebaseUid(user);

    if (uid.length <= 14) {
      return uid;
    }

    return `${uid.slice(0, 6)}...${uid.slice(-5)}`;
  }

  function isCurrentAdminUser(user) {
    return (
      String(user && user.id ? user.id : "") === String(currentUser.id || "") ||
      String(user && user.email ? user.email : "").toLowerCase() ===
        String(currentUser.email || "").toLowerCase()
    );
  }

  function getUserStatusLabel(user) {
    return user.disabled ? "Disabled" : "Active";
  }

  function getSortValue(user, mode) {
    if (mode.startsWith("email")) {
      return String(user.email || "").toLowerCase();
    }

    if (mode.startsWith("joined")) {
      const joinedDate = new Date(user.createdAt || 0);
      return Number.isNaN(joinedDate.getTime()) ? 0 : joinedDate.getTime();
    }

    return getDisplayName(user).toLowerCase();
  }

  function getSortedUsers(users) {
    const mode = userSortSelect.value || "name-asc";
    const sortedUsers = [...users].sort((leftUser, rightUser) => {
      const leftRoleRank = leftUser.role === "admin" ? 0 : 1;
      const rightRoleRank = rightUser.role === "admin" ? 0 : 1;

      if (leftRoleRank !== rightRoleRank) {
        return leftRoleRank - rightRoleRank;
      }

      const leftValue = getSortValue(leftUser, mode);
      const rightValue = getSortValue(rightUser, mode);

      if (mode === "joined-desc") {
        return rightValue - leftValue;
      }

      const result = String(leftValue).localeCompare(String(rightValue), undefined, {
        numeric: true,
        sensitivity: "base",
      });

      return mode.endsWith("desc") ? -result : result;
    });

    return sortedUsers;
  }

  function setBackupStatus(message, variant = "info") {
    backupStatus.textContent = message;
    backupStatus.dataset.variant = variant;
  }

  function setUserStatus(message, variant = "info") {
    if (!userStatus) {
      return;
    }

    userStatus.textContent = message;
    userStatus.dataset.variant = variant;
  }

  function downloadJson(filename, payload) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function downloadExcel(filename, headers, rows) {
    const headHtml = headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("");
    const bodyHtml = rows
      .map(
        (row) => `
          <tr>
            ${row
              .map(
                (cell) =>
                  `<td style="mso-number-format:'\\@';">${escapeHtml(cell)}</td>`
              )
              .join("")}
          </tr>
        `
      )
      .join("");
    const excelHtml = `
      <!doctype html>
      <html>
        <head>
          <meta charset="UTF-8" />
        </head>
        <body>
          <table border="1">
            <thead><tr>${headHtml}</tr></thead>
            <tbody>${bodyHtml}</tbody>
          </table>
        </body>
      </html>
    `;
    const blob = new Blob(["\ufeff" + excelHtml], {
      type: "application/vnd.ms-excel;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function renderWorkspaceStatus() {
    if (!window.BanikApi || typeof window.BanikApi.getWorkspace !== "function") {
      workspaceStatus.innerHTML = `
        <article>
          <span>Workspace</span>
          <strong>Unavailable</strong>
        </article>
        <article>
          <span>Role</span>
          <strong>${escapeHtml(currentUser.role || "-")}</strong>
        </article>
        <article>
          <span>Backend</span>
          <strong>Offline</strong>
        </article>
      `;
      setBackupStatus("Backend API client is not ready.", "error");
      return;
    }

    try {
      const workspace = await window.BanikApi.getWorkspace();
      workspaceStatus.innerHTML = `
        <article>
          <span>Workspace</span>
          <strong>${escapeHtml(workspace.workspaceId || "default")}</strong>
        </article>
        <article>
          <span>Role</span>
          <strong>${escapeHtml(workspace.role || currentUser.role || "-")}</strong>
        </article>
        <article>
          <span>Backend</span>
          <strong>${escapeHtml(workspace.source || "connected")}</strong>
        </article>
      `;
    } catch {
      workspaceStatus.innerHTML = `
        <article>
          <span>Workspace</span>
          <strong>Unknown</strong>
        </article>
        <article>
          <span>Role</span>
          <strong>${escapeHtml(currentUser.role || "-")}</strong>
        </article>
        <article>
          <span>Backend</span>
          <strong>Unavailable</strong>
        </article>
      `;
      setBackupStatus("Could not connect to backend operations.", "error");
    }
  }

  function getEnabledModuleCount(user) {
    if (user.role === "admin") {
      return authService.modules.length;
    }

    return authService.modules.filter(
      (module) => user.permissions && user.permissions[module.key]
    ).length;
  }

  function renderSummary(users) {
    const adminCount = users.filter((user) => user.role === "admin").length;
    const enabledCount = users.reduce((count, user) => count + getEnabledModuleCount(user), 0);

    summary.innerHTML = `
      <article class="admin-summary-card">
        <span>Total users</span>
        <small>Signed-up accounts</small>
        <strong>${users.length}</strong>
      </article>
      <article class="admin-summary-card">
        <span>Admin accounts</span>
        <small>Full-control users</small>
        <strong>${adminCount}</strong>
      </article>
      <article class="admin-summary-card">
        <span>Enabled page groups</span>
        <small>Granted module access</small>
        <strong>${enabledCount}</strong>
      </article>
    `;
  }

  async function persistPermission(userId, moduleKey, isEnabled) {
    const targetUser = usersCache.find((user) => user.id === userId);

    if (targetUser && targetUser.role === "admin") {
      window.alert("Admin accounts always keep full access.");
      renderTable(usersCache);
      return;
    }

    const result = await authService.updateUserPermission(userId, moduleKey, isEnabled);

    if (!result.ok) {
      window.alert(result.message || "Could not update permission.");
      renderTable(usersCache);
      return;
    }

    usersCache = usersCache.map((user) => {
      if (user.id !== userId) {
        return user;
      }

      return {
        ...user,
        permissions: {
          ...(user.permissions || {}),
          [moduleKey]: Boolean(isEnabled),
        },
      };
    });
    renderSummary(usersCache);
    renderTable(usersCache);
  }

  function renderUserMeta(users) {
    const regularCount = users.filter((user) => user.role !== "admin").length;
    const adminCount = users.length - regularCount;
    userCount.textContent = `${users.length} total users / ${regularCount} regular / ${adminCount} admin`;
  }

  function renderTable(users) {
    const sortedUsers = getSortedUsers(users);

    tableHead.innerHTML = `
      <tr>
        <th class="admin-sticky-col admin-serial-col">Serial</th>
        <th class="admin-sticky-col admin-user-col">User</th>
        <th class="admin-firebase-col">Firebase UID</th>
        <th class="admin-account-col">Account name</th>
        <th class="admin-status-col">Status</th>
        <th class="admin-date-col">Joined</th>
        <th class="admin-date-col">Last login</th>
        <th class="admin-actions-col">Actions</th>
        ${authService.modules
          .map(
            (module) =>
              `<th class="admin-access-head"><span>${escapeHtml(module.label)}</span></th>`
          )
          .join("")}
      </tr>
    `;

    tableBody.innerHTML = sortedUsers.length
      ? sortedUsers
          .map(
            (user) => `
              <tr>
                <td class="admin-sticky-col admin-serial-col admin-serial-cell">
                  <strong>${escapeHtml(getUserSerial(user))}</strong>
                </td>
                <td class="admin-sticky-col admin-user-col admin-user-cell">
                  <strong>${escapeHtml(user.email)}</strong>
                  <span class="admin-role-pill ${user.role === "admin" ? "is-admin" : ""}">
                    ${escapeHtml(user.role === "admin" ? "Admin" : "User")}
                  </span>
                </td>
                <td class="admin-firebase-cell" title="${escapeHtml(getFirebaseUid(user))}">
                  ${escapeHtml(getShortFirebaseUid(user))}
                </td>
                <td class="admin-account-cell">${escapeHtml(getAccountName(user))}</td>
                <td class="admin-status-cell">
                  <span class="admin-status-pill ${user.disabled ? "is-disabled" : "is-active"}">
                    ${escapeHtml(getUserStatusLabel(user))}
                  </span>
                </td>
                <td>${formatDate(user.createdAt)}</td>
                <td>${formatDate(user.lastLoginAt)}</td>
                <td class="admin-user-actions-cell">
                  <button
                    class="admin-user-action-button ${user.disabled ? "is-enable" : "is-disable"}"
                    type="button"
                    data-admin-user-action="${user.disabled ? "enable" : "disable"}"
                    data-user-id="${escapeHtml(user.id)}"
                    ${isCurrentAdminUser(user) ? "disabled" : ""}
                  >
                    ${user.disabled ? "Enable" : "Disable"}
                  </button>
                  <button
                    class="admin-user-action-button is-delete"
                    type="button"
                    data-admin-user-action="delete"
                    data-user-id="${escapeHtml(user.id)}"
                    ${isCurrentAdminUser(user) ? "disabled" : ""}
                  >
                    Delete
                  </button>
                </td>
                ${authService.modules
                  .map((module) => {
                    const isEnabled =
                      user.role === "admin" ||
                      Boolean(user.permissions && user.permissions[module.key]);

                    return `
                      <td class="admin-toggle-cell">
                        <label class="admin-switch" aria-label="${escapeHtml(
                          `${module.label} access for ${user.email}`
                        )}">
                          <input
                            type="checkbox"
                            data-user-id="${user.id}"
                            data-module-key="${module.key}"
                            ${isEnabled ? "checked" : ""}
                            ${user.role === "admin" ? "disabled" : ""}
                          />
                          <span></span>
                        </label>
                      </td>
                    `;
                  })
                  .join("")}
              </tr>
            `
          )
          .join("")
      : `
        <tr>
          <td colspan="${authService.modules.length + 9}" class="admin-empty">
            No users have signed up yet.
          </td>
        </tr>
      `;
  }

  async function render() {
    usersCache = await authService.getUsers();
    renderUserMeta(usersCache);
    renderSummary(usersCache);
    renderTable(usersCache);
  }

  tableBody.addEventListener("change", async (event) => {
    const input = event.target.closest("input[data-user-id][data-module-key]");

    if (!input) {
      return;
    }

    input.disabled = true;
    await persistPermission(input.dataset.userId, input.dataset.moduleKey, input.checked);
  });

  userSortSelect.addEventListener("change", () => {
    renderTable(usersCache);
  });

  async function persistDisabledState(userId, shouldDisable) {
    if (!window.BanikApi || typeof window.BanikApi.setAdminUserDisabled !== "function") {
      setUserStatus("Admin user action API is not ready.", "error");
      return;
    }

    const targetUser = usersCache.find((user) => user.id === userId);

    if (!targetUser) {
      setUserStatus("User record was not found.", "error");
      return;
    }

    if (isCurrentAdminUser(targetUser)) {
      setUserStatus("You cannot disable your own admin account here.", "error");
      return;
    }

    const actionLabel = shouldDisable ? "disable" : "enable";
    const didConfirm = window.confirm(
      `${shouldDisable ? "Disable" : "Enable"} ${targetUser.email}?\n\n${
        shouldDisable
          ? "They will not be able to sign in until an admin enables the account again."
          : "They will be able to sign in again."
      }`
    );

    if (!didConfirm) {
      return;
    }

    setUserStatus(`${shouldDisable ? "Disabling" : "Enabling"} ${targetUser.email}...`, "info");

    try {
      await window.BanikApi.setAdminUserDisabled(userId, shouldDisable);
      usersCache = usersCache.map((user) =>
        user.id === userId
          ? {
              ...user,
              disabled: shouldDisable,
              disabledAt: shouldDisable ? new Date().toISOString() : "",
              enabledAt: shouldDisable ? "" : new Date().toISOString(),
            }
          : user
      );
      renderSummary(usersCache);
      renderTable(usersCache);
      setUserStatus(`${targetUser.email} is now ${shouldDisable ? "disabled" : "enabled"}.`, "success");
    } catch (error) {
      setUserStatus(error.message || `Could not ${actionLabel} this user.`, "error");
    }
  }

  async function deleteUserAccount(userId) {
    if (!window.BanikApi || typeof window.BanikApi.deleteAdminUser !== "function") {
      setUserStatus("Admin user delete API is not ready.", "error");
      return;
    }

    const targetUser = usersCache.find((user) => user.id === userId);

    if (!targetUser) {
      setUserStatus("User record was not found.", "error");
      return;
    }

    if (isCurrentAdminUser(targetUser)) {
      setUserStatus("You cannot delete your own admin account here.", "error");
      return;
    }

    const confirmation = window.prompt(
      `Permanent delete ${targetUser.email}?\n\nThis removes Firebase Auth, profile, uploaded assets, and backend workspace data for this user.\n\nType DELETE to continue.`
    );

    if (confirmation !== "DELETE") {
      setUserStatus("Delete cancelled.", "info");
      return;
    }

    setUserStatus(`Deleting ${targetUser.email} from server...`, "info");

    try {
      await window.BanikApi.deleteAdminUser(userId);
      usersCache = usersCache.filter((user) => user.id !== userId);
      renderUserMeta(usersCache);
      renderSummary(usersCache);
      renderTable(usersCache);
      setUserStatus(`${targetUser.email} was permanently deleted.`, "success");
    } catch (error) {
      setUserStatus(error.message || "Could not permanently delete this user.", "error");
    }
  }

  tableBody.addEventListener("click", async (event) => {
    const actionButton = event.target.closest("button[data-admin-user-action][data-user-id]");

    if (!actionButton) {
      return;
    }

    actionButton.disabled = true;
    const action = actionButton.dataset.adminUserAction;
    const userId = actionButton.dataset.userId;

    try {
      if (action === "disable") {
        await persistDisabledState(userId, true);
      } else if (action === "enable") {
        await persistDisabledState(userId, false);
      } else if (action === "delete") {
        await deleteUserAccount(userId);
      }
    } finally {
      if (document.body.contains(actionButton)) {
        actionButton.disabled = false;
      }
    }
  });

  exportUsersButton.addEventListener("click", () => {
    if (!usersCache.length) {
      window.alert("No users available to export.");
      return;
    }

    const headers = [
      "Serial",
      "Firebase UID",
      "Email",
      "Account name",
      "Role",
      "Status",
      "Joined",
      "Last login",
      ...authService.modules.map((module) => module.label),
    ];
    const rows = getSortedUsers(usersCache).map((user) => [
      getUserSerial(user),
      getFirebaseUid(user),
      user.email,
      getAccountName(user),
      user.role,
      getUserStatusLabel(user),
      formatDate(user.createdAt),
      formatDate(user.lastLoginAt),
      ...authService.modules.map((module) =>
        user.role === "admin" || (user.permissions && user.permissions[module.key])
          ? "Yes"
          : "No"
      ),
    ]);
    const datePart = new Date().toISOString().slice(0, 10);

    downloadExcel(`banik-books-user-access-${datePart}.xls`, headers, rows);
  });

  exportBackupButton.addEventListener("click", async () => {
    if (!window.BanikApi || typeof window.BanikApi.exportBackup !== "function") {
      setBackupStatus("Backup API is not ready.", "error");
      return;
    }

    exportBackupButton.disabled = true;
    setBackupStatus("Preparing backup...", "info");

    try {
      const backup = await window.BanikApi.exportBackup();
      const workspaceId = backup.workspaceId || "default";
      const datePart = new Date().toISOString().slice(0, 10);
      downloadJson(`banik-books-${workspaceId}-backup-${datePart}.json`, backup);
      setBackupStatus("Backup exported successfully.", "success");
    } catch {
      setBackupStatus("Could not export backup. Check backend auth and try again.", "error");
    } finally {
      exportBackupButton.disabled = false;
    }
  });

  importBackupInput.addEventListener("change", async () => {
    const file = importBackupInput.files && importBackupInput.files[0];

    if (!file) {
      return;
    }

    if (!window.BanikApi || typeof window.BanikApi.importBackup !== "function") {
      setBackupStatus("Backup API is not ready.", "error");
      importBackupInput.value = "";
      return;
    }

    try {
      const backup = JSON.parse(await file.text());
      const confirmed = window.confirm(
        "Importing this backup will replace backend data for the current workspace. Continue?"
      );

      if (!confirmed) {
        setBackupStatus("Backup import cancelled.", "info");
        return;
      }

      setBackupStatus("Importing backup...", "info");
      await window.BanikApi.importBackup(backup);
      setBackupStatus("Backup imported successfully. Refresh opened report pages to reload data.", "success");
    } catch {
      setBackupStatus("Could not import backup. Confirm the JSON file and admin permission.", "error");
    } finally {
      importBackupInput.value = "";
    }
  });

  await renderWorkspaceStatus();
  await render();
});
