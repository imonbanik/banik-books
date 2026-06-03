const STORAGE_KEYS = {
  journals: "banikBooksJournals",
  ledgers: "banikBooksLedgers",
  chartOfAccounts: "banikBooksChartOfAccounts",
};

const fromDateInput = document.querySelector("#general-ledger-from");
const toDateInput = document.querySelector("#general-ledger-to");
const searchInput = document.querySelector("#general-ledger-search");
const excelButton = document.querySelector("#general-ledger-excel");
const printButton = document.querySelector("#general-ledger-print");
const ledgerGroups = document.querySelector("#general-ledger-groups");

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

function formatDateForDisplay(dateValue) {
  return window.BanikAccounting ? window.BanikAccounting.formatDate(dateValue) : dateValue;
}

function formatBalance(value) {
  if (Math.abs(value) < 0.005) {
    return "0.00";
  }

  return `${formatAmount(value)} ${value > 0 ? "Dr" : "Cr"}`;
}

function formatTableAmount(value) {
  return Math.abs(value || 0) < 0.005 ? "-" : formatAmount(value);
}

function normalizeSearchText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function searchIncludes(target, query) {
  const normalizedQuery = normalizeSearchText(query);

  if (!normalizedQuery) {
    return true;
  }

  return normalizeSearchText(target).includes(normalizedQuery);
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

function formatPrintDateRange() {
  const fromDate = fromDateInput.value ? formatDateForDisplay(fromDateInput.value) : "All";
  const toDate = toDateInput.value ? formatDateForDisplay(toDateInput.value) : "All";

  return `From: ${fromDate} | To: ${toDate}`;
}

function getLedgerKey(name) {
  return normalizeSearchText(name);
}

function collectChartLedgers(items, ledgers = []) {
  if (!Array.isArray(items)) {
    return ledgers;
  }

  items.forEach((item) => {
    if (item && item.type === "ledger" && item.name) {
      ledgers.push({
        name: String(item.name).trim(),
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
  const chartLedgers = collectChartLedgers(safeReadArray(STORAGE_KEYS.chartOfAccounts));
  const storedLedgers = safeReadArray(STORAGE_KEYS.ledgers)
    .map((ledger) => {
      if (typeof ledger === "string") {
        return { name: ledger, openingBalance: 0, openingBalanceDate: "" };
      }

      if (!ledger || typeof ledger !== "object") {
        return null;
      }

      return {
        name: ledger.name || ledger.ledgerName || ledger.accountName || ledger.title || "",
        openingBalance: parseAmount(ledger.openingBalance),
        openingBalanceDate: String(ledger.openingBalanceDate || ""),
      };
    })
    .filter(Boolean)
    .map((ledger) => ({
      ...ledger,
      name: String(ledger.name || "").trim(),
    }))
    .filter((ledger) => ledger.name);

  const recordMap = new Map();

  [...chartLedgers, ...storedLedgers].forEach((ledger) => {
    const key = getLedgerKey(ledger.name);
    if (!key || recordMap.has(key)) {
      return;
    }

    recordMap.set(key, ledger);
  });

  return [...recordMap.values()];
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

function ensureLedger(ledgerMap, name) {
  const ledgerName = String(name || "").trim();

  if (!ledgerName) {
    return null;
  }

  const key = getLedgerKey(ledgerName);

  if (!ledgerMap.has(key)) {
    ledgerMap.set(key, {
      name: ledgerName,
      entries: [],
      opening: 0,
      debit: 0,
      credit: 0,
      closing: 0,
    });
  }

  return ledgerMap.get(key);
}

function shouldApplyOpeningBalance(balanceDate, fromDate, toDate) {
  const date = String(balanceDate || "");

  if (!date) {
    return true;
  }

  if (toDate && date > toDate) {
    return false;
  }

  return !fromDate || date < fromDate || date <= toDate;
}

function buildLedgerGroups() {
  const fromDate = fromDateInput.value;
  const toDate = toDateInput.value;
  const ledgerMap = new Map();

  getSavedLedgerRecords().forEach((record) => {
    const ledger = ensureLedger(ledgerMap, record.name);

    if (!ledger || !shouldApplyOpeningBalance(record.openingBalanceDate, fromDate, toDate)) {
      return;
    }

    ledger.opening += record.openingBalance;
    ledger.closing += record.openingBalance;
  });

  getSortedJournals().forEach((journal) => {
    const journalDate = String(journal.journalDate || "");
    const lines = Array.isArray(journal.lines) ? journal.lines : [];

    lines.forEach((line) => {
      const ledger = ensureLedger(ledgerMap, line.account);

      if (!ledger) {
        return;
      }

      const debit = parseAmount(line.debit);
      const credit = parseAmount(line.credit);
      const movement = debit - credit;

      if (fromDate && journalDate < fromDate) {
        ledger.opening += movement;
        ledger.closing += movement;
        return;
      }

      if (toDate && journalDate > toDate) {
        return;
      }

      const opening = ledger.closing;
      ledger.closing += movement;
      ledger.debit += debit;
      ledger.credit += credit;
      ledger.entries.push({
        journalDate,
        journalNumber: journal.number || "",
        description: line.description || "",
        name: line.name || "",
        opening,
        debit,
        credit,
        balance: ledger.closing,
      });
    });
  });

  return [...ledgerMap.values()]
    .filter((ledger) => ledger.entries.length > 0 || Math.abs(ledger.opening) >= 0.005)
    .filter((ledger) => searchIncludes(ledger.name, searchInput.value))
    .sort((left, right) =>
      left.name.localeCompare(right.name, undefined, {
        numeric: true,
        sensitivity: "base",
      })
    );
}

function buildEntryRows(ledger) {
  if (!ledger.entries.length) {
    return `
      <div class="general-ledger-grid general-ledger-grid--empty-row">
        <div>No transactions in selected date range.</div>
      </div>
    `;
  }

  return ledger.entries
    .map(
      (entry) => `
        <div class="general-ledger-grid">
          <div>${escapeHtml(formatDateForDisplay(entry.journalDate))}</div>
          <div><a class="general-ledger-link" href="./journal-entry.html?journal=${encodeURIComponent(entry.journalNumber)}&return=general-ledger">${escapeHtml(entry.journalNumber)}</a></div>
          <div>${escapeHtml(entry.description)}</div>
          <div>${escapeHtml(formatTableAmount(entry.opening))}</div>
          <div>${escapeHtml(formatTableAmount(entry.debit))}</div>
          <div>${escapeHtml(formatTableAmount(entry.credit))}</div>
          <div class="${entry.balance >= 0 ? "general-ledger-balance--debit" : "general-ledger-balance--credit"}">${escapeHtml(formatBalance(entry.balance))}</div>
          <div>${escapeHtml(entry.name)}</div>
        </div>
      `
    )
    .join("");
}

function renderGeneralLedger() {
  const ledgers = buildLedgerGroups();

  ledgerGroups.innerHTML = "";

  if (!ledgers.length) {
    const empty = document.createElement("div");
    empty.className = "general-ledger-empty";
    empty.textContent = "No ledgers found.";
    ledgerGroups.append(empty);
  } else {
    ledgers.forEach((ledger) => {
      const group = document.createElement("article");
      group.className = "general-ledger-group";
      group.innerHTML = `
        <header class="general-ledger-group__head">
          <h2>${escapeHtml(ledger.name)}</h2>
        </header>
        <div class="general-ledger-scroll">
          <div class="general-ledger-table">
            <div class="general-ledger-grid general-ledger-grid--head">
              <div>Date</div>
              <div>Journal No.</div>
              <div>Description</div>
              <div>Opening</div>
              <div>Debit</div>
              <div>Credit</div>
              <div>Balance</div>
              <div>Name</div>
            </div>
            ${buildEntryRows(ledger)}
            <div class="general-ledger-grid general-ledger-grid--total">
              <div></div>
              <div></div>
              <div>Total</div>
              <div>${escapeHtml(formatTableAmount(ledger.opening))}</div>
              <div>${escapeHtml(formatTableAmount(ledger.debit))}</div>
              <div>${escapeHtml(formatTableAmount(ledger.credit))}</div>
              <div>${escapeHtml(formatBalance(ledger.closing))}</div>
              <div></div>
            </div>
          </div>
        </div>
      `;
      ledgerGroups.append(group);
    });
  }
}

function buildPrintLedgerRows(ledger) {
  return ledger.entries
    .map(
      (entry) => `
        <tr>
          <td class="print-date">${escapeHtml(formatDateForDisplay(entry.journalDate))}</td>
          <td class="print-journal">${escapeHtml(entry.journalNumber)}</td>
          <td class="print-description">${escapeHtml(entry.description)}</td>
          <td class="print-money">${escapeHtml(formatTableAmount(entry.opening))}</td>
          <td class="print-money">${escapeHtml(formatTableAmount(entry.debit))}</td>
          <td class="print-money">${escapeHtml(formatTableAmount(entry.credit))}</td>
          <td class="print-money">${escapeHtml(formatBalance(entry.balance))}</td>
          <td class="print-name">${escapeHtml(entry.name)}</td>
        </tr>
      `
    )
    .join("");
}

function buildPrintLedgerSections(ledgers) {
  return ledgers
    .map(
      (ledger) => `
        <section class="print-report-section">
          <h2>${escapeHtml(ledger.name)}</h2>
          <table>
            <thead>
              <tr>
                <th class="print-date">Date</th>
                <th class="print-journal">Journal No.</th>
                <th class="print-description">Description</th>
                <th class="print-money">Opening</th>
                <th class="print-money">Debit</th>
                <th class="print-money">Credit</th>
                <th class="print-money">Balance</th>
                <th class="print-name">Name</th>
              </tr>
            </thead>
            <tbody>${buildPrintLedgerRows(ledger)}</tbody>
            <tfoot>
              <tr>
                <td></td>
                <td></td>
                <td>Total</td>
                <td class="print-money">${escapeHtml(formatTableAmount(ledger.opening))}</td>
                <td class="print-money">${escapeHtml(formatTableAmount(ledger.debit))}</td>
                <td class="print-money">${escapeHtml(formatTableAmount(ledger.credit))}</td>
                <td class="print-money">${escapeHtml(formatBalance(ledger.closing))}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </section>
      `
    )
    .join("");
}

function buildExcelLedgerRows(ledger) {
  return ledger.entries
    .map(
      (entry) => `
        <tr>
          <td>${escapeHtml(formatDateForDisplay(entry.journalDate))}</td>
          <td style="mso-number-format:'\\@';">${escapeHtml(entry.journalNumber)}</td>
          <td>${escapeHtml(entry.description)}</td>
          <td>${escapeHtml(formatTableAmount(entry.opening))}</td>
          <td>${escapeHtml(formatTableAmount(entry.debit))}</td>
          <td>${escapeHtml(formatTableAmount(entry.credit))}</td>
          <td>${escapeHtml(formatBalance(entry.balance))}</td>
          <td>${escapeHtml(entry.name)}</td>
        </tr>
      `
    )
    .join("");
}

function buildExcelLedgerSections(ledgers) {
  return ledgers
    .map(
      (ledger) => `
        <tr><td colspan="8"><strong>${escapeHtml(ledger.name)}</strong></td></tr>
        <tr>
          <th>Date</th>
          <th>Journal No.</th>
          <th>Description</th>
          <th>Opening</th>
          <th>Debit</th>
          <th>Credit</th>
          <th>Balance</th>
          <th>Name</th>
        </tr>
        ${buildExcelLedgerRows(ledger)}
        <tr>
          <td></td>
          <td></td>
          <td><strong>Total</strong></td>
          <td><strong>${escapeHtml(formatTableAmount(ledger.opening))}</strong></td>
          <td><strong>${escapeHtml(formatTableAmount(ledger.debit))}</strong></td>
          <td><strong>${escapeHtml(formatTableAmount(ledger.credit))}</strong></td>
          <td><strong>${escapeHtml(formatBalance(ledger.closing))}</strong></td>
          <td></td>
        </tr>
        <tr><td colspan="8"></td></tr>
      `
    )
    .join("");
}

function downloadExcelReport(filename, excelHtml) {
  const blob = new Blob(["\ufeff" + excelHtml], {
    type: "application/vnd.ms-excel;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function getReportPrintStyles() {
  return `
    @page {
      size: A4 landscape;
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
      font-size: 9.5pt;
    }

    .print-page {
      width: 297mm;
      min-height: 210mm;
      margin: 0 auto;
      padding: 14mm 12mm;
      background: #ffffff;
    }

    .print-organization,
    .print-title,
    .print-subtitle {
      text-align: center;
    }

    .print-organization {
      font-weight: 700;
      line-height: 1.3;
    }

    .print-organization-name {
      font-size: 13pt;
    }

    .print-title {
      margin: 8px 0 3px;
      font-size: 13pt;
      font-weight: 700;
      text-transform: none;
    }

    .print-subtitle {
      margin-bottom: 7px;
      font-weight: 700;
    }

    .print-report-section {
      margin-top: 8px;
      break-inside: avoid;
    }

    .print-report-section h2 {
      margin: 0 0 4px;
      font-size: 10.5pt;
      font-weight: 700;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }

    th,
    td {
      border: 0.8px solid #000000;
      padding: 4px 5px;
      vertical-align: middle;
      line-height: 1.25;
      overflow-wrap: anywhere;
    }

    th,
    tfoot td {
      font-weight: 700;
      text-align: center;
    }

    .print-date {
      width: 22mm;
      text-align: center;
    }

    .print-journal {
      width: 36mm;
    }

    .print-description {
      width: 58mm;
    }

    .print-money {
      width: 27mm;
      text-align: right;
      white-space: nowrap;
    }

    .print-name {
      width: 42mm;
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
  `;
}

async function printGeneralLedger() {
  const ledgers = buildLedgerGroups();

  if (!ledgers.length) {
    window.alert("No general ledger transactions found for printing.");
    return;
  }

  const organization = await getPrintOrganization();
  const printWindow = window.open("", "_blank");

  if (!printWindow) {
    window.alert("Please allow popups to print this report.");
    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <title>General Ledger</title>
        <style>${getReportPrintStyles()}</style>
      </head>
      <body>
        <main class="print-page">
          <section class="print-organization">
            <div class="print-organization-name">${escapeHtml(organization.name)}</div>
            <div>${escapeHtml(organization.address)}</div>
          </section>
          <h1 class="print-title">General Ledger</h1>
          <div class="print-subtitle">${escapeHtml(formatPrintDateRange())}</div>
          ${buildPrintLedgerSections(ledgers)}
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

async function downloadGeneralLedgerExcel() {
  const ledgers = buildLedgerGroups();

  if (!ledgers.length) {
    window.alert("No general ledger transactions found for Excel export.");
    return;
  }

  const organization = await getPrintOrganization();
  const datePart = new Date().toISOString().slice(0, 10);
  const excelHtml = `
    <!doctype html>
    <html>
      <head>
        <meta charset="UTF-8" />
      </head>
      <body>
        <table border="1">
          <tbody>
            <tr><td colspan="8"><strong>${escapeHtml(organization.name)}</strong></td></tr>
            <tr><td colspan="8">${escapeHtml(organization.address)}</td></tr>
            <tr><td colspan="8"><strong>General Ledger</strong></td></tr>
            <tr><td colspan="8">${escapeHtml(formatPrintDateRange())}</td></tr>
            <tr><td colspan="8"></td></tr>
            ${buildExcelLedgerSections(ledgers)}
          </tbody>
        </table>
      </body>
    </html>
  `;

  downloadExcelReport(`general-ledger-${datePart}.xls`, excelHtml);
}

fromDateInput.addEventListener("change", renderGeneralLedger);
toDateInput.addEventListener("change", renderGeneralLedger);
searchInput.addEventListener("input", renderGeneralLedger);
excelButton.addEventListener("click", downloadGeneralLedgerExcel);
printButton.addEventListener("click", printGeneralLedger);

document.addEventListener("DOMContentLoaded", async () => {
  if (window.BanikAccounting) await window.BanikAccounting.ready();
  if (window.BanikReportData) {
    await window.BanikReportData.hydrateCollections([
      { name: "journals", storageKey: STORAGE_KEYS.journals },
      { name: "chartOfAccounts", storageKey: STORAGE_KEYS.chartOfAccounts },
    ]);
  }
  renderGeneralLedger();
});
