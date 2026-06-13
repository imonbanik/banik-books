# Release Notes

## Unreleased Local Fixes

These changes are local only until the owner explicitly approves a GitHub push.
Do not change the public version number for this section.

No unreleased local changes.

## Version 1.1.8 - June 2026

Release type: Challan Management backend storage and A-Challan prepare flow.

Deployment status: Owner approved GitHub commit and push on June 13, 2026.

### Highlights

- Challan Management records, helper dropdowns, and TIN/BIN info are now
  backend-backed per user so one account cannot see another account's entries.
- Added TIN/BIN Info management for organization or individual names with
  backend persistence.
- Added Prepare A-Challan form fields for party-based Deductee/Deductor TIN,
  phone number, comment, amount, assessment year, and challan type.
- Added a backend A-Challan automation endpoint powered by Playwright for the
  initial Tax prepare flow.
- Challan Register now allows duplicate A-Challan numbers because one challan
  may cover multiple people's tax payments.
- Profile asset cards now align saved status text and remove buttons consistently
  and show profile photo previews in the same card pattern.

### Verification

Passed locally on June 13, 2026:

- `npm run check:js`
- `npm run commercial:audit`

## Version 1.1.7 - June 2026

Release type: Super Admin confirmation modal polish.

Deployment status: Owner approved GitHub commit and push on June 6, 2026.

### Highlights

- Super Admin user Disable/Enable, Permanent Delete, and backup import
  confirmations now use centered in-app modals with blurred background instead
  of browser-native confirm/prompt popups.

### Verification

Passed locally on June 6, 2026:

- `npm run check:js`
- `npm run commercial:audit`

## Version 1.1.6 - June 2026

Release type: Admin user lifecycle controls.

Deployment status: Owner approved GitHub commit and push on June 6, 2026.

### Highlights

- Super Admin Panel now has server-backed Disable/Enable and Permanent Delete
  actions for user accounts.
- Permanent Delete removes the Firebase Auth user, Firestore profile, uploaded
  user assets, legacy `userData`, and backend workspace-scope records for that
  user.
- Disabled accounts have refresh tokens revoked and backend API token checks now
  reject revoked/disabled Firebase sessions.

### Verification

Passed locally on June 6, 2026:

- `npm run check:js`
- `npm run commercial:audit`

## Version 1.1.5 - June 2026

Release type: Firebase Admin credential deployment fix.

Deployment status: Owner approved GitHub commit and push on June 6, 2026.

### Highlights

- Backend Firebase Admin can now load server credentials from
  `FIREBASE_SERVICE_ACCOUNT_JSON`, which fits Vercel-style environment variable
  deployment.
- Production config checks now validate `FIREBASE_SERVICE_ACCOUNT_JSON` when it
  is provided and still support `GOOGLE_APPLICATION_CREDENTIALS` or host ADC.

### Verification

Passed locally on June 6, 2026:

- `npm run check:js`
- `npm run check:production-config` with safe sample credential shape
- `npm run commercial:audit`

## Version 1.1.4 - June 2026

Release type: Hosted API token retry fix.

Deployment status: Owner approved GitHub commit and push on June 4, 2026.

### Highlights

- Backend API requests now wait for the current BANIK Books user before reading
  the Firebase ID token.
- Hosted API calls retry once with a freshly refreshed Firebase ID token after a
  `401` response.
- API errors now include the backend response message when available, making
  production Firebase Admin configuration issues easier to identify.

### Verification

Passed locally on June 4, 2026:

- `npm run check:js`
- `npm run commercial:audit`

## Version 1.1.3 - June 2026

Release type: Hosted API auth readiness fix.

Deployment status: Owner approved GitHub commit and push on June 4, 2026.

### Highlights

- Backend API requests now wait for the Firebase auth module before sending
  requests, preventing hosted Chart of Accounts and other backend-backed pages
  from calling APIs without an `Authorization` bearer token.

### Verification

Passed locally on June 4, 2026:

- `npm run check:js`
- `npm run commercial:audit`

## Version 1.1.2 - June 2026

Release type: Admin experience and hosted auth hardening release.

Deployment status: Owner approved GitHub commit and push on June 4, 2026.

### Highlights

- Hosted sign-in no longer fails when Firebase Auth succeeds but Firestore
  profile sync times out.
- Landing page now detects the auth module script loading state and waits
  longer for hosted/CDN startup before showing an error.
- Vercel now serves `/js`, `/css`, `/assets`, `/pages`, and `/styles.css` from
  static frontend files before falling back to `server.js`, preventing browser
  modules from being converted into Node-style `require(...)` code.
- Git ignore rules and secret audit checks now block real `.env`, service
  account, and private key files from being tracked.
- Super Admin Panel now has a smoother premium background, fixed-scroll
  tabular access matrix, `BB-2606-00000001` style admin account serials,
  separate Firebase UIDs, admin-first sorting, centered column headings, and
  Excel export with text-safe serials plus Yes/No access values.
- Profile-sync fallback opens the workspace using authenticated user data while
  Firestore configuration is corrected.
- Stage-specific Firebase/Auth timeout messages remain available for real
  domain, API key, or network failures.

### Verification

Passed locally on June 4, 2026:

- `npm run check:js`
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
