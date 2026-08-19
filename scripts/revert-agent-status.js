#!/usr/bin/env node
// One-time production data fix: reverts two users' agent status.
//
//   1. info.komisiyoneri.net@gmail.com — role was changed to 'agent' by
//      mistake; needs to go back to 'staff'.
//   2. kubwimana77@gmail.com (Kubwimana Noel) — agent approval was granted
//      by mistake; needs to be revoked back to the default 'client' role.
//
// Schema note (confirmed by reading index.html before writing this script):
// this codebase has NO separate `agents` collection. Every agent field
// (role, status, isActive, isVerified/verified, zone, district, experience,
// transport, languages, agentAppliedAt) lives directly on the applicant's
// own users/{uid} document — see submitAgentReg() (writes those fields when
// someone applies) and _fsPendingApprove() (flips status/isActive/isVerified
// on approval). There is nothing else to soft- or hard-delete: reverting
// agent status IS editing this one document, the same way the app's own
// admin approve/reject actions already do it.
//
// district/zone/experience/transport/languages are cleared because
// submitAgentReg() is the only code path in this app that ever writes them
// onto a users/{uid} doc (confirmed via grep) — general profile fields the
// task said not to touch (displayName, phone, email, nationalId, address)
// are left completely alone.
//
// Kubwimana Noel additionally gets a hard identity guard before any write:
// phone and nationalId must match the values given in the task, or the
// script aborts for that user without writing anything. This exists so a
// wrong/duplicate email match can never silently revoke the wrong person's
// agent status.
//
// Usage:
//   GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json \
//     node scripts/revert-agent-status.js --project=<firebase-project-id>
//
// Defaults to a dry run (prints the current doc and the exact planned
// diff, writes nothing). Pass --apply to actually perform the updates.
// Also writes an auditlogs entry per user on apply, matching the shape
// index.html's own logAudit() uses.

const admin = require('firebase-admin');

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const projectArg = args.find(function (a) { return a.startsWith('--project='); });
const projectId = projectArg ? projectArg.split('=')[1] : undefined;

admin.initializeApp(projectId ? { projectId: projectId } : {});
const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

// Fields this app only ever writes as part of an agent application/approval
// (see submitAgentReg()/_fsPendingApprove() in index.html) — cleared on
// revert regardless of which of the two target roles a user is reverted to.
const AGENT_ONLY_FIELDS = [
  'isVerified', 'verified', 'agentAppliedAt',
  'zone', 'district', 'experience', 'transport', 'languages'
];

function normalizePhone(p) {
  return String(p || '').replace(/[\s\-()]/g, '');
}

async function findUserByEmail(email) {
  const snap = await db.collection('users').where('email', '==', email).limit(2).get();
  if (snap.empty) return { error: 'no users/{uid} doc found with email == ' + email };
  if (snap.size > 1) return { error: 'more than one users/{uid} doc has email == ' + email + ' — ambiguous, aborting for safety' };
  return { doc: snap.docs[0] };
}

function printCurrentDoc(label, data) {
  console.log('  Current doc (' + label + '):');
  Object.keys(data).sort().forEach(function (k) {
    console.log('    ' + k + ': ' + JSON.stringify(data[k]));
  });
}

// Returns { payload, deletedFields, setFields } rather than making the
// caller re-introspect FieldValue.delete() sentinels after the fact —
// deletedFields/setFields are plain, human-readable records of the same
// decisions baked into payload, used for printing and for the audit log.
function buildRevertPayload(data, targetRole) {
  const setFields = { role: targetRole };
  // Only touch status if the account is still sitting in the agent
  // application's own pending state — an already-active account (staff or
  // otherwise) keeps whatever status it already has; this script only
  // exists to fix role + agent-specific fields, not to reset an unrelated
  // account-lifecycle field it didn't cause.
  if (data.status === 'pending') setFields.status = 'active';

  const deletedFields = AGENT_ONLY_FIELDS.filter(function (f) {
    return Object.prototype.hasOwnProperty.call(data, f);
  });

  const payload = Object.assign({}, setFields, {
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: 'admin-script:revert-agent-status.js'
  });
  deletedFields.forEach(function (f) { payload[f] = FieldValue.delete(); });

  return { payload: payload, setFields: setFields, deletedFields: deletedFields };
}

function printPlannedChange(built) {
  console.log('  Planned update:');
  Object.keys(built.setFields).forEach(function (k) {
    console.log('    ' + k + ': ' + JSON.stringify(built.setFields[k]));
  });
  built.deletedFields.forEach(function (k) { console.log('    ' + k + ': <removed>'); });
  console.log('    updatedAt: <server timestamp>');
  console.log('    updatedBy: admin-script:revert-agent-status.js');
}

async function writeAuditLog(docId, oldData, built) {
  var oldValueSnapshot = {};
  Object.keys(built.setFields).forEach(function (k) { oldValueSnapshot[k] = Object.prototype.hasOwnProperty.call(oldData, k) ? oldData[k] : null; });
  built.deletedFields.forEach(function (k) { oldValueSnapshot[k] = oldData[k]; });

  var newValueSnapshot = Object.assign({}, built.setFields);
  built.deletedFields.forEach(function (k) { newValueSnapshot[k] = '<removed>'; });

  var ref = await db.collection('auditlogs').add({
    id: '', action: 'user.agent_status_reverted', collection: 'users', docId: docId,
    oldValue: oldValueSnapshot, newValue: newValueSnapshot,
    performedBy: 'admin-script:revert-agent-status.js', performedAt: FieldValue.serverTimestamp(),
    userRole: 'system', ipAddress: '', isActive: true, status: 'logged',
    createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
    createdBy: 'admin-script:revert-agent-status.js', updatedBy: 'admin-script:revert-agent-status.js'
  });
  await ref.update({ id: ref.id });
}

async function revertOne(label, email, targetRole, identityGuard) {
  console.log('\n=== ' + label + ' (' + email + ') ===');
  const found = await findUserByEmail(email);
  if (found.error) {
    console.error('  ABORTED: ' + found.error);
    return { ok: false };
  }
  const doc = found.doc;
  const data = doc.data();
  printCurrentDoc(label, data);

  if (identityGuard) {
    const problems = [];
    if (normalizePhone(data.phone) !== normalizePhone(identityGuard.phone)) {
      problems.push('phone mismatch: doc has ' + JSON.stringify(data.phone) + ', expected ' + JSON.stringify(identityGuard.phone));
    }
    if (String(data.nationalId || '') !== identityGuard.nationalId) {
      problems.push('nationalId mismatch: doc has ' + JSON.stringify(data.nationalId) + ', expected ' + JSON.stringify(identityGuard.nationalId));
    }
    if (problems.length) {
      console.error('  ABORTED — identity guard failed, refusing to touch this document:');
      problems.forEach(function (p) { console.error('    - ' + p); });
      return { ok: false };
    }
    console.log('  Identity guard passed (phone + nationalId match).');
  }

  if (data.role !== 'agent') {
    console.warn('  NOTE: current role is ' + JSON.stringify(data.role) + ', not "agent" — proceeding anyway since agent-specific fields may still be present, but double-check this is still the intended account.');
  }

  const built = buildRevertPayload(data, targetRole);
  printPlannedChange(built);

  if (!apply) {
    console.log('  Dry run — nothing written.');
    return { ok: true, docId: doc.id, data: data, built: built };
  }

  await doc.ref.update(built.payload);
  await writeAuditLog(doc.id, data, built);
  console.log('  APPLIED — ' + doc.id + ' updated, auditlogs entry written.');
  return { ok: true, docId: doc.id, data: data, built: built };
}

async function main() {
  console.log('KOMISIYONERI: revert agent status for 2 users');
  console.log(apply ? 'Mode: APPLY (will write to production)' : 'Mode: DRY RUN (pass --apply to actually write)');

  const r1 = await revertOne(
    'info.komisiyoneri.net@gmail.com -> staff',
    'info.komisiyoneri.net@gmail.com',
    'staff',
    null // no name/phone/ID given for this one in the task — email match only
  );

  const r2 = await revertOne(
    'Kubwimana Noel -> client',
    'kubwimana77@gmail.com',
    'client',
    { phone: '+250785355082', nationalId: '1199280085227103' }
  );

  console.log('\n=== SUMMARY ===');
  console.log('info.komisiyoneri.net@gmail.com: ' + (r1.ok ? (apply ? 'reverted to staff' : 'dry-run OK, ready for --apply') : 'FAILED / ABORTED — see above'));
  console.log('kubwimana77@gmail.com:           ' + (r2.ok ? (apply ? 'reverted to client' : 'dry-run OK, ready for --apply') : 'FAILED / ABORTED — see above'));

  if (!r1.ok || !r2.ok) process.exitCode = 1;
}

main().catch(function (e) {
  console.error(e);
  process.exitCode = 1;
});
