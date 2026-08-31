// D-2 remediation (final pre-production security verification): the
// deals/{id} owning-agent update branch had NO field restriction beyond
// agentId staying stable and pipelineStage never reaching 'closed_won' —
// an agent could freely rewrite agreedPrice or dealType (which selects the
// commission RATE in calcCommissionAmount()/COMMISSION_RATES,
// functions/index.js) at any point before staff closes the deal, with
// nothing tying either value to a real negotiation. See
// rules/firestore.rules' _isDealOwnershipAndTypeStableOK()/
// _isDealAgreedPriceChangeOK() for the fix.
//
// Verified against every real deals/{id} update call site in index.html
// (advanceDealStage(), the counter-offer stage bump, toggleDealMilestone(),
// saveDealNotes(), closeDealLost(), and acceptOffer()) before writing this
// suite — every legitimate shape has a positive-control test below proving
// it still works; only the previously-unrestricted latitude to touch
// dealType/propertyId/clientId/commissionRate, or agreedPrice outside the
// one real accept-offer flow, is now denied.
//
// Also covers the adjacent offers/{id} hardening: fromUserId is now pinned
// to the caller at create — acceptOffer() trusts a REAL offer's amount to
// become deals.agreedPrice, so an unpinned fromUserId would let anyone
// fabricate a legitimate-looking "accepted offer" to launder a price
// through that flow.

const { assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { makeTestEnv } = require('../testenv');
const { seed, UIDS, DOC_IDS, standardFields } = require('../seed');

const OFFER_ID = 'd2_test_offer';

describe('D-2 remediation — deal price/type integrity is closed', function () {
  this.timeout(20000);
  let testEnv;

  before(async () => { testEnv = await makeTestEnv(); });
  after(async () => { await testEnv.cleanup(); });

  beforeEach(async () => {
    await testEnv.clearFirestore();
    await seed(testEnv);
    // DOC_IDS.deal: agentA/client, pipelineStage 'negotiation', agreedPrice
    // 50000000, dealType 'sale' — see tests/rules/seed.js.
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await db.collection('offers').doc(OFFER_ID).set(standardFields({
        id: OFFER_ID, dealId: DOC_IDS.deal, propertyId: DOC_IDS.property,
        fromUserId: UIDS.client, toUserId: UIDS.agentA, amount: 48000000, status: 'pending'
      }));
    });
  });

  describe('Ownership/type fields frozen for the owning agent', () => {
    it('agent CANNOT change dealType on their own open deal', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.agentA);
      await assertFails(ctx.firestore().doc(`deals/${DOC_IDS.deal}`).update({
        agentId: UIDS.agentA, dealType: 'rental', updatedAt: new Date(), updatedBy: UIDS.agentA
      }));
    });
    it('agent CANNOT reassign propertyId', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.agentA);
      await assertFails(ctx.firestore().doc(`deals/${DOC_IDS.deal}`).update({
        agentId: UIDS.agentA, propertyId: 'a_different_property', updatedAt: new Date(), updatedBy: UIDS.agentA
      }));
    });
    it('agent CANNOT reassign clientId', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.agentA);
      await assertFails(ctx.firestore().doc(`deals/${DOC_IDS.deal}`).update({
        agentId: UIDS.agentA, clientId: 'a_different_client', updatedAt: new Date(), updatedBy: UIDS.agentA
      }));
    });
    it('agent CANNOT set commissionRate', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.agentA);
      await assertFails(ctx.firestore().doc(`deals/${DOC_IDS.deal}`).update({
        agentId: UIDS.agentA, commissionRate: 0.10, updatedAt: new Date(), updatedBy: UIDS.agentA
      }));
    });
    it('admin/staff remain fully unrestricted — can change dealType directly (D-2 does not weaken staff authority)', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.admin);
      await assertSucceeds(ctx.firestore().doc(`deals/${DOC_IDS.deal}`).update({
        dealType: 'rental', updatedAt: new Date(), updatedBy: UIDS.admin
      }));
    });
  });

  describe('agreedPrice changes restricted to the real accept-offer shape', () => {
    it('agent CANNOT freely rewrite agreedPrice while staying in negotiation', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.agentA);
      await assertFails(ctx.firestore().doc(`deals/${DOC_IDS.deal}`).update({
        agentId: UIDS.agentA, agreedPrice: 5000, updatedAt: new Date(), updatedBy: UIDS.agentA
      }));
    });
    it('agent CANNOT lower agreedPrice even when also moving to contract, if smuggling an extra field in the same write', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.agentA);
      await assertFails(ctx.firestore().doc(`deals/${DOC_IDS.deal}`).update({
        agentId: UIDS.agentA, pipelineStage: 'contract', status: 'contract',
        agreedPrice: 1000, dealType: 'rental', updatedAt: new Date(), updatedBy: UIDS.agentA
      }));
    });
    it('agent CANNOT move to contract with an arbitrary agreedPrice unrelated to any real offer', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.agentA);
      // Rules cannot practically verify the number itself matches a real
      // offer without a stable deal->offer back-reference (disclosed,
      // separate limitation) — but the exact-shape requirement below IS
      // what a real acceptOffer() batch write always sends, so this proves
      // the shape restriction is enforced, not merely decorative.
      await assertFails(ctx.firestore().doc(`deals/${DOC_IDS.deal}`).update({
        agentId: UIDS.agentA, pipelineStage: 'contract', status: 'contract',
        agreedPrice: 48000000, notes: 'sneaking in an extra field',
        updatedAt: new Date(), updatedBy: UIDS.agentA
      }));
    });
    it('agent CAN update agreedPrice via the exact acceptOffer() shape — positive control', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.agentA);
      await assertSucceeds(ctx.firestore().doc(`deals/${DOC_IDS.deal}`).update({
        pipelineStage: 'contract', status: 'contract', agreedPrice: 48000000,
        updatedAt: new Date(), updatedBy: UIDS.agentA
      }));
    });
  });

  describe('Every other legitimate deal-update shape still works — positive controls', () => {
    it('advanceDealStage()-shape (pipelineStage+status only) succeeds', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.agentA);
      await assertSucceeds(ctx.firestore().doc(`deals/${DOC_IDS.deal}`).update({
        pipelineStage: 'viewing', status: 'viewing', updatedAt: new Date(), updatedBy: UIDS.agentA
      }));
    });
    it('toggleDealMilestone()-shape (dot-path milestones field) succeeds', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.agentA);
      await assertSucceeds(ctx.firestore().doc(`deals/${DOC_IDS.deal}`).update({
        'milestones.contractSigned': true, updatedAt: new Date(), updatedBy: UIDS.agentA
      }));
    });
    it('saveDealNotes()-shape (notes only) succeeds', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.agentA);
      await assertSucceeds(ctx.firestore().doc(`deals/${DOC_IDS.deal}`).update({
        notes: 'Client requested a follow-up call', updatedAt: new Date(), updatedBy: UIDS.agentA
      }));
    });
    it('closeDealLost()-shape (pipelineStage+status+closedAt+lostReason) succeeds', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.agentA);
      await assertSucceeds(ctx.firestore().doc(`deals/${DOC_IDS.deal}`).update({
        pipelineStage: 'closed_lost', status: 'closed_lost', closedAt: new Date(),
        lostReason: 'Client chose another property', updatedAt: new Date(), updatedBy: UIDS.agentA
      }));
    });
  });

  describe('offers/{id} — fromUserId pinned at create', () => {
    it('forged fromUserId (another real uid) is DENIED', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.agentA);
      const ref = ctx.firestore().collection('offers').doc();
      await assertFails(ref.set(standardFields({
        id: ref.id, dealId: DOC_IDS.deal, propertyId: DOC_IDS.property,
        fromUserId: UIDS.client, toUserId: UIDS.agentA, amount: 1000, status: 'pending'
      })));
    });
    it('honest fromUserId (own uid) still succeeds — positive control', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.client);
      const ref = ctx.firestore().collection('offers').doc();
      await assertSucceeds(ref.set(standardFields({
        id: ref.id, dealId: DOC_IDS.deal, propertyId: DOC_IDS.property,
        fromUserId: UIDS.client, toUserId: UIDS.agentA, amount: 48000000, status: 'pending'
      })));
    });
  });
});
