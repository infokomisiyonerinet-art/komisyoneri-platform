// Final Management Org Chart — HR, Finance, Legal department collections +
// the structured reports system + deniedActions approval routing. Builds on
// the CEO vs Operations Director governance work (06-*.spec.js): isCEO()/
// isDirector()/isExecutive() plus the new inDept()/deptOfRole() helpers.
//
// department/jobTitle/reportsTo/deniedActions are DERIVED from role (see
// rules/firestore.rules' deptOfRole() and index.html's ROLE_DEPARTMENT) —
// there is no independently-trusted department field; the fixtures in
// seed.js stamp them for realism (matching what the admin panel actually
// writes) but the rules themselves only ever trust `role`.

const { assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { makeTestEnv } = require('../testenv');
const { seed, UIDS, DOC_IDS, FINANCE_BUDGET_LIMIT } = require('../seed');

describe('Final Org Chart — HR, Legal & Reports', function () {
  this.timeout(20000);
  let testEnv;

  before(async () => { testEnv = await makeTestEnv(); });
  after(async () => { await testEnv.cleanup(); });
  beforeEach(async () => {
    await testEnv.clearFirestore();
    await seed(testEnv);
  });

  describe('HR Manager — employeeRecords, recruitment (job_postings), salaries (payroll)', () => {
    it('HR Manager CAN read employeeRecords', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.hr);
      await assertSucceeds(ctx.firestore().doc(`employeeRecords/${DOC_IDS.employeeRecord}`).get());
    });

    it('HR Manager CAN write employeeRecords', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.hr);
      await assertSucceeds(ctx.firestore().doc(`employeeRecords/${DOC_IDS.employeeRecord}`).update({ note: 'updated' }));
    });

    it('a non-HR, non-executive person CANNOT read employeeRecords', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.agentA);
      await assertFails(ctx.firestore().doc(`employeeRecords/${DOC_IDS.employeeRecord}`).get());
    });

    it('HR Manager CAN read/write recruitment via job_postings (already isAdminOrStaff()-gated, no new collection needed)', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.hr);
      await assertSucceeds(
        ctx.firestore().collection('job_postings').add({
          id: 'new_posting', title: 'Test Role', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          createdBy: UIDS.hr, updatedBy: UIDS.hr, status: 'active', isActive: true
        })
      );
    });

    it('HR Manager CAN read payroll (salaries) like every other staff-tier role', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.hr);
      await assertSucceeds(ctx.firestore().doc(`payroll/${DOC_IDS.payroll}`).get());
    });

    it('HR Manager\'s DIRECT write to payroll (salaries) is DENIED — must route through approvals', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.hr);
      await assertFails(ctx.firestore().doc(`payroll/${DOC_IDS.payroll}`).update({ netSalary: 999999 }));
    });

    it('HR Manager CANNOT create a new payroll doc directly either', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.hr);
      await assertFails(
        ctx.firestore().collection('payroll').add({
          id: 'forged_payslip', userId: UIDS.marketing, period: '2026-08', netSalary: 999999,
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          createdBy: UIDS.hr, updatedBy: UIDS.hr, status: 'active', isActive: true
        })
      );
    });

    it('CEO/admin CAN still write payroll directly — the HR carve-out does not affect other staff-tier roles', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.admin);
      await assertSucceeds(ctx.firestore().doc(`payroll/${DOC_IDS.payroll}`).update({ netSalary: 500000 }));
    });
  });

  describe('Legal Adviser — legalCompliance, contractReviews, majorContracts (read-only)', () => {
    it('Legal Adviser CAN read/write legalCompliance', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.legalAdviser);
      await assertSucceeds(ctx.firestore().doc(`legalCompliance/${DOC_IDS.legalComplianceDoc}`).update({ title: 'updated' }));
    });

    it('Legal Adviser CAN read/write contractReviews', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.legalAdviser);
      await assertSucceeds(ctx.firestore().doc(`contractReviews/${DOC_IDS.contractReview}`).update({ notes: 'updated' }));
    });

    it('Legal Adviser CAN read majorContracts (review access)', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.legalAdviser);
      await assertSucceeds(ctx.firestore().doc(`majorContracts/${DOC_IDS.majorContract}`).get());
    });

    it('Legal Adviser CANNOT write majorContracts — no signing authority, CEO-only stays unchanged', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.legalAdviser);
      await assertFails(ctx.firestore().doc(`majorContracts/${DOC_IDS.majorContract}`).update({ value: 1 }));
    });

    it('a non-Legal, non-executive person CANNOT read legalCompliance', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.agentA);
      await assertFails(ctx.firestore().doc(`legalCompliance/${DOC_IDS.legalComplianceDoc}`).get());
    });
  });

  describe('Director of Finance — financeTransactions spend limit, bankAccounts', () => {
    it('Director of Finance CAN create a financeTransaction within their budgetApprovalLimit', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.finance);
      await assertSucceeds(
        ctx.firestore().collection('financeTransactions').add({
          id: 'new_txn', amount: FINANCE_BUDGET_LIMIT - 1, description: 'Within limit',
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          createdBy: UIDS.finance, updatedBy: UIDS.finance, status: 'active', isActive: true
        })
      );
    });

    it('Director of Finance\'s financeTransaction ABOVE their budgetApprovalLimit is DENIED', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.finance);
      await assertFails(
        ctx.firestore().collection('financeTransactions').add({
          id: 'forged_txn', amount: FINANCE_BUDGET_LIMIT + 1, description: 'Above limit',
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          createdBy: UIDS.finance, updatedBy: UIDS.finance, status: 'active', isActive: true
        })
      );
    });

    it('CEO bypasses the financeTransactions limit', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.ceo);
      await assertSucceeds(
        ctx.firestore().collection('financeTransactions').add({
          id: 'ceo_txn', amount: FINANCE_BUDGET_LIMIT * 100, description: 'Executive bypass',
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          createdBy: UIDS.ceo, updatedBy: UIDS.ceo, status: 'active', isActive: true
        })
      );
    });

    it('Finance CANNOT create a bankAccount unilaterally', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.finance);
      await assertFails(
        ctx.firestore().collection('bankAccounts').add({
          id: 'forged_account', bankName: 'New Bank', accountNumber: '999',
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          createdBy: UIDS.finance, updatedBy: UIDS.finance, status: 'active', isActive: true
        })
      );
    });

    it('Finance CANNOT delete a bankAccount either', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.finance);
      await assertFails(ctx.firestore().doc(`bankAccounts/${DOC_IDS.bankAccount}`).delete());
    });

    it('CEO/Executive CAN create a bankAccount', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.ceo);
      await assertSucceeds(
        ctx.firestore().collection('bankAccounts').add({
          id: 'exec_account', bankName: 'New Bank', accountNumber: '999',
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          createdBy: UIDS.ceo, updatedBy: UIDS.ceo, status: 'active', isActive: true
        })
      );
    });

    it('Finance CAN read bankAccounts', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.finance);
      await assertSucceeds(ctx.firestore().doc(`bankAccounts/${DOC_IDS.bankAccount}`).get());
    });
  });

  describe('Structured reports — recipients-scoped visibility', () => {
    it('a report submitted by Chief Broker correctly appears for Operations Director (recipients array-contains)', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.director);
      const query = ctx.firestore().collection('reports').where('recipients', 'array-contains', UIDS.director);
      await assertSucceeds(query.get());
      const snap = await query.get();
      if (!snap.docs.some((d) => d.id === DOC_IDS.reportFromChiefBroker)) {
        throw new Error('Expected Chief Broker\'s report to be visible to Operations Director');
      }
    });

    it('a report submitted by Director of Finance (reportsTo=[CEO, OperationsDirector]) is readable by BOTH recipients', async () => {
      const ceoCtx = testEnv.authenticatedContext(UIDS.ceo);
      const dirCtx = testEnv.authenticatedContext(UIDS.director);
      await assertSucceeds(ceoCtx.firestore().doc(`reports/${DOC_IDS.reportFromFinanceDirector}`).get());
      await assertSucceeds(dirCtx.firestore().doc(`reports/${DOC_IDS.reportFromFinanceDirector}`).get());
    });

    it('an unrelated third party (not submitter, not recipient, not executive) CANNOT read a report', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.agentA);
      await assertFails(ctx.firestore().doc(`reports/${DOC_IDS.reportFromChiefBroker}`).get());
    });

    it('the Chief Broker (submitter) CAN read their own submitted report', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.chiefBroker);
      await assertSucceeds(ctx.firestore().doc(`reports/${DOC_IDS.reportFromChiefBroker}`).get());
    });

    it('Chief Broker CAN submit a new report to their reportsTo (Operations Director)', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.chiefBroker);
      await assertSucceeds(
        ctx.firestore().collection('reports').add({
          id: 'new_report', submittedBy: UIDS.chiefBroker, department: 'Brokerage',
          reportType: 'Daily', reportCategory: 'Daily Cash Report', recipients: [UIDS.director],
          content: 'Test', status: 'submitted',
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          createdBy: UIDS.chiefBroker, updatedBy: UIDS.chiefBroker, isActive: true
        })
      );
    });

    it('a staff member CANNOT submit a report claiming a different submittedBy', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.chiefBroker);
      await assertFails(
        ctx.firestore().collection('reports').add({
          id: 'forged_report', submittedBy: UIDS.marketing, department: 'Brokerage',
          reportType: 'Daily', reportCategory: 'Forged', recipients: [UIDS.director],
          content: 'Test', status: 'submitted',
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          createdBy: UIDS.chiefBroker, updatedBy: UIDS.chiefBroker, isActive: true
        })
      );
    });
  });

  describe('deniedActions approval routing — routedTo generalization', () => {
    it('HR CAN create an approvals doc (payroll type) routed to their reportsTo', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.hr);
      await assertSucceeds(
        ctx.firestore().collection('approvals').add({
          id: 'new_salary_approval', type: 'payroll', actionType: 'change_salaries_unapproved',
          requestedBy: UIDS.hr, routedTo: [UIDS.director, UIDS.ceo], requiredApprover: 'director,ceo',
          summaryFields: { title: 'Salary change' }, status: 'pending', serverVerified: false,
          decidedBy: null, decidedAt: null, sourceDocRef: '', payload: {},
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          createdBy: UIDS.hr, updatedBy: UIDS.hr, isActive: true
        })
      );
    });

    it('Operations Director (in routedTo, NOT CEO) CAN decide a server-verified deniedActions approval', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.director);
      await assertSucceeds(
        ctx.firestore().doc(`approvals/${DOC_IDS.payrollApprovalVerified}`).update({ status: 'approved', decidedBy: UIDS.director })
      );
    });

    it('CEO (also in routedTo) CAN decide the same approval', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.ceo);
      await assertSucceeds(
        ctx.firestore().doc(`approvals/${DOC_IDS.payrollApprovalVerified}`).update({ status: 'approved', decidedBy: UIDS.ceo })
      );
    });

    it('someone NOT in routedTo and not CEO CANNOT decide it', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.marketing);
      await assertFails(
        ctx.firestore().doc(`approvals/${DOC_IDS.payrollApprovalVerified}`).update({ status: 'approved', decidedBy: UIDS.marketing })
      );
    });

    it('existing CEO-only approval types (no routedTo field) still require isCEO() — routedTo generalization is additive only', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.director);
      await assertFails(
        ctx.firestore().doc(`approvals/${DOC_IDS.approvalPending}`).update({ status: 'approved', decidedBy: UIDS.director })
      );
    });
  });

  describe('the 3 net-new roles are recognized as staff-tier (isAdminOrStaff()), not just added to seed.js', () => {
    // rules/firestore.rules doesn't govern client-side routing at all —
    // "login redirect" in this codebase actually resolves to the shared
    // dashboard shell (index.html's ROLE_TIERS.STAFF / go('dashboard')),
    // gated by the same isAdminOrStaff() role list asserted here. The 6
    // pre-existing roles (ceo/director/accountant/chief_broker/
    // marketing_manager/hr_manager) are already covered by earlier specs;
    // only the 3 net-new ones need a fresh assertion.
    it('Customer Support Manager (new role) is staff-tier — can read auditlogs', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.csManager);
      await assertSucceeds(ctx.firestore().collection('auditlogs').limit(1).get());
    });

    it('IT / Product Manager (new role) is staff-tier — can read auditlogs', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.itManager);
      await assertSucceeds(ctx.firestore().collection('auditlogs').limit(1).get());
    });

    it('Legal Adviser (new role) is staff-tier — can read auditlogs', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.legalAdviser);
      await assertSucceeds(ctx.firestore().collection('auditlogs').limit(1).get());
    });
  });
});
