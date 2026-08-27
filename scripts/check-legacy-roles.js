#!/usr/bin/env node
// READ-ONLY production check for the three legacy role values
// (operations_manager, branch_manager, company_owner) — run before deploying
// the Dynamic RBAC / Progressive Governance rules change, per the
// pre-production governance audit.
//
// This script NEVER writes, modifies, migrates, or deletes anything. It only
// queries users/{uid} where role is one of the three legacy values and
// prints what it finds.
//
// Usage:
//   GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json \
//     node scripts/check-legacy-roles.js --project=<firebase-project-id>
//
// Add --show-pii to also print displayName/email (omitted by default —
// prints uid + role + isActive + status only, which is enough to get a
// user count and decide next steps without handling personal data unless
// explicitly requested).

const admin = require('firebase-admin');

const LEGACY_ROLES = ['operations_manager', 'branch_manager', 'company_owner'];

const args = process.argv.slice(2);
const showPii = args.includes('--show-pii');
const projectArg = args.find(function (a) { return a.startsWith('--project='); });
const projectId = projectArg ? projectArg.split('=')[1] : undefined;

admin.initializeApp(projectId ? { projectId: projectId } : {});
const db = admin.firestore();

async function main() {
  console.log('KOMISIYONERI: read-only legacy role check');
  console.log('Checking: ' + LEGACY_ROLES.join(', '));
  console.log('');

  let totalFound = 0;
  const results = {};

  for (const role of LEGACY_ROLES) {
    const snap = await db.collection('users').where('role', '==', role).get();
    results[role] = snap.docs;
    totalFound += snap.size;
    console.log('role: ' + role + '  |  user count: ' + snap.size);
    snap.docs.forEach(function (doc) {
      const d = doc.data();
      const line = '  - uid: ' + doc.id
        + '  isActive: ' + JSON.stringify(d.isActive)
        + '  status: ' + JSON.stringify(d.status)
        + (showPii ? '  displayName: ' + JSON.stringify(d.displayName) + '  email: ' + JSON.stringify(d.email) : '');
      console.log(line);
    });
    console.log('');
  }

  console.log('---');
  if (totalFound === 0) {
    console.log('RESULT: zero users found across all three legacy roles. Safe to proceed with the rules deploy from a legacy-role perspective — nothing loses access.');
  } else {
    console.log('RESULT: ' + totalFound + ' user(s) found holding a legacy role. STOP before deploying rules — each of these accounts will lose the newly-gated actions (property/site approve, plot status, agent verify, commission/payout approval) the moment rules/firestore.rules is deployed, until an Admin either seeds a role_permissions doc for that legacy role or migrates the account to a real role. This script has NOT modified anything — decide the treatment for each account above before proceeding.');
  }
}

main().catch(function (e) {
  console.error(e);
  process.exitCode = 1;
});
