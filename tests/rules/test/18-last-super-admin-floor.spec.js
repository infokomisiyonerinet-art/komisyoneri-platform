// P0.5 — Last-Super-Admin Floor.
//
// Even isSuperAdmin()'s own unconditional bypass in _agentGovernanceOK()
// must respect one more guard: a demotion FROM super_admin (self-demotion
// included) is refused outright if stats/adminCounts.superAdminCount is
// <= 1 (or the doc is missing — rules/firestore.rules' own fail-safe
// default). This prevents the platform ending up with zero super_admin
// accounts and no recovery path, the same class of guarantee isAdmin()'s
// own isActive-bypass already exists to protect elsewhere in this file.
//
// stats/adminCounts is normally maintained by functions/index.js's
// onUserSuperAdminCountChange trigger (Admin SDK, bypasses these rules
// entirely) — this file seeds it directly via withSecurityRulesDisabled to
// exercise the floor logic deterministically, independent of the Cloud
// Function (which this repo's test tooling can't run — Firestore rules
// emulator only, no Functions emulator; see tests/rules/README.md).
//
// This file does not modify tests/rules/seed.js — fixtures are local,
// following the same pattern as every other P0.x file in this suite.

const { assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { makeTestEnv } = require('../testenv');
const { seed, UIDS } = require('../seed');

const SUPER_ADMIN_UID = 'p05_super_admin_test_user';
const OTHER_SUPER_ADMIN_UID = 'p05_other_super_admin_test_user';
const ADMIN_TARGET_UID = 'p05_admin_target_test_user';
const SUPER_ADMIN_MIXED_CASE_UID = 'p05_super_admin_mixed_case_test_user'; // role: 'Super_Admin'

describe('P0.5 — Last-Super-Admin floor (stats/adminCounts.superAdminCount)', function () {
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
      await userDoc(OTHER_SUPER_ADMIN_UID, 'super_admin');
      await userDoc(ADMIN_TARGET_UID, 'admin');
      await userDoc(SUPER_ADMIN_MIXED_CASE_UID, 'Super_Admin');
      // Deliberately NOT seeding stats/adminCounts here — each test below
      // sets (or omits) it explicitly, since the exact count is the thing
      // under test in every case.
    });
  });

  async function setSuperAdminCount(n) {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().collection('stats').doc('adminCounts').set({
        superAdminCount: n, updatedAt: new Date().toISOString()
      });
    });
  }

  describe('Floor blocks when count is at or below 1', () => {
    it('super_admin CANNOT self-demote when superAdminCount is 1 (the last one)', async () => {
      await setSuperAdminCount(1);
      const ctx = testEnv.authenticatedContext(SUPER_ADMIN_UID);
      await assertFails(
        ctx.firestore().doc(`users/${SUPER_ADMIN_UID}`).update({ role: 'admin' })
      );
    });

    it('super_admin CANNOT demote a DIFFERENT super_admin when superAdminCount is 1', async () => {
      await setSuperAdminCount(1);
      const ctx = testEnv.authenticatedContext(SUPER_ADMIN_UID);
      await assertFails(
        ctx.firestore().doc(`users/${OTHER_SUPER_ADMIN_UID}`).update({ role: 'client' })
      );
    });

    it('super_admin CANNOT demote a super_admin when superAdminCount is 0', async () => {
      await setSuperAdminCount(0);
      const ctx = testEnv.authenticatedContext(SUPER_ADMIN_UID);
      await assertFails(
        ctx.firestore().doc(`users/${OTHER_SUPER_ADMIN_UID}`).update({ role: 'client' })
      );
    });

    it('a MISSING stats/adminCounts document also blocks demotion (fail-safe default)', async () => {
      // No setSuperAdminCount() call at all — the doc genuinely does not exist.
      const ctx = testEnv.authenticatedContext(SUPER_ADMIN_UID);
      await assertFails(
        ctx.firestore().doc(`users/${OTHER_SUPER_ADMIN_UID}`).update({ role: 'client' })
      );
    });

    it('role:\'Super_Admin\' (mixed case) target is ALSO blocked at count 1 — casing does not bypass the floor', async () => {
      await setSuperAdminCount(1);
      const ctx = testEnv.authenticatedContext(SUPER_ADMIN_UID);
      await assertFails(
        ctx.firestore().doc(`users/${SUPER_ADMIN_MIXED_CASE_UID}`).update({ role: 'client' })
      );
    });
  });

  describe('Floor allows demotion once count is 2 or more', () => {
    it('super_admin CAN demote a different super_admin when superAdminCount is 2 (leaves exactly 1, not 0)', async () => {
      await setSuperAdminCount(2);
      const ctx = testEnv.authenticatedContext(SUPER_ADMIN_UID);
      await assertSucceeds(
        ctx.firestore().doc(`users/${OTHER_SUPER_ADMIN_UID}`).update({ role: 'client' })
      );
    });

    it('super_admin CAN self-demote when superAdminCount is 2', async () => {
      await setSuperAdminCount(2);
      const ctx = testEnv.authenticatedContext(SUPER_ADMIN_UID);
      await assertSucceeds(
        ctx.firestore().doc(`users/${SUPER_ADMIN_UID}`).update({ role: 'admin' })
      );
    });
  });

  describe('The floor is scoped to demotion FROM super_admin only', () => {
    it('demoting a plain admin (not super_admin) is NEVER blocked by the floor, even at count 1', async () => {
      await setSuperAdminCount(1);
      const ctx = testEnv.authenticatedContext(SUPER_ADMIN_UID);
      await assertSucceeds(
        ctx.firestore().doc(`users/${ADMIN_TARGET_UID}`).update({ role: 'operations' })
      );
    });

    it('escalating a user INTO super_admin is NEVER blocked by the floor, even at count 1', async () => {
      await setSuperAdminCount(1);
      const ctx = testEnv.authenticatedContext(SUPER_ADMIN_UID);
      await assertSucceeds(
        ctx.firestore().doc(`users/${UIDS.marketing}`).update({ role: 'super_admin' })
      );
    });

    it('reassigning a non-admin-tier account is unaffected by the floor, even at count 1', async () => {
      await setSuperAdminCount(1);
      const ctx = testEnv.authenticatedContext(SUPER_ADMIN_UID);
      await assertSucceeds(
        ctx.firestore().doc(`users/${UIDS.marketing}`).update({ role: 'operations' })
      );
    });
  });
});
