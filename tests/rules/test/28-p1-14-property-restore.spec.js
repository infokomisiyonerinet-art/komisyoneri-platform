// P1-14 — safe restore path for soft-deleted properties.
//
// Soft-deleted properties (isActive:false) were previously invisible to
// every admin query (adminRender() only ever fetched isActive==true) and
// had no restore path at all — once deleted, a listing was gone from
// every admin surface with no way back short of a direct Firestore
// console edit. restorePropertyFS() (index.html) now queries the
// opposite isActive value for a new "Deleted" admin tab and lets a
// confirmed, sanity-checked write flip isActive back to true.
// _isPropertyRestoreOK() (rules/firestore.rules) is the real boundary:
// restoring is Super-Admin-only, a deliberately higher bar than the
// ordinary isAdminOrStaff() authority that performs the soft-delete
// itself.
//
// This file does not modify tests/rules/seed.js — fixtures are local,
// following the same pattern as every other P0.x/P1.x file in this suite.

const { assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { makeTestEnv } = require('../testenv');
const { seed, UIDS, DOC_IDS, standardFields } = require('../seed');

describe('P1-14 — property restore workflow', function () {
  this.timeout(20000);
  let testEnv;

  before(async () => { testEnv = await makeTestEnv(); });
  after(async () => { await testEnv.cleanup(); });

  const DELETED_ID = 'p114_deleted_property_test_doc';

  beforeEach(async () => {
    await testEnv.clearFirestore();
    await seed(testEnv);
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await db.collection('users').doc('p114_super_admin_test_user').set({
        id: 'p114_super_admin_test_user', uid: 'p114_super_admin_test_user', role: 'super_admin',
        displayName: 'Super Admin Test', email: 'p114sa@test.local', phone: '+250700000000',
        isActive: true, status: 'active', photoURL: '',
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), createdBy: 'seed', updatedBy: 'seed'
      });
      await db.collection('properties').doc(DELETED_ID).set(standardFields({
        id: DELETED_ID, agentId: UIDS.agentA, ownerId: null, status: 'pending', isActive: false,
        title: 'Soft-Deleted Villa', type: 'Villa', district: 'Gasabo', sector: 'Kimironko',
        price: 40000000, bedrooms: 3, bathrooms: 2, area: 250,
        description: 'Seed fixture — soft-deleted', amenities: [], images: []
      }));
    });
  });

  it('super_admin CAN restore a soft-deleted property — ALLOWED', async () => {
    const ctx = testEnv.authenticatedContext('p114_super_admin_test_user');
    await assertSucceeds(ctx.firestore().doc(`properties/${DELETED_ID}`).update({
      isActive: true, updatedAt: new Date().toISOString(), updatedBy: 'p114_super_admin_test_user'
    }));
  });

  it('plain admin CANNOT restore a soft-deleted property — DENIED (the actual gap this closes; ordinary isAdminOrStaff() authority is not enough)', async () => {
    const ctx = testEnv.authenticatedContext(UIDS.admin);
    await assertFails(ctx.firestore().doc(`properties/${DELETED_ID}`).update({
      isActive: true, updatedAt: new Date().toISOString(), updatedBy: UIDS.admin
    }));
  });

  it('CEO CANNOT restore a soft-deleted property — DENIED (Super-Admin-only, not general Ultimate-Authority tier)', async () => {
    const ctx = testEnv.authenticatedContext(UIDS.ceo);
    await assertFails(ctx.firestore().doc(`properties/${DELETED_ID}`).update({
      isActive: true, updatedAt: new Date().toISOString(), updatedBy: UIDS.ceo
    }));
  });

  it('the owning agent CANNOT restore their own soft-deleted property — DENIED', async () => {
    const ctx = testEnv.authenticatedContext(UIDS.agentA);
    await assertFails(ctx.firestore().doc(`properties/${DELETED_ID}`).update({
      isActive: true, updatedAt: new Date().toISOString(), updatedBy: UIDS.agentA
    }));
  });

  it('plain admin retains unrestricted soft-delete authority (isActive true->false unaffected regression)', async () => {
    // Uses the seeded, genuinely-active DOC_IDS.property — flipping
    // an already-false isActive to false again would produce an empty
    // rules diff and trivially pass regardless of what the rule allows.
    const ctx = testEnv.authenticatedContext(UIDS.admin);
    await assertSucceeds(ctx.firestore().doc(`properties/${DOC_IDS.property}`).update({
      isActive: false, updatedAt: new Date().toISOString(), updatedBy: UIDS.admin
    }));
  });
});
