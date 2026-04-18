const STORAGE_KEYS = {
  journals: "banikBooksJournals",
  ledgers: "banikBooksLedgers",
};

const DEFAULT_ROW_COUNT = 4;
const MAX_TOTAL_ATTACHMENT_BYTES = 20 * 1024 * 1024;
const appSettings =
  window.BANIK_BOOKS_SETTINGS ||
  Object.freeze({
    accountingBasis: "accrual",
    accountingBasisLabel: "Accrual basis accounting",
    accountingBasisDescription:
      "Income and expenses are recognized when earned or incurred, not only when cash is received or paid.",
  });

const journalForm = document.querySelector("#journal-form");
const journalDateInput = document.querySelector("#journal-date");
const journalNumberInput = document.querySelector("#journal-number");
const journalNumberNote = document.querySelector("#journal-number-note");
const journalLines = document.querySelector("#journal-lines");
const journalRowTemplate = document.querySelector("#journal-row-template");
const ledgerSourceNote = document.querySelector("#ledger-source-note");
const journalStatus = document.querySelector("#journal-status");
const addLineButton = document.querySelector("#add-line-btn");
const clearLinesButton = document.querySelector("#clear-lines-btn");
const saveButton = document.querySelector("#save-btn");
const saveNewButton = document.querySelector("#save-new-btn");
const journalDescription = document.querySelector("#journal-description");
const attachmentInput = document.querySelector("#journal-attachment");
const attachmentDropzone = document.querySelector("#attachment-dropzone");
const attachmentList = document.querySelector("#attachment-list");
const tableTotalDebit = document.querySelector("#table-total-debit");
const tableTotalCredit = document.querySelector("#table-total-credit");
const footerTotalDebit = document.querySelector("#footer-total-debit");
const footerTotalCredit = document.querySelector("#footer-total-credit");
const footerTotalDifference = document.querySelector("#footer-total-difference");

let attachments = [];

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

function getLedgerNames() {
  const rawLedgers = safeReadArray(STORAGE_KEYS.ledgers);

  return rawLedgers
    .map((ledger) => {
      if (typeof ledger === "string") {
        return ledger.trim();
      }

      if (ledger && typeof ledger === "object") {
        return String(
          ledger.name || ledger.ledgerName || ledger.accountName || ledger.title || ""
        ).trim();
      }

      return "";
    })
    .filter(Boolean);
}

function formatMoney(value) {
  return `Tk ${new Intl.NumberFormat("en-BD", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0)}`;
}

function formatDateForInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getFiscalYear(dateValue) {
  const selectedDate = new Date(`${dateValue}T00:00:00`);
  const month = selectedDate.getMonth();
  const year = selectedDate.getFullYear();

  const startYear = month >= 6 ? year : year - 1;
  const endYear = startYear + 1;
  const shortStartYear = String(startYear).slice(-2);
  const shortEndYear = String(endYear).slice(-2);

  return {
    prefix: `FY/${shortStartYear}-${shortEndYear}`,
    startYear,
    endYear,
  };
}

function getNextJournalNumber(dateValue) {
  const fiscalYear = getFiscalYear(dateValue);
  const prefix = `${fiscalYear.prefix}/`;
  const savedJournals = getSavedJournals();

  const nextSequence =
    savedJournals
      .filter((journal) => typeof journal.number === "string" && journal.number.startsWith(prefix))
      .map((journal) => Number(journal.number.split("/").pop()))
      .filter((value) => Number.isFinite(value))
      .reduce((largest, value) => Math.max(largest, value), 0) + 1;

  return `${prefix}${String(nextSequence).padStart(4, "0")}`;
}

function updateJournalNumber() {
  if (!journalDateInput.value) {
    journalDateInput.value = formatDateForInput(new Date());
  }

  const fiscalYear = getFiscalYear(journalDateInput.value);
  journalNumberInput.value = getNextJournalNumber(journalDateInput.value);
  journalNumberNote.textContent = `Fiscal year ${fiscalYear.startYear}-${String(
    fiscalYear.endYear
  ).slice(-2)} runs from 01 Jul ${fiscalYear.startYear} to 30 Jun ${fiscalYear.endYear}.`;
}

function updateLedgerAvailabilityNote() {
  const ledgerNames = getLedgerNames();

  if (!ledgerNames.length) {
    ledgerSourceNote.textContent =
      `No ledgers found in Chart of Accounts yet. Ledger dropdown will stay empty until ledgers are created there. Default basis: ${appSettings.accountingBasisLabel}.`;
    return;
  }

  ledgerSourceNote.textContent = `${ledgerNames.length} ledger${
    ledgerNames.length > 1 ? "s are" : " is"
  } available from Chart of Accounts for journal selection. Default basis: ${appSettings.accountingBasisLabel}.`;
}

function populateAccountSelect(selectElement, selectedValue = "") {
  const ledgerNames = getLedgerNames();
  selectElement.innerHTML = "";

  if (!ledgerNames.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "No ledgers available";
    selectElement.append(option);
    selectElement.disabled = true;
    return;
  }

  selectElement.disabled = false;

  const placeholderOption = document.createElement("option");
  placeholderOption.value = "";
  placeholderOption.textContent = "Select ledger";
  selectElement.append(placeholderOption);

  ledgerNames.forEach((ledgerName) => {
    const option = document.createElement("option");
    option.value = ledgerName;
    option.textContent = ledgerName;
    option.selected = ledgerName === selectedValue;
    selectElement.append(option);
  });

  selectElement.value = selectedValue;
}

function buildRow(values = {}) {
  const row = journalRowTemplate.content.firstElementChild.cloneNode(true);

  populateAccountSelect(row.querySelector(".line-account"), values.account || "");
  row.querySelector(".line-debit").value = values.debit || "";
  row.querySelector(".line-credit").value = values.credit || "";
  row.querySelector('input[aria-label="Description"]').value = values.description || "";
  row.querySelector('input[aria-label="Name"]').value = values.name || "";

  return row;
}

function renumberRows() {
  [...journalLines.children].forEach((row, index) => {
    row.querySelector(".line-number").textContent = index + 1;
  });
}

function appendRow(values = {}) {
  journalLines.append(buildRow(values));
  renumberRows();
  updateTotalsAndState();
}

function resetRows() {
  journalLines.innerHTML = "";

  for (let index = 0; index < DEFAULT_ROW_COUNT; index += 1) {
    appendRow();
  }
}

function readRowData(row) {
  return {
    account: row.querySelector(".line-account").value.trim(),
    debit: row.querySelector(".line-debit").value.trim(),
    credit: row.querySelector(".line-credit").value.trim(),
    description: row.querySelector('input[aria-label="Description"]').value.trim(),
    name: row.querySelector('input[aria-label="Name"]').value.trim(),
  };
}

function getFilledLines() {
  return [...journalLines.children]
    .map(readRowData)
    .filter((line) => line.account || line.debit || line.credit || line.description || line.name);
}

function getTotals() {
  return getFilledLines().reduce(
    (totals, line) => ({
      debit: totals.debit + (Number.parseFloat(line.debit) || 0),
      credit: totals.credit + (Number.parseFloat(line.credit) || 0),
    }),
    { debit: 0, credit: 0 }
  );
}

function setStatus(message, variant) {
  journalStatus.textContent = message;
  journalStatus.className = `journal-status journal-status--${variant}`;
}

function updateTotalsAndState() {
  const totals = getTotals();
  const difference = Math.abs(totals.debit - totals.credit);
  const hasLines = getFilledLines().length > 0;
  const ledgerNames = getLedgerNames();
  const isBalanced = hasLines && totals.debit > 0 && totals.credit > 0 && difference < 0.005;

  tableTotalDebit.textContent = formatMoney(totals.debit);
  tableTotalCredit.textContent = formatMoney(totals.credit);
  footerTotalDebit.textContent = formatMoney(totals.debit);
  footerTotalCredit.textContent = formatMoney(totals.credit);
  footerTotalDifference.textContent = formatMoney(difference);

  saveButton.disabled = !isBalanced;
  saveNewButton.disabled = !isBalanced;

  if (!ledgerNames.length) {
    setStatus(
      "No ledgers found in Chart of Accounts yet. Create ledgers there first to use this journal page.",
      "pending"
    );
    return;
  }

  if (!hasLines) {
    setStatus("Add at least one journal line before saving.", "pending");
    return;
  }

  if (isBalanced) {
    setStatus("Journal is balanced and ready to save.", "success");
    return;
  }

  setStatus(
    `Journal is not balanced yet. Current difference: ${formatMoney(difference)}.`,
    "error"
  );
}

function bytesToMbText(totalBytes) {
  return `${(totalBytes / (1024 * 1024)).toFixed(2)} MB`;
}

function renderAttachments() {
  attachmentList.innerHTML = "";

  if (!attachments.length) {
    const emptyItem = document.createElement("li");
    emptyItem.className = "attachment-item attachment-item--empty";
    emptyItem.textContent = "No attachments added yet.";
    attachmentList.append(emptyItem);
    return;
  }

  attachments.forEach((file, index) => {
    const item = document.createElement("li");
    item.className = "attachment-item";
    item.innerHTML = `
      <div>
        <strong>${file.name}</strong>
        <span>${bytesToMbText(file.size)}</span>
      </div>
      <button class="line-action line-action--delete" type="button" data-remove-attachment="${index}">Remove</button>
    `;
    attachmentList.append(item);
  });
}

function addAttachments(newFiles) {
  if (!newFiles.length) {
    return;
  }

  const totalBytes = [...attachments, ...newFiles].reduce((sum, file) => sum + file.size, 0);

  if (totalBytes > MAX_TOTAL_ATTACHMENT_BYTES) {
    setStatus(
      `Attachments exceed the 20 MB limit. Current selection is ${bytesToMbText(totalBytes)}.`,
      "error"
    );
    attachmentInput.value = "";
    return;
  }

  attachments = [...attachments, ...newFiles];
  attachmentInput.value = "";
  renderAttachments();
  updateTotalsAndState();
}

function clearAttachments() {
  attachments = [];
  attachmentInput.value = "";
  renderAttachments();
}

function persistJournal() {
  const savedJournals = getSavedJournals();

  if (savedJournals.some((journal) => journal.number === journalNumberInput.value)) {
    setStatus(
      "This journal number is already saved. Use Save and new for a fresh journal.",
      "error"
    );
    return false;
  }

  savedJournals.push({
    number: journalNumberInput.value,
    journalDate: journalDateInput.value,
    accountingBasis: appSettings.accountingBasis,
    description: journalDescription.value.trim(),
    lines: getFilledLines().map((line) => ({
      ...line,
      debit: Number.parseFloat(line.debit) || 0,
      credit: Number.parseFloat(line.credit) || 0,
    })),
    attachments: attachments.map((file) => ({
      name: file.name,
      size: file.size,
      type: file.type,
    })),
    savedAt: new Date().toISOString(),
  });

  localStorage.setItem(STORAGE_KEYS.journals, JSON.stringify(savedJournals));
  setStatus(`Journal ${journalNumberInput.value} saved successfully.`, "success");
  return true;
}

function resetJournalForm() {
  resetRows();
  journalDescription.value = "";
  clearAttachments();
  updateJournalNumber();
  updateLedgerAvailabilityNote();
  updateTotalsAndState();
}

function handleSave(event, openNewAfterSave = false) {
  if (event) {
    event.preventDefault();
  }

  updateTotalsAndState();

  if (saveButton.disabled || saveNewButton.disabled) {
    return;
  }

  const didSave = persistJournal();

  if (!didSave) {
    return;
  }

  if (openNewAfterSave) {
    const currentDate = journalDateInput.value;
    resetJournalForm();
    journalDateInput.value = currentDate;
    updateJournalNumber();
    setStatus("Journal saved. Ready for the next new journal entry.", "success");
  }
}

journalLines.addEventListener("click", (event) => {
  const row = event.target.closest(".journal-row");

  if (!row) {
    return;
  }

  if (event.target.classList.contains("line-action--copy")) {
    const copiedRow = buildRow(readRowData(row));
    row.after(copiedRow);
    renumberRows();
    updateTotalsAndState();
  }

  if (event.target.classList.contains("line-action--delete")) {
    if (journalLines.children.length === 1) {
      const replacementRow = buildRow();
      row.replaceWith(replacementRow);
    } else {
      row.remove();
    }

    renumberRows();
    updateTotalsAndState();
  }
});

journalLines.addEventListener("input", updateTotalsAndState);
journalLines.addEventListener("change", updateTotalsAndState);

attachmentList.addEventListener("click", (event) => {
  const removeIndex = event.target.getAttribute("data-remove-attachment");

  if (removeIndex === null) {
    return;
  }

  attachments.splice(Number(removeIndex), 1);
  renderAttachments();
  updateTotalsAndState();
});

attachmentInput.addEventListener("change", (event) => {
  addAttachments([...event.target.files]);
});

attachmentDropzone.addEventListener("dragover", (event) => {
  event.preventDefault();
  attachmentDropzone.classList.add("attachment-dropzone--active");
});

attachmentDropzone.addEventListener("dragleave", () => {
  attachmentDropzone.classList.remove("attachment-dropzone--active");
});

attachmentDropzone.addEventListener("drop", (event) => {
  event.preventDefault();
  attachmentDropzone.classList.remove("attachment-dropzone--active");
  addAttachments([...event.dataTransfer.files]);
});

journalDateInput.addEventListener("change", () => {
  updateJournalNumber();
  updateTotalsAndState();
});

addLineButton.addEventListener("click", () => {
  appendRow();
});

clearLinesButton.addEventListener("click", () => {
  resetRows();
});

journalForm.addEventListener("submit", handleSave);
saveNewButton.addEventListener("click", (event) => {
  handleSave(event, true);
});

document.addEventListener("DOMContentLoaded", () => {
  journalDateInput.value = formatDateForInput(new Date());
  updateJournalNumber();
  updateLedgerAvailabilityNote();
  resetRows();
  renderAttachments();
});
