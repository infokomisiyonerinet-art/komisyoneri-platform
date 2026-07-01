# KOMISIYONERI User Journey & Next-Step Optimization — Report

**Date:** 2026-07-01
**Branch:** `claude/komisiyoneri-performance-audit-2ucyyb`
**Scope:** "One Clear Next Step" audit across key pages and multi-field forms, building on the prior performance/mobile/conversion sessions on this branch.

## Summary

Two research passes audited five hub pages (Listings, Property Detail, Dashboard, CRM, Auth) and every major form/modal for competing CTAs and missing step guidance. Three pages were already clear and needed no changes — confirmed directly rather than assumed, so effort went to the two genuinely weak spots: the property detail page (10 competing action buttons) and the Add Property form (27 fields in one flat scroll with no progress indicator, despite two other forms in the codebase already using a proven step-wizard pattern).

## Pages audited, and verdict

| Page | Verdict | Action taken |
|---|---|---|
| **Property Detail** (`#page-detail`) | 🔴 Severely cluttered — 10 equal-weight action buttons, no primary/secondary distinction | **Redesigned** — see below |
| **Add Property form** (`add-prop-modal`) | 🔴 27 fields in one flat scroll, no progress indicator | **Converted to a 3-step wizard** |
| **Listings/Search** (`#page-listings`) | 🟢 Already clear — one obvious primary action ("Apply Filters"), sort/view-toggle correctly subordinate | No change needed |
| **Dashboard landing** (`#page-dashboard`) | 🟢 Already clear — "Add Listing" (navy) visually distinguished from CRM/Analytics (outline) quick actions | No change needed |
| **CRM/Leads** (`#page-crm`) | 🟢 Already clear — one primary "New Lead" button, view-toggle/filters correctly subordinate | No change needed |
| **Auth page** (`#page-auth`) | 🟡 Moderately cluttered for first-time visitors (3 role tabs + 3 auth methods at similar weight) — lower severity, not addressed this pass | Deferred (see below) |
| **Lead capture form** (`lead-modal`) | 🟢 Already good — 7 fields, no grouping needed at that size, contextual success message (names the agent, promises 2-hour callback) | No change needed |
| **Agent Registration** (`agent-reg-modal`) | 🟢 Already a proper 3-step wizard with a visible progress bar and contextual "24-hour review" success message | No change needed — this became the template reused for Add Property |
| **Site Submission** (`site-submit-modal`) | 🟢 Already a proper 4-step wizard with numbered step dots | No change needed |

## What was fixed

### 1. Property Detail page — one primary CTA instead of ten competing buttons
The agent-card action area (`index.html:3706`, `.ag-acts`) stacked 10 full-width, mostly equal-weight buttons: Chat, Call, WhatsApp, Schedule Visit, Submit Offer, Get an Agent (with a gold-gradient override making it look almost-but-not-quite primary), Send Message, Mortgage Calc, Compare, and Pay Deposit. A visitor had no way to tell which one mattered most — and five of them (Chat/Call/WhatsApp/Message/Get-an-Agent) were really just different channels for the same underlying intent: "I want to talk to someone about this property."

**Redesigned into three tiers, with every existing `onclick` handler preserved exactly:**
- **Primary** (one large gold button, top): "Get an Agent — Fast!" with its existing "responds within 2 hours" promise now shown directly beneath it.
- **Secondary** (two medium outline buttons, side by side): "Schedule Visit" and "Submit Offer" — meaningful next steps for a more decided visitor.
- **Contact row** (four compact 44×44px icon buttons): Chat, Call, WhatsApp, Message — same channels, same handlers, just visually demoted to "more ways to reach us" instead of competing with the primary action.
- **Tertiary utility links** (small text links): Mortgage Calc, Compare, Pay Deposit.

No functionality was removed — every one of the original 10 actions still fires the exact same function it did before.

### 2. Add Property form — converted to a 3-step wizard
This form had the most friction in the whole audit: 27 fields (type, service, district, sector, price, beds, baths, size, description, contact, title, year, deed, floors, parking, 7 amenity checkboxes, 3 document links, GPS coordinates, video/tour/image fields) all visible in one continuous scroll, with only color-coded section headers and no progress feedback — while the Agent Registration and Site Submission forms elsewhere in the same codebase already use a clean step-bar wizard pattern.

**Fix:** reused that exact existing pattern rather than inventing a new one. The form is now split into:
- **Step 1 — Basic Info**: type, service, district, sector, price, beds/baths, size, description, contact (the fields every listing needs).
- **Step 2 — Details & Documents**: the "extra details," documents, and coordinates sections that were already visually grouped, now behind Back/Continue.
- **Step 3 — Photos**: the media upload section, with Back and Submit.

A progress bar (`.prop-step-bar`, styled identically to the existing `.agent-step-bar`) and a step label ("Step 2/3 — Details & Documents") show progress at all times. The new `propStep()` function is a direct copy of the existing `agentStep()` function's logic — same show/hide-by-ID approach, no new pattern introduced. The wizard resets to step 1 both when adding a new property and when editing an existing pending one, so users never land mid-wizard unexpectedly. `submitProperty()` itself was not touched — it already reads all fields by ID regardless of which step is currently visible, so editing/submission logic works exactly as before.

### 3. Standardized the Add Property success message
Found inconsistent "what happens next" messaging: the Lead form and Agent Registration already tell users exactly what to expect ("agent will call within 2 hours," "reviewed within 24 hours"), but the Add Property submission just said "✅ Property submitted for review!" with no timeline. Updated all three occurrences of this message (Firebase Storage path, base64 fallback path, and the edit-save path) to match the existing "24-hour" review convention already used for agent applications: *"✅ Property submitted! We'll review it within 24 hours and notify you once it's approved."*

## What was deliberately not done this pass

- **Auth page's 3 role tabs + 3 auth methods** — rated "moderately cluttered" rather than severe, and the default state (Buyer/Renter tab active, email/password as the visually dominant form) already guides most visitors reasonably. Lower priority than the two fixes above; flagged for a future pass if you want it tightened further.
- **Internal admin/staff tool pages** (HR, Accounting, Office Management, Branches, Executive dashboard, BI) were not audited for CTA clarity in this pass — these are staff-only operational tools, not part of the visitor-facing conversion journey the brief is focused on, and auditing all of them exhaustively would be a substantially larger undertaking than the confirmed, high-traffic pages covered here.
- **Branch Create and other flat 10+-field internal forms** were identified as also lacking step indicators, but these are low-traffic, staff-only forms — lower priority than the visitor-facing Add Property form that was fixed.

## Verification performed
- Every inline `<script>` block passed `node --check` after each edit batch.
- Chromium/Playwright: confirmed the wizard's three steps show/hide correctly, the progress bar changes color as steps advance, and the step label text updates.
- Confirmed the detail page's redesigned action area has exactly one `.btn-gold.btn-lg` primary button, 4 compact contact-icon buttons, and 3 tertiary text links — matching the intended hierarchy.
- Mobile viewports (320/375/414px): zero horizontal overflow in either the wizard modal or the redesigned action area; contact icon buttons measure 44×44px (meeting this branch's established touch-target standard); the primary CTA remains visible and prominent at every width.
- Same sandbox constraint as prior sessions: external CDNs are blocked here, so live Firestore submission couldn't be exercised end-to-end — the fixes were verified structurally and via direct function calls instead.

## Bottom line
Users can now complete their two highest-friction goals — deciding what to do on a property's detail page, and listing their own property — with meaningfully less effort: one obvious next step instead of ten competing buttons, and a guided 3-step form with visible progress instead of a 27-field wall of inputs. The pages that were already good (Listings, Dashboard, CRM, Lead capture, Agent Registration, Site Submission) were verified and left alone rather than changed for the sake of it.
