// Audit Log Forgery Fix — final security audit finding F-1.
//
// auditlogs/{id}'s create rule used to be `isAuth() && hasStandardFields()`
// with no constraint on performedBy/createdBy/updatedBy at all. Since
// auditlogs never allows update or delete, that single missing constraint
// meant ANY authenticated user (including a plain 'client') could create a
// PERMANENT, IMMUTABLE audit entry claiming a different uid performed an
// arbitrary action — e.g. framing a real admin for an approval they never
// made. index.html's one and only client write path (logAudit()) has
// always self-attributed (performedBy == createdBy == updatedBy ==
// currentUser.uid, never a parameter), so pinning that invariant into the
// rule itself closes the direct-Firestore-write forgery path without
// touching that function or any legitimate call site.
//
// Deliberately scoped to IDENTITY attribution only, matching this fix's own
// narrow mandate — action/userRole/collection/docId/oldValue/newValue are
// untouched here (separate, already-disclosed findings, not this fix's job).

const { assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { makeTestEnv } = require('../testenv');
const { seed, UIDS, standardFields } = require('../seed');

describe('Audit Log Forgery Fix (F-1) — auditlogs identity attribution', function () {
  this.timeout(20000);
  let testEnv;

  before(async () => { testEnv = await makeTestEnv(); });
  after(async () => { await testEnv.cleanup(); });
  beforeEach(async () => {
    await testEnv.clearFirestore();
    await seed(testEnv);
  });

  // Same document shape index.html's logAudit() actually sends, with the
  // three identity fields parameterized so each test can vary just the one
  // under test.
  function auditDoc(overrides) {
    return Object.assign(standardFields({
      id: '',
      action: 'property.approved',
      collection: 'properties',
      docId: 'some_property_id',
      oldValue: { status: 'pending' },
      newValue: { status: 'approved' },
      performedBy: UIDS.client,
      userRole: 'client',
      ipAddress: '',
      createdBy: UIDS.client,
      updatedBy: UIDS.client
    }), overrides);
  }

  it('A. forged performedBy (claiming a DIFFERENT uid performed the action) is rejected', async () => {
    const ctx = testEnv.authenticatedContext(UIDS.client);
    await assertFails(
      ctx.firestore().collection('auditlogs').add(
        auditDoc({ performedBy: UIDS.admin, createdBy: UIDS.client, updatedBy: UIDS.client })
      )
    );
  });

  it('A2. forged createdBy/updatedBy (claiming a different uid) is rejected even if performedBy is honest', async () => {
    const ctx = testEnv.authenticatedContext(UIDS.agentA);
    await assertFails(
      ctx.firestore().collection('auditlogs').add(
        auditDoc({ performedBy: UIDS.agentA, createdBy: UIDS.ceo, updatedBy: UIDS.agentA })
      )
    );
  });

  it('B. legitimate self-attributed audit creation succeeds (matches logAudit()\'s own shape exactly)', async () => {
    const ctx = testEnv.authenticatedContext(UIDS.agentA);
    await assertSucceeds(
      ctx.firestore().collection('auditlogs').add(
        auditDoc({ performedBy: UIDS.agentA, createdBy: UIDS.agentA, updatedBy: UIDS.agentA, userRole: 'agent' })
      )
    );
  });

  it('C. unauthenticated audit creation fails', async () => {
    const ctx = testEnv.unauthenticatedContext();
    await assertFails(
      ctx.firestore().collection('auditlogs').add(
        auditDoc({ performedBy: 'anonymous', createdBy: 'anonymous', updatedBy: 'anonymous' })
      )
    );
  });

  it('D. auditlogs remain immutable — update is still denied even for the entry\'s own creator', async () => {
    let docId;
    await testEnv.withSecurityRulesDisabled(async (bgCtx) => {
      const ref = await bgCtx.firestore().collection('auditlogs').add(
        auditDoc({ performedBy: UIDS.admin, createdBy: UIDS.admin, updatedBy: UIDS.admin })
      );
      docId = ref.id;
    });
    const ctx = testEnv.authenticatedContext(UIDS.admin);
    await assertFails(ctx.firestore().doc(`auditlogs/${docId}`).update({ action: 'tampered' }));
  });

  it('D2. auditlogs remain immutable — delete is still denied, even for admin', async () => {
    let docId;
    await testEnv.withSecurityRulesDisabled(async (bgCtx) => {
      const ref = await bgCtx.firestore().collection('auditlogs').add(
        auditDoc({ performedBy: UIDS.admin, createdBy: UIDS.admin, updatedBy: UIDS.admin })
      );
      docId = ref.id;
    });
    const ctx = testEnv.authenticatedContext(UIDS.admin);
    await assertFails(ctx.firestore().doc(`auditlogs/${docId}`).delete());
  });

  it('E. every staff-tier role can still self-attribute a legitimate audit entry (existing logAudit() paths keep working)', async () => {
    const ctx = testEnv.authenticatedContext(UIDS.ceo);
    await assertSucceeds(
      ctx.firestore().collection('auditlogs').add(
        auditDoc({ performedBy: UIDS.ceo, createdBy: UIDS.ceo, updatedBy: UIDS.ceo, userRole: 'ceo', action: 'site.approved', collection: 'sites' })
      )
    );
  });

  it('E2. admin can still self-attribute a legitimate audit entry', async () => {
    const ctx = testEnv.authenticatedContext(UIDS.admin);
    await assertSucceeds(
      ctx.firestore().collection('auditlogs').add(
        auditDoc({ performedBy: UIDS.admin, createdBy: UIDS.admin, updatedBy: UIDS.admin, userRole: 'admin' })
      )
    );
  });
});
