// P0.2 — Tier A / Tier B Super Admin Authority Core.
//
// Verifies the reconciliation introduced by the new isSuperAdmin() helper
// (rules/firestore.rules): a literal role:'super_admin' account now has
// explicit access to the "Tier B" governance/finance/HR/legal collections
// that previously gated on isCEO()/isDirector()/isExecutive()/inDept() with
// NO admin/super_admin presence at all — while plain role:'admin' gains
// NOTHING new (isAdmin() itself was never touched; Tier A authority is
// unaffected; Tier B stays closed to plain admin exactly as before).
//
// This file does not modify tests/rules/seed.js — per P0.2's scope, only
// rules/firestore.rules and this file were touched. A genuine role:
// 'super_admin' fixture (never previously seeded anywhere in this suite —
// every prior "super_admin" assertion actually authenticated as role:
// 'admin', see 10-super-admin-control-center.spec.js's own header comment)
// plus role-casing variant fixtures are created locally below, following
// the same withSecurityRulesDisabled local-fixture pattern already used by
// 08-dynamic-rbac-permissions.spec.js (see its OPERATIONS_UID fixture).

const { assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { makeTestEnv } = require('../testenv');
const { seed, UIDS, DOC_IDS, standardFields } = require('../seed');

const SUPER_ADMIN_UID = 'super_admin_test_user';
// Role-casing variants — none of these exist anywhere else in the suite.
// Exercises rules/firestore.rules' isRole()/getRole().lower() normalization
// directly, rather than assuming it.
const ADMIN_CAP_UID = 'admin_capitalized_test_user'; // role: 'Admin'
const SUPER_ADMIN_MIXED_UID = 'super_admin_mixed_test_user'; // role: 'Super_Admin'
const SUPER_ADMIN_UPPER_UID = 'super_admin_upper_test_user'; // role: 'SUPER_ADMIN'

// Local fixture docs for the 4 Tier B collections seed.js doesn't already
// seed (campaigns/support_tickets/system_changes/sales_targets — none of
// these existed as fixtures before this file, same as how
// 08-dynamic-rbac-permissions.spec.js adds its own local site/plot fixtures
// on top of the shared seed()).
const CAMPAIGN_ID = 'p02_campaign_test_doc';
const SUPPORT_TICKET_ID = 'p02_support_ticket_test_doc';
const SYSTEM_CHANGE_ID = 'p02_system_change_test_doc';
const SALES_TARGET_ID = 'p02_sales_target_test_doc';

describe('P0.2 — Tier A / Tier B Super Admin authority split', function () {
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
        phone: '+250700000000', role, isActive: true, status: 'active',
        photoURL: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        createdBy: 'seed', updatedBy: 'seed'
      }, extra));

      // Genuine super_admin fixture — the first in this entire suite.
      await userDoc(SUPER_ADMIN_UID, 'super_admin');
      // Role-casing variants (H).
      await userDoc(ADMIN_CAP_UID, 'Admin');
      await userDoc(SUPER_ADMIN_MIXED_UID, 'Super_Admin');
      await userDoc(SUPER_ADMIN_UPPER_UID, 'SUPER_ADMIN');

      // Tier B fixtures not already seeded by seed.js.
      await db.collection('campaigns').doc(CAMPAIGN_ID).set(standardFields({
        id: CAMPAIGN_ID, name: 'Q3 Campaign', createdBy: UIDS.marketing, updatedBy: UIDS.marketing
      }));
      await db.collection('support_tickets').doc(SUPPORT_TICKET_ID).set(standardFields({
        id: SUPPORT_TICKET_ID, subject: 'Test ticket', createdBy: UIDS.csManager, updatedBy: UIDS.csManager
      }));
      await db.collection('system_changes').doc(SYSTEM_CHANGE_ID).set(standardFields({
        id: SYSTEM_CHANGE_ID, summary: 'Test system change', createdBy: UIDS.itManager, updatedBy: UIDS.itManager
      }));
      await db.collection('sales_targets').doc(SALES_TARGET_ID).set(standardFields({
        id: SALES_TARGET_ID, period: '2026-Q3', target: 100000000,
        createdBy: UIDS.chiefBroker, updatedBy: UIDS.chiefBroker
      }));
    });
  });

  // ── A + B combined: CEO-only collections (isCEO() || isSuperAdmin()) ──
  describe('A/B. CEO-only collections (shareStructure, governanceDocuments, companyRegistration, loansAndAssetDisposals, seniorStaffActions)', () => {
    const ceoOnlyDocs = [
      ['shareStructure', DOC_IDS.shareStructure],
      ['governanceDocuments', DOC_IDS.governanceDoc],
      ['companyRegistration', DOC_IDS.companyRegistration],
      ['loansAndAssetDisposals', DOC_IDS.loanDisposal],
      ['seniorStaffActions', DOC_IDS.seniorStaffAction]
    ];

    ceoOnlyDocs.forEach(([col, id]) => {
      it(`super_admin CAN read ${col}`, async () => {
        const ctx = testEnv.authenticatedContext(SUPER_ADMIN_UID);
        await assertSucceeds(ctx.firestore().doc(`${col}/${id}`).get());
      });

      it(`super_admin CAN write ${col}`, async () => {
        const ctx = testEnv.authenticatedContext(SUPER_ADMIN_UID);
        await assertSucceeds(ctx.firestore().doc(`${col}/${id}`).update({ updatedBy: SUPER_ADMIN_UID }));
      });

      it(`plain admin CANNOT read ${col} (unchanged by P0.2)`, async () => {
        const ctx = testEnv.authenticatedContext(UIDS.admin);
        await assertFails(ctx.firestore().doc(`${col}/${id}`).get());
      });

      it(`plain admin CANNOT write ${col} (unchanged by P0.2)`, async () => {
        const ctx = testEnv.authenticatedContext(UIDS.admin);
        await assertFails(ctx.firestore().doc(`${col}/${id}`).update({ updatedBy: UIDS.admin }));
      });
    });
  });

  // ── A + B: dailyOperations, suggestions (isCEO() || isDirector() || isSuperAdmin()) ──
  describe('A/B. dailyOperations, suggestions', () => {
    const docs = [
      ['dailyOperations', DOC_IDS.dailyOp, { note: 'updated by super admin' }],
      ['suggestions', DOC_IDS.suggestion, { text: 'updated by super admin' }]
    ];

    docs.forEach(([col, id, patch]) => {
      it(`super_admin CAN read ${col}`, async () => {
        const ctx = testEnv.authenticatedContext(SUPER_ADMIN_UID);
        await assertSucceeds(ctx.firestore().doc(`${col}/${id}`).get());
      });

      it(`super_admin CAN update ${col}`, async () => {
        const ctx = testEnv.authenticatedContext(SUPER_ADMIN_UID);
        await assertSucceeds(ctx.firestore().doc(`${col}/${id}`).update(patch));
      });

      it(`plain admin CANNOT read ${col} (unchanged by P0.2)`, async () => {
        const ctx = testEnv.authenticatedContext(UIDS.admin);
        await assertFails(ctx.firestore().doc(`${col}/${id}`).get());
      });

      it(`plain admin CANNOT update ${col} (unchanged by P0.2)`, async () => {
        const ctx = testEnv.authenticatedContext(UIDS.admin);
        await assertFails(ctx.firestore().doc(`${col}/${id}`).update(patch));
      });
    });
  });

  // ── A + B: department/executive collections (isExecutive() || inDept(X) || isSuperAdmin()) ──
  describe('A/B. Department/Executive collections (employeeRecords, legalCompliance, contractReviews, campaigns, support_tickets, system_changes)', () => {
    const docs = [
      ['employeeRecords', DOC_IDS.employeeRecord, { note: 'updated' }],
      ['legalCompliance', DOC_IDS.legalComplianceDoc, { title: 'updated' }],
      ['contractReviews', DOC_IDS.contractReview, { notes: 'updated' }],
      ['campaigns', CAMPAIGN_ID, { name: 'updated' }],
      ['support_tickets', SUPPORT_TICKET_ID, { subject: 'updated' }],
      ['system_changes', SYSTEM_CHANGE_ID, { summary: 'updated' }]
    ];

    docs.forEach(([col, id, patch]) => {
      it(`super_admin CAN read ${col}`, async () => {
        const ctx = testEnv.authenticatedContext(SUPER_ADMIN_UID);
        await assertSucceeds(ctx.firestore().doc(`${col}/${id}`).get());
      });

      it(`super_admin CAN update ${col}`, async () => {
        const ctx = testEnv.authenticatedContext(SUPER_ADMIN_UID);
        await assertSucceeds(ctx.firestore().doc(`${col}/${id}`).update(patch));
      });

      it(`plain admin CANNOT read ${col} (unchanged by P0.2 — isAdminOrStaff() never covered dept/executive gates)`, async () => {
        const ctx = testEnv.authenticatedContext(UIDS.admin);
        await assertFails(ctx.firestore().doc(`${col}/${id}`).get());
      });

      it(`plain admin CANNOT update ${col} (unchanged by P0.2)`, async () => {
        const ctx = testEnv.authenticatedContext(UIDS.admin);
        await assertFails(ctx.firestore().doc(`${col}/${id}`).update(patch));
      });
    });
  });

  // ── A + B: financeTransactions, bankAccounts (special cases) ──
  describe('A/B. financeTransactions', () => {
    it('super_admin CAN read financeTransactions', async () => {
      const ctx = testEnv.authenticatedContext(SUPER_ADMIN_UID);
      await assertSucceeds(ctx.firestore().doc(`financeTransactions/${DOC_IDS.financeTxnWithin}`).get());
    });

    it('super_admin CAN update financeTransactions', async () => {
      const ctx = testEnv.authenticatedContext(SUPER_ADMIN_UID);
      await assertSucceeds(ctx.firestore().doc(`financeTransactions/${DOC_IDS.financeTxnWithin}`).update({ description: 'updated' }));
    });

    it('super_admin CAN create a financeTransactions doc ABOVE the Finance-dept cap (uncapped branch, not the capped accountant branch)', async () => {
      const ctx = testEnv.authenticatedContext(SUPER_ADMIN_UID);
      await assertSucceeds(
        ctx.firestore().collection('financeTransactions').add(standardFields({
          id: 'p02_super_admin_finance_txn', amount: 999999999, description: 'Uncapped Super Admin txn',
          createdBy: SUPER_ADMIN_UID, updatedBy: SUPER_ADMIN_UID
        }))
      );
    });

    it('plain admin CANNOT read financeTransactions (unchanged by P0.2)', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.admin);
      await assertFails(ctx.firestore().doc(`financeTransactions/${DOC_IDS.financeTxnWithin}`).get());
    });

    it('plain admin CANNOT update financeTransactions (unchanged by P0.2)', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.admin);
      await assertFails(ctx.firestore().doc(`financeTransactions/${DOC_IDS.financeTxnWithin}`).update({ description: 'x' }));
    });
  });

  describe('A/B/I. bankAccounts (read/create/update gain isSuperAdmin(); delete deliberately does NOT)', () => {
    it('super_admin CAN read bankAccounts', async () => {
      const ctx = testEnv.authenticatedContext(SUPER_ADMIN_UID);
      await assertSucceeds(ctx.firestore().doc(`bankAccounts/${DOC_IDS.bankAccount}`).get());
    });

    it('super_admin CAN update bankAccounts', async () => {
      const ctx = testEnv.authenticatedContext(SUPER_ADMIN_UID);
      await assertSucceeds(ctx.firestore().doc(`bankAccounts/${DOC_IDS.bankAccount}`).update({ bankName: 'Updated Bank' }));
    });

    it('super_admin CAN create a bankAccounts doc', async () => {
      const ctx = testEnv.authenticatedContext(SUPER_ADMIN_UID);
      await assertSucceeds(
        ctx.firestore().collection('bankAccounts').add(standardFields({
          id: 'p02_super_admin_bank_account', bankName: 'New Bank', accountNumber: '999999',
          createdBy: SUPER_ADMIN_UID, updatedBy: SUPER_ADMIN_UID
        }))
      );
    });

    it('I. super_admin CANNOT delete a bankAccounts doc — P0.2 grants no new hard-delete path', async () => {
      const ctx = testEnv.authenticatedContext(SUPER_ADMIN_UID);
      await assertFails(ctx.firestore().doc(`bankAccounts/${DOC_IDS.bankAccount}`).delete());
    });

    it('I. CEO retains its pre-existing bankAccounts delete authority (regression check — delete branch untouched by P0.2)', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.ceo);
      await assertSucceeds(ctx.firestore().doc(`bankAccounts/${DOC_IDS.bankAccount}`).delete());
    });

    it('plain admin CANNOT read bankAccounts (unchanged by P0.2)', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.admin);
      await assertFails(ctx.firestore().doc(`bankAccounts/${DOC_IDS.bankAccount}`).get());
    });

    it('plain admin CANNOT update bankAccounts (unchanged by P0.2)', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.admin);
      await assertFails(ctx.firestore().doc(`bankAccounts/${DOC_IDS.bankAccount}`).update({ bankName: 'x' }));
    });

    it('plain admin CANNOT delete bankAccounts (unaffected by P0.2, was already denied)', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.admin);
      await assertFails(ctx.firestore().doc(`bankAccounts/${DOC_IDS.bankAccount}`).delete());
    });
  });

  // ── A + B: strategyDocuments, majorContracts (read unchanged; create/update gain isSuperAdmin()) ──
  describe('A/B. strategyDocuments, majorContracts — read unchanged, write gains Super Admin', () => {
    it('super_admin CAN read strategyDocuments (already covered pre-P0.2 via isAdminOrStaff())', async () => {
      const ctx = testEnv.authenticatedContext(SUPER_ADMIN_UID);
      await assertSucceeds(ctx.firestore().doc(`strategyDocuments/${DOC_IDS.strategyDoc}`).get());
    });

    it('super_admin CAN update strategyDocuments (new in P0.2)', async () => {
      const ctx = testEnv.authenticatedContext(SUPER_ADMIN_UID);
      await assertSucceeds(ctx.firestore().doc(`strategyDocuments/${DOC_IDS.strategyDoc}`).update({ title: 'updated' }));
    });

    it('super_admin CAN update majorContracts (new in P0.2)', async () => {
      const ctx = testEnv.authenticatedContext(SUPER_ADMIN_UID);
      await assertSucceeds(ctx.firestore().doc(`majorContracts/${DOC_IDS.majorContract}`).update({ value: 25000000 }));
    });

    it('plain admin CAN still read strategyDocuments (unaffected — was already true via isAdminOrStaff())', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.admin);
      await assertSucceeds(ctx.firestore().doc(`strategyDocuments/${DOC_IDS.strategyDoc}`).get());
    });

    it('plain admin CANNOT update strategyDocuments (was already denied pre-P0.2, remains denied — only CEO/Super Admin write)', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.admin);
      await assertFails(ctx.firestore().doc(`strategyDocuments/${DOC_IDS.strategyDoc}`).update({ title: 'x' }));
    });

    it('plain admin CANNOT update majorContracts (was already denied pre-P0.2, remains denied)', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.admin);
      await assertFails(ctx.firestore().doc(`majorContracts/${DOC_IDS.majorContract}`).update({ value: 1 }));
    });
  });

  // ── A + B: budgetRequests decision authority ──
  describe('A/B. budgetRequests — decision authority', () => {
    it('super_admin CAN approve a budgetRequest above the Director\'s cap (uncapped, like CEO)', async () => {
      const ctx = testEnv.authenticatedContext(SUPER_ADMIN_UID);
      await assertSucceeds(
        ctx.firestore().doc(`budgetRequests/${DOC_IDS.budgetRequestAboveLimit}`).update({ status: 'approved' })
      );
    });

    it('plain admin CANNOT approve a budgetRequest (was already denied pre-P0.2 — only CEO/Director/now Super Admin decide)', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.admin);
      await assertFails(
        ctx.firestore().doc(`budgetRequests/${DOC_IDS.budgetRequestAboveLimit}`).update({ status: 'approved' })
      );
    });
  });

  // ── A + B: sales_targets — read unchanged, create/update gains Super Admin ──
  describe('A/B. sales_targets — read unchanged, write gains Super Admin', () => {
    it('super_admin CAN read sales_targets (already covered pre-P0.2 via isInternalTeam())', async () => {
      const ctx = testEnv.authenticatedContext(SUPER_ADMIN_UID);
      await assertSucceeds(ctx.firestore().doc(`sales_targets/${SALES_TARGET_ID}`).get());
    });

    it('super_admin CAN update sales_targets (new in P0.2)', async () => {
      const ctx = testEnv.authenticatedContext(SUPER_ADMIN_UID);
      await assertSucceeds(ctx.firestore().doc(`sales_targets/${SALES_TARGET_ID}`).update({ target: 200000000 }));
    });

    it('plain admin CAN still read sales_targets (unaffected — was already true via isInternalTeam())', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.admin);
      await assertSucceeds(ctx.firestore().doc(`sales_targets/${SALES_TARGET_ID}`).get());
    });

    it('plain admin CANNOT update sales_targets (was already denied pre-P0.2, remains denied)', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.admin);
      await assertFails(ctx.firestore().doc(`sales_targets/${SALES_TARGET_ID}`).update({ target: 1 }));
    });
  });

  // ── C. Tier A regression — plain admin retains representative existing authority ──
  describe('C. Tier A regression (plain admin authority untouched by P0.2)', () => {
    it('admin CAN still approve a property (isAdmin() itself was never modified)', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.admin);
      await assertSucceeds(ctx.firestore().doc(`properties/${DOC_IDS.property}`).update({ status: 'approved' }));
    });

    it('admin CAN still manage a commission (hasPerm() short-circuit via isAdmin() untouched)', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.admin);
      await assertSucceeds(ctx.firestore().doc(`commissions/${DOC_IDS.commission}`).update({ status: 'approved' }));
    });

    it('admin CAN still change another user\'s role (users/{uid} update rule untouched)', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.admin);
      await assertSucceeds(ctx.firestore().doc(`users/${UIDS.agentA}`).update({ role: 'agent' }));
    });

    it('super_admin ALSO retains full Tier A authority (isAdmin() already included super_admin before P0.2 — pure regression check)', async () => {
      const ctx = testEnv.authenticatedContext(SUPER_ADMIN_UID);
      await assertSucceeds(ctx.firestore().doc(`properties/${DOC_IDS.property}`).update({ status: 'approved' }));
    });
  });

  // ── D. CEO regression ──
  describe('D. CEO regression (isCEO() itself untouched)', () => {
    it('CEO CAN still write shareStructure (pre-existing authority, unaffected by the added OR clause)', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.ceo);
      await assertSucceeds(ctx.firestore().doc(`shareStructure/${DOC_IDS.shareStructure}`).update({ updatedBy: UIDS.ceo }));
    });

    it('CEO CAN still approve a budgetRequest above the Director\'s cap', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.ceo);
      await assertSucceeds(
        ctx.firestore().doc(`budgetRequests/${DOC_IDS.budgetRequestAboveLimit}`).update({ status: 'approved' })
      );
    });
  });

  // ── E. Director regression ──
  describe('E. Director regression (isDirector() itself untouched)', () => {
    it('Director CAN still manage dailyOperations', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.director);
      await assertSucceeds(ctx.firestore().doc(`dailyOperations/${DOC_IDS.dailyOp}`).update({ note: 'still works' }));
    });

    it('Director CANNOT approve a budgetRequest above their own cap (still true post-P0.2)', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.director);
      await assertFails(
        ctx.firestore().doc(`budgetRequests/${DOC_IDS.budgetRequestAboveLimit}`).update({ status: 'approved' })
      );
    });

    it('Director still CANNOT write to CEO-only shareStructure', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.director);
      await assertFails(ctx.firestore().doc(`shareStructure/${DOC_IDS.shareStructure}`).update({ updatedBy: UIDS.director }));
    });
  });

  // ── F. Executive regression ──
  describe('F. Executive regression (isExecutive() itself untouched)', () => {
    it('CEO (Executive) CAN still update financeTransactions uncapped', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.ceo);
      await assertSucceeds(ctx.firestore().doc(`financeTransactions/${DOC_IDS.financeTxnWithin}`).update({ description: 'updated' }));
    });

    it('Director (Executive) CAN still read bankAccounts', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.director);
      await assertSucceeds(ctx.firestore().doc(`bankAccounts/${DOC_IDS.bankAccount}`).get());
    });
  });

  // ── G. Department roles unchanged ──
  describe('G. Department-specific authorization unchanged', () => {
    it('HR manager CAN still read employeeRecords (inDept(\'HR\') untouched)', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.hr);
      await assertSucceeds(ctx.firestore().doc(`employeeRecords/${DOC_IDS.employeeRecord}`).get());
    });

    it('Legal Adviser CAN still read legalCompliance (inDept(\'Legal\') untouched)', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.legalAdviser);
      await assertSucceeds(ctx.firestore().doc(`legalCompliance/${DOC_IDS.legalComplianceDoc}`).get());
    });

    it('Chief Broker CAN still update sales_targets (inDept(\'Brokerage\') untouched)', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.chiefBroker);
      await assertSucceeds(ctx.firestore().doc(`sales_targets/${SALES_TARGET_ID}`).update({ target: 150000000 }));
    });

    it('Marketing Manager CAN still update campaigns (inDept(\'Marketing\') untouched)', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.marketing);
      await assertSucceeds(ctx.firestore().doc(`campaigns/${CAMPAIGN_ID}`).update({ name: 'updated' }));
    });

    it('Customer Support Manager CAN still update support_tickets (inDept(\'CustomerSupport\') untouched)', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.csManager);
      await assertSucceeds(ctx.firestore().doc(`support_tickets/${SUPPORT_TICKET_ID}`).update({ subject: 'updated' }));
    });

    it('IT Manager CAN still update system_changes (inDept(\'IT\') untouched)', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.itManager);
      await assertSucceeds(ctx.firestore().doc(`system_changes/${SYSTEM_CHANGE_ID}`).update({ summary: 'updated' }));
    });

    it('Director of Finance CAN still create a financeTransactions doc within their own cap', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.finance);
      await assertSucceeds(
        ctx.firestore().collection('financeTransactions').add(standardFields({
          id: 'p02_finance_within_cap_txn', amount: 100, description: 'Within cap',
          createdBy: UIDS.finance, updatedBy: UIDS.finance
        }))
      );
    });
  });

  // ── H. Role casing — verified from code, not assumed ──
  describe('H. Role casing normalization', () => {
    it('role:\'Admin\' (capitalized) behaves exactly like role:\'admin\' for Tier A (properties approve)', async () => {
      const ctx = testEnv.authenticatedContext(ADMIN_CAP_UID);
      await assertSucceeds(ctx.firestore().doc(`properties/${DOC_IDS.property}`).update({ status: 'approved' }));
    });

    it('role:\'Admin\' (capitalized) is STILL denied Tier B (shareStructure) — casing does not grant Super Admin', async () => {
      const ctx = testEnv.authenticatedContext(ADMIN_CAP_UID);
      await assertFails(ctx.firestore().doc(`shareStructure/${DOC_IDS.shareStructure}`).update({ updatedBy: ADMIN_CAP_UID }));
    });

    it('role:\'Super_Admin\' (mixed case) behaves like role:\'super_admin\' for Tier B (shareStructure)', async () => {
      const ctx = testEnv.authenticatedContext(SUPER_ADMIN_MIXED_UID);
      await assertSucceeds(ctx.firestore().doc(`shareStructure/${DOC_IDS.shareStructure}`).update({ updatedBy: SUPER_ADMIN_MIXED_UID }));
    });

    it('role:\'SUPER_ADMIN\' (all caps) behaves like role:\'super_admin\' for Tier B (shareStructure)', async () => {
      const ctx = testEnv.authenticatedContext(SUPER_ADMIN_UPPER_UID);
      await assertSucceeds(ctx.firestore().doc(`shareStructure/${DOC_IDS.shareStructure}`).update({ updatedBy: SUPER_ADMIN_UPPER_UID }));
    });

    it('role:\'Super_Admin\' (mixed case) also retains Tier A authority (isAdmin() already normalizes casing)', async () => {
      const ctx = testEnv.authenticatedContext(SUPER_ADMIN_MIXED_UID);
      await assertSucceeds(ctx.firestore().doc(`properties/${DOC_IDS.property}`).update({ status: 'approved' }));
    });

    it('plain lowercase role:\'admin\' never satisfies isSuperAdmin() under any comparison — denied bankAccounts read', async () => {
      const ctx = testEnv.authenticatedContext(UIDS.admin);
      await assertFails(ctx.firestore().doc(`bankAccounts/${DOC_IDS.bankAccount}`).get());
    });
  });
});
