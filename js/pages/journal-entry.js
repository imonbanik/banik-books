const STORAGE_KEYS = {
  journals: "banikBooksJournals",
  ledgers: "banikBooksLedgers",
  chartOfAccounts: "banikBooksChartOfAccounts",
  parties: "banikBooksParties",
};

const DEFAULT_ROW_COUNT = 4;
const PARTY_TYPES = Object.freeze(["Customer", "Supplier", "Both", "Employee"]);
const MAX_TOTAL_ATTACHMENT_BYTES = 20 * 1024 * 1024;
const appSettings =
  window.BANIK_BOOKS_SETTINGS ||
  Object.freeze({
    accountingBasis: "accrual",
  });

const journalForm = document.querySelector("#journal-form");
const journalBackButton = document.querySelector(".journal-back-button");
const journalDateInput = document.querySelector("#journal-date");
const journalNumberInput = document.querySelector("#journal-number");
const journalNumberMenu = document.querySelector("#journal-number-menu");
const journalLines = document.querySelector("#journal-lines");
const journalRowTemplate = document.querySelector("#journal-row-template");
const journalStatus = document.querySelector("#journal-status");
const createLedgerButton = document.querySelector("#create-ledger-btn");
const addLineButton = document.querySelector("#add-line-btn");
const clearLinesButton = document.querySelector("#clear-lines-btn");
const saveButton = document.querySelector("#save-btn");
const newJournalButton = document.querySelector("#new-journal-btn");
const deleteJournalButton = document.querySelector("#delete-journal-btn");
const copyJournalButton = document.querySelector("#copy-journal-btn");
const printJournalButton = document.querySelector("#print-journal-btn");
const journalDescription = document.querySelector("#journal-description");
const journalCopyNote = document.querySelector("#journal-copy-note");
const attachmentInput = document.querySelector("#journal-attachment");
const attachmentDropzone = document.querySelector("#attachment-dropzone");
const attachmentList = document.querySelector("#attachment-list");
const allJournalsButton = document.querySelector("#all-journals-btn");
const allJournalsModal = document.querySelector("#all-journals-modal");
const allJournalsClose = document.querySelector("#all-journals-close");
const allJournalsSearch = document.querySelector("#all-journals-search");
const allJournalsList = document.querySelector("#all-journals-list");
const tableTotalDebit = document.querySelector("#table-total-debit");
const tableTotalCredit = document.querySelector("#table-total-credit");
const saveToast = document.querySelector("#journal-save-toast");
const journalAlert = document.querySelector("#journal-alert");
const journalAlertMessage = document.querySelector("#journal-alert-message");
const journalAlertClose = document.querySelector("#journal-alert-close");
const deleteConfirmModal = document.querySelector("#journal-delete-confirm");
const deleteConfirmYes = document.querySelector("#journal-delete-yes");
const deleteConfirmNo = document.querySelector("#journal-delete-no");
const quickLedgerModal = document.querySelector("#quick-ledger-modal");
const quickLedgerClose = document.querySelector("#quick-ledger-close");
const quickLedgerForm = document.querySelector("#quick-ledger-form");
const quickLedgerName = document.querySelector("#quick-ledger-name");
const quickLedgerCode = document.querySelector("#quick-ledger-code");
const quickLedgerClassification = document.querySelector("#quick-ledger-classification");
const quickLedgerParent = document.querySelector("#quick-ledger-parent");
const journalPartyModal = document.querySelector("#journal-party-modal");
const journalPartyClose = document.querySelector("#journal-party-close");
const journalPartyCancel = document.querySelector("#journal-party-cancel");
const journalPartyForm = document.querySelector("#journal-party-form");
const journalPartyType = document.querySelector("#journal-party-type");
const journalPartyDynamicFields = document.querySelector("#journal-party-dynamic-fields");
const journalPartySave = document.querySelector("#journal-party-save");
const receivablePayablePanel = document.createElement("div");
receivablePayablePanel.className = "receivable-payable-panel";
receivablePayablePanel.hidden = true;
document.body.append(receivablePayablePanel);
const journalPreviewModal = document.createElement("div");
journalPreviewModal.className = "journal-preview-modal";
journalPreviewModal.hidden = true;
document.body.append(journalPreviewModal);

let attachments = [];
let chartItems = [];
let saveToastTimer = 0;
let currentEditingJournalNumber = "";
let activeJournalSearch = {
  journals: [],
  index: -1,
};
let activeLedgerPicker = {
  input: null,
  menu: null,
  items: [],
  index: -1,
};
let activePartyPicker = {
  input: null,
  menu: null,
  items: [],
  index: -1,
};
let pendingPartyNameInput = null;
let journalRowIdSequence = 0;
let activeAdjustmentContext = null;

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

function getSavedParties() {
  return safeReadArray(STORAGE_KEYS.parties).filter((party) => PARTY_TYPES.includes(party && party.type));
}

function saveParties(parties, changedParty = null) {
  localStorage.setItem(STORAGE_KEYS.parties, JSON.stringify(parties));

  if (changedParty && changedParty.id) {
    upsertItemToBackend("parties", changedParty.id, changedParty, parties);
    return;
  }

  syncCollectionToBackend("parties", parties);
}

async function syncCollectionToBackend(collectionName, items) {
  if (!window.BanikApi || typeof window.BanikApi.replace !== "function") {
    return;
  }

  try {
    await window.BanikApi.replace(collectionName, items);
  } catch (error) {
    console.warn(`Could not sync ${collectionName} to backend.`, error);
  }
}

async function upsertItemToBackend(collectionName, itemId, item, fallbackItems = []) {
  if (!window.BanikApi) {
    return;
  }

  try {
    if (typeof window.BanikApi.upsert === "function") {
      await window.BanikApi.upsert(collectionName, itemId, item);
      return;
    }

    if (typeof window.BanikApi.replace === "function") {
      await window.BanikApi.replace(collectionName, fallbackItems);
    }
  } catch (error) {
    console.warn(`Could not save ${collectionName} item to backend.`, error);
  }
}

async function removeItemFromBackend(collectionName, itemId, fallbackItems = []) {
  if (!window.BanikApi) {
    return;
  }

  try {
    if (typeof window.BanikApi.remove === "function") {
      await window.BanikApi.remove(collectionName, itemId);
      return;
    }

    if (typeof window.BanikApi.replace === "function") {
      await window.BanikApi.replace(collectionName, fallbackItems);
    }
  } catch (error) {
    console.warn(`Could not delete ${collectionName} item from backend.`, error);
  }
}

async function hydrateCollectionFromBackend(collectionName, storageKey, filterItems = (items) => items) {
  if (!window.BanikApi || typeof window.BanikApi.list !== "function") {
    return safeReadArray(storageKey);
  }

  try {
    const remoteItems = filterItems(await window.BanikApi.list(collectionName));
    const localItems = filterItems(safeReadArray(storageKey));

    if (remoteItems.length) {
      localStorage.setItem(storageKey, JSON.stringify(remoteItems));
      return remoteItems;
    }

    if (localItems.length) {
      await window.BanikApi.replace(collectionName, localItems);
    }

    return localItems;
  } catch (error) {
    console.warn(`Could not load ${collectionName} from backend.`, error);
    return safeReadArray(storageKey);
  }
}

function filterParties(items) {
  return Array.isArray(items) ? items.filter((party) => PARTY_TYPES.includes(party && party.type)) : [];
}

function filterJournals(items) {
  return Array.isArray(items) ? items.filter((journal) => journal && journal.number) : [];
}

function getPartyDisplayName(party) {
  const fields = (party && party.fields) || {};
  return (
    fields.customerName ||
    fields.supplierName ||
    fields.partyName ||
    fields.employeeName ||
    ""
  ).trim();
}

function getPartyDisplayLabel(party, parties = getSavedParties()) {
  const name = getPartyDisplayName(party);
  if (!name) return "";

  const duplicateNameCount = parties.filter(
    (item) => normalizeSearchText(getPartyDisplayName(item)) === normalizeSearchText(name)
  ).length;

  return duplicateNameCount > 1 ? `${name} (${party.type})` : name;
}

function getPartyById(partyId) {
  return getSavedParties().find((party) => party.id === partyId) || null;
}

function getPartyPickerRows(query = "") {
  const normalizedQuery = normalizeSearchText(query);
  const parties = getSavedParties();
  const rows = getSavedParties()
    .map((party) => ({
      type: "party",
      id: party.id,
      label: getPartyDisplayLabel(party, parties),
      partyType: party.type,
    }))
    .filter((row) => row.label)
    .filter((row) => !normalizedQuery || normalizeSearchText(row.label).includes(normalizedQuery))
    .sort((left, right) => left.label.localeCompare(right.label));

  const seen = new Set();
  return [
    { type: "add", label: "Add Party" },
    ...rows.filter((row) => {
      const key = normalizeSearchText(row.label);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }),
  ];
}

function getSavedJournals() {
  return safeReadArray(STORAGE_KEYS.journals);
}

function getLatestJournalDateForNewEntry() {
  const dates = getSavedJournals()
    .map((journal) => String(journal.journalDate || ""))
    .filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date))
    .sort();

  return dates.length ? dates[dates.length - 1] : formatDateForInput(new Date());
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
      } else {
        normalizedNode.openingBalance = Number((node && node.openingBalance) || 0) || 0;
        normalizedNode.openingBalanceDate = String((node && node.openingBalanceDate) || "").trim();
        normalizedNode.openingBalanceSide =
          String((node && node.openingBalanceSide) || "").toLowerCase() === "credit"
            ? "credit"
            : "debit";
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
        openingBalance: Number(item.openingBalance || 0) || 0,
        openingBalanceDate: item.openingBalanceDate || "",
        openingBalanceSide:
          String(item.openingBalanceSide || "").toLowerCase() === "credit" ? "credit" : "debit",
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
  return window.BanikAccounting
    ? window.BanikAccounting.formatMoney(value)
    : `BDT ${Number(value || 0).toFixed(2)}`;
}

function parseAmount(value) {
  return Number.parseFloat(String(value || "").replace(/,/g, "").replace(/[^\d.-]/g, "")) || 0;
}

function formatAmountInput(value) {
  const amount = typeof value === "number" ? value : parseAmount(value);

  if (!amount) {
    return "";
  }

  return window.BanikAccounting
    ? window.BanikAccounting.formatNumber(amount)
    : amount.toFixed(2);
}

function formatPlainMoney(value) {
  return window.BanikAccounting
    ? window.BanikAccounting.formatNumber(value)
    : Number(value || 0).toFixed(2);
}

function formatDateForInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getFiscalYear(dateValue) {
  if (window.BanikAccounting) {
    return window.BanikAccounting.getFiscalPeriod(dateValue);
  }

  const selectedDate = new Date(`${dateValue}T00:00:00`);
  const year = selectedDate.getFullYear();
  return { prefix: `FY/${String(year).slice(-2)}-${String(year + 1).slice(-2)}`, startYear: year, endYear: year + 1 };
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

function getJournalSequence(number) {
  const sequence = Number(String(number || "").split("/").pop());
  return Number.isFinite(sequence) ? sequence : 0;
}

function getJournalNumberParts(dateValue) {
  const fiscalYear = getFiscalYear(dateValue);
  const prefix = `${fiscalYear.prefix}/`;
  const usedSequences = getSavedJournals()
    .filter((journal) => typeof journal.number === "string" && journal.number.startsWith(prefix))
    .map((journal) => getJournalSequence(journal.number))
    .filter((sequence) => sequence > 0);
  const largestSequence = usedSequences.reduce((largest, sequence) => Math.max(largest, sequence), 0);
  const usedSequenceSet = new Set(usedSequences);
  const unusedNumbers = [];

  for (let sequence = 1; sequence <= largestSequence; sequence += 1) {
    if (!usedSequenceSet.has(sequence)) {
      unusedNumbers.push(`${prefix}${String(sequence).padStart(4, "0")}`);
    }
  }

  return {
    prefix,
    latestNumber: `${prefix}${String(largestSequence + 1).padStart(4, "0")}`,
    unusedNumbers,
  };
}

function updateJournalNumber() {
  if (!journalDateInput.value) {
    journalDateInput.value = formatDateForInput(new Date());
  }

  journalNumberInput.value = getJournalNumberParts(journalDateInput.value).latestNumber;
  currentEditingJournalNumber = "";
}

function hideJournalNumberMenu() {
  if (!journalNumberMenu) {
    return;
  }

  journalNumberMenu.hidden = true;
  journalNumberMenu.innerHTML = "";
}

function selectJournalNumber(number) {
  journalNumberInput.value = number;
  currentEditingJournalNumber = "";
  hideJournalNumberMenu();
}

function createJournalNumberSection(title, numbers) {
  const section = document.createElement("div");
  section.className = "journal-number-menu__section";

  const heading = document.createElement("div");
  heading.className = "journal-number-menu__title";
  heading.textContent = title;
  section.append(heading);

  if (!numbers.length) {
    const empty = document.createElement("div");
    empty.className = "journal-number-menu__empty";
    empty.textContent = "No unused journal no.";
    section.append(empty);
    return section;
  }

  numbers.forEach((number) => {
    const option = document.createElement("button");
    option.className = "journal-number-menu__option";
    option.type = "button";
    option.textContent = number;
    option.classList.toggle("is-selected", number === journalNumberInput.value);
    option.addEventListener("click", () => selectJournalNumber(number));
    section.append(option);
  });

  return section;
}

function showJournalNumberMenu() {
  if (!journalNumberMenu) {
    return;
  }

  if (!journalDateInput.value) {
    journalDateInput.value = formatDateForInput(new Date());
  }

  const { unusedNumbers, latestNumber } = getJournalNumberParts(journalDateInput.value);
  journalNumberMenu.innerHTML = "";
  journalNumberMenu.append(
    createJournalNumberSection("Unused Journal No.", unusedNumbers),
    createJournalNumberSection("Latest Journal No.", [latestNumber])
  );
  journalNumberMenu.hidden = false;
}

function updateLedgerAvailabilityNote() {
  refreshOpenLedgerPicker();
}

function normalizeSearchText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function searchIncludes(target, query) {
  const normalizedTarget = normalizeSearchText(target);
  const normalizedQuery = normalizeSearchText(query);

  if (!normalizedQuery) {
    return true;
  }

  return normalizedTarget.includes(normalizedQuery);
}

function ledgerMatchesQuery(ledger, query) {
  const tokens = String(query || "")
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  const target = `${ledger.name || ""} ${ledger.code || ""}`;

  if (!tokens.length) {
    return true;
  }

  return tokens.every((token) => searchIncludes(target, token));
}

function uniqueLedgerRows(rows) {
  const seenNames = new Set();

  return rows.filter((row) => {
    const key = normalizeSearchText(row.name);

    if (!key || seenNames.has(key)) {
      return false;
    }

    seenNames.add(key);
    return true;
  });
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
  const normalizedQuery = query.trim();

  items.forEach((item) => {
    const nextPath = [...path, item.name];

    if (item.type === "group") {
      rows.push(...buildLedgerPickerRows(item.children || [], normalizedQuery, nextPath, level + 1));
      return;
    }

    if (
      ledgerMatchesQuery(
        {
          name: item.name,
          path: nextPath.join(" "),
          code: item.code || "",
        },
        normalizedQuery
      )
    ) {
      rows.push({
        name: item.name,
        type: "ledger",
        level: 0,
        isSelectable: true,
      });
    }
  });

  if (!rows.length && getLedgerRecords().length) {
    return uniqueLedgerRows(
      getLedgerRecords()
        .filter((ledger) => ledgerMatchesQuery(ledger, normalizedQuery))
        .map((ledger) => ({
        name: ledger.name,
        type: "ledger",
        level: 0,
        isSelectable: true,
        }))
    );
  }

  return uniqueLedgerRows(rows);
}

function positionLedgerMenu(input, menu) {
  const inputBox = input.getBoundingClientRect();
  const left = Math.max(12, Math.min(inputBox.left, window.innerWidth - 420));
  const width = Math.min(
    Math.max(inputBox.width, window.innerWidth * 0.5),
    window.innerWidth - left - 12
  );

  menu.style.left = `${left}px`;
  menu.style.top = `${inputBox.bottom + 6}px`;
  menu.style.width = `${width}px`;
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
  positionLedgerMenu(input, menu);

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

  if (event.key === "Tab" && !menu.hidden && activeLedgerPicker.index >= 0) {
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

function positionPartyMenu(input, menu) {
  const rect = input.getBoundingClientRect();
  menu.style.position = "fixed";
  menu.style.left = `${rect.left}px`;
  menu.style.top = `${rect.bottom + 4}px`;
  menu.style.width = `${Math.max(rect.width, Math.min(420, window.innerWidth - rect.left - 16))}px`;
}

function hidePartyMenu(menu) {
  if (menu) {
    menu.hidden = true;
    menu.innerHTML = "";
  }

  if (activePartyPicker.menu === menu) {
    activePartyPicker = {
      input: null,
      menu: null,
      items: [],
      index: -1,
    };
  }
}

function setActivePartyOption(index) {
  const { menu, items } = activePartyPicker;

  if (!menu || !items.length) {
    return;
  }

  const boundedIndex = Math.max(0, Math.min(index, items.length - 1));
  activePartyPicker.index = boundedIndex;
  [...menu.querySelectorAll(".journal-party-menu__option")].forEach((option) => {
    const optionIndex = Number(option.dataset.index);
    const isActive = optionIndex === boundedIndex;
    option.classList.toggle("is-active", isActive);
    option.setAttribute("aria-selected", isActive ? "true" : "false");

    if (isActive) {
      option.scrollIntoView({ block: "nearest" });
    }
  });
}

function applyPartyOption(input, menu, row) {
  if (!row) return;

  if (row.type === "add") {
    pendingPartyNameInput = input;
    hidePartyMenu(menu);
    openJournalPartyModal();
    return;
  }

  input.value = row.label;
  input.dataset.partyId = row.id || "";
  hidePartyMenu(menu);
  updateTotalsAndState();
  input.focus();
}

function showPartyMenu(input, menu) {
  if (!input || !menu) return;

  const rows = getPartyPickerRows(input.value);
  menu.innerHTML = "";
  positionPartyMenu(input, menu);

  rows.forEach((row, index) => {
    const option = document.createElement("div");
    option.className = [
      "journal-party-menu__option",
      row.type === "add" ? "journal-party-menu__option--add" : "",
    ]
      .filter(Boolean)
      .join(" ");
    option.dataset.index = String(index);
    option.setAttribute("role", "option");
    option.setAttribute("aria-selected", "false");
    option.innerHTML =
      row.type === "add"
        ? `<strong>${row.label}</strong>`
        : `<span>${escapeHtml(row.label)}</span><small>${escapeHtml(row.partyType)}</small>`;
    option.addEventListener("mousedown", (event) => {
      event.preventDefault();
      applyPartyOption(input, menu, row);
    });
    menu.append(option);
  });

  menu.hidden = false;
  activePartyPicker = { input, menu, items: rows, index: -1 };
}

function handlePartyPickerKeydown(event, input, menu) {
  if (event.key === "ArrowDown") {
    event.preventDefault();
    if (menu.hidden) showPartyMenu(input, menu);
    setActivePartyOption(activePartyPicker.index + 1);
    return;
  }

  if (event.key === "ArrowUp") {
    event.preventDefault();
    if (menu.hidden) showPartyMenu(input, menu);
    setActivePartyOption(activePartyPicker.index <= 0 ? activePartyPicker.items.length - 1 : activePartyPicker.index - 1);
    return;
  }

  if ((event.key === "Enter" || event.key === "Tab") && !menu.hidden && activePartyPicker.index >= 0) {
    if (event.key === "Enter") event.preventDefault();
    applyPartyOption(input, menu, activePartyPicker.items[activePartyPicker.index]);
    return;
  }

  if (event.key === "Escape") {
    hidePartyMenu(menu);
  }
}

function setupPartyPicker(row) {
  const input = row.querySelector(".line-party-name");
  const menu = row.querySelector(".journal-party-menu");

  input.addEventListener("focus", () => showPartyMenu(input, menu));
  input.addEventListener("click", () => showPartyMenu(input, menu));
  input.addEventListener("input", () => {
    showPartyMenu(input, menu);
    updateTotalsAndState();
  });
  input.addEventListener("keydown", (event) => handlePartyPickerKeydown(event, input, menu));
  input.addEventListener("blur", () => {
    window.setTimeout(() => hidePartyMenu(menu), 140);
  });
}

function refreshOpenLedgerPicker() {
  if (!activeLedgerPicker.input || !activeLedgerPicker.menu || activeLedgerPicker.menu.hidden) {
    return;
  }

  showLedgerMenu(activeLedgerPicker.input, activeLedgerPicker.menu);
}

function refreshOpenPartyPicker() {
  if (!activePartyPicker.input || !activePartyPicker.menu || activePartyPicker.menu.hidden) {
    return;
  }

  showPartyMenu(activePartyPicker.input, activePartyPicker.menu);
}

function clearCopyNotice() {
  if (!journalCopyNote) {
    return;
  }

  journalCopyNote.hidden = true;
  journalCopyNote.textContent = "";
}

function showCopyNotice(sourceNumber) {
  if (!journalCopyNote) {
    return;
  }

  journalCopyNote.textContent = `This is a copy of Journal ${sourceNumber}`;
  journalCopyNote.hidden = false;
}

function buildRow(values = {}) {
  const row = journalRowTemplate.content.firstElementChild.cloneNode(true);
  const partyInput = row.querySelector('input[aria-label="Name"]');
  const savedParty = values.partyId ? getPartyById(values.partyId) : null;

  row.dataset.rowId = values.rowId || `journal-row-${journalRowIdSequence += 1}`;
  row.querySelector(".line-account").value = values.account || "";
  row.querySelector(".line-debit").value = formatAmountInput(values.debit);
  row.querySelector(".line-credit").value = formatAmountInput(values.credit);
  row.querySelector('input[aria-label="Description"]').value = values.description || "";
  partyInput.value = savedParty ? getPartyDisplayLabel(savedParty) : values.name || "";
  partyInput.dataset.partyId = savedParty ? savedParty.id : values.partyId || "";
  setupLedgerPicker(row);
  setupPartyPicker(row);

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

function enforceSingleAmountSide(input) {
  if (!input || !input.classList.contains("line-number-input") || !input.value.trim()) {
    return;
  }

  const row = input.closest(".journal-row");
  if (!row) {
    return;
  }

  const oppositeInput = input.classList.contains("line-debit")
    ? row.querySelector(".line-credit")
    : row.querySelector(".line-debit");

  if (oppositeInput) {
    oppositeInput.value = "";
  }
}

function getSettlementRule(accountName, amountInput) {
  const normalizedAccount = normalizeSearchText(accountName);

  if (normalizedAccount.includes("receivable") && amountInput.classList.contains("line-credit")) {
    return {
      type: "receivable",
      label: "Receivable adjustment",
      sourceSide: "debit",
      adjustmentSide: "credit",
      normalBalance: "Dr",
      adjustingSide: "Credit",
    };
  }

  if (normalizedAccount.includes("payable") && amountInput.classList.contains("line-debit")) {
    return {
      type: "payable",
      label: "Payable adjustment",
      sourceSide: "credit",
      adjustmentSide: "debit",
      normalBalance: "Cr",
      adjustingSide: "Debit",
    };
  }

  return null;
}

function getLinePartyKey(line) {
  return line && line.partyId ? `id:${line.partyId}` : `name:${normalizeSearchText((line && line.name) || "")}`;
}

function getReceivablePayableEntryId(entry) {
  return [
    entry.journalNumber,
    entry.lineIndex,
    normalizeSearchText(entry.partyName),
    formatPlainMoney(entry.originalAmount),
  ].join("|");
}

function isPreviousJournal(journal, currentDate, currentNumber) {
  if (!journal || journal.number === currentNumber) {
    return false;
  }

  const journalDate = String(journal.journalDate || "");

  if (!currentDate) {
    return true;
  }

  if (journalDate < currentDate) {
    return true;
  }

  if (journalDate > currentDate) {
    return false;
  }

  return getJournalSequence(journal.number) < getJournalSequence(currentNumber);
}

function getOpenReceivablePayableEntries(row, rule) {
  const rowData = readRowData(row);
  const accountKey = normalizeSearchText(rowData.account);
  const currentPartyKey = getLinePartyKey(rowData);
  const shouldFilterParty = Boolean(rowData.partyId || rowData.name);
  const buckets = new Map();
  const savedJournals = getSavedJournals()
    .filter((journal) => isPreviousJournal(journal, journalDateInput.value, journalNumberInput.value))
    .sort((left, right) => {
      return String(left.journalDate || "").localeCompare(String(right.journalDate || "")) ||
        getJournalSequence(left.number) - getJournalSequence(right.number);
    });

  savedJournals.forEach((journal) => {
    (Array.isArray(journal.lines) ? journal.lines : []).forEach((line, lineIndex) => {
      if (normalizeSearchText(line.account) !== accountKey) {
        return;
      }

      const partyKey = getLinePartyKey(line);
      if (shouldFilterParty && partyKey !== currentPartyKey) {
        return;
      }

      if (!buckets.has(partyKey)) {
        buckets.set(partyKey, []);
      }

      const bucket = buckets.get(partyKey);
      const sourceAmount = parseAmount(line[rule.sourceSide]);
      const adjustmentAmount = parseAmount(rule.sourceSide === "debit" ? line.credit : line.debit);

      if (sourceAmount > 0) {
        bucket.push({
          journalDate: journal.journalDate || "",
          journalNumber: journal.number || "",
          partyName: line.name || "",
          partyId: line.partyId || "",
          description: line.description || "",
          originalAmount: sourceAmount,
          remainingAmount: sourceAmount,
          lineIndex,
        });
      }

      if (adjustmentAmount > 0) {
        let remainingAdjustment = adjustmentAmount;
        bucket.forEach((entry) => {
          if (remainingAdjustment <= 0 || entry.remainingAmount <= 0) {
            return;
          }

          const applied = Math.min(entry.remainingAmount, remainingAdjustment);
          entry.remainingAmount -= applied;
          remainingAdjustment -= applied;
        });
      }
    });
  });

  return Array.from(buckets.values())
    .flat()
    .filter((entry) => entry.remainingAmount > 0.004)
    .sort((left, right) => {
      return String(left.journalDate || "").localeCompare(String(right.journalDate || "")) ||
        getJournalSequence(left.journalNumber) - getJournalSequence(right.journalNumber) ||
        left.lineIndex - right.lineIndex;
    });
}

function hideReceivablePayablePanel() {
  receivablePayablePanel.hidden = true;
  receivablePayablePanel.innerHTML = "";
  activeAdjustmentContext = null;
}

function closeJournalPreviewModal() {
  journalPreviewModal.hidden = true;
  journalPreviewModal.innerHTML = "";
  document.body.classList.remove("modal-open");
}

function openJournalPreviewModal(journalNumber) {
  const journal = getSavedJournals().find((entry) => entry.number === journalNumber);

  if (!journal) {
    showJournalAlert("Could not find this journal.");
    return;
  }

  const lines = Array.isArray(journal.lines) ? journal.lines.filter((line) => line.account) : [];
  const totalDebit = lines.reduce((sum, line) => sum + parseAmount(line.debit), 0);
  const totalCredit = lines.reduce((sum, line) => sum + parseAmount(line.credit), 0);

  journalPreviewModal.innerHTML = `
    <div class="journal-preview-modal__dialog" role="dialog" aria-modal="true" aria-label="Journal preview">
      <button class="journal-preview-modal__close" type="button" data-close-journal-preview aria-label="Close">x</button>
      <div class="journal-preview-modal__title">Journal</div>
      <div class="journal-preview-modal__meta">
        <strong>Journal Date: ${escapeHtml(formatPrintDate(journal.journalDate))}</strong>
        <strong>Journal No.: ${escapeHtml(journal.number)}</strong>
      </div>
      <div class="journal-preview-modal__table">
        <div class="journal-preview-modal__row journal-preview-modal__row--head">
          <div>Sl.</div>
          <div>Account</div>
          <div>Debit</div>
          <div>Credit</div>
          <div>Description</div>
          <div>Name</div>
        </div>
        ${
          lines.length
            ? lines
                .map(
                  (line, index) => `
                    <div class="journal-preview-modal__row">
                      <div>${index + 1}</div>
                      <div>${escapeHtml(line.account)}</div>
                      <div>${line.debit ? escapeHtml(formatPlainMoney(line.debit)) : ""}</div>
                      <div>${line.credit ? escapeHtml(formatPlainMoney(line.credit)) : ""}</div>
                      <div>${escapeHtml(line.description)}</div>
                      <div>${escapeHtml(line.name)}</div>
                    </div>
                  `
                )
                .join("")
            : '<div class="journal-preview-modal__empty">No journal lines found.</div>'
        }
        <div class="journal-preview-modal__row journal-preview-modal__row--total">
          <div></div>
          <div>Total</div>
          <div>${escapeHtml(formatPlainMoney(totalDebit))}</div>
          <div>${escapeHtml(formatPlainMoney(totalCredit))}</div>
          <div></div>
          <div></div>
        </div>
      </div>
      ${
        journal.description
          ? `<div class="journal-preview-modal__note"><strong>Journal Note:</strong> ${escapeHtml(journal.description)}</div>`
          : ""
      }
    </div>
  `;
  journalPreviewModal.hidden = false;
  document.body.classList.add("modal-open");
}

function positionReceivablePayablePanel(input) {
  const rect = input.getBoundingClientRect();
  const width = Math.min(980, window.innerWidth - 24);
  const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12));
  receivablePayablePanel.style.left = `${left}px`;
  receivablePayablePanel.style.top = `${rect.bottom + 8}px`;
  receivablePayablePanel.style.width = `${width}px`;
}

function renderReceivablePayableRows(entries) {
  return entries
    .map((entry) => {
      const entryId = getReceivablePayableEntryId(entry);

      return `
        <div class="receivable-payable-panel__row" data-adjustment-party="${escapeHtml(entry.partyName)}">
          <div>${escapeHtml(formatPrintDate(entry.journalDate))}</div>
          <div>
            <button class="receivable-payable-panel__journal-link" type="button" tabindex="-1" data-preview-journal="${escapeHtml(entry.journalNumber)}">
              ${escapeHtml(entry.journalNumber)}
            </button>
          </div>
          <div>${escapeHtml(entry.partyName || "-")}</div>
          <div>${escapeHtml(entry.description || "-")}</div>
          <div>${escapeHtml(formatPlainMoney(entry.originalAmount))}</div>
          <div>${escapeHtml(formatPlainMoney(entry.remainingAmount))}</div>
          <div>
            <input
              class="receivable-payable-panel__adjust-input"
              type="text"
              inputmode="decimal"
              autocomplete="off"
              data-adjust-entry-id="${escapeHtml(entryId)}"
              data-party-name="${escapeHtml(entry.partyName)}"
              data-party-id="${escapeHtml(entry.partyId)}"
              data-source-journal="${escapeHtml(entry.journalNumber)}"
              data-source-description="${escapeHtml(entry.description)}"
              data-due-amount="${escapeHtml(String(entry.remainingAmount))}"
              aria-label="Now Adjust"
            />
          </div>
        </div>
      `;
    })
    .join("");
}

function filterReceivablePayableRows(query) {
  const normalizedQuery = normalizeSearchText(query);
  receivablePayablePanel.querySelectorAll(".receivable-payable-panel__row:not(.receivable-payable-panel__row--head)").forEach((row) => {
    const partyName = row.dataset.adjustmentParty || "";
    row.hidden = Boolean(normalizedQuery) && !normalizeSearchText(partyName).includes(normalizedQuery);
  });
}

function showReceivablePayablePanelForInput(input) {
  if (!input || !input.classList.contains("line-number-input") || !input.value.trim()) {
    hideReceivablePayablePanel();
    return;
  }

  const row = input.closest(".journal-row");
  const account = row ? row.querySelector(".line-account").value.trim() : "";
  const rule = getSettlementRule(account, input);

  if (!row || !rule) {
    hideReceivablePayablePanel();
    return;
  }

  const openEntries = getOpenReceivablePayableEntries(row, rule);
  const rowData = readRowData(row);
  activeAdjustmentContext = {
    sourceRowId: row.dataset.rowId,
    sourceSide: input.classList.contains("line-debit") ? "debit" : "credit",
    account,
    rule,
  };
  positionReceivablePayablePanel(input);
  receivablePayablePanel.innerHTML = `
    <div class="receivable-payable-panel__head">
      <div>
        <strong>${escapeHtml(rule.label)}</strong>
        <span>${escapeHtml(account)} | Normal Balance ${rule.normalBalance} | ${rule.adjustingSide} entry</span>
      </div>
      <div class="receivable-payable-panel__head-actions">
        <button type="button" data-close-receivable-payable-panel aria-label="Close">x</button>
      </div>
    </div>
    <div class="receivable-payable-panel__note">
      ${rowData.name ? `Party: ${escapeHtml(rowData.name)}` : "No party selected. Showing all parties for this ledger."}
    </div>
    ${
      openEntries.length
        ? `<label class="receivable-payable-panel__search">
            <span>Search Party</span>
            <input type="text" autocomplete="off" placeholder="Type party name..." data-receivable-payable-search />
          </label>
          <div class="receivable-payable-panel__table">
            <div class="receivable-payable-panel__row receivable-payable-panel__row--head">
              <div>Journal Date</div>
              <div>Journal No.</div>
              <div>Party</div>
              <div>Description</div>
              <div>Net Amount</div>
              <div>Due Amount</div>
              <div>Now Adjust</div>
            </div>
            ${renderReceivablePayableRows(openEntries)}
            <div class="receivable-payable-panel__actions">
              <button type="button" data-enter-receivable-payable-adjustments>Adjust</button>
            </div>
          </div>`
        : `<div class="receivable-payable-panel__empty">No previous open ${rule.type} balance found for this ledger${rowData.name ? " and party" : ""}.</div>`
    }
  `;
  receivablePayablePanel.hidden = false;
}

function findFirstUsableAdjustmentRow(sourceRowId, entryId) {
  const existingRow = journalLines.querySelector(`[data-adjustment-entry-id="${CSS.escape(entryId)}"]`);
  if (existingRow) {
    return existingRow;
  }

  const sourceRow = journalLines.querySelector(`[data-row-id="${CSS.escape(sourceRowId)}"]`);
  if (sourceRow && !sourceRow.dataset.adjustmentEntryId) {
    return sourceRow;
  }

  const emptyRow = [...journalLines.children].find((row) => {
    if (row.dataset.adjustmentEntryId) return false;
    const rowData = readRowData(row);
    return !rowData.account && !rowData.debit && !rowData.credit && !rowData.description && !rowData.name;
  });

  if (emptyRow) {
    return emptyRow;
  }

  const row = buildRow();
  journalLines.append(row);
  renumberRows();
  return row;
}

function setAdjustmentRow(row, input) {
  const context = activeAdjustmentContext;
  if (!context || !row) return;

  const amount = parseAmount(input.value);
  const dueAmount = parseAmount(input.dataset.dueAmount);
  const entryId = input.dataset.adjustEntryId;
  const debitInput = row.querySelector(".line-debit");
  const creditInput = row.querySelector(".line-credit");
  const partyInput = row.querySelector(".line-party-name");
  const descriptionInput = row.querySelector('input[aria-label="Description"]');
  const appliedAmount = dueAmount > 0 ? Math.min(amount, dueAmount) : amount;

  if (!amount) {
    if (row.dataset.adjustmentEntryId === entryId) {
      row.dataset.adjustmentEntryId = "";
      debitInput.value = "";
      creditInput.value = "";
      updateTotalsAndState();
    }
    return;
  }

  if (appliedAmount !== amount) {
    input.value = formatAmountInput(appliedAmount);
  }

  row.dataset.adjustmentEntryId = entryId;
  row.querySelector(".line-account").value = context.account;
  partyInput.value = input.dataset.partyName || "";
  partyInput.dataset.partyId = input.dataset.partyId || "";
  descriptionInput.value = input.dataset.sourceDescription || `Adjusted against ${input.dataset.sourceJournal || "previous journal"}`;

  if (context.rule.adjustmentSide === "debit") {
    debitInput.value = formatAmountInput(appliedAmount);
    creditInput.value = "";
  } else {
    creditInput.value = formatAmountInput(appliedAmount);
    debitInput.value = "";
  }

  updateTotalsAndState();
}

function applyReceivablePayableAdjustmentInput(input) {
  if (!input || !input.classList.contains("receivable-payable-panel__adjust-input")) {
    return;
  }

  const context = activeAdjustmentContext;
  if (!context) return;

  const row = findFirstUsableAdjustmentRow(context.sourceRowId, input.dataset.adjustEntryId);
  setAdjustmentRow(row, input);
}

function enterReceivablePayableAdjustments() {
  const context = activeAdjustmentContext;
  if (!context) return;

  const inputs = Array.from(receivablePayablePanel.querySelectorAll(".receivable-payable-panel__adjust-input"))
    .filter((input) => parseAmount(input.value) > 0);

  inputs.forEach((input) => {
    const row = findFirstUsableAdjustmentRow(context.sourceRowId, input.dataset.adjustEntryId);
    setAdjustmentRow(row, input);
    input.value = formatAmountInput(input.value);
  });

  if (inputs.length) {
    hideReceivablePayablePanel();
    renumberRows();
    updateTotalsAndState();
    focusAfterReceivablePayableAdjustment(context);
  }
}

function getReceivablePayableFocusableControls() {
  return Array.from(
    receivablePayablePanel.querySelectorAll(
      '[data-receivable-payable-search], .receivable-payable-panel__adjust-input, [data-enter-receivable-payable-adjustments]'
    )
  ).filter((control) => !control.disabled && !control.closest("[hidden]") && !control.hidden);
}

function focusReceivablePayablePanelStart() {
  const controls = getReceivablePayableFocusableControls();
  const searchInput = controls.find((control) => control.matches("[data-receivable-payable-search]"));
  const target = searchInput || controls[0];

  if (target) {
    target.focus();
    if (typeof target.select === "function") {
      target.select();
    }
  }
}

function handleAmountInputTabToAdjustment(event) {
  if (
    event.key !== "Tab" ||
    event.shiftKey ||
    !event.target.classList.contains("line-number-input")
  ) {
    return;
  }

  showReceivablePayablePanelForInput(event.target);

  if (receivablePayablePanel.hidden || !getReceivablePayableFocusableControls().length) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  window.setTimeout(focusReceivablePayablePanelStart, 0);
}

function moveReceivablePayablePanelFocus(event) {
  if (event.key !== "Tab" || receivablePayablePanel.hidden) {
    return;
  }

  const controls = getReceivablePayableFocusableControls();
  const currentIndex = controls.indexOf(event.target);

  if (currentIndex === -1) {
    return;
  }

  const nextIndex = event.shiftKey ? currentIndex - 1 : currentIndex + 1;
  const nextControl = controls[nextIndex];

  if (!nextControl) {
    return;
  }

  event.preventDefault();
  nextControl.focus();
  if (typeof nextControl.select === "function") {
    nextControl.select();
  }
}

function focusAfterReceivablePayableAdjustment(context) {
  const sourceRow = journalLines.querySelector(`[data-row-id="${CSS.escape(context.sourceRowId)}"]`);
  const fallbackRow = journalLines.lastElementChild;
  const targetRow = sourceRow || fallbackRow;

  if (!targetRow) return;

  const targetInput =
    context.sourceSide === "debit"
      ? targetRow.querySelector(".line-credit")
      : targetRow.querySelector(".line-debit");

  if (targetInput) {
    targetInput.focus();
    if (typeof targetInput.select === "function") {
      targetInput.select();
    }
  }
}

function readRowData(row) {
  const partyInput = row.querySelector('input[aria-label="Name"]');
  const party = partyInput && partyInput.dataset.partyId ? getPartyById(partyInput.dataset.partyId) : null;

  return {
    account: row.querySelector(".line-account").value.trim(),
    debit: row.querySelector(".line-debit").value.trim(),
    credit: row.querySelector(".line-credit").value.trim(),
    description: row.querySelector('input[aria-label="Description"]').value.trim(),
    name: party ? getPartyDisplayLabel(party) : partyInput.value.trim(),
    partyId: party ? party.id : partyInput.dataset.partyId || "",
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

function getJournalSearchText(journal) {
  const lineText = Array.isArray(journal.lines)
    ? journal.lines
        .map((line) =>
          [
            line.account,
            line.description,
            line.note,
            line.notes,
            line.name,
            line.debit,
            line.credit,
          ].join(" ")
        )
        .join(" ")
    : "";

  return [
    journal.number,
    journal.journalDate,
    formatPrintDate(journal.journalDate),
    journal.description,
    journal.note,
    journal.notes,
    lineText,
  ].join(" ");
}

function journalMatchesSearch(journal, query) {
  const tokens = String(query || "")
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  const target = getJournalSearchText(journal);

  if (!tokens.length) {
    return true;
  }

  return tokens.every((token) => searchIncludes(target, token));
}

function getSortedSavedJournals() {
  return getSavedJournals().sort((left, right) => {
    const leftSequence = getJournalSequence(left.number);
    const rightSequence = getJournalSequence(right.number);
    return String(right.journalDate || "").localeCompare(String(left.journalDate || "")) ||
      rightSequence - leftSequence;
  });
}

function setActiveJournalOption(index) {
  if (!activeJournalSearch.journals.length) {
    activeJournalSearch.index = -1;
    return;
  }

  const boundedIndex = Math.max(0, Math.min(index, activeJournalSearch.journals.length - 1));
  activeJournalSearch.index = boundedIndex;

  [...allJournalsList.querySelectorAll(".all-journals-option")].forEach((option) => {
    const isActive = Number(option.dataset.index) === boundedIndex;
    option.classList.toggle("is-active", isActive);
    option.setAttribute("aria-selected", isActive ? "true" : "false");

    if (isActive) {
      option.scrollIntoView({ block: "nearest" });
    }
  });
}

function loadJournalIntoForm(journal) {
  if (!journal) {
    return;
  }

  journalDateInput.value = journal.journalDate || formatDateForInput(new Date());
  journalNumberInput.value = journal.number || getJournalNumberParts(journalDateInput.value).latestNumber;
  journalDescription.value = journal.description || "";
  attachments = Array.isArray(journal.attachments) ? journal.attachments.map((file) => ({ ...file })) : [];
  journalLines.innerHTML = "";

  const lines = Array.isArray(journal.lines) ? journal.lines : [];
  lines.forEach((line) => {
    journalLines.append(buildRow(line));
  });

  while (journalLines.children.length < DEFAULT_ROW_COUNT) {
    journalLines.append(buildRow());
  }

  currentEditingJournalNumber = journalNumberInput.value;
  clearCopyNotice();
  renumberRows();
  renderAttachments();
  updateTotalsAndState();
  closeAllJournalsModal();
  showSaveToast(`Journal Number ${journalNumberInput.value} loaded`);
}

function renderAllJournals() {
  const query = allJournalsSearch.value;
  const journals = getSortedSavedJournals().filter((journal) => journalMatchesSearch(journal, query));
  activeJournalSearch = {
    journals,
    index: journals.length ? 0 : -1,
  };
  allJournalsList.innerHTML = "";

  if (!journals.length) {
    const empty = document.createElement("div");
    empty.className = "all-journals-empty";
    empty.textContent = "No saved journals found.";
    allJournalsList.append(empty);
    return;
  }

  journals.forEach((journal, index) => {
    const option = document.createElement("button");
    const firstLine = Array.isArray(journal.lines) ? journal.lines.find((line) => line.account) : null;
    option.className = "all-journals-option";
    option.type = "button";
    option.dataset.index = String(index);
    option.setAttribute("role", "option");
    option.setAttribute("aria-selected", index === 0 ? "true" : "false");
    option.classList.toggle("is-active", index === 0);
    option.innerHTML = `
      <strong>${escapeHtml(journal.number || "-")}</strong>
      <span>${escapeHtml(formatPrintDate(journal.journalDate) || "-")}${firstLine ? ` | ${escapeHtml(firstLine.account)}` : ""}</span>
    `;
    option.addEventListener("click", () => loadJournalIntoForm(journal));
    allJournalsList.append(option);
  });
}

function openAllJournalsModal() {
  allJournalsSearch.value = "";
  renderAllJournals();
  allJournalsModal.hidden = false;
  document.body.classList.add("modal-open");
  allJournalsSearch.focus();
}

function closeAllJournalsModal() {
  allJournalsModal.hidden = true;
  document.body.classList.remove("modal-open");
}

function loadJournalFromUrlParams() {
  const params = new URLSearchParams(window.location.search);
  const journalNumber = params.get("journal");
  const copyNumber = params.get("copy");
  const targetNumber = journalNumber || copyNumber;

  if (!targetNumber) {
    return;
  }

  const journal = getSavedJournals().find((entry) => entry.number === targetNumber);

  if (!journal) {
    showJournalAlert("Could not find this journal.");
    return;
  }

  loadJournalIntoForm(journal);

  if (copyNumber) {
    copyJournal();
  }
}

function updateBackButtonFromUrlParams() {
  if (!journalBackButton) {
    return;
  }

  const params = new URLSearchParams(window.location.search);

  if (params.get("return") === "journal-register") {
    journalBackButton.href = "./journal-register.html";
  } else if (params.get("return") === "general-ledger") {
    journalBackButton.href = "./general-ledger.html";
  } else if (params.get("return") === "party-wise-transaction") {
    journalBackButton.href = "./party-wise-transaction.html";
  } else if (params.get("return") === "party-wise-ledger") {
    journalBackButton.href = "./party-wise-transaction.html";
  } else {
    journalBackButton.href = "./workspace.html";
  }
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

function showDeleteConfirm() {
  const targetNumber = journalNumberInput.value;
  const journalExists = getSavedJournals().some((journal) => journal.number === targetNumber);

  if (!journalExists) {
    showJournalAlert("This journal has not been saved yet.");
    return;
  }

  deleteConfirmModal.hidden = false;
  document.body.classList.add("modal-open");
  deleteConfirmYes.focus();
}

function hideDeleteConfirm() {
  deleteConfirmModal.hidden = true;
  document.body.classList.remove("modal-open");
}

function deleteCurrentJournal() {
  const targetNumber = journalNumberInput.value;
  const savedJournals = getSavedJournals();
  const nextJournals = savedJournals.filter((journal) => journal.number !== targetNumber);

  if (nextJournals.length === savedJournals.length) {
    hideDeleteConfirm();
    showJournalAlert("This journal has not been saved yet.");
    return;
  }

  localStorage.setItem(STORAGE_KEYS.journals, JSON.stringify(nextJournals));
  removeItemFromBackend("journals", targetNumber, nextJournals);
  hideDeleteConfirm();
  resetRows();
  journalDescription.value = "";
  currentEditingJournalNumber = "";
  clearCopyNotice();
  clearAttachments();
  journalNumberInput.value = targetNumber;
  updateTotalsAndState();
  showSaveToast(`Journal Number ${targetNumber} deleted`);
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
  const existingIndex = savedJournals.findIndex((journal) => journal.number === journalNumberInput.value);
  const duplicateNumberExists = savedJournals.some(
    (journal) =>
      journal.number === journalNumberInput.value &&
      journal.number !== currentEditingJournalNumber
  );

  if (duplicateNumberExists || (existingIndex >= 0 && currentEditingJournalNumber !== journalNumberInput.value)) {
    showJournalAlert("Duplicate can't create. This journal number is already saved.");
    return false;
  }

  const journalEntry = {
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
  };

  if (existingIndex >= 0) {
    savedJournals[existingIndex] = {
      ...savedJournals[existingIndex],
      ...journalEntry,
      updatedAt: new Date().toISOString(),
    };
  } else {
    savedJournals.push(journalEntry);
  }

  localStorage.setItem(STORAGE_KEYS.journals, JSON.stringify(savedJournals));
  upsertItemToBackend("journals", journalEntry.number, journalEntry, savedJournals);
  currentEditingJournalNumber = journalNumberInput.value;
  clearCopyNotice();
  showSaveToast(`Journal Number ${journalNumberInput.value} saved`);
  return true;
}

function resetJournalForm() {
  const lastDate = journalDateInput.value || formatDateForInput(new Date());
  resetRows();
  journalDateInput.value = lastDate;
  journalDescription.value = "";
  currentEditingJournalNumber = "";
  clearCopyNotice();
  clearAttachments();
  updateJournalNumber();
  updateLedgerAvailabilityNote();
  updateTotalsAndState();
}

function startNewJournal() {
  resetJournalForm();
  hideJournalNumberMenu();
  closeAllJournalsModal();
  showSaveToast(`New Journal ${journalNumberInput.value} ready`);
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
  const sourceNumber = journalNumberInput.value || getNextJournalNumber(journalDateInput.value);
  const currentDate = journalDateInput.value || formatDateForInput(new Date());
  const generatedNumber = getNextJournalNumber(currentDate);
  const nextNumber =
    generatedNumber === journalNumberInput.value ? incrementJournalNumber(journalNumberInput.value) : generatedNumber;

  journalDateInput.value = currentDate;
  journalNumberInput.value = nextNumber;
  currentEditingJournalNumber = "";
  showCopyNotice(sourceNumber);
  showSaveToast(`Copied as ${nextNumber}`);
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

function formatPrintDate(dateValue) {
  return window.BanikAccounting ? window.BanikAccounting.formatDate(dateValue) : dateValue;
}

async function getPrintOrganization() {
  if (!window.BanikAuth || typeof window.BanikAuth.getCurrentUser !== "function") {
    return {
      name: "BANIK Books",
      address: "",
    };
  }

  try {
    const user = await window.BanikAuth.getCurrentUser();

    return {
      name: user && (user.companyName || user.fullName) ? user.companyName || user.fullName : "BANIK Books",
      address: user && user.companyAddress ? user.companyAddress : "",
    };
  } catch {
    return {
      name: "BANIK Books",
      address: "",
    };
  }
}

function buildPrintRows(lines) {
  return lines
    .map(
      (line, index) => `
        <tr>
          <td class="print-sl">${index + 1}</td>
          <td class="print-account">${escapeHtml(line.account)}</td>
          <td class="print-money">${escapeHtml(formatAmountInput(line.debit))}</td>
          <td class="print-money">${escapeHtml(formatAmountInput(line.credit))}</td>
          <td class="print-line-description">${escapeHtml(line.description)}</td>
          <td class="print-name">${escapeHtml(line.name)}</td>
        </tr>`
    )
    .join("");
}

async function printJournal() {
  const lines = getFilledLines();

  if (!lines.length) {
    showJournalAlert("Please add a journal line before printing.");
    return;
  }

  const totals = getTotals();
  const organization = await getPrintOrganization();
  const description = journalDescription.value.trim();
  const printWindow = window.open("", "_blank");

  if (!printWindow) {
    showJournalAlert("Please allow popups to print this journal.");
    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <title>Journal ${escapeHtml(journalNumberInput.value)}</title>
        <style>
          @page {
            size: A4;
            margin: 0;
          }

          * {
            box-sizing: border-box;
          }

          body {
            margin: 0;
            background: #f2f2f2;
            color: #000000;
            font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            font-size: 10.5pt;
          }

          .print-page {
            width: 210mm;
            min-height: 297mm;
            margin: 0 auto;
            padding: 18mm 14mm;
            display: flex;
            flex-direction: column;
            background: #ffffff;
          }

          .print-title {
            margin: 10px 0 6px;
            text-align: center;
            font-size: 13pt;
            font-weight: 700;
            text-transform: none;
          }

          .print-organization {
            text-align: center;
            font-weight: 700;
            line-height: 1.3;
          }

          .print-organization-name {
            font-size: 13pt;
          }

          .print-organization-address {
            font-size: 10.5pt;
          }

          .print-meta {
            display: flex;
            justify-content: space-between;
            gap: 24px;
            margin-top: 0;
            padding-top: 6.35mm;
            border-top: 1.2px solid #000000;
            font-weight: 700;
          }

          table {
            width: 100%;
            margin-top: 8px;
            border-collapse: collapse;
            table-layout: fixed;
          }

          th,
          td {
            border: 0.8px solid #000000;
            padding: 5px 6px;
            vertical-align: middle;
            line-height: 1.25;
            overflow-wrap: anywhere;
          }

          td {
            font-size: 10pt;
            font-weight: 400;
          }

          th {
            font-size: 11pt;
            font-weight: 700;
            text-align: center;
          }

          tfoot td {
            font-size: 11pt;
            font-weight: 700;
          }

          .print-sl {
            width: 9mm;
            text-align: center;
          }

          .print-account {
            width: 48mm;
            text-align: left;
          }

          .print-money {
            width: 30mm;
            text-align: right;
            white-space: nowrap;
          }

          .print-line-description {
            width: 38mm;
            text-align: left;
          }

          .print-name {
            width: 27mm;
            text-align: left;
          }

          thead .print-sl,
          thead .print-account,
          thead .print-money,
          thead .print-line-description,
          thead .print-name {
            text-align: center;
          }

          .print-description {
            margin-top: 6.35mm;
            padding-top: 0;
            line-height: 1.45;
            white-space: pre-wrap;
          }

          .print-signatures {
            display: flex;
            justify-content: center;
            gap: 36mm;
            margin-top: auto;
            padding-top: 28mm;
            text-align: center;
          }

          .print-signature-line {
            min-width: 42mm;
            border-top: 1px solid #000000;
            padding-top: 6px;
          }

          @media screen {
            body {
              padding: 16px;
            }

            .print-page {
              box-shadow: 0 8px 26px rgba(0, 0, 0, 0.18);
            }
          }

          @media print {
            body {
              background: #ffffff;
              padding: 0;
            }

            .print-page {
              margin: 0;
              box-shadow: none;
            }
          }
        </style>
      </head>
      <body>
        <main class="print-page">
          <section class="print-organization">
            <div class="print-organization-name">${escapeHtml(organization.name)}</div>
            <div class="print-organization-address">${escapeHtml(organization.address)}</div>
          </section>
          <h1 class="print-title">Journal</h1>

          <section class="print-meta">
            <div>Journal Date: ${escapeHtml(formatPrintDate(journalDateInput.value))}</div>
            <div>Journal No.: ${escapeHtml(journalNumberInput.value)}</div>
          </section>

          <table>
            <thead>
              <tr>
                <th class="print-sl">Sl.</th>
                <th class="print-account">Account</th>
                <th class="print-money">Debit</th>
                <th class="print-money">Credit</th>
                <th class="print-line-description">Description</th>
                <th class="print-name">Name</th>
              </tr>
            </thead>
            <tbody>${buildPrintRows(lines)}</tbody>
            <tfoot>
              <tr>
                <td></td>
                <td class="print-account">Total</td>
                <td class="print-money">${escapeHtml(formatMoney(totals.debit))}</td>
                <td class="print-money">${escapeHtml(formatMoney(totals.credit))}</td>
                <td class="print-line-description"></td>
                <td class="print-name"></td>
              </tr>
            </tfoot>
          </table>

          ${
            description
              ? `<section class="print-description"><strong>Journal Note:</strong> ${escapeHtml(description)}</section>`
              : ""
          }

          <section class="print-signatures">
            <div class="print-signature-line">Entry By</div>
            <div class="print-signature-line">Approved by</div>
          </section>
        </main>
        <script>
          window.addEventListener("load", () => {
            window.print();
          });
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
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
    showJournalAlert("Duplicate can't create. This group or ledger name already exists.");
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

function openJournalPartyModal() {
  journalPartyForm.reset();
  journalPartyType.value = "Customer";
  renderJournalPartyFields(journalPartyType.value);
  journalPartySave.textContent = "Save";
  journalPartyModal.hidden = false;
  setTimeout(() => {
    const firstInput = journalPartyModal.querySelector("input, select, textarea");
    if (firstInput) firstInput.focus();
  }, 0);
}

function closeJournalPartyModal() {
  journalPartyModal.hidden = true;
}

function renderJournalPartyFields(type) {
  journalPartyDynamicFields.innerHTML = getJournalPartyFieldsForType(type)
    .map((field) => renderJournalPartyField(field))
    .join("");
  wireJournalPartyDoFields();
}

function getJournalPartyFieldsForType(type) {
  if (type === "Customer") {
    return [
      partyTextField("customerName", "Customer Name", true),
      partyTextareaField("address", "Address", "wide"),
      partyTextField("mobileNumber", "Mobile Number"),
      partyEmailField("email", "Email"),
      partyTextField("bin", "BIN"),
      partyTextField("tin", "TIN"),
    ];
  }

  if (type === "Supplier") {
    return [
      partyTextField("supplierName", "Supplier Name", true),
      partySelectField("businessNature", "Company/Individual", ["Company", "Individual"]),
      partyConditionalField(partyTextField("contactPerson", "Name of Contact Person"), "businessNature", "Individual"),
      partyTextareaField("billingAddress", "Billing Address", "wide"),
      partyDoField("shippingSameAsBilling", "Do"),
      partyTextareaField("shippingAddress", "Shipping Address", "wide"),
      partyTextField("district", "District"),
      partyTextField("mobileNumber", "Mobile Number"),
      partyEmailField("email", "Email"),
      partyTextField("bin", "BIN"),
      partyTextField("tin", "TIN"),
    ];
  }

  if (type === "Both") {
    return [
      partyTextField("partyName", "Party Name", true),
      partySelectField("businessNature", "Company/Individual", ["Company", "Individual"]),
      partyConditionalField(partyTextField("contactPerson", "Name of Contact Person"), "businessNature", "Individual"),
      partyTextareaField("address", "Address", "wide"),
      partyTextareaField("billingAddress", "Billing Address", "wide"),
      partyDoField("shippingSameAsBilling", "Do"),
      partyTextareaField("shippingAddress", "Shipping Address", "wide"),
      partyTextField("district", "District"),
      partyTextField("mobileNumber", "Mobile Number"),
      partyEmailField("email", "Email"),
      partyTextField("bin", "BIN"),
      partyTextField("tin", "TIN"),
    ];
  }

  return [
    partyTextField("employeeName", "Employee Name", true),
    partyDateField("joiningDate", "Date of Joining"),
    partyDateField("releaseDate", "Date of Release"),
    partyTextField("designation", "Designation"),
    partyTextField("nid", "NID"),
    partyTextareaField("currentAddress", "Current Address", "wide"),
    partyDoField("permanentSameAsCurrent", "Do"),
    partyTextareaField("permanentAddress", "Permanent Address", "wide"),
    partyTextField("mobileNumber", "Mobile Number"),
    partyEmailField("personalEmail", "Personal Email"),
    partyEmailField("officialEmail", "Official Email"),
    partyDateField("realDob", "Real Date of Birth"),
    partyDoField("certificateDobSameAsReal", "Do"),
    partyDateField("certificateDob", "Certificate Date of Birth"),
    partyTextField("tin", "TIN"),
  ];
}

function partyTextField(name, label, required = false) {
  return { kind: "input", type: "text", name, label, required };
}

function partyEmailField(name, label) {
  return { kind: "input", type: "email", name, label };
}

function partyDateField(name, label) {
  return { kind: "input", type: "date", name, label };
}

function partyTextareaField(name, label, span = "") {
  return { kind: "textarea", name, label, span };
}

function partySelectField(name, label, options) {
  return { kind: "select", name, label, options };
}

function partyDoField(name, label) {
  return { kind: "checkbox", name, label };
}

function partyConditionalField(field, sourceName, sourceValue) {
  return { ...field, condition: { sourceName, sourceValue } };
}

function renderJournalPartyField(field) {
  const conditionAttrs = field.condition
    ? ` data-party-condition-source="${field.condition.sourceName}" data-party-condition-value="${field.condition.sourceValue}" hidden`
    : "";
  const required = field.required ? " required" : "";
  const spanClass =
    field.span === "wide" ? " party-field--wide" : field.span === "full" ? " party-field--full" : "";

  if (field.kind === "checkbox") {
    return `
      <label class="party-do-field"${conditionAttrs}>
        <input name="${field.name}" type="checkbox" />
        <span>${escapeHtml(field.label)}</span>
      </label>
    `;
  }

  if (field.kind === "textarea") {
    return `
      <label class="party-field${spanClass}"${conditionAttrs}>
        <span>${escapeHtml(field.label)}</span>
        <textarea name="${field.name}"${required}></textarea>
      </label>
    `;
  }

  if (field.kind === "select") {
    return `
      <label class="party-field"${conditionAttrs}>
        <span>${escapeHtml(field.label)}</span>
        <select name="${field.name}"${required}>
          ${field.options.map((option) => `<option value="${escapeHtml(option)}">${escapeHtml(option)}</option>`).join("")}
        </select>
      </label>
    `;
  }

  return `
    <label class="party-field"${conditionAttrs}>
      <span>${escapeHtml(field.label)}</span>
      <input name="${field.name}" type="${field.type}"${required} autocomplete="off" />
    </label>
  `;
}

function wireJournalPartyDoFields() {
  bindJournalPartyMirror(journalPartyForm.elements.shippingSameAsBilling, journalPartyForm.elements.billingAddress, journalPartyForm.elements.shippingAddress);
  bindJournalPartyMirror(journalPartyForm.elements.permanentSameAsCurrent, journalPartyForm.elements.currentAddress, journalPartyForm.elements.permanentAddress);
  bindJournalPartyMirror(journalPartyForm.elements.certificateDobSameAsReal, journalPartyForm.elements.realDob, journalPartyForm.elements.certificateDob);
  wireJournalPartyConditionalFields();
}

function bindJournalPartyMirror(toggle, source, target) {
  if (!toggle || !source || !target) return;

  const sync = () => {
    if (toggle.checked) {
      target.value = source.value;
      target.disabled = true;
    } else {
      target.disabled = false;
    }
  };

  toggle.addEventListener("change", sync);
  source.addEventListener("input", sync);
  sync();
}

function wireJournalPartyConditionalFields() {
  const conditionalLabels = Array.from(journalPartyForm.querySelectorAll("[data-party-condition-source]"));
  const syncAll = () => {
    conditionalLabels.forEach((label) => {
      const source = journalPartyForm.elements[label.dataset.partyConditionSource];
      const isHidden = !source || source.value !== label.dataset.partyConditionValue;
      const input = label.querySelector("input, select, textarea");
      label.hidden = isHidden;
      if (input) input.disabled = isHidden;
    });
  };

  conditionalLabels.forEach((label) => {
    const source = journalPartyForm.elements[label.dataset.partyConditionSource];
    if (source && !source.dataset.partyConditionWired) {
      source.addEventListener("change", syncAll);
      source.dataset.partyConditionWired = "true";
    }
  });

  syncAll();
}

function collectJournalPartyFormData() {
  const type = journalPartyType.value;
  const fields = {};

  getJournalPartyFieldsForType(type).forEach((field) => {
    const input = journalPartyForm.elements[field.name];
    if (!input) return;
    if (input.disabled) {
      fields[field.name] = "";
      return;
    }
    fields[field.name] = input.type === "checkbox" ? input.checked : input.value.trim();
  });

  return {
    type,
    fields,
    bank: {
      bankName: journalPartyForm.elements.bankName.value.trim(),
      accountName: journalPartyForm.elements.accountName.value.trim(),
      accountNumber: journalPartyForm.elements.accountNumber.value.trim(),
      branchName: journalPartyForm.elements.branchName.value.trim(),
      routingNumber: journalPartyForm.elements.routingNumber.value.trim(),
    },
  };
}

function saveJournalParty(event) {
  event.preventDefault();
  if (!journalPartyForm.reportValidity()) return;

  const now = new Date().toISOString();
  const party = {
    id: `party-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: now,
    updatedAt: now,
    ...collectJournalPartyFormData(),
  };
  const parties = getSavedParties();
  parties.push(party);
  saveParties(parties, party);

  const displayName = getPartyDisplayLabel(party, parties);
  if (pendingPartyNameInput && displayName) {
    pendingPartyNameInput.value = displayName;
    pendingPartyNameInput.dataset.partyId = party.id;
    pendingPartyNameInput.focus();
  }

  closeJournalPartyModal();
  refreshOpenPartyPicker();
  showSaveToast(`Party ${displayName || "created"} saved`);
  updateTotalsAndState();
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

journalLines.addEventListener("input", (event) => {
  enforceSingleAmountSide(event.target);
  showReceivablePayablePanelForInput(event.target);
  updateTotalsAndState();
});
journalLines.addEventListener("keydown", handleAmountInputTabToAdjustment);
journalLines.addEventListener("change", (event) => {
  showReceivablePayablePanelForInput(event.target);
  updateTotalsAndState();
});
journalLines.addEventListener("blur", (event) => {
  if (event.target.classList.contains("line-number-input")) {
    enforceSingleAmountSide(event.target);
    event.target.value = formatAmountInput(event.target.value);
    if (!receivablePayablePanel.contains(event.relatedTarget)) {
      showReceivablePayablePanelForInput(event.target);
    }
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
  hideJournalNumberMenu();
  updateTotalsAndState();
});

journalNumberInput.addEventListener("click", showJournalNumberMenu);
journalNumberInput.addEventListener("focus", showJournalNumberMenu);

addLineButton.addEventListener("click", () => {
  appendRow();
});

clearLinesButton.addEventListener("click", () => {
  resetRows();
});

journalForm.addEventListener("submit", handleSave);
allJournalsButton.addEventListener("click", openAllJournalsModal);
allJournalsClose.addEventListener("click", closeAllJournalsModal);
allJournalsSearch.addEventListener("input", renderAllJournals);
allJournalsSearch.addEventListener("keydown", (event) => {
  if (event.key === "ArrowDown") {
    event.preventDefault();
    setActiveJournalOption(activeJournalSearch.index + 1);
    return;
  }

  if (event.key === "ArrowUp") {
    event.preventDefault();
    setActiveJournalOption(
      activeJournalSearch.index <= 0
        ? activeJournalSearch.journals.length - 1
        : activeJournalSearch.index - 1
    );
    return;
  }

  if (event.key === "Enter" || event.key === "Tab") {
    const journal =
      activeJournalSearch.journals[activeJournalSearch.index] || activeJournalSearch.journals[0];

    if (journal) {
      event.preventDefault();
      loadJournalIntoForm(journal);
    }
  }
});
deleteJournalButton.addEventListener("click", showDeleteConfirm);
newJournalButton.addEventListener("click", startNewJournal);
deleteConfirmYes.addEventListener("click", deleteCurrentJournal);
deleteConfirmNo.addEventListener("click", hideDeleteConfirm);
copyJournalButton.addEventListener("click", copyJournal);
printJournalButton.addEventListener("click", printJournal);
createLedgerButton.addEventListener("click", openQuickLedgerModal);
quickLedgerClose.addEventListener("click", closeQuickLedgerModal);
quickLedgerForm.addEventListener("submit", saveQuickLedger);
journalPartyType.addEventListener("change", () => renderJournalPartyFields(journalPartyType.value));
journalPartyClose.addEventListener("click", closeJournalPartyModal);
journalPartyCancel.addEventListener("click", closeJournalPartyModal);
journalPartyForm.addEventListener("submit", saveJournalParty);
journalAlertClose.addEventListener("click", hideJournalAlert);
[journalAlert, deleteConfirmModal, allJournalsModal, quickLedgerModal, journalPartyModal].forEach((modal) => {
  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      if (modal === journalAlert) {
        hideJournalAlert();
      } else if (modal === deleteConfirmModal) {
        hideDeleteConfirm();
      } else if (modal === allJournalsModal) {
        closeAllJournalsModal();
      } else if (modal === journalPartyModal) {
        closeJournalPartyModal();
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

  if (!deleteConfirmModal.hidden) {
    hideDeleteConfirm();
  }

  if (!allJournalsModal.hidden) {
    closeAllJournalsModal();
  }

  if (!quickLedgerModal.hidden) {
    closeQuickLedgerModal();
  }

  if (!journalPartyModal.hidden) {
    closeJournalPartyModal();
  }

  if (!receivablePayablePanel.hidden) {
    hideReceivablePayablePanel();
  }

  if (!journalPreviewModal.hidden) {
    closeJournalPreviewModal();
  }

  hideJournalNumberMenu();
});

window.addEventListener("resize", refreshOpenLedgerPicker);
window.addEventListener("resize", refreshOpenPartyPicker);
window.addEventListener("resize", hideReceivablePayablePanel);
window.addEventListener("scroll", refreshOpenLedgerPicker, true);
window.addEventListener("scroll", refreshOpenPartyPicker, true);
window.addEventListener("scroll", hideReceivablePayablePanel, true);
document.addEventListener("click", (event) => {
  const previewButton = event.target.closest("[data-preview-journal]");
  if (previewButton) {
    openJournalPreviewModal(previewButton.dataset.previewJournal);
    return;
  }

  if (event.target.closest("[data-close-journal-preview]")) {
    closeJournalPreviewModal();
    return;
  }

  if (event.target === journalPreviewModal) {
    closeJournalPreviewModal();
    return;
  }

  if (event.target.closest("[data-enter-receivable-payable-adjustments]")) {
    enterReceivablePayableAdjustments();
    return;
  }

  if (event.target.closest("[data-close-receivable-payable-panel]")) {
    hideReceivablePayablePanel();
    return;
  }

  if (
    !receivablePayablePanel.hidden &&
    !receivablePayablePanel.contains(event.target) &&
    !event.target.closest(".line-number-input")
  ) {
    hideReceivablePayablePanel();
  }

  if (
    !journalNumberMenu ||
    journalNumberMenu.hidden ||
    event.target === journalNumberInput ||
    journalNumberMenu.contains(event.target)
  ) {
    return;
  }

  hideJournalNumberMenu();
});

receivablePayablePanel.addEventListener("input", (event) => {
  if (event.target.matches("[data-receivable-payable-search]")) {
    filterReceivablePayableRows(event.target.value);
    return;
  }
});

receivablePayablePanel.addEventListener("keydown", moveReceivablePayablePanelFocus);

receivablePayablePanel.addEventListener("click", (event) => {
  const previewButton = event.target.closest("[data-preview-journal]");
  if (!previewButton) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  openJournalPreviewModal(previewButton.dataset.previewJournal);
});

receivablePayablePanel.addEventListener("blur", (event) => {
  if (event.target.classList.contains("receivable-payable-panel__adjust-input")) {
    event.target.value = formatAmountInput(event.target.value);
  }
}, true);

document.addEventListener("DOMContentLoaded", async () => {
  if (window.BanikAccounting) {
    await window.BanikAccounting.ready();
  }
  await hydrateCollectionFromBackend("parties", STORAGE_KEYS.parties, filterParties);
  await hydrateCollectionFromBackend("journals", STORAGE_KEYS.journals, filterJournals);
  updateBackButtonFromUrlParams();
  renderJournalPartyFields(journalPartyType.value);
  journalDateInput.value = getLatestJournalDateForNewEntry();
  updateJournalNumber();
  await refreshLedgersFromChartOfAccounts();
  updateLedgerAvailabilityNote();
  resetRows();
  renderAttachments();
  loadJournalFromUrlParams();
});
