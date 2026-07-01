# KOMISIYONERI Production Domain Migration — Report

**Date:** 2026-07-01
**Branch:** `claude/komisiyoneri-performance-audit-2ucyyb`
**Scope:** Project-wide branding migration to the official production domain `https://komisiyoneri.co.rw`, building on the prior performance/mobile/conversion/user-journey/trust sessions on this branch.

## Summary

The repo owner had already updated `KOMISIYONERI_MASTER_CONTEXT.md` (commits on `main`) with the new domain, but the live codebase still pointed at the old Vercel preview URL (`komisyoneri-platform-nu.vercel.app`) for every SEO-critical tag, and at a placeholder `.com` domain (`www.komisiyoneri.com`) for user-facing branding text. This pass replaced every production-facing reference with `https://komisiyoneri.co.rw` (no `www.`, matching your instruction), while deliberately leaving alone anything that is either a live authentication check, a legitimate dev/staging config, or an external system that requires its own manual re-verification step.

## Files updated

### `index.html`
- **SEO/metadata head block**: header comment, `<link rel="canonical">`, all 3 hreflang alternates, Open Graph (`og:url`, `og:image`), Twitter Card (`twitter:image`), and all 9 JSON-LD `@graph` URL fields (`@id`, `url`, `urlTemplate`, `logo.url` across WebSite/Organization/RealEstateAgent) — all now point to `https://komisiyoneri.co.rw`.
- Removed the stale `<!-- TODO: Update to www.komisiyoneri.com once domain is live -->` comment — the domain is live now, so the TODO no longer applies.
- **User-facing text**: footer contact line, the `branch-email` form placeholder (`branch@komisiyoneri.co.rw`), the AI chat assistant's company-info text block, and both language variants (rw/en) of the chat fallback messages.
- **Demo data**: all 8 sample-property `ownerEmail: 'demo@komisiyoneri.com'` values updated to `demo@komisiyoneri.co.rw` (cosmetic seed data, not production data).
- Verified `fetch('/api/chat', ...)` uses a relative path — no domain-related change needed there.
- Verified every inline `<script>` block (24 total) still passes `node --check`, and the JSON-LD block still parses as valid JSON, after all edits.

### `robots.txt`
Updated the header comment and the `Sitemap:` directive from the old Vercel domain to `https://komisiyoneri.co.rw/sitemap.xml`.

### `sitemap.xml`
Updated both `<loc>` entries (root and `/listings`) to `https://komisiyoneri.co.rw`.

### `KOMISIYONERI_MASTER_CONTEXT.md`
- Fixed an internal inconsistency: `Target Domain: www.komisiyoneri.co.rw` → `komisiyoneri.co.rw`, now matching the `Live Platform` line directly above it.
- Updated the stale Hosting & DevOps section, which still listed the Vercel URL as "live" and the old `.com` domain as "target — pending DNS". It now reads `komisiyoneri.co.rw (live — production)` with the Vercel URL correctly relabeled as the preview/staging alias (kept, not removed — see below).

### `property-card-fix.html` (developer doc, not part of the live app)
Updated the Firebase "Authorized domains" instruction to tell the developer to add the real production domain `komisiyoneri.co.rw`, while keeping the existing Vercel-domain instruction alongside it — that domain likely still needs to stay authorized in Firebase for preview/staging deploys, so this was additive rather than a replacement.

### `KOMISIYONERI_Firebase_Guide.html` (developer setup guide, not part of the live app)
Updated all instructional/example references to the custom-domain setup, Search Console property URL, sitemap URL, and the footer URL pill to `komisiyoneri.co.rw`.

## Verified — no changes needed
- `manifest.json`, `sw.js`, `api/chat.js`, `README.md` — no domain references found.
- `vercel.json` — only contains the internal Vercel deployment project name (`komisiyoneri-platform`), not a URL; out of scope for a branding migration.

## Flagged for manual/external review (deliberately not auto-edited)

1. **4 authentication/authorization checks** using the literal string `admin@komisiyoneri.com` in `index.html` (lines ~9052, 10539, 12141, 24953). These gate real admin-only UI. If the actual admin login is on a different address (e.g. the real `info.komisiyoneri.net@gmail.com`, which is already checked alongside it in one location), the `admin@komisiyoneri.com` fallback should be updated by someone who can confirm the real credential in use — a blind text-replace here risks silently locking out or granting admin access incorrectly.
2. **Google Search Console verification file** (`google75d59cf7770a60a9.html`). This token is cryptographically tied to Google's verification of the *old* domain/property and can't be produced by find-and-replace. A new verification file/token must be obtained from Google Search Console once `komisiyoneri.co.rw` is added and verified there as its own property.
3. **`komisyoneri-platform.vercel.app` retained in two developer docs** (`property-card-fix.html`, `KOMISIYONERI_MASTER_CONTEXT.md`'s Hosting section) as the Firebase-authorized preview/staging domain. Confirm whether Vercel preview deploys are still needed post-launch; if not, this can be removed from Firebase's Authorized domains list and from these docs.
4. **`info@komisiyoneri.com` in `KOMISIYONERI_Firebase_Guide.html`'s footer** — this is a *different* address from the platform's real, actively-used contact email (`info.komisiyoneri.net@gmail.com`, a Gmail address used everywhere else). This looks like a pre-existing placeholder/typo in the dev doc, unrelated to this migration. Left unchanged rather than inventing a new `@komisiyoneri.co.rw` mailbox that may not exist yet — flagging for someone to confirm the correct address.
5. **DNS/hosting cutover itself** is an infrastructure action outside this codebase change: this pass only updates what the *code* says the domain is, not the actual DNS records, SSL certificate, or Vercel/Firebase domain configuration.

## What was intentionally preserved
- `info.komisiyoneri.net@gmail.com` — the real, actively-used contact email — untouched everywhere, since it's a Gmail address structurally unrelated to the `.com`→`.co.rw` domain change.
- Sentry `release:'komisiyoneri@1.0.0'` (a version tag, not a domain) and `location.hostname.includes('localhost')` (legitimate runtime dev/prod environment detection) — both preserved exactly as-is, per the instruction to preserve development configurations where required.

## Verification performed
- `node --check` on all 24 inline `<script>` blocks in `index.html` — 0 errors.
- JSON-LD `@graph` block re-parsed with `JSON.parse` — still valid after the URL updates.
- Repo-wide grep for `komisyoneri-platform-nu.vercel.app` and `www.komisiyoneri.com` after all edits: the only remaining hit is the one intentionally-preserved Vercel alias reference in `KOMISIYONERI_MASTER_CONTEXT.md`, now correctly labeled as a staging alias rather than the live domain.

## Bottom line
Every production-facing domain reference in the live application — canonical/hreflang tags, Open Graph, Twitter Card, structured data, sitemap, robots.txt, footer/nav text, form placeholders, and chat-assistant copy — now points to `https://komisiyoneri.co.rw`. Nothing was fabricated or guessed: the four live admin-auth checks, the Google Search Console token, and one pre-existing doc-only email inconsistency are flagged above for a manual decision rather than silently changed, since getting any of those wrong risks either breaking real admin access or leaving a dead/incorrect external reference in place.
