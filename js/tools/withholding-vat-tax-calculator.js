document.addEventListener("DOMContentLoaded", () => {
  const supplierInvoiceAmount = document.getElementById("supplierInvoiceAmount");
  const supplierVatRate = document.getElementById("supplierVatRate");
  const supplierTaxRate = document.getElementById("supplierTaxRate");
  const supplierVatAmount = document.getElementById("supplierVatAmount");
  const supplierExcludingVat = document.getElementById("supplierExcludingVat");
  const supplierTaxAmount = document.getElementById("supplierTaxAmount");
  const supplierNetPayable = document.getElementById("supplierNetPayable");
  const customerNetReceivable = document.getElementById("customerNetReceivable");
  const customerTaxRate = document.getElementById("customerTaxRate");
  const customerVatRate = document.getElementById("customerVatRate");
  const customerTaxAmount = document.getElementById("customerTaxAmount");
  const customerExcludingVat = document.getElementById("customerExcludingVat");
  const customerVatAmount = document.getElementById("customerVatAmount");
  const customerTotalInvoice = document.getElementById("customerTotalInvoice");

  function parseAmount(value) {
    return Number(String(value || "").replace(/[^\d.]/g, "")) || 0;
  }

  function roundAmount(value) {
    return Math.round(Number(value) || 0);
  }

  function formatAmount(value, fractionDigits = 2) {
    return new Intl.NumberFormat("en-IN", {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(Number(value) || 0);
  }

  function formatInput(input, fractionDigits = 2) {
    input.value = formatAmount(parseAmount(input.value), fractionDigits);
  }

  function calculateVatTax() {
    const supplierTotal = parseAmount(supplierInvoiceAmount.value);
    const supplierVatRateValue = parseAmount(supplierVatRate.value);
    const supplierTaxRateValue = parseAmount(supplierTaxRate.value);
    const supplierVat = supplierVatRateValue
      ? roundAmount((supplierTotal * supplierVatRateValue) / (100 + supplierVatRateValue))
      : 0;
    const supplierAmountExcludingVat = supplierTotal - supplierVat;
    const supplierTax = roundAmount((supplierAmountExcludingVat * supplierTaxRateValue) / 100);
    const supplierNet = supplierAmountExcludingVat - supplierTax;

    supplierVatAmount.value = formatAmount(supplierVat);
    supplierExcludingVat.value = formatAmount(supplierAmountExcludingVat);
    supplierTaxAmount.value = formatAmount(supplierTax);
    supplierNetPayable.value = formatAmount(supplierNet);

    const customerNet = parseAmount(customerNetReceivable.value);
    const customerTaxRateValue = parseAmount(customerTaxRate.value);
    const customerVatRateValue = parseAmount(customerVatRate.value);
    const customerTax = customerTaxRateValue >= 100
      ? 0
      : roundAmount((customerNet * customerTaxRateValue) / (100 - customerTaxRateValue));
    const customerAmountExcludingVat = customerNet + customerTax;
    const customerVat = roundAmount((customerAmountExcludingVat * customerVatRateValue) / 100);
    const customerTotal = customerAmountExcludingVat + customerVat;

    customerTaxAmount.value = formatAmount(customerTax);
    customerExcludingVat.value = formatAmount(customerAmountExcludingVat);
    customerVatAmount.value = formatAmount(customerVat);
    customerTotalInvoice.value = formatAmount(customerTotal);
  }

  [
    supplierInvoiceAmount,
    supplierVatRate,
    supplierTaxRate,
    customerNetReceivable,
    customerTaxRate,
    customerVatRate,
  ].forEach((input) => {
    input.addEventListener("input", () => {
      input.value = String(input.value || "").replace(/[^\d.,]/g, "");
      calculateVatTax();
    });
    input.addEventListener("blur", () => {
      formatInput(input);
      calculateVatTax();
    });
  });

  calculateVatTax();
});
