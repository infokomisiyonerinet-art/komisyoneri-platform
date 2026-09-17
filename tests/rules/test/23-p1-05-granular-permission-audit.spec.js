// P1-05 — granular PERMISSION_GRANTED/PERMISSION_REVOKED audit events.
//
// saveRolePermissions() (index.html) now emits one PERMISSION_GRANTED or
// PERMISSION_REVOKED entry per individual permission actually added or
// removed, alongside the pre-existing aggregate
// 'permissions.role_config.changed' entry (kept, not replaced) — a
// frontend change this rules-only emulator suite can't invoke directly.
// What this verifies is the rules-governed part: the write shape these
// two new action names now produce is permitted by the existing
// identity-pinned auditlogs create rule (no action-name allowlist), from
// an admin actor (the only one who can reach saveRolePermissions() in the
// first place, since role_permissions writes are isAdmin()-only), and
// that the resulting entries are immutable.
//
// This file does not modify tests/rules/seed.js — fixtures are local,
// following the same pattern as every other P0.x/P1.x file in this suite.

const { assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { makeTestEnv } = require('../testenv');
const { seed, UIDS } = require('../seed');

describe('P1-05 — granular permission audit events', function () {
  this.timeout(20000);
  let testEnv;

  before(async () => { testEnv = await makeTestEnv(); });
  after(async () => { await testEnv.cleanup(); });
  beforeEach(async () => {
    await testEnv.clearFirestore();
    await seed(testEnv);
  });

  function permEvent(action, actorUid, granted) {
    return {
      id: '', action: action, collection: 'role_permissions', docId: 'marketing_manager',
      oldValue: { role: 'marketing_manager', permission: 'properties.approve', granted: !granted },
      newValue: { role: 'marketing_manager', permission: 'properties.approve', granted: granted },
      performedBy: actorUid, performedAt: new Date().toISOString(), userRole: 'admin',
      ipAddress: '', isActive: true, status: 'logged',
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      createdBy: actorUid, updatedBy: actorUid
    };
  }

  it('admin can actually write role_permissions (the real precondition for reaching this audit call) — ALLOWED', async () => {
    const ctx = testEnv.authenticatedContext(UIDS.admin);
    await assertSucceeds(ctx.firestore().doc('role_permissions/marketing_manager').set({
      role: 'marketing_manager', permissions: ['properties.approve'],
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      createdBy: UIDS.admin, updatedBy: UIDS.admin
    }, { merge: true }));
  });

  it('a non-admin CANNOT write role_permissions — DENIED (the audit call is unreachable without this)', async () => {
    const ctx = testEnv.authenticatedContext(UIDS.ceo);
    await assertFails(ctx.firestore().doc('role_permissions/marketing_manager').set({
      role: 'marketing_manager', permissions: ['properties.approve'],
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      createdBy: UIDS.ceo, updatedBy: UIDS.ceo
    }, { merge: true }));
  });

  it('admin CAN create the resulting PERMISSION_GRANTED audit entry — ALLOWED', async () => {
    const ctx = testEnv.authenticatedContext(UIDS.admin);
    await assertSucceeds(ctx.firestore().collection('auditlogs').add(permEvent('PERMISSION_GRANTED', UIDS.admin, true)));
  });

  it('admin CAN create the resulting PERMISSION_REVOKED audit entry — ALLOWED', async () => {
    const ctx = testEnv.authenticatedContext(UIDS.admin);
    await assertSucceeds(ctx.firestore().collection('auditlogs').add(permEvent('PERMISSION_REVOKED', UIDS.admin, false)));
  });

  it('a user CANNOT create a PERMISSION_GRANTED entry attributed to someone else — DENIED', async () => {
    const ctx = testEnv.authenticatedContext(UIDS.admin);
    await assertFails(ctx.firestore().collection('auditlogs').add(permEvent('PERMISSION_GRANTED', UIDS.ceo, true)));
  });

  it('the resulting audit entries are immutable — no one can edit or delete them afterward', async () => {
    const ctx = testEnv.authenticatedContext(UIDS.admin);
    const ref = await assertSucceeds(ctx.firestore().collection('auditlogs').add(permEvent('PERMISSION_GRANTED', UIDS.admin, true)));
    await assertFails(ref.update({ newValue: { granted: false } }));
    await assertFails(ref.delete());
  });
});
