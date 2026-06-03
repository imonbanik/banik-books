# Release Status

## Repository Status

The local codebase architecture migration is complete.

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

## External Tasks Still Required

These cannot be completed inside the repository without real deployment access:

- Provide Firebase Admin credentials.
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
