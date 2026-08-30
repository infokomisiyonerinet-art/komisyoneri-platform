/**
 * KOMISIYONERI — server-side automation (Phase 2 of the ecosystem roadmap).
 *
 * Moves the deal -> commission -> invoice -> referral cascade out of the
 * browser and onto a Firestore trigger, so it runs exactly once no matter
 * which client (or which of the two existing "close deal" UI flows) wrote
 * the status change, and survives the tab that made the change being
 * closed mid-chain.
 *
 * All business constants and arithmetic below were originally copied
 * verbatim from index.html's autoCalculateCommission() / generateDealInvoice().
 * Two quirks from that copy have since been deliberately fixed here (see
 * the full data-flow audit): COMMISSION_RATES.rental.default was `null`,
 * so calcCommissionAmount()'s `rate = rates.default || 0.04` fallback
 * silently charged the *sale* rate on every rental deal regardless of
 * dealType — now set to 0.0833 (one month's rent as a fraction of the
 * annual value), matching the client's own convertLeadToDeal()/
 * createManualCommission() convention. And the invoice description below
 * only matched the literal string 'rent' (only ever written by
 * submitOffer()'s auto-created deal) while every other deal-creation path
 * writes 'rental' — it now matches both spellings.
 */

const { onDocumentUpdated, onDocumentCreated, onDocumentWritten } = require('firebase-functions/v2/firestore');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions');
const { randomBytes } = require('crypto');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');

initializeApp();

const REGION = 'us-central1';
const KIGALI_OFFSET_MS = 2 * 60 * 60 * 1000; // Africa/Kigali is UTC+2 year-round, no DST

// ── Constants — copied verbatim from index.html ────────────────────────
const COMMISSION_RATES = {
  sale: { default: 0.04, min: 0.03, max: 0.05 },
  rental: { default: 0.0833, min: null, max: null },
  property_management: { default: 0.10, min: 0.08, max: 0.12 },
  valuation: { flat: 80000 },
  surveying: { flat: 120000 },
  legal: { flat: 150000 },
  mortgage_referral: { default: 0.0075, min: 0.005, max: 0.01 },
  construction: { default: 0.075, min: 0.05, max: 0.10 }
};
const COMM_AGENT_SPLIT = 0.60;
const COMM_COMPANY_SPLIT = 0.40;
const RWANDA_VAT = 0.18;

function calcCommissionAmount(dealType, dealValue) {
  dealValue = parseFloat(dealValue) || 0;
  const rates = COMMISSION_RATES[dealType] || COMMISSION_RATES.sale;
  if (rates.flat) return rates.flat;
  const rate = rates.default || 0.04;
  return Math.round(dealValue * rate);
}

// ── Shared write helpers — same document shape as index.html's
// notifyUser()/logAudit(), so the existing notification bell and audit
// log UI need no changes to read what this function writes. Notification
// text is English-only here (there's no reliable per-recipient language
// preference to read server-side — curLang in the app is a client-only
// UI toggle, never persisted to the user's document).
async function notifyUser(db, targetUserId, title, body, type, relatedCollection, relatedId, actingUid) {
  if (!targetUserId) return;
  const ref = db.collection('notifications').doc();
  await ref.set({
    id: ref.id,
    userId: targetUserId,
    title: title || '',
    body: body || '',
    type: type || 'system',
    relatedId: relatedId || '',
    relatedCollection: relatedCollection || '',
    read: false,
    status: 'unread',
    isActive: true,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    createdBy: actingUid,
    updatedBy: actingUid
  });
}

// Broadcasts a notification to every active admin/staff-tier account.
// 'Admin' (capitalized) is included alongside 'admin' because this
// codebase stores that one role inconsistently-cased in a few older user
// records (see the client-side isAdminOrStaff() checks elsewhere) — every
// other role here is written consistently lowercase. That's 13 entries,
// over Firestore's 10-value cap for a single `in` query, so the lookup
// below runs as two batched queries and merges the results — `role` is a
// single field per user doc, so the two batches can never return the same
// doc twice. Recipients are still capped at 20 total after merging — a
// defensive limit, not a real one, since this codebase's staff roster is
// small; if either cap is ever hit for real, this should move to a
// dedicated broadcast mechanism instead of fanning out individual
// notification writes.
const STAFF_ROLES = ['admin', 'Admin', 'super_admin', 'staff', 'ceo', 'branch_manager', 'hr_manager', 'operations_manager', 'operations', 'marketing_manager', 'company_owner', 'director', 'accountant', 'chief_broker', 'customer_support_manager', 'it_manager', 'legal_adviser'];
async function notifyStaff(db, title, body, type, relatedCollection, relatedId, actingUid) {
  const roleBatches = [STAFF_ROLES.slice(0, 10), STAFF_ROLES.slice(10)];
  const snaps = await Promise.all(roleBatches.map((roles) =>
    db.collection('users').where('role', 'in', roles).where('isActive', '==', true).get()
  ));
  const docs = snaps.flatMap((snap) => snap.docs).slice(0, 20);
  await Promise.all(docs.map((d) => notifyUser(db, d.id, title, body, type, relatedCollection, relatedId, actingUid)));
}

// Governance hardening P3.13: userRole below used to be hardcoded 'system'
// unconditionally, even when actingUid names a real user — so every
// server-side audit entry (property/site/plot status changes, deal
// closures, etc.) looked like an anonymous system action, discarding
// exactly the "who" an audit trail exists to answer. This independently
// re-reads the actor's role straight from Firestore (never trusts a
// caller-supplied role, matching every other actor-authorization check in
// this file) — a genuine system-initiated write (actingUid is falsy or the
// literal string 'system') still logs 'system', unchanged.
async function getActorRole(db, actingUid) {
  if (!actingUid || actingUid === 'system') return 'system';
  try {
    const doc = await db.collection('users').doc(actingUid).get();
    return doc.exists ? (doc.data().role || 'unknown') : 'unknown';
  } catch (e) {
    return 'unknown';
  }
}

async function logAudit(db, action, collection, docId, oldValue, newValue, actingUid) {
  const ref = db.collection('auditlogs').doc();
  const userRole = await getActorRole(db, actingUid);
  await ref.set({
    id: ref.id,
    action,
    collection,
    docId: docId || '',
    oldValue: oldValue || null,
    newValue: newValue || null,
    performedBy: actingUid,
    performedAt: FieldValue.serverTimestamp(),
    userRole,
    ipAddress: '',
    isActive: true,
    status: 'logged',
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    createdBy: actingUid,
    updatedBy: actingUid
  });
}

/**
 * Fires once per deal, the moment pipelineStage transitions INTO
 * 'closed_won' (guarded by checking it wasn't already 'closed_won'
 * before this write, so later unrelated edits to an already-won deal
 * never re-trigger it). Both existing client call sites
 * (advanceDealStage() and closeDealWon()) write pipelineStage and status
 * together in the same update, so watching pipelineStage alone is
 * sufficient and catches both flows without duplicating logic per caller.
 */
exports.onDealClosedWon = onDocumentUpdated({ document: 'deals/{dealId}', region: REGION }, async (event) => {
  const before = event.data.before.data() || {};
  const after = event.data.after.data() || {};
  if (before.pipelineStage === 'closed_won' || after.pipelineStage !== 'closed_won') return;

  const dealId = event.params.dealId;
  const deal = after;
  const db = getFirestore();
  const actingUid = deal.updatedBy || 'system';

  // P0.1 security closure: rules/firestore.rules now restrict the
  // closed_won transition to admin/staff, so this should be unreachable
  // by anyone else — but this trigger is the one place that actually
  // creates money, so it independently re-verifies the actor rather than
  // trusting the rules layer alone. A rules bug, a future admin-SDK script
  // writing on someone's behalf, or any other path that reaches this
  // trigger without going through the client rule should not silently
  // mint a commission — it logs a flagged audit entry and stops instead.
  if (actingUid !== 'system') {
    const actorDoc = await db.collection('users').doc(actingUid).get();
    const actorRole = actorDoc.exists ? String(actorDoc.data().role || '').toLowerCase() : '';
    if (!STAFF_ROLES.map((r) => r.toLowerCase()).includes(actorRole)) {
      logger.warn('onDealClosedWon: deal closed by a non-staff actor — skipping commission/invoice generation', { dealId, actingUid, actorRole });
      await logAudit(db, 'deal.closed_won.rejected_untrusted_actor', 'deals', dealId,
        { pipelineStage: before.pipelineStage || 'new' }, { actingUid, actorRole }, 'system');
      return;
    }
  }

  const dealType = deal.dealType || 'sale';
  const dealValue = Number(deal.agreedPrice || deal.price || 0);
  const rate = (COMMISSION_RATES[dealType] && COMMISSION_RATES[dealType].default) || 0.04;
  const total = calcCommissionAmount(dealType, dealValue);
  const agentShare = Math.round(total * COMM_AGENT_SPLIT);
  const companyShare = Math.round(total * COMM_COMPANY_SPLIT);

  // Deterministic IDs make this idempotent by construction: a retried or
  // duplicate trigger invocation for the same deal hits ALREADY_EXISTS on
  // .create() and is skipped, rather than relying on a query-then-write
  // race the way the original client code did.
  const commissionRef = db.collection('commissions').doc('deal_' + dealId + '_commission');
  let commissionCreated = false;
  try {
    await commissionRef.create({
      id: commissionRef.id,
      dealId: dealId,
      agentId: deal.agentId || actingUid,
      agentName: deal.agentName || '',
      propertyId: deal.propertyId || '',
      propertyTitle: deal.propertyTitle || deal.propTitle || '',
      clientName: deal.clientName || '',
      dealType: dealType,
      dealValue: dealValue,
      commissionRate: rate,
      totalCommission: total,
      agentShare: agentShare,
      companyShare: companyShare,
      agentSplitPct: COMM_AGENT_SPLIT,
      companySplitPct: COMM_COMPANY_SPLIT,
      approvedBy: '',
      approvedAt: null,
      paidAt: null,
      paymentRef: '',
      notes: '',
      status: 'pending',
      isActive: true,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      createdBy: actingUid,
      updatedBy: actingUid
    });
    commissionCreated = true;
  } catch (e) {
    if (e.code === 6 /* ALREADY_EXISTS */) {
      logger.info('Commission already generated for deal ' + dealId + ' — skipping (idempotent retry)');
    } else {
      throw e;
    }
  }

  if (commissionCreated) {
    await logAudit(db, 'commission.calculated', 'commissions', commissionRef.id, null,
      { dealId: dealId, total: total, agentShare: agentShare, companyShare: companyShare }, actingUid);

    if (deal.agentId) {
      await notifyUser(db, deal.agentId,
        'Commission Recorded!',
        'Commission of ' + agentShare.toLocaleString() + ' RWF recorded for ' + (deal.clientName || 'deal') + '.',
        'commission_calculated', 'commissions', commissionRef.id, actingUid);
    }
  }

  // Invoice — mirrors generateDealInvoice()'s own guard: no invoice for a
  // zero/missing deal value.
  if (dealValue > 0) {
    const invoiceRef = db.collection('invoices').doc('deal_' + dealId + '_invoice');
    let invoiceCreated = false;
    const vatAmount = Math.round(dealValue * RWANDA_VAT);
    const totalAmount = dealValue + vatAmount;
    const desc = ((deal.dealType === 'rent' || deal.dealType === 'rental') ? 'Rental' : 'Sale') + ' — ' + (deal.propertyTitle || deal.propTitle || 'Property');
    try {
      await invoiceRef.create({
        id: invoiceRef.id,
        invoiceNo: '',
        type: 'deal',
        dealId: dealId,
        billedTo: deal.clientName || deal.clientId || '',
        clientId: deal.clientId || '',
        clientEmail: '',
        clientAddress: '',
        lineItems: [{ description: desc, qty: 1, unitPrice: dealValue, lineTotal: dealValue }],
        subtotal: dealValue,
        vatAmount: vatAmount,
        totalAmount: totalAmount,
        dueDate: '',
        notes: 'Auto-generated on deal closure',
        paidAt: null,
        pdfUrl: null,
        status: 'sent',
        isActive: true,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        createdBy: actingUid,
        updatedBy: actingUid
      });
      invoiceCreated = true;
    } catch (e) {
      if (e.code === 6) {
        logger.info('Invoice already generated for deal ' + dealId + ' — skipping (idempotent retry)');
      } else {
        throw e;
      }
    }
    if (invoiceCreated) {
      await logAudit(db, 'invoice.deal_auto_generated', 'invoices', invoiceRef.id, null,
        { dealId: dealId, totalAmount: totalAmount }, actingUid);
    }
  }

  // Referral auto-qualify — only runs once, gated on the commission
  // actually having just been created, matching the original code's
  // placement inside autoCalculateCommission()'s single success path.
  if (commissionCreated && deal.clientId) {
    const referralsSnap = await db.collection('referrals')
      .where('referredUserId', '==', deal.clientId)
      .where('isActive', '==', true)
      .where('status', '==', 'registered')
      .limit(1).get();
    if (!referralsSnap.empty) {
      const rDoc = referralsSnap.docs[0];
      const rData = rDoc.data();
      await rDoc.ref.update({
        status: 'qualified',
        qualifiedAt: FieldValue.serverTimestamp(),
        dealId: dealId,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: actingUid
      });
      await logAudit(db, 'referral.qualified', 'referrals', rDoc.id, { status: 'registered' }, { status: 'qualified', dealId: dealId }, actingUid);
      if (rData.referrerId) {
        await notifyUser(db, rData.referrerId,
          'Your Referral Qualified!',
          'Someone you referred just completed a deal! You will receive your referral reward soon.',
          'referral_qualified', 'referrals', rDoc.id, actingUid);
      }
    }
  }

  // Denormalize a privacy-safe "sold" marker onto the public property doc
  // itself, for index.html's loadHomepageRotation() SOLD-badge slot.
  // Deliberately NOT read from `deals` client-side for that: deals/{id}
  // requires auth (isAdminOrStaff() or being a party to it — see
  // rules/firestore.rules), so an anonymous homepage visitor's query would
  // just get permission-denied and the badge would silently never appear
  // for most real traffic; and even if it were made readable, a full deal
  // doc carries client name/phone and commission figures that have no
  // business being public. `properties` is already fully public
  // (`allow read: if true`), and a single non-PII timestamp field adds no
  // new exposure — every other property field is already visible there.
  // Additive only: does NOT touch the property's own approval `status`
  // field, so it keeps appearing in the normal approved-listings pipeline
  // exactly as before; only loadHomepageRotation() treats soldAt specially.
  // Governance hardening P2.12: also flips `availability` to 'sold' here —
  // before this, a deal closing won only ever set soldAt, so a property
  // could sit indefinitely reading "Available" on every UI surface that
  // reads availability (see _normalizePropDoc()'s own _sold check, which
  // already treats soldAt as equivalent — this just makes the underlying
  // field agree with what the UI already implies) unless a staff member
  // separately remembered to click "Mark Sold" in the admin panel. This
  // write is additive alongside the existing soldAt marker, not a
  // replacement for it — onPropertyStatusChanged below still independently
  // logs/notifies on the availability change, same as a manual one.
  if (deal.propertyId) {
    await db.collection('properties').doc(deal.propertyId).update({
      soldAt: FieldValue.serverTimestamp(),
      availability: 'sold',
      availabilityReason: 'Deal closed won (deal ' + dealId + ')',
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: actingUid
    }).catch((e) => {
      logger.warn('onDealClosedWon: could not mark property as sold (may have been deleted)', { dealId, propertyId: deal.propertyId, error: e.message });
    });
  }

  logger.info('Deal ' + dealId + ' closed_won cascade complete', { commissionCreated, dealValue, agentShare, companyShare });
});

/**
 * Notifies the listing's agent and writes an audit log entry the moment a
 * property's admin-review decision changes — replacing the notifyUser()/
 * logAudit() calls that used to live inline in _fsAdminApprove()/
 * _fsAdminReject(), in the same .then() as the status write itself. Those
 * two writes happened in sequence on the client with no guarantee the
 * second one (the notification) survived a closed tab; this makes the
 * notification a property of the status change itself; it happens
 * wherever the write comes from, and can't be lost independently of it.
 *
 * Status values in this collection are stored inconsistently-cased
 * ('approved' from this admin flow vs 'Approved' in some older
 * localStorage-mirrored writes) — comparisons here are lowercased to be
 * robust to that, matching the defensive pattern used for `role` checks
 * elsewhere in this codebase.
 *
 * The two title strings below use real unicode emoji rather than the
 * original code's HTML entities (&#9989; / &#10060;) in the title text —
 * the notification panel's render path passes the title through
 * escapeHtml() before display, which neutralizes those entities into
 * unrenderable literal text. That was a pre-existing display bug in the
 * code this replaces; fixing it here rather than reproducing it, since
 * it's a one-line cosmetic fix, not a behavior change. The `type` field
 * itself is kept exactly as the original ('property_approved' / 'system')
 * since that field is used for icon/analytics categorization elsewhere,
 * not just display text.
 */
exports.onPropertyStatusChanged = onDocumentUpdated({ document: 'properties/{propertyId}', region: REGION }, async (event) => {
  const before = event.data.before.data() || {};
  const after = event.data.after.data() || {};
  const propertyId = event.params.propertyId;
  const db = getFirestore();
  const actingUid = after.updatedBy || 'system';
  const propTitle = after.title || after.titleEN || 'Property';

  const beforeStatus = String(before.status || '').toLowerCase();
  const afterStatus = String(after.status || '').toLowerCase();
  if (beforeStatus !== afterStatus && (afterStatus === 'approved' || afterStatus === 'rejected')) {
    // only these two transitions exist today for the approval `status` field
    if (afterStatus === 'approved') {
      await logAudit(db, 'property.approved', 'properties', propertyId, { status: before.status || 'pending' }, { status: after.status }, actingUid);
      if (after.agentId) {
        await notifyUser(db, after.agentId,
          '✅ Property Approved!',
          propTitle + ' has been approved and is now live.',
          'property_approved', 'properties', propertyId, actingUid);
      }
    } else {
      await logAudit(db, 'property.rejected', 'properties', propertyId, { status: before.status || 'pending' }, { status: after.status, reason: after.rejectionReason || '' }, actingUid);
      if (after.agentId) {
        await notifyUser(db, after.agentId,
          '❌ Property Not Approved',
          propTitle + ' was not approved.' + (after.rejectionReason ? ' Reason: ' + after.rejectionReason : ' Please contact admin for more details.'),
          'system', 'properties', propertyId, actingUid);
      }
    }
    logger.info('Property ' + propertyId + ' status change (' + beforeStatus + ' -> ' + afterStatus + ') notification sent');
  }

  // Availability (Available/Reserved/Sold) — a separate concept from the
  // approval `status` above (see the property/status audit this governs).
  // Independent of the status branch: either, both, or neither can fire on
  // a given write, since they're two unrelated fields that can change
  // together (e.g. a listing approved and marked available in one write)
  // or apart.
  const beforeAvail = String(before.availability || '').toLowerCase();
  const afterAvail = String(after.availability || '').toLowerCase();
  if (beforeAvail !== afterAvail && ['available', 'reserved', 'sold'].includes(afterAvail)) {
    await logAudit(db, 'property.availability_changed', 'properties', propertyId,
      { availability: before.availability || 'available' },
      { availability: after.availability, reason: after.availabilityReason || '' }, actingUid);
    if (after.agentId) {
      const label = afterAvail === 'sold' ? '🔴 Sold' : afterAvail === 'reserved' ? '🔵 Reserved' : '✅ Available';
      await notifyUser(db, after.agentId,
        'Property Availability Updated',
        propTitle + ' marked ' + label + '.' + (after.availabilityReason ? ' Note: ' + after.availabilityReason : ''),
        'property_availability_changed', 'properties', propertyId, actingUid);
    }
    logger.info('Property ' + propertyId + ' availability change (' + beforeAvail + ' -> ' + afterAvail + ') notification sent');
  }
});

/**
 * Governance hardening P0.5 — plots/sites had NO Cloud Function audit
 * backstop at all (unlike properties' onPropertyStatusChanged above), so a
 * status change made through a direct Firestore write that satisfied the
 * rules (or, before this same hardening pass, one of the now-closed
 * managingAgentId/clientId rule bypasses) left zero audit trail if it also
 * skipped the client's own logAudit() call. These two triggers close that
 * gap the same way onPropertyStatusChanged does: fire on every actual
 * status transition regardless of which code path wrote it, and
 * independently read the actor's role from Firestore via logAudit() (never
 * trusting anything the client claims about itself).
 *
 * The client-side logAudit()/notifyUser() calls these replace
 * (submitPlotReservation(), openPlotStatusChange(), approveSite(),
 * confirmRejectSite()) were removed from index.html in the same pass, so a
 * status change now produces exactly one audit entry and one notification,
 * not two.
 */
exports.onPlotStatusChanged = onDocumentUpdated({ document: 'plots/{plotId}', region: REGION }, async (event) => {
  const before = event.data.before.data() || {};
  const after = event.data.after.data() || {};
  const plotId = event.params.plotId;
  const db = getFirestore();
  const actingUid = after.updatedBy || 'system';
  const plotLabel = after.plotLabel || ('Plot ' + (after.plotNumber || plotId));

  const beforeStatus = String(before.status || '').toLowerCase();
  const afterStatus = String(after.status || '').toLowerCase();
  if (beforeStatus === afterStatus) return;

  // 'plot.reserved' preserves the specific action name the removed
  // client-side call used for this one transition (anything reading the
  // audit trail for that name keeps working); every other transition logs
  // as the more general 'plot.status.changed', matching openPlotStatusChange()'s
  // own prior naming.
  const action = afterStatus === 'reserved' ? 'plot.reserved' : 'plot.status.changed';
  const oldValue = { status: before.status || 'available' };
  const newValue = { status: after.status };
  if (after.clientId) newValue.clientId = after.clientId;
  if (after.transactionSource) newValue.transactionSource = after.transactionSource;
  if (after.statusChangeReason) newValue.reason = after.statusChangeReason;
  await logAudit(db, action, 'plots', plotId, oldValue, newValue, actingUid);

  if (after.agentId) {
    const label = afterStatus === 'sold' ? '🔴 Sold' : afterStatus === 'reserved' ? '🔵 Reserved'
      : afterStatus === 'unavailable' ? '⚪ Unavailable' : afterStatus === 'on_hold' ? '⏸️ On Hold' : '✅ Available';
    await notifyUser(db, after.agentId,
      afterStatus === 'reserved' ? 'Plot Reserved' : 'Plot Status Updated',
      afterStatus === 'reserved'
        ? plotLabel + ' has been reserved by a client.'
        : plotLabel + ' marked ' + label + '.' + (after.statusChangeReason ? ' Reason: ' + after.statusChangeReason : ''),
      afterStatus === 'reserved' ? 'plot_reserved' : 'plot_status_changed', 'plots', plotId, actingUid);
  }
  logger.info('Plot ' + plotId + ' status change (' + beforeStatus + ' -> ' + afterStatus + ') notification sent');
});

exports.onSiteStatusChanged = onDocumentUpdated({ document: 'sites/{siteId}', region: REGION }, async (event) => {
  const before = event.data.before.data() || {};
  const after = event.data.after.data() || {};
  const siteId = event.params.siteId;
  const db = getFirestore();
  const actingUid = after.updatedBy || 'system';
  const siteName = after.name || 'Site';
  const recipientUid = after.managingAgentId || after.developerId || '';

  const beforeStatus = String(before.status || '').toLowerCase();
  const afterStatus = String(after.status || '').toLowerCase();
  if (beforeStatus === afterStatus || (afterStatus !== 'active' && afterStatus !== 'rejected')) return;

  if (afterStatus === 'active') {
    await logAudit(db, 'site.approved', 'sites', siteId,
      { status: before.status || 'pending_review' },
      { status: after.status, approvedBy: after.approvedBy || actingUid }, actingUid);
    if (recipientUid) {
      await notifyUser(db, recipientUid,
        '✅ Site Approved!',
        siteName + ' has been approved and is now live on the marketplace.',
        'site_approved', 'sites', siteId, actingUid);
    }
  } else {
    await logAudit(db, 'site.rejected', 'sites', siteId,
      { status: before.status || 'pending_review' },
      { status: after.status, reason: after.rejectionReason || '' }, actingUid);
    if (recipientUid) {
      await notifyUser(db, recipientUid,
        '❌ Site Not Approved',
        siteName + ' was not approved.' + (after.rejectionReason ? ' Reason: ' + after.rejectionReason : ' Please contact admin for more details.'),
        'system', 'sites', siteId, actingUid);
    }
  }
  logger.info('Site ' + siteId + ' status change (' + beforeStatus + ' -> ' + afterStatus + ') notification sent');
});

/**
 * Gap-filling audit triggers — NOT a blanket "audit every write" catch-all.
 *
 * This codebase already has 78 distinct, specifically-named manual
 * logAudit() calls covering nearly every collection and business action
 * (deal.created, lead.stage.changed, commission.paid, branch_created, and
 * so on). A generic trigger that logged every Firestore write on every
 * collection would mostly duplicate that existing, well-named coverage
 * with noise — one meaningful "deal.stage.changed" entry sitting next to
 * a redundant generic "deals document updated" entry adds cost and
 * clutter, not safety.
 *
 * What's actually missing, verified by checking every top-level
 * `.add()` call site in index.html against the existing logAudit()
 * calls, is exactly two: a brand-new property listing and a brand-new
 * site enquiry are both created with no audit trail at all. These two
 * triggers fill those two specific, confirmed gaps — they are not a
 * general substitute for calling logAudit() in new code.
 */
async function auditCreate(db, action, collection, docId, snapshotData) {
  await logAudit(db, action, collection, docId, null, snapshotData, snapshotData.createdBy || snapshotData.agentId || 'system');
}

exports.onPropertyCreated = onDocumentCreated({ document: 'properties/{propertyId}', region: REGION }, async (event) => {
  const data = event.data.data() || {};
  await auditCreate(getFirestore(), 'property.created', 'properties', event.params.propertyId, {
    title: data.title || '', district: data.district || '', price: data.price || 0,
    agentId: data.agentId || '', status: data.status || '', createdBy: data.createdBy || ''
  });
});

exports.onSiteEnquiryCreated = onDocumentCreated({ document: 'site_enquiries/{enquiryId}', region: REGION }, async (event) => {
  const data = event.data.data() || {};
  await auditCreate(getFirestore(), 'site_enquiry.created', 'site_enquiries', event.params.enquiryId, {
    siteId: data.siteId || '', plotId: data.plotId || '', clientId: data.clientId || '',
    agentId: data.agentId || '', createdBy: data.createdBy || data.clientId || ''
  });
});

/**
 * Nightly follow-up reminder sweep — replaces
 * _checkLeadFollowupNotifications(), which only ever ran client-side, at
 * the moment someone happened to have the CRM page open, and only over
 * whichever leads THAT viewer's own query returned (their own leads, or
 * every lead if they're admin/staff). If nobody opened the CRM on a given
 * day, zero reminders went out that day, for anyone. This runs once a day
 * regardless of whether any browser tab is open anywhere.
 *
 * Query and business logic are unchanged from the original: any active
 * lead with a nextFollowUp date that has arrived (today or earlier),
 * excluding closed_won/closed_lost, notifies that lead's agent — every
 * day it remains outstanding, not just once — matching the original's
 * "remind every day until it's handled" behavior exactly.
 *
 * Dedup is now a real per-lead Firestore field (lastFollowupReminderDate)
 * instead of a per-browser localStorage key, so it actually prevents
 * duplicate reminders across devices/sessions rather than only within one
 * browser — a genuine correctness improvement, not just a reliability one.
 * The existing isActive+nextFollowUp composite index already covers this
 * query; no new index is needed.
 */
exports.nightlyFollowupReminderSweep = onSchedule({
  schedule: '0 6 * * *',
  timeZone: 'Africa/Kigali',
  region: REGION
}, async () => {
  const db = getFirestore();
  const now = new Date();
  const kigaliNow = new Date(now.getTime() + KIGALI_OFFSET_MS);
  const todayKey = kigaliNow.toISOString().slice(0, 10); // YYYY-MM-DD, Kigali-local
  // Midnight today in Kigali, expressed as the equivalent UTC instant —
  // this is the boundary the original code compared against after its own
  // fuDate.setHours(0,0,0,0) truncation to local midnight.
  const startOfTodayKigali = new Date(Date.UTC(kigaliNow.getUTCFullYear(), kigaliNow.getUTCMonth(), kigaliNow.getUTCDate()) - KIGALI_OFFSET_MS);
  const endOfTodayKigali = new Date(startOfTodayKigali.getTime() + 24 * 60 * 60 * 1000 - 1);

  const snap = await db.collection('leads')
    .where('isActive', '==', true)
    .where('nextFollowUp', '<=', endOfTodayKigali)
    .get();

  let sent = 0;
  for (const doc of snap.docs) {
    const lead = doc.data();
    if (lead.pipelineStage === 'closed_won' || lead.pipelineStage === 'closed_lost') continue;
    const target = lead.agentId;
    if (!target) continue;
    if (lead.lastFollowupReminderDate === todayKey) continue; // already reminded today

    const fuDate = lead.nextFollowUp && lead.nextFollowUp.toDate ? lead.nextFollowUp.toDate() : new Date(lead.nextFollowUp);
    const isOverdue = fuDate.getTime() < startOfTodayKigali.getTime();
    const clientN = lead.clientName || 'Client';
    const title = isOverdue ? 'Follow-up Overdue' : 'Follow-up Due Today';
    const body = 'Follow up with ' + clientN + (isOverdue ? ' — Overdue!' : ' today.');

    await notifyUser(db, target, title, body, 'lead_followup', 'leads', doc.id, 'system');
    await doc.ref.update({ lastFollowupReminderDate: todayKey, updatedAt: FieldValue.serverTimestamp() });
    sent++;
  }

  logger.info('Nightly follow-up sweep complete', { checked: snap.size, sent });
});

/**
 * Governance hardening P2.10 — submitPlotReservation() (index.html) sets a
 * 7-day reservedUntil on every reservation, but nothing ever read it back:
 * an expired reservation held a plot 'reserved' — removed from the site's
 * availablePlots count — indefinitely, until a staff member happened to
 * notice and manually revert it via openPlotStatusChange(). Runs hourly
 * (reservations are date-only granularity, so this is frequent enough to
 * matter without being wasteful) and re-verifies each candidate inside a
 * transaction (not trusting the query snapshot, which can be stale by the
 * time the write happens) so it can never race a client confirming a sale
 * or cancelling in the same window: if the plot's real status or
 * reservedUntil has already moved on since the query ran, this is a no-op
 * for that plot. The resulting status write (reserved -> available) is
 * picked up by onPlotStatusChanged above like any other status change, so
 * the audit log entry and agent notification come from that one shared
 * code path rather than being duplicated here.
 */
exports.expireStaleReservations = onSchedule({
  schedule: '0 * * * *',
  timeZone: 'Africa/Kigali',
  region: REGION
}, async () => {
  const db = getFirestore();
  const now = new Date();
  const snap = await db.collection('plots')
    .where('status', '==', 'reserved')
    .where('reservedUntil', '<=', now)
    .get();

  let expired = 0;
  for (const doc of snap.docs) {
    const plotId = doc.id;
    try {
      await db.runTransaction(async (tx) => {
        const plotRef = db.collection('plots').doc(plotId);
        const pd = await tx.get(plotRef);
        if (!pd.exists) return;
        const p = pd.data();
        if (p.status !== 'reserved') return; // already changed since the query ran
        const ru = p.reservedUntil && p.reservedUntil.toDate ? p.reservedUntil.toDate() : new Date(p.reservedUntil);
        if (!(ru.getTime() <= now.getTime())) return; // extended/changed since the query ran
        tx.update(plotRef, {
          status: 'available',
          clientId: '',
          reservedAt: null,
          reservedUntil: null,
          depositPaid: false,
          statusChangeReason: 'Reservation expired (reservedUntil passed)',
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: 'system'
        });
        if (p.siteId) {
          tx.update(db.collection('sites').doc(p.siteId), {
            reservedPlots: FieldValue.increment(-1),
            availablePlots: FieldValue.increment(1),
            updatedAt: FieldValue.serverTimestamp(),
            updatedBy: 'system'
          });
        }
      });
      expired++;
    } catch (e) {
      logger.error('expireStaleReservations: failed to expire plot ' + plotId, e);
    }
  }
  if (expired) logger.info('expireStaleReservations: expired ' + expired + ' stale plot reservation(s)');
});

/**
 * Lead auto-assignment — replaces manual triage with a district- and
 * workload-aware pick, and replaces the old naive fallback that lived in
 * index.html's submitLead(): if the client-side (localStorage-only,
 * disconnected-from-Firestore) zone round-robin found no match, it just
 * grabbed "the first of up to 5 active agents" with no district or
 * workload logic at all. That client-side fallback has been removed in
 * the same change that adds this trigger, since a race between the two
 * writing agentId would otherwise be possible.
 *
 * Fires on every new lead, from all five places index.html creates one.
 * Skips leads that already have an agentId — several of those creation
 * paths inherit agentId from the property being enquired about, and the
 * manual "Add Lead" form lets staff pick an agent explicitly; both of
 * those are intentional assignments this trigger must not override.
 *
 * Agents have no district/zone field of their own in Firestore — the only
 * real territory model in this codebase is at the branch level
 * (branches.district / branches.districtsCovered, with agents linked via
 * users.branchId). So district matching here is: find active branches
 * covering the lead's district, take the active agents linked to those
 * branches, and pick the one with the fewest currently-active leads
 * (leads.where(agentId==X, isActive==true).count(), the same signal
 * already used for agent-performance leaderboards elsewhere in the app).
 * If the lead has no district, or no branch covers it, or no agent is
 * linked to a matching branch, this falls back to picking the
 * lowest-workload agent company-wide — never leaves a lead unassigned
 * just because the district lookup didn't resolve to anyone.
 *
 * Deliberately reads all active agents (and, when needed, all active
 * branches) in full rather than adding new composite indexes: both
 * collections are small (a company's staff roster and physical office
 * list), and district values are free-text elsewhere in the app, so
 * matching them in-memory with a normalized (trim + lowercase) compare
 * avoids exact-match casing bugs a Firestore `where` clause would hit.
 */
exports.onLeadCreated = onDocumentCreated({ document: 'leads/{leadId}', region: REGION }, async (event) => {
  const data = event.data.data() || {};
  if (data.agentId) return; // already assigned — inherited from a property, or picked manually

  const db = getFirestore();
  const leadId = event.params.leadId;
  const district = (data.district || data.zone || '').trim();

  const agentsSnap = await db.collection('users')
    .where('role', '==', 'agent')
    .where('isActive', '==', true)
    .get();
  const activeAgents = agentsSnap.docs.filter((d) => d.data().status === 'active');
  if (activeAgents.length === 0) {
    logger.warn('No active agents available to auto-assign lead', { leadId });
    return;
  }

  let candidates = activeAgents;
  let method = 'workload_only';

  if (district) {
    const norm = (s) => (s || '').trim().toLowerCase();
    const branchesSnap = await db.collection('branches').where('isActive', '==', true).get();
    const matchingBranchIds = new Set();
    branchesSnap.forEach((b) => {
      const bd = b.data();
      const covered = Array.isArray(bd.districtsCovered) ? bd.districtsCovered : [];
      if (norm(bd.district) === norm(district) || covered.some((c) => norm(c) === norm(district))) {
        matchingBranchIds.add(b.id);
      }
    });
    if (matchingBranchIds.size > 0) {
      const districtAgents = activeAgents.filter((a) => matchingBranchIds.has(a.data().branchId));
      if (districtAgents.length > 0) {
        candidates = districtAgents;
        method = 'district_workload';
      }
    }
  }

  const withWorkload = await Promise.all(candidates.map(async (a) => {
    const countSnap = await db.collection('leads')
      .where('agentId', '==', a.id)
      .where('isActive', '==', true)
      .count().get();
    return { id: a.id, data: a.data(), leadCount: countSnap.data().count };
  }));
  withWorkload.sort((x, y) => x.leadCount - y.leadCount);
  const chosen = withWorkload[0];
  const agentName = chosen.data.displayName || chosen.data.email || '';

  // Re-check inside a transaction: a manual assignment or a duplicate/
  // retried trigger invocation could have set agentId in between the
  // reads above and this write.
  const leadRef = db.collection('leads').doc(leadId);
  const didAssign = await db.runTransaction(async (tx) => {
    const fresh = await tx.get(leadRef);
    if (!fresh.exists || fresh.data().agentId) return false;
    tx.update(leadRef, {
      agentId: chosen.id,
      agentName: agentName,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: 'system'
    });
    return true;
  });
  if (!didAssign) return;

  await notifyUser(db, chosen.id, 'New Lead Assigned',
    'You have a new lead: ' + (data.clientName || 'Client') + (district ? ' — ' + district : ''),
    'lead_assigned', 'leads', leadId, 'system');

  await logAudit(db, 'lead.auto_assigned', 'leads', leadId,
    { agentId: '' }, { agentId: chosen.id, agentName: agentName, method: method }, 'system');

  logger.info('Lead auto-assigned', { leadId, agentId: chosen.id, method, candidateCount: candidates.length });
});

/**
 * Subscriptions — the last confirmed-unbuilt roadmap item. One plan for
 * now (AGENT_PREMIUM_MONTHLY), matching the only concrete figure that
 * appears anywhere in this app's own business-plan copy ("Subscription ya
 * agents: 50,000 RWF/kwezi"). There is no payment gateway anywhere in this
 * app, so "billing" here means generating a real invoice each period
 * (through the exact same invoices collection every other invoice in this
 * app already uses — no new invoice UI needed) rather than moving money
 * automatically.
 *
 * Runs daily rather than exactly on each subscription's renewal instant:
 * simpler, and it doubles as a self-healing sync for the `featured` flag
 * (a boolean that already existed on every property and already affects
 * homepage/search sort order, but until index.html's subscribeToPremium()
 * nothing ever set it to true) — any property an agent adds mid-cycle
 * becomes featured within a day, not just at subscribe/renew time.
 *
 * Deterministic invoice IDs (sub_<agentId>_<YYYY-MM>_invoice) make renewal
 * idempotent by construction, the same pattern onDealClosedWon uses above.
 */
const AGENT_PREMIUM_MONTHLY = 50000;

exports.dailySubscriptionSync = onSchedule({
  schedule: '0 5 * * *',
  timeZone: 'Africa/Kigali',
  region: REGION
}, async () => {
  const db = getFirestore();
  const now = new Date();

  const snap = await db.collection('subscriptions').where('status', '==', 'active').get();
  let renewed = 0;
  let synced = 0;

  for (const doc of snap.docs) {
    const sub = doc.data();
    const agentId = sub.agentId;
    if (!agentId) continue;

    // Re-sync featured flag against the agent's CURRENT active listings —
    // covers listings added after subscribing/renewing.
    const propsSnap = await db.collection('properties')
      .where('agentId', '==', agentId).where('isActive', '==', true).get();
    const currentIds = [];
    const featureBatch = db.batch();
    let featureBatchHasWrites = false;
    propsSnap.forEach((p) => {
      currentIds.push(p.id);
      if (!p.data().featured) {
        featureBatch.update(p.ref, { featured: true, updatedAt: FieldValue.serverTimestamp(), updatedBy: 'system' });
        featureBatchHasWrites = true;
      }
    });
    if (featureBatchHasWrites) {
      await featureBatch.commit();
      synced++;
    }
    const previousIds = Array.isArray(sub.featuredPropertyIds) ? sub.featuredPropertyIds : [];
    if (currentIds.slice().sort().join(',') !== previousIds.slice().sort().join(',')) {
      await doc.ref.update({ featuredPropertyIds: currentIds, updatedAt: FieldValue.serverTimestamp() });
    }

    // Renewal billing.
    const periodEnd = sub.currentPeriodEnd && sub.currentPeriodEnd.toDate ? sub.currentPeriodEnd.toDate() : new Date(sub.currentPeriodEnd);
    if (!periodEnd || periodEnd > now) continue;

    const nextStart = periodEnd;
    const nextEnd = new Date(nextStart.getTime());
    nextEnd.setMonth(nextEnd.getMonth() + 1);
    const periodKey = nextStart.toISOString().slice(0, 7); // YYYY-MM
    const amount = sub.amount || AGENT_PREMIUM_MONTHLY;
    const vatAmount = Math.round(amount * RWANDA_VAT);
    const totalAmount = amount + vatAmount;
    const invoiceRef = db.collection('invoices').doc('sub_' + agentId + '_' + periodKey + '_invoice');
    let invoiceCreated = false;
    try {
      await invoiceRef.create({
        id: invoiceRef.id,
        invoiceNo: '',
        type: 'subscription',
        subscriptionId: doc.id,
        dealId: '',
        billedTo: sub.agentName || agentId,
        clientId: agentId,
        clientEmail: '',
        clientAddress: '',
        lineItems: [{ description: 'Agent Premium Subscription — ' + periodKey, qty: 1, unitPrice: amount, lineTotal: amount }],
        subtotal: amount,
        vatAmount: vatAmount,
        totalAmount: totalAmount,
        dueDate: nextStart.toISOString().slice(0, 10),
        notes: 'Auto-generated subscription renewal',
        paidAt: null,
        pdfUrl: null,
        status: 'sent',
        isActive: true,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        createdBy: 'system',
        updatedBy: 'system'
      });
      invoiceCreated = true;
    } catch (e) {
      if (e.code === 6 /* ALREADY_EXISTS */) {
        logger.info('Renewal invoice already generated for subscription ' + doc.id + ' period ' + periodKey + ' — skipping (idempotent retry)');
      } else {
        throw e;
      }
    }

    if (invoiceCreated) {
      await logAudit(db, 'subscription.invoice_generated', 'invoices', invoiceRef.id, null,
        { agentId: agentId, subscriptionId: doc.id, totalAmount: totalAmount }, 'system');
      await notifyUser(db, agentId, 'Subscription Renewed',
        'Your Agent Premium subscription renewed — invoice ' + totalAmount.toLocaleString() + ' RWF.',
        'subscription_renewed', 'invoices', invoiceRef.id, 'system');
      renewed++;
    }

    await doc.ref.update({
      currentPeriodStart: nextStart,
      currentPeriodEnd: nextEnd,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: 'system'
    });
  }

  logger.info('Daily subscription sync complete', { active: snap.size, renewed, synced });
});

/**
 * P0 remediation (Enterprise Readiness Audit): moves the FIRST subscription
 * invoice server-side, the same way dailySubscriptionSync's renewal invoice
 * already is. subscribeToPremium() in index.html used to write this invoice
 * client-side, which meant the invoices.create rule had to carve out an
 * exception for it. Deleting that carve-out (see rules/firestore.rules)
 * closes off a class of forged-invoice risk entirely, at the cost of
 * needing this one extra trigger.
 *
 * Fires on subscriptions/{agentId} create OR update, but only acts on a
 * genuine transition INTO 'active' (fresh subscribe, or re-subscribe after
 * a cancellation) — a metadata-only update to an already-active
 * subscription must not generate a second invoice. Uses the exact same
 * deterministic invoice ID scheme as the renewal path
 * (sub_<agentId>_<YYYY-MM>_invoice), so if both paths were ever to race for
 * the same billing period, the second write hits ALREADY_EXISTS and is
 * skipped — idempotent by construction, not by coincidence.
 */
exports.onSubscriptionActivated = onDocumentWritten({ document: 'subscriptions/{agentId}', region: REGION }, async (event) => {
  const before = event.data.before && event.data.before.exists ? event.data.before.data() : null;
  const after = event.data.after && event.data.after.exists ? event.data.after.data() : null;
  if (!after || after.status !== 'active') return;
  if (before && before.status === 'active') return; // already active — not a fresh activation

  const db = getFirestore();
  const agentId = event.params.agentId;
  const periodStart = after.currentPeriodStart && after.currentPeriodStart.toDate
    ? after.currentPeriodStart.toDate() : new Date();
  const periodKey = periodStart.toISOString().slice(0, 7); // YYYY-MM
  const amount = after.amount || AGENT_PREMIUM_MONTHLY;
  const vatAmount = Math.round(amount * RWANDA_VAT);
  const totalAmount = amount + vatAmount;

  const invoiceRef = db.collection('invoices').doc('sub_' + agentId + '_' + periodKey + '_invoice');
  let invoiceCreated = false;
  try {
    await invoiceRef.create({
      id: invoiceRef.id,
      invoiceNo: '',
      type: 'subscription',
      subscriptionId: agentId,
      dealId: '',
      billedTo: after.agentName || agentId,
      clientId: agentId,
      clientEmail: '',
      clientAddress: '',
      lineItems: [{ description: 'Agent Premium Subscription — first month', qty: 1, unitPrice: amount, lineTotal: amount }],
      subtotal: amount,
      vatAmount: vatAmount,
      totalAmount: totalAmount,
      dueDate: periodStart.toISOString().slice(0, 10),
      notes: 'Agent Premium subscription — first billing period',
      paidAt: null,
      pdfUrl: null,
      status: 'sent',
      isActive: true,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      createdBy: 'system',
      updatedBy: 'system'
    });
    invoiceCreated = true;
  } catch (e) {
    if (e.code === 6 /* ALREADY_EXISTS */) {
      logger.info('Subscription activation invoice already generated for ' + agentId + ' period ' + periodKey + ' — skipping (idempotent retry)');
    } else {
      throw e;
    }
  }

  if (invoiceCreated) {
    await logAudit(db, 'subscription.invoice_generated', 'invoices', invoiceRef.id, null,
      { agentId: agentId, totalAmount: totalAmount }, 'system');
    await notifyUser(db, agentId, 'Subscribed to Agent Premium',
      'Your first invoice (' + totalAmount.toLocaleString() + ' RWF) has been generated.',
      'subscription_invoice', 'invoices', invoiceRef.id, 'system');
  }
});

/**
 * P0 remediation (Enterprise Readiness Audit): server-side verification of
 * every payout request the instant it's created. The audit found the
 * client-submitted amount/commissionIds were never recomputed or checked
 * server-side — an authenticated user could reference commissions they
 * don't own, that aren't approved, or that are already claimed by another
 * request, or simply submit a mismatched amount. This runs before any
 * admin ever sees the request in their queue: on success it stamps
 * serverVerified:true (which the admin approval UI now requires before
 * showing an Approve action); on any mismatch it auto-rejects the request
 * and notifies the agent, exactly as if an admin had rejected it by hand.
 */
/**
 * Shared verification core for a payout request — used both at creation
 * time (onPayoutRequestCreated) and again at approval time
 * (onPayoutRequestApproved). Re-running the exact same checks at approval
 * time matters because "verified" state can go stale between the two: a
 * referenced commission could be paid out via a different, concurrently-
 * approved request in the window between them, which only a fresh
 * duplicate-claim check (excluding the request being verified) catches.
 */
async function verifyPayoutRequest(db, requestId, req) {
  const commissionIds = Array.isArray(req.commissionIds) ? req.commissionIds : [];
  if (!req.agentId || !commissionIds.length) {
    return { ok: false, reason: 'No commissions were referenced.' };
  }

  // No OTHER pending/approved request by this agent may already claim any
  // of the same commission IDs — prevents duplicate/double-spent requests.
  const existingSnap = await db.collection('payout_requests')
    .where('agentId', '==', req.agentId)
    .where('status', 'in', ['pending', 'approved'])
    .get();
  const claimed = new Set();
  existingSnap.forEach((d) => {
    if (d.id === requestId) return;
    (d.data().commissionIds || []).forEach((cid) => claimed.add(cid));
  });
  if (commissionIds.some((cid) => claimed.has(cid))) {
    return { ok: false, reason: 'One or more commissions are already referenced by another payout request.' };
  }

  // Recompute the real total from the actual commission documents — the
  // client-submitted amount is never trusted.
  let recomputedTotal = 0;
  for (const cid of commissionIds) {
    const cDoc = await db.collection('commissions').doc(cid).get();
    if (!cDoc.exists) return { ok: false, reason: 'A referenced commission does not exist.' };
    const c = cDoc.data();
    if (c.agentId !== req.agentId) return { ok: false, reason: 'A referenced commission does not belong to you.' };
    if (c.status !== 'approved') return { ok: false, reason: 'A referenced commission is not in an approved, payable state.' };
    recomputedTotal += Number(c.agentShare) || 0;
  }
  if (Math.round(recomputedTotal) !== Math.round(Number(req.amount) || 0)) {
    return { ok: false, reason: 'The requested amount does not match the referenced commissions.' };
  }

  return { ok: true, total: recomputedTotal, commissionIds: commissionIds };
}

exports.onPayoutRequestCreated = onDocumentCreated({ document: 'payout_requests/{requestId}', region: REGION }, async (event) => {
  const db = getFirestore();
  const requestId = event.params.requestId;
  const ref = event.data.ref;
  const req = event.data.data() || {};
  if (req.status !== 'pending') return; // rules pin creation to 'pending' — defensive only

  const result = await verifyPayoutRequest(db, requestId, req);
  if (!result.ok) {
    await ref.update({
      status: 'rejected',
      rejectedReason: result.reason,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: 'system'
    });
    await logAudit(db, 'payout_request.auto_rejected', 'payout_requests', requestId, null, { reason: result.reason }, 'system');
    if (req.agentId) {
      await notifyUser(db, req.agentId, 'Payout Request Rejected',
        'Your payout request was automatically rejected: ' + result.reason,
        'payout_rejected', 'payout_requests', requestId, 'system');
    }
    logger.info('Payout request auto-rejected', { requestId: requestId, reason: result.reason });
    return;
  }

  await ref.update({
    serverVerified: true,
    verifiedAmount: result.total,
    verifiedAt: FieldValue.serverTimestamp()
  });
  logger.info('Payout request verified', { requestId: requestId, agentId: req.agentId, amount: result.total });
});

/**
 * P0.1 security closure: approvePayoutRequest() in index.html used to mark
 * the referenced commissions 'paid' directly from the client, trusting
 * whatever `serverVerified` said at whatever moment the admin's browser
 * last read it. This is the actual money-movement step now — it fires the
 * instant a payout_requests doc transitions into 'approved' (which rules
 * only allow from a genuinely 'pending' + already-server-verified state,
 * closing the forgery path at the rules layer), and independently
 * re-verifies everything a second time before touching a single
 * commission, since "verified a moment ago" and "still true right now"
 * are different claims — see verifyPayoutRequest()'s doc comment.
 */
exports.onPayoutRequestApproved = onDocumentUpdated({ document: 'payout_requests/{requestId}', region: REGION }, async (event) => {
  const before = event.data.before.data() || {};
  const after = event.data.after.data() || {};
  if (before.status === 'approved' || after.status !== 'approved') return;

  const db = getFirestore();
  const requestId = event.params.requestId;
  const ref = event.data.after.ref;
  const approvedBy = after.approvedBy || after.updatedBy || 'system';

  const result = await verifyPayoutRequest(db, requestId, after);
  if (!result.ok) {
    await ref.update({
      status: 'rejected',
      rejectedReason: 'Re-verification failed at approval time: ' + result.reason,
      approvedBy: null,
      approvedAt: null,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: 'system'
    });
    await logAudit(db, 'payout_request.approval_reverted', 'payout_requests', requestId,
      { status: 'approved' }, { status: 'rejected', reason: result.reason }, 'system');
    if (after.agentId) {
      await notifyUser(db, after.agentId, 'Payout Approval Could Not Be Completed',
        'Your payout could not be completed on re-verification: ' + result.reason,
        'payout_rejected', 'payout_requests', requestId, 'system');
    }
    if (approvedBy && approvedBy !== 'system') {
      await notifyUser(db, approvedBy, 'Payout Approval Reverted',
        'A payout you approved failed re-verification and was reverted: ' + result.reason,
        'system', 'payout_requests', requestId, 'system');
    }
    logger.warn('Payout approval reverted on re-verification failure', { requestId, reason: result.reason });
    return;
  }

  const batch = db.batch();
  result.commissionIds.forEach((cid) => {
    batch.update(db.collection('commissions').doc(cid), {
      status: 'paid',
      paidAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: 'system'
    });
  });
  await batch.commit();

  await logAudit(db, 'payout_request.paid', 'payout_requests', requestId, null,
    { agentId: after.agentId, amount: result.total, approvedBy: approvedBy }, 'system');
  if (after.agentId) {
    await notifyUser(db, after.agentId, 'Payout Approved',
      'Your payout request has been approved and ' + result.total.toLocaleString() + ' RWF marked paid.',
      'payout_approved', 'payout_requests', requestId, 'system');
  }
  logger.info('Payout request paid', { requestId, agentId: after.agentId, amount: result.total });
});

/**
 * P0 remediation (Enterprise Readiness Audit): the audit found
 * submitOffer() in index.html was a dead end — it wrote a real Firestore
 * doc that nothing ever read back, no notification ever fired despite a
 * comment claiming one did. index.html's submitOffer() now resolves/
 * creates a real deals doc for every offer so it inherits the existing
 * deal-detail-modal's offer timeline, staff/agent dashboard visibility,
 * and reporting — this trigger is the "notify" half of that fix: a
 * client's offer notifies the deal's agent AND staff (so a new inbound
 * offer isn't only visible if someone happens to be looking), while an
 * agent's counter-offer notifies the buyer whose offer it responds to.
 */
exports.onOfferCreated = onDocumentCreated({ document: 'offers/{offerId}', region: REGION }, async (event) => {
  const db = getFirestore();
  const offerId = event.params.offerId;
  const offer = event.data.data() || {};
  const amountStr = (Number(offer.amount) || 0).toLocaleString() + ' RWF';

  if (offer.fromRole === 'client') {
    let agentId = '';
    if (offer.dealId) {
      const dealDoc = await db.collection('deals').doc(offer.dealId).get();
      if (dealDoc.exists) agentId = dealDoc.data().agentId || '';
    }
    if (agentId) {
      await notifyUser(db, agentId, 'New Offer Received',
        (offer.fromName || 'A client') + ' submitted an offer of ' + amountStr + '.',
        'offer_received', 'offers', offerId, 'system');
    }
    await notifyStaff(db, 'New Offer Received',
      (offer.fromName || 'A client') + ' submitted an offer of ' + amountStr + '.',
      'offer_received', 'offers', offerId, 'system');
  } else if (offer.fromRole === 'agent' && offer.counterTo) {
    const origDoc = await db.collection('offers').doc(offer.counterTo).get();
    const buyerId = origDoc.exists ? origDoc.data().fromUserId : '';
    if (buyerId) {
      await notifyUser(db, buyerId, 'Counter-Offer Received',
        'The agent sent a counter-offer of ' + amountStr + '.',
        'offer_countered', 'offers', offerId, 'system');
    }
  }
});

/**
 * CEO vs Operations Director governance (rules/firestore.rules' isCEO()/
 * isDirector() section) — /approvals is the escalation path a Director uses
 * for anything above their normal scope (budget above their limit, senior
 * staff actions, major contracts, etc). Same P0.1 pattern already proven for
 * payout_requests: the client can never set serverVerified itself (rules
 * enforce this), so this trigger — and only this trigger — is the one path
 * to serverVerified:true, after independently re-checking the request is
 * real (requestedBy exists and is a genuine staff-tier account, type is one
 * of the recognized governance target collections).
 */
const APPROVAL_TARGET_TYPES = [
  'strategyDocuments', 'majorContracts', 'shareStructure', 'governanceDocuments',
  'companyRegistration', 'loansAndAssetDisposals', 'seniorStaffActions', 'budgetRequests',
  // Final Management Org Chart — deniedActions-triggered approval types
  // (see index.html's requestApproval()): a salary change HR can't make
  // directly, a Finance spend/new-account request above their scope, or a
  // fired-director/major-contract-sign request that already has its own
  // CEO-only collection above and is included here only so it can also be
  // routed through /approvals rather than always assumed CEO-only.
  'payroll', 'financeTransactions', 'bankAccounts'
];

async function verifyApprovalRequest(db, req) {
  if (!APPROVAL_TARGET_TYPES.includes(req.type)) {
    return { ok: false, reason: 'Unrecognized approval type: ' + req.type };
  }
  if (!req.requestedBy) {
    return { ok: false, reason: 'No requesting user was recorded.' };
  }
  const requesterDoc = await db.collection('users').doc(req.requestedBy).get();
  if (!requesterDoc.exists) {
    return { ok: false, reason: 'Requesting user does not exist.' };
  }
  const requesterRole = String(requesterDoc.data().role || '').toLowerCase();
  if (!STAFF_ROLES.map((r) => r.toLowerCase()).includes(requesterRole)) {
    return { ok: false, reason: 'Requesting user is not a staff-tier account.' };
  }
  return { ok: true };
}

exports.onApprovalCreated = onDocumentCreated({ document: 'approvals/{approvalId}', region: REGION }, async (event) => {
  const db = getFirestore();
  const approvalId = event.params.approvalId;
  const ref = event.data.ref;
  const req = event.data.data() || {};
  if (req.status !== 'pending') return; // rules pin creation to 'pending' — defensive only

  const result = await verifyApprovalRequest(db, req);
  if (!result.ok) {
    await ref.update({
      status: 'rejected',
      rejectedReason: result.reason,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: 'system'
    });
    await logAudit(db, 'approval.auto_rejected', 'approvals', approvalId, null, { reason: result.reason }, 'system');
    if (req.requestedBy) {
      await notifyUser(db, req.requestedBy, 'Approval Request Rejected',
        'Your approval request was automatically rejected: ' + result.reason,
        'approval_rejected', 'approvals', approvalId, 'system');
    }
    logger.info('Approval request auto-rejected', { approvalId, reason: result.reason });
    return;
  }

  await ref.update({ serverVerified: true });
  await notifyStaff(db, 'CEO Approval Requested',
    (req.summaryFields && req.summaryFields.title) || ('A ' + req.type + ' request needs CEO approval.'),
    'approval_requested', 'approvals', approvalId, req.requestedBy || 'system');
  logger.info('Approval request verified', { approvalId, type: req.type, requestedBy: req.requestedBy });
});

/**
 * Fires when a CEO's decision (rules require serverVerified already true —
 * see rules/firestore.rules' /approvals match block) moves an approval to
 * 'approved'. Re-verifies the actor is genuinely CEO — the actual privileged
 * write to the target collection only ever happens here, server-side, never
 * from the client directly, mirroring onPayoutRequestApproved's re-
 * verification-before-money-moves pattern above.
 */
exports.onApprovalDecided = onDocumentUpdated({ document: 'approvals/{approvalId}', region: REGION }, async (event) => {
  const before = event.data.before.data() || {};
  const after = event.data.after.data() || {};
  if (before.status === 'approved' || after.status !== 'approved') return;

  const db = getFirestore();
  const approvalId = event.params.approvalId;
  const ref = event.data.after.ref;
  const decidedBy = after.decidedBy || after.updatedBy || 'system';

  if (decidedBy !== 'system') {
    const actorDoc = await db.collection('users').doc(decidedBy).get();
    const actorRole = actorDoc.exists ? String(actorDoc.data().role || '').toLowerCase() : '';
    // Mirrors rules/firestore.rules' own approvals-update permission
    // exactly (isCEO() || caller's uid in routedTo) — a CEO can decide
    // anything; anyone else must actually be one of the superiors this
    // specific request was routed to (requestApproval()'s own
    // currentUser.reportsTo at request time). This used to hardcode
    // actorRole !== 'ceo' unconditionally, silently reverting even a
    // legitimate routedTo Director's decision — the client-side UI,
    // firestore.rules, and this re-verification disagreed about who was
    // really allowed to decide.
    const routedTo = Array.isArray(after.routedTo) ? after.routedTo : [];
    // admin/super_admin added alongside ceo — mirrors the same
    // Ultimate-Authority/absent-staff-fallback fix applied to
    // createStaffOrPartnerAccount/deleteApprovedAgent and to the /approvals
    // update rule in rules/firestore.rules (all three re-check this
    // identically; keep them in sync).
    const isAuthorized = actorRole === 'ceo' || actorRole === 'admin' || actorRole === 'super_admin'
      || routedTo.indexOf(decidedBy) > -1;
    if (!isAuthorized) {
      await ref.update({
        status: 'rejected',
        rejectedReason: 'Re-verification failed: approving actor is not the CEO or a listed approver.',
        decidedBy: null,
        decidedAt: null,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: 'system'
      });
      await logAudit(db, 'approval.decision_reverted', 'approvals', approvalId,
        { status: 'approved' }, { status: 'rejected', decidedBy, actorRole }, 'system');
      logger.warn('Approval decision reverted — actor not authorized', { approvalId, decidedBy, actorRole });
      return;
    }
  }

  const targetRef = db.collection(after.type).doc();
  await targetRef.set(Object.assign({
    id: targetRef.id,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    createdBy: after.requestedBy || 'system',
    updatedBy: decidedBy,
    status: 'active',
    isActive: true,
    sourceApprovalId: approvalId
  }, after.payload || {}));

  await logAudit(db, 'approval.decided_approved', 'approvals', approvalId, null,
    { type: after.type, targetId: targetRef.id, decidedBy }, decidedBy);
  if (after.requestedBy) {
    await notifyUser(db, after.requestedBy, 'Approval Granted',
      'Your ' + after.type + ' request was approved.',
      'approval_approved', after.type, targetRef.id, decidedBy);
  }
  logger.info('Approval decided — target write complete', { approvalId, type: after.type, targetId: targetRef.id });
});

/**
 * ── Staff/Partner Admin Provisioning (createStaffOrPartnerAccount) ──────
 *
 * Callable (onCall), not the approvals/{id} async workflow above — that
 * workflow is for a staff member REQUESTING something a CEO signs off on
 * later; this is the CEO directly, immediately provisioning an account
 * right now. Creating a Firebase Auth user needs Admin-SDK privileges the
 * client doesn't have, which is the whole reason this exists server-side
 * at all rather than as a client-side db.collection('users').add().
 *
 * department/jobTitle/reportsTo mirror index.html's own ROLE_DEPARTMENT/
 * ROLE_JOBTITLE/ROLE_SUPERIOR_ROLES exactly (kept in sync manually, same
 * as the COMMISSION_RATES constants at the top of this file) — this app
 * has exactly one management role per department, and department/
 * jobTitle are derived from role everywhere else (see index.html's own
 * comment on ROLE_DEPARTMENT and rules/firestore.rules' deptOfRole()), so
 * a provisioning form that let the caller set them independently would
 * only ever be able to create an account that drifts out of sync with
 * every other permission check in the app — e.g. a "CEO" stored as
 * role:'staff' with some separate executiveLevel flag would silently
 * fail every isExecutive()/role==='ceo' check elsewhere, despite having
 * successfully logged in.
 */
const PROVISIONABLE_STAFF_ROLES = [
  'ceo', 'director', 'accountant', 'chief_broker', 'marketing_manager',
  'customer_support_manager', 'it_manager', 'hr_manager', 'legal_adviser', 'operations', 'staff'
];
const ROLE_DEPARTMENT = {
  ceo: 'Executive', director: 'Executive',
  accountant: 'Finance', chief_broker: 'Brokerage', marketing_manager: 'Marketing',
  customer_support_manager: 'CustomerSupport', it_manager: 'IT',
  hr_manager: 'HR', legal_adviser: 'Legal', operations: 'Operations'
};
const ROLE_JOBTITLE = {
  ceo: 'Founder & CEO', director: 'Operations Director',
  accountant: 'Director of Finance', chief_broker: 'Chief Broker', marketing_manager: 'Marketing Manager',
  customer_support_manager: 'Customer Support Manager', it_manager: 'IT / Product Manager',
  hr_manager: 'HR Manager', legal_adviser: 'Legal Adviser', operations: 'Operations Manager'
};
const ROLE_SUPERIOR_ROLES = {
  director: ['ceo'],
  accountant: ['ceo', 'director'],
  chief_broker: ['director'],
  marketing_manager: ['director'],
  customer_support_manager: ['director'],
  it_manager: ['ceo', 'director'],
  hr_manager: ['director', 'ceo'],
  legal_adviser: ['ceo'],
  operations: ['director', 'ceo']
};

// Never shown to anyone or emailed anywhere — the account's very first
// useful action is the client calling sendPasswordResetEmail() right
// after this succeeds (same mechanism the existing "Forgot password?"
// links already use), so nobody ever needs to know or type this value.
function randomTempPassword() {
  return randomBytes(24).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 24) + 'Aa1!';
}

exports.createStaffOrPartnerAccount = onCall({ region: REGION }, async (request) => {
  const auth = request.auth;
  if (!auth || !auth.uid) {
    throw new HttpsError('unauthenticated', 'You must be signed in.');
  }
  const db = getFirestore();

  // Never trust the client's own role claim for this — re-verify against
  // Firestore, the same source of truth every other privileged trigger in
  // this file re-checks against (see onApprovalDecided above).
  const callerDoc = await db.collection('users').doc(auth.uid).get();
  const callerRole = callerDoc.exists ? String(callerDoc.data().role || '').toLowerCase() : '';
  // Admin/super_admin are equally-trusted callers alongside CEO — Ultimate
  // Authority / absent-staff fallback (governance spec §1/§7/§20): an
  // Admin-only company with no CEO account must still be able to provision
  // its first staff account without a code change. This was previously
  // CEO-only, literally, which meant Admin could not onboard anyone until a
  // CEO account existed — a real gap, not an intentional restriction.
  if (callerRole !== 'ceo' && callerRole !== 'admin' && callerRole !== 'super_admin') {
    logger.warn('createStaffOrPartnerAccount: rejected — caller is not CEO/Admin', { callerUid: auth.uid, callerRole });
    throw new HttpsError('permission-denied', 'Only the CEO or an Admin can provision staff or partner accounts.');
  }

  const data = request.data || {};
  const accountType = data.accountType === 'partner' ? 'partner' : 'staff';
  const role = accountType === 'partner' ? 'partner' : String(data.role || '').toLowerCase();
  const name = String(data.name || '').trim();
  const email = String(data.email || '').trim().toLowerCase();

  if (!name) throw new HttpsError('invalid-argument', 'Full name is required.');
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpsError('invalid-argument', 'A valid email is required.');
  }
  if (accountType === 'staff' && PROVISIONABLE_STAFF_ROLES.indexOf(role) === -1) {
    throw new HttpsError('invalid-argument', 'Unrecognized role: ' + role);
  }

  // Exactly one CEO — block a second one outright, server-side (the client
  // panel also warns before submitting, but this is the real gate).
  if (role === 'ceo') {
    const existingCeo = await db.collection('users')
      .where('role', '==', 'ceo').where('isActive', '==', true).limit(1).get();
    if (!existingCeo.empty) {
      throw new HttpsError('already-exists', 'A CEO account already exists. Only one CEO is allowed.');
    }
  }

  // Firebase Auth itself is the authoritative email-uniqueness check —
  // createUser() below rejects a duplicate with auth/email-already-exists.
  let userRecord;
  try {
    userRecord = await getAuth().createUser({
      email,
      password: randomTempPassword(),
      displayName: name,
      emailVerified: false
    });
  } catch (err) {
    if (err && err.code === 'auth/email-already-exists') {
      throw new HttpsError('already-exists', 'An account with this email already exists.');
    }
    logger.error('createStaffOrPartnerAccount: Auth user creation failed', { error: err && err.message });
    throw new HttpsError('internal', 'Could not create the account. Please try again.');
  }

  const uid = userRecord.uid;
  const department = accountType === 'staff' ? (ROLE_DEPARTMENT[role] || '') : '';
  const jobTitle = accountType === 'staff' ? (ROLE_JOBTITLE[role] || '') : '';

  // reportsTo: resolved to real, currently-active uids of the superior
  // role(s) for this role — mirrors how changeUserRole()/
  // renderOrgChartFields() already do this for an existing user's role
  // change in index.html, so a freshly-provisioned account ends up with
  // exactly the same reportsTo shape as one reassigned into this role.
  let reportsTo = [];
  const superiorRoles = ROLE_SUPERIOR_ROLES[role];
  if (superiorRoles && superiorRoles.length) {
    const superiors = await db.collection('users')
      .where('role', 'in', superiorRoles)
      .where('isActive', '==', true)
      .get();
    reportsTo = superiors.docs.map((d) => d.id);
  }

  const now = FieldValue.serverTimestamp();
  await db.collection('users').doc(uid).set({
    id: uid,
    uid,
    displayName: name,
    email,
    role,
    department,
    jobTitle,
    reportsTo,
    // 'pending_first_login' is deliberately NOT the 'pending' status value
    // the agent-registration approval flow and the staff/partner login
    // pages' own pending-approval check use — a CEO-provisioned account
    // must land straight on its dashboard on first login (no extra
    // approval screen, per the acceptance criteria), so it must never
    // match either of those existing status === 'pending' checks. This
    // flips to 'active' the first time restoreUserSession() sees it.
    status: 'pending_first_login',
    isActive: true,
    createdAt: now,
    updatedAt: now,
    createdBy: auth.uid,
    updatedBy: auth.uid
  });

  await logAudit(db, 'user.provisioned', 'users', uid, null,
    { role, department, jobTitle, accountType }, auth.uid);
  await notifyUser(db, auth.uid, 'Account Provisioned',
    name + ' (' + (accountType === 'partner' ? 'Partner' : (ROLE_JOBTITLE[role] || role)) + ') has been added.',
    'user_provisioned', 'users', uid, auth.uid);

  logger.info('createStaffOrPartnerAccount: account created', { uid, role, accountType, createdBy: auth.uid });

  return { ok: true, uid, email, name, role, department, jobTitle };
});

/**
 * ── Permanent Agent Deletion (deleteApprovedAgent) ──────────────────────
 *
 * CEO-only, same server-side re-verification pattern as
 * createStaffOrPartnerAccount right above (never trust the client's role
 * claim — re-read users/{uid} here). Deleting a Firebase Auth account is
 * an Admin-SDK-only operation, so — same reasoning as staff provisioning —
 * this has to be a Cloud Function, not a client-side Firestore write.
 *
 * Scoped to an already-approved agent only (role === 'agent' and
 * isVerified/verified === true — this app has no separate "agents"
 * collection or distinct "approved" status string; approval IS those two
 * fields on the users/{uid} doc, set by index.html's _fsPendingApprove()).
 *
 * Cascade behavior (confirmed with the requester before implementing,
 * since this app has no existing "delete an agent" precedent to copy):
 *   - deals / leads: deletion is BLOCKED if the agent has any not yet in
 *     pipelineStage closed_won/closed_lost — these are active business in
 *     progress, never silently reassigned or orphaned.
 *   - properties.agentId / sites.managingAgentId: reassigned to the CEO
 *     performing the deletion (the one account guaranteed to always
 *     exist), so listings/sites stay properly owned instead of pointing
 *     at a deleted account.
 *   - commissions / subscriptions / payout_requests / documents /
 *     viewings / site_enquiries: left completely untouched. These are
 *     financial/historical records — agentId becomes a dangling reference
 *     to a deleted account on purpose, the same way a paid invoice still
 *     names a since-deleted client elsewhere in a normal accounting
 *     system. Never modified, never deleted.
 */
exports.deleteApprovedAgent = onCall({ region: REGION }, async (request) => {
  const auth = request.auth;
  if (!auth || !auth.uid) {
    throw new HttpsError('unauthenticated', 'You must be signed in.');
  }
  const db = getFirestore();

  const callerDoc = await db.collection('users').doc(auth.uid).get();
  const callerRole = callerDoc.exists ? String(callerDoc.data().role || '').toLowerCase() : '';
  // Same admin-inclusive fix as createStaffOrPartnerAccount above — see its
  // comment.
  if (callerRole !== 'ceo' && callerRole !== 'admin' && callerRole !== 'super_admin') {
    logger.warn('deleteApprovedAgent: rejected — caller is not CEO/Admin', { callerUid: auth.uid, callerRole });
    throw new HttpsError('permission-denied', 'Only the CEO or an Admin can permanently delete an agent.');
  }

  const targetUid = String((request.data || {}).uid || '').trim();
  if (!targetUid) throw new HttpsError('invalid-argument', 'Missing agent uid.');
  if (targetUid === auth.uid) throw new HttpsError('invalid-argument', 'Cannot delete your own account this way.');

  const targetDoc = await db.collection('users').doc(targetUid).get();
  if (!targetDoc.exists) throw new HttpsError('not-found', 'Agent not found.');
  const targetData = targetDoc.data();
  const targetRole = String(targetData.role || '').toLowerCase();
  const isApprovedAgent = targetRole === 'agent' && (targetData.isVerified === true || targetData.verified === true);
  if (!isApprovedAgent) {
    throw new HttpsError('failed-precondition', 'Only an already-approved (verified) agent can be deleted this way.');
  }

  // Active-business guard — deals and leads share the same pipelineStage
  // field/values (see EXEC_CRM_STAGES/CRM_STAGES in index.html); fetched
  // and filtered in JS rather than a composite `not-in` query since a
  // single agent's deal/lead volume here is always small.
  const CLOSED_STAGES = ['closed_won', 'closed_lost'];
  const [dealsSnap, leadsSnap] = await Promise.all([
    db.collection('deals').where('agentId', '==', targetUid).get(),
    db.collection('leads').where('agentId', '==', targetUid).get()
  ]);
  const activeDeals = dealsSnap.docs.filter((d) => CLOSED_STAGES.indexOf(d.data().pipelineStage) === -1);
  const activeLeads = leadsSnap.docs.filter((d) => CLOSED_STAGES.indexOf(d.data().pipelineStage) === -1);
  if (activeDeals.length || activeLeads.length) {
    throw new HttpsError('failed-precondition',
      'Cannot delete: ' + activeDeals.length + ' active deal(s) and ' + activeLeads.length +
      ' active lead(s) still assigned to this agent. Reassign or close them first, then retry.');
  }

  // Reassign properties/sites to the CEO performing the deletion, batched
  // (Firestore batches cap at 500 writes — this app's per-agent listing
  // volume is nowhere near that, so a single batch is fine).
  const [propsSnap, sitesSnap] = await Promise.all([
    db.collection('properties').where('agentId', '==', targetUid).get(),
    db.collection('sites').where('managingAgentId', '==', targetUid).get()
  ]);
  const now = FieldValue.serverTimestamp();
  if (propsSnap.size || sitesSnap.size) {
    const batch = db.batch();
    propsSnap.docs.forEach((d) => batch.update(d.ref, { agentId: auth.uid, updatedAt: now, updatedBy: auth.uid }));
    sitesSnap.docs.forEach((d) => batch.update(d.ref, { managingAgentId: auth.uid, updatedAt: now, updatedBy: auth.uid }));
    await batch.commit();
  }

  // Auth account first — if this fails, nothing else has been touched yet
  // and the whole operation can just be retried. 'auth/user-not-found' is
  // tolerated (the Firestore profile can outlive its Auth record in rare
  // cases, e.g. a prior manual cleanup) rather than blocking the deletion
  // on a record that's already gone.
  try {
    await getAuth().deleteUser(targetUid);
  } catch (err) {
    if (!err || err.code !== 'auth/user-not-found') {
      logger.error('deleteApprovedAgent: Auth user deletion failed', { targetUid, error: err && err.message });
      throw new HttpsError('internal', 'Could not delete the agent login. No data was changed — please retry.');
    }
  }

  await db.collection('users').doc(targetUid).delete();

  await logAudit(db, 'agent.permanently_deleted', 'users', targetUid,
    { role: targetData.role, displayName: targetData.displayName, email: targetData.email,
      reassignedProperties: propsSnap.size, reassignedSites: sitesSnap.size },
    null, auth.uid);

  logger.info('deleteApprovedAgent: agent deleted', {
    targetUid, deletedBy: auth.uid, reassignedProperties: propsSnap.size, reassignedSites: sitesSnap.size
  });

  return { ok: true, reassignedProperties: propsSnap.size, reassignedSites: sitesSnap.size };
});

/**
 * Public homepage stats aggregate.
 *
 * The homepage's hero section shows real, live counts (active listings,
 * active clients, verified agents — see loadLiveHomeStats() in index.html),
 * but two of those three counts come from the `users` collection, which is
 * correctly locked down (rules/firestore.rules: `allow read: if isAuth() &&
 * (own doc || staff)`) — an anonymous visitor's browser gets a permission-
 * denied error querying it, so those two counts silently stay at 0 for
 * logged-out visitors. Opening `users` to public list-queries instead would
 * expose every matching user's full document (email, phone, etc.) to any
 * visitor who queries it — not an acceptable trade for a vanity stat.
 *
 * This recomputes the same three counts server-side on a timer (the Admin
 * SDK bypasses security rules entirely) and writes ONLY the three resulting
 * numbers to a single, narrowly public-readable stats/homepage document —
 * no user documents, no PII, ever reach the client. index.html's
 * loadLiveHomeStats() should read this document instead of querying
 * `properties`/`users` directly once rules/firestore.rules' stats/homepage
 * rule (added alongside this function) is deployed.
 */
// Pulled out of updateHomepageStats so the event-driven triggers below can
// call the exact same counting logic on-demand, instead of every affected
// user/property change having to wait for the next 15-minute sweep. Logs
// the raw counts on every run (not just the schedule) so a "why is this
// showing 0" question can be answered from Cloud Function logs alone,
// without needing direct Firestore console access.
async function recomputeHomepageStats(db) {
  const propsSnap = await db.collection('properties').where('status', 'in', ['approved', 'Approved']).get();
  let activeListings = 0;
  propsSnap.forEach((doc) => { if (doc.data().isActive !== false) activeListings++; });

  // Same role-scoped query shape as index.html's loadLiveHomeStats() —
  // querying only 'client'/'agent' role docs (rather than the whole
  // collection) keeps this cheap regardless of total user count.
  const clientsSnap = await db.collection('users').where('role', 'in', ['client', 'Client']).get();
  let activeClients = 0;
  clientsSnap.forEach((doc) => { if (doc.data().isActive !== false) activeClients++; });

  const agentsSnap = await db.collection('users').where('role', 'in', ['agent', 'Agent']).get();
  let verifiedAgents = 0;
  const agentVerificationDump = [];
  agentsSnap.forEach((doc) => {
    const d = doc.data();
    // Agent verification has been written under two different field names
    // across the app's history (index.html's _normalizeAgentDoc() already
    // reads `data.isVerified || data.verified` defensively for exactly this
    // reason) — checking isVerified alone undercounted every agent doc that
    // only ever got `verified: true` set, which is how this stat could read
    // 0 while the agents directory page visibly showed real verified agents
    // (it uses the lenient two-field check).
    if (d.isVerified || d.verified) verifiedAgents++;
    // One line per agent doc, not just the final count — this is the
    // specific piece the prior source-only audit couldn't confirm: whether
    // real agent docs actually have isVerified/verified set. Cheap at this
    // collection's expected size; if that changes, downgrade to
    // logger.debug rather than removing the visibility outright.
    agentVerificationDump.push(doc.id + ':isVerified=' + !!d.isVerified + ':verified=' + !!d.verified + ':status=' + (d.status || ''));
  });

  await db.collection('stats').doc('homepage').set({
    activeListings,
    activeClients,
    verifiedAgents,
    updatedAt: FieldValue.serverTimestamp()
  });

  logger.info('Homepage stats recomputed', { activeListings, activeClients, verifiedAgents, agentVerificationDump });
  return { activeListings, activeClients, verifiedAgents };
}

exports.updateHomepageStats = onSchedule({
  schedule: '*/15 * * * *',
  timeZone: 'Africa/Kigali',
  region: REGION
}, async () => {
  await recomputeHomepageStats(getFirestore());
});

// Closes the up-to-15-minute staleness window between an actual approval
// (_fsPendingApprove() in index.html sets isVerified/status/isActive
// together) and the homepage reflecting it — recompute immediately instead
// of waiting for the next scheduled sweep, but only for writes that could
// actually change one of the three published counts, not on every profile
// edit.
exports.onUserStatsRelevantChange = onDocumentWritten({ document: 'users/{uid}', region: REGION }, async (event) => {
  const statsFields = (d) => d ? {
    role: String(d.role || '').toLowerCase(),
    // Same isVerified||verified lenient check as recomputeHomepageStats()
    // above — a doc that only ever gets `verified: true` toggled must still
    // trip this trigger, or its change to the actual published count would
    // silently wait for the next 15-minute scheduled sweep instead.
    isVerified: !!(d.isVerified || d.verified),
    isActive: d.isActive !== false
  } : null;
  const before = statsFields(event.data.before.exists ? event.data.before.data() : null);
  const after = statsFields(event.data.after.exists ? event.data.after.data() : null);
  const wasCountable = before && (before.role === 'client' || before.role === 'agent');
  const isCountable = after && (after.role === 'client' || after.role === 'agent');
  if (!wasCountable && !isCountable) return; // never a client/agent doc, before or after — irrelevant to these counts
  if (before && after && before.role === after.role && before.isVerified === after.isVerified && before.isActive === after.isActive) return; // relevant fields unchanged
  await recomputeHomepageStats(getFirestore());
});

exports.onPropertyStatsRelevantChange = onDocumentWritten({ document: 'properties/{id}', region: REGION }, async (event) => {
  const statsFields = (d) => d ? {
    status: String(d.status || ''),
    isActive: d.isActive !== false
  } : null;
  const before = statsFields(event.data.before.exists ? event.data.before.data() : null);
  const after = statsFields(event.data.after.exists ? event.data.after.data() : null);
  if (before && after && before.status === after.status && before.isActive === after.isActive) return;
  await recomputeHomepageStats(getFirestore());
});
