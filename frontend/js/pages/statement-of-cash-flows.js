const STORAGE_KEYS = {
  journals: "banikBooksJournals",
  chartOfAccounts: "banikBooksChartOfAccounts",
  ledgers: "banikBooksLedgers",
};

const fromDateInput = document.querySelector("#cash-flows-from");
const toDateInput = document.querySelector("#cash-flows-to");
const companyNameElement = document.querySelector("#cash-flows-company-name");
const periodLabel = document.querySelector("#cash-flows-period-label");
const currentColumnLabel = document.querySelector("#cash-flows-current-label");
const previousColumnLabel = document.querySelector("#cash-flows-previous-label");
const currencyTitle = document.querySelector("#cash-flows-currency-title");
const excelButton = document.querySelector("#cash-flows-excel");
const printButton = document.querySelector("#cash-flows-print");
const containers = {
  operating: document.querySelector("#cash-flows-operating"),
  investing: document.querySelector("#cash-flows-investing"),
  financing: document.querySelector("#cash-flows-financing"),
  summary: document.querySelector("#cash-flows-summary"),
  validation: document.querySelector("#cash-flows-validation"),
};
const CASH_FLOW_MAPPINGS = {
  cashEquivalents: [/cashandcashequivalents/, /cashinhand/, /cashatbank/, /bankaccount/],
  netProfit: {
    income: [/revenue/, /income/, /sales/, /serviceincome/],
    expense: [/expense/, /cost/, /salary/, /allowance/, /bonus/, /rent/, /depreciation/, /tax/, /fee/, /charge/, /bill/],
  },
  nonCash: {
    depreciationPpe: [/depreciation/],
  },
  operatingWorkingCapital: [
    {
      label: "(Increase)/Decrease in Advance, Deposit & Prepayments",
      type: "asset",
      patterns: [/advancedepositprepayment/, /advanceofficerent/, /advanceincometax/, /advancetosupplier/, /advancetostaff/],
    },
    {
      label: "(Increase)/Decrease in Sundry Receivable",
      type: "asset",
      patterns: [/sundryreceivable/, /sundryreceivables/, /tradereceivable/, /receivable/],
    },
    {
      label: "Increase/(Decrease) in Long Term Loan",
      type: "liability",
      patterns: [/longtermloan/],
    },
    {
      label: "Increase/(Decrease) in Salary & Other Payables",
      type: "liability",
      patterns: [/salaryotherpayable/, /salaryallowancespayable/, /festivalbonuspayable/, /sundrypayable/, /payable/],
      exclude: [/taxpayable/, /vatpayable/],
    },
    {
      label: "Increase/(Decrease) in Provision for Expenses",
      type: "liability",
      patterns: [/provisionforexpenses/, /provisionforauditfees/, /provisionforincometaxexpense/, /provision/],
    },
  ],
  investing: {
    tangibleAsset: [/propertyplantequipment/, /tangibleasset/, /fixedasset/, /computerperipherals/, /officeequipment/, /furniturefixture/],
    exclude: [/accumulateddepreciation/, /depreciation/],
  },
  financing: [
    {
      label: "Issued, subscribed & paid up share capital",
      type: "equity",
      patterns: [/paidupsharecapital/, /sharecapital/],
    },
    {
      label: "Share Money Deposit",
      type: "equity",
      patterns: [/sharemoneydeposit/, /sharemoney/],
    },
  ],
};

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

function getReportCurrency() {
  return window.BanikAccounting
    ? window.BanikAccounting.getPreferences().currency
    : "BDT";
}

function formatAmount(value) {
  const amount = Number(value || 0);

  if (Math.abs(amount) < 0.005) {
    return "-";
  }

  return window.BanikAccounting
    ? window.BanikAccounting.formatNumber(amount, { digits: 0, absolute: true, negativeBrackets: true })
    : amount < 0 ? `(${Math.abs(amount).toFixed(0)})` : Math.abs(amount).toFixed(0);
}

async function getReportOrganization() {
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

function formatDateForDisplay(dateValue) {
  return window.BanikAccounting ? window.BanikAccounting.formatDate(dateValue) : dateValue;
}

function shiftDateByYears(dateValue, years) {
  if (!dateValue) {
    return "";
  }

  const [year, month, day] = String(dateValue).split("-").map(Number);

  if (!year || !month || !day) {
    return "";
  }

  const date = new Date(Date.UTC(year + years, month - 1, day));
  const shiftedYear = date.getUTCFullYear();
  const shiftedMonth = String(date.getUTCMonth() + 1).padStart(2, "0");
  const shiftedDay = String(date.getUTCDate()).padStart(2, "0");

  return `${shiftedYear}-${shiftedMonth}-${shiftedDay}`;
}

function getDateRange() {
  const today = new Date();
  const fallbackToDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const toDate = toDateInput.value || fallbackToDate;
  const fromDate = fromDateInput.value || `${toDate.slice(0, 4)}-01-01`;

  return {
    current: {
      fromDate,
      toDate,
      label: toDate,
    },
    previous: {
      fromDate: shiftDateByYears(fromDate, -1),
      toDate: shiftDateByYears(toDate, -1),
      label: shiftDateByYears(toDate, -1),
    },
  };
}

function getOptionalFilterValue(selectors) {
  const element = selectors.map((selector) => document.querySelector(selector)).find(Boolean);
  return element ? String(element.value || "").trim() : "";
}

function getReportFilters() {
  return {
    companyId: getOptionalFilterValue(["#cash-flows-company", "#company-filter", "[name='companyId']"]),
    branchId: getOptionalFilterValue(["#cash-flows-branch", "#branch-filter", "[name='branchId']"]),
  };
}

function collectLedgerMetadata(items, map = new Map(), inheritedPath = []) {
  if (!Array.isArray(items)) {
    return map;
  }

  items.forEach((item) => {
    if (!item || typeof item !== "object") {
      return;
    }

    const nextPath = item.name ? [...inheritedPath, item.name] : inheritedPath;

    if (item.type === "ledger" && item.name) {
      const classification = normalizeClassification(item.classification);
      if (classification) {
        map.set(normalizeSearchText(item.name), {
          classification,
          path: nextPath,
        });
      }
    }

    collectLedgerMetadata(item.children || [], map, nextPath);
  });

  return map;
}

function getLedgerMetadataMap() {
  const map = collectLedgerMetadata(safeReadArray(STORAGE_KEYS.chartOfAccounts));

  safeReadArray(STORAGE_KEYS.ledgers).forEach((ledger) => {
    if (!ledger || typeof ledger !== "object") {
      return;
    }

    const name = ledger.name || ledger.ledgerName || ledger.accountName || ledger.title || "";
    const classification = normalizeClassification(ledger.classification);

    if (name && classification && !map.has(normalizeSearchText(name))) {
      map.set(normalizeSearchText(name), {
        classification,
        path: [name],
      });
    }
  });

  return map;
}

function collectLedgerOpeningBalances(items, records = []) {
  if (!Array.isArray(items)) {
    return records;
  }

  items.forEach((item) => {
    if (!item || typeof item !== "object") {
      return;
    }

    if (item.type === "ledger" && item.name) {
      records.push({
        account: item.name,
        openingBalance: parseAmount(item.openingBalance),
        openingBalanceDate: String(item.openingBalanceDate || ""),
      });
    }

    collectLedgerOpeningBalances(item.children || [], records);
  });

  return records;
}

function getLedgerOpeningBalanceRecords() {
  const recordMap = new Map();
  const addRecord = (record) => {
    const account = String((record && record.account) || "").trim();
    const key = normalizeSearchText(account);

    if (!key || recordMap.has(key)) {
      return;
    }

    recordMap.set(key, {
      account,
      openingBalance: parseAmount(record.openingBalance),
      openingBalanceDate: String(record.openingBalanceDate || ""),
    });
  };

  collectLedgerOpeningBalances(safeReadArray(STORAGE_KEYS.chartOfAccounts)).forEach(addRecord);
  safeReadArray(STORAGE_KEYS.ledgers).forEach((ledger) => {
    if (!ledger || typeof ledger !== "object") {
      return;
    }

    addRecord({
      account: ledger.name || ledger.ledgerName || ledger.accountName || ledger.title || "",
      openingBalance: ledger.openingBalance,
      openingBalanceDate: ledger.openingBalanceDate,
    });
  });

  return [...recordMap.values()];
}

function shouldApplyOpeningBalance(balanceDate, toDate) {
  const date = String(balanceDate || "");
  return !date || !toDate || date <= toDate;
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

  if (/(expense|cost|rent|salary|allowance|bonus|depreciation|fee|charge|bill|repair|maintenance|printing|travel|insurance|tax)/.test(normalized)) {
    return "Expense";
  }

  return "";
}

function getClassification(account, metadataMap) {
  const key = normalizeSearchText(account);
  const metadata = metadataMap.get(key);
  return (metadata && metadata.classification) || inferClassification(account);
}

function getPathText(account, metadataMap) {
  const metadata = metadataMap.get(normalizeSearchText(account));
  const path = metadata && Array.isArray(metadata.path) ? metadata.path : [account];
  return normalizeSearchText(path.join(" "));
}

function isCashLedger(account, metadataMap) {
  const text = getPathText(account, metadataMap);
  return matchesAnyPattern(text, CASH_FLOW_MAPPINGS.cashEquivalents);
}

function isDepreciationLedger(account) {
  return /depreciation/.test(normalizeSearchText(account));
}

function isAccumulatedDepreciationLedger(account) {
  return /accumulateddepreciation/.test(normalizeSearchText(account));
}

function getNonCashCategory(account, metadataMap) {
  const text = getPathText(account, metadataMap);

  if (/depreciation/.test(text)) {
    return "Depreciation";
  }

  if (/amortization|amortisation/.test(text)) {
    return "Amortization";
  }

  if (/impairment/.test(text)) {
    return "Impairment";
  }

  if (/provision/.test(text)) {
    return "Provision expenses";
  }

  if (/unrealized|unrealised|fairvalue/.test(text)) {
    return /gain|income/.test(text) ? "Unrealized gain" : "Unrealized loss";
  }

  if (/disposal|saleoffixedasset|saleofasset/.test(text)) {
    return /gain|income|profit/.test(text) ? "Gain on disposal of fixed assets" : "Loss on disposal of fixed assets";
  }

  if (/financecost|interestexpense|borrowingcost/.test(text)) {
    return "Finance cost";
  }

  return "";
}

function isIncomeTaxLedger(account, metadataMap) {
  return /incometax|taxexpense|taxexpenses|taxpaid|advanceincometax|provisionforincometax/.test(getPathText(account, metadataMap));
}

function isInterestLedger(account, metadataMap) {
  return /interestexpense|financecost|borrowingcost|interestpaid/.test(getPathText(account, metadataMap));
}

function isInvestingAssetLedger(account, metadataMap) {
  const text = getPathText(account, metadataMap);
  return /(noncurrentassets|propertyplantequipment|equipment|furniture|fixture|computer|peripherals|tangibleasset|fixedasset)/.test(text);
}

function isFinancingLedger(account, metadataMap) {
  const text = getPathText(account, metadataMap);
  return /(equity|capital|sharemoney|sharedeposit|retainedearnings|drawing|loan|lease)/.test(text);
}

function matchesAnyPattern(text, patterns = []) {
  return patterns.some((pattern) => pattern.test(text));
}

function ledgerMatchesMapping(ledger, metadataMap, mapping) {
  const text = getPathText(ledger.account, metadataMap);

  if (mapping.exclude && matchesAnyPattern(text, mapping.exclude)) {
    return false;
  }

  return matchesAnyPattern(text, mapping.patterns || mapping);
}

function getStatementBalance(rawBalance, type) {
  return type === "asset" ? rawBalance : -rawBalance;
}

function sumMappedBalance(ledgerMap, metadataMap, mapping, balanceKey) {
  let total = 0;

  ledgerMap.forEach((ledger) => {
    if (!ledgerMatchesMapping(ledger, metadataMap, mapping)) {
      return;
    }

    total += getStatementBalance(ledger[balanceKey] || 0, mapping.type || "asset");
  });

  return total;
}

function sumPeriodExpense(ledgerMap, metadataMap, patterns) {
  let total = 0;

  ledgerMap.forEach((ledger) => {
    const classification = getClassification(ledger.account, metadataMap);

    if (classification !== "Expense" || !matchesAnyPattern(getPathText(ledger.account, metadataMap), patterns)) {
      return;
    }

    total += ledger.periodBalance || 0;
  });

  return total;
}

function getNetProfitAfterTax(ledgerMap, metadataMap) {
  let income = 0;
  let expenses = 0;

  ledgerMap.forEach((ledger) => {
    const classification = getClassification(ledger.account, metadataMap);

    if (classification === "Income") {
      income += -(ledger.periodBalance || 0);
    } else if (classification === "Expense") {
      expenses += ledger.periodBalance || 0;
    }
  });

  return income - expenses;
}

function getDisplayLabel(account, metadataMap) {
  const metadata = metadataMap.get(normalizeSearchText(account));
  const path = metadata && Array.isArray(metadata.path) ? metadata.path : [];
  const groupName = path.length > 1 ? path[path.length - 2] : "";
  const normalizedGroup = normalizeSearchText(groupName);
  const normalizedAccount = normalizeSearchText(account);

  if (/(advance|deposit|prepayment)/.test(normalizedGroup)) {
    return "Advance, Deposit & Prepayments";
  }

  if (/salaryotherpayable/.test(normalizedGroup)) {
    return "Salary & Other Payables";
  }

  if (/provisionforexpenses/.test(normalizedGroup)) {
    return "Provision for Expenses";
  }

  if (/cashandcashequivalents/.test(normalizedGroup)) {
    return "Cash and Cash Equivalents";
  }

  if (/propertyplantequipment/.test(normalizedGroup)) {
    return "Tangible Asset";
  }

  if (/paidupsharecapital|sharecapital/.test(normalizedAccount)) {
    return "Issued, subscribed & paid up share capital";
  }

  if (/sharemoney/.test(normalizedAccount)) {
    return "Share Money Deposit";
  }

  return account;
}

function ensureLedger(ledgerMap, account) {
  const name = String(account || "").trim();

  if (!name) {
    return null;
  }

  const key = normalizeSearchText(name);
  const ledger = ledgerMap.get(key) || {
    account: name,
    openingBalance: 0,
    closingBalance: 0,
    periodBalance: 0,
  };

  ledgerMap.set(key, ledger);
  return ledger;
}

function journalMatchesFilters(journal, filters) {
  if (filters.companyId) {
    const journalCompany = String(journal.companyId || journal.company || journal.companyName || "").trim();
    if (journalCompany && journalCompany !== filters.companyId) {
      return false;
    }
  }

  if (filters.branchId) {
    const journalBranch = String(journal.branchId || journal.branch || journal.branchName || "").trim();
    if (journalBranch && journalBranch !== filters.branchId) {
      return false;
    }
  }

  return true;
}

function getLedgerDataForPeriod(range, filters = {}) {
  const ledgerMap = new Map();

  getLedgerOpeningBalanceRecords().forEach((record) => {
    if (!shouldApplyOpeningBalance(record.openingBalanceDate, range.toDate)) {
      return;
    }

    const ledger = ensureLedger(ledgerMap, record.account);

    if (!ledger) {
      return;
    }

    const balanceDate = String(record.openingBalanceDate || "");
    const openingBalance = parseAmount(record.openingBalance);

    ledger.closingBalance += openingBalance;
    if (!range.fromDate || !balanceDate || balanceDate < range.fromDate) {
      ledger.openingBalance += openingBalance;
    } else {
      ledger.periodBalance += openingBalance;
    }
  });

  getSortedJournals().forEach((journal) => {
    const journalDate = String(journal.journalDate || "");

    if ((range.toDate && journalDate > range.toDate) || !journalMatchesFilters(journal, filters)) {
      return;
    }

    (Array.isArray(journal.lines) ? journal.lines : []).forEach((line) => {
      const ledger = ensureLedger(ledgerMap, line && line.account);

      if (!ledger) {
        return;
      }

      const movement = parseAmount(line.debit) - parseAmount(line.credit);

      if (range.fromDate && journalDate < range.fromDate) {
        ledger.openingBalance += movement;
      } else {
        ledger.periodBalance += movement;
      }

      ledger.closingBalance += movement;
    });
  });

  return ledgerMap;
}

function addGroupedValue(map, label, value, options = {}) {
  const current = Number(value.current || 0);
  const previous = Number(value.previous || 0);

  if (Math.abs(current) < 0.005 && Math.abs(previous) < 0.005) {
    return;
  }

  const key = normalizeSearchText(label);
  const row = map.get(key) || { label, current: 0, previous: 0, ...options };
  row.current += current;
  row.previous += previous;
  map.set(key, row);
}

function sumRows(rows, column) {
  return rows.reduce((total, row) => total + (row[column] || 0), 0);
}

function getPeriodStatement(range, filters = {}) {
  const metadataMap = getLedgerMetadataMap();
  const ledgerMap = getLedgerDataForPeriod(range, filters);
  const data = {
    netProfitAfterTax: getNetProfitAfterTax(ledgerMap, metadataMap),
    depreciationPpe: sumPeriodExpense(ledgerMap, metadataMap, CASH_FLOW_MAPPINGS.nonCash.depreciationPpe),
    operatingChanges: [],
    acquisitionTangibleAsset: 0,
    financing: [],
    openingCash: 0,
    closingCash: 0,
  };

  CASH_FLOW_MAPPINGS.operatingWorkingCapital.forEach((mapping) => {
    const opening = sumMappedBalance(ledgerMap, metadataMap, mapping, "openingBalance");
    const closing = sumMappedBalance(ledgerMap, metadataMap, mapping, "closingBalance");
    const movement = mapping.type === "asset" ? opening - closing : closing - opening;

    data.operatingChanges.push({
      label: mapping.label,
      value: movement,
    });
  });

  const ppeMapping = {
    type: "asset",
    patterns: CASH_FLOW_MAPPINGS.investing.tangibleAsset,
    exclude: CASH_FLOW_MAPPINGS.investing.exclude,
  };
  const openingPpe = sumMappedBalance(ledgerMap, metadataMap, ppeMapping, "openingBalance");
  const closingPpe = sumMappedBalance(ledgerMap, metadataMap, ppeMapping, "closingBalance");
  data.acquisitionTangibleAsset = openingPpe - closingPpe;

  CASH_FLOW_MAPPINGS.financing.forEach((mapping) => {
    const opening = sumMappedBalance(ledgerMap, metadataMap, mapping, "openingBalance");
    const closing = sumMappedBalance(ledgerMap, metadataMap, mapping, "closingBalance");

    data.financing.push({
      label: mapping.label,
      value: closing - opening,
    });
  });

  ledgerMap.forEach((ledger) => {
    if (!isCashLedger(ledger.account, metadataMap)) {
      return;
    }

    data.openingCash += ledger.openingBalance || 0;
    data.closingCash += ledger.closingBalance || 0;
  });

  return data;
}

function buildStatementData(customOptions = {}) {
  const ranges = customOptions.ranges || getDateRange();
  const filters = customOptions.filters || getReportFilters();
  const current = getPeriodStatement(ranges.current, filters);
  const previous = getPeriodStatement(ranges.previous, filters);
  const operating = [
    {
      label: "Net profit or (loss) after tax",
      current: current.netProfitAfterTax,
      previous: previous.netProfitAfterTax,
      strong: true,
    },
    {
      label: "Add: Amount consider as non cash item",
      current: 0,
      previous: 0,
      heading: true,
    },
    {
      label: "Depreciation of Property, Plant & Equipment",
      current: current.depreciationPpe,
      previous: previous.depreciationPpe,
    },
    {
      label: "Changes in Operating Assets & Liabilities",
      current: 0,
      previous: 0,
      heading: true,
    },
    ...current.operatingChanges.map((row, index) => ({
      label: row.label,
      current: row.value,
      previous: previous.operatingChanges[index] ? previous.operatingChanges[index].value : 0,
    })),
  ];
  const investingRows = [
    {
      label: "Acquisition of Tangible Asset",
      current: current.acquisitionTangibleAsset,
      previous: previous.acquisitionTangibleAsset,
    },
  ];
  const financingRows = current.financing.map((row, index) => ({
    label: row.label,
    current: row.value,
    previous: previous.financing[index] ? previous.financing[index].value : 0,
  }));

  const totalOperating = sumRows(operating, "current");
  const totalPreviousOperating = sumRows(operating, "previous");
  const totalInvesting = sumRows(investingRows, "current");
  const totalPreviousInvesting = sumRows(investingRows, "previous");
  const totalFinancing = sumRows(financingRows, "current");
  const totalPreviousFinancing = sumRows(financingRows, "previous");
  const netCash = totalOperating + totalInvesting + totalFinancing;
  const previousNetCash = totalPreviousOperating + totalPreviousInvesting + totalPreviousFinancing;

  return {
    ranges,
    operating,
    investing: investingRows,
    financing: financingRows,
    totals: {
      operating: totalOperating,
      previousOperating: totalPreviousOperating,
      investing: totalInvesting,
      previousInvesting: totalPreviousInvesting,
      financing: totalFinancing,
      previousFinancing: totalPreviousFinancing,
      netCash,
      previousNetCash,
      openingCash: current.openingCash,
      previousOpeningCash: previous.openingCash,
      endingCash: current.openingCash + netCash,
      previousEndingCash: previous.openingCash + previousNetCash,
      balanceSheetClosingCash: current.closingCash,
      previousBalanceSheetClosingCash: previous.closingCash,
    },
    validations: getValidationChecks({
      endingCash: current.openingCash + netCash,
      balanceSheetClosingCash: current.closingCash,
      previousEndingCash: previous.openingCash + previousNetCash,
      previousBalanceSheetClosingCash: previous.closingCash,
    }),
  };
}

function getStatementRowsForExport(data) {
  return [
    { label: "Cash flow from operating activities:", section: true },
    ...data.operating,
    {
      label: "Cash flows from operating activities (A)",
      current: data.totals.operating,
      previous: data.totals.previousOperating,
      strong: true,
    },
    { label: "", spacer: true },
    { label: "Cash flow from investing activities:", section: true },
    ...data.investing,
    {
      label: "Cash flows from investing activities (B)",
      current: data.totals.investing,
      previous: data.totals.previousInvesting,
      strong: true,
    },
    { label: "", spacer: true },
    { label: "Cash flow from financing activities:", section: true },
    ...data.financing,
    {
      label: "Cash flows from financing activities (C)",
      current: data.totals.financing,
      previous: data.totals.previousFinancing,
      strong: true,
    },
    { label: "", spacer: true },
    {
      label: "Net cash flows (A + B + C)",
      current: data.totals.netCash,
      previous: data.totals.previousNetCash,
      strong: true,
    },
    {
      label: "Cash and Cash equivalents at beginning of the year",
      current: data.totals.openingCash,
      previous: data.totals.previousOpeningCash,
    },
    {
      label: "Cash and Cash equivalents at end of the year",
      current: data.totals.endingCash,
      previous: data.totals.previousEndingCash,
      strong: true,
      grandTotal: true,
    },
  ];
}

function getReportStyles() {
  return `
    @page { size: A4; margin: 16mm 14mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: #ffffff;
      color: #111111;
      font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 10.5pt;
      line-height: 1.24;
    }
    .cash-print-page { width: 100%; max-width: 190mm; margin: 0 auto; }
    .cash-print-header { margin-bottom: 28px; color: #0f5bd6; font-weight: 800; }
    .cash-print-company { font-size: 17pt; line-height: 1.12; }
    .cash-print-title { font-size: 16pt; line-height: 1.12; }
    .cash-print-period { font-size: 12pt; line-height: 1.18; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    col.particulars { width: 62%; }
    col.amount { width: 19%; }
    th, td { padding: 2px 4px; vertical-align: top; }
    thead th { border: 1px solid #111111; font-weight: 800; text-align: center; }
    thead th:first-child { border: 0; }
    td.label { color: #111111; }
    td.amount { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
    tr.section td { padding-top: 18px; padding-bottom: 14px; font-weight: 800; }
    tr.heading td { padding-top: 10px; font-weight: 800; }
    tr.strong td { font-weight: 800; }
    tr.subtotal td.amount { border-top: 1px solid #111111; border-bottom: 3px double #111111; }
    tr.grand-total td.amount { border-top: 1px solid #111111; border-bottom: 3px double #111111; font-weight: 800; }
    tr.spacer td { height: 10px; }
    .cash-print-validation { margin-top: 18px; border-top: 1px solid #d4d4d4; padding-top: 8px; font-size: 9pt; color: #404040; }
    .cash-print-validation div { display: flex; justify-content: space-between; gap: 16px; }
    @media print {
      body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    }
  `;
}

function buildReportTableHtml(data) {
  const currentLabel = formatDateForDisplay(data.ranges.current.label);
  const previousLabel = formatDateForDisplay(data.ranges.previous.label);
  const rows = getStatementRowsForExport(data)
    .map((row) => {
      if (row.spacer) {
        return '<tr class="spacer"><td colspan="3"></td></tr>';
      }

      if (row.section) {
        return `<tr class="section"><td colspan="3">${escapeHtml(row.label)}</td></tr>`;
      }

      const classNames = [
        row.heading ? "heading" : "",
        row.strong ? "strong" : "",
        row.strong && !row.grandTotal ? "subtotal" : "",
        row.grandTotal ? "grand-total" : "",
      ].filter(Boolean).join(" ");

      return `
        <tr class="${classNames}">
          <td class="label">${escapeHtml(row.label)}</td>
          <td class="amount">${row.heading ? "" : escapeHtml(formatAmount(row.current))}</td>
          <td class="amount">${row.heading ? "" : escapeHtml(formatAmount(row.previous))}</td>
        </tr>
      `;
    })
    .join("");

  return `
    <table>
      <colgroup>
        <col class="particulars" />
        <col class="amount" />
        <col class="amount" />
      </colgroup>
      <thead>
        <tr>
          <th></th>
          <th colspan="2">Amount in ${escapeHtml(getReportCurrency())}</th>
        </tr>
        <tr>
          <th></th>
          <th>${escapeHtml(currentLabel)}</th>
          <th>${escapeHtml(previousLabel)}</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function buildValidationHtml(validations) {
  return `
    <section class="cash-print-validation">
      ${validations
        .map(
          (check) => `
            <div>
              <span>${escapeHtml(check.ok ? "OK" : "Check")}: ${escapeHtml(check.label)}</span>
              <span>${escapeHtml(formatAmount(check.difference))}</span>
            </div>
          `
        )
        .join("")}
    </section>
  `;
}

async function printCashFlows() {
  const data = buildStatementData();
  const organization = await getReportOrganization();
  const printWindow = window.open("", "_blank");

  if (!printWindow) {
    window.alert("Please allow popups to print this report.");
    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Statement of Cash Flows | BANIK Books</title>
        <style>${getReportStyles()}</style>
      </head>
      <body>
        <main class="cash-print-page">
          <header class="cash-print-header">
            <div class="cash-print-company">${escapeHtml(organization.name)}</div>
            <div class="cash-print-title">Statement of Cash Flows</div>
            <div class="cash-print-period">${escapeHtml(periodLabel.textContent)}</div>
          </header>
          ${buildReportTableHtml(data)}
          ${buildValidationHtml(data.validations)}
        </main>
        <script>
          window.addEventListener("load", function () {
            window.print();
          });
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
}

function downloadExcelReport(filename, excelHtml) {
  const blob = new Blob(["\ufeff" + excelHtml], {
    type: "application/vnd.ms-excel;charset=utf-8",
  });
  const link = document.createElement("a");

  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(link.href);
}

async function downloadCashFlowsExcel() {
  const data = buildStatementData();
  const organization = await getReportOrganization();
  const datePart = data.ranges.current.label || new Date().toISOString().slice(0, 10);
  const excelHtml = `
    <html>
      <head>
        <meta charset="UTF-8" />
        <style>${getReportStyles()}</style>
      </head>
      <body>
        <main class="cash-print-page">
          <header class="cash-print-header">
            <div class="cash-print-company">${escapeHtml(organization.name)}</div>
            <div class="cash-print-title">Statement of Cash Flows</div>
            <div class="cash-print-period">${escapeHtml(periodLabel.textContent)}</div>
          </header>
          ${buildReportTableHtml(data)}
          ${buildValidationHtml(data.validations)}
        </main>
      </body>
    </html>
  `;

  downloadExcelReport(`statement-of-cash-flows-${datePart}.xls`, excelHtml);
}

function getValidationChecks(values) {
  const currentDifference = values.endingCash - values.balanceSheetClosingCash;
  const previousDifference = values.previousEndingCash - values.previousBalanceSheetClosingCash;

  return [
    {
      label: "Current period closing cash reconciles with Cash and Cash Equivalents",
      ok: Math.abs(currentDifference) < 0.005,
      difference: currentDifference,
    },
    {
      label: "Comparative period closing cash reconciles with Cash and Cash Equivalents",
      ok: Math.abs(previousDifference) < 0.005,
      difference: previousDifference,
    },
  ];
}

function buildRow(row, className = "") {
  return `
    <div class="cash-flows-row ${row.strong ? "cash-flows-row--strong" : ""} ${row.heading ? "cash-flows-row--heading" : ""} ${className}">
      <div>${escapeHtml(row.label)}</div>
      <div>${row.heading ? "" : escapeHtml(formatAmount(row.current))}</div>
      <div>${row.heading ? "" : escapeHtml(formatAmount(row.previous))}</div>
    </div>
  `;
}

function buildRows(rows, emptyLabel) {
  if (!rows.length) {
    return buildRow({ label: emptyLabel, current: 0, previous: 0 });
  }

  return rows.map((row) => buildRow(row)).join("");
}

function renderCashFlows() {
  const data = buildStatementData();
  const currentLabel = formatDateForDisplay(data.ranges.current.label);
  const previousLabel = formatDateForDisplay(data.ranges.previous.label);

  periodLabel.textContent = `For the period ended ${currentLabel}`;
  currentColumnLabel.textContent = currentLabel;
  previousColumnLabel.textContent = previousLabel;
  currencyTitle.textContent = `Amount in ${getReportCurrency()}`;
  containers.operating.innerHTML =
    buildRows(data.operating, "No operating cash flow data found.") +
    buildRow(
      {
        label: "Cash flows from operating activities (A)",
        current: data.totals.operating,
        previous: data.totals.previousOperating,
        strong: true,
      },
      "cash-flows-row--subtotal"
    );
  containers.investing.innerHTML =
    buildRows(data.investing, "No investing cash flow data found.") +
    buildRow(
      {
        label: "Cash flows from investing activities (B)",
        current: data.totals.investing,
        previous: data.totals.previousInvesting,
        strong: true,
      },
      "cash-flows-row--subtotal"
    );
  containers.financing.innerHTML =
    buildRows(data.financing, "No financing cash flow data found.") +
    buildRow(
      {
        label: "Cash flows from financing activities (C)",
        current: data.totals.financing,
        previous: data.totals.previousFinancing,
        strong: true,
      },
      "cash-flows-row--subtotal"
    );
  containers.summary.innerHTML = [
    buildRow({
      label: "Net cash flows (A + B + C)",
      current: data.totals.netCash,
      previous: data.totals.previousNetCash,
      strong: true,
    }),
    buildRow({
      label: "Cash and Cash equivalents at beginning of the year",
      current: data.totals.openingCash,
      previous: data.totals.previousOpeningCash,
    }),
    buildRow(
      {
        label: "Cash and Cash equivalents at end of the year",
        current: data.totals.endingCash,
        previous: data.totals.previousEndingCash,
        strong: true,
      },
      "cash-flows-row--grand-total"
    ),
  ].join("");
  containers.validation.innerHTML = data.validations
    .map(
      (check) => `
        <div class="cash-flows-row cash-flows-row--validation ${check.ok ? "cash-flows-row--valid" : "cash-flows-row--invalid"}">
          <div>${escapeHtml(check.ok ? "OK" : "Check")}: ${escapeHtml(check.label)}</div>
          <div colspan="2">${escapeHtml(formatAmount(check.difference))}</div>
          <div></div>
        </div>
      `
    )
    .join("");
}

fromDateInput.addEventListener("change", renderCashFlows);
toDateInput.addEventListener("change", renderCashFlows);
excelButton.addEventListener("click", downloadCashFlowsExcel);
printButton.addEventListener("click", printCashFlows);

window.BanikCashFlowService = {
  generateStatementOfCashFlows: buildStatementData,
};

document.addEventListener("DOMContentLoaded", async () => {
  if (window.BanikAccounting) await window.BanikAccounting.ready();
  if (window.BanikReportData) {
    await window.BanikReportData.hydrateCollections([
      { name: "journals", storageKey: STORAGE_KEYS.journals },
      { name: "chartOfAccounts", storageKey: STORAGE_KEYS.chartOfAccounts },
    ]);
  }
  renderCashFlows();
});
document.addEventListener("DOMContentLoaded", async () => {
  const organization = await getReportOrganization();
  companyNameElement.textContent = organization.name;
});
