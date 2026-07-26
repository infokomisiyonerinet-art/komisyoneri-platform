# Photo Upload System — End-to-End Audit

**Date:** 2026-07-25 (correction added 2026-07-26)
**Branch:** `claude/project-health-scan-v1qqw6`
**Scope:** Investigation only. No code was modified. Re-traces the complete property-listing photo upload pipeline — file picker, validation, compression, Firebase init, Storage bucket, upload task, progress events, download URL, Firestore save, property creation — against the current state of the code, 18 days after `P0_PROPERTY_UPLOAD_ROOT_CAUSE_INVESTIGATION.md` (2026-07-07) and one upload-specific hardening pass (`8094031`, 2026-07-10) that followed it.

## Correction (2026-07-26)

The CORS hypothesis below (originally the leading candidate for the "0%/timeout" symptom) has been **tested live and ruled out**. Unauthenticated HTTP requests against `firebasestorage.googleapis.com` (the exact endpoint the Firebase Storage JS SDK's `ref.put()` talks to — confirmed via this file's own network interceptor, which watches that host specifically) show it returns `Access-Control-Allow-Origin: *` unconditionally, regardless of whatever bucket-level policy `gsutil cors set`/`rules/storage-cors.json` applies. That bucket-level CORS config only governs the raw `storage.googleapis.com` API, which this app's upload code never calls directly. See `UPLOAD_RETRY_FIX_2026-07-26.md` for what was found and fixed instead.

## Bottom line (superseded by the correction above for the CORS claim specifically)

Every layer between selecting a photo and getting a Storage download URL back (steps 1–8 below) is correct in the current code and was already the subject of two prior, targeted hardening passes — there is no remaining code defect in that stretch. Given that, and given that a Storage rules rejection returns a distinct error code almost immediately rather than a 60-second hang with zero progress events, **the single remaining explanation for a genuine "stuck at 0%, then `timeout`" failure is whether `rules/storage-cors.json` has actually been applied to the live GCS bucket** — nothing in this repository's build/deploy path (`package.json`, CI, `firebase.json`) ever runs `gsutil cors set` automatically; it is, and has only ever been, a manual operator action. This cannot be confirmed or ruled out from source code alone.

Separately — a **different** bug, not the "0%/timeout" symptom — the Firestore write-path defect first identified in the 2026-07-07 report (`properties.update` rules allowlist missing `id`, silently rejecting `_savePropToFirestoreFS()`'s ID-stamp write for every non-admin submitter) is **still present and unfixed** in the current code.

---

## Pipeline trace

### 1. File picker — Working
`index.html`, `handleFiles()` (~12721), wired via `pick()` (~12777) and the injected `<input type="file" accept="image/*" multiple>` (~12682). Enforces `MAX_IMAGES=15`.

### 2. Image validation — Working
`handleFiles()` (~12722, ~12734): MIME (`image/*`) and size (`MAX_FILE_BYTES=10MB`) checks before a file is queued. Matches server-side `rules/storage.rules` (`isImage()`, `underSizeLimit(10)`) exactly — no client/server mismatch.

### 3. Compression — Working (hardened)
`compressImage()` (~12597–12643). Resizes to `MAX_DIMENSION=1920`, JPEG quality 0.82. Falls back to the original file on any decode/canvas failure or an 8s internal watchdog (`COMPRESS_TIMEOUT_MS`) — added in commit `ba175eb` (2026-07-04) to kill a prior "hangs at 0% forever" failure mode inside compression itself. Confirmed still present.
Known, separate, lower-severity gap: HEIC files fall back to uploading un-decoded, which may not display for non-Apple viewers — a display issue downstream, not an upload failure.

### 4. Firebase initialization — Working
`index.html` inline `<script>` (~18876–18902). `firebaseConfig` → `firebase.initializeApp()` → `db`, `rtdb`, `storage = firebase.storage()` (~18901) assigned unconditionally and synchronously. Only one `var storage` declaration exists in the entire file (checked via full-file grep) — no shadowing risk. SDK versions (`app`/`auth`/`firestore`/`storage`-compat) are all pinned to `10.7.1`, consistent.

### 5. Firebase Storage bucket — Working, but the one unverifiable link
`storageBucket: "komisyoneri-platform-prod.firebasestorage.app"` (~18887). The generated upload path (`properties/{propId}/{fileName}`) matches `rules/storage.rules`'s `match /properties/{propId}/{fileName}` exactly.
**Cannot verify from source:** `rules/storage-cors.json` declares the correct current origins (`komisiyoneri.co.rw`, `www.`, `staff.`, `partners.`, the Vercel alias, localhost), but there is no `package.json`, CI workflow, or deploy script anywhere in this repo that applies it to the live bucket via `gsutil cors set`. Last edited 2026-07-13 (adding staff./partners. origins) — nothing confirms that edit, or the original policy, was ever actually pushed to GCS. No gsutil/gcloud/network access is available in this sandbox to check the live, applied policy directly.

### 6. Upload task — Working (hardened twice)
`uploadOne()` (~12818–12880) / `uploadAll()` (~12890–12908). `ref.put()` starts the resumable upload; a watchdog (~12839–12850) marks the item `error`/`timeout` and cancels the task if **zero** `state_changed` events fire within `UPLOAD_TIMEOUT_MS`. Confirmed fixes from `8094031` (2026-07-10) still present: timeout raised 45s→60s, and `uploadAll()` rewritten from "start every photo at once" to a concurrency-capped dispatcher (2 at a time) so N photos no longer split one mobile uplink N ways.

### 7. Progress events — Working
`task.on('state_changed', ...)` (~12851–12854) drives the visible `%` bar. **This is the exact mechanism behind "stops at 0%":** if the upload never receives its first `state_changed` event, progress never leaves 0 until the watchdog fires 60s later with `errorCode:'timeout'`. A rules rejection instead fires the *error* callback promptly with a distinct code (e.g. `storage/unauthorized`) — not `timeout`. An observed `timeout` code specifically means the request got no response at all, consistent with the browser silently dropping it (the signature of a CORS failure) rather than a rules or bandwidth problem, both of which are already ruled out by the evidence above.

### 8. Download URL generation — Working
`getDownloadURL()` (~12869), only reached on task success; failures here surface their own distinct error code, not `timeout`.

### 9. Firestore save — BROKEN for every non-admin submitter (confirmed, unfixed since 2026-07-07)
`_savePropToFirestoreFS()` (~33331–33391):
```js
return db.collection('properties').add(fsDoc).then(function(ref) {
  return ref.update({ id: ref.id }).then(function() { return ref.id; });
});
```
The doc creates fine (`rules/firestore.rules` `hasStandardFields()` only checks the 7 standard keys *exist*). The follow-up `.update({id: ref.id})` changes only the `id` key, but `properties.update`'s field allowlist (`rules/firestore.rules` ~181–186) does not include `id` — rejected with `permission-denied` for anyone who isn't admin/staff. `submitProperty()`'s `.catch()` (~33546) calls the same finish function as the success path, so the user sees "✅ Property submitted!" regardless. **This is a real, still-live bug, but it is not the "0%/timeout" symptom** — it happens after the photo has already uploaded successfully.

### 10. Property creation — Working, compounds #9
Cloud Function `onPropertyCreated` (`functions/index.js` ~397, admin SDK, bypasses client rules) fires correctly regardless of #9. Client-side, the admin queue's reconciliation keys off `_fsId`, so a submission whose `.update()` was silently rejected shows up as a second "ghost" entry — a downstream consequence of #9, not an independent defect.

---

## Ranked findings

| # | Issue | File | Symptom | Verifiable from code? | Status |
|---|---|---|---|---|---|
| 1 | Storage CORS policy may never have been applied to the live bucket | `rules/storage-cors.json` (declaration only, no deploy path in-repo) | Upload stuck at 0%, `timeout` after 60s | **No — requires operator check** (`gsutil cors get`) | Unverified since 07-07, still the leading candidate |
| 2 | `properties.update` rules allowlist missing `id`, rejecting the create-flow's ID-stamp write | `index.html` `_savePropToFirestoreFS()` + `rules/firestore.rules` | False "success" message; permanently-blank `id` field; ghost admin-queue entries | **Yes — fully confirmed** | Still unfixed, 18 days later |
| 3 | HEIC photos upload but may not display for non-Apple viewers | `index.html` `compressImage()` | Broken image icon for some viewers | Yes | Unfixed, low severity |

No code was changed as part of this audit. Awaiting direction on whether to (a) request an operator CORS check, (b) fix the `id`-stamp rules collision (the same one-line rewrite proposed in the 2026-07-07 report: pre-allocate `db.collection('properties').doc()` and `.set()` once instead of `.add()` + `.update()`), or both.
