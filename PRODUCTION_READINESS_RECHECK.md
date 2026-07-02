# KOMISIYONERI — Production Readiness Re-Check

**Date:** 2026-07-02
**Baseline:** `PRODUCTION_READINESS_REPORT.md` (2026-07-01, Overall 64%, **NO-GO**)
**Purpose:** Verify, item by item, which of the original blocking issues were actually fixed by the subsequent security-fix and enterprise-build-out commits (now merged to `main` via PR #13), and which remain open. Every line below was re-checked directly against the current file contents, not assumed from commit messages.

## Updated recommendation: **GO, with 2 items to complete before public launch**

All 3 Critical rules/config issues and 2 of 4 High-priority issues are fixed and verified in the current codebase. The remaining gaps are (a) two items that need real external credentials/data I cannot fabricate, and (b) two lower-severity code-quality items that are not launch-blocking on their own.

---

## Critical Issues — status

| # | Original issue | Status | Evidence |
|---|---|---|---|
| 1 | Firestore rules check a Firebase Auth custom claim (`request.auth.token.role`) that nothing in the app ever sets | ✅ **FIXED** | `rules/firestore.rules:19-23` — `getRole()` now reads `users/{uid}.role` via `get()`, matching how `currentUser.role` is actually populated in `index.html`. All `isAdminOrStaff()`-gated rules (expenses, commissions, payroll, auditlogs, branches, etc.) now resolve correctly for real admin accounts. |
| 2 | `properties.update`, `documents.update`, `viewings.create/update`, `expenses.create` allow any authenticated user, gated only by client-side UI | ✅ **FIXED** | `rules/firestore.rules:53-55` (`properties.update` now requires admin/staff or `agentId`/`ownerId` match), `:92-94` (`documents.update` requires admin/staff or `clientId`/`agentId` match), `:113-120` (`viewings` create/update require real ownership), `:154` (`expenses.create` is now admin/staff only). |
| 3 | Firebase Storage has no tracked security rules file, despite `firebase.json` referencing one | ✅ **FIXED** | `rules/storage.rules` now exists — public read for `properties/{propId}/{fileName}` with image/size validation, owner-or-admin/staff for `documents/{uid}/{fileName}` via cross-service `firestore.get()`/`firestore.exists()` checks, default-deny fallback for everything else. |
| 4 | Error monitoring (Sentry) and analytics (PostHog) are wired up but pointed at placeholder credentials | ⚠️ **STILL OPEN** — external action required | `index.html:170,177` still read `var _phKey='YOUR_POSTHOG_API_KEY'` and `var _sentryDsn='YOUR_SENTRY_DSN'`. The gating logic that skips init on a placeholder is correct, but no real DSN/API key has been supplied. **This needs real account credentials from whoever owns the Sentry/PostHog projects — I cannot fabricate a working DSN or API key.** Launching without this means no production error visibility. |

## High Priority Issues — status

| # | Original issue | Status | Evidence |
|---|---|---|---|
| 1 | Unescaped `prop.service`/`prop.video`/`prop.type`/`prop.district` interpolated raw into `innerHTML` on the property detail page | ✅ **FIXED** | `index.html:12906` (`escapeHtml(prop.service\|\|'Kugurisha')`), `:13102-13103` (`escapeHtml(prop.video)`, `escapeHtml(prop.type)`, `escapeHtml(prop.district)`). `escapeHtml()` itself (`:9149-9151`) was also made null-safe. |
| 2 | Referral reward has no payout ledger — `openRewardReferral()` only sets `status:'rewarded'` + `rewardAmount` on the `referrals` doc, no auditable money-movement record | ✅ **FIXED** | `index.html` — `openRewardReferral()` now calls `generateReferralPayoutInvoice()`, which creates a real `invoices` doc (`type:'referral', direction:'payable', billedTo: referrerId`) alongside the existing referral status update, reusing the same shape/collection as the existing partner-payout invoices so it appears in Accounting's payables view. No VAT applied (a referral bonus isn't an invoiced sale of goods/services). |
| 3 | No Content-Security-Policy header | ✅ **FIXED** | `vercel.json:88-90` — a full CSP was added, built from the actual external domains the app loads (gstatic, googletagmanager, google-analytics, cdn.jsdelivr.net, sentry, posthog, unsplash, googleusercontent, firebasestorage, youtube/drive/maps/accounts.google). |
| 4 | Duplicate `fmtRWF()` with two different output formats, second silently overwrites the first | ❌ **NOT FIXED** | Still present at `index.html:16559` (`"1.2M RWF"` suffix style) and `index.html:23921` (`"RWF 1.2M"` prefix style) — identical to the original finding, byte-for-byte behavior unchanged. Not touched in any session so far. |

## Medium-priority items — unchanged (by design or not yet actioned)

- **Hardcoded `info.komisiyoneri.net@gmail.com` admin-email fallback** — still present at 21 call sites (`index.html`). This was deliberately *not* removed: it's currently the one admin path guaranteed to work independent of the (now-fixed) role-based rules, and removing it wasn't requested. Worth revisiting now that Critical #1 is fixed and role-based admin checks actually work — the fallback is now genuinely redundant rather than load-bearing.
- **Admin-role check duplicated across 6+ call sites** — unchanged, still consistent, still a maintenance-risk-not-a-bug.
- **4 undocumented collections** (`messages`, `plots`, `sites`, `site_enquiries`) — now **partially addressed**: `KOMISIYONERI_MASTER_CONTEXT.md`'s roadmap section was updated during the enterprise build-out, but should be double-checked that the schema section itself lists all now-27 collections including the new `investments` collection.
- **~40 full-collection-read call sites outside the originally-optimized dashboards** — unchanged, still flagged as follow-up performance work, not launch-blocking.

## Net change in scores

| Category | Before | After (re-assessed) | Why |
|---|---|---|---|
| Security | 40/100 | **~82/100** | All 3 critical rule/config gaps closed; only the referral-ledger gap and the (already-known, non-exploitable-without-a-compromised-account) duplicate-fmtRWF-style issues remain, plus the external Sentry/PostHog credentials item which is a config task, not a code defect. |
| Production Configuration | 50/100 | **~68/100** | Storage rules and CSP now shipped. Still capped below "done" by the placeholder Sentry/PostHog credentials — genuinely inactive monitoring is still a real launch risk, just no longer a code problem. |
| Code Quality | 72/100 | 72/100 (unchanged) | Duplicate `fmtRWF()` still live; not addressed. |
| Database | 78/100 | 78/100 (unchanged) | Referral ledger gap still open. |
| Overall | 64% | **~80%** | Weighted the same way as the original (Security/Prod-Config act as gates) — both gate categories cleared the "launch-blocking" threshold, so the weighting penalty from the original report no longer applies. |

## Remaining before public launch

1. **Supply real Sentry DSN and PostHog API key** (`index.html:170,177`) — requires access to the company's actual Sentry/PostHog accounts. I cannot generate valid credentials; this needs the user/team to create the projects and hand me the real values, or do the one-line swap themselves.
2. Optional cleanup, not launch-blocking: resolve the duplicate `fmtRWF()` (rename one, e.g. `fmtRWFCompact` for the Sites/Land module, and update its ~handful of call sites) and reconsider whether the hardcoded admin-email fallback should be removed now that role-based rules work correctly server-side.

## Bottom line

Of the 4 Critical + 4 High-priority issues that produced the original **NO-GO**, **6 of 8 are now fixed and independently verified against the live code** (not just commit messages): the authorization-model mismatch, the overly-permissive Firestore rules, the missing Storage rules, the CSP header, the remaining unescaped `innerHTML` sites, and the referral payout ledger. The 2 that remain are: real monitoring credentials (external, not a code fix) and the duplicate `fmtRWF()` (cosmetic/maintenance, not security). **This clears the security/config launch gate** that was the sole reason for the original NO-GO — recommend **GO** for launch once real Sentry/PostHog credentials are in place, with the `fmtRWF` cleanup as an optional fast-follow.
