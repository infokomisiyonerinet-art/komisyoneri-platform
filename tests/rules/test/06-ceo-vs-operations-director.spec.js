// CEO vs Operations Director governance boundary (rules/firestore.rules'
// isCEO()/isDirector()/isSeniorManager() section). 'director' is this app's
// real "Operations Director" role value — see the plan file's audit notes
// for why (no separate executiveLevel/department field exists anywhere in
// this codebase; role IS the permission tier throughout).
//
// The Cloud-Function-driven side of the /approvals workflow (onApprovalCreated
// setting serverVerified:true, onApprovalDecided performing the actual
// privileged write to the target collection) is NOT exercised here — this
// suite only runs the Firestore emulator, not the Functions emulator. What
// IS fully testable and tested below: no client (CEO included) can ever set
// serverVerified via an update, and CEO's approval transition is only legal
// once serverVerified is already true (the same structural guarantee proven
// for payout_requests in 02-p0-regression-guards.spec.js).

const { assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { makeTestEnv } = require('../testenv');
const { seed, UIDS, DOC_IDS, DIRECTOR_BUDGET_LIMIT } = require('../seed');

describe('CEO vs Operations Director permission boundaries', function () {
  this.timeout(20000);
  let testEnv;

  before(async () => { testEnv = await makeTestEnv(); });
  after(async () => { await testEnv.cleanup(); });
  beforeEach(async () => {
    await testEnv.clearFirestore();
    await seed(testEnv);
  });

  describe('CEO-only collections (shareStructure, governanceDocuments, companyRegistration, loansAndAssetDisposals, seniorStaffActions)', () => {
    const ceoOnlyDocs = [
      ['shareStructure', DOC_IDS.shareStructure],
      ['governanceDocuments', DOC_IDS.governanceDoc],
      ['companyRegistration', DOC_IDS.companyRegistration],
      ['loansAndAssetDisposals', DOC_IDS.loanDisposal],
      ['seniorStaffActions', DOC_IDS.seniorStaffAction]
    ];

    ceoOnlyDocs.forEach(([col, id]) => {
      it(`CEO CAN write to ${col}`, async () => {
        const ctx = testEnv.authenticatedContext(UIDS.ceo);
        await assertSucceeds(ctx.firestore().doc(`${col}/${id}`).update({ updatedBy: UIDS.ceo }));
      });

      it(`Operations Director CANNOT write to ${col}`, async () => {
        const ctx = testEnv.authenticatedContext(UIDS.director);
        await assertFails(ctx.firestore().doc(`${col}/${id}`).update({ updatedBy: UIDS.director }));
      });

      it(`Operations Director CANNOT read ${col}`, async () => {
        const ctx = testEnv.authenticatedContext(UIDS.director);
        await assertFails(ctx.firestore().doc(`${col}/${id}`).get());
      });
    });
  });

  describe('CEO-write / staff-read collections (strategyDocuments, majorContracts)', () => {
    it('Operations Director CAN read strategyDocuments', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.director);
      await assertSucceeds(ctx.firestore().doc(`strategyDocuments/${DOC_IDS.strategyDoc}`).get());
    });

    it('Operations Director CAN read majorContracts', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.director);
      await assertSucceeds(ctx.firestore().doc(`majorContracts/${DOC_IDS.majorContract}`).get());
    });

    it('Operations Director CANNOT write to strategyDocuments', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.director);
      await assertFails(ctx.firestore().doc(`strategyDocuments/${DOC_IDS.strategyDoc}`).update({ updatedBy: UIDS.director }));
    });

    it('CEO CAN write to strategyDocuments', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.ceo);
      await assertSucceeds(ctx.firestore().doc(`strategyDocuments/${DOC_IDS.strategyDoc}`).update({ updatedBy: UIDS.ceo }));
    });
  });

  describe('Operations Director normal scope (dailyOperations, reports, suggestions, regular staff)', () => {
    it('Operations Director CAN manage dailyOperations', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.director);
      await assertSucceeds(ctx.firestore().doc(`dailyOperations/${DOC_IDS.dailyOp}`).update({ note: 'updated' }));
    });

    it('Operations Director CAN manage reports', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.director);
      await assertSucceeds(ctx.firestore().doc(`reports/${DOC_IDS.report}`).update({ title: 'updated' }));
    });

    it('Operations Director CAN manage suggestions', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.director);
      await assertSucceeds(ctx.firestore().doc(`suggestions/${DOC_IDS.suggestion}`).update({ text: 'updated' }));
    });

    it('Operations Director CAN edit a regular agent\'s user doc (not a senior manager)', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.director);
      await assertSucceeds(ctx.firestore().doc(`users/${UIDS.agentA}`).update({ status: 'active' }));
    });

    it('Operations Director CANNOT edit a senior manager\'s user doc (e.g. the HR manager)', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.director);
      await assertFails(ctx.firestore().doc(`users/${UIDS.hr}`).update({ status: 'active' }));
    });

    it('Operations Director CAN edit their own user doc even though director is a senior-manager role', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.director);
      await assertSucceeds(ctx.firestore().doc(`users/${UIDS.director}`).update({ status: 'active' }));
    });

    it('CEO (not itself a director) CAN still edit a senior manager\'s user doc — blanket staff-tier access is unaffected', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.ceo);
      await assertSucceeds(ctx.firestore().doc(`users/${UIDS.hr}`).update({ status: 'active' }));
    });
  });

  describe('budgetRequests — Operations Director\'s budgetApprovalLimit boundary', () => {
    it('Operations Director CAN approve a budgetRequest within their limit', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.director);
      await assertSucceeds(
        ctx.firestore().doc(`budgetRequests/${DOC_IDS.budgetRequestWithinLimit}`).update({ status: 'approved' })
      );
    });

    it('Operations Director CANNOT directly approve a budgetRequest above their limit', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.director);
      await assertFails(
        ctx.firestore().doc(`budgetRequests/${DOC_IDS.budgetRequestAboveLimit}`).update({ status: 'approved' })
      );
    });

    it('CEO CAN approve a budgetRequest above the director\'s limit', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.ceo);
      await assertSucceeds(
        ctx.firestore().doc(`budgetRequests/${DOC_IDS.budgetRequestAboveLimit}`).update({ status: 'approved' })
      );
    });

    it('an above-limit request instead routes through /approvals — Operations Director CAN create an approvals doc', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.director);
      await assertSucceeds(
        ctx.firestore().collection('approvals').add({
          id: 'new_budget_approval', type: 'budgetRequests', requestedBy: UIDS.director,
          requiredApprover: 'CEO', summaryFields: { title: 'Above-limit spend', amount: DIRECTOR_BUDGET_LIMIT + 5000 },
          status: 'pending', serverVerified: false, decidedBy: null, decidedAt: null, sourceDocRef: '',
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          createdBy: UIDS.director, updatedBy: UIDS.director, isActive: true
        })
      );
    });
  });

  describe('approvals — mirrors payout_requests\' P0.1 client-immutability pattern', () => {
    it('Operations Director CAN create an approvals doc for a restricted action, with correct unverified defaults', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.director);
      await assertSucceeds(
        ctx.firestore().collection('approvals').add({
          id: 'new_approval', type: 'loansAndAssetDisposals', requestedBy: UIDS.director,
          requiredApprover: 'CEO', summaryFields: { title: 'Sell old office equipment' },
          status: 'pending', serverVerified: false, decidedBy: null, decidedAt: null, sourceDocRef: '',
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          createdBy: UIDS.director, updatedBy: UIDS.director, isActive: true
        })
      );
    });

    it('Operations Director CANNOT create an approvals doc pre-marked serverVerified:true', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.director);
      await assertFails(
        ctx.firestore().collection('approvals').add({
          id: 'forged_approval', type: 'loansAndAssetDisposals', requestedBy: UIDS.director,
          requiredApprover: 'CEO', summaryFields: {}, status: 'pending', serverVerified: true,
          decidedBy: null, decidedAt: null, sourceDocRef: '',
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          createdBy: UIDS.director, updatedBy: UIDS.director, isActive: true
        })
      );
    });

    it('NO ONE (including CEO) can directly set serverVerified via a client update', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.ceo);
      await assertFails(
        ctx.firestore().doc(`approvals/${DOC_IDS.approvalUnverified}`).update({ serverVerified: true })
      );
    });

    it('CEO CANNOT approve an approval that has not been server-verified yet', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.ceo);
      await assertFails(
        ctx.firestore().doc(`approvals/${DOC_IDS.approvalUnverified}`).update({ status: 'approved' })
      );
    });

    it('CEO CAN approve an approval that has already been server-verified', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.ceo);
      await assertSucceeds(
        ctx.firestore().doc(`approvals/${DOC_IDS.approvalPending}`).update({ status: 'approved', decidedBy: UIDS.ceo })
      );
    });

    it('Operations Director CANNOT approve their own approval request, even server-verified', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.director);
      await assertFails(
        ctx.firestore().doc(`approvals/${DOC_IDS.approvalPending}`).update({ status: 'approved', decidedBy: UIDS.director })
      );
    });

    it('the requesting Director CAN read their own approval', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.director);
      await assertSucceeds(ctx.firestore().doc(`approvals/${DOC_IDS.approvalPending}`).get());
    });

    it('an unrelated agent CANNOT read someone else\'s approval', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.agentA);
      await assertFails(ctx.firestore().doc(`approvals/${DOC_IDS.approvalPending}`).get());
    });
  });
});
