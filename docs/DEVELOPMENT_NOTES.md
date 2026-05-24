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
curl -I http://127.0.0.1:4103/journal-entry.html
```

## CSS Convention

Keep `styles.css` as the only stylesheet linked from existing HTML pages. It is
an import hub, so old URLs and page markup stay stable while CSS is split.

Use this order:

1. Shared/base styles.
2. Extracted page styles in their original cascade position.
3. Remaining legacy/component/layout styles.
4. App-wide responsive overrides.
5. Final page overrides last.

For a new page CSS file:

1. Create `css/pages/page-name.css`.
2. Move only clearly page-scoped selectors.
3. Add the import to `styles.css` after shared CSS.
4. Verify the affected page and at least one unrelated page.

## HTML Route Convention

- Current root-level HTML pages are mapped in `docs/HTML_ROUTE_MAP.md`.
- Active HTML pages now live under `pages/`.
- Root URL compatibility shims live under `routes/compat/`; `server.js` serves
  them for old links such as `/journal-entry.html`.
- Active pages use `<base href="/" />` so root-level styles, scripts, assets,
  and shim links continue to resolve correctly.
- Before moving any page, search every `href`, `script src`, and JavaScript
  navigation reference with `rg`.
- Preserve existing redirect/shim pages such as `Imon-Cheque.html` and
  `vat-tax-calculator.html` until old URLs are deliberately retired.

## JavaScript Convention

- Current JavaScript dependencies are mapped in `docs/JS_DEPENDENCY_MAP.md`.
- Browser JavaScript files now live under `js/`.
- When changing JavaScript paths, update every HTML `<script src>` and ES module
  `import` together.
- Keep `server.js` at the project root unless local server scripts are updated
  at the same time.
- Support scripts live in `scripts/`; local runtime pid/log files live in
  `runtime/`.
- Extract inline page scripts only one page at a time and verify that page after
  each extraction.

## Responsive CSS Convention

- App-wide responsive rules live in `css/responsive/app-responsive.css`.
- Keep `css/responsive/app-responsive.css` imported after `css/legacy.css` and
  before final Journal overrides.
- When a responsive rule clearly belongs to one page, move it into that page CSS
  only after checking the page at mobile and desktop widths.

## Journal Entry Notes

- Journal Entry uses `assets/banik-logo.svg`.
- Brand subtitle is `Simple accounting for growing businesses`.
- Base/shared Journal CSS lives in `css/pages/journal-entry-base.css`.
- The active final compact overrides live in `css/pages/journal-entry.css` and
  must remain the last stylesheet import.
- The page keeps root shim URL `/journal-entry.html`; active page URL is
  `/pages/accounting/journal-entry.html`.
- Run `node --check js/pages/journal-entry.js` after changes.

## Chart Of Accounts Notes

- Chart of Accounts keeps root URL `/chart-of-accounts.html`.
- COA-specific CSS lives in `css/pages/chart-of-accounts.css`.
- COA uses shared Journal shell classes such as `journal-hero` and
  `journal-button`, so `journal-entry-base.css` must load before
  `chart-of-accounts.css`.

## EMI Calculator Notes

- EMI Calculator keeps root URL `/emi-calculator.html`.
- EMI-specific CSS lives in `css/pages/emi-calculator.css`.
- Responsive EMI adjustments live in `css/responsive/app-responsive.css` until
  they are safely moved into the EMI page module.

## Tax/VAT/Customs Rates Notes

- Tax, VAT and Customs Rates keeps root URL `/tax-vat-customs-rates.html`.
- Its page-specific CSS lives in `css/pages/tax-vat-customs-rates.css`.
- The page reuses some `challan-*` shell classes, so
  `css/pages/challan-management.css` must load before the rates module.
- Responsive rate finder adjustments live in `css/responsive/app-responsive.css`
  until they are safely moved into the rates page module.

## Workspace Notes

- Workspace keeps root URL `/workspace.html`.
- Workspace-specific CSS lives in `css/pages/workspace.css`.
- Its import is intentionally before `css/responsive/app-responsive.css` because
  responsive rules still adjust Workspace layout there.

## Detail Page Notes

- Reports placeholder pages and Necessary Tools use the shared `detail-page`
  and `detail-card` classes.
- Their base CSS lives in `css/pages/detail-pages.css`.
- Responsive adjustments for `detail-card` live in
  `css/responsive/app-responsive.css` until they are safely moved.

## Payroll Notes

- Payroll Tax Calculator keeps root URL `/payroll-tax-calculator.html`.
- Payroll-specific base CSS lives in `css/pages/payroll-tax-calculator.css`.
- Responsive Payroll adjustments live in `css/responsive/app-responsive.css`
  until they are safely moved into the Payroll page module.

## VAT/Tax Calculator Notes

- Withholding VAT/Tax Calculator keeps root URL
  `/withholding-vat-tax-calculator.html`.
- Its base CSS lives in `css/pages/withholding-vat-tax-calculator.css`.
- Responsive VAT/Tax adjustments live in `css/responsive/app-responsive.css`
  until they are safely moved into the VAT/Tax page module.

## Admin Notes

- Admin keeps root URL `/admin.html`.
- Admin-specific base CSS lives in `css/pages/admin.css`.
- Shared access-denied styling remains in `css/legacy.css` because it is not
  specific to only the Admin page.

## Challan Notes

- Challan Management keeps root URL `/challan-management.html`.
- Challan-specific CSS lives in `css/pages/challan-management.css`.
- Some `challan-*` shell classes are reused by related tools such as Tax, VAT &
  Customs Rates; keep those selectors in the Challan module until a shared tools
  shell module is created.
- Responsive Challan adjustments live in `css/responsive/app-responsive.css`
  until they are safely moved into the Challan page module.

## Invoice Generator Notes

- Invoice Generator keeps root URL `/invoice-generator.html`.
- Invoice-specific CSS lives in `css/pages/invoice-generator.css`.
- Invoice print rules moved with the page module because they only apply to
  Invoice Generator print mode.
- Responsive invoice adjustments live in `css/responsive/app-responsive.css`
  until they are safely moved into the Invoice page module.

## Verification Checklist

After frontend changes, run:

```bash
node --check js/pages/journal-entry.js
curl -I http://127.0.0.1:4103/journal-entry.html
curl -I http://127.0.0.1:4103/pages/accounting/journal-entry.html
curl -I http://127.0.0.1:4103/styles.css
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
