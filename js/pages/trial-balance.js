const STORAGE_KEYS = {
  journals: "banikBooksJournals",
  chartOfAccounts: "banikBooksChartOfAccounts",
  ledgers: "banikBooksLedgers",
};

const fromDateInput = document.querySelector("#trial-balance-from");
const toDateInput = document.querySelector("#trial-balance-to");
const balanceRows = document.querySelector("#trial-balance-rows");
const totalDebitCell = document.querySelector("#trial-balance-total-debit");
const totalCreditCell = document.querySelector("#trial-balance-total-credit");

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

function formatTableAmount(value) {
  return Math.abs(value || 0) < 0.005 ? "-" : formatAmount(value);
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

function normalizeSearchText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function collectChartLedgers(items, ledgers = []) {
  if (!Array.isArray(items)) {
    return ledgers;
  }

  items.forEach((item) => {
    if (item && item.type === "ledger" && item.name) {
      ledgers.push({
        account: String(item.name).trim(),
        openingBalance: parseAmount(item.openingBalance),
        openingBalanceDate: String(item.openingBalanceDate || ""),
      });
      return;
    }

    collectChartLedgers((item && item.children) || [], ledgers);
  });

  return ledgers;
}

function getSavedLedgerRecords() {
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

  collectChartLedgers(safeReadArray(STORAGE_KEYS.chartOfAccounts)).forEach(addRecord);
  safeReadArray(STORAGE_KEYS.ledgers).forEach((ledger) => {
    if (typeof ledger === "string") {
      addRecord({ account: ledger });
      return;
    }

    if (ledger && typeof ledger === "object") {
      addRecord({
        account: ledger.name || ledger.ledgerName || ledger.accountName || ledger.title || "",
        openingBalance: ledger.openingBalance,
        openingBalanceDate: ledger.openingBalanceDate,
      });
    }
  });

  return [...recordMap.values()];
}

function shouldApplyOpeningBalance(balanceDate, toDate) {
  const date = String(balanceDate || "");
  return !date || !toDate || date <= toDate;
}

function getTrialBalanceRows() {
  const fromDate = fromDateInput.value;
  const toDate = toDateInput.value;
  const ledgerMap = new Map();

  getSavedLedgerRecords().forEach((record) => {
    if (!shouldApplyOpeningBalance(record.openingBalanceDate, toDate)) {
      return;
    }

    const key = normalizeSearchText(record.account);
    ledgerMap.set(key, {
      account: record.account,
      balance: parseAmount(record.openingBalance),
    });
  });

  getSortedJournals().forEach((journal) => {
    const journalDate = String(journal.journalDate || "");

    if ((fromDate && journalDate < fromDate) || (toDate && journalDate > toDate)) {
      return;
    }

    const lines = Array.isArray(journal.lines) ? journal.lines : [];

    lines.forEach((line) => {
      const account = String((line && line.account) || "").trim();

      if (!account) {
        return;
      }

      const key = normalizeSearchText(account);
      const existing = ledgerMap.get(key) || {
        account,
        balance: 0,
      };

      existing.balance += parseAmount(line.debit) - parseAmount(line.credit);
      ledgerMap.set(key, existing);
    });
  });

  return [...ledgerMap.values()]
    .filter((ledger) => Math.abs(ledger.balance) >= 0.005)
    .sort((left, right) =>
      left.account.localeCompare(right.account, undefined, {
        numeric: true,
        sensitivity: "base",
      })
    );
}

function renderTrialBalance() {
  const ledgers = getTrialBalanceRows();
  const totals = ledgers.reduce(
    (summary, ledger) => {
      if (ledger.balance > 0) {
        summary.debit += ledger.balance;
      } else {
        summary.credit += Math.abs(ledger.balance);
      }

      return summary;
    },
    { debit: 0, credit: 0 }
  );

  balanceRows.innerHTML = "";

  if (!ledgers.length) {
    balanceRows.innerHTML = `
      <div class="trial-balance-grid trial-balance-grid--empty">
        <div>No non-zero ledger balances found for this date range.</div>
      </div>
    `;
  } else {
    balanceRows.innerHTML = ledgers
      .map((ledger, index) => {
        const debit = ledger.balance > 0 ? ledger.balance : 0;
        const credit = ledger.balance < 0 ? Math.abs(ledger.balance) : 0;

        return `
          <div class="trial-balance-grid">
            <div>${index + 1}</div>
            <div>${escapeHtml(ledger.account)}</div>
            <div>${escapeHtml(formatTableAmount(debit))}</div>
            <div>${escapeHtml(formatTableAmount(credit))}</div>
          </div>
        `;
      })
      .join("");
  }

  totalDebitCell.textContent = formatAmount(totals.debit);
  totalCreditCell.textContent = formatAmount(totals.credit);
}

fromDateInput.addEventListener("change", renderTrialBalance);
toDateInput.addEventListener("change", renderTrialBalance);

document.addEventListener("DOMContentLoaded", async () => {
  if (window.BanikAccounting) await window.BanikAccounting.ready();
  renderTrialBalance();
});
