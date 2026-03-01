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
| Usage count | Denormalized counter | Avoids slow LEFT JOIN on large datasets |
| Rollback strategy | Store previous schema on push | Enables undo if push causes issues |

---

### 7.1 Database Migration

**File:** `migrations/014_form_templates_admin.sql`

```sql
-- System template additions
ALTER TABLE form_templates ADD COLUMN IF NOT EXISTS new_until TIMESTAMPTZ;
ALTER TABLE form_templates ADD COLUMN IF NOT EXISTS usage_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE form_templates ADD COLUMN IF NOT EXISTS slug VARCHAR(255);

-- Ensure slug uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS form_templates_slug_unique ON form_templates (slug) WHERE slug IS NOT NULL;

-- Agency form tracking
ALTER TABLE agency_forms ADD COLUMN IF NOT EXISTS source_template_id UUID REFERENCES form_templates(id) ON DELETE SET NULL;
ALTER TABLE agency_forms ADD COLUMN IF NOT EXISTS is_customized BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE agency_forms ADD COLUMN IF NOT EXISTS previous_schema JSONB;

CREATE INDEX IF NOT EXISTS agency_forms_source_template_idx ON agency_forms (source_template_id) WHERE source_template_id IS NOT NULL;
```

**Drizzle schema updates** (`lib/server/schema.ts`):

```typescript
// formTemplates table additions
newUntil: timestamp("new_until", { withTimezone: true }),
usageCount: integer("usage_count").notNull().default(0),
slug: varchar("slug", { length: 255 }),

// agencyForms table additions  
sourceTemplateId: uuid("source_template_id").references(() => formTemplates.id, { onDelete: "set null" }),
isCustomized: boolean("is_customized").notNull().default(false),
previousSchema: jsonb("previous_schema"),
```

---

### 7.2 Remote Functions

**New file:** `lib/api/super-admin-templates.remote.ts`

| Function | Type | Purpose |
|----------|------|---------|
| `getFormTemplatesAdmin` | query | All templates (usageCount already denormalized) |
| `getFormTemplateAdmin(id)` | query | Single template by ID |
| `createFormTemplate(data)` | command | Insert new template (validate slug uniqueness) |
| `updateFormTemplate(data)` | command | Update template fields (validate slug uniqueness) |
| `deleteFormTemplate(id)` | command | Delete template (FK cascades to SET NULL) |
| `reorderFormTemplates([{id, displayOrder}])` | command | Batch update display order |
| `getTemplatePushPreview(templateId)` | query | Count of agency forms that would be affected |
| `pushTemplateUpdate(templateId)` | command | Update schema+uiConfig on unmodified copies, store rollback, return count |
| `rollbackTemplatePush(templateId)` | command | Restore previous schema on affected agency forms |

All functions call `requireSuperAdmin()`.

**Modify existing `forms.remote.ts`:**
- `createFormFromTemplate`: add `sourceTemplateId: templateId, isCustomized: false` to insert values, **increment `usageCount`** on template
- `updateForm`: when `schema` field is present in update, set `isCustomized: true`
- `createSubmissionFromTemplate`: same — set `sourceTemplateId` on implicitly-created agency form, **increment `usageCount`**
- `deleteForm`: if `sourceTemplateId` exists and `is_customized = false`, **decrement `usageCount`** on template

---

### 7.3 Slug Uniqueness Validation

**In `createFormTemplate` and `updateFormTemplate`:**

```typescript
// Validate slug uniqueness
if (data.slug) {
  const existing = await db.query.formTemplates.findFirst({
    where: and(
      eq(formTemplates.slug, data.slug),
      // Exclude current template on edit
      templateId ? ne(formTemplates.id, templateId) : undefined
    )
  });
  
  if (existing) {
    throw new Error('A template with this slug already exists');
  }
}
```

**Auto-generate slug on create if not provided:**

```typescript
if (!data.slug && data.name) {
  data.slug = generateSlug(data.name); // kebab-case, check uniqueness, append number if needed
}
```

---

### 7.4 Push Update with Rollback Support

**`pushTemplateUpdate(templateId)` logic:**

```typescript
export const pushTemplateUpdate = command$(async (templateId: string) => {
  await requireSuperAdmin();
  
  // 1. Get template
  const template = await db.query.formTemplates.findFirst({
    where: eq(formTemplates.id, templateId)
  });
  if (!template) throw new Error('Template not found');
  
  // 2. Update all matching forms, storing previous schema for rollback
  const result = await db.execute(sql`
    UPDATE agency_forms
    SET 
      previous_schema = schema,
      schema = ${template.schema},
      ui_config = ${template.uiConfig},
      version = version + 1,
      updated_at = NOW()
    WHERE source_template_id = ${templateId}
      AND is_customized = false
    RETURNING id
  `);
  
  return { 
    updatedCount: result.rowCount,
    templateId,
    pushedAt: new Date().toISOString()
  };
});
```

**`rollbackTemplatePush(templateId)` logic:**

```typescript
export const rollbackTemplatePush = command$(async (templateId: string) => {
  await requireSuperAdmin();
  
  // Restore previous schema where available
  const result = await db.execute(sql`
    UPDATE agency_forms
    SET 
      schema = previous_schema,
      previous_schema = NULL,
      version = version + 1,
      updated_at = NOW()
    WHERE source_template_id = ${templateId}
      AND is_customized = false
      AND previous_schema IS NOT NULL
    RETURNING id
  `);
  
  return { rolledBackCount: result.rowCount };
});
```

---

### 7.5 Route Structure

```
routes/(app)/super-admin/form-templates/
  +page.svelte                    -- List all templates
  new/+page.svelte                -- Create template (Builder + settings)
  [templateId]/+page.svelte       -- Edit template (Builder + settings)
```

No `+page.server.ts` needed — data loaded client-side via remote functions (matching super-admin pattern).

---

### 7.6 Layout Nav Update

**File:** `routes/(app)/super-admin/+layout.svelte`

Add to `nav` array:
```typescript
{ label: 'Form Templates', url: '/super-admin/form-templates', icon: FileText }
```

Import `FileText` from `lucide-svelte`.

---

### 7.7 List Page UI (`form-templates/+page.svelte`)

**Header:** "Form Templates" title + "Create Template" primary button

**Table columns:**
| # | Name | Slug | Category | Steps | Featured | New Badge | Usage | Actions |
|---|------|------|----------|-------|----------|-----------|-------|---------|

- **#**: Display order with up/down arrow buttons
- **Name**: Template name
- **Slug**: Template slug (monospace, muted)
- **Category**: Badge (questionnaire, intake, consultation, etc.)
- **Steps**: `schema.steps.length` count
- **Featured**: Star toggle (calls updateFormTemplate)
- **New Badge**: Shows if `newUntil > now()` with expiry date, else "—"
- **Usage**: Denormalized `usageCount` from template record
- **Actions**: Dropdown with Edit, Push Update, Rollback (if applicable), Delete

**Push Update action:**
1. Click "Push Update" → calls `getTemplatePushPreview(id)` to get count
2. Opens confirmation modal: "Push update to {N} agency forms?"
3. Warning: "Only forms that haven't been customized will be updated. Previous schemas will be saved for rollback."
4. Confirm → calls `pushTemplateUpdate(id)` → toast with result count
5. Store `lastPushTemplateId` in component state for rollback option

**Rollback action:**
1. Only shown if a push was recently performed on this template (or could check if any forms have `previous_schema`)
2. Confirmation modal: "Rollback the last push update?"
3. Warning: "This will restore the previous schema for all affected forms."
4. Confirm → calls `rollbackTemplatePush(id)` → toast with result count

**Delete action:**
- Confirmation dialog with template name
- Warns if usage count > 0: "This template is used by {N} agency forms. They will retain their copies but lose the connection to this template."

---

### 7.8 Create/Edit Page UI (`new/+page.svelte` and `[templateId]/+page.svelte`)

**Layout:** Settings panel above, Builder below (full width)

**Settings panel** (card with form inputs):
- Name (text, required)
- Slug (text, auto-gen from name on create, editable, shows validation error if duplicate)
- Description (textarea)
- Category (select: questionnaire, consultation, feedback, intake, general)
- Display Order (number)
- Is Featured (checkbox)
- New Until (date input, nullable — clear button)

**Slug field behavior:**
- On create: auto-generates from name as user types (debounced)
- Manual edit clears auto-generation
- Shows inline error if slug already exists
- Format: lowercase, alphanumeric, hyphens only

**Builder section:**
- Reuses `Builder` component from `$lib/components/form-builder`
- Pass `initialSchema` prop (empty for create, template.schema for edit)
- Builder `onSave` callback triggers the full save (settings + schema)

**Save flow:**
1. Builder's Save button triggers `onSave(schema)`
2. Callback collects settings form values + schema
3. Validates slug uniqueness (client-side check before submit)
4. Calls `createFormTemplate` or `updateFormTemplate`
5. Toast success → navigate back to list

---

### 7.9 "New" Badge on Agency Settings/Forms Page

**File:** `routes/(app)/[agencySlug]/settings/forms/+page.svelte`

In template cards, add badge after template name:
```svelte
{#if template.newUntil && new Date(template.newUntil) > new Date()}
  <span class="badge badge-accent badge-sm">New</span>
{/if}
```

No remote function changes needed — `getFormTemplates` already returns all columns.

---

### 7.10 Agency Form Update Status Indicator

**File:** `routes/(app)/[agencySlug]/settings/forms/+page.svelte`

For agency forms that were created from a template, show update status:

```svelte
{#if form.sourceTemplateId}
  <div class="flex items-center gap-1.5 text-xs">
    {#if form.isCustomized}
      <span class="badge badge-ghost badge-sm gap-1">
        <LockIcon class="w-3 h-3" />
        Customized
      </span>
      <span class="text-base-content/50">Updates disabled</span>
    {:else}
      <span class="badge badge-info badge-sm gap-1">
        <RefreshCwIcon class="w-3 h-3" />
        Synced
      </span>
      <span class="text-base-content/50">Receives system updates</span>
    {/if}
  </div>
{/if}
```

**Import icons:**
```typescript
import { Lock as LockIcon, RefreshCw as RefreshCwIcon } from 'lucide-svelte';
```

**Tooltip enhancement (optional):**
- On "Synced" badge: "This form will automatically receive improvements when we update the system template."
- On "Customized" badge: "You've modified this form's structure, so it won't receive automatic updates."

---

### 7.11 Push Update Implementation Detail

**`pushTemplateUpdate(templateId)` full logic:**
```typescript
1. Get template by ID (error 404 if not found)
2. Update all matching forms, storing rollback:
   UPDATE agency_forms
   SET previous_schema = schema,
       schema = template.schema,
       ui_config = template.uiConfig,
       version = version + 1,
       updated_at = NOW()
   WHERE source_template_id = templateId
     AND is_customized = false
3. Return { updatedCount: result.rowCount, pushedAt: timestamp }
```

---

### 7.12 Usage Count Maintenance

**Increment on form creation from template:**
```typescript
// In createFormFromTemplate
await db.update(formTemplates)
  .set({ usageCount: sql`usage_count + 1` })
  .where(eq(formTemplates.id, templateId));
```

**Decrement on form deletion (only if not customized):**
```typescript
// In deleteForm
if (form.sourceTemplateId && !form.isCustomized) {
  await db.update(formTemplates)
    .set({ usageCount: sql`GREATEST(usage_count - 1, 0)` })
    .where(eq(formTemplates.id, form.sourceTemplateId));
}
```

**Note:** Forms that become customized still count toward usage (they were created from the template). Only deletion reduces the count, and only for non-customized forms to avoid edge cases.

---

### 7.13 Implementation Order

| # | Task | Files |
|---|------|-------|
| 1 | DB migration + schema.ts | `migrations/014_*.sql`, `schema.ts` |
| 2 | Create `super-admin-templates.remote.ts` | New file |
| 3 | Modify `forms.remote.ts` | sourceTemplateId, isCustomized, usageCount maintenance |
| 4 | Add nav item to layout | `super-admin/+layout.svelte` |
| 5 | List page | `form-templates/+page.svelte` |
| 6 | Create page | `form-templates/new/+page.svelte` |
| 7 | Edit page | `form-templates/[templateId]/+page.svelte` |
| 8 | "New" badge on agency page | `settings/forms/+page.svelte` |
| 9 | Update status indicator on agency page | `settings/forms/+page.svelte` |
| 10 | Type check | `npm run check` |

---

### 7.14 Critical Files

| File | Action |
|------|--------|
| `lib/server/schema.ts` | Add newUntil, usageCount, slug, sourceTemplateId, isCustomized, previousSchema |
| `lib/api/super-admin-templates.remote.ts` | Create (all template admin functions + rollback) |
| `lib/api/forms.remote.ts` | Modify createFormFromTemplate, updateForm, deleteForm, createSubmissionFromTemplate |
| `routes/(app)/super-admin/+layout.svelte` | Add nav item |
| `routes/(app)/super-admin/form-templates/+page.svelte` | Create (list page with push/rollback) |
| `routes/(app)/super-admin/form-templates/new/+page.svelte` | Create (builder + settings with slug validation) |
| `routes/(app)/super-admin/form-templates/[templateId]/+page.svelte` | Create (builder + settings with slug validation) |
| `routes/(app)/[agencySlug]/settings/forms/+page.svelte` | Add "New" badge + update status indicator |
| `migrations/014_form_templates_admin.sql` | Create |

---

### Verification

1. Navigate to `/super-admin/form-templates` — see list of all system templates with usage counts
2. Click "Create Template" — settings form + Builder loads
3. Fill in settings, add fields via Builder, save → template appears in list
4. **Slug auto-generates from name, can be manually edited**
5. **Try duplicate slug → see validation error**
6. Edit template → changes persist
7. Toggle featured → star updates immediately
8. Reorder with up/down arrows → display order changes
9. Set "New Until" date → "New" badge appears on list + agency settings/forms page
10. Agency uses template → usage count increments
11. **Agency form shows "Synced - Receives system updates" indicator**
12. Push update → confirmation shows correct count → unmodified copies updated
13. **Rollback available after push → restores previous schemas**
14. Agency edits form schema → isCustomized=true → push no longer affects it
15. **Agency form now shows "Customized - Updates disabled" indicator**
16. Delete template → removed from list, agency forms retain their copies (sourceTemplateId set NULL)
