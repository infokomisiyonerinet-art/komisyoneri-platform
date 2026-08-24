#!/usr/bin/env node
// Bug 1 (2026-08-24 QA sprint) — two live property listings, "Inzu
// bihehembe!10M" and "Inzu nziza kumuyumbu", both show the exact same
// location ("Gasabo, Kimironko, Kigali") despite being different
// properties. Traced in index.html: openPropDetail() reads district/
// sector fresh per property (not a rendering bug) — the root cause is
// that openAddProperty() never reset the district/sector form fields
// between two back-to-back submissions, so the SECOND property silently
// inherited the FIRST one's location in Firestore. That code bug is
// already fixed (see openAddProperty()'s reset block); this script is
// for the resulting bad data already sitting in production, which no
// code fix can retroactively correct.
//
// This script deliberately does NOT try to guess which property's
// location is the wrong one, or what the right value should be — that's
// a real-world judgment call (which of these two properties is actually
// in Gasabo/Kimironko?) that only someone who knows the actual listings
// can make. It has two modes instead:
//
//   1. SCAN (default, no --fix-doc): finds the two properties named in
//      the bug report by title, and separately finds any OTHER pair/group
//      of active properties sharing an identical non-empty
//      district+sector combination — the same bug could plausibly have
//      hit other listings before the code fix, not just these two.
//      Prints everything needed to make the call: title, price, current
//      district/sector, createdAt, and Firestore doc id.
//
//   2. FIX (--fix-doc=<id> --district="..." [--sector="..."]): applies a
//      specific, explicit correction to ONE named document. Dry run by
//      default (prints current vs. planned value, writes nothing); pass
//      --apply to actually write. Writes an auditlogs entry on apply,
//      matching index.html's own logAudit() shape.
//
// Usage:
//   GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json \
//     node scripts/fix-property-location.js --project=<firebase-project-id>
//
//   GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json \
//     node scripts/fix-property-location.js --project=<firebase-project-id> \
//     --fix-doc=<docId> --district="Rwamagana" --sector="Muyumbu" --apply

const admin = require('firebase-admin');

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const projectArg  = args.find(function (a) { return a.startsWith('--project='); });
const fixDocArg   = args.find(function (a) { return a.startsWith('--fix-doc='); });
const districtArg = args.find(function (a) { return a.startsWith('--district='); });
const sectorArg   = args.find(function (a) { return a.startsWith('--sector='); });
const projectId = projectArg ? projectArg.split('=')[1] : undefined;

admin.initializeApp(projectId ? { projectId: projectId } : {});
const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

const REPORTED_TITLES = ['Inzu bihehembe!10M', 'Inzu nziza kumuyumbu'];

function fmtDoc(doc) {
  var d = doc.data();
  return {
    id: doc.id,
    title: d.title || '(no title)',
    price: d.price || 0,
    district: d.district || '',
    sector: d.sector || '',
    status: d.status || '',
    createdAt: d.createdAt && d.createdAt.toDate ? d.createdAt.toDate().toISOString() : String(d.createdAt || '')
  };
}

async function scan() {
  console.log('KOMISIYONERI: scan for Bug 1 (duplicated property location)\n');

  const snap = await db.collection('properties').where('isActive', '==', true).limit(2000).get();
  const all = snap.docs.map(fmtDoc);

  console.log('Scanned ' + all.length + ' active propert' + (all.length === 1 ? 'y' : 'ies') + '.\n');

  console.log('--- Properties named in the bug report ---');
  var reported = all.filter(function (p) { return REPORTED_TITLES.indexOf(p.title) > -1; });
  if (reported.length === 0) {
    console.log('  Neither reported title was found verbatim — titles may have since');
    console.log('  changed, or they are not active. Check the "other duplicate-location');
    console.log('  groups" list below instead, or search Firestore Console directly.');
  } else {
    reported.forEach(function (p) {
      console.log('  ' + p.id + '  "' + p.title + '"  ' + p.price.toLocaleString() + ' RWF  ' +
        '[' + p.district + (p.sector ? ', ' + p.sector : '') + ']  status=' + p.status + '  createdAt=' + p.createdAt);
    });
  }

  console.log('\n--- All other groups of active properties sharing an identical');
  console.log('    district+sector (possible same bug, other listings) ---');
  var byLoc = {};
  all.forEach(function (p) {
    if (!p.district) return; // no location at all isn't this bug
    var key = p.district + '|||' + p.sector;
    (byLoc[key] = byLoc[key] || []).push(p);
  });
  var suspiciousGroups = Object.keys(byLoc)
    .map(function (k) { return byLoc[k]; })
    .filter(function (group) { return group.length > 1; });

  if (suspiciousGroups.length === 0) {
    console.log('  None found — either genuinely no other duplicates, or several');
    console.log('  properties legitimately share a neighborhood (not itself a bug).');
  } else {
    suspiciousGroups.forEach(function (group) {
      console.log('  Location: [' + group[0].district + (group[0].sector ? ', ' + group[0].sector : '') + ']  (' + group.length + ' properties)');
      group.forEach(function (p) {
        console.log('    ' + p.id + '  "' + p.title + '"  ' + p.price.toLocaleString() + ' RWF  createdAt=' + p.createdAt);
      });
    });
    console.log('\n  A shared neighborhood alone is not proof of the bug — check whether');
    console.log('  it makes sense for these specific properties to be in the same place');
    console.log('  before assuming any of them need correcting.');
  }

  console.log('\nTo correct one, re-run with:');
  console.log('  --fix-doc=<id> --district="<correct district>" [--sector="<correct sector>"] [--apply]');
}

async function fixOne(docId, district, sector) {
  console.log('KOMISIYONERI: fix property location — doc ' + docId);
  console.log(apply ? 'Mode: APPLY (will write to production)' : 'Mode: DRY RUN (pass --apply to actually write)\n');

  const ref = db.collection('properties').doc(docId);
  const doc = await ref.get();
  if (!doc.exists) {
    console.error('ABORTED: no properties/' + docId + ' document found.');
    process.exitCode = 1;
    return;
  }
  const before = fmtDoc(doc);
  console.log('Current: "' + before.title + '"  [' + before.district + (before.sector ? ', ' + before.sector : '') + ']');
  console.log('Planned: [' + district + (sector ? ', ' + sector : '') + ']\n');

  if (!apply) {
    console.log('Dry run — nothing written.');
    return;
  }

  const payload = {
    district: district,
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: 'admin-script:fix-property-location.js'
  };
  if (sector !== undefined) payload.sector = sector;

  await ref.update(payload);

  const auditRef = db.collection('auditlogs').doc();
  await auditRef.set({
    id: auditRef.id, action: 'property.location_corrected', collection: 'properties', docId: docId,
    oldValue: { district: before.district, sector: before.sector },
    newValue: { district: district, sector: sector !== undefined ? sector : before.sector },
    performedBy: 'admin-script:fix-property-location.js', performedAt: FieldValue.serverTimestamp(),
    userRole: 'system', ipAddress: '', isActive: true, status: 'logged',
    createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
    createdBy: 'admin-script:fix-property-location.js', updatedBy: 'admin-script:fix-property-location.js'
  });

  console.log('APPLIED — ' + docId + ' updated, auditlogs entry written.');
}

async function main() {
  if (fixDocArg) {
    const docId = fixDocArg.split('=')[1];
    const district = districtArg ? districtArg.split('=').slice(1).join('=') : null;
    const sector = sectorArg ? sectorArg.split('=').slice(1).join('=') : undefined;
    if (!district) {
      console.error('ABORTED: --fix-doc requires --district="<correct district>" too.');
      process.exitCode = 1;
      return;
    }
    await fixOne(docId, district, sector);
    return;
  }
  await scan();
}

main().catch(function (e) {
  console.error(e);
  process.exitCode = 1;
});
