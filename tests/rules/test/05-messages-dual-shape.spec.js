// messages/{id} covers two different document shapes in one collection:
// 1:1 client<->agent chat (a `participants` array) and internal
// team-channel posts (a `channel` field, no participants). Each shape has
// its own access logic layered into the same rule, which is exactly the
// kind of thing that's easy to get subtly wrong — worth its own file.

const { assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { makeTestEnv } = require('../testenv');
const { seed, UIDS } = require('../seed');

describe('Messages — dual-shape access (1:1 participants vs internal channel)', function () {
  this.timeout(20000);
  let testEnv;

  before(async () => { testEnv = await makeTestEnv(); });
  after(async () => { await testEnv.cleanup(); });
  beforeEach(async () => {
    await testEnv.clearFirestore();
    await seed(testEnv);

    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await db.doc('messages/dm_msg').set({
        id: 'dm_msg', fromId: UIDS.client, toId: UIDS.agentA, participants: [UIDS.client, UIDS.agentA],
        text: 'Hi', read: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        createdBy: UIDS.client, updatedBy: UIDS.client, status: 'active', isActive: true
      });
      await db.doc('messages/channel_msg').set({
        id: 'channel_msg', fromId: UIDS.hr, toId: '', channel: 'general', text: 'Team update',
        read: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        createdBy: UIDS.hr, updatedBy: UIDS.hr, status: 'active', isActive: true
      });
    });
  });

  describe('read', () => {
    it('a participant CAN read their own 1:1 message', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.agentA);
      await assertSucceeds(ctx.firestore().doc('messages/dm_msg').get());
    });

    it('a non-participant CANNOT read a 1:1 message they\'re not part of', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.agentB);
      await assertFails(ctx.firestore().doc('messages/dm_msg').get());
    });

    it('internal team member (agent) CAN read a channel-based message', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.agentA);
      await assertSucceeds(ctx.firestore().doc('messages/channel_msg').get());
    });

    it('a client (NOT internal team) CANNOT read a channel-based message', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.client);
      await assertFails(ctx.firestore().doc('messages/channel_msg').get());
    });

    it('staff (isAdminOrStaff) CAN read any message regardless of shape', async () => {
      const ctxA = testEnv.authenticatedContext(UIDS.admin);
      await assertSucceeds(ctxA.firestore().doc('messages/dm_msg').get());
      const ctxB = testEnv.authenticatedContext(UIDS.admin);
      await assertSucceeds(ctxB.firestore().doc('messages/channel_msg').get());
    });
  });

  describe('create', () => {
    it('a user CAN create a 1:1 message where they are fromId and a participant', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.client);
      await assertSucceeds(
        ctx.firestore().collection('messages').add({
          id: 'new_dm', fromId: UIDS.client, toId: UIDS.agentA, participants: [UIDS.client, UIDS.agentA],
          text: 'New message', read: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          createdBy: UIDS.client, updatedBy: UIDS.client, status: 'active', isActive: true
        })
      );
    });

    it('a user CANNOT create a message impersonating a different fromId', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.client);
      await assertFails(
        ctx.firestore().collection('messages').add({
          id: 'spoofed_dm', fromId: UIDS.agentA, toId: UIDS.client, participants: [UIDS.client, UIDS.agentA],
          text: 'Impersonation attempt', read: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          createdBy: UIDS.client, updatedBy: UIDS.client, status: 'active', isActive: true
        })
      );
    });

    it('a user CANNOT create a 1:1 message where they are fromId but not in participants', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.client);
      await assertFails(
        ctx.firestore().collection('messages').add({
          id: 'excluded_dm', fromId: UIDS.client, toId: UIDS.agentA, participants: [UIDS.agentA, UIDS.agentB],
          text: 'Should fail', read: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          createdBy: UIDS.client, updatedBy: UIDS.client, status: 'active', isActive: true
        })
      );
    });

    it('a client (NOT internal team) CANNOT create a channel-based message', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.client);
      await assertFails(
        ctx.firestore().collection('messages').add({
          id: 'client_channel_attempt', fromId: UIDS.client, toId: '', channel: 'general',
          text: 'Should fail', read: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          createdBy: UIDS.client, updatedBy: UIDS.client, status: 'active', isActive: true
        })
      );
    });

    it('an agent (internal team) CAN create a channel-based message', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.agentA);
      await assertSucceeds(
        ctx.firestore().collection('messages').add({
          id: 'agent_channel_post', fromId: UIDS.agentA, toId: '', channel: 'general',
          text: 'Agent update', read: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          createdBy: UIDS.agentA, updatedBy: UIDS.agentA, status: 'active', isActive: true
        })
      );
    });
  });

  describe('update', () => {
    it('the recipient (toId) CAN mark a message as read', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.agentA);
      await assertSucceeds(
        ctx.firestore().doc('messages/dm_msg').update({ read: true, updatedAt: new Date().toISOString(), updatedBy: UIDS.agentA })
      );
    });

    it('the recipient CANNOT modify the message content via update', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.agentA);
      await assertFails(
        ctx.firestore().doc('messages/dm_msg').update({ text: 'Tampered content' })
      );
    });

    it('a non-recipient, non-staff user CANNOT update a message at all', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.agentB);
      await assertFails(
        ctx.firestore().doc('messages/dm_msg').update({ read: true })
      );
    });
  });
});
