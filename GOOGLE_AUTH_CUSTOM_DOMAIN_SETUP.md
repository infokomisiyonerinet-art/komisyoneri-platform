# Google Sign-In Custom Auth Domain — Setup Runbook

## Why this doc exists

`firebaseConfig.authDomain` (set in both `index.html` and
`js/portal-login.js`) now points at `auth.komisiyoneri.co.rw` instead of
the default `komisyoneri-platform-prod.firebaseapp.com`. That's a pure
code change — it does **not** make the custom domain work on its own.
Firebase Auth's popup/redirect flow (`signInWithPopup`,
`signInWithRedirect`, `getRedirectResult` — see `handleGoogleSignInClick()`
in `index.html`) needs `auth.komisiyoneri.co.rw` to actually resolve to
Firebase's auth handler and be verified/authorized before any of this
works. None of the steps below can be done from this codebase or from a
sandboxed session with no DNS/Firebase Console/Google Cloud Console
access — they're all manual, human, console-side actions.

**Until every step below is complete, Google Sign-In will be broken in
production** (typically `auth/unauthorized-domain`, or a DNS/TLS failure
before Firebase even returns an error code) — the code was pointed at a
hostname that doesn't do anything yet. This is expected, not a regression
to chase in the codebase.

## What you need to do, in order

### a) DNS — Cloudflare

Add a CNAME record for `auth.komisiyoneri.co.rw`. The exact target is
whatever Firebase's own custom-domain wizard gives you in step (c) below
— don't guess `ghs.googlehosted.com` ahead of time, Firebase's wizard
tells you the precise value for your project and may include a second
TXT record for ownership verification. In Cloudflare:
- DNS → Add record → Type: `CNAME`, Name: `auth`, Target: (value from
  Firebase's wizard), Proxy status: **DNS only** (grey cloud, not
  orange/proxied — Firebase's auth handler needs to terminate TLS itself
  and see the real request; Cloudflare's proxy in front of it will break
  the auth handshake).

### b) Firebase Console — Authorized domains

Firebase Console → your project (`komisyoneri-platform-prod`) →
Authentication → Settings → Authorized domains → confirm
`auth.komisiyoneri.co.rw` is listed (adding a custom domain via step (c)
adds it here automatically, but double-check it's actually present and
not stuck in a pending state).

### c) Firebase Console — Custom auth domain verification

Firebase Console → Authentication → Settings → Authorized domains → **Add
custom domain** → enter `auth.komisiyoneri.co.rw` → follow the wizard.
This is what actually gives you the exact CNAME/TXT target for step (a) —
do this step first if you haven't already, then come back to (a) with the
real values. Verification can take anywhere from a few minutes to a few
hours to propagate once DNS is live; Firebase Console shows the domain's
status (Pending / Verified) — don't consider this done until it shows
Verified.

### d) Google Cloud Console — OAuth consent screen app name

Separate from Firebase entirely, and not fixable via code or the Firebase
Console: Google Cloud Console → select the same underlying GCP project →
APIs & Services → OAuth consent screen → edit the **App name** field so
it reads "KOMISIYONERI" (or whatever exact name is wanted) instead of
whatever default/old name is currently set. This is what actually shows
on the Google consent screen itself ("­­­­komisiyoneri.co.rw wants to
access your Google Account" vs. some other app name) — it's a Google
Cloud project setting, unrelated to the `authDomain` change and unrelated
to Firebase's own console.

## Verify after completing all four steps

1. Firebase Console → Authentication → Settings → Authorized domains:
   `auth.komisiyoneri.co.rw` shows, status Verified.
2. Visit the live site, tap "Continue with Google" (desktop → popup
   flow; a mobile UA or a blocked-popup desktop browser → redirect flow,
   see `handleGoogleSignInClick()`'s isMobileUA branch) and confirm the
   browser's address bar during the OAuth flow shows
   `auth.komisiyoneri.co.rw` (or `accounts.google.com`, which is
   expected and unrelated), never
   `komisyoneri-platform-prod.firebaseapp.com`.
3. Confirm the Google consent screen itself shows the intended app name
   from step (d).
4. If it still fails, check the browser console for `[AUTH]` logs —
   `_handleGoogleAuthError()` in `index.html` prints the raw Firebase
   error code/message and cross-references `window.__cspViolations` for
   the specific "CSP blocked the auth iframe" failure mode this exact
   domain change is sensitive to (see that function's
   `auth/internal-error` branch for the full explanation — this already
   happened once in production against the old domain, for a different
   reason, and left detailed logging specifically so it's diagnosable
   from the console next time too).
