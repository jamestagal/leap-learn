## Phase 7: Super Admin Form Templates Management

**Goal:** Dedicated admin panel for CRUD on system form templates, "New" badge control, display ordering, and push updates to agencies.

### Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Push behavior | Only update unmodified copies | Respects agency customizations |
| What counts as "modified" | Only schema changes | Metadata changes (name, isActive) don't block pushes |
| "New" badge | Admin-set expiry date (`newUntil`) | Full control, auto-expires |
| Remote file | Separate `super-admin-templates.remote.ts` | Keeps files manageable |
| Data loading | Client-side via `onMount` | Matches existing super-admin pattern (beta-invites, freemium) |

---

### 7.1 Database Migration

**File:** `migrations/014_form_templates_admin.sql`

```sql
ALTER TABLE form_templates ADD COLUMN IF NOT EXISTS new_until TIMESTAMPTZ;

ALTER TABLE agency_forms ADD COLUMN IF NOT EXISTS source_template_id UUID REFERENCES form_templates(id) ON DELETE SET NULL;
ALTER TABLE agency_forms ADD COLUMN IF NOT EXISTS is_customized BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS agency_forms_source_template_idx ON agency_forms (source_template_id) WHERE source_template_id IS NOT NULL;
```

**Drizzle schema updates** (`lib/server/schema.ts`):
- `formTemplates`: add `newUntil: timestamp("new_until", { withTimezone: true })`
- `agencyForms`: add `sourceTemplateId: uuid("source_template_id").references(() => formTemplates.id, { onDelete: "set null" })` and `isCustomized: boolean("is_customized").notNull().default(false)`

---

### 7.2 Remote Functions

**New file:** `lib/api/super-admin-templates.remote.ts`

| Function | Type | Purpose |
|----------|------|---------|
| `getFormTemplatesAdmin` | query | All templates + usage count (LEFT JOIN count on agencyForms.sourceTemplateId) |
| `getFormTemplateAdmin(id)` | query | Single template by ID |
| `createFormTemplate(data)` | command | Insert new template |
| `updateFormTemplate(data)` | command | Update template fields |
| `deleteFormTemplate(id)` | command | Delete template (FK cascades to SET NULL) |
| `reorderFormTemplates([{id, displayOrder}])` | command | Batch update display order |
| `getTemplatePushPreview(templateId)` | query | Count of agency forms that would be affected |
| `pushTemplateUpdate(templateId)` | command | Update schema+uiConfig on unmodified copies, return count |

All functions call `requireSuperAdmin()`.

**Modify existing `forms.remote.ts`:**
- `createFormFromTemplate`: add `sourceTemplateId: templateId, isCustomized: false` to insert values
- `updateForm`: when `schema` field is present in update, set `isCustomized: true`
- `createSubmissionFromTemplate`: same — set `sourceTemplateId` on implicitly-created agency form

---

### 7.3 Route Structure

```
routes/(app)/super-admin/form-templates/
  +page.svelte                    -- List all templates
  new/+page.svelte                -- Create template (Builder + settings)
  [templateId]/+page.svelte       -- Edit template (Builder + settings)
```

No `+page.server.ts` needed — data loaded client-side via remote functions (matching super-admin pattern).

---

### 7.4 Layout Nav Update

**File:** `routes/(app)/super-admin/+layout.svelte`

Add to `nav` array:
```typescript
{ label: 'Form Templates', url: '/super-admin/form-templates', icon: FileText }
```

Import `FileText` from `lucide-svelte`.

---

### 7.5 List Page UI (`form-templates/+page.svelte`)

**Header:** "Form Templates" title + "Create Template" primary button

**Table columns:**
| # | Name | Category | Steps | Featured | New Badge | Usage | Actions |
|---|------|----------|-------|----------|-----------|-------|---------|

- **#**: Display order with up/down arrow buttons
- **Name**: Template name
- **Category**: Badge (questionnaire, intake, consultation, etc.)
- **Steps**: `schema.steps.length` count
- **Featured**: Star toggle (calls updateFormTemplate)
- **New Badge**: Shows if `newUntil > now()` with expiry date, else "—"
- **Usage**: Count of agency forms created from this template
- **Actions**: Dropdown with Edit, Push Update, Delete

**Push Update action:**
1. Click "Push Update" → calls `getTemplatePushPreview(id)` to get count
2. Opens confirmation modal: "Push update to {N} agency forms?"
3. Warning: "Only forms that haven't been customized will be updated."
4. Confirm → calls `pushTemplateUpdate(id)` → toast with result count

**Delete action:**
- Confirmation dialog with template name
- Warns if usage count > 0

---

### 7.6 Create/Edit Page UI (`new/+page.svelte` and `[templateId]/+page.svelte`)

**Layout:** Settings panel above, Builder below (full width)

**Settings panel** (card with form inputs):
- Name (text, required)
- Slug (text, auto-gen from name on create, editable)
- Description (textarea)
- Category (select: questionnaire, consultation, feedback, intake, general)
- Display Order (number)
- Is Featured (checkbox)
- New Until (date input, nullable — clear button)

**Builder section:**
- Reuses `Builder` component from `$lib/components/form-builder`
- Pass `initialSchema` prop (empty for create, template.schema for edit)
- Builder `onSave` callback triggers the full save (settings + schema)

**Save flow:**
1. Builder's Save button triggers `onSave(schema)`
2. Callback collects settings form values + schema
3. Calls `createFormTemplate` or `updateFormTemplate`
4. Toast success → navigate back to list

---

### 7.7 "New" Badge on Agency Settings/Forms Page

**File:** `routes/(app)/[agencySlug]/settings/forms/+page.svelte`

In template cards, add badge after template name:
```svelte
{#if template.newUntil && new Date(template.newUntil) > new Date()}
  <span class="badge badge-accent badge-sm">New</span>
{/if}
```

No remote function changes needed — `getFormTemplates` already returns all columns.

---

### 7.8 Push Update Implementation Detail

**`pushTemplateUpdate(templateId)` logic:**
```typescript
1. Get template by ID (error 404 if not found)
2. Update all matching forms:
   UPDATE agency_forms
   SET schema = template.schema,
       ui_config = template.uiConfig,
       version = version + 1,
       updated_at = NOW()
   WHERE source_template_id = templateId
     AND is_customized = false
3. Return { updatedCount: result.rowCount }
```

---

### 7.9 Implementation Order

| # | Task | Files |
|---|------|-------|
| 1 | DB migration + schema.ts | `migrations/014_*.sql`, `schema.ts` |
| 2 | Create `super-admin-templates.remote.ts` | New file |
| 3 | Modify `forms.remote.ts` | sourceTemplateId + isCustomized |
| 4 | Add nav item to layout | `super-admin/+layout.svelte` |
| 5 | List page | `form-templates/+page.svelte` |
| 6 | Create page | `form-templates/new/+page.svelte` |
| 7 | Edit page | `form-templates/[templateId]/+page.svelte` |
| 8 | "New" badge on agency page | `settings/forms/+page.svelte` |
| 9 | Type check | `npm run check` |

---

### 7.10 Critical Files

| File | Action |
|------|--------|
| `lib/server/schema.ts` | Add newUntil, sourceTemplateId, isCustomized |
| `lib/api/super-admin-templates.remote.ts` | Create (all template admin functions) |
| `lib/api/forms.remote.ts` | Modify createFormFromTemplate, updateForm, createSubmissionFromTemplate |
| `routes/(app)/super-admin/+layout.svelte` | Add nav item |
| `routes/(app)/super-admin/form-templates/+page.svelte` | Create (list page) |
| `routes/(app)/super-admin/form-templates/new/+page.svelte` | Create (builder + settings) |
| `routes/(app)/super-admin/form-templates/[templateId]/+page.svelte` | Create (builder + settings) |
| `routes/(app)/[agencySlug]/settings/forms/+page.svelte` | Add "New" badge |
| `migrations/014_form_templates_admin.sql` | Create |

---

### Verification

1. Navigate to `/super-admin/form-templates` — see list of all system templates
2. Click "Create Template" — settings form + Builder loads
3. Fill in settings, add fields via Builder, save → template appears in list
4. Edit template → changes persist
5. Toggle featured → star updates immediately
6. Reorder with up/down arrows → display order changes
7. Set "New Until" date → "New" badge appears on list + agency settings/forms page
8. Agency uses template → usage count increments
9. Push update → confirmation shows correct count → unmodified copies updated
10. Agency edits form schema → isCustomized=true → push no longer affects it
11. Delete template → removed from list, agency forms retain their copies (sourceTemplateId set NULL)
