const MODULE_KEYS = Object.freeze([
  "journal-entry", "chart-of-accounts", "party-management", "necessary-tools",
  "cheque-printer", "challan-management", "payroll-tax-calculator", "vat-tax-calculator",
  "tax-vat-customs-rates", "emi-calculator", "invoice-generator", "reports",
]);
const PERMISSION_MODULE = Object.freeze({
  "journals.viewAll": "journal-entry", "journals.create": "journal-entry",
  "journals.editOwn": "journal-entry", "journals.editAll": "journal-entry",
  "journals.submit": "journal-entry", "journals.post": "journal-entry",
  "journals.approve": "journal-entry", "journals.reverse": "journal-entry",
  "parties.view": "party-management", "parties.manage": "party-management",
  "chartOfAccounts.view": "chart-of-accounts", "chartOfAccounts.manage": "chart-of-accounts",
  "reports.view": "reports",
  "reports.general-ledger": "reports", "reports.party-wise-transaction": "reports",
  "reports.trial-balance": "reports", "reports.statement-of-financial-position": "reports",
  "reports.statement-of-profit-loss-and-oci": "reports", "reports.statement-of-changes-in-equity": "reports",
  "reports.statement-of-cash-flows": "reports", "reports.notes-to-the-accounts": "reports",
  "challans.view": "challan-management", "challans.manage": "challan-management",
  "exports.download": "", "company.settings": "", "team.manage": "", "activity.view": "",
  ...Object.fromEntries(MODULE_KEYS.filter((key) => !["journal-entry", "chart-of-accounts", "party-management", "reports", "challan-management"].includes(key)).map((key) => [`tools.${key}`, key])),
});
const PERMISSION_KEYS = Object.freeze(Object.keys(PERMISSION_MODULE));
const PERMISSION_LABELS = Object.freeze({
  "journals.viewAll": "View all journal entries", "journals.create": "Create journal drafts",
  "journals.editOwn": "Edit own drafts", "journals.editAll": "Edit other members' drafts",
  "journals.submit": "Submit drafts for approval", "journals.post": "Post entries directly",
  "journals.approve": "Approve and post submitted entries", "journals.reverse": "Reverse posted entries",
  "parties.view": "View full party records", "parties.manage": "Create and edit parties",
  "chartOfAccounts.view": "View accounts and opening balances", "chartOfAccounts.manage": "Manage accounts and opening balances",
  "reports.view": "View company financial reports", "challans.view": "View challans", "challans.manage": "Create and edit challans",
  "reports.general-ledger": "View General Ledger", "reports.party-wise-transaction": "View Party-wise Transactions",
  "reports.trial-balance": "View Trial Balance", "reports.statement-of-financial-position": "View Financial Position",
  "reports.statement-of-profit-loss-and-oci": "View Profit or Loss and OCI", "reports.statement-of-changes-in-equity": "View Changes in Equity",
  "reports.statement-of-cash-flows": "View Cash Flows", "reports.notes-to-the-accounts": "View Notes to the Accounts",
  "exports.download": "Download and export company data", "company.settings": "Manage company settings",
  "team.manage": "Invite and manage company members", "activity.view": "View company activity history",
  "tools.necessary-tools": "Use necessary tools", "tools.cheque-printer": "Use cheque printer",
  "tools.payroll-tax-calculator": "Use payroll tax calculator", "tools.vat-tax-calculator": "Use withholding VAT/tax calculator",
  "tools.tax-vat-customs-rates": "View tax, VAT and customs rates", "tools.emi-calculator": "Use EMI calculator",
  "tools.invoice-generator": "Use invoice generator",
});
const MEMBER_ROLES = Object.freeze(["junior", "accountant", "viewer", "custom"]);
const READ_PERMISSIONS = new Set(["journals.viewAll", "parties.view", "chartOfAccounts.view", "reports.view", "challans.view", "activity.view", "exports.download"]);

function companyError(statusCode, message) {
  return Object.assign(new Error(message), { statusCode });
}

function allPermissions(enabled = false) {
  return Object.fromEntries(PERMISSION_KEYS.map((key) => [key, enabled]));
}

function getRolePermissions(role = "junior") {
  const permissions = allPermissions(role === "owner");
  const enabled = {
    junior: ["journals.create", "journals.editOwn", "journals.submit"],
    accountant: ["journals.viewAll", "journals.create", "journals.editOwn", "journals.editAll", "journals.submit", "journals.post", "journals.reverse", "parties.view", "parties.manage", "chartOfAccounts.view", "reports.view", "challans.view", "challans.manage", "activity.view"],
    viewer: ["journals.viewAll", "parties.view", "chartOfAccounts.view", "reports.view", "challans.view"],
    custom: [],
  }[role] || [];
  for (const key of enabled) permissions[key] = true;
  return permissions;
}

function normalizeMemberRole(value) {
  const role = value === "junior-accountant" ? "junior" : String(value || "junior");
  if (!MEMBER_ROLES.includes(role)) throw companyError(400, "Choose a valid company member role.");
  return role;
}

function normalizePermissions(value, base = allPermissions(false)) {
  if (value === undefined) return { ...base };
  if (!value || typeof value !== "object" || Array.isArray(value)) throw companyError(400, "Permissions must be an object.");
  const result = { ...base };
  for (const [key, enabled] of Object.entries(value)) {
    if (!Object.hasOwn(PERMISSION_MODULE, key) || typeof enabled !== "boolean") throw companyError(400, `Invalid permission: ${key}.`);
    result[key] = enabled;
  }
  return result;
}

function applyModuleCeiling(permissions, modules, companyRole, platformRole) {
  const result = allPermissions(false);
  for (const key of PERMISSION_KEYS) {
    const moduleKey = PERMISSION_MODULE[key];
    result[key] = Boolean(permissions[key]) && (!moduleKey || Boolean(modules[moduleKey]));
    if (platformRole === "viewer" && !READ_PERMISSIONS.has(key) && !key.startsWith("tools.") && !key.startsWith("reports.")) result[key] = false;
  }
  if (companyRole === "owner" && platformRole !== "viewer") result["team.manage"] = true;
  return result;
}

function hasCompanyPermission(authContext, permission) {
  return Boolean(authContext && authContext.companyId && authContext.permissions && authContext.permissions[permission]);
}

function assertCompanyPermission(authContext, permission) {
  if (!hasCompanyPermission(authContext, permission)) throw companyError(403, "You do not have permission to perform this action in this company.");
}

function assertDelegablePermissions(authContext, permissions) {
  for (const key of PERMISSION_KEYS) {
    const moduleKey = PERMISSION_MODULE[key];
    if (!permissions[key]) continue;
    if (moduleKey && !authContext.companyModules[moduleKey]) throw companyError(403, `The company does not have access to ${moduleKey}.`);
    if (authContext.companyRole !== "owner" && !authContext.permissions[key]) throw companyError(403, "You cannot grant access beyond your own permissions.");
  }
}

module.exports = {
  MODULE_KEYS, PERMISSION_KEYS, PERMISSION_MODULE, PERMISSION_LABELS, MEMBER_ROLES,
  companyError, allPermissions, getRolePermissions, normalizeMemberRole, normalizePermissions,
  applyModuleCeiling, hasCompanyPermission, assertCompanyPermission, assertDelegablePermissions,
};
