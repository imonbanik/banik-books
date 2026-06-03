# Root Support Files

The project root is intentionally kept small. These files remain at the root
because tools, local scripts, or active pages depend on stable paths.

| File | Why it stays at root |
| --- | --- |
| `server.js` | Local static server and `/rate-finder-csv` proxy. `package.json` and local scripts start it directly. |
| `local-server.sh` | Main local startup command used during development. |
| `package.json` | npm script entry point. |
| `styles.css` | Single CSS entry point referenced by active pages through `<base href="/" />`. |
| `firestore.rules` | Firebase rules file, commonly expected at project root. |
| `.gitignore` | Repository ignore rules. |
| `README.md` | First file a developer should read. |

## Moved Out Of Root

| Former root item | Current location |
| --- | --- |
| Active HTML pages | `pages/` |
| Root URL HTML shims | Removed; dynamic redirects live in `backend/page-routes.js` |
| Browser JavaScript | `js/` |
| Backend helper script | `scripts/backend-server.sh` |
| Local pid/log files | `runtime/` |
| Sample cheque image | `assets/sample-cheque.jpg` |
| Local development data | `data/` |
| Generated outputs | `outputs/` |

## Rule

Before moving any remaining root file, update all scripts, docs, and server
path handling in the same change, then verify the local server.

For local data, runtime files, and generated outputs, see
`docs/DATA_RUNTIME_POLICY.md`.
