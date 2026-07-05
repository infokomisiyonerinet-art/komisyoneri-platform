#!/usr/bin/env node
// One-time production data migration: moves any staff performance reviews
// still sitting in the `reviews` collection (subjectType == 'staff',
// written by the old prompt()-based submitStaffReview()) into their own
// `staff_reviews` collection.
//
// Why this has to run: the `reviews` collection also holds public partner
// ratings, and Firestore cannot prove a list/query read is safe when the
// security rule branches on a field (subjectType) that isn't part of the
// query filter — verified against the rules-enabled emulator, this let an
// unrelated authenticated user list another employee's private reviews via
// a plain `.where('staffId','==',...)` query. New code (see index.html)
// already writes new staff reviews to `staff_reviews`, which has a rule
// Firestore CAN prove safe. This script clears out any pre-existing staff
// review docs left behind in `reviews` so that collection's rule can be
// simplified to a plain public read with no ambiguity at all.
//
// MUST run against production BEFORE deploying the simplified `reviews`
// rule in rules/firestore.rules — deploying the rule first (or without
// running this) would make any still-present staff reviews readable by
// anyone.
//
// Usage:
//   GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json \
//     node scripts/migrate-staff-reviews.js --project=<firebase-project-id>
//
// Defaults to a dry run (lists what would move, writes nothing). Pass
// --apply to actually perform the migration.

const admin = require('firebase-admin');

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const projectArg = args.find(function (a) { return a.startsWith('--project='); });
const projectId = projectArg ? projectArg.split('=')[1] : undefined;

admin.initializeApp(projectId ? { projectId: projectId } : {});
const db = admin.firestore();

async function main() {
  console.log('KOMISIYONERI: migrate staff reviews out of `reviews`');
  console.log(apply ? 'Mode: APPLY (will write and delete)' : 'Mode: DRY RUN (pass --apply to actually migrate)');
  console.log('');

  const snap = await db.collection('reviews').where('subjectType', '==', 'staff').get();
  if (snap.empty) {
    console.log('No staff reviews found in `reviews` — nothing to migrate.');
    return;
  }
  console.log('Found ' + snap.size + ' staff review doc(s) to migrate:\n');

  let migrated = 0, skipped = 0, failed = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    const id = doc.id;
    console.log('  - ' + id + '  staffId=' + (data.staffId || '?') + '  period=' + (data.period || '?') + '  rating=' + (data.rating || '?'));

    if (!apply) continue;

    try {
      const destRef = db.collection('staff_reviews').doc(id);
      const destSnap = await destRef.get();
      if (destSnap.exists) {
        console.log('    already migrated, skipping write; removing stale copy from `reviews`');
        await doc.ref.delete();
        skipped++;
        continue;
      }

      const payload = Object.assign({}, data);
      delete payload.subjectType; // no longer needed — staff_reviews is single-purpose

      await db.runTransaction(async function (tx) {
        tx.set(destRef, payload);
        tx.delete(doc.ref);
      });
      migrated++;
    } catch (e) {
      console.error('    FAILED: ' + e.message);
      failed++;
    }
  }

  console.log('');
  if (!apply) {
    console.log('Dry run complete. Re-run with --apply to migrate the ' + snap.size + ' doc(s) above.');
  } else {
    console.log('Migration complete: ' + migrated + ' migrated, ' + skipped + ' already migrated, ' + failed + ' failed.');
    if (failed > 0) process.exitCode = 1;
  }
}

main().catch(function (e) {
  console.error(e);
  process.exitCode = 1;
});
