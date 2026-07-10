// The highest-value file in this suite: every collection here carries a
// "P0"/"P0.1 security closure" comment in rules/firestore.rules documenting
// a REAL, previously-exploited bug. These tests guard against that exact
// class of regression ever silently coming back — not hypothetical gaps.

const { assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { makeTestEnv } = require('../testenv');
const { seed, UIDS, DOC_IDS } = require('../seed');

describe('P0 regression guards', function () {
  this.timeout(20000);
  let testEnv;

  before(async () => { testEnv = await makeTestEnv(); });
  after(async () => { await testEnv.cleanup(); });
  beforeEach(async () => {
    await testEnv.clearFirestore();
    await seed(testEnv);
  });

  describe('deals — P0.1: closed_won self-transition (money-laundering) block', () => {
    it('owning agent CAN update other fields/stage of their own deal', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.agentA);
      await assertSucceeds(
        ctx.firestore().doc(`deals/${DOC_IDS.deal}`).update({ pipelineStage: 'offer_made' })
      );
    });

    it('owning agent CANNOT self-transition their own deal to closed_won', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.agentA);
      await assertFails(
        ctx.firestore().doc(`deals/${DOC_IDS.deal}`).update({ pipelineStage: 'closed_won' })
      );
    });

    it('admin/staff CAN transition a deal to closed_won', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.admin);
      await assertSucceeds(
        ctx.firestore().doc(`deals/${DOC_IDS.deal}`).update({ pipelineStage: 'closed_won' })
      );
    });

    it('a deal CANNOT be created already closed_won', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.agentA);
      await assertFails(
        ctx.firestore().collection('deals').add({
          id: 'forged_deal', agentId: UIDS.agentA, clientId: UIDS.client,
          pipelineStage: 'closed_won', agreedPrice: 99999999, dealType: 'sale',
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          createdBy: UIDS.agentA, updatedBy: UIDS.agentA, status: 'active', isActive: true
        })
      );
    });

    it('a client CAN create a deal naming themselves as clientId (buyer-initiated)', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.client);
      await assertSucceeds(
        ctx.firestore().collection('deals').add({
          id: 'buyer_deal', agentId: UIDS.agentA, clientId: UIDS.client,
          pipelineStage: 'new', agreedPrice: 30000000, dealType: 'sale',
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          createdBy: UIDS.client, updatedBy: UIDS.client, status: 'active', isActive: true
        })
      );
    });

    it('a bystander (neither agentId nor clientId) CANNOT create a deal between two other people', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.agentB);
      await assertFails(
        ctx.firestore().collection('deals').add({
          id: 'fabricated_deal', agentId: UIDS.agentA, clientId: UIDS.client,
          pipelineStage: 'new', agreedPrice: 30000000, dealType: 'sale',
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          createdBy: UIDS.agentB, updatedBy: UIDS.agentB, status: 'active', isActive: true
        })
      );
    });
  });

  describe('commissions — P0: forge-an-approved-commission block', () => {
    it('authenticated user CAN create a commission with status "pending"', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.agentA);
      await assertSucceeds(
        ctx.firestore().collection('commissions').add({
          id: 'new_comm', agentId: UIDS.agentA, dealId: DOC_IDS.deal, status: 'pending',
          totalCommission: 1000000, agentShare: 800000, companyShare: 200000,
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          createdBy: UIDS.agentA, updatedBy: UIDS.agentA, isActive: true
        })
      );
    });

    it('authenticated user CANNOT create a commission already "approved"', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.agentA);
      await assertFails(
        ctx.firestore().collection('commissions').add({
          id: 'forged_comm', agentId: UIDS.agentA, dealId: DOC_IDS.deal, status: 'approved',
          totalCommission: 99999999, agentShare: 99999999, companyShare: 0,
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          createdBy: UIDS.agentA, updatedBy: UIDS.agentA, isActive: true
        })
      );
    });

    it('agent CANNOT self-approve their own commission', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.agentA);
      await assertFails(
        ctx.firestore().doc(`commissions/${DOC_IDS.commission}`).update({ status: 'approved' })
      );
    });

    it('admin CAN approve a commission', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.admin);
      await assertSucceeds(
        ctx.firestore().doc(`commissions/${DOC_IDS.commission}`).update({ status: 'approved' })
      );
    });
  });

  describe('payout_requests — P0.1: serverVerified/verifiedAmount/verifiedAt client-immutability', () => {
    it('agent CAN create their own payout request with correct unverified defaults', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.agentA);
      await assertSucceeds(
        ctx.firestore().collection('payout_requests').add({
          id: 'new_payout', agentId: UIDS.agentA, amount: 500000, status: 'pending',
          serverVerified: false, verifiedAmount: 0, verifiedAt: null, commissionIds: [],
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          createdBy: UIDS.agentA, updatedBy: UIDS.agentA, isActive: true
        })
      );
    });

    it('agent CANNOT create a payout request pre-marked serverVerified:true', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.agentA);
      await assertFails(
        ctx.firestore().collection('payout_requests').add({
          id: 'forged_payout', agentId: UIDS.agentA, amount: 99999999, status: 'pending',
          serverVerified: true, verifiedAmount: 99999999, verifiedAt: new Date().toISOString(), commissionIds: [],
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          createdBy: UIDS.agentA, updatedBy: UIDS.agentA, isActive: true
        })
      );
    });

    it('agent CANNOT create a payout request on another agent\'s behalf', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.agentB);
      await assertFails(
        ctx.firestore().collection('payout_requests').add({
          id: 'other_agent_payout', agentId: UIDS.agentA, amount: 500000, status: 'pending',
          serverVerified: false, verifiedAmount: 0, verifiedAt: null, commissionIds: [],
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          createdBy: UIDS.agentB, updatedBy: UIDS.agentB, isActive: true
        })
      );
    });

    it('agent CAN cancel their own still-pending payout request', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.agentA);
      await assertSucceeds(
        ctx.firestore().doc(`payout_requests/${DOC_IDS.payoutRequest}`).update({ status: 'cancelled' })
      );
    });

    it('agent CANNOT approve their own payout request', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.agentA);
      await assertFails(
        ctx.firestore().doc(`payout_requests/${DOC_IDS.payoutRequest}`).update({ status: 'approved' })
      );
    });

    it('admin CANNOT approve a payout request that has not been server-verified yet', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.admin);
      await assertFails(
        ctx.firestore().doc(`payout_requests/${DOC_IDS.payoutRequest}`).update({ status: 'approved' })
      );
    });

    it('NO ONE (including admin) can directly set serverVerified via a client update', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.admin);
      await assertFails(
        ctx.firestore().doc(`payout_requests/${DOC_IDS.payoutRequest}`).update({
          serverVerified: true, verifiedAmount: 1600000, verifiedAt: new Date().toISOString()
        })
      );
    });
  });

  describe('invoices — P0: forge-paid/refunded block', () => {
    it('authenticated user CAN create an invoice as "draft"', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.agentA);
      await assertSucceeds(
        ctx.firestore().collection('invoices').add({
          id: 'new_inv', billedTo: UIDS.client, clientId: UIDS.client, status: 'draft', amount: 100000,
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          createdBy: UIDS.agentA, updatedBy: UIDS.agentA, isActive: true
        })
      );
    });

    it('authenticated user CANNOT create an invoice already marked "paid"', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.agentA);
      await assertFails(
        ctx.firestore().collection('invoices').add({
          id: 'forged_inv', billedTo: UIDS.client, clientId: UIDS.client, status: 'paid', amount: 999999,
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          createdBy: UIDS.agentA, updatedBy: UIDS.agentA, isActive: true
        })
      );
    });

    it('non-staff CANNOT update an invoice (e.g. mark it paid)', async () => {
      const invId = 'update_test_inv';
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc(`invoices/${invId}`).set({
          id: invId, billedTo: UIDS.client, clientId: UIDS.client, status: 'sent', amount: 100000,
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          createdBy: 'seed', updatedBy: 'seed', isActive: true
        });
      });
      const ctx = testEnv.authenticatedContext(UIDS.client);
      await assertFails(ctx.firestore().doc(`invoices/${invId}`).update({ status: 'paid' }));
    });

    it('admin CAN update an invoice', async () => {
      const invId = 'update_test_inv2';
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc(`invoices/${invId}`).set({
          id: invId, billedTo: UIDS.client, clientId: UIDS.client, status: 'sent', amount: 100000,
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          createdBy: 'seed', updatedBy: 'seed', isActive: true
        });
      });
      const ctx = testEnv.authenticatedContext(UIDS.admin);
      await assertSucceeds(ctx.firestore().doc(`invoices/${invId}`).update({ status: 'paid' }));
    });
  });

  describe('reviews / staff_reviews — list-query safety split', () => {
    it('authenticated user CAN create a partner review', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.client);
      await assertSucceeds(
        ctx.firestore().collection('reviews').add({
          id: 'new_review', subjectType: 'partner', subjectId: DOC_IDS.partner, authorId: UIDS.client,
          rating: 4, comment: 'Good', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          createdBy: UIDS.client, updatedBy: UIDS.client, status: 'active', isActive: true
        })
      );
    });

    it('authenticated user CANNOT create a "staff" review via the public reviews collection', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.client);
      await assertFails(
        ctx.firestore().collection('reviews').add({
          id: 'staff_via_reviews', subjectType: 'staff', subjectId: UIDS.hr, authorId: UIDS.client,
          rating: 1, comment: 'Should be rejected', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          createdBy: UIDS.client, updatedBy: UIDS.client, status: 'active', isActive: true
        })
      );
    });

    it('non-staff CANNOT create a staff_reviews document', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.client);
      await assertFails(
        ctx.firestore().collection('staff_reviews').add({
          id: 'forged_staff_review', staffId: UIDS.hr, reviewerId: UIDS.client, rating: 1,
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          createdBy: UIDS.client, updatedBy: UIDS.client, status: 'active', isActive: true
        })
      );
    });

    it('the reviewed staff member CAN read their own staff_review', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.hr);
      await assertSucceeds(ctx.firestore().doc(`staff_reviews/${DOC_IDS.staffReview}`).get());
    });

    // Not another staff-tier account (accountant/hr_manager/etc. can ALL
    // read this via the blanket isAdminOrStaff() clause — see
    // 03-staff-tier-uniform-trust.spec.js) — the real negative case is a
    // non-staff-tier person who also isn't the reviewed staffId.
    it('a non-staff person who isn\'t the reviewed staffId CANNOT read the staff_review', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.agentA);
      await assertFails(ctx.firestore().doc(`staff_reviews/${DOC_IDS.staffReview}`).get());
    });

    it('NO ONE (including admin) can ever update a staff_review — immutable', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.admin);
      await assertFails(ctx.firestore().doc(`staff_reviews/${DOC_IDS.staffReview}`).update({ rating: 5 }));
    });
  });
});
