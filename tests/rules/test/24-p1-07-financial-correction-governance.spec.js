// P1-07 — financial correction governance.
//
// commissions/invoices/financeTransactions previously let their existing
// admin-authorized update branch rewrite the amount fields
// (totalCommission/agentShare/companyShare, totalAmount, amount
// respectively) with no distinction between an ordinary status transition
// and a silent, unreasoned correction. rules/firestore.rules now requires
// any write touching those specific fields to also carry a non-empty
// correctionReason in that same write, via the new
// _isAmountCorrectionReasoned() helper — mirroring the existing
// statusChangeReason pattern already used for plots. The frontend
// correction functions (correctCommissionAmount(), correctInvoiceAmount(),
// index.html) always send this field; this file proves the rule itself
// is the real backstop, not just client-side discipline.
//
// This file does not modify tests/rules/seed.js — fixtures are local,
// following the same pattern as every other P0.x/P1.x file in this suite.

const { assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { makeTestEnv } = require('../testenv');
const { seed, UIDS, DOC_IDS, standardFields } = require('../seed');

describe('P1-07 — financial correction governance (mandatory reason)', function () {
  this.timeout(20000);
  let testEnv;

  before(async () => { testEnv = await makeTestEnv(); });
  after(async () => { await testEnv.cleanup(); });
  beforeEach(async () => {
    await testEnv.clearFirestore();
    await seed(testEnv);
  });

  describe('commissions', () => {
    it('admin correcting totalCommission WITH a reason — ALLOWED', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.admin);
      await assertSucceeds(ctx.firestore().doc(`commissions/${DOC_IDS.commission}`).update({
        totalCommission: 2500000, agentShare: 2000000, companyShare: 500000,
        correctionReason: 'Deal value was recorded incorrectly',
        updatedAt: new Date().toISOString(), updatedBy: UIDS.admin
      }));
    });

    it('admin correcting totalCommission WITHOUT a reason — DENIED (was silently allowed before P1-07)', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.admin);
      await assertFails(ctx.firestore().doc(`commissions/${DOC_IDS.commission}`).update({
        totalCommission: 2500000, agentShare: 2000000, companyShare: 500000,
        updatedAt: new Date().toISOString(), updatedBy: UIDS.admin
      }));
    });

    it('admin correcting totalCommission with an EMPTY-STRING reason — DENIED', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.admin);
      await assertFails(ctx.firestore().doc(`commissions/${DOC_IDS.commission}`).update({
        totalCommission: 2500000, correctionReason: '',
        updatedAt: new Date().toISOString(), updatedBy: UIDS.admin
      }));
    });

    it('the ordinary pending->approved status transition still works with NO reason required (regression)', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.admin);
      await assertSucceeds(ctx.firestore().doc(`commissions/${DOC_IDS.commission}`).update({
        status: 'approved', approvedBy: 'Admin Test', updatedAt: new Date().toISOString(), updatedBy: UIDS.admin
      }));
    });
  });

  describe('invoices', () => {
    const ID = 'p107_invoice_test_doc';
    beforeEach(async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().collection('invoices').doc(ID).set(standardFields({
          id: ID, invoiceNo: 'INV-0001', billedTo: UIDS.client, clientEmail: '', clientAddress: '',
          dueDate: '2026-12-31', lineItems: [], subtotal: 100000, vatAmount: 18000, totalAmount: 118000,
          notes: '', status: 'sent'
        }));
      });
    });

    it('admin correcting totalAmount WITH a reason — ALLOWED', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.admin);
      await assertSucceeds(ctx.firestore().doc(`invoices/${ID}`).update({
        totalAmount: 125000, correctionReason: 'VAT was miscalculated',
        updatedAt: new Date().toISOString(), updatedBy: UIDS.admin
      }));
    });

    it('admin correcting totalAmount WITHOUT a reason — DENIED (was silently allowed before P1-07)', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.admin);
      await assertFails(ctx.firestore().doc(`invoices/${ID}`).update({
        totalAmount: 125000, updatedAt: new Date().toISOString(), updatedBy: UIDS.admin
      }));
    });

    it('the ordinary sent->paid status transition still works with NO reason required (regression)', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.admin);
      await assertSucceeds(ctx.firestore().doc(`invoices/${ID}`).update({
        status: 'paid', paidAt: new Date().toISOString(), updatedAt: new Date().toISOString(), updatedBy: UIDS.admin
      }));
    });

    it('submitInvoiceRefund()\'s real shape (refundAmount, not totalAmount) still works with no correctionReason required (regression)', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc(`invoices/${ID}`).update({ status: 'paid' });
      });
      const ctx = testEnv.authenticatedContext(UIDS.admin);
      await assertSucceeds(ctx.firestore().doc(`invoices/${ID}`).update({
        status: 'refunded', refundAmount: 50000, refundReason: 'Client cancelled after paying',
        refundedAt: new Date().toISOString(), updatedAt: new Date().toISOString(), updatedBy: UIDS.admin
      }));
    });
  });

  describe('financeTransactions', () => {
    it('Executive correcting amount WITH a reason — ALLOWED', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.director);
      await assertSucceeds(ctx.firestore().doc(`financeTransactions/${DOC_IDS.financeTxnWithin}`).update({
        amount: 500000, correctionReason: 'Wrong amount was entered originally',
        updatedAt: new Date().toISOString(), updatedBy: UIDS.director
      }));
    });

    it('Executive correcting amount WITHOUT a reason — DENIED (was silently allowed before P1-07)', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.director);
      await assertFails(ctx.firestore().doc(`financeTransactions/${DOC_IDS.financeTxnWithin}`).update({
        amount: 500000, updatedAt: new Date().toISOString(), updatedBy: UIDS.director
      }));
    });

    it('super_admin correcting amount WITHOUT a reason — DENIED', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().collection('users').doc('p107_super_admin_test_user').set({
          id: 'p107_super_admin_test_user', uid: 'p107_super_admin_test_user', role: 'super_admin',
          displayName: 'Super Admin Test', email: 'p107sa@test.local', phone: '+250700000000',
          isActive: true, status: 'active', photoURL: '',
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), createdBy: 'seed', updatedBy: 'seed'
        });
      });
      const ctx = testEnv.authenticatedContext('p107_super_admin_test_user');
      await assertFails(ctx.firestore().doc(`financeTransactions/${DOC_IDS.financeTxnWithin}`).update({
        amount: 500000, updatedAt: new Date().toISOString(), updatedBy: 'p107_super_admin_test_user'
      }));
    });

    it('a non-Executive edit touching an unrelated field with no reason still works (regression)', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.director);
      await assertSucceeds(ctx.firestore().doc(`financeTransactions/${DOC_IDS.financeTxnWithin}`).update({
        category: 'updated_category', updatedAt: new Date().toISOString(), updatedBy: UIDS.director
      }));
    });
  });
});
