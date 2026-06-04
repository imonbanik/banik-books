# Release Notes

## Unreleased Local Fixes

These changes are local only until the owner explicitly approves a GitHub push.
Do not change the public version number for this section.

- Hosted sign-in no longer fails when Firebase Auth succeeds but Firestore
  profile sync times out.
- Landing page now detects the auth module script loading state and waits
  longer for hosted/CDN startup before showing an error.
- Profile-sync fallback opens the workspace using authenticated user data while
  Firestore configuration is corrected.
- Stage-specific Firebase/Auth timeout messages remain available for real
  domain, API key, or network failures.

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
