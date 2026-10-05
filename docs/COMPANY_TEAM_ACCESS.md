# Company teams and attributable accounting

Implementation date: 5 October 2026. Release: 1.2.0. GitHub commit and push
approved by the owner; live deployment and rules rollout not verified.

This is the user-approved feature/design change for company team membership,
independent staff logins, permissions and entry history. The Team & Access and
invitation pages, company selector, journal workflow controls and register history
are intentional additions to the existing visual design.

## Account and data compatibility

Every existing account receives an owner membership when it next resolves its
company. The company stores a server-controlled mapping to the existing
`ownerUid::workspaceId` data scope. Ledger data is not moved to a junior's UID,
and the authenticated actor UID is never replaced with the owner's UID.
Existing journal records without a workflow status remain posted for reporting;
unknown historical creators are labelled as legacy, not invented.

Existing users accepting another company's invitation retain their original
company. Invitation-created users are marked `accountType: invited`, skip company
setup and join through a verified-email invitation. The same email/password login
works afterward; multiple memberships are selected at sign-in or in the header.

Legacy directly stored Firestore charts and challans are copied once from the
owner's `userData` paths into the existing backend scope, retaining backend items
when IDs overlap. The source is retained. Browser-only values are never silently
uploaded to an empty company. The client preserves recovery JSON copies when
clearing browser-only drafts/options; verified server-backed arrays are not
duplicated. Recovery copies are bounded per company, and identical untagged
legacy copies are deduplicated. Untagged legacy copies have unverified ownership
and require manual review. Owners can download a recovery copy, then explicitly
confirm its deletion. Normal company/account changes discard old in-memory caches and
cancel pending requests before they can write into the new company.

## Company access

Team & Access is available at `/team.html`. Owners can invite, resend/revoke
invitations, change permissions, suspend/reactivate/remove membership and review
activity. Junior, accountant, viewer and custom presets are configurable.

A junior's default permissions permit preparing/editing their own draft and
submitting it for review. Account/party lookups return only the information
needed to prepare an entry; bank details and opening balances require explicit
read/report permissions. Direct posting, approval, reversing, company-wide
journal visibility, exports, individual financial reports and other modules are
separate permissions. `reports.view` enables all reports; `reports.<page-name>`
enables an individual report. The company owner's platform-enabled modules are
an upper bound on delegable permissions, refreshed on each server request.

Company ownership is separate from BANIK platform administration. A company
owner cannot promote a member to platform admin. Removing one company
membership does not disable the person's Firebase account or their membership
elsewhere. The owner's membership cannot be deleted through the team controls.
Account deletion refuses accounts with company/member history to preserve books
and attribution. An inactive company membership is rejected on its next request.

## Invitations and login

Invites expire in 72 hours; only a hash of the random secret is stored. Acceptance
requires a matching verified email and consumes the invite in a transaction.
Resending rotates the secret, and revocation invalidates it. The invitation page
supports new signup, existing login, verification, password reset and wrong-user
sign-out. Verification emails carry a same-origin return URL to the invitation.
Passwords remain in Firebase Authentication.

Without mail configuration, creating an invitation returns a copyable invitation
link and explicitly says the email was not sent. It does not pretend delivery
succeeded. Optional delivery uses an HTTPS transactional mail endpoint:

- `BANIK_PUBLIC_URL`: canonical HTTPS application origin, used for invite links.
- `BANIK_INVITE_EMAIL_API_URL`: HTTPS mail API endpoint.
- `BANIK_INVITE_EMAIL_API_KEY`: optional bearer token, configured on the host.
- `BANIK_INVITE_EMAIL_FROM`: sender accepted by the configured provider.

The mail endpoint must accept JSON `{from?, to, subject, text}`. Failed delivery
still leaves a valid invitation link; resend invalidates the previous link.
No real invitations or emails are sent by the test suite.

## Journals, reports and audit

The workflow is `draft -> submitted -> posted`, with return-for-correction and
explicit direct posting when granted. Submission and posting require complete,
balanced entries. A submitted entry requires a different creator/submitter and
approver. Posted entries are immutable; corrections use a reasoned reversal that
creates an opposite posted journal and retains the original. Draft deletion is
an audited archive. Only posted journals feed financial report totals.

The server assigns unique journal numbers, authenticated actor IDs and timestamps.
Creation and action request IDs prevent duplicate retries. Versions prevent a
stale editor from overwriting another person's change. Chart collection revision
checks and record versions protect other shared edits. Saves report success only
after a confirmed server response for journals and party records.

An entry mutation and its activity event commit together. Events contain before
and after values, actor identity, company, record, action and server UTC timestamp;
the UI shows Asia/Dhaka time separately from the editable voucher date. Team
membership changes are likewise audited atomically. History is append-only
through application APIs, including after staff removal or backup restore.
Journal bulk replacement is disabled. Backups cannot inject actor identities,
workflow metadata or arbitrary historical activity. Restore is owner-only,
validates the entire native backup and logs the replacement while retaining the
old activity. This is application-level history, not protection against a trusted
infrastructure administrator editing the database directly.

## Storage and release configuration

Production must use Firebase Auth verification and the Firebase storage adapter;
file storage is a single-process local development adapter. Keep
`BANIK_API_REQUIRE_AUTH=true`, `BANIK_API_AUTH_PROVIDER=firebase`,
`BANIK_STORAGE_ADAPTER=firebase`, and `BANIK_API_TRUST_UNVERIFIED_TOKEN=false`.
`NODE_ENV=production` additionally forces token authentication.

Company metadata, memberships, invitations and team events use Firestore
collections prefixed by `BANIK_TEAM_COLLECTION_PREFIX`, defaulting to
`${BANIK_FIRESTORE_ROOT_COLLECTION || 'banikWorkspaceData'}_team`.
Use different storage roots/prefixes for staging and production. File metadata
uses `BANIK_TEAM_DATA_FILE` or `${BANIK_DATA_FILE}.team.json`.

Deploy backend/frontend and the updated `firestore.rules` together. The rules
allow own profile/branding documents and deny direct legacy accounting writes;
all shared accounting writes must pass the server membership/permission checks.
The static server serves only public frontend aliases, never repository files,
credentials or either data store. Configure the deployed domain in Firebase Auth
for signup, verification return links and password reset.

No physical ledger migration is required for owner-scoped backend records. Before
rollout, take a real database backup and verify a representative existing owner,
a new invited user and an existing user invited to a second company in staging.
Verify existing balances, source chart/challan migration, company branding and
permission changes. Legacy challan migration processes at most 440 missing records per transaction
and resumes after interruption; collection access waits for the complete migration.
Large restores exceeding the atomic write/document limits require a staged
restore, not a partially applied import. API request bodies are limited to 5 MiB.

## Verification

- `npm run check:team`: company membership/invite tests, client isolation and
  cache-quota failure handling, actual auth/onboarding scripts with mocked
  Firebase, journal client invariants, accounting concurrency/workflows and
  Firebase contracts.
- `npm run check:api:http`: actual HTTP routing with synthetic authenticated actors,
  cross-company restrictions, private static-file denial, lookup privacy, review,
  audit, backups and revocation.
- `npm run check:browser`: isolated Playwright workflow fixtures; no real accounts.
- `npm run commercial:audit`: existing syntax, API, storage, route and release checks.

Firebase contract tests use an offline transactional fake. They check transaction
read/write order, storage scoping, migration and failure atomicity; they do not
replace a Firestore Emulator or staging test. Live Firebase security-rule and
email-delivery verification require the configured deployment and were not run
against customer accounts during implementation.
