document.addEventListener("DOMContentLoaded", async () => {
  if (window.BanikAccounting) await window.BanikAccounting.ready();
  const principalInput = document.getElementById("emiPrincipal");
  const interestInput = document.getElementById("emiInterestRate");
  const tenureInput = document.getElementById("emiTenure");
  const monthlyInstalment = document.getElementById("monthlyInstalment");
  const totalPayment = document.getElementById("totalPayment");
  const totalInterest = document.getElementById("totalInterest");
  const scheduleSummary = document.getElementById("emiScheduleSummary");
  const scheduleBody = document.getElementById("emiScheduleBody");
  const downloadExcelButton = document.getElementById("downloadEmiExcel");
  let currentScheduleRows = [];
  let currentScheduleTotals = {
    monthlyInstalment: 0,
    totalPayment: 0,
    totalInterest: 0,
  };

  function parseAmount(value) {
    return Number(String(value || "").replace(/[^\d.]/g, "")) || 0;
  }

  function parseTenure(value) {
    return Math.max(0, Math.floor(Number(String(value || "").replace(/[^\d]/g, "")) || 0));
  }

  function formatTaka(value) {
    return window.BanikAccounting
      ? window.BanikAccounting.formatMoney(value)
      : `BDT ${Number(value || 0).toFixed(2)}`;
  }

  function formatScheduleAmount(value) {
    return window.BanikAccounting
      ? window.BanikAccounting.formatNumber(value)
      : Number(value || 0).toFixed(2);
  }

  function formatNumberInput(input) {
    if (!String(input.value || "").trim()) {
      input.value = "";
      return;
    }

    input.value = formatScheduleAmount(parseAmount(input.value));
  }

  function formatTenureInput(input) {
    if (!String(input.value || "").trim()) {
      input.value = "";
      return;
    }

    input.value = String(parseTenure(input.value));
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function calculateEmi() {
    const principal = parseAmount(principalInput.value);
    const annualRate = parseAmount(interestInput.value);
    const tenure = parseTenure(tenureInput.value);

    if (!principal || !tenure) {
      currentScheduleRows = [];
      currentScheduleTotals = {
        monthlyInstalment: 0,
        totalPayment: 0,
        totalInterest: 0,
      };
      monthlyInstalment.textContent = formatTaka(0);
      totalPayment.textContent = formatTaka(0);
      totalInterest.textContent = formatTaka(0);
      scheduleSummary.textContent = "No schedule yet";
      scheduleBody.innerHTML =
        '<tr><td colspan="6" class="emi-empty-cell">Enter amount, rate, and tenure to see schedule.</td></tr>';
      downloadExcelButton.disabled = true;
      return;
    }

    const monthlyRate = annualRate / 12 / 100;
    const emi = monthlyRate
      ? (principal * monthlyRate * Math.pow(1 + monthlyRate, tenure)) /
        (Math.pow(1 + monthlyRate, tenure) - 1)
      : principal / tenure;
    const rows = [];
    let openingBalance = principal;
    let paymentTotal = 0;
    let interestTotal = 0;

    for (let month = 1; month <= tenure; month += 1) {
      const interest = monthlyRate ? openingBalance * monthlyRate : 0;
      const normalPrincipal = emi - interest;
      const principalPaid = month === tenure ? openingBalance : Math.min(normalPrincipal, openingBalance);
      const payment = principalPaid + interest;
      const closingBalance = Math.max(0, openingBalance - principalPaid);

      rows.push({
        month,
        openingBalance,
        payment,
        principalPaid,
        interest,
        closingBalance,
      });

      paymentTotal += payment;
      interestTotal += interest;
      openingBalance = closingBalance;
    }

    currentScheduleRows = rows;
    currentScheduleTotals = {
      monthlyInstalment: emi,
      totalPayment: paymentTotal,
      totalInterest: interestTotal,
    };
    monthlyInstalment.textContent = formatTaka(emi);
    totalPayment.textContent = formatTaka(paymentTotal);
    totalInterest.textContent = formatTaka(interestTotal);
    scheduleSummary.textContent = `${tenure.toLocaleString("en-IN")} monthly instalments`;
    downloadExcelButton.disabled = false;
    scheduleBody.innerHTML = rows
      .map(
        (row) => `
          <tr>
            <td>${row.month}</td>
            <td>${formatScheduleAmount(row.openingBalance)}</td>
            <td>${formatScheduleAmount(row.payment)}</td>
            <td>${formatScheduleAmount(row.principalPaid)}</td>
            <td>${formatScheduleAmount(row.interest)}</td>
            <td>${formatScheduleAmount(row.closingBalance)}</td>
          </tr>
        `
      )
      .join("");
  }

  function downloadScheduleAsExcel() {
    if (!currentScheduleRows.length) {
      return;
    }

    const principal = parseAmount(principalInput.value);
    const annualRate = parseAmount(interestInput.value);
    const tenure = parseTenure(tenureInput.value);
    const headers = [
      "Month",
      "Opening Balance",
      "Monthly Instalment",
      "Principal",
      "Interest",
      "Closing Balance",
    ];
    const bodyRows = currentScheduleRows
      .map(
        (row) => `
          <tr>
            <td>${escapeHtml(row.month)}</td>
            <td>${escapeHtml(formatScheduleAmount(row.openingBalance))}</td>
            <td>${escapeHtml(formatScheduleAmount(row.payment))}</td>
            <td>${escapeHtml(formatScheduleAmount(row.principalPaid))}</td>
            <td>${escapeHtml(formatScheduleAmount(row.interest))}</td>
            <td>${escapeHtml(formatScheduleAmount(row.closingBalance))}</td>
          </tr>
        `
      )
      .join("");
    const excelHtml = `
      <!doctype html>
      <html>
        <head>
          <meta charset="UTF-8" />
        </head>
        <body>
          <table border="1">
            <tbody>
              <tr><th colspan="2">EMI Repayment Schedule</th></tr>
              <tr><td>Principal Amount</td><td>${escapeHtml(formatTaka(principal))}</td></tr>
              <tr><td>Interest Rate (%)</td><td>${escapeHtml(annualRate.toFixed(2))}</td></tr>
              <tr><td>Tenure in Months</td><td>${escapeHtml(tenure)}</td></tr>
              <tr><td>Monthly Instalment</td><td>${escapeHtml(formatTaka(currentScheduleTotals.monthlyInstalment))}</td></tr>
              <tr><td>Total Payment</td><td>${escapeHtml(formatTaka(currentScheduleTotals.totalPayment))}</td></tr>
              <tr><td>Total Interest</td><td>${escapeHtml(formatTaka(currentScheduleTotals.totalInterest))}</td></tr>
            </tbody>
          </table>
          <br />
          <table border="1">
            <thead>
              <tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr>
            </thead>
            <tbody>${bodyRows}</tbody>
          </table>
        </body>
      </html>
    `;
    const blob = new Blob(["\ufeff" + excelHtml], {
      type: "application/vnd.ms-excel;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const datePart = new Date().toISOString().slice(0, 10);

    link.href = url;
    link.download = `emi-repayment-schedule-${datePart}.xls`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  [principalInput, interestInput].forEach((input) => {
    input.addEventListener("input", () => {
      input.value = String(input.value || "").replace(/[^\d.,]/g, "");
      calculateEmi();
    });
    input.addEventListener("blur", () => {
      formatNumberInput(input);
      calculateEmi();
    });
  });

  tenureInput.addEventListener("input", () => {
    tenureInput.value = String(tenureInput.value || "").replace(/[^\d]/g, "");
    calculateEmi();
  });
  tenureInput.addEventListener("blur", () => {
    formatTenureInput(tenureInput);
    calculateEmi();
  });
  downloadExcelButton.addEventListener("click", downloadScheduleAsExcel);

  calculateEmi();
});
