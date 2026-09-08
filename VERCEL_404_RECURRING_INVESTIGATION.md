# Recurring Vercel 404s — main domain + staff subdomain (widened investigation)

## Report

Six screenshots across multiple different dates show the same generic
"🧭 Page Not Found — This page doesn't exist or may have moved. [Go to
Homepage]" page firing on multiple different routes:
- `staff.komisiyoneri.co.rw` (root), on at least two different dates
- `www.komisiyoneri.co.rw/an...` (path truncated in the screenshot — most
  likely `/analytics`, the only `CLEAN_PATHS` route starting "an", but this
  could not be confirmed since the full URL wasn't captured)
- At least two more occurrences with no visible URL in the screenshot at all

This supersedes the scope of `STAFF_SUBDOMAIN_404_INVESTIGATION.md`, which
investigated only the `staff.` case and concluded (correctly, and still
true — see below) that it was Vercel-dashboard-side, not a repo issue. This
report adds new evidence that the identical symptom also hits the main
`www.` domain, and situates both inside a much larger pattern visible in
`git log`.

## 1. Disambiguating server-level 404 from client-level "route not matched"

This app deliberately has TWO different "page not found" surfaces that were
styled to look nearly identical (same 🧭 icon, same headline, same
copy — see `404.html`'s own comment: "same brand, same 'go home' recovery
path"):

| | Static `404.html` (Vercel's filesystem fallback — the SPA never loaded) | SPA's own `#page-404` (`go()`'s fallback for an unrecognized route name) |
|---|---|---|
| Buttons | **One** — "Go to Homepage" | **Two** — "Go to Homepage" *and* "Search" |
| Path debug pill | None | A visible monospace pill showing the exact attempted path/hash (populated by `go()`, see `index.html` ~line 13790) |

All six reported screenshots show exactly one button and no path pill.
**Every occurrence is the static `404.html`** — the request never reached
`index.html`/the SPA router at all in any of these six cases; it was
resolved by Vercel's own filesystem-level 404, bypassing this project's
catch-all rewrite entirely. This is the server-level case, not a
client-side route-matching bug, in every instance captured so far.

## 2. The repo-side routing/caching config has no remaining gap (as of this investigation)

- `vercel.json`'s `rewrites` array is exactly two rules: `/property/:id` →
  the OG-preview function (its own caching bug fixed in PR #189), and a
  catch-all `/(.*)` → `/index.html`. No `redirects` key has ever existed in
  this file's history (`git log -p --all -- vercel.json`, confirmed empty).
- The app produces exactly **8 real top-level clean URLs** —
  `index.html`'s `CLEAN_PATHS` map: `/`, `/listings`, `/analytics`,
  `/about`, `/agents`, `/careers`, `/privacy`, `/terms`. Every other page
  (`dashboard`, `crm`, `hr`, `finance-mgr`, `sites`, 40+ more) is
  deliberately hash-only routing (`#dashboard`, etc.) — a browser never
  sends the fragment to the server, so these can never produce a
  server-level 404 by construction.
- `vercel.json`'s `Cache-Control: public, max-age=0, must-revalidate`
  header-override list — `/(listings|analytics|agents|about|careers|
  privacy|terms)`, added in commit `4a88ff7` ("Fix stale-cache 404s on SPA
  routes") — is in **exact 1:1 correspondence** with those 7 non-home
  `CLEAN_PATHS` entries. Nothing is missing from that list.

**Conclusion: there is no code-level rewrite or cache-header gap left to
patch in this repository, as of the commit this investigation was done
against.**

## 3. This exact symptom has already been "fixed" upstream of here, repeatedly, without permanent resolution

`git log --oneline --all | grep -i 404` shows the branch name
`claude/vercel-404-root-route-qrw92o` reused across **more than 30 merged
PRs** (#85 through #188) all addressing this same class of symptom, plus
the dedicated `staff.` subdomain investigation
(`STAFF_SUBDOMAIN_404_INVESTIGATION.md`) that independently reached the
same conclusion for that one hostname: every repo-resident cause (rewrite
config, missing static files, service-worker scoping, client-side portal
gate logic) was checked and ruled out with direct evidence, and what
remained was exclusively Vercel-dashboard-side state — domain verification
status, or which deployment/environment a domain is actually bound to —
none of which lives in version control.

Given (2) shows the code is currently correct and complete, and the
symptom still recurs on fresh dates against different paths **and now
confirmed on the main `www.` domain, not just `staff.`** — the sheer
repeat-fix count across 30+ PRs is itself strong evidence that another
`vercel.json` edit will not hold. The plausible remaining explanations are
infrastructure-side, and this sandbox has no network path to confirm any
of them directly (`curl https://komisiyoneri.co.rw/...` consistently
returns `CONNECT tunnel failed, response 403`, same limitation the prior
investigation hit):

1. **Domain(s) pinned to an old deployment** rather than tracking
   "Production." If true, this would mean some or all of the 30+ merged
   fixes — including this session's own PR #189 — may never actually be
   live, which alone would fully explain a bug that never permanently goes
   away no matter how many PRs land on `main`.
2. **Stale edge/CDN caching of a 404 response** from before a given
   route/fix existed. Cloudflare DNS is confirmed in front of this domain
   (per the `staff.` investigation); a `must-revalidate` header added going
   forward does not purge a copy that was already cached before it shipped.
3. A **domain verification/binding issue**, as already diagnosed for
   `staff.` in the prior investigation, intermittently affecting
   `www.`/apex too (not necessarily the same root cause as `staff.`'s —
   could be a second, independent instance of the same class of problem).

## 4. Recommendation — dashboard-side, not another code patch

Treat this as the `STAFF_SUBDOMAIN_404_INVESTIGATION.md` decision tree,
widened to cover the main domain as well as `staff.`:

1. **Deployments tab** → confirm every production domain (apex/`www.` AND
   `staff.`) is bound to "Production" tracking `main`, not pinned to a
   specific old deployment.
2. **Settings → Domains** → confirm "Valid Configuration" status for every
   domain, not just `staff.` — the earlier investigation only checked that
   one hostname.
3. **Redeploy without build cache** (Deployments → latest `main` commit →
   "..." → Redeploy, uncheck "Use existing Build Cache") to force a clean
   re-bind of every domain to the current deployment.
4. **Next occurrence: capture the full exact URL**, not a truncated one —
   screenshot 2's `/an...` could be `/analytics` or something else entirely,
   and there's no way to tell from what was captured. If possible, also
   capture the response headers via browser dev tools
   (`x-vercel-cache`, `x-vercel-id`, `cache-control`) — that single piece
   of evidence immediately distinguishes hypothesis 1 (old deployment, no
   `x-vercel-cache` HIT) from hypothesis 2 (edge cache HIT serving a stale
   body) from hypothesis 3 (binding/verification failure, likely a
   different error shape entirely, similar to what `staff.` showed).

## 5. Not recommended

Do not open another PR editing `vercel.json`'s rewrites or headers for this
report without new evidence pointing at a specific code gap — section 2
confirms there isn't one to find right now, and this would just be PR #31
in a series that hasn't resolved the underlying problem. If a *specific*
new clean-path route gets added to `CLEAN_PATHS` in the future, its
matching `Cache-Control` override must be added to `vercel.json` in the
same change (that's the one class of gap this pattern could still
reintroduce) — but that's a "remember to do this" note for future feature
work, not an action item against the current code.
