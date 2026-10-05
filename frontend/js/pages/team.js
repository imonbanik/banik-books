document.addEventListener("DOMContentLoaded", async () => {
  const api = window.BanikApi;
  const status = document.getElementById("team-status");
  const inviteForm = document.getElementById("team-invite-form");
  const memberForm = document.getElementById("member-form");
  const dialog = document.getElementById("member-dialog");
  let user;
  let catalog = [];
  let defaults = {};
  let members = [];
  let editingMember = null;
  let activityCursor = "";
  const activityLoadMore = document.getElementById("activity-load-more");
  const actionLabels = {
    "journal.created": "Draft created", "journal.created-and-posted": "Journal created and posted", "journal.updated": "Draft updated",
    "journal.submitted": "Submitted for review", "journal.returned": "Returned for changes", "journal.posted": "Journal posted",
    "journal.reversed": "Journal reversed", "journal.reversal-created": "Reversal entry created", "journal.archived": "Draft archived",
    "company.created": "Company activated", "team.invited": "Colleague invited", "team.invitation_resent": "Invitation resent",
    "team.invitation_revoked": "Invitation revoked", "team.invitation_accepted": "Invitation accepted",
    "team.member_active": "Member access restored", "team.member_suspended": "Member suspended", "team.member_removed": "Member removed", "team.permissions_changed": "Member permissions changed",
    ...Object.fromEntries([["parties", "Party"], ["chartOfAccounts", "Chart of accounts"], ["challans", "Challan"], ["settings", "Company settings"]].flatMap(([key, label]) => [[`${key}.created`, `${label} created`], [`${key}.updated`, `${label} updated`], [`${key}.deleted`, `${label} deleted`], [`${key}.replaced`, `${label} records updated`]])),
    "backup.restored": "Company backup restored",
  };
  Object.entries(actionLabels).forEach(([value, label]) => {
    const option = document.createElement("option"); option.value = value; option.textContent = label; document.getElementById("activity-action").append(option);
  });
  const permissionLabels = {
    "journals.viewAll": "View everyone's journal entries", "journals.create": "Create journal drafts",
    "journals.editOwn": "Edit own journal drafts", "journals.editAll": "Edit everyone's journal drafts",
    "journals.submit": "Submit entries for review", "journals.post": "Post entries directly",
    "journals.approve": "Approve and post submitted entries", "journals.reverse": "Reverse posted entries",
    "parties.view": "View the party directory", "parties.manage": "Create and edit parties",
    "chartOfAccounts.view": "View the chart of accounts", "chartOfAccounts.manage": "Create and edit accounts",
    "reports.view": "View all financial reports",
    "reports.general-ledger": "View General Ledger", "reports.party-wise-transaction": "View Party Wise Transactions",
    "reports.trial-balance": "View Trial Balance", "reports.statement-of-financial-position": "View Statement of Financial Position",
    "reports.statement-of-profit-loss-and-oci": "View Statement of Profit or Loss and OCI",
    "reports.statement-of-changes-in-equity": "View Statement of Changes in Equity",
    "reports.statement-of-cash-flows": "View Statement of Cash Flows", "reports.notes-to-the-accounts": "View Notes to the Accounts", "challans.view": "View challans", "challans.manage": "Create and edit challans",
    "exports.download": "Print and download data", "team.manage": "Manage team access", "activity.view": "View company activity",
    "tools.necessary-tools": "Open Necessary Tools", "tools.cheque-printer": "Use Cheque Printer",
    "tools.payroll-tax-calculator": "Use Payroll Tax Calculator", "tools.vat-tax-calculator": "Use Withholding VAT/Tax Calculator",
    "tools.tax-vat-customs-rates": "View Tax, VAT & Customs Rates", "tools.emi-calculator": "Use EMI Calculator", "tools.invoice-generator": "Use Invoice Generator",
  };
  const escape = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
  const date = (value) => {
    if (!value) return "—";
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? "—" : new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dhaka", dateStyle: "medium", timeStyle: "short" }).format(parsed);
  };
  function message(value, error = false) { status.textContent = value; status.className = `auth-form-status ${error ? "auth-form-status--error" : "auth-form-status--success"}`; }
  function permissions(container, values) {
    container.replaceChildren();
    catalog.filter((permission) => permission.key !== "company.settings").forEach((permission) => {
      const label = document.createElement("label");
      const input = document.createElement("input"); input.type = "checkbox"; input.name = permission.key; input.checked = values[permission.key] === true;
      if (permission.enabled === false || permission.available === false) { input.disabled = true; input.checked = false; }
      label.append(input, document.createTextNode(permissionLabels[permission.key] || permission.label || permission.key)); container.append(label);
    });
  }
  function readPermissions(container) { return Object.fromEntries([...container.querySelectorAll("input")].map((input) => [input.name, !input.disabled && input.checked])); }
  function roleDefaults(role) {
    if (defaults[role]) return defaults[role];
    return Object.fromEntries(catalog.map((item) => [item.key, Array.isArray(item.defaultRoles) ? item.defaultRoles.includes(role) : false]));
  }
  function showInvitation(result) {
    document.getElementById("team-invite-result").hidden = false;
    document.getElementById("team-invite-url").value = result.inviteUrl ? new URL(result.inviteUrl, window.location.origin).href : "";
    document.getElementById("team-invite-delivery").textContent = result.emailSent
      ? "Invitation email sent. You can also share this link with your colleague."
      : "Invitation created. Share this link with your colleague to let them join.";
  }
  async function loadTeam() {
    const payload = await api.request("/api/team");
    catalog = Array.isArray(payload.permissionCatalog) ? payload.permissionCatalog.map((entry) => typeof entry === "string" ? { key: entry, label: entry } : entry) : Object.entries(payload.permissionCatalog || {}).map(([key, value]) => ({ key, ...(typeof value === "object" ? value : { label: value }) }));
    const modules = payload.company && payload.company.modules || {};
    catalog = catalog.map((permission) => ({ ...permission, available: permission.available !== false && (!permission.module || modules[permission.module] === true) && (user.companyRole === "owner" || api.can(permission.key)) }));
    defaults = payload.roleDefaults || payload.defaultPermissions || {};
    members = payload.members || [];
    permissions(document.getElementById("invite-permissions"), roleDefaults(inviteForm.elements.role.value));
    const rows = members.map((member) => `<tr><td>${escape(member.name || member.fullName || member.email)}<small>${escape(member.email)}</small></td><td>${escape(member.role)}</td><td><span class="team-badge team-badge--${escape(member.status)}">${escape(member.status || "active")}</span></td><td>${member.role === "owner" ? "Company owner" : (member.userId || member.id) === user.id ? "Your account" : `<button type="button" data-edit="${escape(member.userId || member.id)}">Edit access</button><button type="button" data-toggle="${escape(member.userId || member.id)}">${member.status === "suspended" ? "Restore access" : "Suspend"}</button>`}</td></tr>`);
    (payload.invitations || []).forEach((invitation) => {
      const state = invitation.status === "pending" && new Date(invitation.expiresAt) < new Date() ? "expired" : invitation.status || "pending";
      rows.push(`<tr><td>${escape(invitation.name || invitation.fullName || invitation.email)}<small>${escape(invitation.email)} · Expires ${escape(date(invitation.expiresAt))}</small></td><td>${escape(invitation.role)}</td><td><span class="team-badge team-badge--${escape(state)}">${escape(state)}</span></td><td>${["pending", "expired"].includes(state) ? `<button type="button" data-resend="${escape(invitation.id)}">Resend</button><button type="button" data-revoke="${escape(invitation.id)}">Revoke</button>` : "—"}</td></tr>`);
    });
    document.getElementById("team-members").innerHTML = rows.join("") || '<tr><td colspan="4">No team members yet.</td></tr>';
    const personSelect = document.getElementById("activity-person");
    personSelect.innerHTML = '<option value="">Everyone</option>' + members.map((member) => `<option value="${escape(member.userId || member.id)}">${escape(member.name || member.fullName || member.email)}</option>`).join("");
  }
  function activityValues(record) {
    if (record === null || record === undefined) return '<p class="team-muted">No record</p>';
    if (Array.isArray(record)) return `<p>${record.length} records</p>${record.slice(0, 20).map((entry) => activityValues(entry)).join("")}${record.length > 20 ? "<p>Additional records are included in this update.</p>" : ""}`;
    if (typeof record !== "object") return `<p>${escape(record)}</p>`;
    const labels = { number: "Voucher number", journalDate: "Journal date", status: "Status", description: "Description", reference: "Reference", fullName: "Name", companyName: "Company", companyAddress: "Company address", name: "Name", type: "Type", role: "Role", email: "Email", currency: "Currency", amount: "Amount", debit: "Debit", credit: "Credit", account: "Account", fiscalYearStart: "Fiscal year start", openingBalance: "Opening balance", tinNumber: "TIN", binNumber: "BIN" };
    const rows = [];
    for (const [key, value] of Object.entries(record)) {
      if (["id", "version", "legacy", "dataUrl", "chunkCount", "dataLength"].includes(key) || /(?:Id|Ids|By|ByName|At)$/.test(key) || /token|hash/i.test(key) || value === null || value === undefined) continue;
      if (key === "lines" && Array.isArray(value)) {
        const amounts = (amount) => Number(amount || 0).toLocaleString("en-BD", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        rows.push(`<dt>Journal lines</dt><dd>${value.map((line) => `<p><strong>${escape(line.account)}</strong> · Debit ${escape(amounts(line.debit))} · Credit ${escape(amounts(line.credit))}${line.name ? ` · ${escape(line.name)}` : ""}${line.description ? `<br>${escape(line.description)}` : ""}</p>`).join("")}</dd>`);
      } else if (key === "permissions" && value && typeof value === "object") {
        rows.push(`<dt>Access granted</dt><dd>${Object.keys(value).filter((permission) => value[permission] === true).map((permission) => escape(permissionLabels[permission] || "Company settings")).join("; ") || "No optional permissions"}</dd>`);
      } else if (key === "attachments" && Array.isArray(value)) {
        rows.push(`<dt>Attachments</dt><dd>${value.map((attachment) => escape(attachment.name || "Attachment")).join(", ") || "None"}</dd>`);
      } else {
        const label = labels[key] || key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (letter) => letter.toUpperCase());
        const display = value && typeof value === "object" ? activityValues(value) : escape(typeof value === "boolean" ? value ? "Yes" : "No" : value);
        rows.push(`<dt>${escape(label)}</dt><dd>${display}</dd>`);
      }
    }
    return rows.length ? `<dl class="team-change-fields">${rows.join("")}</dl>` : '<p class="team-muted">No accounting field changes</p>';
  }
  function activityDetails(item) {
    return `<div class="team-change-columns"><section><h4>Before</h4>${activityValues(item.before)}</section><section><h4>After</h4>${activityValues(item.after)}</section></div>`;
  }
  async function loadActivity(append = false) {
    if (user.companyRole !== "owner" && !api.can("activity.view")) return;
    const params = new URLSearchParams();
    new FormData(document.getElementById("activity-filter")).forEach((value, key) => {
      if (!String(value).trim()) return;
      if (key === "from") value = new Date(`${value}T00:00:00+06:00`).toISOString();
      if (key === "to") value = new Date(`${value}T23:59:59.999+06:00`).toISOString();
      params.set(key, value);
    });
    if (append && activityCursor) params.set("cursor", activityCursor);
    activityLoadMore.disabled = true;
    let payload;
    try { payload = await api.request(`/api/activity?${params}`); }
    finally { activityLoadMore.disabled = false; }
    if (!members.length) {
      const personSelect = document.getElementById("activity-person");
      (payload.items || []).forEach((item) => {
        const actorId = item.actorId || item.actor && item.actor.id;
        if (actorId && ![...personSelect.options].some((option) => option.value === actorId)) {
          const option = document.createElement("option"); option.value = actorId; option.textContent = item.actorName || item.actor && (item.actor.name || item.actor.email) || actorId; personSelect.append(option);
        }
      });
    }
    const activityRows = (payload.items || []).map((item) => `<tr><td>${escape(date(item.createdAt || item.timestamp || item.occurredAt))}</td><td>${escape(item.actorName || item.actor && (item.actor.name || item.actor.email) || item.actorId || "Historical user unavailable")}</td><td>${escape(actionLabels[item.action] || item.action)}</td><td>${escape(item.entityNumber || item.entityId || item.targetId || item.recordId || "—")}</td><td><details><summary>View changes</summary>${item.reason ? `<p>${escape(item.reason)}</p>` : ""}${activityDetails(item)}</details></td></tr>`).join("") || '<tr><td colspan="5">No activity matches these filters.</td></tr>';
    const rowsTarget = document.getElementById("activity-items");
    if (append) rowsTarget.insertAdjacentHTML("beforeend", activityRows);
    else rowsTarget.innerHTML = activityRows;
    activityCursor = payload.nextCursor || "";
    activityLoadMore.hidden = !activityCursor;
    document.getElementById("activity-more").textContent = activityCursor ? "Showing the latest matching activity. Load more to view earlier events." : "All matching activity is shown.";
  }
  function showRecovery() {
    const target = document.getElementById("team-recovery-list");
    target.replaceChildren();
    if (user.companyRole !== "owner") return;
    Object.keys(localStorage).filter((key) => key.startsWith(`banikBooksRecovery:${user.id}:`)).forEach((key) => {
      let snapshot;
      try { snapshot = JSON.parse(localStorage.getItem(key)); } catch { return; }
      const row = document.createElement("div"); row.className = "team-recovery-row";
      const button = document.createElement("button"); button.className = "secondary-button"; button.type = "button"; button.textContent = `Download copy · ${date(snapshot.capturedAt)}${snapshot.ownershipVerified ? "" : " · original owner unverified"}`;
      const remove = document.createElement("button"); remove.className = "secondary-button"; remove.type = "button"; remove.textContent = "Delete recovery copy"; remove.disabled = true;
      button.addEventListener("click", () => {
        const url = URL.createObjectURL(new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" }));
        const link = document.createElement("a"); link.href = url; link.download = `banik-browser-recovery-${snapshot.capturedAt.slice(0, 10)}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
        remove.disabled = false;
      });
      remove.addEventListener("click", () => {
        if (!window.confirm("Delete this browser recovery copy? Confirm that the downloaded file is saved and readable. This removes only the recovery copy from this browser; company records are unchanged.")) return;
        localStorage.removeItem(key); showRecovery(); message("Browser recovery copy deleted.");
      });
      row.append(button, remove); target.append(row);
    });
    document.getElementById("team-recovery-section").hidden = !target.children.length;
  }

  inviteForm.elements.role.addEventListener("change", () => permissions(document.getElementById("invite-permissions"), roleDefaults(inviteForm.elements.role.value)));
  memberForm.elements.role.addEventListener("change", () => permissions(document.getElementById("member-permissions"), roleDefaults(memberForm.elements.role.value)));
  inviteForm.addEventListener("submit", async (event) => {
    event.preventDefault(); const button = inviteForm.querySelector('button[type="submit"]'); button.disabled = true;
    try {
      const result = await api.request("/api/team/invitations", { method: "POST", body: { name: inviteForm.elements.name.value.trim(), email: inviteForm.elements.email.value.trim(), role: inviteForm.elements.role.value, permissions: readPermissions(document.getElementById("invite-permissions")) } });
      showInvitation(result); inviteForm.reset(); await loadTeam(); message("Invitation created.");
    } catch (error) { message(error.message, true); }
    finally { button.disabled = false; }
  });
  document.getElementById("team-copy-invite").addEventListener("click", async () => {
    const input = document.getElementById("team-invite-url");
    try { await navigator.clipboard.writeText(input.value); message("Invitation link copied."); }
    catch { input.select(); message("Select and copy the invitation link above."); }
  });
  document.getElementById("team-members").addEventListener("click", async (event) => {
    const button = event.target.closest("button"); if (!button) return;
    if (button.dataset.edit) {
      editingMember = members.find((member) => (member.userId || member.id) === button.dataset.edit);
      memberForm.elements.role.value = editingMember.role;
      document.getElementById("member-title").textContent = `Access for ${editingMember.name || editingMember.fullName || editingMember.email}`;
      document.getElementById("member-status").textContent = "";
      permissions(document.getElementById("member-permissions"), editingMember.permissions || {}); dialog.showModal(); return;
    }
    button.disabled = true;
    try {
      if (button.dataset.toggle) {
        const member = members.find((entry) => (entry.userId || entry.id) === button.dataset.toggle);
        await api.request(`/api/team/members/${encodeURIComponent(button.dataset.toggle)}`, { method: "PATCH", body: { status: member.status === "suspended" ? "active" : "suspended" } });
      } else if (button.dataset.resend) showInvitation(await api.request(`/api/team/invitations/${encodeURIComponent(button.dataset.resend)}/resend`, { method: "POST" }));
      else if (button.dataset.revoke) await api.request(`/api/team/invitations/${encodeURIComponent(button.dataset.revoke)}`, { method: "DELETE" });
      await loadTeam(); await loadActivity(); message("Team access updated.");
    } catch (error) { message(error.message, true); button.disabled = false; }
  });
  document.getElementById("member-close").addEventListener("click", () => dialog.close());
  memberForm.addEventListener("submit", async (event) => {
    event.preventDefault(); const button = memberForm.querySelector('button[type="submit"]'); button.disabled = true;
    try {
      await api.request(`/api/team/members/${encodeURIComponent(editingMember.userId || editingMember.id)}`, { method: "PATCH", body: { role: memberForm.elements.role.value, permissions: readPermissions(document.getElementById("member-permissions")) } });
      dialog.close(); await loadTeam(); await loadActivity(); message("Member permissions saved.");
    } catch (error) { document.getElementById("member-status").textContent = error.message; }
    finally { button.disabled = false; }
  });
  activityLoadMore.addEventListener("click", async () => { try { await loadActivity(true); } catch (error) { message(error.message, true); } });
  document.getElementById("activity-filter").addEventListener("change", () => { activityCursor = ""; activityLoadMore.hidden = true; });
  document.getElementById("activity-filter").addEventListener("submit", async (event) => { event.preventDefault(); try { await loadActivity(); message("Activity updated."); } catch (error) { message(error.message, true); } });
  document.getElementById("team-export-backup").addEventListener("click", async (event) => {
    const button = event.currentTarget; button.disabled = true;
    const backupStatus = document.getElementById("team-backup-status");
    try {
      const backup = await api.exportBackup();
      const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" }));
      const link = document.createElement("a"); link.href = url; link.download = `banik-company-backup-${new Date().toISOString().slice(0, 10)}.json`; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      backupStatus.textContent = "Company backup downloaded.";
    } catch (error) { backupStatus.textContent = error.message; }
    finally { button.disabled = false; }
  });
  document.getElementById("team-restore-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = event.currentTarget.querySelector('button[type="submit"]');
    const backupStatus = document.getElementById("team-backup-status");
    const file = document.getElementById("team-backup-file").files[0];
    if (!file) return;
    button.disabled = true;
    try {
      const backup = JSON.parse(await file.text());
      const collections = ["journals", "parties", "chartOfAccounts", "challans", "settings"];
      const data = backup && backup.data;
      if (!data || !collections.every((key) => Array.isArray(data[key]))) throw new Error("Choose a complete BANIK Books company backup. Browser recovery copies must be reviewed and converted before restoring.");
      const counts = `${data.journals.length} journal entries, ${data.parties.length} parties, ${data.chartOfAccounts.length} account groups, and ${data.challans.length} challans`;
      if (!window.confirm(`Replace the accounting records in ${user.companyName} with ${counts} from ${file.name}? Current accounting records will be replaced. Existing activity history will remain. Continue only after saving a current company backup.`)) return;
      backupStatus.textContent = "Restoring company records…";
      await api.importBackup(backup);
      api.clearBusinessCache();
      await api.getWorkspace();
      backupStatus.textContent = "Company backup restored. Accounting pages will load the restored records.";
      document.getElementById("team-restore-form").reset();
      await loadActivity();
    } catch (error) { backupStatus.textContent = error.message; }
    finally { button.disabled = false; }
  });
  try {
    user = await window.BanikAuth.getCurrentUser();
    if (!user) return;
    document.getElementById("team-company").textContent = user.companyName;
    const owner = user.companyRole === "owner";
    document.getElementById("team-company-settings").hidden = !owner;
    document.getElementById("team-backup-section").hidden = !owner;
    const manageTeam = owner || api.can("team.manage");
    document.getElementById("team-invite-section").hidden = !manageTeam;
    document.getElementById("team-members-section").hidden = !manageTeam;
    if (manageTeam) await loadTeam();
    if (owner) showRecovery();
    const activityAllowed = owner || api.can("activity.view");
    document.getElementById("team-activity-section").hidden = !activityAllowed;
    if (activityAllowed) await loadActivity();
  } catch (error) { message(error.message, true); }
});
