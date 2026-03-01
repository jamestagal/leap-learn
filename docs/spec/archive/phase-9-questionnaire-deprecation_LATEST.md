# Phase 9: Questionnaire System Deprecation

**Goal:** Remove the redundant questionnaire system entirely. All client data collection happens through Forms.

**Status:** Ready for Implementation  
**Estimated Effort:** 1-2 days  
**Risk Level:** Low (no production data)

---

## Background

### Why Deprecate?

The questionnaire system duplicates the forms system:

| Feature | Forms | Questionnaires |
|---------|-------|----------------|
| Send form to client | ✓ | ✓ (duplicate) |
| Public URL | `/f/[slug]` | `/q/[slug]` (duplicate) |
| Progress tracking | ✓ | ✓ (duplicate) |
| DynamicForm rendering | ✓ | ✗ (hardcoded) |
| Template flexibility | ✓ | ✗ (fixed 8 sections) |
| Entity linking | ✓ | ✓ (same fields) |

The only "unique" feature was access gating (contract signed + payment), which:
- Was custom to Plentify's workflow
- Isn't needed as a core feature
- Could be added to Forms later if needed

### Current State

- **Production data:** None (test accounts only)
- **Live `/q/[slug]` links:** None
- **"Website Questionnaire" template:** Already exists in `form_templates` table
- **Forms linking fields:** Already has `contractId`, `proposalId`, `consultationId`

**Conclusion:** Safe to delete without migration.

---

## Pre-Implementation Checklist

Before starting, verify:

- [x] No real agency accounts have questionnaire data
- [x] "Website Questionnaire" template exists (`slug: website-questionnaire`)
- [ ] Template seeds correctly to new agencies via onboarding ← **Needs implementation (Task 2)**
- [x] Forms system has all required linking fields

```sql
-- Verify template exists
SELECT id, name, slug, category FROM form_templates 
WHERE slug = 'website-questionnaire';

-- Check for any real questionnaire data
SELECT agency_id, COUNT(*) FROM questionnaire_responses 
GROUP BY agency_id;
```

---

## Tasks

### Task 1: Verify Website Questionnaire Template
**Effort:** 15 min

Confirm the system template is complete and matches the legacy questionnaire structure.

**Location:** `src/lib/components/form-builder/templates/website-questionnaire.ts`

**Verify:**
- [ ] Template has 8 steps matching legacy sections
- [ ] Field names align with expected questionnaire data
- [ ] Template category is `questionnaire`
- [ ] Template is seeded in migrations

**If missing or incomplete:** Create/update the template before proceeding.

---

### Task 2: Add Website Questionnaire to Agency Onboarding
**Effort:** 30 min

Add seeding of "Website Questionnaire" form to agency creation. Currently only "Full Discovery" is seeded.

**File:** `src/lib/api/agency.remote.ts` (or equivalent onboarding logic)

**Current state:**
- Seeds "Full Discovery" consultation form ✓ (already done)
- Does NOT seed "Website Questionnaire" form ✗ (needs implementation)

```typescript
// Verify this exists in createAgency():
const [questionnaireTemplate] = await db.select()
  .from(formTemplates)
  .where(eq(formTemplates.slug, "website-questionnaire"))
  .limit(1);

if (questionnaireTemplate) {
  await db.insert(agencyForms).values({
    agencyId: agency.id,
    name: questionnaireTemplate.name,
    slug: "website-questionnaire",
    formType: "questionnaire", // Keep type for filtering
    schema: questionnaireTemplate.schema,
    uiConfig: questionnaireTemplate.uiConfig,
    isActive: true,
    isDefault: true, // Default questionnaire form
    sourceTemplateId: questionnaireTemplate.id,
    createdBy: userId
  });
}
```

**Verification:**
- Create test agency
- Check `agency_forms` table has "Website Questionnaire" entry

---

### Task 3: Remove Navigation Item
**Effort:** 15 min

Remove "Questionnaires" from the app navigation.

**File:** `src/lib/components/layout/AppSidebar.svelte` (or equivalent)

**Before:**
```svelte
<NavItem href="/{agencySlug}/clients" icon={Users}>Clients</NavItem>
<NavItem href="/{agencySlug}/consultations" icon={ClipboardList}>Consultations</NavItem>
<NavItem href="/{agencySlug}/proposals" icon={FileText}>Proposals</NavItem>
<NavItem href="/{agencySlug}/contracts" icon={FileSignature}>Contracts</NavItem>
<NavItem href="/{agencySlug}/forms" icon={FormInput}>Forms</NavItem>
<NavItem href="/{agencySlug}/questionnaires" icon={ClipboardCheck}>Questionnaires</NavItem>
```

**After:**
```svelte
<NavItem href="/{agencySlug}/clients" icon={Users}>Clients</NavItem>
<NavItem href="/{agencySlug}/consultations" icon={ClipboardList}>Consultations</NavItem>
<NavItem href="/{agencySlug}/proposals" icon={FileText}>Proposals</NavItem>
<NavItem href="/{agencySlug}/contracts" icon={FileSignature}>Contracts</NavItem>
<NavItem href="/{agencySlug}/forms" icon={FormInput}>Forms</NavItem>
<!-- Questionnaires removed - use Forms instead -->
```

---

### Task 4: Delete Questionnaire Routes
**Effort:** 30 min

Remove all questionnaire-related routes.

**Routes to delete:**
```
src/routes/(app)/[agencySlug]/questionnaires/
├── +page.svelte           # List questionnaires
├── +page.server.ts
├── new/
│   ├── +page.svelte       # Create questionnaire
│   └── +page.server.ts
├── preview/
│   ├── +page.svelte       # Preview questionnaire
│   └── +page.server.ts
└── [id]/
    ├── +page.svelte       # View responses
    └── +page.server.ts

src/routes/q/[slug]/
├── +page.svelte           # Public questionnaire form
└── +page.server.ts
```

**Action:** Delete entire directories:
```bash
rm -rf src/routes/(app)/[agencySlug]/questionnaires
rm -rf src/routes/q
```

---

### Task 5: Delete Questionnaire Components
**Effort:** 30 min

Remove all questionnaire-specific components.

**Components to delete:**
```
src/lib/components/questionnaire/
├── QuestionnaireWizard.svelte
├── QuestionnaireSidebar.svelte
├── QuestionnaireNav.svelte
├── QuestionnaireView.svelte
├── Section1Personal.svelte
├── Section2Company.svelte
├── Section3Display.svelte
├── Section4Domain.svelte
├── Section5Business.svelte
├── Section6Content.svelte
├── Section7Design.svelte
└── Section8Final.svelte
```

**Verification:** All components are ONLY used within questionnaire routes. Safe to delete.

**Action:** Delete entire directory:
```bash
rm -rf src/lib/components/questionnaire
```

---

### Task 6: Delete Questionnaire API Functions
**Effort:** 30 min

Remove questionnaire-related remote functions.

**File:** `src/lib/api/questionnaire.remote.ts`

**Functions to remove:**
- `getQuestionnaires`
- `getQuestionnaire`
- `getQuestionnaireBySlug`
- `createQuestionnaire`
- `updateQuestionnaireProgress`
- `completeQuestionnaire`
- Any other questionnaire-specific functions

**Action:** Delete the entire file:
```bash
rm src/lib/api/questionnaire.remote.ts
```

**Also check and clean:**
- `src/lib/api/index.ts` - Remove questionnaire exports
- Any other files importing from questionnaire.remote.ts

---

### Task 7: Delete Questionnaire Types
**Effort:** 15 min

Remove questionnaire-specific TypeScript types.

**File:** `src/lib/types/questionnaire.ts` (or equivalent)

**Types to remove:**
- `QuestionnaireResponses`
- `QuestionnaireStatus`
- `QuestionnaireSection`
- Any other questionnaire-specific types

**Also update:**
- `src/lib/types/index.ts` - Remove exports

---

### Task 8: Clean Up Database Schema
**Effort:** 30 min

Remove questionnaire table from Drizzle schema.

**File:** `src/lib/server/schema.ts`

**Remove:**
```typescript
// DELETE this entire table definition
export const questionnaireResponses = pgTable("questionnaire_responses", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: varchar("slug", { length: 20 }).notNull().unique(),
  agencyId: uuid("agency_id").notNull().references(() => agencies.id),
  // ... all other columns
});
```

**Create migration to drop table:**

**File:** `migrations/009_drop_questionnaires.sql`
```sql
-- Phase 9: Questionnaire Deprecation
-- Safe to run: no production data exists

-- Drop the questionnaire_responses table
DROP TABLE IF EXISTS questionnaire_responses;

-- Remove any related indexes (should cascade, but be explicit)
DROP INDEX IF EXISTS idx_questionnaire_responses_agency_id;
DROP INDEX IF EXISTS idx_questionnaire_responses_slug;
DROP INDEX IF EXISTS idx_questionnaire_responses_contract_id;
```

**Note:** If you prefer to keep the table dormant for safety, skip this task. The table won't cause issues if left in place.

---

### Task 9: Update Documentation
**Effort:** 15 min

Update any documentation referencing questionnaires.

**Files to check:**
- README.md
- Any onboarding docs
- API documentation
- Internal specs

**Update messaging:**
- "Questionnaires" → "Forms"
- "Website Questionnaire" is now a Form template
- `/q/[slug]` references → `/f/[slug]`

---

### Task 10: Final Verification
**Effort:** 30 min

Complete testing checklist.

**Verify:**
- [ ] App builds without errors (`npm run build`)
- [ ] No TypeScript errors (`npm run check`)
- [ ] No broken imports or references
- [ ] Navigation shows Forms, not Questionnaires
- [ ] New agency gets "Website Questionnaire" in Forms
- [ ] Can create form submission using Website Questionnaire template
- [ ] Public form URL (`/f/[slug]`) works correctly
- [ ] Old `/q/[slug]` routes return 404 (not 500)

---

## Files to Delete Summary

```
# Routes (delete entire directories)
src/routes/(app)/[agencySlug]/questionnaires/
src/routes/q/
src/routes/api/questionnaires/

# Components (delete entire directory)
src/lib/components/questionnaire/

# API
src/lib/api/questionnaire.remote.ts
src/lib/api/questionnaire.types.ts

# Templates
src/lib/templates/questionnaire-pdf.ts
```

**Note:** Forms system already has PDF generation at `/api/forms/[submissionId]/pdf` with `form-submission-pdf.ts` template.

## Files to Modify Summary

```
# Navigation
src/lib/components/layout/AppSidebar.svelte

# Schema (optional - can leave table dormant)
src/lib/server/schema.ts

# Exports/Imports
src/lib/api/index.ts
src/lib/types/index.ts

# Agency onboarding (verify, may not need changes)
src/lib/api/agency.remote.ts
```

---

## Post-Deprecation: User Flow

**Before (confusing):**
```
Agency wants to collect website requirements from client

Option A: Forms → New Form → Pick template → Send
Option B: Questionnaires → New Questionnaire → Send

Which one? 🤔
```

**After (clear):**
```
Agency wants to collect website requirements from client

Forms → New Form → Pick "Website Questionnaire" template → Send ✓
```

---

## Rollback Plan

If issues arise:

1. **Routes:** Restore from git
2. **Components:** Restore from git
3. **Database:** Table still exists (if Task 8 skipped)
4. **Navigation:** Re-add nav item

Recommend: Skip Task 8 (drop table) initially. Leave table dormant for 30 days, then drop if no issues.

---

## Success Criteria

- [ ] "Questionnaires" removed from navigation
- [ ] All questionnaire routes return 404
- [ ] No TypeScript/build errors
- [ ] New agencies receive "Website Questionnaire" as a Form template
- [ ] Existing Forms functionality unchanged
- [ ] Codebase is ~15 files lighter

---

## Appendix: What Stays

The "Website Questionnaire" concept lives on as:

1. **System Template:** `form_templates` row with `slug: website-questionnaire`
2. **Agency Form:** Seeded to each agency's `agency_forms` on creation
3. **Form Submissions:** Client responses stored in `form_submissions`
4. **Public URL:** `/f/[slug]` (standard form URL)

The only thing removed is the *separate system* for managing it.
