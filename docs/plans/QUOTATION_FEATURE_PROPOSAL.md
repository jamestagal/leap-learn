# Feature Proposal: Quotations for Webkit (v2)

## Overview

Add a **Quotation** document type to Webkit, modelled on the Stop Leak / Re-seal Bathrooms format. A quotation is a multi-page document:

- **Page 1+** — Business header, client details, site address, dates, and one or more **scope sections** (e.g., "Main", "Full Shower Retile") each containing a list of work items with optional per-section pricing
- **Final Page** — Pricing summary (section totals, quotation subtotal ex GST, GST, total inc GST), reusable terms sections (fixed price clause, payment terms, client-supplied materials notes), optional add-on notes, and an acceptance/signature block

Quotations use a **two-tier template system** (matching the contract template pattern):

1. **Quotation Templates** (parent) — bundle together scope section templates + terms templates into reusable quote types (e.g., "Type A: Full Shower Retile", "Type B: Full Renovation", "Type C: Kitchen")
2. **Scope Section Templates** (building blocks) — individual reusable work item lists (e.g., "Full Shower Retile" with 18 items)
3. **Terms Templates** (building blocks) — individual reusable terms blocks (e.g., "Fixed Price Quote", "Payment Terms")

When creating a new quotation, the user picks a Quotation Template and everything pre-populates — all scope sections with their work items, all default terms blocks — ready to customise per client.

---

## Document Format (from Stop Leak / Re-seal PDFs)

### Page 1 Layout

```
┌─────────────────────────────────────────────────┐
│  [Agency Logo + ABN + Address + Contact]        │  ← From agencyProfiles
│                                                 │
│  Client Quotation                               │
│  QUOTE #QUO-2026-0042                           │  ← Auto-numbered
│                                                 │
│  ┌─────────────────────┐                        │
│  │ Quote Name: ...     │  PREPARED DATE         │
│  │ Quote No: ...       │  Feb 15, 2026          │
│  │ Site Address: ...   │                        │
│  │ Phone: ...          │  EXP. DATE             │
│  │ Email: ...          │  Apr 15, 2026          │
│  │ Valid For: 60 Days  │                        │
│  └─────────────────────┘                        │
│                                                 │
│  PREPARED FOR                                   │
│  Customer Name                                  │
│  123 Customer Street                            │
│  Customer City ACT 2601                         │
│                                                 │
│  Re: 9 Morice Place, Bonython                   │  ← Site reference
│                                                 │
│  ┌─────────────────────────────────────────┐    │
│  │ Main                                    │    │  ← Scope section 1
│  ├─────────────────────────────────────────┤    │
│  │ Item                                    │    │
│  │ • Tap service and pressure test         │    │
│  └─────────────────────────────────────────┘    │
│                                                 │
│  ┌─────────────────────────────────────────┐    │
│  │ Main Shower - Full Shower Retile        │    │  ← Scope section 2
│  ├────────────────────┬────────────────────┤    │
│  │ Remove old wall    │ Remove existing    │    │  ← Two-column work items
│  │ tiles in shower    │ shower screen      │    │
│  ├────────────────────┼────────────────────┤    │
│  │ Fill in sunken     │ Re-sheet walls     │    │
│  │ shower             │ with villa board   │    │
│  ├────────────────────┼────────────────────┤    │
│  │ ...                │ ...                │    │
│  └────────────────────┴────────────────────┘    │
│                                                 │
│  Section Total ex GST             $5,850.00     │  ← Per-section pricing
│  GST                                $585.00     │
│  Section Total inc GST            $6,435.00     │
└─────────────────────────────────────────────────┘
```

### Final Page Layout

```
┌─────────────────────────────────────────────────┐
│  ┌───────────────────────────────┬─────────┐    │
│  │ Quotation Sub-Total ex GST   │$5,850.00│    │  ← Grand totals
│  ├───────────────────────────────┼─────────┤    │
│  │                           GST│  $585.00│    │
│  ├───────────────────────────────┼─────────┤    │
│  │ Quotation Total inc GST      │$6,435.00│    │
│  └───────────────────────────────┴─────────┘    │
│                                    $6,435.00    │  ← Bold grand total
│                                                 │
│  Quotation Notes For Client Below:              │  ← Terms block 1
│  Please ensure you have reviewed...             │
│                                                 │
│  FIXED PRICE QUOTE                              │  ← Terms block 2
│  This is a fixed price quote...                 │
│                                                 │
│  Payment Terms                                  │  ← Terms block 3
│  30% deposit... 70% on completion...            │
│                                                 │
│  Options:                                       │  ← Optional add-ons (free text)
│  • Framed pivot screen +$X,XXX                  │
│  • Semi-frameless pivot screen +$X,XXX          │
│                                                 │
│  CLIENT TO SUPPLY TILES OF THEIR CHOICE         │  ← Terms block 4
│  Notes: If you have existing wall tiles...      │
│                                                 │
│  ────────────────────────────────────────────   │
│  AGREED AND ACCEPTED:                           │
│  _____________  _____________  __________        │
│  NAME           TITLE          DATE             │
└─────────────────────────────────────────────────┘
```

---

## Data Model

### Table Hierarchy

```
quotation_templates              ← "Type A: Full Shower Retile" (the recipe)
  ├─ quotation_template_sections ← which scope templates to include, in what order
  │    └─ quotation_scope_templates  ← "Full Shower Retile" work items (reusable block)
  └─ quotation_template_terms    ← which terms to include, in what order
       └─ quotation_terms_templates  ← "Fixed Price Quote" content (reusable block)

quotations                       ← actual document sent to client (frozen snapshot)
  └─ quotation_scope_sections    ← work items copied from templates, editable per client
```

### New Tables (7 total)

#### 1. `quotations`

The main quotation document. Follows the same patterns as `invoices`, `proposals`, and `contracts`.

```typescript
export const quotations = pgTable("quotations", {
    id: uuid("id").primaryKey().defaultRandom(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),

    agencyId: uuid("agency_id").notNull()
        .references(() => agencies.id, { onDelete: "cascade" }),

    // Unified client link
    clientId: uuid("client_id")
        .references(() => clients.id, { onDelete: "set null" }),

    // Source template (if created from a template)
    templateId: uuid("template_id")
        .references(() => quotationTemplates.id, { onDelete: "set null" }),

    // Document identification
    quotationNumber: varchar("quotation_number", { length: 50 }).notNull(),
    slug: varchar("slug", { length: 100 }).notNull().unique(), // nanoid(12)
    quotationName: text("quotation_name").notNull().default(""), // Internal ref name

    // Status workflow: draft → sent → viewed → accepted → declined
    // "expired" is calculated dynamically (sent/viewed + past expiryDate)
    status: varchar("status", { length: 50 }).notNull().default("draft"),

    // Client info (snapshot at creation)
    clientBusinessName: text("client_business_name").notNull().default(""),
    clientContactName: text("client_contact_name").notNull().default(""),
    clientEmail: varchar("client_email", { length: 255 }).notNull().default(""),
    clientPhone: varchar("client_phone", { length: 50 }).notNull().default(""),
    clientAddress: text("client_address").notNull().default(""),

    // Site / job details (trades: work site differs from client address)
    siteAddress: text("site_address").notNull().default(""),
    siteReference: text("site_reference").notNull().default(""), // "Re: 9 Morice Place, Bonython"

    // Dates
    preparedDate: timestamp("prepared_date", { withTimezone: true }).notNull(),
    expiryDate: timestamp("expiry_date", { withTimezone: true }).notNull(),

    // Pricing (grand totals across all scope sections)
    subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
    discountAmount: decimal("discount_amount", { precision: 10, scale: 2 }).notNull().default("0.00"),
    discountDescription: text("discount_description").notNull().default(""),
    gstAmount: decimal("gst_amount", { precision: 10, scale: 2 }).notNull().default("0.00"),
    total: decimal("total", { precision: 10, scale: 2 }).notNull(),

    // GST snapshot from agency profile
    gstRegistered: boolean("gst_registered").notNull().default(true),
    gstRate: decimal("gst_rate", { precision: 5, scale: 2 }).notNull().default("10.00"),

    // Terms sections (frozen snapshot: array of { title, content } objects)
    termsBlocks: jsonb("terms_blocks").notNull().default([]),

    // Optional add-ons / upgrades (free text for MVP)
    // e.g., "Framed pivot screen +$1,299 / Semi-frameless pivot screen +$2,187"
    optionsNotes: text("options_notes").notNull().default(""),

    // Notes (internal, not shown on document)
    notes: text("notes").notNull().default(""),

    // Tracking
    viewCount: integer("view_count").notNull().default(0),
    lastViewedAt: timestamp("last_viewed_at", { withTimezone: true }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    declinedAt: timestamp("declined_at", { withTimezone: true }),
    declineReason: text("decline_reason").notNull().default(""),

    // Client acceptance fields
    acceptedByName: varchar("accepted_by_name", { length: 255 }),
    acceptedByTitle: varchar("accepted_by_title", { length: 255 }),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    acceptanceIp: varchar("acceptance_ip", { length: 50 }),

    // Creator
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
}, (table) => ({
    agencyIdx: index("quotations_agency_idx").on(table.agencyId),
    clientIdx: index("quotations_client_idx").on(table.clientId),
    statusIdx: index("quotations_status_idx").on(table.status),
    slugIdx: index("quotations_slug_idx").on(table.slug),
    uniqueAgencyNumber: unique("quotations_agency_number_unique")
        .on(table.agencyId, table.quotationNumber),
}));
```

**Key changes from v1:** Fixed duplicate `acceptedAt`; added `templateId`, `quotationName`, `siteAddress`, `siteReference`, `discountAmount`, `discountDescription`, `optionsNotes`, `declineReason`; removed `pdfUrl`/`pdfGeneratedAt` (PDFs generated on-demand via Gotenberg); `expired` status calculated dynamically (not stored).

#### 2. `quotation_scope_sections`

Each quotation has one or more scope sections (job types). Each section has a title, a list of work items, and optional per-section pricing.

```typescript
export const quotationScopeSections = pgTable("quotation_scope_sections", {
    id: uuid("id").primaryKey().defaultRandom(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),

    quotationId: uuid("quotation_id").notNull()
        .references(() => quotations.id, { onDelete: "cascade" }),

    // Section identity
    title: text("title").notNull(),  // e.g., "Main Shower - Full Shower Retile"

    // Work items (array of strings displayed in two-column grid)
    // e.g., ["Removing the old wall tiles", "Removing existing shower screen", ...]
    workItems: jsonb("work_items").notNull().default([]),

    // Per-section pricing (from Re-seal PDF: Section Total ex GST $5,850.00)
    sectionPrice: decimal("section_price", { precision: 10, scale: 2 }),
    sectionGst: decimal("section_gst", { precision: 10, scale: 2 }),
    sectionTotal: decimal("section_total", { precision: 10, scale: 2 }),

    // Ordering
    sortOrder: integer("sort_order").notNull().default(0),

    // Source template (if created from a template)
    scopeTemplateId: uuid("scope_template_id")
        .references(() => quotationScopeTemplates.id, { onDelete: "set null" }),
}, (table) => ({
    quotationIdx: index("quotation_scope_sections_quotation_idx").on(table.quotationId),
}));
```

**Key changes from v1:** Renamed `templateId` → `scopeTemplateId` for clarity; added `sectionGst` and `sectionTotal` to match Re-seal PDF per-section pricing pattern (Section Total ex GST / GST / Section Total inc GST).

#### 3. `quotation_scope_templates`

Reusable building blocks for scope sections. The user builds these once (e.g., "Full Shower Retile") and selects them when creating quotation templates or individual quotations.

```typescript
export const quotationScopeTemplates = pgTable("quotation_scope_templates", {
    id: uuid("id").primaryKey().defaultRandom(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),

    agencyId: uuid("agency_id").notNull()
        .references(() => agencies.id, { onDelete: "cascade" }),

    // Template identity
    name: varchar("name", { length: 255 }).notNull(),       // "Full Shower Retile"
    slug: varchar("slug", { length: 100 }).notNull(),
    description: text("description").notNull().default(""),  // Optional internal note
    category: varchar("category", { length: 100 }),          // "Shower", "Kitchen", "Vanity"

    // Default work items for this job type
    workItems: jsonb("work_items").notNull().default([]),

    // Default section price (optional, pre-fills when added to quotation)
    defaultPrice: decimal("default_price", { precision: 10, scale: 2 }),

    // Display
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),

    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
}, (table) => ({
    agencyIdx: index("quotation_scope_templates_agency_idx").on(table.agencyId),
    uniqueAgencySlug: unique().on(table.agencyId, table.slug),
}));
```

**Key changes from v1:** Added `defaultPrice` so scope templates can carry a default price.

#### 4. `quotation_terms_templates`

Reusable terms blocks. Each has a title and rich-text content.

```typescript
export const quotationTermsTemplates = pgTable("quotation_terms_templates", {
    id: uuid("id").primaryKey().defaultRandom(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),

    agencyId: uuid("agency_id").notNull()
        .references(() => agencies.id, { onDelete: "cascade" }),

    // Template identity
    title: varchar("title", { length: 255 }).notNull(),      // "FIXED PRICE QUOTE"
    content: text("content").notNull(),                       // Rich text body

    // When true, automatically included on all new quotations
    isDefault: boolean("is_default").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),

    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
}, (table) => ({
    agencyIdx: index("quotation_terms_templates_agency_idx").on(table.agencyId),
}));
```

*Unchanged from v1.*

#### 5. `quotation_templates` (NEW — parent template)

Bundles scope section templates + terms templates into reusable quote types. Matches the `contractTemplates` pattern.

```typescript
export const quotationTemplates = pgTable("quotation_templates", {
    id: uuid("id").primaryKey().defaultRandom(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),

    agencyId: uuid("agency_id").notNull()
        .references(() => agencies.id, { onDelete: "cascade" }),

    // Template identity
    name: varchar("name", { length: 255 }).notNull(),       // "Type A: Full Shower Retile"
    description: text("description").notNull().default(""),  // Internal notes
    category: varchar("category", { length: 100 }),          // "Shower", "Kitchen", "General"

    // Default validity period override (null = use agency default)
    defaultValidityDays: integer("default_validity_days"),

    // Status
    isDefault: boolean("is_default").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),

    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
}, (table) => ({
    agencyIdx: index("quotation_templates_agency_idx").on(table.agencyId),
    activeIdx: index("quotation_templates_active_idx").on(table.agencyId, table.isActive),
}));
```

#### 6. `quotation_template_sections` (NEW — junction: template → scope templates)

Links a quotation template to its scope section templates with ordering and optional default pricing.

```typescript
export const quotationTemplateSections = pgTable("quotation_template_sections", {
    id: uuid("id").primaryKey().defaultRandom(),

    templateId: uuid("template_id").notNull()
        .references(() => quotationTemplates.id, { onDelete: "cascade" }),
    scopeTemplateId: uuid("scope_template_id").notNull()
        .references(() => quotationScopeTemplates.id, { onDelete: "cascade" }),

    // Optional default price override for this scope in this template
    // (overrides the scope template's defaultPrice when not null)
    defaultSectionPrice: decimal("default_section_price", { precision: 10, scale: 2 }),

    sortOrder: integer("sort_order").notNull().default(0),
}, (table) => ({
    templateIdx: index("quotation_template_sections_template_idx").on(table.templateId),
    uniqueTemplateScope: unique().on(table.templateId, table.scopeTemplateId),
}));
```

#### 7. `quotation_template_terms` (NEW — junction: template → terms templates)

Links a quotation template to its default terms blocks with ordering.

```typescript
export const quotationTemplateTerms = pgTable("quotation_template_terms", {
    id: uuid("id").primaryKey().defaultRandom(),

    templateId: uuid("template_id").notNull()
        .references(() => quotationTemplates.id, { onDelete: "cascade" }),
    termsTemplateId: uuid("terms_template_id").notNull()
        .references(() => quotationTermsTemplates.id, { onDelete: "cascade" }),

    sortOrder: integer("sort_order").notNull().default(0),
}, (table) => ({
    templateIdx: index("quotation_template_terms_template_idx").on(table.templateId),
    uniqueTemplateTerms: unique().on(table.templateId, table.termsTemplateId),
}));
```

### Schema Additions to Existing Tables

#### `agencyProfiles` (add columns)

```typescript
// Add to existing agencyProfiles table:
quotationPrefix: varchar("quotation_prefix", { length: 20 }).notNull().default("QUO"),
nextQuotationNumber: integer("next_quotation_number").notNull().default(1),
defaultQuotationValidityDays: integer("default_quotation_validity_days").notNull().default(60),
```

#### `invoices` (add FK)

```typescript
// Add to existing invoices table for quotation → invoice conversion:
quotationId: uuid("quotation_id").references(() => quotations.id, { onDelete: "set null" }),
```

#### `emailLogs` (add FK)

```typescript
// Add to existing emailLogs table for quotation email tracking:
quotationId: uuid("quotation_id").references(() => quotations.id, { onDelete: "set null" }),
```

### Type Exports

```typescript
// Main document types
export type Quotation = typeof quotations.$inferSelect;
export type QuotationInsert = typeof quotations.$inferInsert;
export type QuotationScopeSection = typeof quotationScopeSections.$inferSelect;
export type QuotationScopeSectionInsert = typeof quotationScopeSections.$inferInsert;

// Building block template types
export type QuotationScopeTemplate = typeof quotationScopeTemplates.$inferSelect;
export type QuotationScopeTemplateInsert = typeof quotationScopeTemplates.$inferInsert;
export type QuotationTermsTemplate = typeof quotationTermsTemplates.$inferSelect;
export type QuotationTermsTemplateInsert = typeof quotationTermsTemplates.$inferInsert;

// Parent template types
export type QuotationTemplate = typeof quotationTemplates.$inferSelect;
export type QuotationTemplateInsert = typeof quotationTemplates.$inferInsert;
export type QuotationTemplateSection = typeof quotationTemplateSections.$inferSelect;
export type QuotationTemplateTerm = typeof quotationTemplateTerms.$inferSelect;

// Status type (note: "expired" is calculated dynamically, not stored)
export type QuotationStatus = "draft" | "sent" | "viewed" | "accepted" | "declined";

// JSONB types
export interface TermsBlock {
    title: string;
    content: string;
}
```

---

## Routes & Pages

All routes follow the existing `[agencySlug]` pattern.

### Internal (Authenticated) Routes

| Route | Purpose |
|-------|---------|
| `/(app)/[agencySlug]/quotations/` | List all quotations with status filters |
| `/(app)/[agencySlug]/quotations/new` | Create new quotation (template picker → builder) |
| `/(app)/[agencySlug]/quotations/[quotationId]` | View/edit quotation detail |
| `/(app)/[agencySlug]/settings/quotations/` | Overview: quotation templates, scope templates, terms templates |
| `/(app)/[agencySlug]/settings/quotations/templates/` | Quotation template CRUD (parent templates) |
| `/(app)/[agencySlug]/settings/quotations/templates/[templateId]` | Edit template: manage linked scope sections + terms |
| `/(app)/[agencySlug]/settings/quotations/scopes/` | Scope template CRUD (building blocks) |
| `/(app)/[agencySlug]/settings/quotations/terms/` | Terms template CRUD (building blocks) |

### Public Routes

| Route | Purpose |
|-------|---------|
| `/q/[slug]` | Public quotation view (client sees and accepts) |

---

## API Layer

### `quotations.remote.ts`

Following the existing `invoices.remote.ts` pattern using `query()` / `command()` from `$app/server` with Valibot validation.

#### Queries

```
getQuotations(filters?)       → List quotations for agency (with dynamic "expired" status)
getQuotation(quotationId)     → Single quotation with scope sections
getQuotationBySlug(slug)      → Public view (no auth, increments viewCount)
getQuotationStats()           → Dashboard counts by status
```

#### Commands

```
createQuotation(data)         → Create quotation from template (or scratch) with scope sections
updateQuotation(data)         → Update draft quotation
deleteQuotation(quotationId)  → Delete draft quotation
duplicateQuotation(id)        → Copy quotation (new number, new slug, back to draft)
sendQuotation(quotationId)    → Mark as sent + send email via sendEmail()
acceptQuotation(slug, data)   → Client accepts (name, title, date, IP) — public endpoint
declineQuotation(slug, data)  → Client declines (optional reason) — public endpoint
convertToInvoice(quotationId) → Create invoice from accepted quotation (links via quotationId FK)
```

**Dynamic expiry:** `getQuotations()` and `getQuotation()` calculate `expired` status dynamically for quotations with status `sent` or `viewed` where `expiryDate < now()`. Same pattern as invoices calculate `overdue`.

### `quotation-templates.remote.ts`

Separate file for template management (matching `contract-templates.remote.ts` pattern).

#### Queries

```
getQuotationTemplates(filters?)    → List parent templates for agency
getQuotationTemplate(templateId)   → Single template with linked scope sections + terms
getDefaultQuotationTemplate()      → Get default template for new quotations
getScopeTemplates(filters?)        → List scope building blocks for agency
getTermsTemplates(filters?)        → List terms building blocks for agency
```

#### Commands

```
// Parent templates
createQuotationTemplate(data)      → New parent template
updateQuotationTemplate(data)      → Edit parent template
deleteQuotationTemplate(id)        → Soft delete (isActive = false)
duplicateQuotationTemplate(id)     → Copy template with all linked sections + terms
setDefaultQuotationTemplate(id)    → Set as default (unsets others)

// Template section/terms linking
addSectionToTemplate(data)         → Link scope template to parent template
removeSectionFromTemplate(data)    → Unlink scope template from parent template
reorderTemplateSections(data)      → Reorder linked scope sections
addTermsToTemplate(data)           → Link terms template to parent template
removeTermsFromTemplate(data)      → Unlink terms template from parent template
reorderTemplateTerms(data)         → Reorder linked terms blocks

// Scope building blocks
createScopeTemplate(data)          → New scope template
updateScopeTemplate(data)          → Edit scope template
deleteScopeTemplate(id)            → Soft delete scope template

// Terms building blocks
createTermsTemplate(data)          → New terms template
updateTermsTemplate(data)          → Edit terms template
deleteTermsTemplate(id)            → Soft delete terms template
```

---

## UI Components

### Quotation Builder (`/quotations/new` and `/quotations/[id]`)

The builder is a single-page form with four sections:

**1. Template Selection (new quotation only)**
- Dropdown or card picker: "Select Quote Type" with saved templates
- "Start from Scratch" option (no pre-population)
- When template selected: all scope sections + terms blocks pre-populate
- Auto-selects default template if one exists

**2. Client & Site Details**
- Client selector (search existing clients or enter new — uses `getOrCreateClient()`)
- Quotation name (internal reference, e.g., "Morice Place shower")
- Site address (text field — work location, separate from client address)
- Site reference (auto-generated or editable, e.g., "Re: 9 Morice Place, Bonython")
- Prepared date (defaults to today)
- Expiry date (defaults to today + template's `defaultValidityDays` or agency default)

**3. Scope Sections**
- Pre-populated from template selection (or empty if "from scratch")
- Button: "+ Add Scope Section"
- Opens a modal to either:
  - **Pick from templates** — select a saved scope template, work items pre-fill
  - **Create custom** — enter title + work items manually
- Each scope section is a card showing:
  - Title (editable)
  - Work items as editable list (add/remove/reorder)
  - Per-section pricing: Section Total ex GST, GST (auto-calc), Section Total inc GST
- Sections are drag-reorderable (using existing `svelte-dnd-action`)

**4. Pricing, Terms & Options**
- Per-section pricing: visible per scope section card (above)
- Grand total: auto-summed from section prices
- Discount: optional amount + description
- GST calculated automatically from agency profile
- Terms blocks: pre-populated from template, toggle on/off, reorder, edit inline
- Options notes: free text field for optional add-ons/upgrades (e.g., shower screen options)

### Public View (`/q/[slug]`)

Matches the PDF layout:
- Branded header (logo, ABN, address, contact from agencyProfiles)
- Quote number, client details, site reference, dates
- Scope sections with work items in two-column grid
- Per-section pricing (Section Total ex GST / GST / Section Total inc GST)
- Grand totals (Quotation Sub-Total ex GST / GST / Quotation Total inc GST)
- Terms blocks
- Options notes (if any)
- Acceptance form: Name, Title, Date (auto-filled), "Accept Quotation" / "Decline" buttons

When accepted: status → `accepted`, records `acceptedByName`, `acceptedByTitle`, `acceptedAt`, `acceptanceIp`, notifies agency by email.

When declined: status → `declined`, records `declinedAt`, `declineReason` (optional), notifies agency.

### Settings: Quotation Templates (`/settings/quotations/templates/`)

Grid of saved quotation templates with:
- Name, category, section count, terms count, default badge
- Actions: Edit, Duplicate, Set as Default, Delete
- "New Template" button

**Edit template page** (`/settings/quotations/templates/[templateId]`):
- Name, description, category
- Default validity days override
- **Scope Sections tab**: pick from existing scope templates, reorder, set default prices
- **Terms tab**: pick from existing terms templates, reorder
- Set as default checkbox
- Follows the `contractTemplates` edit page pattern

### Settings: Scope Templates (`/settings/quotations/scopes/`)

Table listing saved scope templates with:
- Name, category, work item count, default price
- Edit / Delete actions
- "New Scope Template" button opens builder form:
  - Name (e.g., "Full Shower Retile")
  - Category dropdown (e.g., "Shower", "Kitchen", "Vanity", "General")
  - Default price (optional)
  - Work items list (add/remove/reorder text items)

### Settings: Terms Templates (`/settings/quotations/terms/`)

Table listing saved terms templates with:
- Title, preview of content, default toggle
- Edit / Delete actions
- "New Terms Block" button opens:
  - Title (e.g., "FIXED PRICE QUOTE")
  - Content (rich text via existing TipTap editor)
  - Default toggle (auto-include on new quotations when no template selected)

---

## Features Config Update

Add to `$lib/config/features.ts`:

```typescript
import { ClipboardCheck } from "lucide-svelte";

// Add to FeatureKey type:
// | "quotations"

// Add to FEATURES:
quotations: {
    key: "quotations",
    title: "Quotations",
    description: "Create professional quotations with templated scopes, per-section pricing, and client acceptance.",
    icon: ClipboardCheck,
    color: "#f97316",  // Orange
    colorLight: "#f9731615",
},
```

---

## Pipeline Integration

### Quotation → Invoice Conversion

When a quotation is accepted, a "Create Invoice" button appears on the quotation detail page. Clicking it:

1. Creates a new draft invoice with `quotationId` FK linking back to the source quotation
2. Pre-fills client info from the quotation
3. Creates one invoice line item per scope section (using section title as description, section price as amount)
4. Applies discount from quotation (if any)
5. Links to the unified client record via `getOrCreateClient()`
6. Redirects to the invoice editor for final adjustments before sending

### Client Hub Integration

The client detail page (`/[agencySlug]/clients/[clientId]`) already shows linked consultations, proposals, contracts, and invoices. Add a "Quotations" tab showing all quotations linked to that client.

### Sidebar Navigation

Add "Quotations" after "Proposals" following the pipeline order:

```
Dashboard
Clients
New Consultation
My Consultations
Proposals
Quotations    ← New
Contracts
Invoices
Forms
Reports
```

### PDF Generation

Generate quotation PDFs on-demand via the existing Gotenberg pipeline (same as invoices). Create `quotation-pdf.ts` template that renders the multi-page layout matching the Stop Leak / Re-seal format.

---

## Email Integration

Reuse the existing `sendEmail()` service and `emailLogs` table. Add `quotationId` FK to `emailLogs` for tracking.

### Email Types to Add

| Type | Trigger | Template |
|------|---------|----------|
| `quotation_sent` | User sends quotation | "Here's your quotation from {agency}" with public link |
| `quotation_accepted` | Client accepts via public page | Notify agency: "{client} accepted quotation #{number}" |
| `quotation_declined` | Client declines via public page | Notify agency with decline reason |
| `quotation_reminder` | Manual reminder send | "Reminder: Your quotation #{number} expires on {date}" |

**Note:** Expiry notification deferred to post-MVP. Expiry status is calculated dynamically — no cron job needed.

---

## Permissions

Add to the existing permission system, matching the contracts pattern:

```
quotation:create      → owner, admin, member
quotation:view_own    → owner, admin, member
quotation:view_all    → owner, admin
quotation:edit_own    → owner, admin, member
quotation:edit_all    → owner, admin
quotation:send        → owner, admin, member  (members send their own)
quotation:delete_own  → owner, admin, member
quotation:delete_all  → owner, admin
```

---

## Document Numbering

Update `getNextDocumentNumber()` in `$lib/server/document-numbers.ts` to support `"quotation"` type:

- Reads `quotationPrefix` and `nextQuotationNumber` from `agencyProfiles`
- Atomic `UPDATE ... RETURNING` to prevent race conditions
- Format: `QUO-2026-0001` (prefix-year-padded number)

---

## Expiry Handling

Quotation expiry is calculated **dynamically** in queries (same pattern as invoice `overdue`):

```typescript
// In getQuotations() and getQuotation():
// If status is "sent" or "viewed" and expiryDate < now(), treat as expired
const isExpired = (q: Quotation) =>
    ["sent", "viewed"].includes(q.status) && new Date(q.expiryDate) < new Date();
```

This avoids needing a cron job or background process. The stored `status` remains `sent` or `viewed` — the UI displays "Expired" based on the date comparison.

---

## Initial Seed Data for Stop Leak Bathrooms

When setting up the agency, pre-populate these building blocks AND a parent template:

### Scope Templates (building blocks)

**1. Main — Inspection & Assessment**
- Video inspection of shower and assessment of proposed scope of work
- Tap service and pressure test to ensure there are no significant plumbing issues

**2. Full Shower Retile**
- Removing the old wall tiles in the shower
- Removing the existing shower screen
- Lifting the old floor and removing the bed
- Fill in sunken shower
- Re-sheet two shower walls with new villa board
- Prime the walls
- Waterproofing the shower walls
- Applying a new wet seal membrane to the floor and the bottom row of the walls
- Screeding a new 30mm raised bed and re-tiling the floor and bottom row of wall tiles
- Tiling the shower walls with tiles supplied
- Grouting the walls
- Grouting the shower floor
- Applying Re-seal to the wall to floor joints and the vertical grout joints on the first row of wall tiles
- Refitting the existing shower screen if possible
- Replacing the silicone on the shower screen
- Applying a penetrating sealer over the floor of the shower
- Disposal of all rubbish associated with the job
- Finish off any miscellaneous items

**3. Shower Waterproofing Only**
(Subset of above — demo/membrane/screeding items only)

**4. Vanity Replacement**
(To be defined with client)

**5. Full Bathroom Renovation**
(To be defined with client)

### Terms Templates (building blocks, all default: true)

**1. "Quotation Notes For Client Below:"**
> Please ensure that you have thoroughly reviewed your quotation and understand all items before approving the work. Kindly note that this quote has been provided based on the visible conditions and the information available to us at the time of the assessment.

**2. "FIXED PRICE QUOTE"**
> This is a fixed price quote, which means any unforeseen damage, Stop Leak Bathrooms will complete any additional works that need rectifying after demolition is completed to: - Plumbing: Fix or replace leak control flange, shower breach, and piping associated to it in shower recess only - Flooring: Fix or replace tong and grove floor in shower recess only - Stud framing: Fix or replace framing in shower recess only. The only variation to this quoted price would be for additional tiling to retile the two shower recess walls only, if it was to arise. Any unforeseen asbestos, as it needs to be removed by a licensed asbestos removal specialist.

**3. "Payment Terms"**
> On signed acceptance of this quote, our payment schedule is: 30% deposit, please note that we cannot schedule any work until the deposit has been received. 70% final payment, on completion of the job.

**4. "CLIENT TO SUPPLY TILES OF THEIR CHOICE"**
> Notes: If you have existing wall tiles that you are trying to match you need to be mindful of the thickness of your new wall tiles. A thickness variance no greater than 2mm is recommended. Manufacturers also make tiles that can vary in size by several mm's, which can cause grout joints to step out or not align perfectly with existing tiles. This quote does not include the installation of mosaic tiles. Please note that using mosaic tiles has additional costs and restrictions; we suggest keeping to the size guides above; otherwise, please notify us of any changes. Tiles need to be onsite prior to the commencement of work. This quote does not include painting and/or plastering. Any painting or plastering work required will need to be arranged by the owner after the completion of the quoted works. Please let us know before approving the quote if you would like the options included, so they can be added to your quote for approval.

### Parent Templates (using the building blocks above)

**Type A: Full Shower Retile** (default: true)
- Scope sections: "Main — Inspection & Assessment" + "Full Shower Retile"
- Terms: all 4 terms blocks

**Type B: Shower Waterproofing Only**
- Scope sections: "Main — Inspection & Assessment" + "Shower Waterproofing Only"
- Terms: terms 1, 2, 3 (no "Client Supply Tiles")

---

## Implementation Phases

### Phase 1: Schema + Migration (1-2 days)
- Create migration file with 7 new tables (all idempotent)
- Add `quotationPrefix` / `nextQuotationNumber` / `defaultQuotationValidityDays` to `agencyProfiles`
- Add `quotationId` FK to `invoices` table
- Add `quotationId` FK to `emailLogs` table
- Add all 7 tables + types to `schema.ts`
- Update `getNextDocumentNumber()` in `document-numbers.ts` to support `"quotation"`
- Add quotation permissions to `permissions.ts` (matching contract pattern)
- Add `"quotation"` to `DocumentType` and `agencyDocumentBranding`

### Phase 2: Template API + Settings Pages (2-3 days)
- Create `quotation-templates.remote.ts` (all template CRUD operations)
- Quotation Templates settings page (parent templates: list + create/edit with section/terms linking)
- Scope Templates settings page (building blocks: list + create/edit modal)
- Terms Templates settings page (building blocks: list + create/edit modal with TipTap)
- Add to settings sidebar navigation

### Phase 3: Quotation Builder (2-3 days)
- Create `quotations.remote.ts` (CRUD, send, accept, decline, convert-to-invoice)
- List page with status filters, stats cards, and dynamic expiry calculation
- Create/edit page: template picker → client/site details → scope sections → pricing/terms
- Quotation detail/preview page matching PDF layout
- Use `+page.server.ts` load pattern (avoid remount bug — see `.claude/notes/sveltekit-data-loading/`)

### Phase 4: Public View + Acceptance (1-2 days)
- `/q/[slug]` public page with branded document view
- Acceptance form (name, title, date) with status update + IP recording
- Decline flow with optional reason
- View tracking (count + status transition sent → viewed)
- Print/download CSS
- `quotation-pdf.ts` template for on-demand Gotenberg PDF generation

### Phase 5: Integration (1-2 days)
- Convert accepted quotation → invoice (with `quotationId` FK link)
- Client hub: add quotations tab
- Email sending (quotation_sent, quotation_accepted, quotation_declined, quotation_reminder)
- Feature config + sidebar nav entry
- Quotation-specific document branding override
- Seed data migration for Stop Leak Bathrooms

### Total Estimated Effort: ~8-12 days (manual), ~4-6 days (agent-assisted)

---

## Design Decisions Log

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Separate terms tables (not shared with contracts) | Separate | Contract terms are legal (indemnity, liability); quotation terms are operational (payment schedules, materials). Different UX contexts. |
| Per-section pricing | Include from MVP | Re-seal PDF confirms per-section totals are standard for trades. Needed for multi-scope quotations. |
| Expiry handling | Dynamic calculation | Same pattern as invoice `overdue`. No cron job needed. |
| PDF generation | On-demand via Gotenberg | Matches invoice pattern. No need to cache — quotations are viewed infrequently. |
| Optional add-ons | Free text for MVP | Re-seal PDF shows shower screen options. Full structured add-ons (with client selection) deferred to post-MVP. |
| Slug generation | nanoid(12) | Matches invoice and contract slug pattern. |
| Parent template system | Yes (matching contracts) | Agencies need "quote types" (Type A, B, C) that bundle scope sections + terms. Individual building blocks alone require too much manual assembly per quotation. |
| `quotation:send` permission | Available to members | Members send their own quotations. Restricting to owner/admin creates bottleneck. Matches contract pattern. |

---

## Post-MVP Enhancements

- **Structured optional add-ons**: Replace `optionsNotes` with a proper `quotation_options` table where clients can tick which options they want during acceptance
- **Expiry notification emails**: Auto-send email when quotation reaches expiry date
- **Quotation versioning**: Ability to create revised versions (v2, v3) of a quotation
- **Merge fields in terms**: Support `{{client.name}}`, `{{agency.name}}` etc. in terms content (matching contract template merge fields)
- **Batch operations**: Send multiple quotations at once, bulk status updates
- **Analytics**: Conversion rate (sent → accepted), average response time, revenue by template type
