# Security Notes

## Local Data

`data/`, `runtime/`, and `outputs/` are ignored by git. Keep local database
snapshots, pid files, logs, and generated files there unless an artifact is
sanitized and intentionally moved into source or docs.

## Firebase Web Config

`js/config/firebase-config.js` contains Firebase browser configuration. Firebase
web API keys are not treated like server secrets, but access must be protected
by Firebase Auth, Firestore rules, and Firebase project restrictions.

## Firestore Rules

`firestore.rules` is the main access-control boundary for Firestore data.
Review it before adding new collections or admin-only features.

## Do Not Commit

- Personal local database snapshots.
- Runtime logs or pid files.
- Private service account keys.
- Exported customer/business data.
- Temporary debug files with credentials, tokens, or production data.

## Before Deployment

1. Review `firestore.rules`.
2. Confirm Firebase project settings and authorized domains.
3. Configure backend API auth:
   - `BANIK_API_REQUIRE_AUTH=true`
   - `BANIK_API_AUTH_PROVIDER=firebase`
   - `BANIK_STORAGE_ADAPTER=firebase`
   - `BANIK_ADMIN_EMAILS=owner@example.com`
   - Firebase Admin credentials through the hosting platform or
     `GOOGLE_APPLICATION_CREDENTIALS`.
4. Configure `BANIK_ALLOWED_WORKSPACE_IDS` when a host should only serve known
   workspaces.
5. Keep `BANIK_API_TRUST_UNVERIFIED_TOKEN` disabled in production.
6. Confirm local ignored folders are not staged.
7. Run `npm run check`.
8. Run `npm run check:production-config` with production env loaded.

## Backend API Controls

The backend validates workspace ids, checks API roles, and rate-limits requests
with `BANIK_API_RATE_LIMIT_MAX`. Backup import is admin-only because it replaces
workspace data.
