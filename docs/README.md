# BANIK Books Docs

Use this folder as the handoff guide for future development.

## Start Here

1. `../README.md` - quick start and folder overview.
2. `PROJECT_STRUCTURE.md` - complete folder and file layout.
3. `DEVELOPMENT_NOTES.md` - conventions and verification checklist.
4. `CODE_QUALITY.md` - npm checks and editor defaults.

## Route And Script Maps

- `HTML_ROUTE_MAP.md` - dynamic root compatibility URLs and active page
  locations.
- `JS_DEPENDENCY_MAP.md` - browser JavaScript files, dependencies, and page
  script ownership.

## Support Files

- `ROOT_SUPPORT_FILES.md` - why the remaining root files should stay at the
  project root.
- `DATA_RUNTIME_POLICY.md` - how to treat ignored local data, runtime artifacts,
  and generated outputs.
- `SMOKE_TESTS.md` - local route and asset smoke test coverage.
- `VISUAL_QA_CHECKLIST.md` - browser layout QA checklist.
- `NO_VISUAL_REGRESSION_POLICY.md` - architecture refactor guardrails for
  preserving the current frontend design.
- `RELEASE_NOTES.md` - versioned release notes and release metadata update
  rule.
- `PRODUCTION_RELEASE_CHECKLIST.md` - release verification and environment
  handoff checklist.
- `REMAINING_EXTERNAL_STEPS.md` - deployment, credential, migration, and human
  visual-review tasks that cannot be completed inside the repository alone.
- `RELEASE_STATUS.md` - current release state and final local/external task
  split.
- `DEPENDENCY_AUDIT_NOTES.md` - current npm audit status and release guidance.
- `COMMIT_PLAN.md` - suggested commit grouping for this architecture migration.
- `SECURITY_NOTES.md` - local data, Firebase config, and handoff security notes.

## Common Tasks

For a page style change:

1. Edit the matching file in `../frontend/css/pages/`.
2. If the change is responsive-only, check `../frontend/css/responsive/`.
3. Verify `../frontend/styles.css` still imports files in the documented order.

For a page behavior change:

1. Edit the matching file in `../frontend/js/pages/` or
   `../frontend/js/tools/`.
2. Run `node --check` on the changed file.
3. Verify the active page and old root URL with `curl -I`.

For a route change:

1. Update the active page under `../frontend/pages/`.
2. Keep or update the matching route in `../backend/page-routes.js`.
3. Update `HTML_ROUTE_MAP.md`.
4. Verify both URLs.

For a professional handoff check:

1. Run `npm run check`.
2. Review `SECURITY_NOTES.md`.
3. Review `VISUAL_QA_CHECKLIST.md` for changed pages.

For local data or generated output:

1. Keep local database snapshots in `../data/`.
2. Keep pid/log files in `../runtime/`.
3. Keep generated exports in `../outputs/`.
4. Do not commit those folders unless a file has been deliberately sanitized and
   moved to a source/docs location.
