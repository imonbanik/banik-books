# Code Quality

This project uses lightweight checks that do not require installing extra npm
packages.

## Scripts

Run all checks:

```bash
npm run check
```

Run only JavaScript syntax checks:

```bash
npm run check:js
```

Run only local route smoke checks:

```bash
npm run check:smoke
```

`check:smoke` expects the local app to be running at:

```text
http://127.0.0.1:4103
```

Use a different local server URL with:

```bash
SMOKE_BASE_URL=http://127.0.0.1:4104 npm run check:smoke
```

## Editor Defaults

`.editorconfig` keeps indentation, newlines, and trailing whitespace consistent.
`.prettierignore` excludes local data, runtime logs, and generated outputs.

## Before Handoff

1. Run `npm run check`.
2. Check the page you changed in the browser.
3. Update the route/script docs if a file path changed.
4. Keep ignored local data out of commits.
