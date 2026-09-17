// P0.6 — targeted coverage for two of the four Super Admin Control Center
// audit fixes that touched rules/firestore.rules:
//
// FIX 1: _isApprovedContentEditByNonCEO() now also excludes isSuperAdmin(),
// mirroring the same isCEO()||isSuperAdmin() pattern used in 47 other
// places in this file — Super Admin can now edit an approved property
// listing's own content fields, which it could not do before this fix.
//
// FIX 4: offers/{id}'s party-branch update rule is now pinned to the exact
// pending->accepted/pending->rejected shape via _isOfferStatusChangeOK(),
// mirroring the deals D-2 pattern — neither party can rewrite amount/
// dealId/fromUserId/toUserId or set status to an arbitrary value anymore.
//
// (Fixes 2 and 3 are functions/index.js and index.html changes respectively
// — outside what this Firestore-rules-only emulator suite can exercise;
// see the PR description for how those two were verified.)
//
// This file does not modify tests/rules/seed.js — fixtures are local,
// following the same pattern as every other P0.x file in this suite.

const { assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { makeTestEnv } = require('../testenv');
const { seed, UIDS, standardFields } = require('../seed');

const SUPER_ADMIN_UID = 'p06_super_admin_test_user';
const APPROVED_PROPERTY_ID = 'p06_approved_property_test_doc';
const OFFER_ID = 'p06_offer_test_doc';
const BUYER_UID = 'p06_offer_buyer_test_user';

describe('P0.6 FIX 1 — Super Admin can edit approved property content', () => {
  let testEnv;
  before(async () => { testEnv = await makeTestEnv(); });
  after(async () => { await testEnv.cleanup(); });
  beforeEach(async () => {
    await testEnv.clearFirestore();
    await seed(testEnv);
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await db.collection('users').doc(SUPER_ADMIN_UID).set({
        id: SUPER_ADMIN_UID, uid: SUPER_ADMIN_UID, role: 'super_admin', displayName: 'Super Admin Test',
        email: SUPER_ADMIN_UID + '@test.local', phone: '+250700000000', isActive: true, status: 'active',
        photoURL: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        createdBy: 'seed', updatedBy: 'seed'
      });
      await db.collection('properties').doc(APPROVED_PROPERTY_ID).set(standardFields({
        id: APPROVED_PROPERTY_ID, agentId: UIDS.agentA, ownerId: null, status: 'approved',
        title: 'Approved Villa', type: 'Villa', district: 'Gasabo', sector: 'Kimironko',
        price: 60000000, bedrooms: 4, bathrooms: 3, area: 350,
        description: 'Seed fixture — already approved', amenities: [], images: [], isVerified: true
      }));
    });
  });

  it('super_admin CAN now edit content fields of an approved listing (was blocked before FIX 1)', async () => {
    const ctx = testEnv.authenticatedContext(SUPER_ADMIN_UID);
    await assertSucceeds(
      ctx.firestore().doc(`properties/${APPROVED_PROPERTY_ID}`).update({ price: 65000000, description: 'Updated by super admin' })
    );
  });

  it('CEO retains its pre-existing authority to edit approved-listing content (regression)', async () => {
    const ctx = testEnv.authenticatedContext(UIDS.ceo);
    await assertSucceeds(
      ctx.firestore().doc(`properties/${APPROVED_PROPERTY_ID}`).update({ price: 65000000 })
    );
  });

  it('plain admin (not super_admin, not CEO) is STILL blocked from editing approved-listing content (unchanged by FIX 1)', async () => {
    const ctx = testEnv.authenticatedContext(UIDS.admin);
    await assertFails(
      ctx.firestore().doc(`properties/${APPROVED_PROPERTY_ID}`).update({ price: 65000000 })
    );
  });

  it('admin/staff can still approve/reject/toggle non-content fields on an approved listing (unaffected by FIX 1)', async () => {
    const ctx = testEnv.authenticatedContext(UIDS.admin);
    await assertSucceeds(
      ctx.firestore().doc(`properties/${APPROVED_PROPERTY_ID}`).update({ featured: true })
    );
  });
});

describe('P0.6 FIX 4 — offers party branch frozen to the real accept/reject shape', () => {
  let testEnv;
  before(async () => { testEnv = await makeTestEnv(); });
  after(async () => { await testEnv.cleanup(); });
  beforeEach(async () => {
    await testEnv.clearFirestore();
    await seed(testEnv);
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await db.collection('users').doc(BUYER_UID).set({
        id: BUYER_UID, uid: BUYER_UID, role: 'client', displayName: 'Buyer Test',
        email: BUYER_UID + '@test.local', phone: '+250700000000', isActive: true, status: 'active',
        photoURL: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        createdBy: 'seed', updatedBy: 'seed'
      });
      await db.collection('offers').doc(OFFER_ID).set(standardFields({
        id: OFFER_ID, fromUserId: BUYER_UID, toUserId: UIDS.agentA, dealId: '',
        amount: 40000000, message: 'Seed offer fixture', status: 'pending'
      }));
    });
  });

  it('the legitimate pending->accepted transition still works, touching only status/updatedAt/updatedBy', async () => {
    const ctx = testEnv.authenticatedContext(UIDS.agentA);
    await assertSucceeds(
      ctx.firestore().doc(`offers/${OFFER_ID}`).update({ status: 'accepted' })
    );
  });

  it('the legitimate pending->rejected transition still works', async () => {
    const ctx = testEnv.authenticatedContext(UIDS.agentA);
    await assertSucceeds(
      ctx.firestore().doc(`offers/${OFFER_ID}`).update({ status: 'rejected' })
    );
  });

  it('the buyer (fromUserId party) CANNOT rewrite amount alongside a status change (was allowed before FIX 4)', async () => {
    const ctx = testEnv.authenticatedContext(BUYER_UID);
    await assertFails(
      ctx.firestore().doc(`offers/${OFFER_ID}`).update({ status: 'accepted', amount: 999999999 })
    );
  });

  it('the recipient (toUserId party) CANNOT rewrite dealId (was allowed before FIX 4)', async () => {
    const ctx = testEnv.authenticatedContext(UIDS.agentA);
    await assertFails(
      ctx.firestore().doc(`offers/${OFFER_ID}`).update({ status: 'accepted', dealId: 'some_other_deal' })
    );
  });

  it('a party CANNOT set status to an arbitrary value outside the valid transition set (was allowed before FIX 4)', async () => {
    const ctx = testEnv.authenticatedContext(BUYER_UID);
    await assertFails(
      ctx.firestore().doc(`offers/${OFFER_ID}`).update({ status: 'countered' })
    );
  });

  it('a party CANNOT rewrite amount alone with no status change (was allowed before FIX 4)', async () => {
    const ctx = testEnv.authenticatedContext(BUYER_UID);
    await assertFails(
      ctx.firestore().doc(`offers/${OFFER_ID}`).update({ amount: 1 })
    );
  });

  it('admin/staff retain full unrestricted update authority on offers (unaffected by FIX 4)', async () => {
    const ctx = testEnv.authenticatedContext(UIDS.admin);
    await assertSucceeds(
      ctx.firestore().doc(`offers/${OFFER_ID}`).update({ amount: 42000000, status: 'accepted' })
    );
  });
});
