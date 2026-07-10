// Tests the fundamental ownership/self-escalation boundaries: can a user
// modify their own privileged fields, can they touch someone else's doc,
// and does the one deliberate self-service carve-out (isSelfAgentApplication,
// rules/firestore.rules ~line 69) stay as narrow as its own comment claims.

const { assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { makeTestEnv } = require('../testenv');
const { seed, UIDS, DOC_IDS } = require('../seed');

describe('Ownership & self-escalation', function () {
  this.timeout(20000);
  let testEnv;

  before(async () => { testEnv = await makeTestEnv(); });
  after(async () => { await testEnv.cleanup(); });
  beforeEach(async () => {
    await testEnv.clearFirestore();
    await seed(testEnv);
  });

  describe('users/{uid} — self-escalation', () => {
    it('client CANNOT self-modify their own role field', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.client);
      await assertFails(
        ctx.firestore().doc(`users/${UIDS.client}`).update({ role: 'admin', updatedAt: new Date().toISOString() })
      );
    });

    it('client CAN self-modify an allowed profile field (phone)', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.client);
      await assertSucceeds(
        ctx.firestore().doc(`users/${UIDS.client}`).update({ phone: '+250788888888', updatedAt: new Date().toISOString() })
      );
    });

    it('client CANNOT modify another user\'s document', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.client);
      await assertFails(
        ctx.firestore().doc(`users/${UIDS.agentA}`).update({ phone: '+250788888888' })
      );
    });

    it('admin CAN modify another user\'s role', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.admin);
      await assertSucceeds(
        ctx.firestore().doc(`users/${UIDS.client}`).update({ role: 'agent', updatedAt: new Date().toISOString() })
      );
    });

    it('user CAN create their own doc on registration', async () => {
      const ctx = testEnv.authenticatedContext('new_user_uid');
      await assertSucceeds(
        ctx.firestore().doc('users/new_user_uid').set({
          id: 'new_user_uid', uid: 'new_user_uid', displayName: 'New User', email: 'new@test.local',
          phone: '', role: 'client', isActive: true, status: 'active', photoURL: '',
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          createdBy: 'new_user_uid', updatedBy: 'new_user_uid'
        })
      );
    });

    it('user CANNOT create a doc under a different uid', async () => {
      const ctx = testEnv.authenticatedContext('new_user_uid');
      await assertFails(
        ctx.firestore().doc('users/someone_else_uid').set({
          id: 'someone_else_uid', uid: 'someone_else_uid', displayName: 'X', email: 'x@test.local',
          phone: '', role: 'client', isActive: true, status: 'active', photoURL: '',
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          createdBy: 'new_user_uid', updatedBy: 'new_user_uid'
        })
      );
    });
  });

  describe('users/{uid} — isSelfAgentApplication carve-out', () => {
    it('client CAN self-apply to become an agent (pending, unverified)', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.client);
      await assertSucceeds(
        ctx.firestore().doc(`users/${UIDS.client}`).update({
          role: 'agent', status: 'pending', isActive: true, isVerified: false,
          district: 'Gasabo', updatedAt: new Date().toISOString()
        })
      );
    });

    it('client CANNOT self-apply already verified (self-approval attempt)', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.client);
      await assertFails(
        ctx.firestore().doc(`users/${UIDS.client}`).update({
          role: 'agent', status: 'pending', isActive: true, isVerified: true,
          updatedAt: new Date().toISOString()
        })
      );
    });

    it('client CANNOT self-apply directly into an approved status', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.client);
      await assertFails(
        ctx.firestore().doc(`users/${UIDS.client}`).update({
          role: 'agent', status: 'approved', isActive: true, isVerified: false,
          updatedAt: new Date().toISOString()
        })
      );
    });

    // isSelfAgentApplication()'s own exclusion list only names the literal
    // roles 'admin'/'super_admin'/'staff' — but every one of those (and
    // every other staff-tier role, e.g. hr_manager here) already has
    // blanket update access via the isAdminOrStaff() disjunct earlier in
    // the same `allow update`. So this update succeeds regardless of the
    // loophole — there's no reachable case where the exclusion clause is
    // the thing standing between a staff-tier account and this write, since
    // isAdminOrStaff() is a strict superset of what the loophole would
    // grant. Documenting that as the real, current behavior.
    it('a staff-tier account CAN still update its own doc (via isAdminOrStaff, not the loophole)', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.hr);
      await assertSucceeds(
        ctx.firestore().doc(`users/${UIDS.hr}`).update({
          role: 'agent', status: 'pending', isActive: true, isVerified: false,
          updatedAt: new Date().toISOString()
        })
      );
    });
  });

  describe('properties/{id} — create is open, update is ownership-scoped', () => {
    it('ANY authenticated user (even a client) CAN create a property', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.client);
      await assertSucceeds(
        ctx.firestore().collection('properties').add({
          id: 'new_prop', agentId: UIDS.client, ownerId: UIDS.client,
          title: 'My Listing', type: 'Apartment', district: 'Kicukiro', sector: 'Niboye',
          price: 20000000, bedrooms: 2, bathrooms: 1, area: 80, description: '', amenities: [], images: [],
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          createdBy: UIDS.client, updatedBy: UIDS.client, status: 'pending', isActive: true
        })
      );
    });

    it('owning agent CAN update their own property\'s editable fields', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.agentA);
      await assertSucceeds(
        ctx.firestore().doc(`properties/${DOC_IDS.property}`).update({
          price: 55000000, updatedAt: new Date().toISOString(), updatedBy: UIDS.agentA
        })
      );
    });

    it('a DIFFERENT agent CANNOT update someone else\'s property', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.agentB);
      await assertFails(
        ctx.firestore().doc(`properties/${DOC_IDS.property}`).update({ price: 1 })
      );
    });

    it('owning agent CANNOT self-approve their own property (isVerified)', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.agentA);
      await assertFails(
        ctx.firestore().doc(`properties/${DOC_IDS.property}`).update({ isVerified: true })
      );
    });

    it('admin CAN approve a property (isVerified)', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.admin);
      await assertSucceeds(
        ctx.firestore().doc(`properties/${DOC_IDS.property}`).update({ isVerified: true, status: 'Approved' })
      );
    });
  });

  describe('leads/{id} — agent ownership scoping', () => {
    const leadId = 'lead_test_doc';
    beforeEach(async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc(`leads/${leadId}`).set({
          id: leadId, agentId: UIDS.agentA, clientId: UIDS.client, status: 'new',
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          createdBy: 'seed', updatedBy: 'seed', isActive: true
        });
      });
    });

    it('owning agent CAN update their own lead', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.agentA);
      await assertSucceeds(ctx.firestore().doc(`leads/${leadId}`).update({ status: 'contacted' }));
    });

    it('a non-owning agent CANNOT update someone else\'s lead', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.agentB);
      await assertFails(ctx.firestore().doc(`leads/${leadId}`).update({ status: 'contacted' }));
    });
  });
});
