# Release Status

## Repository Status

Current version: 1.2.0
Current release: October 2026

The local codebase architecture migration is complete. Version 1.2.0 adds
company teams, independent staff logins, configurable permissions, journal
review/history and shared accounting while retaining existing owner data scopes.

Completed inside the repository:

- Frontend and backend file boundaries are separated.
- Active frontend source lives under `frontend/`; active backend source lives
  under `backend/`.
- Backend API is the source of truth for business data.
- Local file storage and Firebase Admin/Firestore storage adapters are wired.
- Backup export/import and migration scripts are available.
- Root duplicate HTML files and compatibility shim folders are removed.
- Commercial architecture audit is available through `npm run commercial:audit`.
- Frontend visual design is protected by `NO_VISUAL_REGRESSION_POLICY.md`.

## Company Team Release

Company memberships, staff invitations/login, action/report permissions, journal
review/history, posted-only reports and owner backups are implemented locally.
The owner approved GitHub commit and push on October 5, 2026. Live deployment
and Firebase rules rollout have not been verified. Read `COMPANY_TEAM_ACCESS.md`
for coordinated backend/frontend/rules deployment and staging verification.

## External Tasks Still Required

These cannot be completed inside the repository without real deployment access:

- Provide Firebase Admin credentials through `FIREBASE_SERVICE_ACCOUNT_JSON`,
  `GOOGLE_APPLICATION_CREDENTIALS`, or host-provided ADC.
- Set real `BANIK_ADMIN_EMAILS`.
- Deploy to a staging host.
- Run migration against the real Firebase project.
- Manually confirm the existing screens still look and behave as expected.

## Final Local Verification

Run:

```bash
npm run commercial:audit
```

Production environment verification:

```bash
npm run check:production-config
```
