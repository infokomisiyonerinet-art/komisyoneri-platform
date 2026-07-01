# KOMISIYONERI MASTER CONTEXT
**Version 1.0 — June 2026**
**Classification: Internal — Confidential**
**Path: /docs/KOMISIYONERI_MASTER_CONTEXT.md**

---

## 1. COMPANY IDENTITY

### Basic Information
```
Legal Name:    KOMISIYONERI ConnectPro Services Ltd
Trading As:    KOMISIYONERI
Location:      Kigali, Rwanda
Founded:       2024
CEO/Founder:   Fabrice Ndacyayisenga (65% Class A voting shares)
Live Platform: https://komisiyoneri.co.rw
Target Domain: www.komisiyoneri.co.rw
Contact:       info.komisiyoneri.net@gmail.com
Languages:     Kinyarwanda (primary) + English
```

### Vision
> **"Kuba urubuga rw'ibanze rwa real estate mu Rwanda no muri Afurika y'Iburasirazuba — aho umukiriya ashobora gushaka, kugura, gutunga, no gucunga imitungo yose akoresheje platform imwe."**

> *"To become the leading real estate operating system in Rwanda and East Africa — where every property transaction, from search to ownership transfer, happens within one integrated ecosystem."*

### Mission
> **"Guhuza abaguzi, abacuruzi, agents, banki, abagenzuzi b'imitungo, n'inzobere z'amategeko — kugira ngo transactions z'imitungo mu Rwanda zibe zizewe, zihuse, kandi ziboneke na buri wese."**

> *"To connect buyers, sellers, agents, banks, surveyors, and legal professionals — making Rwanda's property transactions trustworthy, fast, and accessible to everyone."*

### Core Values
```
1. UBUNYANGAMUGAYO (Integrity)
   — Transparency in every transaction, commission, and document.

2. UBUHANGA (Excellence)
   — Professional service that meets international standards
     while remaining locally grounded.

3. UBUFATANYE (Partnership)
   — We succeed when our clients, agents, and partners succeed.

4. INOVASYO (Innovation)
   — Technology-first approach to solving real estate challenges
     specific to Rwanda and East Africa.

5. KWIZERANA (Trust)
   — Every listing verified. Every agent accountable.
     Every document permanent.
```

---

## 2. PROBLEM STATEMENT

### The Problem KOMISIYONERI Solves

**In Rwanda today, real estate transactions are:**

```
❌ Fragmented    — Buyer uses 10 different people/platforms
❌ Untrustworthy — Title deed fraud is common
❌ Slow          — Simple transactions take 3–6 months
❌ Informal      — Most deals are undocumented
❌ Inaccessible  — Diaspora and rural buyers cannot participate remotely
❌ Expensive     — Hidden fees, double commissions, no transparency
❌ Unregulated   — No standard commission rates or agent accountability
```

### Who Suffers:

**Buyers/Renters (Abaguzi/Abakodesha):**
- Cannot verify property ownership before paying
- Do not know real market prices
- Have no single place to search, verify, finance, and close
- Diaspora cannot transact remotely with confidence

**Sellers/Owners (Abacuruzi/Nyir'imitungo):**
- Cannot reach verified buyers efficiently
- Properties sit unsold for months due to poor marketing
- Cannot track rental income or manage tenants professionally

**Agents/Brokers:**
- No professional tools — work via WhatsApp and phone only
- No commission protection — clients bypass agents after introductions
- No performance tracking or career development path

**Real Estate Companies:**
- Cannot manage multiple agents, listings, and deals in one system
- No financial visibility — commissions calculated manually
- Cannot produce professional reports for partners or investors

### The KOMISIYONERI Solution:
> One platform that manages the **entire property lifecycle** — from first search to final ownership transfer — for every stakeholder simultaneously.

---

## 3. ECOSYSTEM ARCHITECTURE

```
KOMISIYONERI ECOSYSTEM
│
├── 🌐 PUBLIC MARKETPLACE
│   ├── Property search (buy/rent/land)
│   ├── Agent directory
│   ├── Service marketplace
│   ├── Market reports (public)
│   └── Mortgage calculator (public)
│
├── 👤 CLIENT SIDE
│   ├── Customer portal (deal tracker)
│   ├── Document vault ("My Property Folder")
│   ├── Viewing scheduler
│   ├── Offer submission + negotiation
│   ├── Mortgage application hub
│   └── After-sale services
│
├── 🤝 AGENT NETWORK
│   ├── Lead management + auto-assignment
│   ├── CRM pipeline (13 stages)
│   ├── Deal management center
│   ├── Mobile workforce app (GPS + reports)
│   ├── Commission tracker
│   └── Performance dashboard
│
├── 📊 DEALS TRACKER
│   ├── Full pipeline (New Lead → Closed)
│   ├── Offer + counter-offer history
│   ├── Negotiation audit trail
│   ├── Deal timeline + milestones
│   └── Digital closing center
│
├── 💰 COMMISSION ENGINE
│   ├── Auto-calculation on deal close
│   ├── Multi-tier commission rules
│   ├── Agent/company split (60/40 default)
│   ├── Approval workflow
│   ├── Payout tracking (MTN MoMo)
│   └── Payslip generation
│
├── 🏢 ADMIN PANEL
│   ├── Office management (tasks, attendance)
│   ├── HR system (payroll, leave, contracts)
│   ├── Accounting & finance (P&L, cashflow)
│   ├── User & role management
│   └── System configuration
│
├── 📈 ANALYTICS DASHBOARD
│   ├── Executive KPI dashboard (CEO)
│   ├── Business intelligence layer
│   ├── Geographic performance heatmap
│   ├── Agent performance analytics
│   ├── Revenue forecasting (AI-powered)
│   └── Custom report builder
│
├── 💼 INVESTOR PORTAL
│   ├── Investment opportunity listings
│   ├── ROI projections per property/zone
│   ├── Portfolio management dashboard
│   ├── Land banking strategy tools
│   ├── Off-plan investment tracking
│   └── Investor reports (quarterly PDF)
│
└── 🤝 PARTNER PORTAL
    ├── Surveyor dashboard
    ├── Notaire/Lawyer dashboard
    ├── Bank/Mortgage portal
    ├── Valuer dashboard
    ├── Construction company portal
    └── Partner rating + review system
```

---

## 4. TECHNICAL STACK

### ⚠️ CRITICAL — Read Before Writing Any Code

```
This platform uses VANILLA HTML/CSS/JS — NOT Next.js or React.
Do NOT generate import/export statements.
Do NOT generate React components.
Do NOT use Tailwind CSS.
```

### Frontend
```
Language:    Vanilla HTML5 + CSS3 + JavaScript (ES6+)
Architecture: Single Page Application (SPA) — data-page routing
Styling:     Custom CSS with CSS Variables (no framework)
PWA:         Progressive Web App (manifest.json + service worker)
Bilingual:   Kinyarwanda (data-rw) + English (data-en) attributes
Mobile:      Mobile-first — 320px to 414px primary targets
```

### Backend / Database
```
Platform:    Firebase (Google Cloud)
SDK:         Firebase Compat SDK v10.7.1 (browser — no bundler)
Auth:        Firebase Authentication
             — Email/Password
             — Google OAuth
             — Phone OTP (SMS)
Database:    Cloud Firestore (primary NoSQL database)
Realtime:    Firebase Realtime Database (notifications + presence)
Storage:     Firebase Storage (images + documents)
Functions:   Firebase Cloud Functions (planned — server-side logic)
Analytics:   Firebase Analytics (GA4 integrated)
```

### Active Firebase Project
```
Project ID:        komisyoneri-platform-prod
Auth Domain:       komisyoneri-platform-prod.firebaseapp.com
Database URL:      https://komisyoneri-platform-prod-default-rtdb.firebaseio.com
Storage Bucket:    komisyoneri-platform-prod.firebasestorage.app
Messaging ID:      766901928352
App ID:            1:766901928352:web:9df910b36a462e1fb524c5
Measurement ID:    G-ERRNCE85E2
```

### Hosting & DevOps
```
Hosting:     Vercel (auto-deploy from GitHub)
Repository:  GitHub (main branch = production)
Domain:      komisyoneri-platform-nu.vercel.app (live)
             www.komisiyoneri.com (target — pending DNS)
SSL:         Automatic via Vercel
```

### Third-Party Integrations (Planned)
```
MTN MoMo API       — Commission + client payments
Airtel Money API   — Alternative payments
Africa's Talking   — SMS notifications
SendGrid/EmailJS   — Email notifications
Google Maps API    — Property location + mapping
Anthropic Claude   — NOHERI AI assistant (active)
RLMUA API          — Title deed verification
RRA API            — Tax verification
WhatsApp Business  — Client communication
Google Calendar    — Viewing sync
```

### Global JavaScript Handles
```javascript
// Always available after Firebase init:
var db      = firebase.firestore();   // Main database
var rtdb    = firebase.database();    // Realtime notifications
var storage = firebase.storage();     // Files + images

// Utility functions (always available):
showPage(id)                          // SPA navigation
g(id)                                 // getElementById shortcut
showToast(message, type)              // User notifications
openModal(id) / closeModal(id)        // Modal management
switchLang('rw'|'en')                 // Language toggle
currentUser                           // Logged-in user object
logAudit(action, col, id, old, new)  // Audit trail
kmNotify(title, body, tag)            // Push notifications
```

### Cloud Functions (Planned)
```
Triggers to automate server-side:
├── onDealClose     → Calculate commission + generate invoice
├── onOfferAccepted → Create deal document + notify parties
├── onLeadCreated   → Auto-assign to available agent
├── onPaymentReceived → Update deal + send receipt
├── onDocumentSigned  → Notify all parties + update status
├── dailyReminders  → Follow-up + viewing reminders
├── monthlyReports  → Auto-generate P&L + commission reports
└── onPartnerComplete → Release payment + update rating
```

---

## 5. FIRESTORE DATABASE STRUCTURE

### Universal Document Standard
**Every document in every collection MUST have these 7 fields:**
```javascript
{
  id:        string,    // Firestore document ID
  createdAt: Timestamp, // firebase.firestore.FieldValue.serverTimestamp()
  updatedAt: Timestamp, // firebase.firestore.FieldValue.serverTimestamp()
  createdBy: string,    // UID of creator
  updatedBy: string,    // UID of last editor
  status:    string,    // document-specific status
  isActive:  boolean    // false = soft deleted
}
```

### Collection Schemas

#### `users`
```javascript
{
  // Standard fields (7)
  id, createdAt, updatedAt, createdBy, updatedBy, status, isActive,
  // User-specific
  uid:          string,    // Firebase Auth UID
  email:        string,
  displayName:  string,
  phone:        string,    // +250 7XX XXX XXX
  photoURL:     string,    // Firebase Storage URL
  role:         string,    // 'admin'|'ceo'|'staff'|'agent'|'owner'|'client'|'partner'|'investor'
  department:   string,    // for staff only
  agentId:      string,    // ref → agents (if role=agent)
  partnerId:    string,    // ref → partners (if role=partner)
  language:     string,    // 'rw'|'en'
  lastLogin:    Timestamp,
  fcmToken:     string,    // push notification token
  isVerified:   boolean,
  referralCode: string,    // unique code for referral system
  referredBy:   string,    // UID of referrer
}
```

#### `properties`
```javascript
{
  // Standard fields (7)
  id, createdAt, updatedAt, createdBy, updatedBy, status, isActive,
  // status: 'available'|'reserved'|'sold'|'rented'|'off_market'
  title:          string,
  titleRW:        string,    // Kinyarwanda title
  description:    string,
  descriptionRW:  string,
  type:           string,    // 'house'|'apartment'|'land'|'villa'|'commercial'
  purpose:        string,    // 'sale'|'rent'|'both'
  price:          number,    // RWF
  priceNegotiable:boolean,
  sizeM2:         number,
  bedrooms:       number,
  bathrooms:      number,
  floors:         number,
  yearBuilt:      number,
  district:       string,    // Rwanda district
  sector:         string,    // Rwanda sector
  cell:           string,
  village:        string,
  gpsLat:         number,
  gpsLng:         number,
  images:         array,     // Firebase Storage URLs []
  videoUrl:       string,
  tourUrl:        string,    // 3D/VR tour
  amenities:      array,     // ['parking','pool','garden',...]
  nearbyServices: array,     // ['school','hospital','market',...]
  agentId:        string,    // ref → agents
  ownerId:        string,    // ref → users (owner)
  isFeatured:     boolean,
  isVerified:     boolean,   // title deed verified
  viewCount:      number,
  saveCount:      number,
  titleDeedNumber:string,
  landUseType:    string,    // 'residential'|'commercial'|'mixed'
}
```

#### `leads`
```javascript
{
  // Standard fields (7)
  id, createdAt, updatedAt, createdBy, updatedBy, status, isActive,
  // status = CRM stage key (see CRM Pipeline below)
  clientId:      string,    // ref → users
  propertyId:    string,    // ref → properties
  agentId:       string,    // ref → users (assigned agent)
  source:        string,    // 'website'|'whatsapp'|'referral'|'walk_in'|'social'
  purpose:       string,    // 'buy'|'rent'|'invest'
  budget:        number,    // max budget RWF
  message:       string,    // initial inquiry
  priority:      string,    // 'hot'|'warm'|'cold'
  nextFollowUp:  Timestamp,
  lastContactAt: Timestamp,
  assignedAt:    Timestamp,
  notes:         array,     // [{text, authorId, createdAt}]
  activities:    array,     // [{type:'call'|'whatsapp'|'email', note, at, by}]
}
```

#### `deals`
```javascript
{
  // Standard fields (7)
  id, createdAt, updatedAt, createdBy, updatedBy, status, isActive,
  // status: 'active'|'closed_won'|'closed_lost'|'on_hold'
  leadId:        string,    // ref → leads
  propertyId:    string,    // ref → properties
  clientId:      string,    // ref → users (buyer)
  sellerId:      string,    // ref → users (seller/owner)
  agentId:       string,    // ref → users (agent)
  dealType:      string,    // 'sale'|'rent'|'management'
  agreedPrice:   number,    // RWF — final negotiated price
  stage:         string,    // current CRM stage
  stageHistory:  array,     // [{stage, changedAt, changedBy, note}]
  closedAt:      Timestamp,
  closedReason:  string,
  totalValue:    number,
  commissionRate:number,    // percentage
  commissionId:  string,    // ref → commissions (after close)
}
```

#### `offers`
```javascript
{
  // Standard fields (7)
  id, createdAt, updatedAt, createdBy, updatedBy, status, isActive,
  // status: 'pending'|'countered'|'accepted'|'rejected'|'withdrawn'
  dealId:        string,    // ref → deals
  propertyId:    string,    // ref → properties
  fromUserId:    string,    // ref → users (buyer or seller)
  toUserId:      string,    // ref → users (other party)
  amount:        number,    // RWF
  offerType:     string,    // 'initial'|'counter'
  roundNumber:   number,    // 1, 2, 3... (negotiation round)
  parentOfferId: string,    // ref → offers (if counter)
  expiresAt:     Timestamp,
  respondedAt:   Timestamp,
  note:          string,
}
```

#### `viewings`
```javascript
{
  // Standard fields (7)
  id, createdAt, updatedAt, createdBy, updatedBy, status, isActive,
  // status: 'scheduled'|'confirmed'|'completed'|'no_show'|'cancelled'
  leadId:        string,    // ref → leads
  propertyId:    string,    // ref → properties
  clientId:      string,    // ref → users
  agentId:       string,    // ref → users
  scheduledAt:   Timestamp,
  duration:      number,    // minutes
  locationType:  string,    // 'in_person'|'virtual'
  meetingUrl:    string,    // for virtual
  agentGpsLat:   number,    // GPS check-in
  agentGpsLng:   number,
  checkInAt:     Timestamp,
  checkOutAt:    Timestamp,
  report: {
    clientReaction:   string,  // 'very_interested'|'interested'|'not_interested'
    propertyCondition:string,
    issuesFound:      array,
    agentNotes:       string,
    photos:           array,   // Firebase Storage URLs
    nextStep:         string,
  },
  reminderSent:  boolean,
}
```

#### `documents`
```javascript
{
  // Standard fields (7)
  id, createdAt, updatedAt, createdBy, updatedBy, status, isActive,
  // status: 'draft'|'pending_signature'|'signed'|'archived'|'rejected'
  type:          string,    // 'title_deed'|'sale_contract'|'lease'|
                            // 'survey_report'|'legal_review'|
                            // 'mortgage_approval'|'title_transfer'|
                            // 'invoice'|'receipt'|'valuation_report'
  dealId:        string,    // ref → deals
  propertyId:    string,    // ref → properties
  clientId:      string,    // ref → users
  ownerId:       string,    // ref → users
  agentId:       string,    // ref → users
  partnerId:     string,    // ref → partners (if partner generated)
  title:         string,
  fileUrl:       string,    // Firebase Storage URL
  filePath:      string,    // Storage path
  fileSize:      number,    // bytes
  mimeType:      string,
  version:       number,    // 1, 2, 3... (version history)
  parentDocId:   string,    // ref → documents (previous version)
  signatories:   array,     // [{userId, signedAt, signatureUrl}]
  expiresAt:     Timestamp,
  isConfidential:boolean,
  accessList:    array,     // [userId, ...] — who can view
}
```

#### `commissions`
```javascript
{
  // Standard fields (7)
  id, createdAt, updatedAt, createdBy, updatedBy, status, isActive,
  // status: 'calculated'|'pending_approval'|'approved'|'paid'|'disputed'
  dealId:         string,   // ref → deals
  agentId:        string,   // ref → users
  dealValue:      number,   // RWF — total deal value
  commissionRate: number,   // percentage (e.g. 0.05 = 5%)
  totalCommission:number,   // dealValue × commissionRate
  agentShare:     number,   // totalCommission × 0.60
  companyShare:   number,   // totalCommission × 0.40
  agentPercent:   number,   // 0.60 (configurable)
  companyPercent: number,   // 0.40 (configurable)
  approvedBy:     string,   // ref → users (manager)
  approvedAt:     Timestamp,
  paidAt:         Timestamp,
  paymentMethod:  string,   // 'mtn_momo'|'bank_transfer'|'cash'
  paymentRef:     string,   // transaction reference
  invoiceId:      string,   // ref → invoices
  notes:          string,
}
```

#### `partners`
```javascript
{
  // Standard fields (7)
  id, createdAt, updatedAt, createdBy, updatedBy, status, isActive,
  // status: 'pending'|'verified'|'suspended'
  userId:        string,    // ref → users
  type:          string,    // 'surveyor'|'notaire'|'lawyer'|'bank'|
                            // 'valuer'|'contractor'|'insurance'
  companyName:   string,
  licenseNumber: string,
  licenseExpiry: Timestamp,
  districts:     array,     // districts they serve
  services:      array,     // specific services offered
  rateCard:      object,    // {serviceName: price}
  rating:        number,    // 1.0–5.0 (average)
  reviewCount:   number,
  completedJobs: number,
  bankDetails: {
    bankName:    string,
    accountName: string,
    accountNo:   string,
  },
  verifiedBy:    string,    // ref → users (admin who verified)
  verifiedAt:    Timestamp,
}
```

#### `services`
```javascript
{
  // Standard fields (7)
  id, createdAt, updatedAt, createdBy, updatedBy, status, isActive,
  // status: 'requested'|'assigned'|'in_progress'|'completed'|'cancelled'
  type:          string,    // 'valuation'|'survey'|'legal_review'|
                            // 'mortgage'|'verification'|'construction'|
                            // 'property_management'|'after_sale'
  clientId:      string,    // ref → users
  propertyId:    string,    // ref → properties
  dealId:        string,    // ref → deals (if part of deal)
  partnerId:     string,    // ref → partners (assigned)
  assignedBy:    string,    // ref → users (staff)
  assignedAt:    Timestamp,
  scheduledAt:   Timestamp,
  completedAt:   Timestamp,
  fee:           number,    // RWF agreed
  reportUrl:     string,    // Firebase Storage (final report)
  reportDocId:   string,    // ref → documents
  clientRating:  number,    // 1–5 after completion
  clientReview:  string,
  notes:         string,
}
```

#### `invoices`
```javascript
{
  // Standard fields (7)
  id, createdAt, updatedAt, createdBy, updatedBy, status, isActive,
  // status: 'draft'|'sent'|'paid'|'overdue'|'cancelled'
  invoiceNumber: string,    // INV-2026-0001 (auto-increment)
  type:          string,    // 'commission'|'service'|'management'|'other'
  clientId:      string,    // ref → users (billed to)
  dealId:        string,    // ref → deals
  commissionId:  string,    // ref → commissions
  serviceId:     string,    // ref → services
  lineItems:     array,     // [{description, quantity, unitPrice, total}]
  subtotal:      number,
  vatRate:       number,    // 0.18 (18% Rwanda VAT)
  vatAmount:     number,
  total:         number,    // RWF including VAT
  paidAmount:    number,
  balance:       number,
  dueDate:       Timestamp,
  paidAt:        Timestamp,
  paymentMethod: string,
  paymentRef:    string,
  fileUrl:       string,    // PDF storage URL
}
```

#### `notifications`
```javascript
{
  // Standard fields (7)
  id, createdAt, updatedAt, createdBy, updatedBy, status, isActive,
  // status: 'unread'|'read'|'archived'
  userId:        string,    // ref → users (recipient)
  type:          string,    // 'lead'|'deal'|'commission'|'document'|
                            // 'viewing'|'offer'|'system'|'reminder'
  title:         string,
  titleRW:       string,
  body:          string,
  bodyRW:        string,
  link:          string,    // in-app link (data-page + params)
  refId:         string,    // ID of related document
  refCollection: string,    // collection of related document
  isRead:        boolean,
  readAt:        Timestamp,
  channel:       array,     // ['push','email','sms','in_app']
}
```

#### `auditlogs`
```javascript
{
  // Standard fields (7)
  id, createdAt, updatedAt, createdBy, updatedBy, status, isActive,
  // status: 'logged' (immutable — never changes)
  action:        string,    // 'deal.status.changed'|'commission.approved'|...
  collection:    string,    // affected Firestore collection
  docId:         string,    // affected document ID
  oldValue:      object,    // previous state snapshot
  newValue:      object,    // new state snapshot
  performedBy:   string,    // ref → users (UID)
  performedAt:   Timestamp,
  userRole:      string,    // role at time of action
  sessionId:     string,    // browser session ID
  ipAddress:     string,    // if available
}
```

#### `tasks` (Office Management)
```javascript
{
  // Standard fields (7)
  id, createdAt, updatedAt, createdBy, updatedBy, status, isActive,
  // status: 'todo'|'in_progress'|'done'|'cancelled'
  title:         string,
  description:   string,
  assignedTo:    string,    // ref → users
  assignedBy:    string,    // ref → users
  department:    string,
  priority:      string,    // 'low'|'medium'|'high'|'urgent'
  dueAt:         Timestamp,
  completedAt:   Timestamp,
  relatedTo:     string,    // ref ID (deal, lead, etc.)
  relatedType:   string,    // 'deal'|'lead'|'property'
  comments:      array,     // [{text, authorId, createdAt}]
}
```

#### `attendance`
```javascript
{
  // Standard fields (7)
  id, createdAt, updatedAt, createdBy, updatedBy, status, isActive,
  userId:        string,    // ref → users (staff/agent)
  date:          string,    // 'YYYY-MM-DD'
  checkInAt:     Timestamp,
  checkOutAt:    Timestamp,
  checkInLat:    number,    // GPS
  checkInLng:    number,
  hoursWorked:   number,
  isLate:        boolean,
  lateMinutes:   number,
  note:          string,
  approvedBy:    string,    // ref → users (manager)
}
```

#### `leaves`
```javascript
{
  // Standard fields (7)
  id, createdAt, updatedAt, createdBy, updatedBy, status, isActive,
  // status: 'pending'|'approved'|'rejected'|'cancelled'
  userId:        string,    // ref → users
  type:          string,    // 'annual'|'sick'|'maternity'|'emergency'|'unpaid'
  startDate:     Timestamp,
  endDate:       Timestamp,
  days:          number,
  reason:        string,
  approvedBy:    string,    // ref → users (manager)
  approvedAt:    Timestamp,
  rejectedReason:string,
}
```

#### `payroll`
```javascript
{
  // Standard fields (7)
  id, createdAt, updatedAt, createdBy, updatedBy, status, isActive,
  // status: 'draft'|'approved'|'paid'
  userId:        string,    // ref → users
  period:        string,    // 'YYYY-MM'
  basicSalary:   number,    // RWF
  allowances:    object,    // {transport, housing, etc.}
  grossSalary:   number,
  rssb:          number,    // RSSB deduction (5%)
  paye:          number,    // Income tax (Rwanda rates)
  otherDeductions:number,
  netSalary:     number,
  commissions:   number,    // from commissions collection
  bonuses:       number,
  totalPay:      number,    // netSalary + commissions + bonuses
  payslipUrl:    string,    // PDF Firebase Storage
  paidAt:        Timestamp,
  paymentRef:    string,
}
```

#### `referrals`
```javascript
{
  // Standard fields (7)
  id, createdAt, updatedAt, createdBy, updatedBy, status, isActive,
  // status: 'pending'|'qualified'|'rewarded'|'cancelled'
  referrerId:    string,    // ref → users (who referred)
  referredId:    string,    // ref → users (who was referred)
  referralCode:  string,    // code used
  dealId:        string,    // ref → deals (when deal closes)
  rewardAmount:  number,    // RWF reward for referrer
  rewardPaid:    boolean,
  rewardPaidAt:  Timestamp,
  type:          string,    // 'client'|'agent'|'partner'
}
```

#### `expenses`
```javascript
{
  // Standard fields (7)
  id, createdAt, updatedAt, createdBy, updatedBy, status, isActive,
  // status: 'pending'|'approved'|'rejected'|'reimbursed'
  submittedBy:   string,    // ref → users
  category:      string,    // 'transport'|'marketing'|'office'|'field'|'legal'
  description:   string,
  amount:        number,    // RWF
  receiptUrl:    string,    // Firebase Storage
  expenseDate:   Timestamp,
  approvedBy:    string,    // ref → users
  approvedAt:    Timestamp,
  reimbursedAt:  Timestamp,
  paymentMethod: string,
}
```

### Firebase Storage Structure
```
/images/
  /properties/{propertyId}/{filename}
  /agents/{agentId}/{filename}
  /users/{userId}/profile/{filename}

/documents/
  /deals/{dealId}/{filename}
  /properties/{propertyId}/{filename}
  /clients/{userId}/{filename}
  /partners/{partnerId}/{filename}
  /payslips/{userId}/{period}/{filename}
  /invoices/{invoiceId}/{filename}

/reports/
  /monthly/{YYYY-MM}/{filename}
  /annual/{YYYY}/{filename}
```

---

## 6. USER ROLES

### Role Hierarchy
```
SUPER ADMIN (Platform owner — Fabrice)
└── Full access including billing, Firebase console, role assignment

ADMIN
└── Full platform access — user management, all data, all reports

CEO / DIRECTOR
└── Read all data + executive dashboard + reports
    Cannot edit operational records

STAFF / MANAGER
└── CRM, leads, deals, office tasks, HR (own dept), finance
    Cannot see other staff salaries

AGENT
└── Own leads, own deals, own commission, own calendar
    Cannot see other agents' data or clients

PROPERTY OWNER
└── Own properties, own tenants, own revenue dashboard
    Cannot see other owners' data

CLIENT
└── Own deal progress, own documents, own viewings
    Cannot see other clients' data

PARTNER (Surveyor/Notaire/Lawyer/Bank/Valuer/Contractor)
└── Assigned requests only, own invoices, own ratings
    Cannot see other partners' assignments

INVESTOR
└── Investment listings, ROI tools, portfolio (own)
    Market reports, deal performance data (anonymized)
```

### Role Permissions Matrix
```
Feature              | SuperAdmin | Admin | CEO | Staff | Agent | Owner | Client | Partner | Investor
---------------------|------------|-------|-----|-------|-------|-------|--------|---------|----------
All users data       | ✅ | ✅ | 👁️ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌
Properties (all)     | ✅ | ✅ | 👁️ | ✅ | Own| Own| ❌ | ❌ | 👁️
Leads (all)          | ✅ | ✅ | 👁️ | ✅ | Own| ❌ | ❌ | ❌ | ❌
Deals (all)          | ✅ | ✅ | 👁️ | ✅ | Own| Own| Own| ❌ | ❌
Commissions          | ✅ | ✅ | 👁️ | ✅ | Own| ❌ | ❌ | ❌ | ❌
Finance/P&L          | ✅ | ✅ | 👁️ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌
HR/Payroll           | ✅ | ✅ | 👁️ | Dept| ❌ | ❌ | ❌ | ❌ | ❌
Partner requests     | ✅ | ✅ | 👁️ | ✅ | ❌ | ❌ | ❌ | Own| ❌
Audit logs           | ✅ | ✅ | 👁️ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌
System config        | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌
Investment data      | ✅ | ✅ | 👁️ | ❌ | ❌ | ❌ | ❌ | ❌ | Own
```
`✅ = Full CRUD | 👁️ = Read only | Own = Own data only | Dept = Own department`

---

## 7. DESIGN RULES

### Philosophy
```
PROFESSIONAL — Every pixel reflects a trusted, established company
MODERN       — Clean, contemporary design — not outdated or cluttered
CORPORATE    — Suitable for banks, government, and high-net-worth clients
MOBILE FIRST — 80%+ of Rwandan users access on mobile
RW FOCUSED   — Kinyarwanda primary, Rwanda geography, local context
```

### Color System (CSS Variables — NEVER change these names)
```css
--navy:  #0D3B8C;   /* Primary brand — headers, CTAs, trust elements */
--blue:  #1249B3;   /* Secondary — links, accents, hover states */
--gold:  #C9A84C;   /* Accent — highlights, badges, premium indicators */
--dark:  #0A0F1E;   /* Deep dark — backgrounds, text on light */
--light: #F4F6FB;   /* Off-white — section backgrounds, cards */
--tr:    all .25s ease;  /* Global transition */

/* Supporting (use sparingly): */
--success: #16A34A;
--error:   #DC2626;
--warning: #D97706;
--info:    #0369A1;
```

### Typography Rules
```
Headings:  'Cormorant Garamond', serif — luxury, professional
Body:      'Inter', sans-serif — clean, readable
Mono:      'Courier New', monospace — data, codes

Minimum sizes:
  Body text:   14px
  Labels:      12px
  Touch areas: 44×44px minimum
```

### Component Standards

**Buttons:**
```css
.btn-gold   /* Primary CTA — gold background, dark text */
.btn-ghost  /* Secondary — transparent, navy border */
.btn-navy   /* Tertiary — navy background, white text */
```

**Cards:**
```css
.p-card     /* Property card — image + details */
.card       /* Generic content card */
.s-card     /* Search/filter card */
/* All cards: white bg, border-radius 12-22px, subtle shadow */
```

**Modals:**
```html
<!-- ALWAYS start with style="display:none" -->
<div class="modal-wrap" id="modal-id" style="display:none">
  <div class="modal">
    <button class="modal-close" onclick="closeModal('modal-id')">✕</button>
    <h2 class="modal-title" data-rw="..." data-en="...">...</h2>
  </div>
</div>
```

**Forms:**
```html
<div class="field">
  <label data-rw="..." data-en="...">Label</label>
  <input type="text" placeholder="...">
</div>
```

**Status Badges:**
```css
/* Use inline style with brand colors: */
background: var(--gold);  /* pending */
background: #16A34A;      /* success/active */
background: #DC2626;      /* error/rejected */
background: var(--navy);  /* info/processing */
```

### Mobile Breakpoints
```css
/* Mobile first — base styles for 320px */
@media (min-width: 480px)  { /* Large mobile */ }
@media (min-width: 660px)  { /* Small tablet */ }
@media (min-width: 768px)  { /* Tablet */ }
@media (min-width: 1024px) { /* Desktop */ }
@media (min-width: 1280px) { /* Large desktop */ }

/* Critical mobile targets in Rwanda: */
320px — Samsung Galaxy A series
360px — Most Android phones
375px — iPhone SE
390px — iPhone 14/15
414px — iPhone Plus
```

---

## 8. CRM PIPELINE

### 13 Stages (Immutable — never remove or rename)
```javascript
const CRM_STAGES = [
  { id:1,  key:'new',               labelRW:'Nshya',                  labelEN:'New Lead',           color:'#64748B' },
  { id:2,  key:'contacted',         labelRW:'Yahamagariwe',           labelEN:'Contacted',           color:'#0369A1' },
  { id:3,  key:'qualified',         labelRW:'Yemejwe',                labelEN:'Qualified',           color:'#1249B3' },
  { id:4,  key:'viewing_scheduled', labelRW:'Kuzabona Yateganijwe',   labelEN:'Viewing Scheduled',  color:'#7C3AED' },
  { id:5,  key:'viewing_completed', labelRW:'Yabonye Inzu',           labelEN:'Viewing Completed',  color:'#9333EA' },
  { id:6,  key:'offer_submitted',   labelRW:'Offer Yoherejwe',        labelEN:'Offer Submitted',    color:'#C9A84C' },
  { id:7,  key:'negotiation',       labelRW:'Ikiganiro',              labelEN:'Negotiation',         color:'#D97706' },
  { id:8,  key:'due_diligence',     labelRW:'Kugenzura',              labelEN:'Due Diligence',       color:'#EA580C' },
  { id:9,  key:'financing',         labelRW:'Inguzanyo',              labelEN:'Financing',           color:'#DC2626' },
  { id:10, key:'contract',          labelRW:'Amasezerano',            labelEN:'Contract Stage',      color:'#0D3B8C' },
  { id:11, key:'closing',           labelRW:'Gufunga',                labelEN:'Closing',             color:'#0D3B8C' },
  { id:12, key:'closed_won',        labelRW:'Byarangiye ✅',          labelEN:'Closed Won',          color:'#16A34A' },
  { id:13, key:'closed_lost',       labelRW:'Byanze ❌',              labelEN:'Closed Lost',         color:'#DC2626' },
];
```

---

## 9. COMMISSION ENGINE RULES

```javascript
const COMMISSION_RATES = {
  sale:                { min: 0.03, max: 0.05, default: 0.05 },
  rent:                { type: 'flat', value: '1_month_rent' },
  property_management: { min: 0.08, max: 0.12, default: 0.10, recurring: true },
  valuation:           { type: 'flat', min: 30000, max: 150000 },
  surveying:           { type: 'flat', min: 50000, max: 200000 },
  legal:               { type: 'flat', min: 50000, max: 250000 },
  mortgage_referral:   { min: 0.005, max: 0.01 },
  construction:        { min: 0.05, max: 0.10 },
};

const COMMISSION_SPLIT = {
  agentPercent:   0.60,   // 60% to agent
  companyPercent: 0.40,   // 40% to KOMISIYONERI
};

// Example: Sale 59,000,000 RWF × 5% = 2,950,000 RWF
// Agent: 1,770,000 RWF | Company: 1,180,000 RWF
```

---

## 10. ROADMAP

### Phase 1 — Stabilization ✅ DONE
```
✅ CSS cascade bug fixed (.s-card rule)
✅ Invisible overlay bug fixed (#pay-modal)
✅ SyntaxError apostrophe bugs fixed (showToast calls)
✅ Firebase project updated (komisyoneri-platform-prod)
✅ Google OAuth config updated
✅ Canonical URLs fixed (Vercel URL)
✅ Mobile CSS improvements (320px–414px)
🔄 Google OAuth origin_mismatch (Google Cloud Console — pending)
🔄 Firebase Security Rules (Firestore — pending)
🔄 PWA icons (pending)
```

### Phase 2 — Lead Management 🔴 NEXT
```
Capture leads from all platform touchpoints
CRM pipeline (13 stages) — Kanban view
Auto-assignment to available agents
Activity logging (calls, WhatsApp, emails)
Follow-up reminders (rtdb schedulers)
Lead source attribution (utm tracking)
```

### Phase 3 — Deal Management 🔴
```
Viewing scheduling + agent calendar
Offer submission (buyer-facing form)
Counter-offer system (seller response)
Negotiation audit trail (timestamped)
Deal pipeline dashboard
Viewing reports (mobile form — GPS)
```

### Phase 4 — Commission Engine 🔴
```
Auto-trigger on deal close
Rate configuration (per deal type)
60/40 split calculation
Manager approval workflow
PDF payslip generation
MTN MoMo payout integration
```

### Phase 5 — Verification Center 🔴
```
Title deed verification request flow
Seller identity checklist
Survey request → partner assignment
Due diligence report management
Fraud prevention workflow
```

### Phase 6 — Document Vault 🔴
```
"My Property Folder" per client
Auto-generated PDF contracts
Digital signature workflow
Document version history
Role-based access control per document
```

### Phase 7 — Partner Portal (Full) 🔴
```
Individual dashboards per partner type
Request management + acceptance
Rapport upload system
Rating + review collection
Payment + invoice management
```

### Phase 8 — Financing Hub 🔴
```
Public affordability calculator
Mortgage application workflow
Bank matching algorithm
Loan status tracker (client view)
```

### Phase 9 — Customer Portal (Full) 🔴
```
Complete deal journey tracker
Document vault access
Mortgage status
Viewing history
Agent communication hub
```

### Phase 10 — Office Management 🔴
```
Task management system
GPS attendance tracking
Internal approval workflows
Team communication (replace WhatsApp groups)
Performance review system
```

### Phase 11 — HR System 🔴
```
Employee records + contracts
Leave request + approval
Payroll (RSSB + PAYE compliant)
PDF payslip auto-generation
Performance tracking
```

### Phase 12 — Accounting & Finance 🔴
```
Invoice auto-generation
Expense management
P&L reports (monthly auto)
Cashflow tracker
RRA-compliant tax reports
```

### Phase 13 — Executive Dashboard 🔴
```
Real-time CEO KPIs
Revenue vs target
Pipeline value
Geographic heatmap
AI-powered 3-scenario forecasts
```

### Phase 14 — Business Intelligence 🔴
```
ROI per zone/type/agent
Market price trends
Buyer profile analysis
Custom report builder
Data export (CSV/PDF)
```

### Phase 15 — National Expansion 🔴
```
Multi-branch management (Musanze, Rubavu, Huye)
Branch manager dashboards
Inter-branch deal routing
East Africa expansion (Nairobi, Kampala)
```

---

## 11. SECURITY RULES (Firebase Firestore)

### Helper Functions
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // ── Helpers ──────────────────────────────────────────
    function isAuth() {
      return request.auth != null;
    }
    function getRole() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role;
    }
    function isRole(role) {
      return isAuth() && getRole() == role;
    }
    function isAnyRole(roles) {
      return isAuth() && getRole() in roles;
    }
    function isOwner(userId) {
      return isAuth() && request.auth.uid == userId;
    }
    function isAdminOrStaff() {
      return isAnyRole(['admin', 'super_admin', 'staff']);
    }
    function isCEO() {
      return isAnyRole(['admin', 'super_admin', 'ceo']);
    }
    function hasStandardFields() {
      return request.resource.data.keys().hasAll([
        'createdAt','updatedAt','createdBy','updatedBy','status','isActive'
      ]);
    }

    // ── users ─────────────────────────────────────────────
    match /users/{userId} {
      allow read:   if isAuth() && (isOwner(userId) || isAdminOrStaff() || isCEO());
      allow create: if isAuth() && isOwner(userId) && hasStandardFields();
      allow update: if isAuth() && (isOwner(userId) || isAdminOrStaff())
                    && hasStandardFields();
      allow delete: if false;
    }

    // ── properties ────────────────────────────────────────
    match /properties/{propId} {
      allow read:   if true;  // Public marketplace
      allow create: if isAnyRole(['admin','super_admin','staff','agent','owner'])
                    && hasStandardFields();
      allow update: if isAnyRole(['admin','super_admin','staff'])
                    || (isRole('agent')
                        && resource.data.agentId == request.auth.uid)
                    || (isRole('owner')
                        && resource.data.ownerId == request.auth.uid);
      allow delete: if false;
    }

    // ── leads ─────────────────────────────────────────────
    match /leads/{leadId} {
      allow read:   if isAdminOrStaff() || isCEO()
                    || (isRole('agent')
                        && resource.data.agentId == request.auth.uid)
                    || (isRole('client')
                        && resource.data.clientId == request.auth.uid);
      allow create: if isAuth() && hasStandardFields();
      allow update: if isAdminOrStaff()
                    || (isRole('agent')
                        && resource.data.agentId == request.auth.uid);
      allow delete: if false;
    }

    // ── deals ─────────────────────────────────────────────
    match /deals/{dealId} {
      allow read:   if isAdminOrStaff() || isCEO()
                    || (isRole('agent')   && resource.data.agentId  == request.auth.uid)
                    || (isRole('client')  && resource.data.clientId == request.auth.uid)
                    || (isRole('owner')   && resource.data.sellerId == request.auth.uid);
      allow create: if isAnyRole(['admin','super_admin','staff','agent'])
                    && hasStandardFields();
      allow update: if isAdminOrStaff()
                    || (isRole('agent') && resource.data.agentId == request.auth.uid);
      allow delete: if false;
    }

    // ── offers ────────────────────────────────────────────
    match /offers/{offerId} {
      allow read:   if isAdminOrStaff()
                    || resource.data.fromUserId == request.auth.uid
                    || resource.data.toUserId   == request.auth.uid;
      allow create: if isAuth() && hasStandardFields();
      allow update: if isAdminOrStaff()
                    || resource.data.toUserId == request.auth.uid;
      allow delete: if false;
    }

    // ── commissions ───────────────────────────────────────
    match /commissions/{comId} {
      allow read:   if isAdminOrStaff() || isCEO()
                    || (isRole('agent') && resource.data.agentId == request.auth.uid);
      allow create: if isAdminOrStaff() && hasStandardFields();
      allow update: if isAdminOrStaff();
      allow delete: if false;
    }

    // ── documents ─────────────────────────────────────────
    match /documents/{docId} {
      allow read:   if isAdminOrStaff()
                    || request.auth.uid in resource.data.accessList;
      allow create: if isAuth() && hasStandardFields();
      allow update: if isAdminOrStaff()
                    || request.auth.uid in resource.data.accessList;
      allow delete: if false;
    }

    // ── auditlogs — immutable ─────────────────────────────
    match /auditlogs/{logId} {
      allow read:   if isCEO() || isAnyRole(['admin','super_admin']);
      allow create: if isAuth() && hasStandardFields();
      allow update: if false;  // IMMUTABLE
      allow delete: if false;  // IMMUTABLE
    }

    // ── invoices ──────────────────────────────────────────
    match /invoices/{invId} {
      allow read:   if isAdminOrStaff() || isCEO()
                    || resource.data.clientId == request.auth.uid;
      allow create: if isAdminOrStaff() && hasStandardFields();
      allow update: if isAdminOrStaff();
      allow delete: if false;
    }

    // ── partners ──────────────────────────────────────────
    match /partners/{partnerId} {
      allow read:   if isAdminOrStaff() || isCEO()
                    || resource.data.userId == request.auth.uid;
      allow create: if isAuth() && hasStandardFields();
      allow update: if isAdminOrStaff()
                    || resource.data.userId == request.auth.uid;
      allow delete: if false;
    }

    // ── services ──────────────────────────────────────────
    match /services/{svcId} {
      allow read:   if isAdminOrStaff()
                    || resource.data.clientId  == request.auth.uid
                    || resource.data.partnerId == request.auth.uid;
      allow create: if isAuth() && hasStandardFields();
      allow update: if isAdminOrStaff()
                    || resource.data.partnerId == request.auth.uid;
      allow delete: if false;
    }

    // ── tasks ─────────────────────────────────────────────
    match /tasks/{taskId} {
      allow read:   if isAdminOrStaff()
                    || resource.data.assignedTo == request.auth.uid;
      allow create: if isAdminOrStaff() && hasStandardFields();
      allow update: if isAdminOrStaff()
                    || resource.data.assignedTo == request.auth.uid;
      allow delete: if false;
    }

    // ── attendance ────────────────────────────────────────
    match /attendance/{attId} {
      allow read:   if isAdminOrStaff()
                    || resource.data.userId == request.auth.uid;
      allow create: if isAuth() && hasStandardFields()
                    && request.resource.data.userId == request.auth.uid;
      allow update: if isAdminOrStaff();
      allow delete: if false;
    }

    // ── payroll ───────────────────────────────────────────
    match /payroll/{payId} {
      allow read:   if isAnyRole(['admin','super_admin'])
                    || resource.data.userId == request.auth.uid;
      allow create: if isAnyRole(['admin','super_admin']) && hasStandardFields();
      allow update: if isAnyRole(['admin','super_admin']);
      allow delete: if false;
    }

    // ── notifications ─────────────────────────────────────
    match /notifications/{notifId} {
      allow read:   if resource.data.userId == request.auth.uid || isAdminOrStaff();
      allow create: if isAuth() && hasStandardFields();
      allow update: if resource.data.userId == request.auth.uid;
      allow delete: if false;
    }

    // ── referrals ─────────────────────────────────────────
    match /referrals/{refId} {
      allow read:   if isAdminOrStaff()
                    || resource.data.referrerId == request.auth.uid
                    || resource.data.referredId == request.auth.uid;
      allow create: if isAuth() && hasStandardFields();
      allow update: if isAdminOrStaff();
      allow delete: if false;
    }
  }
}
```

---

## 12. NON-NEGOTIABLE RULES

```
1.  Never break existing functionality
2.  Never remove existing features
3.  Keep backward compatibility at all times
4.  Protect company and client data — always
5.  Follow Firebase security best practices
6.  Never generate Next.js/React/Tailwind code (Vanilla JS only)
7.  Never use import/export statements (no bundler)
8.  Never use unescaped apostrophes in JavaScript strings
9.  Never create duplicate features, collections, or workflows
10. Never hard-delete Firestore documents — use isActive: false
11. Every document must have all 7 standard fields
12. Use Firestore Timestamps only — never JavaScript Date objects
13. Always add logAudit() on every critical action
14. Always maintain bilingual support (data-rw + data-en)
15. Always test on 320px minimum screen width
```

---

## 13. LONG-TERM VISION

### 3-Year Vision
```
Year 1 (2026): Rwanda's #1 Real Estate Platform
  → 500+ properties, 20+ agents, 15+ deals/month
  → All 28 K-REOS modules operational

Year 2 (2027): East Africa Expansion
  → Launch in Uganda (Kampala)
  → Launch in Kenya (Nairobi)
  → 5,000+ properties across EA
  → Mobile apps (iOS + Android)

Year 3 (2028): Real Estate OS Standard
  → White-label platform for other African RE companies
  → API marketplace for third-party integrations
  → AI-powered property valuation engine
  → 50,000+ registered users across East Africa
```

### Revenue Model (Long-Term)
```
Transaction Commissions:     40% of revenue
Service Marketplace Fees:    25% of revenue
Property Management Fees:    20% of revenue
SaaS/Subscription (agents):  10% of revenue
Data & Reports:               5% of revenue
```
Official Production Domain:
https://komisiyoneri.co.rw

All production examples, documentation, metadata, SEO, branding, and generated code should use this domain unless explicitly instructed otherwise.
### "Become the leading commission-driven real estate ecosystem in Rwanda and East Africa — where every stakeholder profits when a property changes hands."

---

*KOMISIYONERI ConnectPro Services Ltd — Kigali, Rwanda*
*K-REOS Master Context v1.0 — June 2026*
*Modules: 28 | Collections: 21 | Roles: 8 | Phases: 15*
*CONFIDENTIAL — Internal Engineering Use Only*
*GitHub: /docs/KOMISIYONERI_MASTER_CONTEXT.md*
