const STORAGE_KEYS = {
  journals: "banikBooksJournals",
  chartOfAccounts: "banikBooksChartOfAccounts",
  ledgers: "banikBooksLedgers",
};

const fromDateInput = document.querySelector("#financial-position-from");
const toDateInput = document.querySelector("#financial-position-to");
const assetsContainer = document.querySelector("#financial-position-assets");
const equityContainer = document.querySelector("#financial-position-equity");
const liabilitiesContainer = document.querySelector("#financial-position-liabilities");
const reviewSection = document.querySelector("#financial-position-review-section");
const reviewContainer = document.querySelector("#financial-position-review");
const totalAssetsCell = document.querySelector("#financial-position-total-assets");
const totalEquityCell = document.querySelector("#financial-position-total-equity");
const totalLiabilitiesCell = document.querySelector("#financial-position-total-liabilities");
const totalEquityLiabilitiesCell = document.querySelector("#financial-position-total-equity-liabilities");

function safeReadArray(key) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseAmount(value) {
  return Number.parseFloat(String(value || "").replace(/,/g, "").replace(/[^\d.-]/g, "")) || 0;
}

function formatAmount(value) {
  return window.BanikAccounting
    ? window.BanikAccounting.formatNumber(value, { absolute: true })
    : Math.abs(Number(value || 0)).toFixed(2);
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

function normalizeSearchText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function normalizeClassification(value) {
  const normalized = String(value || "").trim().toLowerCase();

  if (normalized === "asset") return "Asset";
  if (normalized === "liability") return "Liability";
  if (normalized === "equity") return "Equity";
  if (normalized === "income") return "Income";
  if (normalized === "expense") return "Expense";

  return "";
}

function getJournalSequence(number) {
  const sequence = Number(String(number || "").split("/").pop());
  return Number.isFinite(sequence) ? sequence : 0;
}

function getSortedJournals() {
  return safeReadArray(STORAGE_KEYS.journals).sort((left, right) => {
    const dateSort = String(left.journalDate || "").localeCompare(String(right.journalDate || ""));
    return dateSort || getJournalSequence(left.number) - getJournalSequence(right.number);
  });
}

function collectLedgerClassifications(items, map = new Map()) {
  if (!Array.isArray(items)) {
    return map;
  }

  items.forEach((item) => {
    if (!item || typeof item !== "object") {
      return;
    }

    if (item.type === "ledger" && item.name) {
      const classification = normalizeClassification(item.classification);
      if (classification) {
        map.set(normalizeSearchText(item.name), classification);
      }
    }

    collectLedgerClassifications(item.children || [], map);
  });

  return map;
}

function getStoredLedgerClassifications(map) {
  safeReadArray(STORAGE_KEYS.ledgers).forEach((ledger) => {
    if (!ledger || typeof ledger !== "object") {
      return;
    }

    const name = ledger.name || ledger.ledgerName || ledger.accountName || ledger.title || "";
    const classification = normalizeClassification(ledger.classification);

    if (name && classification) {
      map.set(normalizeSearchText(name), classification);
    }
  });

  return map;
}

function inferClassification(account) {
  const normalized = normalizeSearchText(account);

  if (/(cash|bank|receivable|advance|deposit|prepayment|asset|equipment|furniture|computer)/.test(normalized)) {
    return "Asset";
  }

  if (/(payable|provision|loan|liability|vat|taxpayable|salarypayable|bonuspayable)/.test(normalized)) {
    return "Liability";
  }

  if (/(capital|equity|retained|sharemoney|drawing)/.test(normalized)) {
    return "Equity";
  }

  if (/(revenue|income|sales|serviceincome)/.test(normalized)) {
    return "Income";
  }

  if (/(expense|cost|rent|salary|allowance|bonus|depreciation|fee|charge|bill|repair|maintenance|printing|travel|insurance)/.test(normalized)) {
    return "Expense";
  }

  return "";
}

function getLedgerClassificationMap() {
  const map = collectLedgerClassifications(safeReadArray(STORAGE_KEYS.chartOfAccounts));
  return getStoredLedgerClassifications(map);
}

function collectLedgerOpeningBalances(items, map = new Map()) {
  if (!Array.isArray(items)) {
    return map;
  }

  items.forEach((item) => {
    if (!item || typeof item !== "object") {
      return;
    }

    if (item.type === "ledger" && item.name) {
      map.set(normalizeSearchText(item.name), {
        account: item.name,
        openingBalance: parseAmount(item.openingBalance),
        openingBalanceDate: String(item.openingBalanceDate || ""),
      });
    }

    collectLedgerOpeningBalances(item.children || [], map);
  });

  return map;
}

function getLedgerOpeningBalanceMap() {
  const map = collectLedgerOpeningBalances(safeReadArray(STORAGE_KEYS.chartOfAccounts));

  safeReadArray(STORAGE_KEYS.ledgers).forEach((ledger) => {
    if (!ledger || typeof ledger !== "object") {
      return;
    }

    const account = ledger.name || ledger.ledgerName || ledger.accountName || ledger.title || "";
    const key = normalizeSearchText(account);

    if (key && !map.has(key)) {
      map.set(key, {
        account,
        openingBalance: parseAmount(ledger.openingBalance),
        openingBalanceDate: String(ledger.openingBalanceDate || ""),
      });
    }
  });

  return map;
}

function shouldApplyOpeningBalance(balanceDate, toDate) {
  const date = String(balanceDate || "");
  return !date || !toDate || date <= toDate;
}

function ensureLedger(ledgerMap, account) {
  const name = String(account || "").trim();

  if (!name) {
    return null;
  }

  const key = normalizeSearchText(name);

  if (!ledgerMap.has(key)) {
    ledgerMap.set(key, {
      account: name,
      balance: 0,
    });
  }

  return ledgerMap.get(key);
}

function getLedgerBalanceMap() {
  const fromDate = fromDateInput.value;
  const toDate = toDateInput.value;
  const ledgerMap = new Map();

  getLedgerOpeningBalanceMap().forEach((record) => {
    if (!shouldApplyOpeningBalance(record.openingBalanceDate, toDate)) {
      return;
    }

    const ledger = ensureLedger(ledgerMap, record.account);
    if (ledger) {
      ledger.balance += parseAmount(record.openingBalance);
    }
  });

  getSortedJournals().forEach((journal) => {
    const journalDate = String(journal.journalDate || "");

    if ((fromDate && journalDate < fromDate) || (toDate && journalDate > toDate)) {
      return;
    }

    const lines = Array.isArray(journal.lines) ? journal.lines : [];

    lines.forEach((line) => {
      const ledger = ensureLedger(ledgerMap, line && line.account);

      if (!ledger) {
        return;
      }

      ledger.balance += parseAmount(line.debit) - parseAmount(line.credit);
    });
  });

  return ledgerMap;
}

function getAmountForClassification(balance, classification) {
  if (classification === "Asset" || classification === "Expense") {
    return balance;
  }

  return -balance;
}

function buildChartNode(node, targetClassification, ledgerMap, consumedLedgerKeys, inheritedClassification = "", level = 0) {
  if (!node || typeof node !== "object") {
    return null;
  }

  const nodeClassification = normalizeClassification(node.classification) || inheritedClassification;

  if (node.type === "ledger") {
    const key = normalizeSearchText(node.name);
    const ledger = ledgerMap.get(key);

    if (!ledger || nodeClassification !== targetClassification) {
      return null;
    }

    const amount = getAmountForClassification(ledger.balance, nodeClassification);

    if (Math.abs(amount) < 0.005) {
      return null;
    }

    consumedLedgerKeys.add(key);

    return {
      type: "ledger",
      name: node.name,
      amount,
      level,
    };
  }

  const children = (Array.isArray(node.children) ? node.children : [])
    .map((child) =>
      buildChartNode(child, targetClassification, ledgerMap, consumedLedgerKeys, nodeClassification, level + 1)
    )
    .filter(Boolean);
  const amount = children.reduce((total, child) => total + child.amount, 0);

  if (!children.length || Math.abs(amount) < 0.005) {
    return null;
  }

  return {
    type: "group",
    name: node.name,
    amount,
    level,
    children,
  };
}

function isWrapperGroup(node, targetClassification) {
  const normalizedName = normalizeSearchText(node && node.name);

  if (targetClassification === "Asset" && normalizedName === "assets") {
    return true;
  }

  return (
    (targetClassification === "Equity" || targetClassification === "Liability") &&
    normalizedName === "equityliabilities"
  );
}

function buildChartSectionRows(targetClassification, ledgerMap, consumedLedgerKeys) {
  const chartItems = safeReadArray(STORAGE_KEYS.chartOfAccounts);
  const rows = [];

  chartItems.forEach((item) => {
    if (isWrapperGroup(item, targetClassification)) {
      (Array.isArray(item.children) ? item.children : []).forEach((child) => {
        const node = buildChartNode(child, targetClassification, ledgerMap, consumedLedgerKeys, "", 0);
        if (node) rows.push(node);
      });
      return;
    }

    const node = buildChartNode(item, targetClassification, ledgerMap, consumedLedgerKeys, "", 0);
    if (node) rows.push(node);
  });

  return rows;
}

function getOtherRows(targetClassification, ledgerMap, classificationMap, consumedLedgerKeys) {
  const rows = [];

  ledgerMap.forEach((ledger, key) => {
    if (consumedLedgerKeys.has(key) || Math.abs(ledger.balance) < 0.005) {
      return;
    }

    const classification = classificationMap.get(key) || inferClassification(ledger.account);

    if (classification !== targetClassification) {
      return;
    }

    const amount = getAmountForClassification(ledger.balance, classification);

    if (Math.abs(amount) >= 0.005) {
      consumedLedgerKeys.add(key);
      rows.push({
        type: "ledger",
        name: ledger.account,
        amount,
        level: 1,
      });
    }
  });

  rows.sort((left, right) =>
    left.name.localeCompare(right.name, undefined, {
      numeric: true,
      sensitivity: "base",
    })
  );

  return rows.length
    ? [
        {
          type: "group",
          name:
            targetClassification === "Liability"
              ? "Other Liabilities"
              : targetClassification === "Equity"
                ? "Other Equity"
                : "Other Assets",
          amount: rows.reduce((total, row) => total + row.amount, 0),
          level: 0,
          children: rows,
        },
      ]
    : [];
}

function getProfitRow(ledgerMap, classificationMap, consumedLedgerKeys) {
  let income = 0;
  let expenses = 0;

  ledgerMap.forEach((ledger, key) => {
    if (consumedLedgerKeys.has(key) || Math.abs(ledger.balance) < 0.005) {
      return;
    }

    const classification = classificationMap.get(key) || inferClassification(ledger.account);

    if (classification === "Income") {
      income += -ledger.balance;
      consumedLedgerKeys.add(key);
    } else if (classification === "Expense") {
      expenses += ledger.balance;
      consumedLedgerKeys.add(key);
    }
  });

  const profit = income - expenses;

  return Math.abs(profit) >= 0.005
    ? {
        type: "ledger",
        name: "Current Period Profit / (Loss)",
        amount: profit,
        level: 1,
      }
    : null;
}

function getReviewRows(ledgerMap, classificationMap, consumedLedgerKeys) {
  const rows = [];

  ledgerMap.forEach((ledger, key) => {
    if (consumedLedgerKeys.has(key) || Math.abs(ledger.balance) < 0.005) {
      return;
    }

    const classification = classificationMap.get(key) || inferClassification(ledger.account);

    if (classification) {
      return;
    }

    rows.push({
      type: "ledger",
      name: ledger.account,
      amount: ledger.balance,
      level: 0,
    });
  });

  return rows.sort((left, right) =>
    left.name.localeCompare(right.name, undefined, {
      numeric: true,
      sensitivity: "base",
    })
  );
}

function getFinancialPositionData() {
  const ledgerMap = getLedgerBalanceMap();
  const classificationMap = getLedgerClassificationMap();
  const consumedLedgerKeys = new Set();
  const data = {
    assets: buildChartSectionRows("Asset", ledgerMap, consumedLedgerKeys),
    equity: buildChartSectionRows("Equity", ledgerMap, consumedLedgerKeys),
    liabilities: buildChartSectionRows("Liability", ledgerMap, consumedLedgerKeys),
    review: [],
  };
  const profitRow = getProfitRow(ledgerMap, classificationMap, consumedLedgerKeys);

  data.assets.push(...getOtherRows("Asset", ledgerMap, classificationMap, consumedLedgerKeys));
  data.equity.push(...getOtherRows("Equity", ledgerMap, classificationMap, consumedLedgerKeys));
  if (profitRow) data.equity.push(profitRow);
  data.liabilities.push(...getOtherRows("Liability", ledgerMap, classificationMap, consumedLedgerKeys));
  data.review = getReviewRows(ledgerMap, classificationMap, consumedLedgerKeys);

  return data;
}

function sumRows(rows) {
  return rows.reduce((total, row) => total + row.amount, 0);
}

function renderRow(row) {
  const level = Math.min(Math.max(Number(row.level) || 0, 0), 4);
  const className = row.type === "group" ? "financial-position-line--group" : "financial-position-line--ledger";
  const childRows = row.children ? row.children.map(renderRow).join("") : "";

  return `
    <div class="financial-position-line ${className} financial-position-line--level-${level}">
      <div>${escapeHtml(row.name)}</div>
      <div>${escapeHtml(formatAmount(row.amount))}</div>
    </div>
    ${childRows}
  `;
}

function buildRows(rows) {
  if (!rows.length) {
    return '<div class="financial-position-line financial-position-line--empty"><div>No balances found.</div></div>';
  }

  return rows.map(renderRow).join("");
}

function renderFinancialPosition() {
  const data = getFinancialPositionData();
  const totalAssets = sumRows(data.assets);
  const totalEquity = sumRows(data.equity);
  const totalLiabilities = sumRows(data.liabilities);

  assetsContainer.innerHTML = buildRows(data.assets);
  equityContainer.innerHTML = buildRows(data.equity);
  liabilitiesContainer.innerHTML = buildRows(data.liabilities);
  reviewContainer.innerHTML = buildRows(data.review);
  reviewSection.hidden = data.review.length === 0;

  totalAssetsCell.textContent = formatAmount(totalAssets);
  totalEquityCell.textContent = formatAmount(totalEquity);
  totalLiabilitiesCell.textContent = formatAmount(totalLiabilities);
  totalEquityLiabilitiesCell.textContent = formatAmount(totalEquity + totalLiabilities);
}

fromDateInput.addEventListener("change", renderFinancialPosition);
toDateInput.addEventListener("change", renderFinancialPosition);

document.addEventListener("DOMContentLoaded", async () => {
  if (window.BanikAccounting) await window.BanikAccounting.ready();
  if (window.BanikReportData) {
    await window.BanikReportData.hydrateCollections([
      { name: "journals", storageKey: STORAGE_KEYS.journals },
      { name: "chartOfAccounts", storageKey: STORAGE_KEYS.chartOfAccounts },
    ]);
  }
  renderFinancialPosition();
});
