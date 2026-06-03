const PAGE_ROUTES = Object.freeze({
  "/": "/pages/auth/index.html",
  "/index.html": "/pages/auth/index.html",
  "/signup.html": "/pages/auth/signup.html",
  "/workspace.html": "/pages/workspace/workspace.html",
  "/reports.html": "/pages/workspace/reports.html",
  "/necessary-tools.html": "/pages/workspace/necessary-tools.html",
  "/party-management.html": "/pages/workspace/party-management.html",
  "/admin.html": "/pages/admin/admin.html",
  "/journal-entry.html": "/pages/accounting/journal-entry.html",
  "/chart-of-accounts.html": "/pages/accounting/chart-of-accounts.html",
  "/journal-register.html": "/pages/reports/journal-register.html",
  "/general-ledger.html": "/pages/reports/general-ledger.html",
  "/party-wise-transaction.html": "/pages/reports/party-wise-transaction.html",
  "/party-wise-ledger.html": "/pages/reports/party-wise-transaction.html",
  "/trial-balance.html": "/pages/reports/trial-balance.html",
  "/statement-of-financial-position.html": "/pages/reports/statement-of-financial-position.html",
  "/statement-of-profit-loss-and-oci.html": "/pages/reports/statement-of-profit-loss-and-oci.html",
  "/statement-of-changes-in-equity.html": "/pages/reports/statement-of-changes-in-equity.html",
  "/statement-of-cash-flows.html": "/pages/reports/statement-of-cash-flows.html",
  "/notes-to-the-accounts.html": "/pages/reports/notes-to-the-accounts.html",
  "/invoice-generator.html": "/pages/tools/invoice-generator.html",
  "/payroll-tax-calculator.html": "/pages/tools/payroll-tax-calculator.html",
  "/tax-vat-customs-rates.html": "/pages/tools/tax-vat-customs-rates.html",
  "/challan-management.html": "/pages/tools/challan-management.html",
  "/emi-calculator.html": "/pages/tools/emi-calculator.html",
  "/cheque-printer.html": "/pages/tools/cheque-printer.html",
  "/withholding-vat-tax-calculator.html": "/pages/tools/withholding-vat-tax-calculator.html",
  "/vat-tax-calculator.html": "/pages/redirects/vat-tax-calculator.html",
  "/Imon-Cheque.html": "/pages/redirects/Imon-Cheque.html",
});

function getPageRoute(pathname) {
  return PAGE_ROUTES[pathname] || "";
}

module.exports = {
  getPageRoute,
  PAGE_ROUTES,
};
