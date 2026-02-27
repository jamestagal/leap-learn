# Consultation Form Analysis

This document provides a detailed analysis of the current 4-step consultation flow, including all questions, field types, and available options. Use this as a reference for improving the form design.

## Overview

| Step | Component | Title | Required Fields |
|------|-----------|-------|-----------------|
| 1 | `ClientInfoForm.svelte` | Contact Information | Email |
| 2 | `BusinessContext.svelte` | Business Context | Industry, Business Type |
| 3 | `PainPointsCapture.svelte` | Pain Points & Challenges | Primary Challenges, Urgency Level |
| 4 | `GoalsObjectives.svelte` | Goals & Objectives | Primary Goals, Budget Range |

---

## Step 1: Contact Information

**Component:** `ClientInfoForm.svelte`
**Purpose:** Collect basic contact and business details

### Fields

| Field | Type | Required | Validation | Notes |
|-------|------|----------|------------|-------|
| Business Name | Text | No | None | Autocomplete: organization |
| Contact Person | Text | No | None | Autocomplete: name |
| Email Address | Email | **Yes** | Email format regex | Autocomplete: email |
| Phone Number | Tel | No | Auto-formats to (XXX) XXX-XXXX | Autocomplete: tel |
| Website | URL | No | Valid URL, auto-adds https:// | Autocomplete: url |
| Social Media Profiles | JSON Textarea | No | Valid JSON format | Quick-add buttons for LinkedIn, Twitter, Facebook, Instagram |

### UX Features
- Auto-focus on Business Name field on mount
- Auto-format phone numbers as user types
- Auto-prepend `https://` to website if missing
- Quick-add buttons for social media platforms
- Real-time validation feedback with icons

---

## Step 2: Business Context

**Component:** `BusinessContext.svelte`
**Purpose:** Understand the business and current digital presence

### Fields

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Industry | Dropdown | **Yes** | 16 options |
| Business Type | Dropdown | **Yes** | 7 options |
| Team Size | Number | No | Min: 1, Max: 10,000 |
| Current Platform | Text | No | Freeform (e.g., WordPress, Shopify) |
| Digital Presence | Multi-select chips | No | 11 preset options + custom |
| Marketing Channels | Multi-select chips | No | 17 preset options + custom |

### Industry Options (16)

| Value | Label |
|-------|-------|
| technology | Technology & Software |
| healthcare | Healthcare & Medical |
| finance | Finance & Banking |
| retail | Retail & E-commerce |
| manufacturing | Manufacturing |
| education | Education |
| real-estate | Real Estate |
| hospitality | Hospitality & Tourism |
| legal | Legal Services |
| marketing | Marketing & Advertising |
| construction | Construction |
| automotive | Automotive |
| food-beverage | Food & Beverage |
| entertainment | Entertainment & Media |
| nonprofit | Non-Profit |
| other | Other |

### Business Type Options (7)

| Value | Label |
|-------|-------|
| startup | Startup (< 2 years) |
| small-business | Small Business (2-10 employees) |
| medium-business | Medium Business (11-50 employees) |
| enterprise | Enterprise (50+ employees) |
| freelancer | Freelancer / Sole Proprietor |
| agency | Agency |
| nonprofit | Non-Profit Organization |

### Digital Presence Options (11)

| Value | Label |
|-------|-------|
| website | Company Website |
| ecommerce | E-commerce Store |
| blog | Blog |
| social-facebook | Facebook |
| social-instagram | Instagram |
| social-linkedin | LinkedIn |
| social-twitter | Twitter/X |
| social-youtube | YouTube |
| social-tiktok | TikTok |
| mobile-app | Mobile App |
| none | No Digital Presence |

### Marketing Channels Options (17)

| Value | Label |
|-------|-------|
| seo | SEO / Organic Search |
| ppc | PPC / Paid Ads |
| social-media | Social Media Marketing |
| email | Email Marketing |
| content | Content Marketing |
| influencer | Influencer Marketing |
| affiliate | Affiliate Marketing |
| referral | Referral Program |
| events | Events & Trade Shows |
| pr | Public Relations |
| direct-mail | Direct Mail |
| cold-outreach | Cold Outreach |
| partnerships | Strategic Partnerships |
| print | Print Advertising |
| radio-tv | Radio/TV Advertising |
| word-of-mouth | Word of Mouth |
| none | No Active Marketing |

---

## Step 3: Pain Points & Challenges

**Component:** `PainPointsCapture.svelte`
**Purpose:** Identify current problems and pain points

### Fields

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Primary Challenges | Multi-select chips | **Yes** | 20 preset options + custom |
| Technical Issues | Multi-select chips | No | 20 preset options + custom |
| Urgency Level | Dropdown | **Yes** | 4 options with color coding |
| Impact Assessment | Textarea | No | Freeform description |
| Current Solution Gaps | Multi-select chips | No | 20 preset options + custom |

### Urgency Level Options (4)

| Value | Label | Color |
|-------|-------|-------|
| low | Low - Exploratory phase | Green |
| medium | Medium - Planning for next quarter | Yellow |
| high | High - Need to start within weeks | Orange |
| critical | Critical - Urgent need | Red |

### Primary Challenges Options (20)

| Value | Label |
|-------|-------|
| lead-generation | Lead Generation |
| conversion-rate | Low Conversion Rates |
| brand-awareness | Brand Awareness |
| customer-retention | Customer Retention |
| competition | Competitive Pressure |
| scaling | Scaling Operations |
| cost-management | Cost Management |
| talent-acquisition | Talent Acquisition |
| technology-adoption | Technology Adoption |
| data-management | Data Management |
| customer-experience | Customer Experience |
| market-expansion | Market Expansion |
| regulatory-compliance | Regulatory Compliance |
| supply-chain | Supply Chain Issues |
| cash-flow | Cash Flow Management |
| digital-transformation | Digital Transformation |
| product-development | Product Development |
| customer-acquisition-cost | High Customer Acquisition Cost |
| market-positioning | Market Positioning |
| other | Other |

### Technical Issues Options (20)

| Value | Label |
|-------|-------|
| slow-website | Slow Website Performance |
| mobile-optimization | Poor Mobile Experience |
| seo-issues | SEO Problems |
| security-concerns | Security Vulnerabilities |
| integration-issues | System Integration Problems |
| outdated-platform | Outdated Technology Stack |
| scalability | Scalability Limitations |
| data-silos | Data Silos |
| automation-gaps | Lack of Automation |
| analytics-tracking | Poor Analytics/Tracking |
| email-deliverability | Email Deliverability Issues |
| crm-issues | CRM Problems |
| payment-processing | Payment Processing Issues |
| hosting-issues | Hosting/Uptime Problems |
| accessibility | Accessibility Compliance |
| api-limitations | API Limitations |
| backup-recovery | Backup/Recovery Concerns |
| content-management | Content Management Difficulties |
| user-experience | Poor User Experience |
| none | No Technical Issues |

### Current Solution Gaps Options (20)

| Value | Label |
|-------|-------|
| no-crm | No CRM System |
| no-email-marketing | No Email Marketing Platform |
| no-analytics | No Analytics Solution |
| no-automation | No Marketing Automation |
| no-ecommerce | No E-commerce Platform |
| no-booking | No Booking/Scheduling System |
| no-chat | No Live Chat/Support System |
| no-social-management | No Social Media Management |
| no-project-management | No Project Management Tool |
| no-invoicing | No Invoicing System |
| no-inventory | No Inventory Management |
| no-hr-system | No HR Management System |
| no-document-management | No Document Management |
| no-collaboration | No Collaboration Tools |
| no-reporting | No Reporting Dashboard |
| no-mobile-app | No Mobile App |
| no-customer-portal | No Customer Portal |
| no-loyalty-program | No Loyalty Program |
| no-review-management | No Review Management |
| other | Other Gap |

---

## Step 4: Goals & Objectives

**Component:** `GoalsObjectives.svelte`
**Purpose:** Define objectives, timeline, budget, and success metrics

### Fields

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Primary Goals | Multi-select chips | **Yes** | 15 preset options + custom |
| Secondary Goals | Multi-select chips | No | 15 preset options + custom |
| Desired Start Date | Date picker | No | - |
| Target Completion Date | Date picker | No | - |
| Key Milestones | Text list | No | Custom entries only |
| Budget Range | Dropdown | **Yes** | 9 options |
| Budget Constraints | Multi-select chips | No | 15 preset options + custom |
| Success Metrics | Multi-select chips | No | 15 preset options + custom |
| KPIs | Multi-select chips | No | 15 preset options + custom |

### Primary Goals Options (15)

| Value | Label |
|-------|-------|
| increase-revenue | Increase Revenue |
| generate-leads | Generate More Leads |
| improve-conversion | Improve Conversion Rates |
| build-brand | Build Brand Awareness |
| enter-new-market | Enter New Markets |
| launch-product | Launch New Product/Service |
| improve-retention | Improve Customer Retention |
| reduce-costs | Reduce Operational Costs |
| automate-processes | Automate Business Processes |
| improve-efficiency | Improve Team Efficiency |
| enhance-experience | Enhance Customer Experience |
| digital-presence | Establish Digital Presence |
| competitive-advantage | Gain Competitive Advantage |
| data-driven | Become Data-Driven |
| sustainability | Improve Sustainability |

### Secondary Goals Options (15)

| Value | Label |
|-------|-------|
| improve-seo | Improve SEO Rankings |
| social-engagement | Increase Social Engagement |
| email-list | Grow Email List |
| content-strategy | Develop Content Strategy |
| mobile-optimization | Optimize for Mobile |
| analytics-setup | Set Up Analytics |
| crm-implementation | Implement CRM |
| process-documentation | Document Processes |
| team-training | Train Team Members |
| vendor-consolidation | Consolidate Vendors |
| security-improvement | Improve Security |
| compliance | Achieve Compliance |
| partnerships | Build Partnerships |
| customer-feedback | Gather Customer Feedback |
| brand-refresh | Refresh Brand Identity |

### Budget Range Options (9)

| Value | Label |
|-------|-------|
| under-5k | Under $5,000 |
| 5k-10k | $5,000 - $10,000 |
| 10k-25k | $10,000 - $25,000 |
| 25k-50k | $25,000 - $50,000 |
| 50k-100k | $50,000 - $100,000 |
| 100k-250k | $100,000 - $250,000 |
| 250k-500k | $250,000 - $500,000 |
| 500k-plus | $500,000+ |
| tbd | To Be Determined |

### Budget Constraints Options (15)

| Value | Label |
|-------|-------|
| fixed-budget | Fixed Annual Budget |
| monthly-cap | Monthly Spending Cap |
| approval-required | Requires Board/Executive Approval |
| roi-dependent | Contingent on ROI Projections |
| phased-spending | Phased Spending Approach |
| cash-flow | Cash Flow Dependent |
| grant-funded | Grant/External Funding |
| seasonal | Seasonal Budget Variations |
| cost-sharing | Cost Sharing with Partners |
| payment-terms | Extended Payment Terms Needed |
| milestone-based | Milestone-Based Payments |
| retainer | Prefer Retainer Model |
| project-based | Project-Based Pricing |
| performance | Performance-Based Pricing |
| flexible | Flexible / No Constraints |

### Success Metrics Options (15)

| Value | Label |
|-------|-------|
| revenue-growth | Revenue Growth (%) |
| lead-volume | Lead Volume |
| conversion-rate | Conversion Rate |
| customer-acquisition | Customer Acquisition Cost |
| customer-lifetime | Customer Lifetime Value |
| website-traffic | Website Traffic |
| organic-ranking | Organic Search Rankings |
| email-engagement | Email Open/Click Rates |
| social-followers | Social Media Followers |
| nps-score | Net Promoter Score (NPS) |
| churn-rate | Churn Rate |
| time-to-market | Time to Market |
| employee-satisfaction | Employee Satisfaction |
| cost-reduction | Cost Reduction (%) |
| market-share | Market Share |

### KPI Options (15)

| Value | Label |
|-------|-------|
| monthly-revenue | Monthly Recurring Revenue (MRR) |
| qualified-leads | Marketing Qualified Leads (MQLs) |
| sales-qualified | Sales Qualified Leads (SQLs) |
| deal-velocity | Deal Velocity |
| average-deal | Average Deal Size |
| win-rate | Win Rate |
| pipeline-value | Pipeline Value |
| customer-satisfaction | Customer Satisfaction (CSAT) |
| first-response | First Response Time |
| resolution-time | Resolution Time |
| active-users | Active Users |
| engagement-rate | Engagement Rate |
| bounce-rate | Bounce Rate |
| page-load | Page Load Time |
| uptime | System Uptime |

---

## Data Structure

### Stored Consultation Data

```typescript
interface ConsultationData {
  // Step 1: Contact Info
  contact_info: {
    business_name?: string;
    contact_person?: string;
    email?: string;       // Required
    phone?: string;
    website?: string;
    social_media?: Record<string, string>;
  };

  // Step 2: Business Context
  business_context: {
    industry?: string;           // Required
    business_type?: string;      // Required
    team_size?: number;
    current_platform?: string;
    digital_presence?: string[];
    marketing_channels?: string[];
  };

  // Step 3: Pain Points
  pain_points: {
    primary_challenges?: string[];   // Required (min 1)
    technical_issues?: string[];
    urgency_level?: 'low' | 'medium' | 'high' | 'critical';  // Required
    impact_assessment?: string;
    current_solution_gaps?: string[];
  };

  // Step 4: Goals & Objectives
  goals_objectives: {
    primary_goals?: string[];    // Required (min 1)
    secondary_goals?: string[];
    success_metrics?: string[];
    kpis?: string[];
    budget_range?: string;       // Required
    budget_constraints?: string[];
    timeline?: {
      desired_start?: string;      // ISO date
      target_completion?: string;  // ISO date
      milestones?: string[];
    };
  };
}
```

---

## Customization

Agencies can customize dropdown options per category via the `agency_form_options` table. The 14 customizable categories are:

1. `industry`
2. `business_type`
3. `budget_range`
4. `urgency_level`
5. `primary_challenges`
6. `technical_issues`
7. `solution_gaps`
8. `digital_presence`
9. `marketing_channels`
10. `primary_goals`
11. `secondary_goals`
12. `success_metrics`
13. `kpis`
14. `budget_constraints`

---

## Total Field Count Summary

| Category | Total Options |
|----------|---------------|
| Industry | 16 |
| Business Type | 7 |
| Digital Presence | 11 |
| Marketing Channels | 17 |
| Urgency Level | 4 |
| Primary Challenges | 20 |
| Technical Issues | 20 |
| Solution Gaps | 20 |
| Budget Range | 9 |
| Primary Goals | 15 |
| Secondary Goals | 15 |
| Success Metrics | 15 |
| KPIs | 15 |
| Budget Constraints | 15 |
| **Total** | **199 preset options** |

---

## Planned Customize Step (Not Implemented)

The planned `/consultation/customize` step (Step 7 of 8) would allow clients to:

### Add-on Selection
After selecting a service package, clients can add optional services:

```typescript
interface Addon {
  id: string;
  name: string;
  category: string;           // e.g., "seo", "content", "design"
  price: number;
  billingType: 'monthly' | 'one-time';
  description: string;
  value: string;              // What they get
}
```

### Customization Options
- **Feature toggles**: Enable/disable specific features within packages
- **Quantity adjustments**: e.g., number of pages, blog posts per month
- **Priority settings**: Which features are most important
- **Scope modifications**: Expand or reduce package scope
- **Timeline preferences**: Rush delivery, phased rollout

### Database Tables (Planned)

```sql
-- Add-ons table
CREATE TABLE addons (
    id UUID PRIMARY KEY,
    agency_id UUID REFERENCES agencies(id),
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    price DECIMAL(10,2),
    billing_type TEXT CHECK (billing_type IN ('monthly', 'one-time')),
    description TEXT,
    value_proposition TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    display_order INTEGER DEFAULT 0
);

-- Proposal customizations
-- Stored in proposals.customizations JSONB field
```

### UI Components (Planned)

- `AddonSelector.svelte` - Grid of available add-ons
- `AddonCard.svelte` - Individual add-on display with pricing
- `AddonPricing.svelte` - Running total calculator
- `CustomizationForm.svelte` - Feature toggles and quantity inputs

---

## Data Cross-Population Matrix

Consultation data captured in the form flows into and populates downstream documents throughout the client lifecycle. This eliminates redundant data entry.

### Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              DATA FLOW                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│    CONSULTATION ──┬──▶ PROPOSAL ──┬──▶ CONTRACT ──▶ INVOICE                 │
│    (Steps 1-4)    │               │                    │                    │
│                   │               │                    ▼                    │
│                   │               │            QUESTIONNAIRE                │
│                   │               │                    │                    │
│                   │               │                    ▼                    │
│                   │               └──────────▶ CONTENT BRIEF                │
│                   │                                    │                    │
│                   └────────────────────────────────────┼─▶ AI SEO CONTENT   │
│                                                        ▼                    │
│                                                   DEVELOPMENT               │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Field-to-Document Mapping

This matrix shows exactly which consultation fields populate which documents:

#### Step 1: Contact Information → Document Usage

| Consultation Field | Proposal | Contract | Invoice | Questionnaire | Emails |
|--------------------|:--------:|:--------:|:-------:|:-------------:|:------:|
| `business_name` | ✅ Client section | ✅ Party B name | ✅ Bill To | ✅ Pre-fill | ✅ Greeting |
| `contact_person` | ✅ Addressed to | ✅ Signatory | ✅ Attention | ✅ Pre-fill | ✅ Dear X |
| `email` | ✅ Contact info | ✅ Party B contact | ✅ Bill To | ✅ Pre-fill | ✅ To address |
| `phone` | ✅ Contact info | ✅ Party B contact | ✅ Bill To | — | — |
| `website` | ✅ Audit target | ✅ Reference URL | — | ✅ Current site | ✅ Links |
| `social_media` | — | — | — | ✅ Pre-fill | — |

#### Step 2: Business Context → Document Usage

| Consultation Field | Proposal | Contract | Invoice | Questionnaire | AI Content |
|--------------------|:--------:|:--------:|:-------:|:-------------:|:----------:|
| `industry` | ✅ Executive summary | ✅ Scope context | — | ✅ Industry section | ✅ Keywords |
| `business_type` | ✅ Analysis | ✅ Scope context | — | ✅ Pre-fill | ✅ Tone |
| `team_size` | ✅ Sizing recommendation | — | — | — | — |
| `current_platform` | ✅ Migration analysis | ✅ Technical scope | — | ✅ Pre-fill | — |
| `digital_presence` | ✅ Current state | ✅ Integration scope | — | ✅ Pre-fill | ✅ Channels |
| `marketing_channels` | ✅ Strategy alignment | — | — | ✅ Pre-fill | ✅ SEO focus |

#### Step 3: Pain Points → Document Usage

| Consultation Field | Proposal | Contract | Invoice | Questionnaire | AI Content |
|--------------------|:--------:|:--------:|:-------:|:-------------:|:----------:|
| `primary_challenges` | ✅ Problem statement | ✅ Scope justification | — | — | ✅ Solutions copy |
| `technical_issues` | ✅ Technical analysis | ✅ Technical scope | — | ✅ Pre-fill | ✅ Features to highlight |
| `urgency_level` | ✅ Timeline priority | ✅ Delivery terms | — | — | — |
| `impact_assessment` | ✅ ROI narrative | — | — | — | ✅ Value props |
| `current_solution_gaps` | ✅ Opportunity analysis | ✅ Deliverables | — | ✅ What's needed | ✅ Benefits |

#### Step 4: Goals & Objectives → Document Usage

| Consultation Field | Proposal | Contract | Invoice | Questionnaire | AI Content |
|--------------------|:--------:|:--------:|:-------:|:-------------:|:----------:|
| `primary_goals` | ✅ Objectives section | ✅ Success criteria | — | ✅ Goals reminder | ✅ Headlines/CTAs |
| `secondary_goals` | ✅ Nice-to-haves | ✅ Optional scope | — | ✅ Pre-fill | ✅ Secondary copy |
| `success_metrics` | ✅ KPI targets | ✅ Acceptance criteria | — | — | ✅ Social proof |
| `kpis` | ✅ Measurement plan | ✅ Reporting requirements | — | — | — |
| `budget_range` | ✅ Package recommendation | ✅ Payment terms | ✅ Invoice total | — | — |
| `budget_constraints` | ✅ Payment options | ✅ Payment schedule | ✅ Terms | — | — |
| `timeline.desired_start` | ✅ Project timeline | ✅ Start date | — | — | — |
| `timeline.target_completion` | ✅ Project timeline | ✅ Delivery date | — | — | — |
| `timeline.milestones` | ✅ Phase breakdown | ✅ Milestone payments | ✅ Invoicing schedule | — | — |

### Merge Field Syntax

Documents use a consistent merge field syntax for auto-population:

```handlebars
{{client.business_name}}        → "Acme Corp"
{{client.contact_person}}       → "John Smith"
{{client.email}}                → "john@acme.com"
{{client.phone}}                → "(555) 123-4567"
{{client.website_url}}          → "https://acme.com"
{{client.industry}}             → "Technology & Software"
{{client.business_type}}        → "Small Business (2-10 employees)"
{{client.team_size}}            → "8"
{{client.goals}}                → "• Increase Revenue\n• Generate More Leads"
{{client.challenges}}           → "• Lead Generation\n• Low Conversion Rates"
{{client.budget_range}}         → "$10,000 - $25,000"
{{client.timeline_start}}       → "February 1, 2026"
{{client.timeline_end}}         → "April 30, 2026"
```

### Auto-Population Rules

| Document Section | Data Source | Can Override? |
|------------------|-------------|:-------------:|
| **Proposal Header** | Agency Profile (logo, name, contact) | No |
| **Proposal Client Section** | Consultation (all client fields) | Yes |
| **Proposal Analysis** | Consultation + PageSpeed audit | Editable |
| **Proposal Package Recommendation** | Consultation (budget, goals) | Editable |
| **Contract Party A** | Agency Profile | No |
| **Contract Party B** | Consultation (client details) | Yes |
| **Contract Schedule A** | Proposal (package, pricing) | Editable |
| **Invoice Header** | Agency Profile | No |
| **Invoice Bill To** | Consultation (client details) | Yes |
| **Invoice Line Items** | Proposal (package + add-ons) | Editable |
| **Invoice Bank Details** | Agency Profile | No |
| **Questionnaire Pre-fill** | Consultation (business, industry) | Editable |
| **Content Brief** | Consultation + Questionnaire | Generated |
| **AI SEO Content** | Consultation + Questionnaire | Suggestions |

### AI Content Generation (Planned)

The consultation data feeds into AI-powered content generation for SEO-optimized website copy:

| Input (from Consultation) | Output (AI Generated) |
|---------------------------|----------------------|
| `industry` + `business_type` | Industry-specific keywords |
| `primary_goals` | Homepage hero headlines |
| `challenges` + `solution_gaps` | Value proposition copy |
| `primary_goals` + `success_metrics` | CTA button text |
| `industry` + `target_audience` | Meta descriptions |
| `challenges` | Problem/solution sections |
| `goals` | Benefits bullet points |

---

## Recommendations for Improvement

### UX Issues Identified
1. **JSON textarea for social media** - Not user-friendly; should be structured inputs
2. **Too many chip options** - Some categories have 20 options; consider grouping or search
3. **No conditional logic** - All questions shown regardless of previous answers
4. **Missing progress saving feedback** - Auto-save exists but could be more visible
5. **No skip option** - Users must complete required fields even if not applicable

### Suggested Enhancements
1. Replace JSON social media with individual URL fields
2. Add search/filter to chip selectors with many options
3. Add conditional questions based on industry/business type
4. Show "why we ask this" tooltips for context
5. Add "Not applicable" or "Skip" options where appropriate
6. Consider reducing total options (199 is overwhelming)
7. Group related questions more logically
8. Add estimated completion time per step
