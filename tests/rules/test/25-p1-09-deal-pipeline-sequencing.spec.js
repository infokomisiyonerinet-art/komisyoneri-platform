// P1-09 — server-side deal pipeline sequencing.
//
// deals/{id}'s pipelineStage previously had no value restriction at all
// beyond "not closed_won on the agent branch" — any permitted write
// (staff included, not just the owning agent) could jump straight from
// 'new' to 'contract', move backward, or set a nonexistent stage string.
// _isDealPipelineTransitionOK() (rules/firestore.rules) now models the
// real transition shapes actually used anywhere in index.html: one step
// forward through CRM_STAGES' fixed order, a direct jump to 'contract'
// from any stage (acceptOffer()'s batch write, paired with
// _isDealAgreedPriceChangeOK()'s separate agreedPrice pin), a direct jump
// to 'closed_lost' from any non-terminal stage (either party), a direct
// jump to 'closed_won' from any non-terminal stage but staff-only
// (closeDealWon(), already enforced elsewhere too), and an unconditional
// isAdmin() bypass for corrections.
//
// This file does not modify tests/rules/seed.js — fixtures are local,
// following the same pattern as every other P0.x/P1.x file in this suite.
// The shared seeded deal (DOC_IDS.deal) starts at pipelineStage
// 'negotiation' (seed.js) and is reused directly here.

const { assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { makeTestEnv } = require('../testenv');
const { seed, UIDS, DOC_IDS } = require('../seed');

describe('P1-09 — deal pipeline sequencing', function () {
  this.timeout(20000);
  let testEnv;

  before(async () => { testEnv = await makeTestEnv(); });
  after(async () => { await testEnv.cleanup(); });
  beforeEach(async () => {
    await testEnv.clearFirestore();
    await seed(testEnv);
  });

  it('owning agent CAN advance one real step forward (negotiation -> due_diligence) — ALLOWED', async () => {
    const ctx = testEnv.authenticatedContext(UIDS.agentA);
    await assertSucceeds(ctx.firestore().doc(`deals/${DOC_IDS.deal}`).update({
      pipelineStage: 'due_diligence', status: 'due_diligence', updatedAt: new Date().toISOString(), updatedBy: UIDS.agentA
    }));
  });

  it('owning agent CANNOT skip stages forward (negotiation -> contract, without agreedPrice) — DENIED (was allowed before P1-09)', async () => {
    const ctx = testEnv.authenticatedContext(UIDS.agentA);
    await assertFails(ctx.firestore().doc(`deals/${DOC_IDS.deal}`).update({
      pipelineStage: 'closing', updatedAt: new Date().toISOString(), updatedBy: UIDS.agentA
    }));
  });

  it('owning agent CANNOT move backward (negotiation -> qualified) — DENIED (was allowed before P1-09)', async () => {
    const ctx = testEnv.authenticatedContext(UIDS.agentA);
    await assertFails(ctx.firestore().doc(`deals/${DOC_IDS.deal}`).update({
      pipelineStage: 'qualified', updatedAt: new Date().toISOString(), updatedBy: UIDS.agentA
    }));
  });

  it('owning agent CANNOT set a nonexistent stage string — DENIED (was allowed before P1-09)', async () => {
    const ctx = testEnv.authenticatedContext(UIDS.agentA);
    await assertFails(ctx.firestore().doc(`deals/${DOC_IDS.deal}`).update({
      pipelineStage: 'made_up_stage', updatedAt: new Date().toISOString(), updatedBy: UIDS.agentA
    }));
  });

  it('acceptOffer()\'s real shape (direct jump to contract + agreedPrice) still works from any stage — ALLOWED (regression)', async () => {
    const ctx = testEnv.authenticatedContext(UIDS.agentA);
    await assertSucceeds(ctx.firestore().doc(`deals/${DOC_IDS.deal}`).update({
      pipelineStage: 'contract', status: 'contract', agreedPrice: 52000000,
      updatedAt: new Date().toISOString(), updatedBy: UIDS.agentA
    }));
  });

  it('either party CAN jump straight to closed_lost from any non-terminal stage — ALLOWED (regression)', async () => {
    const ctx = testEnv.authenticatedContext(UIDS.agentA);
    await assertSucceeds(ctx.firestore().doc(`deals/${DOC_IDS.deal}`).update({
      pipelineStage: 'closed_lost', status: 'closed_lost', lostReason: 'Client backed out',
      updatedAt: new Date().toISOString(), updatedBy: UIDS.agentA
    }));
  });

  it('the owning agent still CANNOT self-transition to closed_won — DENIED (unchanged P0.1 protection)', async () => {
    const ctx = testEnv.authenticatedContext(UIDS.agentA);
    await assertFails(ctx.firestore().doc(`deals/${DOC_IDS.deal}`).update({
      pipelineStage: 'closed_won', updatedAt: new Date().toISOString(), updatedBy: UIDS.agentA
    }));
  });

  it('admin/staff CAN jump straight to closed_won from any non-terminal stage — ALLOWED (regression, matches closeDealWon())', async () => {
    const ctx = testEnv.authenticatedContext(UIDS.admin);
    await assertSucceeds(ctx.firestore().doc(`deals/${DOC_IDS.deal}`).update({
      pipelineStage: 'closed_won', status: 'closed_won',
      updatedAt: new Date().toISOString(), updatedBy: UIDS.admin
    }));
  });

  it('plain staff (CEO — isAdminOrStaff() but NOT isAdmin(), no bypass) also CANNOT skip stages forward — DENIED (the actual P1-09 gap this closes: staff previously had zero sequencing restriction)', async () => {
    const ctx = testEnv.authenticatedContext(UIDS.ceo);
    await assertFails(ctx.firestore().doc(`deals/${DOC_IDS.deal}`).update({
      pipelineStage: 'closing', updatedAt: new Date().toISOString(), updatedBy: UIDS.ceo
    }));
  });

  it('super_admin CAN bypass the sequencing model entirely for a correction — ALLOWED (the privileged correction path this fix must preserve)', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().collection('users').doc('p109_super_admin_test_user').set({
        id: 'p109_super_admin_test_user', uid: 'p109_super_admin_test_user', role: 'super_admin',
        displayName: 'Super Admin Test', email: 'p109sa@test.local', phone: '+250700000000',
        isActive: true, status: 'active', photoURL: '',
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), createdBy: 'seed', updatedBy: 'seed'
      });
    });
    const ctx = testEnv.authenticatedContext('p109_super_admin_test_user');
    await assertSucceeds(ctx.firestore().doc(`deals/${DOC_IDS.deal}`).update({
      pipelineStage: 'new', status: 'new',
      updatedAt: new Date().toISOString(), updatedBy: 'p109_super_admin_test_user'
    }));
  });

  it('a write that never touches pipelineStage at all is unaffected — ALLOWED (saveDealNotes()-shape regression)', async () => {
    const ctx = testEnv.authenticatedContext(UIDS.agentA);
    await assertSucceeds(ctx.firestore().doc(`deals/${DOC_IDS.deal}`).update({
      notes: 'Client requested a follow-up call', updatedAt: new Date().toISOString(), updatedBy: UIDS.agentA
    }));
  });
});
