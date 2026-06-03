# BANIK Books HTML Route Map

This map documents the current HTML route layout. Real HTML pages live under
`pages/`, while old root-level URLs are redirected dynamically from
`backend/page-routes.js` so existing links and bookmarks keep working without
duplicate files.

## Current Rule

- Keep `backend/page-routes.js` entries in place until old URLs are deliberately
  retired.
- Active pages use `<base href="/" />`, so existing `./styles.css`, `./js/...`,
  assets, and root URL links resolve from the project root.
- All active pages currently load `./styles.css` as the single stylesheet entry
  point.
- Most authenticated pages load `./js/config/app-config.js` and
  `./js/core/auth.js`.
- When changing route paths again, update every matching `href`, `script src`,
  and JavaScript navigation reference.

## Active Folders

These folders now contain active page files.

```text
pages/
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
| `index.html` | `pages/auth/index.html` | Public sign-in entry page. Navigates to signup, admin, or workspace. |
| `signup.html` | `pages/auth/signup.html` | Signup and user setup flow. Includes a large inline script. |

### Workspace

| Root URL | Active page | Notes |
| --- | --- | --- |
| `workspace.html` | `pages/workspace/workspace.html` | Main authenticated workspace and navigation hub. |
| `party-management.html` | `pages/workspace/party-management.html` | Party Management register for customers, suppliers, both parties, and employees. |
| `necessary-tools.html` | `pages/workspace/necessary-tools.html` | Tools menu/detail page. |
| `reports.html` | `pages/workspace/reports.html` | Reports menu/detail page. |

### Accounting

| Root URL | Active page | Notes |
| --- | --- | --- |
| `journal-entry.html` | `pages/accounting/journal-entry.html` | Loads `js/services/data-service.js` and `js/pages/journal-entry.js`. |
| `chart-of-accounts.html` | `pages/accounting/chart-of-accounts.html` | Loads `js/services/data-service.js` and `js/pages/chart-of-accounts.js`. |

### Reports

| Root URL | Active page | Notes |
| --- | --- | --- |
| `general-ledger.html` | `pages/reports/general-ledger.html` | General Ledger report with ledger-wise debit, credit, and balance summary. |
| `party-wise-transaction.html` | `pages/reports/party-wise-transaction.html` | Party Wise Transaction report with party-wise transaction details and running balances. |
| `journal-register.html` | `pages/reports/journal-register.html` | Journal Register report with date range filter and local journal drilldown. |
| `trial-balance.html` | `pages/reports/trial-balance.html` | Trial Balance report with compact date-range ledger debit and credit balances. |
| `statement-of-financial-position.html` | `pages/reports/statement-of-financial-position.html` | Vertical Statement of Financial Position with date-range assets, equity, and liabilities. |
| `statement-of-profit-loss-and-oci.html` | `pages/reports/statement-of-profit-loss-and-oci.html` | Statement of Profit & Loss and OCI with CoA-layered revenue, expense, tax, and profit sections. |
| `statement-of-changes-in-equity.html` | `pages/reports/statement-of-changes-in-equity.html` | Statement of Changes in Equity with CoA equity columns, additions, adjustments, net profit, and closing balances. |
| `statement-of-cash-flows.html` | `pages/reports/statement-of-cash-flows.html` | Statement of Cash Flows with operating, investing, financing, and cash reconciliation sections. |
| `notes-to-the-accounts.html` | `pages/reports/notes-to-the-accounts.html` | Placeholder/report shell page. |

### Tools

| Root URL | Active page | Notes |
| --- | --- | --- |
| `cheque-printer.html` | `pages/tools/cheque-printer.html` | Large inline tool script and page-specific markup. |
| `challan-management.html` | `pages/tools/challan-management.html` | Loads `js/services/data-service.js`; has large inline tool script. |
| `payroll-tax-calculator.html` | `pages/tools/payroll-tax-calculator.html` | Inline calculator script. |
| `withholding-vat-tax-calculator.html` | `pages/tools/withholding-vat-tax-calculator.html` | Inline calculator script. |
| `tax-vat-customs-rates.html` | `pages/tools/tax-vat-customs-rates.html` | Inline rates tool script. |
| `emi-calculator.html` | `pages/tools/emi-calculator.html` | Inline calculator script. |
| `invoice-generator.html` | `pages/tools/invoice-generator.html` | Inline generator script plus external PDF.js CDN script. |

### Admin

| Root URL | Active page | Notes |
| --- | --- | --- |
| `admin.html` | `pages/admin/admin.html` | Admin access-control page with inline script. |

### Redirect/Shim Pages

| Root URL | Active page | Notes |
| --- | --- | --- |
| `Imon-Cheque.html` | `pages/redirects/Imon-Cheque.html` | Legacy redirect to `cheque-printer.html`. Preserve until old links are retired. |
| `vat-tax-calculator.html` | `pages/redirects/vat-tax-calculator.html` | Legacy redirect to `withholding-vat-tax-calculator.html`. Preserve until old links are retired. |

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
