# Commit Plan

Recommended commit groups for this architecture migration:

1. Backend API and storage boundary
   - `backend/`
   - `.env.example`
   - `server.js`

2. Frontend backend-data migration
   - `frontend/js/services/`
   - backend-backed changes in `frontend/js/pages/` and `frontend/js/tools/`
   - script includes in `frontend/pages/`

3. Route and file cleanup
   - removed root `*.html`
   - removed `routes/compat`
   - `backend/page-routes.js`
   - `frontend/styles.css` CSS import hub
   - frontend source under `frontend/`

4. Tests, audits, and documentation
   - `scripts/check-*.mjs`
   - `scripts/migrate-file-to-adapter.mjs`
   - `.env.production.example`
   - `scripts/commercial-audit.mjs`
   - `docs/`
   - `package.json`

Before each commit, run:

```bash
npm run commercial:audit
```
