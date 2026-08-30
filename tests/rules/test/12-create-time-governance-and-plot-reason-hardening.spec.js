// P0 fixes from the FINAL END-TO-END GOVERNANCE, STATUS & ANTI-FRAUD
// SECURITY AUDIT:
//
//   P0-1 (CREATE-TIME GOVERNANCE BYPASS): properties/sites/plots create
//   rules only checked hasStandardFields() — that certain KEYS exist, never
//   their VALUES — so any authenticated user (an agent included) could
//   create a brand-new document already in an end/approved state
//   (properties status:'approved', sites status:'active', plots
//   status:'sold'/'reserved'/etc.), completely bypassing
//   properties.approve/sites.approve/plots.mark_sold and every other
//   review gate those permissions exist to enforce. Fixed by
//   _isPropertyCreateStatusOK()/_isPropertyCreateAvailabilityOK(),
//   _isSiteCreateStatusOK(), and _isPlotCreateStatusOK() in
//   rules/firestore.rules — properties/sites keep the one legitimate
//   admin/staff one-step auto-approve-on-create fast path (gated behind
//   the SAME hasPerm() already governing that value via update, so no new
//   privilege is introduced); plots have no such exception since no real
//   creation call site ever sends a non-'available' status.
//
//   P0-2 (PLOT SOLD REVERSAL REASON): _plotStatusReasonOK() checked the
//   post-merge statusChangeReason value, not this write's own diff, so an
//   update that omitted the field entirely could still pass on a STALE
//   reason left over from a prior, unrelated transition — the same bug
//   already fixed for properties' availabilityReason (see
//   10-property-status-governance-hardening.spec.js). Also extended to
//   require a FRESH reason when REVERSING a plot back OUT of 'sold', not
//   just when entering it.

const { assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { makeTestEnv } = require('../testenv');
const { seed, UIDS, DOC_IDS, standardFields } = require('../seed');

const SITE_ID = 'ctgh_test_site';
const STALE_REASON_PLOT_ID = 'ctgh_stale_reason_sold_plot';

describe('Create-Time Governance (P0-1) & Plot Sold-Reversal Reason (P0-2)', function () {
  this.timeout(20000);
  let testEnv;

  before(async () => { testEnv = await makeTestEnv(); });
  after(async () => { await testEnv.cleanup(); });

  beforeEach(async () => {
    await testEnv.clearFirestore();
    await seed(testEnv);
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();

      await db.collection('sites').doc(SITE_ID).set(standardFields({
        id: SITE_ID, name: 'Create-Time Governance Test Site', status: 'pending_review',
        managingAgentId: UIDS.agentA, developerId: '',
        commissionRate: 4, totalPlots: 1, availablePlots: 0, reservedPlots: 0, soldPlots: 1
      }));

      // Already-sold plot carrying a REAL, pre-existing statusChangeReason
      // from its original sale — deliberately so tests #6/#7 have a
      // realistic stale value to fail against (an update omitting the
      // field entirely still merges with THIS string already present,
      // which is exactly the gap the old, pre-P0-2 rule missed — see
      // 10-property-status-governance-hardening.spec.js's own SOLD_PROPERTY_ID
      // fixture for the identical pattern on the properties side).
      await db.collection('plots').doc(STALE_REASON_PLOT_ID).set(standardFields({
        id: STALE_REASON_PLOT_ID, siteId: SITE_ID, status: 'sold',
        clientId: UIDS.client, agentId: UIDS.agentA, price: 5000000, plotNumber: 'B1',
        statusChangeReason: 'Confirmed cash sale (seed)'
      }));

      // Director: plots.mark_sold granted, for test #8 (authorized reversal
      // with a NEW reason succeeds).
      await db.collection('role_permissions').doc('director').set({
        role: 'director',
        permissions: ['properties.view', 'properties.approve', 'sites.view', 'sites.approve',
          'plots.view', 'plots.change_status', 'plots.mark_sold'],
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        createdBy: 'seed', updatedBy: 'seed'
      });
    });
  });

  describe('P0-1 — an ordinary agent cannot create a document already in an end/approved state', () => {
    it('#1 agent CANNOT create a property with status=\'approved\'', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.agentA);
      await assertFails(
        ctx.firestore().collection('properties').add({
          id: 'ctgh_bad_prop_1', agentId: UIDS.agentA, ownerId: UIDS.agentA,
          title: 'Self-Approved Listing', type: 'Apartment', district: 'Kicukiro', sector: 'Niboye',
          price: 20000000, bedrooms: 2, bathrooms: 1, area: 80, description: '', amenities: [], images: [],
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          createdBy: UIDS.agentA, updatedBy: UIDS.agentA, status: 'approved', isActive: true
        })
      );
    });

    it('#2 agent CANNOT create a property directly as availability=\'sold\'', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.agentA);
      await assertFails(
        ctx.firestore().collection('properties').add({
          id: 'ctgh_bad_prop_2', agentId: UIDS.agentA, ownerId: UIDS.agentA,
          title: 'Pre-Sold Listing', type: 'Apartment', district: 'Kicukiro', sector: 'Niboye',
          price: 20000000, bedrooms: 2, bathrooms: 1, area: 80, description: '', amenities: [], images: [],
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          createdBy: UIDS.agentA, updatedBy: UIDS.agentA, status: 'pending', isActive: true,
          availability: 'sold'
        })
      );
    });

    it('#3 agent CANNOT create a site with status=\'active\'', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.agentA);
      await assertFails(
        ctx.firestore().collection('sites').add(standardFields({
          id: 'ctgh_bad_site_1', name: 'Self-Approved Site', status: 'active',
          managingAgentId: UIDS.agentA, developerId: '', commissionRate: 4,
          totalPlots: 0, availablePlots: 0, reservedPlots: 0, soldPlots: 0
        }))
      );
    });

    it('#4 agent CANNOT create a plot with status=\'sold\'', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.agentA);
      await assertFails(
        ctx.firestore().collection('plots').add(standardFields({
          id: 'ctgh_bad_plot_1', siteId: SITE_ID, status: 'sold',
          clientId: UIDS.client, agentId: UIDS.agentA, price: 5000000, plotNumber: 'C1'
        }))
      );
    });

    it('#5 agent CANNOT create a plot with status=\'reserved\'', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.agentA);
      await assertFails(
        ctx.firestore().collection('plots').add(standardFields({
          id: 'ctgh_bad_plot_2', siteId: SITE_ID, status: 'reserved',
          clientId: UIDS.client, agentId: UIDS.agentA, price: 5000000, plotNumber: 'C2'
        }))
      );
    });
  });

  describe('P0-2 — plot sold->reversal requires a FRESH statusChangeReason, not a stale one', () => {
    it('#6 plot sold -> available WITHOUT a new statusChangeReason fails', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.director);
      await assertFails(
        ctx.firestore().doc(`plots/${STALE_REASON_PLOT_ID}`).update({ status: 'available' })
      );
    });

    it('#7 plot sold -> available using only the OLD/stale reason already on the document fails', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.director);
      await assertFails(
        ctx.firestore().doc(`plots/${STALE_REASON_PLOT_ID}`).update({
          status: 'available', statusChangeReason: 'Confirmed cash sale (seed)'
        })
      );
    });

    it('#8 plot sold -> available WITH a NEW valid reason succeeds for a caller holding plots.mark_sold', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.director);
      await assertSucceeds(
        ctx.firestore().doc(`plots/${STALE_REASON_PLOT_ID}`).update({
          status: 'available', statusChangeReason: 'Buyer defaulted, sale reversed'
        })
      );
    });
  });

  describe('P0-1 — legitimate initial-state creation still succeeds', () => {
    it('#9a property create with status=\'pending\' succeeds', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.agentA);
      await assertSucceeds(
        ctx.firestore().collection('properties').add({
          id: 'ctgh_good_prop', agentId: UIDS.agentA, ownerId: UIDS.agentA,
          title: 'Ordinary Listing', type: 'Apartment', district: 'Kicukiro', sector: 'Niboye',
          price: 20000000, bedrooms: 2, bathrooms: 1, area: 80, description: '', amenities: [], images: [],
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          createdBy: UIDS.agentA, updatedBy: UIDS.agentA, status: 'pending', isActive: true
        })
      );
    });

    it('#9b site create with status=\'pending_review\' succeeds', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.agentA);
      await assertSucceeds(
        ctx.firestore().collection('sites').add(standardFields({
          id: 'ctgh_good_site', name: 'Ordinary Site', status: 'pending_review',
          managingAgentId: UIDS.agentA, developerId: '', commissionRate: 4,
          totalPlots: 0, availablePlots: 0, reservedPlots: 0, soldPlots: 0
        }))
      );
    });

    it('#9c plot create with status=\'available\' succeeds', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.agentA);
      await assertSucceeds(
        ctx.firestore().collection('plots').add(standardFields({
          id: 'ctgh_good_plot', siteId: SITE_ID, status: 'available',
          clientId: '', agentId: UIDS.agentA, price: 5000000, plotNumber: 'C3'
        }))
      );
    });

    it('#9d admin/staff authorized fast-path: property create with status=\'approved\' still succeeds (properties.approve)', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.admin);
      await assertSucceeds(
        ctx.firestore().collection('properties').add({
          id: 'ctgh_good_prop_fastpath', agentId: UIDS.admin, ownerId: UIDS.admin,
          title: 'Admin Fast-Path Listing', type: 'Apartment', district: 'Kicukiro', sector: 'Niboye',
          price: 20000000, bedrooms: 2, bathrooms: 1, area: 80, description: '', amenities: [], images: [],
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          createdBy: UIDS.admin, updatedBy: UIDS.admin, status: 'approved', isActive: true
        })
      );
    });

    it('#9e admin/staff authorized fast-path: site create with status=\'active\' still succeeds (sites.approve)', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.admin);
      await assertSucceeds(
        ctx.firestore().collection('sites').add(standardFields({
          id: 'ctgh_good_site_fastpath', name: 'Admin Fast-Path Site', status: 'active',
          managingAgentId: UIDS.admin, developerId: '', commissionRate: 4,
          totalPlots: 0, availablePlots: 0, reservedPlots: 0, soldPlots: 0
        }))
      );
    });
  });
});
