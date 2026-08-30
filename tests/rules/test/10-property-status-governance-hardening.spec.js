// Property Status Governance Hardening — closes the gap flagged by the
// FINAL PROPERTY STATUS GOVERNANCE HARDENING audit: properties.change_status
// governed EVERY availability transition identically (available->reserved,
// available->sold, AND sold->available/reserved), so any role holding
// everyday change_status authority (director, operations, etc.) could also
// silently reverse an already-finalized sale — exactly as sensitive an
// action as making one, but with none of the extra scrutiny it deserves.
//
// Fix: sold->available and sold->reserved (the HIGH-RISK REVERSALS) are now
// gated behind a separate properties.reverse_sold permission, never granted
// by default to any role. The forward transitions (available->reserved,
// available->sold) are UNCHANGED — still ordinary properties.change_status
// actions, per this collection's own explicitly-specified governance matrix
// (available->sold is listed under normal AVAILABILITY, not under HIGH-RISK
// REVERSALS — see rules/firestore.rules' _isPropertyHighRiskReversal() for
// why this deliberately differs from plots.mark_sold's direction-aware
// check, which gates BOTH directions under one permission).
//
// A transition touching 'sold' on EITHER side (entering it or reversing out
// of it) also now requires a non-empty availabilityReason — previously only
// enforced on entry.
//
// Approval status (properties.approve/reject) and the agent/owner
// self-edit ownership branch are UNCHANGED by this pass — both already
// correctly excluded status/availability from the ownership branch's field
// allowlist (requirement A was already satisfied; verified, not modified).
//
// NOT covered here (documented, not silently skipped): tests #17-19 from
// the audit's test list (closed_won deal -> availability becomes sold;
// audit log entry exists after every governed transition; audit entry
// records the real actor role) exercise onDealClosedWon/
// onPropertyStatusChanged in functions/index.js — Cloud Function triggers,
// which this repo's test harness does not emulate (see tests/rules/
// README.md: "rules tests don't exercise Cloud Function triggers", Firestore
// + Auth emulators only, no Functions emulator). Both functions were read
// in full during this audit and confirmed unaffected by (and already
// correctly handling) the availability transitions this file governs:
// onDealClosedWon writes via the Admin SDK, which bypasses Firestore rules
// entirely, so this hardening cannot break it; onPropertyStatusChanged logs
// an audit entry (with the actor's real role looked up server-side, never
// trusted from the client) on ANY availability change reaching
// 'available'/'reserved'/'sold', with no special-casing for direction, so a
// high-risk reversal is audited exactly the same way a forward sale is.
// Verifying this end-to-end would require standing up a Functions emulator
// harness this repo doesn't currently have — flagged as a follow-up in the
// audit report rather than attempted here.

const { assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { makeTestEnv } = require('../testenv');
const { seed, UIDS, DOC_IDS, standardFields } = require('../seed');

const OPERATIONS_UID = 'psgh_operations_test_user';
const SOLD_PROPERTY_ID = 'psgh_sold_property_test_doc';
const SUSPENDED_DIRECTOR_UID = 'psgh_suspended_director_test_user';

describe('Property Status Governance Hardening (sold-reversal permission split)', function () {
  this.timeout(20000);
  let testEnv;

  before(async () => { testEnv = await makeTestEnv(); });
  after(async () => { await testEnv.cleanup(); });

  beforeEach(async () => {
    await testEnv.clearFirestore();
    await seed(testEnv);
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();

      await db.collection('users').doc(OPERATIONS_UID).set({
        id: OPERATIONS_UID, uid: OPERATIONS_UID, displayName: 'Operations Test',
        email: OPERATIONS_UID + '@test.local', phone: '+250700000098',
        role: 'operations', department: 'Operations', jobTitle: 'Operations Manager',
        isActive: true, status: 'active', photoURL: '',
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        createdBy: 'seed', updatedBy: 'seed'
      });
      // Suspended director — same role as the (active) director fixture
      // below, used to prove isActive:false revokes authority regardless of
      // what role_permissions grants that role.
      await db.collection('users').doc(SUSPENDED_DIRECTOR_UID).set({
        id: SUSPENDED_DIRECTOR_UID, uid: SUSPENDED_DIRECTOR_UID, displayName: 'Suspended Director Test',
        email: SUSPENDED_DIRECTOR_UID + '@test.local', phone: '+250700000097',
        role: 'director', isActive: false, status: 'active', photoURL: '',
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        createdBy: 'seed', updatedBy: 'seed'
      });

      // A second property, already sold, so the reversal transitions have a
      // real fixture to attempt FROM. Kept separate from DOC_IDS.property
      // (which starts with no availability at all) so forward-transition
      // tests and reversal tests never interfere with each other.
      await db.collection('properties').doc(SOLD_PROPERTY_ID).set(standardFields({
        id: SOLD_PROPERTY_ID, agentId: UIDS.agentA, ownerId: null,
        title: 'Sold Test Villa', type: 'Villa', district: 'Gasabo', sector: 'Kimironko',
        price: 60000000, bedrooms: 4, bathrooms: 3, area: 350,
        description: 'Seed fixture (already sold)', amenities: [], images: [], isVerified: false,
        status: 'approved', availability: 'sold', availabilityReason: 'Confirmed cash sale (seed)'
      }));

      // Director: change_status only, deliberately WITHOUT reverse_sold —
      // isolates the reverse_sold-specific gate below (mirrors
      // 09-plot-site-governance-hardening.spec.js's chief_broker-without-
      // mark_sold isolation pattern).
      await db.collection('role_permissions').doc('director').set({
        role: 'director',
        permissions: ['properties.view', 'properties.approve', 'properties.reject', 'properties.change_status'],
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        createdBy: 'seed', updatedBy: 'seed'
      });
      // Operations: change_status AND reverse_sold — proves the elevated
      // permission works for whichever role is actually granted it.
      await db.collection('role_permissions').doc('operations').set({
        role: 'operations',
        permissions: ['properties.view', 'properties.approve', 'properties.reject',
          'properties.change_status', 'properties.reverse_sold'],
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        createdBy: 'seed', updatedBy: 'seed'
      });
    });
  });

  describe('Agent: never gains approval/availability authority through the ownership branch', () => {
    it('#1 agent CANNOT change property approval status on their own listing', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.agentA);
      await assertFails(
        ctx.firestore().doc(`properties/${DOC_IDS.property}`).update({ status: 'approved' })
      );
    });

    it('#2 agent CANNOT change property availability on their own listing', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.agentA);
      await assertFails(
        ctx.firestore().doc(`properties/${DOC_IDS.property}`).update({ availability: 'reserved' })
      );
    });

    it('#3 agent CANNOT mark their own property sold', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.agentA);
      await assertFails(
        ctx.firestore().doc(`properties/${DOC_IDS.property}`).update({ availability: 'sold', availabilityReason: 'Self-dealing attempt' })
      );
    });

    it('#4 agent CANNOT reverse their own sold property back to available', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.agentA);
      await assertFails(
        ctx.firestore().doc(`properties/${SOLD_PROPERTY_ID}`).update({ availability: 'available', availabilityReason: 'Self-dealing attempt' })
      );
    });
  });

  describe('Director: normal transitions allowed, reversal denied by default', () => {
    it('#5 director CAN perform a normal allowed transition (available -> reserved)', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.director);
      await assertSucceeds(
        ctx.firestore().doc(`properties/${DOC_IDS.property}`).update({ availability: 'reserved' })
      );
    });

    it('#6 director CAN mark a property sold (forward transition stays normal change_status)', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.director);
      await assertSucceeds(
        ctx.firestore().doc(`properties/${DOC_IDS.property}`).update({ availability: 'sold', availabilityReason: 'Confirmed sale' })
      );
    });

    it('#7 director CANNOT reverse a sold property back to available (no properties.reverse_sold)', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.director);
      await assertFails(
        ctx.firestore().doc(`properties/${SOLD_PROPERTY_ID}`).update({ availability: 'available', availabilityReason: 'Deal fell through' })
      );
    });

    it('#7b director CANNOT reverse a sold property to reserved either (no properties.reverse_sold)', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.director);
      await assertFails(
        ctx.firestore().doc(`properties/${SOLD_PROPERTY_ID}`).update({ availability: 'reserved', availabilityReason: 'Deal fell through' })
      );
    });
  });

  describe('Operations: normal transitions allowed, reversal allowed only when explicitly granted', () => {
    it('#8 operations CAN perform a normal allowed transition (available -> reserved)', async () => {
      const ctx = testEnv.authenticatedContext(OPERATIONS_UID);
      await assertSucceeds(
        ctx.firestore().doc(`properties/${DOC_IDS.property}`).update({ availability: 'reserved' })
      );
    });

    it('#9 operations CAN mark a property sold', async () => {
      const ctx = testEnv.authenticatedContext(OPERATIONS_UID);
      await assertSucceeds(
        ctx.firestore().doc(`properties/${DOC_IDS.property}`).update({ availability: 'sold', availabilityReason: 'Confirmed sale' })
      );
    });

    it('#10 operations CAN reverse a sold property back to available (explicitly granted properties.reverse_sold)', async () => {
      const ctx = testEnv.authenticatedContext(OPERATIONS_UID);
      await assertSucceeds(
        ctx.firestore().doc(`properties/${SOLD_PROPERTY_ID}`).update({ availability: 'available', availabilityReason: 'Deal fell through' })
      );
    });
  });

  describe('Admin: unconditional bypass covers every legitimate governance action', () => {
    it('#11a admin CAN approve a property with no role_permissions/admin doc at all', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.admin);
      await assertSucceeds(
        ctx.firestore().doc(`properties/${DOC_IDS.property}`).update({ status: 'approved' })
      );
    });

    it('#11b admin CAN perform a normal availability transition', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.admin);
      await assertSucceeds(
        ctx.firestore().doc(`properties/${DOC_IDS.property}`).update({ availability: 'reserved' })
      );
    });

    it('#11c admin CAN reverse a sold property back to available (unconditional bypass, no role_permissions grant needed)', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.admin);
      await assertSucceeds(
        ctx.firestore().doc(`properties/${SOLD_PROPERTY_ID}`).update({ availability: 'available', availabilityReason: 'Corrected admin error' })
      );
    });
  });

  describe('Suspension revokes authority regardless of role_permissions', () => {
    it('#12 a suspended director (isActive:false) CANNOT change property availability even though the active director role has properties.change_status', async () => {
      const ctx = testEnv.authenticatedContext(SUSPENDED_DIRECTOR_UID);
      await assertFails(
        ctx.firestore().doc(`properties/${DOC_IDS.property}`).update({ availability: 'reserved' })
      );
    });
  });

  describe('Direct Firestore writes obey identical governance to the UI', () => {
    it('#13 a bare write with no UI-supplied context (no reason field pre-populated) fails/succeeds by the same rule the UI itself is bound by', async () => {
      // The UI (_fsAdminSetAvailability()) never lets a request reach
      // Firestore without prompting for availabilityReason on a sold-side
      // transition — this simulates a caller that skips the UI entirely
      // (e.g. a script or the console) and confirms the RULE, not the UI,
      // is the actual boundary: identical operations.reverse_sold context
      // as the passing "#10" test above, but omitting availabilityReason
      // the way a non-UI caller might forget to.
      const ctx = testEnv.authenticatedContext(OPERATIONS_UID);
      await assertFails(
        ctx.firestore().doc(`properties/${SOLD_PROPERTY_ID}`).update({ availability: 'available' })
      );
    });
  });

  describe('Unknown/unconfigured permission defaults to deny', () => {
    it('#14 a role with no role_permissions document at all cannot change availability', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.hr); // hr_manager has no role_permissions doc in this suite
      await assertFails(
        ctx.firestore().doc(`properties/${DOC_IDS.property}`).update({ availability: 'reserved' })
      );
    });
  });

  describe('Mandatory reason on high-risk reversal', () => {
    it('#15 missing availabilityReason on a sold->available reversal fails even with properties.reverse_sold', async () => {
      const ctx = testEnv.authenticatedContext(OPERATIONS_UID);
      await assertFails(
        ctx.firestore().doc(`properties/${SOLD_PROPERTY_ID}`).update({ availability: 'reserved' })
      );
    });

    it('#16 a valid non-empty reason succeeds when the actor holds properties.reverse_sold', async () => {
      const ctx = testEnv.authenticatedContext(OPERATIONS_UID);
      await assertSucceeds(
        ctx.firestore().doc(`properties/${SOLD_PROPERTY_ID}`).update({ availability: 'reserved', availabilityReason: 'Buyer requested a hold pending re-inspection' })
      );
    });
  });

  describe('An unauthorized attempt leaves no privileged state change', () => {
    it('#20 a denied reversal attempt does not change the stored availability', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.director); // change_status only, no reverse_sold
      await assertFails(
        ctx.firestore().doc(`properties/${SOLD_PROPERTY_ID}`).update({ availability: 'available', availabilityReason: 'Attempted unauthorized reversal' })
      );
      await testEnv.withSecurityRulesDisabled(async (ctx2) => {
        const doc = await ctx2.firestore().doc(`properties/${SOLD_PROPERTY_ID}`).get();
        if (doc.data().availability !== 'sold') {
          throw new Error('Denied write still changed availability — privileged state change leaked through a failed rule check');
        }
      });
    });
  });
});
