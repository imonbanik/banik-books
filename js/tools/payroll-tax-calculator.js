document.addEventListener("DOMContentLoaded", async () => {
  if (window.BanikAccounting) await window.BanikAccounting.ready();
  const TAX_RULES = {
    "2025-2026": {
      label: "FY 2025-26",
      salaryExemptionCap: 500000,
      investmentCreditCap: 1000000,
      taxFreeLimits: {
        male: 375000,
        female: 425000,
        senior: 425000,
        disabled: 500000,
        freedomFighter: 525000,
      },
      slabsAfterFreeLimit: [
        { limit: 300000, rate: 0.1 },
        { limit: 400000, rate: 0.15 },
        { limit: 500000, rate: 0.2 },
        { limit: 2000000, rate: 0.25 },
        { limit: Infinity, rate: 0.3 },
      ],
    },
    "2024-2025": {
      label: "FY 2024-25",
      salaryExemptionCap: 450000,
      investmentCreditCap: 1000000,
      taxFreeLimits: {
        male: 350000,
        female: 400000,
        senior: 400000,
        disabled: 475000,
        freedomFighter: 500000,
      },
      slabsAfterFreeLimit: [
        { limit: 100000, rate: 0.05 },
        { limit: 400000, rate: 0.1 },
        { limit: 500000, rate: 0.15 },
        { limit: 500000, rate: 0.2 },
        { limit: 2000000, rate: 0.25 },
        { limit: Infinity, rate: 0.3 },
      ],
    },
  };
  const LOCATION_RULES = {
    dhaka: { label: "Dhaka", minimumTax: 5000 },
    chattogram: { label: "Chattogram", minimumTax: 5000 },
    otherCity: { label: "Other City Corporation", minimumTax: 4000 },
    otherArea: { label: "Other Area", minimumTax: 3000 },
  };

  const taxYearSelect = document.getElementById("taxYearSelect");
  const grossSalaryInput = document.getElementById("grossSalaryInput");
  const locationSelect = document.getElementById("locationSelect");
  const taxpayerCategory = document.getElementById("taxpayerCategory");
  const monthlyBenefitAmount = document.getElementById("monthlyBenefitAmount");
  const yearlyBenefitAmount = document.getElementById("yearlyBenefitAmount");
  const investmentInput = document.getElementById("investmentInput");
  const advanceTaxInput = document.getElementById("advanceTaxInput");
  const calculatePayrollButton = document.getElementById("calculatePayrollButton");
  const calculatePayrollButtonBottom = document.getElementById("calculatePayrollButtonBottom");
  const monthlyBreakdownDonut = document.getElementById("monthlyBreakdownDonut");
  const monthlyTaxValue = document.getElementById("monthlyTaxValue");
  const takeHomeValue = document.getElementById("takeHomeValue");
  const monthlyIncomeValue = document.getElementById("monthlyIncomeValue");
  const grossMonthlyCell = document.getElementById("grossMonthlyCell");
  const grossAnnualCell = document.getElementById("grossAnnualCell");
  const monthlyBenefitCell = document.getElementById("monthlyBenefitCell");
  const monthlyBenefitAnnualCell = document.getElementById("monthlyBenefitAnnualCell");
  const yearlyBenefitMonthlyCell = document.getElementById("yearlyBenefitMonthlyCell");
  const yearlyBenefitCell = document.getElementById("yearlyBenefitCell");
  const totalMonthlyIncomeCell = document.getElementById("totalMonthlyIncomeCell");
  const totalAnnualIncomeCell = document.getElementById("totalAnnualIncomeCell");
  const annualIncomeValue = document.getElementById("annualIncomeValue");
  const taxableIncomeValue = document.getElementById("taxableIncomeValue");
  const taxSlabRows = document.getElementById("taxSlabRows");
  const totalSlabIncome = document.getElementById("totalSlabIncome");
  const totalTaxBeforeCredit = document.getElementById("totalTaxBeforeCredit");
  const totalTaxBeforeCreditFooter = document.getElementById("totalTaxBeforeCreditFooter");
  const investmentCreditRows = document.getElementById("investmentCreditRows");
  const taxCreditAllowed = document.getElementById("taxCreditAllowed");
  const taxableIncomeRows = document.getElementById("taxableIncomeRows");
  const incomeTaxPayable = document.getElementById("incomeTaxPayable");
  const minimumTaxValue = document.getElementById("minimumTaxValue");
  const advanceTaxValue = document.getElementById("advanceTaxValue");
  const remainingTaxLiability = document.getElementById("remainingTaxLiability");
  const remainingTaxLiabilityFooter = document.getElementById("remainingTaxLiabilityFooter");

  function parseMoney(value) {
    return Number(String(value || "").replace(/[^\d.]/g, "")) || 0;
  }

  function formatMoney(value) {
    return window.BanikAccounting
      ? window.BanikAccounting.formatNumber(Math.max(0, Math.round(value || 0)), { digits: 0 })
      : String(Math.max(0, Math.round(value || 0)));
  }

  function formatTk(value) {
    const currency = window.BanikAccounting ? window.BanikAccounting.getPreferences().currency : "BDT";
    return `${currency} ${formatMoney(value)}`;
  }

  function formatInput(input) {
    const amount = parseMoney(input.value);
    input.value = amount ? formatMoney(amount) : "";
  }

  function getActiveRule() {
    return TAX_RULES[taxYearSelect.value] || TAX_RULES["2025-2026"];
  }

  function getActiveLocation() {
    return LOCATION_RULES[locationSelect.value] || LOCATION_RULES.dhaka;
  }

  function calculateSlabTax(taxableIncome, category, rule) {
    const freeLimit = rule.taxFreeLimits[category] || rule.taxFreeLimits.male;
    const rows = [];
    let remainingIncome = taxableIncome;
    let totalTax = 0;
    const freeIncome = Math.min(remainingIncome, freeLimit);

    rows.push({
      slab: "On the first amount",
      taxableAmount: freeIncome,
      slabLimit: freeLimit,
      rate: 0,
      taxAmount: 0,
    });
    remainingIncome = Math.max(0, remainingIncome - freeLimit);

    rule.slabsAfterFreeLimit.forEach((slab) => {
      const taxableAmount = remainingIncome > 0 ? Math.min(remainingIncome, slab.limit) : 0;
      const taxAmount = taxableAmount * slab.rate;

      rows.push({
        slab: slab.limit === Infinity ? "On the balance amount" : "On the next amount",
        taxableAmount,
        slabLimit: slab.limit,
        rate: slab.rate,
        taxAmount,
      });
      totalTax += taxAmount;
      remainingIncome = Math.max(0, remainingIncome - taxableAmount);
    });

    return { rows, totalTax, freeLimit };
  }

  function calculatePayrollTax() {
    const rule = getActiveRule();
    const locationRule = getActiveLocation();
    const monthlyGross = parseMoney(grossSalaryInput.value);
    const monthlyBenefits = parseMoney(monthlyBenefitAmount.value);
    const yearlyBenefits = parseMoney(yearlyBenefitAmount.value);
    const advanceTax = parseMoney(advanceTaxInput.value);
    const monthlyPayrollIncome = monthlyGross + monthlyBenefits;
    const annualIncome = monthlyGross * 12 + monthlyBenefits * 12 + yearlyBenefits;
    const oneThirdExemption = annualIncome / 3;
    const salaryExemption = Math.min(oneThirdExemption, rule.salaryExemptionCap);
    const taxableIncome = Math.max(0, annualIncome - salaryExemption);
    const hasInvestmentInput = String(investmentInput.value || "").trim() !== "";
    const actualInvestment = hasInvestmentInput
      ? parseMoney(investmentInput.value)
      : taxableIncome * 0.2;
    const slabResult = calculateSlabTax(taxableIncome, taxpayerCategory.value, rule);
    const taxBeforeCredit = slabResult.totalTax;
    const creditByTaxableIncome = taxableIncome * 0.03;
    const creditByInvestment = actualInvestment * 0.15;
    const allowedCredit = Math.min(
      creditByTaxableIncome,
      creditByInvestment,
      rule.investmentCreditCap,
      taxBeforeCredit
    );
    const taxAfterCredit = Math.max(0, taxBeforeCredit - allowedCredit);
    const minimumTax = taxBeforeCredit > 0 ? locationRule.minimumTax : 0;
    const taxPayable = taxBeforeCredit > 0 ? Math.max(taxAfterCredit, minimumTax) : 0;
    const remainingTax = Math.max(0, taxPayable - advanceTax);
    const monthlyTax = remainingTax / 12;
    const takeHome = Math.max(0, monthlyPayrollIncome - monthlyTax);

    renderResults({
      rule,
      locationRule,
      monthlyGross,
      monthlyBenefits,
      yearlyBenefits,
      monthlyPayrollIncome,
      annualIncome,
      oneThirdExemption,
      salaryExemption,
      taxableIncome,
      slabRows: slabResult.rows,
      taxBeforeCredit,
      actualInvestment,
      creditByTaxableIncome,
      creditByInvestment,
      allowedCredit,
      minimumTax,
      taxPayable,
      advanceTax,
      remainingTax,
      monthlyTax,
      takeHome,
    });
  }

  function renderResults(result) {
    monthlyTaxValue.textContent = formatTk(result.monthlyTax);
    takeHomeValue.textContent = formatTk(result.takeHome);
    monthlyIncomeValue.textContent = formatTk(result.monthlyPayrollIncome);
    grossMonthlyCell.textContent = formatMoney(result.monthlyGross);
    grossAnnualCell.textContent = formatMoney(result.monthlyGross * 12);
    monthlyBenefitCell.textContent = formatMoney(result.monthlyBenefits);
    monthlyBenefitAnnualCell.textContent = formatMoney(result.monthlyBenefits * 12);
    yearlyBenefitMonthlyCell.textContent = "0";
    yearlyBenefitCell.textContent = formatMoney(result.yearlyBenefits);
    totalMonthlyIncomeCell.textContent = formatMoney(result.monthlyPayrollIncome);
    totalAnnualIncomeCell.textContent = formatMoney(result.annualIncome);
    annualIncomeValue.textContent = formatMoney(result.annualIncome);
    taxableIncomeValue.textContent = formatTk(result.taxableIncome);
    totalSlabIncome.textContent = formatMoney(result.taxableIncome);
    totalTaxBeforeCredit.textContent = formatTk(result.taxBeforeCredit);
    totalTaxBeforeCreditFooter.textContent = formatMoney(result.taxBeforeCredit);
    taxCreditAllowed.textContent = "(" + formatTk(result.allowedCredit) + ")";
    incomeTaxPayable.textContent = formatMoney(result.taxPayable);
    minimumTaxValue.textContent = formatMoney(result.minimumTax);
    advanceTaxValue.textContent = "(" + formatMoney(result.advanceTax) + ")";
    remainingTaxLiability.textContent = formatTk(result.remainingTax);
    remainingTaxLiabilityFooter.textContent = formatMoney(result.remainingTax);

    const taxShare = result.monthlyPayrollIncome
      ? (result.monthlyTax / result.monthlyPayrollIncome) * 100
      : 0;
    monthlyBreakdownDonut.style.setProperty(
      "--monthly-tax-share",
      Math.min(100, taxShare).toFixed(2) + "%"
    );

    taxableIncomeRows.innerHTML = `
      <tr class="payroll-muted-row">
        <td>Lower of:</td>
        <td></td>
        <td></td>
      </tr>
      <tr>
        <td>1/3 of projected annual income</td>
        <td>${formatMoney(result.oneThirdExemption)}</td>
        <td rowspan="2">${formatMoney(result.salaryExemption)}</td>
      </tr>
      <tr>
        <td>Maximum limit</td>
        <td>${formatMoney(result.rule.salaryExemptionCap)}</td>
      </tr>
      <tr class="payroll-total-sheet-row">
        <td>Total Taxable Income</td>
        <td></td>
        <td>${formatMoney(result.taxableIncome)}</td>
      </tr>
    `;

    taxSlabRows.innerHTML = result.slabRows
      .map(
        (row) => `
          <tr>
            <td>${row.slab}</td>
            <td>${row.slabLimit === Infinity ? "" : formatMoney(row.slabLimit)}</td>
            <td>${Math.round(row.rate * 100)}%</td>
            <td>${formatMoney(row.taxAmount)}</td>
          </tr>
        `
      )
      .join("");

    investmentCreditRows.innerHTML = `
      <tr class="payroll-muted-row">
        <td colspan="4">Lower of:</td>
      </tr>
      <tr>
        <td>a</td>
        <td>0.03 x Total Taxable Income</td>
        <td>${formatMoney(result.creditByTaxableIncome)}</td>
        <td>${formatMoney(result.creditByTaxableIncome)}</td>
      </tr>
      <tr>
        <td>b</td>
        <td>0.15 x Actual Investment declared/made</td>
        <td>${formatMoney(result.actualInvestment)}</td>
        <td>${formatMoney(result.creditByInvestment)}</td>
      </tr>
      <tr>
        <td>c</td>
        <td>Maximum allowable limit</td>
        <td>${formatMoney(result.rule.investmentCreditCap)}</td>
        <td></td>
      </tr>
      <tr class="payroll-total-sheet-row">
        <td colspan="3">Tax credit allowed</td>
        <td>(${formatMoney(result.allowedCredit)})</td>
      </tr>
    `;
  }

  document.querySelectorAll("[data-focus-target]").forEach((button) => {
    button.addEventListener("click", () => {
      const target = document.getElementById(button.dataset.focusTarget);
      if (target) {
        target.focus();
      }
    });
  });

  [
    grossSalaryInput,
    monthlyBenefitAmount,
    yearlyBenefitAmount,
    investmentInput,
    advanceTaxInput,
  ].forEach((input) => {
    input.addEventListener("input", () => {
      input.value = String(input.value || "").replace(/[^\d,]/g, "");
      calculatePayrollTax();
    });
    input.addEventListener("blur", () => {
      formatInput(input);
      calculatePayrollTax();
    });
  });

  [taxYearSelect, locationSelect, taxpayerCategory].forEach((control) => {
    control.addEventListener("change", calculatePayrollTax);
  });
  calculatePayrollButton.addEventListener("click", calculatePayrollTax);
  calculatePayrollButtonBottom.addEventListener("click", calculatePayrollTax);
  calculatePayrollTax();
});
