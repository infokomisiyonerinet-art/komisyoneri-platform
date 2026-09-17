// P1-04 — saveDealNotes() now generates an audit event.
//
// The actual logAudit('deal.notes_updated', ...) call was added to
// index.html's saveDealNotes() — a frontend change this rules-only
// emulator suite can't invoke directly. What this verifies is the
// rules-governed part: the write shape logAudit() now produces for this
// action is permitted by the existing identity-pinned auditlogs create
// rule (confirmed no action-name allowlist exists), from BOTH callers who
// can legitimately reach saveDealNotes() — the owning agent (deals'
// D-2 ownership branch allows 'notes' through, unaffected by
// _isDealOwnershipAndTypeStableOK()/_isDealAgreedPriceChangeOK()) and
// admin/staff — and that the resulting entry is immutable, same as every
// other audit entry.
//
// This file does not modify tests/rules/seed.js — fixtures are local,
// following the same pattern as every other P0.x/P1.x file in this suite.

const { assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { makeTestEnv } = require('../testenv');
const { seed, UIDS, DOC_IDS } = require('../seed');

describe('P1-04 — deal notes audit trail', function () {
  this.timeout(20000);
  let testEnv;

  before(async () => { testEnv = await makeTestEnv(); });
  after(async () => { await testEnv.cleanup(); });
  beforeEach(async () => {
    await testEnv.clearFirestore();
    await seed(testEnv);
  });

  function notesAuditEntry(actorUid) {
    return {
      id: '', action: 'deal.notes_updated', collection: 'deals', docId: DOC_IDS.deal,
      oldValue: { notes: '' }, newValue: { notes: 'Client wants to renegotiate closing date' },
      performedBy: actorUid, performedAt: new Date().toISOString(), userRole: 'agent',
      ipAddress: '', isActive: true, status: 'logged',
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      createdBy: actorUid, updatedBy: actorUid
    };
  }

  it('the deal actually updating notes still succeeds for the owning agent (unaffected regression check)', async () => {
    const ctx = testEnv.authenticatedContext(UIDS.agentA);
    await assertSucceeds(ctx.firestore().doc(`deals/${DOC_IDS.deal}`).update({
      notes: 'Client wants to renegotiate closing date', updatedAt: new Date().toISOString(), updatedBy: UIDS.agentA
    }));
  });

  it('the owning agent CAN create the resulting deal.notes_updated audit entry — ALLOWED', async () => {
    const ctx = testEnv.authenticatedContext(UIDS.agentA);
    await assertSucceeds(ctx.firestore().collection('auditlogs').add(notesAuditEntry(UIDS.agentA)));
  });

  it('admin/staff CAN create the same audit entry when they update notes instead — ALLOWED', async () => {
    const ctx = testEnv.authenticatedContext(UIDS.admin);
    await assertSucceeds(ctx.firestore().collection('auditlogs').add(notesAuditEntry(UIDS.admin)));
  });

  it('a user CANNOT create a deal.notes_updated entry attributed to someone else — DENIED', async () => {
    const ctx = testEnv.authenticatedContext(UIDS.agentA);
    await assertFails(ctx.firestore().collection('auditlogs').add(notesAuditEntry(UIDS.agentB)));
  });

  it('the resulting audit entry is immutable — no one can edit or delete it afterward', async () => {
    const ctx = testEnv.authenticatedContext(UIDS.agentA);
    const ref = await assertSucceeds(ctx.firestore().collection('auditlogs').add(notesAuditEntry(UIDS.agentA)));
    await assertFails(ref.update({ newValue: { notes: 'Tampered' } }));
    await assertFails(ref.delete());
  });
});
