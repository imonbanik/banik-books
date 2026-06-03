document.addEventListener("DOMContentLoaded", async () => {
  const currentUser = await window.BanikAuth.getCurrentUser();
  const summary = document.getElementById("adminSummary");
  const tableHead = document.getElementById("adminTableHead");
  const tableBody = document.getElementById("adminTableBody");
  const workspaceStatus = document.getElementById("adminWorkspaceStatus");
  const backupStatus = document.getElementById("adminBackupStatus");
  const exportBackupButton = document.getElementById("adminExportBackup");
  const importBackupInput = document.getElementById("adminImportBackup");

  if (!currentUser || currentUser.role !== "admin") {
    return;
  }

  function formatDate(value) {
    if (!value) {
      return "Never";
    }

    return new Intl.DateTimeFormat("en-BD", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function setBackupStatus(message, variant = "info") {
    backupStatus.textContent = message;
    backupStatus.dataset.variant = variant;
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

  async function getRegularUsers() {
    return (await window.BanikAuth.getUsers()).filter((user) => user.role !== "admin");
  }

  async function renderSummary(users) {
    const allUsers = await window.BanikAuth.getUsers();
    const enabledCount = users.reduce((count, user) => {
      const enabledModules = window.BanikAuth.modules.filter(
        (module) => user.permissions && user.permissions[module.key]
      ).length;
      return count + enabledModules;
    }, 0);

    summary.innerHTML = `
      <article class="admin-summary-card">
        <span>Total users</span>
        <strong>${users.length}</strong>
      </article>
      <article class="admin-summary-card">
        <span>Admin accounts</span>
        <strong>${allUsers.filter((user) => user.role === "admin").length}</strong>
      </article>
      <article class="admin-summary-card">
        <span>Enabled page groups</span>
        <strong>${enabledCount}</strong>
      </article>
    `;
  }

  async function persistPermission(userId, moduleKey, isEnabled) {
    const result = await window.BanikAuth.updateUserPermission(userId, moduleKey, isEnabled);

    if (!result.ok) {
      window.alert(result.message || "Could not update permission.");
    }

    await render();
  }

  function renderTable(users) {
    tableHead.innerHTML = `
      <tr>
        <th>User</th>
        <th>Account name</th>
        <th>Joined</th>
        <th>Last login</th>
        ${window.BanikAuth.modules.map((module) => `<th>${module.label}</th>`).join("")}
      </tr>
    `;

    tableBody.innerHTML = users.length
      ? users
          .map(
            (user) => `
              <tr>
                <td>
                  <strong>${escapeHtml(user.email)}</strong>
                  <span>${escapeHtml(user.id)}</span>
                </td>
                <td>${escapeHtml(user.fullName || user.companyName || "-")}</td>
                <td>${formatDate(user.createdAt)}</td>
                <td>${formatDate(user.lastLoginAt)}</td>
                ${window.BanikAuth.modules
                  .map(
                    (module) => `
                      <td class="admin-toggle-cell">
                        <label class="admin-switch">
                          <input
                            type="checkbox"
                            data-user-id="${user.id}"
                            data-module-key="${module.key}"
                            ${user.permissions && user.permissions[module.key] ? "checked" : ""}
                          />
                          <span></span>
                        </label>
                      </td>
                    `
                  )
                  .join("")}
              </tr>
            `
          )
          .join("")
      : `
        <tr>
          <td colspan="${window.BanikAuth.modules.length + 4}" class="admin-empty">
            No regular users have signed up yet.
          </td>
        </tr>
      `;
  }

  async function render() {
    const users = await getRegularUsers();
    await renderSummary(users);
    renderTable(users);
  }

  tableBody.addEventListener("change", async (event) => {
    const input = event.target.closest("input[data-user-id][data-module-key]");

    if (!input) {
      return;
    }

    input.disabled = true;
    await persistPermission(input.dataset.userId, input.dataset.moduleKey, input.checked);
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
