# Firestore Rules / Indexes / Functions Deploy Runbook

## Why this doc exists

Claude Code sessions working on this repo run in a sandbox with no network
path to `firebase.google.com` / `firestore.googleapis.com` and no Firebase
CLI credentials — confirmed repeatedly across multiple sessions (see
`FINAL_LAUNCH_READINESS_AUDIT.md`, `SYSTEM_HEALTH_REPORT.md`,
`SECURITY_FIXES_REPORT.md`). Those sessions can edit `rules/firestore.rules`,
`firestore.indexes.json`, and `functions/index.js` and reason carefully about
correctness, but **cannot deploy any of it**. Every one of those reports ends
with a "you still need to run `firebase deploy`" note. This doc replaces
repeating that note — it's the one place to look for the actual commands and
what to check before/after running them.

Project: **`komisyoneri-platform-prod`** (see `index.html`'s `firebaseConfig`).

## Prerequisites

- Firebase CLI installed (`npm install -g firebase-tools`, or `npx
  firebase-tools`) and logged in with an account that has **Editor** or
  **Owner** on `komisyoneri-platform-prod`:
  ```bash
  firebase login
  firebase use komisyoneri-platform-prod
  ```
- Run this from the repo root (`firebase.json` lives here and points at
  `rules/firestore.rules`, `firestore.indexes.json`, `rules/storage.rules`,
  and the `functions/` directory).

## Deploy

```bash
# Rules + indexes together (safe to run anytime — additive changes only,
# see "What's safe" below)
firebase deploy --only firestore:rules,firestore:indexes

# Cloud Functions (only needed if functions/index.js changed since the last
# functions deploy — check `git log functions/index.js` if unsure)
firebase deploy --only functions
```

Deploying rules and indexes separately also works if you want to stage them:
`firebase deploy --only firestore:rules` / `firebase deploy --only firestore:indexes`.

## What to expect after deploying

- **Rules take effect immediately.**
- **Indexes do not.** The Firebase console (Firestore → Indexes) will show
  each new composite index as "Building" — this can take anywhere from a
  couple of minutes to much longer on large collections. Any query that
  needs a still-building index fails with `FirebaseError: The query requires
  an index` until it finishes. Nothing in this codebase currently surfaces
  that error to end users (most `.catch()` handlers log a console warning
  and degrade quietly) — so expect some sections (e.g. the homepage's
  per-type rotation, Branches/Expenses/Leaves/Payroll/Sites-Plots lists) to
  look emptier than they should for a few minutes after deploying, not
  broken.
- **Functions redeploy can take a few minutes per function** and will show
  build logs in the CLI output. Watch for `onUserStatsRelevantChange`,
  `onPropertyStatsRelevantChange`, `updateHomepageStats`, and
  `onDealClosedWon` specifically — those are the ones recent sessions have
  touched.

## Verify after deploying

1. **Firebase console → Firestore → Indexes**: confirm all indexes listed in
   `firestore.indexes.json` show `Enabled`, not `Building` or `Error`.
2. **Firebase console → Firestore → Rules**: confirm the deployed rules
   timestamp matches your deploy, and spot-check the `users/{uid}` rule
   includes the verified-agent public-read carve-out (search for
   `isVerified` in the deployed rules source shown in the console).
3. **Rules test suite** (optional but recommended — this repo has one and no
   sandbox session has been able to run it):
   ```bash
   cd tests/rules
   npm install
   npm test
   ```
   Fails loudly if a rule change broke something the suite already covers.
4. **Live smoke test** on the deployed site (komisiyoneri.co.rw or the
   current Vercel preview):
   - Homepage loads with real (not demo) property cards in each type slot,
     assuming approved listings exist for that type.
   - "Listed Properties" / "Verified Agents" hero stats show non-zero
     numbers if approved properties / verified agents actually exist.
   - Log out (or open an incognito window) and confirm the public Agents
     directory page still shows real verified agents, not just demo ones.
5. **Cloud Functions logs** (Firebase console → Functions → Logs, or `firebase
   functions:log`): after a deal is manually moved to `closed_won` in the
   CRM, confirm `onDealClosedWon` ran and check for the `soldAt` field on
   that deal's linked property document.

## What's safe to deploy without extra caution

All rules changes made by recent sessions are **additive-only** — they widen
what's publicly readable in narrow, specific ways (verified-agent profiles,
already-public collections) and never remove or loosen a write permission.
None of them touch `create`/`update`/`delete` rules. Index additions are
always safe (an index Firestore doesn't need yet just costs a small amount of
storage/write overhead, never breaks a query). There is no rollback risk
specific to these changes beyond the normal "did I deploy the file I think I
deployed" — `firebase deploy --only firestore:rules` always deploys the
*entire* `rules/firestore.rules` file, not a diff, so double-check you're on
the branch/commit you intend before running it.
