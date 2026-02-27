# Business Features Spec Plan

**Date**: 2026-02-07
**Branch**: feature/subscription-billing
**Area**: Business Features, Pricing, Revenue Enablement

---

## 1. Contract Email Notifications

**Priority**: P0 (before payments)
**Effort**: 4-8 hrs
**Revenue Impact**: Broken workflow = lost deals. Agencies can't use contracts without manual email sending.

### Issue

4 TODO stubs in `service-client/src/lib/api/contracts.remote.ts`:
- Line 793: `TODO: Implement email notification in Phase 3` (sendContract)
- Line 831: `// TODO: Send email notification to client` (commented-out `await sendContractEmail`)
- Line 844/870: Same for `resendContract`
- Line 1386-1387: `TODO: Send confirmation email to client` + `TODO: Send notification to agency` (after signing)

### Current State

- `sendContractEmail` exists in `email.remote.ts:667` -- fully implemented with PDF attachment, branded templates, email logging
- `sendContract` command (contracts.remote.ts:795) updates status to `sent` but never calls `sendContractEmail`
- `resendContract` command (contracts.remote.ts:846) validates state but never sends email
- After client signs (line 1386), no confirmation email to client, no notification to agency

### Proposed Implementation

1. **sendContract** (line 831): After status update, call email system
   - Import and invoke the internal email-sending logic from `email.remote.ts`
   - Since `sendContractEmail` is a `command()` (remote function), can't call directly from another remote function. Extract core email logic into `$lib/server/contract-emails.ts` utility
   - Call utility from both `sendContract` and `sendContractEmail`

2. **resendContract** (line 870): Same pattern -- call extracted utility

3. **Post-signing emails** (line 1386-1387):
   - Create `sendSignatureConfirmationEmail()` in `$lib/server/contract-emails.ts`
   - Template: "Your contract has been signed" with signed date, next steps
   - Create `sendAgencySignatureNotification()` -- notify agency owner/admin that client signed
   - Use existing `email-templates.ts` pattern for HTML generation

4. **Email templates needed**:
   - `generateContractSignedConfirmation()` -- client receives
   - `generateContractSignedNotification()` -- agency receives

### Dependencies

- None. Email infrastructure (`email.remote.ts`, `email-templates.ts`, SMTP via Mailpit/production) fully built

---

## 2. Reporting Dashboard

**Priority**: P1 (before launch)
**Effort**: 2-3 weeks
**Revenue Impact**: Critical for justifying Growth ($79) and Enterprise ($199) tiers. `analytics` feature already gated to Growth+ in `subscription.ts:73`. Without this, Growth/Enterprise have no exclusive value.

### Issue

- `analytics:view` and `analytics:export` permissions defined in `permissions.ts:76-77` but zero implementation
- Dashboard shows placeholder `-` for "Completed This Month" and "Team Members" (`+page.svelte:109-119`)
- "Recent Activity" section is hardcoded placeholder (`+page.svelte:372-380`)
- No route for `/[agencySlug]/reports` or `/[agencySlug]/analytics`

### Current State

All data needed for reporting already exists in the DB:
- `proposals` table: status (draft/sent/viewed/accepted/declined/revised), `createdAt`, `totalPrice`
- `contracts` table: status (draft/sent/viewed/signed/declined/expired), `totalPrice`, `clientSignedAt`
- `invoices` table: status (draft/sent/viewed/paid/overdue/cancelled), `total`, `paidAt`, `amountPaid`
- `consultations` table: status (draft/completed/converted), `createdAt`
- `agencyActivityLog` table: action, entityType, entityId, createdAt -- full audit trail
- `clients` table: with all linked documents

### Proposed Implementation

**Phase A: Dashboard Stats (4-8 hrs)**

Update `+page.server.ts` to query real data:
- Active consultations count (already done)
- Completed consultations this month
- Team member count
- Open proposals count
- Revenue this month (sum of paid invoices)
- Outstanding invoices total

Update `+page.svelte` to display real stats instead of `-` placeholders.

**Phase B: Activity Feed (4-8 hrs)**

Replace "Recent Activity" placeholder with real feed from `agencyActivityLog`:
- Create `reporting.remote.ts` with `getRecentActivity` query
- Show last 20 actions: "John sent proposal PROP-012 to Murray's Plumbing", etc.
- Link to relevant entity

**Phase C: Reports Page (1-2 weeks)**

New route: `/(app)/[agencySlug]/reports/+page.svelte`

Sections:
1. **Revenue Summary**: Monthly/quarterly totals from paid invoices. Bar chart.
2. **Pipeline Funnel**: Consultations -> Proposals sent -> Accepted -> Contracts signed -> Invoices paid. Conversion rates at each stage.
3. **Proposal Win Rate**: Accepted / (Accepted + Declined). Filter by date range.
4. **Invoice Aging**: Outstanding invoices grouped by overdue period (0-30, 30-60, 60-90, 90+ days).
5. **Team Activity**: Actions per team member from activity log.

**Data Model**: No new tables needed. All queries aggregate existing tables with date filters.

**UI**: Use DaisyUI stat cards + lightweight chart library (Chart.js or @svelte/charts). Keep it server-rendered via `query()` functions.

**Tier Gating**: Wrap reports page in `requireFeature('analytics')` check. Free/Starter see upgrade prompt.

### Dependencies

- Dashboard stats fix is independent (Phase A)
- Reports page needs no new schema

---

## 3. Client Portal

**Priority**: P2 (quarterly)
**Effort**: 3-4 weeks
**Revenue Impact**: Reduces churn. Increases invoice payment speed. Table stakes vs HoneyBook/Dubsado.

### Issue

Clients only interact via one-off public links:
- `/p/[slug]` -- proposal view
- `/c/[slug]` -- contract view
- `/i/[slug]` -- invoice view
- `/f/[slug]` -- form view

No persistent client session, no unified view, no payment history.

### Current State

- `clients` table exists with `email`, `phone`, `businessName` fields
- `getClientHub` in `consultation.remote.ts` aggregates all documents per client
- Public routes have no authentication -- anyone with the slug can view

### Proposed Implementation

**Phase 1: Client Magic Link Auth**
- New table: `client_sessions` (id, client_id, agency_id, token, expires_at)
- Client receives magic link via email -> creates session cookie
- Session scoped to agency (client can have accounts across agencies)

**Phase 2: Client Portal Route**
- New route: `/client/[agencySlug]/portal`
- Dashboard showing: all proposals, contracts, invoices, forms for this client
- Filter by status (pending, completed)
- Payment history from invoices

**Phase 3: Portal Features**
- Document notification preferences
- Secure file upload for project deliverables
- Invoice auto-pay via saved Stripe payment method

### Dependencies

- Client email must be captured consistently (already via `getOrCreateClient` pattern)
- Email system for magic links (already built)

---

## 4. Recurring Invoices

**Priority**: P2 (quarterly)
**Effort**: 2-3 weeks
**Revenue Impact**: Captures hosting/maintenance revenue stream (30-50% of agency income). Agencies without this will leave for FreshBooks.

### Issue

- `monthlyPrice` field exists on packages (`schema.ts:352`) and shows in proposals/contracts
- Proposals display monthly pricing in UI (`p/[slug]/+page.svelte:487-491`)
- Contracts generate payment schedule text mentioning monthly billing (`contracts.remote.ts:230-232`)
- But NO automated recurring invoice generation exists

### Current State

- Invoice system is one-time only: create -> send -> pay
- `monthlyPrice` data flows: package -> proposal -> contract -> schedule text
- No `recurring_schedule` or `subscription` concept for agency clients
- Stripe Connect is set up for one-time payments only

### Proposed Implementation

**Schema Changes:**
```sql
CREATE TABLE IF NOT EXISTS recurring_invoice_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  contract_id UUID REFERENCES contracts(id),

  -- Schedule
  frequency VARCHAR(20) NOT NULL, -- 'monthly', 'quarterly', 'annual'
  amount DECIMAL(10,2) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  next_invoice_date DATE NOT NULL,
  end_date DATE, -- NULL = indefinite

  -- State
  status VARCHAR(20) NOT NULL DEFAULT 'active', -- active, paused, cancelled
  last_invoice_id UUID REFERENCES invoices(id),
  invoices_generated INTEGER NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Implementation:**
1. New remote function `createRecurringSchedule` -- creates schedule from contract monthly pricing
2. Cron job or scheduled function: daily check for `next_invoice_date <= today`, auto-generate invoice
3. Auto-send email with generated invoice
4. UI: "Recurring" tab on invoices list page, schedule management

**Cron approach:** Use SvelteKit scheduled endpoint hit by external cron (Cloudflare Worker or simple cron job on VPS):
- `POST /api/cron/recurring-invoices` with auth token
- Queries schedules where `next_invoice_date <= NOW() AND status = 'active'`
- Creates invoice for each, updates `next_invoice_date`

### Dependencies

- Invoice system (complete)
- Client system (complete)
- Cron infrastructure (new -- could use Cloudflare Worker or VPS cron)

---

## 5. International Support

**Priority**: P2 (quarterly)
**Effort**: 2-3 weeks
**Revenue Impact**: Opens UK, NZ, Singapore, SE Asian markets. Currently locked to AU.

### Issue

Hardcoded AUD/GST/en-AU in 5+ files:
- `invoice-pdf.ts:25-28`: `Intl.NumberFormat("en-AU", { currency: "AUD" })`
- `data-pipeline.service.ts:605-615`: Same hardcoded AUD formatting
- `email-templates.ts:51`: Same pattern
- `contract-pdf.ts:23`: Same pattern
- `schema.ts:296-298`: `gstRegistered` default `true`, `gstRate` default `10.00`
- `schema.ts:276`: `abn` field (Australian Business Number)
- `schema.ts:287`: `country` default `"Australia"`

### Current State

- `agencyProfiles` has `gstRate` field (decimal, default 10.00) -- already configurable per agency
- `gstRegistered` boolean exists -- can be used as "tax registered" toggle
- `country` field exists but defaults to Australia and isn't used for locale detection
- All `formatCurrency` functions hardcode `en-AU` and `AUD`

### Proposed Implementation

**Phase 1: Agency Locale Settings (1 week)**

Add columns to `agency_profiles`:
```sql
ALTER TABLE agency_profiles ADD COLUMN IF NOT EXISTS currency VARCHAR(3) NOT NULL DEFAULT 'AUD';
ALTER TABLE agency_profiles ADD COLUMN IF NOT EXISTS locale VARCHAR(10) NOT NULL DEFAULT 'en-AU';
ALTER TABLE agency_profiles ADD COLUMN IF NOT EXISTS tax_label VARCHAR(20) NOT NULL DEFAULT 'GST';
ALTER TABLE agency_profiles ADD COLUMN IF NOT EXISTS business_number_label VARCHAR(30) NOT NULL DEFAULT 'ABN';
```

**Phase 2: Dynamic Formatting (1 week)**

- Create `$lib/server/locale.ts` utility:
  - `formatCurrency(value, currency, locale)` -- replaces all hardcoded versions
  - `formatDate(date, locale)` -- replaces hardcoded en-AU dates
  - `getTaxLabel(agencyId)` -- returns "GST", "VAT", "Sales Tax", etc.
- Update all 5+ `formatCurrency` callsites to use agency locale
- Thread agency profile through PDF templates and email templates

**Phase 3: UI Updates (3-5 days)**

- Settings page: currency dropdown, tax label, locale
- Replace "ABN" label with dynamic `businessNumberLabel`
- Replace "GST" label with dynamic `taxLabel` throughout invoices/contracts

**Preset mappings:**
| Country | Currency | Tax Label | Rate | Biz Number |
|---------|----------|-----------|------|------------|
| Australia | AUD | GST | 10% | ABN |
| New Zealand | NZD | GST | 15% | NZBN |
| United Kingdom | GBP | VAT | 20% | VAT No. |
| United States | USD | Sales Tax | varies | EIN |
| Singapore | SGD | GST | 9% | UEN |

### Dependencies

- Agency profile settings page (exists)
- Migration for new columns

---

## 6. Integrations Roadmap

**Priority**: P3 (future)
**Effort**: 2-4 weeks per integration
**Revenue Impact**: Xero/QuickBooks critical for AU market. Slack adds stickiness. All reduce churn by increasing switching costs.

### Issue

Zero external integrations exist. No integration settings page, no webhook outbound, no API keys.

### Current State

- No `integrations` table or config
- No outbound webhook infrastructure
- No API key system for external access
- Settings sidebar has no "Integrations" link

### Proposed Implementation (Priority Order)

**1. Xero Integration (P2 -- highest AU market demand)**
- OAuth2 connection flow via Xero API
- Auto-sync invoices: WebKit invoice -> Xero invoice
- Auto-sync payments: Stripe payment -> Xero payment
- Contact sync: WebKit client -> Xero contact
- Schema: `agency_integrations` table (agency_id, provider, access_token, refresh_token, config, status)

**2. Slack Notifications (P2)**
- Incoming webhook URL per agency
- Events: contract signed, invoice paid, proposal accepted, new consultation
- Settings page to configure which events trigger notifications
- Simple `POST` to Slack webhook URL -- no complex OAuth needed

**3. QuickBooks Integration (P3)**
- Similar to Xero but different API
- OAuth2 connection, invoice/payment/contact sync

**4. Calendar Integration (P3)**
- Google Calendar OAuth2
- Auto-create events from consultation bookings
- Sync contract milestones

**Schema for all integrations:**
```sql
CREATE TABLE IF NOT EXISTS agency_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL, -- 'xero', 'slack', 'quickbooks', 'google_calendar'
  status VARCHAR(20) NOT NULL DEFAULT 'disconnected',
  access_token TEXT,
  refresh_token TEXT,
  config JSONB NOT NULL DEFAULT '{}',
  connected_at TIMESTAMPTZ,
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(agency_id, provider)
);
```

### Dependencies

- Encryption for OAuth tokens (currently banking info is plaintext too -- solve together)
- External API credentials (Xero app, Slack app)

---

## 7. Onboarding Wizard

**Priority**: P1 (before launch)
**Effort**: 1-2 weeks
**Revenue Impact**: Reduces time-to-value. Current 2-step onboarding (settings + demo) is minimal. Better onboarding = lower churn in first 30 days.

### Issue

- Current onboarding: 2-step section in `+page.svelte:186-271` (complete settings + load demo)
- `SetupChecklist.svelte` exists but only linked from settings page, not visible during initial flow
- No guided tour of features
- No "create your first [consultation/proposal]" prompt after demo data

### Current State

- `SetupChecklist.svelte` tracks: profile completeness via `SetupChecklistItem[]`
- `+page.server.ts:46-53` checks profile completion (legalEntityName, address fields)
- Demo data system works well (Murray's Plumbing scenario)
- Beta invite gate exists (`create/+page.svelte`) -- first touchpoint

### Proposed Implementation

**Phase 1: Enhanced Onboarding Flow (1 week)**

Replace current 2-step with 5-step wizard:
1. **Business Profile** -- name, address, ABN (pull from agency create form)
2. **Branding** -- upload logo, pick colors (simplified branding page)
3. **Packages** -- create first service package or use defaults
4. **Payment Setup** -- connect Stripe (or skip)
5. **Explore** -- load demo data OR create first consultation

Route: `/(app)/[agencySlug]/onboarding/+page.svelte`
Store progress in `agency_profiles` or localStorage.
Show wizard on first login (when profile incomplete).

**Phase 2: Feature Tour (3-5 days)**

- Lightweight tooltip system using existing DaisyUI tooltip classes
- 5-step tour: Dashboard -> Consultations -> Proposals -> Contracts -> Invoices
- One-time flag: `agency_profiles.onboarding_tour_completed`
- Trigger after onboarding wizard completes

### Dependencies

- Agency creation flow (exists)
- Branding settings (exists)
- Package management (exists)

---

## 8. Template Marketplace

**Priority**: P3 (future)
**Effort**: 3-4 weeks
**Revenue Impact**: Flywheel effect. Reduces time-to-value for new agencies. Potential premium template revenue.

### Issue

- `formTemplates` table exists (`schema.ts:589-614`) with `usageCount`, `isFeatured`, `displayOrder`
- System templates seeded via migrations (full discovery template, etc.)
- No agency-to-agency sharing
- No marketplace UI
- Only form templates -- no proposal/contract/email templates

### Current State

- Form templates: system-wide, admin-managed, seeded via SQL
- `usageCount` tracked but not displayed prominently
- No `agencyId` on form templates (all system-wide)
- Proposal templates: not yet implemented (table referenced in CLAUDE.md but not in schema)
- Contract templates: `contractTemplates` table exists (`schema.ts`) with merge fields, agency-scoped

### Proposed Implementation

**Phase 1: Community Templates (2 weeks)**
- Add `visibility` column to `formTemplates`: `system`, `private`, `public`
- Add `agencyId` column (nullable -- NULL = system template)
- Marketplace page: `/marketplace/templates`
- Browse, preview, "use this template" copies to agency
- Rating/review system (optional)

**Phase 2: Expand to All Template Types (1-2 weeks)**
- Proposal templates: standardized proposal structures agencies can share
- Contract templates: already agency-scoped, add sharing capability
- Email templates: custom email layouts

**Phase 3: Premium Templates (future)**
- Stripe payment for premium templates
- Revenue share with template creators

### Dependencies

- Form template system (complete)
- Contract template system (complete)

---

## 9. Pricing Tier Assessment

**Priority**: P0 (before payments)
**Effort**: Configuration changes only
**Revenue Impact**: Direct -- determines revenue per customer.

### Issue

Growth ($79) and Enterprise ($199) lack features that justify premium pricing vs competitors.

### Current State (from `subscription.ts:45-98`)

| Feature | Free | Starter | Growth | Enterprise |
|---------|------|---------|--------|------------|
| Members | 1 | 3 | 10 | Unlimited |
| Consultations/mo | 5 | 25 | 100 | Unlimited |
| AI Generations/mo | 5 | 25 | 100 | Unlimited |
| Templates | 1 | 5 | 20 | Unlimited |
| Storage | 100MB | 1GB | 10GB | Unlimited |
| PDF Export | - | Yes | Yes | Yes |
| Email Delivery | - | Yes | Yes | Yes |
| Custom Branding | - | - | Yes | Yes |
| Analytics | - | - | Yes | Yes |
| White Label | - | - | Yes | Yes |
| API Access | - | - | Yes | Yes |
| Priority Support | - | - | - | Yes |
| Custom Domain | - | - | - | Yes |
| SSO | - | - | - | Yes |

**Problems:**
- `analytics` gated to Growth+ but doesn't exist yet
- `custom_domain` and `sso` gated to Enterprise but not implemented
- `white_label` not clearly defined
- Free tier may be too restrictive (5 consultations, 1 template)

### Recommendations

1. **Free tier**: Increase to 10 consultations/mo, 3 templates. Drives adoption.
2. **Growth must ship with**: Reporting dashboard, custom branding, team management. These justify $79.
3. **Enterprise must ship with**: Everything in Growth + priority support + advanced reporting. SSO and custom domain are nice-to-have but not blockers.
4. **New tier feature**: Recurring invoices -- gate to Growth+ to drive upgrades from Starter agencies with maintenance clients.
5. **Annual pricing**: Already implemented (17% discount per billing notes). Promote prominently.

### Implementation

Update `TIER_DEFINITIONS` in `subscription.ts` once reporting is built:
- Add `recurring_invoices` feature to Growth+ tiers
- Add `advanced_reporting` feature to Enterprise
- Update free tier limits: `maxConsultationsPerMonth: 10`, `maxTemplates: 3`

---

## 10. Project Management Basics

**Priority**: P3 (future roadmap)
**Effort**: 4-6 weeks
**Revenue Impact**: Extends platform stickiness post-contract. Without this, agencies leave for Monday.com/Asana after signing.

### Issue

Workflow ends at contract signing / invoice payment. No project delivery tracking.

### Current State

- Zero project management infrastructure
- No tasks, milestones, time tracking, or project status tables
- Contract has `status: signed` as terminal state
- No "project" concept linking contract to delivery

### Proposed Implementation

**Phase 1: Basic Project Board (3-4 weeks)**

```sql
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id),
  contract_id UUID REFERENCES contracts(id),
  name VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active', -- active, on_hold, completed, cancelled
  start_date DATE,
  due_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS project_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'todo', -- todo, in_progress, done
  assigned_to UUID REFERENCES users(id),
  due_date DATE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS project_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  due_date DATE,
  completed_at TIMESTAMPTZ,
  sort_order INTEGER NOT NULL DEFAULT 0
);
```

- Auto-create project from signed contract
- Kanban board UI (todo / in progress / done)
- Task assignment to team members
- Milestone tracking with dates

**Phase 2: Time Tracking (2 weeks)**
- Start/stop timer per task
- Manual time entry
- Timesheet report per project/client

**Phase 3: Client Visibility (future)**
- Project status visible in client portal
- Milestone completion notifications

### Dependencies

- Client portal (for client visibility)
- Team permissions (exists -- add `project:*` permissions)

---

## Resolved Questions (2026-02-07)

1. **Contract emails:** **Auto-send on `sendContract`.** Current flow is broken: "Send Contract" changes status to `sent` but no email goes out. `sendContract` should auto-send. Separate "Resend" action already exists for re-sending.

2. **Reporting charts:** **Server-rendered stats + lightweight client-side charts.** DaisyUI stat cards for KPIs (SSR, zero JS). Chart.js client-side for revenue bar chart and funnel. Data fetched via `query()` remote functions. Charts are progressive enhancement.

3. **Client portal auth:** **Magic link.** Consistent with agency auth. Simpler (no password storage, no forgot-password flow). Clients are infrequent users who won't remember passwords.

4. **Recurring invoices cron:** **VPS crontab hitting SvelteKit API endpoint.** SvelteKit endpoint: `POST /api/cron/recurring-invoices` with shared secret token. VPS crontab: `0 8 * * * curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://app.webkit.au/api/cron/recurring-invoices`. No new infrastructure. Migrate to Cloudflare Worker when moving off VPS.

5. **International pricing:** **Not for launch. AUD only.** Focus AU market first. Use Stripe's multi-currency support when expanding.

6. **Free tier changes:** **Product decision needed.** Recommendation: increase Free to 10 consultations. Starter's value is features (PDF export, email delivery), not consultation count. More generous free tier drives adoption and word-of-mouth.

7. **Integration priority:** **Xero first.** AU agencies need accounting integration more than notifications. Xero dominates AU small business accounting. Justifies Growth tier pricing.

8. **Template marketplace:** **All free for community building.** At current scale, monetizing templates adds complexity for negligible revenue. Free templates build community and reduce time-to-value. Revisit revenue share after 500+ agencies.

---

*End of Business Features Spec*
