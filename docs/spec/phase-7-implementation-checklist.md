# Phase 7: Implementation Checklist

## Task 1: Database Migration + Schema

### 1.1 Create Migration File

**File:** `migrations/014_form_templates_admin.sql`

- [ ] Add `new_until TIMESTAMPTZ` to `form_templates`
- [ ] Add `usage_count INTEGER NOT NULL DEFAULT 0` to `form_templates`
- [ ] Add `slug VARCHAR(255)` to `form_templates`
- [ ] Create unique index on `form_templates.slug`
- [ ] Add `source_template_id UUID` to `agency_forms` with FK reference
- [ ] Add `is_customized BOOLEAN NOT NULL DEFAULT false` to `agency_forms`
- [ ] Add `previous_schema JSONB` to `agency_forms`
- [ ] Create index on `agency_forms.source_template_id`

**Success Criteria:**
```bash
# Run migration
pnpm db:migrate

# Verify columns exist
psql -c "\d form_templates" | grep -E "new_until|usage_count|slug"
psql -c "\d agency_forms" | grep -E "source_template_id|is_customized|previous_schema"

# Verify unique constraint
psql -c "\di form_templates_slug_unique"
```

### 1.2 Update Drizzle Schema

**File:** `lib/server/schema.ts`

- [ ] Add `newUntil` to `formTemplates` table definition
- [ ] Add `usageCount` to `formTemplates` table definition
- [ ] Add `slug` to `formTemplates` table definition
- [ ] Add `sourceTemplateId` to `agencyForms` table definition
- [ ] Add `isCustomized` to `agencyForms` table definition
- [ ] Add `previousSchema` to `agencyForms` table definition

**Success Criteria:**
```bash
# Type check passes
pnpm check

# Can query new columns without error
# In a test file or REPL:
# db.query.formTemplates.findFirst() includes newUntil, usageCount, slug
# db.query.agencyForms.findFirst() includes sourceTemplateId, isCustomized, previousSchema
```

---

## Task 2: Super Admin Templates Remote Functions

**File:** `lib/api/super-admin-templates.remote.ts` (new file)

### 2.1 Query Functions

- [ ] `getFormTemplatesAdmin()` - returns all templates ordered by displayOrder
- [ ] `getFormTemplateAdmin(id)` - returns single template by ID
- [ ] `getTemplatePushPreview(templateId)` - returns count of forms that would be updated

**Success Criteria:**
```typescript
// getFormTemplatesAdmin returns array with all expected fields
const templates = await getFormTemplatesAdmin();
assert(templates[0].id);
assert(templates[0].name);
assert(templates[0].usageCount !== undefined);
assert(templates[0].newUntil !== undefined); // can be null

// getFormTemplateAdmin returns single template
const template = await getFormTemplateAdmin('uuid-here');
assert(template.schema);
assert(template.uiConfig);

// getTemplatePushPreview returns count
const preview = await getTemplatePushPreview('uuid-here');
assert(typeof preview.count === 'number');
```

### 2.2 Command Functions

- [ ] `createFormTemplate(data)` - inserts new template with slug validation
- [ ] `updateFormTemplate(data)` - updates template with slug validation
- [ ] `deleteFormTemplate(id)` - deletes template
- [ ] `reorderFormTemplates([{id, displayOrder}])` - batch updates display order
- [ ] `pushTemplateUpdate(templateId)` - pushes schema to unmodified copies
- [ ] `rollbackTemplatePush(templateId)` - restores previous schemas

**Success Criteria:**
```typescript
// createFormTemplate validates slug uniqueness
await createFormTemplate({ name: 'Test', slug: 'test-form', ... });
await expect(createFormTemplate({ name: 'Test 2', slug: 'test-form', ... }))
  .rejects.toThrow('slug already exists');

// pushTemplateUpdate stores previous schema and updates
const result = await pushTemplateUpdate(templateId);
assert(result.updatedCount >= 0);
// Verify agency_forms.previous_schema is populated

// rollbackTemplatePush restores schemas
const rollbackResult = await rollbackTemplatePush(templateId);
assert(rollbackResult.rolledBackCount >= 0);
// Verify agency_forms.schema matches original
```

### 2.3 Authorization

- [ ] All functions call `requireSuperAdmin()` at start
- [ ] Non-super-admin requests return 403

**Success Criteria:**
```typescript
// As regular user, all calls should fail
await expect(getFormTemplatesAdmin()).rejects.toThrow(/unauthorized|forbidden/i);
```

---

## Task 3: Modify forms.remote.ts

**File:** `lib/api/forms.remote.ts`

### 3.1 createFormFromTemplate

- [ ] Add `sourceTemplateId` to insert values
- [ ] Add `isCustomized: false` to insert values
- [ ] Increment `usageCount` on template after successful insert

**Success Criteria:**
```typescript
// Create form from template
const form = await createFormFromTemplate(agencyId, templateId);
assert(form.sourceTemplateId === templateId);
assert(form.isCustomized === false);

// Verify usage count incremented
const template = await getFormTemplateAdmin(templateId);
assert(template.usageCount === previousCount + 1);
```

### 3.2 updateForm

- [ ] When `schema` field is in update data, set `isCustomized: true`
- [ ] Metadata-only updates (name, isActive) do NOT set `isCustomized`

**Success Criteria:**
```typescript
// Metadata update keeps isCustomized false
await updateForm(formId, { name: 'New Name' });
const form1 = await getForm(formId);
assert(form1.isCustomized === false);

// Schema update sets isCustomized true
await updateForm(formId, { schema: newSchema });
const form2 = await getForm(formId);
assert(form2.isCustomized === true);
```

### 3.3 deleteForm

- [ ] If `sourceTemplateId` exists and `isCustomized === false`, decrement `usageCount`
- [ ] Use `GREATEST(usage_count - 1, 0)` to prevent negative counts

**Success Criteria:**
```typescript
// Delete non-customized form decrements count
const beforeCount = template.usageCount;
await deleteForm(formId); // where isCustomized = false
const afterCount = (await getFormTemplateAdmin(templateId)).usageCount;
assert(afterCount === beforeCount - 1);

// Delete customized form does NOT decrement count
// (form was customized, still counts as "used")
```

### 3.4 createSubmissionFromTemplate (if applicable)

- [ ] Add `sourceTemplateId` to implicitly-created agency form
- [ ] Increment `usageCount` on template

---

## Task 4: Super Admin Layout Nav

**File:** `routes/(app)/super-admin/+layout.svelte`

- [ ] Import `FileText` from `lucide-svelte`
- [ ] Add nav item: `{ label: 'Form Templates', url: '/super-admin/form-templates', icon: FileText }`
- [ ] Position appropriately in nav array

**Success Criteria:**
- [ ] Navigate to `/super-admin` as super admin
- [ ] "Form Templates" link visible in sidebar
- [ ] Clicking link navigates to `/super-admin/form-templates`
- [ ] Active state highlights correctly when on form templates pages

---

## Task 5: List Page

**File:** `routes/(app)/super-admin/form-templates/+page.svelte`

### 5.1 Page Structure

- [ ] Page title: "Form Templates"
- [ ] "Create Template" primary button linking to `/super-admin/form-templates/new`
- [ ] Data loaded via `onMount` calling `getFormTemplatesAdmin()`
- [ ] Loading state while fetching
- [ ] Empty state if no templates

### 5.2 Table Columns

- [ ] Display order (#) with up/down buttons
- [ ] Name
- [ ] Slug (monospace styling)
- [ ] Category (badge)
- [ ] Steps count
- [ ] Featured (star toggle)
- [ ] New Badge (shows date or "—")
- [ ] Usage count
- [ ] Actions dropdown

### 5.3 Actions

- [ ] Edit → navigates to `/super-admin/form-templates/[id]`
- [ ] Push Update → shows preview modal → confirms → executes → shows toast
- [ ] Rollback → confirmation modal → executes → shows toast
- [ ] Delete → confirmation with warning if usage > 0 → executes → removes from list

**Success Criteria:**
- [ ] Page loads and displays all templates
- [ ] Reordering updates immediately and persists on refresh
- [ ] Featured toggle updates immediately
- [ ] Push update shows correct preview count
- [ ] Push update success toast shows "Updated X forms"
- [ ] Rollback success toast shows "Rolled back X forms"
- [ ] Delete removes template from list
- [ ] Delete warns about usage count if > 0

---

## Task 6: Create Page

**File:** `routes/(app)/super-admin/form-templates/new/+page.svelte`

### 6.1 Settings Panel

- [ ] Name field (required)
- [ ] Slug field (auto-generates from name, editable)
- [ ] Slug validation shows error if duplicate
- [ ] Description textarea
- [ ] Category select (questionnaire, consultation, feedback, intake, general)
- [ ] Display Order number input
- [ ] Is Featured checkbox
- [ ] New Until date picker with clear button

### 6.2 Builder Integration

- [ ] `Builder` component renders below settings
- [ ] Pass empty `initialSchema` prop
- [ ] `onSave` callback receives schema from Builder

### 6.3 Save Flow

- [ ] Save button triggers validation
- [ ] Slug uniqueness checked before submit
- [ ] `createFormTemplate` called with all data
- [ ] Success toast shown
- [ ] Redirects to list page

**Success Criteria:**
- [ ] Can create template with all fields
- [ ] Slug auto-generates as user types name (debounced)
- [ ] Duplicate slug shows inline error
- [ ] Builder fields are saved correctly
- [ ] New template appears in list after save

---

## Task 7: Edit Page

**File:** `routes/(app)/super-admin/form-templates/[templateId]/+page.svelte`

### 7.1 Data Loading

- [ ] Extract `templateId` from route params
- [ ] Load template via `getFormTemplateAdmin(templateId)`
- [ ] Show loading state
- [ ] Show 404 if template not found

### 7.2 Settings Panel

- [ ] Pre-populated with existing values
- [ ] All fields editable
- [ ] Slug validation excludes current template from uniqueness check

### 7.3 Builder Integration

- [ ] Pass `template.schema` as `initialSchema`
- [ ] Builder shows existing fields

### 7.4 Save Flow

- [ ] `updateFormTemplate` called with changes
- [ ] Success toast shown
- [ ] Stays on edit page (or redirects to list - your preference)

**Success Criteria:**
- [ ] Page loads with existing template data
- [ ] Can modify all fields
- [ ] Slug change validates correctly (allows same slug, blocks others' slugs)
- [ ] Schema changes persist
- [ ] Changes visible immediately after save

---

## Task 8: Agency Forms Page - "New" Badge

**File:** `routes/(app)/[agencySlug]/settings/forms/+page.svelte`

- [ ] Check if `template.newUntil` exists and is in future
- [ ] Display "New" badge (accent, small) after template name
- [ ] Badge only shows for system templates in template picker

**Success Criteria:**
- [ ] Template with future `newUntil` date shows "New" badge
- [ ] Template with past `newUntil` date shows no badge
- [ ] Template with null `newUntil` shows no badge

---

## Task 9: Agency Forms Page - Update Status Indicator

**File:** `routes/(app)/[agencySlug]/settings/forms/+page.svelte`

### 9.1 Import Icons

- [ ] Import `Lock` and `RefreshCw` from `lucide-svelte`

### 9.2 Status Display

- [ ] Check if `form.sourceTemplateId` exists (was created from template)
- [ ] If `isCustomized === false`: Show "Synced" badge (info color) + "Receives system updates"
- [ ] If `isCustomized === true`: Show "Customized" badge (ghost color) + "Updates disabled"
- [ ] Forms without `sourceTemplateId` show no indicator

### 9.3 Optional: Tooltips

- [ ] Synced tooltip: "This form will automatically receive improvements when we update the system template."
- [ ] Customized tooltip: "You've modified this form's structure, so it won't receive automatic updates."

**Success Criteria:**
- [ ] Form created from template shows "Synced" indicator
- [ ] After editing schema, form shows "Customized" indicator
- [ ] Forms not from templates show no indicator
- [ ] Visual distinction clear between synced and customized states

---

## Task 10: Final Verification

### 10.1 Type Check

```bash
pnpm check
```
- [ ] No TypeScript errors

### 10.2 Full Flow Test

1. **Create Template**
   - [ ] Navigate to `/super-admin/form-templates`
   - [ ] Click "Create Template"
   - [ ] Fill in all fields, add fields via Builder
   - [ ] Save → appears in list

2. **Template Features**
   - [ ] Set "New Until" to future date → badge appears
   - [ ] Toggle featured → star updates
   - [ ] Reorder → persists

3. **Agency Adopts Template**
   - [ ] As agency, go to Settings > Forms
   - [ ] Use template → creates agency form
   - [ ] Usage count increments on template
   - [ ] Form shows "Synced" indicator

4. **Push Update**
   - [ ] As super admin, edit template schema
   - [ ] Push update → confirmation shows count
   - [ ] Agency form schema is updated
   - [ ] Form still shows "Synced"

5. **Agency Customizes**
   - [ ] As agency, edit form schema (add/remove field)
   - [ ] Form now shows "Customized" indicator

6. **Push Blocked**
   - [ ] As super admin, push update again
   - [ ] Customized form is NOT updated
   - [ ] Preview count reflects this

7. **Rollback**
   - [ ] As super admin, rollback push
   - [ ] Non-customized forms restored
   - [ ] Verify schema matches pre-push state

8. **Delete Template**
   - [ ] Delete template
   - [ ] Agency forms still exist
   - [ ] `sourceTemplateId` is now NULL
   - [ ] Forms still functional

---

## Quick Reference: Files Changed

| File | Action |
|------|--------|
| `migrations/014_form_templates_admin.sql` | Create |
| `lib/server/schema.ts` | Modify |
| `lib/api/super-admin-templates.remote.ts` | Create |
| `lib/api/forms.remote.ts` | Modify |
| `routes/(app)/super-admin/+layout.svelte` | Modify |
| `routes/(app)/super-admin/form-templates/+page.svelte` | Create |
| `routes/(app)/super-admin/form-templates/new/+page.svelte` | Create |
| `routes/(app)/super-admin/form-templates/[templateId]/+page.svelte` | Create |
| `routes/(app)/[agencySlug]/settings/forms/+page.svelte` | Modify |
