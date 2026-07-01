# KOMISIYONERI Performance Optimization — Audit Report

**Date:** 2026-07-01
**Branch:** `claude/komisiyoneri-performance-audit-2ucyyb`
**Scope:** Full-platform performance audit and safe optimization pass (see "Environment constraint" below for what could and couldn't be live-verified).

## Environment constraint (read this first)

This audit was run in a sandboxed remote environment whose network policy **blocks all external CDN domains** (`gstatic.com`, `sentry-cdn.com`, `googletagmanager.com`, etc. all return `403`/`ERR_TUNNEL_CONNECTION_FAILED`). That means the live app — which loads Firebase, Sentry, PostHog, and EmailJS from those CDNs — cannot fully boot in this sandbox, and no live Firestore reads could be executed or measured here. This affects **measurement**, not the changes themselves: every edit was verified through (a) static JS-syntax validation of every inline `<script>` block, (b) direct unit-style execution of the modified functions in a real Chromium instance (Playwright), and (c) careful manual reasoning about Firestore Compat SDK v10.7.1's documented API. Real-world confirmation of the Firestore byte/latency savings (items 1–2 below) should happen on the next deploy preview using Chrome DevTools Network tab on the `/branches`, `/bi`, and `/exec` pages — the report tells you exactly what to look for.

## Bottlenecks found, by severity

**Critical**
1. Dashboard KPI functions (`loadBranchKPIs`, `renderBranchCards`, `loadBranchPerformance`, `loadBISummary`, `biBenchmarkTable`, `loadExecAgentPerf`, exec top-KPI strip) downloaded **entire Firestore collections just to read `.size`** — i.e., paying full document-read cost (bytes + Firestore billing) for a single number.
2. The same dashboards ran **N+1 query patterns**: one query per branch/agent inside a loop (e.g. `biBenchmarkTable` fired 4 queries per agent — 400 reads for 100 agents — just for a leaderboard table).
3. The `branches` collection was queried independently **3 separate times** per branch-dashboard session; `properties` **4+ times**.
4. No `enablePersistence()` — every navigation re-fetched everything from the network, even data the user had already loaded seconds earlier.
5. `main.css` (171 KB) was **completely orphaned** — confirmed via full-repo grep and git history that no HTML file links it and no JS dynamically loads it. Pure dead weight, silently sitting in every branch's git history.

**High**
6. `sw.js` used network-first for every request, including the 1.5 MB HTML shell, so even instant repeat visits paid a full network round trip before any cache fallback.
7. `vercel.json` had no explicit `Cache-Control` for `index.html`; `/images/*` was capped at a 24-hour cache for assets that almost never change.
8. Property-listing card images used CSS `background-image` set eagerly for every card in a list, with no lazy-loading — unlike the rest of the app's static `<img>` tags, which already use `loading="lazy"`.
9. The hero image shipped only as a 332 KB JPEG even though a 259 KB WebP of the same image already existed in the repo, unused.

**Medium**
10. Sentry, EmailJS, and Firebase Analytics loaded synchronously in the same blocking chain as the essential Firebase SDKs, despite none of the three being load-order critical.

## Changes applied

### 1. Firestore query optimization (`index.html`)
Converted **22 call sites** across the Branches, Business Intelligence, and Executive dashboards from full-collection `.get()` reads to Firestore `.count().get()` aggregation queries (returns a single number, not documents):
- `loadBranchKPIs()`, `renderBranchCards()` per-branch loop, `openBranchDetail()` live stats, `loadBranchPerformance()`, `updateBranchSidebarBadge()` — the entire Branches page.
- `loadBISummary()` (total listings + win-rate), `biBenchmarkTable()` (per-agent leads/deals/won/viewings) — the BI dashboard.
- Executive dashboard's top KPI strip (`exec-kpi-deals/props/agents/leads`) and `loadExecAgentPerf()`/`loadExecConversion()`.

Also **deduplicated** the `branches` collection read: `loadBranchKPIs()` and the sidebar badge no longer issue their own independent branch queries — branch/district counts now derive from the `_branches` array already populated by `fetchBranches()`, via a new `renderBranchDistrictKPIs()` helper.

Where a metric needs the *sum of a field* (revenue, commission totals) rather than a count, the original full-document read was left intact — those numbers must stay exact and Firestore's aggregation API in this SDK version only supports `count()`, not `sum()`/`average()`.

**What to verify on next deploy:** open DevTools Network → Firestore, visit `/branches`, `/bi`, and the exec dashboard. Compare request payload sizes to before — count queries return single-digit-KB responses instead of full document sets.

### 2. Firestore offline persistence (`index.html:13780-13785`)
Added `db.enablePersistence({synchronizeTabs:true})` right after Firestore init. Repeat navigations now read from IndexedDB instantly instead of always waiting on network.

### 3. Removed dead weight
Deleted `main.css` (171 KB) — confirmed unreferenced anywhere in the repo before removal.

### 4. Service worker (`sw.js`, v3→v4)
- Navigation requests (the HTML shell) stay **network-first** — so deploys are visible immediately, no risk of serving stale app logic indefinitely.
- Everything else (manifest, icons, images) now uses **stale-while-revalidate** — instant from cache, refreshed in the background.
- Hero WebP added to the precache list.
- Cache name bumped to `komisiyoneri-v4` so the new strategy takes effect cleanly for existing installs (the existing `activate` handler already purges old cache versions).

### 5. HTTP caching (`vercel.json`)
- `index.html` (both `/` and `/index.html`) now gets `Cache-Control: public, max-age=60, stale-while-revalidate=86400` — instant edge serving with fast revalidation.
- `/images/*` raised from `max-age=86400` (24h) to `max-age=604800` (7 days). Note: image filenames aren't content-hashed, so any future image *replacement* should use a new filename to bust this longer cache.

### 6. Image optimization
- Hero background now uses `image-set()` (with `-webkit-` fallback and a plain-URL fallback for non-supporting browsers) to serve the existing WebP to browsers that support it. Verified in Chromium: computed `background-image` correctly resolves to the `.webp` URL.
- Property-card images: since cards use `.p-img` as a real DOM container with badges/buttons layered inside it (not a plain `<img>`, which can't have children), true native `loading="lazy"` wasn't a drop-in option. Implemented equivalent behavior instead: image URLs are now stashed in a `data-bg` attribute and applied via a single shared `IntersectionObserver` (`initLazyPropImages()`) that activates once a card scrolls within 200px of the viewport. A `MutationObserver` on `document.body` wires this up automatically for all 9 places in the codebase that render property cards, so no per-page-call-site changes were needed. Verified end-to-end in Chromium: off-screen card keeps `data-bg` and no background image; after scrolling into view, `data-bg` is removed and `background-image` is set correctly.

### 7. Non-critical blocking scripts
- Sentry bundle: added `async` (its own init already guards with `typeof Sentry !== 'undefined'`).
- EmailJS bundle: added `defer` (its call site already guards with `typeof emailjs === 'undefined'`).
- Firebase Analytics: changed to `defer`, and moved `firebase.analytics()` initialization into a `window.addEventListener('load', ...)` handler so it still initializes reliably without sitting in the blocking chain with the 5 essential Firebase SDK scripts.
- **Deliberately left unchanged:** `firebase-app/auth/database/firestore/storage-compat.js` and the ~14,000-line inline app script. The codebase relies on implicit top-level `var` globals (`db`, `rtdb`, `_branches`, etc.) shared across ~20+ sequential `<script>` blocks with no test coverage. Safely deferring them would require converting that into an explicit module/namespace pattern first — flagged below as future work rather than risked in this pass.

## Verification performed

- **JS syntax:** every inline `<script>` block extracted and run through `node --check` after each edit batch — all pass.
- **JSON validity:** `vercel.json` parsed successfully; `sw.js` passes `node --check`.
- **Functional (Playwright/Chromium):**
  - Service worker registers, activates, and precaches all expected files including the new WebP.
  - Hero `.hero` element's computed `background-image` correctly resolves to `image-set(...)` with the WebP first.
  - `renderUserPropCard()` executes cleanly and produces the expected `data-bg` attribute.
  - Lazy-load observer: an off-screen test card keeps `data-bg` unapplied; after scrolling into view, the background image is correctly applied and the attribute removed.
  - SPA routing (`showPage`) still works — navigating to a static page (`page-about`) correctly toggles the `active` class.
  - No stylesheet in the rendered page references the deleted `main.css`.
- **Not verifiable here:** live Firestore query behavior, real page-load timing under a real network, and Lighthouse — all blocked by the sandbox's CDN restrictions (see constraint note above).

## Recommended follow-up (not attempted in this pass)

- Apply the same `.get()` → `.count()` conversion sweep to the remaining ~40 pure-count call sites the audit found outside the Branches/BI/Exec dashboards (HR, Office, Accounting, Documents, Partners, Viewings sidebar badges) — same mechanical pattern, just needs the same care per call site.
- `loadExecFunnel`, `biPipelineValue`, `biDealsByType`'s underlying full fetch, and the revenue/commission sum queries were deliberately left as full-document reads because they compute exact business totals (pipeline value, revenue) that a `.limit()` would silently misreport. If these collections grow very large, consider Firestore `sum()`/`average()` aggregation queries (need to confirm they're supported by the pinned Compat SDK v10.7.1, or a Cloud Function that maintains a rolling total).
- A future phase to modularize the ~14,000-line inline script (explicit namespacing instead of implicit globals) would unlock deferring the core Firebase SDK scripts too — currently blocked by the lack of a module boundary and test coverage.
- Splitting `index.html`/CSS per page or migrating off the Compat SDK would cut the initial payload further but requires a build step, which conflicts with the project's explicit "no bundler, vanilla JS only" rule — a multi-week rewrite, not a safe incremental change.
- `api/chat.js` has no request timeout — low priority, unrelated to page-load speed.

## Bottom line

The highest-value, lowest-risk levers for the ≤5-second dashboard target — unbounded/duplicated/N+1 Firestore reads on exactly the pages the target calls out (Branches, BI, Executive dashboards) — have been fixed: 22 full-collection reads became single-digit-KB aggregation queries, 3 duplicate `branches` reads collapsed to 1, and offline persistence now serves repeat visits from IndexedDB. Static-delivery wins (dead CSS removed, stale-while-revalidate caching, WebP hero, lazy-loaded listing images, non-critical scripts unblocked) further help the ≤3-second initial-load and Lighthouse targets. I could not run a live Lighthouse pass or measure real Firestore latency in this sandbox (CDN access blocked) — **please re-run Lighthouse and check the Firestore Network tab on the next deploy preview** to confirm the numeric targets are met; the code-level changes here are the mechanism, not a substitute for that live measurement.
