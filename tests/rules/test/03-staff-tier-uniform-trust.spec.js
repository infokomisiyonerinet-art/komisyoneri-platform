// rules/firestore.rules' isAdminOrStaff() comment is explicit: "no
// per-branch or per-department write restriction exists for 'staff'
// either" — every staff-tier role (hr_manager, accountant, marketing_manager,
// etc.) has IDENTICAL trust level. This file documents that as intended
// behavior with real assertions, so a future "let's scope HR out of
// Finance data" change doesn't get silently reverted by someone assuming
// today's blanket access is a bug.
//
// One documented, deliberate exception since the CEO vs Operations Director
// work (see 06-ceo-vs-operations-director.spec.js): the users/{uid} update
// rule alone gives 'director' a narrower grant than the rest of the staff
// tier (isSeniorManager(uid) blocks editing another senior manager's own
// user doc) — every OTHER collection asserted uniform below (payroll,
// expenses, assets) is completely unaffected by that carve-out and remains
// uniform exactly as this file originally documented.

const { assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { makeTestEnv } = require('../testenv');
const { seed, UIDS, DOC_IDS } = require('../seed');

describe('Staff-tier uniform trust (no per-department restriction)', function () {
  this.timeout(20000);
  let testEnv;

  before(async () => { testEnv = await makeTestEnv(); });
  after(async () => { await testEnv.cleanup(); });
  beforeEach(async () => {
    await testEnv.clearFirestore();
    await seed(testEnv);
  });

  // payroll targets UIDS.client in the seed fixture — none of these three
  // staff accounts own it, so any successful read proves it's staff-tier
  // membership alone granting access, not doc ownership.
  ['hr', 'finance', 'marketing'].forEach((key) => {
    it(`${key} role (staff-tier) CAN read someone else's payroll doc`, async () => {
      const ctx = testEnv.authenticatedContext(UIDS[key]);
      await assertSucceeds(ctx.firestore().doc(`payroll/${DOC_IDS.payroll}`).get());
    });
  });

  it('a client CANNOT read someone else\'s payroll doc', async () => {
    const ctx = testEnv.authenticatedContext(UIDS.agentA);
    await assertFails(ctx.firestore().doc(`payroll/${DOC_IDS.payroll}`).get());
  });

  it('a user CAN read their own payroll doc even without a staff role', async () => {
    const ctx = testEnv.authenticatedContext(UIDS.client);
    await assertSucceeds(ctx.firestore().doc(`payroll/${DOC_IDS.payroll}`).get());
  });

  ['hr', 'finance', 'marketing'].forEach((key) => {
    it(`${key} role (staff-tier) CAN read the expenses collection`, async () => {
      const expId = 'expense_' + key;
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc(`expenses/${expId}`).set({
          id: expId, amount: 10000, category: 'office',
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          createdBy: 'seed', updatedBy: 'seed', status: 'active', isActive: true
        });
      });
      const ctx = testEnv.authenticatedContext(UIDS[key]);
      await assertSucceeds(ctx.firestore().doc(`expenses/${expId}`).get());
    });
  });

  it('a client CANNOT read the expenses collection', async () => {
    const expId = 'expense_denied';
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc(`expenses/${expId}`).set({
        id: expId, amount: 10000, category: 'office',
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        createdBy: 'seed', updatedBy: 'seed', status: 'active', isActive: true
      });
    });
    const ctx = testEnv.authenticatedContext(UIDS.agentA);
    await assertFails(ctx.firestore().doc(`expenses/${expId}`).get());
  });

  ['hr', 'finance', 'marketing'].forEach((key) => {
    it(`${key} role (staff-tier) CAN read the internal assets registry`, async () => {
      const assetId = 'asset_' + key;
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc(`assets/${assetId}`).set({
          id: assetId, name: 'Laptop', assignedTo: null,
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          createdBy: 'seed', updatedBy: 'seed', status: 'active', isActive: true
        });
      });
      const ctx = testEnv.authenticatedContext(UIDS[key]);
      await assertSucceeds(ctx.firestore().doc(`assets/${assetId}`).get());
    });
  });

  it('an agent CANNOT read the internal assets registry', async () => {
    const assetId = 'asset_denied';
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc(`assets/${assetId}`).set({
        id: assetId, name: 'Laptop', assignedTo: null,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        createdBy: 'seed', updatedBy: 'seed', status: 'active', isActive: true
      });
    });
    const ctx = testEnv.authenticatedContext(UIDS.agentA);
    await assertFails(ctx.firestore().doc(`assets/${assetId}`).get());
  });
});
