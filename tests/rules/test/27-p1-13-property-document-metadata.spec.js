// P1-13 — property document metadata persistence.
//
// titleDeed/floors/parking/docLuc/docId/docPermit were collected by the
// Add/Edit Property form (prop-deed/prop-floors/prop-parking/prop-doc-luc/
// prop-doc-id/prop-doc-permit, index.html) and written into the local
// pd/u cache objects (so they persisted to localStorage) but were never
// included in _savePropToFirestoreFS()'s fsDoc or submitProperty()'s
// EDIT MODE update payload — silently discarded on every create AND
// edit. Both are fixed to actually forward these fields to Firestore, a
// pure frontend change this rules-only emulator suite can't invoke
// directly. What this verifies is the rules-governed part: the owning
// agent's self-edit allowlist (properties/{id} update) now permits these
// six fields (previously would have rejected the write the frontend fix
// now sends), and the approved-content CEO/Super-Admin gate
// (_isApprovedContentEditByNonCEO()) now also covers them, closing what
// would otherwise be a governance gap the moment these fields started
// actually reaching Firestore.
//
// This file does not modify tests/rules/seed.js — fixtures are local,
// following the same pattern as every other P0.x/P1.x file in this suite.

const { assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { makeTestEnv } = require('../testenv');
const { seed, UIDS, DOC_IDS, standardFields } = require('../seed');

describe('P1-13 — property document metadata persistence', function () {
  this.timeout(20000);
  let testEnv;

  before(async () => { testEnv = await makeTestEnv(); });
  after(async () => { await testEnv.cleanup(); });
  beforeEach(async () => {
    await testEnv.clearFirestore();
    await seed(testEnv);
  });

  it('owning agent CAN now persist titleDeed/floors/parking/docLuc/docId/docPermit on their own pending listing — ALLOWED (was rejected before P1-13)', async () => {
    const ctx = testEnv.authenticatedContext(UIDS.agentA);
    await assertSucceeds(ctx.firestore().doc(`properties/${DOC_IDS.property}`).update({
      titleDeed: 'TD-2026-0001', floors: '2', parking: '1',
      docLuc: 'https://drive.google.com/luc.pdf', docId: 'https://drive.google.com/id.pdf',
      docPermit: 'https://drive.google.com/permit.pdf',
      updatedAt: new Date().toISOString(), updatedBy: UIDS.agentA
    }));
  });

  it('owning agent still cannot smuggle an unrelated field alongside them — DENIED (allowlist still enforced)', async () => {
    const ctx = testEnv.authenticatedContext(UIDS.agentA);
    await assertFails(ctx.firestore().doc(`properties/${DOC_IDS.property}`).update({
      titleDeed: 'TD-2026-0001', agentId: UIDS.agentB,
      updatedAt: new Date().toISOString(), updatedBy: UIDS.agentA
    }));
  });

  describe('on an approved listing, these fields now fall under the CEO/Super-Admin-only content gate', () => {
    const APPROVED_ID = 'p113_approved_property_test_doc';
    beforeEach(async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().collection('properties').doc(APPROVED_ID).set(standardFields({
          id: APPROVED_ID, agentId: UIDS.agentA, ownerId: null, status: 'approved',
          title: 'Approved Villa', type: 'Villa', district: 'Gasabo', sector: 'Kimironko',
          price: 60000000, bedrooms: 4, bathrooms: 3, area: 350,
          description: 'Seed fixture — already approved', amenities: [], images: [], isVerified: true,
          titleDeed: '', floors: '', parking: ''
        }));
      });
    });

    it('CEO CAN edit titleDeed/floors/parking on an approved listing — ALLOWED', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.ceo);
      await assertSucceeds(ctx.firestore().doc(`properties/${APPROVED_ID}`).update({
        titleDeed: 'TD-2026-0002', floors: '3', parking: '2'
      }));
    });

    it('plain admin/staff CANNOT edit titleDeed on an approved listing — DENIED (the actual gap this closes — would have been ungoverned the moment P1-13 started persisting it)', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.admin);
      await assertFails(ctx.firestore().doc(`properties/${APPROVED_ID}`).update({ titleDeed: 'TD-HACKED' }));
    });

    it('admin/staff can still toggle unrelated non-content fields on the same approved listing (unaffected)', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.admin);
      await assertSucceeds(ctx.firestore().doc(`properties/${APPROVED_ID}`).update({ featured: true }));
    });
  });
});
