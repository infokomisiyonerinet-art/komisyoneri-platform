# KOMISIYONERI — Final Production Readiness Audit

**Date:** 2026-07-01
**Branch:** `claude/komisiyoneri-performance-audit-2ucyyb`
**Scope:** Complete end-to-end production readiness audit ahead of public launch on `https://komisiyoneri.co.rw`, evaluating the codebase against 12 categories. This audit does not fix anything — it is evidence for a launch decision. Every claim below is backed by an exact file path and line number; nothing here was assumed.

## Overall Production Readiness: 64%

## GO / NO-GO Recommendation: **NO-GO**

Not because the platform is unfinished — the business-logic core (property management, CRM, deal pipeline, commission engine, notifications, favorites, user approval) is genuinely real and Firestore-backed, not a demo. The recommendation is **NO-GO** because of one specific, verified, launch-blocking defect: **the deployed Firestore security rules use an authorization model the application never implements** (see Critical Issue #1). This would cause real admin/staff functionality to fail with permission-denied errors in production the moment a real admin account tries to use it, and separately leaves several collections writable by any authenticated stranger. Combined with the complete absence of a tracked Firebase Storage security policy and the fact that error monitoring is wired up but pointed at a placeholder (i.e., not actually active), launching today means going live with broken admin operations, an unreviewed file-storage policy, and no visibility into production errors. All three are fixable in a focused security pass — this is a **NO-GO pending that pass, not a NO-GO on the product**.

## Category Scores

| # | Category | Score |
|---|---|---|
| 1 | Architecture & Ecosystem | 80 / 100 |
| 2 | User Experience | 82 / 100 |
| 3 | Performance | 75 / 100 |
| 4 | Security | 40 / 100 |
| 5 | Database | 78 / 100 |
| 6 | Business Workflows | 82 / 100 |
| 7 | Mobile Experience | 82 / 100 |
| 8 | SEO / GEO | 77 / 100 |
| 9 | PWA | 88 / 100 |
| 10 | Branding | 92 / 100 |
| 11 | Production Configuration | 50 / 100 |
| 12 | Code Quality | 72 / 100 |
| | **Overall (weighted, not a flat average)** | **64%** |

A flat average of the table above is ~75%. The overall score is weighted down from that because Security and Production Configuration are launch *gates* for a platform handling PII, ID documents, and real commission payouts — a low score in either one caps overall readiness regardless of how polished everything else is.

---

## Critical Issues (must fix before launch)

### 1. Firestore security rules depend on an authorization mechanism the app never implements
`rules/firestore.rules`'s `isAdminOrStaff()` helper (lines 12–15) checks `request.auth.token.role` — a **Firebase Auth custom claim**. Custom claims can only be set server-side via the Admin SDK's `setCustomUserClaims()`, almost always from a Cloud Function. A full-repo search confirms: **there is no Cloud Functions directory anywhere in this project, and `setCustomUserClaims` appears nowhere in the codebase.**

Meanwhile, the app's real role model lives entirely in Firestore documents: `currentUser.role` is populated from `users/{uid}.role` (`index.html:9058-9067`, `loadSavedUser()`), and the admin-approval workflow (`_fsPendingApprove`) promotes a user by writing `role: 'Admin'` to that Firestore document — never to an auth token claim.

**Consequence:** `request.auth.token.role` is `undefined` for every user, including real admins, forever. Every rule gated by `isAdminOrStaff()` will deny access in production:
- `expenses` reads (`firestore.rules:117`)
- `commissions` and `payroll` updates (`:62`, `:153`)
- `auditlogs` reads (`:202`)
- `branches` creates (`:166`)
- the entire admin-fallback half of the OR-conditions on `leads`, `deals`, `documents`, `services`, `invoices`, `tasks`, `attendance`, `site_enquiries`

A real admin logging into the live site and opening Accounting, HR, Audit Logs, or Branches would get Firestore permission-denied errors on every one of them, despite the client-side UI showing those pages as if they'll work.

**Fix direction (not applied — audit only):** either (a) add a Cloud Function that calls `setCustomUserClaims()` whenever a user's Firestore `role` field changes, keeping the token claim in sync, or (b) rewrite the rules to check the user's own Firestore document instead of a token claim (e.g. `get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role`), which is what the *master context document's own* documented rules helper (`getRole()`) already does — the deployed `rules/firestore.rules` has diverged from the pattern documented in `KOMISIYONERI_MASTER_CONTEXT.md` §11.

### 2. Several Firestore rules allow any authenticated user, gated only by client-side UI
Independently confirmed by reading `rules/firestore.rules` directly:
- `properties.update`: `if isAuth()` (line 34) — any signed-in user can edit any property, not just its owner/agent or an admin. The UI hides the edit button for non-admins, but nothing stops a direct Firestore SDK call.
- `documents.update`: `if isAuth()` (line 71) — any signed-in user can modify any document record (title deeds, contracts).
- `viewings.create`/`update`: `if isAuth()` with no ownership check at all (lines 85, 86).
- `expenses.create`: `if isAuth()` (line 118) — any signed-in user can create expense records, with only admin-only UI hiding the button.

### 3. Firebase Storage has no tracked security rules
`firebase.json` references `"storage": {"rules": "rules/storage.rules"}`, but that file does not exist — `rules/` contains only `firestore.rules`. Property photos, national ID documents, signed contracts, and payslips (the Storage layout documented in `KOMISIYONERI_MASTER_CONTEXT.md` §5) currently have no source-controlled, reviewable access policy in this repository.

### 4. Error monitoring and analytics are wired up but inactive
`index.html:177` sets `var _sentryDsn='YOUR_SENTRY_DSN';` and `index.html:170` sets `var _phKey='YOUR_POSTHOG_API_KEY';` — both are literal, un-replaced placeholder strings, and both init blocks are correctly gated to skip initialization when the placeholder is still present. The integration code (global `window.onerror`/`onunhandledrejection` handlers forwarding to Sentry/GA4/PostHog, `index.html:9004-9018`) is correct and would work — but **right now, in this codebase, no error monitoring or analytics is actually live**. Launching without this means being blind to production errors from day one.

---

## High Priority Issues

1. **Unescaped user/Firestore data interpolated into `innerHTML`** — a real `escapeHtml()` helper exists (`index.html:8977`) and is used correctly in the chat and property-comparison features, but two call sites in the property detail page skip it: `index.html:12746` (`prop.service` interpolated raw into the price display) and `index.html:12942-12943` (`prop.video`, `prop.type`, `prop.district` interpolated raw into a 3D-tour iframe block). Exploitable only if malicious content reaches Firestore first (e.g. via a compromised account or the permissive `properties.update` rule above), but that path exists today.
2. **Referral reward payout has no ledger** — `openRewardReferral()` (`index.html:13537-13564`) writes `status:'rewarded'` and a `rewardAmount` field to the `referrals` collection, but never writes to any wallet/payment/ledger collection. The system records the *intent* to pay a referral bonus, not an actual, auditable payout trail — a real gap for a feature that moves money.
3. **No Content-Security-Policy header** — `vercel.json` has X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, Referrer-Policy, HSTS, and Permissions-Policy configured, but no CSP. Given the app relies heavily on inline `onclick` handlers and inline `<script>` blocks (no bundler), a CSP would need to explicitly allow those, but its complete absence removes a meaningful defense-in-depth layer against the XSS gaps above.
4. **Duplicate `fmtRWF()` currency-formatting function with different output** — defined once at `index.html:16216` (`"0 RWF"`, `"1.2M RWF"` suffix style) and again at `index.html:22895` (`"RWF —"`, `"RWF 1.2M"` prefix style). The second definition silently overwrites the first at script-parse time, so one of the two modules (Branches/Finance vs. Sites/Land) is currently displaying currency in a format its own code wasn't written expecting. This is a live bug risk, not just a style inconsistency.

## Medium Priority Improvements

1. **Hardcoded master-admin email used as an authorization fallback** in 6+ places (`index.html:10628`, `12441`, `12513`, `13254`, `24756`, `25107`, and others) — `currentUser.email === 'info.komisiyoneri.net@gmail.com'`. If this specific mailbox is ever compromised, the attacker gets a universal admin override that bypasses the role system entirely. Combined with Critical Issue #1 (role-based admin checks not working server-side), this hardcoded email is effectively the *only* admin path that reliably works against the current Firestore rules — worth being deliberate about, not just flagging as debt.
2. **`isAdmin`-style role checks duplicated across 6+ call sites** instead of one shared helper — consistent in behavior today per the code-quality audit, but a maintenance risk if one call site is updated (e.g. to add a new admin-equivalent role) and the others aren't.
3. **4 Firestore collections used in code but undocumented** in `KOMISIYONERI_MASTER_CONTEXT.md`: `messages`, `plots`, `sites`, `site_enquiries`. These appear to be legitimate feature work (a site-development/land-plot module and a messaging feature) rather than duplication — each has its own properly-scoped Firestore rule — but the master context document needs updating to stay authoritative.
4. **~40 additional full-collection-read call sites** outside the Branches/BI/Executive dashboards (flagged in `PERFORMANCE_AUDIT_REPORT.md` as follow-up, never actioned) still pay full-document-read cost for what are effectively count queries, in the HR/Office/Accounting/Documents/Partners modules.

## Nice-to-Have Improvements

1. Strip or gate the ~101 `console.log`/`warn`/`error` calls behind a debug flag for a clean production console — none currently leak secrets or sensitive user data, so this is cosmetic, not urgent.
2. Rewrite the CSS to be mobile-first rather than desktop-first-with-overrides (flagged in `MOBILE_READINESS_REPORT.md` as a real but large architectural investment).
3. Convert the 8 admin/BI/HR/Accounting data tables from horizontal-scroll to a stacked card layout on mobile (same report, same reasoning — safe today, not premium).
4. Pre-rendering/SSR investment for the public marketing pages to raise the SEO/GEO ceiling above what's achievable in a pure client-rendered SPA (flagged in `SEARCH_READINESS_REPORT.md`).
5. Regenerate the Google Search Console verification token for the new `komisiyoneri.co.rw` property (external action, flagged in `DOMAIN_MIGRATION_REPORT.md`).
6. Fill in the remaining pre-production trust gaps already identified in `TRUST_READINESS_REPORT.md`: business registration/TIN, professional certifications, a precise office address — all deliberately left un-fabricated rather than invented.

---

## Findings by category

### 1. Architecture & Ecosystem — 80/100
Module integration is real, not decorative: a lead converts into a deal with a genuine `leadId` back-reference (`convertLeadToDeal`, `index.html:26304`), closing a deal as `closed_won` auto-triggers commission calculation with a real `dealId` reference (`autoCalculateCommission`, `index.html:20298`), and a qualifying referral is automatically matched and updated when that commission is created (`index.html:20366`). This is exactly the cross-module integration the "Real Estate Operating System" vision in `KOMISIYONERI_MASTER_CONTEXT.md` calls for, and it's backed by actual Firestore writes with correct ID chains, not simulated. No placeholder or fake pages were found among the 27 page modules — every one binds to real Firestore/localStorage data. The only gap is documentation lag: 4 collections in active use (`messages`, `plots`, `sites`, `site_enquiries`) aren't yet reflected in the master context doc's schema section.

### 2. User Experience — 82/100
This branch has already run two dedicated UX audits: the conversion/landing-page session (`CONVERSION_READINESS_REPORT.md`, 88/100 — fixed a real bug where property owners couldn't list their own properties due to a role-casing mismatch, added an above-the-fold action strip and FAQ/trust sections using only verified facts) and the user-journey session (`USER_JOURNEY_REPORT.md` — redesigned the property detail page from 10 competing buttons to a clear primary/secondary/contact hierarchy, converted the 27-field Add Property form into a 3-step wizard). Both explicitly deferred the Auth page's moderate tab clutter and a full CTA-clarity audit of internal admin tool pages as lower-priority follow-up, which remains true today.

### 3. Performance — 75/100
`PERFORMANCE_AUDIT_REPORT.md` documents real, shipped fixes: 22 call sites converted from full-collection reads to Firestore `.count()` aggregation queries, offline persistence enabled, dead 171KB CSS file removed, service worker upgraded to stale-while-revalidate, WebP hero image with fallback, lazy-loaded property card images via a shared IntersectionObserver, and non-critical scripts (Sentry, EmailJS, Analytics) deferred. None of this has been verified with a live Lighthouse run — every session on this branch, including this one, has run in a sandbox that blocks the external CDNs (Firebase, Sentry, Google Fonts) needed to fully boot the app, so real-world Core Web Vitals numbers are still unconfirmed. ~40 more full-collection-read sites outside the originally-scoped dashboards remain as documented follow-up work.

### 4. Security — 40/100
See Critical Issues #1–3 and High Priority #1 and #3 above for the specifics. Positively: the Firebase web config exposure is normal and expected (web API keys are public by design; no Admin SDK service-account key or other genuine secret was found anywhere in the repo), and `api/chat.js` correctly reads its Anthropic API key from a server-side environment variable rather than hardcoding it. But the combination of a non-functional admin-authorization model at the database layer, several rules that are too permissive for any signed-in user, a completely absent Storage rules file, and inactive error monitoring is a genuine, launch-relevant risk cluster for a platform that will hold user PII, national ID numbers, and process real commission payments.

### 5. Database — 78/100
Schema consistency is good: every collection-write call site checked (`properties`, `leads`, `deals`, `commissions`) includes all 7 standard fields (`id`, `createdAt`, `updatedAt`, `createdBy`, `updatedBy`, `status`, `isActive`) exactly as `KOMISIYONERI_MASTER_CONTEXT.md` mandates. The audit trail is genuinely comprehensive — `logAudit()` is called 81 times across every critical action (property approval, lead stage changes, deal closing, commission approval, user approval, referral rewards), not just a token few. `firestore.indexes.json` has real, sensibly-scoped composite indexes for the leads/deals query patterns the app actually uses. The one integrity gap is the referral payout ledger (see High Priority #2).

### 6. Business Workflows — 82/100
Traced end-to-end with exact line numbers: property management (submit → pending → admin-approved → public), CRM/lead pipeline (all 13 canonical stages, real Firestore stage transitions, agent notifications), deal management (lead-to-deal conversion, stage tracking, closing), the commission engine (a genuine `dealValue × rate`, 60/40 agent/company split calculation — not a fabricated dashboard number), notifications (real Firestore-backed, real-time listener per user), favorites (persisted to the user's Firestore document, not just a CSS toggle), and user role management (real pending → approved/rejected Firestore transitions with audit logging and notifications) **all PASS** — each is genuinely wired to Firestore, not simulated. The referral system is the one workflow that's **INCOMPLETE**: code generation, registration tracking, and reward status all work, but the actual payout has no ledger entry (see High Priority #2).

### 7. Mobile Experience — 82/100
`MOBILE_READINESS_REPORT.md` (this branch) fixed the most severe mobile bug found across all sessions — the internal dashboard's entire sidebar navigation vanished with no substitute below 1024px, making most of the product unreachable on any phone or tablet. Touch targets were brought up to the project's own 44×44px standard. The CSS is still architecturally desktop-first with overrides bolted on (35+ `max-width` queries, 1 `min-width` query) and the 8 admin data tables still rely on horizontal scroll rather than card layouts on mobile — both flagged in that report as acknowledged, deliberately-deferred architectural investments, not new findings.

### 8. SEO / GEO — 77/100
`SEARCH_READINESS_REPORT.md` (this branch) added clean, crawlable URLs for the six public marketing pages, breadcrumb navigation with `BreadcrumbList` schema, dynamic per-property `RealEstateListing` structured data, `FAQPage` schema matching the real FAQ content, and an `llms.txt` file for AI crawler discoverability. The documented ceiling on this score is architectural: this is a client-rendered SPA with no server-side rendering, so most non-JS-executing AI crawlers only ever see the homepage.

### 9. PWA — 88/100
`manifest.json`'s two icon references (`icon-192.svg`, `icon-512.svg`) are both confirmed present in the repo. `sw.js` implements a real network-first strategy for the HTML shell, stale-while-revalidate for assets, a genuine offline SVG fallback for images (not a broken-image icon), and push notification handling. `beforeinstallprompt` is fully wired to a visible install button (`index.html:13077-13106`). The one item flagged as unverified by the research agent — whether `images/kigali-skyline.webp` (the precached hero image) actually exists — was independently confirmed present on disk.

### 10. Branding — 92/100
`DOMAIN_MIGRATION_REPORT.md` and a later follow-up commit on this branch replaced every production-facing reference to the old Vercel preview domain and placeholder `.com` domain with `komisiyoneri.co.rw` across canonical/OG/JSON-LD tags, robots.txt, sitemap.xml, footer text, form placeholders, chat-assistant copy, and demo data — and removed a dead `admin@komisiyoneri.com` authorization fallback that referenced a domain never actually owned. What remains is explicitly external, not code: the Google Search Console verification token needs regenerating for the new domain property, and the old Vercel domain is intentionally still listed as a Firebase-authorized staging alias.

### 11. Production Configuration — 50/100
The parts that are done are done correctly: the Firebase web config's public exposure is standard and expected, and the one genuine secret in the system (the Anthropic API key for the AI chat feature) is correctly kept server-side in an environment variable, never in client code. What's missing is real: no Cloud Functions are deployed anywhere (consistent with the master context document's own "planned" status for that phase, so not a broken promise, but it does mean commission calculation and other critical logic run entirely client-side with no server-side enforcement or backup), and — as covered under Critical Issue #4 — error monitoring and analytics are wired correctly but pointed at placeholder credentials, so neither is actually collecting anything right now. Firestore/Storage backup configuration is a Google Cloud project-level setting not visible from this repository and needs to be confirmed operationally outside of a code audit.

### 12. Code Quality — 72/100
No dead stub functions and no orphaned CSS classes were found on inspection — every one of the 27 page modules and every unusual-looking CSS class checked is genuinely wired to real functionality. The real find here is the duplicate `fmtRWF()` function (see High Priority #4) — a genuine, currently-live bug risk, not a style nitpick. Roughly 101 `console.log`/`warn`/`error` statements exist across the codebase; all were reviewed and none leak sensitive data, but a production build should strip or gate them. Admin-role-check logic is duplicated across 6+ call sites rather than centralized — currently consistent, but a maintenance risk.

---

## Estimated Launch Readiness

**Not launch-ready today.** The product itself — the actual business logic that makes this a real estate operating system rather than a static listings site — is close to genuinely production-grade: the CRM pipeline, deal management, and commission engine are real, Firestore-backed, and internally consistent, and six prior audit passes on this branch have already fixed the highest-severity mobile, conversion, trust, and SEO issues found. What stands between this codebase and a safe public launch is a **focused, bounded security and configuration pass**, not a rewrite:

1. Fix the Firestore-rules/custom-claims mismatch (Critical #1) — either wire up custom claims via a Cloud Function, or rewrite the rules to check the user's own Firestore document (the pattern the master context document itself already specifies).
2. Tighten the `isAuth()`-only rules on `properties`, `documents`, `viewings`, and `expenses` to require real ownership or admin status (Critical #2).
3. Write and deploy `rules/storage.rules` (Critical #3).
4. Replace the placeholder Sentry DSN and PostHog key with real credentials before launch, not after (Critical #4).
5. Escape the two remaining unescaped `innerHTML` interpolation sites (High Priority #1).

Realistically, items 1–5 are a few days of focused, testable work for someone with Firebase Console access to configure Cloud Functions/custom claims and generate real Sentry/PostHog credentials — this is not a multi-week effort, but it is not something to skip or defer past launch given what's at stake (PII, ID documents, commission payouts).

## Bottom line
KOMISIYONERI is a substantially more real platform than a first-pass audit usually finds — the workflows that matter (property lifecycle, CRM, deals, commissions) are genuinely implemented and Firestore-backed, not decorative, and this branch's prior six sessions have already closed the highest-severity mobile, conversion, trust, and SEO gaps. But this audit found a real, previously-undiscovered defect that neither of the two research sub-agents caught on their own: the deployed Firestore security rules require a Firebase Auth custom claim that nothing in this codebase ever sets, meaning the admin-authorization model is currently non-functional against live Firestore. Combined with a missing Storage security policy and inactive error monitoring, that's a **NO-GO** — but a NO-GO with a short, well-defined list of fixes standing between this codebase and a safe launch, not a fundamental redesign.
