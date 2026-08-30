// Dynamic RBAC / Progressive Governance — the granular role_permissions
// layer (rules/firestore.rules' hasPerm()) that narrows a handful of
// high-risk transitions (property approve/reject, agent verify, commission/
// payout approval, role reassignment) from blanket isAdminOrStaff() trust
// down to whichever roles are actually configured for them.
//
// These four scenarios are the ones explicitly required before this layer
// could ship:
//   1. Admin works even with NO role_permissions document at all (absent-
//      staff fallback / Ultimate Authority — hasPerm() must never depend on
//      this collection for isAdmin()).
//   2. A role configured with the relevant permission (operations) CAN
//      perform the gated action.
//   3. A staff-tier role NOT configured with it (hr_manager) CANNOT.
//   4. A role with no role_permissions doc at all defaults to deny, not
//      allow — "unknown role" in the sense that matters: nothing was ever
//      configured for it, so hasPerm() must not default-allow.
//
// Plus the two structural safeguards from the governance requirements:
//   - role_permissions is writable only by isAdmin() (not even isCEO() or
//     other staff-tier roles) — "permissions managed only through the
//     authorized Admin UI."
//   - 'users.manage_roles'/'audit.export' can never be written into ANY
//     role's permissions array, even by Admin — those stay hardcoded.
//   - the `role` field on users/{uid} is Admin/CEO-only, closing the
//     pre-existing gap where any isAdminOrStaff() role could self-escalate
//     another account's role via the blanket staff-tier grant.

const { assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { makeTestEnv } = require('../testenv');
const { seed, UIDS, DOC_IDS, standardFields } = require('../seed');

const OPERATIONS_UID = 'operations_test_user';
const TEST_SITE_ID = 'rbac_test_site';
const TEST_PLOT_ID = 'rbac_test_plot';
// Owned by a third party (neither director nor chiefBroker) so the plots
// rule's managingAgentId ownership branch never fires — isolating exactly
// the isAdminOrStaff()+hasPerm() branch these tests are about.
const PLOT_OWNING_AGENT_UID = 'plot_owning_agent_test_user';

describe('Dynamic RBAC — role_permissions / hasPerm()', function () {
  this.timeout(20000);
  let testEnv;

  before(async () => { testEnv = await makeTestEnv(); });
  after(async () => { await testEnv.cleanup(); });
  beforeEach(async () => {
    await testEnv.clearFirestore();
    await seed(testEnv);
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().collection('users').doc(OPERATIONS_UID).set({
        id: OPERATIONS_UID, uid: OPERATIONS_UID, displayName: 'Operations Test',
        email: OPERATIONS_UID + '@test.local', phone: '+250700000099',
        role: 'operations', department: 'Operations', jobTitle: 'Operations Manager',
        reportsTo: [UIDS.director, UIDS.ceo], isActive: true, status: 'active',
        photoURL: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        createdBy: 'seed', updatedBy: 'seed'
      });
    });
  });

  describe('1. Admin works with NO role_permissions document at all', () => {
    it('admin CAN approve a property when role_permissions/admin does not exist', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.admin);
      await assertSucceeds(
        ctx.firestore().doc(`properties/${DOC_IDS.property}`).update({ status: 'approved' })
      );
    });

    it('admin CAN reject a property when role_permissions/admin does not exist', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.admin);
      await assertSucceeds(
        ctx.firestore().doc(`properties/${DOC_IDS.property}`).update({ status: 'rejected' })
      );
    });

    it('admin CAN verify an agent with no role_permissions document at all', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.admin);
      await assertSucceeds(
        ctx.firestore().doc(`users/${UIDS.agentA}`).update({ isVerified: true })
      );
    });
  });

  describe('2. A role configured with the permission CAN perform the action', () => {
    beforeEach(async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().collection('role_permissions').doc('operations').set({
          role: 'operations',
          permissions: ['properties.view', 'properties.approve', 'properties.reject', 'agents.verify'],
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          createdBy: 'seed', updatedBy: 'seed'
        });
      });
    });

    it('operations CAN approve a property', async () => {
      const ctx = testEnv.authenticatedContext(OPERATIONS_UID);
      await assertSucceeds(
        ctx.firestore().doc(`properties/${DOC_IDS.property}`).update({ status: 'approved' })
      );
    });

    it('operations CAN reject a property', async () => {
      const ctx = testEnv.authenticatedContext(OPERATIONS_UID);
      await assertSucceeds(
        ctx.firestore().doc(`properties/${DOC_IDS.property}`).update({ status: 'rejected' })
      );
    });

    it('operations CAN verify a pending agent', async () => {
      const ctx = testEnv.authenticatedContext(OPERATIONS_UID);
      await assertSucceeds(
        ctx.firestore().doc(`users/${UIDS.agentA}`).update({ isVerified: true })
      );
    });
  });

  describe('3. A staff-tier role NOT configured with the permission CANNOT perform the action', () => {
    it('hr_manager CANNOT approve a property (no role_permissions/hr_manager doc)', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.hr);
      await assertFails(
        ctx.firestore().doc(`properties/${DOC_IDS.property}`).update({ status: 'approved' })
      );
    });

    it('hr_manager still CAN edit non-status property fields (unaffected)', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.hr);
      await assertSucceeds(
        ctx.firestore().doc(`properties/${DOC_IDS.property}`).update({ price: 55000000 })
      );
    });

    it('hr_manager CANNOT approve a property even WITH a role_permissions doc that omits properties.approve', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().collection('role_permissions').doc('hr_manager').set({
          role: 'hr_manager', permissions: ['properties.view', 'agents.view'],
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          createdBy: 'seed', updatedBy: 'seed'
        });
      });
      const ctx = testEnv.authenticatedContext(UIDS.hr);
      await assertFails(
        ctx.firestore().doc(`properties/${DOC_IDS.property}`).update({ status: 'approved' })
      );
    });

    it('hr_manager CANNOT verify a pending agent', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.hr);
      await assertFails(
        ctx.firestore().doc(`users/${UIDS.agentA}`).update({ isVerified: true })
      );
    });

    it('marketing_manager CANNOT approve commissions/payouts (commissions.manage not configured)', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.marketing);
      await assertFails(
        ctx.firestore().doc(`commissions/${DOC_IDS.commission}`).update({ status: 'approved' })
      );
    });
  });

  describe('4. A role with no role_permissions doc at all defaults to DENY, not allow', () => {
    it('a staff-tier role with zero configured permissions is denied a hasPerm()-gated action', async () => {
      // chief_broker exists in isAdminOrStaff() but has no role_permissions
      // doc in this test (only seeded in scenario 2's own beforeEach) —
      // hasPerm() must resolve this as deny, not throw or default-allow.
      const ctx = testEnv.authenticatedContext(UIDS.chiefBroker);
      await assertFails(
        ctx.firestore().doc(`properties/${DOC_IDS.property}`).update({ status: 'approved' })
      );
    });

    it('an empty permissions array denies every gated action for that role', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().collection('role_permissions').doc('operations').set({
          role: 'operations', permissions: [],
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          createdBy: 'seed', updatedBy: 'seed'
        });
      });
      const ctx = testEnv.authenticatedContext(OPERATIONS_UID);
      await assertFails(
        ctx.firestore().doc(`properties/${DOC_IDS.property}`).update({ status: 'approved' })
      );
    });
  });

  describe('Structural safeguards', () => {
    it('role_permissions is writable by isAdmin() only — CEO cannot write it', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.ceo);
      await assertFails(
        ctx.firestore().collection('role_permissions').doc('operations').set({
          role: 'operations', permissions: ['properties.approve'],
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          createdBy: UIDS.ceo, updatedBy: UIDS.ceo
        })
      );
    });

    it('role_permissions is writable by isAdmin() only — a staff-tier role cannot write its own', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.hr);
      await assertFails(
        ctx.firestore().collection('role_permissions').doc('hr_manager').set({
          role: 'hr_manager', permissions: ['properties.approve'],
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          createdBy: UIDS.hr, updatedBy: UIDS.hr
        })
      );
    });

    it('admin CAN write role_permissions', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.admin);
      await assertSucceeds(
        ctx.firestore().collection('role_permissions').doc('operations').set({
          role: 'operations', permissions: ['properties.approve'],
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          createdBy: UIDS.admin, updatedBy: UIDS.admin
        })
      );
    });

    it('even admin CANNOT write users.manage_roles into a role\'s permissions array', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.admin);
      await assertFails(
        ctx.firestore().collection('role_permissions').doc('operations').set({
          role: 'operations', permissions: ['properties.approve', 'users.manage_roles'],
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          createdBy: UIDS.admin, updatedBy: UIDS.admin
        })
      );
    });

    it('even admin CANNOT write audit.export into a role\'s permissions array', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.admin);
      await assertFails(
        ctx.firestore().collection('role_permissions').doc('operations').set({
          role: 'operations', permissions: ['audit.export'],
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          createdBy: UIDS.admin, updatedBy: UIDS.admin
        })
      );
    });

    it('changing a user\'s `role` field is Admin/CEO-only — hr_manager cannot reassign a colleague\'s role', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.hr);
      await assertFails(
        ctx.firestore().doc(`users/${UIDS.marketing}`).update({ role: 'admin' })
      );
    });

    it('admin CAN change a user\'s role', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.admin);
      await assertSucceeds(
        ctx.firestore().doc(`users/${UIDS.marketing}`).update({ role: 'operations' })
      );
    });

    it('ceo CAN change a user\'s role', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.ceo);
      await assertSucceeds(
        ctx.firestore().doc(`users/${UIDS.marketing}`).update({ role: 'operations' })
      );
    });

    // CRITICAL — found during the pre-production governance audit: CEO must
    // never be able to escalate ANY account (including their own) straight
    // to admin/super_admin. That would make Ultimate Authority not actually
    // Admin-only, and would render role_permissions' own Admin-only write
    // gate pointless (why edit permissions when you can just become Admin).
    it('ceo CANNOT promote another user to admin', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.ceo);
      await assertFails(
        ctx.firestore().doc(`users/${UIDS.marketing}`).update({ role: 'admin' })
      );
    });

    it('ceo CANNOT promote another user to super_admin', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.ceo);
      await assertFails(
        ctx.firestore().doc(`users/${UIDS.marketing}`).update({ role: 'super_admin' })
      );
    });

    it('ceo CANNOT self-promote to admin', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.ceo);
      await assertFails(
        ctx.firestore().doc(`users/${UIDS.ceo}`).update({ role: 'admin' })
      );
    });

    it('admin CAN promote a user to admin', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.admin);
      await assertSucceeds(
        ctx.firestore().doc(`users/${UIDS.marketing}`).update({ role: 'admin' })
      );
    });
  });

  // Confirmed final matrix decisions from the pre-production audit:
  //   "Director is the Operations Director and MUST have plots.view,
  //    plots.change_status, plots.mark_sold. Chief Broker MUST have
  //    plots.view. Chief Broker must NOT have plots.change_status or
  //    plots.mark_sold." — and separately, that accountant's
  //    commissions.manage must not leak into any other high-risk permission
  //    (property/site/plot status, agent verify/suspend, role changes,
  //    role_permissions writes).
  describe('Confirmed final matrix decisions', () => {
    beforeEach(async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const db = ctx.firestore();
        await db.collection('users').doc(PLOT_OWNING_AGENT_UID).set({
          id: PLOT_OWNING_AGENT_UID, uid: PLOT_OWNING_AGENT_UID, displayName: 'Plot Owning Agent',
          email: PLOT_OWNING_AGENT_UID + '@test.local', phone: '+250700000098', role: 'agent',
          isActive: true, status: 'active', photoURL: '',
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          createdBy: 'seed', updatedBy: 'seed'
        });
        await db.collection('sites').doc(TEST_SITE_ID).set(standardFields({
          id: TEST_SITE_ID, name: 'RBAC Test Site', managingAgentId: PLOT_OWNING_AGENT_UID,
          developerId: '', availablePlots: 9, reservedPlots: 0, soldPlots: 0
        }));
        await db.collection('plots').doc(TEST_PLOT_ID).set(standardFields({
          id: TEST_PLOT_ID, siteId: TEST_SITE_ID, clientId: '', status: 'available'
        }));
        // Director's confirmed permissions: plots.view, plots.change_status,
        // plots.mark_sold (plus the properties/sites/agents/leads/commissions
        // permissions already agreed and unchanged from the earlier matrix).
        await db.collection('role_permissions').doc('director').set({
          role: 'director',
          permissions: ['properties.view', 'properties.approve', 'sites.view', 'sites.approve',
            'plots.view', 'plots.change_status', 'plots.mark_sold', 'agents.view',
            'leads.view', 'leads.assign', 'commissions.view'],
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          createdBy: 'seed', updatedBy: 'seed'
        });
        // Chief Broker's confirmed permissions: plots.view ONLY (no
        // change_status/mark_sold) — brokerage/agent authority, not
        // operational status authority.
        await db.collection('role_permissions').doc('chief_broker').set({
          role: 'chief_broker',
          permissions: ['properties.view', 'sites.view', 'plots.view', 'agents.view',
            'agents.verify', 'leads.view', 'leads.assign', 'commissions.view'],
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          createdBy: 'seed', updatedBy: 'seed'
        });
        // Accountant's confirmed permissions: commissions.view + manage
        // ONLY — no numeric limit introduced this phase, and no bleed into
        // any other high-risk permission.
        await db.collection('role_permissions').doc('accountant').set({
          role: 'accountant',
          permissions: ['properties.view', 'sites.view', 'plots.view', 'commissions.view', 'commissions.manage'],
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          createdBy: 'seed', updatedBy: 'seed'
        });
      });
    });

    it('director (Operations Director) CAN change plot status', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.director);
      await assertSucceeds(
        ctx.firestore().doc(`plots/${TEST_PLOT_ID}`).update({ status: 'reserved' })
      );
    });

    it('director CAN mark a plot sold', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.director);
      await assertSucceeds(
        ctx.firestore().doc(`plots/${TEST_PLOT_ID}`).update({ status: 'sold', statusChangeReason: 'Confirmed cash sale' })
      );
    });

    it('chief_broker CANNOT change plot status', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.chiefBroker);
      await assertFails(
        ctx.firestore().doc(`plots/${TEST_PLOT_ID}`).update({ status: 'reserved' })
      );
    });

    it('chief_broker CANNOT mark a plot sold', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.chiefBroker);
      await assertFails(
        ctx.firestore().doc(`plots/${TEST_PLOT_ID}`).update({ status: 'sold' })
      );
    });

    it('chief_broker still CAN read plots (view retained)', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.chiefBroker);
      await assertSucceeds(ctx.firestore().doc(`plots/${TEST_PLOT_ID}`).get());
    });

    it('accountant CAN approve/manage commissions', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.finance);
      await assertSucceeds(
        ctx.firestore().doc(`commissions/${DOC_IDS.commission}`).update({ status: 'approved' })
      );
    });

    it('accountant CANNOT approve a property despite having commissions.manage', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.finance);
      await assertFails(
        ctx.firestore().doc(`properties/${DOC_IDS.property}`).update({ status: 'approved' })
      );
    });

    it('accountant CANNOT change plot status despite having commissions.manage', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.finance);
      await assertFails(
        ctx.firestore().doc(`plots/${TEST_PLOT_ID}`).update({ status: 'reserved' })
      );
    });

    it('accountant CANNOT verify an agent despite having commissions.manage', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.finance);
      await assertFails(
        ctx.firestore().doc(`users/${UIDS.agentA}`).update({ isVerified: true })
      );
    });

    it('accountant CANNOT change a user\'s role despite having commissions.manage', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.finance);
      await assertFails(
        ctx.firestore().doc(`users/${UIDS.marketing}`).update({ role: 'operations' })
      );
    });

    it('accountant CANNOT write role_permissions despite having commissions.manage', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.finance);
      await assertFails(
        ctx.firestore().collection('role_permissions').doc('accountant').set({
          role: 'accountant', permissions: ['properties.approve'],
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          createdBy: UIDS.finance, updatedBy: UIDS.finance
        })
      );
    });
  });

  // Property availability (Available/Reserved/Sold) — a separate concept
  // from the approval `status` field this whole file otherwise tests.
  // Gated by properties.change_status, independent of properties.approve/
  // reject (a role can have one without the other — confirmed matrix:
  // ceo/operations/director get it, chief_broker does not, matching
  // "Chief Broker = brokerage/agent authority, not operational status
  // authority").
  describe('Property availability (properties.change_status)', () => {
    beforeEach(async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const db = ctx.firestore();
        await db.collection('role_permissions').doc('ceo').set({
          role: 'ceo',
          permissions: ['properties.view', 'properties.approve', 'properties.reject', 'properties.change_status'],
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          createdBy: 'seed', updatedBy: 'seed'
        });
        await db.collection('role_permissions').doc('operations').set({
          role: 'operations',
          permissions: ['properties.view', 'properties.approve', 'properties.reject', 'properties.change_status'],
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          createdBy: 'seed', updatedBy: 'seed'
        });
        // chief_broker deliberately does NOT get properties.change_status —
        // matches the confirmed matrix (view/agents.verify only).
        await db.collection('role_permissions').doc('chief_broker').set({
          role: 'chief_broker',
          permissions: ['properties.view', 'agents.view', 'agents.verify'],
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          createdBy: 'seed', updatedBy: 'seed'
        });
      });
    });

    it('ceo CAN mark a property sold', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.ceo);
      await assertSucceeds(
        ctx.firestore().doc(`properties/${DOC_IDS.property}`).update({ availability: 'sold', availabilityReason: 'Confirmed cash sale' })
      );
    });

    it('operations CAN mark a property reserved', async () => {
      const ctx = testEnv.authenticatedContext(OPERATIONS_UID);
      await assertSucceeds(
        ctx.firestore().doc(`properties/${DOC_IDS.property}`).update({ availability: 'reserved' })
      );
    });

    it('chief_broker CANNOT change property availability (no properties.change_status)', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.chiefBroker);
      await assertFails(
        ctx.firestore().doc(`properties/${DOC_IDS.property}`).update({ availability: 'sold' })
      );
    });

    it('hr_manager CANNOT change property availability (no role_permissions/hr_manager doc)', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.hr);
      await assertFails(
        ctx.firestore().doc(`properties/${DOC_IDS.property}`).update({ availability: 'sold' })
      );
    });

    it('the owning agent CANNOT self-mark their own property sold', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.agentA);
      await assertFails(
        ctx.firestore().doc(`properties/${DOC_IDS.property}`).update({ availability: 'sold' })
      );
    });

    it('admin CAN change property availability with no role_permissions/admin doc at all', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.admin);
      await assertSucceeds(
        ctx.firestore().doc(`properties/${DOC_IDS.property}`).update({ availability: 'available' })
      );
    });
  });
});
