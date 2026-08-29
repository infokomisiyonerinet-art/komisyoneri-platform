#!/usr/bin/env node
// One-off production account fix: promotes a single user, identified by
// --uid or --email, to role:'super_admin'. Same shape as
// scripts/revert-agent-status.js, scripts/normalize-role-casing.js, and
// scripts/lookup-user-role.js — dry-run by default (prints the current doc
// and the exact planned diff, writes nothing), --apply required to
// actually write. Run scripts/lookup-user-role.js first to confirm the
// exact uid/email/current role before using this.
//
// Touches ONLY the `role` field (plus the standard updatedAt/updatedBy
// bookkeeping every write in this codebase carries) — deliberately does
// NOT clear/touch department, jobTitle, reportsTo, deniedActions,
// budgetApprovalLimit, executiveLevel, or any other field, even though
// index.html's own changeUserRole() would derive/clear some of those for
// a role with no org-chart entry. This script is intentionally narrower
// and more surgical: the one thing being fixed is the role field itself,
// nothing else on the document is anyone's to touch here.
//
// Targeting: --uid is exact and unambiguous (a direct document lookup,
// preferred whenever you already have it — e.g. from
// scripts/lookup-user-role.js's output). --email falls back to the same
// ambiguity guard as revert-agent-status.js's findUserByEmail(): aborts
// without guessing if zero or more than one doc matches. If both are
// given, --uid wins and --email is ignored.
//
// Writes one auditlogs entry on apply, action 'user.role.changed' — the
// exact action name and shape index.html's own changeUserRole() uses for
// a live role change, so this script's write is indistinguishable in the
// audit trail from someone doing the same change through the real Admin UI.
//
// Usage:
//   GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json \
//     node scripts/promote-to-super-admin.js --uid=<uid> --project=<firebase-project-id>
//   # or, if you don't have the uid handy:
//   GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json \
//     node scripts/promote-to-super-admin.js --email=someone@example.com --project=<firebase-project-id>
//
// Defaults to a dry run. Pass --apply to actually perform the write.

const admin = require('firebase-admin');

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const uidArg = args.find(function (a) { return a.startsWith('--uid='); });
const uid = uidArg ? uidArg.split('=').slice(1).join('=') : '';
const emailArg = args.find(function (a) { return a.startsWith('--email='); });
const email = emailArg ? emailArg.split('=').slice(1).join('=') : '';
const projectArg = args.find(function (a) { return a.startsWith('--project='); });
const projectId = projectArg ? projectArg.split('=')[1] : undefined;

if (!uid && !email) {
  console.error('Usage: node scripts/promote-to-super-admin.js (--uid=<uid> | --email=someone@example.com) [--project=<firebase-project-id>] [--apply]');
  process.exit(1);
}

admin.initializeApp(projectId ? { projectId: projectId } : {});
const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

function printDoc(label, data) {
  console.log('  ' + label + ':');
  Object.keys(data).sort().forEach(function (k) {
    console.log('    ' + k + ': ' + JSON.stringify(data[k]));
  });
}

async function findTargetDoc() {
  if (uid) {
    const doc = await db.collection('users').doc(uid).get();
    if (!doc.exists) {
      return { error: 'no users/' + uid + ' document exists.' };
    }
    return { doc: doc };
  }
  const snap = await db.collection('users').where('email', '==', email).limit(2).get();
  if (snap.empty) {
    return { error: 'no users/{uid} document found with email == ' + JSON.stringify(email) + '.' };
  }
  if (snap.size > 1) {
    return { error: 'more than one users/{uid} document has email == ' + JSON.stringify(email) + ' — ambiguous, refusing to guess. Doc IDs: ' + snap.docs.map(function (d) { return d.id; }).join(', ') };
  }
  return { doc: snap.docs[0] };
}

async function main() {
  const targetLabel = uid ? ('uid ' + JSON.stringify(uid)) : ('email ' + JSON.stringify(email));
  console.log('KOMISIYONERI: promote ' + targetLabel + ' to role:"super_admin"');
  console.log(apply ? 'Mode: APPLY (will write to production)' : 'Mode: DRY RUN (pass --apply to actually write)');
  console.log('');

  const found = await findTargetDoc();
  if (found.error) {
    console.error('ABORTED: ' + found.error + ' Run scripts/lookup-user-role.js first to confirm the exact uid/email.');
    process.exitCode = 1;
    return;
  }

  const doc = found.doc;
  const data = doc.data();
  const oldRole = data.role;

  printDoc('Current doc (users/' + doc.id + ')', data);
  console.log('');

  if (String(oldRole).toLowerCase() === 'super_admin') {
    console.log('  NOTE: role is already "super_admin" — nothing to change. Exiting without writing.');
    return;
  }

  console.log('  Planned update (role ONLY — no other field is touched):');
  console.log('    role: ' + JSON.stringify(oldRole) + ' -> "super_admin"');
  console.log('    updatedAt: <server timestamp>');
  console.log('    updatedBy: admin-script:promote-to-super-admin.js');

  if (!apply) {
    console.log('');
    console.log('  Dry run — nothing written. Re-run with --apply to perform this exact update.');
    return;
  }

  const payload = {
    role: 'super_admin',
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: 'admin-script:promote-to-super-admin.js'
  };
  await doc.ref.update(payload);

  const auditRef = await db.collection('auditlogs').add({
    id: '', action: 'user.role.changed', collection: 'users', docId: doc.id,
    oldValue: { role: oldRole }, newValue: { role: 'super_admin' },
    performedBy: 'admin-script:promote-to-super-admin.js', performedAt: FieldValue.serverTimestamp(),
    userRole: 'system', ipAddress: '', isActive: true, status: 'logged',
    createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
    createdBy: 'admin-script:promote-to-super-admin.js', updatedBy: 'admin-script:promote-to-super-admin.js'
  });
  await auditRef.update({ id: auditRef.id });

  console.log('');
  console.log('  APPLIED — users/' + doc.id + ':');
  console.log('    role: ' + JSON.stringify(oldRole) + ' -> "super_admin"  ✓ confirmed');
  console.log('  auditlogs entry written (action: user.role.changed).');
  console.log('  The account must sign out and back in (or reload staff.komisiyoneri.co.rw) to pick up the new role — the client caches the session in localStorage.');
}

main().catch(function (e) {
  console.error(e);
  process.exitCode = 1;
});
