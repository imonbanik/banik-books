const CHART_STORAGE_KEY = "banikBooksChartOfAccounts";
const LEDGER_STORAGE_KEY = "banikBooksLedgers";
const FORM_DRAFT_STORAGE_KEY = "banikBooksChartFormDraft";
const FORM_HISTORY_STORAGE_KEY = "banikBooksChartFormHistory";
const COLLAPSED_GROUPS_STORAGE_KEY = "banikBooksCollapsedChartGroups";
const DEFAULT_CHART_VERSION_STORAGE_KEY = "banikBooksDefaultChartVersion";
const DEFAULT_CHART_VERSION = "banik-default-chart-2026-05-24-v5";
const DEFAULT_CHART_ITEMS = Object.freeze([
  {
    type: "group",
    name: "Assets",
    classification: "Asset",
    children: [
      {
        type: "group",
        name: "Non-Current Assets",
        classification: "Asset",
        children: [
          {
            type: "group",
            name: "Property, Plant & Equipment",
            classification: "Asset",
            children: [
              { type: "ledger", name: "Computer & Peripherals", classification: "Asset" },
              { type: "ledger", name: "Office Equipment", classification: "Asset" },
              { type: "ledger", name: "Furniture & Fixture", classification: "Asset" },
              {
                type: "ledger",
                name: "Accumulated Depreciation on Computer & Peripherals",
                classification: "Asset",
              },
              {
                type: "ledger",
                name: "Accumulated Depreciation on Office Equipment",
                classification: "Asset",
              },
              {
                type: "ledger",
                name: "Accumulated Depreciation on Furniture & Fixture",
                classification: "Asset",
              },
            ],
          },
        ],
      },
      {
        type: "group",
        name: "Current Assets",
        classification: "Asset",
        children: [
          {
            type: "group",
            name: "Advance, Deposit & Prepayments",
            classification: "Asset",
            children: [
              { type: "ledger", name: "Advance Office Rent", classification: "Asset" },
              { type: "ledger", name: "Advance Income Tax", classification: "Asset" },
              { type: "ledger", name: "Advance to Supplier", classification: "Asset" },
              { type: "ledger", name: "Advance to Staff", classification: "Asset" },
            ],
          },
          { type: "ledger", name: "Sundry Receivables", classification: "Asset" },
          {
            type: "group",
            name: "Cash & Cash Equivalents",
            classification: "Asset",
            children: [
              { type: "ledger", name: "Cash In Hand", classification: "Asset" },
              {
                type: "group",
                name: "Cash at Bank",
                classification: "Asset",
                children: [{ type: "ledger", name: "Bank Account", classification: "Asset" }],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    type: "group",
    name: "Equity & Liabilities",
    classification: "Equity",
    children: [
      {
        type: "group",
        name: "Equity",
        classification: "Equity",
        children: [
          { type: "ledger", name: "Paid Up Share Capital", classification: "Equity" },
          { type: "ledger", name: "Share Money Deposit", classification: "Equity" },
          { type: "ledger", name: "Retained Earnings", classification: "Equity" },
        ],
      },
      {
        type: "group",
        name: "Non-Current Liabilities",
        classification: "Liability",
        children: [{ type: "ledger", name: "Long Term Loan", classification: "Liability" }],
      },
      {
        type: "group",
        name: "Current Liabilities",
        classification: "Liability",
        children: [
          {
            type: "group",
            name: "Salary & Other Payable",
            classification: "Liability",
            children: [
              { type: "ledger", name: "Salary & Allowances Payable", classification: "Liability" },
              { type: "ledger", name: "Festival Bonus Payable", classification: "Liability" },
              { type: "ledger", name: "Sundry Payable", classification: "Liability" },
            ],
          },
          {
            type: "group",
            name: "Tax Payable",
            classification: "Liability",
            children: [
              { type: "ledger", name: "Tax Payable - Employee", classification: "Liability" },
              { type: "ledger", name: "Tax Payable - Supplier", classification: "Liability" },
            ],
          },
          {
            type: "group",
            name: "VAT Payable",
            classification: "Liability",
            children: [
              { type: "ledger", name: "VAT Payable - Service Income", classification: "Liability" },
              { type: "ledger", name: "VAT Payable - Supplier", classification: "Liability" },
            ],
          },
          {
            type: "group",
            name: "Provision for Expenses",
            classification: "Liability",
            children: [
              { type: "ledger", name: "Provision for Audit Fees", classification: "Liability" },
              {
                type: "ledger",
                name: "Provision for Income Tax Expense",
                classification: "Liability",
              },
            ],
          },
        ],
      },
    ],
  },
  {
    type: "group",
    name: "Income",
    classification: "Income",
    children: [{ type: "ledger", name: "Service Revenue", classification: "Income" }],
  },
  {
    type: "group",
    name: "Expense",
    classification: "Expense",
    children: [
      {
        type: "group",
        name: "Cost of Services",
        classification: "Expense",
        children: [
          { type: "ledger", name: "Salaries & Allowances - COS", classification: "Expense" },
          { type: "ledger", name: "Festival & Incentive Bonus - COS", classification: "Expense" },
          { type: "ledger", name: "Cost of Service Rendered - COS", classification: "Expense" },
        ],
      },
      {
        type: "group",
        name: "Selling, Marketing & Distribution Expenses",
        classification: "Expense",
        children: [
          { type: "ledger", name: "Salaries & Allowances - SD", classification: "Expense" },
          { type: "ledger", name: "Domestic Travel/Daily Allowances - SD", classification: "Expense" },
          { type: "ledger", name: "Festival & Incentive Bonus - SD", classification: "Expense" },
          { type: "ledger", name: "Media & Advertisement", classification: "Expense" },
          { type: "ledger", name: "Seminar, Workshop, Meeting & Events - SD", classification: "Expense" },
        ],
      },
      {
        type: "group",
        name: "General & Administrative Expenses",
        classification: "Expense",
        children: [
          { type: "ledger", name: "Salaries & Allowances - AD", classification: "Expense" },
          { type: "ledger", name: "Festival & Incentive Bonus - AD", classification: "Expense" },
          { type: "ledger", name: "Office Rent", classification: "Expense" },
          { type: "ledger", name: "Office Service Charge", classification: "Expense" },
          {
            type: "group",
            name: "Utility Bill",
            classification: "Expense",
            children: [
              { type: "ledger", name: "Electricity Expense", classification: "Expense" },
              { type: "ledger", name: "WASA Expense", classification: "Expense" },
              { type: "ledger", name: "Gas Expense", classification: "Expense" },
            ],
          },
          { type: "ledger", name: "Staff Accomodation Rent", classification: "Expense" },
          { type: "ledger", name: "Internet Bill", classification: "Expense" },
          { type: "ledger", name: "Lunch for Staff", classification: "Expense" },
          { type: "ledger", name: "Stationeries & Supplies", classification: "Expense" },
          { type: "ledger", name: "Repair & Maintenance", classification: "Expense" },
          { type: "ledger", name: "Printing & Photocopy", classification: "Expense" },
          { type: "ledger", name: "Registration & Renewal", classification: "Expense" },
          { type: "ledger", name: "Seminar, Workshop, Meeting & Events - AD", classification: "Expense" },
          { type: "ledger", name: "Domestic Travel/Daily Allowances - AD", classification: "Expense" },
          { type: "ledger", name: "Mobile Phone Bill", classification: "Expense" },
          { type: "ledger", name: "Postal & Courier Charges", classification: "Expense" },
          { type: "ledger", name: "Insurance Premium", classification: "Expense" },
          { type: "ledger", name: "Legal & Professional Fees", classification: "Expense" },
          { type: "ledger", name: "Office General Expenses", classification: "Expense" },
          { type: "ledger", name: "Audit Fee", classification: "Expense" },
          { type: "ledger", name: "Bank Charge", classification: "Expense" },
          { type: "ledger", name: "Depreciation on Computer & Peripherals", classification: "Expense" },
          { type: "ledger", name: "Depreciation on Office Equipments", classification: "Expense" },
          {
            type: "ledger",
            name: "Depreciation on Leasehold Improvements",
            classification: "Expense",
          },
          { type: "ledger", name: "Income Tax Expenses", classification: "Expense" },
          {
            type: "group",
            name: "Income Tax",
            classification: "Expense",
            children: [{ type: "ledger", name: "Income Tax Expenses", classification: "Expense" }],
          },
        ],
      },
    ],
  },
]);

const groupForm = document.querySelector("#coaGroupForm");
const ledgerForm = document.querySelector("#coaLedgerForm");
const groupNameInput = document.querySelector("#coaGroupName");
const groupCodeInput = document.querySelector("#coaGroupCode");
const groupClassificationSelect = document.querySelector("#coaGroupClassification");
const groupParentSelect = document.querySelector("#coaGroupParent");
const groupNameHistory = document.querySelector("#coaGroupNameHistory");
const groupCodeHistory = document.querySelector("#coaGroupCodeHistory");
const groupNameSuggestions = document.querySelector("#coaGroupNameSuggestions");
const ledgerNameInput = document.querySelector("#coaLedgerName");
const ledgerCodeInput = document.querySelector("#coaLedgerCode");
const ledgerClassificationSelect = document.querySelector("#coaLedgerClassification");
const ledgerParentSelect = document.querySelector("#coaLedgerParent");
const ledgerBalanceDateInput = document.querySelector("#coaLedgerBalanceDate");
const ledgerBalanceAmountInput = document.querySelector("#coaLedgerBalanceAmount");
const ledgerBalanceSideSelect = document.querySelector("#coaLedgerBalanceSide");
const ledgerNameHistory = document.querySelector("#coaLedgerNameHistory");
const ledgerCodeHistory = document.querySelector("#coaLedgerCodeHistory");
const ledgerNameSuggestions = document.querySelector("#coaLedgerNameSuggestions");
const treeElement = document.querySelector("#coaTree");
const rootDropZone = document.querySelector("#coaRootDrop");
const statusElement = document.querySelector("#coaStatus");
const groupCountElement = document.querySelector("#coaGroupCount");
const ledgerCountElement = document.querySelector("#coaLedgerCount");
const defaultButton = document.querySelector("#coaDefaultButton");
const successToast = document.querySelector("#coaSuccessToast");
const editModal = document.querySelector("#coaEditModal");
const editNameInput = document.querySelector("#coaEditNameInput");
const editCodeInput = document.querySelector("#coaEditCodeInput");
const editClassificationSelect = document.querySelector("#coaEditClassification");
const editParentSelect = document.querySelector("#coaEditParent");
const editBalanceFields = document.querySelector("#coaEditBalanceFields");
const editBalanceDateInput = document.querySelector("#coaEditBalanceDate");
const editBalanceAmountInput = document.querySelector("#coaEditBalanceAmount");
const editBalanceSideSelect = document.querySelector("#coaEditBalanceSide");
const editCancelButton = document.querySelector("#coaEditCancel");
const editSaveButton = document.querySelector("#coaEditSave");
const deleteModal = document.querySelector("#coaDeleteModal");
const deleteMessage = document.querySelector("#coaDeleteMessage");
const deleteCancelButton = document.querySelector("#coaDeleteCancel");
const deleteConfirmButton = document.querySelector("#coaDeleteConfirm");

let chartItems = [];
let draggedNodeId = "";
let saveTimer = 0;
let toastTimer = 0;
let didRestoreFormDraft = false;
let collapsedGroupIds = new Set(safeParseArray(localStorage.getItem(COLLAPSED_GROUPS_STORAGE_KEY)));
let pendingEditNodeId = "";
let pendingDeleteNodeId = "";
let canManageDefaultTemplate = false;
let profileNumberFormat = "1,23,456.78";
let activeNameSuggestion = {
  input: null,
  panel: null,
  items: [],
  index: -1,
};

function createId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return String(Date.now()) + Math.random().toString(36).slice(2);
}

function safeParseArray(value) {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function safeParseObject(value) {
  try {
    const parsed = JSON.parse(value || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function parseAmount(value) {
  return Number.parseFloat(String(value || "").replace(/,/g, "").replace(/[^\d.-]/g, "")) || 0;
}

function getNumberLocale() {
  return profileNumberFormat === "123,456.78" ? "en-US" : "en-IN";
}

function formatProfileAmount(value) {
  const amount = Math.abs(parseAmount(value));

  if (amount < 0.005) {
    return "";
  }

  return new Intl.NumberFormat(getNumberLocale(), {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatRawAmountForEdit(value) {
  const amount = Math.abs(parseAmount(value));
  return amount < 0.005 ? "" : amount.toFixed(2);
}

async function loadProfileNumberFormat() {
  if (!window.BanikAuth || typeof window.BanikAuth.getCurrentUser !== "function") {
    return;
  }

  try {
    const user = await window.BanikAuth.getCurrentUser();
    profileNumberFormat = user && user.numberFormat === "123,456.78" ? "123,456.78" : "1,23,456.78";
    formatBalanceInput(ledgerBalanceAmountInput);
    formatBalanceInput(editBalanceAmountInput);
  } catch {
    profileNumberFormat = "1,23,456.78";
  }
}

function formatBalanceInput(input) {
  if (!input) {
    return;
  }

  input.value = formatProfileAmount(input.value);
}

function unformatBalanceInput(input) {
  if (!input) {
    return;
  }

  input.value = formatRawAmountForEdit(input.value);
  input.select();
}

function normalizeBalanceSide(value) {
  return String(value || "").toLowerCase() === "credit" ? "credit" : "debit";
}

function getSignedOpeningBalance(amount, side) {
  const absoluteAmount = Math.abs(parseAmount(amount));
  return normalizeBalanceSide(side) === "credit" ? -absoluteAmount : absoluteAmount;
}

function getBalanceSideFromAmount(amount, fallbackSide = "debit") {
  const parsedAmount = parseAmount(amount);
  if (parsedAmount < 0) {
    return "credit";
  }
  if (parsedAmount > 0) {
    return "debit";
  }
  return normalizeBalanceSide(fallbackSide);
}

function getBalanceAmountForInput(amount) {
  return formatProfileAmount(amount);
}

function normalizeNode(node) {
  const type = node && node.type === "ledger" ? "ledger" : "group";
  const normalizedNode = {
    id: String((node && node.id) || createId()),
    type,
    name: String((node && node.name) || "").trim(),
    code: String((node && node.code) || "").trim(),
    classification: String((node && node.classification) || "").trim(),
  };

  if (type === "group") {
    normalizedNode.children = normalizeTree((node && node.children) || []);
  } else {
    const openingBalance = parseAmount(node && node.openingBalance);
    normalizedNode.openingBalance = openingBalance;
    normalizedNode.openingBalanceDate = String((node && node.openingBalanceDate) || "").trim();
    normalizedNode.openingBalanceSide = getBalanceSideFromAmount(
      openingBalance,
      node && node.openingBalanceSide
    );
  }

  return normalizedNode;
}

function isDiscardedChartNodeName(name) {
  return String(name || "").trim().toLowerCase() === "asda";
}

function containsDiscardedChartNode(items) {
  return Array.isArray(items) && items.some((item) => {
    if (isDiscardedChartNodeName(item && item.name)) {
      return true;
    }

    return item && item.type === "group" && containsDiscardedChartNode(item.children || []);
  });
}

function normalizeTree(items) {
  return safeParseArray(JSON.stringify(Array.isArray(items) ? items : []))
    .map((item) => normalizeNode(item))
    .filter((item) => item.name && !isDiscardedChartNodeName(item.name));
}

function isSundryReceivablesName(name) {
  return ["sundry receivable", "sundry receivables"].includes(
    String(name || "").trim().toLowerCase()
  );
}

function isCurrentAssetsGroup(node) {
  return (
    node &&
    node.type === "group" &&
    ["current asset", "current assets"].includes(String(node.name || "").trim().toLowerCase())
  );
}

function removeSundryReceivables(items, exceptNode = null) {
  let didRemove = false;

  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index];

    if (item !== exceptNode && isSundryReceivablesName(item.name)) {
      items.splice(index, 1);
      didRemove = true;
      continue;
    }

    if (item.type === "group") {
      didRemove = removeSundryReceivables(item.children || [], exceptNode) || didRemove;
    }
  }

  return didRemove;
}

function findCurrentAssetsGroup(items) {
  for (const item of items) {
    if (isCurrentAssetsGroup(item)) {
      return item;
    }

    if (item.type === "group") {
      const foundGroup = findCurrentAssetsGroup(item.children || []);

      if (foundGroup) {
        return foundGroup;
      }
    }
  }

  return null;
}

function applyChartStructureRules(items) {
  const preparedItems = normalizeTree(items);
  const before = JSON.stringify(preparedItems);
  const currentAssetsGroup = findCurrentAssetsGroup(preparedItems);

  if (currentAssetsGroup) {
    currentAssetsGroup.children = currentAssetsGroup.children || [];
    const existingDirectLedger = currentAssetsGroup.children.find((item) =>
      isSundryReceivablesName(item.name)
    );
    removeSundryReceivables(preparedItems, existingDirectLedger || null);

    const sundryLedger =
      existingDirectLedger || {
        id: createId(),
        type: "ledger",
        name: "Sundry Receivables",
        code: "",
        classification: "Asset",
      };
    sundryLedger.type = "ledger";
    sundryLedger.name = "Sundry Receivables";
    sundryLedger.code = sundryLedger.code || "";
    sundryLedger.classification = "Asset";
    delete sundryLedger.children;
    currentAssetsGroup.children = currentAssetsGroup.children.filter((item) => item !== sundryLedger);

    const advanceGroupIndex = currentAssetsGroup.children.findIndex(
      (item) => item.type === "group" && item.name === "Advance, Deposit & Prepayments"
    );

    if (advanceGroupIndex >= 0) {
      currentAssetsGroup.children.splice(advanceGroupIndex + 1, 0, sundryLedger);
    } else {
      currentAssetsGroup.children.push(sundryLedger);
    }
  } else {
    removeSundryReceivables(preparedItems);
  }

  return {
    items: preparedItems,
    changed: JSON.stringify(preparedItems) !== before,
  };
}

function prepareChartItems(items) {
  return applyChartStructureRules(items).items;
}

function createDefaultChartItems() {
  return prepareChartItems(DEFAULT_CHART_ITEMS);
}

function shouldApplyDefaultChart() {
  return localStorage.getItem(DEFAULT_CHART_VERSION_STORAGE_KEY) !== DEFAULT_CHART_VERSION;
}

function markDefaultChartApplied() {
  localStorage.setItem(DEFAULT_CHART_VERSION_STORAGE_KEY, DEFAULT_CHART_VERSION);
}

async function loadDefaultChartItems() {
  if (window.BanikData && typeof window.BanikData.getDefaultChartOfAccounts === "function") {
    try {
      const sharedItems = prepareChartItems(await window.BanikData.getDefaultChartOfAccounts());

      if (sharedItems.length) {
        return sharedItems;
      }
    } catch {
      // Fall back to the built-in template when the public template is not available.
    }
  }

  return createDefaultChartItems();
}

function setStatus(message, type = "pending") {
  statusElement.textContent = message;
  statusElement.classList.toggle("coa-status--success", type === "success");
  statusElement.classList.toggle("coa-status--error", type === "error");
}

function showSuccessToast(message = "Added") {
  if (!successToast) {
    return;
  }

  successToast.querySelector("strong").textContent = message;
  successToast.setAttribute("aria-hidden", "false");
  successToast.classList.add("is-visible");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    successToast.classList.remove("is-visible");
    successToast.setAttribute("aria-hidden", "true");
  }, 1350);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function readLocalTree() {
  const localTreeResult = applyChartStructureRules(safeParseArray(localStorage.getItem(CHART_STORAGE_KEY)));
  const localTree = localTreeResult.items;

  if (localTree.length) {
    if (localTreeResult.changed) {
      localStorage.setItem(CHART_STORAGE_KEY, JSON.stringify(localTree));
    }

    return localTree;
  }

  const legacyLedgers = safeParseArray(localStorage.getItem(LEDGER_STORAGE_KEY))
    .map((ledger) => {
      if (typeof ledger === "string") {
        return ledger.trim();
      }

      return String(
        (ledger && (ledger.name || ledger.ledgerName || ledger.accountName || ledger.title)) || ""
      ).trim();
    })
    .filter(Boolean);

  if (!legacyLedgers.length) {
    return [];
  }

  return [
    {
      id: createId(),
      type: "group",
      name: "Unassigned Ledgers",
      code: "",
      children: legacyLedgers.map((name) => ({
        id: createId(),
        type: "ledger",
        name,
        code: "",
        classification: "",
      })),
    },
  ];
}

function flattenGroups(items, level = 0, groups = []) {
  items.forEach((item) => {
    if (item.type !== "group") {
      return;
    }

    groups.push({
      id: item.id,
      name: item.name,
      code: item.code,
      level,
    });
    flattenGroups(item.children || [], level + 1, groups);
  });

  return groups;
}

function flattenLedgers(items, path = [], ledgers = []) {
  items.forEach((item) => {
    if (item.type === "ledger") {
      ledgers.push({
        id: item.id,
        name: item.name,
        ledgerName: item.name,
        code: item.code,
        classification: item.classification || "",
        openingBalance: parseAmount(item.openingBalance),
        openingBalanceDate: item.openingBalanceDate || "",
        openingBalanceSide: getBalanceSideFromAmount(item.openingBalance, item.openingBalanceSide),
        groupPath: path.join(" > "),
      });
      return;
    }

    flattenLedgers(item.children || [], [...path, item.name], ledgers);
  });

  return ledgers;
}

function flattenNodesByType(items, nodeType, values = []) {
  items.forEach((item) => {
    if (item.type === nodeType) {
      values.push(item);
    }

    if (item.type === "group") {
      flattenNodesByType(item.children || [], nodeType, values);
    }
  });

  return values;
}

function flattenNameSuggestions(items, nodeType, path = [], level = 0, suggestions = []) {
  items.forEach((item) => {
    const nextPath = [...path, item.name];

    if (item.type === nodeType) {
      suggestions.push({
        name: item.name,
        code: item.code || "",
        classification: item.classification || "",
        level,
        path: path.join(" > "),
        fullPath: nextPath.join(" > "),
        type: item.type,
      });
    }

    if (item.type === "group") {
      flattenNameSuggestions(item.children || [], nodeType, nextPath, level + 1, suggestions);
    }
  });

  return suggestions;
}

function countItems(items) {
  return items.reduce(
    (totals, item) => {
      if (item.type === "ledger") {
        totals.ledgers += 1;
        return totals;
      }

      totals.groups += 1;
      const childTotals = countItems(item.children || []);
      totals.groups += childTotals.groups;
      totals.ledgers += childTotals.ledgers;
      return totals;
    },
    { groups: 0, ledgers: 0 }
  );
}

function findNode(items, nodeId) {
  for (const item of items) {
    if (item.id === nodeId) {
      return item;
    }

    if (item.type === "group") {
      const foundNode = findNode(item.children || [], nodeId);
      if (foundNode) {
        return foundNode;
      }
    }
  }

  return null;
}

function findParentId(items, nodeId, parentId = "") {
  for (const item of items) {
    if (item.id === nodeId) {
      return parentId;
    }

    if (item.type === "group") {
      const foundParentId = findParentId(item.children || [], nodeId, item.id);
      if (foundParentId !== null) {
        return foundParentId;
      }
    }
  }

  return null;
}

function removeNode(items, nodeId) {
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];

    if (item.id === nodeId) {
      return items.splice(index, 1)[0];
    }

    if (item.type === "group") {
      const removedNode = removeNode(item.children || [], nodeId);
      if (removedNode) {
        return removedNode;
      }
    }
  }

  return null;
}

function containsNode(node, nodeId) {
  if (!node || node.type !== "group") {
    return false;
  }

  return (node.children || []).some((child) => child.id === nodeId || containsNode(child, nodeId));
}

function isGroupOptionAllowed(group, editingNode) {
  if (!editingNode) {
    return true;
  }

  if (group.id === editingNode.id) {
    return false;
  }

  return !containsNode(editingNode, group.id);
}

function hasDuplicateName(name, excludeId = "") {
  const normalizedName = String(name || "").trim().toLowerCase();

  function scan(items) {
    return items.some((item) => {
      if (item.id !== excludeId && item.name.trim().toLowerCase() === normalizedName) {
        return true;
      }

      return item.type === "group" && scan(item.children || []);
    });
  }

  return scan(chartItems);
}

function persistLocal() {
  localStorage.setItem(CHART_STORAGE_KEY, JSON.stringify(chartItems));
  localStorage.setItem(LEDGER_STORAGE_KEY, JSON.stringify(flattenLedgers(chartItems)));
}

function persistCollapsedGroups() {
  localStorage.setItem(COLLAPSED_GROUPS_STORAGE_KEY, JSON.stringify([...collapsedGroupIds]));
}

function getFormHistory() {
  const history = safeParseObject(localStorage.getItem(FORM_HISTORY_STORAGE_KEY));
  const cleanHistory = {
    groupNames: uniqueValues(Array.isArray(history.groupNames) ? history.groupNames : []).filter(
      (name) => !isDiscardedChartNodeName(name)
    ),
    groupCodes: uniqueValues(Array.isArray(history.groupCodes) ? history.groupCodes : []),
    ledgerNames: uniqueValues(Array.isArray(history.ledgerNames) ? history.ledgerNames : []).filter(
      (name) => !isDiscardedChartNodeName(name)
    ),
    ledgerCodes: uniqueValues(Array.isArray(history.ledgerCodes) ? history.ledgerCodes : []),
  };

  if (JSON.stringify(history) !== JSON.stringify(cleanHistory)) {
    localStorage.setItem(FORM_HISTORY_STORAGE_KEY, JSON.stringify(cleanHistory));
  }

  return cleanHistory;
}

function uniqueValues(values) {
  const seen = new Set();

  return values
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .filter((value) => {
      const key = value.toLowerCase();

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    })
    .slice(0, 80);
}

function saveFormHistory(updates = {}) {
  const currentHistory = getFormHistory();
  const nextHistory = {
    groupNames: uniqueValues([...(updates.groupNames || []), ...currentHistory.groupNames]).filter(
      (name) => !isDiscardedChartNodeName(name)
    ),
    groupCodes: uniqueValues([...(updates.groupCodes || []), ...currentHistory.groupCodes]),
    ledgerNames: uniqueValues([...(updates.ledgerNames || []), ...currentHistory.ledgerNames]).filter(
      (name) => !isDiscardedChartNodeName(name)
    ),
    ledgerCodes: uniqueValues([...(updates.ledgerCodes || []), ...currentHistory.ledgerCodes]),
  };

  localStorage.setItem(FORM_HISTORY_STORAGE_KEY, JSON.stringify(nextHistory));
  renderFormHistory();
}

function renderDatalist(datalist, values) {
  datalist.innerHTML = "";
  uniqueValues(values).forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    datalist.append(option);
  });
}

function getRecentNameSuggestions(nodeType) {
  const history = getFormHistory();
  const chartSuggestions = flattenNameSuggestions(chartItems, nodeType);
  const seen = new Set(chartSuggestions.map((item) => item.name.trim().toLowerCase()));
  const historyValues = nodeType === "group" ? history.groupNames : history.ledgerNames;

  return uniqueValues(historyValues)
    .filter((name) => !seen.has(name.toLowerCase()))
    .map((name) => ({
      name,
      level: 0,
      type: nodeType,
      isSelectable: true,
      isRecent: true,
    }));
}

function matchesNameSuggestion(item, path, query) {
  if (!query) {
    return true;
  }

  return [item.name, item.code, item.classification, path.join(" ")]
    .join(" ")
    .toLowerCase()
    .includes(query);
}

function hideNameSuggestions(panel, input) {
  if (!panel || panel.hidden) {
    return;
  }

  panel.hidden = true;
  panel.innerHTML = "";
  if (input) {
    input.setAttribute("aria-expanded", "false");
  }

  if (activeNameSuggestion.panel === panel) {
    activeNameSuggestion = {
      input: null,
      panel: null,
      items: [],
      index: -1,
    };
  }
}

function setActiveNameSuggestion(index) {
  const { panel, items } = activeNameSuggestion;

  if (!panel || !items.length) {
    return;
  }

  const boundedIndex = Math.max(0, Math.min(index, items.length - 1));
  activeNameSuggestion.index = boundedIndex;
  [...panel.querySelectorAll(".coa-name-suggestions__option")].forEach((option) => {
    const optionIndex = Number(option.dataset.index);
    const isActive = optionIndex === boundedIndex;
    option.classList.toggle("is-active", isActive);
    option.setAttribute("aria-selected", isActive ? "true" : "false");

    if (isActive) {
      option.scrollIntoView({ block: "nearest" });
    }
  });
}

function applyNameSuggestion(input, panel, row) {
  if (!row || !row.isSelectable) {
    return;
  }

  input.value = row.name;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  hideNameSuggestions(panel, input);
  input.focus();
}

function buildNameSuggestionRows(items, nodeType, query = "", path = [], level = 0) {
  const rows = [];

  items.forEach((item) => {
    const nextPath = [...path, item.name];

    if (item.type === "group") {
      const childRows = buildNameSuggestionRows(item.children || [], nodeType, query, nextPath, level + 1);
      const isGroupSuggestion = nodeType === "group";
      const isMatchedGroup = isGroupSuggestion && matchesNameSuggestion(item, nextPath, query);
      const shouldShowGroup = !query || isMatchedGroup || childRows.length;

      if (shouldShowGroup) {
        rows.push({
          id: item.id,
          name: item.name,
          type: "group",
          level,
          isSelectable: isGroupSuggestion,
          isMainGroup: level === 0,
        });
        rows.push(...childRows);
      }

      return;
    }

    if (nodeType === "ledger" && matchesNameSuggestion(item, nextPath, query)) {
      rows.push({
        id: item.id,
        name: item.name,
        type: "ledger",
        level,
        isSelectable: true,
      });
    }
  });

  return rows;
}

function getNameSuggestionRows(nodeType, query) {
  const rows = buildNameSuggestionRows(chartItems, nodeType, query);
  const recentRows = getRecentNameSuggestions(nodeType)
    .filter((row) => !query || row.name.toLowerCase().includes(query))
    .map((row) => ({
      ...row,
      type: nodeType,
      level: 0,
    }));

  return [...rows, ...recentRows].slice(0, 180);
}

function showNameSuggestions(input, panel, nodeType) {
  if (!input || !panel) {
    return;
  }

  const query = input.value.trim().toLowerCase();
  const rows = getNameSuggestionRows(nodeType, query);

  panel.innerHTML = "";

  if (!rows.length) {
    const empty = document.createElement("div");
    empty.className = "coa-name-suggestions__empty";
    empty.textContent = "No matching saved names.";
    panel.append(empty);
    panel.hidden = false;
    input.setAttribute("aria-expanded", "true");
    activeNameSuggestion = { input, panel, items: [], index: -1 };
    return;
  }

  const selectableRows = rows.filter((row) => row.isSelectable);

  rows.forEach((row) => {
    const option = document.createElement("div");
    option.className = [
      "coa-name-suggestions__option",
      `coa-name-suggestions__option--${row.type}`,
      row.isMainGroup ? "coa-name-suggestions__option--main" : "",
      row.isRecent ? "coa-name-suggestions__option--recent" : "",
      row.isSelectable ? "" : "is-muted",
    ]
      .filter(Boolean)
      .join(" ");
    option.setAttribute("role", row.isSelectable ? "option" : "presentation");
    option.setAttribute("aria-selected", "false");
    option.style.setProperty("--coa-suggestion-indent", `${Math.min(row.level, 8) * 18}px`);
    option.innerHTML = `
      <span class="coa-name-suggestions__name">${escapeHtml(row.name)}</span>
    `;

    if (row.isSelectable) {
      const selectableIndex = selectableRows.findIndex((selectableRow) => selectableRow === row);
      option.dataset.index = String(selectableIndex);
      option.addEventListener("mousedown", (event) => {
        event.preventDefault();
        applyNameSuggestion(input, panel, row);
      });
    }

    panel.append(option);
  });

  panel.hidden = false;
  input.setAttribute("aria-expanded", "true");
  activeNameSuggestion = { input, panel, items: selectableRows, index: -1 };
}

function handleNameSuggestionKeydown(event, input, panel, nodeType) {
  if (event.key === "ArrowDown") {
    event.preventDefault();
    if (panel.hidden) {
      showNameSuggestions(input, panel, nodeType);
    }
    setActiveNameSuggestion(activeNameSuggestion.index + 1);
    return;
  }

  if (event.key === "ArrowUp") {
    event.preventDefault();
    if (panel.hidden) {
      showNameSuggestions(input, panel, nodeType);
    }
    setActiveNameSuggestion(activeNameSuggestion.index <= 0 ? activeNameSuggestion.items.length - 1 : activeNameSuggestion.index - 1);
    return;
  }

  if (event.key === "Enter" && !panel.hidden && activeNameSuggestion.index >= 0) {
    event.preventDefault();
    applyNameSuggestion(input, panel, activeNameSuggestion.items[activeNameSuggestion.index]);
    return;
  }

  if (event.key === "Escape") {
    hideNameSuggestions(panel, input);
  }
}

function setupNameSuggestions(input, panel, nodeType) {
  input.addEventListener("focus", () => showNameSuggestions(input, panel, nodeType));
  input.addEventListener("click", () => showNameSuggestions(input, panel, nodeType));
  input.addEventListener("input", () => showNameSuggestions(input, panel, nodeType));
  input.addEventListener("keydown", (event) => handleNameSuggestionKeydown(event, input, panel, nodeType));
  input.addEventListener("blur", () => {
    window.setTimeout(() => hideNameSuggestions(panel, input), 140);
  });
}

function refreshOpenNameSuggestions() {
  if (!activeNameSuggestion.input || !activeNameSuggestion.panel || activeNameSuggestion.panel.hidden) {
    return;
  }

  const nodeType = activeNameSuggestion.input === groupNameInput ? "group" : "ledger";
  showNameSuggestions(activeNameSuggestion.input, activeNameSuggestion.panel, nodeType);
}

function renderFormHistory() {
  const history = getFormHistory();
  const groups = flattenNodesByType(chartItems, "group");
  const ledgers = flattenNodesByType(chartItems, "ledger");

  renderDatalist(
    groupNameHistory,
    [...groups.map((group) => group.name), ...history.groupNames]
  );
  renderDatalist(
    groupCodeHistory,
    [...groups.map((group) => group.code), ...history.groupCodes]
  );
  renderDatalist(
    ledgerNameHistory,
    [...ledgers.map((ledger) => ledger.name), ...history.ledgerNames]
  );
  renderDatalist(
    ledgerCodeHistory,
    [...ledgers.map((ledger) => ledger.code), ...history.ledgerCodes]
  );
  refreshOpenNameSuggestions();
}

function getFormDraft() {
  const draft = safeParseObject(localStorage.getItem(FORM_DRAFT_STORAGE_KEY));

  return {
    group: {
      name: String((draft.group && draft.group.name) || ""),
      code: String((draft.group && draft.group.code) || ""),
      classification: String((draft.group && draft.group.classification) || ""),
      parentId: String((draft.group && draft.group.parentId) || ""),
    },
    ledger: {
      name: String((draft.ledger && draft.ledger.name) || ""),
      code: String((draft.ledger && draft.ledger.code) || ""),
      classification: String((draft.ledger && draft.ledger.classification) || ""),
      parentId: String((draft.ledger && draft.ledger.parentId) || ""),
      openingBalanceDate: String((draft.ledger && draft.ledger.openingBalanceDate) || ""),
      openingBalanceAmount: String((draft.ledger && draft.ledger.openingBalanceAmount) || ""),
      openingBalanceSide: normalizeBalanceSide(draft.ledger && draft.ledger.openingBalanceSide),
    },
  };
}

function persistFormDraft() {
  const draft = {
    group: {
      name: groupNameInput.value,
      code: groupCodeInput.value,
      classification: groupClassificationSelect.value,
      parentId: groupParentSelect.value,
    },
    ledger: {
      name: ledgerNameInput.value,
      code: ledgerCodeInput.value,
      classification: ledgerClassificationSelect.value,
      parentId: ledgerParentSelect.value,
      openingBalanceDate: ledgerBalanceDateInput.value,
      openingBalanceAmount: ledgerBalanceAmountInput.value,
      openingBalanceSide: ledgerBalanceSideSelect.value,
    },
  };

  localStorage.setItem(FORM_DRAFT_STORAGE_KEY, JSON.stringify(draft));
}

function setSelectIfOptionExists(select, value) {
  const hasOption = [...select.options].some((option) => option.value === value);
  select.value = hasOption ? value : "";
}

function restoreFormDraft() {
  if (didRestoreFormDraft) {
    return;
  }

  const draft = getFormDraft();

  groupNameInput.value = draft.group.name;
  groupCodeInput.value = draft.group.code;
  setSelectIfOptionExists(groupClassificationSelect, draft.group.classification);
  setSelectIfOptionExists(groupParentSelect, draft.group.parentId);
  ledgerNameInput.value = draft.ledger.name;
  ledgerCodeInput.value = draft.ledger.code;
  setSelectIfOptionExists(ledgerClassificationSelect, draft.ledger.classification);
  setSelectIfOptionExists(ledgerParentSelect, draft.ledger.parentId);
  ledgerBalanceDateInput.value = draft.ledger.openingBalanceDate;
  ledgerBalanceAmountInput.value = draft.ledger.openingBalanceAmount;
  ledgerBalanceSideSelect.value = draft.ledger.openingBalanceSide;
  formatBalanceInput(ledgerBalanceAmountInput);
  didRestoreFormDraft = true;
}

async function persistRemote() {
  if (!window.BanikData || typeof window.BanikData.saveChartOfAccounts !== "function") {
    setStatus("Saved in this browser. Backend sync is not available on this page.", "success");
    return;
  }

  try {
    await window.BanikData.saveChartOfAccounts(chartItems);
    const didSyncDefault = await syncDefaultTemplate(true);
    setStatus(
      `Saved. Journal Entry ledger dropdown is updated.${didSyncDefault ? " Default template updated." : ""}`,
      "success"
    );
  } catch (error) {
    setStatus(error.message || "Saved locally, but backend sync failed.", "error");
  }
}

function saveChart() {
  persistLocal();
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(persistRemote, 250);
}

async function revealDefaultTemplateButton() {
  if (!defaultButton || !window.BanikAuth || typeof window.BanikAuth.getCurrentUser !== "function") {
    return;
  }

  try {
    const user = await window.BanikAuth.getCurrentUser();
    canManageDefaultTemplate = !!(user && user.role === "admin");
    defaultButton.hidden = !canManageDefaultTemplate;
  } catch {
    canManageDefaultTemplate = false;
    defaultButton.hidden = true;
  }
}

async function syncDefaultTemplate(silent = false) {
  if (
    !canManageDefaultTemplate ||
    !window.BanikData ||
    typeof window.BanikData.saveDefaultChartOfAccounts !== "function"
  ) {
    return false;
  }

  try {
    await window.BanikData.saveDefaultChartOfAccounts(chartItems);
    return true;
  } catch (error) {
    if (!silent) {
      setStatus(error.message || "Could not save default chart template.", "error");
    }
    return false;
  }
}

async function saveCurrentChartAsDefault() {
  if (!defaultButton || !window.BanikData || typeof window.BanikData.saveDefaultChartOfAccounts !== "function") {
    setStatus("Default template sync is not available.", "error");
    return;
  }

  defaultButton.disabled = true;
  defaultButton.textContent = "Saving...";

  try {
    const didSyncDefault = await syncDefaultTemplate(false);

    if (didSyncDefault) {
      markDefaultChartApplied();
      showSuccessToast("Default saved");
      setStatus("This structure is now the default for new users.", "success");
    }
  } catch (error) {
    setStatus(error.message || "Could not save default chart template.", "error");
  } finally {
    defaultButton.disabled = false;
    defaultButton.textContent = "Set as default";
  }
}

function updateParentSelects() {
  const groups = flattenGroups(chartItems);
  const selects = [groupParentSelect, ledgerParentSelect];

  selects.forEach((select) => {
    const selectedValue = select.value;

    select.innerHTML = "";
    select.append(new Option("Top level", ""));
    groups.forEach((group) => {
      const indent = " ".repeat(group.level * 4);
      const label = `${indent}${group.code ? `${group.code} - ` : ""}${group.name}`;
      select.append(new Option(label, group.id));
    });

    select.value = groups.some((group) => group.id === selectedValue) ? selectedValue : "";
  });
}

function populateParentSelect(select, selectedValue = "", editingNode = null) {
  const groups = flattenGroups(chartItems).filter((group) => isGroupOptionAllowed(group, editingNode));

  select.innerHTML = "";
  select.append(new Option("Top level", ""));
  groups.forEach((group) => {
    const indent = " ".repeat(group.level * 4);
    const label = `${indent}${group.code ? `${group.code} - ` : ""}${group.name}`;
    select.append(new Option(label, group.id));
  });

  select.value = groups.some((group) => group.id === selectedValue) ? selectedValue : "";
}

function createNodeMeta(node, level) {
  const metaParts = [node.type === "group" ? "Group" : "Ledger"];

  if (node.code) {
    metaParts.push(node.code);
  }

  if (node.classification) {
    metaParts.push(node.classification);
  }

  if (level > 0) {
    metaParts.push(`Layer ${level + 1}`);
  }

  if (node.type === "ledger" && Math.abs(parseAmount(node.openingBalance)) >= 0.005) {
    const side = getBalanceSideFromAmount(node.openingBalance, node.openingBalanceSide) === "credit" ? "Cr" : "Dr";
    metaParts.push(`Opening ${Math.abs(parseAmount(node.openingBalance)).toLocaleString("en-BD")} ${side}`);
  }

  return metaParts.join(" / ");
}

function toggleGroup(nodeId) {
  const escapedNodeId =
    window.CSS && typeof window.CSS.escape === "function"
      ? window.CSS.escape(nodeId)
      : String(nodeId).replace(/"/g, '\\"');
  const childrenElement = document.querySelector(`.coa-children[data-parent-id="${escapedNodeId}"]`);

  if (!childrenElement) {
    if (collapsedGroupIds.has(nodeId)) {
      collapsedGroupIds.delete(nodeId);
    } else {
      collapsedGroupIds.add(nodeId);
    }

    persistCollapsedGroups();
    renderTree();
    return;
  }

  if (collapsedGroupIds.has(nodeId)) {
    collapsedGroupIds.delete(nodeId);
    persistCollapsedGroups();
    childrenElement.hidden = false;
    childrenElement.classList.remove("is-collapsed");
    const toggleButton = document.querySelector(`[data-action="toggle"][data-node-id="${escapedNodeId}"]`);

    if (toggleButton) {
      toggleButton.textContent = "-";
      toggleButton.setAttribute("aria-label", toggleButton.getAttribute("aria-label").replace("Expand", "Collapse"));
    }
  } else {
    collapsedGroupIds.add(nodeId);
    persistCollapsedGroups();
    childrenElement.classList.add("is-collapsed");
    const toggleButton = document.querySelector(`[data-action="toggle"][data-node-id="${escapedNodeId}"]`);

    if (toggleButton) {
      toggleButton.textContent = "+";
      toggleButton.setAttribute("aria-label", toggleButton.getAttribute("aria-label").replace("Collapse", "Expand"));
    }

    window.setTimeout(() => {
      if (collapsedGroupIds.has(nodeId)) {
        childrenElement.hidden = true;
      }
    }, 380);
  }
}

function buildNodeElement(node, level = 0) {
  const nodeElement = document.createElement("article");
  nodeElement.className = `coa-node coa-node--${node.type}`;
  nodeElement.dataset.nodeId = node.id;
  nodeElement.dataset.nodeType = node.type;
  nodeElement.draggable = true;

  const header = document.createElement("div");
  header.className = "coa-node-bar";
  const isGroup = node.type === "group";
  const isCollapsed = isGroup && collapsedGroupIds.has(node.id);

  if (isGroup) {
    header.dataset.parentId = node.id;
  }

  header.innerHTML = `
    ${
      isGroup
        ? `<button
            class="coa-tree-toggle"
            type="button"
            data-action="toggle"
            data-node-id="${escapeHtml(node.id)}"
            aria-label="${isCollapsed ? "Expand" : "Collapse"} ${escapeHtml(node.name)}"
          >${isCollapsed ? "+" : "-"}</button>`
        : '<span class="coa-tree-toggle coa-tree-toggle--spacer" aria-hidden="true"></span>'
    }
    <span class="coa-drag-grip" aria-hidden="true">::</span>
    <div class="coa-node-title">
      <strong>${escapeHtml(node.name)}</strong>
      <span>${escapeHtml(createNodeMeta(node, level))}</span>
    </div>
    <span class="coa-action-line" aria-hidden="true"></span>
    <div class="coa-node-actions">
      <button type="button" data-action="rename" data-node-id="${escapeHtml(node.id)}">Edit</button>
      <button type="button" data-action="delete" data-node-id="${escapeHtml(node.id)}">Delete</button>
    </div>
  `;
  nodeElement.append(header);

  if (isGroup) {
    const children = document.createElement("div");
    children.className = "coa-children";
    children.dataset.parentId = node.id;

    if ((node.children || []).length) {
      node.children.forEach((child) => {
        children.append(buildNodeElement(child, level + 1));
      });
    } else {
      const empty = document.createElement("div");
      empty.className = "coa-empty-drop";
      empty.textContent = "Drop ledgers or groups here";
      children.append(empty);
    }

    if (isCollapsed) {
      children.classList.add("is-collapsed");
      children.hidden = true;
    }

    nodeElement.append(children);
  }

  return nodeElement;
}

function renderTree() {
  updateParentSelects();
  renderFormHistory();
  const totals = countItems(chartItems);

  groupCountElement.textContent = totals.groups.toLocaleString("en-IN");
  ledgerCountElement.textContent = totals.ledgers.toLocaleString("en-IN");
  treeElement.innerHTML = "";

  if (!chartItems.length) {
    const empty = document.createElement("div");
    empty.className = "coa-tree-empty";
    empty.textContent = "No groups or ledgers yet. Create a group or ledger to start.";
    treeElement.append(empty);
    return;
  }

  const fragment = document.createDocumentFragment();
  chartItems.forEach((item) => {
    fragment.append(buildNodeElement(item));
  });
  treeElement.append(fragment);
}

function insertUnderParent(node, parentId) {
  if (!parentId) {
    chartItems.push(node);
    return true;
  }

  const parentNode = findNode(chartItems, parentId);

  if (!parentNode || parentNode.type !== "group") {
    return false;
  }

  parentNode.children = parentNode.children || [];
  parentNode.children.push(node);
  return true;
}

function moveNode(nodeId, parentId) {
  if (!nodeId || nodeId === parentId) {
    return;
  }

  const movingNode = findNode(chartItems, nodeId);

  if (!movingNode) {
    return;
  }

  if (containsNode(movingNode, parentId)) {
    setStatus("A parent group cannot be moved under its own child.", "error");
    return;
  }

  const removedNode = removeNode(chartItems, nodeId);

  if (!removedNode) {
    return;
  }

  const inserted = insertUnderParent(removedNode, parentId);

  if (!inserted) {
    chartItems.push(removedNode);
  }

  renderTree();
  saveChart();
}

function addGroup(event) {
  event.preventDefault();

  const name = groupNameInput.value.trim();
  const code = groupCodeInput.value.trim();
  const classification = groupClassificationSelect.value.trim();

  if (!name) {
    setStatus("Group name is required.", "error");
    groupNameInput.focus();
    return;
  }

  if (hasDuplicateName(name)) {
    setStatus("Duplicate can't create. This group or ledger name already exists.", "error");
    groupNameInput.focus();
    return;
  }

  insertUnderParent(
    {
      id: createId(),
      type: "group",
      name,
      code,
      classification,
      children: [],
    },
    groupParentSelect.value
  );

  saveFormHistory({
    groupNames: [name],
    groupCodes: [code],
  });
  persistFormDraft();
  renderTree();
  saveChart();
  showSuccessToast("Group added");
  groupNameInput.focus();
  groupNameInput.select();
}

function addLedger(event) {
  event.preventDefault();

  const name = ledgerNameInput.value.trim();
  const code = ledgerCodeInput.value.trim();
  const classification = ledgerClassificationSelect.value.trim();
  const openingBalance = getSignedOpeningBalance(
    ledgerBalanceAmountInput.value,
    ledgerBalanceSideSelect.value
  );

  if (!name) {
    setStatus("Ledger name is required.", "error");
    ledgerNameInput.focus();
    return;
  }

  if (hasDuplicateName(name)) {
    setStatus("Duplicate can't create. This group or ledger name already exists.", "error");
    ledgerNameInput.focus();
    return;
  }

  insertUnderParent(
    {
      id: createId(),
      type: "ledger",
      name,
      code,
      classification,
      openingBalance,
      openingBalanceDate: ledgerBalanceDateInput.value,
      openingBalanceSide: getBalanceSideFromAmount(openingBalance, ledgerBalanceSideSelect.value),
    },
    ledgerParentSelect.value
  );

  saveFormHistory({
    ledgerNames: [name],
    ledgerCodes: [code],
  });
  persistFormDraft();
  renderTree();
  saveChart();
  showSuccessToast("Ledger added");
  ledgerNameInput.focus();
  ledgerNameInput.select();
}

function openEditModal(nodeId) {
  const node = findNode(chartItems, nodeId);

  if (!node) {
    return;
  }

  pendingEditNodeId = nodeId;
  editNameInput.value = node.name;
  editCodeInput.value = node.code || "";
  setSelectIfOptionExists(editClassificationSelect, node.classification || "");
  populateParentSelect(editParentSelect, findParentId(chartItems, nodeId) || "", node);

  if (node.type === "ledger") {
    editBalanceFields.hidden = false;
    editBalanceDateInput.value = node.openingBalanceDate || "";
    editBalanceAmountInput.value = getBalanceAmountForInput(node.openingBalance);
    editBalanceSideSelect.value = getBalanceSideFromAmount(node.openingBalance, node.openingBalanceSide);
  } else {
    editBalanceFields.hidden = true;
    editBalanceDateInput.value = "";
    editBalanceAmountInput.value = "";
    editBalanceSideSelect.value = "debit";
  }

  editModal.hidden = false;
  document.body.classList.add("modal-open");
  window.setTimeout(() => {
    editNameInput.focus();
    editNameInput.select();
  }, 0);
}

function closeEditModal() {
  editModal.hidden = true;
  pendingEditNodeId = "";
  document.body.classList.remove("modal-open");
}

function saveEditModal() {
  const node = findNode(chartItems, pendingEditNodeId);

  if (!node) {
    closeEditModal();
    return;
  }

  const trimmedName = editNameInput.value.trim();
  const code = editCodeInput.value.trim();
  const classification = editClassificationSelect.value.trim();
  const parentId = editParentSelect.value;

  if (!trimmedName) {
    setStatus("Name cannot be blank.", "error");
    editNameInput.focus();
    return;
  }

  if (hasDuplicateName(trimmedName, node.id)) {
    setStatus("Duplicate can't create. This group or ledger name already exists.", "error");
    editNameInput.focus();
    return;
  }

  node.name = trimmedName;
  node.code = code;
  node.classification = classification;

  if (node.type === "ledger") {
    const openingBalance = getSignedOpeningBalance(
      editBalanceAmountInput.value,
      editBalanceSideSelect.value
    );
    node.openingBalance = openingBalance;
    node.openingBalanceDate = editBalanceDateInput.value;
    node.openingBalanceSide = getBalanceSideFromAmount(openingBalance, editBalanceSideSelect.value);
  }

  const currentParentId = findParentId(chartItems, node.id) || "";

  if (parentId !== currentParentId) {
    const movingNode = removeNode(chartItems, node.id);
    if (movingNode) {
      const inserted = insertUnderParent(movingNode, parentId);
      if (!inserted) {
        chartItems.push(movingNode);
      }
    }
  }

  closeEditModal();
  renderTree();
  saveChart();
  showSuccessToast("Updated");
}

function openDeleteModal(nodeId) {
  const node = findNode(chartItems, nodeId);

  if (!node) {
    return;
  }

  const childCount = node.type === "group" ? countItems(node.children || []) : { groups: 0, ledgers: 0 };
  const detail =
    node.type === "group" && (childCount.groups || childCount.ledgers)
      ? ` This will also delete all items under "${node.name}".`
      : "";

  pendingDeleteNodeId = nodeId;
  deleteMessage.textContent = `Are you sure you want to delete this ${node.type}?${detail}`;
  deleteModal.hidden = false;
  document.body.classList.add("modal-open");
}

function closeDeleteModal() {
  deleteModal.hidden = true;
  pendingDeleteNodeId = "";
  document.body.classList.remove("modal-open");
}

function confirmDeleteModal() {
  if (!pendingDeleteNodeId) {
    closeDeleteModal();
    return;
  }

  removeNode(chartItems, pendingDeleteNodeId);
  closeDeleteModal();
  renderTree();
  saveChart();
}

function handleTreeClick(event) {
  const actionButton = event.target.closest("[data-action]");

  if (!actionButton) {
    return;
  }

  const { action, nodeId } = actionButton.dataset;

  if (action === "toggle") {
    toggleGroup(nodeId);
  }

  if (action === "rename") {
    openEditModal(nodeId);
  }

  if (action === "delete") {
    openDeleteModal(nodeId);
  }
}

function clearDropStates() {
  document
    .querySelectorAll(".coa-children.is-drop-target, .coa-root-drop.is-drop-target, .coa-node-bar.is-drop-target")
    .forEach((target) => {
      target.classList.remove("is-drop-target");
    });
}

function getDropTarget(event) {
  return event.target.closest(".coa-node-bar[data-parent-id], .coa-children, .coa-root-drop");
}

function handleDragStart(event) {
  const nodeElement = event.target.closest(".coa-node");

  if (!nodeElement) {
    return;
  }

  draggedNodeId = nodeElement.dataset.nodeId || "";
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", draggedNodeId);
  nodeElement.classList.add("is-dragging");
}

function handleDragEnd() {
  draggedNodeId = "";
  document.querySelectorAll(".coa-node.is-dragging").forEach((node) => {
    node.classList.remove("is-dragging");
  });
  clearDropStates();
}

function handleDragOver(event) {
  const dropTarget = getDropTarget(event);

  if (!dropTarget || !draggedNodeId) {
    return;
  }

  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
  clearDropStates();
  dropTarget.classList.add("is-drop-target");
}

function handleDrop(event) {
  const dropTarget = getDropTarget(event);

  if (!dropTarget) {
    return;
  }

  event.preventDefault();
  const nodeId = event.dataTransfer.getData("text/plain") || draggedNodeId;
  moveNode(nodeId, dropTarget.dataset.parentId || "");
  handleDragEnd();
}

async function loadChart() {
  await loadProfileNumberFormat();
  const localItems = readLocalTree();
  chartItems = localItems.length ? localItems : createDefaultChartItems();
  renderTree();

  if (localItems.length) {
    setStatus("Loaded saved chart from this browser.", "success");
  } else {
    setStatus("Default chart of accounts loaded.", "success");
  }

  await waitForBanikData();
  await revealDefaultTemplateButton();

  if (!window.BanikData || typeof window.BanikData.getChartOfAccounts !== "function") {
    if (!chartItems.length) {
      setStatus("Create your first group or ledger to start.", "pending");
    }
    restoreFormDraft();
    return;
  }

  try {
    const rawRemoteItems = await window.BanikData.getChartOfAccounts();
    const hadDiscardedNodes = containsDiscardedChartNode(rawRemoteItems);
    const remoteTreeResult = applyChartStructureRules(rawRemoteItems);
    const remoteItems = remoteTreeResult.items;

    if (remoteItems.length) {
      chartItems = remoteItems;
      persistLocal();
      markDefaultChartApplied();
      renderTree();
      if (hadDiscardedNodes || remoteTreeResult.changed) {
        await window.BanikData.saveChartOfAccounts(chartItems);
      }
      const didSyncDefault = await syncDefaultTemplate(true);
      setStatus(
        `Loaded saved chart of accounts.${didSyncDefault ? " Default template updated." : ""}`,
        "success"
      );
      restoreFormDraft();
      return;
    }

    chartItems = await loadDefaultChartItems();
    persistLocal();
    markDefaultChartApplied();
    renderTree();
    await window.BanikData.saveChartOfAccounts(chartItems);
    setStatus("Default chart of accounts saved.", "success");
  } catch (error) {
    setStatus(error.message || "Could not load backend chart. Local data is available.", "error");
  }

  restoreFormDraft();
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

groupForm.addEventListener("submit", addGroup);
ledgerForm.addEventListener("submit", addLedger);
[groupNameInput, groupCodeInput, ledgerNameInput, ledgerCodeInput, ledgerBalanceDateInput, ledgerBalanceAmountInput].forEach((input) => {
  input.addEventListener("input", persistFormDraft);
});
[
  groupClassificationSelect,
  groupParentSelect,
  ledgerClassificationSelect,
  ledgerParentSelect,
  ledgerBalanceSideSelect,
].forEach((select) => {
  select.addEventListener("change", persistFormDraft);
});
setupNameSuggestions(groupNameInput, groupNameSuggestions, "group");
setupNameSuggestions(ledgerNameInput, ledgerNameSuggestions, "ledger");
[ledgerBalanceAmountInput, editBalanceAmountInput].forEach((input) => {
  input.classList.add("coa-balance-amount");
  input.addEventListener("focus", () => unformatBalanceInput(input));
  input.addEventListener("blur", () => formatBalanceInput(input));
});
treeElement.addEventListener("click", handleTreeClick);
treeElement.addEventListener("dragstart", handleDragStart);
treeElement.addEventListener("dragend", handleDragEnd);
treeElement.addEventListener("dragover", handleDragOver);
treeElement.addEventListener("drop", handleDrop);
rootDropZone.addEventListener("dragover", handleDragOver);
rootDropZone.addEventListener("drop", handleDrop);
editCancelButton.addEventListener("click", closeEditModal);
editSaveButton.addEventListener("click", saveEditModal);
editNameInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    saveEditModal();
  }
});
deleteCancelButton.addEventListener("click", closeDeleteModal);
deleteConfirmButton.addEventListener("click", confirmDeleteModal);
if (defaultButton) {
  defaultButton.addEventListener("click", saveCurrentChartAsDefault);
}
[editModal, deleteModal].forEach((modal) => {
  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      if (modal === editModal) {
        closeEditModal();
      } else {
        closeDeleteModal();
      }
    }
  });
});
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") {
    return;
  }

  if (!editModal.hidden) {
    closeEditModal();
  }

  if (!deleteModal.hidden) {
    closeDeleteModal();
  }
});

loadChart();
