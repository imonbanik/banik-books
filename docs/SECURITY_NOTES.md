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
3. Confirm local ignored folders are not staged.
4. Run `npm run check`.
