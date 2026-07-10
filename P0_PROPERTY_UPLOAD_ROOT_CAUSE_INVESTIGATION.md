# P0 — Property Upload Root Cause Investigation

**Date:** 2026-07-07
**Branch:** `claude/project-health-scan-v1qqw6`
**Scope:** Investigation only. No code was modified. Traces the complete Property Upload pipeline end to end — creation, edit, photo upload/compression, Firebase Storage, Firestore, Auth, Security Rules, Storage Rules, Cloud Functions, config, validation, error handling — down to a single, git-history-confirmed root cause.

## Bottom line

**Property creation is broken for every non-admin submitter (agents and property owners — the entire self-service "list your property" audience) because of a one-day-old collision between two otherwise-correct commits in this repo.** On 2026-07-04, a fix for a different bug (uploads hanging at 0% forever) restructured property creation into a two-step Firestore write: create the document, then immediately update it to stamp its own ID into an `id` field. On 2026-07-05, a *separate*, independently-correct security fix tightened the Firestore rule governing who can update a property document and with which fields — but the new field allowlist does not include `id`. The second write in the two-step sequence has been rejected by Firestore Security Rules with `permission-denied` for every non-admin user ever since, and the code silently swallows that rejection and shows the user a **success** message regardless. Photos really do upload; the Firestore document really does get created; but every affected submission is left with a permanently-blank internal `id` field and a client-side bookkeeping gap that produces duplicate/ghost entries in the admin review queue.

This is not a Storage problem, not a compression problem, not an authentication problem, and not a CORS/network problem — all of those layers were checked and are functioning correctly. It is a single, precise, two-file rules/write-pattern mismatch.

---

## Complete pipeline trace

```
Select Images → Preview → Validation → Compression → Storage Upload → Download URL → Firestore Document Creation → Property Save → Property Display
     OK             OK         OK           OK             OK              OK          ⛔ BREAKS HERE (non-admins)      —              OK (self-healing on read)
```

Every stage up to and including "Download URL" was traced and verified working correctly. The pipeline breaks at **Firestore Document Creation** — specifically at a *second*, unnecessary write that happens immediately after the document is successfully created.

---

## Issues found, ranked Critical → Low

### CRITICAL #1 — The actual root cause: `properties.update` rules don't allow the field the create-flow needs to write

- **File:** `index.html`
- **Function:** `_savePropToFirestoreFS()` (~line 30200), called from `submitProperty()` (~line 30403)
- **Interacts with:** `rules/firestore.rules`, `match /properties/{id}` → `allow update` (~line 107-112)

**Root cause.** `_savePropToFirestoreFS()` creates the property with an auto-generated ID:
```js
return db.collection('properties').add(fsDoc).then(function(ref) {
  return ref.update({ id: ref.id }).then(function() { return ref.id; });
});
```
`fsDoc.id` starts as `''` (line 30207) because the real ID isn't known until after `.add()` returns; the follow-up `.update({id: ref.id})` is meant to stamp it in. But `rules/firestore.rules`'s `properties.update` rule is:
```
allow update: if isAdminOrStaff()
              || ((resource.data.agentId == request.auth.uid || resource.data.ownerId == request.auth.uid)
                  && request.resource.data.diff(resource.data).affectedKeys()
                     .hasOnly(['type','category','district','sector','price','bedrooms',
                               'bathrooms','area','description','title','amenities',
                               'images','updatedAt','updatedBy']));
```
`'id'` is not in this allowlist. The update changes *only* `id`, so `diff().affectedKeys()` = `{'id'}`, and `hasOnly([...])` evaluates to `false`. For a regular agent or property owner (not `isAdminOrStaff()`), **both** OR-branches of the rule are false, so Firestore rejects the write with `permission-denied`.

**Why it fails silently.** In `submitProperty()`:
```js
return _savePropToFirestoreFS(pd, isAdmin ? 'approved' : 'pending', currentUser.uid, isAdmin)
  .then(function(fsId) { if (fsId) pd._fsId = fsId; logAudit(...); _propSubmitFinish(pd, isAdmin); })
  .catch(function() { _propSubmitFinish(pd, isAdmin); });   // ← swallows the permission-denied rejection
```
The `.catch()` calls the exact same success-path function (`_propSubmitFinish`) that the `.then()` calls — there is no functional difference between "it worked" and "the Firestore write was rejected" from the user's point of view. No `console.error`, no error toast, nothing. The user sees "✅ Property submitted! We'll review it within 24 hours" every time, even though the ID-stamp write failed.

**When this started (git-confirmed).**
- **2026-07-04, commit `ba175eb`** ("fix: property image uploads silently hang at 0% forever with no error") introduced `_savePropToFirestoreFS()`'s two-step `.add()` + `.update({id: ref.id})` pattern. At that point, `properties.update` had no field restriction at all (`allow update: if isAdminOrStaff() || resource.data.agentId == uid || resource.data.ownerId == uid` — no `hasOnly` clause), so the ID-stamp update worked fine for everyone.
- **2026-07-05, commit `c4c8d8b`** ("fix: close self-role-escalation and self-approval gaps in Firestore rules") added the field allowlist to `properties.update` — a genuinely necessary fix in isolation (before it, an agent could rewrite their own listing's `status`, `verified`, or `approvedBy` field and self-approve). This commit had no way to know about the `ref.update({id: ref.id})` call added the day before in a different file, and didn't include `id` in the new allowlist.
- **Net effect:** two independently-correct commits, one day apart, in two different files, combined into a regression that has been live since 2026-07-05.

**Reproduces:** 100% of the time, for every agent/property-owner submission (the entire non-admin listing flow — this is the primary use case the "Pending → admin review" workflow exists for). Does **not** reproduce for admin/staff submissions (`isAdminOrStaff()` bypasses the field check entirely), which is likely why this wasn't caught immediately — anyone testing as an admin account would see it work.

**Severity: CRITICAL.**

**Exact fix (not implemented — investigation only):** Eliminate the second write entirely. Pre-allocate the document reference and set the real ID in the *same* initial write:
```js
var ref = db.collection('properties').doc();     // ID known immediately, no round-trip needed
fsDoc.id = ref.id;
return ref.set(fsDoc).then(function() { return ref.id; });
```
This is the same pattern already used correctly elsewhere in this codebase (e.g. `functions/index.js`'s `notifyUser()`/`logAudit()` helpers: `db.collection('x').doc()` → `.set({id: ref.id, ...})` in one write). It removes the network round-trip, removes the rules collision, and makes `id` correct from the instant the document exists — no rules change required. (If the two-step pattern must be kept for some reason, the alternative is adding `'id'` to the `properties.update` allowlist in `rules/firestore.rules`, but that re-opens a narrow surface the 07-05 commit was specifically trying to close and is the less clean option.)

---

### CRITICAL #2 — Compounding effect: silent failure produces duplicate/ghost listings in the admin queue

- **File:** `index.html`
- **Functions:** `adminRender()` (~line 30423), `_fsAdminApprove()` (~line 30531)

**Root cause.** Because the Critical #1 rejection happens, `submitProperty()`'s `.then(function(fsId){ if (fsId) pd._fsId = fsId; ... })` branch never runs — it goes straight to `.catch()`. `pd._fsId` is therefore `undefined` when `_propSubmitFinish()` pushes it into `localStorage.km_properties`.

`adminRender()`'s reconciliation logic:
```js
var fsPropFsIds = {};
fsProps.forEach(function(p) { if (p._fsId) fsPropFsIds[p._fsId] = true; });
var lsOnly = lsProps.filter(function(p) { return !p._fsId || !fsPropFsIds[p._fsId]; });
_adminAllProps = fsProps.concat(lsOnly.map(...));
```
An `_fsId`-less localStorage entry *always* passes the `!p._fsId` check, so it's treated as a distinct "local-only, not yet synced" listing and concatenated alongside the real Firestore-backed copy the same query already fetched. **The same submission appears twice** in the admin's pending queue.

**Why it matters.** If an admin approves the *phantom* copy specifically, `_fsAdminApprove()`'s `else` branch (triggered when `fsId` is falsy) calls `_savePropToFirestoreFS()` again — creating a second, genuinely duplicate Firestore document for one real submission.

**Severity: Critical** (data integrity / admin workflow), but this is a *consequence* of #1, not an independent defect — it resolves automatically once #1 is fixed (no separate fix needed).

---

### HIGH #3 — Every affected property document has a permanently-blank `id` field

- **File:** `index.html`, `_savePropToFirestoreFS()` (~line 30207)

**Root cause.** Same as #1 — `fsDoc.id` starts as `''` and the correcting update never lands.

**Why it matters.** Confirmed by direct code inspection that most *read* paths self-heal this: `_normalizePropDoc(data, docId)` (~line 29583) always sets `id: docId` from the real Firestore document ID, ignoring the broken internal field — so `openMyProps()`, `loadApprovedProperties()`, and similar consumers aren't visibly broken today. But `adminRender()` does **not** normalize (`d._fsId = doc.id;` is added, but `d.id` itself is left as `''`), and at least one function keys directly off the raw field: `adminDeleteAll()`'s localStorage cleanup matches on `String(p.id||'')`. This is a live data-integrity defect that is currently mostly masked by defensive read-time overrides elsewhere, not evidence that it's harmless — a future feature that queries/matches by `id` (the field) instead of the document ID will silently fail to find these documents.

**Severity: High.**

**Exact fix:** Resolves automatically with the #1 fix (`id` becomes correct at creation time; no document is ever written with a blank `id` going forward). Existing already-affected documents in production would need a one-time backfill (`update({id: docId})` per document, run with admin/staff credentials so the rules gate doesn't apply) — a data-repair step, separate from the code fix.

---

### HIGH #4 — Edit-mode Firestore update failures are completely silent (latent, not currently reproducing)

- **File:** `index.html`, `submitProperty()` edit-mode branch (~line 30342-30372)

**Root cause.** The edit-mode Firestore update:
```js
db.collection('properties').doc(u._fsId).update({
  type:u.type, category:..., district:..., sector:..., price:..., bedrooms:..., bathrooms:...,
  area:..., description:..., title:..., amenities:..., images:urls,
  updatedAt:..., updatedBy:currentUser.uid
}).catch(function(){});   // ← empty catch, discards everything
```
This field list (`type, category, district, sector, price, bedrooms, bathrooms, area, description, title, amenities, images, updatedAt, updatedBy`) was checked field-by-field against the current rules allowlist and **matches exactly** — this specific call does not reproduce the #1 bug today. But its `.catch(function(){})` is a bare no-op: any rejection for any reason (a future rules change, a deleted document, a transient network error) is discarded with zero logging and zero user feedback, and execution continues unconditionally to `setBusy(false); closeAddProperty(); showToast('✅ Listing updated!...')`.

**Severity: High** — not a currently-active bug, but it is the exact same silent-failure pattern that made #1 invisible for two days, sitting dormant and ready to mask the next regression the same way.

**Exact fix:** Replace the empty `.catch(function(){})` with the same error-surfacing pattern already used for the photo-upload failure path (`showUploadError`) — log `err.code`/`err.message` to console and show a real error toast instead of a blanket success message.

---

### MEDIUM #5 — HEIC photos (iPhone camera format) upload successfully but may not display

- **File:** `index.html`, `PropImageUploader.compressImage()` (~line 11242-11288)

**Root cause.** `compressImage()` correctly falls back to uploading the original, uncompressed file when the browser can't decode an image via `Image()`/canvas (`img.onerror` handler, line 11285) — this is a deliberate, already-good defensive fallback, not a bug in itself. HEIC (the default format for many iPhone cameras) is one such format: most non-Apple/non-WebKit rendering contexts cannot decode it via `Image()`. The *upload* still succeeds (Storage rules accept any `image/.*` contentType), but the resulting HEIC file, once rendered via a normal `<img>` tag on the listings/detail pages for visitors on Android/Chrome (the majority of this audience per the app's own analytics targets), will show as a broken image.

**Severity: Medium** — real, but narrower in scope than #1 (affects a subset of iPhone submitters whose camera format setting is HEIC rather than "Most Compatible"/JPEG), and the symptom is "photo doesn't display for other users," not "upload fails" for the submitter.

**Exact fix:** Detect `file.type === 'image/heic'`/`'image/heif'` and either convert to JPEG client-side via a small HEIC-decode library before the existing compress/upload path, or block HEIC client-side with a clear message asking the user to switch their camera's format — do not silently upload a file most viewers can't render.

---

### LOW #6 — Storage bucket CORS configuration cannot be verified as actually deployed

- **File:** `rules/storage-cors.json`

**Root cause.** This file is a declaration of intent for `gsutil cors set gs://<bucket> rules/storage-cors.json`. Nothing in this repository (no CI/CD step, no deploy script, no `package.json` script) actually applies it to the live Google Cloud Storage bucket — it must be run manually, once, by whoever has `gsutil`/GCP console access. If it was never applied, or was edited since it was last applied, browser-initiated uploads from the production origin would fail with a CORS error (network status `0`) — precisely the failure signature `PropImageUploader`'s own `_dumpStorageNetworkEvidence()` diagnostic (line 11216) was built to detect and distinguish from a rules rejection.

**Severity: Low / unverifiable from source** — flagged as a required *external* check (`gsutil cors get gs://komisyoneri-platform-prod.firebasestorage.app`, or the equivalent GCP Console page) rather than a confirmed defect. The Critical #1 finding is fully code-verified and already explains the reported symptom without this needing to also be true, but it costs nothing to rule out operationally.

---

### LOW #7 (ruled out) — File size / MIME-type limits are consistent client ↔ server

Checked and confirmed matching exactly: client-side `MAX_FILE_BYTES = 10MB` (`PropImageUploader`, line 11197) ↔ Storage rule `underSizeLimit(10)` (`rules/storage.rules`); client-side `image/*` MIME gate (`handleFiles()`, line 11367) ↔ Storage rule `isImage()` regex `image/.*`. No mismatch. Not a contributing factor.

### LOW #8 (ruled out / already hardened) — Compression timeouts, upload watchdogs, and Storage rules permissions

- `compressImage()` has an 8-second timeout guaranteeing forward progress even if image decode hangs.
- `uploadAll()` has a 45-second watchdog guaranteeing the UI can't spin forever silently, plus the `_dumpStorageNetworkEvidence()` correlator that inspects real intercepted network traffic to distinguish a CORS failure (status 0) from a rules rejection (403) from a genuine timeout.
- `rules/storage.rules`'s `properties/{propId}/{fileName}` write rule (`isAuth() && isImage() && underSizeLimit(10)`) imposes no ownership restriction, so it is *more* permissive than needed, not a blocker.
- **All of this was already hardened by an earlier session** (commit `ba175eb`, 2026-07-04) targeting a *different*, previously-reported upload bug ("hangs at 0% forever"). This investigation found no evidence that the photo-upload/compression/Storage layer is implicated in the current failure — the pipeline gets all the way to a valid download URL successfully. The break is at the Firestore write immediately after.

---

## Ranked summary

| Rank | Issue | File | Reproduces | Severity |
|---|---|---|---|---|
| 1 | `properties.update` rules allowlist missing `id`, rejecting the create-flow's ID-stamp write | `index.html` (`_savePropToFirestoreFS`) + `rules/firestore.rules` | 100% of non-admin submissions | **Critical** |
| 2 | Ghost/duplicate admin-queue entries from the resulting unset `_fsId` | `index.html` (`adminRender`, `_fsAdminApprove`) | Every affected submission | **Critical** |
| 3 | Permanently-blank `id` field on affected Firestore documents | `index.html` (`_savePropToFirestoreFS`) | Every affected submission | High |
| 4 | Edit-mode Firestore failures are silently discarded (latent) | `index.html` (`submitProperty` edit branch) | Not currently, but zero visibility if it does | High |
| 5 | HEIC photos upload but may not display for other users | `index.html` (`PropImageUploader.compressImage`) | Subset of iPhone submitters | Medium |
| 6 | Storage CORS deployment status unverifiable from source | `rules/storage-cors.json` | Unknown — external check needed | Low |
| 7 | File size/MIME limits | — | Ruled out, consistent | — |
| 8 | Compression/upload robustness, Storage rules permissiveness | — | Ruled out, already hardened | — |

---

## One final repair plan (not implemented — for approval before any code changes)

1. **Fix the root cause (#1):** In `_savePropToFirestoreFS()`, replace `db.collection('properties').add(fsDoc)` + follow-up `ref.update({id: ref.id})` with a single atomic write: pre-allocate `db.collection('properties').doc()`, set `fsDoc.id = ref.id` before writing, and call `ref.set(fsDoc)` once. No rules change needed. This alone resolves #1, #2, and #3.
2. **Backfill already-affected production documents:** a one-time admin-run script/console action to set `id` = document ID on every existing `properties` document where `id === ''`, using admin credentials (bypasses the rules gate that's blocking users from doing this themselves).
3. **Harden the edit-mode catch (#4):** replace the empty `.catch(function(){})` on the edit-mode Firestore update with real error logging and a user-facing error toast, matching the existing `showUploadError()` pattern already used for photo-upload failures.
4. **Handle HEIC uploads (#5):** either convert HEIC → JPEG client-side before compression, or block HEIC client-side with a clear, actionable message.
5. **Operationally verify CORS (#6):** confirm (outside this codebase, via `gsutil`/GCP Console) that `rules/storage-cors.json` has actually been applied to the live `komisyoneri-platform-prod.firebasestorage.app` bucket, and re-apply if not or if it's stale.
6. **Process guard against recurrence:** the #1/#2 timeline shows the actual failure mode here — a rules change and a client write-path change, each correct in isolation, landing one day apart with no cross-check. Before merging a Firestore rules change, grep the client code for every `.update(`/`.set(` call against the affected collection and confirm each one's field list is still covered by the new rule, and vice versa.

No code has been changed as part of this investigation. Awaiting direction on which of the above to implement.
