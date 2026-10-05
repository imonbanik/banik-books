const fromDateInput = document.querySelector("#journal-register-from");
const toDateInput = document.querySelector("#journal-register-to");
const statusInput = document.querySelector("#journal-register-status");
const creatorInput = document.querySelector("#journal-register-creator");
const registerRows = document.querySelector("#journal-register-rows");
const totalDebitCell = document.querySelector("#journal-register-total-debit");
const totalCreditCell = document.querySelector("#journal-register-total-credit");
const registerMessage = document.querySelector("#journal-register-message");
const refreshButton = document.querySelector("#journal-register-refresh");
const deleteConfirmModal = document.querySelector("#journal-register-delete-confirm");
const deleteConfirmYes = document.querySelector("#journal-register-delete-yes");
const deleteConfirmNo = document.querySelector("#journal-register-delete-no");
let pendingDeleteJournalNumber = "";
let journals = [];
let workspaceContext = null;

function getSavedJournals() { return [...journals]; }
function isPosted(journal) { return !journal.status || journal.status === "posted"; }
function canArchive(journal) {
  return workspaceContext && ["draft", "returned"].includes(journal.status) &&
    (window.BanikApi.can("journals.editAll") ||
      (window.BanikApi.can("journals.editOwn") && journal.createdBy === workspaceContext.userId));
}
function formatActivityTime(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dhaka", year: "numeric", month: "short", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: true,
  }).format(date) + " (BDT)" : "Unavailable";
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (character) => {
    const replacements = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };

    return replacements[character];
  });
}

function parseAmount(value) {
  return Number.parseFloat(String(value || "").replace(/,/g, "").replace(/[^\d.-]/g, "")) || 0;
}

function formatAmount(value) {
  return window.BanikAccounting
    ? window.BanikAccounting.formatNumber(value)
    : Number(value || 0).toFixed(2);
}

function formatDateForDisplay(dateValue) {
  return window.BanikAccounting ? window.BanikAccounting.formatDate(dateValue) : dateValue;
}

function getJournalSequence(number) {
  const sequence = Number((String(number || "").match(/(\d+)$/) || [])[1]);
  return Number.isFinite(sequence) ? sequence : 0;
}

function getFilteredJournals() {
  const fromDate = fromDateInput.value;
  const toDate = toDateInput.value;

  return getSavedJournals()
    .filter((journal) => {
      const journalDate = String(journal.journalDate || "");
      if (statusInput.value && (journal.status || "posted") !== statusInput.value) return false;
      if (creatorInput.value && (journal.createdBy || "legacy") !== creatorInput.value) return false;

      if (fromDate && journalDate < fromDate) {
        return false;
      }

      if (toDate && journalDate > toDate) {
        return false;
      }

      return true;
    })
    .sort((left, right) => {
      const dateSort = String(left.journalDate || "").localeCompare(String(right.journalDate || ""));
      return dateSort || getJournalSequence(left.number) - getJournalSequence(right.number);
    });
}

function buildRegisterRows(journals) {
  const rows = [];

  journals.forEach((journal) => {
    const lines = Array.isArray(journal.lines) ? journal.lines : [];

    if (!lines.length) {
      rows.push({ journal, line: {}, debit: 0, credit: 0 });
      return;
    }

    lines.forEach((line) => {
      rows.push({
        journal,
        line,
        debit: parseAmount(line.debit),
        credit: parseAmount(line.credit),
      });
    });
  });

  return rows;
}

function showDeleteConfirm(number) {
  const journal = journals.find((item) => (item.id || item.number) === number);
  if (!journal || !canArchive(journal)) return;
  pendingDeleteJournalNumber = number;
  deleteConfirmModal.hidden = false;
  document.body.classList.add("modal-open");
  deleteConfirmYes.focus();
}

function hideDeleteConfirm() {
  pendingDeleteJournalNumber = "";
  deleteConfirmModal.hidden = true;
  document.body.classList.remove("modal-open");
}

async function deletePendingJournal() {
  const journal = journals.find((item) => (item.id || item.number) === pendingDeleteJournalNumber);
  if (!journal || !canArchive(journal)) return;
  deleteConfirmYes.disabled = true;
  try {
    await window.BanikApi.request(`/api/journals/${encodeURIComponent(journal.id || journal.number)}`, {
      method: "DELETE", body: { expectedVersion: journal.version ?? 0 },
    });
    hideDeleteConfirm();
    await loadRegister();
    registerMessage.textContent = `Draft ${journal.number} archived. Its activity history is retained.`;
  } catch (error) {
    hideDeleteConfirm();
    registerMessage.textContent = error.message || "The draft could not be archived.";
    registerMessage.setAttribute("role", "alert");
  } finally {
    deleteConfirmYes.disabled = false;
  }
}

function renderRegister() {
  const journals = getFilteredJournals();
  const rows = buildRegisterRows(journals);
  const totals = rows.reduce(
    (sum, row) => ({
      debit: sum.debit + (isPosted(row.journal) ? row.debit : 0),
      credit: sum.credit + (isPosted(row.journal) ? row.credit : 0),
    }),
    { debit: 0, credit: 0 }
  );

  registerRows.innerHTML = "";

  if (!rows.length) {
    const empty = document.createElement("div");
    empty.className = "journal-register-grid";
    empty.innerHTML = '<div class="journal-register-empty">No journals found for this date range.</div>';
    registerRows.append(empty);
  } else {
    rows.forEach((row, index) => {
      const line = row.line || {};
      const journal = row.journal || {};
      const rowElement = document.createElement("div");
      rowElement.className = "journal-register-grid";
      rowElement.innerHTML = `
        <div>${index + 1}</div>
        <div>${escapeHtml(formatDateForDisplay(journal.journalDate))}</div>
        <div><a class="journal-register-link" href="./journal-entry.html?journal=${encodeURIComponent(journal.id || journal.number || "")}&return=journal-register">${escapeHtml(journal.number)}</a></div>
        <div>${escapeHtml(line.account)}</div>
        <div>${row.debit ? escapeHtml(formatAmount(row.debit)) : ""}</div>
        <div>${row.credit ? escapeHtml(formatAmount(row.credit)) : ""}</div>
        <div>${escapeHtml(line.description)}</div>
        <div>${escapeHtml(line.name)}</div>
        <div>${escapeHtml(journal.description || journal.note || journal.notes || "")}</div>
        <div><span class="register-status register-status--${escapeHtml(journal.status || "posted")}">${escapeHtml(journal.status || "posted")}</span></div>
        <div class="register-attribution"><strong>${escapeHtml(journal.createdByName || journal.createdBy || "Legacy — creator unavailable")}</strong><small>${escapeHtml(formatActivityTime(journal.createdAt))}</small></div>
        <div class="register-attribution">${journal.approvedBy ? `<strong>${escapeHtml(journal.approvedByName || journal.approvedBy)}</strong><small>${escapeHtml(formatActivityTime(journal.approvedAt))}</small>` : "—"}</div>
        <div class="register-attribution">${journal.postedBy ? `<strong>${escapeHtml(journal.postedByName || journal.postedBy)}</strong><small>${escapeHtml(formatActivityTime(journal.postedAt))}</small>` : "—"}</div>
        <div><a class="journal-register-link" href="./journal-entry.html?journal=${encodeURIComponent(journal.id || journal.number || "")}&return=journal-register">Open</a>
          ${canArchive(journal) ? `<button class="journal-button journal-button--ghost register-archive" type="button" data-delete="${escapeHtml(journal.id || journal.number)}">Archive</button>` : ""}
        </div>
      `;
      registerRows.append(rowElement);
    });
  }

  totalDebitCell.textContent = formatAmount(totals.debit);
  totalCreditCell.textContent = formatAmount(totals.credit);
}

registerRows.addEventListener("click", (event) => {
  const deleteButton = event.target.closest("[data-delete]");
  const deleteNumber = deleteButton && deleteButton.getAttribute("data-delete");

  if (deleteNumber) {
    showDeleteConfirm(deleteNumber);
  }
});

deleteConfirmYes.addEventListener("click", deletePendingJournal);
deleteConfirmNo.addEventListener("click", hideDeleteConfirm);
deleteConfirmModal.addEventListener("click", (event) => {
  if (event.target === deleteConfirmModal) {
    hideDeleteConfirm();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !deleteConfirmModal.hidden) {
    hideDeleteConfirm();
  }
});

fromDateInput.addEventListener("change", renderRegister);
toDateInput.addEventListener("change", renderRegister);

statusInput.addEventListener("change", renderRegister);
creatorInput.addEventListener("change", renderRegister);
refreshButton.addEventListener("click", loadRegister);

async function loadRegister() {
  refreshButton.disabled = true;
  registerMessage.textContent = "Loading company journals…";
  registerMessage.setAttribute("role", "status");
  try {
    workspaceContext = await window.BanikApi.getWorkspace();
    const payload = await window.BanikApi.request("/api/journals");
    journals = Array.isArray(payload.items) ? payload.items : [];
    const selectedCreator = creatorInput.value;
    const creators = new Map();
    journals.forEach((journal) => creators.set(journal.createdBy || "legacy", journal.createdByName || journal.createdBy || "Legacy / unavailable"));
    creatorInput.replaceChildren(new Option("All creators", ""));
    [...creators].sort((left, right) => left[1].localeCompare(right[1])).forEach(([id, name]) => creatorInput.add(new Option(name, id)));
    creatorInput.value = creators.has(selectedCreator) ? selectedCreator : "";
    registerMessage.textContent = "Only posted entries contribute to the totals below. Activity times use Bangladesh time (UTC+6).";
    renderRegister();
  } catch (error) {
    journals = [];
    renderRegister();
    registerMessage.textContent = error.message || "Journals could not be loaded. Please try again.";
    registerMessage.setAttribute("role", "alert");
  } finally {
    refreshButton.disabled = false;
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  if (window.BanikAccounting) await window.BanikAccounting.ready();
  await loadRegister();
});
