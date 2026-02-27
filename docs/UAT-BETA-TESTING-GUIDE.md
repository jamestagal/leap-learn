# WebKit Beta Tester UAT Guide

**Version:** 1.0
**Last Updated:** January 2026
**For:** Beta Testers

---

## Table of Contents

1. [Getting Started](#1-getting-started)
2. [Dashboard & Navigation](#2-dashboard--navigation)
3. [Consultations](#3-consultations)
4. [Proposals](#4-proposals)
5. [Contracts](#5-contracts)
6. [Invoices](#6-invoices)
7. [Clients](#7-clients)
8. [Forms](#8-forms)
9. [Settings](#9-settings)
10. [Billing & Subscription](#10-billing--subscription)
11. [Email System](#11-email-system)
12. [End-to-End Workflows](#12-end-to-end-workflows)
13. [Permission Testing](#13-permission-testing)
14. [Known Issues & Feedback](#14-known-issues--feedback)

---

## 1. Getting Started

### 1.1 Account Creation

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1.1.1 | Navigate to `app.webkit.au` (or `localhost:3000` for local testing) | Login page displayed |
| 1.1.2 | Click "Sign in with Email" | Email input field shown |
| 1.1.3 | Enter your email and submit | "Check your email" message displayed |
| 1.1.4 | Click magic link in email | Redirected to app, logged in |
| 1.1.5 | If new user with beta invite: Create agency form shown | Agency name input with invite token pre-filled |
| 1.1.6 | Enter agency name and submit | Dashboard loads, "Beta Access" badge visible |

### 1.2 First Login Checklist

- [ ] Magic link email received within 2 minutes
- [ ] Login redirects to correct agency (owner agency if multiple)
- [ ] Beta/Freemium badge visible in billing section
- [ ] All navigation items accessible

---

## 2. Dashboard & Navigation

### 2.1 Dashboard Overview

| Test ID | Action | Expected Result | Pass/Fail |
|---------|--------|-----------------|-----------|
| 2.1.1 | View dashboard after login | Quick stats cards visible (consultations, proposals, contracts, invoices) | |
| 2.1.2 | Check agency name in header | Correct agency name and logo displayed | |
| 2.1.3 | Click each navigation item | Corresponding page loads without error | |

### 2.2 Agency Switcher (Multi-Agency Users)

| Test ID | Action | Expected Result | Pass/Fail |
|---------|--------|-----------------|-----------|
| 2.2.1 | Click agency name in sidebar | Agency switcher dropdown appears | |
| 2.2.2 | Select different agency | Page reloads with new agency context | |
| 2.2.3 | Verify role badge | Correct role shown (Owner/Admin/Member) | |

### 2.3 Demo Data (Testing Aid)

| Test ID | Action | Expected Result | Pass/Fail |
|---------|--------|-----------------|-----------|
| 2.3.1 | Go to Settings → Demo Data | Demo data management page loads | |
| 2.3.2 | Click "Load Demo Data" | Sample consultation, proposal, contract, invoice created | |
| 2.3.3 | Navigate to each section | Demo data visible in respective lists | |
| 2.3.4 | Click "Clear Demo Data" | All demo data removed | |

---

## 3. Consultations

### 3.1 Create New Consultation

| Test ID | Action | Expected Result | Pass/Fail |
|---------|--------|-----------------|-----------|
| 3.1.1 | Click "New Consultation" | 4-step form wizard opens | |
| 3.1.2 | **Step 1 - Contact Info:** Fill business name, contact, email, phone | Fields validate, Next button enabled | |
| 3.1.3 | Enter website URL and click "Run Audit" | PageSpeed audit runs, scores displayed | |
| 3.1.4 | Click Next | Progress to Step 2 | |
| 3.1.5 | **Step 2 - Current Situation:** Select industry, challenges, digital presence | Dropdowns populated with agency options | |
| 3.1.6 | Click Next | Progress to Step 3 | |
| 3.1.7 | **Step 3 - Goals & Budget:** Select goals, budget range, urgency | Fields save correctly | |
| 3.1.8 | Click Next | Progress to Step 4 | |
| 3.1.9 | **Step 4 - Design Preferences:** Add notes, preferences | Free text fields work | |
| 3.1.10 | Click "Complete Consultation" | Success page shown, consultation saved | |

### 3.2 Draft Saving

| Test ID | Action | Expected Result | Pass/Fail |
|---------|--------|-----------------|-----------|
| 3.2.1 | Start new consultation, fill Step 1 | Data entered | |
| 3.2.2 | Navigate away (click different nav item) | Draft auto-saved warning appears | |
| 3.2.3 | Return to consultations, click "Resume Draft" | Previous data restored | |

### 3.3 Consultation History

| Test ID | Action | Expected Result | Pass/Fail |
|---------|--------|-----------------|-----------|
| 3.3.1 | Navigate to Consultation History | List of all consultations shown | |
| 3.3.2 | Click on a consultation | Detail view opens | |
| 3.3.3 | Click "Create Proposal" from consultation | Proposal form pre-filled with consultation data | |
| 3.3.4 | Click "Edit" on own consultation | Edit form opens | |
| 3.3.5 | Click "Delete" on own consultation | Confirmation dialog, then deleted | |

---

## 4. Proposals

### 4.1 Create Proposal

| Test ID | Action | Expected Result | Pass/Fail |
|---------|--------|-----------------|-----------|
| 4.1.1 | Click "New Proposal" | Proposal creation form opens | |
| 4.1.2 | Search and select existing client | Client details auto-populated | |
| 4.1.3 | Or create new client inline | New client created and linked | |
| 4.1.4 | Select service package(s) | Package pricing displayed | |
| 4.1.5 | Add optional add-ons | Add-on pricing added to total | |
| 4.1.6 | Adjust pricing (custom override) | Total updates correctly | |
| 4.1.7 | Fill ROI Analysis section | Projections calculated | |
| 4.1.8 | Add timeline phases | Week-by-week plan visible | |
| 4.1.9 | Save as Draft | Proposal saved, appears in list | |

### 4.2 AI Proposal Generation

| Test ID | Action | Expected Result | Pass/Fail |
|---------|--------|-----------------|-----------|
| 4.2.1 | Create proposal linked to consultation | Consultation data available | |
| 4.2.2 | Click "Generate with AI" | AI generates proposal content | |
| 4.2.3 | Review generated content | Content relevant to consultation | |
| 4.2.4 | Edit AI-generated content | Can modify as needed | |

### 4.3 Send & Share Proposal

| Test ID | Action | Expected Result | Pass/Fail |
|---------|--------|-----------------|-----------|
| 4.3.1 | Click "Send" on proposal | Email composition modal opens | |
| 4.3.2 | Customize message and send | Email sent confirmation | |
| 4.3.3 | Check email log | Email appears with "sent" status | |
| 4.3.4 | Copy public link | Link copied to clipboard | |
| 4.3.5 | Open public link in incognito | Proposal visible without login | |
| 4.3.6 | Export as PDF | PDF downloads with correct branding | |

### 4.4 Proposal Status Tracking

| Test ID | Action | Expected Result | Pass/Fail |
|---------|--------|-----------------|-----------|
| 4.4.1 | View proposal list | Status badges visible (Draft/Sent/Viewed) | |
| 4.4.2 | Client views proposal (via public link) | Status changes to "Viewed" | |

---

## 5. Contracts

### 5.1 Create Contract

| Test ID | Action | Expected Result | Pass/Fail |
|---------|--------|-----------------|-----------|
| 5.1.1 | Click "New Contract" | Contract creation form opens | |
| 5.1.2 | Select contract template | Template terms loaded | |
| 5.1.3 | Link to client | Client details populated | |
| 5.1.4 | Fill pricing fields (setup fee, monthly, one-time) | Calculations correct | |
| 5.1.5 | Set validity dates | Date pickers work correctly | |
| 5.1.6 | Configure field visibility | Can show/hide specific fields | |
| 5.1.7 | Add schedule (package-specific terms) | Schedule attached | |
| 5.1.8 | Save contract | Contract saved to list | |

### 5.2 Create Contract from Proposal

| Test ID | Action | Expected Result | Pass/Fail |
|---------|--------|-----------------|-----------|
| 5.2.1 | Open accepted proposal | "Convert to Contract" button visible | |
| 5.2.2 | Click "Convert to Contract" | Contract form pre-filled from proposal | |
| 5.2.3 | Package and pricing carried over | Values match proposal | |

### 5.3 Contract Signing Flow

| Test ID | Action | Expected Result | Pass/Fail |
|---------|--------|-----------------|-----------|
| 5.3.1 | Send contract to client | Email with signing link sent | |
| 5.3.2 | Open signing link (as client) | Contract displayed with signature area | |
| 5.3.3 | Client enters name and signs | Signature captured | |
| 5.3.4 | Submit signature | Contract status → "Signed" | |
| 5.3.5 | View signed contract as agency | Client signature and timestamp visible | |
| 5.3.6 | Download signed PDF | PDF includes both signatures | |

### 5.4 Contract Templates

| Test ID | Action | Expected Result | Pass/Fail |
|---------|--------|-----------------|-----------|
| 5.4.1 | Go to Settings → Contracts | Template list shown | |
| 5.4.2 | Create new template | Template editor opens | |
| 5.4.3 | Add terms with merge fields (`{{clientName}}`, `{{agencyName}}`) | Fields saved | |
| 5.4.4 | Configure cover page options | Show/hide logo, addresses | |
| 5.4.5 | Set as default template | Default badge shown | |
| 5.4.6 | Create contract using template | Merge fields replaced with actual values | |

---

## 6. Invoices

### 6.1 Create Invoice

| Test ID | Action | Expected Result | Pass/Fail |
|---------|--------|-----------------|-----------|
| 6.1.1 | Click "New Invoice" | Invoice creation form opens | |
| 6.1.2 | Select or create client | Client details populated | |
| 6.1.3 | Add line items (description, qty, price) | Line items displayed | |
| 6.1.4 | Mark items as taxable/non-taxable | Tax calculations adjust | |
| 6.1.5 | Select payment terms (NET 7/14/30) | Due date calculated | |
| 6.1.6 | Preview invoice | Preview shows formatted invoice | |
| 6.1.7 | Save invoice | Invoice saved to list | |

### 6.2 Create Invoice from Contract

| Test ID | Action | Expected Result | Pass/Fail |
|---------|--------|-----------------|-----------|
| 6.2.1 | Open signed contract | "Create Invoice" button visible | |
| 6.2.2 | Click "Create Invoice" | Invoice pre-filled from contract pricing | |

### 6.3 Send & Track Invoice

| Test ID | Action | Expected Result | Pass/Fail |
|---------|--------|-----------------|-----------|
| 6.3.1 | Send invoice to client | Email with PDF attached sent | |
| 6.3.2 | Invoice status → "Sent" | Status badge updated | |
| 6.3.3 | Send reminder for overdue invoice | Reminder email sent | |

### 6.4 Record Payment

| Test ID | Action | Expected Result | Pass/Fail |
|---------|--------|-----------------|-----------|
| 6.4.1 | Open sent invoice | "Record Payment" button visible | |
| 6.4.2 | Enter payment amount and method | Payment recorded | |
| 6.4.3 | Invoice status → "Paid" | Status updated, amount shown | |
| 6.4.4 | Partial payment | "Partially Paid" status with balance | |

### 6.5 Invoice Numbering

| Test ID | Action | Expected Result | Pass/Fail |
|---------|--------|-----------------|-----------|
| 6.5.1 | Go to Settings → Profile → Document Defaults | Invoice prefix setting visible | |
| 6.5.2 | Set custom prefix (e.g., "INV-") | Prefix saved | |
| 6.5.3 | Create new invoice | Invoice number uses custom prefix | |
| 6.5.4 | Numbers auto-increment | Each new invoice gets next number | |

---

## 7. Clients

### 7.1 Client Management

| Test ID | Action | Expected Result | Pass/Fail |
|---------|--------|-----------------|-----------|
| 7.1.1 | Navigate to Clients | Client list displayed | |
| 7.1.2 | Search for client by name | Filtered results shown | |
| 7.1.3 | Click "Add Client" | Client creation form opens | |
| 7.1.4 | Fill required fields and save | Client created, appears in list | |
| 7.1.5 | Click on client name | Client detail page opens | |
| 7.1.6 | View linked documents | Proposals, contracts, invoices listed | |
| 7.1.7 | Archive client | Client moved to archived list | |
| 7.1.8 | Filter by archived | Archived clients shown | |
| 7.1.9 | Restore archived client | Client back to active | |

### 7.2 Auto-Created Clients

| Test ID | Action | Expected Result | Pass/Fail |
|---------|--------|-----------------|-----------|
| 7.2.1 | Create consultation with new client info | Consultation saved | |
| 7.2.2 | Check clients list | Client auto-created from consultation | |

---

## 8. Forms

### 8.1 Form Builder

| Test ID | Action | Expected Result | Pass/Fail |
|---------|--------|-----------------|-----------|
| 8.1.1 | Go to Settings → Forms | Forms list displayed | |
| 8.1.2 | Click "Create Form" | Form builder opens | |
| 8.1.3 | Enter form name and slug | Basic info saved | |
| 8.1.4 | Add fields using drag-and-drop | Fields added to form | |
| 8.1.5 | Configure field validation | Validation rules set | |
| 8.1.6 | Preview form | Form preview displayed | |
| 8.1.7 | Save and activate form | Form available for submissions | |

### 8.2 Form Submissions

| Test ID | Action | Expected Result | Pass/Fail |
|---------|--------|-----------------|-----------|
| 8.2.1 | Copy public form link | Link copied | |
| 8.2.2 | Open link and submit form | Submission successful | |
| 8.2.3 | View submissions in app | Submission data visible | |

---

## 9. Settings

### 9.1 Agency Profile

| Test ID | Action | Expected Result | Pass/Fail |
|---------|--------|-----------------|-----------|
| 9.1.1 | Go to Settings → Agency Profile | Profile form displayed | |
| 9.1.2 | Fill business registration (ABN/ACN) | Saved correctly | |
| 9.1.3 | Fill address details | Saved correctly | |
| 9.1.4 | Fill banking details | Saved correctly | |
| 9.1.5 | Enable GST registration | GST settings shown | |
| 9.1.6 | Add social media links | Links saved | |
| 9.1.7 | Verify profile appears in documents | Info shows on proposals/contracts | |

### 9.2 Branding

| Test ID | Action | Expected Result | Pass/Fail |
|---------|--------|-----------------|-----------|
| 9.2.1 | Go to Settings → Branding | Branding page loads | |
| 9.2.2 | Upload agency logo | Logo previewed and saved | |
| 9.2.3 | Upload avatar logo (square) | Avatar shown in UI | |
| 9.2.4 | Set primary color | Color picker works, saved | |
| 9.2.5 | Set secondary color | Color applied to UI elements | |
| 9.2.6 | Set accent color | Color applied to highlights | |
| 9.2.7 | Generate PDF document | Branding colors/logo appear | |

### 9.3 Team Members

| Test ID | Action | Expected Result | Pass/Fail |
|---------|--------|-----------------|-----------|
| 9.3.1 | Go to Settings → Members | Member list displayed | |
| 9.3.2 | Click "Invite Member" | Invite form opens | |
| 9.3.3 | Enter email and select role | Invitation sent | |
| 9.3.4 | View pending invitations | Invitation listed with status | |
| 9.3.5 | Resend invitation | New email sent | |
| 9.3.6 | Cancel invitation | Invitation removed | |
| 9.3.7 | (As Owner) Change member role | Role updated | |
| 9.3.8 | Remove member | Member removed from agency | |

### 9.4 Packages

| Test ID | Action | Expected Result | Pass/Fail |
|---------|--------|-----------------|-----------|
| 9.4.1 | Go to Settings → Packages | Package list displayed | |
| 9.4.2 | Create new package | Package form opens | |
| 9.4.3 | Set pricing model (subscription/lump sum/hybrid) | Appropriate fields shown | |
| 9.4.4 | Add included features | Features list saved | |
| 9.4.5 | Set minimum term | Term saved | |
| 9.4.6 | Reorder packages (drag) | Order persisted | |
| 9.4.7 | Duplicate package | Copy created with "(Copy)" suffix | |
| 9.4.8 | Deactivate package | Package hidden from proposals | |

### 9.5 Add-ons

| Test ID | Action | Expected Result | Pass/Fail |
|---------|--------|-----------------|-----------|
| 9.5.1 | Go to Settings → Add-ons | Add-on list displayed | |
| 9.5.2 | Create new add-on | Add-on form opens | |
| 9.5.3 | Set pricing type (one-time/monthly/per-unit) | Correct fields shown | |
| 9.5.4 | Link to specific packages | Package restrictions saved | |
| 9.5.5 | Create proposal and verify add-ons | Only linked add-ons available | |

---

## 10. Billing & Subscription

### 10.1 View Billing Status

| Test ID | Action | Expected Result | Pass/Fail |
|---------|--------|-----------------|-----------|
| 10.1.1 | Go to Settings → Billing | Billing page loads | |
| 10.1.2 | View current plan badge | Correct tier displayed (Free/Starter/Growth/Enterprise) | |
| 10.1.3 | View usage statistics | Members, consultations, AI generations shown | |
| 10.1.4 | View progress bars | Usage percentages accurate | |

### 10.2 Freemium/Beta Status

| Test ID | Action | Expected Result | Pass/Fail |
|---------|--------|-----------------|-----------|
| 10.2.1 | If beta user: See "Beta Access" banner | Banner with expiry date visible | |
| 10.2.2 | Verify enterprise features accessible | All features work despite "free" tier | |

### 10.3 Upgrade Subscription

| Test ID | Action | Expected Result | Pass/Fail |
|---------|--------|-----------------|-----------|
| 10.3.1 | View available plans | Starter, Growth, Enterprise displayed | |
| 10.3.2 | Toggle Monthly/Yearly | Prices update accordingly | |
| 10.3.3 | Click "Upgrade" on plan | Stripe checkout opens | |
| 10.3.4 | Complete checkout (test mode) | Redirected back to billing page | |
| 10.3.5 | Verify plan updated | New tier badge shown | |

### 10.4 Manage Billing (Paying Customers)

| Test ID | Action | Expected Result | Pass/Fail |
|---------|--------|-----------------|-----------|
| 10.4.1 | Click "Manage Billing" | Stripe billing portal opens | |
| 10.4.2 | Update payment method | Card updated successfully | |
| 10.4.3 | View invoice history | Past invoices listed | |
| 10.4.4 | Cancel subscription | Cancellation processed | |

---

## 11. Email System

### 11.1 Email Delivery

| Test ID | Action | Expected Result | Pass/Fail |
|---------|--------|-----------------|-----------|
| 11.1.1 | Send proposal via email | Email delivered to recipient | |
| 11.1.2 | Send contract via email | Email with signing link delivered | |
| 11.1.3 | Send invoice via email | Email with PDF attached delivered | |

### 11.2 Email Log

| Test ID | Action | Expected Result | Pass/Fail |
|---------|--------|-----------------|-----------|
| 11.2.1 | Navigate to Emails | Email log displayed | |
| 11.2.2 | View email status | Status badges (Sent/Failed/Opened) shown | |
| 11.2.3 | Click on email entry | Email details displayed | |
| 11.2.4 | Resend failed email | New email sent | |

---

## 12. End-to-End Workflows

### 12.1 Complete Sales Workflow

This workflow tests the entire consultation-to-payment flow.

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Create new consultation | Consultation saved |  |
| 2 | Complete all 4 steps with real data | Client info, challenges, goals captured |  |
| 3 | Create proposal from consultation | Data pre-filled from consultation |  |
| 4 | Add package and 2 add-ons | Pricing calculated correctly |  |
| 5 | Fill ROI analysis | Projections displayed |  |
| 6 | Save and send proposal | Email sent to client |  |
| 7 | Open proposal as client (public link) | Proposal displays correctly |  |
| 8 | Convert proposal to contract | Contract pre-filled |  |
| 9 | Send contract for signing | Client receives signing link |  |
| 10 | Sign contract as client | Signature captured |  |
| 11 | Create invoice from contract | Invoice pre-filled |  |
| 12 | Send invoice | Client receives invoice email |  |
| 13 | Record payment | Invoice marked as paid |  |
| **Verify** | Check client profile | All documents linked |  |
| **Verify** | Check email log | All emails tracked |  |

### 12.2 Multi-User Collaboration Workflow

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Owner invites Admin user | Invitation email sent |  |
| 2 | Admin accepts invitation | Admin can access agency |  |
| 3 | Owner invites Member user | Invitation sent |  |
| 4 | Member accepts invitation | Member can access agency |  |
| 5 | Member creates consultation | Consultation visible to all |  |
| 6 | Admin creates proposal | Proposal visible to all |  |
| 7 | Member tries to access billing | Access denied (correct) |  |
| 8 | Admin tries to change roles | Action denied (Owner only) |  |
| 9 | Owner changes Admin to Member | Role updated |  |
| 10 | Ex-Admin loses admin privileges | Settings restricted |  |

---

## 13. Permission Testing

### 13.1 Owner Permissions

| Test ID | Permission | Expected | Pass/Fail |
|---------|------------|----------|-----------|
| 13.1.1 | Access all consultations | ✓ Allowed | |
| 13.1.2 | Access all proposals | ✓ Allowed | |
| 13.1.3 | Access billing settings | ✓ Allowed | |
| 13.1.4 | Change member roles | ✓ Allowed | |
| 13.1.5 | Delete agency | ✓ Allowed | |
| 13.1.6 | Connect Stripe | ✓ Allowed | |
| 13.1.7 | Export all data (GDPR) | ✓ Allowed | |

### 13.2 Admin Permissions

| Test ID | Permission | Expected | Pass/Fail |
|---------|------------|----------|-----------|
| 13.2.1 | Access all consultations | ✓ Allowed | |
| 13.2.2 | Access all proposals | ✓ Allowed | |
| 13.2.3 | Access billing settings | ✗ Denied | |
| 13.2.4 | Change member roles | ✗ Denied | |
| 13.2.5 | Invite new members | ✓ Allowed | |
| 13.2.6 | Edit agency branding | ✓ Allowed | |
| 13.2.7 | Manage packages/add-ons | ✓ Allowed | |

### 13.3 Member Permissions

| Test ID | Permission | Expected | Pass/Fail |
|---------|------------|----------|-----------|
| 13.3.1 | Create own consultations | ✓ Allowed | |
| 13.3.2 | View all consultations | ✗ Denied (own only) | |
| 13.3.3 | Access settings | ✗ Denied | |
| 13.3.4 | Create proposals | ✓ Allowed | |
| 13.3.5 | Edit others' proposals | ✗ Denied | |
| 13.3.6 | Send contracts | ✓ Allowed | |
| 13.3.7 | Record payments | ✗ Denied | |

---

## 14. Known Issues & Feedback

### How to Report Issues

1. **Take a screenshot** of the issue
2. **Note the URL** where the issue occurred
3. **Describe steps to reproduce**
4. **Check browser console** for errors (F12 → Console tab)
5. **Email to:** support@webkit.au

### Feedback Form

Please complete after testing:

| Question | Your Response |
|----------|---------------|
| Overall ease of use (1-10) | |
| Most useful feature | |
| Most confusing feature | |
| Missing features you expected | |
| Performance issues noticed | |
| Mobile experience (if tested) | |
| Would you recommend to a colleague? | |
| Additional comments | |

---

## Appendix A: Test Data Suggestions

### Sample Client Data
```
Business: Murray's Plumbing Services
Contact: Murray Johnson
Email: murray@example.com
Phone: 0412 345 678
Website: https://example-plumber.com
Industry: Trade Services
Budget: $5,000 - $10,000
```

### Sample Package
```
Name: Professional Website Package
Setup Fee: $2,500
Monthly: $199
Includes: 5 pages, contact form, SEO basics
Term: 12 months
```

---

## Appendix B: Browser Compatibility

Please test on at least one of these browsers:

| Browser | Minimum Version | Tested? |
|---------|-----------------|---------|
| Chrome | 100+ | |
| Firefox | 100+ | |
| Safari | 15+ | |
| Edge | 100+ | |

---

## Appendix C: Test Account Credentials

*For local testing only - production uses magic link authentication*

| Email | Password | Role |
|-------|----------|------|
| (Your beta invite email) | Magic Link | Owner |

---

**Thank you for being a beta tester!**

Your feedback is invaluable in making WebKit the best platform for web agencies.

Questions? Contact us at support@webkit.au
