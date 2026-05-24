const STORAGE_KEYS = {
  journals: "banikBooksJournals",
  ledgers: "banikBooksLedgers",
  chartOfAccounts: "banikBooksChartOfAccounts",
};

const DEFAULT_ROW_COUNT = 4;
const MAX_TOTAL_ATTACHMENT_BYTES = 20 * 1024 * 1024;
const appSettings =
  window.BANIK_BOOKS_SETTINGS ||
  Object.freeze({
    accountingBasis: "accrual",
  });

const journalForm = document.querySelector("#journal-form");
const journalDateInput = document.querySelector("#journal-date");
const journalNumberInput = document.querySelector("#journal-number");
const journalLines = document.querySelector("#journal-lines");
const journalRowTemplate = document.querySelector("#journal-row-template");
const journalStatus = document.querySelector("#journal-status");
const createLedgerButton = document.querySelector("#create-ledger-btn");
const addLineButton = document.querySelector("#add-line-btn");
const clearLinesButton = document.querySelector("#clear-lines-btn");
const saveButton = document.querySelector("#save-btn");
const copyJournalButton = document.querySelector("#copy-journal-btn");
const journalDescription = document.querySelector("#journal-description");
const attachmentInput = document.querySelector("#journal-attachment");
const attachmentDropzone = document.querySelector("#attachment-dropzone");
const attachmentList = document.querySelector("#attachment-list");
const tableTotalDebit = document.querySelector("#table-total-debit");
const tableTotalCredit = document.querySelector("#table-total-credit");
const saveToast = document.querySelector("#journal-save-toast");
const journalAlert = document.querySelector("#journal-alert");
const journalAlertMessage = document.querySelector("#journal-alert-message");
const journalAlertClose = document.querySelector("#journal-alert-close");
const quickLedgerModal = document.querySelector("#quick-ledger-modal");
const quickLedgerClose = document.querySelector("#quick-ledger-close");
const quickLedgerForm = document.querySelector("#quick-ledger-form");
const quickLedgerName = document.querySelector("#quick-ledger-name");
const quickLedgerCode = document.querySelector("#quick-ledger-code");
const quickLedgerClassification = document.querySelector("#quick-ledger-classification");
const quickLedgerParent = document.querySelector("#quick-ledger-parent");

let attachments = [];
let chartItems = [];
let saveToastTimer = 0;
let activeLedgerPicker = {
  input: null,
  menu: null,
  items: [],
  index: -1,
};

function safeReadArray(key) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function createId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return String(Date.now()) + Math.random().toString(36).slice(2);
}

function getSavedJournals() {
  return safeReadArray(STORAGE_KEYS.journals);
}

function normalizeChartNodes(nodes) {
  if (!Array.isArray(nodes)) {
    return [];
  }

  return nodes
    .map((node) => {
      const nodeType = node && node.type === "ledger" ? "ledger" : "group";
      const normalizedNode = {
        id: String((node && node.id) || createId()),
        type: nodeType,
        name: String((node && node.name) || "").trim(),
        code: String((node && node.code) || "").trim(),
        classification: String((node && node.classification) || "").trim(),
      };

      if (nodeType === "group") {
        normalizedNode.children = normalizeChartNodes((node && node.children) || []);
      }

      return normalizedNode;
    })
    .filter((node) => node.name && node.name.toLowerCase() !== "asda");
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

function getLedgerRecords() {
  const records = collectChartLedgers(chartItems);

  if (records.length) {
    return records;
  }

  return getLedgerNames().map((name) => ({
    id: name,
    name,
    ledgerName: name,
    code: "",
    classification: "",
  }));
}

function collectChartLedgers(items, ledgers = []) {
  if (!Array.isArray(items)) {
    return ledgers;
  }

  items.forEach((item) => {
    if (item && item.type === "ledger" && item.name) {
      ledgers.push({
        id: item.id || item.name,
        name: item.name,
        ledgerName: item.name,
        code: item.code || "",
        classification: item.classification || "",
      });
      return;
    }

    collectChartLedgers((item && item.children) || [], ledgers);
  });

  return ledgers;
}

function waitForBanikData() {
  if (window.BanikData && typeof window.BanikData.getChartOfAccounts === "function") {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    let attempts = 0;
    const intervalId = window.setInterval(() => {
      attempts += 1;

      if (
        (window.BanikData && typeof window.BanikData.getChartOfAccounts === "function") ||
        attempts >= 20
      ) {
        window.clearInterval(intervalId);
        resolve();
      }
    }, 100);
  });
}

async function refreshLedgersFromChartOfAccounts() {
  chartItems = normalizeChartNodes(safeReadArray(STORAGE_KEYS.chartOfAccounts));
  await waitForBanikData();

  if (!window.BanikData || typeof window.BanikData.getChartOfAccounts !== "function") {
    return;
  }

  try {
    const remoteChartItems = normalizeChartNodes(await window.BanikData.getChartOfAccounts());
    const ledgers = collectChartLedgers(remoteChartItems);
    chartItems = remoteChartItems;

    if (Array.isArray(remoteChartItems)) {
      localStorage.setItem(STORAGE_KEYS.chartOfAccounts, JSON.stringify(remoteChartItems));
    }

    if (ledgers.length) {
      localStorage.setItem(STORAGE_KEYS.ledgers, JSON.stringify(ledgers));
    }
  } catch {
    // Local ledger data remains available if backend sync is unavailable.
  }
}

function formatMoney(value) {
  return `Tk ${new Intl.NumberFormat("en-BD", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0)}`;
}

function parseAmount(value) {
  return Number.parseFloat(String(value || "").replace(/,/g, "").replace(/[^\d.-]/g, "")) || 0;
}

function formatAmountInput(value) {
  const amount = typeof value === "number" ? value : parseAmount(value);

  if (!amount) {
    return "";
  }

  return new Intl.NumberFormat("en-BD", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
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

  journalNumberInput.value = getNextJournalNumber(journalDateInput.value);
}

function updateLedgerAvailabilityNote() {
  refreshOpenLedgerPicker();
}

function flattenGroups(items, level = 0, groups = []) {
  items.forEach((item) => {
    if (item.type !== "group") {
      return;
    }

    groups.push({
      id: item.id,
      name: item.name,
      code: item.code || "",
      classification: item.classification || "",
      level,
    });
    flattenGroups(item.children || [], level + 1, groups);
  });

  return groups;
}

function findGroup(items, groupId) {
  for (const item of items) {
    if (item.id === groupId && item.type === "group") {
      return item;
    }

    if (item.type === "group") {
      const foundGroup = findGroup(item.children || [], groupId);

      if (foundGroup) {
        return foundGroup;
      }
    }
  }

  return null;
}

function hasChartName(name) {
  const normalizedName = String(name || "").trim().toLowerCase();

  function scan(items) {
    return items.some((item) => {
      if (String(item.name || "").trim().toLowerCase() === normalizedName) {
        return true;
      }

      return item.type === "group" && scan(item.children || []);
    });
  }

  return scan(chartItems);
}

function buildLedgerPickerRows(items, query = "", path = [], level = 0) {
  const rows = [];
  const normalizedQuery = query.trim().toLowerCase();

  items.forEach((item) => {
    const nextPath = [...path, item.name];

    if (item.type === "group") {
      const childRows = buildLedgerPickerRows(item.children || [], normalizedQuery, nextPath, level + 1);
      const matchesGroup = !normalizedQuery || nextPath.join(" ").toLowerCase().includes(normalizedQuery);

      if (matchesGroup || childRows.length) {
        rows.push({
          name: item.name,
          type: "group",
          level,
          isMainGroup: level === 0,
          isSelectable: false,
        });
        rows.push(...childRows);
      }

      return;
    }

    if (!normalizedQuery || nextPath.join(" ").toLowerCase().includes(normalizedQuery)) {
      rows.push({
        name: item.name,
        type: "ledger",
        level,
        isSelectable: true,
      });
    }
  });

  if (!rows.length && getLedgerRecords().length) {
    return getLedgerRecords()
      .filter((ledger) => !normalizedQuery || ledger.name.toLowerCase().includes(normalizedQuery))
      .map((ledger) => ({
        name: ledger.name,
        type: "ledger",
        level: 0,
        isSelectable: true,
      }));
  }

  return rows;
}

function hideLedgerMenu(menu, input) {
  if (!menu || menu.hidden) {
    return;
  }

  menu.hidden = true;
  menu.innerHTML = "";

  if (activeLedgerPicker.menu === menu) {
    activeLedgerPicker = {
      input: null,
      menu: null,
      items: [],
      index: -1,
    };
  }
}

function setActiveLedgerOption(index) {
  const { menu, items } = activeLedgerPicker;

  if (!menu || !items.length) {
    return;
  }

  const boundedIndex = Math.max(0, Math.min(index, items.length - 1));
  activeLedgerPicker.index = boundedIndex;
  [...menu.querySelectorAll(".journal-ledger-menu__option")].forEach((option) => {
    const optionIndex = Number(option.dataset.index);
    const isActive = optionIndex === boundedIndex;
    option.classList.toggle("is-active", isActive);
    option.setAttribute("aria-selected", isActive ? "true" : "false");

    if (isActive) {
      option.scrollIntoView({ block: "nearest" });
    }
  });
}

function applyLedgerOption(input, menu, row) {
  if (!row || !row.isSelectable) {
    return;
  }

  input.value = row.name;
  hideLedgerMenu(menu, input);
  updateTotalsAndState();
  input.focus();
}

function showLedgerMenu(input, menu) {
  if (!input || !menu) {
    return;
  }

  const rows = buildLedgerPickerRows(chartItems, input.value).slice(0, 180);
  const selectableRows = rows.filter((row) => row.isSelectable);
  menu.innerHTML = "";

  if (!rows.length) {
    const empty = document.createElement("div");
    empty.className = "journal-ledger-menu__empty";
    empty.textContent = "No ledgers found.";
    menu.append(empty);
    menu.hidden = false;
    activeLedgerPicker = { input, menu, items: [], index: -1 };
    return;
  }

  rows.forEach((row) => {
    const option = document.createElement("div");
    option.className = [
      "journal-ledger-menu__option",
      `journal-ledger-menu__option--${row.type}`,
      row.isMainGroup ? "journal-ledger-menu__option--main" : "",
      row.isSelectable ? "" : "is-muted",
    ]
      .filter(Boolean)
      .join(" ");
    option.setAttribute("role", row.isSelectable ? "option" : "presentation");
    option.setAttribute("aria-selected", "false");
    option.style.setProperty("--journal-ledger-indent", `${Math.min(row.level, 8) * 16}px`);
    option.innerHTML = `<span>${row.name}</span>`;

    if (row.isSelectable) {
      const selectableIndex = selectableRows.findIndex((selectableRow) => selectableRow === row);
      option.dataset.index = String(selectableIndex);
      option.addEventListener("mousedown", (event) => {
        event.preventDefault();
        applyLedgerOption(input, menu, row);
      });
    }

    menu.append(option);
  });

  menu.hidden = false;
  activeLedgerPicker = { input, menu, items: selectableRows, index: -1 };
}

function handleLedgerPickerKeydown(event, input, menu) {
  if (event.key === "ArrowDown") {
    event.preventDefault();
    if (menu.hidden) {
      showLedgerMenu(input, menu);
    }
    setActiveLedgerOption(activeLedgerPicker.index + 1);
    return;
  }

  if (event.key === "ArrowUp") {
    event.preventDefault();
    if (menu.hidden) {
      showLedgerMenu(input, menu);
    }
    setActiveLedgerOption(activeLedgerPicker.index <= 0 ? activeLedgerPicker.items.length - 1 : activeLedgerPicker.index - 1);
    return;
  }

  if (event.key === "Enter" && !menu.hidden && activeLedgerPicker.index >= 0) {
    event.preventDefault();
    applyLedgerOption(input, menu, activeLedgerPicker.items[activeLedgerPicker.index]);
    return;
  }

  if (event.key === "Escape") {
    hideLedgerMenu(menu, input);
  }
}

function setupLedgerPicker(row) {
  const input = row.querySelector(".line-account");
  const menu = row.querySelector(".journal-ledger-menu");

  input.addEventListener("focus", () => showLedgerMenu(input, menu));
  input.addEventListener("click", () => showLedgerMenu(input, menu));
  input.addEventListener("input", () => {
    showLedgerMenu(input, menu);
    updateTotalsAndState();
  });
  input.addEventListener("keydown", (event) => handleLedgerPickerKeydown(event, input, menu));
  input.addEventListener("blur", () => {
    window.setTimeout(() => hideLedgerMenu(menu, input), 140);
  });
}

function refreshOpenLedgerPicker() {
  if (!activeLedgerPicker.input || !activeLedgerPicker.menu || activeLedgerPicker.menu.hidden) {
    return;
  }

  showLedgerMenu(activeLedgerPicker.input, activeLedgerPicker.menu);
}

function buildRow(values = {}) {
  const row = journalRowTemplate.content.firstElementChild.cloneNode(true);

  row.querySelector(".line-account").value = values.account || "";
  row.querySelector(".line-debit").value = formatAmountInput(values.debit);
  row.querySelector(".line-credit").value = formatAmountInput(values.credit);
  row.querySelector('input[aria-label="Description"]').value = values.description || "";
  row.querySelector('input[aria-label="Name"]').value = values.name || "";
  setupLedgerPicker(row);

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
      debit: totals.debit + parseAmount(line.debit),
      credit: totals.credit + parseAmount(line.credit),
    }),
    { debit: 0, credit: 0 }
  );
}

function setStatus(message, variant) {
  if (journalStatus.hidden) {
    journalStatus.hidden = false;
  }
  journalStatus.textContent = message;
  journalStatus.className = `journal-status journal-status--${variant}`;
}

function updateTotalsAndState() {
  const totals = getTotals();

  tableTotalDebit.textContent = formatMoney(totals.debit);
  tableTotalCredit.textContent = formatMoney(totals.credit);
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

function showJournalAlert(message) {
  journalAlertMessage.textContent = message;
  journalAlert.hidden = false;
  document.body.classList.add("modal-open");
  journalAlertClose.focus();
}

function hideJournalAlert() {
  journalAlert.hidden = true;
  document.body.classList.remove("modal-open");
}

function showSaveToast(message) {
  if (!saveToast) {
    return;
  }

  saveToast.querySelector("strong").textContent = message;
  saveToast.setAttribute("aria-hidden", "false");
  saveToast.classList.add("is-visible");
  window.clearTimeout(saveToastTimer);
  saveToastTimer = window.setTimeout(() => {
    saveToast.classList.remove("is-visible");
    saveToast.setAttribute("aria-hidden", "true");
  }, 1500);
}

function isJournalBalanced() {
  const totals = getTotals();
  return getFilledLines().length > 0 && Math.abs(totals.debit - totals.credit) < 0.005;
}

function persistJournal() {
  const savedJournals = getSavedJournals();

  if (savedJournals.some((journal) => journal.number === journalNumberInput.value)) {
    showJournalAlert("This journal number is already saved. Use Copy Journal for a fresh journal number.");
    return false;
  }

  savedJournals.push({
    number: journalNumberInput.value,
    journalDate: journalDateInput.value,
    accountingBasis: appSettings.accountingBasis,
    description: journalDescription.value.trim(),
    lines: getFilledLines().map((line) => ({
      ...line,
      debit: parseAmount(line.debit),
      credit: parseAmount(line.credit),
    })),
    attachments: attachments.map((file) => ({
      name: file.name,
      size: file.size,
      type: file.type,
    })),
    savedAt: new Date().toISOString(),
  });

  localStorage.setItem(STORAGE_KEYS.journals, JSON.stringify(savedJournals));
  showSaveToast(`Journal Number ${journalNumberInput.value} saved`);
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

function handleSave(event) {
  if (event) {
    event.preventDefault();
  }

  updateTotalsAndState();

  if (!getFilledLines().length) {
    showJournalAlert("Please add a journal line.");
    return;
  }

  if (!isJournalBalanced()) {
    showJournalAlert("Debit Credit is not Equal, please check.");
    return;
  }

  const didSave = persistJournal();

  if (!didSave) {
    return;
  }
}

function incrementJournalNumber(number) {
  const parts = String(number || "").split("/");
  const serial = Number(parts.pop());

  if (!Number.isFinite(serial)) {
    return getNextJournalNumber(journalDateInput.value);
  }

  return `${parts.join("/")}/${String(serial + 1).padStart(4, "0")}`;
}

function copyJournal() {
  const currentDate = journalDateInput.value || formatDateForInput(new Date());
  const generatedNumber = getNextJournalNumber(currentDate);
  const nextNumber =
    generatedNumber === journalNumberInput.value ? incrementJournalNumber(journalNumberInput.value) : generatedNumber;

  journalDateInput.value = currentDate;
  journalNumberInput.value = nextNumber;
  showSaveToast(`Copied as ${nextNumber}`);
}

function populateQuickLedgerParent() {
  const groups = flattenGroups(chartItems);
  quickLedgerParent.innerHTML = "";
  quickLedgerParent.append(new Option("Top level", ""));

  groups.forEach((group) => {
    const indent = " ".repeat(group.level * 4);
    quickLedgerParent.append(new Option(`${indent}${group.name}`, group.id));
  });
}

function openQuickLedgerModal() {
  populateQuickLedgerParent();
  quickLedgerForm.reset();
  quickLedgerModal.hidden = false;
  document.body.classList.add("modal-open");
  quickLedgerName.focus();
}

function closeQuickLedgerModal() {
  quickLedgerModal.hidden = true;
  document.body.classList.remove("modal-open");
}

function insertLedgerIntoChart(ledger, parentId) {
  if (!parentId) {
    chartItems.push(ledger);
    return;
  }

  const parent = findGroup(chartItems, parentId);

  if (!parent) {
    chartItems.push(ledger);
    return;
  }

  parent.children = parent.children || [];
  parent.children.push(ledger);
}

async function saveQuickLedger(event) {
  event.preventDefault();
  const name = quickLedgerName.value.trim();

  if (!name) {
    quickLedgerName.focus();
    return;
  }

  if (hasChartName(name)) {
    showJournalAlert("This group or ledger name already exists.");
    return;
  }

  const ledger = {
    id: createId(),
    type: "ledger",
    name,
    code: quickLedgerCode.value.trim(),
    classification: quickLedgerClassification.value.trim(),
  };

  insertLedgerIntoChart(ledger, quickLedgerParent.value);
  localStorage.setItem(STORAGE_KEYS.chartOfAccounts, JSON.stringify(chartItems));
  localStorage.setItem(STORAGE_KEYS.ledgers, JSON.stringify(collectChartLedgers(chartItems)));

  if (window.BanikData && typeof window.BanikData.saveChartOfAccounts === "function") {
    try {
      await window.BanikData.saveChartOfAccounts(chartItems);
    } catch {
      setStatus("Ledger added locally, but backend sync failed.", "error");
    }
  }

  closeQuickLedgerModal();
  refreshOpenLedgerPicker();
  showSaveToast(`Ledger ${name} created`);
}

journalLines.addEventListener("click", (event) => {
  const row = event.target.closest(".journal-row");

  if (!row) {
    return;
  }

  if (event.target.closest(".line-action--copy")) {
    const copiedRow = buildRow(readRowData(row));
    row.after(copiedRow);
    renumberRows();
    updateTotalsAndState();
  }

  if (event.target.closest(".line-action--delete")) {
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
journalLines.addEventListener("blur", (event) => {
  if (event.target.classList.contains("line-number-input")) {
    event.target.value = formatAmountInput(event.target.value);
    updateTotalsAndState();
  }
}, true);

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
copyJournalButton.addEventListener("click", copyJournal);
createLedgerButton.addEventListener("click", openQuickLedgerModal);
quickLedgerClose.addEventListener("click", closeQuickLedgerModal);
quickLedgerForm.addEventListener("submit", saveQuickLedger);
journalAlertClose.addEventListener("click", hideJournalAlert);
[journalAlert, quickLedgerModal].forEach((modal) => {
  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      if (modal === journalAlert) {
        hideJournalAlert();
      } else {
        closeQuickLedgerModal();
      }
    }
  });
});
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") {
    return;
  }

  if (!journalAlert.hidden) {
    hideJournalAlert();
  }

  if (!quickLedgerModal.hidden) {
    closeQuickLedgerModal();
  }
});

document.addEventListener("DOMContentLoaded", async () => {
  journalDateInput.value = formatDateForInput(new Date());
  updateJournalNumber();
  await refreshLedgersFromChartOfAccounts();
  updateLedgerAvailabilityNote();
  resetRows();
  renderAttachments();
});
