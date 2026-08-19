#!/usr/bin/env node
// One-off production account deletion: permanently deletes the Agent
// account registered under knoel839@gmail.com (a DIFFERENT person/account
// from kubwimana77@gmail.com in scripts/grant-staff-role.js — this script
// only ever touches the single document it finds by this exact email).
//
// This is a genuine hard delete of the users/{uid} document (doc.delete(),
// not a soft isActive:false flag — that softer pattern exists elsewhere in
// this codebase, e.g. adminDeleteAll() in index.html, but was not what was
// asked for here). Irreversible. Two independent safety gates before
// anything is deleted:
//
//   1. Reference check (always runs, even in dry run): queries
//      properties (agentId AND ownerId), deals (agentId), commissions
//      (agentId), and leads (agentId) for this uid, and prints what it
//      finds. If any deals are in a non-closed pipelineStage (i.e. not
//      closed_won/closed_lost), the script REFUSES to delete even with
//      --apply — active deals need a human decision (reassign to another
//      agent, or close them out first) that this script cannot make on
//      its own. Pass --force-with-active-deals to override this specific
//      refusal after that decision has actually been made elsewhere.
//   2. --apply alone is NOT enough to delete, unlike the other scripts in
//      this directory — deleting an account is a different order of
//      irreversibility than migrating a field. Both --apply AND
//      --confirm-delete must be passed together to actually delete.
//
// Does NOT delete the Firebase Auth user by default — only the Firestore
// users/{uid} document ("the agent record", per the request). Pass
// --delete-auth-too (in addition to --apply --confirm-delete) to also
// remove the Auth account, which is a separate, additional irreversible
// action (nobody could ever sign in with this email as a fresh account
// with a clean history again — a new signup would get a new uid with no
// relation to the deleted one).
//
// Usage:
//   GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json \
//     node scripts/delete-agent-account.js --project=<firebase-project-id>
//
// Defaults to a dry run (identity/status check + full reference report,
// deletes nothing). Add --apply --confirm-delete to actually delete the
// users/{uid} document (and, only with --delete-auth-too as well, the
// Auth account too).

const admin = require('firebase-admin');

const TARGET_EMAIL = 'knoel839@gmail.com';
const ACTIVE_DEAL_STAGES_EXCLUDED = ['closed_won', 'closed_lost']; // anything else counts as active

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const confirmDelete = args.includes('--confirm-delete');
const forceWithActiveDeals = args.includes('--force-with-active-deals');
const deleteAuthToo = args.includes('--delete-auth-too');
const projectArg = args.find(function (a) { return a.startsWith('--project='); });
const projectId = projectArg ? projectArg.split('=')[1] : undefined;

admin.initializeApp(projectId ? { projectId: projectId } : {});
const db = admin.firestore();

async function collectRefs(uid) {
  const [propsByAgent, propsByOwner, deals, commissions, leads] = await Promise.all([
    db.collection('properties').where('agentId', '==', uid).get(),
    db.collection('properties').where('ownerId', '==', uid).get(),
    db.collection('deals').where('agentId', '==', uid).get(),
    db.collection('commissions').where('agentId', '==', uid).get(),
    db.collection('leads').where('agentId', '==', uid).get()
  ]);
  return { propsByAgent, propsByOwner, deals, commissions, leads };
}

function printDocs(label, snap, extractor) {
  console.log(label + ': ' + snap.size);
  snap.forEach(function (d) {
    console.log('    - ' + d.id + (extractor ? '  ' + extractor(d.data()) : ''));
  });
}

async function main() {
  console.log('KOMISIYONERI: permanently delete Agent account ' + TARGET_EMAIL);
  console.log(apply && confirmDelete ? 'Mode: DELETE (will hard-delete the document below)' : 'Mode: DRY RUN / REPORT ONLY (pass --apply AND --confirm-delete to actually delete)');
  console.log('');

  const snap = await db.collection('users').where('email', '==', TARGET_EMAIL).limit(2).get();
  if (snap.empty) {
    console.error('No users/{uid} document found with email == ' + TARGET_EMAIL + '. Nothing to do.');
    process.exitCode = 1;
    return;
  }
  if (snap.size > 1) {
    console.error('FOUND ' + snap.size + ' documents with email == ' + TARGET_EMAIL + ' — refusing to guess which one. Resolve the duplicate manually first.');
    process.exitCode = 1;
    return;
  }

  const doc = snap.docs[0];
  const uid = doc.id;
  const data = doc.data();
  console.log('Found users/' + uid + ':');
  console.log('  displayName: ' + JSON.stringify(data.displayName));
  console.log('  email:       ' + JSON.stringify(data.email));
  console.log('  role:        ' + JSON.stringify(data.role));
  console.log('  status:      ' + JSON.stringify(data.status));
  console.log('  isActive:    ' + JSON.stringify(data.isActive));
  console.log('  isVerified:  ' + JSON.stringify(data.isVerified || data.verified));
  console.log('');

  const role = String(data.role || '').toLowerCase();
  if (role !== 'agent') {
    console.error('REFUSING: role is "' + data.role + '", not "agent". This script only deletes Agent accounts. No write performed.');
    process.exitCode = 1;
    return;
  }
  const statusOk = String(data.status || '').toLowerCase() === 'approved' || data.isVerified === true || data.verified === true;
  if (!statusOk) {
    console.warn('WARNING: role is agent, but status is "' + data.status + '" and isVerified/verified is not true — this does not look like an approved agent. Re-verify this is the intended account before proceeding.');
  }

  console.log('Checking references before anything else...\n');
  const refs = await collectRefs(uid);

  printDocs('Properties listed as agent (agentId == ' + uid + ')', refs.propsByAgent, function (p) { return '"' + (p.title || p.type || '') + '" status=' + p.status; });
  printDocs('Properties owned by this account (ownerId == ' + uid + ')', refs.propsByOwner, function (p) { return '"' + (p.title || p.type || '') + '" status=' + p.status; });
  printDocs('Deals (agentId == ' + uid + ')', refs.deals, function (d) { return 'pipelineStage=' + d.pipelineStage + ' clientName=' + d.clientName + ' agreedPrice=' + d.agreedPrice; });
  printDocs('Commissions (agentId == ' + uid + ')', refs.commissions, function (c) { return 'status=' + c.status + ' agentShare=' + c.agentShare; });
  printDocs('CRM leads (agentId == ' + uid + ')', refs.leads, function (l) { return 'pipelineStage=' + l.pipelineStage + ' clientName=' + l.clientName; });
  console.log('');

  const activeDeals = refs.deals.docs.filter(function (d) {
    return ACTIVE_DEAL_STAGES_EXCLUDED.indexOf(d.data().pipelineStage) === -1;
  });

  if (activeDeals.length && !forceWithActiveDeals) {
    console.error(activeDeals.length + ' deal(s) for this agent are NOT closed (pipelineStage not in ' + JSON.stringify(ACTIVE_DEAL_STAGES_EXCLUDED) + '):');
    activeDeals.forEach(function (d) { console.error('  - ' + d.id + '  stage=' + d.data().pipelineStage + '  client=' + d.data().clientName); });
    console.error('\nREFUSING to delete while active deals exist. Decide how to handle each first (reassign to another agent, or close the deal), then either re-run once none remain, or pass --force-with-active-deals if you have deliberately decided to proceed anyway.');
    process.exitCode = 1;
    return;
  }

  if (refs.propsByAgent.size || refs.propsByOwner.size || refs.commissions.size || refs.leads.size) {
    console.log('NOTE: the reference counts above (properties/commissions/leads) are NOT auto-reassigned or orphan-cleaned by this script — it only deletes the users/' + uid + ' document itself. Those records will keep pointing at a uid that no longer resolves to a user document. Decide separately whether each needs reassigning, and say so explicitly if you want a follow-up pass to handle them.');
    console.log('');
  }

  if (!apply || !confirmDelete) {
    console.log('Dry run complete — no delete performed.');
    console.log('Re-run with --apply --confirm-delete to permanently delete users/' + uid + '.');
    if (activeDeals.length) console.log('(Active deals were found; also add --force-with-active-deals once you have decided how to proceed.)');
    return;
  }

  console.log('Deleting users/' + uid + ' ...');
  await doc.ref.delete();
  console.log('Deleted users/' + uid + ' (Firestore document only).');

  if (deleteAuthToo) {
    try {
      await admin.auth().deleteUser(uid);
      console.log('Deleted the matching Firebase Auth account (uid=' + uid + ') as well.');
    } catch (e) {
      console.error('Firestore document was deleted, but deleting the Auth account failed: ' + e.message);
      process.exitCode = 1;
    }
  } else {
    console.log('Firebase Auth account for this uid was left intact (pass --delete-auth-too to also remove it).');
  }
}

main().catch(function (e) {
  console.error(e);
  process.exitCode = 1;
});
