#!/usr/bin/env node
// One-time seed for the Dynamic RBAC / Progressive Governance permission
// layer — writes role_permissions/{role} for every role in DEFAULT_MATRIX,
// matching rules/firestore.rules' hasPerm() and the final permission matrix
// agreed for this work.
//
// 'admin' and 'super_admin' are deliberately NOT seeded: their access is the
// unconditional hardcoded bypass in rules/firestore.rules' isAdmin(), never
// sourced from this collection (see hasPerm()'s own comment) — a doc for
// them here would be misleading, inert configuration.
//
// 'users.manage_roles' and 'audit.export' never appear in any role's array
// below — those two stay hardcoded to isAdmin()/isCEO() at their own call
// sites and are actively rejected by role_permissions' own create/update
// rule if anyone ever tries to write them (defense in depth, not just this
// script's own discipline).
//
// Usage:
//   GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json \
//     node scripts/seed-role-permissions.js --project=<firebase-project-id>
//
// Defaults to a dry run (prints the exact writes it would make). Pass
// --apply to actually perform them. Safe to re-run: uses set() with the
// role's full intended array each time (idempotent), and never touches any
// field this app doesn't own on that doc.

const admin = require('firebase-admin');

const DEFAULT_MATRIX = {
  ceo: [
    'properties.view', 'properties.approve', 'properties.reject', 'properties.change_status',
    'sites.view', 'sites.approve',
    'plots.view', 'plots.change_status', 'plots.mark_sold',
    'agents.view', 'agents.verify', 'agents.suspend',
    'leads.view', 'leads.assign',
    'commissions.view', 'commissions.manage'
  ],
  director: [
    'properties.view', 'properties.approve', 'properties.change_status',
    'sites.view', 'sites.approve',
    'plots.view', 'plots.change_status', 'plots.mark_sold',
    'agents.view',
    'leads.view', 'leads.assign',
    'commissions.view'
  ],
  operations: [
    'properties.view', 'properties.approve', 'properties.reject', 'properties.change_status',
    'sites.view', 'sites.approve',
    'plots.view', 'plots.change_status', 'plots.mark_sold',
    'agents.view', 'agents.verify',
    'leads.view', 'leads.assign',
    'commissions.view'
  ],
  chief_broker: [
    'properties.view', 'sites.view', 'plots.view',
    'agents.view', 'agents.verify',
    'leads.view', 'leads.assign',
    'commissions.view'
  ],
  accountant: [
    'properties.view', 'sites.view', 'plots.view',
    'commissions.view', 'commissions.manage'
  ],
  hr_manager: ['properties.view', 'sites.view', 'plots.view', 'agents.view'],
  it_manager: ['properties.view', 'sites.view', 'plots.view', 'agents.view'],
  legal_adviser: ['properties.view', 'sites.view', 'plots.view', 'agents.view'],
  marketing_manager: ['properties.view', 'sites.view', 'plots.view', 'agents.view'],
  customer_support_manager: ['properties.view', 'sites.view', 'plots.view', 'agents.view'],
  staff: ['properties.view', 'sites.view', 'plots.view', 'leads.view_assigned']
};

const RESERVED = ['users.manage_roles', 'audit.export', 'admin.bypass'];

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const projectArg = args.find(function (a) { return a.startsWith('--project='); });
const projectId = projectArg ? projectArg.split('=')[1] : undefined;

admin.initializeApp(projectId ? { projectId: projectId } : {});
const db = admin.firestore();

async function main() {
  console.log('KOMISIYONERI: seed role_permissions/{role}');
  console.log(apply ? 'Mode: APPLY (will write)' : 'Mode: DRY RUN (pass --apply to actually write)');
  console.log('');

  for (const role of Object.keys(DEFAULT_MATRIX)) {
    const perms = DEFAULT_MATRIX[role];
    const bad = perms.filter(function (p) { return RESERVED.indexOf(p) > -1; });
    if (bad.length) {
      console.error('REFUSING to seed role "' + role + '" — contains reserved permission(s): ' + bad.join(', '));
      process.exitCode = 1;
      continue;
    }
    console.log('role_permissions/' + role + ':');
    console.log('  permissions: ' + JSON.stringify(perms));
    if (apply) {
      await db.collection('role_permissions').doc(role).set({
        role: role,
        permissions: perms,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: 'system-migration:seed-role-permissions',
        updatedBy: 'system-migration:seed-role-permissions'
      }, { merge: true });
      console.log('  -> written');
    }
    console.log('');
  }

  if (!apply) {
    console.log('Dry run complete. Re-run with --apply to write the roles above.');
  } else {
    console.log('Done.');
  }
}

main().catch(function (e) {
  console.error(e);
  process.exitCode = 1;
});
