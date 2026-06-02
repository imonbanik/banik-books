document.addEventListener("DOMContentLoaded", async () => {
  const currentUser = await window.BanikAuth.getCurrentUser();
  const summary = document.getElementById("adminSummary");
  const tableHead = document.getElementById("adminTableHead");
  const tableBody = document.getElementById("adminTableBody");

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

  await render();
});
