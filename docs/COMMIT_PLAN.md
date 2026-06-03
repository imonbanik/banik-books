# Commit Plan

Recommended commit groups for this architecture migration:

1. Backend API and storage boundary
   - `backend/`
   - `.env.example`
   - `server.js`

2. Frontend backend-data migration
   - `js/services/`
   - backend-backed changes in `js/pages/` and `js/tools/`
   - script includes in `pages/`

3. Route and file cleanup
   - removed root `*.html`
   - removed `routes/compat`
   - `backend/page-routes.js`
   - `styles.css` CSS import hubs

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
