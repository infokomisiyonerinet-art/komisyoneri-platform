// P1-16 — admin/staff suspension governance review.
//
// This is a REVIEW task, not a behavior change: the audit's finding was
// that isActive:false does not revoke isAdmin()/isSuperAdmin()'s
// authority, and the task explicitly says "Do NOT automatically remove
// the recovery protection" — rules/firestore.rules' isAdmin() already
// documents why this is deliberate ("a corrupted isActive flag on the
// last Super Admin must never be able to brick the platform's own
// recovery path"). No rules were changed for this fix.
//
// What WAS missing, and is what this file exists to prove/pin down:
// 1. An end-to-end confirmation that ordinary staff suspension DOES
//    genuinely revoke write authority (the contrast that makes the
//    admin/super_admin exception meaningful, not just asserted).
// 2. An end-to-end confirmation that the admin/super_admin recovery path
//    genuinely still works while suspended.
// 3. Confirmation that isActive alone never GRANTS elevated authority to
//    a non-admin/staff role, regardless of its value — the "no ordinary
//    user can exploit it" requirement.
// No prior test file in this suite proved suspension's actual EFFECT
// end-to-end (10-super-admin-control-center.spec.js only covers WHO can
// flip the flag, not what flipping it does). The frontend half of this
// fix (index.html) adds a visible warning wherever a suspended
// admin/super_admin account is displayed, so this architectural fact is
// documented and monitored rather than a silent surprise — not
// separately testable by this rules-only emulator suite.
//
// This file does not modify tests/rules/seed.js — fixtures are local,
// following the same pattern as every other P0.x/P1.x file in this suite.

const { assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { makeTestEnv } = require('../testenv');
const { seed, UIDS, DOC_IDS } = require('../seed');

describe('P1-16 — emergency-access architecture (review, no logic change)', function () {
  this.timeout(20000);
  let testEnv;

  before(async () => { testEnv = await makeTestEnv(); });
  after(async () => { await testEnv.cleanup(); });
  beforeEach(async () => {
    await testEnv.clearFirestore();
    await seed(testEnv);
  });

  it('suspending a plain staff member (isActive:false) genuinely revokes their staff-tier authority — the real, effective control', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc(`users/${UIDS.hr}`).update({ isActive: false, status: 'suspended' });
    });
    const ctx = testEnv.authenticatedContext(UIDS.hr);
    await assertFails(ctx.firestore().doc(`properties/${DOC_IDS.property}`).update({ featured: true }));
  });

  it('the same account, while still active, CAN perform that action (contrast/regression)', async () => {
    const ctx = testEnv.authenticatedContext(UIDS.hr);
    await assertSucceeds(ctx.firestore().doc(`properties/${DOC_IDS.property}`).update({ featured: true }));
  });

  it('suspending a plain admin (isActive:false) does NOT revoke admin authority — the deliberate recovery-path protection', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc(`users/${UIDS.admin}`).update({ isActive: false, status: 'suspended' });
    });
    const ctx = testEnv.authenticatedContext(UIDS.admin);
    await assertSucceeds(ctx.firestore().doc(`properties/${DOC_IDS.property}`).update({ featured: true }));
  });

  it('suspending a super_admin (isActive:false) does NOT revoke Tier B authority either — same recovery-path protection', async () => {
    const SA_UID = 'p116_super_admin_test_user';
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const bgDb = ctx.firestore();
      await bgDb.collection('users').doc(SA_UID).set({
        id: SA_UID, uid: SA_UID, role: 'super_admin', displayName: 'Super Admin Test',
        email: SA_UID + '@test.local', phone: '+250700000000', isActive: false, status: 'suspended',
        photoURL: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        createdBy: 'seed', updatedBy: 'seed'
      });
      await bgDb.collection('strategyDocuments').doc('p116_strategy_doc').set({
        id: 'p116_strategy_doc', title: 'Test', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        createdBy: 'seed', updatedBy: 'seed', status: 'active', isActive: true
      });
    });
    const ctx = testEnv.authenticatedContext(SA_UID);
    await assertSucceeds(ctx.firestore().doc('strategyDocuments/p116_strategy_doc').update({ title: 'Updated by suspended super_admin' }));
  });

  it('a suspended client (isActive:false, the ordinary/expected direction) remains fully denied, same as before — no exploitable inversion', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc(`users/${UIDS.client}`).update({ isActive: false });
    });
    const ctx = testEnv.authenticatedContext(UIDS.client);
    await assertFails(ctx.firestore().doc(`properties/${DOC_IDS.property}`).update({ featured: true }));
  });

  it('a client with isActive explicitly forced true still gains no elevated authority — isActive alone never GRANTS access, only ever restricts it', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc(`users/${UIDS.client}`).update({ isActive: true });
    });
    const ctx = testEnv.authenticatedContext(UIDS.client);
    await assertFails(ctx.firestore().doc(`properties/${DOC_IDS.property}`).update({ featured: true }));
  });
});
