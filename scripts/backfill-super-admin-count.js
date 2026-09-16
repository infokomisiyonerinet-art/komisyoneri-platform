#!/usr/bin/env node
// One-time backfill for stats/adminCounts.superAdminCount — the counter
// rules/firestore.rules' _isLastSuperAdminDemotion() (P0.5) reads to refuse
// demoting the platform's only remaining super_admin account down to zero.
//
// functions/index.js's onUserSuperAdminCountChange trigger maintains this
// counter going forward on every users/{uid} write, but a brand-new deploy
// has no stats/adminCounts document at all yet — and the rules layer
// deliberately treats a missing doc as "assume exactly 1 super admin"
// (fail-safe: blocks every demotion, never allows one past an uninitialized
// counter). Run this ONCE, right after deploying rules/firestore.rules and
// functions/index.js together, to seed the counter with the TRUE current
// count from the live users collection — everything after that is the
// Cloud Function's job, not this script's.
//
// Same shape as scripts/seed-role-permissions.js / promote-to-super-admin.js
// — dry-run by default (counts and prints what it would write, writes
// nothing), --apply required to actually write. Safe to re-run: it always
// recomputes and sets the exact true count via .set() (not increment), so
// running it twice — or after the Cloud Function has already been
// maintaining the counter for a while — just re-confirms the same value
// (or corrects any drift, e.g. from a period before this trigger was
// deployed).
//
// Usage:
//   GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json \
//     node scripts/backfill-super-admin-count.js --project=<firebase-project-id>
//
// Defaults to a dry run. Pass --apply to actually perform the write.

const admin = require('firebase-admin');

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const projectArg = args.find(function (a) { return a.startsWith('--project='); });
const projectId = projectArg ? projectArg.split('=')[1] : undefined;

admin.initializeApp(projectId ? { projectId: projectId } : {});
const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

// Mirrors superAdminCountDelta()'s own casing tolerance in
// functions/index.js: a plain in-memory .toLowerCase() comparison, not a
// Firestore query 'in' list — reads the whole users collection once
// (acceptable for a one-time backfill; the ongoing Cloud Function trigger
// never does this, it only ever inspects the single document that changed)
// so no casing variant can be missed the way a fixed query list could.
async function countRealSuperAdmins() {
  const snap = await db.collection('users').get();
  let count = 0;
  const matches = [];
  snap.forEach(function (doc) {
    const role = String(doc.data().role || '');
    if (role.toLowerCase() === 'super_admin') {
      count++;
      matches.push(doc.id + ' (role: ' + JSON.stringify(role) + ')');
    }
  });
  return { count: count, matches: matches };
}

async function main() {
  console.log('KOMISIYONERI: backfill stats/adminCounts.superAdminCount');
  console.log(apply ? 'Mode: APPLY (will write to production)' : 'Mode: DRY RUN (pass --apply to actually write)');
  console.log('');

  const existing = await db.collection('stats').doc('adminCounts').get();
  console.log('  Current stats/adminCounts: ' + (existing.exists ? JSON.stringify(existing.data()) : '(does not exist)'));

  const { count, matches } = await countRealSuperAdmins();
  console.log('  Real super_admin accounts found in users collection: ' + count);
  matches.forEach(function (m) { console.log('    - ' + m); });

  if (count === 0) {
    console.error('');
    console.error('ABORTED: found ZERO super_admin accounts. Writing superAdminCount:0 would permanently lock');
    console.error('every future demotion path shut (correctly — but if this is unexpected, the real problem is');
    console.error('that no super_admin account exists yet, not this script. Promote one first, e.g. with');
    console.error('scripts/promote-to-super-admin.js, then re-run this.');
    process.exitCode = 1;
    return;
  }

  console.log('');
  console.log('  Planned write to stats/adminCounts:');
  console.log('    superAdminCount: ' + count);
  console.log('    updatedAt: <server timestamp>');

  if (!apply) {
    console.log('');
    console.log('  Dry run — nothing written. Re-run with --apply to perform this exact write.');
    return;
  }

  await db.collection('stats').doc('adminCounts').set({
    superAdminCount: count,
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });

  console.log('');
  console.log('  APPLIED — stats/adminCounts.superAdminCount = ' + count + '  ✓ confirmed');
}

main().catch(function (e) {
  console.error(e);
  process.exitCode = 1;
});
