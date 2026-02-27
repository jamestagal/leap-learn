# WebKit Invoice Management Module
## Technical Specification v1.0

### Executive Summary

A comprehensive invoice management system integrated into WebKit, enabling agencies to create, manage, send, and track invoices with seamless PDF generation via the shared Gotenberg infrastructure. The module supports both standalone invoices and proposal/contract-linked invoices, recurring billing for subscription clients, and full GST compliance for Australian business requirements.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Database Schema](#2-database-schema)
3. [Remote Functions](#3-remote-functions)
4. [Permissions](#4-permissions)
5. [UI Routes](#5-ui-routes)
6. [UI Components](#6-ui-components)
7. [Gotenberg PDF Integration](#7-gotenberg-pdf-integration)
8. [Invoice Templates](#8-invoice-templates)
9. [Business Logic & Workflows](#9-business-logic--workflows)
10. [Email Integration](#10-email-integration)
11. [Public Invoice View](#11-public-invoice-view)
12. [Implementation Tasks](#12-implementation-tasks)

---

## 1. Architecture Overview

### System Context

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           WebKit Platform                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐  │
│  │   Consultation   │───▶│    Proposals     │───▶│    Contracts     │  │
│  │     Capture      │    │    Generator     │    │    Management    │  │
│  └──────────────────┘    └──────────────────┘    └────────┬─────────┘  │
│                                   │                        │            │
│                                   └────────────┬───────────┘            │
│                                                │                        │
│                                                ▼                        │
│                                    ┌──────────────────┐                 │
│                                    │     Invoices     │                 │
│                                    │   Management     │                 │
│                                    └────────┬─────────┘                 │
│                                             │                           │
│                                             ▼                           │
│                                  ┌──────────────────┐                   │
│                                  │    Gotenberg     │                   │
│                                  │  PDF Generation  │                   │
│                                  └──────────────────┘                   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
┌─────────────────┐
│    Proposal     │ (accepted)
│   or Contract   │ (signed)
└────────┬────────┘
         │ createInvoiceFromProposal() / createInvoiceFromContract()
         ▼
┌─────────────────┐     ┌─────────────────┐
│     Invoice     │────▶│  Agency Profile │
│   (generated)   │     │  (GST, banking) │
└────────┬────────┘     └─────────────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│  Data Pipeline  │────▶│    Gotenberg    │
│  Merge Fields   │     │  PDF Generation │
└────────┬────────┘     └─────────────────┘
         │
         ▼
┌─────────────────┐
│  Public View    │
│  /i/{slug}      │◀──── Email with PDF attached
└────────┬────────┘
         │ recordPayment()
         ▼
┌─────────────────┐
│  Paid Invoice   │
│ (status=paid)   │
└─────────────────┘
```

### Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| PDF Engine | Gotenberg | Already deployed for proposals/contracts, Chromium-based rendering |
| Public URL Pattern | `/i/{slug}` | Consistent with `/p/{slug}` (proposals) and `/c/{slug}` (contracts) |
| GST Handling | Column-level | Explicit GST amount stored, not calculated on-the-fly |
| Recurring Billing | Separate table | Clean separation, flexible scheduling |
| Payment Recording | Manual entry | Phase 1 - integrations (Stripe) can be added later |

---

## 2. Database Schema

### 2.1 Invoices Table

**File**: `service-client/src/lib/server/schema.ts`

```typescript
export const invoices = pgTable('invoices', {
    id: uuid('id').primaryKey().defaultRandom(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),

    agencyId: uuid('agency_id').notNull()
        .references(() => agencies.id, { onDelete: 'cascade' }),

    // Link to source documents (optional)
    proposalId: uuid('proposal_id')
        .references(() => proposals.id, { onDelete: 'set null' }),
    contractId: uuid('contract_id')
        .references(() => contracts.id, { onDelete: 'set null' }),

    // Document identification
    invoiceNumber: varchar('invoice_number', { length: 50 }).notNull(),  // INV-2025-0001
    slug: varchar('slug', { length: 100 }).notNull().unique(),  // Public URL slug

    // Status workflow: draft, sent, viewed, paid, overdue, cancelled, refunded
    status: varchar('status', { length: 50 }).notNull().default('draft'),

    // Client info (snapshot at invoice creation)
    clientBusinessName: text('client_business_name').notNull(),
    clientContactName: text('client_contact_name').notNull().default(''),
    clientEmail: varchar('client_email', { length: 255 }).notNull(),
    clientPhone: varchar('client_phone', { length: 50 }).notNull().default(''),
    clientAddress: text('client_address').notNull().default(''),
    clientAbn: varchar('client_abn', { length: 20 }).notNull().default(''),

    // Dates
    issueDate: timestamp('issue_date', { withTimezone: true }).notNull(),
    dueDate: timestamp('due_date', { withTimezone: true }).notNull(),

    // Financials (all in AUD)
    subtotal: decimal('subtotal', { precision: 10, scale: 2 }).notNull(),
    discountAmount: decimal('discount_amount', { precision: 10, scale: 2 }).notNull().default('0.00'),
    discountDescription: text('discount_description').notNull().default(''),
    gstAmount: decimal('gst_amount', { precision: 10, scale: 2 }).notNull().default('0.00'),
    total: decimal('total', { precision: 10, scale: 2 }).notNull(),

    // GST settings (snapshot from agency profile)
    gstRegistered: boolean('gst_registered').notNull().default(true),
    gstRate: decimal('gst_rate', { precision: 5, scale: 2 }).notNull().default('10.00'),

    // Payment terms
    paymentTerms: varchar('payment_terms', { length: 50 }).notNull().default('NET_14'),
    // NET_7, NET_14, NET_30, NET_60, DUE_ON_RECEIPT, CUSTOM
    paymentTermsCustom: text('payment_terms_custom').notNull().default(''),

    // Payment details (for bank transfer)
    paymentInstructions: text('payment_instructions').notNull().default(''),

    // Notes
    notes: text('notes').notNull().default(''),  // Internal notes
    publicNotes: text('public_notes').notNull().default(''),  // Shown on invoice

    // Tracking
    viewCount: integer('view_count').notNull().default(0),
    lastViewedAt: timestamp('last_viewed_at', { withTimezone: true }),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    paidAt: timestamp('paid_at', { withTimezone: true }),

    // Payment recording
    paymentMethod: varchar('payment_method', { length: 50 }),  // bank_transfer, card, cash, other
    paymentReference: text('payment_reference'),  // Transaction ID, cheque number, etc.
    paymentNotes: text('payment_notes'),

    // PDF storage
    pdfUrl: text('pdf_url'),
    pdfGeneratedAt: timestamp('pdf_generated_at', { withTimezone: true }),

    // Recurring invoice reference
    recurringInvoiceId: uuid('recurring_invoice_id')
        .references(() => recurringInvoices.id, { onDelete: 'set null' }),

    // Creator
    createdBy: uuid('created_by')
        .references(() => users.id, { onDelete: 'set null' })
}, (table) => ({
    agencyIdx: index('invoices_agency_idx').on(table.agencyId),
    statusIdx: index('invoices_status_idx').on(table.status),
    dueDateIdx: index('invoices_due_date_idx').on(table.dueDate),
    slugIdx: index('invoices_slug_idx').on(table.slug),
    invoiceNumberIdx: index('invoices_number_idx').on(table.agencyId, table.invoiceNumber)
}));
```

### 2.2 Invoice Line Items Table

```typescript
export const invoiceLineItems = pgTable('invoice_line_items', {
    id: uuid('id').primaryKey().defaultRandom(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),

    invoiceId: uuid('invoice_id').notNull()
        .references(() => invoices.id, { onDelete: 'cascade' }),

    // Line item details
    description: text('description').notNull(),
    quantity: decimal('quantity', { precision: 10, scale: 2 }).notNull().default('1.00'),
    unitPrice: decimal('unit_price', { precision: 10, scale: 2 }).notNull(),
    amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),  // quantity * unitPrice

    // Tax handling per line item
    isTaxable: boolean('is_taxable').notNull().default(true),

    // Ordering
    sortOrder: integer('sort_order').notNull().default(0),

    // Optional categorization
    category: varchar('category', { length: 50 }),  // setup, development, hosting, addon, other

    // Reference to package/addon if applicable
    packageId: uuid('package_id')
        .references(() => agencyPackages.id, { onDelete: 'set null' }),
    addonId: uuid('addon_id')
        .references(() => agencyAddons.id, { onDelete: 'set null' })
}, (table) => ({
    invoiceIdx: index('invoice_line_items_invoice_idx').on(table.invoiceId)
}));
```

### 2.3 Recurring Invoices Table

```typescript
export const recurringInvoices = pgTable('recurring_invoices', {
    id: uuid('id').primaryKey().defaultRandom(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),

    agencyId: uuid('agency_id').notNull()
        .references(() => agencies.id, { onDelete: 'cascade' }),

    // Link to source (optional)
    contractId: uuid('contract_id')
        .references(() => contracts.id, { onDelete: 'set null' }),

    // Client info
    clientBusinessName: text('client_business_name').notNull(),
    clientContactName: text('client_contact_name').notNull().default(''),
    clientEmail: varchar('client_email', { length: 255 }).notNull(),
    clientAddress: text('client_address').notNull().default(''),

    // Schedule
    frequency: varchar('frequency', { length: 20 }).notNull(),  // monthly, quarterly, yearly
    dayOfMonth: integer('day_of_month').notNull().default(1),  // 1-28 (safe for all months)
    startDate: timestamp('start_date', { withTimezone: true }).notNull(),
    endDate: timestamp('end_date', { withTimezone: true }),  // NULL = indefinite
    nextInvoiceDate: timestamp('next_invoice_date', { withTimezone: true }).notNull(),

    // Template data (JSONB for line items template)
    lineItemsTemplate: jsonb('line_items_template').notNull().default([]),
    // [{ description, quantity, unitPrice, isTaxable, category }]

    // Financials
    subtotal: decimal('subtotal', { precision: 10, scale: 2 }).notNull(),
    gstAmount: decimal('gst_amount', { precision: 10, scale: 2 }).notNull().default('0.00'),
    total: decimal('total', { precision: 10, scale: 2 }).notNull(),

    // Settings
    paymentTerms: varchar('payment_terms', { length: 50 }).notNull().default('NET_14'),
    autoSend: boolean('auto_send').notNull().default(false),  // Automatically send on generation
    notes: text('notes').notNull().default(''),

    // Status
    isActive: boolean('is_active').notNull().default(true),
    lastGeneratedAt: timestamp('last_generated_at', { withTimezone: true }),
    invoicesGenerated: integer('invoices_generated').notNull().default(0),

    // Creator
    createdBy: uuid('created_by')
        .references(() => users.id, { onDelete: 'set null' })
}, (table) => ({
    agencyIdx: index('recurring_invoices_agency_idx').on(table.agencyId),
    nextDateIdx: index('recurring_invoices_next_date_idx').on(table.nextInvoiceDate),
    activeIdx: index('recurring_invoices_active_idx').on(table.isActive)
}));
```

### 2.4 Type Definitions

```typescript
export type Invoice = typeof invoices.$inferSelect;
export type InvoiceInsert = typeof invoices.$inferInsert;

export type InvoiceLineItem = typeof invoiceLineItems.$inferSelect;
export type InvoiceLineItemInsert = typeof invoiceLineItems.$inferInsert;

export type RecurringInvoice = typeof recurringInvoices.$inferSelect;
export type RecurringInvoiceInsert = typeof recurringInvoices.$inferInsert;

export type InvoiceStatus = 'draft' | 'sent' | 'viewed' | 'paid' | 'overdue' | 'cancelled' | 'refunded';
export type PaymentTerms = 'NET_7' | 'NET_14' | 'NET_30' | 'NET_60' | 'DUE_ON_RECEIPT' | 'CUSTOM';
export type PaymentMethod = 'bank_transfer' | 'card' | 'cash' | 'other';
export type RecurringFrequency = 'monthly' | 'quarterly' | 'yearly';
export type LineItemCategory = 'setup' | 'development' | 'hosting' | 'addon' | 'other';
```

---

## 3. Remote Functions

### 3.1 Invoice Remote Functions

**New file**: `service-client/src/lib/api/invoices.remote.ts`

| Function | Type | Description |
|----------|------|-------------|
| `getInvoices(filters?)` | query | List invoices with optional status/date filters |
| `getInvoice(id)` | query | Get single invoice with line items |
| `getInvoiceBySlug(slug)` | query | Get by public slug (for public view) |
| `createInvoice(data)` | command | Create standalone invoice |
| `createInvoiceFromProposal(proposalId)` | command | Generate from accepted proposal |
| `createInvoiceFromContract(contractId)` | command | Generate from signed contract |
| `updateInvoice(data)` | command | Update invoice fields |
| `deleteInvoice(id)` | command | Delete invoice (draft only) |
| `duplicateInvoice(id)` | command | Create copy of existing invoice |
| `sendInvoice(id)` | command | Mark as sent, send email with PDF |
| `recordPayment(id, paymentData)` | command | Record payment received |
| `recordProposalView(slug)` | command | Increment view count (public) |
| `cancelInvoice(id, reason?)` | command | Mark as cancelled |
| `refundInvoice(id, reason?)` | command | Mark as refunded |
| `regeneratePdf(id)` | command | Regenerate PDF via Gotenberg |
| `getInvoiceStats(dateRange?)` | query | Dashboard statistics |

### 3.2 Line Items Remote Functions

| Function | Type | Description |
|----------|------|-------------|
| `addLineItem(invoiceId, data)` | command | Add line item |
| `updateLineItem(id, data)` | command | Update line item |
| `deleteLineItem(id)` | command | Remove line item |
| `reorderLineItems(invoiceId, itemIds)` | command | Reorder items |
| `recalculateInvoiceTotals(invoiceId)` | command | Recalculate subtotal/GST/total |

### 3.3 Recurring Invoice Remote Functions

| Function | Type | Description |
|----------|------|-------------|
| `getRecurringInvoices()` | query | List recurring invoice schedules |
| `getRecurringInvoice(id)` | query | Get single with generated history |
| `createRecurringInvoice(data)` | command | Create recurring schedule |
| `updateRecurringInvoice(data)` | command | Update schedule |
| `pauseRecurringInvoice(id)` | command | Pause generation |
| `resumeRecurringInvoice(id)` | command | Resume generation |
| `deleteRecurringInvoice(id)` | command | Delete schedule |
| `generateNextInvoice(id)` | command | Manually trigger next invoice |

### 3.4 Create Invoice From Proposal Flow

```typescript
async function createInvoiceFromProposal(proposalId: string): Promise<Invoice> {
    const context = await getAgencyContext();
    const profile = await getAgencyProfile(context.agencyId);

    // 1. Load proposal with package/addons
    const proposal = await getProposalWithRelations(proposalId);

    if (proposal.status !== 'accepted') {
        throw new Error('Can only create invoice from accepted proposal');
    }

    // 2. Generate invoice number
    const invoiceNumber = generateDocumentNumber(
        profile.invoicePrefix || 'INV',
        profile.nextInvoiceNumber || 1
    );

    // 3. Calculate dates
    const issueDate = new Date();
    const dueDate = calculateDueDate(issueDate, profile.defaultPaymentTerms);

    // 4. Build line items from proposal
    const lineItems: InvoiceLineItemInsert[] = [];
    const pkg = await getPackage(proposal.selectedPackageId);

    if (pkg) {
        // Setup fee
        if (parseFloat(pkg.setupFee) > 0) {
            lineItems.push({
                description: `${pkg.name} - Setup & Development`,
                quantity: '1.00',
                unitPrice: pkg.setupFee,
                amount: pkg.setupFee,
                category: 'setup',
                packageId: pkg.id,
                isTaxable: true,
                sortOrder: 0
            });
        }

        // One-time price (for lump sum)
        if (pkg.pricingModel === 'lump_sum' && parseFloat(pkg.oneTimePrice) > 0) {
            lineItems.push({
                description: `${pkg.name} - Website Development`,
                quantity: '1.00',
                unitPrice: pkg.oneTimePrice,
                amount: pkg.oneTimePrice,
                category: 'development',
                packageId: pkg.id,
                isTaxable: true,
                sortOrder: 1
            });
        }

        // First month (for subscription) - separate invoice usually
        // This creates setup invoice; recurring handles monthly
    }

    // Add-ons
    const addons = await getAddons(proposal.selectedAddons);
    for (const addon of addons) {
        if (addon.pricingType === 'one_time') {
            lineItems.push({
                description: addon.name,
                quantity: '1.00',
                unitPrice: addon.price,
                amount: addon.price,
                category: 'addon',
                addonId: addon.id,
                isTaxable: true,
                sortOrder: lineItems.length
            });
        }
    }

    // 5. Calculate totals
    const subtotal = lineItems.reduce((sum, item) => sum + parseFloat(item.amount), 0);
    const taxableAmount = lineItems
        .filter(item => item.isTaxable)
        .reduce((sum, item) => sum + parseFloat(item.amount), 0);
    const gstAmount = profile.gstRegistered
        ? taxableAmount * (parseFloat(profile.gstRate) / 100)
        : 0;
    const total = subtotal + gstAmount;

    // 6. Create invoice
    const [invoice] = await db.insert(invoices).values({
        agencyId: context.agencyId,
        proposalId,
        invoiceNumber,
        slug: generateUniqueSlug(),
        status: 'draft',
        clientBusinessName: proposal.clientBusinessName,
        clientContactName: proposal.clientContactName,
        clientEmail: proposal.clientEmail,
        clientPhone: proposal.clientPhone || '',
        issueDate,
        dueDate,
        subtotal: subtotal.toFixed(2),
        gstAmount: gstAmount.toFixed(2),
        total: total.toFixed(2),
        gstRegistered: profile.gstRegistered,
        gstRate: profile.gstRate,
        paymentTerms: profile.defaultPaymentTerms,
        paymentInstructions: buildPaymentInstructions(profile),
        createdBy: context.userId
    }).returning();

    // 7. Create line items
    for (const item of lineItems) {
        await db.insert(invoiceLineItems).values({
            invoiceId: invoice.id,
            ...item
        });
    }

    // 8. Increment invoice number
    await updateAgencyProfile(context.agencyId, {
        nextInvoiceNumber: (profile.nextInvoiceNumber || 1) + 1
    });

    // 9. Log activity
    await logActivity({
        agencyId: context.agencyId,
        userId: context.userId,
        action: 'invoice.created',
        entityType: 'invoice',
        entityId: invoice.id,
        newValues: { invoiceNumber, proposalId }
    });

    return invoice;
}
```

---

## 4. Permissions

**File**: `service-client/src/lib/server/permissions.ts`

```typescript
// Add to PERMISSIONS object:

// Invoices
'invoice:view_own': ['owner', 'admin', 'member'],
'invoice:view_all': ['owner', 'admin'],
'invoice:create': ['owner', 'admin', 'member'],
'invoice:edit_own': ['owner', 'admin', 'member'],
'invoice:edit_all': ['owner', 'admin'],
'invoice:send': ['owner', 'admin', 'member'],
'invoice:record_payment': ['owner', 'admin'],
'invoice:delete': ['owner', 'admin'],
'invoice:cancel': ['owner', 'admin'],
'invoice:refund': ['owner'],

// Recurring Invoices
'recurring_invoice:view': ['owner', 'admin'],
'recurring_invoice:create': ['owner', 'admin'],
'recurring_invoice:edit': ['owner', 'admin'],
'recurring_invoice:delete': ['owner'],
```

---

## 5. UI Routes

### 5.1 Internal Routes (Agency Dashboard)

```
service-client/src/routes/(app)/[agencySlug]/invoices/
├── +page.svelte                    # Invoice list/dashboard
├── +page.server.ts                 # Load invoices with stats
├── new/+page.svelte                # Create invoice (standalone or from proposal)
├── new/+page.server.ts
├── [invoiceId]/
│   ├── +page.svelte                # View/edit invoice
│   ├── +page.server.ts
│   └── preview/+page.svelte        # Preview as client sees it
├── recurring/
│   ├── +page.svelte                # Recurring invoice list
│   ├── +page.server.ts
│   ├── new/+page.svelte            # Create recurring schedule
│   └── [recurringId]/+page.svelte  # Edit recurring schedule
```

### 5.2 Public Route

```
service-client/src/routes/i/
├── [slug]/
│   ├── +page.svelte                # Public invoice view
│   └── +page.server.ts             # Load by slug, record view
```

---

## 6. UI Components

### 6.1 Invoice Management

```
service-client/src/lib/components/invoices/
├── InvoiceList.svelte              # List with status filters
├── InvoiceCard.svelte              # Card for list view
├── InvoiceStatusBadge.svelte       # Status indicator
├── InvoiceEditor.svelte            # Main invoice editor
├── InvoiceHeader.svelte            # Invoice number, dates, client
├── LineItemsEditor.svelte          # Add/edit/remove line items
├── LineItemRow.svelte              # Single line item row
├── InvoiceTotals.svelte            # Subtotal, discount, GST, total
├── PaymentTermsSelect.svelte       # Payment terms dropdown
├── RecordPaymentModal.svelte       # Mark as paid modal
├── InvoiceActions.svelte           # Send, download, duplicate buttons
├── InvoiceStats.svelte             # Dashboard statistics cards
```

### 6.2 Public View

```
├── public/
│   ├── InvoicePublicView.svelte    # Full public invoice render
│   ├── PublicInvoiceHeader.svelte  # Agency branding, invoice details
│   ├── PublicLineItems.svelte      # Line items table
│   ├── PublicTotals.svelte         # Totals with GST breakdown
│   ├── PublicPaymentInfo.svelte    # Bank details, payment instructions
│   └── InvoicePaidBanner.svelte    # "PAID" overlay when applicable
```

### 6.3 Recurring Invoices

```
├── recurring/
│   ├── RecurringList.svelte        # List of recurring schedules
│   ├── RecurringEditor.svelte      # Create/edit recurring invoice
│   ├── FrequencySelect.svelte      # Monthly/quarterly/yearly
│   └── RecurringHistory.svelte     # Generated invoices list
```

---

## 7. Gotenberg PDF Integration

### 7.1 Go Service Endpoint

**File**: `app/service-core/handlers/pdf.go`

```go
package handlers

import (
    "bytes"
    "context"
    "html/template"
    "net/http"
    "time"

    "github.com/starwalkn/gotenberg-go-client/v8"
    "github.com/starwalkn/gotenberg-go-client/v8/document"
)

type InvoicePDFRequest struct {
    InvoiceID string `json:"invoice_id"`
}

type InvoicePDFData struct {
    Invoice      Invoice          `json:"invoice"`
    LineItems    []InvoiceLineItem `json:"line_items"`
    Agency       Agency           `json:"agency"`
    AgencyProfile AgencyProfile   `json:"agency_profile"`
    LogoBase64   string           `json:"logo_base64"`
    GeneratedAt  time.Time        `json:"generated_at"`
}

func (h *Handler) GenerateInvoicePDF(w http.ResponseWriter, r *http.Request) {
    var req InvoicePDFRequest
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        http.Error(w, "Invalid request", http.StatusBadRequest)
        return
    }

    // Load invoice data
    data, err := h.loadInvoicePDFData(r.Context(), req.InvoiceID)
    if err != nil {
        http.Error(w, err.Error(), http.StatusInternalServerError)
        return
    }

    // Render HTML template
    tmpl, err := template.ParseFiles("templates/invoice.html")
    if err != nil {
        http.Error(w, "Template error", http.StatusInternalServerError)
        return
    }

    var htmlBuf bytes.Buffer
    if err := tmpl.Execute(&htmlBuf, data); err != nil {
        http.Error(w, "Template render error", http.StatusInternalServerError)
        return
    }

    // Generate PDF via Gotenberg
    client, err := gotenberg.NewClient("http://gotenberg:3000", http.DefaultClient)
    if err != nil {
        http.Error(w, "Gotenberg connection error", http.StatusInternalServerError)
        return
    }

    index, err := document.FromString("index.html", htmlBuf.String())
    if err != nil {
        http.Error(w, "Document error", http.StatusInternalServerError)
        return
    }

    req := gotenberg.NewHTMLRequest(index)
    req.PaperSize(gotenberg.A4)
    req.Margins(gotenberg.NoMargins)
    req.PrintBackground(true)
    req.PreferCSSPageSize(true)

    // Add footer with page numbers
    footer, _ := document.FromString("footer.html", `
        <div style="font-size: 9px; color: #666; text-align: center; width: 100%;">
            Page <span class="pageNumber"></span> of <span class="totalPages"></span>
        </div>
    `)
    req.Footer(footer)

    var pdfBuf bytes.Buffer
    if err := client.Store(r.Context(), req, &pdfBuf); err != nil {
        http.Error(w, "PDF generation error", http.StatusInternalServerError)
        return
    }

    // Return PDF
    w.Header().Set("Content-Type", "application/pdf")
    w.Header().Set("Content-Disposition",
        fmt.Sprintf("attachment; filename=%s.pdf", data.Invoice.InvoiceNumber))
    w.Write(pdfBuf.Bytes())
}
```

### 7.2 Docker Compose Configuration

**File**: `docker-compose.yml`

```yaml
services:
  gotenberg:
    image: gotenberg/gotenberg:8
    restart: unless-stopped
    command:
      - "gotenberg"
      - "--api-timeout=60s"
      - "--chromium-restart-after=50"
      - "--log-level=info"
    deploy:
      resources:
        limits:
          memory: 1G
        reservations:
          memory: 512M
    networks:
      - webkit
    labels:
      - "traefik.enable=false"  # Internal only
```

---

## 8. Invoice Templates

### 8.1 HTML Template

**File**: `app/service-core/templates/invoice.html`

```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        @page {
            size: A4;
            margin: 15mm 20mm;
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            font-size: 11px;
            line-height: 1.5;
            color: #1f2937;
        }

        .header {
            display: flex;
            justify-content: space-between;
            margin-bottom: 40px;
        }

        .logo {
            max-height: 60px;
            max-width: 200px;
        }

        .invoice-title {
            text-align: right;
        }

        .invoice-title h1 {
            font-size: 28px;
            font-weight: 700;
            color: {{.Agency.PrimaryColor}};
            margin-bottom: 5px;
        }

        .invoice-number {
            font-size: 14px;
            color: #6b7280;
        }

        .parties {
            display: flex;
            justify-content: space-between;
            margin-bottom: 30px;
        }

        .party {
            width: 48%;
        }

        .party-label {
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #6b7280;
            margin-bottom: 8px;
        }

        .party-name {
            font-size: 14px;
            font-weight: 600;
            margin-bottom: 5px;
        }

        .party-details {
            font-size: 11px;
            color: #4b5563;
        }

        .dates-box {
            background: #f9fafb;
            border-radius: 8px;
            padding: 15px;
            margin-bottom: 30px;
            display: flex;
            justify-content: space-between;
        }

        .date-item {
            text-align: center;
        }

        .date-label {
            font-size: 10px;
            text-transform: uppercase;
            color: #6b7280;
        }

        .date-value {
            font-size: 13px;
            font-weight: 600;
        }

        .line-items {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
        }

        .line-items th {
            background: {{.Agency.PrimaryColor}};
            color: white;
            padding: 12px;
            text-align: left;
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .line-items th:last-child,
        .line-items td:last-child {
            text-align: right;
        }

        .line-items td {
            padding: 12px;
            border-bottom: 1px solid #e5e7eb;
        }

        .line-items tr:last-child td {
            border-bottom: none;
        }

        .totals {
            width: 300px;
            margin-left: auto;
            margin-bottom: 30px;
        }

        .total-row {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid #e5e7eb;
        }

        .total-row.grand-total {
            border-bottom: none;
            border-top: 2px solid {{.Agency.PrimaryColor}};
            font-size: 16px;
            font-weight: 700;
            padding-top: 12px;
        }

        .payment-info {
            background: #f9fafb;
            border-radius: 8px;
            padding: 20px;
            margin-top: 30px;
        }

        .payment-title {
            font-size: 12px;
            font-weight: 600;
            margin-bottom: 10px;
        }

        .bank-details {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 15px;
        }

        .bank-item-label {
            font-size: 10px;
            color: #6b7280;
            text-transform: uppercase;
        }

        .bank-item-value {
            font-size: 12px;
            font-weight: 600;
        }

        .footer-note {
            margin-top: 30px;
            font-size: 10px;
            color: #6b7280;
            text-align: center;
        }

        .paid-stamp {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-30deg);
            font-size: 72px;
            font-weight: 700;
            color: rgba(34, 197, 94, 0.15);
            text-transform: uppercase;
            pointer-events: none;
        }
    </style>
</head>
<body>
    {{if eq .Invoice.Status "paid"}}
    <div class="paid-stamp">PAID</div>
    {{end}}

    <div class="header">
        <div class="logo-section">
            {{if .LogoBase64}}
            <img src="data:image/png;base64,{{.LogoBase64}}" class="logo" alt="{{.Agency.Name}}">
            {{else}}
            <div style="font-size: 24px; font-weight: 700; color: {{.Agency.PrimaryColor}};">
                {{.Agency.Name}}
            </div>
            {{end}}
        </div>
        <div class="invoice-title">
            <h1>TAX INVOICE</h1>
            <div class="invoice-number">{{.Invoice.InvoiceNumber}}</div>
        </div>
    </div>

    <div class="parties">
        <div class="party">
            <div class="party-label">From</div>
            <div class="party-name">{{.AgencyProfile.TradingName}}</div>
            <div class="party-details">
                {{if .AgencyProfile.Abn}}ABN: {{.AgencyProfile.Abn}}<br>{{end}}
                {{.AgencyProfile.AddressLine1}}<br>
                {{if .AgencyProfile.AddressLine2}}{{.AgencyProfile.AddressLine2}}<br>{{end}}
                {{.AgencyProfile.City}} {{.AgencyProfile.State}} {{.AgencyProfile.Postcode}}<br>
                {{.Agency.Email}}<br>
                {{.Agency.Phone}}
            </div>
        </div>
        <div class="party">
            <div class="party-label">Bill To</div>
            <div class="party-name">{{.Invoice.ClientBusinessName}}</div>
            <div class="party-details">
                {{if .Invoice.ClientContactName}}{{.Invoice.ClientContactName}}<br>{{end}}
                {{if .Invoice.ClientAddress}}{{.Invoice.ClientAddress}}<br>{{end}}
                {{.Invoice.ClientEmail}}<br>
                {{if .Invoice.ClientPhone}}{{.Invoice.ClientPhone}}{{end}}
                {{if .Invoice.ClientAbn}}<br>ABN: {{.Invoice.ClientAbn}}{{end}}
            </div>
        </div>
    </div>

    <div class="dates-box">
        <div class="date-item">
            <div class="date-label">Issue Date</div>
            <div class="date-value">{{formatDate .Invoice.IssueDate}}</div>
        </div>
        <div class="date-item">
            <div class="date-label">Due Date</div>
            <div class="date-value">{{formatDate .Invoice.DueDate}}</div>
        </div>
        <div class="date-item">
            <div class="date-label">Amount Due</div>
            <div class="date-value" style="color: {{.Agency.PrimaryColor}};">
                ${{formatCurrency .Invoice.Total}}
            </div>
        </div>
    </div>

    <table class="line-items">
        <thead>
            <tr>
                <th style="width: 50%;">Description</th>
                <th style="width: 15%;">Qty</th>
                <th style="width: 15%;">Unit Price</th>
                <th style="width: 20%;">Amount</th>
            </tr>
        </thead>
        <tbody>
            {{range .LineItems}}
            <tr>
                <td>{{.Description}}</td>
                <td>{{.Quantity}}</td>
                <td>${{formatCurrency .UnitPrice}}</td>
                <td>${{formatCurrency .Amount}}</td>
            </tr>
            {{end}}
        </tbody>
    </table>

    <div class="totals">
        <div class="total-row">
            <span>Subtotal</span>
            <span>${{formatCurrency .Invoice.Subtotal}}</span>
        </div>
        {{if gt (parseFloat .Invoice.DiscountAmount) 0}}
        <div class="total-row">
            <span>Discount {{if .Invoice.DiscountDescription}}({{.Invoice.DiscountDescription}}){{end}}</span>
            <span>-${{formatCurrency .Invoice.DiscountAmount}}</span>
        </div>
        {{end}}
        {{if .Invoice.GstRegistered}}
        <div class="total-row">
            <span>GST ({{.Invoice.GstRate}}%)</span>
            <span>${{formatCurrency .Invoice.GstAmount}}</span>
        </div>
        {{end}}
        <div class="total-row grand-total">
            <span>Total AUD</span>
            <span>${{formatCurrency .Invoice.Total}}</span>
        </div>
    </div>

    <div class="payment-info">
        <div class="payment-title">Payment Details</div>
        <div class="bank-details">
            <div>
                <div class="bank-item-label">Bank</div>
                <div class="bank-item-value">{{.AgencyProfile.BankName}}</div>
            </div>
            <div>
                <div class="bank-item-label">BSB</div>
                <div class="bank-item-value">{{.AgencyProfile.Bsb}}</div>
            </div>
            <div>
                <div class="bank-item-label">Account</div>
                <div class="bank-item-value">{{.AgencyProfile.AccountNumber}}</div>
            </div>
        </div>
        <div style="margin-top: 10px;">
            <div class="bank-item-label">Account Name</div>
            <div class="bank-item-value">{{.AgencyProfile.AccountName}}</div>
        </div>
        <div style="margin-top: 10px; font-size: 11px; color: #4b5563;">
            Please use invoice number <strong>{{.Invoice.InvoiceNumber}}</strong> as payment reference.
        </div>
    </div>

    {{if .Invoice.PublicNotes}}
    <div style="margin-top: 20px; font-size: 11px; color: #4b5563;">
        {{.Invoice.PublicNotes}}
    </div>
    {{end}}

    {{if .AgencyProfile.InvoiceFooter}}
    <div class="footer-note">
        {{.AgencyProfile.InvoiceFooter}}
    </div>
    {{end}}
</body>
</html>
```

---

## 9. Business Logic & Workflows

### 9.1 Invoice Status State Machine

```
                    ┌──────────────────────────────────────────────┐
                    │                                              │
                    ▼                                              │
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐         │
│  DRAFT  │───▶│  SENT   │───▶│ VIEWED  │───▶│  PAID   │         │
└─────────┘    └─────────┘    └────┬────┘    └─────────┘         │
     │              │              │              │               │
     │              │              │              ▼               │
     │              │              │         ┌─────────┐         │
     │              │              │         │REFUNDED │         │
     │              │              │         └─────────┘         │
     │              │              │                              │
     │              ▼              ▼                              │
     │         ┌─────────────────────┐                           │
     └────────▶│     CANCELLED       │◀──────────────────────────┘
               └─────────────────────┘
                        │
                        ▼
               ┌─────────────────────┐
               │      OVERDUE        │ (auto-transition when due_date passes)
               └─────────────────────┘
```

### 9.2 Overdue Detection

**File**: `app/service-core/jobs/invoice_overdue.go`

Run daily via cron to mark overdue invoices:

```go
func MarkOverdueInvoices(ctx context.Context, db *sql.DB) error {
    _, err := db.ExecContext(ctx, `
        UPDATE invoices
        SET status = 'overdue', updated_at = NOW()
        WHERE status IN ('sent', 'viewed')
        AND due_date < NOW()
        AND status != 'overdue'
    `)
    return err
}
```

### 9.3 Payment Terms Calculation

```typescript
function calculateDueDate(issueDate: Date, paymentTerms: PaymentTerms): Date {
    const due = new Date(issueDate);

    switch (paymentTerms) {
        case 'DUE_ON_RECEIPT':
            return due;
        case 'NET_7':
            due.setDate(due.getDate() + 7);
            return due;
        case 'NET_14':
            due.setDate(due.getDate() + 14);
            return due;
        case 'NET_30':
            due.setDate(due.getDate() + 30);
            return due;
        case 'NET_60':
            due.setDate(due.getDate() + 60);
            return due;
        default:
            due.setDate(due.getDate() + 14);  // Default to NET_14
            return due;
    }
}
```

### 9.4 GST Calculation

```typescript
function calculateInvoiceTotals(
    lineItems: InvoiceLineItem[],
    gstRegistered: boolean,
    gstRate: number
): { subtotal: number; gstAmount: number; total: number } {
    const subtotal = lineItems.reduce(
        (sum, item) => sum + parseFloat(item.amount),
        0
    );

    const taxableAmount = lineItems
        .filter(item => item.isTaxable)
        .reduce((sum, item) => sum + parseFloat(item.amount), 0);

    const gstAmount = gstRegistered
        ? taxableAmount * (gstRate / 100)
        : 0;

    const total = subtotal + gstAmount;

    return {
        subtotal: Math.round(subtotal * 100) / 100,
        gstAmount: Math.round(gstAmount * 100) / 100,
        total: Math.round(total * 100) / 100
    };
}
```

### 9.5 Recurring Invoice Generation

**File**: `app/service-core/jobs/recurring_invoices.go`

Run daily to generate scheduled invoices:

```go
func GenerateRecurringInvoices(ctx context.Context, db *sql.DB) error {
    rows, err := db.QueryContext(ctx, `
        SELECT id, agency_id, client_business_name, client_email,
               line_items_template, subtotal, gst_amount, total,
               payment_terms, auto_send
        FROM recurring_invoices
        WHERE is_active = true
        AND next_invoice_date <= NOW()
    `)
    if err != nil {
        return err
    }
    defer rows.Close()

    for rows.Next() {
        var ri RecurringInvoice
        if err := rows.Scan(&ri); err != nil {
            continue
        }

        // Generate invoice
        invoice, err := createInvoiceFromRecurring(ctx, db, ri)
        if err != nil {
            log.Printf("Failed to generate recurring invoice: %v", err)
            continue
        }

        // Update next invoice date
        nextDate := calculateNextInvoiceDate(ri)
        db.ExecContext(ctx, `
            UPDATE recurring_invoices
            SET next_invoice_date = $1,
                last_generated_at = NOW(),
                invoices_generated = invoices_generated + 1
            WHERE id = $2
        `, nextDate, ri.ID)

        // Auto-send if enabled
        if ri.AutoSend {
            sendInvoiceEmail(ctx, invoice)
        }
    }

    return nil
}
```

---

## 10. Email Integration

### 10.1 Invoice Email Template

**File**: `app/service-core/templates/email/invoice.html`

```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: 'Inter', sans-serif; color: #1f2937; }
        .container { max-width: 600px; margin: 0 auto; }
        .header { text-align: center; padding: 30px 0; }
        .logo { max-height: 50px; }
        .content { padding: 30px; background: #f9fafb; border-radius: 12px; }
        .amount-box {
            background: white;
            border-radius: 8px;
            padding: 20px;
            text-align: center;
            margin: 20px 0;
        }
        .amount { font-size: 32px; font-weight: 700; color: {{.PrimaryColor}}; }
        .due-date { color: #6b7280; margin-top: 5px; }
        .btn {
            display: inline-block;
            background: {{.PrimaryColor}};
            color: white;
            padding: 14px 28px;
            border-radius: 8px;
            text-decoration: none;
            font-weight: 600;
        }
        .footer { text-align: center; padding: 30px; color: #6b7280; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            {{if .LogoUrl}}
            <img src="{{.LogoUrl}}" class="logo" alt="{{.AgencyName}}">
            {{else}}
            <h2>{{.AgencyName}}</h2>
            {{end}}
        </div>

        <div class="content">
            <p>Hi {{.ClientContactName}},</p>

            <p>Please find attached invoice <strong>{{.InvoiceNumber}}</strong> for your recent project.</p>

            <div class="amount-box">
                <div class="amount">${{.Total}} AUD</div>
                <div class="due-date">Due by {{.DueDate}}</div>
            </div>

            <p style="text-align: center;">
                <a href="{{.ViewUrl}}" class="btn">View Invoice Online</a>
            </p>

            <p style="margin-top: 30px;">
                <strong>Payment Details:</strong><br>
                Bank: {{.BankName}}<br>
                BSB: {{.Bsb}}<br>
                Account: {{.AccountNumber}}<br>
                Account Name: {{.AccountName}}<br>
                Reference: {{.InvoiceNumber}}
            </p>

            <p>If you have any questions about this invoice, please reply to this email.</p>

            <p>Thank you for your business!</p>

            <p>
                Best regards,<br>
                {{.AgencyName}}
            </p>
        </div>

        <div class="footer">
            {{.AgencyName}} | {{.AgencyEmail}} | {{.AgencyPhone}}<br>
            ABN: {{.Abn}}
        </div>
    </div>
</body>
</html>
```

### 10.2 Send Invoice Function

```go
func SendInvoiceEmail(ctx context.Context, invoiceID string) error {
    // Load invoice data
    invoice, err := getInvoice(ctx, invoiceID)
    if err != nil {
        return err
    }

    agency, profile, err := getAgencyWithProfile(ctx, invoice.AgencyID)
    if err != nil {
        return err
    }

    // Generate PDF
    pdfBytes, err := generateInvoicePDF(ctx, invoice)
    if err != nil {
        return err
    }

    // Prepare email data
    emailData := map[string]interface{}{
        "ClientContactName": invoice.ClientContactName,
        "InvoiceNumber":     invoice.InvoiceNumber,
        "Total":             invoice.Total,
        "DueDate":           invoice.DueDate.Format("2 January 2006"),
        "ViewUrl":           fmt.Sprintf("%s/i/%s", config.PublicURL, invoice.Slug),
        "AgencyName":        agency.Name,
        "AgencyEmail":       agency.Email,
        "AgencyPhone":       agency.Phone,
        "LogoUrl":           agency.LogoUrl,
        "PrimaryColor":      agency.PrimaryColor,
        "Abn":               profile.Abn,
        "BankName":          profile.BankName,
        "Bsb":               profile.Bsb,
        "AccountNumber":     profile.AccountNumber,
        "AccountName":       profile.AccountName,
    }

    // Render email template
    htmlContent, err := renderTemplate("email/invoice.html", emailData)
    if err != nil {
        return err
    }

    // Send email with PDF attachment
    err = mailer.Send(mailer.Email{
        To:      invoice.ClientEmail,
        From:    fmt.Sprintf("%s <%s>", agency.Name, agency.Email),
        Subject: fmt.Sprintf("Invoice %s from %s", invoice.InvoiceNumber, agency.Name),
        HTML:    htmlContent,
        Attachments: []mailer.Attachment{
            {
                Filename: fmt.Sprintf("%s.pdf", invoice.InvoiceNumber),
                Content:  pdfBytes,
                MimeType: "application/pdf",
            },
        },
    })
    if err != nil {
        return err
    }

    // Update invoice status
    _, err = db.Exec(`
        UPDATE invoices
        SET status = 'sent', sent_at = NOW(), updated_at = NOW()
        WHERE id = $1
    `, invoiceID)

    return err
}
```

---

## 11. Public Invoice View

### 11.1 Route Structure

**File**: `service-client/src/routes/i/[slug]/+page.server.ts`

```typescript
import { getInvoiceBySlug, recordInvoiceView } from '$lib/api/invoices.remote';
import { error } from '@sveltejs/kit';

export async function load({ params }) {
    const invoice = await getInvoiceBySlug(params.slug);

    if (!invoice) {
        throw error(404, 'Invoice not found');
    }

    // Check if expired (more than 90 days overdue)
    const dueDate = new Date(invoice.dueDate);
    const ninetyDaysAfterDue = new Date(dueDate);
    ninetyDaysAfterDue.setDate(ninetyDaysAfterDue.getDate() + 90);

    if (new Date() > ninetyDaysAfterDue && invoice.status !== 'paid') {
        throw error(410, 'This invoice has expired');
    }

    // Record view (fire and forget)
    if (invoice.status === 'sent') {
        recordInvoiceView(params.slug).catch(() => {});
    }

    return { invoice };
}
```

### 11.2 Public View Component

**File**: `service-client/src/routes/i/[slug]/+page.svelte`

```svelte
<script lang="ts">
    import InvoicePublicView from '$lib/components/invoices/public/InvoicePublicView.svelte';

    let { data } = $props();
</script>

<svelte:head>
    <title>Invoice {data.invoice.invoiceNumber}</title>
    <meta name="robots" content="noindex, nofollow">
</svelte:head>

<InvoicePublicView invoice={data.invoice} />
```

---

## 12. Implementation Tasks

### Phase 1: Database & Backend (Est. 1 day)
- [ ] Add `invoices` table to schema.ts
- [ ] Add `invoice_line_items` table to schema.ts
- [ ] Add `recurring_invoices` table to schema.ts
- [ ] Add type exports and interfaces
- [ ] Add SQL to schema_postgres.sql
- [ ] Run Atlas migration
- [ ] Add invoice permissions to permissions.ts

### Phase 2: Remote Functions (Est. 1.5 days)
- [ ] Create `invoices.remote.ts` with CRUD operations
- [ ] Implement `createInvoiceFromProposal`
- [ ] Implement `createInvoiceFromContract`
- [ ] Implement line items CRUD
- [ ] Implement totals recalculation
- [ ] Implement `sendInvoice` with email
- [ ] Implement `recordPayment`
- [ ] Add Valibot validation schemas

### Phase 3: PDF Integration (Est. 1 day)
- [ ] Add Gotenberg to docker-compose.yml
- [ ] Create Go PDF endpoint
- [ ] Create invoice HTML template
- [ ] Install Go client library
- [ ] Implement PDF generation flow
- [ ] Add PDF storage/caching

### Phase 4: UI - Invoice List & Dashboard (Est. 0.5 days)
- [ ] Create invoice routes structure
- [ ] Create InvoiceList component
- [ ] Create InvoiceStats component
- [ ] Create status filter tabs
- [ ] Wire up to remote functions

### Phase 5: UI - Invoice Editor (Est. 1.5 days)
- [ ] Create InvoiceEditor component
- [ ] Create LineItemsEditor component
- [ ] Create InvoiceTotals component
- [ ] Create "New from Proposal" flow
- [ ] Implement save/send actions
- [ ] Create RecordPaymentModal

### Phase 6: UI - Public View (Est. 0.5 days)
- [ ] Create public route at /i/[slug]
- [ ] Create InvoicePublicView component
- [ ] Implement view tracking
- [ ] Add download PDF button
- [ ] Style for print

### Phase 7: Email Integration (Est. 0.5 days)
- [ ] Create invoice email template
- [ ] Implement send email with PDF attachment
- [ ] Add payment reminder email template

### Phase 8: Recurring Invoices (Est. 1 day)
- [ ] Create recurring invoice routes
- [ ] Create RecurringEditor component
- [ ] Implement recurring generation job
- [ ] Add recurring invoice list UI

### Phase 9: Testing (Est. 0.5 days)
- [ ] Test invoice CRUD operations
- [ ] Test PDF generation
- [ ] Test email sending
- [ ] Test public view access
- [ ] Test recurring generation
- [ ] Test GST calculations

---

## Key Files to Modify/Create

| File | Changes |
|------|---------|
| [schema.ts](service-client/src/lib/server/schema.ts) | Add 3 tables + types |
| [schema_postgres.sql](app/service-core/storage/schema_postgres.sql) | Add SQL for 3 tables |
| [permissions.ts](service-client/src/lib/server/permissions.ts) | Add 11 invoice permissions |
| NEW: `invoices.remote.ts` | Invoice remote functions |
| NEW: `invoices/` routes | 8+ new route files |
| NEW: `components/invoices/` | ~15 new component files |
| NEW: `i/[slug]/` route | 2 new route files |
| NEW: `templates/invoice.html` | Invoice PDF template |
| NEW: `templates/email/invoice.html` | Invoice email template |
| [docker-compose.yml](docker-compose.yml) | Add Gotenberg service |

---

## Appendix: Merge Fields for Invoices

Available in invoice templates:

### Agency Fields
- `{{agency.business_name}}`, `{{agency.trading_name}}`
- `{{agency.abn}}`, `{{agency.acn}}`
- `{{agency.full_address}}`, `{{agency.email}}`, `{{agency.phone}}`
- `{{agency.logo_url}}`
- `{{agency.bank_name}}`, `{{agency.bsb}}`, `{{agency.account_number}}`, `{{agency.account_name}}`

### Client Fields
- `{{client.business_name}}`, `{{client.contact_person}}`
- `{{client.email}}`, `{{client.phone}}`
- `{{client.address}}`, `{{client.abn}}`

### Invoice Fields
- `{{invoice.number}}` (INV-2025-0001)
- `{{invoice.issue_date}}`, `{{invoice.due_date}}`
- `{{invoice.subtotal}}`, `{{invoice.gst_amount}}`, `{{invoice.total}}`
- `{{invoice.payment_terms}}`, `{{invoice.status}}`

### Computed Fields
- `{{computed.current_date}}`, `{{computed.current_year}}`
- `{{computed.days_until_due}}`, `{{computed.days_overdue}}`
