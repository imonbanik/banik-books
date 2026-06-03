# No Visual Regression Policy

Architecture refactors must preserve the current frontend experience unless a
separate design task explicitly approves visual changes.

## Locked During Architecture Work

- Page layout and section order.
- Text content and labels.
- Colors, spacing, borders, shadows, and typography.
- Button placement and form flow.
- Existing links, exports, filters, and report behavior.

## Allowed During Architecture Work

- Moving duplicate files into safer folders.
- Replacing direct data writes with backend API calls.
- Extracting repeated JavaScript helpers when behavior stays the same.
- Adding tests, audits, and documentation.
- Improving backend validation, auth, permissions, and storage adapters.

## Required Checks

Run before handoff:

```bash
npm run check
npm run commercial:audit
```

If a refactor intentionally changes UI, document it as a design task first.
