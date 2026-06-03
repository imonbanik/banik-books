# Smoke Tests

Smoke tests verify that the main local URLs and important static assets respond
successfully. These are public browser paths; `server.js` maps frontend static
paths to source files under `frontend/`.

## Run

Start the local server:

```bash
./local-server.sh
```

Then run:

```bash
npm run check:smoke
```

## Covered Paths

- `/journal-entry.html`
- `/pages/accounting/journal-entry.html`
- `/workspace.html`
- `/pages/workspace/workspace.html`
- `/journal-register.html`
- `/pages/reports/journal-register.html`
- `/general-ledger.html`
- `/pages/reports/general-ledger.html`
- `/party-wise-transaction.html`
- `/pages/reports/party-wise-transaction.html`
- `/trial-balance.html`
- `/pages/reports/trial-balance.html`
- `/statement-of-financial-position.html`
- `/pages/reports/statement-of-financial-position.html`
- `/statement-of-profit-loss-and-oci.html`
- `/pages/reports/statement-of-profit-loss-and-oci.html`
- `/statement-of-changes-in-equity.html`
- `/pages/reports/statement-of-changes-in-equity.html`
- `/statement-of-cash-flows.html`
- `/pages/reports/statement-of-cash-flows.html`
- `/party-management.html`
- `/pages/workspace/party-management.html`
- `/invoice-generator.html`
- `/pages/tools/invoice-generator.html`
- `/styles.css`
- `/css/pages/journal-entry.css`
- `/css/responsive/base-responsive.css`
- `/js/pages/journal-entry.js`
- `/js/pages/journal-register.js`
- `/js/pages/general-ledger.js`
- `/js/pages/party-wise-transaction.js`
- `/js/pages/trial-balance.js`
- `/js/pages/statement-of-financial-position.js`
- `/js/pages/statement-of-profit-loss-and-oci.js`
- `/js/pages/statement-of-changes-in-equity.js`
- `/js/pages/statement-of-cash-flows.js`
- `/js/pages/party-management.js`
- `/assets/banik-logo.svg`

Add a route here when it becomes business-critical or when future refactors move
its active HTML, CSS, JS, or assets.
