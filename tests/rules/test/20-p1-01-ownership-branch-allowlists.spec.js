// P1-01 — Ownership/assignment-branch field allowlists.
//
// Before this fix, the non-admin "party" branch of the update rule for
// leads, documents, viewings, services, partners, site_enquiries, reports,
// tasks, and attendance had NO field allowlist at all — the matching
// owner/assignee (agentId/clientId/assignedTo/assignedToId/submittedBy/
// userId) could rewrite ANY field on the document, not just the ones their
// real, legitimate frontend call sites ever touch. This mirrors the same
// hasOnly()-allowlist pattern already used elsewhere in this file (deals
// D-2, offers P0.6 FIX 4, investments' pre-existing investorId branch).
//
// investments is NOT covered here — its investorId branch already had this
// exact allowlist before P1-01 (nothing to change, confirmed by the
// research pass that scoped this fix).
//
// This file does not modify tests/rules/seed.js — fixtures are local,
// following the same pattern as every other P0.x/P1.x file in this suite.

const { assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { makeTestEnv } = require('../testenv');
const { seed, UIDS, standardFields } = require('../seed');

const OUTSIDER_UID = 'p101_outsider_test_user';

describe('P1-01 — ownership-branch field allowlists', function () {
  this.timeout(20000);
  let testEnv;

  before(async () => { testEnv = await makeTestEnv(); });
  after(async () => { await testEnv.cleanup(); });

  async function seedExtra(fn) {
    await testEnv.clearFirestore();
    await seed(testEnv);
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await db.collection('users').doc(OUTSIDER_UID).set({
        id: OUTSIDER_UID, uid: OUTSIDER_UID, role: 'client', displayName: 'Outsider Test',
        email: OUTSIDER_UID + '@test.local', phone: '+250700000000', isActive: true, status: 'active',
        photoURL: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        createdBy: 'seed', updatedBy: 'seed'
      });
      await fn(db);
    });
  }

  // ── leads ──────────────────────────────────────────────
  describe('leads (ownership field: agentId)', () => {
    const ID = 'p101_lead_test_doc';
    beforeEach(async () => {
      await seedExtra(async (db) => {
        await db.collection('leads').doc(ID).set(standardFields({
          id: ID, clientId: UIDS.client, clientName: 'Test Client', clientPhone: '+250700000000',
          agentId: UIDS.agentA, agentName: 'Agent A', propertyId: 'x', action: 'buy',
          zone: 'Gasabo', district: 'Gasabo', budgetMin: 0, budgetMax: 0, notes: '',
          source: 'web', pipelineStage: 'new', priority: 'medium', contactLog: [],
          nextFollowUp: null, status: 'active', dealId: null, lostReason: '', closedAt: null
        }));
      });
    });

    it('owning agent CAN update pipelineStage/status (real call-site shape) — ALLOWED', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.agentA);
      await assertSucceeds(ctx.firestore().doc(`leads/${ID}`).update({ pipelineStage: 'contacted', status: 'active' }));
    });

    it('owning agent CANNOT self-reassign the lead (agentId) — DENIED (was allowed before P1-01)', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.agentA);
      await assertFails(ctx.firestore().doc(`leads/${ID}`).update({ agentId: UIDS.agentB }));
    });

    it('owning agent CANNOT rewrite client contact info — DENIED (was allowed before P1-01)', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.agentA);
      await assertFails(ctx.firestore().doc(`leads/${ID}`).update({ clientPhone: '+250799999999' }));
    });

    it('admin/staff retains unrestricted update authority — ALLOWED', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.admin);
      await assertSucceeds(ctx.firestore().doc(`leads/${ID}`).update({ agentId: UIDS.agentB, budgetMax: 99 }));
    });

    it('unrelated agent (not assigned) — DENIED', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.agentB);
      await assertFails(ctx.firestore().doc(`leads/${ID}`).update({ status: 'active' }));
    });
  });

  // ── documents ──────────────────────────────────────────
  describe('documents (ownership fields: clientId, agentId)', () => {
    const ID = 'p101_document_test_doc';
    beforeEach(async () => {
      await seedExtra(async (db) => {
        await db.collection('documents').doc(ID).set(standardFields({
          id: ID, name: 'Sale Agreement', type: 'contract', fileUrl: 'https://example.test/doc.pdf',
          propertyId: 'x', dealId: 'x', clientId: UIDS.client, clientName: 'Test Client',
          agentId: UIDS.agentA, uploadedByName: 'Agent A', accessRoles: ['client', 'agent'],
          signatories: [{ name: 'Test Client', signed: false, signedAt: null }],
          signed: false, version: 1, requiresSignature: true, status: 'pending'
        }));
      });
    });

    it('client party CAN sign (real confirmSignature() shape) — ALLOWED', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.client);
      await assertSucceeds(ctx.firestore().doc(`documents/${ID}`).update({
        signatories: [{ name: 'Test Client', signed: true, signedAt: new Date().toISOString() }], signed: true, status: 'signed'
      }));
    });

    it('agent party CAN archive (real archiveDocument() shape) — ALLOWED', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.agentA);
      await assertSucceeds(ctx.firestore().doc(`documents/${ID}`).update({ status: 'archived' }));
    });

    it('client party CANNOT rewrite fileUrl — DENIED (was allowed before P1-01)', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.client);
      await assertFails(ctx.firestore().doc(`documents/${ID}`).update({ fileUrl: 'https://evil.test/swap.pdf' }));
    });

    it('agent party CANNOT rewrite accessRoles to hide the doc — DENIED (was allowed before P1-01)', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.agentA);
      await assertFails(ctx.firestore().doc(`documents/${ID}`).update({ accessRoles: ['agent'] }));
    });

    it('admin/staff retains unrestricted update authority — ALLOWED', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.admin);
      await assertSucceeds(ctx.firestore().doc(`documents/${ID}`).update({ fileUrl: 'https://example.test/replaced.pdf' }));
    });

    it('unrelated user — DENIED', async () => {
      const ctx = testEnv.authenticatedContext(OUTSIDER_UID);
      await assertFails(ctx.firestore().doc(`documents/${ID}`).update({ status: 'archived' }));
    });
  });

  // ── viewings ───────────────────────────────────────────
  describe('viewings (ownership fields: clientId, agentId)', () => {
    const ID = 'p101_viewing_test_doc';
    beforeEach(async () => {
      await seedExtra(async (db) => {
        await db.collection('viewings').doc(ID).set(standardFields({
          id: ID, clientId: UIDS.client, clientName: 'Test Client', clientPhone: '+250700000000',
          agentId: UIDS.agentA, agentName: 'Agent A', propertyId: 'x', propertyTitle: 'Test Villa',
          leadId: 'x', scheduledAt: new Date().toISOString(), status: 'scheduled', notes: '',
          report: {}, agentCheckIn: false, agentGPS: {}, completedAt: null
        }));
      });
    });

    it('owning agent CAN mark complete (real markViewingComplete() shape) — ALLOWED', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.agentA);
      await assertSucceeds(ctx.firestore().doc(`viewings/${ID}`).update({ status: 'completed' }));
    });

    it('owning agent CANNOT rewrite scheduledAt/propertyId — DENIED (was allowed before P1-01)', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.agentA);
      await assertFails(ctx.firestore().doc(`viewings/${ID}`).update({ scheduledAt: new Date(Date.now() + 86400000).toISOString() }));
    });

    it('owning agent CANNOT reassign the viewing (agentId) — DENIED (was allowed before P1-01)', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.agentA);
      await assertFails(ctx.firestore().doc(`viewings/${ID}`).update({ agentId: UIDS.agentB }));
    });

    it('admin/staff retains unrestricted update authority — ALLOWED', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.admin);
      await assertSucceeds(ctx.firestore().doc(`viewings/${ID}`).update({ agentId: UIDS.agentB }));
    });

    it('unrelated agent — DENIED', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.agentB);
      await assertFails(ctx.firestore().doc(`viewings/${ID}`).update({ status: 'completed' }));
    });
  });

  // ── services ───────────────────────────────────────────
  describe('services (ownership field: assignedToId)', () => {
    const ID = 'p101_service_test_doc';
    beforeEach(async () => {
      await seedExtra(async (db) => {
        await db.collection('services').doc(ID).set(standardFields({
          id: ID, serviceType: 'legal', serviceSubtype: 'title_check', requestedBy: UIDS.client,
          requestedByName: 'Test Client', propertyRef: 'x', description: 'Test service request',
          priority: 'medium', preferredDate: null, assignedTo: 'Partner B', assignedToId: UIDS.agentB,
          partnerId: 'p101_partner', status: 'assigned', quotedPrice: 100000, reportUrl: '', serviceRated: false,
          adminNotes: ''
        }));
      });
    });

    it('assigned partner CAN submit a job report (real submitPartnerJobReport() shape) — ALLOWED', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.agentB);
      await assertSucceeds(ctx.firestore().doc(`services/${ID}`).update({ reportUrl: 'https://example.test/report.pdf', status: 'completed' }));
    });

    it('assigned partner CANNOT rewrite quotedPrice — DENIED (was allowed before P1-01)', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.agentB);
      await assertFails(ctx.firestore().doc(`services/${ID}`).update({ quotedPrice: 1 }));
    });

    it('assigned partner CANNOT self-reassign away (assignedToId) — DENIED (was allowed before P1-01)', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.agentB);
      await assertFails(ctx.firestore().doc(`services/${ID}`).update({ assignedToId: UIDS.agentA }));
    });

    it('admin/staff retains unrestricted update authority — ALLOWED', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.admin);
      await assertSucceeds(ctx.firestore().doc(`services/${ID}`).update({ quotedPrice: 200000 }));
    });

    it('unrelated partner — DENIED', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.agentA);
      await assertFails(ctx.firestore().doc(`services/${ID}`).update({ status: 'completed' }));
    });
  });

  // ── partners ───────────────────────────────────────────
  describe('partners (ownership field: userId)', () => {
    // Reuses the seeded DOC_IDS.partner (userId: UIDS.agentB) from seed.js,
    // but forces verified:false first — the shared fixture seeds
    // verified:true, and asserting a write of the SAME value back would
    // produce an empty diff().affectedKeys() (no value actually changed),
    // trivially passing regardless of what the rule allows. Flipping to
    // false first makes the "self-verify" attempt below a real value
    // change the allowlist must actually block.
    const { DOC_IDS } = require('../seed');
    beforeEach(async () => {
      await seedExtra(async (db) => {
        await db.collection('partners').doc(DOC_IDS.partner).update({ verified: false });
      });
    });

    it('the partner CAN update their own bio (new, conservative self-service field) — ALLOWED', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.agentB);
      await assertSucceeds(ctx.firestore().doc(`partners/${DOC_IDS.partner}`).update({ bio: 'Updated bio text' }));
    });

    it('the partner CANNOT self-verify — DENIED', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.agentB);
      await assertFails(ctx.firestore().doc(`partners/${DOC_IDS.partner}`).update({ verified: true }));
    });

    it('the partner CANNOT inflate their own avgRating/reviewCount — DENIED', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.agentB);
      await assertFails(ctx.firestore().doc(`partners/${DOC_IDS.partner}`).update({ avgRating: 5, reviewCount: 999 }));
    });

    it('admin/staff retains unrestricted update authority — ALLOWED', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.admin);
      await assertSucceeds(ctx.firestore().doc(`partners/${DOC_IDS.partner}`).update({ verified: true }));
    });

    it('unrelated user — DENIED', async () => {
      const ctx = testEnv.authenticatedContext(OUTSIDER_UID);
      await assertFails(ctx.firestore().doc(`partners/${DOC_IDS.partner}`).update({ bio: 'hijacked' }));
    });
  });

  // ── site_enquiries ─────────────────────────────────────
  describe('site_enquiries (ownership field: agentId)', () => {
    const ID = 'p101_site_enquiry_test_doc';
    beforeEach(async () => {
      await seedExtra(async (db) => {
        await db.collection('site_enquiries').doc(ID).set(standardFields({
          id: ID, siteId: 'x', plotId: 'x', clientId: UIDS.client, agentId: UIDS.agentA,
          message: 'Interested in this plot', intendedUse: 'residential', financingNeeded: false,
          viewingRequested: false, preferredPlots: [], budget: 10000000, status: 'new'
        }));
      });
    });

    it('owning agent CAN update status — ALLOWED', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.agentA);
      await assertSucceeds(ctx.firestore().doc(`site_enquiries/${ID}`).update({ status: 'contacted' }));
    });

    it('owning agent CANNOT rewrite budget — DENIED (was allowed before P1-01)', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.agentA);
      await assertFails(ctx.firestore().doc(`site_enquiries/${ID}`).update({ budget: 1 }));
    });

    it('admin/staff retains unrestricted update authority — ALLOWED', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.admin);
      await assertSucceeds(ctx.firestore().doc(`site_enquiries/${ID}`).update({ agentId: UIDS.agentB }));
    });

    it('unrelated agent — DENIED', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.agentB);
      await assertFails(ctx.firestore().doc(`site_enquiries/${ID}`).update({ status: 'contacted' }));
    });
  });

  // ── reports (submittedBy party branch) ─────────────────
  describe('reports (ownership field: submittedBy)', () => {
    const ID = 'p101_report_test_doc';
    beforeEach(async () => {
      await seedExtra(async (db) => {
        await db.collection('reports').doc(ID).set(standardFields({
          id: ID, submittedBy: UIDS.marketing, department: 'Marketing', reportType: 'Weekly',
          reportCategory: 'Weekly Marketing Report', recipients: [UIDS.director],
          content: 'Test content', status: 'submitted'
        }));
      });
    });

    it('submittedBy party CAN update status — ALLOWED', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.marketing);
      await assertSucceeds(ctx.firestore().doc(`reports/${ID}`).update({ status: 'archived' }));
    });

    it('submittedBy party CANNOT rewrite recipients (widen visibility) — DENIED (was allowed before P1-01)', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.marketing);
      await assertFails(ctx.firestore().doc(`reports/${ID}`).update({ recipients: [UIDS.director, UIDS.ceo, UIDS.finance] }));
    });

    it('submittedBy party CANNOT rewrite content after submission — DENIED (was allowed before P1-01)', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.marketing);
      await assertFails(ctx.firestore().doc(`reports/${ID}`).update({ content: 'Rewritten after the fact' }));
    });

    it('CEO retains unrestricted update authority (unchanged privileged-role branch)', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.ceo);
      await assertSucceeds(ctx.firestore().doc(`reports/${ID}`).update({ content: 'CEO correction' }));
    });

    it('an uninvolved staff member — DENIED', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.hr);
      await assertFails(ctx.firestore().doc(`reports/${ID}`).update({ status: 'archived' }));
    });
  });

  // ── tasks ──────────────────────────────────────────────
  describe('tasks (ownership field: assignedTo)', () => {
    const ID = 'p101_task_test_doc';
    beforeEach(async () => {
      await seedExtra(async (db) => {
        await db.collection('tasks').doc(ID).set(standardFields({
          id: ID, title: 'Follow up with client', description: '', priority: 'medium',
          department: 'Brokerage', assignedTo: UIDS.agentA, assignedToName: 'Agent A',
          assignedBy: UIDS.admin, dueAt: new Date().toISOString(), comments: [],
          checklistKind: null, checklistFor: null, completedAt: null, status: 'todo'
        }));
      });
    });

    it('assignee CAN update status/comments (real call-site shape) — ALLOWED', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.agentA);
      await assertSucceeds(ctx.firestore().doc(`tasks/${ID}`).update({
        status: 'done', completedAt: new Date().toISOString(),
        comments: [{ by: UIDS.agentA, name: 'Agent A', text: 'Done', at: new Date().toISOString() }]
      }));
    });

    it('assignee CANNOT self-reassign away — DENIED (was allowed before P1-01)', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.agentA);
      await assertFails(ctx.firestore().doc(`tasks/${ID}`).update({ assignedTo: UIDS.agentB }));
    });

    it('assignee CANNOT rewrite priority/dueAt — DENIED (was allowed before P1-01)', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.agentA);
      await assertFails(ctx.firestore().doc(`tasks/${ID}`).update({ priority: 'low' }));
    });

    it('admin/staff retains unrestricted update authority — ALLOWED', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.admin);
      await assertSucceeds(ctx.firestore().doc(`tasks/${ID}`).update({ assignedTo: UIDS.agentB }));
    });

    it('unrelated agent — DENIED', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.agentB);
      await assertFails(ctx.firestore().doc(`tasks/${ID}`).update({ status: 'done' }));
    });
  });

  // ── attendance ─────────────────────────────────────────
  describe('attendance (ownership field: userId)', () => {
    const ID = 'p101_attendance_test_doc';
    beforeEach(async () => {
      await seedExtra(async (db) => {
        await db.collection('attendance').doc(ID).set(standardFields({
          id: ID, userId: UIDS.agentA, date: '2026-09-17', checkInAt: new Date().toISOString(),
          checkOutAt: null, checkInLat: -1.95, checkInLng: 30.06, hoursWorked: 0,
          isLate: false, lateMinutes: 0, note: '', approvedBy: null, status: 'checked_in'
        }));
      });
    });

    it('the record owner CAN check out (real submitCheckout() shape) — ALLOWED', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.agentA);
      await assertSucceeds(ctx.firestore().doc(`attendance/${ID}`).update({
        checkOutAt: new Date().toISOString(), hoursWorked: 8
      }));
    });

    it('the record owner CANNOT rewrite checkInAt — DENIED (was allowed before P1-01)', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.agentA);
      await assertFails(ctx.firestore().doc(`attendance/${ID}`).update({ checkInAt: new Date(Date.now() - 3600000).toISOString() }));
    });

    it('the record owner CANNOT self-mark isLate=false / approvedBy — DENIED (was allowed before P1-01)', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.agentA);
      await assertFails(ctx.firestore().doc(`attendance/${ID}`).update({ isLate: false, approvedBy: UIDS.agentA }));
    });

    it('admin/staff retains unrestricted update authority — ALLOWED', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.admin);
      await assertSucceeds(ctx.firestore().doc(`attendance/${ID}`).update({ approvedBy: UIDS.admin }));
    });

    it('unrelated user — DENIED', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.agentB);
      await assertFails(ctx.firestore().doc(`attendance/${ID}`).update({ checkOutAt: new Date().toISOString() }));
    });
  });
});
