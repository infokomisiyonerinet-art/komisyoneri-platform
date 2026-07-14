# K-REOS Data-Flow Map

Full inventory of every form, dashboard, pipeline, and Firestore collection in
`index.html` (~35,100 lines) + `functions/index.js`, produced as Phase 1 of the
end-to-end data-flow audit. All line numbers refer to `index.html` unless
marked `functions/index.js` or `rules/firestore.rules`.

This map is descriptive (what the code actually does today), not prescriptive.
Bugs found during the audit are called out inline under **BUG** and
consolidated in the [Critical Bugs Found](#critical-bugs-found) section at
the top for triage.

---

## Critical Bugs Found

Ranked roughly by severity / blast radius. Each is detailed in its module
section below with exact line numbers.

| # | Bug | Impact |
|---|---|---|
| 1 | `submitTask` (23791-23812) never sets `id` on the create payload | **Every "Create Task" submission in Office → Tasks fails with `permission-denied`** (firestore.rules' `hasStandardFields()` requires the `id` key to exist). The onboarding/offboarding checklist generator (`createChecklistTasks`) is unaffected — it sets `id` correctly. |
| 2 | `changeUserRole` (22640) writes `status: undefined` for any role change except to `'agent'` | Compat Firestore SDK throws synchronously on `update()` with an `undefined` field value. **Every org-chart role reassignment to a governance role (director, hr_manager, accountant, chief_broker, etc.) fails** — department/jobTitle/reportsTo never get re-derived. |
| 3 | `populateAssignPartnerSelect`/`populateAfterSalePartnerSelect`/`populateAssignBankSelect` (27018, 24686, 25282) filter `partners.where('status','==','verified')` | No partner document is ever written with `status:'verified'` — `verifyPartner()` sets `status:'active'`. **All three "Assign Partner" dropdowns are permanently empty**, even after an admin verifies a partner. |
| 4 | `populateAssignBankSelect` (25282) additionally filters `.where('type','==','bank')` | Every partner writer uses the field name `partnerType`, never `type`. Doubly broken on top of #3. |
| 5 | No composite indexes exist for the `reports` collection in `firestore.indexes.json` | `loadMyReportsWidget` and `loadExecReportsReceived` both require composite indexes Firestore doesn't have — **both "Reports Received"/"My Reports" widgets almost certainly hit `failed-precondition` in production.** |
| 6 | `dealType` detection in `convertLeadToDeal` (33613) and `_convertLeadToDealData` (34549) does exact-match against plain strings (`'gukodesha'`/`'Gukodesha'`) that never appear — the real field holds emoji-prefixed dropdown text | **Every rental deal converted from a CRM lead is silently miscategorized as `dealType:'sale'`**, undercharging commission (0.04 instead of 0.0833). |
| 7 | Server `COMMISSION_RATES.rental.default` is `null` (functions/index.js) | Even if #6 were fixed, `calcCommissionAmount()`'s `rate = rates.default \|\| 0.04` falls back to the **sale rate for every rental deal**, server-side, regardless of what the client wrote. Documented as a known, deliberately-unfixed quirk in the file's own header comment. |
| 8 | Legacy `markDealSold`/`markDealActive`/`renderAdminDeals` (17930, 17995, 18008) operate on `localStorage['km_leads']` + Realtime Database `leads/{id}`, never Firestore | An admin using this button changes a `status` value **no Firestore-based dashboard, Kanban board, or Cloud Function (`onDealClosedWon`) will ever see** — no commission, no invoice, no audit log. |
| 9 | `createManualCommission` (27939) writes `agentId: currentUser.uid` (the staff member creating the entry), not the named agent | **The actual agent named in the free-text field never sees a manually-entered commission** in their own Commissions tab, wallet, or payout eligibility — it's silently attributed to the wrong person. |
| 10 | `convertLeadToDeal` (33655-33679) creates a `commissions` doc at `pipelineStage:'contract'`, then `onDealClosedWon` creates a **second** one (deterministic id) when the same deal reaches `closed_won` | **Double-counted commission for every deal that originated from a CRM lead conversion** — inflates the Exec revenue KPI, agent wallet, and payout-eligible totals. |
| 11 | `onApprovalDecided` (functions/index.js:1093-1109) hardcodes `actorRole !== 'ceo'`, reverting the decision otherwise; the "Decide" UI is also gated to literal `'ceo'` only | `routedTo`-based Director co-approval is **rules-permitted (firestore.rules) but functionally dead** — contradicts the code's own comments claiming either listed superior can decide. A Director-initiated action can never actually be approved by a Director. |
| 12 | No dashboard in HR/Staff/Ops (`users`, `leaves`, `attendance`, `tasks`, `departments`, `branches`, `staff_reviews`, `job_postings`, `job_applications`) uses `.onSnapshot()` | Entire HR/Ops module is **not real-time** — an employee's leave approval, a new hire's pending→active flip, a task update, etc. all require a manual page reload to see. |
| 13 | `loadVerifications`/`loadDocuments`/`loadClients`/`loadPartnerDashboard` and most Exec/Accounting/BI reads use `.get()` | Same as #12 but across Finance/Verification/Partner/Exec modules — real-time is the exception (`invoices`, `commissions`, `payroll`, `messages`, a couple of `leads` listeners), not the rule, contrary to the platform's "live dashboard" goal. |
| 14 | Revenue-recognition mismatch: `loadExecKPIs` buckets by invoice `createdAt`, `loadAccountingStats` buckets the same invoices by `paidAt` | The Exec dashboard and Accounting can disagree about which month an invoice's revenue counts toward, for the same invoice. |
| 15 | `billedTo` holds a display name for receivable invoices but a raw Firestore UID for payable (partner/referral payout) invoices | Accounting's invoice list renders `inv.billedTo` verbatim — **partner/referral payout invoices show a raw UID instead of a person's name.** |
| 16 | `generatePartnerPayoutInvoice` (25899) silently no-ops when `quotedPrice` is 0 (an optional field in the assignment modal) | A completed job with no price set produces **no payout invoice and no error/toast** — looks like a successful report submission but silently drops the accounting side-effect. |
| 17 | `logAudit` (28900) and `calculatePlotCommission`'s commission write (30614) set `id:''` at creation and never patch it back, unlike every other writer in the codebase | `auditlogs` and plot-sale `commissions` docs permanently have an empty `id` field. |
| 18 | `decideApproval` (20573) writes `decidedAt` as a client `.toISOString()` string, while `requestApproval` (20558) writes `createdAt` as a server `Timestamp` in the same document | Any reader calling `.toDate()` on `decidedAt` (the codebase's normal pattern) will throw/produce `undefined` for a decided approval. |
| 19 | `approvedBy` holds a **display name** in `commissions` but a **Firestore UID** in `expenses` | Any shared "who approved this" rendering needs per-collection special-casing. |
| 20 | `submitReview` (14609, property reviews) writes only to `localStorage['km_reviews']`, never Firestore | Property reviews are invisible cross-device/cross-user and have no security rule — a structurally weaker, disconnected system sitting next to the real `reviews` collection used for partner ratings. |

---

## Module: CRM / Leads / Deals / Viewings / Offers / Clients

### Forms

| Function (line) | Collection(s) written | Key fields | 7 standard fields? |
|---|---|---|---|
| `submitBooking` (14194) | `viewings` `.add()` | propertyId, clientId, agentId, scheduledAt, status:'scheduled' | Yes |
| same fn, auto-lead (14246) | `leads` `.add()` | clientId, propertyId, agentId, source:'Platform Booking', pipelineStage:'viewing_scheduled' | Yes |
| `submitMessage` (14327) | `leads` `.add()` | clientId, propertyId, agentId, source:'Platform Message', pipelineStage:'contacted' | Yes |
| `submitLead` (15629) | `leads` `.add()` | clientId, agentId, action (emoji-prefixed text), zone, district, budgetMin/Max, pipelineStage:'new' | Yes |
| `scheduleViewing` (32680) | `viewings` `.add()` | leadId, propertyId, clientId, agentId, scheduledAt, status:'scheduled' | Yes |
| `submitViewingReport` (28818/28830) | `viewings` + `leads` `.update()` | viewings: status:'completed', report{}; leads: pipelineStage:'viewing_completed' | update-only |
| `saveAgentLead` (34419) | `leads` `.add()` | clientName/Phone/Email, agentId, action, district, pipelineStage:'new' | Yes |
| `updateLeadStage`/`advanceLeadStage` (29271/29292) | `leads` `.update()` | pipelineStage, status | update-only |
| `closeLeadWon`/`closeLeadLost` (34465/34512) | `leads` `.update()` | pipelineStage:'closed_won'/'closed_lost', closedAt | update-only |
| `addContactLog` (29390) | `leads` `.update()` | contactLog: arrayUnion | update-only |
| `saveLeadFollowUp` (29433) | `leads` `.update()` | nextFollowUp | update-only |
| `convertLeadToDeal` (33625) | `deals` `.add()` + `commissions` `.add()` (33655) | leadId, dealType (**BUG #6**), agreedPrice, commissionRate, pipelineStage:'contract' | Yes |
| `createNewDeal` (28562) | `deals` `.add()`, `leads.doc().update({dealId})` | leadId, dealType, agreedPrice, pipelineStage:'new' | Yes |
| `submitOffer` (28692/28713) | `deals` (create-if-missing) + `offers` `.add()` | dealType:'rent' (**BUG #6 casing**), pipelineStage:'negotiation'; offer: fromUserId, toUserId, amount, status:'pending' | Yes |
| `submitCounterOffer` (28472) | `offers` `.add()` + `deals` `.update()` | fromRole:'agent', counterTo, pipelineStage:'negotiation' | Yes |
| `acceptOffer` (28327/28331, batch) | `offers` + `deals` `.update()` | offer status:'accepted'; deal pipelineStage:'contract', agreedPrice:offer.amount | update-only |
| `rejectOffer` (28364) | `offers` `.update()` | status:'rejected' | update-only |
| `advanceDealStage` (28410) | `deals` `.update()` | pipelineStage, status | update-only |
| `closeDealWon`/`closeDealLost` (34760/34803) | `deals` `.update()` | pipelineStage:'closed_won'/'closed_lost' | update-only |
| **BUG #8** `markDealSold`/`markDealActive` (17995/18008) | **localStorage `km_leads` + RTDB `leads/{id}`, NOT Firestore** | status:'Closed'/'Active' | N/A — bypasses Firestore entirely |

Clients directory has **no dedicated form** — fully derived from `leads` at read time, deduplicated by `clientPhone` (fallback `clientId`/`clientName`).

### Dashboards / Read Views

| Function (line) | Collection / query | get()/onSnapshot() | Role scoping |
|---|---|---|---|
| `loadCRM` (28950) | `leads` isActive[+agentId] orderBy createdAt | `.get()` | admin sees all, agent sees own |
| `loadDeals` (28023) | `deals` isActive[+agentId] orderBy createdAt | **`.onSnapshot()`** | Yes |
| `_attachFsLeadListener` (18728) | `leads` agentId or isActive (admin) | **`.onSnapshot()`** | Yes |
| `renderDealKanban`/`renderCrmKanban` (29759/29835) | in-memory `_deals`/`_crmLeads`, no direct query | n/a | n/a |
| `loadClients` (33172) | `leads` isActive[+agentId] orderBy createdAt, limit 500 | `.get()` | Yes |
| `loadViewings` (32906) | `viewings` isActive[+agentId] orderBy scheduledAt | `.get()` | Yes |
| `loadCustDeals`/`loadCustViewings` (24330/24356) | `deals`/`viewings` clientId==uid | `.get()` | client self-scoped |
| `_loadDealOffers` (28273/28297) | `offers` dealId== (+fromUserId/toUserId for non-staff) | `.get()` | Yes |
| `loadAgentDashboard` KPIs (31001-31300) | `properties`/`leads`/`deals`/`viewings`, agent vs company-wide branch | `.get()` | Yes |
| BI/Exec pipeline & funnel widgets (19928-20990) | `leads`/`deals` company-wide | `.get()` | No (exec-only page) |
| **BUG #8** `renderAdminDeals` (17930) | **RTDB `.ref('leads').once('value')`, NOT Firestore** | one-time `.once()` | No |

### The 13-Stage CRM Pipeline

Defined at `CRM_STAGES` (28883), duplicated at `EXEC_CRM_STAGES` (20395, same
order) and at `DEAL_STAGE_LIST` (24288, **only 12 entries — omits
`closed_lost`**).

| # | Stage key | Trigger |
|---|---|---|
| 1 | `new` | `submitLead`, `saveAgentLead`, `createNewDeal` |
| 2 | `contacted` | `submitMessage` auto-lead |
| 3 | `qualified` | Manual kanban/detail-panel advance only — no dedicated "qualify" action |
| 4 | `viewing_scheduled` | Booking auto-lead; also `updateLeadStage` intercepted to auto-open scheduler |
| 5 | `viewing_completed` | `submitViewingReport` |
| 6 | `offer_submitted` | Manual advance only — **`submitOffer` does not set this on the lead** (BUG-adjacent, see #8 in Broken Links) |
| 7 | `negotiation` | `submitOffer`, `submitCounterOffer` |
| 8 | `due_diligence` | Manual advance only |
| 9 | `financing` | Manual advance only |
| 10 | `contract` | `acceptOffer`, `convertLeadToDeal` |
| 11 | `closing` | Manual advance only |
| 12 | `closed_won` | `closeDealWon`/`closeLeadWon`, gated to `isAdminOrStaff()` |
| 13 | `closed_lost` | `closeDealLost`/`closeLeadLost` |

**Server side:** `onDealClosedWon` (functions/index.js:138) fires purely on
`pipelineStage` transitioning into `closed_won`, idempotent via deterministic
doc IDs (`deal_<id>_commission`, `deal_<id>_invoice`). Does not touch `leads`
at all — a lead's own `closed_won` (via `closeLeadWon`) has no server-side
counterpart and generates no commission unless a `deals` doc is separately
closed (see Broken Links #7 below).

---

## Module: Finance — Commissions / Invoices / Expenses / Payroll / Payout Requests / Subscriptions

### Forms

| Function (line) | Collection(s) | Key fields | 7 fields? |
|---|---|---|---|
| `onDealClosedWon` (functions/index.js:138) | `commissions` + `invoices` | 60/40 split (COMM_AGENT_SPLIT/COMPANY_SPLIT), status:'pending'/'sent' | Yes |
| `createManualCommission` (27910) | `commissions` | **BUG #9**: agentId = staff uid, not named agent | Yes |
| `convertLeadToDeal` nested add (27655) | `commissions` | **BUG #10**: duplicates `onDealClosedWon`'s later write | Yes |
| `calculatePlotCommission` (30598) | `commissions` | dealType:'plot_sale'; **id never backfilled**, several fields missing | Partial |
| `submitCommissionDecision`/`markCommissionPaid` (27725/27781) | `commissions` `.update()` | status, approvedBy (**name, not uid** — BUG #19-adjacent), paidAt | update-only |
| `submitInvoice`/`updateInvStatus`/`submitInvoiceRefund` (21274/21438/21468) | `invoices` | billedTo (name), status, refundAmount | Yes / update |
| `onSubscriptionActivated`/renewal (functions/index.js:736) | `invoices` | billedTo (agentName), type:'subscription' | Yes |
| `generatePartnerPayoutInvoice` (25894) | `invoices` | **billedTo = UID** (BUG #15), silently no-ops on quotedPrice:0 (BUG #16) | Yes |
| `generateReferralPayoutInvoice` (17412) | `invoices` | **billedTo = UID** (BUG #15) | Yes |
| `submitExpense`/`setExpenseApproval` (21585/21556) | `expenses` | approvedBy = **uid** (contrast w/ commissions' name — BUG #19) | Yes / update |
| `submitPayslip`/`markPayslipPaid` (23118/23219) | `payroll` | period, netSalary, status:'generated'/'paid' | Yes |
| `submitPayoutRequest` (27335) | `payout_requests` | agentId, commissionIds[], serverVerified:false | Yes |
| `onPayoutRequestCreated`/`onPayoutRequestApproved` (functions/index.js:857/902) | `payout_requests` + batch `commissions` update | serverVerified, then **commissions status:'paid'** on approval | — |
| `subscribeToPremium`/`cancelMySubscription` (27517/27562) | `subscriptions` (doc id = agentId) + `properties` batch | status:'active'/'cancelled', featuredPropertyIds | Yes |

### Dashboards / Read Views

| Function (line) | Query | get()/onSnapshot() | Scoping |
|---|---|---|---|
| `loadExecKPIs` (20444) | `invoices` status:'paid'+createdAt>=monthStart; `commissions` isActive+createdAt>=monthStart | `.get()` | none (exec-gated page) |
| `loadInvoices` (21149) | `invoices` isActive orderBy createdAt limit 100 | **`.onSnapshot()`** | **None** — Accounting sees everyone's invoices |
| `loadExpenses`/`loadAccountingStats` (21495/21099) | `expenses` isActive | `.get()` | none |
| `loadPayroll` (23002) | `payroll` period+isActive [+userId for non-admin] | **`.onSnapshot()`** | Yes |
| `loadCommissions` (27229) | `commissions` isActive [+agentId for non-admin] | **`.onSnapshot()`** | Yes |
| `loadMyPayoutRequests`/`loadPayoutRequestsAdmin` (27363/27395) | `payout_requests` agentId== / status:'pending' | `.get()` / **`.onSnapshot()`** | Yes |
| `loadSubscriptionPage` (27496) | `subscriptions.doc(uid)` | `.get()` | self |
| `loadReports` (Accounting, 21611) | `invoices` status in [paid,refunded]; `expenses` | `.get()` | none |

### Commission Pipeline End-to-End

```
deals.pipelineStage → 'closed_won'  (advanceDealStage / closeDealWon — money math intentionally NOT done client-side)
        ↓
onDealClosedWon (functions/index.js:138)
  re-verifies role server-side → total = calcCommissionAmount(dealType, dealValue)
  → agentShare = round(total*0.60), companyShare = round(total*0.40)
  → commissions/deal_<id>_commission  {status:'pending'}      ← idempotent (ALREADY_EXISTS caught)
  → invoices/deal_<id>_invoice        {status:'sent'}          ← only if dealValue > 0
  → auto-qualifies matching referrals doc
        ↓
Agent's Commissions tab (loadCommissions, onSnapshot, agentId==uid)      → updates live
Accounting invoice list (loadInvoices, onSnapshot, no filter)            → updates live
Exec revenue KPI (loadExecKPIs, invoices status=='paid' only)           → does NOT count until Accounting marks the invoice paid
Exec commission KPI (loadExecKPIs, commissions any status, this month)  → counts immediately, even while still 'pending'
                                                                            (different recognition rule from the tile next to it)
```

**BUG #7**: server `COMMISSION_RATES.rental.default = null` → `rate = rates.default || 0.04` silently uses the **sale** rate for
every rental deal regardless of `dealType`/`commissionRate` written client-side. Documented as a known quirk in
`functions/index.js`'s own header comment.

### Payout Request Workflow (confirmed working end-to-end)

```
submitPayoutRequest → payout_requests {status:'pending', serverVerified:false}
  ↓
onPayoutRequestCreated (functions/index.js:857) — re-verifies each commission is unclaimed, agentId matches, status=='approved',
  recomputed total == submitted amount → serverVerified:true (or status:'rejected' + notifyUser)
  ↓
loadPayoutRequestsAdmin only shows "Approve & Pay" once serverVerified is true
  ↓
approvePayoutRequest → payout_requests {status:'approved'} — does NOT touch commissions itself (moved server-side deliberately)
  ↓
onPayoutRequestApproved (functions/index.js:902) — RE-VERIFIES a second time (catches concurrent claims), then batch-updates
  every referenced commissions/{id} → {status:'paid', paidAt}
```

This is the one place a payout request's approval actually flips the source
commission's status — confirmed correct, no client-side direct write of
`commissions.status` exists in this path.

---

## Module: Documents / Verification (Services) / Partners / Reviews

### Forms

| Function (line) | Collection(s) | Key fields | 7 fields? |
|---|---|---|---|
| `submitDocumentUpload` (26283) | `documents` | type, clientId, agentId, accessRoles[], status:'draft'/'pending_signature' | Yes |
| `confirmSignature`/`archiveDocument` (26478/26549) | `documents` `.update()` | signatories[], signed, status:'signed'/'archived' | update-only |
| `submitVerificationRequest` (26862) | `services` | serviceType, requestedBy, assignedToId:'', status:'pending' | Yes |
| `assignServicePartner` (27041) | `services` `.update()` | assignedTo (name), **assignedToId (real uid)**, partnerId, status:'assigned' | update-only |
| `updateServiceStatus`/`saveReportUrl`/`submitPartnerJobReport` (27105/27143/25871) | `services` `.update()` | status, reportUrl | update-only |
| `generatePartnerPayoutInvoice` (25894, auto-called from submitPartnerJobReport) | `invoices` | **BUG #16**: no-ops if quotedPrice:0 | Yes |
| `submitPartnerRegister` (25489) | `partners` | companyName, **partnerType**, districts[], verified:false, status:'pending' | Yes |
| `verifyPartner`/`rejectPartner` (25686/25701) | `partners` `.update()` | verified:true + **status:'active'** (not 'verified' — BUG #3) / status:'rejected' | update-only |
| `submitPartnerRating` (25622, batch) | `reviews` + `partners` + `services` | rating, comment, avgRating, reviewCount | Yes (reviews doc) |
| **BUG #20** `submitReview` (14609, property reviews) | **localStorage `km_reviews` only** | id (client string), rating, text | No |
| `assignAfterSalePartner`/`assignLoanBank` (24702/25297) | `services` `.update()` | assignedTo/assignedToId, assignedBank/assignedBankId | update-only |

### Dashboards / Read Views

| Function (line) | Query | get()/onSnapshot() | Scoping |
|---|---|---|---|
| `loadDocuments` (26147) | `documents` isActive [+agentId or +clientId], client-side accessRoles filter | `.get()` | Yes |
| `loadVerifications` (26747) | `services` isActive [+requestedBy for non-admin] | `.get()` | Yes |
| `loadPartners` (25383) | `partners` isActive orderBy createdAt | `.get()` | login-required only, no further scoping |
| `loadPartnerDashboard`/`loadPartnerDashboardStats`/`loadMyPartnerJobs` (25741/25793/25832) | `partners.userId==`, `services.assignedToId==`, `invoices.billedTo==` | `.get()` ×all | self (uid) |
| `loadPartnerReviews` (25580) | `reviews.partnerId==` | `.get()` | public |
| **BUG #3** `populateAssignPartnerSelect`/`populateAfterSalePartnerSelect` (27014/24682) | `partners.status=='verified'` | `.get()` | admin UI — **always empty, see Bug #3** |
| **BUG #3+#4** `populateAssignBankSelect` (25278) | `partners.status=='verified'.type=='bank'` | `.get()` | admin UI — **doubly broken** |

### Verification Pipeline (confirmed correct except one bug)

```
submitVerificationRequest → services {status:'pending', assignedToId:''}
  ↓
assignServicePartner → services.update({assignedTo:name, assignedToId:realUid, partnerId, status:'assigned'})   ✓ correct
  ↓
loadPartnerDashboard → loadMyPartnerJobs (services.assignedToId==uid)                                            ✓ reads correctly
  ↓
submitPartnerJobReport → services.update({reportUrl, status:'completed'})                                        ✓ fires
  ↓
generatePartnerPayoutInvoice → invoices.add({billedTo:assignedToId, status:'draft'})                             ⚠ BUG #16 on quotedPrice:0
```

The `assignedTo` (name) vs `assignedToId` (real uid) split — historically a
known trap in this codebase — is **correctly resolved** in every current call
site checked (`assignServicePartner`, `assignAfterSalePartner`,
`assignLoanBank`).

**Not real-time**: `loadVerifications` is `.get()`-only. A requester watching
their own Verification tab while staff assigns/updates their request will not
see the change without a manual reload — the only "push" is a separate
`notifications` bell listener, which does not re-run `loadVerifications()`.

### Document Signature Pipeline

```
submitDocumentUpload → documents {status: reqSign?'pending_signature':'draft', signed:false}
  ↓
confirmSignature → documents.update({signatories[], signed, status:'signed'/'pending_signature'})
```

No automated "contract active" transition exists anywhere — `updateDocumentStats`
merely *counts* `sale_agreement`/`rental_agreement`-type docs as "contracts"
for a stat tile; there's no separate contract entity that flips state.
Signer's own view updates in-memory immediately (no reload needed for the
actor); a different concurrent viewer needs a manual reload (no `onSnapshot`).

---

## Module: HR / Staff / Operations

### Forms

| Function (line) | Collection(s) | Key fields | 7 fields? |
|---|---|---|---|
| `createStaffOrPartnerAccount` (functions/index.js:1192) | `users` | status:'pending_first_login', department/jobTitle/reportsTo derived from role | Yes |
| **BUG #2** `changeUserRole` (22619) | `users` `.update()` | role, **status: undefined for non-agent roles** | update-only, but **throws** |
| `assignStaffDepartment`/branch assignment (21986/19353) | `users` `.update()` | departmentId / branchId | update-only |
| `submitLeaveApply`/`hrMgrProcessLeave`/`processLeave` (24109/19618/24167) | `leaves` | status:'pending'→approved/rejected; **rejectedReason never populated (dead field)** | Yes / update |
| `submitCheckin`/`submitCheckout` (23984/24019) | `attendance` | checkInAt/checkOutAt, hoursWorked | Yes / update |
| **BUG #1** `submitTask` (23780, create path 23812) | `tasks` `.add()` | **no `id` field on create — rejected by rules** | **No — missing id** |
| `createChecklistTasks` (22019) | `tasks` `.set()` (id pre-assigned) | checklistKind, checklistFor | Yes |
| `addTaskComment`/`updateTaskStatus` (23876/23898) | `tasks` `.update()` | comments (arrayUnion), status | update-only |
| `saveDepartment`/branch save (21939/19190) | `departments`/`branches` `.set()` | name, headUserId / managerId | Yes |
| `saveJobPosting`/`toggleJobPostingStatus` (22171/22211) | `job_postings` | status:'open', postedBy | Yes / update |
| `submitJobApplication` (15832, public) | `job_applications` | stage:'applied' | Yes |
| `submitStaffReview` (23416) | `staff_reviews` | rating, comment | Yes |

### Dashboards / Read Views

**Every single read view in this module uses `.get()` — none use
`.onSnapshot()`.** (`loadAddStaffList` 22847, `loadHRMgrDash` 19564,
`loadOpsMgrDash` 19638, `loadHRStats`/`loadStaffDirectory` 21855/22437,
`loadPerformance` 23306, `loadStaffReviewHistory` 23395, `fetchDepartments`/
`fetchBranches` 21896/19084, `loadJobPostings`/`loadJobApplications`
22120/22227, `loadOfficeStats`/`loadTasks`/`loadAttendance`/`loadLeaves`/
`loadSchedule` 23521/23642/23915/24038/24185.) All correctly role-scope via
an explicit `isAdminOrStaff(currentUser)` branch where relevant.

### Staff Provisioning Pipeline (confirmed correct, but not real-time)

```
createStaffOrPartnerAccount → users {status:'pending_first_login'}
  ↓
restoreUserSession (line 11219) — the ONE place every login method funnels through —
  flips status:'active' on first successful login, any provider
  ↓
renderAddStaffList (22898) — statusLabel = status==='pending_first_login' ? 'Pending' : 'Active'   ✓ correct, same literal string
```

CEO must revisit/reload the Add Staff page to see Pending flip to Active — no
listener re-triggers `loadAddStaffList()` when a different session logs in.

### Leave Approval Pipeline (confirmed correct, but not real-time)

Two field-consistent approval entry points (`hrMgrProcessLeave` in the HR
Manager dashboard, `processLeave` in the Office/Leaves tab) both write the
identical field set. The requesting employee's own Leaves tab (`loadLeaves`,
`userId==uid`) will show the correct final status — but only after a manual
reload, since nothing is `onSnapshot`-based here.

### Org Chart Consistency — VERIFIED CLEAN

`ROLE_DEPARTMENT`/`ROLE_JOBTITLE`/`ROLE_SUPERIOR_ROLES` (index.html) vs.
`deptOfRole()`/`isSeniorManager()` (rules/firestore.rules) vs. their
functions/index.js counterparts are **byte-identical** across all three
locations, casing included (`Executive, Finance, Brokerage, Marketing,
CustomerSupport, IT, HR, Legal`). The historical "Executive vs executive"
casing bug class does **not** recur anywhere in this module.

---

## Module: Executive Governance — Approvals / Reports / Messages / Notifications / Investor / Referrals / Sites

### Forms

| Function (line) | Collection(s) | Key fields | 7 fields? |
|---|---|---|---|
| `requestApproval` (20545) | `approvals` | routedTo[] (resolved superior uids), status:'pending', serverVerified:false | Yes |
| **BUG #18** `decideApproval` (20566) | `approvals` `.update()` | status, decidedBy, **decidedAt as ISO string (not Timestamp)** | update-only |
| `submitReport` (20633) | `reports` | department (ROLE_DEPARTMENT-derived), recipients = currentUser.reportsTo | Yes |
| `notifyUser`/`kmNotify` (18980/18950) | `notifications` | userId, read:false, status:'unread' | Yes |
| `postToTeamChannel` (23617) | `messages` | channel, content | Yes |
| **BUG #17** `logAudit` (28900) | `auditlogs` | **id:'' never patched back** | Partial |
| `openInvestmentPledge` (26000) | `investments` | investorId, amountInvested, status:'pledged' | Yes |
| `linkReferralOnRegister`/`openRewardReferral` (33746/17382) | `referrals` | status:'registered'→'rewarded' | Yes / update |
| `saveAsset`/`assignAsset` (22352/22387) | `assets` | status:'available', assignedToUserId | Yes / update |
| `submitSiteForm` (30793) | `sites` + `plots` | status:'pending_review'/'active'/'available' | Yes |

### Dashboards / Read Views

| Function (line) | Query | get()/onSnapshot() | Scoping |
|---|---|---|---|
| `loadExecApprovals` (20501) | `approvals` status:'pending'+serverVerified:true | `.get()` | **Gated to literal `role==='ceo'` only — see Bug #11** |
| `loadMyReportsWidget`/`loadExecReportsReceived` (20590/20666) | `reports` submittedBy== / recipients array-contains | `.get()` | **BUG #5 — no composite index exists for either query** |
| `_startFsNotifListener` (18791) | `notifications` userId== | **`.onSnapshot()`** | self |
| `loadTeamChannel` (23590) | `messages` channel== | **`.onSnapshot()`** | isInternalTeam() |
| `loadExecActivity` (20729) | `auditlogs` orderBy createdAt | `.get()` | none extra (page-gated) |
| `loadMyPortfolio`/`loadInvestmentOpportunities` (26066/25957) | `investments.investorId==` / `properties.isInvestmentOpportunity==true` | `.get()` | self / public |
| `loadAdminReferrals`/`loadReferralStats` (17315/17787) | `referrals` isActive / referrerId== | `.get()` | admin / self |
| `loadAssets` (22301) | `assets` isActive | `.get()` | staff-only via rules |
| `loadSites`/`loadSitePlan` (30194/30287) | `sites` status:'active' / `plots` siteId== | `.get()` | public read |

### Approval Workflow End-to-End

```
requestApproval → approvals {routedTo:[director,ceo], status:'pending', serverVerified:false}
  ↓
onApprovalCreated (functions/index.js:1043) → serverVerified:true, notifyStaff() broadcasts to ALL 15 staff-tier roles
  (not just routedTo — BUG-adjacent, over-broad notification)
  ↓
loadExecApprovals — query itself correctly checks status+serverVerified, but the PANEL is hidden unless role==='ceo' literally (20504)
  ↓
decideApproval (client) — writes status/decidedBy/decidedAt directly; rules DO allow a routedTo Director to do this, but no UI exposes it
  ↓
onApprovalDecided (functions/index.js:1083) — only fires on transition to 'approved'; re-verifies decidedBy role is EXACTLY 'ceo' (1096)
  → REVERTS even a legitimate routedTo Director's decision — BUG #11
  → on real CEO approval: writes the actual privileged doc (e.g. payroll) server-side, sourceApprovalId linked
  ↓
Manual rejection (decideApproval → status:'rejected') never triggers any Cloud Function — no notifyUser fires,
  so a rejected request is silently invisible to its requester
```

### Report Submission Pipeline

```
submitReport → reports {recipients: currentUser.reportsTo (uids), department: ROLE_DEPARTMENT[role]}
  ↓
loadMyReportsWidget (submittedBy==uid) — submitter's own sent reports
loadExecReportsReceived (recipients array-contains uid) — gated to CEO or role==='director'
  ↓
BUG #5: zero composite indexes declared for `reports` anywhere in firestore.indexes.json — both queries above
  require one (array-contains + orderBy, and equality + orderBy respectively) and will hit failed-precondition in production
```

Department string casing was specifically re-checked here given the
project's history — **verified byte-identical** across the report-submission
code, the dropdown filter options, `functions/index.js`, and
`firestore.rules`. No recurrence of the casing bug class in this module.

---

## Summary: get() vs onSnapshot() by Collection

| Real-time (`.onSnapshot()`) | One-time (`.get()`) only |
|---|---|
| `invoices` (Accounting), `commissions`, `payroll`, `messages` (team channel), `notifications`, `leads` (CRM list + dashboard widget), `deals`, `payout_requests` (admin queue) | `documents`, `services` (verification), `partners`, `reviews`, `viewings`, `users` (Add Staff list, HR directory), `leaves`, `attendance`, `tasks`, `departments`, `branches`, `staff_reviews`, `job_postings`, `job_applications`, `approvals`, `reports`, `investments`, `referrals`, `assets`, `sites`, `plots`, `expenses`, `subscriptions`, `auditlogs`, all Exec/BI aggregate queries |

The platform's stated goal ("dashboards reflect changes immediately") is
currently true for the Finance/CRM core loop and notifications/messages, but
**not** true for HR/Ops, Documents, Verification, Partners, Approvals,
Reports, or the Investor/Referral/Sites modules — those are the majority of
the collections in the app.

---

## Broken Links Not Already Covered Above

1. `submitOffer`/`submitCounterOffer` update the **deal's** `pipelineStage` to `negotiation` directly but never advance the **lead's** `pipelineStage` to `offer_submitted` — a lead that generates a real offer can sit at `viewing_completed` indefinitely in lead-based views (e.g. the Clients directory's "has deal" check) unless staff manually clicks through the kanban.
2. A lead's own `closeLeadWon` (setting `pipelineStage:'closed_won'` directly on the lead) does not require or force creating a matching `deals` doc — if the user declines the "convert to deal?" prompt, the lead shows as won in lead-based views with no corresponding commission/invoice ever generated.
3. `department` (string, for the 9 governance roles) vs `departmentId` (FK, for regular staff) on `users` are two non-overlapping fields by design — not a bug today, but any future report/filter that checks only one of them will silently miss users who only have the other set.
4. `dealType` value spelling inconsistency: `'rent'` (from `submitOffer`) vs `'rental'` (from every other deal-creation path) — `functions/index.js`'s invoice line-item description only matches `'rent'`, so invoices for `'rental'`-tagged deals print "Sale — ..." instead of "Rental — ...".

---

## Not Audited In This Pass

- Property listing creation/edit forms and the public marketplace read path (search/filter/detail) — not explicitly in scope of the 5 dispatched audit slices; a follow-up pass should cover `properties` writes/reads specifically if needed.
- Storage-backed uploads (photos, ID scans, contracts) — covered structurally in an earlier engagement phase (Storage rules/CORS), not re-verified here.
- Cloud Functions not touched by any pipeline above (e.g. `nightlyFollowupReminderSweep`, `dailySubscriptionSync`'s full body) — read only as much as needed to confirm the specific pipeline claims above.
