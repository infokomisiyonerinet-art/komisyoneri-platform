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
  admin: 'admin_test_user',
  // CEO vs Operations Director governance fixtures — 'director' is this
  // app's real "Operations Director" role value (see rules/firestore.rules'
  // isCEO()/isDirector()). hr/finance/marketing above double as
  // "senior manager" fixtures for the isSeniorManager() carve-out, since
  // hr_manager/accountant/marketing_manager are all in that literal list.
  ceo: 'ceo_test_user',
  director: 'director_test_user',
  // Final Management Org Chart fixtures — 'finance' above (role 'accountant')
  // doubles as the real "Director of Finance"; extended below with
  // budgetApprovalLimit + reportsTo. The other 3 are net-new roles.
  chiefBroker: 'chief_broker_test_user',
  csManager: 'cs_manager_test_user',
  itManager: 'it_manager_test_user',
  legalAdviser: 'legal_adviser_test_user'
};

const DOC_IDS = {
  property: 'property_test_doc',
  deal: 'deal_test_doc',
  commission: 'commission_test_doc',
  payoutRequest: 'payout_request_test_doc',
  partner: 'partner_test_doc',
  payroll: 'payroll_test_doc',
  review: 'review_test_doc',
  staffReview: 'staff_review_test_doc',
  // CEO vs Operations Director governance fixtures
  strategyDoc: 'strategy_doc_test_doc',
  majorContract: 'major_contract_test_doc',
  shareStructure: 'share_structure_test_doc',
  governanceDoc: 'governance_doc_test_doc',
  companyRegistration: 'company_registration_test_doc',
  loanDisposal: 'loan_disposal_test_doc',
  seniorStaffAction: 'senior_staff_action_test_doc',
  dailyOp: 'daily_op_test_doc',
  report: 'report_test_doc',
  suggestion: 'suggestion_test_doc',
  approvalPending: 'approval_pending_test_doc',
  approvalUnverified: 'approval_unverified_test_doc',
  budgetRequestWithinLimit: 'budget_request_within_test_doc',
  budgetRequestAboveLimit: 'budget_request_above_test_doc',
  // Final Management Org Chart fixtures
  employeeRecord: 'employee_record_test_doc',
  legalComplianceDoc: 'legal_compliance_test_doc',
  contractReview: 'contract_review_test_doc',
  financeTxnWithin: 'finance_txn_within_test_doc',
  financeTxnAbove: 'finance_txn_above_test_doc',
  bankAccount: 'bank_account_test_doc',
  reportFromChiefBroker: 'report_from_chief_broker_test_doc',
  reportFromFinanceDirector: 'report_from_finance_director_test_doc',
  payrollApprovalVerified: 'payroll_approval_verified_test_doc'
};

// Director's budgetApprovalLimit fixture — budgetRequestWithinLimit's amount
// sits under this, budgetRequestAboveLimit's sits over it, so the boundary
// tests have real fixtures to assert against on both sides.
const DIRECTOR_BUDGET_LIMIT = 1000000;
// Director of Finance's own budgetApprovalLimit — used by financeTransactions'
// spend-limit boundary tests, same pattern as DIRECTOR_BUDGET_LIMIT above.
const FINANCE_BUDGET_LIMIT = 2000000;

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
    await userDoc(UIDS.hr, 'hr_manager', { department: 'HR', jobTitle: 'HR Manager', reportsTo: [UIDS.director, UIDS.ceo] });
    await userDoc(UIDS.finance, 'accountant', { department: 'Finance', jobTitle: 'Director of Finance',
      budgetApprovalLimit: FINANCE_BUDGET_LIMIT, reportsTo: [UIDS.ceo, UIDS.director] });
    await userDoc(UIDS.marketing, 'marketing_manager', { department: 'Marketing', jobTitle: 'Marketing Manager', reportsTo: [UIDS.director] });
    await userDoc(UIDS.admin, 'admin');
    await userDoc(UIDS.ceo, 'ceo');
    await userDoc(UIDS.director, 'director', { budgetApprovalLimit: DIRECTOR_BUDGET_LIMIT, department: 'Executive', jobTitle: 'Operations Director', reportsTo: [UIDS.ceo] });
    await userDoc(UIDS.chiefBroker, 'chief_broker', { department: 'Brokerage', jobTitle: 'Chief Broker', reportsTo: [UIDS.director] });
    await userDoc(UIDS.csManager, 'customer_support_manager', { department: 'CustomerSupport', jobTitle: 'Customer Support Manager', reportsTo: [UIDS.director] });
    await userDoc(UIDS.itManager, 'it_manager', { department: 'IT', jobTitle: 'IT / Product Manager', reportsTo: [UIDS.ceo, UIDS.director] });
    await userDoc(UIDS.legalAdviser, 'legal_adviser', { department: 'Legal', jobTitle: 'Legal Adviser', reportsTo: [UIDS.ceo] });

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

    // ── CEO vs Operations Director governance fixtures ──
    await db.collection('strategyDocuments').doc(DOC_IDS.strategyDoc).set(standardFields({
      id: DOC_IDS.strategyDoc, title: 'FY26 Strategy', createdBy: UIDS.ceo, updatedBy: UIDS.ceo
    }));
    await db.collection('majorContracts').doc(DOC_IDS.majorContract).set(standardFields({
      id: DOC_IDS.majorContract, counterparty: 'Test Partner Ltd', value: 20000000,
      createdBy: UIDS.ceo, updatedBy: UIDS.ceo
    }));
    await db.collection('shareStructure').doc(DOC_IDS.shareStructure).set(standardFields({
      id: DOC_IDS.shareStructure, holder: 'Founder', percent: 100,
      createdBy: UIDS.ceo, updatedBy: UIDS.ceo
    }));
    await db.collection('governanceDocuments').doc(DOC_IDS.governanceDoc).set(standardFields({
      id: DOC_IDS.governanceDoc, title: 'Bylaws', createdBy: UIDS.ceo, updatedBy: UIDS.ceo
    }));
    await db.collection('companyRegistration').doc(DOC_IDS.companyRegistration).set(standardFields({
      id: DOC_IDS.companyRegistration, regNumber: 'RW-0001', createdBy: UIDS.ceo, updatedBy: UIDS.ceo
    }));
    await db.collection('loansAndAssetDisposals').doc(DOC_IDS.loanDisposal).set(standardFields({
      id: DOC_IDS.loanDisposal, kind: 'loan', amount: 10000000,
      createdBy: UIDS.ceo, updatedBy: UIDS.ceo
    }));
    await db.collection('seniorStaffActions').doc(DOC_IDS.seniorStaffAction).set(standardFields({
      id: DOC_IDS.seniorStaffAction, action: 'hire', targetUid: UIDS.marketing,
      createdBy: UIDS.ceo, updatedBy: UIDS.ceo
    }));
    await db.collection('dailyOperations').doc(DOC_IDS.dailyOp).set(standardFields({
      id: DOC_IDS.dailyOp, note: 'Daily ops log', createdBy: UIDS.director, updatedBy: UIDS.director
    }));
    await db.collection('reports').doc(DOC_IDS.report).set(standardFields({
      id: DOC_IDS.report, title: 'Weekly Report', createdBy: UIDS.director, updatedBy: UIDS.director
    }));
    await db.collection('suggestions').doc(DOC_IDS.suggestion).set(standardFields({
      id: DOC_IDS.suggestion, text: 'Improve onboarding flow',
      createdBy: UIDS.director, updatedBy: UIDS.director
    }));

    // ── approvals — one already server-verified (ready for CEO to decide),
    //    one still unverified (proves CEO can't approve before the
    //    Cloud Function verifies it — same P0.1 shape as payout_requests)
    await db.collection('approvals').doc(DOC_IDS.approvalPending).set(standardFields({
      id: DOC_IDS.approvalPending, type: 'majorContracts', requestedBy: UIDS.director,
      requiredApprover: 'CEO', summaryFields: { title: 'New vendor contract' },
      status: 'pending', serverVerified: true, decidedBy: null, decidedAt: null,
      sourceDocRef: '', payload: { title: 'New vendor contract' }
    }));
    await db.collection('approvals').doc(DOC_IDS.approvalUnverified).set(standardFields({
      id: DOC_IDS.approvalUnverified, type: 'loansAndAssetDisposals', requestedBy: UIDS.director,
      requiredApprover: 'CEO', summaryFields: { title: 'Asset disposal' },
      status: 'pending', serverVerified: false, decidedBy: null, decidedAt: null,
      sourceDocRef: '', payload: { title: 'Asset disposal' }
    }));

    // ── budgetRequests — one within the director's budgetApprovalLimit, one
    //    above it, so the boundary is directly testable
    await db.collection('budgetRequests').doc(DOC_IDS.budgetRequestWithinLimit).set(standardFields({
      id: DOC_IDS.budgetRequestWithinLimit, requestedBy: UIDS.director,
      amount: DIRECTOR_BUDGET_LIMIT - 1, description: 'Office supplies', status: 'pending'
    }));
    await db.collection('budgetRequests').doc(DOC_IDS.budgetRequestAboveLimit).set(standardFields({
      id: DOC_IDS.budgetRequestAboveLimit, requestedBy: UIDS.director,
      amount: DIRECTOR_BUDGET_LIMIT + 1, description: 'New office lease', status: 'pending'
    }));

    // ── Final Management Org Chart fixtures ──
    await db.collection('employeeRecords').doc(DOC_IDS.employeeRecord).set(standardFields({
      id: DOC_IDS.employeeRecord, employeeUid: UIDS.marketing, note: 'Test employee record',
      createdBy: UIDS.hr, updatedBy: UIDS.hr
    }));
    await db.collection('legalCompliance').doc(DOC_IDS.legalComplianceDoc).set(standardFields({
      id: DOC_IDS.legalComplianceDoc, title: 'Data protection compliance note',
      createdBy: UIDS.legalAdviser, updatedBy: UIDS.legalAdviser
    }));
    await db.collection('contractReviews').doc(DOC_IDS.contractReview).set(standardFields({
      id: DOC_IDS.contractReview, contractRef: DOC_IDS.majorContract, notes: 'Reviewed, no issues',
      createdBy: UIDS.legalAdviser, updatedBy: UIDS.legalAdviser
    }));
    await db.collection('financeTransactions').doc(DOC_IDS.financeTxnWithin).set(standardFields({
      id: DOC_IDS.financeTxnWithin, amount: FINANCE_BUDGET_LIMIT - 1, description: 'Office supplies',
      createdBy: UIDS.finance, updatedBy: UIDS.finance
    }));
    await db.collection('bankAccounts').doc(DOC_IDS.bankAccount).set(standardFields({
      id: DOC_IDS.bankAccount, bankName: 'Test Bank', accountNumber: '000123456',
      createdBy: UIDS.ceo, updatedBy: UIDS.ceo
    }));

    // ── Structured reports — Chief Broker's report routes to Operations
    //    Director only; Director of Finance's routes to BOTH CEO and
    //    Operations Director (reportsTo = [ceo, director] per the fixture
    //    above) — the acceptance criterion this directly proves.
    await db.collection('reports').doc(DOC_IDS.reportFromChiefBroker).set(standardFields({
      id: DOC_IDS.reportFromChiefBroker, submittedBy: UIDS.chiefBroker, department: 'Brokerage',
      reportType: 'Weekly', reportCategory: 'Weekly Brokerage Report', recipients: [UIDS.director],
      content: 'Test content', status: 'submitted',
      createdBy: UIDS.chiefBroker, updatedBy: UIDS.chiefBroker
    }));
    await db.collection('reports').doc(DOC_IDS.reportFromFinanceDirector).set(standardFields({
      id: DOC_IDS.reportFromFinanceDirector, submittedBy: UIDS.finance, department: 'Finance',
      reportType: 'Monthly', reportCategory: 'Monthly Financial Statements', recipients: [UIDS.ceo, UIDS.director],
      content: 'Test content', status: 'submitted',
      createdBy: UIDS.finance, updatedBy: UIDS.finance
    }));

    // ── An already server-verified approval routed to BOTH of HR's
    //    reportsTo (director, ceo) — proves either listed superior (not
    //    just isCEO()) can decide it, per the routedTo generalization.
    await db.collection('approvals').doc(DOC_IDS.payrollApprovalVerified).set(standardFields({
      id: DOC_IDS.payrollApprovalVerified, type: 'payroll', actionType: 'change_salaries_unapproved',
      requestedBy: UIDS.hr, routedTo: [UIDS.director, UIDS.ceo], requiredApprover: 'director,ceo',
      summaryFields: { title: 'Salary change for Marketing Manager' },
      status: 'pending', serverVerified: true, decidedBy: null, decidedAt: null,
      sourceDocRef: '', payload: {}
    }));
  });
}

module.exports = { seed, UIDS, DOC_IDS, standardFields, DIRECTOR_BUDGET_LIMIT, FINANCE_BUDGET_LIMIT };
