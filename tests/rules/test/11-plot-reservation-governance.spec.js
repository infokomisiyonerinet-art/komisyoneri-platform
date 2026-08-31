// Phase 1 PRODUCTION BLOCKER fix — a legitimate authenticated client could
// never actually complete submitPlotReservation() (index.html): the plot's
// clientId is '' before a first reservation, so the pre-existing client
// ownership branch (resource.data.clientId == request.auth.uid) could never
// match, and even if it somehow had, that branch only ever permitted moving
// status TO 'available' (cancelling), never TO 'reserved' (creating). The
// staff/admin branch and the managingAgentId branch don't apply to an
// ordinary client either. All three branches rejected the write — this was
// true even before the plot/site governance hardening pass (F-1/F-2), not a
// regression it introduced. See rules/firestore.rules'
// _isClientFirstReservationOK() for the fix.
//
// An earlier version of this fix also added a narrowly-bounded
// sites/{siteId} branch letting a client adjust availablePlots/
// reservedPlots by exactly ±1, since submitPlotReservation() originally
// wrote both documents in one transaction and a transaction fails entirely
// if any one of its writes is denied. A security review (this repo's own)
// found that capability broader than the reservation flow actually
// needed, even bounded — so it was replaced with a server-side fix
// instead: onPlotStatusChanged (functions/index.js) now maintains those
// counters via the Admin SDK (which bypasses rules/firestore.rules
// entirely) whenever a plot's status actually changes, regardless of which
// code path caused it. submitPlotReservation()'s transaction — and every
// test below — only ever touches the one plot document a client actually
// owns; no client, of any role, has (or needs) write access to a site's
// counters through this rule. The Cloud Function side of this fix is
// CODE-REVIEW VERIFIED / EXECUTION UNVERIFIED here — this rules-only
// emulator suite has no Functions emulator target (see
// tests/rules/README.md), so it cannot exercise onPlotStatusChanged
// directly; only the rules-layer half (this file) runs for real.

const { assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { makeTestEnv } = require('../testenv');
const { seed, standardFields } = require('../seed');

const SITE_ID = 'resv_test_site';
const AVAILABLE_PLOT_ID = 'resv_test_plot_available';
const RESERVED_PLOT_ID = 'resv_test_plot_reserved';
const SOLD_PLOT_ID = 'resv_test_plot_sold';
const MANAGING_AGENT_UID = 'resv_managing_agent_test_user';
const RESERVING_CLIENT_UID = 'resv_client_test_user';
const OTHER_CLIENT_UID = 'resv_other_client_test_user';
const SUSPENDED_CLIENT_UID = 'resv_suspended_client_test_user';
const ALREADY_RESERVED_BY_UID = 'resv_already_reserved_by_test_user';

// Exact shape of the reservation-time write submitPlotReservation() sends,
// matching that function's own tx.update() call literally (index.html).
function reservationPlotWrite(clientUid) {
  return {
    status: 'reserved',
    clientId: clientUid,
    reservedAt: new Date(),
    reservedUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    depositPaid: false,
    updatedAt: new Date(),
    updatedBy: clientUid
  };
}

describe('Plot Reservation Governance — Phase 1 production blocker fix', function () {
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
      await userDoc(RESERVING_CLIENT_UID, 'client');
      await userDoc(OTHER_CLIENT_UID, 'client');
      await userDoc(SUSPENDED_CLIENT_UID, 'client', { isActive: false });
      await userDoc(ALREADY_RESERVED_BY_UID, 'client');

      await db.collection('sites').doc(SITE_ID).set(standardFields({
        id: SITE_ID, name: 'Reservation Test Site', status: 'active',
        managingAgentId: MANAGING_AGENT_UID, commissionRate: 4,
        totalPlots: 3, availablePlots: 1, reservedPlots: 1, soldPlots: 1
      }));
      // status:'available', clientId:'' — the real shape submitSiteForm()
      // writes for a brand-new, never-reserved plot.
      await db.collection('plots').doc(AVAILABLE_PLOT_ID).set(standardFields({
        id: AVAILABLE_PLOT_ID, siteId: SITE_ID, status: 'available',
        clientId: '', agentId: MANAGING_AGENT_UID, price: 5000000,
        commissionRate: 4, transactionSource: '', plotNumber: 'R1'
      }));
      await db.collection('plots').doc(RESERVED_PLOT_ID).set(standardFields({
        id: RESERVED_PLOT_ID, siteId: SITE_ID, status: 'reserved',
        clientId: ALREADY_RESERVED_BY_UID, agentId: MANAGING_AGENT_UID,
        price: 5000000, plotNumber: 'R2'
      }));
      await db.collection('plots').doc(SOLD_PLOT_ID).set(standardFields({
        id: SOLD_PLOT_ID, siteId: SITE_ID, status: 'sold',
        clientId: ALREADY_RESERVED_BY_UID, agentId: MANAGING_AGENT_UID,
        price: 5000000, plotNumber: 'R3'
      }));
    });
  });

  // Runs the REAL (single-document, post-fix) transaction shape
  // submitPlotReservation() performs — only the plot document; the site's
  // counters are no longer touched by client code at all (see the header
  // comment above).
  // Accepts either a context (calls ctx.firestore() once, internally) or an
  // already-obtained Firestore instance — @firebase/rules-unit-testing's
  // ctx.firestore() is not safe to call more than once per context (a
  // second call throws "Firestore has already been started and its
  // settings can no longer be changed"), so any test that also needs to
  // read back state afterward must obtain `db` once and pass it to both.
  function reserveViaTransaction(ctxOrDb, plotId, clientUid, extraPlotFields) {
    const db = typeof ctxOrDb.firestore === 'function' ? ctxOrDb.firestore() : ctxOrDb;
    return db.runTransaction(async (tx) => {
      const plotRef = db.doc(`plots/${plotId}`);
      tx.update(plotRef, Object.assign(reservationPlotWrite(clientUid), extraPlotFields || {}));
    });
  }

  describe('1-2: legitimate reservation succeeds, unauthenticated is denied', () => {
    it('1. authenticated client CAN reserve an available plot for themselves', async () => {
      // ctx.firestore() is obtained exactly ONCE and reused for both the
      // transaction and the follow-up read — calling it a second time on
      // the same context throws ("Firestore has already been started...").
      const db = testEnv.authenticatedContext(RESERVING_CLIENT_UID).firestore();
      await assertSucceeds(reserveViaTransaction(db, AVAILABLE_PLOT_ID, RESERVING_CLIENT_UID));

      // Confirm the resulting state is exactly what the app expects to see.
      // plots/{id} has `allow read: if true`, so this read is itself real,
      // rules-governed proof the write landed correctly, not just that
      // assertSucceeds() didn't throw. The site's counters are NOT checked
      // here — they're now updated by onPlotStatusChanged (a Cloud
      // Function), which this rules-only emulator suite doesn't run (see
      // this file's header comment) — verifying them is out of this
      // suite's reach, not skipped by oversight.
      const plot = (await db.doc(`plots/${AVAILABLE_PLOT_ID}`).get()).data();
      if (plot.status !== 'reserved' || plot.clientId !== RESERVING_CLIENT_UID) {
        throw new Error('Reservation did not produce the expected plot state: ' + JSON.stringify(plot));
      }
    });

    it('2. an UNAUTHENTICATED user CANNOT reserve a plot', async () => {
      const ctx = testEnv.unauthenticatedContext();
      await assertFails(reserveViaTransaction(ctx, AVAILABLE_PLOT_ID, RESERVING_CLIENT_UID));
    });
  });

  describe('3-4: cannot reserve a plot that is not genuinely available', () => {
    it('3. client CANNOT reserve an already-SOLD plot', async () => {
      const ctx = testEnv.authenticatedContext(RESERVING_CLIENT_UID);
      await assertFails(reserveViaTransaction(ctx, SOLD_PLOT_ID, RESERVING_CLIENT_UID));
    });

    it('4. client CANNOT reserve an already-RESERVED plot (by someone else)', async () => {
      const ctx = testEnv.authenticatedContext(RESERVING_CLIENT_UID);
      await assertFails(reserveViaTransaction(ctx, RESERVED_PLOT_ID, RESERVING_CLIENT_UID));
    });
  });

  describe('5: cannot reserve on behalf of another UID', () => {
    it('5. client CANNOT assign a DIFFERENT uid as clientId (reserve on behalf of / impersonate another user)', async () => {
      const ctx = testEnv.authenticatedContext(RESERVING_CLIENT_UID);
      await assertFails(reserveViaTransaction(ctx, AVAILABLE_PLOT_ID, OTHER_CLIENT_UID));
    });
  });

  describe('6-9: cannot smuggle protected fields into the reservation write', () => {
    it('6. client CANNOT modify price during reservation', async () => {
      const ctx = testEnv.authenticatedContext(RESERVING_CLIENT_UID);
      await assertFails(reserveViaTransaction(ctx, AVAILABLE_PLOT_ID, RESERVING_CLIENT_UID, { price: 1 }));
    });

    it('7. client CANNOT modify commissionRate during reservation', async () => {
      const ctx = testEnv.authenticatedContext(RESERVING_CLIENT_UID);
      await assertFails(reserveViaTransaction(ctx, AVAILABLE_PLOT_ID, RESERVING_CLIENT_UID, { commissionRate: 50 }));
    });

    it('8. client CANNOT modify transactionSource during reservation', async () => {
      const ctx = testEnv.authenticatedContext(RESERVING_CLIENT_UID);
      await assertFails(reserveViaTransaction(ctx, AVAILABLE_PLOT_ID, RESERVING_CLIENT_UID, { transactionSource: 'external' }));
    });

    it('9a. client CANNOT modify agentId during reservation', async () => {
      const ctx = testEnv.authenticatedContext(RESERVING_CLIENT_UID);
      await assertFails(reserveViaTransaction(ctx, AVAILABLE_PLOT_ID, RESERVING_CLIENT_UID, { agentId: RESERVING_CLIENT_UID }));
    });

    it('9b. client CANNOT modify siteId during reservation', async () => {
      const ctx = testEnv.authenticatedContext(RESERVING_CLIENT_UID);
      await assertFails(reserveViaTransaction(ctx, AVAILABLE_PLOT_ID, RESERVING_CLIENT_UID, { siteId: 'some-other-site' }));
    });

    it('9c. client CANNOT modify plotNumber (identity field) during reservation', async () => {
      const ctx = testEnv.authenticatedContext(RESERVING_CLIENT_UID);
      await assertFails(reserveViaTransaction(ctx, AVAILABLE_PLOT_ID, RESERVING_CLIENT_UID, { plotNumber: 'HACKED' }));
    });
  });

  describe('10: cannot bypass the available -> reserved transition shape', () => {
    it('10a. client CANNOT jump straight to "sold" via this branch', async () => {
      const ctx = testEnv.authenticatedContext(RESERVING_CLIENT_UID);
      await assertFails(
        ctx.firestore().doc(`plots/${AVAILABLE_PLOT_ID}`).update(
          Object.assign(reservationPlotWrite(RESERVING_CLIENT_UID), { status: 'sold' })
        )
      );
    });

    it('10b. client CANNOT use this branch to move a plot that is NOT "available" (e.g. on_hold) into "reserved"', async () => {
      await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
        await adminCtx.firestore().doc(`plots/${AVAILABLE_PLOT_ID}`).update({ status: 'on_hold' });
      });
      const ctx = testEnv.authenticatedContext(RESERVING_CLIENT_UID);
      await assertFails(reserveViaTransaction(ctx, AVAILABLE_PLOT_ID, RESERVING_CLIENT_UID));
    });
  });

  describe('11: cannot exploit the managing-agent ownership branch to gain reservation privilege', () => {
    it('11. managing agent CANNOT combine ownership-branch content fields with a reservation write in one update', async () => {
      const ctx = testEnv.authenticatedContext(MANAGING_AGENT_UID);
      await assertFails(reserveViaTransaction(ctx, AVAILABLE_PLOT_ID, MANAGING_AGENT_UID, { plotNumber: 'RENAMED' }));
    });

    it('11b. the managing agent CANNOT use their ownership position to reserve the plot in a DIFFERENT person\'s name', async () => {
      // Being the site's managing agent grants no special ability to create
      // a reservation on someone else's behalf — _isClientFirstReservationOK()
      // requires clientId == the CALLER's own uid, regardless of any other
      // role or ownership relationship the caller has. Distinct from test 5
      // (an ordinary client can't do this either) — this confirms the
      // managing-agent identity specifically doesn't unlock it.
      const ctx = testEnv.authenticatedContext(MANAGING_AGENT_UID);
      await assertFails(
        ctx.firestore().doc(`plots/${AVAILABLE_PLOT_ID}`).update({
          status: 'reserved', clientId: RESERVING_CLIENT_UID,
          reservedAt: new Date(), reservedUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          depositPaid: false, updatedAt: new Date(), updatedBy: MANAGING_AGENT_UID
        })
      );
    });

    it('11c. the managing agent, reserving a plot for THEMSELVES as an ordinary client would, is still allowed (not an exploit — same right any authenticated user has)', async () => {
      const ctx = testEnv.authenticatedContext(MANAGING_AGENT_UID);
      await assertSucceeds(reserveViaTransaction(ctx, AVAILABLE_PLOT_ID, MANAGING_AGENT_UID));
    });
  });

  describe('12: direct Firestore write gets identical protection to the UI flow', () => {
    it('12. the plots/{plotId} rule is a real, independent boundary — a raw single-document write (no transaction, no site-side write at all) is authorized on its own merits', async () => {
      const ctx = testEnv.authenticatedContext(RESERVING_CLIENT_UID);
      // Proves _isClientFirstReservationOK() isn't merely "incidentally
      // permissive because it's always bundled with the site write" — the
      // plot document's own rule independently allows exactly this write,
      // with or without a transaction wrapper.
      await assertSucceeds(
        ctx.firestore().doc(`plots/${AVAILABLE_PLOT_ID}`).update(reservationPlotWrite(RESERVING_CLIENT_UID))
      );
    });

    it('12b. a malicious multi-field write attempt via a plain (non-transaction) update is denied identically', async () => {
      const ctx = testEnv.authenticatedContext(RESERVING_CLIENT_UID);
      await assertFails(
        ctx.firestore().doc(`plots/${AVAILABLE_PLOT_ID}`).update(
          Object.assign(reservationPlotWrite(RESERVING_CLIENT_UID), { price: 1 })
        )
      );
    });
  });

  describe('13: existing reservation-cancellation behavior remains intact', () => {
    it('13. client with matching clientId CAN still cancel their own reservation (reserved -> available)', async () => {
      const ctx = testEnv.authenticatedContext(ALREADY_RESERVED_BY_UID);
      await assertSucceeds(
        ctx.firestore().doc(`plots/${RESERVED_PLOT_ID}`).update({
          status: 'available', clientId: '', reservedAt: null, reservedUntil: null,
          updatedAt: new Date(), updatedBy: ALREADY_RESERVED_BY_UID
        })
      );
    });

    it('13b. a suspended client CANNOT reserve (isActive:false loses ordinary authority, matching the rest of this governance model)', async () => {
      const ctx = testEnv.authenticatedContext(SUSPENDED_CLIENT_UID);
      await assertFails(reserveViaTransaction(ctx, AVAILABLE_PLOT_ID, SUSPENDED_CLIENT_UID));
    });
  });

  describe('sites/{siteId} counters are NOT client-writable at all (Option 2: server-side maintenance only)', () => {
    it('a client CANNOT adjust availablePlots/reservedPlots directly, even by a legitimate-looking ±1 delta matching a real reservation', async () => {
      const ctx = testEnv.authenticatedContext(RESERVING_CLIENT_UID);
      await assertFails(
        ctx.firestore().doc(`sites/${SITE_ID}`).update({
          availablePlots: 0, reservedPlots: 2, updatedAt: new Date(), updatedBy: RESERVING_CLIENT_UID
        })
      );
    });

    it('a client CANNOT adjust just a single counter field on its own', async () => {
      const ctx = testEnv.authenticatedContext(RESERVING_CLIENT_UID);
      await assertFails(
        ctx.firestore().doc(`sites/${SITE_ID}`).update({ availablePlots: 0 })
      );
    });

    it('the managing agent ALSO cannot adjust these counters directly (only isAdminOrStaff() or the server-side Cloud Function can)', async () => {
      const ctx = testEnv.authenticatedContext(MANAGING_AGENT_UID);
      await assertFails(
        ctx.firestore().doc(`sites/${SITE_ID}`).update({
          availablePlots: 0, reservedPlots: 2, updatedAt: new Date(), updatedBy: MANAGING_AGENT_UID
        })
      );
    });
  });
});
