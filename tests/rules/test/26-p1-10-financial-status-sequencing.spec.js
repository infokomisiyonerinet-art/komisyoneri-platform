// P1-10 — commission/invoice/budget-request status sequencing.
//
// All three collections previously let their existing admin-authorized
// update branch set `status` to any value with no transition validation —
// a write could set a commission straight to 'paid' from 'pending'
// (skipping the approval step), an invoice straight to 'paid' from
// 'refunded', or a budget request straight to 'approved' from 'rejected'.
// _isCommissionStatusTransitionOK()/_isInvoiceStatusTransitionOK()/
// _isBudgetRequestStatusTransitionOK() (rules/firestore.rules) now model
// the real transition shapes each collection's own frontend call sites
// actually use, with an admin/CEO/super_admin correction bypass.
//
// This file does not modify tests/rules/seed.js — fixtures are local,
// following the same pattern as every other P0.x/P1.x file in this suite.

const { assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { makeTestEnv } = require('../testenv');
const { seed, UIDS, DOC_IDS, standardFields } = require('../seed');

describe('P1-10 — financial status sequencing', function () {
  this.timeout(20000);
  let testEnv;

  before(async () => { testEnv = await makeTestEnv(); });
  after(async () => { await testEnv.cleanup(); });
  beforeEach(async () => {
    await testEnv.clearFirestore();
    await seed(testEnv);
  });

  describe('commissions (pending -> approved/rejected -> paid)', () => {
    // isAdmin() (role 'admin'/'super_admin') unconditionally bypasses the
    // new sequencing check by design (the required correction path) — so
    // proving the check itself works requires a staff-tier actor who is
    // NOT isAdmin(): 'accountant' (UIDS.finance) granted commissions.manage
    // via role_permissions, same as a real non-admin Finance user would be.
    beforeEach(async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc('role_permissions/accountant').set({
          role: 'accountant', permissions: ['commissions.manage'],
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), createdBy: 'seed', updatedBy: 'seed'
        });
      });
    });

    it('pending -> approved — ALLOWED (real submitCommissionDecision() shape)', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.finance);
      await assertSucceeds(ctx.firestore().doc(`commissions/${DOC_IDS.commission}`).update({
        status: 'approved', approvedBy: 'Finance Test', updatedAt: new Date().toISOString(), updatedBy: UIDS.finance
      }));
    });

    it('pending -> paid directly — DENIED (the exact gap the task calls out; was allowed before P1-10)', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.finance);
      await assertFails(ctx.firestore().doc(`commissions/${DOC_IDS.commission}`).update({
        status: 'paid', paidAt: new Date().toISOString(), updatedAt: new Date().toISOString(), updatedBy: UIDS.finance
      }));
    });

    it('approved -> paid — ALLOWED (real markCommissionPaid() shape) once actually approved', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc(`commissions/${DOC_IDS.commission}`).update({ status: 'approved' });
      });
      const ctx = testEnv.authenticatedContext(UIDS.finance);
      await assertSucceeds(ctx.firestore().doc(`commissions/${DOC_IDS.commission}`).update({
        status: 'paid', paidAt: new Date().toISOString(), updatedAt: new Date().toISOString(), updatedBy: UIDS.finance
      }));
    });

    it('rejected -> approved — DENIED (no backward/lateral move)', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc(`commissions/${DOC_IDS.commission}`).update({ status: 'rejected' });
      });
      const ctx = testEnv.authenticatedContext(UIDS.finance);
      await assertFails(ctx.firestore().doc(`commissions/${DOC_IDS.commission}`).update({
        status: 'approved', updatedAt: new Date().toISOString(), updatedBy: UIDS.finance
      }));
    });

    it('admin retains its unconditional correction bypass — ALLOWED (regression, the required privileged path)', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.admin);
      await assertSucceeds(ctx.firestore().doc(`commissions/${DOC_IDS.commission}`).update({
        status: 'paid', paidAt: new Date().toISOString(), updatedAt: new Date().toISOString(), updatedBy: UIDS.admin
      }));
    });
  });

  describe('invoices (draft/sent -> sent/paid/cancelled, paid -> refunded)', () => {
    const ID = 'p110_invoice_test_doc';
    beforeEach(async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().collection('invoices').doc(ID).set(standardFields({
          id: ID, invoiceNo: 'INV-0002', billedTo: UIDS.client, clientEmail: '', clientAddress: '',
          dueDate: '2026-12-31', lineItems: [], subtotal: 100000, vatAmount: 18000, totalAmount: 118000,
          notes: '', status: 'draft'
        }));
      });
    });

    // isAdmin() (role 'admin'/'super_admin') unconditionally bypasses the
    // new sequencing check by design — so proving the check itself works
    // requires a staff-tier, non-admin actor: UIDS.hr ('hr_manager'),
    // which invoices' isAdminOrStaff()-only update rule already trusted
    // just as much as 'admin' before this fix.
    it('draft -> paid directly — ALLOWED (real UI lets "Mark as Paid" fire from draft too)', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.hr);
      await assertSucceeds(ctx.firestore().doc(`invoices/${ID}`).update({
        status: 'paid', paidAt: new Date().toISOString(), updatedAt: new Date().toISOString(), updatedBy: UIDS.hr
      }));
    });

    it('paid -> sent — DENIED (no "un-pay" path in the real app; was allowed before P1-10)', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc(`invoices/${ID}`).update({ status: 'paid' });
      });
      const ctx = testEnv.authenticatedContext(UIDS.hr);
      await assertFails(ctx.firestore().doc(`invoices/${ID}`).update({
        status: 'sent', updatedAt: new Date().toISOString(), updatedBy: UIDS.hr
      }));
    });

    it('paid -> refunded — ALLOWED (real submitInvoiceRefund() shape)', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc(`invoices/${ID}`).update({ status: 'paid' });
      });
      const ctx = testEnv.authenticatedContext(UIDS.hr);
      await assertSucceeds(ctx.firestore().doc(`invoices/${ID}`).update({
        status: 'refunded', refundAmount: 50000, refundReason: 'Client cancelled',
        refundedAt: new Date().toISOString(), updatedAt: new Date().toISOString(), updatedBy: UIDS.hr
      }));
    });

    it('refunded -> paid — DENIED (no backward move; was allowed before P1-10)', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc(`invoices/${ID}`).update({ status: 'refunded' });
      });
      const ctx = testEnv.authenticatedContext(UIDS.hr);
      await assertFails(ctx.firestore().doc(`invoices/${ID}`).update({
        status: 'paid', updatedAt: new Date().toISOString(), updatedBy: UIDS.hr
      }));
    });

    it('admin retains its unconditional correction bypass — ALLOWED (regression, the required privileged path)', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc(`invoices/${ID}`).update({ status: 'refunded' });
      });
      const ctx = testEnv.authenticatedContext(UIDS.admin);
      await assertSucceeds(ctx.firestore().doc(`invoices/${ID}`).update({
        status: 'paid', updatedAt: new Date().toISOString(), updatedBy: UIDS.admin
      }));
    });
  });

  describe('budgetRequests (pending -> approved/rejected)', () => {
    it('Director (capped, within limit): pending -> approved — ALLOWED (real transition)', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.director);
      await assertSucceeds(ctx.firestore().doc(`budgetRequests/${DOC_IDS.budgetRequestWithinLimit}`).update({
        status: 'approved', updatedAt: new Date().toISOString(), updatedBy: UIDS.director
      }));
    });

    it('Director: rejected -> approved — DENIED (no backward/lateral move)', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc(`budgetRequests/${DOC_IDS.budgetRequestWithinLimit}`).update({ status: 'rejected' });
      });
      const ctx = testEnv.authenticatedContext(UIDS.director);
      await assertFails(ctx.firestore().doc(`budgetRequests/${DOC_IDS.budgetRequestWithinLimit}`).update({
        status: 'approved', updatedAt: new Date().toISOString(), updatedBy: UIDS.director
      }));
    });

    it('CEO retains unconditional status authority (unaffected regression — matches CEO\'s existing uncapped decision authority)', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc(`budgetRequests/${DOC_IDS.budgetRequestWithinLimit}`).update({ status: 'rejected' });
      });
      const ctx = testEnv.authenticatedContext(UIDS.ceo);
      await assertSucceeds(ctx.firestore().doc(`budgetRequests/${DOC_IDS.budgetRequestWithinLimit}`).update({
        status: 'approved', updatedAt: new Date().toISOString(), updatedBy: UIDS.ceo
      }));
    });
  });
});
