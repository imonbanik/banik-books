# BANIK Books Project Structure

This project keeps the public app URLs stable while keeping implementation
folders clean. For example, `/journal-entry.html` redirects to
`/pages/accounting/journal-entry.html`, and `server.js` serves that page from
`frontend/pages/accounting/journal-entry.html`.

## Runtime Entry Points

- `server.js` - local Node static server, backend API mount, frontend static
  aliases, and `/rate-finder-csv` proxy.
- `local-server.sh` - starts the local app at `http://127.0.0.1:4103`.
- `backend/page-routes.js` - compatibility redirect map for old root `*.html`
  links and bookmarks.
- `frontend/` - all active browser source: HTML, CSS, JavaScript, and assets.
- `package.json` - local scripts for syntax, API, storage, smoke, and
  commercial architecture checks.

## Frontend Source

Edit frontend implementation files under `frontend/`.

- `frontend/pages/` - active HTML page folders.
- `frontend/js/` - browser JavaScript grouped by config, core, services, page
  scripts, and tool scripts.
- `frontend/css/` - shared, page-specific, responsive, and remaining legacy CSS.
- `frontend/assets/` - image and logo assets.
- `frontend/styles.css` - CSS import hub. It is served publicly as
  `/styles.css`, so existing page markup and browser URLs stay stable.

Public static URLs remain:

```text
/pages/...
/js/...
/css/...
/assets/...
/styles.css
```

`server.js` maps those public URLs to the matching `frontend/` files.

## Active HTML Folders

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

## Active JavaScript Folders

```text
frontend/js/
  config/
  core/
  services/
  pages/
  tools/
```

Important files:

- `frontend/js/config/app-config.js` - app-level browser settings and release
  metadata.
- `frontend/js/config/firebase-config.js` - Firebase browser configuration.
- `frontend/js/core/auth.js` - Firebase Auth/session UI behavior.
- `frontend/js/services/api-client.js` - backend API client used by browser
  pages.
- `frontend/js/services/data-service.js` - shared Firebase data helper kept for
  compatibility.
- `frontend/js/services/report-data.js` - shared report storage/API hydration
  helper.
- `frontend/js/pages/` - page-level browser scripts.
- `frontend/js/tools/` - tool/calculator browser scripts.

## Stylesheet Structure

`frontend/styles.css` is the only stylesheet entry point linked by active
pages. Keep page-specific imports after shared styles.

Current import order:

```css
@import "./css/base.css";
@import "./css/pages/workspace.css";
@import "./css/pages/detail-pages.css";
@import "./css/tools.css";
@import "./css/pages/admin.css";
@import "./css/accounting.css";
@import "./css/reports.css";
@import "./css/pages/party-management.css";
@import "./css/legacy.css";
@import "./css/responsive/base-responsive.css";
@import "./css/responsive/tools-responsive.css";
@import "./css/responsive/accounting-responsive.css";
@import "./css/responsive/admin-responsive.css";
@import "./css/pages/journal-entry.css";
@import "./css/typography.css";
```

## Backend And Support

- `backend/` - API route, auth context, validation, services, permissions,
  rate limits, backup logic, and storage adapter selection.
- `backend/adapters/` - persistence adapters. `file-adapter.js` is active for
  local/dev storage; `firebase-admin-adapter.js` is the production Firestore
  adapter; `postgres-adapter.js` documents a future SQL target.
- `backend/storage-adapter.js` - persistence adapter selector.
- `backend/backup-service.js` - scoped backup export/import logic.
- `firestore.rules` - Firestore security rules.
- `scripts/` - utility and verification scripts.
- `docs/` - project handoff and architecture notes.
- `data/` - ignored local development data.
- `runtime/` - ignored local pid/log artifacts.
- `outputs/` - ignored generated outputs.

## Safe Reorganization Rule

Do not remove entries from `backend/page-routes.js` until old links and
bookmarks are deliberately retired. Keep root frontend source folders out of the
project root; active browser implementation belongs under `frontend/`.

For the current page inventory and public route map, see
`docs/HTML_ROUTE_MAP.md`. For JavaScript ownership, see
`docs/JS_DEPENDENCY_MAP.md`.
