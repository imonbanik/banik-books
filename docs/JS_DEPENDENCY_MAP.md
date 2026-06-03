# BANIK Books JavaScript Dependency Map

This map documents the current JavaScript files after the safe folder move.
Active HTML pages live under `pages/`, compatibility redirects live in
`backend/page-routes.js`, and browser JavaScript lives under `js/`.

## Current Rule

- Keep JavaScript files under the active `js/` folders.
- `js/core/auth.js` and `js/services/data-service.js` are browser ES modules.
- `js/services/report-data.js` is a shared classic-script helper for report
  storage/API hydration.
- `js/pages/journal-entry.js` and `js/pages/chart-of-accounts.js` are loaded as
  deferred classic scripts and use backend-backed API hydration with local UI
  cache/fallback.
- Large active page/tool scripts have been extracted from HTML into `js/pages/`
  and `js/tools/`. Legacy redirect behavior is handled by
  `backend/page-routes.js` and `pages/redirects/`.

## Active Folders

These folders are active runtime paths for browser JavaScript.

```text
js/
  config/
  core/
  services/
  pages/
  tools/
```

## Current JavaScript Files

| Active file | Type | Notes |
| --- | --- | --- |
| `js/config/app-config.js` | classic script | Initializes fixed app settings and writes `window.BANIK_BOOKS_SETTINGS`. |
| `js/config/firebase-config.js` | ES module | Exports Firebase config and founder admin email. |
| `js/core/auth.js` | ES module | Firebase Auth, user profile, admin access, page protection, and `window.BanikAuth`. Imports `../config/firebase-config.js`. |
| `js/services/data-service.js` | ES module | User-scoped Firestore helper and `window.BanikData`. Imports `../config/firebase-config.js`. |
| `js/pages/journal-entry.js` | classic script | Journal Entry behavior, backend-backed journals/parties/chart data, attachment UI, and quick ledger modal. |
| `js/pages/journal-register.js` | classic script | Journal Register report behavior, backend-hydrated journal register rows, date filtering, totals, and Journal Entry drilldown links. |
| `js/pages/general-ledger.js` | classic script | General Ledger report behavior, backend-hydrated ledger aggregation, date/search filtering, debit/credit/balance totals. |
| `js/pages/party-wise-transaction.js` | classic script | Party Wise Transaction report behavior, backend-hydrated party aggregation, date/search filtering, debit/credit/balance totals, and Journal Entry drilldown links. |
| `js/pages/trial-balance.js` | classic script | Trial Balance report behavior, backend-hydrated ledger balance aggregation, date filtering, and debit/credit totals. |
| `js/pages/statement-of-financial-position.js` | classic script | Statement of Financial Position behavior, backend-hydrated ledger balance aggregation, chart classification mapping, date filtering, and vertical assets/equity/liabilities totals. |
| `js/pages/statement-of-profit-loss-and-oci.js` | classic script | Statement of Profit & Loss and OCI behavior, backend-hydrated income/expense aggregation, chart hierarchy mapping, date filtering, and profit subtotals. |
| `js/pages/statement-of-changes-in-equity.js` | classic script | Statement of Changes in Equity behavior, backend-hydrated equity movement aggregation, CoA equity column mapping, date filtering, and net profit allocation to retained earnings. |
| `js/pages/statement-of-cash-flows.js` | classic script | Statement of Cash Flows behavior, backend-hydrated journal aggregation, CoA cash/non-cash classification, comparative period cash flow sections, and cash reconciliation. |
| `js/pages/party-management.js` | classic script | Party Management behavior, backend-backed party register, dynamic party form, and edit/delete actions. |
| `js/pages/chart-of-accounts.js` | classic script | Chart of Accounts behavior, default chart data, backend-backed sync, and optional template sync. |
| `js/pages/index.js` | classic script | Sign-in/register landing page behavior. |
| `js/pages/signup.js` | classic script | Signup/profile setup, letterhead, and e-signature behavior. |
| `js/pages/admin.js` | classic script | Admin user/module permission table plus backend backup/workspace operations. Depends on `window.BanikApi`. |
| `js/tools/challan-management.js` | classic script | Challan Management modal, register, backend sync, and export behavior. |
| `js/tools/cheque-printer.js` | classic script | Cheque Printer layout, formatting, and print behavior. |
| `js/tools/emi-calculator.js` | classic script | EMI calculation and amortization schedule behavior. |
| `js/tools/invoice-generator.js` | classic script | Invoice form, preview, letterhead/e-signature, PDF rendering, and print behavior. |
| `js/tools/payroll-tax-calculator.js` | classic script | Payroll tax calculator behavior. |
| `js/tools/tax-vat-customs-rates.js` | classic script | Tax, VAT, and Customs Rates data browser behavior. |
| `js/tools/withholding-vat-tax-calculator.js` | classic script | Withholding VAT/Tax Calculator behavior. |
| `server.js` | Node script | Local static server and `/rate-finder-csv` proxy. Keep root unless npm/local scripts are updated. |
| `scripts/*.mjs` | Node scripts | Utility scripts for rate data extraction/inspection. Already organized. |

## HTML Script Usage

Most active pages load:

```html
<script src="./js/config/app-config.js" defer></script>
<script src="./js/core/auth.js" type="module"></script>
```

Accounting pages additionally load:

```html
<script src="./js/services/data-service.js" type="module"></script>
```

Journal Entry loads:

```html
<script src="./js/pages/journal-entry.js" defer></script>
```

Journal Register loads:

```html
<script src="./js/pages/journal-register.js" defer></script>
```

General Ledger loads:

```html
<script src="./js/pages/general-ledger.js" defer></script>
```

Party Wise Transaction loads:

```html
<script src="./js/pages/party-wise-transaction.js" defer></script>
```

Party Management loads:

```html
<script src="./js/pages/party-management.js" defer></script>
```

Chart of Accounts loads:

```html
<script src="./js/pages/chart-of-accounts.js" defer></script>
```

Invoice Generator additionally loads PDF.js from CDN:

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
```

## Extracted Page/Tool Scripts

These active pages now load page-specific JavaScript from separate files:

| Page | JS file |
| --- | --- |
| `index.html` | `js/pages/index.js` |
| `signup.html` | `js/pages/signup.js` |
| `admin.html` | `js/services/api-client.js`, `js/pages/admin.js` |
| `cheque-printer.html` | `js/tools/cheque-printer.js` |
| `challan-management.html` | `js/tools/challan-management.js` |
| `payroll-tax-calculator.html` | `js/tools/payroll-tax-calculator.js` |
| `withholding-vat-tax-calculator.html` | `js/tools/withholding-vat-tax-calculator.js` |
| `tax-vat-customs-rates.html` | `js/tools/tax-vat-customs-rates.js` |
| `emi-calculator.html` | `js/tools/emi-calculator.js` |
| `invoice-generator.html` | `js/tools/invoice-generator.js` |

Legacy redirect pages under `pages/redirects/` remain for product-specific
aliases; old root URLs are handled by `backend/page-routes.js`.

## Dependency Notes

- `js/core/auth.js` imports `../config/firebase-config.js`.
- `js/services/data-service.js` imports `../config/firebase-config.js`.
- `js/core/auth.js` contains the admin module/page permission list, so future
  HTML moves must update its page filenames or preserve root redirect/shim
  pages.
- `js/services/data-service.js` exposes Firestore helpers through
  `window.BanikData`; pages that depend on it should load the service before
  page scripts.
- `js/config/app-config.js` must load before page scripts that read
  `window.BANIK_BOOKS_SETTINGS`.

## Safe JS Change Checklist

Before changing JavaScript paths again:

1. Search references with `rg "file-name.js|from \"./|from './|script src=\"./"`.
2. Move one group at a time.
3. Update every affected HTML `<script src>`.
4. Update every affected ES module `import`.
5. Run `node --check` on moved local JavaScript files.
6. Verify every affected page with `curl -I` and browser testing when UI
   behavior changed.

## Completed Move

Step 18 completed the root JS move:

1. `firebase-config.js` moved to `js/config/firebase-config.js`.
2. `app-config.js` moved to `js/config/app-config.js`.
3. `auth.js` moved to `js/core/auth.js`.
4. `data-service.js` moved to `js/services/data-service.js`.
5. `journal-entry.js` moved to `js/pages/journal-entry.js`.
6. `chart-of-accounts.js` moved to `js/pages/chart-of-accounts.js`.

The next JS cleanup should focus on shared helpers inside the extracted files,
for example money/date formatting or modal utilities, only when duplication
becomes painful.
