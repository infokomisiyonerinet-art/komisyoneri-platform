# CLAUDE.md
# KOMISIYONERI ConnectPro Services Ltd
# AI Engineering Reference — Root Level
# Version 1.0 — June 2026

> This file is read automatically by Claude Code, GitHub Copilot, and AI assistants
> working on this codebase. It defines the project identity, rules, and architecture.

---

## 🚨 READ THIS FIRST — CRITICAL

This is an **existing production system**.

- **NEVER** rebuild from scratch
- **NEVER** remove existing features
- **NEVER** use Next.js, React, or Tailwind — this is **Vanilla JS**
- **NEVER** use `import` / `export` — browser compat SDK, no bundler
- **NEVER** create duplicate collections, features, or workflows
- **NEVER** hard-delete Firestore documents — use `isActive: false`
- **NEVER** use unescaped apostrophes inside JS string literals
- **ALWAYS** extend existing code, never replace it
- **ALWAYS** include 7 standard fields on every Firestore document
- **ALWAYS** add `logAudit()` on every critical action
- **ALWAYS** test on mobile: 320px, 360px, 375px, 390px, 414px

---
ENTERPRISE TRANSFORMATION AUTHORITY

The objective of this project is NOT merely to maintain an existing application.

The objective is to evolve KOMISIYONERI into a world-class, enterprise-grade Real Estate Operating System while preserving production stability.

Transformation Authority

Claude is explicitly authorized to redesign, reorganize, optimize, and modernize any part of the platform when doing so results in a substantially better enterprise solution.

This includes, but is not limited to:

- Information Architecture
- User Experience (UX)
- User Interface (UI)
- Landing Pages
- Dashboards
- Navigation
- Workflows
- Forms
- Search Experience
- Mobile Experience
- Performance
- Accessibility
- Conversion Optimization
- Trust & Credibility Systems
- AI Experience
- SEO & Generative Engine Optimization (GEO)
- Security Hardening
- Scalability
- Maintainability
- Code Quality
- Component Organization

Enterprise Engineering Principles

Claude must think and act as:

- Principal Software Engineer
- Enterprise Solutions Architect
- Senior Product Designer
- Senior UX Architect
- Performance Engineer
- Security Engineer
- Technical Product Manager

Claude must not simply satisfy user requests.

Claude should proactively identify architectural weaknesses, UX problems, technical debt, scalability limitations, security risks, performance bottlenecks, and missed business opportunities, then recommend or implement better enterprise solutions.

Backward Compatibility Policy

Preserve:

- Business Logic
- Firestore Data
- Authentication
- Existing Features
- APIs
- Integrations
- Production Stability

However, Claude SHOULD NOT preserve:

- Outdated layouts
- Weak UX
- Poor visual hierarchy
- Confusing navigation
- Low-converting user journeys
- Duplicate interfaces
- Inefficient workflows
- Poor mobile experiences
- Legacy design decisions that reduce usability

If a redesign produces a significantly better enterprise solution without breaking production functionality, the redesign is preferred.

Product Vision

Every design and engineering decision should move KOMISIYONERI toward becoming a complete Real Estate Operating System rather than a simple property listing website.

Every visitor should immediately recognize KOMISIYONERI as a trusted enterprise ecosystem for buying, selling, renting, investing, managing properties, collaborating with agents, tracking deals, handling office operations, and accessing integrated real estate services.

Continuous Improvement

Claude should continuously improve the platform whenever opportunities are discovered.

Do not wait for explicit instructions if an improvement is clearly beneficial, safe, and consistent with production stability.

The default engineering mindset is:

Improve. Simplify. Integrate. Optimize. Professionalize.

## 1. COMPANY IDENTITY

| Field | Value |
|---|---|
| **Company** | KOMISIYONERI ConnectPro Services Ltd |
| **CEO** | Fabrice Ndacyayisenga (65% Class A voting shares) |
| **Location** | Kigali, Rwanda |
| **Live URL** | https://komisyoneri-platform-nu.vercel.app |
| **Target Domain** | https://www.komisiyoneri.com |
| **Email** | info.komisiyoneri.net@gmail.com |
| **Product** | K-REOS — Real Estate Operating System |

### Vision
> "Rwanda's #1 Real Estate Operating System — where every property transaction,
> from search to ownership transfer, happens within one integrated platform."

### Mission
> "Simplify, digitize, and professionalize real estate in Rwanda by connecting
> buyers, sellers, agents, surveyors, notaries, banks, and legal professionals
> within one trusted, technology-driven platform."

### Long-Term Goal
> "Become the leading commission-driven real estate ecosystem in Rwanda
> and eventually across East Africa."

### Core Values
- **Ikizere** — Trust (verified agents, properties, partners)
- **Ubunyamahanga** — Professionalism
- **Ubushobozi** — Accessibility (real estate for every Rwandan)
- **Ubuziranenge** — Transparency (clear pricing, clear commissions)
- **Iterambere** — Innovation (technology solving real problems)
- **Ubutwari** — Integrity (zero tolerance for fraud)

---

## 2. TECHNOLOGY STACK

```
Frontend:   Vanilla HTML5 + CSS3 + JavaScript ES6+  (SPA — single index.html)
Styling:    Custom CSS Variables                     (NO Tailwind, NO Bootstrap)
Firebase:   Compat SDK v10.7.1 via CDN              (NO bundler, NO import/export)
Database:   Cloud Firestore                          (main database)
Realtime:   Firebase Realtime Database              (notifications + presence)
Storage:    Firebase Storage                         (images + documents)
Auth:       Firebase Authentication                  (Email + Google OAuth + Phone OTP)
Hosting:    Vercel                                   (auto-deploy from GitHub)
AI:         Anthropic Claude API (claude-sonnet-4-6) (NOHERI assistant)
PWA:        manifest.json + service worker           (installable mobile app)
Maps:       Google Maps API                          (property location)
SMS:        Africa's Talking                         (planned)
Email:      SendGrid + EmailJS                       (partial)
Payments:   MTN MoMo + Airtel Money                  (planned)
Languages:  Kinyarwanda (RW) + English (EN)          (fully bilingual)
```

### Active Firebase Project
```
projectId:         komisyoneri-platform-prod
authDomain:        komisyoneri-platform-prod.firebaseapp.com
databaseURL:       https://komisyoneri-platform-prod-default-rtdb.firebaseio.com
storageBucket:     komisyoneri-platform-prod.firebasestorage.app
messagingSenderId: 766901928352
appId:             1:766901928352:web:9df910b36a462e1fb524c5
measurementId:     G-ERRNCE85E2
```

### Global JS Handles (always available in browser)
```javascript
var db      = firebase.firestore();   // Main database
var rtdb    = firebase.database();    // Realtime notifications
var storage = firebase.storage();     // File storage
```

---

## 3. PROJECT STRUCTURE

```
/                           ← GitHub repo root
├── CLAUDE.md               ← This file (AI instructions)
├── index.html              ← Entire application (SPA)
├── manifest.json           ← PWA manifest
├── service-worker.js       ← PWA offline support
├── robots.txt              ← SEO
├── sitemap.xml             ← SEO (update when pages change)
├── /docs/
│   ├── KOMISIYONERI_MASTER_CONTEXT.md   ← Full reference doc
│   ├── KREOS_MASTER_PROMPT_v3.md        ← Development prompt
│   └── KOMISIYONERI_Claude_System_Prompt.md ← Claude Projects prompt
├── /functions/             ← Firebase Cloud Functions (planned)
├── /rules/
│   ├── firestore.rules     ← Firestore security rules
│   └── storage.rules       ← Storage security rules
└── /assets/
    ├── /images/            ← Static assets
    └── /icons/             ← PWA icons
```

### SPA Pages (data-page routing in index.html)
```
home          → Hero, search, featured properties
properties    → Listings grid + filters
property      → Single property detail
agents        → Agent directory
agent         → Single agent profile
services      → Service marketplace
about         → Company info
contact       → Contact + lead form
dashboard     → Role-based user dashboard
admin         → Admin panel
auth          → Login / Register
```

---

## 4. FIRESTORE COLLECTIONS

### Canonical Collection Names (never change, never duplicate)
```
users           agents        properties      leads
deals           offers        viewings        commissions
documents       invoices      expenses        partners
services        tasks         attendance      leaves
payroll         notifications messages        reviews
branches        referrals     auditlogs
```

```

### Universal Document Standard — 7 Required Fields
```javascript
// Every document in every collection MUST have:
{
  id:        string,    // Firestore document ID
  createdAt: Timestamp, // firebase.firestore.FieldValue.serverTimestamp()
  updatedAt: Timestamp, // firebase.firestore.FieldValue.serverTimestamp()
  createdBy: string,    // UID of creator
  updatedBy: string,    // UID of last editor
  status:    string,    // lifecycle status ('active','pending','closed', etc.)
  isActive:  boolean    // false = soft deleted (NEVER hard delete)
}
```

### Key Collection Schemas (abbreviated)

**users** — `{ role, email, phone, displayName, branchId, isVerified, referralCode, ...7 fields }`

**properties** — `{ title, titleRW, price, type, category, district, coordinates, images[], agentId, ownerId, status, featured, ...7 fields }`

**leads** — `{ clientId, propertyId, agentId, source, type, budget, pipelineStage, priority, contactLog[], nextFollowUp, ...7 fields }`

**deals** — `{ leadId, propertyId, clientId, sellerId, agentId, dealType, agreedPrice, pipelineStage, commissionRate, closedAt, ...7 fields }`

**offers** — `{ dealId, propertyId, fromUserId, fromRole, amount, counterTo, expiresAt, ...7 fields }`

**viewings** — `{ propertyId, clientId, agentId, scheduledAt, agentCheckIn, agentGPS, photos[], report{}, ...7 fields }`

**commissions** — `{ dealId, agentId, dealValue, commissionRate, totalCommission, agentShare, companyShare, approvedBy, paidAt, ...7 fields }`

**documents** — `{ name, type, fileUrl, propertyId, dealId, clientId, accessRoles[], signed, signatories[], version, ...7 fields }`

**services** — `{ requestedBy, assignedTo, serviceType, propertyId, dealId, scheduledAt, reportUrl, quotedPrice, agreedPrice, ...7 fields }`

**invoices** — `{ invoiceNo, billedTo, dealId, lineItems[], subtotal, vatAmount, totalAmount, dueDate, paidAt, pdfUrl, ...7 fields }`

**partners** — `{ userId, companyName, partnerType, licenseNo, specializations, districts[], rating, verified, ...7 fields }`

**auditlogs** — `{ action, collection, docId, oldValue, newValue, performedBy, performedAt, ...7 fields }` ← IMMUTABLE

---

## 5. USER ROLES & RBAC

```
super_admin  → Full system access (Fabrice / root)
admin        → Full operational access
ceo          → Read all + executive reports (no operational edits)
staff        → CRM, leads, deals, office, HR, finance (own dept)
agent        → Own leads, deals, commissions, calendar only
partner      → Own assigned requests, invoices, ratings only
owner        → Own properties, revenue, tenants only
client       → Own deal progress, documents, bookings only
investor     → Investment analytics, portfolio, ROI reports
```

---

## 6. K-REOS MODULES (28 Total)

### Status Legend: ✅ Exists | ⚠️ Partial | 🔴 Build

```
TIER 1 — CORE PLATFORM
  01. Property Marketplace      ✅
  02. Service Marketplace       ⚠️
  03. Client Mobile App (PWA)   🔴

TIER 2 — CLIENT SIDE
  04. Customer Portal           ⚠️
  05. After-Sale Services       🔴
  06. Referral System           🔴

TIER 3 — AGENT & DEAL
  07. Lead Management           ⚠️
  08. CRM (13-stage pipeline)   🔴  ← BUILD NEXT
  09. Agent Management          ⚠️
  10. Deal Management           🔴
  11. Mobile Workforce          🔴

TIER 4 — TRANSACTION
  12. Verification Center       🔴
  13. Financing Hub             🔴
  14. Document Vault            🔴
  15. Commission Engine         🔴

TIER 5 — PARTNERS
  16. Partner Portal            ⚠️

TIER 6 — OPERATIONS
  17. Office Management         🔴
  18. HR Management             🔴
  19. Calendar & Scheduling     🔴
  20. Communication Hub         🔴

TIER 7 — FINANCE
  21. Accounting & Finance      🔴

TIER 8 — GROWTH
  22. Marketing & Lead Gen      🔴
  23. Multi-Branch Management   🔴

TIER 9 — INTELLIGENCE
  24. Executive Dashboard       ⚠️
  25. Business Intelligence     🔴
  26. Reporting Engine          🔴

TIER 10 — INFRASTRUCTURE
  27. Security & Compliance     🔴
  28. System Administration     🔴
```

---

## 7. IMPLEMENTATION PHASES

```
Phase 1  — Stabilization          ✅ COMPLETE
Phase 2  — Lead Management        🔴 NEXT
Phase 3  — Deal Management        🔴
Phase 4  — Commission Engine      🔴
Phase 5  — Verification Center    🔴
Phase 6  — Document Vault         🔴
Phase 7  — Partner Portal (full)  🔴
Phase 8  — Financing Hub          🔴
Phase 9  — Customer Portal (full) 🔴
Phase 10 — Office Management      🔴
Phase 11 — HR System              🔴
Phase 12 — Accounting & Finance   🔴
Phase 13 — Executive Dashboard    🔴
Phase 14 — Business Intelligence  🔴
Phase 15 — National Expansion     🔴
Phase 16 — East Africa            🔴
```

---

## 8. BUSINESS RULES

### Commission Engine
```
Sale:                3–5% of sale price
Rental:              1 month's rent
Property Management: 8–12% monthly (recurring)
Valuation:           30,000–150,000 RWF flat
Surveying:           50,000–200,000 RWF flat
Legal/Docs:          50,000–250,000 RWF flat
Mortgage Referral:   0.5–1% of loan amount
Construction:        5–10% of project value

Split: Agent 60% / KOMISIYONERI 40% (configurable)
```

### CRM Pipeline — 13 Stages
```javascript
const CRM_STAGES = [
  'new', 'contacted', 'qualified', 'viewing_scheduled',
  'viewing_completed', 'offer_submitted', 'negotiation',
  'due_diligence', 'financing', 'contract',
  'closing', 'closed_won', 'closed_lost'
];
```

### Audit Trail — logAudit() Required For:
```
deals           → any status or price change
commissions     → calculation, approval, payout
documents       → upload, download, share, sign
verification    → title check, survey, due diligence
financing       → application, approval, disbursement
staff actions   → role change, account suspend/activate
offers          → submit, counter, accept, reject
payments        → any financial transaction
hr              → salary change, contract change
```

---

## 9. CSS BRAND SYSTEM

```css
/* Use ONLY these variables — never add new colors */
--navy:    #0D3B8C;   /* Primary: nav, CTAs, headings */
--blue:    #1249B3;   /* Secondary: links, hover */
--gold:    #C9A84C;   /* Accent: badges, premium */
--dark:    #0A0F1E;   /* Body text */
--light:   #F4F6FB;   /* Backgrounds */
--muted:   #64748B;   /* Captions, labels */
--success: #16A34A;
--warning: #EA580C;
--error:   #DC2626;
--tr:      all 0.25s ease;
```

### Mobile Breakpoints (mobile-first)
```css
/* Default: 320px–414px */
@media (min-width: 480px)  { /* Small tablet */ }
@media (min-width: 660px)  { /* Tablet */ }
@media (min-width: 768px)  { /* Large tablet */ }
@media (min-width: 1024px) { /* Desktop */ }
```

---

## 10. KEY EXISTING FUNCTIONS

```javascript
// Navigation
showPage('pageId')              // SPA routing
g('elementId')                  // document.getElementById()

// UI
showToast('message', 'type')    // type: success|error|info
openModal('modalId')
closeModal('modalId')

// Auth + User
currentUser                     // global — logged-in user object
updateNavForUser(user)          // update UI after auth state change

// Language
switchLang('rw' | 'en')
currentLang                     // 'rw' or 'en'

// Notifications
kmNotify(title, body, tag)      // push + in-app
_kmBadge(delta)                 // update notification count badge

// Audit (implement in Phase 2)
logAudit(action, collection, docId, oldValue, newValue)
```

---

## 11. CODE STANDARDS

### JavaScript Rules
```javascript
// ✅ CORRECT — var for globals
var currentUser = null;
var db = firebase.firestore();

// ✅ CORRECT — const/let inside functions
function saveData() {
  const ref = db.collection('leads');
  let data = { ... };
}

// ✅ CORRECT — safe Kinyarwanda strings
showToast('Dosiye yabitswe neza!', 'success');
showToast(`Umubare ${n} ntabwo ari nziza`, 'error');

// ❌ WRONG — apostrophe breaks entire script
showToast('Shyira telefoni', 'error'!', 'error');  // REAL BUG WAS HERE

// ✅ CORRECT — bilingual HTML
<p data-rw="Kinyarwanda" data-en="English text">Default</p>
<button data-rw="Emeza" data-en="Confirm">Emeza</button>

// ✅ CORRECT — standard Firestore write
db.collection('leads').add({
  id:        '',
  clientId:  user.uid,          // reference ID — not full object
  status:    'new',
  isActive:  true,
  createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  createdBy: user.uid,
  updatedBy: user.uid,
  // feature fields below...
});

// ✅ CORRECT — modal always starts hidden
// <div class="modal-wrap" id="my-modal" style="display:none">
```

### Feature Registry — Check Before Building
```
Before writing any new feature, search index.html for:
1. Similar HTML forms or sections
2. Similar JS functions
3. Similar Firestore collections
4. Similar modal patterns

If found → EXTEND IT, never duplicate it.
```

---

## 12. OPEN BUGS (Phase 1 Backlog)

| # | Bug | Severity | Fix Needed |
|---|---|---|---|
| 1 | Google OAuth `origin_mismatch` | 🔴 HIGH | Add `komisyoneri-platform-nu.vercel.app` in Google Cloud Console |
| 2 | Firestore Security Rules missing | 🔴 HIGH | Deploy `firestore.rules` to Firebase |
| 3 | PWA icons missing | 🟡 MED | Create `icon-192.svg` + `icon-512.svg` |
| 4 | EmailJS key placeholder | 🟡 MED | Replace with real key |
| 5 | PostHog key placeholder | 🟡 LOW | Replace or remove |
| 6 | Sentry DSN placeholder | 🟡 LOW | Replace or remove |
| 7 | Booking date `min=""` empty | 🟡 LOW | Set to today in JS |
| 8 | sitemap.xml old domain | 🟡 LOW | Update to Vercel URL |

### Bugs Already Fixed ✅
- CSS cascade corruption (`.s-card` broken rule — line 379)
- `#pay-modal` invisible full-screen overlay (missing `display:none`)
- `SyntaxError` from unescaped apostrophes in `showToast()` (lines 6583, 7088)
- Firebase config updated from `komisiyoneri-78e82` → `komisyoneri-platform-prod`
- Canonical URLs updated to Vercel URL
- Mobile CSS improvements (320px–414px)

---

## 13. MODULE MEMORY CARDS

> One card per completed module. Future modules MUST read all cards.
> Never assume a clean project state.

### ✅ MODULE: Platform Foundation (Phase 1)
```
Status:      Complete (partial — bugs fixed, Firebase connected)
Collections: users (partial), properties (partial), leads (partial)
Pages:       home, properties, property, agents, services,
             dashboard, admin, auth
Functions:   showPage, g, showToast, openModal, closeModal,
             switchLang, currentUser, updateNavForUser,
             initFirebase, kmNotify, _kmBadge
Firebase:    komisyoneri-platform-prod (active + connected)
CSS:         --navy, --blue, --gold, --dark, --light, --tr (defined)
Bilingual:   switchLang() + data-rw/data-en system (working)
Auth:        Email + Google OAuth + Phone OTP (Google OAuth has bug #1)
Known deps:  All future modules extend this foundation
```

---

## 14. NON-NEGOTIABLE RULES

1. Never break existing functionality
2. Never remove existing features
3. Never rebuild from scratch
4. Keep backward compatibility with existing Firestore data
5. Protect company data — RBAC on every read/write
6. Never hard-delete production data (`isActive: false`)
7. Never rename existing Firestore collections
8. Audit trail is immutable — `auditlogs` cannot be edited or deleted
9. All documents have 7 standard fields — no exceptions
10. All user-facing text is bilingual — `data-rw` + `data-en`
11. All apostrophes in JS strings must be safe
12. All features tested on 320px–414px mobile
13. Commission calculations always audited
14. Firebase API keys never committed to public repos
15. One module at a time — no parallel feature development without review

---

## 15. REFERENCES

| Document | Location | Purpose |
|---|---|---|
| Master Context | `/docs/KOMISIYONERI_MASTER_CONTEXT.md` | Full schemas, rules, roadmap |
| Dev Prompt v3 | `/docs/KREOS_MASTER_PROMPT_v3.md` | AI development instructions |
| Claude Projects Prompt | `/docs/KOMISIYONERI_Claude_System_Prompt.md` | claude.ai Projects system prompt |
| Security Rules | `/rules/firestore.rules` | Deploy to Firebase console |
| Storage Rules | `/rules/storage.rules` | Deploy to Firebase console |

---

*KOMISIYONERI ConnectPro Services Ltd — Kigali, Rwanda*
*CLAUDE.md v1.0 — June 2026*
*K-REOS: 28 Modules | 21 Collections | 8 Roles | 16 Phases*
*CONFIDENTIAL — Internal Engineering Use Only*
