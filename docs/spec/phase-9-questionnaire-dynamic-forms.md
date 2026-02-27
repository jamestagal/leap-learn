# Phase 9: Questionnaire Conversion to Dynamic Forms

**Goal:** Convert the questionnaires system to use DynamicForm, allowing agencies to choose which form template (and layout) to use per questionnaire. Preserve all existing functionality including public links, progress tracking, and entity linking.

---

## Current State

### Hardcoded Components
```
src/lib/components/questionnaire/
├── QuestionnaireWizard.svelte      # Main 8-section orchestrator
├── QuestionnaireSidebar.svelte     # Progress sidebar
├── QuestionnaireNav.svelte         # Next/Previous navigation
├── Section1Personal.svelte         # Personal info fields
├── Section2Company.svelte          # Company details
├── Section3Display.svelte          # Display info (public website)
├── Section4Domain.svelte           # Domain/technical
├── Section5Business.svelte         # About business
├── Section6Content.svelte          # Website content needs
├── Section7Design.svelte           # Design preferences
└── Section8Final.svelte            # Final details
```

### Existing System Template
**"Website Questionnaire"** template already exists:
- Slug: `website-questionnaire`
- Category: `questionnaire`
- 8 steps matching the hardcoded sections
- Field names match `QuestionnaireResponses` type
- File: `src/lib/components/form-builder/templates/website-questionnaire.ts`
- Seeded in: `migrations/004_form_builder_system.sql`

### Database Table: `questionnaire_responses`
| Column | Type | Purpose |
|--------|------|---------|
| `id` | UUID | Primary key |
| `slug` | VARCHAR | Public URL (`/q/{slug}`) |
| `agencyId` | UUID | Agency scope |
| `contractId` | UUID | Optional link |
| `proposalId` | UUID | Optional link |
| `consultationId` | UUID | Optional link |
| `clientBusinessName` | TEXT | Client identifier |
| `clientEmail` | VARCHAR | Client contact |
| `responses` | JSONB | All field values |
| `currentSection` | INT | Progress tracking (0-7) |
| `completionPercentage` | INT | 0-100% |
| `status` | VARCHAR | not_started/in_progress/completed |

### Routes
| Route | Purpose |
|-------|---------|
| `/{agencySlug}/questionnaires` | List all questionnaires |
| `/{agencySlug}/questionnaires/new` | Create new questionnaire |
| `/{agencySlug}/questionnaires/preview` | Preview default form |
| `/{agencySlug}/questionnaires/[id]` | View completed responses |
| `/q/[slug]` | Public form for clients |

---

## Architecture Decision

### Key Changes
1. Add `formId` column to `questionnaire_responses` to track which form was used
2. Add `layoutOverride` column to allow per-questionnaire layout selection
3. Render via DynamicForm instead of QuestionnaireWizard
4. Preserve backward compatibility for existing questionnaires (no `formId` = use legacy)

### Field Storage Strategy
Unlike consultations which map to typed columns, questionnaires already use JSONB `responses` column. **No field mapping needed** — DynamicForm data goes directly to `responses`.

---

## Task 1: Database Migration

**File:** `migrations/009_questionnaire_dynamic_forms.sql`

```sql
-- Add formId to track which form template/agency form was used
ALTER TABLE questionnaire_responses
ADD COLUMN IF NOT EXISTS form_id UUID REFERENCES agency_forms(id) ON DELETE SET NULL;

-- Add layout override (null = use form's default layout)
ALTER TABLE questionnaire_responses
ADD COLUMN IF NOT EXISTS layout_override VARCHAR(20);

-- Index for form lookups
CREATE INDEX IF NOT EXISTS idx_questionnaire_responses_form_id
ON questionnaire_responses(form_id);

-- Comment
COMMENT ON COLUMN questionnaire_responses.form_id IS 'Agency form used. NULL = legacy hardcoded form or system template.';
COMMENT ON COLUMN questionnaire_responses.layout_override IS 'Layout override: single-column, stepper, wizard. NULL = use form default.';
```

**Drizzle schema update** (`src/lib/server/schema.ts`):
```typescript
// In questionnaireResponses table:
formId: uuid("form_id").references(() => agencyForms.id, { onDelete: "set null" }),
layoutOverride: varchar("layout_override", { length: 20 }),
```

---

## Task 2: Update createQuestionnaire Remote Function

**File:** `src/lib/api/questionnaire.remote.ts`

Update `CreateQuestionnaireSchema` and `createQuestionnaire`:

```typescript
const CreateQuestionnaireSchema = v.object({
  clientBusinessName: v.pipe(v.string(), v.minLength(1)),
  clientEmail: v.pipe(v.string(), v.email()),
  formId: v.optional(v.pipe(v.string(), v.uuid())),
  layoutOverride: v.optional(v.picklist(["single-column", "stepper", "wizard"])),
  contractId: v.optional(v.pipe(v.string(), v.uuid())),
  proposalId: v.optional(v.pipe(v.string(), v.uuid())),
  consultationId: v.optional(v.pipe(v.string(), v.uuid())),
});

export const createQuestionnaire = command(CreateQuestionnaireSchema, async (data) => {
  const context = await getAgencyContext();

  // Verify formId belongs to agency if provided
  if (data.formId) {
    const [form] = await db.select()
      .from(agencyForms)
      .where(and(
        eq(agencyForms.id, data.formId),
        eq(agencyForms.agencyId, context.agencyId)
      ))
      .limit(1);
    if (!form) throw new Error("Form not found");
  }

  // Create questionnaire with formId
  const [questionnaire] = await db.insert(questionnaireResponses).values({
    slug: nanoid(12),
    agencyId: context.agencyId,
    clientBusinessName: data.clientBusinessName,
    clientEmail: data.clientEmail,
    formId: data.formId || null,
    layoutOverride: data.layoutOverride || null,
    contractId: data.contractId || null,
    // ... rest
  }).returning();

  return questionnaire;
});
```

Add query to get agency's questionnaire forms:

```typescript
export const getQuestionnaireForms = query(async () => {
  const context = await getAgencyContext();

  const forms = await db.select()
    .from(agencyForms)
    .where(and(
      eq(agencyForms.agencyId, context.agencyId),
      eq(agencyForms.formType, "questionnaire"),
      eq(agencyForms.isActive, true)
    ))
    .orderBy(agencyForms.name);

  return forms;
});

export const getDefaultQuestionnaireForm = query(async () => {
  const context = await getAgencyContext();

  const [form] = await db.select()
    .from(agencyForms)
    .where(and(
      eq(agencyForms.agencyId, context.agencyId),
      eq(agencyForms.formType, "questionnaire"),
      eq(agencyForms.isDefault, true)
    ))
    .limit(1);

  return form || null;
});
```

---

## Task 3: Update "New Questionnaire" Page

**File:** `src/routes/(app)/[agencySlug]/questionnaires/new/+page.svelte`

Add form picker and layout selector similar to consultation page:

### UI Flow
```
┌─────────────────────────────────────────────────────────────┐
│ New Questionnaire                                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Client Business Name *     [____________________________]   │
│ Client Email *             [____________________________]   │
│                                                             │
│ ─────────────────────────────────────────────────────────── │
│                                                             │
│ Form Template                                               │
│ ┌─────────────────┐ ┌─────────────────┐                    │
│ │ ○ Website       │ │ ○ Project       │                    │
│ │   Questionnaire │ │   Discovery     │                    │
│ │   8 steps       │ │   6 steps       │                    │
│ └─────────────────┘ └─────────────────┘                    │
│                                                             │
│ Layout Style                                                │
│ [Simple] [Stepper] [Wizard (default)]                      │
│                                                             │
│                              [Cancel] [Create Questionnaire]│
└─────────────────────────────────────────────────────────────┘
```

### Server Load
```typescript
// +page.server.ts
export const load = async () => {
  const forms = await getQuestionnaireForms();
  const defaultForm = await getDefaultQuestionnaireForm();
  const fallbackTemplate = await getFormTemplateBySlug("website-questionnaire");

  return { forms, defaultForm, fallbackTemplate };
};
```

### Component Changes
- Add form picker cards (if multiple forms)
- Add layout toggle (Simple/Stepper/Wizard)
- Pass `formId` and `layoutOverride` to `createQuestionnaire()`
- Show form indicator when single form auto-selected

---

## Task 4: Update Public Form Route (`/q/[slug]`)

**File:** `src/routes/q/[slug]/+page.svelte`

Render via DynamicForm when questionnaire has `formId`, else fallback to legacy QuestionnaireWizard.

### Server Load Changes
```typescript
// +page.server.ts
export const load = async ({ params }) => {
  const result = await getQuestionnaireByOwnSlug(params.slug);
  if (!result) error(404, "Questionnaire not found");

  const { questionnaire, agency, agencyProfile } = result;

  // Load form schema if formId exists
  let formSchema = null;
  let formUiConfig = null;
  if (questionnaire.formId) {
    const form = await getAgencyFormById(questionnaire.formId);
    if (form) {
      formSchema = form.schema;
      formUiConfig = form.uiConfig;
    }
  }

  // Fallback to system template if no form but new questionnaire
  if (!formSchema && !questionnaire.formId) {
    // Legacy questionnaire - will use QuestionnaireWizard
  }

  return { questionnaire, agency, agencyProfile, formSchema, formUiConfig };
};
```

### Component Changes
```svelte
{#if data.formSchema}
  <!-- Dynamic Form -->
  <DynamicForm
    schema={buildFormSchema(data.formSchema, data.formUiConfig)}
    initialData={questionnaire.responses}
    branding={agencyBranding}
    onStepChange={handleStepSave}
    onSubmit={handleSubmit}
    previewMode={questionnaire.status === "completed"}
    readOnly={questionnaire.status === "completed"}
  />
{:else}
  <!-- Legacy hardcoded form -->
  <QuestionnaireWizard
    questionnaire={data.questionnaire}
    agencyLogoUrl={data.agency?.logoUrl}
    onComplete={handleComplete}
    readOnly={data.questionnaire.status === "completed"}
  />
{/if}
```

### Layout Override
Apply `layoutOverride` from questionnaire:
```typescript
let effectiveSchema = $derived.by(() => {
  if (!data.formSchema) return null;
  const schema = buildFormSchema(data.formSchema, data.formUiConfig);

  // Apply layout override if set
  if (data.questionnaire.layoutOverride) {
    return {
      ...schema,
      uiConfig: {
        ...schema.uiConfig,
        layout: data.questionnaire.layoutOverride
      }
    };
  }
  return schema;
});
```

---

## Task 5: Update Questionnaire Progress Saving

**File:** `src/lib/api/questionnaire.remote.ts`

Modify `saveQuestionnaireProgress` to work with dynamic form data:

```typescript
const SaveProgressSchema = v.object({
  questionnaireId: v.pipe(v.string(), v.uuid()),
  responses: v.record(v.string(), v.any()),
  currentStep: v.pipe(v.number(), v.minValue(0)), // Renamed from currentSection
});

export const saveQuestionnaireProgress = command(SaveProgressSchema, async (data) => {
  const [existing] = await db.select()
    .from(questionnaireResponses)
    .where(eq(questionnaireResponses.id, data.questionnaireId))
    .limit(1);

  if (!existing) throw new Error("Questionnaire not found");
  if (existing.status === "completed") throw new Error("Already completed");

  // Merge responses
  const mergedResponses = {
    ...(existing.responses as Record<string, unknown>),
    ...data.responses
  };

  // Calculate completion (simplified - count non-empty fields)
  const filledFields = Object.values(mergedResponses).filter(v =>
    v !== undefined && v !== null && v !== ""
  ).length;

  // For dynamic forms, we estimate based on filled fields
  // If formId exists, we could calculate based on form's required fields
  const completionPercentage = existing.formId
    ? await calculateDynamicFormCompletion(existing.formId, mergedResponses)
    : calculateLegacyCompletion(mergedResponses);

  const [updated] = await db.update(questionnaireResponses)
    .set({
      responses: mergedResponses,
      currentSection: data.currentStep,
      completionPercentage,
      status: completionPercentage > 0 ? "in_progress" : "not_started",
      startedAt: existing.startedAt || new Date(),
      lastActivityAt: new Date(),
      updatedAt: new Date()
    })
    .where(eq(questionnaireResponses.id, data.questionnaireId))
    .returning();

  return updated;
});
```

---

## Task 6: Update View Responses Page

**File:** `src/routes/(app)/[agencySlug]/questionnaires/[id]/+page.svelte`

Render completed questionnaire using DynamicForm in read-only mode:

```svelte
{#if formSchema}
  <DynamicForm
    schema={buildFormSchema(formSchema, formUiConfig)}
    initialData={questionnaire.responses}
    readOnly={true}
    branding={agencyBranding}
  />
{:else}
  <!-- Legacy view with hardcoded display -->
  <QuestionnaireResponseView questionnaire={questionnaire} />
{/if}
```

---

## Task 7: Update Preview Page

**File:** `src/routes/(app)/[agencySlug]/questionnaires/preview/+page.svelte`

Add layout toggle similar to form preview:

```svelte
<script>
  let layoutOverride = $state<"wizard" | "stepper" | "single-column">("wizard");
</script>

<div class="flex gap-2 mb-4">
  <button class:btn-active={layoutOverride === "wizard"} onclick={() => layoutOverride = "wizard"}>
    Wizard
  </button>
  <button class:btn-active={layoutOverride === "stepper"} onclick={() => layoutOverride = "stepper"}>
    Stepper
  </button>
  <button class:btn-active={layoutOverride === "single-column"} onclick={() => layoutOverride = "single-column"}>
    Simple
  </button>
</div>

<DynamicForm
  schema={enhancedSchema}
  previewMode={true}
  branding={agencyBranding}
/>
```

---

## Task 8: Agency Onboarding — Auto-seed Default Questionnaire Form

**File:** `src/lib/api/agency.remote.ts`

When agency is created, also seed "Website Questionnaire" form:

```typescript
// In createAgency(), after Full Discovery seeding:

// Auto-seed Website Questionnaire form from template
const [questionnaireTemplate] = await db.select()
  .from(formTemplates)
  .where(eq(formTemplates.slug, "website-questionnaire"))
  .limit(1);

if (questionnaireTemplate) {
  await db.insert(agencyForms).values({
    agencyId: agency.id,
    name: questionnaireTemplate.name,
    slug: "website-questionnaire",
    description: questionnaireTemplate.description,
    formType: "questionnaire",
    schema: questionnaireTemplate.schema,
    uiConfig: questionnaireTemplate.uiConfig,
    isActive: true,
    isDefault: true,
    sourceTemplateId: questionnaireTemplate.id,
    createdBy: userId
  });

  // Increment usage count
  await db.update(formTemplates)
    .set({ usageCount: sql`${formTemplates.usageCount} + 1` })
    .where(eq(formTemplates.id, questionnaireTemplate.id));
}
```

---

## Task 9: Cleanup (After Verification)

**Only after Tasks 1-8 verified working:**

### Files to delete:
- [ ] `src/lib/components/questionnaire/Section1Personal.svelte`
- [ ] `src/lib/components/questionnaire/Section2Company.svelte`
- [ ] `src/lib/components/questionnaire/Section3Display.svelte`
- [ ] `src/lib/components/questionnaire/Section4Domain.svelte`
- [ ] `src/lib/components/questionnaire/Section5Business.svelte`
- [ ] `src/lib/components/questionnaire/Section6Content.svelte`
- [ ] `src/lib/components/questionnaire/Section7Design.svelte`
- [ ] `src/lib/components/questionnaire/Section8Final.svelte`

### Files to keep (still needed for legacy fallback):
- `QuestionnaireWizard.svelte` — for questionnaires without `formId`
- `QuestionnaireSidebar.svelte` — used by QuestionnaireWizard
- `QuestionnaireNav.svelte` — used by QuestionnaireWizard

### Optional cleanup (future):
- After all legacy questionnaires migrated, remove QuestionnaireWizard entirely

---

## Implementation Order

```
Task 1: Database Migration ─────────────────────────────┐
    │                                                   │
Task 2: Update questionnaire.remote.ts                  │ Foundation
    │                                                   │
Task 8: Agency Onboarding Auto-seed ───────────────────┘
    │
    ▼
Task 3: Update "New Questionnaire" Page ───────────────┐
    │                                                   │
Task 4: Update Public Form Route (/q/[slug])           │ Core UI
    │                                                   │
Task 5: Update Progress Saving                         │
    │                                                   │
Task 6: Update View Responses Page ────────────────────┘
    │
Task 7: Update Preview Page
    │
    ▼
Task 9: Cleanup (after verification)
```

---

## Success Criteria

- [ ] New questionnaire creation shows form picker (if multiple forms)
- [ ] Layout toggle (Simple/Stepper/Wizard) works on creation
- [ ] Public form (`/q/[slug]`) renders DynamicForm for new questionnaires
- [ ] Legacy questionnaires (no formId) still work with QuestionnaireWizard
- [ ] Progress saving works with DynamicForm
- [ ] View responses page renders correctly
- [ ] Preview page has layout toggle
- [ ] New agencies auto-receive "Website Questionnaire" as default
- [ ] Existing questionnaire data preserved
- [ ] All questionnaire linking (contract/proposal/consultation) preserved

---

## Backward Compatibility

| Scenario | Behavior |
|----------|----------|
| Existing questionnaire, no `formId` | Use QuestionnaireWizard (legacy) |
| New questionnaire, agency has forms | Use selected form + DynamicForm |
| New questionnaire, no agency forms | Use system template + DynamicForm |
| Questionnaire linked to contract | Preserved, works same as before |

---

## Unresolved Questions

1. **Completion calculation for dynamic forms**: How to calculate % when form structure varies? Options:
   - Count filled required fields vs total required
   - Count all non-empty fields vs total fields
   - Use step progress (current step / total steps)

2. **Migration of existing questionnaires**: Should we backfill `formId` for existing questionnaires that match the "Website Questionnaire" template?
