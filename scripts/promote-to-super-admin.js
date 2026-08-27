#!/usr/bin/env node
// One-off production account fix: promotes a single user, identified by
// email, to role:'super_admin'. Same shape as scripts/revert-agent-status.js
// and scripts/normalize-role-casing.js — dry-run by default (prints the
// current doc and the exact planned diff, writes nothing), --apply required
// to actually write. Run scripts/lookup-user-role.js first to confirm the
// exact email/current role before using this.
//
// Only ever touches the ONE users/{uid} document matching --email — same
// ambiguity guard as revert-agent-status.js's findUserByEmail(): aborts
// without guessing if zero or more than one doc matches.
//
// Field shape mirrors what index.html's own changeUserRole() writes for a
// role change into a non-governance role (super_admin has no entry in
// ROLE_DEPARTMENT/ROLE_JOBTITLE/ROLE_SUPERIOR_ROLES, same as 'admin' —
// see index.html's own "isGovRole" branching): department/jobTitle are
// cleared to null, reportsTo/deniedActions cleared to [], and ONLY if
// those fields are already present on the doc (an agent account typically
// won't have them at all, so this is usually a no-op) — never invents new
// fields that don't already have a place in this app's data model.
// status/isActive are deliberately left untouched: the account is already
// logging in successfully, so there's nothing broken there to fix, and
// touching fields nobody asked to change risks an unrelated regression.
//
// Writes one auditlogs entry on apply, action 'user.role.changed' — the
// exact action name and shape index.html's own changeUserRole() uses for
// a live role change, so this script's write is indistinguishable in the
// audit trail from someone doing the same change through the real Admin UI.
//
// Usage:
//   GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json \
//     node scripts/promote-to-super-admin.js --email=someone@example.com --project=<firebase-project-id>
//
// Defaults to a dry run. Pass --apply to actually perform the write.

const admin = require('firebase-admin');

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const emailArg = args.find(function (a) { return a.startsWith('--email='); });
const email = emailArg ? emailArg.split('=').slice(1).join('=') : '';
const projectArg = args.find(function (a) { return a.startsWith('--project='); });
const projectId = projectArg ? projectArg.split('=')[1] : undefined;

if (!email) {
  console.error('Usage: node scripts/promote-to-super-admin.js --email=someone@example.com [--project=<firebase-project-id>] [--apply]');
  process.exit(1);
}

admin.initializeApp(projectId ? { projectId: projectId } : {});
const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

// Only cleared if already present on the doc — see header comment.
const GOVCHART_FIELDS_TO_CLEAR = ['department', 'jobTitle', 'reportsTo', 'deniedActions', 'budgetApprovalLimit'];

function printDoc(label, data) {
  console.log('  ' + label + ':');
  Object.keys(data).sort().forEach(function (k) {
    console.log('    ' + k + ': ' + JSON.stringify(data[k]));
  });
}

async function main() {
  console.log('KOMISIYONERI: promote ' + JSON.stringify(email) + ' to role:"super_admin"');
  console.log(apply ? 'Mode: APPLY (will write to production)' : 'Mode: DRY RUN (pass --apply to actually write)');
  console.log('');

  const snap = await db.collection('users').where('email', '==', email).limit(2).get();

  if (snap.empty) {
    console.error('ABORTED: no users/{uid} document found with email == ' + JSON.stringify(email) + '. Run scripts/lookup-user-role.js first to confirm the exact email.');
    process.exitCode = 1;
    return;
  }
  if (snap.size > 1) {
    console.error('ABORTED: more than one users/{uid} document has email == ' + JSON.stringify(email) + ' — ambiguous, refusing to guess. Doc IDs: ' + snap.docs.map(function (d) { return d.id; }).join(', '));
    process.exitCode = 1;
    return;
  }

  const doc = snap.docs[0];
  const data = doc.data();
  const oldRole = data.role;

  printDoc('Current doc (users/' + doc.id + ')', data);
  console.log('');

  if (String(oldRole).toLowerCase() === 'super_admin') {
    console.log('  NOTE: role is already "super_admin" — nothing to change. Exiting without writing.');
    return;
  }

  // Informational only, not a blocker — 'super_admin' has no uniqueness
  // constraint in this app's model (unlike 'ceo', which does).
  const existingAdmins = await db.collection('users')
    .where('role', 'in', ['admin', 'super_admin']).get();
  console.log('  Info: ' + existingAdmins.size + ' existing user(s) currently have role admin/super_admin.');
  console.log('');

  const clearedFields = GOVCHART_FIELDS_TO_CLEAR.filter(function (f) {
    return Object.prototype.hasOwnProperty.call(data, f);
  });

  const payload = {
    role: 'super_admin',
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: 'admin-script:promote-to-super-admin.js'
  };
  clearedFields.forEach(function (f) {
    payload[f] = (f === 'reportsTo' || f === 'deniedActions') ? [] : null;
  });

  console.log('  Planned update:');
  console.log('    role: "' + oldRole + '" -> "super_admin"');
  clearedFields.forEach(function (f) {
    console.log('    ' + f + ': ' + JSON.stringify(data[f]) + ' -> ' + JSON.stringify(payload[f]));
  });
  console.log('    updatedAt: <server timestamp>');
  console.log('    updatedBy: admin-script:promote-to-super-admin.js');

  if (!apply) {
    console.log('');
    console.log('  Dry run — nothing written. Re-run with --apply to perform this exact update.');
    return;
  }

  await doc.ref.update(payload);

  const oldValueSnapshot = { role: oldRole };
  clearedFields.forEach(function (f) { oldValueSnapshot[f] = data[f]; });
  const newValueSnapshot = { role: 'super_admin' };
  clearedFields.forEach(function (f) { newValueSnapshot[f] = payload[f]; });

  const auditRef = await db.collection('auditlogs').add({
    id: '', action: 'user.role.changed', collection: 'users', docId: doc.id,
    oldValue: oldValueSnapshot, newValue: newValueSnapshot,
    performedBy: 'admin-script:promote-to-super-admin.js', performedAt: FieldValue.serverTimestamp(),
    userRole: 'system', ipAddress: '', isActive: true, status: 'logged',
    createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
    createdBy: 'admin-script:promote-to-super-admin.js', updatedBy: 'admin-script:promote-to-super-admin.js'
  });
  await auditRef.update({ id: auditRef.id });

  console.log('');
  console.log('  APPLIED — users/' + doc.id + ' updated to role:"super_admin", auditlogs entry written.');
  console.log('  The account must sign out and back in (or reload staff.komisiyoneri.co.rw) to pick up the new role — the client caches the session in localStorage.');
}

main().catch(function (e) {
  console.error(e);
  process.exitCode = 1;
});
