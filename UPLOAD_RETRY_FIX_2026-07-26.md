# Property Photo Upload — Retry Gap Found and Fixed

**Date:** 2026-07-26
**Branch:** `claude/project-health-scan-v1qqw6`
**Scope:** Smallest possible fix, not a redesign. One function (`PropImageUploader`) in `index.html`.

## What was ruled out first

Per the correction in `PHOTO_UPLOAD_SYSTEM_AUDIT_2026-07-25.md`: Storage bucket CORS is **not** the cause of "0%, then timeout" — confirmed via live, unauthenticated HTTP requests against `firebasestorage.googleapis.com` (the exact host the app's upload code talks to), which returns `Access-Control-Allow-Origin: *` unconditionally regardless of any `gsutil cors`-applied bucket policy. That policy only governs the separate raw GCS API, which this app never calls.

## Re-tracing the pipeline (image selection → Firestore save) for the real gap

Every layer already carried logging on its **failure** paths (`console.error` with `err.code`/`err.message`, plus `_dumpStorageNetworkEvidence()` correlating against raw network traffic). What was missing was any trace of the **start** of an attempt, and — the actual gap — any recovery once a timeout happened.

`PropImageUploader.uploadOne()` (`index.html`, was ~line 12818): once the per-item 60-second watchdog fired with zero `state_changed` events, the item was marked `error`/`timeout` and **that was final** — no retry, ever. Two concrete consequences, both confirmed by code inspection:

1. **A single transient network blip permanently fails that photo.** A `timeout` specifically means the request got no response at all (ruled out as a rules rejection, which returns a distinct code almost immediately) — exactly the kind of thing a flaky mobile connection produces once and then works fine on the next attempt. There was no mechanism to find out, because nothing ever tried again.
2. **`uploadOne()` had no check for an item already `status === 'done'`.** If the user resubmitted the form after one sibling photo failed, every already-successful photo got silently re-uploaded from scratch alongside the retry of the failed one — wasting bandwidth and time on a connection that's already marginal, making a second timeout on the resubmit itself more likely, not less.

Firebase init, `storageBucket`, the Storage-rules match, the Promise chain in `compressImage()`→`ref.put()`→`getDownloadURL()`, and the Firestore save step were all re-inspected and found unchanged from the 2026-07-25 audit — correct, no defect found there.

## The fix (smallest possible; no redesign)

`index.html`, `PropImageUploader` module:

- Split the existing upload body into `_attemptUpload(it, idx, pathPrefix, attemptNum)` (identical logic, unchanged) plus two added `console.log` lines: one right before `ref.put()` (path, current auth uid, file size — the one previously-unlogged fact needed to rule out a hung token refresh as the cause of a given timeout) and one on success (previously only failures were logged).
- `uploadOne()` is now a thin wrapper: skip re-uploading if `it.status === 'done' && it.url` (new); call `_attemptUpload` once; on a rejection with `err.code === 'timeout'` specifically, retry exactly once more before giving up for real. Any other error code (e.g. a genuine `storage/unauthorized`) is not retried, since retrying a permission rejection just repeats a guaranteed failure.
- `uploadAll()`'s concurrency dispatcher and result ordering are untouched.

## Verification

Full-file syntax check (`new Function()` over every inline `<script>`): 29 blocks, 0 errors.

Playwright, driving the real DOM (`page.setInputFiles()` on the real injected `<input>`, not a simulated internal call), 3 scenarios:
1. First attempt times out, retry succeeds → item ends `status:'done'` with the correct URL; log shows exactly 2 attempts with the retry logged in between.
2. Resubmitting the form after a photo already succeeded does not call `storage.ref(...).put()` again for that photo (`putsAfterFirstSubmit: 1`, `putsAfterResubmit: 1`).
3. A `storage/unauthorized`-style rejection is not retried (`putCalls: 1`).

This does not guarantee zero timeouts on a sufficiently bad connection — no client-side code can force a network to work — but it gives a single transient failure one automatic chance to recover, and stops a resubmit from re-paying the cost (and re-rolling the risk) of already-successful uploads.
