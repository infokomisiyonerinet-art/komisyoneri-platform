# staff.komisiyoneri.co.rw — 404 Investigation

## Report

Visiting `https://staff.komisiyoneri.co.rw` returns **Vercel's own "Page Not
Found" page** — not a DNS resolution failure, not a browser error, an actual
Vercel-served 404. This was first noticed shortly after the Dynamic RBAC /
Progressive Governance work (PR #169) merged, which raised an initial
question of whether the two were related. They are not — see below.

Confirmed facts going in (from the reporter's own Vercel/Cloudflare access,
which this investigation had no way to verify directly — see the network
limitation in the next section):
- `staff.komisiyoneri.co.rw` and `partners.komisiyoneri.co.rw` both show as
  "Connected Projects" under the `komisiyoneri-platform` Vercel project.
- Cloudflare DNS has a CNAME: `staff.komisiyoneri.co.rw` →
  `c2532991196d05eb.vercel-dns-017.com` (DNS only / grey cloud) — the same
  pattern already working for `www`.
- The request reaches Vercel's edge (TLS succeeds, Vercel's own 404 page
  renders) — this is not a DNS-level failure.

## 1. Network limitation, stated explicitly

This sandbox has no route to the live domains or to the Vercel
dashboard/API — `curl https://staff.komisiyoneri.co.rw/` consistently
returns `CONNECT tunnel failed, response 403`, confirmed at multiple points
across this investigation. **No live response headers, dashboard screenshots,
or verification-status fields could be pulled directly.** Every finding
below is either (a) confirmed from the actual repository contents, with the
exact evidence shown, or (b) explicitly flagged as requiring a human with
live dashboard access, per the decision tree in section 6.

## 2. Was this caused by the RBAC work (PR #169)?

No. Traced in detail first, since the timing coincidence was the initial
hypothesis:
- `staff-login.html`'s actual login logic lives in `js/portal-login.js`,
  which was **not touched** by the RBAC PR at all.
- Its one Firestore read (`db.collection('users').doc(uid).get()`, reading
  the signed-in user's own document) is authorized by the unconditional
  `request.auth.uid == uid` clause in the `users/{uid}` read rule — present
  before this session's rules changes and never modified by them (only the
  `update` rule was touched, for role-field/agent-verify gating).
- The one new async Firestore read added this session
  (`role_permissions/{role}` inside `index.html`'s `restoreUserSession()`)
  is wrapped in a `.catch()` that always proceeds to `saveUser()` regardless
  of outcome — it cannot block, redirect, or 404 anything.
- No top-level (immediately-executing) code added this session could throw
  and break script initialization — every addition is either a function
  declaration or a static object/array literal, confirmed by `node --check`
  across all inline `<script>` blocks.

Ruled out. The 404 is a routing/infrastructure issue, unrelated to RBAC.

## 3. Is the client-side portal-gate logic broken?

No — confirmed correct and unmodified, on two independent passes:
- This investigation's own read of `getPortalContext()`, `portalAllowsUser()`,
  `portalLoginUrl()`, and the `DOMContentLoaded` portal gate in `index.html`.
- A prior, separate investigation (`PORTAL_REDIRECT_INVESTIGATION.md`) had
  already verified this same logic with a live Playwright run against
  `staff.komisiyoneri.co.rw`/`partners.komisiyoneri.co.rw` hostnames,
  confirming correct redirect-to-login-page behavior for a logged-out
  visitor. That report's own conclusion — "no code fix was made because no
  code regression exists" — still holds; this investigation found nothing
  to contradict it.

## 4. Repository-side causes — checked and ruled out with evidence

### 4a. Project-level redirect/rewrite intercepting the `staff` hostname
`vercel.json`'s full `rewrites` array:
```json
"rewrites": [
  { "source": "/property/:id", "destination": "/api/property-og?id=:id" },
  { "source": "/(.*)", "destination": "/index.html" }
]
```
No `redirects` key exists in the file at all. Neither rule has a `has`/
`missing` condition (Vercel's mechanism for host-header-scoped rules) —
both apply identically regardless of the request's `Host` header. **The
codebase contains no mechanism capable of singling out or misrouting the
`staff` hostname specifically.**

### 4b. `staff-login.html` missing or moved
```
git ls-files | grep staff-login.html   → staff-login.html (tracked, repo root)
git log -1 -- staff-login.html          → 7923f07, 2026-07-23 (committed)
```
Present at the deployment root, not nested, part of history. Vercel's
routing order is always static-file-match before rewrites apply, so a
direct request for `/` or `/staff-login.html` is never "swallowed" by the
SPA catch-all rewrite — that rewrite exists only for paths with no matching
static file (e.g. `/listings`).

### 4c. Service worker / edge cache serving a stale cached 404
Ruled out on two independent grounds:
- `sw.js`'s fetch handler branches only on request path/destination type —
  zero hostname-conditional logic anywhere in the file.
- Service workers are scoped **per-origin** by browser design. A worker
  registered on `www.komisiyoneri.co.rw` cannot see or affect requests to
  `staff.komisiyoneri.co.rw` — a different origin entirely, with fully
  isolated registration and cache storage. `staff-login.html` itself
  contains no `navigator.serviceWorker.register(...)` call at all, so no
  service worker could ever have been registered on that origin in the
  first place, even in principle.

## 5. Conclusion

Every code-level, repository-resident cause was checked and ruled out with
direct evidence. What remains is exclusively Vercel-dashboard-side state —
domain verification status, or which deployment/environment the `staff.`
domain is actually bound to — none of which is stored in version control
and none of which this sandbox could reach live. **This requires a human
with Vercel dashboard access to resolve**, per the decision tree below.

## 6. Decision tree (for whoever has Vercel/Cloudflare access)

**Step 0 — decisive first test:** open `https://partners.komisiyoneri.co.rw`
in an incognito tab. Same CNAME pattern, same "Connected Project" status as
`staff.` — this single test splits the remaining problem in two.

- **If `partners.` ALSO 404s** → systemic, not `staff.`-specific (Branch A).
- **If `partners.` loads correctly** → something specific to the `staff.`
  domain entry itself (Branch B).

### Branch A — both subdomains 404
1. Vercel Dashboard → `komisiyoneri-platform` project → **Settings →
   Domains** → tap `staff.komisiyoneri.co.rw`.
2. Check the status badge: **Valid Configuration** vs **Invalid
   Configuration/Pending**.
   - If Invalid/Pending: compare the DNS record Vercel says it expects
     against the actual Cloudflare record character-for-character — a
     leftover conflicting A record or a second CNAME for `staff` from an
     earlier attempt is the most common cause of a stuck verification
     despite "the CNAME looking right." Remove any conflict, then tap
     **Refresh** on the domain.
   - If already Valid Configuration: proceed to step 3.
3. Check what deployment/environment the domain is assigned to (Vercel
   shows this as "Assigned to Production" or a specific deployment/branch).
   If it names an old/pinned deployment or the wrong branch, edit it to
   track **Production**.
4. Force a clean re-bind: **Deployments** tab → latest `main` commit → "..."
   → **Redeploy** (uncheck "Use existing Build Cache"). This re-attaches
   every domain assigned to Production to the fresh deployment.

### Branch B — only `staff.` 404s, `partners.` works
1. Settings → Domains → tap `staff.komisiyoneri.co.rw`.
2. Look for a redirect toggle/arrow on this specific row (the "Redirects to
   www..." indicator visible in the domains list). Confirm it is `staff.`
   itself carrying this, not the apex domain (an apex→www redirect is
   normal and unrelated).
   - If found on `staff.`: disable it, set the domain to serve the project
     directly instead. Save.
3. If no redirect is set, diff `staff.`'s configuration against `partners.`'s
   (which works) field-by-field — verification status, assignment target —
   and make `staff.` match.
4. If they look identical and it still 404s, remove
   `staff.komisiyoneri.co.rw` from the project entirely and re-add it fresh.
   Re-adding often clears a corrupted binding state no toggle exposes
   directly; Cloudflare's existing CNAME does not need to change.

## 7. Pass/fail signal after the fix

Reload `https://staff.komisiyoneri.co.rw/` in a fresh incognito tab.

**Pass:** the Staff Portal page — navy sidebar, "KOMISIYONERI ConnectPro"
branding, "Staff Portal — internal access for KOMISIYONERI ConnectPro
Services team members only," email/password fields, "Injira" button. This
is `staff-login.html`'s actual markup.

**Still fail:**
- Vercel's 404 again → the binding still isn't fixed; re-check the branch
  followed above.
- The public marketing homepage (listings/hero content) instead of the
  login form → a *different* symptom class than this report addresses (the
  domain now resolves, but something in the client-side portal gate would
  need a fresh look) — not expected given section 3's findings, but if seen,
  treat as a new investigation rather than assuming this report covers it.
