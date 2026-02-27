# Decision: Questionnaire & Forms Consolidation

**Status:** Under Consideration
**Date:** 2026-01-25
**Author:** Claude (AI Assistant)
**Stakeholder:** Benjamin Waller

---

## Context

The platform currently has two separate systems for collecting client information:

1. **Forms** (`/{agencySlug}/forms`)
   - Generic form submissions using DynamicForm
   - Public URL: `/f/[slug]`
   - Linked to `form_submissions` table
   - Can link to contracts/proposals
   - Template-based (agency forms + system templates)

2. **Questionnaires** (`/{agencySlug}/questionnaires`)
   - Specialized 8-section website questionnaire
   - Public URL: `/q/[slug]`
   - Linked to `questionnaire_responses` table
   - Access gated by: contract signed + first invoice paid
   - Auto-created when client accesses via contract
   - Hardcoded form structure (not using DynamicForm)

### The Problem

- **User confusion**: Two places to "send a form to a client"
- **Duplicated functionality**: Both systems do client selection, form creation, progress tracking, public URLs
- **Maintenance burden**: Questionnaire uses legacy hardcoded components while Forms uses DynamicForm
- **Limited flexibility**: Questionnaires locked to one form structure

### Original Use Case

The questionnaire was built for a specific web agency workflow:
1. Client signs contract
2. Client pays first invoice
3. Questionnaire unlocks automatically
4. Client fills out website requirements
5. Agency reviews responses

This workflow assumes questionnaires are "owed" after contract execution — a specific business process that may not apply to all agencies.

---

## Options

### Option 1: Full Consolidation (Recommended)

**Merge questionnaires into the forms system entirely.**

#### Changes
- Deprecate `/{agencySlug}/questionnaires` routes
- Migrate `questionnaire_responses` data to `form_submissions`
- Keep `/q/[slug]` as legacy redirect to `/f/[slug]`
- Contract-linked forms use existing `contractId` on `form_submissions`
- Access gating becomes optional form setting (not default behavior)

#### Data Migration
```sql
-- Migrate questionnaire_responses to form_submissions
INSERT INTO form_submissions (
  agency_id, client_id, form_id, form_data, status, slug,
  contract_id, created_at, updated_at, completion_percentage
)
SELECT
  agency_id,
  NULL, -- client_id (would need lookup or leave null)
  NULL, -- form_id (legacy data, no form reference)
  responses,
  status,
  slug,
  contract_id,
  created_at,
  updated_at,
  completion_percentage
FROM questionnaire_responses;
```

#### Pros
- Single mental model: "Forms" is where you send things to clients
- Removes navigation confusion
- DynamicForm for all client-facing forms
- Simpler codebase (delete ~15 questionnaire components)
- Template flexibility (agencies choose their questionnaire form)

#### Cons
- Migration complexity for existing data
- Loses the auto-create-on-contract-access behavior
- Contract/payment gating needs reimplementation as form setting
- Breaking change for agencies using questionnaires

#### Effort
- **High**: Data migration, route redirects, feature parity for gating

---

### Option 2: Keep Separate, Use DynamicForm

**Questionnaires remain a distinct entity but render via DynamicForm.**

#### Changes
- Add `formId` to `questionnaire_responses`
- Questionnaire routes stay at `/{agencySlug}/questionnaires`
- Public URL stays at `/q/[slug]`
- Render via DynamicForm instead of QuestionnaireWizard
- Keep contract/payment access gating
- Agencies can choose which form template for questionnaires

#### Pros
- Preserves contract-linked workflow
- No data migration needed
- Incremental change (just swap rendering)
- Keeps specialized access rules

#### Cons
- Two systems still exist — user confusion remains
- Duplicated UI patterns (forms list vs questionnaires list)
- Have to maintain two "create for client" flows
- Questionable value: is the gating logic worth a separate system?

#### Effort
- **Medium**: As outlined in Phase 9 spec

---

### Option 3: Consolidate UI, Keep Data Model (Hybrid)

**Hide questionnaires from users, but keep the data model for contract-linked forms.**

#### Changes
- Remove "Questionnaires" from navigation
- `/q/[slug]` stays for legacy + contract-linked forms
- Contract-linked forms auto-create in `questionnaire_responses` (existing behavior)
- Users manage ALL forms via `/{agencySlug}/forms`
- Forms list shows both `form_submissions` AND `questionnaire_responses`
- "New Form" flow can optionally link to contract (enables gating)

#### User Experience
```
User clicks "New Form"
  → Pick client
  → Pick template (including "Website Questionnaire")
  → Optional: Link to contract (enables payment gating)
  → Creates form_submission OR questionnaire_response based on linking
```

#### Pros
- Single UI for users (no confusion)
- Preserves contract-gating for agencies that want it
- No data migration needed
- Gradual deprecation path

#### Cons
- Two tables still exist (technical debt)
- Complex conditional logic in forms list/creation
- `/q/` and `/f/` URLs for same conceptual thing

#### Effort
- **Medium-High**: UI consolidation without data consolidation

---

### Option 4: Do Nothing (Status Quo)

**Keep both systems as-is.**

#### Pros
- No development effort
- No risk of breaking existing functionality

#### Cons
- User confusion persists
- Questionnaire stuck on legacy components
- Technical debt accumulates
- Two systems to maintain indefinitely

---

## Recommendation

**Option 1 (Full Consolidation)** is the cleanest long-term architecture, but requires significant migration work.

**Option 3 (Hybrid)** is a pragmatic middle ground if we want to reduce user confusion without a large migration. It hides the complexity from users while preserving existing data structures.

### Suggested Path

1. **Short-term (Option 3)**: Hide Questionnaires nav, unify the UI
2. **Medium-term**: Observe usage patterns — do agencies actually use contract-gating?
3. **Long-term (Option 1)**: If gating is rarely used, fully consolidate

---

## Questions to Resolve

1. **How many agencies actively use contract-linked questionnaires?**
   - If very few, Option 1 is clearly better
   - If many, Option 3 preserves their workflow

2. **Is payment-gating a feature we want to offer broadly?**
   - If yes, implement as a form setting (works with Option 1)
   - If no, it's legacy behavior to deprecate

3. **What happens to existing `/q/[slug]` links?**
   - Must remain functional (clients have bookmarked/emailed links)
   - Option 1 needs redirect layer

4. **Do we need the "auto-create questionnaire on contract access" behavior?**
   - This is the key differentiator of questionnaires
   - Could be replicated with "contract has linked form template" setting

---

## Appendix: Current Data Models

### form_submissions
```
id, agency_id, client_id, form_id, slug
form_type, form_name, form_data (JSONB)
status, completion_percentage
contract_id, proposal_id, consultation_id
created_at, updated_at, submitted_at
```

### questionnaire_responses
```
id, agency_id, slug
contract_id, proposal_id, consultation_id
client_business_name, client_email
responses (JSONB)
current_section, completion_percentage, status
started_at, completed_at, last_activity_at
```

### Key Differences
| Aspect | form_submissions | questionnaire_responses |
|--------|------------------|------------------------|
| Client reference | `client_id` (FK) | `client_business_name`, `client_email` (inline) |
| Form reference | `form_id` (FK) | None (hardcoded structure) |
| Progress | `completion_percentage` | `current_section` + `completion_percentage` |
| Access control | None | Contract signed + payment |

---

## Decision

**[To be filled after stakeholder review]**

- [ ] Option 1: Full Consolidation
- [ ] Option 2: Keep Separate, Use DynamicForm
- [ ] Option 3: Consolidate UI, Keep Data Model
- [ ] Option 4: Do Nothing

**Rationale:**

**Next Steps:**
