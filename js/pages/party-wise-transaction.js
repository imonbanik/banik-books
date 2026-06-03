const STORAGE_KEYS = {
  journals: "banikBooksJournals",
  parties: "banikBooksParties",
};

const fromDateInput = document.querySelector("#party-wise-transaction-from");
const toDateInput = document.querySelector("#party-wise-transaction-to");
const searchInput = document.querySelector("#party-wise-transaction-search");
const accountSelect = document.querySelector("#party-wise-transaction-account");
const excelButton = document.querySelector("#party-wise-transaction-excel");
const printButton = document.querySelector("#party-wise-transaction-print");
const partyGroups = document.querySelector("#party-wise-transaction-groups");

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

function getPartyDisplayName(party) {
  if (!party) {
    return "";
  }

  return party.partyName || party.name || party.employeeName || party.bankName || party.accountName || "";
}

function getPartyDisplayLabel(party, parties = safeReadArray(STORAGE_KEYS.parties)) {
  const name = getPartyDisplayName(party);

  if (!name) {
    return "";
  }

  const duplicateNameCount = parties.filter(
    (item) => normalizeSearchText(getPartyDisplayName(item)) === normalizeSearchText(name)
  ).length;

  return duplicateNameCount > 1 && party.type ? `${name} (${party.type})` : name;
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

function getPartyLedgerOptions() {
  const ledgerMap = new Map();

  getSortedJournals().forEach((journal) => {
    const lines = Array.isArray(journal.lines) ? journal.lines : [];

    lines.forEach((line) => {
      const partyKey = getPartyKeyFromLine(line);
      const account = String((line && line.account) || "").trim();

      if (!account || !partyKey || partyKey === "name:") {
        return;
      }

      const key = normalizeSearchText(account);
      if (!ledgerMap.has(key)) {
        ledgerMap.set(key, account);
      }
    });
  });

  return [...ledgerMap.values()].sort((left, right) =>
    left.localeCompare(right, undefined, {
      numeric: true,
      sensitivity: "base",
    })
  );
}

function renderPartyLedgerOptions() {
  const selectedValue = accountSelect.value;
  const ledgers = getPartyLedgerOptions();

  accountSelect.innerHTML = `
    <option value="">All party ledgers</option>
    ${ledgers.map((ledger) => `<option value="${escapeHtml(ledger)}">${escapeHtml(ledger)}</option>`).join("")}
  `;

  if (ledgers.includes(selectedValue)) {
    accountSelect.value = selectedValue;
  }
}

function getPartyKeyFromLine(line) {
  if (line && line.partyId) {
    return `id:${line.partyId}`;
  }

  return `name:${normalizeSearchText(line && line.name)}`;
}

function getSavedPartyMap() {
  const partyMap = new Map();
  const parties = safeReadArray(STORAGE_KEYS.parties);

  parties.forEach((party) => {
    if (!party || !party.id) {
      return;
    }

    const label = getPartyDisplayLabel(party, parties);
    if (label) {
      partyMap.set(`id:${party.id}`, label);
    }
  });

  return partyMap;
}

function ensureParty(partyMap, key, name) {
  const partyName = String(name || "").trim();

  if (!key || key === "name:" || !partyName) {
    return null;
  }

  if (!partyMap.has(key)) {
    partyMap.set(key, {
      name: partyName,
      entries: [],
      opening: 0,
      debit: 0,
      credit: 0,
      closing: 0,
    });
  }

  return partyMap.get(key);
}

function buildPartyGroups() {
  const fromDate = fromDateInput.value;
  const toDate = toDateInput.value;
  const selectedAccount = normalizeSearchText(accountSelect.value);
  const savedPartyLabels = getSavedPartyMap();
  const partyMap = new Map();

  getSortedJournals().forEach((journal) => {
    const journalDate = String(journal.journalDate || "");
    const lines = Array.isArray(journal.lines) ? journal.lines : [];

    lines.forEach((line) => {
      const partyKey = getPartyKeyFromLine(line);
      const lineAccount = String((line && line.account) || "").trim();

      if (selectedAccount && normalizeSearchText(lineAccount) !== selectedAccount) {
        return;
      }

      const partyName = savedPartyLabels.get(partyKey) || line.name || "";
      const party = ensureParty(partyMap, partyKey, partyName);

      if (!party) {
        return;
      }

      const debit = parseAmount(line.debit);
      const credit = parseAmount(line.credit);
      const movement = debit - credit;

      if (fromDate && journalDate < fromDate) {
        party.opening += movement;
        party.closing += movement;
        return;
      }

      if (toDate && journalDate > toDate) {
        return;
      }

      const opening = party.closing;
      party.closing += movement;
      party.debit += debit;
      party.credit += credit;
      party.entries.push({
        journalDate,
        journalNumber: journal.number || "",
        account: lineAccount,
        description: line.description || "",
        opening,
        debit,
        credit,
        balance: party.closing,
      });
    });
  });

  return [...partyMap.values()]
    .filter((party) => party.entries.length > 0)
    .filter((party) => searchIncludes(party.name, searchInput.value))
    .sort((left, right) =>
      left.name.localeCompare(right.name, undefined, {
        numeric: true,
        sensitivity: "base",
      })
    );
}

function buildEntryRows(party) {
  if (!party.entries.length) {
    return `
      <div class="general-ledger-grid party-wise-transaction-grid party-wise-transaction-grid--empty-row">
        <div>No transactions in selected date range.</div>
      </div>
    `;
  }

  return party.entries
    .map(
      (entry) => `
        <div class="general-ledger-grid party-wise-transaction-grid">
          <div>${escapeHtml(formatDateForDisplay(entry.journalDate))}</div>
          <div><a class="general-ledger-link" href="./journal-entry.html?journal=${encodeURIComponent(entry.journalNumber)}&return=party-wise-transaction">${escapeHtml(entry.journalNumber)}</a></div>
          <div>${escapeHtml(entry.account)}</div>
          <div>${escapeHtml(entry.description)}</div>
          <div>${escapeHtml(formatTableAmount(entry.opening))}</div>
          <div>${escapeHtml(formatTableAmount(entry.debit))}</div>
          <div>${escapeHtml(formatTableAmount(entry.credit))}</div>
          <div class="${entry.balance >= 0 ? "general-ledger-balance--debit" : "general-ledger-balance--credit"}">${escapeHtml(formatBalance(entry.balance))}</div>
        </div>
      `
    )
    .join("");
}

function buildPrintPartyRows(party) {
  return party.entries
    .map(
      (entry) => `
        <tr>
          <td class="print-date">${escapeHtml(formatDateForDisplay(entry.journalDate))}</td>
          <td class="print-journal">${escapeHtml(entry.journalNumber)}</td>
          <td class="print-ledger">${escapeHtml(entry.account)}</td>
          <td class="print-description">${escapeHtml(entry.description)}</td>
          <td class="print-money">${escapeHtml(formatTableAmount(entry.opening))}</td>
          <td class="print-money">${escapeHtml(formatTableAmount(entry.debit))}</td>
          <td class="print-money">${escapeHtml(formatTableAmount(entry.credit))}</td>
          <td class="print-money">${escapeHtml(formatBalance(entry.balance))}</td>
        </tr>
      `
    )
    .join("");
}

function buildPrintPartySections(parties) {
  return parties
    .map(
      (party) => `
        <section class="print-report-section">
          <h2>${escapeHtml(party.name)}</h2>
          <table>
            <thead>
              <tr>
                <th class="print-date">Date</th>
                <th class="print-journal">Journal No.</th>
                <th class="print-ledger">Ledger</th>
                <th class="print-description">Description</th>
                <th class="print-money">Opening</th>
                <th class="print-money">Debit</th>
                <th class="print-money">Credit</th>
                <th class="print-money">Balance</th>
              </tr>
            </thead>
            <tbody>${buildPrintPartyRows(party)}</tbody>
            <tfoot>
              <tr>
                <td></td>
                <td></td>
                <td></td>
                <td>Total</td>
                <td class="print-money">${escapeHtml(formatTableAmount(party.opening))}</td>
                <td class="print-money">${escapeHtml(formatTableAmount(party.debit))}</td>
                <td class="print-money">${escapeHtml(formatTableAmount(party.credit))}</td>
                <td class="print-money">${escapeHtml(formatBalance(party.closing))}</td>
              </tr>
            </tfoot>
          </table>
        </section>
      `
    )
    .join("");
}

function buildExcelPartyRows(party) {
  return party.entries
    .map(
      (entry) => `
        <tr>
          <td>${escapeHtml(formatDateForDisplay(entry.journalDate))}</td>
          <td style="mso-number-format:'\\@';">${escapeHtml(entry.journalNumber)}</td>
          <td>${escapeHtml(entry.account)}</td>
          <td>${escapeHtml(entry.description)}</td>
          <td>${escapeHtml(formatTableAmount(entry.opening))}</td>
          <td>${escapeHtml(formatTableAmount(entry.debit))}</td>
          <td>${escapeHtml(formatTableAmount(entry.credit))}</td>
          <td>${escapeHtml(formatBalance(entry.balance))}</td>
        </tr>
      `
    )
    .join("");
}

function buildExcelPartySections(parties) {
  return parties
    .map(
      (party) => `
        <tr><td colspan="8"><strong>${escapeHtml(party.name)}</strong></td></tr>
        <tr>
          <th>Date</th>
          <th>Journal No.</th>
          <th>Ledger</th>
          <th>Description</th>
          <th>Opening</th>
          <th>Debit</th>
          <th>Credit</th>
          <th>Balance</th>
        </tr>
        ${buildExcelPartyRows(party)}
        <tr>
          <td></td>
          <td></td>
          <td></td>
          <td><strong>Total</strong></td>
          <td><strong>${escapeHtml(formatTableAmount(party.opening))}</strong></td>
          <td><strong>${escapeHtml(formatTableAmount(party.debit))}</strong></td>
          <td><strong>${escapeHtml(formatTableAmount(party.credit))}</strong></td>
          <td><strong>${escapeHtml(formatBalance(party.closing))}</strong></td>
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
      width: 34mm;
    }

    .print-ledger {
      width: 46mm;
    }

    .print-description {
      width: 58mm;
    }

    .print-money {
      width: 25mm;
      text-align: right;
      white-space: nowrap;
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

async function printPartyWiseTransaction() {
  const parties = buildPartyGroups();

  if (!parties.length) {
    window.alert("No party wise transaction found for printing.");
    return;
  }

  const organization = await getPrintOrganization();
  const relatedLedger = accountSelect.value.trim();
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
        <title>Party Wise Transaction</title>
        <style>${getReportPrintStyles()}</style>
      </head>
      <body>
        <main class="print-page">
          <section class="print-organization">
            <div class="print-organization-name">${escapeHtml(organization.name)}</div>
            <div>${escapeHtml(organization.address)}</div>
          </section>
          <h1 class="print-title">Party Wise Transaction</h1>
          <div class="print-subtitle">
            ${escapeHtml(formatPrintDateRange())}${relatedLedger ? ` | Related Ledger: ${escapeHtml(relatedLedger)}` : ""}
          </div>
          ${buildPrintPartySections(parties)}
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

async function downloadPartyWiseTransactionExcel() {
  const parties = buildPartyGroups();

  if (!parties.length) {
    window.alert("No party wise transaction found for Excel export.");
    return;
  }

  const organization = await getPrintOrganization();
  const relatedLedger = accountSelect.value.trim();
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
            <tr><td colspan="8"><strong>Party Wise Transaction</strong></td></tr>
            <tr>
              <td colspan="8">
                ${escapeHtml(formatPrintDateRange())}${relatedLedger ? ` | Related Ledger: ${escapeHtml(relatedLedger)}` : ""}
              </td>
            </tr>
            <tr><td colspan="8"></td></tr>
            ${buildExcelPartySections(parties)}
          </tbody>
        </table>
      </body>
    </html>
  `;

  downloadExcelReport(`party-wise-transaction-${datePart}.xls`, excelHtml);
}

function renderPartyWiseLedger() {
  const parties = buildPartyGroups();

  partyGroups.innerHTML = "";

  if (!parties.length) {
    const empty = document.createElement("div");
    empty.className = "general-ledger-empty";
    empty.textContent = "No party transactions found.";
    partyGroups.append(empty);
  } else {
    parties.forEach((party) => {
      const group = document.createElement("article");
      group.className = "general-ledger-group";
      group.innerHTML = `
        <header class="general-ledger-group__head">
          <h2>${escapeHtml(party.name)}</h2>
        </header>
        <div class="general-ledger-scroll">
          <div class="general-ledger-table party-wise-transaction-table">
            <div class="general-ledger-grid party-wise-transaction-grid general-ledger-grid--head">
              <div>Date</div>
              <div>Journal No.</div>
              <div>Ledger</div>
              <div>Description</div>
              <div>Opening</div>
              <div>Debit</div>
              <div>Credit</div>
              <div>Balance</div>
            </div>
            ${buildEntryRows(party)}
            <div class="general-ledger-grid party-wise-transaction-grid general-ledger-grid--total">
              <div></div>
              <div></div>
              <div></div>
              <div>Total</div>
              <div>${escapeHtml(formatTableAmount(party.opening))}</div>
              <div>${escapeHtml(formatTableAmount(party.debit))}</div>
              <div>${escapeHtml(formatTableAmount(party.credit))}</div>
              <div>${escapeHtml(formatBalance(party.closing))}</div>
            </div>
          </div>
        </div>
      `;
      partyGroups.append(group);
    });
  }
}

fromDateInput.addEventListener("change", renderPartyWiseLedger);
toDateInput.addEventListener("change", renderPartyWiseLedger);
searchInput.addEventListener("input", renderPartyWiseLedger);
accountSelect.addEventListener("change", renderPartyWiseLedger);
excelButton.addEventListener("click", downloadPartyWiseTransactionExcel);
printButton.addEventListener("click", printPartyWiseTransaction);

document.addEventListener("DOMContentLoaded", async () => {
  if (window.BanikAccounting) await window.BanikAccounting.ready();
  if (window.BanikReportData) {
    await window.BanikReportData.hydrateCollections([
      { name: "journals", storageKey: STORAGE_KEYS.journals },
      { name: "parties", storageKey: STORAGE_KEYS.parties },
    ]);
  }
  renderPartyLedgerOptions();
  renderPartyWiseLedger();
});
