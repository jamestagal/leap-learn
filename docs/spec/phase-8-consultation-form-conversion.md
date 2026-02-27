# Phase 8: Consultation Form Conversion to Dynamic Forms

**Goal:** Replace the hardcoded 4-step consultation form with the Dynamic Form Renderer, using the agency's selected consultation form template. Preserve the `consultations` table structure for downstream document linking.

---

## Current State

### Hardcoded Components (to be replaced)

```
src/lib/components/consultation/
├── ConsultationPage.svelte       # Orchestrator (4 steps, save per step)
├── ContactBusinessForm.svelte    # Step 1: Contact + Industry/Business Type
├── SituationChallenges.svelte    # Step 2: Website Status, Challenges, Urgency
├── GoalsBudget.svelte            # Step 3: Goals, Conversion, Budget, Timeline
└── PreferencesNotes.svelte       # Step 4: Design Styles, Notes
```

### Hardcoded Options (79 total, in `lib/config/consultation-options.ts`)

| Category | Count | Equivalent `field_option_sets` slug |
|----------|-------|-------------------------------------|
| Industries | 16 | `industries` (seeded) |
| Business Types | 7 | `business-types` (seeded) |
| Website Status | 3 | *None — needs new option set* |
| Primary Challenges | 15 | `primary-challenges` (seeded, different values) |
| Urgency Levels | 4 | `urgency-levels` (seeded, similar) |
| Primary Goals | 12 | `primary-goals` (seeded, different values) |
| Conversion Goals | 7 | *None — needs new option set* |
| Budget Ranges | 6 | `budget-ranges` (seeded, different values) |
| Timeline | 4 | `timeline-preferences` (seeded, similar) |
| Design Styles | 5 | *None — needs new option set* |

### Data Storage: Flat Columns on `consultations` Table

The consultation form currently saves to **typed columns** (not JSONB):
- `businessName`, `contactPerson`, `email`, `phone`, `website`
- `socialLinkedin`, `socialFacebook`, `socialInstagram`
- `industry`, `businessType`
- `websiteStatus`, `primaryChallenges[]`, `urgencyLevel`
- `primaryGoals[]`, `conversionGoal`, `budgetRange`, `timeline`
- `designStyles[]`, `admiredWebsites`, `consultationNotes`

These are referenced by proposals/contracts for client data extraction.

---

## Architecture Decision: Keep `consultations` Table

The `consultations` table MUST be preserved because:
1. Proposals extract typed data from it (`createProposal` reads `industry`, `budgetRange`, etc.)
2. Contracts inherit client data from proposals → consultations
3. History/view pages query typed columns for filtering/display
4. `clientId` linkage lives here

**Approach:** DynamicForm renders the form, but on submit a **field mapping layer** writes to the flat `consultations` columns. Custom fields (from agency modifications) go to a new `customData` JSONB column.

### Database Schema Notes

**Important column naming differences between tables:**

| Table | Column | Purpose |
|-------|--------|---------|
| `form_templates` | `category` | Categorizes system templates (e.g., 'consultation', 'questionnaire', 'feedback') |
| `agency_forms` | `form_type` | Identifies agency form type (e.g., 'consultation', 'questionnaire', 'intake') |

Both use similar values but different column names. This is important when writing migrations and queries.

---

## Agency Form Selection Flow

### How agencies choose their consultation form:

1. Agency goes to **Settings > Forms**
2. They have one or more forms with `formType = 'consultation'`
3. One form is marked `isDefault = true` for that type
4. When a team member clicks "New Consultation", the system loads the agency's default consultation-type form

### Form selection on consultation page:

```
User clicks "New Consultation"
    │
    ▼
Load agency's default form: agency_forms WHERE formType='consultation' AND isDefault=true
    │
    ├─ Found → Render via DynamicForm
    │
    └─ Not found → Fallback: load "Full Discovery" system template, render via DynamicForm
```

### Form picker behavior:

| Agency Forms | Behavior |
|--------------|----------|
| 0 forms | Use Full Discovery system template directly |
| 1 form | Load it directly, no picker. Show "Using: [Form Name]" with "Manage Forms" link |
| 2+ forms | Show picker cards (name, description, step count) before form |

---

## Resolved Questions

### 1. Draft Saving with DynamicForm

**Decision:** Step-transition persistence (matching current behavior), not continuous auto-save.

Current `ConsultationPage.svelte` pattern:
- **Lazy creation** — Consultation created on first "Next" click (Step 0 → Step 1)
- **Save on Next** — `saveCurrentStep()` called before advancing
- **Save on Previous** — Also saves before going back
- **Explicit "Save" button** — Mid-step save without navigating

**Implementation:** Add `onStepChange` callback prop to DynamicForm (see Task 0).

### 2. Social Media Fields

**Decision:** Three separate `url` fields with a `heading` for visual grouping.

```json
{
  "id": "social_heading",
  "type": "heading",
  "label": "Social Media (Optional)"
},
{
  "id": "social_linkedin",
  "type": "url",
  "name": "socialLinkedin",
  "label": "LinkedIn",
  "placeholder": "https://linkedin.com/company/...",
  "layout": { "width": "full" }
},
{
  "id": "social_facebook",
  "type": "url",
  "name": "socialFacebook",
  "label": "Facebook",
  "layout": { "width": "half" }
},
{
  "id": "social_instagram",
  "type": "url",
  "name": "socialInstagram",
  "label": "Instagram",
  "layout": { "width": "half" }
}
```

**Rationale:** A "group" field type adds schema complexity (nested fields, validation changes) for minimal UX benefit. Heading + layout achieves the same visual grouping.

### 3. Performance Audit Data (`performanceData` JSONB)

**Decision:** Keep outside the form system entirely.

- It's agency-side tooling (PageSpeed results), not client-facing input
- Populated by AuditRunner component, not form submission
- Field mapping layer will **exclude** any field named `performanceData`

### 4. ChipSelector vs. Checkbox Rendering

**Decision:** Add `renderAs: "chips"` option to multiselect field type.

Current `ChipSelector.svelte` renders options as toggleable pill buttons. DynamicForm's `FieldRenderer` renders multiselect as stacked checkboxes.

**Implementation:** Add `renderAs` property to field schema (see Task 0).

Fields to use chips in Full Discovery template:
- `primaryChallenges`
- `primaryGoals`
- `designStyles`

### 5. Phone Formatting (Australian)

**Decision:** Add `formatter` property to field schema, processed by FieldRenderer.

**Schema addition:**
```typescript
interface FormField {
  // ... existing
  formatter?: "au-phone" | "currency" | "uppercase";
}
```

**Full Discovery template usage:**
```json
{
  "id": "phone",
  "type": "tel",
  "name": "phone",
  "label": "Phone Number",
  "formatter": "au-phone"
}
```

### 6. Form Picker vs. Default

**Decision:** Skip picker when only one consultation form exists.

For discoverability, show a small indicator when single form is auto-loaded:

```svelte
{#if agencyForms.length === 1}
  <div class="text-sm text-base-content/60 mb-4">
    Using: <span class="font-medium">{agencyForms[0].name}</span>
    <a href="/{agencySlug}/settings/forms" class="link link-primary ml-2">
      Manage Forms
    </a>
  </div>
{/if}
```

---

## Task 0: DynamicForm Enhancements (Prerequisite)

**Purpose:** Ensure DynamicForm has feature parity with hardcoded components before the swap.

**File:** `src/lib/components/form-renderer/DynamicForm.svelte` and related

### 0.1 Add `onStepChange` Callback

Support step-transition persistence matching current consultation form:

```typescript
interface Props {
  // ... existing
  onStepChange?: (
    direction: 'next' | 'prev',
    stepIndex: number,
    data: Record<string, unknown>
  ) => Promise<void>;
}
```

**In `handleNext()`:**
```typescript
async function handleNext() {
  if (!previewMode && !validateStep()) return;

  // Call step change handler before advancing
  if (onStepChange && !isLastStep) {
    try {
      await onStepChange('next', currentStepIndex, formData);
    } catch (err) {
      console.error('Step save failed:', err);
      return; // Don't advance if save fails
    }
  }

  if (isLastStep) {
    // ... existing submit logic
  } else {
    currentStepIndex++;
  }
}
```

**In `goBack()`:**
```typescript
async function goBack() {
  if (isFirstStep) return;
  
  if (onStepChange) {
    try {
      await onStepChange('prev', currentStepIndex, formData);
    } catch (err) {
      console.error('Step save failed on back:', err);
      // Still allow navigation back even if save fails
    }
  }
  
  currentStepIndex--;
}
```

### 0.2 Add `renderAs: "chips"` for Multiselect

**File:** `src/lib/types/form-builder.ts`

```typescript
interface FormField {
  // ... existing
  renderAs?: "default" | "chips";
}
```

**File:** `src/lib/components/form-renderer/FieldRenderer.svelte`

```svelte
{:else if field.type === "multiselect"}
  {#if field.renderAs === "chips"}
    <!-- Chip/pill button style -->
    <div class="flex flex-wrap gap-2">
      {#each options as option}
        {@const isSelected = ((value as string[]) || []).includes(option.value)}
        <button
          type="button"
          class="btn btn-sm transition-all"
          class:btn-primary={isSelected}
          class:btn-outline={!isSelected}
          onclick={() => handleMultiSelectChange(option.value)}
        >
          {option.label}
        </button>
      {/each}
    </div>
  {:else}
    <!-- Existing checkbox style -->
    <div class="field-options-group" class:has-error={!!error}>
      {#each options as option}
        <!-- ... existing checkbox markup ... -->
      {/each}
    </div>
  {/if}
{/if}
```

### 0.3 Add `formatter` Support for Text/Tel Fields

**File:** `src/lib/types/form-builder.ts`

```typescript
interface FormField {
  // ... existing
  formatter?: "au-phone" | "currency" | "uppercase";
}
```

**File:** `src/lib/components/form-renderer/FieldRenderer.svelte`

```typescript
import { formatAustralianPhone } from "$lib/utils/phone";

const FORMATTERS: Record<string, (v: string) => string> = {
  "au-phone": formatAustralianPhone,
  "uppercase": (v) => v.toUpperCase(),
  // Add others as needed
};

function handleTextInput(e: Event) {
  const target = e.target as HTMLInputElement;
  let value = target.value;
  
  if (field.formatter && FORMATTERS[field.formatter]) {
    value = FORMATTERS[field.formatter](value);
    target.value = value; // Update display immediately
  }
  
  onchange(value);
}
```

### 0.4 Add Read-Only Mode

For view/edit pages to re-render historical consultations:

```typescript
interface Props {
  // ... existing
  readOnly?: boolean;
}
```

When `readOnly={true}`:
- All inputs get `disabled` attribute
- Navigation buttons hidden
- Submit button hidden
- Visual styling indicates view-only state

### 0.5 Add Explicit "Save" Button Option

```typescript
interface Props {
  // ... existing
  showSaveButton?: boolean;
  onSave?: (data: Record<string, unknown>) => Promise<void>;
}
```

Renders a "Save" button in FormNav that calls `onSave` without advancing steps.

### Task 0 Checklist

- [ ] Add `onStepChange` callback prop
- [ ] Add `renderAs: "chips"` for multiselect fields
- [ ] Add `formatter` support for text/tel fields
- [ ] Add `readOnly` mode for view pages
- [ ] Add `showSaveButton` + `onSave` props
- [ ] Update TypeScript types in `form-builder.ts`
- [ ] Test all enhancements in Form Builder preview

---

## Task 1: Seed Missing Option Sets

**File:** `migrations/007_consultation_option_sets.sql`

Add option sets that exist in `consultation-options.ts` but NOT in `field_option_sets`:

### New Option Sets to Create

**`website-status`** (3 options):
```sql
INSERT INTO field_option_sets (id, slug, name, description, options, is_system, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'website-status',
  'Website Status',
  'Current state of client website',
  '[
    {"value": "none", "label": "No Current Website"},
    {"value": "refresh", "label": "Needs Refresh"},
    {"value": "rebuild", "label": "Complete Rebuild"}
  ]'::jsonb,
  true,
  NOW(),
  NOW()
);
```

**`conversion-goals`** (7 options):
```sql
INSERT INTO field_option_sets (id, slug, name, description, options, is_system, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'conversion-goals',
  'Conversion Goals',
  'Desired conversion actions for website',
  '[
    {"value": "phone-calls", "label": "Phone Calls"},
    {"value": "form-submissions", "label": "Form Submissions"},
    {"value": "email-inquiries", "label": "Email Inquiries"},
    {"value": "bookings", "label": "Bookings / Appointments"},
    {"value": "purchases", "label": "Online Purchases"},
    {"value": "quote-requests", "label": "Quote Requests"},
    {"value": "newsletter-signups", "label": "Newsletter Signups"}
  ]'::jsonb,
  true,
  NOW(),
  NOW()
);
```

**`design-styles`** (5 options):
```sql
INSERT INTO field_option_sets (id, slug, name, description, options, is_system, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'design-styles',
  'Design Styles',
  'Visual design style preferences',
  '[
    {"value": "modern-clean", "label": "Modern & Clean"},
    {"value": "bold-creative", "label": "Bold & Creative"},
    {"value": "corporate-professional", "label": "Corporate & Professional"},
    {"value": "minimalist", "label": "Minimalist"},
    {"value": "traditional-classic", "label": "Traditional & Classic"}
  ]'::jsonb,
  true,
  NOW(),
  NOW()
);
```

### Option Sets to Reconcile

Update existing seeded option sets to match hardcoded values:

**`urgency-levels`** — Use hardcoded labels (more concise):
```sql
UPDATE field_option_sets
SET options = '[
  {"value": "low", "label": "Low - Exploratory phase"},
  {"value": "medium", "label": "Medium - Planning for next quarter"},
  {"value": "high", "label": "High - Need to start within weeks"},
  {"value": "critical", "label": "Critical - Urgent need"}
]'::jsonb,
updated_at = NOW()
WHERE slug = 'urgency-levels';
```

**`budget-ranges`** — Use hardcoded values (simpler for typical agency clients):
```sql
UPDATE field_option_sets
SET options = '[
  {"value": "under-2k", "label": "Under $2,000"},
  {"value": "2k-5k", "label": "$2,000 - $5,000"},
  {"value": "5k-10k", "label": "$5,000 - $10,000"},
  {"value": "10k-20k", "label": "$10,000 - $20,000"},
  {"value": "20k-plus", "label": "$20,000+"},
  {"value": "tbd", "label": "To Be Determined"}
]'::jsonb,
updated_at = NOW()
WHERE slug = 'budget-ranges';
```

**`primary-challenges`** — Merge: keep hardcoded as primary
```sql
UPDATE field_option_sets
SET options = '[
  {"value": "lead-generation", "label": "Lead Generation"},
  {"value": "conversion-rate", "label": "Low Conversion Rates"},
  {"value": "brand-awareness", "label": "Brand Awareness"},
  {"value": "customer-retention", "label": "Customer Retention"},
  {"value": "competition", "label": "Competitive Pressure"},
  {"value": "technology-adoption", "label": "Technology Adoption"},
  {"value": "customer-experience", "label": "Customer Experience"},
  {"value": "digital-transformation", "label": "Digital Transformation"},
  {"value": "outdated-website", "label": "Outdated Website"},
  {"value": "poor-mobile", "label": "Poor Mobile Experience"},
  {"value": "seo-issues", "label": "SEO / Search Visibility"},
  {"value": "no-online-presence", "label": "No Online Presence"},
  {"value": "credibility", "label": "Lack of Credibility/Trust"},
  {"value": "manual-processes", "label": "Too Many Manual Processes"},
  {"value": "other", "label": "Other"}
]'::jsonb,
updated_at = NOW()
WHERE slug = 'primary-challenges';
```

**`primary-goals`** — Keep hardcoded values:
```sql
UPDATE field_option_sets
SET options = '[
  {"value": "increase-revenue", "label": "Increase Revenue"},
  {"value": "generate-leads", "label": "Generate More Leads"},
  {"value": "improve-conversion", "label": "Improve Conversion Rates"},
  {"value": "build-brand", "label": "Build Brand Awareness"},
  {"value": "launch-product", "label": "Launch New Product/Service"},
  {"value": "improve-retention", "label": "Improve Customer Retention"},
  {"value": "enhance-experience", "label": "Enhance Customer Experience"},
  {"value": "digital-presence", "label": "Establish Digital Presence"},
  {"value": "competitive-advantage", "label": "Gain Competitive Advantage"},
  {"value": "automate-processes", "label": "Automate Business Processes"},
  {"value": "credibility", "label": "Build Credibility & Trust"},
  {"value": "other", "label": "Other"}
]'::jsonb,
updated_at = NOW()
WHERE slug = 'primary-goals';
```

---

## Task 2: Update "Full Discovery" System Template

**File:** `migrations/008_update_full_discovery_template.sql`

**IMPORTANT:** A "Full Discovery" template already exists in migration 004, but it has a 6-step generic schema that does NOT map to the `consultations` table. We need to UPDATE it with the correct 4-step schema that matches the hardcoded consultation form fields.

**Note:** The `form_templates` table uses `category` column (not `form_type`). The `form_type` column exists on `agency_forms` table only.

```sql
-- Update existing Full Discovery template with correct consultation-mapped schema
-- Uses ON CONFLICT to update if exists, insert if not
INSERT INTO form_templates (
  slug,
  name,
  description,
  category,
  schema,
  ui_config,
  is_featured,
  display_order,
  updated_at
) VALUES (
  'full-discovery',
  'Full Discovery',
  'Comprehensive 4-step consultation form covering contact info, challenges, goals, and preferences. Maps directly to consultations table for proposal generation.',
  'consultation',
  '{
    "version": "1.0",
    "steps": [
      {
        "id": "contact",
        "title": "Contact & Business",
        "description": "Basic contact and business information",
        "fields": [
          {"id": "business_name", "type": "text", "name": "businessName", "label": "Business Name", "required": true, "layout": {"width": "half"}},
          {"id": "contact_person", "type": "text", "name": "contactPerson", "label": "Contact Person", "required": true, "layout": {"width": "half"}},
          {"id": "email", "type": "email", "name": "email", "label": "Email Address", "required": true, "layout": {"width": "half"}},
          {"id": "phone", "type": "tel", "name": "phone", "label": "Phone Number", "formatter": "au-phone", "layout": {"width": "half"}},
          {"id": "website", "type": "url", "name": "website", "label": "Current Website", "placeholder": "https://", "layout": {"width": "full"}},
          {"id": "industry", "type": "select", "name": "industry", "label": "Industry", "required": true, "optionSetSlug": "industries", "layout": {"width": "half"}},
          {"id": "business_type", "type": "select", "name": "businessType", "label": "Business Type", "required": true, "optionSetSlug": "business-types", "layout": {"width": "half"}},
          {"id": "social_heading", "type": "heading", "label": "Social Media (Optional)"},
          {"id": "social_linkedin", "type": "url", "name": "socialLinkedin", "label": "LinkedIn", "placeholder": "https://linkedin.com/company/...", "layout": {"width": "full"}},
          {"id": "social_facebook", "type": "url", "name": "socialFacebook", "label": "Facebook", "layout": {"width": "half"}},
          {"id": "social_instagram", "type": "url", "name": "socialInstagram", "label": "Instagram", "layout": {"width": "half"}}
        ]
      },
      {
        "id": "situation",
        "title": "Situation & Challenges",
        "description": "Current website status and business challenges",
        "fields": [
          {"id": "website_status", "type": "radio", "name": "websiteStatus", "label": "Current Website Status", "optionSetSlug": "website-status", "layout": {"width": "full"}},
          {"id": "primary_challenges", "type": "multiselect", "name": "primaryChallenges", "label": "Primary Challenges", "description": "Select all that apply", "optionSetSlug": "primary-challenges", "renderAs": "chips", "layout": {"width": "full"}},
          {"id": "urgency_level", "type": "select", "name": "urgencyLevel", "label": "Project Urgency", "optionSetSlug": "urgency-levels", "layout": {"width": "full"}}
        ]
      },
      {
        "id": "goals",
        "title": "Goals & Budget",
        "description": "Project objectives and investment expectations",
        "fields": [
          {"id": "primary_goals", "type": "multiselect", "name": "primaryGoals", "label": "Primary Goals", "description": "What do you want to achieve?", "optionSetSlug": "primary-goals", "renderAs": "chips", "layout": {"width": "full"}},
          {"id": "conversion_goal", "type": "radio", "name": "conversionGoal", "label": "Desired Conversion Action", "description": "What action should visitors take?", "optionSetSlug": "conversion-goals", "layout": {"width": "full"}},
          {"id": "budget_range", "type": "select", "name": "budgetRange", "label": "Budget Range", "required": true, "optionSetSlug": "budget-ranges", "layout": {"width": "half"}},
          {"id": "timeline", "type": "select", "name": "timeline", "label": "Timeline", "optionSetSlug": "timeline-preferences", "layout": {"width": "half"}}
        ]
      },
      {
        "id": "preferences",
        "title": "Preferences & Notes",
        "description": "Design preferences and additional information",
        "fields": [
          {"id": "design_styles", "type": "multiselect", "name": "designStyles", "label": "Design Style Preferences", "optionSetSlug": "design-styles", "renderAs": "chips", "layout": {"width": "full"}},
          {"id": "admired_websites", "type": "textarea", "name": "admiredWebsites", "label": "Admired Websites", "placeholder": "List any websites you admire and why...", "layout": {"width": "full"}},
          {"id": "consultation_notes", "type": "textarea", "name": "consultationNotes", "label": "Additional Notes", "placeholder": "Any other information that would help us understand your needs...", "layout": {"width": "full"}}
        ]
      }
    ]
  }'::jsonb,
  '{
    "layout": "wizard",
    "showProgressBar": true,
    "showStepNumbers": true,
    "submitButtonText": "Complete Consultation",
    "successMessage": "Thank you! Your consultation has been submitted successfully."
  }'::jsonb,
  true,
  11,
  NOW()
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  schema = EXCLUDED.schema,
  ui_config = EXCLUDED.ui_config,
  is_featured = EXCLUDED.is_featured,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();
```

---

## Task 3: Add `customData` and `formId` Columns

**File:** `migrations/007_consultation_option_sets.sql` (or separate migration)

```sql
-- Add customData for unmapped dynamic form fields
ALTER TABLE consultations 
ADD COLUMN IF NOT EXISTS custom_data JSONB DEFAULT '{}';

-- Add formId to track which form was used (for re-rendering in view mode)
ALTER TABLE consultations 
ADD COLUMN IF NOT EXISTS form_id UUID REFERENCES agency_forms(id) ON DELETE SET NULL;

-- Index for form_id lookups
CREATE INDEX IF NOT EXISTS idx_consultations_form_id ON consultations(form_id);
```

**Drizzle schema update** (`src/lib/server/schema.ts`):

```typescript
export const consultations = pgTable("consultations", {
  // ... existing columns
  
  customData: jsonb("custom_data").default({}),
  formId: uuid("form_id").references(() => agencyForms.id, { onDelete: "set null" }),
});
```

---

## Task 4: Field Mapping Layer

**New file:** `src/lib/server/consultation-field-map.ts`

Maps dynamic form submission data → flat `consultations` columns:

```typescript
/**
 * Consultation Field Mapping
 * 
 * Maps DynamicForm field names to consultation table columns.
 * Fields not in this map go to customData JSONB.
 */

// Known field mappings: form field name → consultation column
const FIELD_MAP: Record<string, string> = {
  // Step 1: Contact & Business
  businessName: 'businessName',
  contactPerson: 'contactPerson',
  email: 'email',
  phone: 'phone',
  website: 'website',
  socialLinkedin: 'socialLinkedin',
  socialFacebook: 'socialFacebook',
  socialInstagram: 'socialInstagram',
  industry: 'industry',
  businessType: 'businessType',
  
  // Step 2: Situation & Challenges
  websiteStatus: 'websiteStatus',
  primaryChallenges: 'primaryChallenges',
  urgencyLevel: 'urgencyLevel',
  
  // Step 3: Goals & Budget
  primaryGoals: 'primaryGoals',
  conversionGoal: 'conversionGoal',
  budgetRange: 'budgetRange',
  timeline: 'timeline',
  
  // Step 4: Preferences & Notes
  designStyles: 'designStyles',
  admiredWebsites: 'admiredWebsites',
  consultationNotes: 'consultationNotes',
};

// Fields to exclude from mapping entirely (agency-side data)
const EXCLUDED_FIELDS = ['performanceData'];

export interface MappedConsultationData {
  mapped: Record<string, unknown>;
  custom: Record<string, unknown>;
}

/**
 * Map dynamic form data to consultation table structure
 */
export function mapFormDataToConsultation(
  formData: Record<string, unknown>
): MappedConsultationData {
  const mapped: Record<string, unknown> = {};
  const custom: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(formData)) {
    // Skip excluded fields
    if (EXCLUDED_FIELDS.includes(key)) continue;
    
    // Skip empty values
    if (value === undefined || value === null || value === '') continue;
    
    if (FIELD_MAP[key]) {
      // Known field → map to consultation column
      mapped[FIELD_MAP[key]] = value;
    } else {
      // Unknown field → store in customData
      custom[key] = value;
    }
  }

  return { mapped, custom };
}

/**
 * Reverse map: consultation columns → form field names
 * Used for populating DynamicForm initialData from existing consultation
 */
export function consultationToFormData(
  consultation: Record<string, unknown>,
  customData?: Record<string, unknown>
): Record<string, unknown> {
  const formData: Record<string, unknown> = {};
  
  // Reverse map known columns
  for (const [formField, dbColumn] of Object.entries(FIELD_MAP)) {
    const value = consultation[dbColumn];
    if (value !== undefined && value !== null) {
      formData[formField] = value;
    }
  }
  
  // Merge in custom data
  if (customData) {
    Object.assign(formData, customData);
  }
  
  return formData;
}

/**
 * Get list of mapped column names (for partial updates)
 */
export function getMappedColumns(): string[] {
  return Object.values(FIELD_MAP);
}
```

---

## Task 5: Add ClientPicker to Consultation Flow

**Before** the form renders, show a client selection step:

```
┌─────────────────────────────────────────┐
│ Step 0: Select Client                   │
│                                         │
│ [ClientPicker component]                │
│  - Search existing clients              │
│  - Or enter new client details          │
│  - Pre-fills contact fields in form     │
│                                         │
│ [Continue to Form →]                    │
└─────────────────────────────────────────┘
```

### Behavior

- Reuse `ClientPicker.svelte` from `$lib/components/shared/`
- If client selected: pre-fill `businessName`, `email`, `contactPerson`, `phone` in form
- If new client: leave form empty, `getOrCreateClient()` runs on submit
- Skip this step if `?clientId=` URL param provided (pre-fill directly)

### Implementation in consultation page:

```svelte
<script>
  let showClientPicker = $state(true);
  let selectedClient = $state<Client | null>(null);
  let prefillData = $state<Record<string, unknown>>({});
  
  // Skip picker if clientId in URL
  $effect(() => {
    if (page.url.searchParams.get('clientId')) {
      showClientPicker = false;
      // Load client and set prefillData
    }
  });
  
  function handleClientSelected(client: Client) {
    selectedClient = client;
    prefillData = {
      businessName: client.businessName,
      contactPerson: client.contactName,
      email: client.email,
      phone: client.phone,
    };
    showClientPicker = false;
  }
  
  function handleSkipClientPicker() {
    showClientPicker = false;
  }
</script>

{#if showClientPicker}
  <ClientPickerStep 
    onSelect={handleClientSelected}
    onSkip={handleSkipClientPicker}
  />
{:else}
  <DynamicForm
    schema={agencyForm.schema}
    initialData={prefillData}
    ...
  />
{/if}
```

---

## Task 6: Replace Consultation Page with DynamicForm

**Split into 3 sub-tasks for reduced complexity:**

### Task 6a: Basic DynamicForm Rendering

**File:** `routes/(app)/[agencySlug]/consultation/+page.svelte`

Replace form content with DynamicForm, keeping existing page structure:

```svelte
<script lang="ts">
  import DynamicForm from '$lib/components/form-renderer/DynamicForm.svelte';
  import { mapFormDataToConsultation } from '$lib/server/consultation-field-map';
  import { createConsultation, updateConsultation } from '$lib/api/consultation.remote';
  
  let { data } = $props();
  let { agencyForm, optionSets, agencyId } = data;
  
  let consultationId = $state<string | null>(null);
  
  // Convert option sets array to map for DynamicForm
  const optionSetsMap = $derived(
    Object.fromEntries(optionSets.map(os => [os.slug, os.options]))
  );
  
  async function handleStepChange(
    direction: 'next' | 'prev',
    stepIndex: number,
    formData: Record<string, unknown>
  ) {
    const { mapped, custom } = mapFormDataToConsultation(formData);
    
    if (!consultationId && stepIndex === 0) {
      // Lazy creation on first step
      const result = await createConsultation({
        agencyId,
        formId: agencyForm.id,
        ...mapped,
        customData: custom,
      });
      consultationId = result.consultationId;
    } else if (consultationId) {
      // Update existing
      await updateConsultation({
        consultationId,
        ...mapped,
        customData: custom,
      });
    }
  }
  
  async function handleSubmit(formData: Record<string, unknown>) {
    const { mapped, custom } = mapFormDataToConsultation(formData);
    
    if (!consultationId) {
      // Create if somehow not created yet
      const result = await createConsultation({
        agencyId,
        formId: agencyForm.id,
        ...mapped,
        customData: custom,
        status: 'completed',
      });
      consultationId = result.consultationId;
    } else {
      // Complete existing
      await updateConsultation({
        consultationId,
        ...mapped,
        customData: custom,
        status: 'completed',
      });
    }
    
    goto(`/${agencySlug}/consultation/success`);
  }
</script>

<DynamicForm
  schema={agencyForm.schema}
  options={optionSetsMap}
  onStepChange={handleStepChange}
  onSubmit={handleSubmit}
  showSaveButton={true}
  onSave={async (data) => {
    if (consultationId) {
      const { mapped, custom } = mapFormDataToConsultation(data);
      await updateConsultation({ consultationId, ...mapped, customData: custom });
    }
  }}
/>
```

### Task 6b: Form Picker Logic

Add form selection when agency has multiple consultation forms:

```svelte
<script>
  let { data } = $props();
  let { consultationForms } = data; // All agency forms with formType='consultation'
  
  let selectedForm = $state<AgencyForm | null>(null);
  let showPicker = $derived(consultationForms.length > 1 && !selectedForm);
  
  // Auto-select if only one form
  $effect(() => {
    if (consultationForms.length === 1) {
      selectedForm = consultationForms[0];
    }
  });
</script>

{#if showPicker}
  <FormPicker 
    forms={consultationForms}
    onSelect={(form) => selectedForm = form}
  />
{:else if selectedForm}
  <!-- Show form indicator if auto-selected -->
  {#if consultationForms.length === 1}
    <div class="text-sm text-base-content/60 mb-4">
      Using: <span class="font-medium">{selectedForm.name}</span>
      <a href="/{agencySlug}/settings/forms" class="link link-primary ml-2">
        Manage Forms
      </a>
    </div>
  {/if}
  
  <DynamicForm schema={selectedForm.schema} ... />
{/if}
```

### Task 6c: ClientPicker Integration

Combine ClientPicker step with form flow (see Task 5 implementation).

---

## Task 7: Update consultation.remote.ts

### Modify `createConsultation`:

```typescript
export async function createConsultation(params: {
  agencyId: string;
  formId?: string;
  customData?: Record<string, unknown>;
  // Accept any mapped field dynamically
  [key: string]: unknown;
}): Promise<{ consultationId: string }> {
  const { agencyId, formId, customData, ...fieldData } = params;
  
  // Get or create client from email
  const clientId = await getOrCreateClient({
    agencyId,
    email: fieldData.email as string,
    businessName: fieldData.businessName as string,
    contactName: fieldData.contactPerson as string,
    phone: fieldData.phone as string,
  });
  
  const consultation = await db.insert(consultations).values({
    id: crypto.randomUUID(),
    agencyId,
    clientId,
    formId,
    customData: customData || {},
    status: 'draft',
    ...fieldData,
    createdAt: new Date(),
    updatedAt: new Date(),
  }).returning({ id: consultations.id });
  
  return { consultationId: consultation[0].id };
}
```

### Modify `updateConsultation`:

```typescript
export async function updateConsultation(params: {
  consultationId: string;
  customData?: Record<string, unknown>;
  status?: string;
  [key: string]: unknown;
}): Promise<void> {
  const { consultationId, customData, ...fieldData } = params;
  
  const updateData: Record<string, unknown> = {
    ...fieldData,
    updatedAt: new Date(),
  };
  
  // Merge customData if provided
  if (customData && Object.keys(customData).length > 0) {
    // Fetch existing customData and merge
    const existing = await db.query.consultations.findFirst({
      where: eq(consultations.id, consultationId),
      columns: { customData: true },
    });
    
    updateData.customData = {
      ...(existing?.customData || {}),
      ...customData,
    };
  }
  
  await db.update(consultations)
    .set(updateData)
    .where(eq(consultations.id, consultationId));
}
```

### Keep legacy functions (deprecated):

```typescript
/**
 * @deprecated Use updateConsultation with dynamic fields instead
 */
export async function updateContactBusiness(...) { ... }

/**
 * @deprecated Use updateConsultation with dynamic fields instead  
 */
export async function updateSituation(...) { ... }
```

---

## Task 8: Update View/Edit Pages

**Files:**
- `consultation/view/[id]/+page.svelte` — read-only view
- `consultation/edit/[id]/+page.svelte` — edit existing

### View page changes:

```svelte
<script>
  import DynamicForm from '$lib/components/form-renderer/DynamicForm.svelte';
  import { consultationToFormData } from '$lib/server/consultation-field-map';
  
  let { data } = $props();
  let { consultation, agencyForm, optionSets } = data;
  
  // Convert consultation to form data
  const initialData = $derived(
    consultationToFormData(consultation, consultation.customData)
  );
  
  // Determine which schema to use
  const schema = $derived(
    agencyForm?.schema || data.fullDiscoveryTemplate.schema
  );
</script>

<DynamicForm
  {schema}
  options={optionSetsMap}
  initialData={initialData}
  readOnly={true}
  onSubmit={() => {}} <!-- No-op, form is read-only -->
/>
```

### Edit page changes:

```svelte
<DynamicForm
  {schema}
  options={optionSetsMap}
  initialData={initialData}
  readOnly={false}
  onSubmit={handleUpdate}
  showSaveButton={true}
  onSave={handleSave}
/>
```

### Page load (server):

```typescript
// +page.server.ts
export async function load({ params }) {
  const consultation = await getConsultation(params.id);
  
  // Load the form used for this consultation
  let agencyForm = null;
  if (consultation.formId) {
    agencyForm = await getAgencyForm(consultation.formId);
  }
  
  // Fallback to Full Discovery template if no formId
  const fullDiscoveryTemplate = await getFormTemplate('full-discovery');
  
  // Load option sets
  const optionSets = await getOptionSets([
    'industries', 'business-types', 'website-status',
    'primary-challenges', 'urgency-levels', 'primary-goals',
    'conversion-goals', 'budget-ranges', 'timeline-preferences',
    'design-styles'
  ]);
  
  return { consultation, agencyForm, fullDiscoveryTemplate, optionSets };
}
```

---

## Task 9: Agency Onboarding — Auto-seed Default Consultation Form

**File:** Modify agency creation flow in `agency.remote.ts`

When a new agency is created:

```typescript
export async function createAgency(params: CreateAgencyParams) {
  // ... existing agency creation logic
  
  const agency = await db.insert(agencies).values({ ... }).returning();
  
  // Auto-seed Full Discovery form for new agency
  const fullDiscoveryTemplate = await db.query.formTemplates.findFirst({
    where: eq(formTemplates.slug, 'full-discovery'),
  });
  
  if (fullDiscoveryTemplate) {
    await db.insert(agencyForms).values({
      id: crypto.randomUUID(),
      agencyId: agency[0].id,
      name: fullDiscoveryTemplate.name,
      description: fullDiscoveryTemplate.description,
      formType: 'consultation',
      schema: fullDiscoveryTemplate.schema,
      uiConfig: fullDiscoveryTemplate.uiConfig,
      isDefault: true,
      isActive: true,
      sourceTemplateId: fullDiscoveryTemplate.id, // For push update tracking
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
  
  return agency[0];
}
```

---

## Task 10: Cleanup — Remove Legacy Components

**Only after Tasks 0-9 are verified working:**

### Files to delete:

- [ ] `src/lib/components/consultation/ConsultationPage.svelte`
- [ ] `src/lib/components/consultation/ContactBusinessForm.svelte`
- [ ] `src/lib/components/consultation/SituationChallenges.svelte`
- [ ] `src/lib/components/consultation/GoalsBudget.svelte`
- [ ] `src/lib/components/consultation/PreferencesNotes.svelte`
- [ ] `src/lib/config/consultation-options.ts`
- [ ] `src/lib/schema/consultation.ts` (valibot schemas — validation now in form schema)

### Code to remove:

- [ ] Remove deprecated step-update functions from `consultation.remote.ts`
- [ ] Remove `agency_form_options` table usage (old per-agency customization)
- [ ] Remove old consultation type imports where no longer needed

### Post-cleanup verification:

- [ ] Ensure demo seed data still works (`scripts/seed-consultation.ts`)
- [ ] Update seed script if needed to use new dynamic form approach
- [ ] Run full test suite
- [ ] Manual test: create, view, edit consultation

---

## Option Set Comparison Summary

### Exact matches (no changes needed):
- `industries` — 16 options, identical values ✓
- `business-types` — 7 options, identical values ✓

### Updates required:
- `urgency-levels` — Update to use hardcoded labels
- `budget-ranges` — Update to use hardcoded values
- `primary-challenges` — Update to use hardcoded values
- `primary-goals` — Update to use hardcoded values

### New option sets to create:
- `website-status` (3 options)
- `conversion-goals` (7 options)
- `design-styles` (5 options)

---

## Implementation Order

```
Task 0: DynamicForm Enhancements ──────────────────────┐
    │                                                   │
    ▼                                                   │
Task 1: Seed Missing Option Sets                        │
    │                                                   │ Prerequisites
Task 2: Create Full Discovery Template                  │
    │                                                   │
Task 3: Add customData + formId Columns                 │
    │                                                   │
Task 4: Field Mapping Layer ───────────────────────────┘
    │
    ▼
Task 5: ClientPicker Integration ──────────────────────┐
    │                                                   │
Task 6a: Basic DynamicForm Rendering                    │
    │                                                   │ Core Swap
Task 6b: Form Picker Logic                              │
    │                                                   │
Task 6c: ClientPicker + Form Integration ──────────────┘
    │
    ▼
Task 7: Update consultation.remote.ts
    │
Task 8: Update View/Edit Pages
    │
Task 9: Agency Onboarding Auto-seed
    │
    ▼
Task 10: Cleanup Legacy Components
    │
    ▼
Post-Task: Verify demo seed data works
```

---

## Success Criteria

- [ ] New consultation created via DynamicForm saves to flat columns correctly
- [ ] Custom fields (agency additions) stored in `customData` JSONB
- [ ] Existing consultation view pages render correctly using stored `formId`
- [ ] ClientPicker pre-fills contact data in form
- [ ] Form picker shows when agency has multiple consultation forms
- [ ] New agencies auto-receive Full Discovery as default form
- [ ] Step-transition saves work (Next/Previous persist data)
- [ ] Explicit "Save" button works mid-step
- [ ] Phone formatting applies correctly
- [ ] Chip-style multiselect renders for challenges/goals/styles
- [ ] Demo seed consultation still works after migration
- [ ] All hardcoded components successfully deleted
