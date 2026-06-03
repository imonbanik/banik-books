# Dependency Audit Notes

Last checked: 2026-06-03.

## Current Finding

Installing `firebase-admin` adds transitive `uuid` advisories through Google
Cloud/Firebase packages. `npm audit fix --omit=dev` does not resolve them.
`npm audit fix --force` currently suggests a breaking downgrade of
`firebase-admin`, so it should not be applied blindly.

## Release Rule

- Keep `firebase-admin` on the latest compatible version.
- Re-run `npm audit --omit=dev` before production release.
- Apply non-breaking audit fixes when available.
- Do not run `npm audit fix --force` unless the downgrade/major change is
  reviewed and tested.
