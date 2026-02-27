# Webkit V2 - Client Lifecycle Management Hub
## Architecture Specification

> **Scope Expansion**: From consultation capture → Full client lifecycle management

> **Core Principle**: Capture rich data once, reuse everywhere. Every piece of information flows through the pipeline and auto-populates downstream documents, eliminating redundant data entry and enabling AI-powered content generation.

---

## Executive Summary

Webkit evolves from a proposal generator into a comprehensive client lifecycle management platform with three core services:

1. **Consultation Capture** (existing) - Web form wizard for discovery
2. **Proposal/Invoice/Contract Generation** (new) - After client agreement
3. **Website Questionnaire** (new) - Unlocked post-payment for content creation

---

## Confirmed Technical Decisions

| Decision | Choice | Notes |
|----------|--------|-------|
| **Payment Integration** | Stripe (existing) | Already in use, continue with current workflow |
| **E-Signatures** | DocuSign/HelloSign API | Plus PDF download for hardcopy signing |
| **PDF Generation** | Server-side (Puppeteer/Playwright) | Reliable for complex layouts |
| **Email Service** | Resend | With agency custom sender support |
| **Public Links** | PR Preview Pattern | `https://p-{slug}.webkit.au` |
| **Currency** | AUD | Australia-focused |

---

## Agency-Configurable Pricing & Packages

> **IMPORTANT**: All pricing, packages, add-ons, and contract terms are **agency-specific configurations**. Each agency defines their own pricing structure, service packages, and terms through the admin interface. Nothing is hardcoded.

### Configuration Model

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     AGENCY CONFIGURATION HIERARCHY                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Agency Profile                                                              │
│  └── Branding, contact info, banking details                                │
│                                                                              │
│  Service Packages (agency_packages)                                          │
│  └── Each agency defines their own packages                                 │
│      • Package name, description                                            │
│      • Pricing model (subscription, lump_sum, hybrid)                       │
│      • Setup fees, monthly rates, one-time prices                           │
│      • Minimum terms, cancellation fees                                     │
│      • Included features list                                               │
│                                                                              │
│  Add-On Services (agency_addons)                                            │
│  └── Each agency defines their own add-ons                                  │
│      • Add-on name, description                                             │
│      • Price, pricing type (one-time, recurring)                            │
│      • Availability per package                                             │
│                                                                              │
│  Contract Templates (contract_templates)                                     │
│  └── Each agency creates their own contract templates                       │
│      • Terms & conditions                                                   │
│      • Package-specific schedules                                           │
│      • Merge fields for dynamic content                                     │
│                                                                              │
│  Consultation Parameters (via Unified Form Builder)                          │
│  └── Each agency customizes their discovery form                            │
│      • Questions, sections, conditional logic                               │
│      • Industry-specific fields                                             │
│      • Dropdown option customization                                        │
│                                                                              │
│  Questionnaire Templates (via Unified Form Builder)                          │
│  └── Each agency designs their content collection forms                     │
│      • Page-by-page content sections                                        │
│      • File upload fields for assets                                        │
│      • Conditional sections based on package                                │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Example Configuration (Plentify Web Designs)

> This is **example data only** - each agency configures their own structure.

**Example Packages:**

| Package | Setup | Monthly | Total (12mo) |
|---------|-------|---------|--------------|
| Subscription | $500 | $180/mo | $2,660 |
| Lump Sum | $3,900 | $40/mo hosting | $4,380 |

**Example Add-Ons:**

| Service | Price | Type |
|---------|-------|------|
| Extra Pages | $100/page | One-time |
| SEO-Focused Content | $1,000 | One-time |
| Blog Integration | $500 | One-time |
| Appointment Scheduling | $200 | One-time |

---

## Client Lifecycle State Machine

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          CLIENT LIFECYCLE STATES                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────┐    ┌─────────────────┐    ┌───────────────┐    ┌────────────────┐│
│  │ LEAD │───▶│ CONSULTATION    │───▶│ PROPOSAL_SENT │───▶│ CONTRACT_SIGNED││
│  └──────┘    │ COMPLETE        │    └───────────────┘    └────────────────┘│
│              └─────────────────┘            │                     │         │
│                                             │                     ▼         │
│  ┌──────────┐    ┌─────────────────┐    ┌───────────────────────────────┐  │
│  │ LAUNCHED │◀───│ IN_DEVELOPMENT  │◀───│ PAYMENT_RECEIVED              │  │
│  └──────────┘    └─────────────────┘    │ (Unlocks Questionnaire)       │  │
│       │                  ▲               └───────────────────────────────┘  │
│       ▼                  │                            │                     │
│  ┌────────────┐    ┌─────────────────┐    ┌──────────▼──────────┐          │
│  │ MAINTENANCE│    │ QUESTIONNAIRE   │◀───│ QUESTIONNAIRE_SENT  │          │
│  └────────────┘    │ COMPLETE        │    └─────────────────────┘          │
│                    └─────────────────┘                                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              DATA FLOW                                        │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  1. CONSULTATION (existing)                                                   │
│     └─▶ Discovery data captured                                               │
│         • Business info, goals, challenges                                    │
│         • Budget, timeline, technical requirements                            │
│                                                                               │
│  2. PROPOSAL GENERATION (new)                                                 │
│     └─▶ Generated FROM consultation data                                      │
│         ┌─────────────────────────────────────────────────────┐              │
│         │ PROPOSAL BUNDLE                                      │              │
│         ├─────────────────────────────────────────────────────┤              │
│         │ • Proposal Document (OCB Law Group style)           │              │
│         │   - Current site analysis (PageSpeed audit)         │              │
│         │   - ROI calculations                                │              │
│         │   - Compliance considerations                        │              │
│         │   - Site architecture & timeline                    │              │
│         │                                                      │              │
│         │ • Contract (Plentify Service Agreement)             │              │
│         │   - Terms & Conditions (fixed)                      │              │
│         │   - Schedule A (package-specific)                   │              │
│         │   - E-signature or PDF download                     │              │
│         │                                                      │              │
│         │ • Invoice                                            │              │
│         │   - Line items from package selection               │              │
│         │   - Stripe Payment Link                             │              │
│         └─────────────────────────────────────────────────────┘              │
│                                                                               │
│  3. PAYMENT CONFIRMATION                                                      │
│     └─▶ Stripe webhook triggers:                                              │
│         • Contract status → signed                                            │
│         • Invoice status → paid                                               │
│         • Questionnaire → unlocked                                            │
│                                                                               │
│  4. WEBSITE QUESTIONNAIRE (new)                                               │
│     └─▶ Content collection for development                                    │
│         • Business copy, brand assets                                         │
│         • Page-by-page content                                                │
│         • Image uploads, logo files                                           │
│                                                                               │
│  5. CONTENT BRIEF (auto-generated)                                            │
│     └─▶ Merged from Consultation + Questionnaire                              │
│         • Complete project specification                                      │
│         • Ready for development handoff                                       │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Data Pipeline & Cross-Population

> **Design Goal**: Capture data once at the earliest opportunity, then auto-populate all downstream documents. No redundant data entry. Maximum reuse.

### Data Sources & Ownership

| Data Source | When Captured | Owner | Lifetime |
|-------------|---------------|-------|----------|
| **Agency Profile** | Agency setup | Agency admin | Persistent, rarely changes |
| **Consultation** | Pre-sale discovery | Client + Agency | Per-project |
| **Proposal** | After consultation | Agency | Per-project |
| **Contract** | After proposal accepted | Both parties | Per-project |
| **Invoice** | Generated from proposal | Agency | Per-project |
| **Questionnaire** | Post-payment | Client | Per-project |

### Cross-Population Matrix

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    DATA CROSS-POPULATION MATRIX                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│                    ┌─────────────────────────────────────────────────────┐  │
│  AGENCY PROFILE    │ • Business name, ABN, logo                          │  │
│  (Source of Truth) │ • Bank details (BSB, Account)                       │  │
│                    │ • Contact info (email, phone, address)              │  │
│                    │ • Branding (colors, fonts)                          │  │
│                    └───────────────────────────────────────────────────────  │
│                              │                                               │
│                              ▼                                               │
│         ┌─────────────┬─────────────┬─────────────┬─────────────┐          │
│         │  PROPOSAL   │  INVOICE    │  CONTRACT   │   EMAILS    │          │
│         │  • Header   │  • Header   │  • Party A  │  • Signature│          │
│         │  • Footer   │  • Bank     │  • ABN      │  • Branding │          │
│         │  • Logo     │  • ABN      │  • Logo     │  • From     │          │
│         └─────────────┴─────────────┴─────────────┴─────────────┘          │
│                                                                              │
│                    ┌─────────────────────────────────────────────────────┐  │
│  CONSULTATION      │ • Client business name, contact person              │  │
│  (Client Discovery)│ • Website URL (triggers PageSpeed audit)            │  │
│                    │ • Industry, business type                           │  │
│                    │ • Goals, challenges, pain points                    │  │
│                    │ • Budget range, timeline                            │  │
│                    │ • Team size, current platform                       │  │
│                    └───────────────────────────────────────────────────────  │
│                              │                                               │
│                              ▼                                               │
│         ┌─────────────┬─────────────┬─────────────┬─────────────┐          │
│         │  PROPOSAL   │  CONTRACT   │QUESTIONNAIRE│  SEO/AI     │          │
│         │  • Client   │  • Party B  │  • Pre-fill │  • Keywords │          │
│         │  • Analysis │  • Scope    │  • Industry │  • Copy     │          │
│         │  • ROI calc │  • Ref URL  │  • Goals    │  • Meta     │          │
│         └─────────────┴─────────────┴─────────────┴─────────────┘          │
│                                                                              │
│                    ┌─────────────────────────────────────────────────────┐  │
│  PROPOSAL          │ • Selected package (name, pricing model)            │  │
│  (Package Selection)• Add-ons selected                                   │  │
│                    │ • Setup fee, monthly price, one-time price          │  │
│                    │ • Proposal number                                   │  │
│                    └───────────────────────────────────────────────────────  │
│                              │                                               │
│                              ▼                                               │
│         ┌─────────────────────────────┬─────────────────────────────┐      │
│         │         INVOICE             │         CONTRACT            │      │
│         │  • Line items (auto)        │  • Schedule A (package)     │      │
│         │  • Setup fee line           │  • Monthly price            │      │
│         │  • Monthly × term           │  • Minimum term             │      │
│         │  • Add-on lines             │  • Add-on scope             │      │
│         │  • Totals calculated        │  • Payment schedule         │      │
│         └─────────────────────────────┴─────────────────────────────┘      │
│                                                                              │
│                    ┌─────────────────────────────────────────────────────┐  │
│  QUESTIONNAIRE     │ • Detailed business description                     │  │
│  (Content Capture) │ • Services offered, USPs, differentiators           │  │
│                    │ • Target audience, ideal customer                   │  │
│                    │ • Brand voice, tone preferences                     │  │
│                    │ • Page-by-page content, uploaded assets             │  │
│                    └───────────────────────────────────────────────────────  │
│                              │                                               │
│                              ▼                                               │
│         ┌─────────────────────────────┬─────────────────────────────┐      │
│         │      CONTENT BRIEF          │      AI SEO CONTENT         │      │
│         │  • Complete project spec    │  • Homepage hero copy       │      │
│         │  • Merged consultation +    │  • About page content       │      │
│         │    questionnaire data       │  • Service descriptions     │      │
│         │  • Ready for dev handoff    │  • Meta descriptions        │      │
│         └─────────────────────────────┴─────────────────────────────┘      │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Merge Field System

All documents use a consistent merge field syntax for auto-population:

```typescript
// Merge field format: {{source.field_name}}

// Agency Profile fields
{{agency.business_name}}
{{agency.abn}}
{{agency.logo_url}}
{{agency.email}}
{{agency.phone}}
{{agency.address}}
{{agency.bank_name}}
{{agency.bsb}}
{{agency.account_number}}
{{agency.account_name}}

// Consultation fields
{{client.business_name}}
{{client.contact_person}}
{{client.email}}
{{client.phone}}
{{client.website_url}}
{{client.industry}}
{{client.business_type}}
{{client.team_size}}
{{client.goals}}                    // Formatted list
{{client.challenges}}               // Formatted list
{{client.budget_range}}
{{client.timeline_start}}
{{client.timeline_end}}

// Proposal fields
{{proposal.number}}                 // PROP-2025-0001
{{proposal.date}}
{{proposal.package_name}}
{{proposal.package_price}}
{{proposal.setup_fee}}
{{proposal.monthly_price}}
{{proposal.addons}}                 // Formatted list with prices
{{proposal.total}}
{{proposal.valid_until}}

// Contract fields
{{contract.number}}                 // CON-2025-0001
{{contract.date}}
{{contract.minimum_term}}
{{contract.cancellation_fee}}
{{contract.payment_terms}}

// Invoice fields
{{invoice.number}}                  // INV-2025-0001
{{invoice.date}}
{{invoice.due_date}}
{{invoice.subtotal}}
{{invoice.gst}}
{{invoice.total}}
{{invoice.payment_link}}

// Computed/Derived fields
{{computed.project_duration}}       // From timeline
{{computed.total_contract_value}}   // Setup + (monthly × term)
{{computed.roi_estimate}}           // AI-calculated
```

### Auto-Population Rules

| Document | Auto-Populated From | Manual Override |
|----------|---------------------|-----------------|
| **Proposal Header** | Agency Profile (logo, name, contact) | No |
| **Proposal Client Section** | Consultation (all client fields) | Yes |
| **Proposal Analysis** | Consultation (goals, challenges) + PageSpeed | Editable |
| **Contract Party A** | Agency Profile | No |
| **Contract Party B** | Consultation (client details) | Yes |
| **Contract Schedule A** | Proposal (package, pricing) | Editable |
| **Invoice Header** | Agency Profile | No |
| **Invoice Client** | Consultation OR Proposal | Yes |
| **Invoice Line Items** | Proposal (package + add-ons) | Editable |
| **Invoice Bank Details** | Agency Profile | No |
| **Questionnaire Pre-fill** | Consultation (business name, industry) | Editable |
| **Content Brief** | Consultation + Questionnaire | Generated |

### AI-Powered Content Generation

The rich data captured enables AI content generation for SEO-optimized website copy:

```typescript
interface AIContentGeneration {
  // Input: Combined data from consultation + questionnaire
  input: {
    industry: string;
    business_type: string;
    goals: string[];
    challenges: string[];
    target_audience: string;
    usps: string[];
    services: string[];
    brand_voice: string;
    competitors: string[];
  };

  // Output: SEO-optimized content suggestions
  output: {
    homepage: {
      hero_headline: string;
      hero_subheadline: string;
      value_propositions: string[];
      cta_text: string;
    };
    about_page: {
      company_story: string;
      mission_statement: string;
      team_description: string;
    };
    services_page: {
      service_descriptions: ServiceDescription[];
      benefits_list: string[];
    };
    seo: {
      meta_title: string;
      meta_description: string;
      keywords: string[];
      h1_suggestions: string[];
      h2_suggestions: string[];
    };
  };
}
```

### Data Pipeline Implementation

```typescript
// service-client/src/lib/server/services/data-pipeline.service.ts

export class DataPipelineService {

  // Get all data for a client project
  async getProjectData(consultationId: string): Promise<ProjectData> {
    const consultation = await getConsultation(consultationId);
    const proposal = await getProposalByConsultation(consultationId);
    const contract = await getContractByProposal(proposal?.id);
    const invoice = await getInvoiceByProposal(proposal?.id);
    const questionnaire = await getQuestionnaireByConsultation(consultationId);
    const agency = await getAgency(consultation.agencyId);

    return {
      agency,
      consultation,
      proposal,
      contract,
      invoice,
      questionnaire,
      computed: this.computeDerivedFields(...)
    };
  }

  // Resolve merge fields in a template
  async resolveMergeFields(
    template: string,
    projectData: ProjectData
  ): Promise<string> {
    return template.replace(
      /\{\{(\w+)\.(\w+)\}\}/g,
      (match, source, field) => {
        return projectData[source]?.[field] ?? match;
      }
    );
  }

  // Generate invoice line items from proposal
  async generateInvoiceLines(proposalId: string): Promise<LineItem[]> {
    const proposal = await getProposal(proposalId);
    const lines: LineItem[] = [];

    // Add setup fee if applicable
    if (proposal.setup_fee > 0) {
      lines.push({
        description: `${proposal.package_name} - Setup Fee`,
        quantity: 1,
        unit_price: proposal.setup_fee,
        total: proposal.setup_fee
      });
    }

    // Add monthly recurring (first payment or full term)
    if (proposal.monthly_price > 0) {
      lines.push({
        description: `${proposal.package_name} - Monthly Service`,
        quantity: 12, // or 1 for first month only
        unit_price: proposal.monthly_price,
        total: proposal.monthly_price * 12
      });
    }

    // Add one-time price if lump sum
    if (proposal.one_time_price > 0) {
      lines.push({
        description: `${proposal.package_name} - Website Development`,
        quantity: 1,
        unit_price: proposal.one_time_price,
        total: proposal.one_time_price
      });
    }

    // Add each add-on
    for (const addon of proposal.addons) {
      lines.push({
        description: addon.name,
        quantity: addon.quantity || 1,
        unit_price: addon.price,
        total: addon.price * (addon.quantity || 1)
      });
    }

    return lines;
  }

  // Generate AI content suggestions
  async generateSEOContent(
    consultationId: string,
    questionnaireId?: string
  ): Promise<AIContentSuggestions> {
    const consultation = await getConsultation(consultationId);
    const questionnaire = questionnaireId
      ? await getQuestionnaire(questionnaireId)
      : null;

    // Combine data for AI prompt
    const context = {
      industry: consultation.businessContext.industry,
      goals: consultation.goalsObjectives.primary_goals,
      challenges: consultation.painPoints.primary_challenges,
      // ... more fields
    };

    // Call AI service (Claude/OpenAI)
    return await this.aiService.generateContent(context);
  }
}
```

### Benefits of This Approach

1. **Zero Redundant Entry**: Client enters business name once in consultation → appears everywhere
2. **Consistency**: Same data used across all documents, no typos or mismatches
3. **Speed**: Proposals, contracts, invoices generated in seconds
4. **AI Enhancement**: Rich data enables smart content generation
5. **Audit Trail**: Clear lineage of where each piece of data originated
6. **Easy Updates**: Change in source → propagates to all documents

---

## Database Schema Extensions

### New Tables

```sql
-- ============================================
-- PROPOSALS
-- ============================================
CREATE TABLE proposals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID NOT NULL REFERENCES agencies(id),
    consultation_id UUID REFERENCES consultations(id),
    
    -- Identification
    slug VARCHAR(100) UNIQUE NOT NULL,  -- For public URLs
    proposal_number VARCHAR(50),         -- PROP-2025-0001
    
    -- Client Info (denormalized for proposal snapshot)
    client_name VARCHAR(255) NOT NULL,
    client_email VARCHAR(255),
    client_phone VARCHAR(50),
    business_name VARCHAR(255),
    website_url VARCHAR(500),
    
    -- Package Selection
    package_type VARCHAR(50) NOT NULL,   -- 'subscription', 'lump_sum', 'custom'
    setup_fee DECIMAL(10,2) DEFAULT 0,
    monthly_price DECIMAL(10,2) DEFAULT 0,
    one_time_price DECIMAL(10,2) DEFAULT 0,
    
    -- Add-ons (JSONB array)
    addons JSONB DEFAULT '[]',           -- [{name, price, type}]
    
    -- Proposal Content
    proposal_data JSONB NOT NULL,        -- Full proposal content
    audit_data JSONB,                    -- PageSpeed audit results
    
    -- Status & Tracking
    status VARCHAR(50) DEFAULT 'draft',  -- draft, sent, viewed, accepted, rejected, expired
    sent_at TIMESTAMPTZ,
    viewed_at TIMESTAMPTZ,
    view_count INTEGER DEFAULT 0,
    expires_at TIMESTAMPTZ,
    
    -- Public Access
    public_token VARCHAR(100),           -- For shareable links
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES users(id)
);

-- ============================================
-- CONTRACTS
-- ============================================
CREATE TABLE contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID NOT NULL REFERENCES agencies(id),
    proposal_id UUID REFERENCES proposals(id),
    
    -- Contract Details
    contract_number VARCHAR(50),         -- CON-2025-0001
    template_id UUID REFERENCES contract_templates(id),
    
    -- Generated Content
    contract_html TEXT NOT NULL,         -- Rendered contract
    contract_pdf_url VARCHAR(500),       -- R2/S3 storage URL
    
    -- Terms
    package_type VARCHAR(50) NOT NULL,   -- 'subscription', 'lump_sum'
    minimum_term_months INTEGER DEFAULT 12,
    early_termination_fee DECIMAL(10,2),
    
    -- Signing
    status VARCHAR(50) DEFAULT 'pending', -- pending, sent, viewed, signed, cancelled
    signature_method VARCHAR(50),        -- 'e_signature', 'pdf_upload', 'docusign'
    
    -- E-Signature Data
    signed_at TIMESTAMPTZ,
    signed_by_name VARCHAR(255),
    signed_by_email VARCHAR(255),
    signed_ip VARCHAR(50),
    signature_data TEXT,                 -- Base64 signature image or DocuSign ID
    docusign_envelope_id VARCHAR(100),
    
    -- PDF Upload (alternative)
    uploaded_pdf_url VARCHAR(500),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- CONTRACT TEMPLATES
-- ============================================
CREATE TABLE contract_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID NOT NULL REFERENCES agencies(id),
    
    name VARCHAR(255) NOT NULL,
    template_type VARCHAR(50) NOT NULL,  -- 'subscription', 'lump_sum', 'custom'
    
    -- Template Content (Markdown with placeholders)
    terms_content TEXT NOT NULL,         -- Main terms & conditions
    schedule_a_content TEXT,             -- Package-specific terms
    
    -- Merge Fields
    available_fields JSONB DEFAULT '[]', -- List of {{field}} placeholders
    
    is_default BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INVOICES
-- ============================================
CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID NOT NULL REFERENCES agencies(id),
    proposal_id UUID REFERENCES proposals(id),
    consultation_id UUID REFERENCES consultations(id),
    contract_id UUID REFERENCES contracts(id),
    
    -- Invoice Details
    invoice_number VARCHAR(50) UNIQUE NOT NULL,  -- INV-2025-0001
    
    -- Client Info (snapshot)
    client_name VARCHAR(255) NOT NULL,
    client_email VARCHAR(255),
    client_address TEXT,
    client_abn VARCHAR(50),              -- Australian Business Number
    
    -- Line Items
    line_items JSONB NOT NULL,           -- [{description, quantity, unit_price, total}]
    
    -- Totals
    subtotal DECIMAL(10,2) NOT NULL,
    gst_amount DECIMAL(10,2) DEFAULT 0,  -- 10% GST for Australia
    discount_amount DECIMAL(10,2) DEFAULT 0,
    total DECIMAL(10,2) NOT NULL,
    
    -- Payment Terms
    due_date DATE NOT NULL,
    payment_terms VARCHAR(100),          -- 'NET_7', 'NET_14', 'NET_30', 'DUE_ON_RECEIPT'
    
    -- Status
    status VARCHAR(50) DEFAULT 'draft',  -- draft, sent, viewed, paid, overdue, cancelled
    
    -- Stripe Integration
    stripe_invoice_id VARCHAR(100),
    stripe_payment_intent_id VARCHAR(100),
    stripe_payment_link VARCHAR(500),
    stripe_customer_id VARCHAR(100),
    
    -- Payment Tracking
    sent_at TIMESTAMPTZ,
    viewed_at TIMESTAMPTZ,
    paid_at TIMESTAMPTZ,
    payment_method VARCHAR(50),          -- 'stripe', 'bank_transfer', 'cash'
    
    -- Reminders
    reminder_count INTEGER DEFAULT 0,
    last_reminder_at TIMESTAMPTZ,
    next_reminder_at TIMESTAMPTZ,
    
    -- Notes
    internal_notes TEXT,
    client_notes TEXT,                   -- Shown on invoice
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES users(id)
);

-- ============================================
-- WEBSITE QUESTIONNAIRES
-- ============================================
CREATE TABLE website_questionnaires (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID NOT NULL REFERENCES agencies(id),
    consultation_id UUID REFERENCES consultations(id),
    invoice_id UUID REFERENCES invoices(id),
    proposal_id UUID REFERENCES proposals(id),
    
    -- Identification
    slug VARCHAR(100) UNIQUE NOT NULL,   -- For public access
    public_token VARCHAR(100),           -- Security token for link
    
    -- Status & Access Control
    status VARCHAR(50) DEFAULT 'locked', -- locked, sent, in_progress, completed
    unlocked_at TIMESTAMPTZ,             -- When payment confirmed
    unlocked_by VARCHAR(50),             -- 'payment', 'manual'
    
    -- Progress
    current_section INTEGER DEFAULT 0,
    total_sections INTEGER DEFAULT 0,
    completion_percentage INTEGER DEFAULT 0,
    
    -- Questionnaire Data
    responses JSONB DEFAULT '{}',        -- All form responses
    
    -- Content Brief (auto-generated)
    content_brief_generated BOOLEAN DEFAULT FALSE,
    content_brief_data JSONB,
    content_brief_pdf_url VARCHAR(500),
    
    -- Timestamps
    sent_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    last_activity_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- AI INVOICE INSIGHTS (for dashboard)
-- ============================================
CREATE TABLE invoice_insights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID NOT NULL REFERENCES agencies(id),
    
    -- Time Period
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    period_type VARCHAR(20) NOT NULL,    -- 'daily', 'weekly', 'monthly'
    
    -- Financial Metrics
    total_invoiced DECIMAL(12,2) DEFAULT 0,
    total_collected DECIMAL(12,2) DEFAULT 0,
    total_outstanding DECIMAL(12,2) DEFAULT 0,
    total_overdue DECIMAL(12,2) DEFAULT 0,
    
    -- Counts
    invoices_sent INTEGER DEFAULT 0,
    invoices_paid INTEGER DEFAULT 0,
    invoices_overdue INTEGER DEFAULT 0,
    
    -- Averages
    avg_days_to_payment DECIMAL(5,2),
    avg_invoice_value DECIMAL(10,2),
    
    -- AI-Generated Insights (JSONB)
    ai_insights JSONB,                   -- AI analysis and recommendations
    
    calculated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- AGENCY PROFILES (for auto-fill)
-- ============================================
CREATE TABLE agency_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID NOT NULL UNIQUE REFERENCES agencies(id),
    
    -- Business Details
    business_name VARCHAR(255) NOT NULL,
    trading_name VARCHAR(255),
    abn VARCHAR(50),                     -- Australian Business Number
    acn VARCHAR(50),                     -- Australian Company Number
    
    -- Contact
    email VARCHAR(255),
    phone VARCHAR(50),
    website VARCHAR(500),
    
    -- Address
    address_line1 VARCHAR(255),
    address_line2 VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(50),
    postcode VARCHAR(20),
    country VARCHAR(100) DEFAULT 'Australia',
    
    -- Banking (for invoices)
    bank_name VARCHAR(100),
    bsb VARCHAR(20),
    account_number VARCHAR(50),
    account_name VARCHAR(255),
    
    -- Branding
    logo_url VARCHAR(500),
    primary_color VARCHAR(20),
    secondary_color VARCHAR(20),
    
    -- Invoice Defaults
    default_payment_terms VARCHAR(50) DEFAULT 'NET_14',
    invoice_footer TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- AGENCY PACKAGES (Configurable Pricing Tiers)
-- ============================================
CREATE TABLE agency_packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID NOT NULL REFERENCES agencies(id),
    
    -- Package Identity
    name VARCHAR(100) NOT NULL,           -- e.g., "Subscription", "Lump Sum", "Enterprise"
    slug VARCHAR(50) NOT NULL,            -- e.g., "subscription", "lump_sum"
    description TEXT,
    
    -- Pricing Model
    pricing_model VARCHAR(50) NOT NULL,   -- 'subscription', 'lump_sum', 'hybrid'
    
    -- Fees (all optional based on pricing_model)
    setup_fee DECIMAL(10,2) DEFAULT 0,           -- One-time setup fee
    monthly_price DECIMAL(10,2) DEFAULT 0,       -- Recurring monthly charge
    one_time_price DECIMAL(10,2) DEFAULT 0,      -- Full one-time payment
    hosting_fee DECIMAL(10,2) DEFAULT 0,         -- Ongoing hosting (lump sum model)
    
    -- Terms
    minimum_term_months INTEGER DEFAULT 12,      -- Contract minimum
    cancellation_fee_type VARCHAR(50),           -- 'none', 'fixed', 'remaining_balance'
    cancellation_fee_amount DECIMAL(10,2),       -- Fixed amount if applicable
    
    -- Included Features (displayed in proposals)
    included_features JSONB DEFAULT '[]',        -- ["Custom Design", "SEO Setup", "Mobile Optimization"]
    max_pages INTEGER,                           -- Page limit (NULL = unlimited)
    
    -- Display Settings
    display_order INTEGER DEFAULT 0,
    is_featured BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(agency_id, slug)
);

-- ============================================
-- AGENCY ADDONS (Configurable Add-On Services)
-- ============================================
CREATE TABLE agency_addons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID NOT NULL REFERENCES agencies(id),
    
    -- Add-On Identity
    name VARCHAR(100) NOT NULL,           -- e.g., "Extra Pages", "Blog Integration"
    slug VARCHAR(50) NOT NULL,            -- e.g., "extra_pages", "blog"
    description TEXT,
    
    -- Pricing
    price DECIMAL(10,2) NOT NULL,
    pricing_type VARCHAR(50) NOT NULL,    -- 'one_time', 'monthly', 'per_unit'
    unit_label VARCHAR(50),               -- e.g., "page", "hour" (for per_unit pricing)
    
    -- Availability
    available_packages JSONB DEFAULT '[]', -- Package slugs where this addon is available, empty = all
    is_active BOOLEAN DEFAULT TRUE,
    display_order INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(agency_id, slug)
);

-- ============================================
-- EMAIL LOGS
-- ============================================
CREATE TABLE email_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID NOT NULL REFERENCES agencies(id),
    
    -- Related Entities
    proposal_id UUID REFERENCES proposals(id),
    invoice_id UUID REFERENCES invoices(id),
    questionnaire_id UUID REFERENCES website_questionnaires(id),
    
    -- Email Details
    email_type VARCHAR(50) NOT NULL,     -- 'proposal_sent', 'invoice_sent', 'reminder', 'questionnaire_sent'
    recipient_email VARCHAR(255) NOT NULL,
    subject VARCHAR(500) NOT NULL,
    
    -- Status
    status VARCHAR(50) DEFAULT 'pending', -- pending, sent, delivered, opened, bounced, failed
    resend_message_id VARCHAR(100),
    
    -- Tracking
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    opened_at TIMESTAMPTZ,
    clicked_at TIMESTAMPTZ,
    
    -- Error Handling
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_proposals_agency ON proposals(agency_id);
CREATE INDEX idx_proposals_slug ON proposals(slug);
CREATE INDEX idx_proposals_status ON proposals(status);
CREATE INDEX idx_proposals_consultation ON proposals(consultation_id);

CREATE INDEX idx_contracts_agency ON contracts(agency_id);
CREATE INDEX idx_contracts_proposal ON contracts(proposal_id);
CREATE INDEX idx_contracts_status ON contracts(status);

CREATE INDEX idx_invoices_agency ON invoices(agency_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_due_date ON invoices(due_date);
CREATE INDEX idx_invoices_stripe ON invoices(stripe_invoice_id);

CREATE INDEX idx_questionnaires_agency ON website_questionnaires(agency_id);
CREATE INDEX idx_questionnaires_slug ON website_questionnaires(slug);
CREATE INDEX idx_questionnaires_status ON website_questionnaires(status);

CREATE INDEX idx_email_logs_agency ON email_logs(agency_id);
CREATE INDEX idx_email_logs_type ON email_logs(email_type);

CREATE INDEX idx_agency_packages_agency ON agency_packages(agency_id);
CREATE INDEX idx_agency_packages_slug ON agency_packages(agency_id, slug);
CREATE INDEX idx_agency_packages_active ON agency_packages(agency_id, is_active);

CREATE INDEX idx_agency_addons_agency ON agency_addons(agency_id);
CREATE INDEX idx_agency_addons_slug ON agency_addons(agency_id, slug);
CREATE INDEX idx_agency_addons_active ON agency_addons(agency_id, is_active);

-- ============================================
-- UNIFIED FORM BUILDER TABLES
-- ============================================

-- Form Definitions (reusable for consultation & questionnaire)
CREATE TABLE form_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID NOT NULL REFERENCES agencies(id),

    -- Identity
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    description TEXT,

    -- Form Type
    form_type VARCHAR(50) NOT NULL,       -- 'consultation', 'questionnaire', 'custom'

    -- Version Control
    version INTEGER DEFAULT 1,
    is_published BOOLEAN DEFAULT FALSE,
    published_at TIMESTAMPTZ,

    -- Settings
    settings JSONB DEFAULT '{}',          -- Theme, branding overrides, etc.

    is_default BOOLEAN DEFAULT FALSE,     -- Default form for this type
    is_active BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES users(id),

    UNIQUE(agency_id, slug, version)
);

-- Form Sections (steps/pages in the wizard)
CREATE TABLE form_sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_id UUID NOT NULL REFERENCES form_definitions(id) ON DELETE CASCADE,

    -- Identity
    title VARCHAR(255) NOT NULL,
    description TEXT,

    -- Ordering
    display_order INTEGER NOT NULL DEFAULT 0,

    -- Conditional Display
    condition_logic JSONB,                -- When to show this section
    -- Example: {"field": "package_type", "operator": "equals", "value": "enterprise"}

    -- Settings
    is_required BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Form Fields (individual inputs)
CREATE TABLE form_fields (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section_id UUID NOT NULL REFERENCES form_sections(id) ON DELETE CASCADE,

    -- Identity
    field_key VARCHAR(100) NOT NULL,      -- Unique key within form (e.g., "business_name")
    label VARCHAR(255) NOT NULL,
    description TEXT,
    placeholder VARCHAR(255),

    -- Field Type
    field_type VARCHAR(50) NOT NULL,      -- text, textarea, select, multiselect, checkbox,
                                          -- radio, date, number, email, phone, url,
                                          -- file_upload, image_upload, rich_text

    -- Ordering
    display_order INTEGER NOT NULL DEFAULT 0,

    -- Validation
    is_required BOOLEAN DEFAULT FALSE,
    validation_rules JSONB,               -- {min, max, pattern, custom_message}

    -- Options (for select, multiselect, radio, checkbox)
    options JSONB,                        -- [{value, label, description}] or reference to agency_form_options
    options_source VARCHAR(100),          -- 'static', 'agency_form_options:industry', 'api:endpoint'

    -- Conditional Display
    condition_logic JSONB,                -- When to show this field

    -- Default Value
    default_value TEXT,

    -- UI Settings
    ui_settings JSONB,                    -- {width: 'half', helper_text, icon}

    is_active BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Form Field Options (for dropdowns, radios, checkboxes)
-- Links to existing agency_form_options or defines custom options per field
CREATE TABLE form_field_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    field_id UUID NOT NULL REFERENCES form_fields(id) ON DELETE CASCADE,

    value VARCHAR(255) NOT NULL,
    label VARCHAR(255) NOT NULL,
    description TEXT,

    display_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Form Responses (captures all responses in a structured way)
CREATE TABLE form_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_id UUID NOT NULL REFERENCES form_definitions(id),
    agency_id UUID NOT NULL REFERENCES agencies(id),

    -- Link to entity (consultation, questionnaire, etc.)
    entity_type VARCHAR(50) NOT NULL,     -- 'consultation', 'questionnaire'
    entity_id UUID NOT NULL,

    -- All responses as JSONB
    responses JSONB NOT NULL DEFAULT '{}',

    -- Progress
    current_section INTEGER DEFAULT 0,
    completion_percentage INTEGER DEFAULT 0,

    -- Timestamps
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    last_activity_at TIMESTAMPTZ DEFAULT NOW(),

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for form builder
CREATE INDEX idx_form_definitions_agency ON form_definitions(agency_id);
CREATE INDEX idx_form_definitions_type ON form_definitions(agency_id, form_type);
CREATE INDEX idx_form_definitions_active ON form_definitions(agency_id, is_active);
CREATE INDEX idx_form_sections_form ON form_sections(form_id);
CREATE INDEX idx_form_fields_section ON form_fields(section_id);
CREATE INDEX idx_form_responses_entity ON form_responses(entity_type, entity_id);
CREATE INDEX idx_form_responses_agency ON form_responses(agency_id);
```

---

## AI-Powered Features

### 1. AI Invoice Creation

Generate invoices from natural language or client emails:

```typescript
// Example: AI Invoice Generation
const aiInvoice = await generateInvoiceFromText(`
  John from ABC Corp wants the Growth package with:
  - Extra 3 pages
  - Blog integration
  - Due in 14 days
`);

// Returns structured invoice data:
{
  client_name: "John",
  business_name: "ABC Corp",
  line_items: [
    { description: "Growth Package - Setup", quantity: 1, unit_price: 500 },
    { description: "Growth Package - Monthly (12 months)", quantity: 12, unit_price: 180 },
    { description: "Additional Pages (3)", quantity: 3, unit_price: 100 },
    { description: "Blog Integration", quantity: 1, unit_price: 500 }
  ],
  due_date: "2025-01-08",
  payment_terms: "NET_14"
}
```

### 2. AI Payment Reminders

Auto-generate professional reminder emails:

```typescript
// Reminder levels with AI-generated content
const reminderTemplates = {
  friendly: "3 days before due",      // Gentle reminder
  standard: "1 day after due",        // Standard follow-up
  urgent: "7 days overdue",           // Urgent request
  final: "14+ days overdue"           // Final notice
};

// AI generates contextual, professional email content
```

### 3. AI Insights Dashboard

Smart financial analytics:

```typescript
interface AIInsights {
  // Revenue Trends
  revenue_trend: 'increasing' | 'stable' | 'decreasing';
  revenue_forecast: number;
  
  // Collection Efficiency
  avg_days_to_payment: number;
  collection_rate: number;
  at_risk_invoices: Invoice[];
  
  // Recommendations
  recommendations: [
    "Consider offering early payment discount - 15% of clients pay late",
    "Package upgrade opportunity: 3 clients on Starter could benefit from Growth",
    "Outstanding balance from ABC Corp ($2,500) overdue 21 days - follow up recommended"
  ];
  
  // Seasonal Patterns
  best_sending_day: 'Tuesday';
  best_sending_time: '10:00 AM';
}
```

---

## Public Shareable Links

Using PR Preview pattern for secure, shareable URLs:

### Proposal Links
```
https://p-{proposal_slug}.webkit.au
https://p-{proposal_slug}.webkit.au?token={public_token}
```

### Questionnaire Links  
```
https://q-{questionnaire_slug}.webkit.au
https://q-{questionnaire_slug}.webkit.au?token={public_token}
```

### Implementation
- Cloudflare Workers for routing
- Token validation for security
- Tracking pixel for view analytics
- No login required for viewing

---

## Email Integration (Resend)

### Agency Email Configuration

```typescript
interface AgencyEmailConfig {
  // Resend Configuration
  resend_api_key: string;
  
  // Custom Sender
  from_email: string;           // "invoices@plentify.au"
  from_name: string;            // "Plentify Web Designs"
  reply_to: string;             // "ben@plentify.au"
  
  // Templates (customizable per agency)
  templates: {
    proposal_sent: string;
    invoice_sent: string;
    payment_reminder: string;
    questionnaire_sent: string;
    payment_received: string;
  };
}
```

### Email Types

| Type | Trigger | Template |
|------|---------|----------|
| `proposal_sent` | Send proposal | Proposal link + summary |
| `invoice_sent` | Send invoice | Invoice PDF + Stripe link |
| `payment_reminder` | Scheduled | AI-generated reminder |
| `questionnaire_sent` | Payment received | Questionnaire link |
| `payment_received` | Stripe webhook | Thank you + next steps |

---

## E-Signature Integration

### DocuSign/HelloSign Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    E-SIGNATURE FLOW                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Contract Generated                                           │
│     └─▶ PDF created with merge fields                           │
│                                                                  │
│  2. Send for Signature                                           │
│     ├─▶ Option A: DocuSign API                                  │
│     │   - Create envelope                                        │
│     │   - Add signature fields                                   │
│     │   - Send to client                                         │
│     │                                                            │
│     └─▶ Option B: PDF Download                                  │
│         - Client downloads PDF                                   │
│         - Signs physically                                       │
│         - Uploads signed copy                                    │
│                                                                  │
│  3. Signature Received                                           │
│     └─▶ Webhook updates contract status                         │
│         └─▶ Triggers invoice generation                         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Unified Form Builder Architecture

> **Key Design Decision**: A single form builder system powers BOTH the consultation form customization AND the website questionnaire. This reduces development effort and provides a consistent experience.

### Form Builder Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        UNIFIED FORM BUILDER                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     FORM DEFINITION                                  │   │
│  │  (form_definitions table)                                            │   │
│  │                                                                      │   │
│  │  form_type: 'consultation' | 'questionnaire' | 'custom'             │   │
│  │                                                                      │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐     │   │
│  │  │ Section 1       │  │ Section 2       │  │ Section 3       │     │   │
│  │  │ "Contact Info"  │  │ "Business"      │  │ "Goals"         │     │   │
│  │  │                 │  │                 │  │                 │     │   │
│  │  │ ┌─────────────┐│  │ ┌─────────────┐│  │ ┌─────────────┐│     │   │
│  │  │ │ Field: name ││  │ │ Field:      ││  │ │ Field:      ││     │   │
│  │  │ │ type: text  ││  │ │ industry    ││  │ │ budget      ││     │   │
│  │  │ └─────────────┘│  │ │ type: select││  │ │ type: select││     │   │
│  │  │ ┌─────────────┐│  │ └─────────────┘│  │ └─────────────┘│     │   │
│  │  │ │ Field: email││  │ ┌─────────────┐│  │ ┌─────────────┐│     │   │
│  │  │ │ type: email ││  │ │ Field: size ││  │ │ Field: goals││     │   │
│  │  │ └─────────────┘│  │ │ type: number││  │ │ type: multi ││     │   │
│  │  │                 │  │ └─────────────┘│  │ └─────────────┘│     │   │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  SHARED COMPONENTS:                                                          │
│  • FormBuilder.svelte         - Admin: Build/edit forms                     │
│  • FormRenderer.svelte        - Client: Display/fill forms                  │
│  • FieldEditor.svelte         - Admin: Configure individual fields          │
│  • ConditionalLogic.svelte    - Admin: Set up show/hide rules              │
│  • OptionsManager.svelte      - Admin: Manage dropdown options              │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Use Cases

| Form Type | Use Case | Notes |
|-----------|----------|-------|
| `consultation` | Client discovery form | Pre-sale, captures business needs |
| `questionnaire` | Post-payment content collection | Unlocked after payment, detailed content |
| `custom` | Agency-specific forms | Feedback, surveys, intake forms |

### Field Types Supported

| Field Type | Description | Use Case |
|------------|-------------|----------|
| `text` | Single line text | Names, short answers |
| `textarea` | Multi-line text | Descriptions, notes |
| `rich_text` | WYSIWYG editor | Content copy, about sections |
| `email` | Email with validation | Contact emails |
| `phone` | Phone with formatting | Contact numbers |
| `url` | URL with validation | Website addresses |
| `number` | Numeric input | Team size, budgets |
| `date` | Date picker | Timelines, deadlines |
| `select` | Single dropdown | Industry, budget range |
| `multiselect` | Multiple selection | Goals, challenges |
| `radio` | Radio buttons | Yes/no, single choice |
| `checkbox` | Checkboxes | Terms acceptance, multi-choice |
| `file_upload` | File attachment | Documents, PDFs |
| `image_upload` | Image with preview | Logos, photos |
| `heading` | Section heading | Visual organization |
| `paragraph` | Descriptive text | Instructions, context |

### Conditional Logic

Fields and sections can be shown/hidden based on previous answers:

```typescript
// Example: Show "Enterprise features" section only for budget > $10k
{
  "condition_type": "show",
  "rules": [
    {
      "field": "budget_range",
      "operator": "in",
      "value": ["$10k-$25k", "$25k-$50k", "$50k+"]
    }
  ],
  "logic": "AND"  // or "OR" for multiple rules
}

// Operators available:
// equals, not_equals, contains, not_contains,
// in, not_in, greater_than, less_than, is_empty, is_not_empty
```

### Options Management

Fields can source their options from multiple places:

```typescript
// Option 1: Static options defined in field
{
  "options_source": "static",
  "options": [
    { "value": "tech", "label": "Technology" },
    { "value": "health", "label": "Healthcare" }
  ]
}

// Option 2: Reference agency_form_options table
{
  "options_source": "agency_form_options:industry"
  // Pulls from agency_form_options WHERE category = 'industry'
}

// Option 3: Dynamic from API (future)
{
  "options_source": "api:/api/lookup/industries"
}
```

### Form Builder UI Routes

```
/[agencySlug]/settings/
├── forms/                           # Form management
│   ├── +page.svelte                 # List all forms
│   ├── new/+page.svelte             # Create new form
│   └── [formId]/
│       ├── +page.svelte             # Form builder UI
│       ├── preview/+page.svelte     # Preview mode
│       └── settings/+page.svelte    # Form settings
│
├── consultation-form/               # Quick link to consultation form
│   └── +page.svelte                 # Edit default consultation form
│
└── questionnaire-templates/         # Questionnaire templates
    └── +page.svelte                 # Manage questionnaire templates
```

### Migration from Current System

The existing consultation form will continue to work during migration:

1. **Phase 5a**: Build form builder infrastructure
2. **Phase 5b**: Create "system default" consultation form definition
3. **Phase 5c**: Agency can clone default → customize
4. **Phase 5d**: Existing `agency_form_options` → converted to form field options
5. **Phase 5e**: Form renderer replaces hardcoded wizard components

### Form Builder Components

```
service-client/src/lib/components/
├── form-builder/
│   ├── FormBuilder.svelte           # Main builder canvas
│   ├── SectionList.svelte           # Sortable section list
│   ├── FieldPalette.svelte          # Draggable field types
│   ├── FieldEditor.svelte           # Configure selected field
│   ├── OptionsEditor.svelte         # Manage select options
│   ├── ConditionalEditor.svelte     # Build show/hide rules
│   ├── FormPreview.svelte           # Live preview
│   └── FormSettings.svelte          # Form-level settings
│
├── form-renderer/
│   ├── FormRenderer.svelte          # Renders form from definition
│   ├── SectionRenderer.svelte       # Renders a section
│   ├── FieldRenderer.svelte         # Renders a field by type
│   ├── fields/                      # Individual field components
│   │   ├── TextField.svelte
│   │   ├── SelectField.svelte
│   │   ├── MultiSelectField.svelte
│   │   ├── FileUploadField.svelte
│   │   ├── RichTextField.svelte
│   │   └── ...
│   └── ConditionalWrapper.svelte    # Handles show/hide logic
```

### Remote Functions for Form Builder

```typescript
// Form Definition Management
export const getFormDefinitions = query(...)      // List agency forms
export const getFormDefinition = query(...)       // Get single form
export const createFormDefinition = command(...)  // Create new form
export const updateFormDefinition = command(...)  // Update form
export const deleteFormDefinition = command(...)  // Delete form
export const cloneFormDefinition = command(...)   // Clone existing form
export const publishFormDefinition = command(...) // Publish version

// Section Management
export const addSection = command(...)
export const updateSection = command(...)
export const deleteSection = command(...)
export const reorderSections = command(...)

// Field Management
export const addField = command(...)
export const updateField = command(...)
export const deleteField = command(...)
export const reorderFields = command(...)

// Form Responses
export const saveFormResponse = command(...)
export const getFormResponse = query(...)
export const submitFormResponse = command(...)
```

---

## Implementation Phases

### Phase 1: Proposals ✅ COMPLETE
- [x] Database schema (proposals, contract_templates)
- [x] Proposal generator from consultation
- [x] PDF generation (Gotenberg)
- [x] Public shareable links (`/p/[slug]`)
- [x] Proposal preview & edit
- [ ] PageSpeed audit integration (deferred)

### Phase 2: Contracts ✅ COMPLETE
- [x] Contract template management
- [x] Merge field system
- [x] PDF contract generation (Gotenberg)
- [x] Simple signature (typed name + checkbox)
- [x] Public contract view (`/c/[slug]`)
- [ ] PDF upload alternative (deferred)

### Phase 3: Invoices ✅ COMPLETE
- [x] Invoice CRUD (standalone + from proposal/contract)
- [x] Line item management with per-item taxable flag
- [x] Invoice PDF generation (Gotenberg)
- [x] Status tracking (draft → sent → viewed → paid/overdue/cancelled)
- [x] Public invoice view (`/i/[slug]`)
- [x] Manual payment recording
- [ ] Stripe Payment Link integration (deferred to Phase 4)
- [ ] AI invoice creation from text (deferred)

### Phase 4: Email & Reminders ✅ COMPLETE
- [x] Resend integration (email.service.ts with lazy client initialization)
- [x] Email templates per document type (professional HTML templates)
- [x] Send documents with PDF attachments (proposals, invoices, contracts)
- [x] Email logging (email_logs table with status tracking)
- [x] Email history component (EmailHistory.svelte with email type badges)
- [x] Emails list page with filters (/{agencySlug}/emails)
- [x] Retry failed emails functionality
- [x] Manual payment reminder sending (Send Reminder action)
- [x] Overdue reminder email template with urgency styling and days past due
- [x] Automatic overdue status detection (updates invoice status on fetch)
- [x] Expanded invoice editing (dates, line items, financials for non-draft invoices)
- [ ] Scheduled payment reminders - deferred to Phase 5
- [ ] AI reminder generation - deferred
- [ ] Email tracking via Resend webhooks (opens, clicks) - deferred

### Phase 5: Unified Form Builder & Questionnaire (Week 7-9)

**Unified Form Builder** - Single system for both consultation and questionnaire customization:
- [ ] Form builder database schema (form_definitions, form_sections, form_fields)
- [ ] Form builder UI components (drag-and-drop sections/fields)
- [ ] Field type library (text, select, multiselect, file upload, rich text, etc.)
- [ ] Conditional logic engine (show/hide based on previous answers)
- [ ] Form preview and testing mode
- [ ] Version control for form definitions
- [ ] Import/export form templates

**Consultation Form Customization:**
- [ ] Agency settings page for consultation form management
- [ ] Edit default consultation sections and fields
- [ ] Manage dropdown options (replaces simple agency_form_options)
- [ ] Industry-specific field presets
- [ ] Clone and customize system default form

**Website Questionnaire:**
- [ ] Questionnaire template management
- [ ] Public questionnaire links with token auth
- [ ] Payment-unlocked access (Stripe webhook integration)
- [ ] Auto-save progress with resume capability
- [ ] File/image upload handling (R2/S3)
- [ ] Content brief auto-generation from responses

### Phase 6: AI Dashboard (Week 9)
- [ ] Invoice insights calculation
- [ ] AI analysis integration
- [ ] Dashboard widgets
- [ ] Recommendations engine

### Phase 7: E-Signature (Week 10)
- [ ] DocuSign/HelloSign integration
- [ ] Envelope management
- [ ] Webhook handlers
- [ ] Signature status tracking

---

## API Endpoints (Remote Functions)

```typescript
// Proposals
export const createProposal = command(...)
export const getProposal = query(...)
export const sendProposal = command(...)
export const getProposalBySlug = query(...)  // Public

// Contracts
export const createContract = command(...)
export const signContract = command(...)
export const uploadSignedPdf = command(...)

// Invoices
export const createInvoice = command(...)
export const sendInvoice = command(...)
export const generateInvoiceFromText = command(...)  // AI
export const getInvoiceInsights = query(...)         // AI

// Questionnaires
export const createQuestionnaire = command(...)
export const unlockQuestionnaire = command(...)
export const saveQuestionnaireProgress = command(...)
export const generateContentBrief = command(...)

// Email
export const sendEmail = command(...)
export const scheduleReminder = command(...)
export const generateReminder = command(...)  // AI

// Form Builder (Unified)
export const getFormDefinitions = query(...)      // List agency forms
export const getFormDefinition = query(...)       // Get single form with sections/fields
export const createFormDefinition = command(...)  // Create new form
export const updateFormDefinition = command(...)  // Update form metadata
export const deleteFormDefinition = command(...)  // Delete form
export const cloneFormDefinition = command(...)   // Clone existing form
export const publishFormDefinition = command(...) // Publish version
export const addSection = command(...)            // Add section to form
export const updateSection = command(...)         // Update section
export const deleteSection = command(...)         // Delete section
export const reorderSections = command(...)       // Reorder sections
export const addField = command(...)              // Add field to section
export const updateField = command(...)           // Update field
export const deleteField = command(...)           // Delete field
export const reorderFields = command(...)         // Reorder fields
export const saveFormResponse = command(...)      // Save form progress
export const getFormResponse = query(...)         // Get form response
export const submitFormResponse = command(...)    // Submit completed form
```

---

## File Structure (New Additions)

```
service-client/src/
├── lib/
│   ├── api/
│   │   ├── proposal.remote.ts        # NEW
│   │   ├── contract.remote.ts        # NEW
│   │   ├── invoice.remote.ts         # NEW
│   │   ├── questionnaire.remote.ts   # NEW
│   │   ├── email.remote.ts           # NEW
│   │   └── form-builder.remote.ts    # NEW (Unified Form Builder)
│   │
│   ├── server/
│   │   ├── services/
│   │   │   ├── proposal.service.ts   # NEW
│   │   │   ├── contract.service.ts   # NEW
│   │   │   ├── invoice.service.ts    # NEW
│   │   │   ├── questionnaire.service.ts  # NEW
│   │   │   ├── email.service.ts      # NEW
│   │   │   ├── pdf.service.ts        # NEW (Puppeteer)
│   │   │   ├── audit.service.ts      # NEW (PageSpeed)
│   │   │   └── ai.service.ts         # NEW (AI features)
│   │   │
│   │   └── integrations/
│   │       ├── stripe.ts             # NEW
│   │       ├── docusign.ts           # NEW
│   │       └── resend.ts             # NEW
│   │
│   └── components/
│       ├── proposals/
│       │   ├── ProposalBuilder.svelte
│       │   ├── ProposalPreview.svelte
│       │   └── ROICalculator.svelte
│       │
│       ├── contracts/
│       │   ├── ContractViewer.svelte
│       │   ├── SignatureCapture.svelte
│       │   └── PdfUpload.svelte
│       │
│       ├── invoices/
│       │   ├── InvoiceBuilder.svelte
│       │   ├── LineItems.svelte
│       │   ├── InvoicePreview.svelte
│       │   └── AIInvoiceInput.svelte
│       │
│       ├── form-builder/                    # UNIFIED FORM BUILDER
│       │   ├── FormBuilder.svelte           # Main builder canvas
│       │   ├── SectionList.svelte           # Sortable section list
│       │   ├── FieldPalette.svelte          # Draggable field types
│       │   ├── FieldEditor.svelte           # Configure selected field
│       │   ├── OptionsEditor.svelte         # Manage select options
│       │   ├── ConditionalEditor.svelte     # Build show/hide rules
│       │   ├── FormPreview.svelte           # Live preview
│       │   └── FormSettings.svelte          # Form-level settings
│       │
│       ├── form-renderer/                   # FORM DISPLAY ENGINE
│       │   ├── FormRenderer.svelte          # Renders form from definition
│       │   ├── SectionRenderer.svelte       # Renders a section
│       │   ├── FieldRenderer.svelte         # Renders field by type
│       │   ├── ConditionalWrapper.svelte    # Handles show/hide logic
│       │   └── fields/                      # Field type components
│       │       ├── TextField.svelte
│       │       ├── TextareaField.svelte
│       │       ├── SelectField.svelte
│       │       ├── MultiSelectField.svelte
│       │       ├── RadioField.svelte
│       │       ├── CheckboxField.svelte
│       │       ├── DateField.svelte
│       │       ├── NumberField.svelte
│       │       ├── FileUploadField.svelte
│       │       ├── ImageUploadField.svelte
│       │       └── RichTextField.svelte
│       │
│       └── questionnaires/
│           ├── QuestionnaireWizard.svelte   # Uses FormRenderer
│           ├── ContentBrief.svelte
│           └── ProgressTracker.svelte
│
└── routes/
    └── (app)/[agencySlug]/
        ├── proposals/
        │   ├── +page.svelte           # List
        │   ├── new/+page.svelte       # Create
        │   └── [id]/
        │       ├── +page.svelte       # View/Edit
        │       └── preview/+page.svelte
        │
        ├── contracts/
        │   ├── +page.svelte
        │   ├── templates/+page.svelte
        │   └── [id]/+page.svelte
        │
        ├── invoices/
        │   ├── +page.svelte
        │   ├── new/+page.svelte
        │   ├── ai/+page.svelte        # AI invoice creation
        │   └── [id]/+page.svelte
        │
        ├── questionnaires/
        │   ├── +page.svelte
        │   └── [id]/+page.svelte
        │
        └── settings/                  # Agency Settings
            ├── +page.svelte           # General settings
            ├── branding/+page.svelte  # Logo, colors
            ├── forms/                 # UNIFIED FORM BUILDER
            │   ├── +page.svelte       # List all forms
            │   ├── new/+page.svelte   # Create new form
            │   └── [formId]/
            │       ├── +page.svelte   # Form builder UI
            │       ├── preview/+page.svelte
            │       └── settings/+page.svelte
            ├── packages/+page.svelte  # Pricing packages
            ├── addons/+page.svelte    # Add-on services
            └── members/+page.svelte   # Team management
```

---

## Next Steps

1. **Confirm this architecture** - Any adjustments needed?
2. **Start Phase 1** - Begin with proposal database schema and API
3. **Set up Resend** - Email service configuration
4. **PageSpeed API** - Get API key for audits

Ready to proceed with implementation?
