# Fix: Google Sign-In `origin_mismatch` (Google Cloud Console)

**Status:** Pending — requires a human operator with Google Cloud Console
access to this project. No code change in this repository can fix it.

## Symptom

Google Sign-In fails for every visitor, on every environment. The app
surfaces it as a generic error toast ("Google Sign-In is unavailable right
now") and the browser console shows:

```
[AUTH] error.code      = auth/internal-error
```

This is misleading — `auth/internal-error` is Firebase's catch-all wrapper.
The Firebase Auth SDK has no specific error code for Google's own
`origin_mismatch` rejection, so it falls back to the generic one. The real
cause only shows up in the raw network response, which `_handleGoogleAuthError()`
(`index.html`, ~line 15531) already logs and correlates for exactly this
reason — check the browser console's `[NET]`/`[AUTH]` log group for the
actual HTTP response body from `accounts.google.com` when reproducing this.

## Root cause

The OAuth 2.0 Web Client that Firebase's Google sign-in provider uses does
not have this app's domains listed under **Authorized JavaScript origins**
in Google Cloud Console. This was first confirmed on **2026-07-04** (see
`KOMISIYONERI_MASTER_CONTEXT.md`, Roadmap → Phase 1, and the investigation
history on branch `claude/vercel-404-root-route-qrw92o`) and is still
unresolved.

## Fix (operator with Google Cloud Console access)

1. **Confirm which OAuth client Firebase is using.**
   Firebase Console → this project (`komisyoneri-platform-prod`) →
   **Authentication → Sign-in method → Google → Web SDK configuration**.
   Note the **Web client ID** shown there — that's the exact client you
   need to edit in step 2 (there may be more than one OAuth client in the
   Cloud project; editing the wrong one won't fix anything).

2. **Open Google Cloud Console → APIs & Services → Credentials**, for the
   same GCP project. Click the OAuth 2.0 Client ID matching the one from
   step 1.

3. **Add every origin this app is actually served from** under
   **Authorized JavaScript origins**:
   - `https://komisiyoneri.co.rw` — live production domain
   - `https://www.komisiyoneri.co.rw` — if the `www` host is also served
     (confirm against current DNS/Vercel domain config; don't add it
     speculatively if it 404s or redirects)
   - `https://komisyoneri-platform-prod.firebaseapp.com` — this project's
     Firebase Auth domain (`authDomain` in `index.html`'s Firebase config,
     ~line 18884); `signInWithPopup`/`signInWithRedirect` both bounce
     through this domain's `/__/auth/handler`, so it must be authorized
     even though users never see it directly
   - `https://komisyoneri-platform-nu.vercel.app` — the Vercel
     preview/staging alias already referenced in
     `KOMISIYONERI_MASTER_CONTEXT.md`'s Hosting section

   **Note on ad-hoc Vercel preview deployments:** every PR/branch preview
   Vercel creates gets its own unique, unpredictable subdomain (e.g.
   `komisyoneri-platform-git-<branch>-<team>.vercel.app`). Google Cloud
   Console does not support wildcard origins, so those one-off preview
   URLs will keep hitting this same `origin_mismatch` no matter what —
   that's expected, not a regression. Test Google Sign-In against the
   stable alias above (or production) rather than a per-PR preview URL.

4. **Save.** Google's docs note propagation can take anywhere from a few
   minutes to a few hours — don't conclude the fix didn't work from an
   immediate retry.

5. **Verify** in an incognito window against `https://komisiyoneri.co.rw`:
   click "Continue with Google" and confirm the popup (or redirect, on
   mobile) completes without `auth/internal-error`. Check the console log
   group `_handleGoogleAuthError()` prints on failure — if it still fires,
   capture the full log output (it includes the raw HTTP response) for
   further diagnosis, since a persisting failure at that point would be a
   different underlying cause, not this one.

## Why this can't be fixed from this repository

This is entirely Google Cloud Console configuration external to the
codebase — there is no config file, environment variable, or API call this
repo can make to add an authorized origin. The Firebase Web SDK config in
`index.html` (the `apiKey`/`authDomain`/`projectId` block, ~line 18879) is
already correct and does not need to change; the gap is purely on the
Google Cloud side of the OAuth client tied to that Firebase project.
