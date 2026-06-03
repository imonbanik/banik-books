# Root Support Files

The project root is intentionally kept small. These files remain at the root
because tools and local scripts depend on stable paths.

| File | Why it stays at root |
| --- | --- |
| `server.js` | Local static server and `/rate-finder-csv` proxy. `package.json` and local scripts start it directly. |
| `vercel.json` | Vercel deployment routing config. It routes hosted requests through `server.js`. |
| `local-server.sh` | Main local startup command used during development. |
| `package.json` | npm script entry point. |
| `firestore.rules` | Firebase rules file, commonly expected at project root. |
| `.gitignore` | Repository ignore rules. |
| `README.md` | First file a developer should read. |

## Moved Out Of Root

| Former root item | Current location |
| --- | --- |
| Frontend source | `frontend/` |
| Active HTML pages | `frontend/pages/` |
| Root URL HTML shims | Removed; dynamic redirects live in `backend/page-routes.js` |
| Browser JavaScript | `frontend/js/` |
| Stylesheet import hub | `frontend/styles.css`, served publicly as `/styles.css` |
| Stylesheets | `frontend/css/` |
| Backend helper script | `scripts/backend-server.sh` |
| Local pid/log files | `runtime/` |
| Sample cheque image | `frontend/assets/sample-cheque.jpg` |
| Local development data | `data/` |
| Generated outputs | `outputs/` |

## Rule

Before moving any remaining root file, update all scripts, docs, and server
path handling in the same change, then verify the local server.

For local data, runtime files, and generated outputs, see
`docs/DATA_RUNTIME_POLICY.md`.
