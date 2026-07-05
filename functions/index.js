/**
 * KOMISIYONERI — server-side automation (Phase 2 of the ecosystem roadmap).
 *
 * Moves the deal -> commission -> invoice -> referral cascade out of the
 * browser and onto a Firestore trigger, so it runs exactly once no matter
 * which client (or which of the two existing "close deal" UI flows) wrote
 * the status change, and survives the tab that made the change being
 * closed mid-chain.
 *
 * All business constants and arithmetic below are copied verbatim from
 * index.html's autoCalculateCommission() / generateDealInvoice() so this
 * is a behavior-preserving migration, not a rules change — including the
 * pre-existing quirks (e.g. the invoice description check compares
 * dealType against the string 'rent', while the commission-rate table
 * uses the key 'rental', so the ternary in practice always resolves to
 * "Sale"). Those are left exactly as they were; fixing them is a separate,
 * deliberate decision for later, not a side effect of this migration.
 */

const { onDocumentUpdated, onDocumentCreated } = require('firebase-functions/v2/firestore');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { logger } = require('firebase-functions');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

initializeApp();

const REGION = 'us-central1';
const KIGALI_OFFSET_MS = 2 * 60 * 60 * 1000; // Africa/Kigali is UTC+2 year-round, no DST

// ── Constants — copied verbatim from index.html ────────────────────────
const COMMISSION_RATES = {
  sale: { default: 0.04, min: 0.03, max: 0.05 },
  rental: { default: null, min: null, max: null },
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

async function logAudit(db, action, collection, docId, oldValue, newValue, actingUid) {
  const ref = db.collection('auditlogs').doc();
  await ref.set({
    id: ref.id,
    action,
    collection,
    docId: docId || '',
    oldValue: oldValue || null,
    newValue: newValue || null,
    performedBy: actingUid,
    performedAt: FieldValue.serverTimestamp(),
    userRole: 'system',
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
    const desc = (deal.dealType === 'rent' ? 'Rental' : 'Sale') + ' — ' + (deal.propertyTitle || deal.propTitle || 'Property');
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
  const beforeStatus = String(before.status || '').toLowerCase();
  const afterStatus = String(after.status || '').toLowerCase();
  if (beforeStatus === afterStatus) return;
  if (afterStatus !== 'approved' && afterStatus !== 'rejected') return; // only these two transitions exist today

  const propertyId = event.params.propertyId;
  const db = getFirestore();
  const actingUid = after.updatedBy || 'system';
  const propTitle = after.title || after.titleEN || 'Property';

  if (afterStatus === 'approved') {
    await logAudit(db, 'property.approved', 'properties', propertyId, { status: before.status || 'pending' }, { status: after.status }, actingUid);
    if (after.agentId) {
      await notifyUser(db, after.agentId,
        '✅ Property Approved!',
        propTitle + ' has been approved and is now live.',
        'property_approved', 'properties', propertyId, actingUid);
    }
  } else {
    await logAudit(db, 'property.rejected', 'properties', propertyId, { status: before.status || 'pending' }, { status: after.status }, actingUid);
    if (after.agentId) {
      await notifyUser(db, after.agentId,
        '❌ Property Not Approved',
        propTitle + ' was not approved. Please contact admin for more details.',
        'system', 'properties', propertyId, actingUid);
    }
  }

  logger.info('Property ' + propertyId + ' status change (' + beforeStatus + ' -> ' + afterStatus + ') notification sent');
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
