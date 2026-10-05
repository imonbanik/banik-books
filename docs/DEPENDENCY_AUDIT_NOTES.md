# Dependency Audit Notes

Last checked: 2026-10-05.

## Current Finding

`npm audit --omit=dev` initially reported 13 findings: 9 moderate, 3 high and
1 critical. Applied compatible fixes with `npm audit fix --omit=dev`, updating
the lockfile's affected multipart, gRPC, protobuf and WebSocket dependencies.

The final audit reports 8 moderate findings through the transitive `uuid`
dependency in Google Cloud/Firebase packages; no high or critical findings
remain. The audit command still exits nonzero because of these findings.
`npm audit fix --force` proposes `firebase-admin@14.5.0`, a major upgrade outside
the current dependency range. That migration requires separate compatibility
review and was not applied as part of this feature release.

## Release Rule

- Keep `firebase-admin` on the latest compatible version.
- Re-run `npm audit --omit=dev` before production release.
- Apply non-breaking audit fixes when available.
- Do not run `npm audit fix --force` unless the downgrade/major change is
  reviewed and tested.
