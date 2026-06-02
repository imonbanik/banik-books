const STORAGE_KEYS = {
  journals: "banikBooksJournals",
  chartOfAccounts: "banikBooksChartOfAccounts",
  ledgers: "banikBooksLedgers",
};

const fromDateInput = document.querySelector("#profit-loss-from");
const toDateInput = document.querySelector("#profit-loss-to");
const containers = {
  revenue: document.querySelector("#profit-loss-revenue"),
  costService: document.querySelector("#profit-loss-cost-service"),
  sellingMarketing: document.querySelector("#profit-loss-selling-marketing"),
  generalAdmin: document.querySelector("#profit-loss-general-admin"),
  nonOperatingIncome: document.querySelector("#profit-loss-non-operating-income"),
  incomeTax: document.querySelector("#profit-loss-income-tax"),
  review: document.querySelector("#profit-loss-review"),
};
const totals = {
  revenue: document.querySelector("#profit-loss-total-revenue"),
  costService: document.querySelector("#profit-loss-total-cost-service"),
  sellingMarketing: document.querySelector("#profit-loss-total-selling-marketing"),
  generalAdmin: document.querySelector("#profit-loss-total-general-admin"),
  nonOperatingIncome: document.querySelector("#profit-loss-total-non-operating-income"),
  incomeTax: document.querySelector("#profit-loss-total-income-tax"),
  grossProfit: document.querySelector("#profit-loss-gross-profit"),
  operatingProfit: document.querySelector("#profit-loss-operating-profit"),
  beforeTax: document.querySelector("#profit-loss-before-tax"),
  netProfit: document.querySelector("#profit-loss-net-profit"),
};
const reviewSection = document.querySelector("#profit-loss-review-section");

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

function getLedgerBalanceMap() {
  const fromDate = fromDateInput.value;
  const toDate = toDateInput.value;
  const ledgerMap = new Map();

  getSortedJournals().forEach((journal) => {
    const journalDate = String(journal.journalDate || "");

    if ((fromDate && journalDate < fromDate) || (toDate && journalDate > toDate)) {
      return;
    }

    (Array.isArray(journal.lines) ? journal.lines : []).forEach((line) => {
      const account = String((line && line.account) || "").trim();

      if (!account) {
        return;
      }

      const key = normalizeSearchText(account);
      const ledger = ledgerMap.get(key) || { account, balance: 0 };
      ledger.balance += parseAmount(line.debit) - parseAmount(line.credit);
      ledgerMap.set(key, ledger);
    });
  });

  return ledgerMap;
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

function getLedgerClassificationMap() {
  const map = collectLedgerClassifications(safeReadArray(STORAGE_KEYS.chartOfAccounts));

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

  if (/(revenue|income|sales|serviceincome)/.test(normalized)) {
    return "Income";
  }

  if (/(expense|cost|rent|salary|allowance|bonus|depreciation|fee|charge|bill|repair|maintenance|printing|travel|insurance|tax)/.test(normalized)) {
    return "Expense";
  }

  return "";
}

function getAmount(balance, classification) {
  return classification === "Income" ? -balance : balance;
}

function getCategoryForName(name, classification, pathNames = []) {
  const text = normalizeSearchText([...pathNames, name].join(" "));

  if (classification === "Income") {
    return /(nonoperating|otherincome|interestincome|gain)/.test(text) ? "nonOperatingIncome" : "revenue";
  }

  if (/(incometax|taxexpense|taxexpenses)/.test(text)) {
    return "incomeTax";
  }

  if (/(costofservice|costofservices|cos|costofservicerendered)/.test(text)) {
    return "costService";
  }

  if (/(selling|marketing|distribution|sd)/.test(text)) {
    return "sellingMarketing";
  }

  if (/(general|administrative|admin|ad)/.test(text)) {
    return "generalAdmin";
  }

  return "generalAdmin";
}

function buildChartNode(node, category, ledgerMap, consumedLedgerKeys, inheritedClassification = "", pathNames = [], level = 0) {
  if (!node || typeof node !== "object") {
    return null;
  }

  const classification = normalizeClassification(node.classification) || inheritedClassification;
  const nextPath = node.name ? [...pathNames, node.name] : pathNames;

  if (node.type === "ledger") {
    const key = normalizeSearchText(node.name);
    const ledger = ledgerMap.get(key);

    if (!ledger || getCategoryForName(node.name, classification, pathNames) !== category) {
      return null;
    }

    const amount = getAmount(ledger.balance, classification);

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
    .map((child) => buildChartNode(child, category, ledgerMap, consumedLedgerKeys, classification, nextPath, level + 1))
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

function buildCategoryRows(category, ledgerMap, consumedLedgerKeys) {
  const rows = [];

  safeReadArray(STORAGE_KEYS.chartOfAccounts).forEach((item) => {
    const node = buildChartNode(item, category, ledgerMap, consumedLedgerKeys, "", [], 0);
    if (node) rows.push(node);
  });

  return rows;
}

function getOtherRows(category, ledgerMap, classificationMap, consumedLedgerKeys) {
  const rows = [];

  ledgerMap.forEach((ledger, key) => {
    if (consumedLedgerKeys.has(key) || Math.abs(ledger.balance) < 0.005) {
      return;
    }

    const classification = classificationMap.get(key) || inferClassification(ledger.account);

    if (!classification || getCategoryForName(ledger.account, classification) !== category) {
      return;
    }

    const amount = getAmount(ledger.balance, classification);

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
          name: "Other",
          amount: rows.reduce((total, row) => total + row.amount, 0),
          level: 0,
          children: rows,
        },
      ]
    : [];
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

  return rows;
}

function getProfitLossData() {
  const ledgerMap = getLedgerBalanceMap();
  const classificationMap = getLedgerClassificationMap();
  const consumedLedgerKeys = new Set();
  const categories = [
    "revenue",
    "costService",
    "sellingMarketing",
    "generalAdmin",
    "nonOperatingIncome",
    "incomeTax",
  ];
  const data = {};

  categories.forEach((category) => {
    data[category] = [
      ...buildCategoryRows(category, ledgerMap, consumedLedgerKeys),
      ...getOtherRows(category, ledgerMap, classificationMap, consumedLedgerKeys),
    ];
  });

  data.review = getReviewRows(ledgerMap, classificationMap, consumedLedgerKeys);
  return data;
}

function sumRows(rows) {
  return rows.reduce((total, row) => total + row.amount, 0);
}

function renderRow(row) {
  const level = Math.min(Math.max(Number(row.level) || 0, 0), 4);
  const className = row.type === "group" ? "profit-loss-line--group" : "profit-loss-line--ledger";
  const childRows = row.children ? row.children.map(renderRow).join("") : "";

  return `
    <div class="profit-loss-line ${className} profit-loss-line--level-${level}">
      <div>${escapeHtml(row.name)}</div>
      <div>${escapeHtml(formatAmount(row.amount))}</div>
    </div>
    ${childRows}
  `;
}

function buildRows(rows) {
  if (!rows.length) {
    return '<div class="profit-loss-line profit-loss-line--empty"><div>No balances found.</div></div>';
  }

  return rows.map(renderRow).join("");
}

function renderProfitLoss() {
  const data = getProfitLossData();
  const totalRevenue = sumRows(data.revenue);
  const totalCostService = sumRows(data.costService);
  const grossProfit = totalRevenue - totalCostService;
  const totalSellingMarketing = sumRows(data.sellingMarketing);
  const totalGeneralAdmin = sumRows(data.generalAdmin);
  const operatingProfit = grossProfit - totalSellingMarketing - totalGeneralAdmin;
  const totalNonOperatingIncome = sumRows(data.nonOperatingIncome);
  const beforeTax = operatingProfit + totalNonOperatingIncome;
  const totalIncomeTax = sumRows(data.incomeTax);
  const netProfit = beforeTax - totalIncomeTax;

  containers.revenue.innerHTML = buildRows(data.revenue);
  containers.costService.innerHTML = buildRows(data.costService);
  containers.sellingMarketing.innerHTML = buildRows(data.sellingMarketing);
  containers.generalAdmin.innerHTML = buildRows(data.generalAdmin);
  containers.nonOperatingIncome.innerHTML = buildRows(data.nonOperatingIncome);
  containers.incomeTax.innerHTML = buildRows(data.incomeTax);
  containers.review.innerHTML = buildRows(data.review);
  reviewSection.hidden = data.review.length === 0;

  totals.revenue.textContent = formatAmount(totalRevenue);
  totals.costService.textContent = formatAmount(totalCostService);
  totals.grossProfit.textContent = formatAmount(grossProfit);
  totals.sellingMarketing.textContent = formatAmount(totalSellingMarketing);
  totals.generalAdmin.textContent = formatAmount(totalGeneralAdmin);
  totals.operatingProfit.textContent = formatAmount(operatingProfit);
  totals.nonOperatingIncome.textContent = formatAmount(totalNonOperatingIncome);
  totals.beforeTax.textContent = formatAmount(beforeTax);
  totals.incomeTax.textContent = formatAmount(totalIncomeTax);
  totals.netProfit.textContent = formatAmount(netProfit);
}

fromDateInput.addEventListener("change", renderProfitLoss);
toDateInput.addEventListener("change", renderProfitLoss);

document.addEventListener("DOMContentLoaded", async () => {
  if (window.BanikAccounting) await window.BanikAccounting.ready();
  renderProfitLoss();
});
