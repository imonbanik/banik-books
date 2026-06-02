# BANIK Books Project Structure

This project currently keeps root HTML page URLs stable for safety. For example,
`journal-entry.html` still opens at `/journal-entry.html` through a redirect
shim, while the active page lives at `/pages/accounting/journal-entry.html`.

## Runtime Entry Points

- `routes/compat/` - compatibility redirect shims for old root `*.html` links
  and bookmarks. The local server maps requests like `/journal-entry.html` to
  this folder.
- `pages/` - active HTML pages grouped by auth, workspace, accounting, reports,
  tools, admin, and redirects.
- `styles.css` - the single stylesheet entry point used by existing pages.
- `server.js` - local Node static server plus the rate CSV proxy endpoint.
- `local-server.sh` - starts the local app at `http://127.0.0.1:4103`.
- `package.json` - no-dependency local scripts for start, syntax checks, and
  route smoke checks.

## Frontend Files

- `assets/` - image and logo assets.
- `routes/compat/` - root URL compatibility shims served by `server.js`.
- `data/` - ignored local development data. See
  `docs/DATA_RUNTIME_POLICY.md`.
- `runtime/` - ignored local runtime artifacts such as pid/log files.
- `outputs/` - ignored generated outputs.
- `docs/DATA_RUNTIME_POLICY.md` - explains local data, runtime, and generated
  output ownership.
- `docs/CODE_QUALITY.md` - npm check scripts and editor defaults.
- `docs/SMOKE_TESTS.md` - local route and asset smoke test coverage.
- `docs/VISUAL_QA_CHECKLIST.md` - manual browser visual QA checklist.
- `docs/SECURITY_NOTES.md` - security and sensitive-data handoff notes.
- `docs/README.md` - documentation index and common task guide.
- `docs/ROOT_SUPPORT_FILES.md` - explains why the remaining root files stay at
  the project root.
- `docs/HTML_ROUTE_MAP.md` - current root HTML page map and future folder
  targets.
- `docs/JS_DEPENDENCY_MAP.md` - current JavaScript dependency map and future
  folder targets.
- `pages/` - active HTML page folders. Root HTML files remain as compatibility
  shims.
- `js/` - active browser JavaScript folders for config, core, services, and
  page scripts.
- `css/base.css` - shared base styles loaded before extracted page modules.
- `css/legacy.css` - older page styles that have not yet been split into page
  modules.
- `css/responsive/base-responsive.css` - shared responsive overrides.
- `css/responsive/tools-responsive.css` - tool/calculator responsive overrides.
- `css/responsive/accounting-responsive.css` - accounting responsive overrides.
- `css/responsive/admin-responsive.css` - admin responsive overrides.
- `css/pages/workspace.css` - Workspace page-specific CSS.
- `css/pages/detail-pages.css` - Reports placeholder pages and Necessary Tools
  detail-page CSS.
- `css/pages/payroll-tax-calculator.css` - Payroll Tax Calculator page CSS.
- `css/pages/withholding-vat-tax-calculator.css` - Withholding VAT/Tax
  Calculator page CSS.
- `css/pages/admin.css` - Admin user/access-control page CSS.
- `css/pages/challan-management.css` - Challan Management page CSS and shared
  challan-style shell classes reused by related tools.
- `css/pages/journal-entry-base.css` - Journal Entry base/shared CSS that must
  load before Chart of Accounts and legacy rules.
- `css/pages/chart-of-accounts.css` - Chart of Accounts page CSS.
- `css/pages/emi-calculator.css` - EMI Calculator page CSS.
- `css/pages/tax-vat-customs-rates.css` - Tax, VAT and Customs Rates page CSS.
- `css/pages/invoice-generator.css` - Invoice Generator page CSS and print
  rules.
- `css/pages/journal-entry.css` - Journal Entry page-specific CSS overrides.
- `styles.css` - CSS import hub. Keep page-specific imports after shared styles.

Current stylesheet order:

```css
@import "./css/base.css";
@import "./css/pages/workspace.css";
@import "./css/pages/detail-pages.css";
@import "./css/pages/payroll-tax-calculator.css";
@import "./css/pages/withholding-vat-tax-calculator.css";
@import "./css/pages/admin.css";
@import "./css/pages/challan-management.css";
@import "./css/pages/journal-entry-base.css";
@import "./css/pages/chart-of-accounts.css";
@import "./css/pages/emi-calculator.css";
@import "./css/pages/tax-vat-customs-rates.css";
@import "./css/pages/invoice-generator.css";
@import "./css/legacy.css";
@import "./css/responsive/base-responsive.css";
@import "./css/responsive/tools-responsive.css";
@import "./css/responsive/accounting-responsive.css";
@import "./css/responsive/admin-responsive.css";
@import "./css/pages/journal-entry.css";
```

## JavaScript Files

- `js/config/app-config.js` - app-level settings.
- `js/config/firebase-config.js` - Firebase project configuration.
- `js/core/auth.js` - Firebase Auth/session UI behavior.
- `js/services/data-service.js` - shared data access helper.
- `js/pages/` - page-level browser scripts.
- `js/tools/` - tool/calculator browser scripts.
- `js/pages/journal-entry.js` - Journal Entry page behavior.
- `js/pages/chart-of-accounts.js` - Chart of Accounts page behavior.

Browser JavaScript now lives under `js/`. Root HTML compatibility shims live in
`routes/compat/` and are served by `server.js`. For the current dependency
inventory, see
`docs/JS_DEPENDENCY_MAP.md`.

Active JavaScript folders:

```text
js/
  config/
  core/
  services/
  pages/
  tools/
```

Active HTML folders:

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

## Backend And Support

- `server.js` - local HTTP server and `/rate-finder-csv` proxy.
- `firestore.rules` - Firestore security rules.
- `scripts/` - utility scripts for rate data extraction/building.
- `scripts/backend-server.sh` - backend helper script.
- `scripts/check-js.mjs` - runs `node --check` across active JavaScript files.
- `scripts/smoke-check.mjs` - checks key local URLs and static assets.
- `package.json` - npm scripts.
- `README.md` - quick start and folder overview.
- `docs/ROOT_SUPPORT_FILES.md` - root file ownership guide.

## Safe Reorganization Rule

Do not delete `routes/compat/` shim files until old links and bookmarks are
deliberately retired. The current safe approach is to keep root URLs as stable
compatibility entry points while active pages live under `pages/`.

For the current page inventory and future destination folders, see
`docs/HTML_ROUTE_MAP.md`.
