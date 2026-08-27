# K-REOS Firestore Rules Test Suite

Automated tests for `rules/firestore.rules`, run entirely against the
Firebase Emulator Suite — **zero risk to production data**, nothing here
ever touches the real `komisiyoneri-platform-prod` project.

## What this actually tests

An earlier version of this note said a `permissions` array (among other
fields) "does not exist anywhere in this codebase." That's no longer true:
the Dynamic RBAC / Progressive Governance work added a real, small
`role_permissions/{role}` collection and a `hasPerm()` rules helper that
narrows a handful of high-risk transitions (property/site approve+reject,
plot status, agent verify/suspend, commission/payout approval, `role`
reassignment) away from the blanket staff-tier trust described below — see
`08-dynamic-rbac-permissions.spec.js`. `partnerOrgId`, `orgType`, and a
`users/{uid}/compensation` sub-collection still don't exist anywhere in this
codebase, confirmed the same way (a full read of `rules/firestore.rules`
and an exhaustive grep of `index.html`).

Outside of that new, narrow permission layer, the model is still a single
`users/{uid}.role` string field, and every staff-tier role (`hr_manager`,
`accountant`, `marketing_manager`, `branch_manager`, `director`,
`chief_broker`, `ceo`, `company_owner`, `admin`, `super_admin`, `staff`,
`operations`) has **identical** trust level for everything NOT explicitly
gated by `hasPerm()` — there is no blanket per-department sub-tier. This
suite tests the real rules as they actually exist. See the "Failures"
section format below, `03-staff-tier-uniform-trust.spec.js` (which documents
the remaining uniform-trust behavior as intended, not a gap), and
`08-dynamic-rbac-permissions.spec.js` (which documents where that uniform
trust is now deliberately narrowed, and why).

## Layout

```
tests/rules/
  package.json        — isolated npm package; nothing added to repo root
                         (this is a zero-build static site served by
                         Vercel — a root package.json could change how
                         Vercel auto-detects the build, so all test
                         tooling and node_modules live here instead)
  testenv.js           — shared Firebase Emulator test-environment factory,
                          loads the REAL rules/firestore.rules (not a copy)
  seed.js               — fixture data: a client, two agents, three
                          differently-roled staff accounts, one admin, plus
                          one doc each in properties/deals/commissions/
                          payout_requests/partners/payroll/reviews/staff_reviews
  generate-report.js    — parses mocha's JSON output into a Markdown report
  test/
    01-ownership-and-selfescalation.spec.js
    02-p0-regression-guards.spec.js   — highest priority: the 5 collections
                                        whose rules document a real,
                                        previously-exploited bug each
    03-staff-tier-uniform-trust.spec.js
    04-public-read-collections.spec.js
    05-messages-dual-shape.spec.js
    06-ceo-vs-operations-director.spec.js
    07-org-chart-hr-legal-reports.spec.js
    08-dynamic-rbac-permissions.spec.js — role_permissions/hasPerm(): Admin's
                                        unconditional bypass, a configured
                                        role succeeding, a non-configured
                                        staff role and an unconfigured role
                                        both denying by default, and the
                                        Admin-only/no-self-escalation
                                        safeguards on the collection itself
  out/                  — generated at run time: results.json, RULES_TEST_REPORT.md
```

## How to run it

From the repo root:

```sh
./scripts/test-rules.sh
```

This starts the Firebase emulator (Firestore + Auth only — no functions
emulator needed, since rules tests don't exercise Cloud Function triggers),
runs the full suite, writes `tests/rules/out/RULES_TEST_REPORT.md`, and
exits non-zero if anything failed.

First run will download `firebase-tools` via `npx` and install
`tests/rules/node_modules` if not already present — expect it to take a
minute or two the first time.

To just re-generate the report from the last run's raw results (e.g. after
manually inspecting `out/results.json`):

```sh
npm --prefix tests/rules run report
```

## Re-run this after any change to `rules/firestore.rules`

Any time the rules file changes, re-run `./scripts/test-rules.sh` before
deploying — the suite loads the file directly, so it always reflects
whatever is currently in the repo.

## Proving the suite has real teeth (one-time manual demo)

To confirm these tests actually catch a real regression, not just pass
trivially:

1. Open `rules/firestore.rules` and temporarily loosen one of the P0-flagged
   guards — e.g. in the `deals` block, change
   `request.resource.data.pipelineStage != 'closed_won'` to `true` (or just
   delete that clause), which reintroduces the exact money-laundering bug
   `02-p0-regression-guards.spec.js` exists to catch.
2. Run `./scripts/test-rules.sh` again.
3. Confirm the run exits non-zero and `RULES_TEST_REPORT.md`'s Failures
   section names the specific test ("owning agent CANNOT self-transition
   their own deal to closed_won") and points at
   `rules/firestore.rules:<line>` for the `deals` block.
4. Revert: `git checkout -- rules/firestore.rules`.

This is a one-time verification step, not something to automate inside the
suite or CI — auto-mutating `rules/firestore.rules` as part of a test run
risks leaving production rules broken if the run is interrupted. The
`02-p0-regression-guards.spec.js` file itself is the permanent, non-mutating
guard against this class of regression ever coming back silently.
