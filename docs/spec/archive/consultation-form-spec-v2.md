# Consultation Form Specification v2

## Overview

This document specifies the revised 4-step consultation flow, streamlined from 199 preset options down to ~80. The focus is on capturing only information essential for qualifying leads and writing proposals.

### Design Principles

1. **Capture only what informs the proposal** - Remove fields that are "nice to have" but unused
2. **One notes field** - Capture conversation context in a single textarea at the end
3. **No conditional logic** - Keep implementation simple, show all relevant fields
4. **4 steps max** - Respect the user's time during an initial consultation call

### Changes Summary

| Aspect | Before | After |
|--------|--------|-------|
| Total Steps | 4 | 4 |
| Total Preset Options | 199 | ~80 |
| Required Fields | 6 | 7 |
| Notes/Textarea Fields | 1 (Impact Assessment) | 2 (Admired Websites + Notes) |

### Fields Removed (Not Used in Downstream Documents)

| Field | Reason |
|-------|--------|
| Marketing Channels (17 options) | Not relevant to web design proposals |
| Team Size | Rarely impacts web project scope |
| Digital Presence (11 options) | Covered by Website URL + Social fields |
| Technical Issues (20 options) | Let the audit reveal these |
| Solution Gaps (20 options) | Scoping phase, not consultation |
| Secondary Goals (15 options) | Primary goals sufficient |
| Success Metrics (15 options) | Too granular for initial consultation |
| KPIs (15 options) | Overlaps with goals, too detailed |
| Budget Constraints (15 options) | Captured at proposal stage if needed |
| Impact Assessment textarea | Replaced by Consultation Notes |
| Key Milestones | Captured at proposal stage |
| Two date pickers | Replaced with Timeline dropdown; specific dates at proposal stage |
| Current Platform text field | Can note in Consultation Notes if relevant |

### Fields Added

| Field | Purpose |
|-------|---------|
| Structured Social Media fields | Fix JSON textarea UX issue |
| Website Status (3 options) | Quick context on current state |
| Conversion Goal (7 options) | Understand primary intent |
| Design Style Preference (5 options) | Quick read on aesthetic taste |
| Websites They Admire (textarea) | Capture 2-3 inspiration URLs |
| Consultation Notes (textarea) | Capture conversation context |

---

## Step 1: Contact & Business

**Component:** `ContactBusinessForm.svelte` (merge of `ClientInfoForm.svelte` + `BusinessContext.svelte`)

**Purpose:** Collect contact details and basic business context in one step.

**Route:** `/consultation`

### Fields

| Field | Type | Required | Validation | Notes |
|-------|------|----------|------------|-------|
| Business Name | Text | No | None | Autocomplete: organization |
| Contact Person | Text | No | None | Autocomplete: name |
| Email Address | Email | **Yes** | Email format regex | Autocomplete: email |
| Phone Number | Tel | No | Australian format: 04XX XXX XXX or (0X) XXXX XXXX | Autocomplete: tel |
| Website URL | URL | No | Valid URL, auto-adds https:// | Autocomplete: url |
| LinkedIn | URL | No | Valid URL | Individual field |
| Facebook | URL | No | Valid URL | Individual field |
| Instagram | URL | No | Valid URL | Individual field |
| Industry | Dropdown | **Yes** | Selection required | 16 options |
| Business Type | Dropdown | **Yes** | Selection required | 7 options |

### Social Media Fields (Replaces JSON Textarea)

Display as a collapsible "Social Media Profiles" section with individual URL fields:

```svelte
<div class="space-y-3">
  <label class="text-sm font-medium">Social Media Profiles (optional)</label>
  <div class="grid gap-3">
    <div class="flex items-center gap-2">
      <span class="w-24 text-sm text-gray-500">LinkedIn</span>
      <input type="url" placeholder="https://linkedin.com/company/..." />
    </div>
    <div class="flex items-center gap-2">
      <span class="w-24 text-sm text-gray-500">Facebook</span>
      <input type="url" placeholder="https://facebook.com/..." />
    </div>
    <div class="flex items-center gap-2">
      <span class="w-24 text-sm text-gray-500">Instagram</span>
      <input type="url" placeholder="https://instagram.com/..." />
    </div>
  </div>
</div>
```

### Industry Options (16) - UNCHANGED

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

### Business Type Options (7) - UNCHANGED

| Value | Label |
|-------|-------|
| startup | Startup (< 2 years) |
| small-business | Small Business (2-10 employees) |
| medium-business | Medium Business (11-50 employees) |
| enterprise | Enterprise (50+ employees) |
| freelancer | Freelancer / Sole Proprietor |
| agency | Agency |
| nonprofit | Non-Profit Organization |

### UX Features

- Auto-focus on Business Name field on mount
- Auto-format phone numbers for Australian format
- Auto-prepend `https://` to URLs if missing
- Real-time validation feedback with icons
- Collapsible social media section (collapsed by default)

---

## Step 2: Situation & Challenges

**Component:** `SituationChallenges.svelte` (replaces `PainPointsCapture.svelte`)

**Purpose:** Understand current website situation and primary pain points.

**Route:** `/consultation/challenges`

### Fields

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Website Status | Radio/Segment | **Yes** | 3 options - NEW |
| Primary Challenges | Multi-select chips | **Yes** | 15 options (reduced from 20) + custom |
| Urgency Level | Dropdown | **Yes** | 4 options with color coding |

### Website Status Options (3) - NEW

| Value | Label | Description |
|-------|-------|-------------|
| none | No Current Website | Starting from scratch |
| refresh | Needs Refresh | Has website but needs updates/redesign |
| rebuild | Complete Rebuild | Current site not salvageable |

Display as segmented control or radio button group:

```svelte
<fieldset class="space-y-2">
  <legend class="text-sm font-medium">Current Website Status *</legend>
  <div class="flex gap-2">
    <label class="btn btn-outline">
      <input type="radio" name="website_status" value="none" class="hidden" />
      No Website
    </label>
    <label class="btn btn-outline">
      <input type="radio" name="website_status" value="refresh" class="hidden" />
      Needs Refresh
    </label>
    <label class="btn btn-outline">
      <input type="radio" name="website_status" value="rebuild" class="hidden" />
      Complete Rebuild
    </label>
  </div>
</fieldset>
```

### Primary Challenges Options (15) - REDUCED

Removed 5 less relevant options for web design context:

| Value | Label |
|-------|-------|
| lead-generation | Lead Generation |
| conversion-rate | Low Conversion Rates |
| brand-awareness | Brand Awareness |
| customer-retention | Customer Retention |
| competition | Competitive Pressure |
| technology-adoption | Technology Adoption |
| customer-experience | Customer Experience |
| digital-transformation | Digital Transformation |
| outdated-website | Outdated Website |
| poor-mobile | Poor Mobile Experience |
| seo-issues | SEO / Search Visibility |
| no-online-presence | No Online Presence |
| credibility | Lack of Credibility/Trust |
| manual-processes | Too Many Manual Processes |
| other | Other |

**Removed from original:** scaling, cost-management, talent-acquisition, data-management, market-expansion, regulatory-compliance, supply-chain, cash-flow, product-development, customer-acquisition-cost, market-positioning

### Urgency Level Options (4) - UNCHANGED

| Value | Label | Color |
|-------|-------|-------|
| low | Low - Exploratory phase | Green |
| medium | Medium - Planning for next quarter | Yellow |
| high | High - Need to start within weeks | Orange |
| critical | Critical - Urgent need | Red |

---

## Step 3: Goals & Budget

**Component:** `GoalsBudget.svelte` (replaces `GoalsObjectives.svelte`)

**Purpose:** Define primary objectives, conversion goals, budget, and timeline.

**Route:** `/consultation/goals`

### Fields

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Primary Goals | Multi-select chips | **Yes** | 12 options (reduced from 15) + custom |
| Conversion Goal | Single-select chips | No | 7 options - NEW |
| Budget Range | Dropdown | **Yes** | 6 options (reduced from 9) |
| Timeline | Dropdown | No | 4 options - SIMPLIFIED |

### Primary Goals Options (12) - REDUCED

Focused on web-design relevant goals:

| Value | Label |
|-------|-------|
| increase-revenue | Increase Revenue |
| generate-leads | Generate More Leads |
| improve-conversion | Improve Conversion Rates |
| build-brand | Build Brand Awareness |
| launch-product | Launch New Product/Service |
| improve-retention | Improve Customer Retention |
| enhance-experience | Enhance Customer Experience |
| digital-presence | Establish Digital Presence |
| competitive-advantage | Gain Competitive Advantage |
| automate-processes | Automate Business Processes |
| credibility | Build Credibility & Trust |
| other | Other |

**Removed from original:** enter-new-market, reduce-costs, improve-efficiency, data-driven, sustainability

### Conversion Goal Options (7) - NEW

| Value | Label |
|-------|-------|
| phone-calls | Phone Calls |
| form-submissions | Form Submissions |
| email-inquiries | Email Inquiries |
| bookings | Bookings / Appointments |
| purchases | Online Purchases |
| quote-requests | Quote Requests |
| newsletter-signups | Newsletter Signups |

Display as single-select chips (only one can be selected):

```svelte
<fieldset class="space-y-2">
  <legend class="text-sm font-medium">Primary Conversion Goal</legend>
  <p class="text-xs text-gray-500">What's the main action you want visitors to take?</p>
  <div class="flex flex-wrap gap-2">
    {#each conversionGoals as goal}
      <label class="chip" class:chip-selected={selected === goal.value}>
        <input type="radio" name="conversion_goal" value={goal.value} class="hidden" />
        {goal.label}
      </label>
    {/each}
  </div>
</fieldset>
```

### Budget Range Options (6) - SIMPLIFIED

Adjusted for realistic web design project budgets:

| Value | Label |
|-------|-------|
| under-2k | Under $2,000 |
| 2k-5k | $2,000 - $5,000 |
| 5k-10k | $5,000 - $10,000 |
| 10k-20k | $10,000 - $20,000 |
| 20k-plus | $20,000+ |
| tbd | To Be Determined |

**Removed:** 25k-50k, 50k-100k, 100k-250k, 250k-500k, 500k-plus (unrealistic for typical web design clients)

### Timeline Options (4) - NEW (replaces two date pickers)

| Value | Label |
|-------|-------|
| asap | ASAP / Urgent |
| 1-3-months | 1-3 Months |
| 3-6-months | 3-6 Months |
| flexible | Flexible / No Rush |

---

## Step 4: Preferences & Notes

**Component:** `PreferencesNotes.svelte` (NEW)

**Purpose:** Capture design preferences and consultation conversation context.

**Route:** `/consultation/notes`

### Fields

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Design Style | Multi-select chips | No | 5 options - NEW |
| Websites They Admire | Textarea | No | 2-3 URLs - NEW |
| Consultation Notes | Textarea | No | Free-form conversation notes - NEW |

### Design Style Options (5) - NEW

| Value | Label |
|-------|-------|
| modern-clean | Modern & Clean |
| bold-creative | Bold & Creative |
| corporate-professional | Corporate & Professional |
| minimalist | Minimalist |
| traditional-classic | Traditional & Classic |

Allow multiple selections (client may like aspects of multiple styles).

### Websites They Admire - NEW

```svelte
<div class="space-y-2">
  <label class="text-sm font-medium">Websites You Admire</label>
  <p class="text-xs text-gray-500">Paste 2-3 website URLs that you like the look/feel of</p>
  <textarea 
    rows="3" 
    placeholder="https://example1.com&#10;https://example2.com&#10;https://example3.com"
    class="textarea textarea-bordered w-full"
  ></textarea>
</div>
```

### Consultation Notes - NEW

This is the critical free-form field for capturing conversation context:

```svelte
<div class="space-y-2">
  <label class="text-sm font-medium">Consultation Notes</label>
  <p class="text-xs text-gray-500">
    Capture key points from the conversation - context that helps personalize the proposal
  </p>
  <textarea 
    rows="6" 
    placeholder="e.g., Client was burned by previous agency - wants clear timeline and communication...&#10;&#10;Mentioned competitor acme.com.au - dislikes their cluttered design...&#10;&#10;Decision maker is the business partner, not the person on the call..."
    class="textarea textarea-bordered w-full"
  ></textarea>
</div>
```

---

## Data Structure

### Updated ConsultationData Interface

```typescript
interface ConsultationData {
  // Step 1: Contact & Business
  contact_business: {
    business_name?: string;
    contact_person?: string;
    email: string;                    // Required
    phone?: string;
    website?: string;
    social_media: {
      linkedin?: string;
      facebook?: string;
      instagram?: string;
    };
    industry: string;                 // Required
    business_type: string;            // Required
  };

  // Step 2: Situation & Challenges
  situation: {
    website_status: 'none' | 'refresh' | 'rebuild';  // Required - NEW
    primary_challenges: string[];     // Required (min 1)
    urgency_level: 'low' | 'medium' | 'high' | 'critical';  // Required
  };

  // Step 3: Goals & Budget
  goals_budget: {
    primary_goals: string[];          // Required (min 1)
    conversion_goal?: string;         // NEW
    budget_range: string;             // Required
    timeline?: string;                // NEW (replaces date pickers)
  };

  // Step 4: Preferences & Notes
  preferences_notes: {
    design_styles?: string[];         // NEW
    admired_websites?: string;        // NEW - raw textarea content
    consultation_notes?: string;      // NEW - free-form notes
  };
}
```

---

## Route Structure

```
/consultation
├── +layout.svelte           # Consultation wrapper with step indicator
├── +page.svelte             # Step 1: Contact & Business
├── +page.server.ts
├── challenges/
│   ├── +page.svelte         # Step 2: Situation & Challenges
│   └── +page.server.ts
├── goals/
│   ├── +page.svelte         # Step 3: Goals & Budget
│   └── +page.server.ts
└── notes/
    ├── +page.svelte         # Step 4: Preferences & Notes
    └── +page.server.ts
```

---

## Component Changes Summary

| Old Component | Action | New Component |
|---------------|--------|---------------|
| `ClientInfoForm.svelte` | Merge | `ContactBusinessForm.svelte` |
| `BusinessContext.svelte` | Merge | `ContactBusinessForm.svelte` |
| `PainPointsCapture.svelte` | Replace | `SituationChallenges.svelte` |
| `GoalsObjectives.svelte` | Replace | `GoalsBudget.svelte` |
| N/A | Create | `PreferencesNotes.svelte` |

---

## Database Schema

### ConsultationData Structure

Since the app is in development with no production data, implement the v2 schema directly:

```sql
-- consultations table (simplified)
CREATE TABLE consultations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID REFERENCES agencies(id),
    
    -- Step 1: Contact & Business
    business_name TEXT,
    contact_person TEXT,
    email TEXT NOT NULL,
    phone TEXT,
    website TEXT,
    social_linkedin TEXT,
    social_facebook TEXT,
    social_instagram TEXT,
    industry TEXT NOT NULL,
    business_type TEXT NOT NULL,
    
    -- Step 2: Situation & Challenges
    website_status TEXT NOT NULL CHECK (website_status IN ('none', 'refresh', 'rebuild')),
    primary_challenges TEXT[] NOT NULL DEFAULT '{}',  -- Array of challenge values
    urgency_level TEXT NOT NULL CHECK (urgency_level IN ('low', 'medium', 'high', 'critical')),
    
    -- Step 3: Goals & Budget
    primary_goals TEXT[] NOT NULL DEFAULT '{}',  -- Array of goal values
    conversion_goal TEXT,
    budget_range TEXT NOT NULL,
    timeline TEXT,
    
    -- Step 4: Preferences & Notes
    design_styles TEXT[],  -- Array of style values
    admired_websites TEXT,  -- Raw textarea content (URLs)
    consultation_notes TEXT,  -- Free-form notes
    
    -- Metadata
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'completed', 'converted')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for agency lookups
CREATE INDEX idx_consultations_agency ON consultations(agency_id);
CREATE INDEX idx_consultations_status ON consultations(status);
```

### Alternative: JSONB Approach

If using JSONB for flexibility:

```sql
CREATE TABLE consultations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID REFERENCES agencies(id),
    data JSONB NOT NULL DEFAULT '{}',
    status TEXT DEFAULT 'draft',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

With the `data` column containing the `ConsultationData` structure defined in the TypeScript interface.

---

## Data Cross-Population (v2 Fields)

Consultation data flows into proposals, contracts, invoices, questionnaires, and AI-generated content. This matrix shows how v2 fields map to downstream documents.

### Step 1: Contact & Business → Downstream Usage

| v2 Field | Proposal | Contract | Invoice | Questionnaire | AI Content |
|----------|:--------:|:--------:|:-------:|:-------------:|:----------:|
| `business_name` | ✅ Client section | ✅ Party B | ✅ Bill To | ✅ Pre-fill | — |
| `contact_person` | ✅ Addressed to | ✅ Signatory | ✅ Attention | ✅ Pre-fill | — |
| `email` | ✅ Contact info | ✅ Party B | ✅ Bill To | ✅ Pre-fill | — |
| `phone` | ✅ Contact info | ✅ Party B | ✅ Bill To | — | — |
| `website` | ✅ Audit target | ✅ Reference URL | — | ✅ Current site | — |
| `social_media.*` | — | — | — | ✅ Pre-fill | — |
| `industry` | ✅ Executive summary | ✅ Scope context | — | ✅ Industry section | ✅ Keywords/tone |
| `business_type` | ✅ Analysis | ✅ Scope context | — | ✅ Pre-fill | ✅ Tone |

### Step 2: Situation & Challenges → Downstream Usage

| v2 Field | Proposal | Contract | Invoice | Questionnaire | AI Content |
|----------|:--------:|:--------:|:-------:|:-------------:|:----------:|
| `website_status` | ✅ Scope (new/refresh/rebuild) | ✅ Scope context | — | — | — |
| `primary_challenges` | ✅ Problem statement | ✅ Scope justification | — | — | ✅ Solutions copy |
| `urgency_level` | ✅ Timeline priority | ✅ Delivery terms | — | — | — |

### Step 3: Goals & Budget → Downstream Usage

| v2 Field | Proposal | Contract | Invoice | Questionnaire | AI Content |
|----------|:--------:|:--------:|:-------:|:-------------:|:----------:|
| `primary_goals` | ✅ Objectives section | ✅ Success criteria | — | ✅ Goals reminder | ✅ Headlines/CTAs |
| `conversion_goal` | ✅ CTA strategy | ✅ Success criteria | — | — | ✅ Primary CTA copy |
| `budget_range` | ✅ Package recommendation | ✅ Payment terms | ✅ Invoice total | — | — |
| `timeline` | ✅ Project timeline | ✅ Delivery window | — | — | — |

### Step 4: Preferences & Notes → Downstream Usage

| v2 Field | Proposal | Contract | Invoice | Questionnaire | AI Content |
|----------|:--------:|:--------:|:-------:|:-------------:|:----------:|
| `design_styles` | ✅ Design direction | ✅ Design scope | — | ✅ Pre-fill | — |
| `admired_websites` | ✅ Inspiration references | ✅ Design scope | — | ✅ Pre-fill | — |
| `consultation_notes` | ✅ Context/personalization | — | — | — | ✅ Tone/approach |

### Fields Captured at Later Stages

These details are NOT captured in the initial consultation but are added when creating proposals/contracts:

| Field | When Captured | Used In |
|-------|---------------|---------|
| Specific start date | Proposal creation | Contract, Timeline |
| Specific end date | Proposal creation | Contract, Timeline |
| Milestones | Proposal creation | Contract, Invoice schedule |
| Payment terms | Proposal creation | Contract, Invoice |
| Package selection | Proposal creation | Contract, Invoice |
| Add-ons | Proposal creation | Contract, Invoice |

### Merge Field Syntax (Updated for v2)

```handlebars
{{client.business_name}}        → "Acme Corp"
{{client.contact_person}}       → "John Smith"
{{client.email}}                → "john@acme.com"
{{client.phone}}                → "0412 345 678"
{{client.website_url}}          → "https://acme.com"
{{client.industry}}             → "Technology & Software"
{{client.business_type}}        → "Small Business (2-10 employees)"
{{client.website_status}}       → "Needs Refresh"
{{client.challenges}}           → "• Lead Generation\n• Low Conversion Rates"
{{client.goals}}                → "• Increase Revenue\n• Generate More Leads"
{{client.conversion_goal}}      → "Quote Requests"
{{client.budget_range}}         → "$5,000 - $10,000"
{{client.timeline}}             → "1-3 Months"
{{client.design_styles}}        → "Modern & Clean, Minimalist"
{{client.admired_websites}}     → "https://stripe.com\nhttps://linear.app"
{{client.notes}}                → "Client was burned by previous agency..."
```

---

## Agency Customization

### Updated Customizable Categories

Reduce from 14 to 9 categories via `agency_form_options` table:

| Category | Options Count |
|----------|---------------|
| `industry` | 16 |
| `business_type` | 7 |
| `website_status` | 3 |
| `primary_challenges` | 15 |
| `urgency_level` | 4 |
| `primary_goals` | 12 |
| `conversion_goal` | 7 |
| `budget_range` | 6 |
| `timeline` | 4 |
| `design_styles` | 5 |

**Removed categories:** `technical_issues`, `solution_gaps`, `digital_presence`, `marketing_channels`, `secondary_goals`, `success_metrics`, `kpis`, `budget_constraints`

---

## Total Field Count Summary

| Category | Options Count |
|----------|---------------|
| Industry | 16 |
| Business Type | 7 |
| Website Status | 3 |
| Primary Challenges | 15 |
| Urgency Level | 4 |
| Primary Goals | 12 |
| Conversion Goal | 7 |
| Budget Range | 6 |
| Timeline | 4 |
| Design Styles | 5 |
| **Total** | **79 preset options** |

**Reduction:** 199 → 79 options (60% reduction)

---

## Implementation Checklist

### Phase 1: Component Creation

- [ ] Create `ContactBusinessForm.svelte` (merge Steps 1+2)
- [ ] Replace JSON social media with structured URL fields
- [ ] Create `SituationChallenges.svelte` with Website Status field
- [ ] Update Primary Challenges to 15 options
- [ ] Create `GoalsBudget.svelte` with Conversion Goal and Timeline
- [ ] Update Primary Goals to 12 options
- [ ] Update Budget Range to 6 options
- [ ] Create `PreferencesNotes.svelte` with Design Styles, Admired Websites, Notes

### Phase 2: Routes & Data Layer

- [ ] Update `/consultation/+page.svelte` for merged Contact & Business
- [ ] Remove `/consultation/business` route (merged into step 1)
- [ ] Update `/consultation/challenges/+page.svelte`
- [ ] Update `/consultation/goals/+page.svelte`
- [ ] Create `/consultation/notes/+page.svelte`
- [ ] Update step indicator to reflect 4 steps
- [ ] Update `ConsultationData` TypeScript interface
- [ ] Update Zod validation schemas
- [ ] Update Go models in `service-core`
- [ ] Implement database schema (SQL or JSONB approach)
- [ ] Update SQLC queries

### Phase 3: Cleanup & Integration

- [ ] Remove old components (`ClientInfoForm.svelte`, `BusinessContext.svelte`, `PainPointsCapture.svelte`, `GoalsObjectives.svelte`)
- [ ] Remove unused chip option arrays from codebase
- [ ] Update `agency_form_options` categories (reduce from 14 to 9)
- [ ] Verify merge fields work in proposal templates
- [ ] Verify merge fields work in contract templates
- [ ] Verify merge fields work in invoice templates
- [ ] Test auto-save functionality

---

## Notes for Implementation Agent

1. **Preserve auto-save functionality** - The current form auto-saves; ensure this continues working with new structure.

2. **Phone number formatting** - Update to Australian format (04XX XXX XXX) instead of US format.

3. **Step indicator** - Should show 4 steps with labels: "Contact & Business", "Situation", "Goals & Budget", "Preferences & Notes"

4. **Validation** - Required fields are marked with **Yes** in tables above. Minimum 1 selection for chip multi-selects.

5. **No backward compatibility needed** - App is still in development with no production data. Clean slate implementation.

6. **Downstream document integration** - Ensure all v2 fields are available for merge field injection into proposals, contracts, invoices, and questionnaires. See "Data Cross-Population" section for field mappings.

7. **The Notes field is key** - This is where the human context lives. Make it prominent with good placeholder text showing examples of useful notes.

8. **Detailed dates captured later** - Specific project dates (start, end, milestones) are captured at proposal creation stage, not in this initial consultation form. The consultation only captures general timeline preference (ASAP / 1-3 months / etc).
