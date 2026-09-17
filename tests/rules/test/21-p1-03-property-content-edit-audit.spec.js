// P1-03 — property content edits now generate an audit record.
//
// The actual logAudit('property.content_edited', ...) call was added to
// index.html's property-edit save path (submitProperty()'s EDIT MODE
// branch) — a frontend change this rules-only emulator suite can't invoke
// directly. What this file verifies is the part that IS rules-governed:
// the exact write shape logAudit() produces for this new action name is
// permitted by the existing auditlogs identity-pinned create rule (no
// action-name allowlist exists — confirmed by reading the rule — so no
// rules change was needed for this fix), and the resulting record is
// immutable, same as every other audit entry in this collection.
//
// Also folded in here: P0.6 FIX 1 left two client-side gates
// (openEditProperty(), submitProperty()'s EDIT MODE branch) still
// checking only isCEO() for editing an approved listing, even though the
// matching rules check (_isApprovedContentEditByNonCEO()) already allows
// isSuperAdmin() too — Super Admin literally could not reach the save
// path this fix instruments. Both gates now also accept
// isSuperAdminExact(currentUser). That's a pure frontend conditional with
// no rules counterpart, so it isn't separately testable here either — the
// existing FIX 1 rules tests (19-p0-fixes-approved-edit-and-offer-freeze)
// already confirm the backend accepts the write from a super_admin.
//
// This file does not modify tests/rules/seed.js — fixtures are local,
// following the same pattern as every other P0.x/P1.x file in this suite.

const { assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { makeTestEnv } = require('../testenv');
const { seed, UIDS, DOC_IDS, standardFields } = require('../seed');

describe('P1-03 — property content-edit audit trail', function () {
  this.timeout(20000);
  let testEnv;

  before(async () => { testEnv = await makeTestEnv(); });
  after(async () => { await testEnv.cleanup(); });
  beforeEach(async () => {
    await testEnv.clearFirestore();
    await seed(testEnv);
  });

  function contentEditAuditEntry(actorUid) {
    return {
      id: '', action: 'property.content_edited', collection: 'properties', docId: DOC_IDS.property,
      oldValue: { title: 'Test Villa', price: 50000000, description: 'Seed fixture' },
      newValue: { title: 'Test Villa Renovated', price: 55000000, description: 'Updated description' },
      performedBy: actorUid, performedAt: new Date().toISOString(), userRole: 'ceo',
      ipAddress: '', isActive: true, status: 'logged',
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      createdBy: actorUid, updatedBy: actorUid
    };
  }

  it('the editing user CAN create a property.content_edited audit entry attributed to themself — ALLOWED', async () => {
    const ctx = testEnv.authenticatedContext(UIDS.ceo);
    await assertSucceeds(ctx.firestore().collection('auditlogs').add(contentEditAuditEntry(UIDS.ceo)));
  });

  it('a user CANNOT create a property.content_edited entry attributed to someone else — DENIED (identity-pin, pre-existing protection)', async () => {
    const ctx = testEnv.authenticatedContext(UIDS.ceo);
    await assertFails(ctx.firestore().collection('auditlogs').add(contentEditAuditEntry(UIDS.agentA)));
  });

  it('the resulting audit entry is immutable — even the author cannot edit it afterward', async () => {
    const adminCtx = testEnv.authenticatedContext(UIDS.admin);
    const ref = await assertSucceeds(adminCtx.firestore().collection('auditlogs').add(contentEditAuditEntry(UIDS.admin)));
    await assertFails(ref.update({ newValue: { title: 'Tampered' } }));
    await assertFails(ref.delete());
  });

  it('the resulting audit entry is immutable — admin/super_admin cannot edit it either', async () => {
    const agentCtx = testEnv.authenticatedContext(UIDS.agentA);
    const ref = await assertSucceeds(agentCtx.firestore().collection('auditlogs').add(contentEditAuditEntry(UIDS.agentA)));
    const adminDb = testEnv.authenticatedContext(UIDS.admin).firestore();
    await assertFails(adminDb.collection('auditlogs').doc(ref.id).update({ newValue: { title: 'Tampered' } }));
    await assertFails(adminDb.collection('auditlogs').doc(ref.id).delete());
  });

  // Regression: FIX 1's own rules-layer behavior (Super Admin can edit an
  // approved listing's content) is unaffected by this audit-only change —
  // re-confirmed briefly here since this file also touched the two
  // client-side gates guarding the same feature.
  it('regression: super_admin can still edit content fields of an approved listing at the rules layer', async () => {
    const approvedId = 'p103_approved_property_test_doc';
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await db.collection('users').doc('p103_super_admin_test_user').set({
        id: 'p103_super_admin_test_user', uid: 'p103_super_admin_test_user', role: 'super_admin',
        displayName: 'Super Admin Test', email: 'p103sa@test.local', phone: '+250700000000',
        isActive: true, status: 'active', photoURL: '',
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), createdBy: 'seed', updatedBy: 'seed'
      });
      await db.collection('properties').doc(approvedId).set(standardFields({
        id: approvedId, agentId: UIDS.agentA, ownerId: null, status: 'approved',
        title: 'Approved Villa', type: 'Villa', district: 'Gasabo', sector: 'Kimironko',
        price: 60000000, bedrooms: 4, bathrooms: 3, area: 350,
        description: 'Seed fixture — already approved', amenities: [], images: [], isVerified: true
      }));
    });
    const ctx = testEnv.authenticatedContext('p103_super_admin_test_user');
    await assertSucceeds(ctx.firestore().doc(`properties/${approvedId}`).update({ price: 65000000 }));
  });
});
