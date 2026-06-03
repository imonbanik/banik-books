# BANIK Books HTML Route Map

This map documents the current HTML route layout. Real HTML pages live under
`frontend/pages/`, while old root-level URLs are redirected dynamically from
`backend/page-routes.js` so existing links and bookmarks keep working without
duplicate files.

## Current Rule

- Keep `backend/page-routes.js` entries in place until old URLs are deliberately
  retired.
- Active pages use `<base href="/" />`, so existing `./styles.css`, `./js/...`,
  assets, and root URL links resolve through public static aliases.
- All active pages currently load `./styles.css` as the single stylesheet entry
  point.
- Most authenticated pages load `./js/config/app-config.js` and
  `./js/core/auth.js`.
- When changing route paths again, update every matching `href`, `script src`,
  and JavaScript navigation reference.

## Active Folders

These folders now contain active page files.

```text
frontend/pages/
  auth/
  workspace/
  accounting/
  reports/
  tools/
  admin/
  redirects/
```

## Route Categories

### Auth And Entry

| Root URL | Active page | Notes |
| --- | --- | --- |
| `index.html` | `frontend/pages/auth/index.html` | Public sign-in entry page. Navigates to signup, admin, or workspace. |
| `signup.html` | `frontend/pages/auth/signup.html` | Signup and user setup flow. |

### Workspace

| Root URL | Active page | Notes |
| --- | --- | --- |
| `workspace.html` | `frontend/pages/workspace/workspace.html` | Main authenticated workspace and navigation hub. |
| `party-management.html` | `frontend/pages/workspace/party-management.html` | Party Management register for customers, suppliers, both parties, and employees. |
| `necessary-tools.html` | `frontend/pages/workspace/necessary-tools.html` | Tools menu/detail page. |
| `reports.html` | `frontend/pages/workspace/reports.html` | Reports menu/detail page. |

### Accounting

| Root URL | Active page | Notes |
| --- | --- | --- |
| `journal-entry.html` | `frontend/pages/accounting/journal-entry.html` | Loads public `/js/services/data-service.js` and `/js/pages/journal-entry.js`. |
| `chart-of-accounts.html` | `frontend/pages/accounting/chart-of-accounts.html` | Loads public `/js/services/data-service.js` and `/js/pages/chart-of-accounts.js`. |

### Reports

| Root URL | Active page | Notes |
| --- | --- | --- |
| `general-ledger.html` | `frontend/pages/reports/general-ledger.html` | General Ledger report with ledger-wise debit, credit, and balance summary. |
| `party-wise-transaction.html` | `frontend/pages/reports/party-wise-transaction.html` | Party Wise Transaction report with party-wise transaction details and running balances. |
| `journal-register.html` | `frontend/pages/reports/journal-register.html` | Journal Register report with date range filter and local journal drilldown. |
| `trial-balance.html` | `frontend/pages/reports/trial-balance.html` | Trial Balance report with compact date-range ledger debit and credit balances. |
| `statement-of-financial-position.html` | `frontend/pages/reports/statement-of-financial-position.html` | Vertical Statement of Financial Position with date-range assets, equity, and liabilities. |
| `statement-of-profit-loss-and-oci.html` | `frontend/pages/reports/statement-of-profit-loss-and-oci.html` | Statement of Profit & Loss and OCI with CoA-layered revenue, expense, tax, and profit sections. |
| `statement-of-changes-in-equity.html` | `frontend/pages/reports/statement-of-changes-in-equity.html` | Statement of Changes in Equity with CoA equity columns, additions, adjustments, net profit, and closing balances. |
| `statement-of-cash-flows.html` | `frontend/pages/reports/statement-of-cash-flows.html` | Statement of Cash Flows with operating, investing, financing, and cash reconciliation sections. |
| `notes-to-the-accounts.html` | `frontend/pages/reports/notes-to-the-accounts.html` | Placeholder/report shell page. |

### Tools

| Root URL | Active page | Notes |
| --- | --- | --- |
| `cheque-printer.html` | `frontend/pages/tools/cheque-printer.html` | Cheque printer tool markup. |
| `challan-management.html` | `frontend/pages/tools/challan-management.html` | Loads public `/js/services/data-service.js`. |
| `payroll-tax-calculator.html` | `frontend/pages/tools/payroll-tax-calculator.html` | Payroll calculator page. |
| `withholding-vat-tax-calculator.html` | `frontend/pages/tools/withholding-vat-tax-calculator.html` | VAT/tax calculator page. |
| `tax-vat-customs-rates.html` | `frontend/pages/tools/tax-vat-customs-rates.html` | Rates tool page. |
| `emi-calculator.html` | `frontend/pages/tools/emi-calculator.html` | EMI calculator page. |
| `invoice-generator.html` | `frontend/pages/tools/invoice-generator.html` | Invoice generator page plus external PDF.js CDN script. |

### Admin

| Root URL | Active page | Notes |
| --- | --- | --- |
| `admin.html` | `frontend/pages/admin/admin.html` | Admin access-control page. |

### Redirect/Shim Pages

| Root URL | Active page | Notes |
| --- | --- | --- |
| `Imon-Cheque.html` | `frontend/pages/redirects/Imon-Cheque.html` | Legacy redirect to `cheque-printer.html`. Preserve until old links are retired. |
| `vat-tax-calculator.html` | `frontend/pages/redirects/vat-tax-calculator.html` | Legacy redirect to `withholding-vat-tax-calculator.html`. Preserve until old links are retired. |

## Shared HTML Dependencies

Most pages depend on:

```html
<base href="/" />
<link rel="stylesheet" href="./styles.css" />
<script src="./js/config/app-config.js" defer></script>
<script src="./js/core/auth.js" type="module"></script>
```

Accounting pages additionally depend on:

```html
<script src="./js/services/data-service.js" type="module"></script>
```

Page-specific external files currently include:

```html
<script src="./js/pages/journal-entry.js" defer></script>
<script src="./js/pages/journal-register.js" defer></script>
<script src="./js/pages/general-ledger.js" defer></script>
<script src="./js/pages/chart-of-accounts.js" defer></script>
```

## Route Change Safety Checklist

Before changing any HTML route again:

1. Search references with `rg "page-name.html|href=\"\\.\\/|script src=\"\\.\\/"`.
2. Keep or update the matching `backend/page-routes.js` entry for compatibility.
3. Update internal links and script/style paths.
4. Verify the active page and the root URL.
5. Keep redirect pages for legacy URLs until there is a deliberate cleanup step.
