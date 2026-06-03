# Commercial Architecture Status

## Backend Boundary

Active API code now lives under `backend/`:

- `backend/api.js` - HTTP route parsing and response formatting.
- `backend/auth-context.js` - request auth and workspace context.
- `backend/auth-verifier.js` - optional production token verifier adapter.
- `backend/backup-service.js` - scoped backup export/import service.
- `backend/collection-service.js` - validation plus persistence boundary.
- `backend/adapters/file-adapter.js` - local ignored JSON development store.
- `backend/adapters/firebase-admin-adapter.js` - production Firestore storage
  adapter selected by `BANIK_STORAGE_ADAPTER=firebase`.
- `backend/data-store.js` - compatibility export for the active file adapter.
- `backend/permissions.js` - API role guard helpers.
- `backend/rate-limit.js` - dependency-free API request limiter.
- `backend/storage-adapter.js` - storage adapter selector. Current supported
  adapter is `file`; future database adapters should attach here.
- `backend/validators.js` - collection payload validation.

The frontend talks to the backend through
`frontend/js/services/api-client.js`, served publicly as
`/js/services/api-client.js`.

## Production Auth

Local development uses `local-dev` and workspace `default`. Production should
set:

```text
BANIK_API_REQUIRE_AUTH=true
BANIK_API_AUTH_PROVIDER=firebase
```

When `firebase-admin` and Google Application Default Credentials are available,
the backend verifies Firebase ID tokens and scopes data by:

```text
userId::workspaceId
```

`BANIK_API_TRUST_UNVERIFIED_TOKEN=true` is only for local experiments.

For hosted deployments, set `BANIK_ALLOWED_WORKSPACE_IDS` when one server
should only serve known workspaces. Workspace ids are normalized to lowercase
URL-safe ids before they reach storage.

Production roles are derived from verified token identity:

```text
BANIK_ADMIN_EMAILS=owner@example.com,admin@example.com
BANIK_VIEWER_EMAILS=viewer@example.com
```

Default verified users receive the `user` role. Local development defaults to
`admin`, and `X-Banik-Role` may be used locally for permission tests only.

## Workspace Scope

The browser sends:

```text
X-Banik-Workspace-Id
```

from `localStorage.banikBooksWorkspaceId`, defaulting to `default`.

## Backend-Backed Data

The following are backend-backed with local cache/fallback:

- Journals
- Parties
- Chart of Accounts
- Challan register entries
- Report data hydration
- Accounting preferences
- Cheque printer payee helper list
- Challan management helper option lists

Local UI-only state may remain in `localStorage`, including collapsed chart
groups, form drafts, field suggestions, and temporary tool helper lists.

Run the storage audit with:

```bash
npm run check:storage
```

## Backup And Restore

The backend exposes scoped backup endpoints:

```text
GET /api/backups/export
PUT /api/backups/import
```

Export requires `user` or `admin`. Import requires `admin` because it replaces
the current workspace data. Backup payloads contain the backend-backed
collections only.

The admin page includes matching UI controls for export/import and shows the
current backend workspace context.

## API Protection

The API has a lightweight in-memory limiter:

```text
BANIK_API_RATE_LIMIT_WINDOW_MS=60000
BANIK_API_RATE_LIMIT_MAX=240
```

Use a platform/WAF rate limiter in production as the primary control; this
project-level limiter is a protective baseline.

## File Cleanup Rule

Do not remove dynamic root compatibility route entries until the deployment and
customer links are intentionally migrated. Active implementation files should be
edited in:

- `backend/`
- `frontend/pages/`
- `frontend/js/`
- `frontend/css/`
- `frontend/assets/`

Root `*.html` compatibility is served from `backend/page-routes.js`. Public
frontend URLs such as `/pages/...`, `/js/...`, `/css/...`, `/assets/...`, and
`/styles.css` are mapped to source files under `frontend/` by `server.js`.

## Database Migration Path

The app currently uses:

```text
BANIK_STORAGE_ADAPTER=file
```

The Firebase Admin production adapter is wired and can be selected with:

```text
BANIK_STORAGE_ADAPTER=firebase
BANIK_FIRESTORE_ROOT_COLLECTION=banikWorkspaceData
```

The deployment package must include `firebase-admin`, and the host must provide
Google Application Default Credentials or `GOOGLE_APPLICATION_CREDENTIALS`.
Use `.env.production.example` for the release environment shape, then verify
with:

```bash
npm run check:production-config
```

Future database adapters should live under `backend/adapters/` with the same
methods as `backend/adapters/file-adapter.js`:

- `listCollection(collectionName, authContext)`
- `replaceCollection(collectionName, items, authContext)`
- `upsertItem(collectionName, itemId, item, authContext)`
- `deleteItem(collectionName, itemId, authContext)`

After that, `backend/storage-adapter.js` can select the new adapter without
changing page scripts or API routes.

To migrate local file data to the selected production adapter, set
`BANIK_STORAGE_ADAPTER` and run:

```bash
npm run migrate:file-to-adapter
```
