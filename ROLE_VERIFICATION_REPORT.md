# K-REOS Role Verification Report

Production-readiness verification for all 9 staff roles (10 named in the
request — see the Sales Manager note below) and 4 partner orgTypes.

## Verification method (stated explicitly, per this task's own agreement)

This sandbox has no Firebase CLI or network access to the live Firebase
project — real Firebase Auth accounts could not be created, and no
literal "log in as each role against production" was performed. Every
finding below was verified by:
1. Code-level tracing: the exact `go()` redirect, Firestore query, and
   security rule for each role, cross-referenced against what the role's
   forms actually write.
2. Playwright against a mocked Firestore (the same method used throughout
   this whole engagement) — confirming routing to the correct page for
   all 10 roles, and confirming the one genuinely novel piece of new
   logic (Finance's within-limit vs. above-limit branching) produces the
   correct writes.

This is not the same as a live production test. It is the most rigorous
verification possible without that access, and is stated as such rather
than implied to be more than it is.

## Critical fix found and applied (blocks everything below without it)

**`restoreUserSession()` never populated `currentUser.department`,
`.jobTitle`, `.reportsTo`, `.deniedActions`, `.budgetApprovalLimit`,
`.branchId`, or `.departmentId`** — even though `changeUserRole()` writes
all of these correctly to Firestore. Every real login therefore had
`currentUser.reportsTo` permanently `undefined`, no matter how correctly
it was set in the database, which meant:
- `submitReport()`'s `recipients` was always empty → **every report
  submission by every non-CEO governance role failed immediately** with
  "No recipients configured for your role."
- `requestApproval()`'s `routedTo` was always empty → **every
  approval-escalation request failed immediately** with "No approver is
  configured for your role."

This was previously reported as "confirmed working" in an earlier
code-trace pass of this engagement — that pass verified the
routing/query logic correctly but never traced whether the field
actually reaches `currentUser` at runtime. **Fixed** in this pass; see
the commit for detail.

**Rollout note:** this self-heals for every new login, but an account
already logged in with a stale cached session (`localStorage['km_current']`
saved before this fix) will not pick up the fields until they log out and
back in, since `restoreUserSession()` skips its own Firestore re-read
when `currentUser.uid` already matches. Not expected to matter in
practice (a small population, and this deploys before most of them are
mid-session), but noted for completeness.

---

## Staff Roles

### CEO (`role: 'ceo'`)
- **Dashboard:** ✓ routes to `page-exec` (`loadExecDash`). ✓ Company-wide
  KPIs, Reports Received, Pending Approvals — all real Firestore queries.
  Reports Received/Approvals converted to real-time in an earlier pass of
  this engagement. ✓ Correctly scoped (company-wide aggregates, as
  expected for the top of the org chart).
- **Primary write action(s):** Approve/reject a pending approval
  (`decideApproval`) — ✓ confirmed: updates `approvals.status`, and
  `onApprovalDecided` (functions/index.js) performs the real privileged
  write to the target collection server-side once approved; a rejection
  now notifies the requester (fixed in an earlier pass). Also: Strategy
  Documents, Share Structure, and (new this pass) Major Contracts —
  ✓ all three genuinely persist via `ref.set()`, all CEO-gated by rules.
- **Issues found and fixed (this pass):** the critical `reportsTo`
  population bug above directly affects CEO too (their own report
  submissions, if they ever submit one via the same `submitReport()`
  path, though CEO is exempted from the "recipients required" check).

### Operations Director (`role: 'director'`)
- **Dashboard:** ✓ routes to `page-exec`, shared with CEO — scoped down
  automatically (the CEO-only Approvals panel is gated to
  `role==='ceo'` OR the request's own `routedTo` containing the
  Director's uid; see below). ✓ real-time. ✓ correctly scoped.
- **Primary write action(s):** Submit a Daily/Weekly Operations Report
  (`submitReport`) — ✓ **now** confirmed working (was silently broken by
  the critical bug above; fixed this pass). Approve a request routed to
  them — ✓ fixed this pass: was rules-permitted but functionally dead
  (UI gated to literal `'ceo'`, and the Cloud Function's re-verification
  hardcoded `actorRole !== 'ceo'`, reverting even a legitimate Director
  decision). Both sides now match.
- **Issues found and fixed:** the reportsTo bug (blocking); the
  Director-approval dead pathway (fixed in the prior PR, re-verified
  here).

### Director of Finance (`role: 'accountant'`)
- **Dashboard:** ✓ **built this pass** — previously fell through to the
  generic Agent dashboard (same bug class as CEO's earlier fix, just not
  yet closed for this role). Now `page-finance-mgr`: pending/approved
  budget requests, expenses this month, own approval limit — all real,
  scoped to `requestedBy==uid` (own requests) or company-wide expense
  total. Budget requests list is real-time (`onSnapshot`).
- **Primary write action(s):** Submit a budget request within limit —
  **✓ confirmed via Playwright** (mocked write tracker): writes directly
  to `financeTransactions` with `status:'approved'`. Submit one above
  limit — **✓ confirmed via Playwright**: correctly routes through
  `/approvals` (`requestApproval('financeTransactions', 'spend_above_limit', ...)`)
  instead of a direct write, which `firestore.rules`' `financeTransactions`
  create rule would otherwise reject outright. `routedTo` is correctly
  populated from `currentUser.reportsTo` (only possible because of this
  pass's critical fix).
- **Issues found and fixed:** no dashboard existed at all; the
  `budgetApprovalLimit` field had no UI to set it (added to the Staff
  Profile org-chart editor, CEO-only, gated on the `users/{uid}` rule
  that already protected the field). Task named a "budget requests"
  collection specifically — the app already had a better-fitting,
  self-service `financeTransactions` collection designed by an earlier
  phase (checks the limit at create time, no separate approve step
  needed when within limit); used that instead of inventing a
  parallel `budgetRequests` flow, and documented the substitution here.

### Chief Broker (`role: 'chief_broker'`, department: Brokerage)
- **Dashboard:** ✓ **built this pass** — `page-brokerage-mgr`: total
  agents, deals in pipeline, closed-won this month (all company-wide
  KPIs, correctly scoped for a brokerage-wide role), active sales
  targets. Targets list is real-time.
- **Primary write action(s):** Set a sales target
  (`submitSalesTarget`) — ✓ confirmed: writes to the new `sales_targets`
  collection with all 7 standard fields. Visibility: read-only to
  `isInternalTeam()` (includes `'agent'`) — ✓ matches the task's "Sales
  Manager can see it read-only" intent.
- **Issues found and fixed:** no dashboard, no sales-target feature
  existed at all — both built this pass. **Naming mismatch flagged, not
  fixed as a new role:** this app's real data model (`ROLE_DEPARTMENT`,
  `ROLE_SUPERIOR_ROLES`, `AS_PROVISIONABLE_ROLES` — all three files kept
  in sync) has no `'sales_manager'` role; Chief Broker (department
  Brokerage) is the real, only role for this function. Inventing a
  fictional role to satisfy the task's literal wording would have
  created a role nothing else in the app (rules, org chart, provisioning
  panel) recognizes — reusing the real one and documenting the mismatch
  here was judged the more correct choice.

### Marketing Manager (`role: 'marketing_manager'`)
- **Dashboard:** ✓ **built this pass** — `page-marketing-mgr`: active
  campaigns, leads this month, top lead source (computed from
  `leads.source`), total campaigns. Campaigns list is real-time.
- **Primary write action(s):** Create a campaign
  (`submitCampaign`) — ✓ confirmed: writes to the new `campaigns`
  collection with all 7 standard fields, displays immediately on the
  same dashboard via the live listener.
- **Issues found and fixed:** no dashboard, no campaigns feature existed
  — both built this pass.

### CustomerSupport Manager (`role: 'customer_support_manager'`)
- **Dashboard:** ✓ **built this pass** — `page-support-mgr`: open
  tickets, resolved this month, total tickets. Real-time.
- **Primary write action(s):** Log a support ticket
  (`submitSupportTicket`) — ✓ confirmed: writes to the new
  `support_tickets` collection, status `'open'`. Resolve a ticket
  (`resolveSupportTicket`) — ✓ confirmed: updates `status:'resolved'`,
  correctly moves out of the "open" KPI live.
- **Issues found and fixed:** no dashboard, no ticket feature existed —
  both built this pass.

### IT / Product Manager (`role: 'it_manager'`)
- **Dashboard:** ✓ **built this pass** — `page-it-mgr`: changes logged
  this month, total log entries, recent audit-log event count (reuses
  the existing `auditlogs` collection). Real-time change log.
- **Primary write action(s):** Log a system change
  (`submitSystemChange`) — ✓ confirmed: writes to the new
  `system_changes` collection, plus a `logAudit()` call so it's also
  visible in the company-wide audit trail.
- **Issues found and fixed:** no dashboard, no system-change-log feature
  existed — both built this pass. The task's own phrasing ("whatever
  their primary write action is, e.g. a system log entry or config
  change request") was deliberately interpreted as the simpler,
  concrete "system log entry" — a direct department-scoped write, not
  routed through `/approvals`, since `ROLE_DENIED_ACTIONS.it_manager`
  only restricts unapproved *architecture changes* and *data deletion*,
  not routine change logging.

### HR Manager (`role: 'hr_manager'`)
- **Dashboard:** ✓ already existed (`page-hr-mgr`, built in an earlier
  phase) — total staff, departments, pending leaves, open job postings.
  Leave list already converted to real-time in an earlier pass.
  ✓ correctly scoped.
- **Primary write action(s):** Process a leave request
  (`hrMgrProcessLeave`) — ✓ confirmed working (pre-existing, re-verified
  this pass). **Employee-record visibility check (explicit task
  requirement):** `employeeRecords` (rules already scope read/write to
  `inDept('HR') || isExecutive()`) has **no UI in `index.html` at all**
  — HR's actual employee-management UI is the pre-existing Staff
  Directory (`users` collection, admin-tier), not this collection. The
  rules-level HR/Executive-only isolation the task asks to confirm
  ("NOT visible to non-HR/Executive roles") is correctly enforced for
  whichever surface is used; `employeeRecords` itself remains an unused,
  correctly-secured but empty collection — flagged, not built, since HR
  record-keeping already has a working home elsewhere and building a
  second, parallel one wasn't asked for as a fix, only as a
  verification target.
- **Issues found but NOT fixed:** `employeeRecords` has no UI (see
  above) — flagged for a future decision on whether it should replace or
  supplement the existing Staff Directory.

### Legal Adviser (`role: 'legal_adviser'`)
- **Dashboard:** ✓ **built this pass** — `page-legal-mgr`: major
  contracts on file, awaiting review, reviewed by me. Both contracts and
  own-review lists are real-time.
- **Primary write action(s):** Submit a contract review note
  (`submitContractReview`) — ✓ confirmed: writes **only** to
  `contractReviews` (contractId, reviewerId, note) — **explicitly
  verified the write never touches `majorContracts.status`/`.signedBy`/
  `.signedAt`** (separate function, separate collection, no shared write
  path). Signing (`markContractSigned`) is a completely separate
  function only reachable from the CEO-only Major Contracts panel, using
  the CEO's own `currentUser.uid`, not Legal's.
- **Issues found and fixed:** no dashboard existed. `majorContracts` had
  **no creation UI anywhere** (CEO-only create per rules, but nothing to
  create it with) — without one, Legal's review feature would have had
  nothing to review, so a minimal CEO-only "Add Major Contract"/"Mark
  Signed" panel was added to the Exec dashboard's existing Quick Links
  section this pass.

---

## Partner OrgTypes

Real partner types in this app's data model (`PARTNER_TYPES`):
`surveyor`, `notary`, `lawyer`, `bank`, `inspector`, `valuer` — plus
`construction` and `insurance`, **added this pass**. There is no
separate `partnerOrgId` field anywhere in the codebase; a partner is an
individual `partners/{id}` document linked to a login account via
`userId`, not a multi-user "organization" — every partner-scoping check
in this app (job assignment, invoices, reviews) is keyed off that
document's own id or the linked account's `uid`, not a distinct org
concept. The 4 orgTypes named in this task map as follows:

### Bank (`partnerType: 'bank'`)
- **Dashboard:** ✓ already existed and already verified (an earlier
  phase built `page-partner-dashboard`) — company/specialty name,
  verification badge, job stats, "My Assigned Jobs", reviews.
  ✓ correctly scoped: every query filters `assignedToId==uid` or
  `partners.userId==uid`, so one partner never sees another's data.
- **Primary write action(s):** Submit a mortgage/loan verification note
  — the closest real equivalent is `submitPartnerJobReport()` (a
  service the partner was assigned, marked completed with a report URL)
  — ✓ confirmed working (verified in an earlier phase of this
  engagement, and the "Assign Bank" dropdown bug that fed jobs to a bank
  partner in the first place was fixed in an earlier pass of this exact
  engagement).

### Legal (`partnerType: 'lawyer'`)
- Same dashboard/scoping as Bank above (generic partner dashboard, works
  identically for any `partnerType`). ✓ Primary write action:
  `submitPartnerJobReport()` for an assigned legal-review service job —
  ✓ confirmed working, same mechanism as Bank.

### Construction (`partnerType: 'construction'`) — **added this pass**
- **Dashboard:** ✓ the existing generic partner dashboard now applies —
  no code change needed beyond adding the type, since the dashboard is
  data-driven by whatever `partnerType` a partner's own document holds.
- **Primary write action(s):** "Submit a project update" — the closest
  real equivalent is the same `submitPartnerJobReport()` used by every
  other partner type (assigned service → report → payout invoice).
  **Not separately verified with construction-specific sample data**
  (no construction partner account exists yet to test against, since
  none was ever provisioned) — flagged as untested-with-real-data,
  though the code path is identical to Bank/Legal's already-verified one.

### Insurance (`partnerType: 'insurance'`) — **added this pass**
- Same as Construction: dashboard applies automatically, primary write
  action is the same generic job-report pipeline, not separately
  verified with insurance-specific sample data.

---

## Summary

| Role | Dashboard correct/real-time/scoped | Primary write confirmed | Fixed this pass |
|---|---|---|---|
| CEO | ✓/✓/✓ | ✓ | reportsTo bug (shared) |
| Operations Director | ✓/✓/✓ | ✓ | reportsTo bug + Director-approval (prior PR) |
| Director of Finance | ✓/✓/✓ (new) | ✓ (Playwright-verified) | dashboard + budget-limit UI, both new |
| Chief Broker | ✓/✓/✓ (new) | ✓ | dashboard + sales_targets, both new |
| Marketing Manager | ✓/✓/✓ (new) | ✓ | dashboard + campaigns, both new |
| CustomerSupport Manager | ✓/✓/✓ (new) | ✓ | dashboard + support_tickets, both new |
| IT Manager | ✓/✓/✓ (new) | ✓ | dashboard + system_changes, both new |
| HR Manager | ✓/✓/✓ (existing) | ✓ | none needed |
| Legal Adviser | ✓/✓/✓ (new) | ✓ | dashboard + contractReviews UI + majorContracts creation, all new |
| Bank partner | ✓/✓/✓ (existing) | ✓ | none needed this pass |
| Legal partner | ✓/✓/✓ (existing) | ✓ | none needed this pass |
| Construction partner | ✓/✓/✓ (existing pipeline, new type) | code-path identical to Bank, not separately data-tested | orgType added |
| Insurance partner | ✓/✓/✓ (existing pipeline, new type) | code-path identical to Bank, not separately data-tested | orgType added |

**Not fixed, flagged for follow-up:**
- `employeeRecords` collection has no UI — HR's actual record-keeping
  uses the pre-existing Staff Directory instead; decide whether to
  consolidate or leave as-is.
- Construction/Insurance partner job flows share code with Bank/Legal
  but have no real sample data to confirm against — recommend
  provisioning one test account of each once real Firebase access
  exists.
- Same rollout note as the critical fix above: already-logged-in
  sessions need a fresh login to pick up the newly-populated
  `reportsTo`/`department`/`budgetApprovalLimit` fields.
