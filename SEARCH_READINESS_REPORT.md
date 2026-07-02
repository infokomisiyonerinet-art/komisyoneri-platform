# KOMISIYONERI Google Search & AI Discoverability (SEO/GEO) — Readiness Report

**Date:** 2026-07-01
**Branch:** `claude/komisiyoneri-performance-audit-2ucyyb`
**Scope:** Full technical SEO, content SEO, local SEO, and generative-engine-optimization (GEO/AI discoverability) audit and safe optimization pass, building on the prior performance, mobile, conversion, user-journey, trust, and domain-migration sessions on this branch.

## Scores

| Dimension | Score |
|---|---|
| Technical SEO | 78 / 100 |
| Content SEO | 82 / 100 |
| Local SEO | 70 / 100 |
| AI Discoverability (GEO) | 80 / 100 |
| Core Web Vitals | 75 / 100 *(carried over from the performance session — see note below)* |
| **Overall Production Search Readiness** | **77 / 100** |

The single factor capping every dimension is architectural, not a fixable bug: this is a vanilla-JS single-page app with no server-side rendering or build step (an explicit, deliberate project constraint — see `KOMISIYONERI_MASTER_CONTEXT.md` §4). Search engines that don't execute JavaScript (most AI crawlers) only ever see the homepage's initial HTML; engines that do execute JavaScript (Googlebot) see everything, but only for the one URL state they choose to render. This pass closes every gap that's fixable *within* that constraint — dynamic per-page metadata, structured data, breadcrumbs, clean URLs for the public pages, and an AI-readable site summary — and flags the remaining architectural investment (pre-rendering) as a scoped follow-up rather than attempting a rewrite.

## What was audited

Read `CLAUDE.md`, `KOMISIYONERI_MASTER_CONTEXT.md`, and `.github/copilot-instructions.md` first, per your instruction. Then audited: `<head>` metadata (canonical, hreflang, Open Graph, Twitter Card, JSON-LD), `robots.txt`, `sitemap.xml`, heading hierarchy across all public pages, image alt-text coverage, internal linking/breadcrumbs, the SPA's routing mechanism (hash vs. path), and the existing AI-chat-assistant company-facts block. Prior reports (`PERFORMANCE_AUDIT_REPORT.md`, `MOBILE_READINESS_REPORT.md`) were reviewed for Core Web Vitals and mobile-usability findings rather than re-measured from scratch, since this sandbox still blocks the external CDNs (Firebase, Sentry, fonts) needed to run a live Lighthouse pass — same constraint documented in every prior session on this branch.

## Findings and fixes

### 1. Routing was 100% hash-based — no clean, crawlable URLs for public pages
**Finding:** Every "page" in the SPA (`go('about')`, `go('listings')`, etc.) only ever changed `location.hash` (`#about`), never the actual URL path. `vercel.json`'s existing catch-all rewrite (`/(.*) → /index.html`) already means any real path *would* correctly serve the app — the client-side router just never took advantage of it. This meant `/about`, `/agents`, `/privacy`, and `/terms` had no distinct, indexable URL at all; Google collapses hash-fragment states into the root URL, so none of that content could ever rank independently.

**Fix (`index.html`, `go()` function and the `DOMContentLoaded` bootstrap handler):** added a `CLEAN_PATHS` map for the six genuinely public marketing pages (`/`, `/listings`, `/about`, `/agents`, `/privacy`, `/terms`). `go()` now pushes a real path for these via `history.pushState`, and dynamically updates `<link rel="canonical">` and `og:url` to match. The initial-load handler now checks `location.pathname` first (so a direct visit or refresh on `/about` correctly reopens the About page), falling back to the existing hash logic unchanged for every other page. **Every internal/dashboard page (CRM, HR, Accounting, Admin, etc.) keeps its exact existing hash-based behavior — nothing was changed there**, since those pages are already correctly excluded from indexing via `robots.txt` and don't need clean URLs.

### 2. Only 6 of ~26 SPA states had a page title; none had a distinct meta description
**Finding:** The `titles` map inside `go()` only covered `home`, `listings`, `detail`, `analytics`, `dashboard`, `auth` — visiting About, Agents, Privacy, or Terms left whatever title was last set. There was a single static `<meta name="description">` for the entire site, regardless of which page was showing.

**Fix:** expanded `titles` to cover About/Agents/Privacy/Terms (bilingual, matching the existing pattern), and added a `metaDescs` map that updates `<meta name="description">` dynamically for Home/Listings/Agents/About. This is genuinely useful for Google specifically because Googlebot executes JavaScript during its rendering pass and does pick up post-JS `document.title`/meta changes — this was previously left on the table.

### 3. Zero breadcrumbs anywhere in the codebase
**Finding:** confirmed via a full-file search — no `.breadcrumb` class, no `<nav aria-label="breadcrumb">`, anywhere.

**Fix:** added a real breadcrumb trail (Home › Properties, and Home › Properties › [Property Title]) to the two highest-traffic public pages — Listings and Property Detail — using real internal links (`onclick="go(...)"`, reusing the existing navigation function, not new plumbing) plus matching `BreadcrumbList` JSON-LD. This both helps Google's sitelinks/breadcrumb rich result and adds a genuine internal link back to Listings from every property page.

### 4. No structured data beyond the static site-wide block — property listings were invisible to Google Rich Results and AI Overviews
**Finding:** the only JSON-LD on the whole site was the static `WebSite`/`Organization`/`RealEstateAgent` block in `<head>`. Individual properties — the actual product of the platform — had no structured data at all.

**Fix:** `openPropDetail()` now injects a per-property `RealEstateListing` + `BreadcrumbList` JSON-LD block (real data: title, description, district/sector address, price, availability) each time a listing opens, and removes it when the visitor navigates away so stale schema never lingers in the DOM. Also added a static `FAQPage` JSON-LD block that mirrors the existing FAQ accordion's text exactly (added in the prior conversion session) — this directly targets the brief's "Frequently Asked Questions" GEO ask, since FAQ schema is one of the clearest signals AI Overviews/Perplexity-style engines use to extract Q&A pairs.

### 5. Property photos have no alt-equivalent text
**Finding:** property card images (`renderUserPropCard()`) are deliberately rendered as CSS `background-image` divs, not `<img>` tags — a choice made in the earlier performance session to enable efficient `IntersectionObserver`-based lazy loading. That's the right performance tradeoff, but it means these images have no `alt` text: they're invisible to Google Image Search and to any AI system parsing the DOM for image context. (The 3 real `<img>` tags elsewhere in the codebase already had correct `alt` attributes — verified, not a gap.)

**Fix:** added `role="img"` and a real, data-driven `aria-label` (property title + district) to the `.p-img` container. This doesn't reverse the lazy-load performance win — it's a pure attribute addition — but gives screen readers and AI content parsers the same context an `alt` attribute would.

### 6. No AI/LLM-facing discoverability file
**Finding:** nothing in the repo gave AI browsing agents (ChatGPT, Claude, Perplexity, etc.) a direct, structured summary of the business — they'd have to infer everything from rendered homepage HTML, which most of them can't execute JavaScript to see.

**Fix:** added `llms.txt` at the repo root (an emerging, increasingly-adopted convention for this exact purpose) — a plain-text summary of who KOMISIYONERI is, services offered, service area, contact info, trust/verification model, and key page URLs. Confirmed it's served correctly under Vercel's existing `"handle":"filesystem"` routing rule (same mechanism that already serves `robots.txt`, `manifest.json`, etc. before the SPA catch-all).

### 7. Organization structured data was missing real, already-documented facts
**Fix:** added `foundingDate: "2024"` and `founder: {"name": "Fabrice Ndacyayisenga"}` to the `Organization` JSON-LD block — both real, already-documented facts from `KOMISIYONERI_MASTER_CONTEXT.md`, not invented. Nothing was fabricated (no registration numbers, certifications, or precise address — consistent with the "no fabrication" policy already established in the prior Trust Building session).

### 8. Sitemap only listed 2 URLs; robots.txt didn't reference the new AI-discoverability file
**Fix:** `sitemap.xml` now lists all 6 real, crawlable public URLs (previously only home + listings existed as distinct paths at all). `robots.txt` gained an `Allow: /agents` line and a comment pointing crawlers/operators at `llms.txt`.

### 9. Heading hierarchy — audited, no fix needed
Checked the `<h1>` on every major public page (Home, Listings, Agents, About) — each has exactly one, correctly worded, keyword-relevant `<h1>`, confirmed via direct reads (not assumed). The 19 total `<h1>` elements across the file are one-per-SPA-page (each hidden via `display:none` except the active one), which is the standard, acceptable pattern for this kind of single-file SPA — not a duplication issue on any page a visitor or crawler actually sees rendered at once.

### 10. Search automation — added, since none existed
The brief asked for automated systems for sitemap generation and SEO health monitoring. Since this project has no build step or bundler (an explicit project rule), these are added as standalone Node scripts — dev tooling, never shipped to the browser:
- **`scripts/generate-sitemap.js`** — regenerates `sitemap.xml` from a single canonical route list (kept in sync with `CLEAN_PATHS` in `index.html`). Run manually after adding/removing a public page.
- **`scripts/seo-health-check.js`** — verifies robots.txt/sitemap.xml/index.html all agree on the production domain, checks for stale placeholder domains, confirms structured data and `llms.txt` are present, and exits non-zero on failure so it can gate a future CI step. Both scripts run clean against the current state (verified below).

## What was deliberately not done (flagged for follow-up, not attempted here)

1. **Per-property clean URLs** (e.g. `/property/{id}` instead of the existing `#prop={id}` share-link mechanism) — genuinely valuable, but requires threading a property ID through the history API and the initial-load parser with more surface area than the six static public pages touched in this pass. The existing `sharePropLink()`/`checkUrlHash()` mechanism was left completely untouched and still works exactly as before.
2. **Pre-rendering/SSR for the SPA** — the real ceiling on all five scores above. Most AI crawlers (GPTBot, PerplexityBot, ClaudeBot) don't execute JavaScript at all, so they only ever see the raw homepage HTML plus `llms.txt`; Googlebot executes JS but only renders whichever single state it chooses to snapshot. A prerendering service or a build step that emits static HTML per public route would be the single highest-leverage next investment — but it conflicts with the project's explicit "no bundler, vanilla JS only" rule and is a multi-day architectural project, not a safe incremental change.
3. **District/city landing pages** (e.g. `/kigali`, `/musanze`) — the highest-leverage *content* investment for local SEO on a real-estate platform, since they'd let each of the 30 districts already mentioned in the copy rank independently for "[district] property" searches. Not attempted here — it's new content strategy work, not an audit-and-fix task.
4. **A dynamically-generated sitemap covering individual property listings** — not done, since published listings live in Firestore/localStorage, not as static files; a proper implementation needs a scheduled Cloud Function or build step to query approved listings and regenerate the sitemap, which doesn't exist yet in this project's (currently server-function-free) architecture.
5. **A live Lighthouse / Core Web Vitals re-measurement** — blocked by the same sandbox CDN restriction noted in every prior session. The Core Web Vitals score above is carried over from `PERFORMANCE_AUDIT_REPORT.md`'s code-level fixes (Firestore query optimization, offline persistence, WebP hero, lazy-loaded card images, deferred non-critical scripts) — real changes, but only verifiable with a live Lighthouse run on the next deploy preview.

## Verification performed
- `node --check` on all 25 inline `<script>` blocks in `index.html` — 0 errors, both before and after every edit batch.
- Both JSON-LD blocks in `<head>` (site-wide) and the new `FAQPage` block re-parsed with `JSON.parse` — valid.
- **Chromium/Playwright**, served through a local rewrite-aware server mirroring `vercel.json`'s routing (real static files served as-is, everything else falls back to `index.html`, matching the real Vercel behavior):
  - Navigating to `about` correctly updates `document.title`, `location.pathname` (`/about`), the canonical link, and `og:url`.
  - Navigating to `listings` renders the breadcrumb ("Home / Properties") correctly.
  - Navigating to an internal page (`crm`) correctly **stays hash-based** (`#crm`) with no change to `location.pathname` — confirms zero regression to existing internal navigation.
  - Reloading the browser while on `/about` (simulating a direct visit or refresh) correctly reopens the About page and sets the right title — confirms the new path-aware bootstrap logic works, not just the in-app navigation.
  - Opening a real test property via `openPropDetail()` correctly sets the page title, the breadcrumb's current-page label, the meta description, and injects a valid `RealEstateListing` + `BreadcrumbList` JSON-LD block with the property's real data (title, address, price, availability).
  - Navigating away from the detail page correctly removes the injected JSON-LD — no stale schema left behind.
  - `renderUserPropCard()` output confirmed to include `role="img"` and a correct, data-driven `aria-label` on the property photo container.
  - `scripts/seo-health-check.js` passes all checks against the final state of `robots.txt`, `sitemap.xml`, `index.html`, and `llms.txt`.
- Same sandbox constraint as every prior session on this branch: external CDNs (Firebase, Sentry, Google Fonts, PostHog) are blocked here, so a live Lighthouse run and real Firestore-backed content couldn't be exercised. The console errors seen during testing (`firebase is not defined`, `posthog.capture is not a function`, `ERR_TUNNEL_CONNECTION_FAILED`) are the same pre-existing sandbox artifacts documented in every earlier report on this branch — confirmed unrelated to these changes by reproducing them before any edits were made.

## Bottom line
This pass closed every SEO/GEO gap that's fixable without restructuring the app: public marketing pages now have real, clean, indexable URLs with correct per-page titles/descriptions/canonicals; every property page carries real structured data and a breadcrumb trail instead of none; a new `llms.txt` gives AI systems a direct, honest summary of the business; and two small Node scripts give the team a repeatable way to regenerate the sitemap and catch SEO regressions before they ship. Nothing was fabricated — the new structured-data facts (founder, founding date) are already-documented truths, and the report is explicit about the one thing that would move all five scores meaningfully higher: investing in pre-rendered/static HTML for the public routes, which is a deliberate multi-day project outside this pass's safe-incremental-change scope.
