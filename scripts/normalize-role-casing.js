#!/usr/bin/env node
// One-time production data migration: normalizes any `users/{uid}.role`
// value that isn't already all-lowercase (e.g. legacy 'Agent', 'Client',
// 'Owner' docs) to lowercase.
//
// Why this has to run: current code always writes lowercase role values
// (see index.html's _mapAuthRoleTabToCanonRole(), submitAgentReg(), and
// functions/index.js's createStaffOrPartnerAccount — none of them write a
// capitalized role today). But rules/firestore.rules' isRole()/getRole()
// call .lower() on every comparison, and functions/index.js's
// updateHomepageStats defensively queries `role in ['agent','Agent']` /
// `role in ['client','Client']` — code doesn't defensively guard against a
// case that can't happen, so this is strong evidence that legacy documents
// with capitalized role values still exist in production from before role
// values were consistently normalized. Confirmed as a real, still-open
// finding in the 2026-07-26 Firestore audit — this script was not able to
// directly confirm the live data itself (no DB credentials in that
// session), so treat the dry-run output as the actual confirmation step.
//
// This only touches `role`. It intentionally does not touch `status` or
// any other field — those weren't part of the audited finding, and
// widening scope here risks changing something nobody asked to change.
//
// Usage:
//   GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json \
//     node scripts/normalize-role-casing.js --project=<firebase-project-id>
//
// Defaults to a dry run (lists what would change, writes nothing). Pass
// --apply to actually perform the migration.

const admin = require('firebase-admin');

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const projectArg = args.find(function (a) { return a.startsWith('--project='); });
const projectId = projectArg ? projectArg.split('=')[1] : undefined;

admin.initializeApp(projectId ? { projectId: projectId } : {});
const db = admin.firestore();

async function main() {
  console.log('KOMISIYONERI: normalize users/{uid}.role casing to lowercase');
  console.log(apply ? 'Mode: APPLY (will write)' : 'Mode: DRY RUN (pass --apply to actually migrate)');
  console.log('');

  const snap = await db.collection('users').get();
  const toFix = [];
  snap.forEach(function (doc) {
    const role = doc.data().role;
    if (typeof role !== 'string' || role.length === 0) return;
    const lower = role.toLowerCase();
    if (role !== lower) toFix.push({ id: doc.id, from: role, to: lower });
  });

  if (toFix.length === 0) {
    console.log('No non-lowercase role values found — nothing to migrate.');
    return;
  }
  console.log('Found ' + toFix.length + ' user doc(s) with a non-lowercase role:\n');
  toFix.forEach(function (u) { console.log('  - ' + u.id + '  role: "' + u.from + '" -> "' + u.to + '"'); });

  if (!apply) {
    console.log('\nDry run complete. Re-run with --apply to migrate the ' + toFix.length + ' doc(s) above.');
    return;
  }

  console.log('');
  let migrated = 0, failed = 0;
  for (const u of toFix) {
    try {
      await db.collection('users').doc(u.id).update({
        role: u.to,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: 'system-migration:normalize-role-casing'
      });
      migrated++;
    } catch (e) {
      console.error('    FAILED for ' + u.id + ': ' + e.message);
      failed++;
    }
  }
  console.log('Migration complete: ' + migrated + ' migrated, ' + failed + ' failed.');
  if (failed > 0) process.exitCode = 1;
}

main().catch(function (e) {
  console.error(e);
  process.exitCode = 1;
});
