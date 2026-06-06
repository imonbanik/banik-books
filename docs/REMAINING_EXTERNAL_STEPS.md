# Remaining External Steps

The codebase architecture is ready for Firebase-backed production/staging.
These tasks require real external systems or human review.

## Human Visual Review

Open the app and confirm the existing screens still look and behave as expected:

- Workspace
- Journal Entry
- Chart of Accounts
- Party Management
- Reports
- Tools
- Admin backup export/import

## Firebase Credentials

Configure Firebase Admin credentials outside the repository:

```text
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"..."}
```

For VPS-style hosts that can keep a private file outside the repo, this is also
supported:

```text
GOOGLE_APPLICATION_CREDENTIALS=/secure/path/service-account.json
```

or use host-provided Google Application Default Credentials. Never commit or
share the real service account JSON.

## Staging Deployment

Use `.env.staging.example`, deploy to a staging host, and run:

```bash
npm run check:production-config
npm run commercial:audit
```

## Production Deployment

Use `.env.production.example`, set the real admin emails and workspace policy,
then run the production config check before starting the server.

## Data Migration

After credentials and target project are configured:

```bash
BANIK_STORAGE_ADAPTER=firebase npm run migrate:file-to-adapter
```
