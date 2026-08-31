// D-1 remediation (final pre-production security verification): actor-
// attribution fields (updatedBy, approvedBy, decidedBy) were forgeable to
// an arbitrary uid on almost every collection except auditlogs — an
// authenticated user performing an otherwise-legitimate write could name a
// DIFFERENT real user as having done it, and several Cloud Function
// triggers (onPlotStatusChanged/onPropertyStatusChanged/
// onSiteStatusChanged/onDealClosedWon/onApprovalDecided, functions/index.js)
// read exactly these fields off the AFTER document as the acting identity
// for the immutable auditlogs entry they write. See rules/firestore.rules'
// _updateAttributionOK() for the fix.
//
// Every test below proves ONE of two things about a single write:
//   - forging the field to a DIFFERENT real uid is DENIED, or
//   - the legitimate write (field omitted, or set to the caller's own uid)
//     is still ALLOWED — a write that never touches the field at all must
//     never be blocked by a stale value already sitting on the document
//     from someone else's earlier write (see the "stale value" describe
//     block at the bottom).
//
// commissions.approvedBy is deliberately EXCLUDED throughout — it stores a
// display NAME (submitCommissionDecision(), index.html), not a uid, so
// pinning it to request.auth.uid would misunderstand the schema and break
// that legitimate write; a dedicated test below locks in that exception.

const { assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { makeTestEnv } = require('../testenv');
const { seed, UIDS, DOC_IDS, standardFields } = require('../seed');

const SITE_ID = 'attr_test_site';
const OWNER_PLOT_ID = 'attr_test_plot_owner_edit';
const AVAILABLE_PLOT_ID = 'attr_test_plot_available';
const MESSAGE_ID = 'attr_test_message';
const INVESTMENT_ID = 'attr_test_investment';
const PAYOUT_VERIFIED_ID = 'attr_test_payout_verified';
const IMPOSTER_UID = 'attr_impostor_test_user'; // an unrelated, real, seeded user

describe('D-1 remediation — actor-attribution forgery is closed', function () {
  this.timeout(20000);
  let testEnv;

  before(async () => { testEnv = await makeTestEnv(); });
  after(async () => { await testEnv.cleanup(); });

  beforeEach(async () => {
    await testEnv.clearFirestore();
    await seed(testEnv);
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await db.collection('users').doc(IMPOSTER_UID).set({
        id: IMPOSTER_UID, uid: IMPOSTER_UID, displayName: 'Imposter Test', email: IMPOSTER_UID + '@test.local',
        phone: '+250700000000', role: 'client', isActive: true, status: 'active', photoURL: '',
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        createdBy: 'seed', updatedBy: 'seed'
      });

      await db.collection('sites').doc(SITE_ID).set(standardFields({
        id: SITE_ID, name: 'Attribution Test Site', status: 'pending_review',
        managingAgentId: UIDS.agentA, commissionRate: 4,
        totalPlots: 2, availablePlots: 2, reservedPlots: 0, soldPlots: 0
      }));
      await db.collection('plots').doc(OWNER_PLOT_ID).set(standardFields({
        id: OWNER_PLOT_ID, siteId: SITE_ID, status: 'available',
        clientId: '', agentId: UIDS.agentA, price: 5000000,
        commissionRate: 4, transactionSource: '', plotNumber: 'A1'
      }));
      await db.collection('plots').doc(AVAILABLE_PLOT_ID).set(standardFields({
        id: AVAILABLE_PLOT_ID, siteId: SITE_ID, status: 'available',
        clientId: '', agentId: UIDS.agentA, price: 5000000,
        commissionRate: 4, transactionSource: '', plotNumber: 'A2'
      }));
      await db.collection('messages').doc(MESSAGE_ID).set(standardFields({
        id: MESSAGE_ID, fromId: UIDS.agentA, toId: UIDS.client,
        participants: [UIDS.agentA, UIDS.client], text: 'Hello', read: false
      }));
      await db.collection('investments').doc(INVESTMENT_ID).set(standardFields({
        id: INVESTMENT_ID, investorId: UIDS.client, propertyId: DOC_IDS.property,
        amount: 10000000, status: 'active'
      }));
      await db.collection('payout_requests').doc(PAYOUT_VERIFIED_ID).set(standardFields({
        id: PAYOUT_VERIFIED_ID, agentId: UIDS.agentA, amount: 1600000,
        status: 'pending', serverVerified: true, verifiedAmount: 1600000, verifiedAt: new Date().toISOString(),
        commissionIds: [DOC_IDS.commission]
      }));
    });
  });

  // ── A. Plot reservation with forged updatedBy ─────────────────────────
  describe('A. Plot reservation (client first-time reservation)', () => {
    it('forged updatedBy (another real uid) is DENIED', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.client);
      await assertFails(ctx.firestore().doc(`plots/${AVAILABLE_PLOT_ID}`).update({
        status: 'reserved', clientId: UIDS.client, reservedAt: new Date(),
        reservedUntil: new Date(Date.now() + 7 * 86400000), depositPaid: false,
        updatedAt: new Date(), updatedBy: IMPOSTER_UID
      }));
    });
    it('honest updatedBy (own uid) still succeeds — positive control', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.client);
      await assertSucceeds(ctx.firestore().doc(`plots/${AVAILABLE_PLOT_ID}`).update({
        status: 'reserved', clientId: UIDS.client, reservedAt: new Date(),
        reservedUntil: new Date(Date.now() + 7 * 86400000), depositPaid: false,
        updatedAt: new Date(), updatedBy: UIDS.client
      }));
    });
  });

  // ── B. Plot update (managing-agent content edit) ──────────────────────
  describe('B. Plot update (managing agent content edit)', () => {
    it('forged updatedBy (another real uid) is DENIED', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.agentA);
      await assertFails(ctx.firestore().doc(`plots/${OWNER_PLOT_ID}`).update({
        plotLabel: 'Corner Plot', updatedAt: new Date(), updatedBy: IMPOSTER_UID
      }));
    });
    it('honest updatedBy (own uid) still succeeds — positive control', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.agentA);
      await assertSucceeds(ctx.firestore().doc(`plots/${OWNER_PLOT_ID}`).update({
        plotLabel: 'Corner Plot', updatedAt: new Date(), updatedBy: UIDS.agentA
      }));
    });
  });

  // ── C. Property update (owning agent content edit) ────────────────────
  describe('C. Property update (owning agent content edit)', () => {
    it('forged updatedBy (another real uid) is DENIED', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.agentA);
      await assertFails(ctx.firestore().doc(`properties/${DOC_IDS.property}`).update({
        price: 52000000, updatedAt: new Date(), updatedBy: IMPOSTER_UID
      }));
    });
    it('honest updatedBy (own uid) still succeeds — positive control', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.agentA);
      await assertSucceeds(ctx.firestore().doc(`properties/${DOC_IDS.property}`).update({
        price: 52000000, updatedAt: new Date(), updatedBy: UIDS.agentA
      }));
    });
  });

  // ── D. Property approval (admin approves) ──────────────────────────────
  describe('D. Property approval', () => {
    it('forged approvedBy (another real uid) is DENIED', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.admin);
      await assertFails(ctx.firestore().doc(`properties/${DOC_IDS.property}`).update({
        status: 'approved', approvedBy: IMPOSTER_UID, approvedAt: new Date(),
        updatedAt: new Date(), updatedBy: UIDS.admin
      }));
    });
    it('forged updatedBy (approvedBy honest) is ALSO DENIED', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.admin);
      await assertFails(ctx.firestore().doc(`properties/${DOC_IDS.property}`).update({
        status: 'approved', approvedBy: UIDS.admin, approvedAt: new Date(),
        updatedAt: new Date(), updatedBy: IMPOSTER_UID
      }));
    });
    it('honest approvedBy + updatedBy (own uid) still succeeds — positive control', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.admin);
      await assertSucceeds(ctx.firestore().doc(`properties/${DOC_IDS.property}`).update({
        status: 'approved', approvedBy: UIDS.admin, approvedAt: new Date(),
        updatedAt: new Date(), updatedBy: UIDS.admin
      }));
    });
  });

  // ── E. Site update (managing-agent content edit) ───────────────────────
  describe('E. Site update (managing agent content edit)', () => {
    it('forged updatedBy (another real uid) is DENIED', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.agentA);
      await assertFails(ctx.firestore().doc(`sites/${SITE_ID}`).update({
        description: 'Updated description', updatedAt: new Date(), updatedBy: IMPOSTER_UID
      }));
    });
    it('honest updatedBy (own uid) still succeeds — positive control', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.agentA);
      await assertSucceeds(ctx.firestore().doc(`sites/${SITE_ID}`).update({
        description: 'Updated description', updatedAt: new Date(), updatedBy: UIDS.agentA
      }));
    });
  });

  // ── F. Site approval (admin approves) ──────────────────────────────────
  describe('F. Site approval', () => {
    it('forged approvedBy (another real uid) is DENIED', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.admin);
      await assertFails(ctx.firestore().doc(`sites/${SITE_ID}`).update({
        status: 'active', approvedBy: IMPOSTER_UID, approvedAt: new Date(),
        updatedAt: new Date(), updatedBy: UIDS.admin
      }));
    });
    it('honest approvedBy (own uid) still succeeds — positive control', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.admin);
      await assertSucceeds(ctx.firestore().doc(`sites/${SITE_ID}`).update({
        status: 'active', approvedBy: UIDS.admin, approvedAt: new Date(),
        updatedAt: new Date(), updatedBy: UIDS.admin
      }));
    });
  });

  // ── G. Deal update (owning agent) ──────────────────────────────────────
  describe('G. Deal update (owning agent)', () => {
    it('forged updatedBy (another real uid) is DENIED', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.agentA);
      await assertFails(ctx.firestore().doc(`deals/${DOC_IDS.deal}`).update({
        agentId: UIDS.agentA, notes: 'Client wants a slight discount',
        updatedAt: new Date(), updatedBy: IMPOSTER_UID
      }));
    });
    it('honest updatedBy (own uid) still succeeds — positive control', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.agentA);
      await assertSucceeds(ctx.firestore().doc(`deals/${DOC_IDS.deal}`).update({
        agentId: UIDS.agentA, notes: 'Client wants a slight discount',
        updatedAt: new Date(), updatedBy: UIDS.agentA
      }));
    });
  });

  // ── H/I. Approval decision (CEO decides) ───────────────────────────────
  describe('H/I. Approval decision', () => {
    it('H. forged decidedBy (another real uid) is DENIED', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.ceo);
      await assertFails(ctx.firestore().doc(`approvals/${DOC_IDS.approvalPending}`).update({
        status: 'approved', decidedBy: IMPOSTER_UID, decidedAt: new Date(),
        updatedAt: new Date(), updatedBy: UIDS.ceo
      }));
    });
    it('I. forged updatedBy (decidedBy honest) is ALSO DENIED', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.ceo);
      await assertFails(ctx.firestore().doc(`approvals/${DOC_IDS.approvalPending}`).update({
        status: 'approved', decidedBy: UIDS.ceo, decidedAt: new Date(),
        updatedAt: new Date(), updatedBy: IMPOSTER_UID
      }));
    });
    it('honest decidedBy + updatedBy (own uid) still succeeds — positive control', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.ceo);
      await assertSucceeds(ctx.firestore().doc(`approvals/${DOC_IDS.approvalPending}`).update({
        status: 'approved', decidedBy: UIDS.ceo, decidedAt: new Date(),
        updatedAt: new Date(), updatedBy: UIDS.ceo
      }));
    });
  });

  // ── J. Messages (recipient marks read) ─────────────────────────────────
  describe('J. Messages (toId-owner marks read)', () => {
    it('forged updatedBy (another real uid) is DENIED', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.client);
      await assertFails(ctx.firestore().doc(`messages/${MESSAGE_ID}`).update({
        read: true, updatedAt: new Date(), updatedBy: IMPOSTER_UID
      }));
    });
    it('honest updatedBy (own uid) still succeeds — positive control', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.client);
      await assertSucceeds(ctx.firestore().doc(`messages/${MESSAGE_ID}`).update({
        read: true, updatedAt: new Date(), updatedBy: UIDS.client
      }));
    });
  });

  // ── K. Investments (investor's own status update) ──────────────────────
  describe('K. Investments (investor self-update)', () => {
    it('forged updatedBy (another real uid) is DENIED', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.client);
      await assertFails(ctx.firestore().doc(`investments/${INVESTMENT_ID}`).update({
        status: 'cancelled', updatedAt: new Date(), updatedBy: IMPOSTER_UID
      }));
    });
    it('honest updatedBy (own uid) still succeeds — positive control', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.client);
      await assertSucceeds(ctx.firestore().doc(`investments/${INVESTMENT_ID}`).update({
        status: 'cancelled', updatedAt: new Date(), updatedBy: UIDS.client
      }));
    });
  });

  // ── L1. Payout requests (staff approves) ───────────────────────────────
  describe('L1. Payout request approval', () => {
    it('forged approvedBy (another real uid) is DENIED', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.admin);
      await assertFails(ctx.firestore().doc(`payout_requests/${PAYOUT_VERIFIED_ID}`).update({
        status: 'approved', approvedBy: IMPOSTER_UID, approvedAt: new Date(),
        updatedAt: new Date(), updatedBy: UIDS.admin
      }));
    });
    it('honest approvedBy (own uid) still succeeds — positive control', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.admin);
      await assertSucceeds(ctx.firestore().doc(`payout_requests/${PAYOUT_VERIFIED_ID}`).update({
        status: 'approved', approvedBy: UIDS.admin, approvedAt: new Date(),
        updatedAt: new Date(), updatedBy: UIDS.admin
      }));
    });
  });

  // ── L2. Commissions (updatedBy pinned, approvedBy deliberately NOT) ────
  describe('L2. Commissions', () => {
    it('forged updatedBy (another real uid) is DENIED', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.admin);
      await assertFails(ctx.firestore().doc(`commissions/${DOC_IDS.commission}`).update({
        status: 'paid', updatedAt: new Date(), updatedBy: IMPOSTER_UID
      }));
    });
    it('honest updatedBy (own uid) still succeeds — positive control', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.admin);
      await assertSucceeds(ctx.firestore().doc(`commissions/${DOC_IDS.commission}`).update({
        status: 'paid', updatedAt: new Date(), updatedBy: UIDS.admin
      }));
    });
    it('approvedBy set to a display NAME (not a uid) is intentionally still allowed — schema exception, not a regression', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.admin);
      await assertSucceeds(ctx.firestore().doc(`commissions/${DOC_IDS.commission}`).update({
        status: 'approved', approvedBy: 'Jane Admin', approvedAt: new Date(),
        updatedAt: new Date(), updatedBy: UIDS.admin
      }));
    });
  });

  // ── L3. Users (self-edit) ───────────────────────────────────────────────
  describe('L3. Users (legitimate self-edit)', () => {
    it('forged updatedBy (another real uid) is DENIED', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.client);
      await assertFails(ctx.firestore().doc(`users/${UIDS.client}`).update({
        phone: '+250788000000', updatedAt: new Date(), updatedBy: IMPOSTER_UID
      }));
    });
    it('honest updatedBy (own uid) still succeeds — positive control', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.client);
      await assertSucceeds(ctx.firestore().doc(`users/${UIDS.client}`).update({
        phone: '+250788000000', updatedAt: new Date(), updatedBy: UIDS.client
      }));
    });
  });

  // ── Bypass-path checks (Phase 7) ─────────────────────────────────────
  describe('Bypass-path checks', () => {
    it('omitting updatedBy entirely from the write is still allowed (never made mandatory where it wasn\'t already)', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.agentA);
      await assertSucceeds(ctx.firestore().doc(`plots/${OWNER_PLOT_ID}`).update({
        plotLabel: 'No attribution field touched at all', updatedAt: new Date()
      }));
    });
    it('setting updatedBy to null is DENIED (null != request.auth.uid)', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.agentA);
      await assertFails(ctx.firestore().doc(`properties/${DOC_IDS.property}`).update({
        price: 51000000, updatedAt: new Date(), updatedBy: null
      }));
    });
    it('setting updatedBy to an empty string is DENIED', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.agentA);
      await assertFails(ctx.firestore().doc(`properties/${DOC_IDS.property}`).update({
        price: 51000000, updatedAt: new Date(), updatedBy: ''
      }));
    });
    it('setting updatedBy to an arbitrary/random (non-existent) uid is DENIED', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.agentA);
      await assertFails(ctx.firestore().doc(`properties/${DOC_IDS.property}`).update({
        price: 51000000, updatedAt: new Date(), updatedBy: 'totally_made_up_uid_xyz'
      }));
    });
    it('a stale updatedBy already on the document (from a PRIOR write by someone else) never blocks a legitimate write that does not touch the field', async () => {
      // Seed the document with updatedBy already pointing at a completely
      // different user (simulating a real prior edit), bypassing rules.
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc(`properties/${DOC_IDS.property}`).update({ updatedBy: IMPOSTER_UID });
      });
      const ctx = testEnv.authenticatedContext(UIDS.agentA);
      // This write touches `price` only — never `updatedBy` — so the stale
      // IMPOSTER_UID value already on the document must be irrelevant.
      await assertSucceeds(ctx.firestore().doc(`properties/${DOC_IDS.property}`).update({
        price: 53000000
      }));
    });
    it('using create instead of update cannot re-open the same document\'s attribution once it exists (create only applies to brand-new documents)', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.agentA);
      await assertFails(ctx.firestore().doc(`properties/${DOC_IDS.property}`).set({
        id: DOC_IDS.property, agentId: UIDS.agentA, status: 'pending',
        createdAt: new Date(), updatedAt: new Date(), createdBy: IMPOSTER_UID, updatedBy: IMPOSTER_UID,
        isActive: true
      }));
    });
  });
});
