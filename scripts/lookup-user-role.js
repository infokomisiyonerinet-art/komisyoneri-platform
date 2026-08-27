#!/usr/bin/env node
// READ-ONLY lookup: prints the exact current users/{uid} document for a
// given email — every field, via JSON.stringify so exact casing/whitespace
// in the `role` value is visible (e.g. "agent" vs "Agent" vs "agent " are
// all printed distinguishably), not paraphrased.
//
// This script never writes anything, under any flag — there is no --apply
// concept here at all. Use it to confirm an account's real role/state
// before running any write script (e.g. scripts/promote-to-super-admin.js)
// against that email.
//
// Same ambiguity safety as scripts/revert-agent-status.js's
// findUserByEmail(): aborts without guessing if zero or more than one
// users/{uid} doc matches the given email.
//
// Usage:
//   GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json \
//     node scripts/lookup-user-role.js --email=someone@example.com --project=<firebase-project-id>

const admin = require('firebase-admin');

const args = process.argv.slice(2);
const emailArg = args.find(function (a) { return a.startsWith('--email='); });
const email = emailArg ? emailArg.split('=').slice(1).join('=') : '';
const projectArg = args.find(function (a) { return a.startsWith('--project='); });
const projectId = projectArg ? projectArg.split('=')[1] : undefined;

if (!email) {
  console.error('Usage: node scripts/lookup-user-role.js --email=someone@example.com [--project=<firebase-project-id>]');
  process.exit(1);
}

admin.initializeApp(projectId ? { projectId: projectId } : {});
const db = admin.firestore();

async function main() {
  console.log('KOMISIYONERI: read-only role lookup for ' + JSON.stringify(email));
  console.log('');

  const snap = await db.collection('users').where('email', '==', email).limit(2).get();

  if (snap.empty) {
    console.error('No users/{uid} document found with email == ' + JSON.stringify(email) + '.');
    console.error('Note: this is an exact-match query — a leading/trailing space or different casing in the stored email would not match. If you expect a result, double-check the email as stored (Firebase Auth email vs. the users/{uid}.email field can drift).');
    process.exitCode = 1;
    return;
  }
  if (snap.size > 1) {
    console.error('More than one users/{uid} document has email == ' + JSON.stringify(email) + ' — ambiguous. Doc IDs found: ' + snap.docs.map(function (d) { return d.id; }).join(', '));
    console.error('Resolve the duplicate manually before running any write script against this email.');
    process.exitCode = 1;
    return;
  }

  const doc = snap.docs[0];
  const data = doc.data();

  console.log('Found users/' + doc.id);
  console.log('');
  console.log('  role (exact, quoted to reveal whitespace): ' + JSON.stringify(data.role));
  console.log('  typeof role: ' + typeof data.role);
  console.log('');
  console.log('  Full document:');
  Object.keys(data).sort().forEach(function (k) {
    console.log('    ' + k + ': ' + JSON.stringify(data[k]));
  });
}

main().catch(function (e) {
  console.error(e);
  process.exitCode = 1;
});
