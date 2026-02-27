# Xero Integration — Feature Scope

**Status:** Draft
**Author:** Benjamin / Claude
**Date:** 2026-02-25

---

## 1. Purpose

Add Xero accounting integration so agencies can sync invoices, contacts, and payments between WebKit and Xero. This eliminates double-entry, keeps accounting records current, and is the #1 expected integration for Australian web agencies (70–80% use Xero).

---

## 2. Goals & Non-Goals

### Goals
- One-click OAuth connection from agency settings
- Push invoices to Xero when sent/approved in WebKit
- Sync WebKit clients as Xero contacts (with ABN, address, phone)
- Record payments in Xero when marked paid in WebKit
- Receive Xero webhooks for payment/invoice changes (bidirectional awareness)
- Respect Xero's new API pricing tiers (launching March 2, 2026)
- GST-correct for Australian BAS reporting

### Non-Goals (for now)
- MYOB integration (Phase 2, via Apideck/Codat — see strategic doc)
- QuickBooks integration
- Bill/expense sync (only sales invoices)
- Chart of accounts management
- Bank reconciliation within WebKit
- Recurring invoice scheduling in Xero
- Pull existing Xero invoices into WebKit (one-way push only for MVP)

---

## 3. Xero API Overview

### Authentication
- OAuth 2.0 authorization code flow with PKCE
- Access tokens expire in **30 minutes**, refresh tokens in **60 days**
- Scopes needed: `offline_access`, `accounting.transactions`, `accounting.contacts`, `accounting.settings`
- Multi-tenant: one OAuth app, each agency connects their own Xero org
- Store `xero_tenant_id`, `access_token`, `refresh_token`, `token_expires_at` per agency

### Rate Limits
- **60 calls/minute** per tenant (per connected Xero org)
- **5,000 calls/day** per tenant (Starter tier: 1,000/day)
- **5 concurrent requests** per tenant
- **10,000 calls/minute** app-wide across all tenants
- Bulk endpoints: up to 50 invoices per POST request

### Webhooks
- Events: `INVOICE.CREATED`, `INVOICE.UPDATED`, `PAYMENT.CREATED`, `CONTACT.UPDATED`
- HMAC-SHA256 signed with `x-xero-signature` header
- Must respond within 5 seconds with HTTP 200
- Requires SSL (HTTPS on port 443)
- Intent-to-receive verification during setup

### API Pricing (from March 2, 2026)

| Tier | Cost (AUD/mo) | Connections | Daily Calls/Tenant |
|------|--------------|-------------|-------------------|
| Starter | $0 | 5 | 1,000 |
| Core | ~$35 | 50 | 5,000 |
| Plus | TBD | 25+ | 5,000 |
| Advanced | $895 | Unlimited | 5,000 |

**Recommendation:** Start on **Starter** (free, 5 connections) during development and early launch. Move to **Core** (~$35/mo) once we exceed 5 connected agencies. At $35/mo for 50 connections, this is $0.70/agency/month — negligible.

**Data egress:** $2.40 AUD/GB over monthly allowance. Invoice sync is lightweight (JSON payloads, ~1-2KB per invoice). Even at 1,000 invoices/month, total egress is under 2MB. Not a cost concern.

---

## 4. Data Mapping

### 4a. Contacts (WebKit Client → Xero Contact)

| WebKit Field | Xero Field | Notes |
|---|---|---|
| `clients.businessName` | `Name` | Required in Xero |
| `clients.email` | `EmailAddress` | |
| `clients.contactName` | `FirstName` + `LastName` | Split on last space |
| `clients.phone` | `Phones[0].PhoneNumber` | PhoneType: `DEFAULT` |
| `invoices.clientAbn` | `TaxNumber` | ABN, max 50 chars |
| `invoices.clientAddress` | `Addresses[0]` | Parse into City/Region/PostalCode/Country |
| — | `ContactID` | Store as `xero_contact_id` on clients table |

**Note:** WebKit stores address as a single text field on invoices, not structured. For Xero, we'll need to parse it or store it in the `AddressLine1` field. Client ABN is on the invoice snapshot, not the clients table — we should consider adding ABN to the clients table.

### 4b. Invoices (WebKit Invoice → Xero Invoice)

| WebKit Field | Xero Field | Notes |
|---|---|---|
| `invoices.invoiceNumber` | `InvoiceNumber` | Unique per Xero org |
| `invoices.clientId` → `xero_contact_id` | `Contact.ContactID` | Must sync contact first |
| `invoices.issueDate` | `Date` | YYYY-MM-DD |
| `invoices.dueDate` | `DueDate` | YYYY-MM-DD |
| `invoices.notes` | `Reference` | Short reference field |
| `invoices.publicNotes` | (not mapped) | Or use Xero's line item descriptions |
| `invoices.status` | `Status` | See status mapping below |
| `invoices.subtotal` | (calculated) | Xero calculates from line items |
| `invoices.gstAmount` | (calculated) | Xero calculates from tax type |
| `invoices.total` | (calculated) | Xero calculates |
| `invoices.discountAmount` | Line item or `LineAmountTypes` | See discount handling |
| — | `XeroInvoiceID` | Store as `xero_invoice_id` on invoices table |

### 4c. Line Items

| WebKit Field | Xero Field | Notes |
|---|---|---|
| `lineItems.description` | `Description` | Required |
| `lineItems.quantity` | `Quantity` | |
| `lineItems.unitPrice` | `UnitAmount` | |
| `lineItems.isTaxable` | `TaxType` | `OUTPUT` (GST) or `EXEMPTOUTPUT` (no GST) |
| `lineItems.category` | `AccountCode` | Map to Xero revenue account (default: 200) |

### 4d. Invoice Status Mapping

| WebKit Status | Xero Status | Sync Trigger |
|---|---|---|
| `draft` | `DRAFT` | On create (if setting enabled) |
| `sent` | `AUTHORISED` | On send — this is the primary sync point |
| `viewed` | (no change) | Don't update Xero |
| `paid` | Record Payment | Create Xero Payment object |
| `overdue` | (no change) | Xero handles its own overdue logic |
| `cancelled` | `VOIDED` | Void in Xero |
| `refunded` | `VOIDED` + credit note | Complex — defer to Phase 2 |

### 4e. Payments

| WebKit Field | Xero Field | Notes |
|---|---|---|
| `invoices.paidAt` | `Payment.Date` | |
| `invoices.paymentMethod` | (not mapped) | Xero uses Account, not method |
| `invoices.paymentReference` | `Payment.Reference` | |
| `invoices.total` | `Payment.Amount` | Full payment assumed for MVP |
| — | `Payment.AccountID` | Agency's configured bank account in Xero |

---

## 5. Architecture

### Where does sync logic live?

**Option A: SvelteKit service layer** (recommended for MVP)
- Sync happens in `.remote.ts` functions after invoice/contact operations
- Xero client library lives in `$lib/server/xero/`
- Simple, co-located with existing business logic
- No new infrastructure needed

**Option B: Go content-service**
- Would require new gRPC endpoints and HTTP client
- Overkill for invoice sync — Go services handle content/SEO, not billing

**Option C: Dedicated sync worker**
- NATS-based async processing
- Better for scale but premature for MVP

**Recommendation:** Option A. Keep it in SvelteKit. If we need async processing later (batch sync, retry queues), we can add NATS workers then.

### File Structure

```
service-client/src/lib/server/xero/
├── client.ts          # OAuth token management, HTTP client wrapper
├── auth.ts            # OAuth flow handlers (authorize, callback, disconnect)
├── contacts.ts        # Contact sync logic
├── invoices.ts        # Invoice sync logic
├── payments.ts        # Payment recording
├── webhooks.ts        # Webhook signature validation + event handling
├── types.ts           # Xero API type definitions
└── mapping.ts         # WebKit ↔ Xero field mapping functions
```

### Database Changes

New migration `0XX_xero_integration.sql`:

```sql
-- Xero connection per agency
ALTER TABLE agency_profiles ADD COLUMN IF NOT EXISTS xero_tenant_id TEXT;
ALTER TABLE agency_profiles ADD COLUMN IF NOT EXISTS xero_access_token TEXT;
ALTER TABLE agency_profiles ADD COLUMN IF NOT EXISTS xero_refresh_token TEXT;
ALTER TABLE agency_profiles ADD COLUMN IF NOT EXISTS xero_token_expires_at TIMESTAMPTZ;
ALTER TABLE agency_profiles ADD COLUMN IF NOT EXISTS xero_connected_at TIMESTAMPTZ;
ALTER TABLE agency_profiles ADD COLUMN IF NOT EXISTS xero_org_name TEXT;
ALTER TABLE agency_profiles ADD COLUMN IF NOT EXISTS xero_default_account_code TEXT DEFAULT '200';
ALTER TABLE agency_profiles ADD COLUMN IF NOT EXISTS xero_default_payment_account TEXT;
ALTER TABLE agency_profiles ADD COLUMN IF NOT EXISTS xero_sync_on_send BOOLEAN NOT NULL DEFAULT true;

-- Xero references on synced records
ALTER TABLE clients ADD COLUMN IF NOT EXISTS xero_contact_id TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS xero_invoice_id TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS xero_payment_id TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS xero_last_synced_at TIMESTAMPTZ;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS xero_sync_error TEXT;

-- Sync log for debugging
CREATE TABLE IF NOT EXISTS xero_sync_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL,  -- 'contact', 'invoice', 'payment'
    entity_id UUID NOT NULL,
    xero_id TEXT,
    action TEXT NOT NULL,       -- 'create', 'update', 'void', 'payment'
    status TEXT NOT NULL,       -- 'success', 'failed', 'retrying'
    error_message TEXT,
    request_payload JSONB,
    response_payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_xero_sync_log_agency ON xero_sync_log(agency_id);
CREATE INDEX IF NOT EXISTS idx_xero_sync_log_entity ON xero_sync_log(entity_type, entity_id);
```

### Remote Functions

New file `service-client/src/lib/api/xero.remote.ts`:

```typescript
// Connection management
export const getXeroConnectionStatus = query(async () => { ... });
export const getXeroAuthUrl = command(async () => { ... });
export const connectXero = command(CallbackSchema, async (data) => { ... });
export const disconnectXero = command(async () => { ... });

// Sync settings
export const getXeroSettings = query(async () => { ... });
export const updateXeroSettings = command(SettingsSchema, async (data) => { ... });

// Manual sync triggers
export const syncContactToXero = command(ClientIdSchema, async (clientId) => { ... });
export const syncInvoiceToXero = command(InvoiceIdSchema, async (invoiceId) => { ... });
export const syncAllContacts = command(async () => { ... });  // bulk initial sync

// Sync log
export const getXeroSyncLog = query(FilterSchema, async (filters) => { ... });
```

Webhook endpoint (REST, not remote function):
```
service-client/src/routes/api/xero/webhook/+server.ts
```

### Sync Flow

**Invoice sent in WebKit:**
1. `sendInvoice()` in `invoices.remote.ts` marks invoice as `sent`
2. After status update, checks if agency has Xero connected + `xero_sync_on_send` enabled
3. Calls `syncContactToXero(clientId)` — creates/updates Xero contact, stores `xero_contact_id`
4. Calls `syncInvoiceToXero(invoiceId)` — creates Xero invoice as AUTHORISED, stores `xero_invoice_id`
5. Logs sync result to `xero_sync_log`
6. If sync fails: stores error in `xero_sync_error`, does NOT block the send operation

**Payment recorded in WebKit:**
1. `recordPayment()` marks invoice as `paid`
2. If `xero_invoice_id` exists, creates Xero Payment object
3. Stores `xero_payment_id`
4. Logs sync result

**Payment received via Xero webhook:**
1. Xero sends `PAYMENT.CREATED` event
2. Webhook handler validates HMAC signature
3. Looks up invoice by `xero_invoice_id`
4. If found and not already paid, records payment in WebKit
5. Sends notification emails (same as manual payment recording)

---

## 6. User Interface

### Settings Page: Integrations Tab

New route: `[agencySlug]/settings/integrations`

**Connected state:**
- Xero org name + connected date
- Toggle: "Auto-sync invoices when sent" (default: on)
- Default revenue account code (default: 200 — Sales)
- Default payment account (dropdown from Xero chart of accounts)
- "Disconnect" button with confirmation modal
- Recent sync log (last 10 entries)

**Disconnected state:**
- "Connect to Xero" button → OAuth redirect
- Brief description of what gets synced

### Invoice Detail Page

When Xero is connected:
- Badge showing sync status: "Synced to Xero" (green), "Sync failed" (red), "Not synced" (grey)
- Manual "Sync to Xero" button (for retrying failed syncs or syncing drafts)
- Link to view invoice in Xero (if `xero_invoice_id` exists)

### Client Detail Page

- Badge showing Xero sync status
- Manual "Sync to Xero" button

---

## 7. Tier Gating

| Tier | Xero Integration |
|---|---|
| Free | No |
| Starter | Yes — up to 1 Xero connection |
| Growth | Yes |
| Enterprise | Yes |

**Rationale:** Xero integration is a strong upgrade motivator. Free tier doesn't get it. Starter gets it as a key selling point — this is what agencies are paying for. No per-sync charges; it's included in the tier.

**subscription.ts changes:**
- Add `"xero_integration"` to `TierFeature` type
- Add to Starter, Growth, Enterprise feature arrays
- `requireFeature("xero_integration")` in Xero remote functions

---

## 8. Phased Delivery

### Phase 1: Core Sync (MVP)
- OAuth connection flow (connect/disconnect)
- Contact sync (WebKit → Xero, one-way push)
- Invoice sync on send (WebKit → Xero as AUTHORISED)
- Payment recording (WebKit → Xero)
- Sync status on invoice detail page
- Settings page with connection management
- Sync error logging
- Tier gating

### Phase 2: Bidirectional + Polish
- Xero webhooks for payment events (Xero → WebKit)
- Invoice voiding when cancelled in WebKit
- Retry queue for failed syncs (with exponential backoff)
- Bulk initial sync for existing contacts/invoices
- Credit notes for refunds
- Xero chart of accounts dropdown for account code mapping

### Phase 3: Advanced
- Bidirectional contact sync (Xero changes → WebKit)
- Partial payment support
- Recurring invoice templates synced to Xero repeating invoices
- Xero reporting integration (P&L, BAS data)
- MYOB integration via Apideck/Codat (separate feature)

---

## 9. Token Security

Xero tokens are sensitive credentials. Storage approach:
- Encrypt `xero_access_token` and `xero_refresh_token` at rest using AES-256-GCM
- Encryption key stored in environment variable (`XERO_TOKEN_ENCRYPTION_KEY`)
- Tokens never exposed to the client — all Xero operations happen server-side
- On disconnect, immediately delete tokens from database
- Log all token refresh events for audit trail

---

## 10. Error Handling

| Scenario | Handling |
|---|---|
| Xero rate limit (429) | Retry with exponential backoff, max 3 retries |
| Token expired | Auto-refresh; if refresh fails, mark as disconnected |
| Refresh token expired (60 days unused) | Mark as disconnected, notify agency to reconnect |
| Invoice sync fails | Store error, allow manual retry, don't block WebKit operations |
| Contact sync fails | Store error, skip invoice sync (needs contact first) |
| Webhook signature invalid | Return 401, log attempt |
| Duplicate invoice number in Xero | Append suffix, log warning |
| Xero org has different currency | Reject sync, notify agency |

**Critical principle:** Xero sync failures should NEVER block WebKit operations. Invoice sending, payment recording, etc. must always succeed regardless of Xero sync status.

---

## 11. Xero API Cost Impact on WebKit Pricing

| WebKit Growth Stage | Connected Agencies | Xero Tier | Cost/mo |
|---|---|---|---|
| Early (1–5 agencies) | 1–5 | Starter (free) | $0 |
| Growing (6–50 agencies) | 6–50 | Core | ~$35 |
| Scale (50–250 agencies) | 50–250 | Plus/Advanced | ~$895 |

At $29–$199/agency/month, Xero API costs are negligible relative to subscription revenue. Even at Advanced tier ($895/mo), with 250 connected agencies at average $79/mo = $19,750/mo revenue, Xero costs are 4.5%.

---

## 12. Files to Create/Modify

### New Files
| File | Purpose |
|------|---------|
| `migrations/0XX_xero_integration.sql` | Database columns + sync log table |
| `service-client/src/lib/server/xero/client.ts` | OAuth + HTTP client |
| `service-client/src/lib/server/xero/auth.ts` | OAuth flow |
| `service-client/src/lib/server/xero/contacts.ts` | Contact sync |
| `service-client/src/lib/server/xero/invoices.ts` | Invoice sync |
| `service-client/src/lib/server/xero/payments.ts` | Payment sync |
| `service-client/src/lib/server/xero/webhooks.ts` | Webhook handler |
| `service-client/src/lib/server/xero/types.ts` | Xero API types |
| `service-client/src/lib/server/xero/mapping.ts` | Field mapping |
| `service-client/src/lib/api/xero.remote.ts` | Remote functions |
| `service-client/src/routes/api/xero/webhook/+server.ts` | Webhook endpoint |
| `service-client/src/routes/api/xero/callback/+server.ts` | OAuth callback |
| `service-client/src/routes/(app)/[agencySlug]/settings/integrations/+page.svelte` | Settings UI |
| `service-client/src/routes/(app)/[agencySlug]/settings/integrations/+page.server.ts` | Settings data |

### Modified Files
| File | Changes |
|------|---------|
| `service-client/src/lib/server/schema.ts` | Add Xero columns + sync log table |
| `service-client/src/lib/server/subscription.ts` | Add `xero_integration` feature |
| `service-client/src/lib/api/invoices.remote.ts` | Add Xero sync hooks to send/pay/cancel |
| `service-client/src/lib/components/LandingPage.svelte` | Add Xero to feature descriptions |
| Billing page | Add Xero integration to tier feature lists |
| Settings layout | Add "Integrations" nav item |

---

## 13. Open Questions

1. **Account code mapping** — Should we let agencies configure which Xero revenue account to use, or default to 200 (Sales)? Per line-item category mapping (setup → one account, development → another) adds complexity.

2. **Invoice number conflicts** — If an agency uses the same invoice numbering in both WebKit and Xero, we'll get conflicts. Options: prefix WebKit numbers (e.g., "WK-001"), use Xero's auto-numbering, or let the agency choose.

3. **Draft invoice sync** — Should drafts sync to Xero as DRAFT, or only sync when sent (as AUTHORISED)? Syncing drafts means more API calls but keeps Xero current. Syncing only on send is simpler and avoids polluting Xero with unfinished invoices.

4. **ABN on clients table** — Currently ABN is only stored as a snapshot on the invoice, not on the clients table. Should we add an `abn` column to `clients` for better Xero contact sync?

5. **Multi-currency** — Xero supports multi-currency orgs. Do we need to handle this, or assume AUD only for MVP?

6. **Partial payments** — Xero supports partial payments. WebKit currently only supports full payment recording. Do we need partial payment support for Phase 1?

7. **Existing data** — When an agency first connects Xero, should we offer to bulk-sync all existing clients and invoices? Or only sync new items going forward?

---

## 14. Effort Estimate

| Component | Estimate |
|-----------|----------|
| OAuth flow + token management | 2–3 days |
| Contact sync | 1–2 days |
| Invoice sync (create + status) | 2–3 days |
| Payment sync | 1 day |
| Settings UI | 1–2 days |
| Invoice/client UI badges + manual sync | 1 day |
| Webhook endpoint + handler | 1–2 days |
| Sync logging + error handling | 1 day |
| Tier gating + billing page updates | 0.5 days |
| Testing + edge cases | 2–3 days |
| **Total Phase 1** | **~12–18 days** |
