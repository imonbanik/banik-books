# Data And Runtime Policy

This project has a few folders that are useful during local development but
should not be treated as source code.

## `data/`

`data/` is for local development data only.

Current local file:

- `data/app-data.json`
- `data/banik-books-db.json` may exist as older local development data.

This file may contain local users, sessions, or other development records. Keep
`data/` ignored and do not commit local database snapshots unless there is a
deliberate sanitized fixture/seed-data task.

If a future developer needs sample data, create a sanitized fixture outside the
ignored `data/` folder, for example:

```text
docs/fixtures/example-banik-books-db.json
```

## `runtime/`

`runtime/` is for local process artifacts such as:

- `runtime/local-server.pid`
- `runtime/local-server.log`

These files change while the local server is running and should not be committed.

## `outputs/`

`outputs/` is for generated artifacts, such as spreadsheet exports or extracted
rate-finder workbooks. Generated files should be recreated from `scripts/`
instead of committed by default.

Current generator:

```text
scripts/build-rate-finder-xlsx.py
```

## Rule

Do not put source code in `data/`, `runtime/`, or `outputs/`. If a file must be
versioned, place it in a source/docs folder and explain why in the matching docs.
