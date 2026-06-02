const STORAGE_KEYS = {
  journals: "banikBooksJournals",
  chartOfAccounts: "banikBooksChartOfAccounts",
  ledgers: "banikBooksLedgers",
};

const fromDateInput = document.querySelector("#changes-equity-from");
const toDateInput = document.querySelector("#changes-equity-to");
const tableContainer = document.querySelector("#changes-equity-table");

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
  if (Math.abs(value || 0) < 0.005) {
    return "-";
  }

  return window.BanikAccounting
    ? window.BanikAccounting.formatNumber(value, { absolute: true })
    : Math.abs(Number(value || 0)).toFixed(2);
}

function formatDateForDisplay(dateValue) {
  return window.BanikAccounting ? window.BanikAccounting.formatDate(dateValue) : dateValue;
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

function collectEquityLedgers(items, ledgers = []) {
  if (!Array.isArray(items)) {
    return ledgers;
  }

  items.forEach((item) => {
    if (!item || typeof item !== "object") {
      return;
    }

    if (item.type === "ledger" && normalizeClassification(item.classification) === "Equity" && item.name) {
      ledgers.push(item.name);
    }

    collectEquityLedgers(item.children || [], ledgers);
  });

  return ledgers;
}

function getStoredEquityLedgers() {
  return safeReadArray(STORAGE_KEYS.ledgers)
    .map((ledger) => {
      if (!ledger || typeof ledger !== "object") {
        return null;
      }

      const name = ledger.name || ledger.ledgerName || ledger.accountName || ledger.title || "";
      return normalizeClassification(ledger.classification) === "Equity" && name ? name : null;
    })
    .filter(Boolean);
}

function getEquityColumns() {
  const names = [...collectEquityLedgers(safeReadArray(STORAGE_KEYS.chartOfAccounts)), ...getStoredEquityLedgers()];
  const uniqueNames = [];
  const seen = new Set();

  names.forEach((name) => {
    const key = normalizeSearchText(name);
    if (!key || seen.has(key)) {
      return;
    }

    seen.add(key);
    uniqueNames.push(name);
  });

  if (!uniqueNames.some((name) => /retained/i.test(name))) {
    uniqueNames.push("Retained Earnings");
  }

  return uniqueNames.length ? uniqueNames : ["Share Capital", "Share Money Deposit", "Retained Earnings"];
}

function getDisplayColumnName(name) {
  return String(name || "").replace(/^Paid Up\s+/i, "");
}

function getDateRangeLabels() {
  return {
    opening: fromDateInput.value ? `Balance at ${formatDateForDisplay(fromDateInput.value)}` : "Opening Balance",
    closing: toDateInput.value ? `Balance at ${formatDateForDisplay(toDateInput.value)}` : "Closing Balance",
    period: fromDateInput.value || toDateInput.value
      ? `${fromDateInput.value ? formatDateForDisplay(fromDateInput.value) : "Beginning"} to ${toDateInput.value ? formatDateForDisplay(toDateInput.value) : "End"}`
      : "Selected Period",
  };
}

function getLedgerClassifications() {
  const map = new Map();

  function scan(items) {
    if (!Array.isArray(items)) {
      return;
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

      scan(item.children || []);
    });
  }

  scan(safeReadArray(STORAGE_KEYS.chartOfAccounts));

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

  if (/(capital|equity|retained|share)/.test(normalized)) {
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

function getStatementData() {
  const fromDate = fromDateInput.value;
  const toDate = toDateInput.value;
  const columns = getEquityColumns();
  const retainedColumn = columns.find((name) => /retained/i.test(name)) || columns[columns.length - 1];
  const columnKeys = new Map(columns.map((name) => [normalizeSearchText(name), name]));
  const classifications = getLedgerClassifications();
  const data = {
    columns,
    retainedColumn,
    opening: Object.fromEntries(columns.map((name) => [name, 0])),
    additions: Object.fromEntries(columns.map((name) => [name, 0])),
    adjustments: Object.fromEntries(columns.map((name) => [name, 0])),
    netProfit: Object.fromEntries(columns.map((name) => [name, 0])),
  };
  let income = 0;
  let expenses = 0;

  getSortedJournals().forEach((journal) => {
    const journalDate = String(journal.journalDate || "");
    const isBeforePeriod = fromDate && journalDate < fromDate;
    const isAfterPeriod = toDate && journalDate > toDate;

    if (isAfterPeriod) {
      return;
    }

    (Array.isArray(journal.lines) ? journal.lines : []).forEach((line) => {
      const account = String((line && line.account) || "").trim();
      const key = normalizeSearchText(account);
      const classification = classifications.get(key) || inferClassification(account);
      const debit = parseAmount(line.debit);
      const credit = parseAmount(line.credit);

      if (classification === "Equity" && columnKeys.has(key)) {
        const column = columnKeys.get(key);
        const movement = credit - debit;

        if (isBeforePeriod) {
          data.opening[column] += movement;
        } else {
          if (movement > 0) {
            data.additions[column] += movement;
          } else if (movement < 0) {
            data.adjustments[column] += Math.abs(movement);
          }
        }
      } else if (!isBeforePeriod && classification === "Income") {
        income += credit - debit;
      } else if (!isBeforePeriod && classification === "Expense") {
        expenses += debit - credit;
      }
    });
  });

  data.netProfit[retainedColumn] = income - expenses;
  data.closing = Object.fromEntries(
    columns.map((name) => [
      name,
      data.opening[name] + data.additions[name] - data.adjustments[name] + data.netProfit[name],
    ])
  );

  return data;
}

function sumRow(row, columns) {
  return columns.reduce((total, column) => total + (row[column] || 0), 0);
}

function buildAmountCells(row, columns) {
  return columns.map((column) => `<div>${escapeHtml(formatAmount(row[column]))}</div>`).join("");
}

function buildRow(label, row, columns, className = "") {
  return `
    <div class="changes-equity-grid ${className}">
      <div>${escapeHtml(label)}</div>
      ${buildAmountCells(row, columns)}
      <div>${escapeHtml(formatAmount(sumRow(row, columns)))}</div>
    </div>
  `;
}

function renderChangesInEquity() {
  const data = getStatementData();
  const labels = getDateRangeLabels();
  const columnCount = data.columns.length + 2;

  tableContainer.style.setProperty("--changes-equity-columns", `minmax(300px, 1.35fr) repeat(${data.columns.length + 1}, minmax(150px, 0.72fr))`);
  tableContainer.innerHTML = `
    <div class="changes-equity-period" style="grid-column: 1 / span ${columnCount};">${escapeHtml(labels.period)}</div>
    <div class="changes-equity-grid changes-equity-grid--head">
      <div>Particulars</div>
      ${data.columns.map((name) => `<div>${escapeHtml(getDisplayColumnName(name))}</div>`).join("")}
      <div>Total Equity</div>
    </div>
    ${buildRow(labels.opening, data.opening, data.columns, "changes-equity-grid--strong")}
    ${buildRow("Add: Addition during the year", data.additions, data.columns)}
    ${buildRow("Less: Adjustment during the year", data.adjustments, data.columns)}
    ${buildRow("Net Profit/(Loss) after tax for the year", data.netProfit, data.columns)}
    ${buildRow(labels.closing, data.closing, data.columns, "changes-equity-grid--total")}
  `;
}

fromDateInput.addEventListener("change", renderChangesInEquity);
toDateInput.addEventListener("change", renderChangesInEquity);

document.addEventListener("DOMContentLoaded", async () => {
  if (window.BanikAccounting) await window.BanikAccounting.ready();
  renderChangesInEquity();
});
