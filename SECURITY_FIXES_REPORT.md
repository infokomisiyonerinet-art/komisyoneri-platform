# KOMISIYONERI — Critical Security Fixes Applied

**Date:** 2026-07-01
**Branch:** `claude/komisiyoneri-performance-audit-2ucyyb`
**Scope:** Fixes the Critical and High-priority security findings from `PRODUCTION_READINESS_REPORT.md`, plus the Google Sign-In flow (replaced with a `signInWithPopup`-based implementation per your direction).

## Critical issues fixed

### 1. Firestore rules' authorization model didn't match the app (the launch-blocker)
`rules/firestore.rules`'s `isAdminOrStaff()`/`isRole()` helpers checked `request.auth.token.role` — a Firebase Auth custom claim nothing in this codebase ever sets (no Cloud Functions, no `setCustomUserClaims()` anywhere). The app's real role model lives in `users/{uid}.role` Firestore documents.

**Fixed:** rewrote the helpers to read the caller's own `users/{uid}` document instead:
```
function getRole() {
  return isAuth() && exists(/databases/$(database)/documents/users/$(request.auth.uid))
    ? callerDoc().data.role
    : null;
}
```
`isRole()`/`isAdminOrStaff()` now compare against this (case-insensitively via `.lower()`, since the app itself uses inconsistent casing like `'Admin'`/`'admin'`). This matches the pattern `KOMISIYONERI_MASTER_CONTEXT.md` §11 already documents (`getRole()` reading the Firestore user doc) — the deployed rules had simply drifted from it. Also fixed the same custom-claims bug in the `sites`/`plots` collections' `create` rules, which checked `request.auth.token.role in [...]` directly.

**What this fixes:** admin/staff-gated operations (expenses, commissions/payroll updates, audit log reads, branch creation, and the admin-fallback on leads/deals/documents/services/invoices/tasks/attendance/site_enquiries) will now actually work for a real admin account in production, instead of failing with permission-denied.

### 2. Overly-permissive rules tightened
- `properties.update`: was `if isAuth()` (any signed-in user) → now requires admin/staff, or the property's own `agentId`/`ownerId`.
- `documents.update`: was `if isAuth()` → now requires admin/staff, or the document's own `clientId`/`agentId` (matching the existing read rule's ownership pattern).
- `viewings`: read/create/update were all `if isAuth()` with zero ownership check → now all three require admin/staff or the viewing's own `clientId`/`agentId`.
- `expenses.create`: was `if isAuth()` → now `isAdminOrStaff()`, matching the UI's own admin-only button and the collection's existing read/update rules.
- `offers.update`: was `if isAdminOrStaff() || isAuth()` (the `|| isAuth()` made the first clause meaningless — literally any signed-in user could update any offer) → now requires admin/staff or one of the offer's two real parties (`fromUserId`/`toUserId`). Also tightened the matching `read` rule, which previously only checked `fromUserId` and had no path for the *other* party in the negotiation to read it — now both parties can read.

### 3. Firebase Storage had no tracked security rules
`firebase.json` referenced `rules/storage.rules`, which didn't exist. Added it, matching the **real** upload paths found in `index.html` (not the aspirational `/images/...` structure in the master context doc, which the actual upload code doesn't use):
- `properties/{propId}/{fileName}` (property photos, from `storage.ref('properties/'+propId+'/imgN_...')`) — publicly readable to match the public marketplace, any authenticated user may upload (mirrors the Firestore `properties.create` rule).
- `documents/{uid}/{fileName}` (personal documents — ID scans, contracts, from `storage.ref('documents/'+uid+'/...')`) — only that user or an admin/staff account may read or write it, verified via a cross-service `firestore.get()` call to the user's role.
- Everything else denied by default.

### 4. Error monitoring / analytics — could not fully fix, flagged for you
`index.html` still has `_sentryDsn='YOUR_SENTRY_DSN'` and `_phKey='YOUR_POSTHOG_API_KEY'` — both literal placeholders. **I can't generate real Sentry/PostHog credentials for you** — that requires your own account access. The integration code is already correct (both are properly gated to skip initialization on placeholder values, and the global `window.onerror`/`onunhandledrejection` handlers already forward to Sentry/GA4/PostHog). To activate: sign up for/open your Sentry and PostHog projects and paste the real DSN/key into those two variables — no other code change is needed.

## High priority issues fixed

### 5. Unescaped Firestore data interpolated into `innerHTML` (XSS)
The report flagged 2 sites on the property detail page; verifying the codebase further (rather than trusting that scope was complete) found **6 more** of the same bug across other property-rendering surfaces — all fixed the same way, using the existing `escapeHtml()` helper:
- Property detail page: price display (`prop.service`) and 3D-tour tab (`prop.video`, `prop.type`, `prop.district`).
- `renderUserPropCard()` — used on nearly every listing surface (home, listings grid, favorites, search results) — `district`/`sector`/`type` were unescaped in the visible title/location; also added a defensive split so the *raw* (unescaped) property name still flows into the WhatsApp deep-link text, since HTML-escaping it would show literal `&amp;` etc. to the person reading the WhatsApp message.
- The quick-search suggestions dropdown (`renderQsSuggestions`) — title/location/type unescaped, plus `src`/`alt` on its thumbnail `<img>`.
- The admin property list's thumbnail `<img>` — `src`/`alt` unescaped (both are real attribute-breakout risks, not just element-content ones).
- The "similar properties" recommendation widget — title/type/district unescaped.

Also made `escapeHtml()` itself defensive (`String(str == null ? '' : str)...`) so it no longer throws on `null`/`undefined` input — several of the newly-escaped fields aren't guaranteed to be set on every property.

**Verified in Chromium:** constructed property objects with `<img src=x onerror=...>`/`<script>`/attribute-breakout payloads in every affected field and confirmed via `openPropDetail()` and `renderUserPropCard()` that none of the injected code executes; the payloads render as inert, correctly-escaped text instead.

### 6. Missing Content-Security-Policy header
Added to `vercel.json`, built from the actual external domains this app loads resources from (checked via grep, not guessed): Firebase/Google APIs, Google Fonts, Sentry, PostHog, GA4, Unsplash (demo images), YouTube/Google Drive/Google Maps (embeds). `script-src`/`style-src` include `'unsafe-inline'` — this is a pragmatic, not a strict, CSP: the app has no build step and relies on inline `<script>` blocks and `onclick=` handlers throughout, so a nonce/hash-based strict CSP would require a much larger refactor that's out of scope for a security-hardening pass and conflicts with the project's "vanilla JS, no bundler" rule. Even with `'unsafe-inline'`, this CSP provides real value: it blocks loading scripts, connecting to, or framing content from any origin not on the allowlist, closing off a class of exfiltration/injection attack the app previously had zero defense against.

## Google Sign-In — replaced per your instruction

The existing implementation used Google Identity Services (`google.accounts.id`) with a separately-hardcoded Google Cloud OAuth Client ID, decoding the raw ID-token JWT payload client-side (`atob(...)`) before ever verifying it with Firebase. Replaced with Firebase's own `GoogleAuthProvider` + `signInWithPopup`, matching the pattern you provided:
- `initGoogleSignIn()` now renders a plain, always-visible button wired to a click handler — no dependency on the separate Google Identity Services script (removed the `<script src="https://accounts.google.com/gsi/client">` tag) or a second OAuth Client ID that had to be kept in sync with the Firebase project's own configuration.
- `handleGoogleSignInClick()` calls `firebaseAuth.signInWithPopup(new firebase.auth.GoogleAuthProvider())` and reads the already-Firebase-verified user object directly (`displayName`, `email`, `photoURL`, `uid`) — no manual JWT decoding.
- `finishGoogleLogin()` (previously nested inside the old JWT-handling function) is now a standalone function, unchanged in behavior — it still does the same `km_users` localStorage sync, Firestore user-doc upsert/role-sync, tracking, toast, and redirect exactly as before.
- Verified in Chromium: the auth page renders the button correctly wired to the new handler; the old `googleSignInFallback()`/`handleGoogleResponse()` functions are confirmed gone (not just dead code left behind).

## What's still open (not fixed in this pass — flagged, not silently skipped)

- **Real Sentry/PostHog credentials** — needs your account access, see Critical #4 above.
- **Hardcoded master-admin email fallback** (`info.komisiyoneri.net@gmail.com`, duplicated across 6+ call sites) — Medium priority in the original report, not a security *vulnerability* by itself now that the underlying Firestore rules are fixed (it's redundant with real role-based admin access, not a bypass of it), but still worth centralizing into one helper function as a maintenance item.
- **Referral payout ledger gap** and **duplicate `fmtRWF()` function** — data-integrity/code-quality items from the original report, not security issues; untouched in this security-focused pass.
- **Firestore/Storage rules could not be deployed or tested against the Firebase emulator** — this sandbox has no Firebase CLI and no network access to install it. The rules were verified by careful manual review (balanced braces/parens, syntax matching the existing, already-correct collections in the same file) rather than a live emulator run. **Recommend running `firebase emulators:start` or a `firebase deploy --only firestore:rules,storage --dry-run`-equivalent check before deploying these to production**, and testing the specific scenarios this fix targets (an admin account reading `expenses`/`auditlogs`, a non-owner attempting to edit someone else's property) against the emulator.

## Verification performed
- `node --check` on all 25 inline `<script>` blocks in `index.html` — 0 errors.
- `vercel.json` re-validated as well-formed JSON after the CSP addition.
- Both rules files manually reviewed for balanced braces/parentheses and syntax consistent with the file's own unmodified collections.
- Chromium/Playwright: confirmed the new Google Sign-In button renders and is wired to the new handler, the old functions are gone, `escapeHtml()` is now null-safe, and constructed XSS payloads across every fixed call site render as inert escaped text with no script execution.
- `scripts/seo-health-check.js` still passes (unaffected by this pass, run as a general regression check).

## Bottom line
The specific defect that drove the prior audit's NO-GO recommendation — Firestore rules requiring a Firebase Auth custom claim the app never sets — is fixed, along with the four other overly-permissive rules, the missing Storage rules file, and 8 confirmed XSS sites (2 originally flagged, 6 more found during this pass's own verification). The one item genuinely outside my ability to fix is real Sentry/PostHog credentials, which need your account access — everything else from the report's Critical and High sections is addressed. Recommend a Firebase emulator test pass on the rules changes before deploying to production, since this sandbox has no way to run one directly.
