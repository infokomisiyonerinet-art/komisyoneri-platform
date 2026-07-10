// Seeds the emulator with representative users + sample documents,
// matching REAL doc shapes as written by index.html (not a hypothetical
// data model) — see tests/rules/README.md for how this was verified
// against the actual app.
//
// Bypasses security rules entirely while seeding (withSecurityRulesDisabled),
// since we're setting up fixtures, not testing writes here.

const UIDS = {
  client: 'client_test_user',
  agentA: 'agent_a_test_user',
  agentB: 'agent_b_test_user',
  hr: 'staff_hr_test_user',
  finance: 'staff_finance_test_user',
  marketing: 'staff_marketing_test_user',
  admin: 'admin_test_user'
};

const DOC_IDS = {
  property: 'property_test_doc',
  deal: 'deal_test_doc',
  commission: 'commission_test_doc',
  payoutRequest: 'payout_request_test_doc',
  partner: 'partner_test_doc',
  payroll: 'payroll_test_doc',
  review: 'review_test_doc',
  staffReview: 'staff_review_test_doc'
};

function standardFields(overrides) {
  const now = new Date().toISOString();
  return Object.assign({
    id: 'x',
    createdAt: now,
    updatedAt: now,
    createdBy: 'seed',
    updatedBy: 'seed',
    status: 'active',
    isActive: true
  }, overrides);
}

async function seed(testEnv) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();

    // ── users — matches the real create shape (id, uid, displayName, email,
    //    phone, role, isActive, status, photoURL, createdAt, updatedAt,
    //    createdBy, updatedBy) confirmed from index.html's registration flow.
    const userDoc = (uid, role, extra) => db.collection('users').doc(uid).set(Object.assign({
      id: uid, uid, displayName: role + ' Test', email: uid + '@test.local',
      phone: '+250700000000', role, isActive: true, status: 'active',
      photoURL: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      createdBy: 'seed', updatedBy: 'seed'
    }, extra));

    await userDoc(UIDS.client, 'client');
    await userDoc(UIDS.agentA, 'agent');
    await userDoc(UIDS.agentB, 'agent');
    // Three DIFFERENT staff-tier roles — used to prove they share identical
    // trust level (rules/firestore.rules' isAdminOrStaff() makes no
    // distinction between them; see 03-staff-tier-uniform-trust.spec.js).
    await userDoc(UIDS.hr, 'hr_manager');
    await userDoc(UIDS.finance, 'accountant');
    await userDoc(UIDS.marketing, 'marketing_manager');
    await userDoc(UIDS.admin, 'admin');

    // ── properties — agentA-owned
    await db.collection('properties').doc(DOC_IDS.property).set(standardFields({
      id: DOC_IDS.property, agentId: UIDS.agentA, ownerId: null,
      title: 'Test Villa', type: 'Villa', district: 'Gasabo', sector: 'Kimironko',
      price: 50000000, bedrooms: 3, bathrooms: 2, area: 300,
      description: 'Seed fixture', amenities: [], images: [], isVerified: false
    }));

    // ── deals — agentA/client, NOT closed_won (so the P0.1 transition-block
    //    test has a real doc to attempt the forbidden transition against)
    await db.collection('deals').doc(DOC_IDS.deal).set(standardFields({
      id: DOC_IDS.deal, agentId: UIDS.agentA, clientId: UIDS.client,
      propertyId: DOC_IDS.property, pipelineStage: 'negotiation',
      agreedPrice: 50000000, dealType: 'sale'
    }));

    // ── commissions — pending, agentA
    await db.collection('commissions').doc(DOC_IDS.commission).set(standardFields({
      id: DOC_IDS.commission, agentId: UIDS.agentA, dealId: DOC_IDS.deal,
      status: 'pending', totalCommission: 2000000, agentShare: 1600000, companyShare: 400000
    }));

    // ── payout_requests — pending, unverified (matches the real
    //    create-time defaults the rules require)
    await db.collection('payout_requests').doc(DOC_IDS.payoutRequest).set(standardFields({
      id: DOC_IDS.payoutRequest, agentId: UIDS.agentA, amount: 1600000,
      status: 'pending', serverVerified: false, verifiedAmount: 0, verifiedAt: null,
      commissionIds: [DOC_IDS.commission]
    }));

    // ── partners — agentB-owned (userId is the only real ownership-scoping
    //    field; there is no partnerOrgId/orgType in this codebase)
    await db.collection('partners').doc(DOC_IDS.partner).set(standardFields({
      id: DOC_IDS.partner, userId: UIDS.agentB, companyName: 'Test Construction Ltd',
      displayName: 'Test Construction', partnerType: 'construction',
      licenseNo: 'LIC-0001', phone: '+250700000001', email: 'partner@test.local',
      nid: '', bio: '', districts: ['Gasabo'], specializations: [],
      verified: true, avgRating: 0, reviewCount: 0
    }));

    // ── payroll — targets the client uid (arbitrary "someone's payroll"
    //    fixture; used to prove blanket staff-tier read access)
    await db.collection('payroll').doc(DOC_IDS.payroll).set(standardFields({
      id: DOC_IDS.payroll, userId: UIDS.client, period: '2026-07',
      grossSalary: 500000, rssbEmployee: 30000, paye: 50000, netSalary: 420000
    }));

    // ── reviews — public partner review (subjectType: 'partner', the only
    //    value this collection's create rule allows from a client)
    await db.collection('reviews').doc(DOC_IDS.review).set(standardFields({
      id: DOC_IDS.review, subjectType: 'partner', subjectId: DOC_IDS.partner,
      authorId: UIDS.client, rating: 5, comment: 'Great partner'
    }));

    // ── staff_reviews — staffId-scoped, admin-created only
    await db.collection('staff_reviews').doc(DOC_IDS.staffReview).set(standardFields({
      id: DOC_IDS.staffReview, staffId: UIDS.hr, reviewerId: UIDS.admin,
      rating: 4, comment: 'Solid quarter'
    }));
  });
}

module.exports = { seed, UIDS, DOC_IDS, standardFields };
