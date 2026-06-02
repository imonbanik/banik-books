const STORAGE_KEYS = {
  journals: "banikBooksJournals",
};

const fromDateInput = document.querySelector("#journal-register-from");
const toDateInput = document.querySelector("#journal-register-to");
const registerRows = document.querySelector("#journal-register-rows");
const totalDebitCell = document.querySelector("#journal-register-total-debit");
const totalCreditCell = document.querySelector("#journal-register-total-credit");
const deleteConfirmModal = document.querySelector("#journal-register-delete-confirm");
const deleteConfirmYes = document.querySelector("#journal-register-delete-yes");
const deleteConfirmNo = document.querySelector("#journal-register-delete-no");

let pendingDeleteJournalNumber = "";

function safeReadArray(key) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function getSavedJournals() {
  return safeReadArray(STORAGE_KEYS.journals);
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
  const sequence = Number(String(number || "").split("/").pop());
  return Number.isFinite(sequence) ? sequence : 0;
}

function getFilteredJournals() {
  const fromDate = fromDateInput.value;
  const toDate = toDateInput.value;

  return getSavedJournals()
    .filter((journal) => {
      const journalDate = String(journal.journalDate || "");

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

function deletePendingJournal() {
  if (!pendingDeleteJournalNumber) {
    hideDeleteConfirm();
    return;
  }

  const nextJournals = getSavedJournals().filter(
    (journal) => journal.number !== pendingDeleteJournalNumber
  );
  localStorage.setItem(STORAGE_KEYS.journals, JSON.stringify(nextJournals));
  hideDeleteConfirm();
  renderRegister();
}

function renderRegister() {
  const journals = getFilteredJournals();
  const rows = buildRegisterRows(journals);
  const totals = rows.reduce(
    (sum, row) => ({
      debit: sum.debit + row.debit,
      credit: sum.credit + row.credit,
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
        <div><a class="journal-register-link" href="./journal-entry.html?journal=${encodeURIComponent(journal.number || "")}&return=journal-register">${escapeHtml(journal.number)}</a></div>
        <div>${escapeHtml(line.account)}</div>
        <div>${row.debit ? escapeHtml(formatAmount(row.debit)) : ""}</div>
        <div>${row.credit ? escapeHtml(formatAmount(row.credit)) : ""}</div>
        <div>${escapeHtml(line.description)}</div>
        <div>${escapeHtml(line.name)}</div>
        <div>${escapeHtml(journal.description || journal.note || journal.notes || "")}</div>
        <div>
          <button class="line-action line-action--delete" type="button" data-delete="${escapeHtml(journal.number)}" aria-label="Delete journal">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M3 6h18"></path>
              <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
              <path d="M10 11v6"></path>
              <path d="M14 11v6"></path>
            </svg>
          </button>
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

document.addEventListener("DOMContentLoaded", async () => {
  if (window.BanikAccounting) await window.BanikAccounting.ready();
  renderRegister();
});
