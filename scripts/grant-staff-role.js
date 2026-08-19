#!/usr/bin/env node
// One-off production account change: grants role:'staff' to the account
// registered under kubwimana77@gmail.com.
//
// SCOPE, per the codebase's actual permission model (not assumed — checked
// against rules/firestore.rules and index.html before writing this):
//   - Brokers/Agents management (create/edit/verify/suspend agent records)
//     and full CRM access are BOTH already inherent to plain role:'staff'
//     (isAdminOrStaff() / ROLE_TIERS.STAFF and ROLE_TIERS.INTERNAL_TEAM —
//     see rules/firestore.rules line ~27 and index.html's ROLE_TIERS).
//     Nothing extra needs to be granted for either of those.
//   - Marketing Dashboard (page-marketing-mgr) is gated on the single role
//     'marketing_manager' only (see index.html's sidebar allowlist, "go('
//     marketing-mgr')" -> roles: ['marketing_manager']) — there is no way
//     for role:'staff' to reach it, and per this app's "one management
//     role per department" model (see functions/index.js's
//     createStaffOrPartnerAccount comment, ROLE_DEPARTMENT/ROLE_JOBTITLE),
//     that's not a gap this script can close without changing role away
//     from 'staff'. Confirmed with the requester: proceed with role:
//     'staff' and no Marketing Dashboard access.
//   - HR directory read access is NOT included: rules/firestore.rules'
//     isAdminOrStaff() is one undifferentiated tier for both the `users`
//     collection (HR directory) AND `payroll` — there is no read-only-HR-
//     without-payroll permission in this codebase to grant narrowly.
//     Confirmed with the requester: skip HR access entirely this pass.
//   - Because of the above, this script changes ONLY `role` (plus
//     department/jobTitle/reportsTo, which the canonical pattern always
//     derives from role — see ROLE_DEPARTMENT in functions/index.js).
//     Plain 'staff' has no entry in ROLE_DEPARTMENT/ROLE_JOBTITLE, so both
//     are set to '' and reportsTo to [], exactly matching what
//     createStaffOrPartnerAccount would produce for role:'staff'. No new
//     fields, no permissions array, no dashboard-access flags invented.
//
// SAFETY: refuses to write anything unless the found document's
// displayName/phone/nationalId/district all match the expected identity
// below — this is a real production account, and email lookup alone is
// not enough confirmation for a permission grant. Mismatch aborts with no
// write, in dry run OR --apply.
//
// Usage:
//   GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json \
//     node scripts/grant-staff-role.js --project=<firebase-project-id>
//
// Defaults to a dry run (prints identity check + exact diff, writes
// nothing). Pass --apply to actually perform the write.

const admin = require('firebase-admin');

const TARGET_EMAIL = 'kubwimana77@gmail.com';
const EXPECTED = {
  displayName: 'Kubwimana Noel',
  phone: '+250785355082',
  district: 'Kicukiro',
  nationalId: '1199280085227103'
};

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const projectArg = args.find(function (a) { return a.startsWith('--project='); });
const projectId = projectArg ? projectArg.split('=')[1] : undefined;

admin.initializeApp(projectId ? { projectId: projectId } : {});
const db = admin.firestore();

function normPhone(p) {
  return String(p || '').replace(/[\s-]/g, '');
}

async function main() {
  console.log('KOMISIYONERI: grant role:staff to ' + TARGET_EMAIL);
  console.log(apply ? 'Mode: APPLY (will write)' : 'Mode: DRY RUN (pass --apply to actually write)');
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
  const data = doc.data();
  console.log('Found users/' + doc.id + ':');
  console.log('  displayName: ' + JSON.stringify(data.displayName));
  console.log('  phone:       ' + JSON.stringify(data.phone));
  console.log('  district:    ' + JSON.stringify(data.district));
  console.log('  zone:        ' + JSON.stringify(data.zone));
  console.log('  nationalId:  ' + JSON.stringify(data.nationalId));
  console.log('  role:        ' + JSON.stringify(data.role));
  console.log('  status:      ' + JSON.stringify(data.status));
  console.log('  isActive:    ' + JSON.stringify(data.isActive));
  console.log('');

  // Identity confirmation — every field must match. Case-sensitive on name
  // and district (both are stored/displayed with specific casing
  // conventions in this app); phone compared with whitespace/dashes
  // stripped since phone numbers are sometimes stored with different
  // formatting; nationalId compared exact.
  const mismatches = [];
  if (String(data.displayName || '').trim() !== EXPECTED.displayName) {
    mismatches.push('displayName: expected "' + EXPECTED.displayName + '", found ' + JSON.stringify(data.displayName));
  }
  if (normPhone(data.phone) !== normPhone(EXPECTED.phone)) {
    mismatches.push('phone: expected "' + EXPECTED.phone + '", found ' + JSON.stringify(data.phone));
  }
  const districtMatch = String(data.district || '') === EXPECTED.district || String(data.zone || '') === EXPECTED.district;
  if (!districtMatch) {
    mismatches.push('district/zone: expected "' + EXPECTED.district + '", found district=' + JSON.stringify(data.district) + ' zone=' + JSON.stringify(data.zone));
  }
  if (String(data.nationalId || '') !== EXPECTED.nationalId) {
    mismatches.push('nationalId: expected "' + EXPECTED.nationalId + '", found ' + JSON.stringify(data.nationalId));
  }

  if (mismatches.length) {
    console.error('IDENTITY MISMATCH — refusing to proceed. This document does not match the confirmed identity details:');
    mismatches.forEach(function (m) { console.error('  - ' + m); });
    console.error('\nNo write performed, dry run or --apply. Resolve the mismatch before re-running.');
    process.exitCode = 1;
    return;
  }
  console.log('Identity confirmed: displayName, phone, district/zone, and nationalId all match.');
  console.log('');

  const newRole = 'staff';
  const newDept = '';    // ROLE_DEPARTMENT['staff'] is undefined -> '' (canonical pattern)
  const newTitle = '';   // ROLE_JOBTITLE['staff'] is undefined -> '' (canonical pattern)
  const newReportsTo = []; // 'staff' has no entry in ROLE_SUPERIOR_ROLES

  console.log('Planned change:');
  console.log('  role:      ' + JSON.stringify(data.role) + '  ->  ' + JSON.stringify(newRole));
  console.log('  department:' + JSON.stringify(data.department) + '  ->  ' + JSON.stringify(newDept));
  console.log('  jobTitle:  ' + JSON.stringify(data.jobTitle) + '  ->  ' + JSON.stringify(newTitle));
  console.log('  reportsTo: ' + JSON.stringify(data.reportsTo) + '  ->  ' + JSON.stringify(newReportsTo));
  console.log('  (status and isActive are left untouched — not part of what was requested)');
  console.log('');
  console.log('Effective access after this change (per current rules/firestore.rules + index.html):');
  console.log('  + Brokers/Agents management (create/edit/verify/suspend agent records) — via isAdminOrStaff()');
  console.log('  + Full CRM access — via ROLE_TIERS.INTERNAL_TEAM');
  console.log('  - No HR directory / payroll access (skipped this pass, per confirmation)');
  console.log('  - No Marketing Dashboard access (role stays staff, not marketing_manager, per confirmation)');

  if (!apply) {
    console.log('\nDry run complete. Re-run with --apply to write the change above.');
    return;
  }

  console.log('');
  await doc.ref.update({
    role: newRole,
    department: newDept,
    jobTitle: newTitle,
    reportsTo: newReportsTo,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedBy: 'system-migration:grant-staff-role'
  });
  console.log('Done: users/' + doc.id + ' updated to role:staff.');
}

main().catch(function (e) {
  console.error(e);
  process.exitCode = 1;
});
