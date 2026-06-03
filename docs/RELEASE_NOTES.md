# Release Notes

## Version 1.1.3 - June 2026

Release type: Hosted sign-in reliability patch.

Deployment status: Prepared locally for GitHub push and Vercel redeploy.

### Fixes

- Added a fail-safe around landing page sign-in/signup so the button no longer
  stays on `Please wait...` indefinitely when Firebase Auth or the hosted
  domain configuration does not respond.
- Added a clear Firebase unauthorized-domain message for Vercel/custom-domain
  setup problems.
- Kept the existing landing page design unchanged while updating the version to
  `1.1.3`.

### Verification

- `npm run commercial:audit`

## Version 1.1.2 - June 2026

Release type: Hosted deployment routing patch.

Deployment status: Prepared locally for GitHub push and Vercel redeploy.

### Fixes

- Added `vercel.json` so Vercel routes all hosted requests through `server.js`.
- Updated `server.js` to export a request handler for Vercel while preserving
  the existing local `./local-server.sh` startup behavior.
- Added smoke coverage for `/` and `/index.html` to catch landing-page routing
  regressions.
- Updated landing page, package metadata, and release notes to version `1.1.2`.

### Verification

- `npm run commercial:audit`

## Version 1.1.1 - June 2026

Release type: Commercial architecture readiness release.

Deployment status: Local repository release prepared. GitHub push, staging
deployment, production credentials, and manual visual QA are still pending.

### Highlights

- Separated active frontend source into `frontend/` and active backend source
  into `backend/`.
- Preserved existing browser URLs, page layout, visual design, and route
  behavior through server-side static aliases and compatibility redirects.
- Moved backend-backed business data behind API routes instead of direct
  frontend writes.
- Added local file storage, Firebase Admin/Firestore adapter wiring, workspace
  scoping, auth verification hooks, permissions, rate limiting, and
  backup/export/import service boundaries.
- Added release metadata to the landing page: `Release: June 2026` and
  `Version: 1.1.1`.
- Added commercial architecture audit coverage for source folder boundaries,
  route smoke checks, backend-backed storage writes, and release metadata sync.

### Verification

Passed locally on June 3, 2026:

- `npm run check:js`
- `npm run check:api`
- `npm run check:storage`
- `npm run check:smoke`
- `npm run check:api:http`
- `npm run commercial:audit`

### Remaining Before Production Launch

- Push local commits to GitHub after owner review.
- Configure production environment variables and Firebase Admin credentials.
- Set real production admin emails and workspace policy.
- Deploy to staging.
- Run migration against the real Firebase project.
- Complete manual visual QA on the existing screens.
- Re-run production config, dependency, API, backup, and restore checks.

## Release Metadata Rule

For every future app update, keep these files in sync:

- `package.json` and `package-lock.json` - update the app version.
- `frontend/js/config/app-config.js` - update `BANIK_BOOKS_RELEASE.version` and
  `BANIK_BOOKS_RELEASE.releaseMonthYear`.
- `frontend/pages/auth/index.html` - keep the release placeholders in the
  landing page release block.
- `docs/RELEASE_NOTES.md` - add a new version section at the top.
- `docs/RELEASE_STATUS.md` - update current local/release state when status
  changes.

Before handoff, run:

```bash
npm run commercial:audit
```
