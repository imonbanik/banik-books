# BANIK Books Development Notes

## Local Development

Start the local server:

```bash
./local-server.sh
```

Expected local URL:

```text
http://127.0.0.1:4103
```

Quick page check:

```bash
npm run check
curl -I http://127.0.0.1:4103/journal-entry.html
```

## Root File Convention

- Keep the root folder small and limited to app entry/support files.
- See `README.md` for the quick folder overview.
- See `docs/ROOT_SUPPORT_FILES.md` before moving any remaining root file.
- See `docs/DATA_RUNTIME_POLICY.md` before changing `data/`, `runtime/`, or
  `outputs/`.
- Root files that should stay put for now include `server.js`,
  `local-server.sh`, `package.json`, and `firestore.rules`.

## Data And Runtime Convention

- `data/` is ignored local development data. Do not commit local database
  snapshots.
- `runtime/` is ignored local pid/log state.
- `outputs/` is ignored generated output. Recreate outputs from `scripts/`
  unless a sanitized artifact is intentionally moved to a tracked docs/source
  location.

## CSS Convention

Keep `frontend/styles.css` as the only stylesheet linked from existing HTML
pages. It is served publicly as `/styles.css`, so old URLs and page markup stay
stable while CSS is split.

Use this order:

1. Shared/base styles.
2. Extracted page styles in their original cascade position.
3. Remaining legacy/component/layout styles.
4. Focused responsive overrides.
5. Final page overrides last.

For a new page CSS file:

1. Create `frontend/css/pages/page-name.css`.
2. Move only clearly page-scoped selectors.
3. Add the import to `frontend/styles.css` after shared CSS.
4. Verify the affected page and at least one unrelated page.

## HTML Route Convention

- Current root-level HTML pages are mapped in `docs/HTML_ROUTE_MAP.md`.
- Active HTML pages now live under `frontend/pages/`.
- Root URL compatibility redirects live in `backend/page-routes.js`;
  `server.js` serves them for old links such as `/journal-entry.html`.
- Active pages use `<base href="/" />` so root-level styles, scripts, assets,
  and shim links continue to resolve through public aliases.
- Before moving any page, search every `href`, `script src`, and JavaScript
  navigation reference with `rg`.
- Preserve existing redirect route entries such as `Imon-Cheque.html` and
  `vat-tax-calculator.html` until old URLs are deliberately retired.

## JavaScript Convention

- Current JavaScript dependencies are mapped in `docs/JS_DEPENDENCY_MAP.md`.
- Browser JavaScript files now live under `frontend/js/`.
- When changing JavaScript paths, update every HTML `<script src>` and ES module
  `import` together.
- Keep `server.js` at the project root unless local server scripts are updated
  at the same time.
- Support scripts live in `scripts/`; local runtime pid/log files live in
  `runtime/`.
- Active page/tool scripts have been extracted into `frontend/js/pages/` and
  `frontend/js/tools/`.
- Keep legacy redirect behavior in `backend/page-routes.js` and
  `frontend/pages/redirects/`.
- Run `npm run check:js` before handoff after JavaScript changes.

## Responsive CSS Convention

- Responsive rules live in focused files under `frontend/css/responsive/`.
- Keep responsive imports after `frontend/css/legacy.css` and before final Journal
  overrides.
- Current responsive groups:
  - `frontend/css/responsive/base-responsive.css`
  - `frontend/css/responsive/tools-responsive.css`
  - `frontend/css/responsive/accounting-responsive.css`
  - `frontend/css/responsive/admin-responsive.css`
- When a responsive rule clearly belongs to one page, move it into that page CSS
  only after checking the page at mobile and desktop widths.

## Journal Entry Notes

- Journal Entry uses `frontend/assets/banik-logo.svg`.
- Brand subtitle is `Simple accounting for growing businesses`.
- Base/shared Journal CSS lives in
  `frontend/css/pages/journal-entry-base.css`.
- The active final compact overrides live in
  `frontend/css/pages/journal-entry.css` and must remain the last stylesheet
  import.
- The page keeps root URL `/journal-entry.html`; active page URL is
  `/pages/accounting/journal-entry.html`.
- Run `node --check frontend/js/pages/journal-entry.js` after changes.

## Chart Of Accounts Notes

- Chart of Accounts keeps root URL `/chart-of-accounts.html`.
- COA-specific CSS lives in `frontend/css/pages/chart-of-accounts.css`.
- COA uses shared Journal shell classes such as `journal-hero` and
  `journal-button`, so `journal-entry-base.css` must load before
  `chart-of-accounts.css`.

## EMI Calculator Notes

- EMI Calculator keeps root URL `/emi-calculator.html`.
- EMI-specific CSS lives in `frontend/css/pages/emi-calculator.css`.
- Responsive EMI adjustments live in
  `frontend/css/responsive/tools-responsive.css` until they are safely moved
  into the EMI page module.

## Tax/VAT/Customs Rates Notes

- Tax, VAT and Customs Rates keeps root URL `/tax-vat-customs-rates.html`.
- Its page-specific CSS lives in
  `frontend/css/pages/tax-vat-customs-rates.css`.
- The page reuses some `challan-*` shell classes, so
  `frontend/css/pages/challan-management.css` must load before the rates
  module.
- Responsive rate finder adjustments live in
  `frontend/css/responsive/tools-responsive.css` until they are safely moved
  into the rates page module.

## Workspace Notes

- Workspace keeps root URL `/workspace.html`.
- Workspace-specific CSS lives in `frontend/css/pages/workspace.css`.
- Its import is intentionally before
  `frontend/css/responsive/base-responsive.css` because responsive rules still
  adjust Workspace layout there.

## Detail Page Notes

- Reports placeholder pages and Necessary Tools use the shared `detail-page`
  and `detail-card` classes.
- Their base CSS lives in `frontend/css/pages/detail-pages.css`.
- Responsive adjustments for `detail-card` live in
  `frontend/css/responsive/base-responsive.css` until they are safely moved.

## Payroll Notes

- Payroll Tax Calculator keeps root URL `/payroll-tax-calculator.html`.
- Payroll-specific base CSS lives in
  `frontend/css/pages/payroll-tax-calculator.css`.
- Responsive Payroll adjustments live in
  `frontend/css/responsive/tools-responsive.css` until they are safely moved
  into the Payroll page module.

## VAT/Tax Calculator Notes

- Withholding VAT/Tax Calculator keeps root URL
  `/withholding-vat-tax-calculator.html`.
- Its base CSS lives in
  `frontend/css/pages/withholding-vat-tax-calculator.css`.
- Responsive VAT/Tax adjustments live in
  `frontend/css/responsive/tools-responsive.css` until they are safely moved
  into the VAT/Tax page module.

## Admin Notes

- Admin keeps root URL `/admin.html`.
- Admin-specific base CSS lives in `frontend/css/pages/admin.css`.
- Shared access-denied styling remains in `frontend/css/legacy.css` because it
  is not specific to only the Admin page.

## Challan Notes

- Challan Management keeps root URL `/challan-management.html`.
- Challan-specific CSS lives in `frontend/css/pages/challan-management.css`.
- Some `challan-*` shell classes are reused by related tools such as Tax, VAT &
  Customs Rates; keep those selectors in the Challan module until a shared tools
  shell module is created.
- Responsive Challan adjustments live in
  `frontend/css/responsive/tools-responsive.css` until they are safely moved
  into the Challan page module.

## Invoice Generator Notes

- Invoice Generator keeps root URL `/invoice-generator.html`.
- Invoice-specific CSS lives in `frontend/css/pages/invoice-generator.css`.
- Invoice print rules moved with the page module because they only apply to
  Invoice Generator print mode.
- Responsive invoice adjustments live in
  `frontend/css/responsive/tools-responsive.css` until they are safely moved
  into the Invoice page module.

## Verification Checklist

After frontend changes, run:

```bash
npm run check
```

For broader CSS changes, also check:

```bash
curl -I http://127.0.0.1:4103/workspace.html
curl -I http://127.0.0.1:4103/chart-of-accounts.html
curl -I http://127.0.0.1:4103/invoice-generator.html
curl -I http://127.0.0.1:4103/challan-management.html
```

## Git Safety

The worktree may already contain user changes. Do not revert unrelated files.
Before large moves, inspect references with `rg` and keep edits scoped.
