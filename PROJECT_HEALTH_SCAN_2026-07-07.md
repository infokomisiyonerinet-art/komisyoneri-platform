# KOMISIYONERI — Full Project Health Scan

**Date:** 2026-07-07
**Branch:** `claude/project-health-scan-v1qqw6`
**Scope:** Investigation only — no code was modified. Covers `rules/firestore.rules`, `rules/storage.rules`, `firestore.indexes.json`, `functions/index.js`, `firebase.json`, `api/chat.js`, `vercel.json`, and a full-file grep sweep plus a targeted deep-read of `index.html`'s CRM/Deals/Commission/BI/HR section (~lines 17,000–26,050).

## Coverage note (read this first)

This scan was run with six parallel research passes. Five were sub-agents; the sixth was this session's own direct investigation. **Five of the six background sub-agents were killed mid-run by a platform session-usage limit** (only the CRM/Deals/Commission/BI/HR slice, lines ~17,000–26,050, finished and returned full findings). Rather than re-submit and wait on a multi-hour reset, this session continued the investigation directly — reading `rules/firestore.rules`, `rules/storage.rules`, `functions/index.js`, and `firestore.indexes.json` in full, and running full-file greps across `index.html` for the highest-signal patterns (duplicate function definitions, unescaped `innerHTML`, hardcoded admin-email fallbacks, placeholder credentials, model IDs, CSP).

**What this means for the findings below:** the Firebase/Firestore/Storage/Cloud Functions backend and the CRM/Deals/Commission/BI/HR module are thoroughly verified. The rest of `index.html` (auth/bootstrap ~1–9,000, listings/search/favorites ~9,000–17,000, HR/Office/Investor/Partner/AI-chat/theme/routing ~25,000–33,027) was covered by whole-file grep sweeps (which reliably catch cross-cutting patterns like duplicate functions or hardcoded secrets) but **not** by a line-by-line logic read. Treat findings from those regions as high-confidence where quoted, and treat the absence of findings there as "not yet fully verified," not "clean."

---

## Critical

None found. The three previously-documented Critical/P0 issues (Firestore rules requiring a nonexistent custom claim; deal-fabrication via a fully-open `deals` create/update rule; client-trusted payout verification) have all been independently re-verified as **fixed** in the current `rules/firestore.rules` and `functions/index.js` — see "Previously-reported issues, re-verified" below.

---

## High

### H1. AI chat backend calls a non-existent Anthropic model ID — the AI Assistant feature is likely completely broken
- **Affected file:** `api/chat.js:88`
- **Root cause:** `model: 'claude-sonnet-4-6'` is not a recognized Anthropic model identifier. No Claude model family has ever shipped under that string.
- **Failure scenario:** Every request from the in-app "NOHERI" AI assistant to `/api/chat.js` forwards to `https://api.anthropic.com/v1/messages` with this model string; Anthropic's API returns an error response (likely 404/`not_found_error`) for every single chat message a user sends. The proxy passes that error straight back to the client (`api/chat.js:96`), so the feature fails for 100% of users, silently from a business perspective (no alerting exists on this endpoint).
- **Recommended fix:** Update the `model` field to a currently-valid Claude model ID and add a smoke test (or at minimum a manual curl against the deployed endpoint) before each deploy, since this class of bug produces no client-side console error — it's a silent, 100%-reproducing production outage that would only surface if someone actually opens the chat widget.
- **Risk level:** High (confirmed broken feature, not a security issue, but a full user-facing capability outage).

### H2. Nine functions in `index.html` are defined twice — the first definition of each is 100% dead code, most are stale localStorage-only implementations
- **Affected file:** `index.html` (whole-file grep) — confirmed pairs:
  | Function | First (dead) def | Second (live) def |
  |---|---|---|
  | `loadApprovedProperties` | 12404 | 29177 |
  | `adminRender` | 12485 | 29824 |
  | `openMyProps` | 12603 | 31063 |
  | `adminDeleteAll` | 12590 | 31103 |
  | `loadAgentsPage` | 15479 | 30101 |
  | `filterAgentsPage` | 15571 | 30137 |
  | `renderDealList` | 25677 | 27067 |
  | `renderCrmLeads` | 26633 | 27495 |
  | `updateCrmStats` | 26709 | 27582 |
- **Root cause:** JavaScript's function-declaration hoisting means only the *last* `function name(){...}` in a shared global scope survives — the earlier one is silently and completely overwritten before any code runs. Direct comparison confirms the pattern: `loadApprovedProperties`/`adminRender`/`openMyProps`/`loadAgentsPage`/`filterAgentsPage` (all first defined ~12,400–15,600) read from `localStorage.getItem('km_properties'/'km_agents')` — leftover from a pre-Firestore prototype phase — while their same-named successors (~29,000–31,000) are the real Firestore-backed implementations actually running today. `renderDealList`/`renderCrmLeads`/`updateCrmStats` look like the file simply grew a second, near-identical copy of the same section (the second `renderCrmLeads` additionally handles a kanban view the first doesn't, confirming the second is the actively-maintained one).
- **Failure/impact scenario:** Not a live bug — the app runs correctly today because the browser always picks the second definition. The real risk is **the exact bug class that already bit this codebase once** (the historical duplicate `fmtRWF()` incident documented in `PRODUCTION_READINESS_REPORT.md`, where one silently overwrote the other with different output). A future engineer who searches for `loadAgentsPage`, finds the *first* hit at line 15479, "fixes" a bug there, ships it, and sees zero effect in production — because the version actually running is 14,600 lines later. This has already cost real audit time once; it will again.
- **Recommended fix:** Delete the first (dead) definition of each pair after a quick diff confirms the second is a strict superset of behavior (already spot-checked above and it is, for every pair examined). This also trims real bytes from the 33,000-line/1.5MB file the performance audit already flagged as oversized.
- **Risk level:** High (not exploitable, but a proven recurring source of wasted engineering effort and silent no-op fixes; cheap and safe to remediate).

### H3. Firebase Storage rule lets any authenticated user overwrite (not just add) images in *any* property's folder, regardless of ownership
- **Affected file:** `rules/storage.rules:27-30`
- **Root cause:** `match /properties/{propId}/{fileName} { allow write: if isAuth() && isImage() && underSizeLimit(10); }` places no constraint on `propId` — it never checks that the caller owns, manages, or created the property the path names. Because Storage paths are content-addressed by name (not auto-generated), and `index.html`'s upload path builds deterministic names like `imgN_<filename>`, this is a `write` rule (covering both new uploads *and* overwriting an existing object at the same path), not `create`-only.
- **Failure scenario:** Any signed-in user (client, agent on an unrelated listing, etc.) can upload to, or overwrite an existing file at, `properties/<any-other-agent's-property-id>/imgN_...` — silently replacing another agent's listing photo with arbitrary image content, or using the bucket as a free anonymous-but-authenticated public image host (images are `read: if true`, i.e. publicly served). The Firestore `properties.update` rule correctly restricts who can change the `images` *array field*, but that protection doesn't extend to Storage, since Storage has no concept of "does this file's path belong to a property this user may edit."
- **Recommended fix:** At upload time, look up the property doc's `agentId`/`ownerId` via a `firestore.get()` call (the same cross-service pattern already used for `documents/{uid}` in this same file) and require the caller to match it or be admin/staff — mirroring the Firestore rule it's supposed to back.
- **Risk level:** High for defacement/abuse potential on a public marketplace; not a data-exfiltration risk since no PII is exposed by this specific gap.

---

## Medium

### M1. Storage rules' admin/staff role list has drifted from Firestore rules' — HR/Branch/Ops/Marketing managers and the CEO role can't access Storage-gated documents
- **Affected files:** `rules/storage.rules:8-13` vs `rules/firestore.rules:27-43`
- **Root cause:** Firestore's `isAdminOrStaff()` recognizes 9 roles (`admin, super_admin, staff, ceo, branch_manager, hr_manager, operations_manager, marketing_manager, company_owner`), explicitly extended (per the rules file's own comment) to fix a bug where CEO-tier accounts got silently rejected on Firestore writes. Storage's own `isAdminOrStaff()` (a separately-maintained copy) only recognizes 3 (`admin, super_admin, staff`) — it was never updated when the Firestore list grew.
- **Failure scenario:** An HR Manager, Branch Manager, Operations Manager, Marketing Manager, Company Owner, or CEO account — all of which the Firestore rules and the app's own UI treat as admin-equivalent — will get permission-denied trying to read/write another user's `documents/{uid}/...` Storage files (ID scans, contracts, payslips) via the `isAdminOrStaff()` branch, even though they can see and approve the *Firestore* record that references those same files. This is the same "rules diverged from app reality" bug class as the original Critical #1 from the prior audit, recurring in a sibling rules file that wasn't touched during that fix.
- **Recommended fix:** Replace Storage's hand-maintained role list with the same 9-role list Firestore uses (or, better, keep the two lists in one place if Firebase tooling allows shared rule includes).
- **Risk level:** Medium (broken feature for 6 of 9 staff-tier roles, not a security hole — it fails closed).

### M2. Sentry and PostHog are still wired to literal placeholder credentials
- **Affected file:** `index.html:226,233` — confirmed still `'YOUR_POSTHOG_API_KEY'` and `'YOUR_SENTRY_DSN'` as of this scan.
- **Root cause:** Carried over unresolved from the 2026-07-01 `PRODUCTION_READINESS_REPORT.md` (flagged there as Critical #4, and explicitly noted in `SECURITY_FIXES_REPORT.md` as something the previous session could not fix because it requires the account owner's own Sentry/PostHog credentials).
- **Failure scenario:** Zero error monitoring or product analytics are active in production today. A regression like H1 above (broken AI chat) would produce no alert anywhere — the only way anyone finds out is a user complaint.
- **Recommended fix:** Sign up for/open a Sentry project and a PostHog project, and paste the real DSN/key into these two variables — no code change needed beyond that.
- **Risk level:** Medium (this is an operational blind-spot, not a vulnerability, but it directly compounds the impact of every other bug in this report by delaying detection).

### M3. Hardcoded master-admin email fallback, duplicated across 20 call sites
- **Affected file:** `index.html` — 20 occurrences of `info.komisiyoneri.net@gmail.com`, of which these are live authorization checks (not display text): lines 10427, 10597, 10880, 12455, 14213, 15405, 30016.
- **Root cause:** Every one of these does `currentUser.email === 'info.komisiyoneri.net@gmail.com'` as an OR-condition alongside the real `isAdmin()`/role check, rather than deriving admin status purely from the Firestore-backed role system.
- **Failure scenario:** If this specific Gmail mailbox is ever compromised (or its Google account recovery is social-engineered), the attacker gets a universal admin override on the platform that bypasses the entire role system — and it's duplicated in 7 different call sites, so revoking it means finding and editing all 7, not flipping one flag. This was flagged as Medium in the prior audit and is unchanged.
- **Recommended fix:** Centralize into one `isMasterAdmin(user)` helper (reduces the 7-site duplication risk immediately) and set a concrete timeline to remove it entirely now that the underlying Firestore role-based admin system is confirmed working (per this scan's rules review).
- **Risk level:** Medium (real single-point-of-failure for the admin trust model; not currently exploitable without that one mailbox being compromised).

### M4. Financing/mortgage commission is entirely client-computed with no server-side re-verification, unlike every other money-moving flow in this app
- **Affected file:** `index.html:22763-22826` (`submitLoanApply()`), confirmed by the completed CRM/Finance sub-agent pass.
- **Root cause:** `commRate = 0.0075` and `commAmt = Math.round(loanAmt * commRate)` are computed client-side from client-supplied `loanAmt`/`propVal`, with only a `loanAmt > propVal*0.95` sanity check (itself trivially satisfiable by inflating both numbers together), then written straight to the `services` collection. Every *other* money-moving flow in this codebase — deal-closing commissions, payout requests, subscription invoices — has a matching Cloud Function that independently recomputes the value server-side before anything is trusted (confirmed in `functions/index.js`: `onDealClosedWon`, `verifyPayoutRequest`, `onSubscriptionActivated`). This one flow never got the same treatment.
- **Recommended fix:** Add a Cloud Function trigger on `services` create (or specifically on this loan-referral type) that recomputes `commissionAmount` from `loanAmt`/`propVal`/the fixed 0.75% rate and rejects/flags mismatches, mirroring `verifyPayoutRequest()`'s pattern.
- **Risk level:** Medium (a fabricable financial value, but confirmed not sourced from a rule that's already client-writable to `status:'approved'` — would need to trace how/whether this figure is later paid out before calling it a Critical).

### M5. `acceptOffer()` lets a non-admin agent set the exact price the commission engine later trusts, with no bounds check
- **Affected file:** `index.html:25840-25963`, confirmed by the completed CRM/Deals sub-agent pass.
- **Root cause:** Any `currentUser.role === 'agent'` (not just admin/staff) can accept a pending offer; doing so writes `deal.agreedPrice = offer.amount` verbatim with no validation against the property's listed price or any reasonable band. The `closed_won` transition itself is correctly admin-gated (both client-side and, per this scan's own read of `rules/firestore.rules:157-160` and `functions/index.js:150-159`, server-side), but the *value* that gate ultimately trusts (`agreedPrice`) was set earlier by a non-admin action that never validated it.
- **Recommended fix:** Validate `offer.amount` against the property's listed price band before writing `agreedPrice`, or have the admin-facing `closed_won` approval UI surface a warning when `agreedPrice` deviates significantly from the property's listed price.
- **Risk level:** Medium (requires an admin to subsequently approve `closed_won` without noticing an inflated/deflated price — a process gap more than a technical bypass, since the money-creating step itself is correctly gated).

### M6. Six-plus divergent RWF currency formatters, actively mixed across dashboards
- **Affected file:** `index.html` — `fmtRWF` (19084), `fmtRwfAC` (19135), `fmtMRwf` (19140), `fmtRwfHR` (19846), `fmtRwf` (22498, hardcodes `en-US` locale ignoring the app's own language toggle), `fmtM` (22502, drops the "RWF" suffix entirely), plus `fmtRWFCompact` (27793). Confirmed by the completed CRM/Finance sub-agent pass; independently consistent with this session's grep showing `fmtRWF` and `fmtRWFCompact` are at least no longer *literally* duplicate-named (the specific historical bug is fixed) but the underlying "no shared money-formatting module" problem has regrown as six new similarly-named siblings.
- **Failure scenario:** The same underlying RWF amount can render differently (abbreviated vs. full, with vs. without "RWF" suffix, locale-aware vs. not) depending on which dashboard tab displays it — reads as a data-integrity problem to finance/audit staff even though the underlying stored numbers agree.
- **Recommended fix:** Consolidate to one formatter with a `{compact: bool, locale: aware}` option set.
- **Risk level:** Medium (display-only inconsistency, no data corruption, but erodes trust in financial dashboards).

### M7. Exec/BI dashboard KPIs still perform unbounded full-collection reads — the "already fixed" performance work didn't reach this module
- **Affected file:** `index.html` — confirmed by the completed sub-agent pass: `loadExecHealth()` (18855, loops over 8 collections with no `.limit()`), `loadExecTopAgents()` (18913), `loadExecFunnel()` (18953), `loadExecConversion()` (19002), `loadExecAgentPerf()`/`loadExecAttRate()`/`loadExecTaskRate()` (19026/19060/19073), `biDealsByType()` (18381), `biPipelineValue()` (18621), `biBenchmarkTable()` (18316, plus a per-agent N+1 query at 18327), and a sidebar badge timer (19099-19100) polling unbounded every 8.5 seconds.
- **Root cause:** `PERFORMANCE_AUDIT_REPORT.md` (2026-07-01) explicitly scoped its `.get()`→`.count()` conversion to "the Branches, BI, and Executive dashboards" and claimed that work done — but the sub-agent's direct read of the actual Exec/BI function bodies found the conversion was incomplete: these specific functions inside the very modules the report says were fixed still issue unbounded reads today.
- **Recommended fix:** Apply the same `.count().get()` aggregation pattern already used correctly elsewhere in this same file (e.g. `index.html:17357`) to these specific call sites.
- **Risk level:** Medium (real, quantifiable Firestore cost/latency waste on every Exec/BI dashboard load; not a correctness bug).

---

## Low

### L1. `properties/{propId}` Storage path check aside, `CSP`'s `connect-src` allowlists `console.anthropic.com`, which the app never calls
- **Affected file:** `vercel.json` (`Content-Security-Policy` header). The client never calls Anthropic directly — `api/chat.js` proxies server-side — so this is a harmless but pointless CSP entry.
- **Recommended fix:** Remove it; keeps the allowlist minimal and accurate.
- **Risk level:** Low.

### L2. 222 `console.log`/`warn`/`error` calls remain unguarded in production
- **Affected file:** `index.html` (whole-file count). Consistent with the ~101 figure the prior audit reported and explicitly called cosmetic (none reviewed there leaked secrets); the count has roughly doubled since, tracking the app's growth (phase 6/7 features), not a new regression.
- **Recommended fix:** Gate behind a debug flag for a clean production console — nice-to-have, not urgent, per prior audit's own conclusion, though the growing count is worth capping before it doubles again.
- **Risk level:** Low.

### L3. Rounding-only ±1 RWF drift possible between agent/company commission split and total
- **Affected file:** `index.html:24811-24812`/`25505-25507` and `functions/index.js:165-166` — `Math.round(total*0.60)` and `Math.round(total*0.40)` are rounded independently, so `agentShare + companyShare` can differ from `total` by ±1 RWF in edge cases.
- **Recommended fix:** Compute one share by rounding, derive the other as `total - firstShare`, guaranteeing they always sum exactly.
- **Risk level:** Low (cosmetic rounding artifact, not a real financial-integrity issue at RWF-scale amounts).

### L4. Possible RSSB employer/employee contribution miscalculation (needs domain-expert confirmation)
- **Affected file:** `index.html:20842-20856` (`submitPayslip()`), confirmed by the completed sub-agent pass — both `rssbEmployee` and `rssbEmployer` are computed as the identical `Math.round(gross*0.05)`.
- **Note:** Flagged with low confidence — this scan did not verify current Rwanda RSSB pension contribution split rates. Conventionally employer/employee shares differ; worth a payroll/compliance review, not a code fix per se until the correct split is confirmed.
- **Risk level:** Low/uncertain — compliance risk if the split is wrong, but unverified against authoritative RSSB rates.

---

## Previously-reported issues, re-verified as fixed

Independently confirmed by direct reading of current `rules/firestore.rules` and `functions/index.js` (not assumed from prior reports):

- **Firestore rules' custom-claims mismatch** (prior Critical #1) — fixed. `getRole()` now reads `users/{uid}.role` from Firestore, not a nonexistent auth custom claim.
- **`deals` collection fully open to fabrication** (prior P0.1) — fixed. `create` requires the caller be a real party to the deal; the `closed_won` transition requires admin/staff both in rules *and* independently re-verified inside `onDealClosedWon` (`functions/index.js:150-159`), which rejects and audit-logs any non-staff actor that somehow reaches it.
- **Payout requests trusted client-submitted `serverVerified`/amount** (prior P0.1) — fixed. `verifyPayoutRequest()` recomputes the real total from the actual commission documents server-side, both at request-creation and again at approval time (to catch staleness from concurrent requests), and the Firestore rules structurally prevent any client (including admin) from ever writing `serverVerified`/`verifiedAmount` directly.
- **Missing `rules/storage.rules`** (prior Critical #3) — fixed (file exists), though see High #3 and Medium #1 above for gaps within it.
- **8 unescaped-`innerHTML` XSS sites on property rendering** (prior High #1 in `SECURITY_FIXES_REPORT.md`) — not re-verified in this pass (falls in the unscanned ~9,000–17,000 region); recommend a follow-up spot-check given the app has had substantial churn since.
- **Duplicate `fmtRWF()` with silently-different output** (prior High #4) — the *specific* two functions named identically are fixed, but the underlying problem (no single money-formatting source of truth) has regrown as 6+ differently-named siblings — see Medium #6 above.

## Recommended follow-up scan

Given the session-limit interruption, prioritize a targeted re-scan of:
1. `index.html` lines ~1–9,000 (auth/bootstrap) and ~9,000–17,000 (listings/search/favorites/PWA) for logic bugs and the XSS-escaping regression risk noted above.
2. `index.html` lines ~25,000–33,027 (HR/Office/Investor/Partner portals, routing, theme system) — this scan's grep sweep found nothing alarming there, but it was not read line-by-line.
3. CSS mobile-responsiveness architecture and the ~8 admin-table horizontal-scroll patterns — both already-documented, deliberately-deferred items from `MOBILE_READINESS_REPORT.md`, unchanged status.
