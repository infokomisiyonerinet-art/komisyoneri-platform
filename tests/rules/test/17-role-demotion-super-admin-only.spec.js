// P0.4 — Role Demotion Reconciliation (the mirror of P0.3).
//
// P0.3 (rules/firestore.rules' _isEscalationToAdminRole()) closed off
// writing a user's role field INTO 'admin'/'super_admin' to isSuperAdmin()
// only. It deliberately left open the reverse direction: a plain admin (or
// CEO) could still freely change the role field on a document that was
// CURRENTLY admin/super_admin, moving it DOWN to any lower role — including
// demoting the platform's own super_admin account to 'client'. P0.4 adds
// _isDemotionFromAdminRole() (checks resource.data, the target's role
// BEFORE the write) and folds it into _agentGovernanceOK() alongside the
// existing escalation check: now only isSuperAdmin() may touch the role
// field at all once the target document starts out admin/super_admin,
// whichever direction the write moves it.
//
// Scope, deliberately: like P0.3, this covers only documents whose CURRENT
// role is admin/super_admin. General CEO/Director reassignment authority
// over every other role remains untouched and is not tested here.
//
// This file does not modify tests/rules/seed.js — fixtures are local,
// following the same pattern as 15-tier-a-tier-b-super-admin-split.spec.js
// and 16-role-escalation-super-admin-only.spec.js.

const { assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { makeTestEnv } = require('../testenv');
const { seed, UIDS, DOC_IDS } = require('../seed');

const SUPER_ADMIN_UID = 'p04_super_admin_test_user';
const SECOND_ADMIN_UID = 'p04_second_admin_test_user'; // a distinct admin-role target, separate from UIDS.admin
const ADMIN_CAP_TARGET_UID = 'p04_admin_capitalized_target_test_user'; // role: 'Admin'

describe('P0.4 — Role demotion FROM admin/super_admin is Super Admin-only', function () {
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
      await userDoc(SECOND_ADMIN_UID, 'admin');
      await userDoc(ADMIN_CAP_TARGET_UID, 'Admin');
    });
  });

  describe('super_admin retains unconditional demotion authority', () => {
    it('super_admin CAN demote another admin to a lower role', async () => {
      const ctx = testEnv.authenticatedContext(SUPER_ADMIN_UID);
      await assertSucceeds(
        ctx.firestore().doc(`users/${SECOND_ADMIN_UID}`).update({ role: 'operations' })
      );
    });

    it('super_admin CAN demote another super_admin to a lower role', async () => {
      const ctx = testEnv.authenticatedContext(SUPER_ADMIN_UID);
      const otherSuperAdmin = 'p04_other_super_admin_test_user';
      await testEnv.withSecurityRulesDisabled(async (rulesCtx) => {
        await rulesCtx.firestore().collection('users').doc(otherSuperAdmin).set({
          id: otherSuperAdmin, uid: otherSuperAdmin, role: 'super_admin', displayName: 'Other Super Admin',
          email: otherSuperAdmin + '@test.local', phone: '+250700000000', isActive: true, status: 'active',
          photoURL: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          createdBy: 'seed', updatedBy: 'seed'
        });
      });
      await assertSucceeds(
        ctx.firestore().doc(`users/${otherSuperAdmin}`).update({ role: 'client' })
      );
    });

    it('super_admin CAN self-demote', async () => {
      const ctx = testEnv.authenticatedContext(SUPER_ADMIN_UID);
      await assertSucceeds(
        ctx.firestore().doc(`users/${SUPER_ADMIN_UID}`).update({ role: 'admin' })
      );
    });
  });

  describe('plain admin CANNOT demote an existing admin/super_admin (P0.4 — the actual behavior change)', () => {
    it('admin CANNOT demote another admin to a lower role', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.admin);
      await assertFails(
        ctx.firestore().doc(`users/${SECOND_ADMIN_UID}`).update({ role: 'operations' })
      );
    });

    it('admin CANNOT demote the super_admin account to a lower role (the headline gap this closes)', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.admin);
      await assertFails(
        ctx.firestore().doc(`users/${SUPER_ADMIN_UID}`).update({ role: 'client' })
      );
    });

    it('admin CANNOT self-demote', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.admin);
      await assertFails(
        ctx.firestore().doc(`users/${UIDS.admin}`).update({ role: 'operations' })
      );
    });

    it('admin CANNOT demote a role:\'Admin\' (capitalized) target — casing does not bypass the check', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.admin);
      await assertFails(
        ctx.firestore().doc(`users/${ADMIN_CAP_TARGET_UID}`).update({ role: 'operations' })
      );
    });
  });

  describe('CEO CANNOT demote an existing admin/super_admin (mirrors the admin restriction)', () => {
    it('CEO CANNOT demote an admin to a lower role', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.ceo);
      await assertFails(
        ctx.firestore().doc(`users/${SECOND_ADMIN_UID}`).update({ role: 'operations' })
      );
    });

    it('CEO CANNOT demote the super_admin account to a lower role', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.ceo);
      await assertFails(
        ctx.firestore().doc(`users/${SUPER_ADMIN_UID}`).update({ role: 'client' })
      );
    });
  });

  describe('C. Regression — admin/CEO retain general (non-admin-tier) reassignment authority', () => {
    it('admin CAN still reassign a non-admin-tier account (e.g. marketing -> operations)', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.admin);
      await assertSucceeds(
        ctx.firestore().doc(`users/${UIDS.marketing}`).update({ role: 'operations' })
      );
    });

    it('CEO CAN still reassign a non-admin-tier account (e.g. marketing -> operations)', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.ceo);
      await assertSucceeds(
        ctx.firestore().doc(`users/${UIDS.marketing}`).update({ role: 'operations' })
      );
    });

    it('admin retains every other Tier A authority — e.g. approving a property (unaffected by P0.4)', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.admin);
      await assertSucceeds(
        ctx.firestore().doc(`properties/${DOC_IDS.property}`).update({ status: 'approved' })
      );
    });

    it('admin CANNOT escalate a non-admin-tier account to admin (P0.3 protection, unaffected by P0.4)', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.admin);
      await assertFails(
        ctx.firestore().doc(`users/${UIDS.marketing}`).update({ role: 'admin' })
      );
    });
  });
});
