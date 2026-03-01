# WebKit Form Builder Integration: Technical Implementation Specification

**Version:** 2.0 (Clean Slate)  
**Status:** Ready for Development  
**Last Updated:** January 2026

---

## Executive Summary

This specification details the integration of **Svelte Form Builder** into WebKit to solve the "sameness problem" - where all agencies using WebKit would otherwise have identical forms. The integration replaces rigid, one-size-fits-all forms with a customizable form building system while maintaining the consultation-to-proposal automation that differentiates WebKit.

**Key Outcomes:**
- Agencies can fully customize questionnaires, consultation forms, and intake forms
- Each agency's client-facing forms look unique
- Form schemas stored as JSON, rendered dynamically
- New form types enabled (feedback, custom intake)

**Estimated Timeline:** 4-6 weeks for full implementation

**Approach:** Clean slate build - no migration needed. Delete existing hardcoded forms and build the Form Builder system from scratch.

---

## Table of Contents

1. [Scope: What Gets Built](#1-scope-what-gets-built)
2. [Source Project: Svelte Form Builder V2](#2-source-project-svelte-form-builder-v2)
3. [Architecture Overview](#3-architecture-overview)
4. [Database Schema](#4-database-schema)
5. [Component Structure](#5-component-structure)
6. [API Endpoints](#6-api-endpoints)
7. [Form Builder UI Integration](#7-form-builder-ui-integration)
8. [Dynamic Form Renderer](#8-dynamic-form-renderer)
9. [Default Templates](#9-default-templates)
10. [Phased Implementation Plan](#10-phased-implementation-plan)
11. [Testing Strategy](#11-testing-strategy)
12. [Appendix: Field Type Reference](#appendix-field-type-reference)

---

## 1. Scope: What Gets Built

### 1.1 Forms to Create

| Form Type | Purpose | Audience | Priority |
|-----------|---------|----------|----------|
| **Client Questionnaire** | Pre-call intake from prospects | Client-facing | P0 - Critical |
| **Consultation Capture** | Discovery call data capture | Agency-facing | P0 - Critical |
| **Feedback Form** | Post-project client satisfaction | Client-facing | P1 - High |
| **Custom Intake Forms** | Specialized intakes (e-commerce, app, etc.) | Client-facing | P1 - High |

### 1.2 What Gets Deleted

The following hardcoded components will be **removed** and replaced with the Form Builder system:

```
DELETE these files:
├── src/lib/components/consultation/
│   ├── ClientInfoForm.svelte      # Step 1: Contact Info
│   ├── BusinessContext.svelte     # Step 2: Business Context  
│   ├── PainPointsCapture.svelte   # Step 3: Pain Points
│   └── GoalsObjectives.svelte     # Step 4: Goals
```

**Keep the question content** - the 199 curated options will be seeded into `field_option_sets` for agencies to use.

### 1.3 New System Architecture

```
Old (Hardcoded):
┌─────────────────────────────────────────────────────────┐
│ 4 Hardcoded Svelte Components                           │
│ → Same fields for ALL agencies                          │
│ → Same options for ALL agencies                         │
│ → Same layout for ALL agencies                          │
└─────────────────────────────────────────────────────────┘

New (Form Builder):
┌─────────────────────────────────────────────────────────┐
│ Agency Admin: Form Builder UI                           │
│ - Drag/drop any fields from library                     │
│ - Reorder, add, remove steps                            │
│ - Customize labels, options, validation                 │
│ - Save as agency-specific template                      │
│ - Create multiple templates (Quick Quote, Full Discovery)│
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│ Dynamic Form Renderer                                    │
│ - Loads agency's saved form schema from DB              │
│ - Renders with agency branding                          │
│ - Validates with Superforms + Zod                       │
│ - Submits to backend, triggers AI proposal workflow     │
└─────────────────────────────────────────────────────────┘
```

---

## 2. Source Project: Svelte Form Builder V2

### 2.1 Project to Fork

**Repository:** https://github.com/SikandarJODD/form-builder  
**Live Demo:** https://svelte-form-builder.vercel.app/v2  
**Version:** V2 (use `/v2` route, NOT the legacy `/playground`)  
**License:** MIT  
**Stars:** 217+ (actively maintained)

### 2.2 Why V2 Specifically

The project has two versions:
- **Playground (legacy):** Basic form builder, older patterns
- **V2 (recommended):** Modern 3-panel layout, Svelte 5 ready, all advanced features

**Fork V2 because it includes:**

| V2 Feature | WebKit Benefit |
|------------|----------------|
| 3-panel resizable layout | Professional builder UX out of the box |
| Drag-and-drop with side-by-side fields | Agencies can create unique layouts |
| 6 pre-built templates | Starting points we can customize |
| Save/load/edit/duplicate | Form management already built |
| JSON import/export | AI-assisted form generation possible |
| Real-time preview | Instant feedback while building |
| Keyboard shortcuts | Power user efficiency |

### 2.3 Svelte 5 Compatibility Confirmed

The V2 codebase uses **Svelte 5 runes syntax** throughout:

```svelte
<!-- V2 uses modern Svelte 5 patterns -->
<script lang="ts">
  let { data }: { data: { form: SuperValidated<Infer<FormSchema>> } } = $props();
  
  let selectedField = $state(null);
  let previewMode = $state<"desktop" | "mobile">("desktop");
  
  const fieldCount = $derived(schema.steps.flatMap(s => s.fields).length);
</script>
```

**Stack alignment verified:**

| WebKit Stack | Form Builder V2 | Status |
|--------------|-----------------|--------|
| SvelteKit 2.x | SvelteKit 2.x | ✅ Match |
| Svelte 5 (runes) | Svelte 5 (runes) | ✅ Match |
| Superforms | Superforms native | ✅ Match |
| Zod 4 | Zod 4 + Valibot + Arktype | ✅ Match |
| shadcn-svelte | shadcn-svelte (next) | ✅ Match |
| Tailwind CSS | Tailwind CSS v4 | ✅ Match |
| TypeScript | TypeScript | ✅ Match |

### 2.4 What to Fork vs Build

**Fork from V2 (save weeks of work):**
- 3-panel builder layout (`/v2` routes)
- Drag-and-drop infrastructure
- Field component structure
- Schema generation logic
- Preview rendering

**Build custom for WebKit:**
- Agency-specific form storage (PostgreSQL integration)
- Option set management (link to `field_option_sets` table)
- Submission handling (Go backend integration)
- Agency branding wrapper
- WebKit-specific fields (signature, rating)
- Multi-tenant form isolation

### 2.5 Fork Instructions

```bash
# 1. Clone the repo
git clone https://github.com/SikandarJODD/form-builder.git webkit-form-builder

# 2. Key directories to extract for WebKit:
#    - src/routes/v2/          → Form builder pages (reference)
#    - src/lib/components/     → Core components to adapt
#    - src/lib/               → Utilities and stores

# 3. Adapt to WebKit structure:
#    - Move components to src/lib/components/form-builder/
#    - Update imports to use WebKit's shadcn-svelte components
#    - Connect to WebKit's API endpoints
#    - Add agency context/authentication
```

---

## 3. Architecture Overview

### 3.1 High-Level Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DESIGN TIME (Agency Admin)                         │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
     ┌────────────────────────────────┼────────────────────────────────┐
     │                                │                                │
     ▼                                ▼                                ▼
┌──────────────┐            ┌──────────────────┐            ┌──────────────┐
│ Form Builder │            │  Field Library   │            │   Templates  │
│     UI       │◄──────────►│  (Drag Source)   │            │   (Presets)  │
│              │            │                  │            │              │
└──────────────┘            └──────────────────┘            └──────────────┘
     │
     │ Save Form
     ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                              PostgreSQL                                       │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │ agency_forms                                                             │ │
│  │ - id, agency_id, name, form_type                                        │ │
│  │ - schema (JSONB) ← Zod schema as JSON                                   │ │
│  │ - ui_config (JSONB) ← Layout, steps, styling                            │ │
│  │ - field_config (JSONB) ← Custom labels, options                         │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ Load Schema
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           RUNTIME (Form Fill)                                │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
     ┌────────────────────────────────┼────────────────────────────────┐
     │                                │                                │
     ▼                                ▼                                ▼
┌──────────────┐            ┌──────────────────┐            ┌──────────────┐
│   Dynamic    │            │   Superforms     │            │    Agency    │
│   Renderer   │◄──────────►│   Validation     │            │   Branding   │
│              │            │                  │            │              │
└──────────────┘            └──────────────────┘            └──────────────┘
     │
     │ Submit
     ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                              Go Backend API                                   │
│  - Validates against stored schema                                           │
│  - Stores submission in form_submissions                                     │
│  - Triggers downstream workflows (AI proposal, notifications)                │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Component Architecture

```
webkit/
├── src/
│   ├── lib/
│   │   ├── components/
│   │   │   ├── form-builder/              # Forked from SikandarJODD/form-builder
│   │   │   │   ├── Builder.svelte         # Main 3-panel builder UI
│   │   │   │   ├── FieldLibrary.svelte    # Left panel: available fields
│   │   │   │   ├── FormCanvas.svelte      # Center panel: drag-drop canvas
│   │   │   │   ├── FieldProperties.svelte # Right panel: field config
│   │   │   │   ├── PreviewPanel.svelte    # Live preview
│   │   │   │   ├── fields/                # Individual field components
│   │   │   │   │   ├── TextField.svelte
│   │   │   │   │   ├── EmailField.svelte
│   │   │   │   │   ├── SelectField.svelte
│   │   │   │   │   ├── MultiSelectField.svelte
│   │   │   │   │   ├── CheckboxField.svelte
│   │   │   │   │   ├── RadioField.svelte
│   │   │   │   │   ├── TextareaField.svelte
│   │   │   │   │   ├── NumberField.svelte
│   │   │   │   │   ├── DateField.svelte
│   │   │   │   │   ├── PhoneField.svelte
│   │   │   │   │   ├── UrlField.svelte
│   │   │   │   │   ├── FileUploadField.svelte
│   │   │   │   │   ├── SignatureField.svelte    # Custom for WebKit
│   │   │   │   │   ├── RatingField.svelte       # Custom for WebKit
│   │   │   │   │   └── index.ts                 # Field registry
│   │   │   │   ├── templates/             # Pre-built form templates
│   │   │   │   │   ├── QuickQuote.json
│   │   │   │   │   ├── FullDiscovery.json
│   │   │   │   │   ├── EcommerceIntake.json
│   │   │   │   │   ├── FeedbackForm.json
│   │   │   │   │   └── index.ts
│   │   │   │   └── utils/
│   │   │   │       ├── schema-generator.ts    # JSON → Zod schema
│   │   │   │       ├── schema-validator.ts    # Validate schema structure
│   │   │   │       └── field-registry.ts      # Available field types
│   │   │   │
│   │   │   ├── form-renderer/             # Dynamic form rendering
│   │   │   │   ├── DynamicForm.svelte     # Main renderer component
│   │   │   │   ├── FormStep.svelte        # Multi-step wrapper
│   │   │   │   ├── FieldRenderer.svelte   # Routes to correct field
│   │   │   │   └── FormBranding.svelte    # Agency branding wrapper
│   │   │   │
│   │   │   └── ui/                        # Existing shadcn-svelte components
│   │   │
│   │   ├── stores/
│   │   │   └── form-builder.ts            # Builder state management
│   │   │
│   │   └── types/
│   │       └── form-builder.ts            # TypeScript definitions
│   │
│   └── routes/
│       ├── (app)/
│       │   └── settings/
│       │       └── forms/                 # Agency form management
│       │           ├── +page.svelte       # List agency forms
│       │           ├── [formId]/
│       │           │   └── +page.svelte   # Edit specific form
│       │           └── new/
│       │               └── +page.svelte   # Create new form
│       │
│       └── (public)/
│           └── forms/
│               └── [agencySlug]/
│                   └── [formSlug]/
│                       └── +page.svelte   # Public form renderer
```

---

## 4. Database Schema

### 4.1 Core Tables

```sql
-- ============================================================================
-- FORM DEFINITIONS (Design Time)
-- ============================================================================

CREATE TABLE agency_forms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
    
    -- Form Identification
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    description TEXT,
    form_type VARCHAR(50) NOT NULL CHECK (form_type IN (
        'questionnaire',      -- Client-facing intake
        'consultation',       -- Agency-facing discovery capture
        'feedback',           -- Post-project feedback
        'intake',            -- Generic intake form
        'custom'             -- User-defined type
    )),
    
    -- Form Schema (Zod-compatible JSON)
    schema JSONB NOT NULL,
    
    -- UI Configuration
    ui_config JSONB NOT NULL DEFAULT '{
        "layout": "single-column",
        "showProgressBar": true,
        "showStepNumbers": true,
        "submitButtonText": "Submit",
        "successMessage": "Thank you for your submission!"
    }'::jsonb,
    
    -- Branding Overrides (inherits from agency if null)
    branding JSONB DEFAULT NULL,
    
    -- Form Settings
    is_active BOOLEAN DEFAULT true,
    is_default BOOLEAN DEFAULT false,  -- Default form for this type
    requires_auth BOOLEAN DEFAULT false,
    
    -- Metadata
    version INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    
    -- Constraints
    UNIQUE(agency_id, slug),
    UNIQUE(agency_id, form_type, is_default) WHERE is_default = true
);

-- Index for common queries
CREATE INDEX idx_agency_forms_agency_type ON agency_forms(agency_id, form_type);
CREATE INDEX idx_agency_forms_active ON agency_forms(agency_id, is_active);
CREATE INDEX idx_agency_forms_schema ON agency_forms USING GIN (schema);


-- ============================================================================
-- FORM SUBMISSIONS (Runtime)
-- ============================================================================

CREATE TABLE form_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_id UUID NOT NULL REFERENCES agency_forms(id) ON DELETE CASCADE,
    agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
    
    -- Submission Data (flexible JSONB - matches form schema)
    data JSONB NOT NULL,
    
    -- Linked Entities (created after submission processing)
    prospect_id UUID REFERENCES prospects(id) ON DELETE SET NULL,
    consultation_id UUID REFERENCES consultations(id) ON DELETE SET NULL,
    
    -- Submission Metadata
    metadata JSONB DEFAULT '{}'::jsonb,  -- IP, user agent, referrer, UTM params
    
    -- Status
    status VARCHAR(50) DEFAULT 'completed' CHECK (status IN (
        'draft',        -- Partial submission (if enabled)
        'completed',    -- Full submission
        'processing',   -- Being processed by workflow
        'processed',    -- Processed, entities created
        'archived'      -- Archived/deleted
    )),
    
    -- Timestamps
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE,
    
    -- Form version at time of submission (for schema evolution)
    form_version INTEGER NOT NULL
);

-- Indexes
CREATE INDEX idx_submissions_form ON form_submissions(form_id);
CREATE INDEX idx_submissions_agency ON form_submissions(agency_id);
CREATE INDEX idx_submissions_status ON form_submissions(status);
CREATE INDEX idx_submissions_prospect ON form_submissions(prospect_id) WHERE prospect_id IS NOT NULL;
CREATE INDEX idx_submissions_data ON form_submissions USING GIN (data);
CREATE INDEX idx_submissions_submitted ON form_submissions(submitted_at DESC);


-- ============================================================================
-- FORM TEMPLATES (System-wide starting points)
-- ============================================================================

CREATE TABLE form_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Template Info
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    category VARCHAR(100) NOT NULL,  -- 'questionnaire', 'consultation', etc.
    
    -- Template Schema
    schema JSONB NOT NULL,
    ui_config JSONB NOT NULL,
    
    -- Display
    preview_image_url TEXT,
    is_featured BOOLEAN DEFAULT false,
    display_order INTEGER DEFAULT 0,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- ============================================================================
-- FIELD OPTIONS LIBRARY (Reusable dropdown options)
-- ============================================================================

CREATE TABLE field_option_sets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE,  -- NULL = system-wide
    
    -- Option Set Info
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Options as JSON array
    options JSONB NOT NULL,  -- [{"value": "tech", "label": "Technology"}, ...]
    
    -- Metadata
    is_system BOOLEAN DEFAULT false,  -- System options can't be deleted
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(agency_id, slug)
);
```

### 4.2 Seed System Option Sets

```sql
-- Seed with WebKit's curated 199 options organized by category

INSERT INTO field_option_sets (name, slug, options, is_system) VALUES

-- Industries (16 options)
('Industries', 'industries', '[
    {"value": "technology", "label": "Technology & Software"},
    {"value": "healthcare", "label": "Healthcare & Medical"},
    {"value": "finance", "label": "Finance & Banking"},
    {"value": "retail", "label": "Retail & E-commerce"},
    {"value": "manufacturing", "label": "Manufacturing"},
    {"value": "education", "label": "Education"},
    {"value": "real-estate", "label": "Real Estate"},
    {"value": "hospitality", "label": "Hospitality & Tourism"},
    {"value": "legal", "label": "Legal Services"},
    {"value": "marketing", "label": "Marketing & Advertising"},
    {"value": "construction", "label": "Construction"},
    {"value": "automotive", "label": "Automotive"},
    {"value": "food-beverage", "label": "Food & Beverage"},
    {"value": "entertainment", "label": "Entertainment & Media"},
    {"value": "nonprofit", "label": "Non-Profit"},
    {"value": "other", "label": "Other"}
]'::jsonb, true),

-- Business Types (7 options)
('Business Types', 'business-types', '[
    {"value": "startup", "label": "Startup (< 2 years)"},
    {"value": "small-business", "label": "Small Business (2-10 employees)"},
    {"value": "medium-business", "label": "Medium Business (11-50 employees)"},
    {"value": "enterprise", "label": "Enterprise (50+ employees)"},
    {"value": "freelancer", "label": "Freelancer / Sole Proprietor"},
    {"value": "agency", "label": "Agency"},
    {"value": "nonprofit", "label": "Non-Profit Organization"}
]'::jsonb, true),

-- Budget Ranges (9 options)
('Budget Ranges', 'budget-ranges', '[
    {"value": "under-1k", "label": "Under $1,000"},
    {"value": "1k-5k", "label": "$1,000 - $5,000"},
    {"value": "5k-10k", "label": "$5,000 - $10,000"},
    {"value": "10k-25k", "label": "$10,000 - $25,000"},
    {"value": "25k-50k", "label": "$25,000 - $50,000"},
    {"value": "50k-100k", "label": "$50,000 - $100,000"},
    {"value": "100k-plus", "label": "$100,000+"},
    {"value": "ongoing", "label": "Ongoing Retainer"},
    {"value": "not-sure", "label": "Not Sure Yet"}
]'::jsonb, true),

-- Urgency Levels (4 options)
('Urgency Levels', 'urgency-levels', '[
    {"value": "low", "label": "Low - No rush, exploring options"},
    {"value": "medium", "label": "Medium - Want to start within 1-3 months"},
    {"value": "high", "label": "High - Need to start within 2-4 weeks"},
    {"value": "urgent", "label": "Urgent - Need to start immediately"}
]'::jsonb, true),

-- Digital Presence (11 options)
('Digital Presence', 'digital-presence', '[
    {"value": "website", "label": "Company Website"},
    {"value": "ecommerce", "label": "E-commerce Store"},
    {"value": "blog", "label": "Blog"},
    {"value": "social-facebook", "label": "Facebook"},
    {"value": "social-instagram", "label": "Instagram"},
    {"value": "social-linkedin", "label": "LinkedIn"},
    {"value": "social-twitter", "label": "Twitter/X"},
    {"value": "social-youtube", "label": "YouTube"},
    {"value": "social-tiktok", "label": "TikTok"},
    {"value": "mobile-app", "label": "Mobile App"},
    {"value": "none", "label": "No Digital Presence"}
]'::jsonb, true),

-- Marketing Channels (17 options)
('Marketing Channels', 'marketing-channels', '[
    {"value": "seo", "label": "SEO / Organic Search"},
    {"value": "ppc", "label": "PPC / Paid Ads"},
    {"value": "social-media", "label": "Social Media Marketing"},
    {"value": "email", "label": "Email Marketing"},
    {"value": "content", "label": "Content Marketing"},
    {"value": "influencer", "label": "Influencer Marketing"},
    {"value": "affiliate", "label": "Affiliate Marketing"},
    {"value": "referral", "label": "Referral Program"},
    {"value": "events", "label": "Events & Trade Shows"},
    {"value": "pr", "label": "Public Relations"},
    {"value": "direct-mail", "label": "Direct Mail"},
    {"value": "cold-outreach", "label": "Cold Outreach"},
    {"value": "partnerships", "label": "Strategic Partnerships"},
    {"value": "print", "label": "Print Advertising"},
    {"value": "radio-tv", "label": "Radio/TV Advertising"},
    {"value": "word-of-mouth", "label": "Word of Mouth"},
    {"value": "none", "label": "No Active Marketing"}
]'::jsonb, true),

-- Primary Challenges (20 options)
('Primary Challenges', 'primary-challenges', '[
    {"value": "outdated-website", "label": "Outdated website design"},
    {"value": "poor-mobile", "label": "Poor mobile experience"},
    {"value": "slow-performance", "label": "Slow website performance"},
    {"value": "low-conversions", "label": "Low conversion rates"},
    {"value": "poor-seo", "label": "Poor search engine rankings"},
    {"value": "no-leads", "label": "Not generating enough leads"},
    {"value": "brand-mismatch", "label": "Website doesn''t match brand"},
    {"value": "hard-to-update", "label": "Difficult to update content"},
    {"value": "security-concerns", "label": "Security vulnerabilities"},
    {"value": "no-analytics", "label": "No analytics or insights"},
    {"value": "poor-ux", "label": "Confusing user experience"},
    {"value": "no-ecommerce", "label": "Need e-commerce capabilities"},
    {"value": "integration-issues", "label": "Integration problems"},
    {"value": "accessibility", "label": "Accessibility compliance"},
    {"value": "scalability", "label": "Can''t handle growth"},
    {"value": "competitor-gap", "label": "Falling behind competitors"},
    {"value": "no-online-presence", "label": "No online presence at all"},
    {"value": "rebrand", "label": "Going through rebrand"},
    {"value": "merger", "label": "Company merger/acquisition"},
    {"value": "other", "label": "Other challenges"}
]'::jsonb, true),

-- Primary Goals (15 options)
('Primary Goals', 'primary-goals', '[
    {"value": "increase-sales", "label": "Increase online sales"},
    {"value": "generate-leads", "label": "Generate more leads"},
    {"value": "build-brand", "label": "Build brand awareness"},
    {"value": "improve-ux", "label": "Improve user experience"},
    {"value": "modernize", "label": "Modernize design"},
    {"value": "improve-seo", "label": "Improve search rankings"},
    {"value": "mobile-first", "label": "Better mobile experience"},
    {"value": "faster-site", "label": "Faster website performance"},
    {"value": "easier-updates", "label": "Easier content management"},
    {"value": "integrate-tools", "label": "Integrate with other tools"},
    {"value": "expand-market", "label": "Expand to new markets"},
    {"value": "reduce-costs", "label": "Reduce operational costs"},
    {"value": "compliance", "label": "Meet compliance requirements"},
    {"value": "customer-service", "label": "Improve customer service"},
    {"value": "competitive-edge", "label": "Gain competitive advantage"}
]'::jsonb, true),

-- Success Metrics (15 options)
('Success Metrics', 'success-metrics', '[
    {"value": "traffic-increase", "label": "Increased website traffic"},
    {"value": "conversion-rate", "label": "Higher conversion rate"},
    {"value": "lead-volume", "label": "More leads generated"},
    {"value": "revenue-growth", "label": "Revenue growth"},
    {"value": "bounce-rate", "label": "Lower bounce rate"},
    {"value": "time-on-site", "label": "Longer time on site"},
    {"value": "page-views", "label": "More page views per visit"},
    {"value": "search-rankings", "label": "Better search rankings"},
    {"value": "mobile-traffic", "label": "Increased mobile traffic"},
    {"value": "customer-satisfaction", "label": "Customer satisfaction scores"},
    {"value": "support-tickets", "label": "Fewer support tickets"},
    {"value": "cart-abandonment", "label": "Lower cart abandonment"},
    {"value": "email-signups", "label": "More email signups"},
    {"value": "social-engagement", "label": "Social media engagement"},
    {"value": "brand-mentions", "label": "Brand mentions/PR"}
]'::jsonb, true);
```

### 4.3 Schema JSON Structure

The `schema` field in `agency_forms` stores a JSON representation compatible with Zod:

```typescript
// TypeScript type for schema JSONB
interface FormSchema {
  version: "1.0";
  steps: FormStep[];
}

interface FormStep {
  id: string;
  title: string;
  description?: string;
  fields: FormField[];
}

interface FormField {
  id: string;
  type: FieldType;
  name: string;                    // Form field name (used in data)
  label: string;
  description?: string;
  placeholder?: string;
  required: boolean;
  validation?: ValidationRules;
  options?: FieldOption[];         // For select, radio, checkbox
  optionSetSlug?: string;          // Reference to field_option_sets
  defaultValue?: any;
  conditionalLogic?: ConditionalRule[];
  layout?: {
    width: "full" | "half" | "third";
    order: number;
  };
}

type FieldType = 
  | "text" | "email" | "password" | "tel" | "url"
  | "textarea" | "number" | "date" | "datetime"
  | "select" | "multiselect" | "radio" | "checkbox"
  | "file" | "signature" | "rating" | "slider"
  | "heading" | "paragraph" | "divider";  // Layout elements

interface ValidationRules {
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  patternMessage?: string;
  customMessage?: string;
}

interface FieldOption {
  value: string;
  label: string;
}

interface ConditionalRule {
  field: string;           // Field name to check
  operator: "equals" | "notEquals" | "contains" | "greaterThan" | "lessThan";
  value: any;
  action: "show" | "hide" | "require";
}
```

### 4.4 Example Stored Schema

```json
{
  "version": "1.0",
  "steps": [
    {
      "id": "contact",
      "title": "Contact Information",
      "description": "Let's start with your details",
      "fields": [
        {
          "id": "business_name",
          "type": "text",
          "name": "businessName",
          "label": "Business Name",
          "placeholder": "Acme Corp",
          "required": false,
          "layout": { "width": "full", "order": 1 }
        },
        {
          "id": "contact_email",
          "type": "email",
          "name": "email",
          "label": "Email Address",
          "placeholder": "you@company.com",
          "required": true,
          "validation": {
            "customMessage": "Please enter a valid email address"
          },
          "layout": { "width": "half", "order": 2 }
        },
        {
          "id": "contact_phone",
          "type": "tel",
          "name": "phone",
          "label": "Phone Number",
          "placeholder": "(04XX) XXX XXX",
          "required": false,
          "layout": { "width": "half", "order": 3 }
        }
      ]
    },
    {
      "id": "business",
      "title": "About Your Business",
      "fields": [
        {
          "id": "industry",
          "type": "select",
          "name": "industry",
          "label": "Industry",
          "required": true,
          "optionSetSlug": "industries",
          "layout": { "width": "half", "order": 1 }
        },
        {
          "id": "budget",
          "type": "select",
          "name": "budgetRange",
          "label": "Budget Range",
          "required": true,
          "optionSetSlug": "budget-ranges",
          "layout": { "width": "half", "order": 2 }
        }
      ]
    }
  ]
}
```

---

## 5. Component Structure

### 5.1 Form Builder Components

#### `Builder.svelte` - Main Builder Interface

```svelte
<!-- src/lib/components/form-builder/Builder.svelte -->
<script lang="ts">
  import { Resizable } from "$lib/components/ui/resizable";
  import FieldLibrary from "./FieldLibrary.svelte";
  import FormCanvas from "./FormCanvas.svelte";
  import FieldProperties from "./FieldProperties.svelte";
  import PreviewPanel from "./PreviewPanel.svelte";
  import { formBuilderStore } from "$lib/stores/form-builder";
  import type { FormSchema } from "$lib/types/form-builder";
  
  interface Props {
    initialSchema?: FormSchema;
    onSave: (schema: FormSchema) => Promise<void>;
    agencyBranding?: AgencyBranding;
  }
  
  let { initialSchema, onSave, agencyBranding }: Props = $props();
  
  // Initialize store with schema
  $effect(() => {
    if (initialSchema) {
      formBuilderStore.loadSchema(initialSchema);
    }
  });
  
  let selectedField = $derived(formBuilderStore.selectedField);
  let previewMode = $state<"desktop" | "mobile">("desktop");
</script>

<div class="h-screen flex flex-col">
  <!-- Toolbar -->
  <header class="border-b p-4 flex justify-between items-center">
    <div class="flex items-center gap-4">
      <h1 class="text-lg font-semibold">Form Builder</h1>
      <span class="text-sm text-muted-foreground">
        {$formBuilderStore.name || "Untitled Form"}
      </span>
    </div>
    <div class="flex items-center gap-2">
      <Button variant="outline" onclick={() => formBuilderStore.undo()}>
        Undo
      </Button>
      <Button variant="outline" onclick={() => formBuilderStore.redo()}>
        Redo
      </Button>
      <Button onclick={() => onSave($formBuilderStore.schema)}>
        Save Form
      </Button>
    </div>
  </header>
  
  <!-- 3-Panel Layout -->
  <Resizable.PaneGroup direction="horizontal" class="flex-1">
    <!-- Left: Field Library -->
    <Resizable.Pane defaultSize={20} minSize={15} maxSize={30}>
      <FieldLibrary />
    </Resizable.Pane>
    
    <Resizable.Handle />
    
    <!-- Center: Form Canvas -->
    <Resizable.Pane defaultSize={45} minSize={30}>
      <FormCanvas />
    </Resizable.Pane>
    
    <Resizable.Handle />
    
    <!-- Right: Properties / Preview -->
    <Resizable.Pane defaultSize={35} minSize={25}>
      {#if selectedField}
        <FieldProperties field={selectedField} />
      {:else}
        <PreviewPanel 
          schema={$formBuilderStore.schema} 
          branding={agencyBranding}
          mode={previewMode}
        />
      {/if}
    </Resizable.Pane>
  </Resizable.PaneGroup>
</div>
```

#### `FieldLibrary.svelte` - Draggable Field Source

```svelte
<!-- src/lib/components/form-builder/FieldLibrary.svelte -->
<script lang="ts">
  import { fieldRegistry } from "./utils/field-registry";
  import { Tabs } from "$lib/components/ui/tabs";
  
  const fieldCategories = [
    {
      id: "basic",
      label: "Basic",
      fields: ["text", "email", "tel", "url", "number", "textarea"]
    },
    {
      id: "choice",
      label: "Choice",
      fields: ["select", "multiselect", "radio", "checkbox"]
    },
    {
      id: "advanced",
      label: "Advanced",
      fields: ["date", "file", "signature", "rating", "slider"]
    },
    {
      id: "layout",
      label: "Layout",
      fields: ["heading", "paragraph", "divider"]
    }
  ];
</script>

<div class="p-4 h-full overflow-y-auto">
  <Tabs.Root value="basic">
    <Tabs.List class="grid grid-cols-4 mb-4">
      {#each fieldCategories as category}
        <Tabs.Trigger value={category.id}>{category.label}</Tabs.Trigger>
      {/each}
    </Tabs.List>
    
    {#each fieldCategories as category}
      <Tabs.Content value={category.id}>
        <div class="grid grid-cols-2 gap-2">
          {#each category.fields as fieldType}
            {@const field = fieldRegistry.get(fieldType)}
            <button
              class="p-3 border rounded-lg hover:bg-accent cursor-grab 
                     flex flex-col items-center gap-2 text-sm"
              draggable="true"
              ondragstart={(e) => {
                e.dataTransfer?.setData("field-type", fieldType);
              }}
            >
              <svelte:component this={field.icon} class="h-5 w-5" />
              <span>{field.label}</span>
            </button>
          {/each}
        </div>
      </Tabs.Content>
    {/each}
  </Tabs.Root>
  
  <!-- Templates Section -->
  <div class="mt-6 pt-6 border-t">
    <h3 class="font-medium mb-3">Templates</h3>
    <div class="space-y-2">
      <Button variant="outline" class="w-full justify-start">
        Quick Quote (5 fields)
      </Button>
      <Button variant="outline" class="w-full justify-start">
        Full Discovery (4 steps)
      </Button>
      <Button variant="outline" class="w-full justify-start">
        E-commerce Intake
      </Button>
    </div>
  </div>
</div>
```

#### `FormCanvas.svelte` - Drag-Drop Editor

```svelte
<!-- src/lib/components/form-builder/FormCanvas.svelte -->
<script lang="ts">
  import { formBuilderStore } from "$lib/stores/form-builder";
  import { dndzone } from "svelte-dnd-action";
  import CanvasField from "./CanvasField.svelte";
  import StepHeader from "./StepHeader.svelte";
  
  let schema = $derived($formBuilderStore.schema);
  let activeStepId = $state(schema.steps[0]?.id || "");
  
  function handleDrop(e: CustomEvent) {
    const { items } = e.detail;
    formBuilderStore.updateStepFields(activeStepId, items);
  }
  
  function handleDropFromLibrary(e: DragEvent) {
    const fieldType = e.dataTransfer?.getData("field-type");
    if (fieldType) {
      formBuilderStore.addField(activeStepId, fieldType);
    }
  }
</script>

<div class="h-full flex flex-col">
  <!-- Step Tabs -->
  <div class="border-b p-2 flex items-center gap-2 overflow-x-auto">
    {#each schema.steps as step}
      <button
        class="px-4 py-2 rounded-lg text-sm whitespace-nowrap
               {activeStepId === step.id ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}"
        onclick={() => activeStepId = step.id}
      >
        {step.title}
      </button>
    {/each}
    <button
      class="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-accent"
      onclick={() => formBuilderStore.addStep()}
    >
      + Add Step
    </button>
  </div>
  
  <!-- Canvas Area -->
  <div 
    class="flex-1 p-6 overflow-y-auto"
    ondrop={handleDropFromLibrary}
    ondragover={(e) => e.preventDefault()}
  >
    {#each schema.steps as step}
      {#if step.id === activeStepId}
        <StepHeader {step} />
        
        <div
          use:dndzone={{ items: step.fields, flipDurationMs: 200 }}
          onconsider={handleDrop}
          onfinalize={handleDrop}
          class="space-y-3 min-h-[200px]"
        >
          {#each step.fields as field (field.id)}
            <CanvasField 
              {field}
              selected={$formBuilderStore.selectedFieldId === field.id}
              onclick={() => formBuilderStore.selectField(field.id)}
            />
          {/each}
        </div>
        
        {#if step.fields.length === 0}
          <div class="border-2 border-dashed rounded-lg p-8 text-center text-muted-foreground">
            Drag fields here or click a field type to add
          </div>
        {/if}
      {/if}
    {/each}
  </div>
</div>
```

### 5.2 Field Registry

```typescript
// src/lib/components/form-builder/utils/field-registry.ts
import { 
  Type, Mail, Phone, Link, Hash, AlignLeft,
  List, CheckSquare, Circle, Calendar,
  Upload, PenTool, Star, Sliders,
  Heading, Text, Minus
} from "lucide-svelte";
import type { Component } from "svelte";

export interface FieldDefinition {
  type: string;
  label: string;
  icon: Component;
  defaultConfig: Partial<FormField>;
  zodType: string;
}

export const fieldRegistry = new Map<string, FieldDefinition>([
  ["text", {
    type: "text",
    label: "Text",
    icon: Type,
    defaultConfig: {
      label: "Text Field",
      placeholder: "Enter text...",
      required: false,
      validation: { maxLength: 255 }
    },
    zodType: "z.string()"
  }],
  
  ["email", {
    type: "email",
    label: "Email",
    icon: Mail,
    defaultConfig: {
      label: "Email Address",
      placeholder: "you@example.com",
      required: false
    },
    zodType: "z.string().email()"
  }],
  
  ["tel", {
    type: "tel",
    label: "Phone",
    icon: Phone,
    defaultConfig: {
      label: "Phone Number",
      placeholder: "(04XX) XXX XXX",
      required: false
    },
    zodType: "z.string()"
  }],
  
  ["url", {
    type: "url",
    label: "URL",
    icon: Link,
    defaultConfig: {
      label: "Website",
      placeholder: "https://example.com",
      required: false
    },
    zodType: "z.string().url()"
  }],
  
  ["number", {
    type: "number",
    label: "Number",
    icon: Hash,
    defaultConfig: {
      label: "Number",
      placeholder: "0",
      required: false,
      validation: { min: 0 }
    },
    zodType: "z.number()"
  }],
  
  ["textarea", {
    type: "textarea",
    label: "Long Text",
    icon: AlignLeft,
    defaultConfig: {
      label: "Description",
      placeholder: "Enter details...",
      required: false,
      validation: { maxLength: 2000 }
    },
    zodType: "z.string()"
  }],
  
  ["select", {
    type: "select",
    label: "Dropdown",
    icon: List,
    defaultConfig: {
      label: "Select Option",
      required: false,
      options: [
        { value: "option1", label: "Option 1" },
        { value: "option2", label: "Option 2" }
      ]
    },
    zodType: "z.enum([/* options */])"
  }],
  
  ["multiselect", {
    type: "multiselect",
    label: "Multi-Select",
    icon: CheckSquare,
    defaultConfig: {
      label: "Select Options",
      required: false,
      options: []
    },
    zodType: "z.array(z.string())"
  }],
  
  ["radio", {
    type: "radio",
    label: "Radio",
    icon: Circle,
    defaultConfig: {
      label: "Choose One",
      required: false,
      options: [
        { value: "yes", label: "Yes" },
        { value: "no", label: "No" }
      ]
    },
    zodType: "z.enum([/* options */])"
  }],
  
  ["checkbox", {
    type: "checkbox",
    label: "Checkbox",
    icon: CheckSquare,
    defaultConfig: {
      label: "I agree",
      required: false
    },
    zodType: "z.boolean()"
  }],
  
  ["date", {
    type: "date",
    label: "Date",
    icon: Calendar,
    defaultConfig: {
      label: "Date",
      required: false
    },
    zodType: "z.string().datetime()"
  }],
  
  ["file", {
    type: "file",
    label: "File Upload",
    icon: Upload,
    defaultConfig: {
      label: "Upload File",
      required: false,
      validation: { maxSize: 10 * 1024 * 1024 }  // 10MB
    },
    zodType: "z.instanceof(File).optional()"
  }],
  
  ["signature", {
    type: "signature",
    label: "Signature",
    icon: PenTool,
    defaultConfig: {
      label: "Signature",
      required: false
    },
    zodType: "z.string()"  // Base64 image data
  }],
  
  ["rating", {
    type: "rating",
    label: "Rating",
    icon: Star,
    defaultConfig: {
      label: "Rating",
      required: false,
      validation: { min: 1, max: 5 }
    },
    zodType: "z.number().min(1).max(5)"
  }],
  
  // Layout elements (non-input)
  ["heading", {
    type: "heading",
    label: "Heading",
    icon: Heading,
    defaultConfig: {
      label: "Section Title"
    },
    zodType: ""  // Not included in schema
  }],
  
  ["paragraph", {
    type: "paragraph",
    label: "Paragraph",
    icon: Text,
    defaultConfig: {
      label: "Add descriptive text here..."
    },
    zodType: ""
  }],
  
  ["divider", {
    type: "divider",
    label: "Divider",
    icon: Minus,
    defaultConfig: {},
    zodType: ""
  }]
]);
```

---

## 6. API Endpoints

### 6.1 Go Backend Routes

```go
// internal/api/forms/routes.go
package forms

import (
    "github.com/go-chi/chi/v5"
)

func RegisterRoutes(r chi.Router) {
    r.Route("/forms", func(r chi.Router) {
        // Form Management (Agency Admin - requires auth)
        r.Get("/", ListAgencyForms)           // GET /api/forms
        r.Post("/", CreateForm)               // POST /api/forms
        r.Get("/{formId}", GetForm)           // GET /api/forms/{formId}
        r.Put("/{formId}", UpdateForm)        // PUT /api/forms/{formId}
        r.Delete("/{formId}", DeleteForm)     // DELETE /api/forms/{formId}
        r.Post("/{formId}/duplicate", DuplicateForm)
        r.Put("/{formId}/set-default", SetDefaultForm)
        
        // Templates
        r.Get("/templates", ListTemplates)    // GET /api/forms/templates
        r.Post("/from-template", CreateFromTemplate)
        
        // Option Sets
        r.Get("/option-sets", ListOptionSets)
        r.Post("/option-sets", CreateOptionSet)
        r.Put("/option-sets/{setId}", UpdateOptionSet)
        r.Delete("/option-sets/{setId}", DeleteOptionSet)
        
        // Submissions
        r.Get("/{formId}/submissions", ListSubmissions)
        r.Get("/submissions/{submissionId}", GetSubmission)
    })
    
    // Public Form Endpoints (No Auth Required)
    r.Route("/public/forms", func(r chi.Router) {
        r.Get("/{agencySlug}/{formSlug}", GetPublicForm)
        r.Post("/{agencySlug}/{formSlug}/submit", SubmitForm)
    })
}
```

### 6.2 Request/Response Types

```go
// internal/api/forms/types.go
package forms

import (
    "encoding/json"
    "time"
    "github.com/google/uuid"
)

// Form represents an agency's custom form
type Form struct {
    ID          uuid.UUID       `json:"id" db:"id"`
    AgencyID    uuid.UUID       `json:"agencyId" db:"agency_id"`
    Name        string          `json:"name" db:"name"`
    Slug        string          `json:"slug" db:"slug"`
    Description *string         `json:"description" db:"description"`
    FormType    string          `json:"formType" db:"form_type"`
    Schema      json.RawMessage `json:"schema" db:"schema"`
    UIConfig    json.RawMessage `json:"uiConfig" db:"ui_config"`
    Branding    json.RawMessage `json:"branding,omitempty" db:"branding"`
    IsActive    bool            `json:"isActive" db:"is_active"`
    IsDefault   bool            `json:"isDefault" db:"is_default"`
    Version     int             `json:"version" db:"version"`
    CreatedAt   time.Time       `json:"createdAt" db:"created_at"`
    UpdatedAt   time.Time       `json:"updatedAt" db:"updated_at"`
}

// CreateFormRequest for creating a new form
type CreateFormRequest struct {
    Name        string          `json:"name" validate:"required,min=1,max=255"`
    Slug        string          `json:"slug" validate:"required,slug"`
    Description *string         `json:"description"`
    FormType    string          `json:"formType" validate:"required,oneof=questionnaire consultation feedback intake custom"`
    Schema      json.RawMessage `json:"schema" validate:"required"`
    UIConfig    json.RawMessage `json:"uiConfig"`
    IsDefault   bool            `json:"isDefault"`
}

// UpdateFormRequest for updating an existing form
type UpdateFormRequest struct {
    Name        *string         `json:"name" validate:"omitempty,min=1,max=255"`
    Description *string         `json:"description"`
    Schema      json.RawMessage `json:"schema"`
    UIConfig    json.RawMessage `json:"uiConfig"`
    IsActive    *bool           `json:"isActive"`
    IsDefault   *bool           `json:"isDefault"`
}

// FormSubmission represents a submitted form
type FormSubmission struct {
    ID             uuid.UUID       `json:"id" db:"id"`
    FormID         uuid.UUID       `json:"formId" db:"form_id"`
    AgencyID       uuid.UUID       `json:"agencyId" db:"agency_id"`
    Data           json.RawMessage `json:"data" db:"data"`
    Metadata       json.RawMessage `json:"metadata" db:"metadata"`
    ProspectID     *uuid.UUID      `json:"prospectId,omitempty" db:"prospect_id"`
    ConsultationID *uuid.UUID      `json:"consultationId,omitempty" db:"consultation_id"`
    Status         string          `json:"status" db:"status"`
    FormVersion    int             `json:"formVersion" db:"form_version"`
    SubmittedAt    time.Time       `json:"submittedAt" db:"submitted_at"`
}

// SubmitFormRequest for public form submission
type SubmitFormRequest struct {
    Data map[string]interface{} `json:"data" validate:"required"`
}

// PublicFormResponse for loading public forms
type PublicFormResponse struct {
    Form     Form                     `json:"form"`
    Branding AgencyBranding           `json:"branding"`
    Options  map[string][]FieldOption `json:"options"` // Resolved option sets
}
```

### 6.3 Form Submission Handler

```go
// internal/api/forms/submit.go
package forms

import (
    "encoding/json"
    "net/http"
    
    "github.com/go-chi/chi/v5"
    "github.com/xeipuuv/gojsonschema"
)

func SubmitForm(w http.ResponseWriter, r *http.Request) {
    agencySlug := chi.URLParam(r, "agencySlug")
    formSlug := chi.URLParam(r, "formSlug")
    
    // 1. Load form schema from database
    form, err := formRepo.GetBySlug(r.Context(), agencySlug, formSlug)
    if err != nil {
        respondError(w, http.StatusNotFound, "Form not found")
        return
    }
    
    if !form.IsActive {
        respondError(w, http.StatusGone, "Form is no longer active")
        return
    }
    
    // 2. Parse request body
    var req SubmitFormRequest
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        respondError(w, http.StatusBadRequest, "Invalid request body")
        return
    }
    
    // 3. Validate against JSON schema
    jsonSchema := convertToJSONSchema(form.Schema)
    schemaLoader := gojsonschema.NewBytesLoader(jsonSchema)
    documentLoader := gojsonschema.NewGoLoader(req.Data)
    
    result, err := gojsonschema.Validate(schemaLoader, documentLoader)
    if err != nil {
        respondError(w, http.StatusInternalServerError, "Schema validation failed")
        return
    }
    
    if !result.Valid() {
        errors := make([]string, 0)
        for _, err := range result.Errors() {
            errors = append(errors, err.String())
        }
        respondJSON(w, http.StatusBadRequest, map[string]interface{}{
            "error":  "Validation failed",
            "errors": errors,
        })
        return
    }
    
    // 4. Capture metadata
    metadata := map[string]interface{}{
        "ipAddress": getClientIP(r),
        "userAgent": r.UserAgent(),
        "referrer":  r.Referer(),
        "submittedAt": time.Now().UTC(),
    }
    
    // 5. Create submission record
    submission := &FormSubmission{
        FormID:      form.ID,
        AgencyID:    form.AgencyID,
        Data:        mustMarshal(req.Data),
        Metadata:    mustMarshal(metadata),
        Status:      "completed",
        FormVersion: form.Version,
    }
    
    if err := submissionRepo.Create(r.Context(), submission); err != nil {
        respondError(w, http.StatusInternalServerError, "Failed to save submission")
        return
    }
    
    // 6. Trigger downstream workflows based on form type
    go processSubmission(submission, form)
    
    // 7. Return success with configured message
    var uiConfig UIConfig
    json.Unmarshal(form.UIConfig, &uiConfig)
    
    respondJSON(w, http.StatusCreated, map[string]interface{}{
        "success":      true,
        "submissionId": submission.ID,
        "message":      uiConfig.SuccessMessage,
    })
}

// processSubmission handles post-submission workflows
func processSubmission(submission *FormSubmission, form *Form) {
    ctx := context.Background()
    
    switch form.FormType {
    case "questionnaire", "intake":
        // Create prospect from submission data
        prospect := createProspectFromSubmission(submission)
        submission.ProspectID = &prospect.ID
        submissionRepo.Update(ctx, submission)
        
        // Notify agency of new lead
        notifyAgencyNewLead(form.AgencyID, prospect)
        
    case "consultation":
        // Create consultation record
        consultation := createConsultationFromSubmission(submission)
        submission.ConsultationID = &consultation.ID
        submissionRepo.Update(ctx, submission)
        
        // Trigger AI proposal generation if configured
        if agencyHasAutoProposal(form.AgencyID) {
            triggerAIProposalGeneration(consultation)
        }
        
    case "feedback":
        // Store feedback and calculate metrics
        processFeedback(submission)
        
        // Notify agency of new feedback
        notifyAgencyFeedback(form.AgencyID, submission)
    }
    
    // Mark as processed
    submission.Status = "processed"
    submission.ProcessedAt = timePtr(time.Now())
    submissionRepo.Update(ctx, submission)
}
```

---

## 7. Form Builder UI Integration

### 7.1 Agency Settings Route

```svelte
<!-- src/routes/(app)/settings/forms/+page.svelte -->
<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import { Card } from "$lib/components/ui/card";
  import { Badge } from "$lib/components/ui/badge";
  import { Plus, FileText, MessageSquare, ClipboardList } from "lucide-svelte";
  
  let { data } = $props();
  
  const formTypeConfig = {
    questionnaire: { label: "Client Questionnaire", icon: ClipboardList, description: "Pre-call intake forms for prospects" },
    consultation: { label: "Consultation Form", icon: FileText, description: "Discovery call capture forms" },
    feedback: { label: "Feedback Form", icon: MessageSquare, description: "Post-project satisfaction surveys" },
    intake: { label: "Custom Intake", icon: Plus, description: "Specialized intake forms" }
  };
</script>

<div class="container py-8 max-w-6xl">
  <div class="flex justify-between items-center mb-8">
    <div>
      <h1 class="text-2xl font-bold">Forms</h1>
      <p class="text-muted-foreground">
        Customize questionnaires, consultation forms, and intake forms for your agency
      </p>
    </div>
    <Button href="/settings/forms/new">
      <Plus class="w-4 h-4 mr-2" />
      Create New Form
    </Button>
  </div>
  
  <!-- Form Type Sections -->
  {#each Object.entries(formTypeConfig) as [type, config]}
    {@const formsOfType = data.forms.filter(f => f.formType === type)}
    
    <section class="mb-10">
      <div class="flex items-center gap-3 mb-4">
        <svelte:component this={config.icon} class="w-5 h-5 text-muted-foreground" />
        <div>
          <h2 class="text-lg font-semibold">{config.label}s</h2>
          <p class="text-sm text-muted-foreground">{config.description}</p>
        </div>
      </div>
      
      {#if formsOfType.length === 0}
        <Card.Root class="p-8 text-center border-dashed">
          <p class="text-muted-foreground mb-4">No {config.label.toLowerCase()}s created yet</p>
          <Button variant="outline" href="/settings/forms/new?type={type}">
            Create Your First {config.label}
          </Button>
        </Card.Root>
      {:else}
        <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {#each formsOfType as form}
            <Card.Root class="relative hover:shadow-md transition-shadow">
              {#if form.isDefault}
                <Badge class="absolute top-3 right-3" variant="secondary">Default</Badge>
              {/if}
              
              <Card.Header class="pb-3">
                <Card.Title class="text-base">{form.name}</Card.Title>
                {#if form.description}
                  <Card.Description class="text-sm">{form.description}</Card.Description>
                {/if}
              </Card.Header>
              
              <Card.Content class="pb-3">
                <div class="flex gap-4 text-sm text-muted-foreground">
                  <span>{countFields(form.schema)} fields</span>
                  <span>{countSteps(form.schema)} steps</span>
                </div>
              </Card.Content>
              
              <Card.Footer class="flex gap-2 pt-3 border-t">
                <Button variant="outline" size="sm" href="/settings/forms/{form.id}">
                  Edit
                </Button>
                <Button variant="ghost" size="sm" href="/settings/forms/{form.id}/preview">
                  Preview
                </Button>
                <Button variant="ghost" size="sm" onclick={() => duplicateForm(form.id)}>
                  Duplicate
                </Button>
              </Card.Footer>
            </Card.Root>
          {/each}
        </div>
      {/if}
    </section>
  {/each}
</div>
```

### 7.2 Form Editor Route

```svelte
<!-- src/routes/(app)/settings/forms/[formId]/+page.svelte -->
<script lang="ts">
  import Builder from "$lib/components/form-builder/Builder.svelte";
  import { goto } from "$app/navigation";
  import { toast } from "svelte-sonner";
  
  let { data } = $props();
  
  async function handleSave(schema: FormSchema) {
    try {
      const response = await fetch(`/api/forms/${data.form.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schema })
      });
      
      if (!response.ok) throw new Error("Failed to save");
      
      toast.success("Form saved successfully");
    } catch (error) {
      toast.error("Failed to save form");
    }
  }
</script>

<Builder 
  initialSchema={data.form.schema}
  onSave={handleSave}
  agencyBranding={data.agency.branding}
/>
```

### 7.3 New Form Route

```svelte
<!-- src/routes/(app)/settings/forms/new/+page.svelte -->
<script lang="ts">
  import { page } from "$app/stores";
  import Builder from "$lib/components/form-builder/Builder.svelte";
  import { goto } from "$app/navigation";
  import { toast } from "svelte-sonner";
  
  let { data } = $props();
  
  // Get form type from URL params or default
  const formType = $page.url.searchParams.get("type") || "questionnaire";
  const templateId = $page.url.searchParams.get("template");
  
  // Load template if specified, otherwise start with empty schema
  const initialSchema = templateId 
    ? data.templates.find(t => t.id === templateId)?.schema 
    : { version: "1.0", steps: [{ id: "step1", title: "Step 1", fields: [] }] };
  
  async function handleSave(schema: FormSchema) {
    try {
      const response = await fetch("/api/forms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Untitled Form", // Will be prompted to change
          slug: generateSlug(),
          formType,
          schema
        })
      });
      
      if (!response.ok) throw new Error("Failed to create");
      
      const { id } = await response.json();
      toast.success("Form created successfully");
      goto(`/settings/forms/${id}`);
    } catch (error) {
      toast.error("Failed to create form");
    }
  }
</script>

<Builder 
  initialSchema={initialSchema}
  onSave={handleSave}
  agencyBranding={data.agency.branding}
/>
```

---

## 8. Dynamic Form Renderer

### 8.1 Main Renderer Component

```svelte
<!-- src/lib/components/form-renderer/DynamicForm.svelte -->
<script lang="ts">
  import { superForm } from "sveltekit-superforms";
  import { zodClient } from "sveltekit-superforms/adapters";
  import { generateZodSchema } from "$lib/components/form-builder/utils/schema-generator";
  import FieldRenderer from "./FieldRenderer.svelte";
  import FormStep from "./FormStep.svelte";
  import FormBranding from "./FormBranding.svelte";
  import { Button } from "$lib/components/ui/button";
  import { Loader2, ArrowLeft, ArrowRight, Check } from "lucide-svelte";
  import type { FormSchema, AgencyBranding, FieldOption } from "$lib/types/form-builder";
  
  interface Props {
    schema: FormSchema;
    branding?: AgencyBranding;
    options?: Record<string, FieldOption[]>;
    submitUrl: string;
    onSuccess?: (data: any) => void;
  }
  
  let { schema, branding, options = {}, submitUrl, onSuccess }: Props = $props();
  
  // Generate Zod schema from JSON schema
  const zodSchema = $derived(generateZodSchema(schema));
  
  // Multi-step state
  let currentStepIndex = $state(0);
  const totalSteps = $derived(schema.steps.length);
  const currentStep = $derived(schema.steps[currentStepIndex]);
  const isFirstStep = $derived(currentStepIndex === 0);
  const isLastStep = $derived(currentStepIndex === totalSteps - 1);
  
  // Initialize Superforms
  const { form, errors, enhance, submitting, validate } = superForm(
    {},
    {
      validators: zodClient(zodSchema),
      SPA: true,
      dataType: "json",
      onSubmit: async ({ cancel }) => {
        if (!isLastStep) {
          // Validate current step fields only
          const stepFieldNames = currentStep.fields
            .filter(f => !["heading", "paragraph", "divider"].includes(f.type))
            .map(f => f.name);
          
          const result = await validate(stepFieldNames);
          if (Object.keys(result).length === 0) {
            currentStepIndex++;
          }
          cancel();
          return;
        }
      },
      onResult: ({ result }) => {
        if (result.type === "success") {
          onSuccess?.(result.data);
        }
      }
    }
  );
  
  function goBack() {
    if (!isFirstStep) currentStepIndex--;
  }
  
  // Resolve options from optionSetSlug
  function getFieldOptions(field: FormField): FieldOption[] {
    if (field.optionSetSlug && options[field.optionSetSlug]) {
      return options[field.optionSetSlug];
    }
    return field.options || [];
  }
</script>

<FormBranding {branding}>
  <form method="POST" action={submitUrl} use:enhance class="max-w-2xl mx-auto">
    <!-- Progress Bar -->
    {#if totalSteps > 1}
      <div class="mb-8">
        <div class="flex justify-between text-sm text-muted-foreground mb-2">
          <span>Step {currentStepIndex + 1} of {totalSteps}</span>
          <span>{currentStep.title}</span>
        </div>
        <div class="h-2 bg-muted rounded-full overflow-hidden">
          <div 
            class="h-full bg-primary transition-all duration-300 ease-out"
            style="width: {((currentStepIndex + 1) / totalSteps) * 100}%"
          />
        </div>
      </div>
    {/if}
    
    <!-- Step Content -->
    <FormStep step={currentStep}>
      <div class="grid grid-cols-2 gap-x-4 gap-y-6">
        {#each currentStep.fields as field (field.id)}
          <FieldRenderer 
            {field}
            value={$form[field.name]}
            error={$errors[field.name]?.[0]}
            options={getFieldOptions(field)}
            onchange={(value) => $form[field.name] = value}
          />
        {/each}
      </div>
    </FormStep>
    
    <!-- Navigation -->
    <div class="flex justify-between mt-8 pt-6 border-t">
      {#if !isFirstStep}
        <Button type="button" variant="outline" onclick={goBack}>
          <ArrowLeft class="w-4 h-4 mr-2" />
          Back
        </Button>
      {:else}
        <div />
      {/if}
      
      <Button type="submit" disabled={$submitting}>
        {#if $submitting}
          <Loader2 class="w-4 h-4 mr-2 animate-spin" />
          {isLastStep ? "Submitting..." : "Validating..."}
        {:else if isLastStep}
          <Check class="w-4 h-4 mr-2" />
          Submit
        {:else}
          Continue
          <ArrowRight class="w-4 h-4 ml-2" />
        {/if}
      </Button>
    </div>
  </form>
</FormBranding>
```

### 8.2 Field Renderer Component

```svelte
<!-- src/lib/components/form-renderer/FieldRenderer.svelte -->
<script lang="ts">
  import * as Form from "$lib/components/ui/form";
  import { Input } from "$lib/components/ui/input";
  import { Textarea } from "$lib/components/ui/textarea";
  import * as Select from "$lib/components/ui/select";
  import { Checkbox } from "$lib/components/ui/checkbox";
  import * as RadioGroup from "$lib/components/ui/radio-group";
  import MultiSelect from "./fields/MultiSelect.svelte";
  import DatePicker from "./fields/DatePicker.svelte";
  import FileUpload from "./fields/FileUpload.svelte";
  import SignaturePad from "./fields/SignaturePad.svelte";
  import RatingInput from "./fields/RatingInput.svelte";
  import type { FormField, FieldOption } from "$lib/types/form-builder";
  
  interface Props {
    field: FormField;
    value: any;
    error?: string;
    options?: FieldOption[];
    onchange: (value: any) => void;
  }
  
  let { field, value, error, options = [], onchange }: Props = $props();
  
  // Layout classes based on field width
  const widthClasses = {
    full: "col-span-2",
    half: "col-span-1",
    third: "col-span-1"
  };
  
  const widthClass = widthClasses[field.layout?.width || "full"];
</script>

<div class={widthClass}>
  <!-- Layout Elements (no input) -->
  {#if field.type === "heading"}
    <h3 class="text-lg font-semibold mt-2 mb-1">{field.label}</h3>
    
  {:else if field.type === "paragraph"}
    <p class="text-muted-foreground text-sm">{field.label}</p>
    
  {:else if field.type === "divider"}
    <hr class="my-4 col-span-2" />
    
  <!-- Input Fields -->
  {:else}
    <div class="space-y-2">
      <label for={field.id} class="text-sm font-medium leading-none">
        {field.label}
        {#if field.required}
          <span class="text-destructive ml-1">*</span>
        {/if}
      </label>
      
      {#if field.description}
        <p class="text-xs text-muted-foreground">{field.description}</p>
      {/if}
      
      {#if field.type === "text" || field.type === "email" || field.type === "tel" || field.type === "url"}
        <Input 
          id={field.id}
          type={field.type}
          placeholder={field.placeholder}
          value={value || ""}
          oninput={(e) => onchange(e.currentTarget.value)}
          class={error ? "border-destructive" : ""}
        />
        
      {:else if field.type === "number"}
        <Input 
          id={field.id}
          type="number"
          placeholder={field.placeholder}
          min={field.validation?.min}
          max={field.validation?.max}
          value={value ?? ""}
          oninput={(e) => onchange(e.currentTarget.value ? Number(e.currentTarget.value) : undefined)}
          class={error ? "border-destructive" : ""}
        />
        
      {:else if field.type === "textarea"}
        <Textarea 
          id={field.id}
          placeholder={field.placeholder}
          maxlength={field.validation?.maxLength}
          value={value || ""}
          oninput={(e) => onchange(e.currentTarget.value)}
          rows={4}
          class={error ? "border-destructive" : ""}
        />
        
      {:else if field.type === "select"}
        <Select.Root 
          selected={value ? { value, label: options.find(o => o.value === value)?.label || value } : undefined}
          onSelectedChange={(s) => onchange(s?.value)}
        >
          <Select.Trigger class={error ? "border-destructive" : ""}>
            <Select.Value placeholder={field.placeholder || "Select an option..."} />
          </Select.Trigger>
          <Select.Content>
            {#each options as option}
              <Select.Item value={option.value}>{option.label}</Select.Item>
            {/each}
          </Select.Content>
        </Select.Root>
        
      {:else if field.type === "multiselect"}
        <MultiSelect 
          {options}
          selected={value || []}
          {onchange}
          placeholder={field.placeholder}
          hasError={!!error}
        />
        
      {:else if field.type === "radio"}
        <RadioGroup.Root value={value} onValueChange={onchange} class="space-y-2">
          {#each options as option}
            <div class="flex items-center space-x-2">
              <RadioGroup.Item value={option.value} id={`${field.id}-${option.value}`} />
              <label for={`${field.id}-${option.value}`} class="text-sm">{option.label}</label>
            </div>
          {/each}
        </RadioGroup.Root>
        
      {:else if field.type === "checkbox"}
        <div class="flex items-center space-x-2">
          <Checkbox 
            id={field.id}
            checked={value || false}
            onCheckedChange={onchange}
          />
          <label for={field.id} class="text-sm leading-none">{field.placeholder || field.label}</label>
        </div>
        
      {:else if field.type === "date"}
        <DatePicker {value} {onchange} hasError={!!error} />
        
      {:else if field.type === "file"}
        <FileUpload 
          accept={field.validation?.accept}
          maxSize={field.validation?.maxSize}
          {value}
          {onchange}
        />
        
      {:else if field.type === "signature"}
        <SignaturePad {value} {onchange} />
        
      {:else if field.type === "rating"}
        <RatingInput 
          max={field.validation?.max || 5}
          {value}
          {onchange}
        />
      {/if}
      
      {#if error}
        <p class="text-xs text-destructive">{error}</p>
      {/if}
    </div>
  {/if}
</div>
```

### 8.3 Schema Generator Utility

```typescript
// src/lib/components/form-builder/utils/schema-generator.ts
import { z, type ZodObject, type ZodTypeAny } from "zod";
import type { FormSchema, FormField, ValidationRules } from "$lib/types/form-builder";

/**
 * Generates a Zod schema from a JSON form schema
 */
export function generateZodSchema(formSchema: FormSchema): ZodObject<any> {
  const shape: Record<string, ZodTypeAny> = {};
  
  for (const step of formSchema.steps) {
    for (const field of step.fields) {
      // Skip layout elements
      if (["heading", "paragraph", "divider"].includes(field.type)) {
        continue;
      }
      
      let fieldSchema = createFieldSchema(field);
      
      // Apply required/optional
      if (!field.required) {
        fieldSchema = fieldSchema.optional();
      }
      
      shape[field.name] = fieldSchema;
    }
  }
  
  return z.object(shape);
}

function createFieldSchema(field: FormField): ZodTypeAny {
  const v = field.validation || {};
  
  switch (field.type) {
    case "text":
    case "textarea":
      let textSchema = z.string();
      if (v.minLength) textSchema = textSchema.min(v.minLength, v.customMessage);
      if (v.maxLength) textSchema = textSchema.max(v.maxLength);
      if (v.pattern) textSchema = textSchema.regex(new RegExp(v.pattern), v.patternMessage);
      return textSchema;
      
    case "email":
      return z.string().email(v.customMessage || "Please enter a valid email address");
      
    case "tel":
      return z.string();
      
    case "url":
      return z.string().url(v.customMessage || "Please enter a valid URL");
      
    case "number":
      let numSchema = z.number();
      if (v.min !== undefined) numSchema = numSchema.min(v.min);
      if (v.max !== undefined) numSchema = numSchema.max(v.max);
      return numSchema;
      
    case "date":
    case "datetime":
      return z.string();
      
    case "select":
    case "radio":
      // Dynamic enum - will be validated against options at runtime
      return z.string();
      
    case "multiselect":
      return z.array(z.string());
      
    case "checkbox":
      return z.boolean();
      
    case "file":
      return z.any(); // File validation handled separately
      
    case "signature":
      return z.string(); // Base64 data URL
      
    case "rating":
      return z.number().min(1).max(v.max || 5);
      
    default:
      return z.any();
  }
}

/**
 * Converts form schema to JSON Schema format for Go backend validation
 */
export function toJSONSchema(formSchema: FormSchema): object {
  const properties: Record<string, object> = {};
  const required: string[] = [];
  
  for (const step of formSchema.steps) {
    for (const field of step.fields) {
      if (["heading", "paragraph", "divider"].includes(field.type)) continue;
      
      properties[field.name] = fieldToJSONSchema(field);
      
      if (field.required) {
        required.push(field.name);
      }
    }
  }
  
  return {
    $schema: "http://json-schema.org/draft-07/schema#",
    type: "object",
    properties,
    required,
    additionalProperties: false
  };
}

function fieldToJSONSchema(field: FormField): object {
  const v = field.validation || {};
  
  switch (field.type) {
    case "text":
    case "textarea":
    case "tel":
      return {
        type: "string",
        ...(v.minLength && { minLength: v.minLength }),
        ...(v.maxLength && { maxLength: v.maxLength }),
        ...(v.pattern && { pattern: v.pattern })
      };
      
    case "email":
      return { type: "string", format: "email" };
      
    case "url":
      return { type: "string", format: "uri" };
      
    case "number":
      return {
        type: "number",
        ...(v.min !== undefined && { minimum: v.min }),
        ...(v.max !== undefined && { maximum: v.max })
      };
      
    case "select":
    case "radio":
      return {
        type: "string",
        ...(field.options && { enum: field.options.map(o => o.value) })
      };
      
    case "multiselect":
      return {
        type: "array",
        items: {
          type: "string",
          ...(field.options && { enum: field.options.map(o => o.value) })
        }
      };
      
    case "checkbox":
      return { type: "boolean" };
      
    case "date":
    case "datetime":
      return { type: "string", format: "date-time" };
      
    case "rating":
      return { type: "integer", minimum: 1, maximum: v.max || 5 };
      
    default:
      return { type: "string" };
  }
}
```

---

## 9. Default Templates

When a new agency signs up, they should get **pre-built forms** to start with, not an empty state.

### 9.1 Template Strategy

| Template | Form Type | Description | Fields |
|----------|-----------|-------------|--------|
| **Quick Quote** | questionnaire | Fast 5-question intake | Name, Email, Industry, Budget, Description |
| **Full Discovery** | consultation | Comprehensive 4-step form | Current 199-option form as template |
| **E-commerce Intake** | questionnaire | Online store focused | Platform, Products, Revenue, Goals |
| **Feedback Survey** | feedback | Post-project satisfaction | Rating, Comments, Testimonial |

### 9.2 Agency Onboarding Flow

```typescript
// When a new agency is created, seed their default forms
async function seedAgencyForms(agencyId: string) {
  const templates = await formTemplateRepo.list();
  
  // Create default forms from templates
  for (const template of templates) {
    await agencyFormRepo.create({
      agencyId,
      name: template.name,
      slug: template.slug,
      formType: template.category,
      schema: template.schema,
      uiConfig: template.uiConfig,
      isDefault: true,  // Set as default for this type
      isActive: true
    });
  }
}
```

### 9.3 Full Discovery Template Schema

This converts the current hardcoded 4-step consultation form into a template:

```json
{
  "version": "1.0",
  "steps": [
    {
      "id": "contact",
      "title": "Contact Information",
      "description": "Let's start with your details",
      "fields": [
        {
          "id": "business_name",
          "type": "text",
          "name": "businessName",
          "label": "Business Name",
          "placeholder": "Your Company Name",
          "required": false,
          "layout": { "width": "full", "order": 1 }
        },
        {
          "id": "contact_person",
          "type": "text",
          "name": "contactPerson",
          "label": "Contact Person",
          "placeholder": "Your Name",
          "required": false,
          "layout": { "width": "half", "order": 2 }
        },
        {
          "id": "email",
          "type": "email",
          "name": "email",
          "label": "Email Address",
          "placeholder": "you@company.com",
          "required": true,
          "layout": { "width": "half", "order": 3 }
        },
        {
          "id": "phone",
          "type": "tel",
          "name": "phone",
          "label": "Phone Number",
          "placeholder": "(04XX) XXX XXX",
          "required": false,
          "layout": { "width": "half", "order": 4 }
        },
        {
          "id": "website",
          "type": "url",
          "name": "website",
          "label": "Current Website",
          "placeholder": "https://yoursite.com",
          "required": false,
          "layout": { "width": "half", "order": 5 }
        }
      ]
    },
    {
      "id": "business",
      "title": "Business Context",
      "description": "Tell us about your business",
      "fields": [
        {
          "id": "industry",
          "type": "select",
          "name": "industry",
          "label": "Industry",
          "required": true,
          "optionSetSlug": "industries",
          "layout": { "width": "half", "order": 1 }
        },
        {
          "id": "business_type",
          "type": "select",
          "name": "businessType",
          "label": "Business Type",
          "required": true,
          "optionSetSlug": "business-types",
          "layout": { "width": "half", "order": 2 }
        },
        {
          "id": "team_size",
          "type": "number",
          "name": "teamSize",
          "label": "Team Size",
          "placeholder": "Number of employees",
          "required": false,
          "validation": { "min": 1, "max": 10000 },
          "layout": { "width": "half", "order": 3 }
        },
        {
          "id": "digital_presence",
          "type": "multiselect",
          "name": "digitalPresence",
          "label": "Current Digital Presence",
          "required": false,
          "optionSetSlug": "digital-presence",
          "layout": { "width": "full", "order": 4 }
        },
        {
          "id": "marketing_channels",
          "type": "multiselect",
          "name": "marketingChannels",
          "label": "Marketing Channels",
          "required": false,
          "optionSetSlug": "marketing-channels",
          "layout": { "width": "full", "order": 5 }
        }
      ]
    },
    {
      "id": "challenges",
      "title": "Pain Points & Challenges",
      "description": "What problems are you trying to solve?",
      "fields": [
        {
          "id": "primary_challenges",
          "type": "multiselect",
          "name": "primaryChallenges",
          "label": "Primary Challenges",
          "description": "Select all that apply",
          "required": true,
          "optionSetSlug": "primary-challenges",
          "layout": { "width": "full", "order": 1 }
        },
        {
          "id": "urgency",
          "type": "radio",
          "name": "urgencyLevel",
          "label": "How urgent is this project?",
          "required": true,
          "optionSetSlug": "urgency-levels",
          "layout": { "width": "full", "order": 2 }
        },
        {
          "id": "additional_context",
          "type": "textarea",
          "name": "additionalContext",
          "label": "Additional Context",
          "placeholder": "Any other details you'd like to share...",
          "required": false,
          "validation": { "maxLength": 2000 },
          "layout": { "width": "full", "order": 3 }
        }
      ]
    },
    {
      "id": "goals",
      "title": "Goals & Budget",
      "description": "What are you hoping to achieve?",
      "fields": [
        {
          "id": "primary_goals",
          "type": "multiselect",
          "name": "primaryGoals",
          "label": "Primary Goals",
          "description": "What outcomes are most important?",
          "required": true,
          "optionSetSlug": "primary-goals",
          "layout": { "width": "full", "order": 1 }
        },
        {
          "id": "success_metrics",
          "type": "multiselect",
          "name": "successMetrics",
          "label": "How will you measure success?",
          "required": false,
          "optionSetSlug": "success-metrics",
          "layout": { "width": "full", "order": 2 }
        },
        {
          "id": "budget",
          "type": "select",
          "name": "budgetRange",
          "label": "Budget Range",
          "required": true,
          "optionSetSlug": "budget-ranges",
          "layout": { "width": "half", "order": 3 }
        },
        {
          "id": "timeline",
          "type": "select",
          "name": "desiredTimeline",
          "label": "Desired Timeline",
          "required": false,
          "options": [
            { "value": "asap", "label": "As soon as possible" },
            { "value": "1-month", "label": "Within 1 month" },
            { "value": "1-3-months", "label": "1-3 months" },
            { "value": "3-6-months", "label": "3-6 months" },
            { "value": "flexible", "label": "Flexible" }
          ],
          "layout": { "width": "half", "order": 4 }
        }
      ]
    }
  ]
}
```

---

## 10. Phased Implementation Plan

### Phase 1: Foundation (Week 1)

**Goal:** Database schema and basic API

| Task | Days | Owner |
|------|------|-------|
| Create database migrations (all tables) | 0.5 | Backend |
| Seed field_option_sets with 199 options | 0.5 | Backend |
| Seed form_templates with default templates | 0.5 | Backend |
| Implement form CRUD API endpoints | 1.5 | Backend |
| Implement submission API endpoint | 1 | Backend |
| TypeScript type definitions | 0.5 | Frontend |

**Deliverables:**
- ✅ Database tables created and seeded
- ✅ API endpoints working
- ✅ Can create/read/update/delete forms via API

### Phase 2: Form Builder Core (Week 2)

**Goal:** Fork and integrate Svelte Form Builder

| Task | Days | Owner |
|------|------|-------|
| Fork SikandarJODD/form-builder repo | 0.5 | Frontend |
| Adapt components to WebKit structure | 1.5 | Frontend |
| Implement field registry with all types | 1 | Frontend |
| Build form builder store (state management) | 1 | Frontend |
| Connect builder to save API | 0.5 | Frontend |
| Add WebKit-specific fields (rating, signature) | 0.5 | Frontend |

**Deliverables:**
- ✅ Form Builder UI functional
- ✅ Can drag/drop fields
- ✅ Can save forms to database

### Phase 3: Dynamic Renderer (Week 3)

**Goal:** Render saved forms dynamically

| Task | Days | Owner |
|------|------|-------|
| Build DynamicForm component | 1.5 | Frontend |
| Build FieldRenderer for all field types | 1.5 | Frontend |
| Implement schema-to-Zod generation | 1 | Frontend |
| Multi-step navigation with validation | 0.5 | Frontend |
| Agency branding wrapper | 0.5 | Frontend |

**Deliverables:**
- ✅ Can preview forms in builder
- ✅ Public form routes working
- ✅ Form submissions saving correctly

### Phase 4: Integration & Polish (Week 4)

**Goal:** Wire up to existing workflows, delete old code

| Task | Days | Owner |
|------|------|-------|
| Connect submissions to AI proposal workflow | 1 | Backend |
| Implement agency onboarding (seed default forms) | 0.5 | Backend |
| Build form management UI (list, edit, delete) | 1 | Frontend |
| Delete old hardcoded consultation components | 0.5 | Frontend |
| Add option set management UI | 1 | Frontend |
| Bug fixes and polish | 1 | All |

**Deliverables:**
- ✅ Full flow working end-to-end
- ✅ Old code removed
- ✅ New agencies get default forms

### Phase 5: Advanced Features (Week 5-6, Optional)

**Goal:** Conditional logic and additional polish

| Task | Days | Owner |
|------|------|-------|
| Implement conditional logic engine | 3 | Frontend |
| Add form duplication feature | 0.5 | Full Stack |
| Form analytics (views, completions) | 2 | Full Stack |
| Template marketplace UI | 2 | Frontend |
| Performance optimization | 1 | Frontend |
| Documentation | 1 | All |

**Deliverables:**
- ✅ Conditional show/hide working
- ✅ Analytics dashboard
- ✅ Production ready

---

## 11. Testing Strategy

### 11.1 Unit Tests

```typescript
// src/lib/components/form-builder/utils/__tests__/schema-generator.test.ts
import { describe, it, expect } from "vitest";
import { generateZodSchema } from "../schema-generator";

describe("generateZodSchema", () => {
  it("generates valid schema for required email field", () => {
    const formSchema = {
      version: "1.0",
      steps: [{
        id: "step1",
        title: "Test",
        fields: [{
          id: "email",
          type: "email",
          name: "email",
          label: "Email",
          required: true
        }]
      }]
    };
    
    const zodSchema = generateZodSchema(formSchema);
    
    expect(() => zodSchema.parse({ email: "test@test.com" })).not.toThrow();
    expect(() => zodSchema.parse({ email: "invalid" })).toThrow();
    expect(() => zodSchema.parse({})).toThrow();
  });
  
  it("makes fields optional when required=false", () => {
    const formSchema = {
      version: "1.0",
      steps: [{
        id: "step1",
        title: "Test",
        fields: [{
          id: "name",
          type: "text",
          name: "name",
          label: "Name",
          required: false
        }]
      }]
    };
    
    const zodSchema = generateZodSchema(formSchema);
    
    expect(() => zodSchema.parse({})).not.toThrow();
    expect(() => zodSchema.parse({ name: "John" })).not.toThrow();
  });
  
  it("skips layout elements in schema", () => {
    const formSchema = {
      version: "1.0",
      steps: [{
        id: "step1",
        title: "Test",
        fields: [
          { id: "h1", type: "heading", name: "h1", label: "Title", required: false },
          { id: "email", type: "email", name: "email", label: "Email", required: true }
        ]
      }]
    };
    
    const zodSchema = generateZodSchema(formSchema);
    const shape = zodSchema.shape;
    
    expect(shape).not.toHaveProperty("h1");
    expect(shape).toHaveProperty("email");
  });
});
```

### 11.2 Integration Tests

```typescript
// tests/integration/forms.test.ts
import { describe, it, expect, beforeAll } from "vitest";
import { createTestClient } from "../utils/test-client";

describe("Form API", () => {
  let client: TestClient;
  
  beforeAll(async () => {
    client = await createTestClient();
  });
  
  it("creates a new form", async () => {
    const response = await client.post("/api/forms", {
      name: "Test Questionnaire",
      slug: "test-questionnaire",
      formType: "questionnaire",
      schema: {
        version: "1.0",
        steps: [{
          id: "contact",
          title: "Contact",
          fields: [{
            id: "email",
            type: "email",
            name: "email",
            label: "Email",
            required: true
          }]
        }]
      }
    });
    
    expect(response.status).toBe(201);
    expect(response.data.id).toBeDefined();
  });
  
  it("submits a form successfully", async () => {
    const form = await createTestForm(client);
    
    const response = await client.post(
      `/api/public/forms/${client.agency.slug}/${form.slug}/submit`,
      { data: { email: "test@example.com" } }
    );
    
    expect(response.status).toBe(201);
    expect(response.data.success).toBe(true);
    expect(response.data.submissionId).toBeDefined();
  });
  
  it("validates required fields", async () => {
    const form = await createTestForm(client);
    
    const response = await client.post(
      `/api/public/forms/${client.agency.slug}/${form.slug}/submit`,
      { data: {} }  // Missing required email
    );
    
    expect(response.status).toBe(400);
    expect(response.data.errors).toContain("email");
  });
});
```

### 11.3 E2E Tests

```typescript
// tests/e2e/form-builder.spec.ts
import { test, expect } from "@playwright/test";

test.describe("Form Builder", () => {
  test("can create a form with drag and drop", async ({ page }) => {
    await page.goto("/settings/forms/new");
    
    // Drag email field to canvas
    const emailField = page.locator('[data-field-type="email"]');
    const canvas = page.locator('[data-testid="form-canvas"]');
    await emailField.dragTo(canvas);
    
    // Verify field added
    await expect(page.locator('[data-testid="canvas-field"]')).toHaveCount(1);
    
    // Configure field
    await page.locator('[data-testid="canvas-field"]').click();
    await page.fill('[name="label"]', "Your Email");
    await page.check('[name="required"]');
    
    // Save form
    await page.click('button:has-text("Save Form")');
    
    // Verify saved
    await expect(page.locator('.toast-success')).toBeVisible();
  });
  
  test("form renders and submits correctly", async ({ page }) => {
    // Navigate to public form
    await page.goto("/forms/test-agency/test-form");
    
    // Fill form
    await page.fill('[name="email"]', "test@example.com");
    await page.click('button:has-text("Submit")');
    
    // Verify success message
    await expect(page.locator('text=Thank you')).toBeVisible();
  });
});
```

---

## Appendix: Field Type Reference

### Supported Field Types

| Type | Input Component | Zod Type | JSON Schema Type |
|------|-----------------|----------|------------------|
| `text` | `<Input type="text">` | `z.string()` | `{"type":"string"}` |
| `email` | `<Input type="email">` | `z.string().email()` | `{"type":"string","format":"email"}` |
| `tel` | `<Input type="tel">` | `z.string()` | `{"type":"string"}` |
| `url` | `<Input type="url">` | `z.string().url()` | `{"type":"string","format":"uri"}` |
| `number` | `<Input type="number">` | `z.number()` | `{"type":"number"}` |
| `textarea` | `<Textarea>` | `z.string()` | `{"type":"string"}` |
| `select` | `<Select>` | `z.string()` | `{"type":"string","enum":[...]}` |
| `multiselect` | `<MultiSelect>` | `z.array(z.string())` | `{"type":"array"}` |
| `radio` | `<RadioGroup>` | `z.string()` | `{"type":"string","enum":[...]}` |
| `checkbox` | `<Checkbox>` | `z.boolean()` | `{"type":"boolean"}` |
| `date` | `<DatePicker>` | `z.string()` | `{"type":"string","format":"date"}` |
| `file` | `<FileUpload>` | `z.any()` | `{"type":"string","format":"binary"}` |
| `signature` | `<SignaturePad>` | `z.string()` | `{"type":"string"}` |
| `rating` | `<RatingInput>` | `z.number()` | `{"type":"integer"}` |

### Layout Elements (Non-Input)

| Type | Purpose | Renders As |
|------|---------|------------|
| `heading` | Section title | `<h3>` |
| `paragraph` | Descriptive text | `<p>` |
| `divider` | Visual separator | `<hr>` |

### Validation Rules Reference

```typescript
interface ValidationRules {
  // String validations
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  patternMessage?: string;
  
  // Number validations
  min?: number;
  max?: number;
  
  // File validations
  maxSize?: number;        // Bytes
  accept?: string;         // MIME types
  
  // General
  customMessage?: string;
}
```

---

## Summary

This clean-slate specification provides everything needed to build the Form Builder system:

1. **No migration complexity** - Start fresh with proper schema design
2. **4-6 week timeline** - Achievable with focused development
3. **Default templates** - New agencies get working forms immediately
4. **Full customization** - Agencies can build unique forms
5. **Existing workflow integration** - AI proposals still work from submission data

The Form Builder solves the "sameness problem" while enabling new form types (feedback, custom intake) that weren't possible before.

**Next Steps:**
1. Review and approve this specification
2. Create database migrations
3. Begin Phase 1 implementation
