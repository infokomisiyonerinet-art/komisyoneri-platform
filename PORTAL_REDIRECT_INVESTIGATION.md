# Staff/Partner Portal Redirect — Regression Investigation

## Report

`staff.komisiyoneri.co.rw` and `partners.komisiyoneri.co.rw` were previously fixed (PR #103, #105) to redirect logged-out visitors to their own dedicated login pages (`staff-login.html`, `partner-login.html`) instead of the public homepage. Reported symptom: visiting either subdomain now shows the regular `www.` public homepage again.

## 1. Deployment status

Same limitation as the prior multilingual/mobile-layout investigations in this repo's history: this sandbox has no network route to the live domains or to Vercel's dashboard/API (`curl https://staff.komisiyoneri.co.rw/` → `CONNECT tunnel failed, response 403`). Could not directly confirm what Production is currently serving.

**This is now the third reported "regression" in a row (multilingual toggle, mobile scroll/layout, and now this) that is fully present and correct in `main` but reportedly broken in the field.** That pattern is itself strong evidence pointing to one root cause across all three: Production is not tracking the latest `main` commit. See section 4.

## 2. Is the routing logic still present?

Yes, fully intact, confirmed by direct code reading:
- `<head>`'s early inline script (index.html, top of `<head>`) sets `document.documentElement.setAttribute('data-portal', portal)` based on `window.location.hostname` (`staff.` → `staff`, `partners.` → `partners`, else `public`), before any CSS/paint.
- A CSS rule keyed off that attribute force-hides the public homepage on gated subdomains: `html[data-portal="staff"] #page-home, html[data-portal="partners"] #page-home{display:none!important}`.
- `getPortalContext()`, `portalAllowsUser()`, `portalMismatchMessage()`, `portalLoginUrl()` — all present, unchanged in logic since PR #105.
- The `DOMContentLoaded` "Staff/Partner portal gate" — runs first, unconditionally, before any path/hash routing — calls `redirectToPortalLogin(portalLoginUrl(portalGate), reason)` for any visitor without a valid, correctly-scoped, active session.
- A last-resort `<head>` watchdog independently catches the case where routing never leaves `#page-home` within 5 seconds.

## 3. Git history since PR #105 (`6fda3a1`) — what actually changed

`git log --oneline 6fda3a1..HEAD -- index.html` shows 18 commits touched `index.html` since PR #105 merged. Of those, only **two** touched anything in the portal-routing/gate code at all:

- `9069a93` — "Fix infinite redirect loop between staff/partner login and dashboard"
- `fb60e84` — "Fix staff portal timeout/redirect-loop, role isolation, and missing CEO/management dashboards" (PR #112)

Both changes are the same kind of edit: replacing direct `window.location.replace(portalLoginUrl(...))` calls with `redirectToPortalLogin(portalLoginUrl(...), reason)` — a wrapper added by PR #112 that adds a bounce counter (`PORTAL_REDIRECT_LOOP_KEY`/`PORTAL_REDIRECT_LOOP_MAX`) to detect and stop genuine redirect loops instead of bouncing forever. This is a strict improvement (it only *prevents* a failure mode), not a weakening of the gate — the underlying redirect still happens on the first 4 attempts, exactly as before.

The other 16 commits (multilingual system, mobile-layout audit, RTDB security rules, dashboard builds, data-flow fixes, etc.) never touch `getPortalContext`, `portalAllowsUser`, `portalLoginUrl`, the `data-portal` attribute/CSS, or the `DOMContentLoaded` portal gate.

**No commit since PR #105 introduced a regression in this logic.**

## 4. Empirical verification (Playwright, current `main`)

Loaded the current `index.html` as a genuinely logged-out visitor (no `km_current` in localStorage) against all three hostnames:

| Hostname | Result |
|---|---|
| `staff.komisiyoneri.co.rw` | Real navigation to `/staff-login.html` (confirmed via `page.url()`). Console: `[PORTAL] gate check: portal=staff ... allowed=false` → `[PORTAL] redirecting to /staff-login.html — reason: no session`. |
| `partners.komisiyoneri.co.rw` | Real navigation to `/partner-login.html`, same gate/redirect log pattern. |
| `www.komisiyoneri.co.rw` | Stays on the public homepage — `#page-home` active, `display:block`, `data-portal="public"`. |

All three acceptance criteria for this task are already met by the current `main` branch.

## Conclusion

**No code fix was made because no code regression exists.** The staff/partner portal gate is present, correct, and has only been strengthened (redirect-loop guard) since PR #105 — never weakened. The reported symptom, combined with this being the third such report in a row with the same "works in code, reportedly broken live" shape, points overwhelmingly to Production serving a stale build that predates one or more of these merges, rather than anything in the codebase.

**Recommendation:** whoever has Vercel dashboard/CLI access should check:
- Project Settings → Git: is `main` actually configured as the Production branch?
- Deployments tab: does the deployment for the current `main` HEAD show as **Production** (not just Preview), and does its build actually include `staff-login.html`/`partner-login.html`/the portal-gate script (spot-check by viewing source on the live Production deployment URL, not just the custom domain, in case the custom domain's DNS/alias itself is pointing at an old deployment)?
- If a deployment exists for the latest `main` commit but the custom domains (`staff.`/`partners.`/`www.komisiyoneri.co.rw`) still serve old content, the domain aliases may need to be manually re-pointed at the latest Production deployment.
