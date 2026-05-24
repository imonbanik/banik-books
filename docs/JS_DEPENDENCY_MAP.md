# BANIK Books JavaScript Dependency Map

This map documents the current JavaScript files after the safe folder move. The
HTML pages still remain at the project root, but browser JavaScript now lives
under `js/`.

## Current Rule

- Keep JavaScript files under the active `js/` folders.
- `js/core/auth.js` and `js/services/data-service.js` are browser ES modules.
- `js/pages/journal-entry.js` and `js/pages/chart-of-accounts.js` are loaded as
  deferred classic scripts and currently communicate through `window` globals
  and localStorage.
- Many tool pages still contain large inline scripts inside their HTML files.

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
| `js/pages/journal-entry.js` | classic script | Journal Entry behavior, localStorage journals/ledgers, attachment UI, and quick ledger modal. |
| `js/pages/chart-of-accounts.js` | classic script | Chart of Accounts behavior, default chart data, localStorage sync, and optional `window.BanikData` sync. |
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

Chart of Accounts loads:

```html
<script src="./js/pages/chart-of-accounts.js" defer></script>
```

Invoice Generator additionally loads PDF.js from CDN:

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
```

## Inline Script Inventory

These pages currently contain substantial inline JavaScript and are candidates
for later page-specific extraction:

| Page | Future JS target |
| --- | --- |
| `index.html` | `js/pages/index.js` |
| `signup.html` | `js/pages/signup.js` |
| `admin.html` | `js/pages/admin.js` |
| `cheque-printer.html` | `js/tools/cheque-printer.js` |
| `challan-management.html` | `js/tools/challan-management.js` |
| `payroll-tax-calculator.html` | `js/tools/payroll-tax-calculator.js` |
| `withholding-vat-tax-calculator.html` | `js/tools/withholding-vat-tax-calculator.js` |
| `tax-vat-customs-rates.html` | `js/tools/tax-vat-customs-rates.js` |
| `emi-calculator.html` | `js/tools/emi-calculator.js` |
| `invoice-generator.html` | `js/tools/invoice-generator.js` |

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

Next JS cleanup should extract inline scripts page by page after each page is
stable.
