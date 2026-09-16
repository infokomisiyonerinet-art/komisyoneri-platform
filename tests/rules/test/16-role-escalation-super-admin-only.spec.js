// P0.3 — Role Escalation Reconciliation.
//
// Narrows rules/firestore.rules' _agentGovernanceOK() so the unconditional
// bypass for changing a user's `role` field into 'admin'/'super_admin' now
// belongs to isSuperAdmin() alone — plain role:'admin' previously could
// mint new admin/super_admin accounts unconditionally (the same Ultimate-
// Authority gap _isEscalationToAdminRole() was originally written to close
// for CEO, per that function's own comment, but never closed for Admin
// itself). Plain admin is now folded into the same
// `!_isEscalationToAdminRole()` restriction CEO already had: both can still
// reassign any non-admin-tier role, neither can escalate a user into
// admin/super_admin anymore.
//
// Scope, deliberately: this file covers ESCALATION (a role change whose
// TARGET is admin/super_admin) only. Demoting an existing admin/super_admin
// down to a lower role, and CEO/Director reassignment authority generally,
// are out of scope for this pass (see the P0.3 readiness audit) — not
// tested here, not claimed as fixed.
//
// This file does not modify tests/rules/seed.js. A genuine role:
// 'super_admin' fixture and casing variants are created locally below,
// following the same pattern already used by
// 15-tier-a-tier-b-super-admin-split.spec.js and
// 08-dynamic-rbac-permissions.spec.js's own local OPERATIONS_UID fixture.

const { assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { makeTestEnv } = require('../testenv');
const { seed, UIDS } = require('../seed');

const SUPER_ADMIN_UID = 'p03_super_admin_test_user';
const ADMIN_CAP_UID = 'p03_admin_capitalized_test_user'; // role: 'Admin'
const SUPER_ADMIN_MIXED_UID = 'p03_super_admin_mixed_test_user'; // role: 'Super_Admin'

describe('P0.3 — Role escalation into admin/super_admin is Super Admin-only', function () {
  this.timeout(20000);
  let testEnv;

  before(async () => { testEnv = await makeTestEnv(); });
  after(async () => { await testEnv.cleanup(); });
  beforeEach(async () => {
    await testEnv.clearFirestore();
    await seed(testEnv);
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      const userDoc = (uid, role, extra) => db.collection('users').doc(uid).set(Object.assign({
        id: uid, uid, displayName: role + ' Test', email: uid + '@test.local',
        phone: '+250700000000', role, isActive: true, status: 'active',
        photoURL: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        createdBy: 'seed', updatedBy: 'seed'
      }, extra));

      await userDoc(SUPER_ADMIN_UID, 'super_admin');
      await userDoc(ADMIN_CAP_UID, 'Admin');
      await userDoc(SUPER_ADMIN_MIXED_UID, 'Super_Admin');
    });
  });

  describe('super_admin retains unconditional escalation authority', () => {
    it('super_admin CAN promote a user to admin', async () => {
      const ctx = testEnv.authenticatedContext(SUPER_ADMIN_UID);
      await assertSucceeds(
        ctx.firestore().doc(`users/${UIDS.marketing}`).update({ role: 'admin' })
      );
    });

    it('super_admin CAN promote a user to super_admin', async () => {
      const ctx = testEnv.authenticatedContext(SUPER_ADMIN_UID);
      await assertSucceeds(
        ctx.firestore().doc(`users/${UIDS.marketing}`).update({ role: 'super_admin' })
      );
    });

    it('super_admin retains general (non-escalation) role-change authority — e.g. reassigning to operations', async () => {
      const ctx = testEnv.authenticatedContext(SUPER_ADMIN_UID);
      await assertSucceeds(
        ctx.firestore().doc(`users/${UIDS.marketing}`).update({ role: 'operations' })
      );
    });

    it('role:\'Super_Admin\' (mixed case) also retains unconditional escalation authority', async () => {
      const ctx = testEnv.authenticatedContext(SUPER_ADMIN_MIXED_UID);
      await assertSucceeds(
        ctx.firestore().doc(`users/${UIDS.marketing}`).update({ role: 'admin' })
      );
    });
  });

  describe('plain admin CANNOT escalate (P0.3 — the actual behavior change)', () => {
    it('admin CANNOT promote a user to admin', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.admin);
      await assertFails(
        ctx.firestore().doc(`users/${UIDS.marketing}`).update({ role: 'admin' })
      );
    });

    it('admin CANNOT promote a user to super_admin', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.admin);
      await assertFails(
        ctx.firestore().doc(`users/${UIDS.marketing}`).update({ role: 'super_admin' })
      );
    });

    it('admin CANNOT self-promote to super_admin', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.admin);
      await assertFails(
        ctx.firestore().doc(`users/${UIDS.admin}`).update({ role: 'super_admin' })
      );
    });

    it('role:\'Admin\' (capitalized) is ALSO denied escalation — casing does not restore the old bypass', async () => {
      const ctx = testEnv.authenticatedContext(ADMIN_CAP_UID);
      await assertFails(
        ctx.firestore().doc(`users/${UIDS.marketing}`).update({ role: 'admin' })
      );
    });
  });

  describe('C. Regression — admin and CEO retain non-escalation role-change authority', () => {
    it('admin CAN still reassign a user to a non-admin-tier role (e.g. operations) — unaffected by P0.3', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.admin);
      await assertSucceeds(
        ctx.firestore().doc(`users/${UIDS.marketing}`).update({ role: 'operations' })
      );
    });

    it('CEO still CANNOT promote a user to admin (unchanged pre-existing restriction, not touched by P0.3)', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.ceo);
      await assertFails(
        ctx.firestore().doc(`users/${UIDS.marketing}`).update({ role: 'admin' })
      );
    });

    it('CEO CAN still reassign a user to a non-admin-tier role (e.g. operations) — unaffected by P0.3', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.ceo);
      await assertSucceeds(
        ctx.firestore().doc(`users/${UIDS.marketing}`).update({ role: 'operations' })
      );
    });

    it('admin retains every other Tier A authority — e.g. approving a property (isAdmin() itself untouched by P0.3)', async () => {
      const { DOC_IDS } = require('../seed');
      const ctx = testEnv.authenticatedContext(UIDS.admin);
      await assertSucceeds(
        ctx.firestore().doc(`properties/${DOC_IDS.property}`).update({ status: 'approved' })
      );
    });
  });
});
