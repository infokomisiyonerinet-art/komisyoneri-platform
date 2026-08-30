// Plot/Site Governance Hardening — closes the two CRITICAL findings from
// the FINAL STATUS GOVERNANCE & ANTI-FRAUD AUDIT:
//   F-1: plots/{plotId}'s managingAgentId ownership branch was a completely
//        unrestricted write once the caller matched the site's
//        managingAgentId — no field allowlist, no hasPerm() check at all.
//   F-2: sites/{siteId}'s managingAgentId/developerId ownership branches
//        had the identical problem.
//   Plus: transactionSource had NO rule constraint anywhere in the file;
//   isActive was never checked by any authority helper (a suspended
//   account's role-derived authority kept working); a plot's clientId
//   ownership branch let a "client" self-finalize a sale by writing
//   status:'sold' directly; reversing an already-sold plot only needed
//   plots.change_status, not plots.mark_sold; sold/unavailable transitions
//   accepted an empty reason.
//
// See rules/firestore.rules' _isPlotOwnerContentEditOK(),
// _isSiteOwnerContentEditOK(), _plotTransactionSourceOK(),
// _callerIsActive(), _isClientOwnReservationCancelOK(), _plotStatusOK(),
// and _plotStatusReasonOK() / _isPropertySoldReasonOK() for the fixes these
// tests verify.

const { assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { makeTestEnv } = require('../testenv');
const { seed, UIDS, DOC_IDS, standardFields } = require('../seed');

const SITE_ID = 'gov_test_site';
const PLOT_ID = 'gov_test_plot';
const SOLD_PLOT_ID = 'gov_test_plot_sold';
const MANAGING_AGENT_UID = 'gov_managing_agent_test_user';
const SUSPENDED_AGENT_UID = 'gov_suspended_agent_test_user';
const DEVELOPER_UID = 'gov_developer_test_user';
const RESERVING_CLIENT_UID = 'gov_reserving_client_test_user';
const SUSPENDED_CLIENT_UID = 'gov_suspended_client_test_user';
const SUSPENDED_CEO_UID = 'gov_suspended_ceo_test_user';
const SUSPENDED_ADMIN_UID = 'gov_suspended_admin_test_user';

describe('Plot/Site Governance Hardening (P0-P2)', function () {
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
        phone: '+250700000000', role, isActive: true, status: 'active', photoURL: '',
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        createdBy: 'seed', updatedBy: 'seed'
      }, extra));

      await userDoc(MANAGING_AGENT_UID, 'agent');
      await userDoc(SUSPENDED_AGENT_UID, 'agent', { isActive: false });
      await userDoc(DEVELOPER_UID, 'developer');
      await userDoc(RESERVING_CLIENT_UID, 'client');
      await userDoc(SUSPENDED_CLIENT_UID, 'client', { isActive: false });
      await userDoc(SUSPENDED_CEO_UID, 'ceo', { isActive: false });
      await userDoc(SUSPENDED_ADMIN_UID, 'admin', { isActive: false });

      await db.collection('sites').doc(SITE_ID).set(standardFields({
        id: SITE_ID, name: 'Governance Test Site', status: 'pending_review',
        managingAgentId: MANAGING_AGENT_UID, developerId: DEVELOPER_UID,
        commissionRate: 4, totalPlots: 2, availablePlots: 1, reservedPlots: 0, soldPlots: 1
      }));
      await db.collection('plots').doc(PLOT_ID).set(standardFields({
        id: PLOT_ID, siteId: SITE_ID, status: 'available',
        clientId: '', agentId: MANAGING_AGENT_UID, price: 5000000, plotNumber: 'A1'
      }));
      await db.collection('plots').doc(SOLD_PLOT_ID).set(standardFields({
        id: SOLD_PLOT_ID, siteId: SITE_ID, status: 'sold',
        clientId: RESERVING_CLIENT_UID, agentId: MANAGING_AGENT_UID, price: 5000000, plotNumber: 'A2'
      }));
      // Reserved-by-RESERVING_CLIENT_UID plot, for the client-cancel branch tests.
      await db.collection('plots').doc(PLOT_ID + '_reserved').set(standardFields({
        id: PLOT_ID + '_reserved', siteId: SITE_ID, status: 'reserved',
        clientId: RESERVING_CLIENT_UID, agentId: MANAGING_AGENT_UID, price: 5000000, plotNumber: 'A3'
      }));

      // Grant director full plot/site governance permissions for the
      // plots.mark_sold vs plots.change_status split tests below.
      await db.collection('role_permissions').doc('director').set({
        role: 'director',
        permissions: ['properties.view', 'properties.approve', 'properties.change_status',
          'sites.view', 'sites.approve', 'plots.view', 'plots.change_status', 'plots.mark_sold',
          'agents.view', 'leads.view', 'leads.assign', 'commissions.view'],
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        createdBy: 'seed', updatedBy: 'seed'
      });
      // chiefBroker gets plots.change_status but deliberately NOT
      // plots.mark_sold — isolates the mark_sold-specific gates below.
      await db.collection('role_permissions').doc('chief_broker').set({
        role: 'chief_broker',
        permissions: ['properties.view', 'sites.view', 'plots.view', 'plots.change_status',
          'agents.view', 'agents.verify', 'leads.view', 'leads.assign', 'commissions.view'],
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        createdBy: 'seed', updatedBy: 'seed'
      });
    });
  });

  describe('P0.1 — plots managingAgentId bypass closed (finding F-1)', () => {
    it('managing agent CANNOT mark their own plot sold via the ownership branch', async () => {
      const ctx = testEnv.authenticatedContext(MANAGING_AGENT_UID);
      await assertFails(
        ctx.firestore().doc(`plots/${PLOT_ID}`).update({ status: 'sold', statusChangeReason: 'self-dealing attempt' })
      );
    });

    it('managing agent CANNOT set transactionSource on their own plot via the ownership branch', async () => {
      const ctx = testEnv.authenticatedContext(MANAGING_AGENT_UID);
      await assertFails(
        ctx.firestore().doc(`plots/${PLOT_ID}`).update({ transactionSource: 'external' })
      );
    });

    it('managing agent CANNOT hijack clientId on their own plot via the ownership branch', async () => {
      const ctx = testEnv.authenticatedContext(MANAGING_AGENT_UID);
      await assertFails(
        ctx.firestore().doc(`plots/${PLOT_ID}`).update({ clientId: MANAGING_AGENT_UID })
      );
    });

    it('managing agent CANNOT inflate plot price via the ownership branch', async () => {
      const ctx = testEnv.authenticatedContext(MANAGING_AGENT_UID);
      await assertFails(
        ctx.firestore().doc(`plots/${PLOT_ID}`).update({ price: 999999999 })
      );
    });

    it('managing agent CAN still edit legitimate plot content fields via the ownership branch', async () => {
      const ctx = testEnv.authenticatedContext(MANAGING_AGENT_UID);
      await assertSucceeds(
        ctx.firestore().doc(`plots/${PLOT_ID}`).update({ plotLabel: 'Corner Plot A1', isCorner: true })
      );
    });
  });

  describe('P0.2 — sites managingAgentId/developerId bypass closed (finding F-2)', () => {
    it('managing agent CANNOT self-approve their own site via the ownership branch', async () => {
      const ctx = testEnv.authenticatedContext(MANAGING_AGENT_UID);
      await assertFails(
        ctx.firestore().doc(`sites/${SITE_ID}`).update({ status: 'active', approvedBy: MANAGING_AGENT_UID })
      );
    });

    it('managing agent CANNOT raise their own site\'s commissionRate via the ownership branch', async () => {
      const ctx = testEnv.authenticatedContext(MANAGING_AGENT_UID);
      await assertFails(
        ctx.firestore().doc(`sites/${SITE_ID}`).update({ commissionRate: 20 })
      );
    });

    it('managing agent CANNOT falsify site inventory counters via the ownership branch', async () => {
      const ctx = testEnv.authenticatedContext(MANAGING_AGENT_UID);
      await assertFails(
        ctx.firestore().doc(`sites/${SITE_ID}`).update({ soldPlots: 999 })
      );
    });

    it('managing agent CAN still edit legitimate site content fields via the ownership branch', async () => {
      const ctx = testEnv.authenticatedContext(MANAGING_AGENT_UID);
      await assertSucceeds(
        ctx.firestore().doc(`sites/${SITE_ID}`).update({ description: 'Updated marketing copy' })
      );
    });

    it('developer CANNOT self-approve the site via the developerId ownership branch', async () => {
      const ctx = testEnv.authenticatedContext(DEVELOPER_UID);
      await assertFails(
        ctx.firestore().doc(`sites/${SITE_ID}`).update({ status: 'active' })
      );
    });

    it('developer CAN still edit legitimate site content fields via the developerId ownership branch', async () => {
      const ctx = testEnv.authenticatedContext(DEVELOPER_UID);
      await assertSucceeds(
        ctx.firestore().doc(`sites/${SITE_ID}`).update({ roadType: 'paved' })
      );
    });
  });

  describe('P0.3 — transactionSource gated behind plots.mark_sold', () => {
    it('staff with plots.change_status only CANNOT set transactionSource', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.chiefBroker);
      await assertFails(
        ctx.firestore().doc(`plots/${PLOT_ID}`).update({ transactionSource: 'komisyoneri' })
      );
    });

    it('staff with plots.mark_sold CAN set transactionSource alongside marking a plot sold', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.director);
      await assertSucceeds(
        ctx.firestore().doc(`plots/${PLOT_ID}`).update({
          status: 'sold', transactionSource: 'komisyoneri', statusChangeReason: 'Confirmed sale'
        })
      );
    });
  });

  describe('P0.4 — direct-Firestore-write adversarial coverage', () => {
    it('unauthorized direct write of plots.status=sold fails (no hasPerm branch matched)', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.hr);
      await assertFails(
        ctx.firestore().doc(`plots/${PLOT_ID}`).update({ status: 'sold', statusChangeReason: 'unauthorized' })
      );
    });

    it('unauthorized direct write of sites.status=approved fails (no sites.approve)', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.hr);
      await assertFails(
        ctx.firestore().doc(`sites/${SITE_ID}`).update({ status: 'active' })
      );
    });

    it('staff with neither plots.change_status nor plots.mark_sold cannot move a plot to reserved', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.finance); // accountant — commissions.manage only
      await assertFails(
        ctx.firestore().doc(`plots/${PLOT_ID}`).update({ status: 'reserved' })
      );
    });
  });

  describe('P2.7 — direction-aware plot status governance (reversing a sale)', () => {
    it('plots.change_status alone CANNOT revert an already-sold plot back to available', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.chiefBroker);
      await assertFails(
        ctx.firestore().doc(`plots/${SOLD_PLOT_ID}`).update({ status: 'available' })
      );
    });

    it('plots.mark_sold CAN revert an already-sold plot back to available', async () => {
      // P0-2 hardening: a reversal out of 'sold' now requires its own fresh
      // statusChangeReason (see rules/firestore.rules' _plotStatusReasonOK()) —
      // this fixture call is updated to supply one so it keeps testing what
      // it always meant to ("reversal succeeds when authorized"), now
      // correctly satisfying that requirement instead of relying on the gap
      // this same hardening pass closes (see 11-*-spec.js for the
      // adversarial coverage of the gap itself).
      const ctx = testEnv.authenticatedContext(UIDS.director);
      await assertSucceeds(
        ctx.firestore().doc(`plots/${SOLD_PLOT_ID}`).update({ status: 'available', statusChangeReason: 'Deal fell through' })
      );
    });
  });

  describe('P2.9 — non-empty reason required for finalizing transitions', () => {
    it('plots: transition to sold WITHOUT statusChangeReason fails', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.director);
      await assertFails(
        ctx.firestore().doc(`plots/${PLOT_ID}`).update({ status: 'sold' })
      );
    });

    it('plots: transition to unavailable WITHOUT statusChangeReason fails', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.director);
      await assertFails(
        ctx.firestore().doc(`plots/${PLOT_ID}`).update({ status: 'unavailable' })
      );
    });

    it('plots: transition to unavailable WITH statusChangeReason succeeds', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.director);
      await assertSucceeds(
        ctx.firestore().doc(`plots/${PLOT_ID}`).update({ status: 'unavailable', statusChangeReason: 'Owner withdrew plot' })
      );
    });

    it('properties: transition to sold WITHOUT availabilityReason fails', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.admin);
      await assertFails(
        ctx.firestore().doc(`properties/${DOC_IDS.property}`).update({ availability: 'sold' })
      );
    });
  });

  describe('P1.6 — suspended (isActive:false) callers lose authority', () => {
    it('a suspended CEO (isActive:false) CANNOT approve a property (isAdminOrStaff-gated write)', async () => {
      const ctx = testEnv.authenticatedContext(SUSPENDED_CEO_UID);
      await assertFails(
        ctx.firestore().doc(`properties/${DOC_IDS.property}`).update({ status: 'approved' })
      );
    });

    it('a suspended admin (isActive:false) CAN STILL approve a property — Admin bypass stays unconditional', async () => {
      const ctx = testEnv.authenticatedContext(SUSPENDED_ADMIN_UID);
      await assertSucceeds(
        ctx.firestore().doc(`properties/${DOC_IDS.property}`).update({ status: 'approved' })
      );
    });

    it('a suspended managing agent CANNOT use the plot content-edit ownership branch', async () => {
      const ctx = testEnv.authenticatedContext(SUSPENDED_AGENT_UID);
      await testEnv.withSecurityRulesDisabled(async (bgCtx) => {
        await bgCtx.firestore().doc(`sites/${SITE_ID}`).update({ managingAgentId: SUSPENDED_AGENT_UID });
      });
      await assertFails(
        ctx.firestore().doc(`plots/${PLOT_ID}`).update({ plotLabel: 'Suspended agent edit attempt' })
      );
    });

    it('a suspended managing agent CANNOT use the site content-edit ownership branch', async () => {
      const ctx = testEnv.authenticatedContext(SUSPENDED_AGENT_UID);
      await testEnv.withSecurityRulesDisabled(async (bgCtx) => {
        await bgCtx.firestore().doc(`sites/${SITE_ID}`).update({ managingAgentId: SUSPENDED_AGENT_UID });
      });
      await assertFails(
        ctx.firestore().doc(`sites/${SITE_ID}`).update({ description: 'Suspended agent edit attempt' })
      );
    });

    it('a suspended client CANNOT cancel their own plot reservation', async () => {
      const ctx = testEnv.authenticatedContext(SUSPENDED_CLIENT_UID);
      await testEnv.withSecurityRulesDisabled(async (bgCtx) => {
        await bgCtx.firestore().doc(`plots/${PLOT_ID}_reserved`).update({ clientId: SUSPENDED_CLIENT_UID });
      });
      await assertFails(
        ctx.firestore().doc(`plots/${PLOT_ID}_reserved`).update({ status: 'available', clientId: '', reservedAt: null, reservedUntil: null })
      );
    });
  });

  describe('Client-owned-reservation branch — cancellation only, never self-finalizing a sale', () => {
    it('client with matching clientId CAN cancel their own reservation (reserved -> available)', async () => {
      const ctx = testEnv.authenticatedContext(RESERVING_CLIENT_UID);
      await assertSucceeds(
        ctx.firestore().doc(`plots/${PLOT_ID}_reserved`).update({
          status: 'available', clientId: '', reservedAt: null, reservedUntil: null
        })
      );
    });

    it('client with matching clientId CANNOT self-finalize a sale (status: sold) via this branch', async () => {
      const ctx = testEnv.authenticatedContext(RESERVING_CLIENT_UID);
      await assertFails(
        ctx.firestore().doc(`plots/${PLOT_ID}_reserved`).update({ status: 'sold' })
      );
    });

    it('client with matching clientId on an ALREADY-sold plot cannot touch it via this branch', async () => {
      const ctx = testEnv.authenticatedContext(RESERVING_CLIENT_UID);
      await assertFails(
        ctx.firestore().doc(`plots/${SOLD_PLOT_ID}`).update({ status: 'available' })
      );
    });

    it('client CANNOT smuggle an unrelated field (price) into a reservation-cancel write', async () => {
      const ctx = testEnv.authenticatedContext(RESERVING_CLIENT_UID);
      await assertFails(
        ctx.firestore().doc(`plots/${PLOT_ID}_reserved`).update({ status: 'available', price: 1 })
      );
    });
  });
});
