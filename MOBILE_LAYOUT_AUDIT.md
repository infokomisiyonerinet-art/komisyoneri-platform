# Mobile Layout & Multilingual Deployment Audit — 2026-07-14

## 1. Deployment status: is the multilingual system in Production?

**Merged to `main`: YES, confirmed.**

- `221062e` / PR #117 — "Add professional 4-language system: English, Kinyarwanda, Français, Kiswahili" — merged.
- `66edcf6` / PR #118 — fixed a pre-existing, unrelated `switchLang()`/`currentLang` bug found while verifying the above — merged.
- Current `main` HEAD (`8a38664`) contains both. Verified directly in `index.html`: the header markup is `.lang-selector-btn` + `.lang-menu` with 4 `.lang-menu-item` entries (🇬🇧 English, 🇷🇼 Kinyarwanda, 🇫🇷 Français, 🇹🇿 Kiswahili — Tanzania flag, not Eswatini), `manifest.json`'s default `lang` is `"en"`, and `firestore.rules` allows the `language` field on `users/{uid}` self-edit. The old `.lang-sw` / `.lang-btn` RW/EN toggle markup no longer exists anywhere in the file (`grep -c "lang-btn\|lang-sw" index.html` → 0).

**Promoted to Production: could not be independently confirmed from this sandbox.**

This sandbox has no network route to the live domains or to Vercel's dashboard/API — confirmed via `curl https://staff.komisiyoneri.co.rw/`: `CONNECT tunnel failed, response 403` (the environment's outbound proxy blocks it; this is a standing sandbox limitation, not a site-side error). I cannot fetch the live page to check what it's actually serving.

**However, the field report (old RW/EN toggle still showing on `staff.komisiyoneri.co.rw`) is itself strong, direct evidence that Production has not yet redeployed/promoted the latest `main`.** The code on `main` unambiguously has the new 4-language selector — there is no code path left that would render the old toggle. The most likely explanations, in order of likelihood:
1. Vercel's Production environment hasn't rebuilt from the latest `main` commit yet (either auto-deploy-on-merge isn't wired up for this project, or a manual promotion step is pending).
2. Less likely given the response headers already reviewed (`vercel.json` sets `Cache-Control: public, max-age=0, must-revalidate` on `/` and `/index.html`, and `no-cache, no-store` on `sw.js`) — a stale CDN/edge cache is possible but the existing cache headers are already configured correctly against this, so it's not the prime suspect.

**Recommendation:** someone with Vercel dashboard access should check Project → Deployments for the latest `main` commit (`8a38664`) and confirm it shows as **Production** (not just Preview), and if not, trigger a redeploy/promotion of that commit.

## 2. Mobile scroll/layout audit methodology

Tested the current `main` branch's `index.html` with Playwright/headless Chromium at the two viewport widths named in the task (375×812 and 430×932), serving the real `css/header.css`, `css/bottom-nav.css`, `css/fab.css` files (not mocked) alongside a minimal Firebase stub (auth/firestore/database/storage no-ops returning empty collections), so every dashboard's real CSS and real `go()`/loader code ran unmodified.

For each target: set `localStorage.km_current` to a role fixture (mirrors the app's own synchronous `loadSavedUser()` restore path), load the page fresh, call `go(<page>)` exactly as the app's own nav/dashboard links do, then measure:
- Does `.page.active` match the expected page id (confirms role-routing didn't regress)?
- `scrollTo({top:999999, behavior:'instant'})` — does `window.scrollY` actually move (confirms the page isn't scroll-locked)?
- Computed `overflow-y` on `<html>`/`<body>`, and inline `body.style.overflow` (catches a stuck modal scroll-lock)?
- Walk up from the active `.page` 5 ancestors checking for `overflow-y:hidden` (catches a wrapping container clipping content)?
- `scrollWidth` vs `clientWidth` on `<html>` (catches unwanted horizontal overflow)?

Scripts: `mobile_layout_audit.js` (metrics, 24 targets × 2 viewports) and `mobile_screenshots.js` (visual spot-check, 4 representative dashboards) — both in the session scratchpad, not committed (test-only, no production code).

## 3. Results — checklist

All 24 targets × 2 viewports (375px, 430px) = **48/48 pass**: page routes to the expected dashboard, content scrolls to its full height, no `overflow:hidden` lock on `<html>`/`<body>` or any ancestor of the active page, no horizontal overflow.

| # | Dashboard | 375px | 430px |
|---|---|---|---|
| 1 | Executive (CEO) | ✅ | ✅ |
| 2 | Operations Director (shares Executive dashboard) | ✅ | ✅ |
| 3 | Operations Manager | ✅ | ✅ |
| 4 | Finance (Director of Finance / accountant) | ✅ | ✅ |
| 5 | Brokerage (Chief Broker) | ✅ | ✅ |
| 6 | Marketing Manager | ✅ | ✅ |
| 7 | CustomerSupport Manager | ✅ | ✅ |
| 8 | IT Manager | ✅ | ✅ |
| 9 | Legal Adviser | ✅ | ✅ |
| 10 | HR Manager | ✅ | ✅ |
| 11 | Branch Manager | ✅ | ✅ |
| 12 | Agent — My Properties (dashboard) | ✅ | ✅ |
| 13 | Agent — Deals | ✅ | ✅ |
| 14 | Agent — Viewings | ✅ | ✅ |
| 15 | Agent — Clients | ✅ | ✅ |
| 16 | Agent — Commissions | ✅ | ✅ |
| 17 | Agent — Verification | ✅ | ✅ |
| 18 | Agent — Documents | ✅ | ✅ |
| 19 | Client Dashboard | ✅ | ✅ |
| 20 | Partner — Construction | ✅ | ✅ |
| 21 | Partner — Bank | ✅ | ✅ |
| 22 | Partner — Insurance | ✅ | ✅ |
| 23 | Partner — Legal | ✅ | ✅ |
| 24 | Public Homepage (logged out, and logged-in Agent — the reported "Welcome/home" page) | ✅ | ✅ |

Visual spot-check (screenshots at 375px, real CSS, before/after scrolling to bottom) on Public Homepage, Agent dashboard, CEO Executive dashboard, and Finance dashboard: header renders the new flag-based language selector correctly (icon-only, no code text, per the `@media(max-width:480px)` rule), the bottom tab bar sits fixed at the bottom with correctly-styled icons, and the last card on each page clears the bottom nav with normal spacing (`--bn-h` padding-bottom compensation is working) — no content cut off behind the nav bar.

## 4. Root cause

**No scroll/layout regression is reproducible in the current `main` branch code.** The multilingual PR's diff (reviewed directly, `git diff` between the pre- and post-merge commits) touches only the header's language-selector markup/CSS/JS (`.lang-sw`/`.lang-btn` → `.lang-selector-btn`/`.lang-menu`) and the language-state globals — it does not touch `.page`, `html`/`body` overflow rules, the bottom-nav height variable (`--bn-h`), or any dashboard's own markup.

Given:
- item 1's finding (old toggle still live) already independently indicates Production is running a build older than `main`, and
- this audit finds a completely clean bill of health across every dashboard on current `main`,

the most likely explanation for **both** reported issues (stale language toggle *and* the scroll/layout complaint) is the same one: **Production has not yet redeployed from the latest `main` commit.** No code fix was made because no code defect was found to fix — pushing a fresh Production deployment of `main` is the actual remediation.

If the scroll issue is still reproducible on a real device *after* confirming Production is serving `main`@`8a38664` or later, that would point to something outside this audit's reach: a real-device Safari quirk (e.g. iOS's dynamic toolbar interacting with `calc(100vh - 64px)` in `.page`, or momentum-scroll edge cases) that headless Chromium doesn't reproduce — worth a follow-up with an actual iPhone-width Safari test if it recurs.

## 5. Files

- This report: `MOBILE_LAYOUT_AUDIT.md`.
- No `index.html`/CSS changes were made — audit only, no regression found to fix.
