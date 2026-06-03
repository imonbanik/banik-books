# BANIK Books JavaScript Dependency Map

Active browser JavaScript source now lives under `frontend/js/`. Public script
URLs still use `/js/...` because `server.js` serves those URLs from
`frontend/js/...`.

## Current Rule

- Keep browser JavaScript source under `frontend/js/`.
- Keep public `<script src="./js/...">` references stable unless a separate
  route/static-asset migration is planned.
- `frontend/js/core/auth.js` and `frontend/js/services/data-service.js` are
  browser ES modules.
- `frontend/js/services/api-client.js` is the backend API client for
  backend-backed business data.
- `frontend/js/services/report-data.js` is a shared classic-script helper for
  report storage/API hydration.
- `frontend/js/pages/journal-entry.js` and
  `frontend/js/pages/chart-of-accounts.js` are deferred classic scripts and use
  backend-backed API hydration with local UI cache/fallback.
- Legacy redirect behavior is handled by `backend/page-routes.js` and
  `frontend/pages/redirects/`.

## Active Folders

```text
frontend/js/
  config/
  core/
  services/
  pages/
  tools/
```

## Current JavaScript Files

| Source file | Type | Notes |
| --- | --- | --- |
| `frontend/js/config/app-config.js` | classic script | Initializes fixed app settings and writes `window.BANIK_BOOKS_SETTINGS`. |
| `frontend/js/config/firebase-config.js` | ES module | Exports Firebase config and founder admin email. |
| `frontend/js/core/auth.js` | ES module | Firebase Auth, user profile, admin access, page protection, and `window.BanikAuth`. Imports `../config/firebase-config.js`. |
| `frontend/js/services/api-client.js` | classic script | Backend API client exposed as `window.BanikApi`. |
| `frontend/js/services/data-service.js` | ES module | User-scoped Firestore helper and `window.BanikData`. Imports `../config/firebase-config.js`. |
| `frontend/js/services/report-data.js` | classic script | Shared report data hydration and backend/local fallback helpers. |
| `frontend/js/pages/journal-entry.js` | classic script | Journal Entry behavior, backend-backed journals/parties/chart data, attachment UI, and quick ledger modal. |
| `frontend/js/pages/journal-register.js` | classic script | Journal Register report behavior, backend-hydrated journal rows, filtering, totals, and drilldown links. |
| `frontend/js/pages/general-ledger.js` | classic script | General Ledger report behavior and backend-hydrated ledger aggregation. |
| `frontend/js/pages/party-wise-transaction.js` | classic script | Party Wise Transaction report behavior and backend-hydrated party aggregation. |
| `frontend/js/pages/trial-balance.js` | classic script | Trial Balance report behavior and backend-hydrated ledger balances. |
| `frontend/js/pages/statement-of-financial-position.js` | classic script | Statement of Financial Position aggregation and chart classification mapping. |
| `frontend/js/pages/statement-of-profit-loss-and-oci.js` | classic script | Statement of Profit & Loss and OCI aggregation and profit subtotals. |
| `frontend/js/pages/statement-of-changes-in-equity.js` | classic script | Statement of Changes in Equity movement aggregation. |
| `frontend/js/pages/statement-of-cash-flows.js` | classic script | Statement of Cash Flows aggregation and cash reconciliation. |
| `frontend/js/pages/party-management.js` | classic script | Backend-backed party register, dynamic party form, and edit/delete actions. |
| `frontend/js/pages/chart-of-accounts.js` | classic script | Chart of Accounts behavior, default chart data, backend sync, and optional template sync. |
| `frontend/js/pages/index.js` | classic script | Sign-in/register landing page behavior. |
| `frontend/js/pages/signup.js` | classic script | Signup/profile setup, letterhead, and e-signature behavior. |
| `frontend/js/pages/admin.js` | classic script | Admin permission table plus backend backup/workspace operations. |
| `frontend/js/tools/challan-management.js` | classic script | Challan Management modal, register, backend sync, and export behavior. |
| `frontend/js/tools/cheque-printer.js` | classic script | Cheque Printer layout, formatting, and print behavior. |
| `frontend/js/tools/emi-calculator.js` | classic script | EMI calculation and amortization schedule behavior. |
| `frontend/js/tools/invoice-generator.js` | classic script | Invoice form, preview, PDF rendering, and print behavior. |
| `frontend/js/tools/payroll-tax-calculator.js` | classic script | Payroll tax calculator behavior. |
| `frontend/js/tools/tax-vat-customs-rates.js` | classic script | Tax, VAT, and Customs Rates data browser behavior. |
| `frontend/js/tools/withholding-vat-tax-calculator.js` | classic script | Withholding VAT/Tax Calculator behavior. |
| `server.js` | Node script | Local static server, backend API mount, static aliases, and `/rate-finder-csv` proxy. |
| `scripts/*.mjs` | Node scripts | Utility, audit, smoke, and migration scripts. |

## Public HTML Script Usage

Most active pages still load public script URLs like this:

```html
<script src="./js/config/app-config.js" defer></script>
<script src="./js/core/auth.js" type="module"></script>
```

Accounting pages additionally load:

```html
<script src="./js/services/data-service.js" type="module"></script>
```

Page-specific public script URLs include:

```html
<script src="./js/pages/journal-entry.js" defer></script>
<script src="./js/pages/journal-register.js" defer></script>
<script src="./js/pages/general-ledger.js" defer></script>
<script src="./js/pages/chart-of-accounts.js" defer></script>
```

Invoice Generator additionally loads PDF.js from CDN:

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
```

## Dependency Notes

- `frontend/js/core/auth.js` imports `../config/firebase-config.js`.
- `frontend/js/services/data-service.js` imports
  `../config/firebase-config.js`.
- `frontend/js/core/auth.js` contains the admin module/page permission list, so
  future HTML moves must update page filenames or preserve route compatibility.
- `frontend/js/services/data-service.js` exposes Firestore helpers through
  `window.BanikData`; pages that depend on it should load the service before
  page scripts.
- `frontend/js/config/app-config.js` must load before page scripts that read
  `window.BANIK_BOOKS_SETTINGS`.

## Safe JS Change Checklist

Before changing JavaScript paths again:

1. Search references with `rg "file-name.js|from \"./|from './|script src=\"./"`.
2. Move one group at a time.
3. Update every affected HTML `<script src>`.
4. Update every affected ES module `import`.
5. Run `npm run check:js`.
6. Verify public URLs with `npm run check:smoke` and browser testing when UI
   behavior changed.
