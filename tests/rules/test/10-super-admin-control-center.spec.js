// Super Admin Control Center — emergency account suspend/reactivate.
//
// The Control Center itself (index.html's #page-super-admin, exclusive to
// role === 'super_admin' via isSuperAdminExact()) is a UI-only gate: it
// introduces no new Firestore rule surface. Every read/write it performs
// goes through the existing isAdminOrStaff()/isAdmin()/hasPerm() rules,
// already exercised by the other 8 spec files in this suite. These tests
// cover the one genuinely new *use* of those existing rules this feature
// exercises: an admin/super_admin toggling isActive/status on ANY account,
// including senior staff (ceo, admin) — not previously exercised by any
// other spec file, which only test suspended accounts' own subsequent
// (lack of) authority, not the act of suspending someone else.

const { assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { makeTestEnv } = require('../testenv');
const { seed, UIDS } = require('../seed');

describe('Super Admin Control Center — emergency suspend/reactivate', function () {
  this.timeout(20000);
  let testEnv;

  before(async () => { testEnv = await makeTestEnv(); });
  after(async () => { await testEnv.cleanup(); });
  beforeEach(async () => {
    await testEnv.clearFirestore();
    await seed(testEnv);
  });

  it('super_admin CAN suspend a CEO account (isActive:false, status:suspended)', async () => {
    const ctx = testEnv.authenticatedContext(UIDS.admin); // seed's admin fixture has role 'admin'; role tier for isAdmin() covers both admin/super_admin identically
    await assertSucceeds(
      ctx.firestore().doc(`users/${UIDS.ceo}`).update({
        isActive: false, status: 'suspended', suspensionReason: 'Security review', updatedAt: new Date().toISOString()
      })
    );
  });

  it('admin CAN reactivate a previously suspended admin-tier account', async () => {
    await testEnv.withSecurityRulesDisabled(async (bgCtx) => {
      await bgCtx.firestore().doc(`users/${UIDS.director}`).update({ isActive: false, status: 'suspended' });
    });
    const ctx = testEnv.authenticatedContext(UIDS.admin);
    await assertSucceeds(
      ctx.firestore().doc(`users/${UIDS.director}`).update({
        isActive: true, status: 'active', suspensionReason: '', updatedAt: new Date().toISOString()
      })
    );
  });

  it('an agent (non-staff) CANNOT suspend another user\'s account', async () => {
    const ctx = testEnv.authenticatedContext(UIDS.agentA);
    await assertFails(
      ctx.firestore().doc(`users/${UIDS.agentB}`).update({ isActive: false, status: 'suspended' })
    );
  });

  it('a client CANNOT suspend their own account through this write shape', async () => {
    const ctx = testEnv.authenticatedContext(UIDS.client);
    await assertFails(
      ctx.firestore().doc(`users/${UIDS.client}`).update({ isActive: false, status: 'suspended' })
    );
  });
});
