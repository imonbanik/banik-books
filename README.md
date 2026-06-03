# BANIK Books

Browser-based accounting and business tools app using Firebase Auth and
Firestore.

## What This App Contains

- Firebase Auth and user profile setup.
- Admin module access control.
- User-scoped Firestore data helpers.
- Workspace navigation.
- Journal Entry and Chart of Accounts.
- Challan Management.
- Business tools: Payroll Tax, Withholding VAT/Tax, Tax/VAT/Customs Rates, EMI
  Calculator, Cheque Printer, and Invoice Generator.
- Report placeholder pages.

## Start Locally

```bash
./local-server.sh
```

Local URL:

```text
http://127.0.0.1:4103
```

Useful checks:

```bash
npm run check
curl -I http://127.0.0.1:4103/journal-entry.html
curl -I http://127.0.0.1:4103/pages/accounting/journal-entry.html
curl -I http://127.0.0.1:4103/styles.css
```

## Root Files

Only app entry/support files should stay at the project root:

- `server.js` - local static server and rate CSV proxy.
- `local-server.sh` - starts the local app on port `4103`.
- `package.json` - npm scripts.
- `firestore.rules` - Firebase security rules.
- `.gitignore` - local/generated file ignore rules.

Root URL compatibility is handled dynamically by `backend/page-routes.js`.
Active frontend source lives in `frontend/`. Public URLs such as `/pages/...`,
`/js/...`, `/css/...`, `/assets/...`, and `/styles.css` stay unchanged through
`server.js` static aliases.

## Main Folders

- `frontend/` - active HTML, CSS, JavaScript, and assets.
- `backend/page-routes.js` - old root URL redirects mapped to active pages.
- `frontend/pages/` - active HTML pages grouped by area.
- `frontend/js/` - browser JavaScript grouped by config, core, services, pages,
  and tools.
- `frontend/css/` - shared, page-specific, and responsive styles.
- `frontend/assets/` - images and logo assets.
- `docs/` - project structure and development notes.
- `scripts/` - support scripts.
- `runtime/` - ignored local pid/log files.
- `data/` - ignored local development data.
- `outputs/` - ignored generated outputs.

## Where To Edit

- HTML page markup: `frontend/pages/`
- Root URL compatibility routes: `backend/page-routes.js`
- Page/tool JavaScript: `frontend/js/pages/` and `frontend/js/tools/`
- Shared Firebase/Auth/Data code: `frontend/js/core/`, `frontend/js/services/`,
  `frontend/js/config/`
- Page CSS: `frontend/css/pages/`
- Responsive CSS: `frontend/css/responsive/`
- Shared CSS and remaining older styles: `frontend/css/base.css` and
  `frontend/css/legacy.css`
- Static assets: `frontend/assets/`
- Local helper scripts: `scripts/`

Keep `frontend/styles.css` as the only stylesheet entry point linked by active
pages. It is served publicly as `/styles.css` and remains an import hub.

## Key Docs

- `docs/README.md`
- `docs/COMMERCIAL_ARCHITECTURE.md`
- `docs/PROJECT_STRUCTURE.md`
- `docs/DEVELOPMENT_NOTES.md`
- `docs/HTML_ROUTE_MAP.md`
- `docs/JS_DEPENDENCY_MAP.md`
- `docs/ROOT_SUPPORT_FILES.md`
- `docs/DATA_RUNTIME_POLICY.md`
- `docs/CODE_QUALITY.md`
- `docs/SMOKE_TESTS.md`
- `docs/VISUAL_QA_CHECKLIST.md`
- `docs/SECURITY_NOTES.md`

## Verification

For JavaScript changes:

```bash
npm run check:js
```

For route/style changes:

```bash
npm run check:smoke
```
