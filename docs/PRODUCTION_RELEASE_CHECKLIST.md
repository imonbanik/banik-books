# Production Release Checklist

This checklist is for release preparation after architecture changes. It does
not authorize frontend design changes.

## Required Checks

Run:

```bash
npm run commercial:audit
npm audit --omit=dev
```

The audit must pass with:

- No root HTML duplicates.
- No `routes/compat` duplicates.
- No direct backend-backed `localStorage.setItem` writes.
- Active page routes and static assets returning healthy responses.
- HTTP API route tests passing.
- Package version, landing page release metadata, and release notes synced.
- `vercel.json` present when deploying on Vercel.

## Environment

Set production environment variables:

```text
BANIK_API_REQUIRE_AUTH=true
BANIK_API_AUTH_PROVIDER=firebase
BANIK_STORAGE_ADAPTER=firebase
BANIK_FIRESTORE_ROOT_COLLECTION=banikWorkspaceData
BANIK_ADMIN_EMAILS=owner@example.com
BANIK_API_RATE_LIMIT_WINDOW_MS=60000
BANIK_API_RATE_LIMIT_MAX=240
```

Use `.env.production.example` as the production template.
Use `.env.staging.example` for the first staging deployment.

Use `BANIK_ALLOWED_WORKSPACE_IDS` when one deployment should only serve known
workspace ids.

## Data Safety

- Export a backup before importing or migrating data.
- Keep `data/`, `runtime/`, and `outputs/` out of commits.
- Keep server credentials outside the repository.
- Keep `BANIK_API_TRUST_UNVERIFIED_TOKEN` disabled in production.

## Deployment Notes

- Serve through HTTPS.
- On Vercel, keep `vercel.json` routing requests to `server.js`.
- Put a platform/WAF rate limiter in front of the app.
- Configure Firebase Admin credentials on the host.
- Install `firebase-admin` in the deployment package before enabling Firebase
  auth/storage.
- Verify production env before deploy:

```bash
npm run check:production-config
```

- Migrate local file data with `npm run migrate:file-to-adapter` after setting
  production credentials and `BANIK_STORAGE_ADAPTER=firebase`.
- Run `npm run commercial:audit` after deployment against the hosted URL when a
  smoke-test target is available.
- Update `docs/RELEASE_NOTES.md` and the landing page release metadata for
  every shipped version.
- Review `DEPENDENCY_AUDIT_NOTES.md` before release.
