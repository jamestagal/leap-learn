# Database Schema & Data Integrity Review

**Reviewer:** Database Reviewer Agent
**Date:** 2026-02-06
**Branch:** feature/subscription-billing
**Scope:** Schema design, migrations, multi-tenancy, query patterns, data integrity, billing data

---

## Strengths

### 1. Solid Multi-Tenancy Foundation
- Every agency-scoped table correctly uses `agency_id` with `ON DELETE CASCADE` foreign keys to `agencies(id)`. This is consistent across all 20+ tables.
- The `withAgencyScope()` helper in `db-helpers.ts` provides a clean abstraction for enforcing tenant isolation.
- `unique()` constraints properly include `agency_id` (e.g., `unique(agency_id, slug)` on packages, addons, forms, clients).
- Drizzle schema foreign keys match the SQL migration definitions.

### 2. Well-Designed Audit Trail
- `agency_activity_log` table captures action, entity type, entity ID, old/new values, IP address, and user agent.
- `logActivity()` is called consistently across remote functions for all CRUD operations.
- Silently swallows errors to avoid breaking the primary operation -- correct tradeoff for audit logging.

### 3. Comprehensive Indexing Strategy
- All foreign key columns are indexed.
- Composite indexes exist for common query patterns (e.g., `(agency_id, status)`, `(agency_id, is_active)`).
- Partial indexes are used effectively (e.g., `idx_agencies_freemium WHERE is_freemium = TRUE`, `idx_agencies_deleted WHERE deleted_at IS NOT NULL`).
- JSONB GIN indexes on `agency_forms.schema` and `form_submissions.data` for flexible querying.

### 4. Idempotent Migrations
- All 9 migration files use `IF NOT EXISTS` / `IF EXISTS` / `ON CONFLICT DO NOTHING` patterns consistently.
- Migrations are safe to re-run, which is critical for the production deployment model.

### 5. Good Financial Data Handling
- All monetary columns use `DECIMAL(10,2)` -- correct for AUD currency.
- GST rate uses `DECIMAL(5,2)` -- appropriate for tax percentages.
- Invoice totals are stored alongside computed fields (subtotal, discount, GST, total) for immutable records.

### 6. CHECK Constraints on Critical Columns
- `agencies.status` constrained to `('active', 'suspended', 'cancelled')`.
- `agency_memberships.role` constrained to `('owner', 'admin', 'member')`.
- `agency_memberships.status` constrained to `('active', 'invited', 'suspended')`.
- All document status columns have CHECK constraints matching their status enums.
- `consultations.completion_percentage` has range check `(>= 0 AND <= 100)`.

### 7. Contract Signing Forensics
- `contracts` table captures `client_signature_ip`, `client_signature_user_agent`, and `client_signed_at` -- essential for legal validity of e-signatures.

---

## Weaknesses

### 1. Dual Schema Drift Risk (HIGH)
**Files:** `schema_postgres.sql` (Go) vs `schema.ts` (Drizzle) vs `migrations/*.sql`

Three separate schema definitions exist that must stay in sync:
- The Go schema (`schema_postgres.sql`) is used only for sqlc code generation but contains the full database DDL.
- The Drizzle schema (`schema.ts`) is the ORM model for SvelteKit.
- The migrations (`migrations/*.sql`) are the actual source of truth.

**Specific drift found:**
- `ip_address` column in `agency_activity_log`: Go schema uses `inet` type, Drizzle schema uses `text("ip_address")`. The Drizzle schema comment says "Using text instead of inet for simplicity" but the Go sqlc model expects `pqtype.Inet`. This means Go code writing to this column would use a different serialization than SvelteKit code.
- The `consultations` table in Go schema has both JSONB columns (`contact_info`, `business_context`, `pain_points`, `goals_objectives`) AND flat columns. The Drizzle schema only defines the flat columns (plus references to the JSONB ones as unused). The `userId` field in Drizzle is required (`notNull()`) but the Go `SELECT *` returns all columns including the JSONB ones. A desync here could cause data loss or query failures.
- `email_logs` in Go schema is missing `form_submission_id` column that was added in migration 004. The Go `EmailLog` struct does not have this field -- if Go ever does `SELECT *` on `email_logs`, this will cause a struct mismatch crash.

**Risk:** Medium-High. Any new column added via migration that isn't reflected in all three files will cause runtime errors for whichever service reads the affected table.

### 2. Missing Foreign Key Constraints on Several `client_id` References (HIGH)
**Tables:** `consultations.client_id`, `proposals.client_id`, `contracts.client_id`, `invoices.client_id`

In the Go schema (`schema_postgres.sql`), these `client_id` columns are declared as bare `uuid` columns with no foreign key constraint:
```sql
client_id uuid,  -- References clients(id), but added after clients table
```

Migration `005_clients_system.sql` adds the FK constraint for `form_submissions.client_id` using a `DO $$ ... END $$` block, and adds `client_id` columns with FK references to consultations, proposals, contracts, and invoices. However, the Go schema file was never updated to reflect these constraints.

The Drizzle schema correctly defines `.references(() => clients.id, { onDelete: "set null" })` on all `clientId` columns.

**Impact:** The actual database has the constraints (from migrations), but the Go reference schema is misleading. If someone uses the Go schema to understand the DB structure, they'd miss the FK relationships.

### 3. `consultations.agency_id` is Nullable in Go Schema (MEDIUM-HIGH)
**File:** `schema_postgres.sql` line 661

```sql
agency_id uuid references agencies(id) on delete cascade,  -- No NOT NULL
```

The Drizzle schema correctly marks it as `.notNull()`. The Go model has `AgencyID uuid.NullUUID`. In the actual database (from the base schema in `schema_postgres.sql`), the column is nullable. This means consultations could theoretically exist without an agency, breaking the multi-tenancy model.

**The migration doesn't fix this** because `CREATE TABLE IF NOT EXISTS` won't alter an existing table to add NOT NULL.

### 4. No Unique Constraint on `clients(agency_id, email)` in Go Schema (MEDIUM)
The migration `005_clients_system.sql` creates the unique constraint:
```sql
CONSTRAINT clients_agency_email_unique UNIQUE (agency_id, email)
```
The Drizzle schema has it too. But the Go `schema_postgres.sql` does not include this constraint. The actual DB has it (from migration), but the Go reference is incomplete.

### 5. Race Condition in Document Number Generation (MEDIUM)
**Files:** `proposals.remote.ts:199-225`, `contracts.remote.ts` (similar pattern)

```typescript
async function getNextProposalNumber(agencyId: string): Promise<string> {
    const [profile] = await db.select()...;
    const nextNumber = profile?.nextProposalNumber || 1;
    // Generate number
    // Increment next number
    await db.update(agencyProfiles).set({ nextProposalNumber: nextNumber + 1 })...;
}
```

This is a classic read-then-write race condition. Two concurrent proposal creations could read the same `nextProposalNumber`, generating duplicate proposal numbers. The same pattern exists for contract numbers and invoice numbers.

**Fix:** Use `UPDATE ... SET next_proposal_number = next_proposal_number + 1 RETURNING next_proposal_number` in a single atomic query, or use a database sequence.

### 6. AI Generation Counter Race Condition (MEDIUM)
**File:** `subscription.ts:338-370`

`incrementAIGenerationCount()` reads the current count, then writes `currentCount + 1`. Under concurrent requests, two requests could read the same count and both write `count + 1`, losing an increment.

**Fix:** Use `SET ai_generations_this_month = ai_generations_this_month + 1` directly.

### 7. `consultations` Table Has Legacy JSONB + Flat Column Duplication (LOW-MEDIUM)
**File:** `schema_postgres.sql` lines 664-670

The consultations table has both:
- JSONB columns: `contact_info`, `business_context`, `pain_points`, `goals_objectives`
- Flat columns: `business_name`, `contact_person`, `email`, etc.

The TODO comment says to migrate SvelteKit to use JSONB columns and remove flat columns. However, the SvelteKit remote functions exclusively use the flat columns and the Go backend uses the JSONB columns. This means **the same consultation has two independent representations of the same data** that are never synchronized.

If a consultation is created via SvelteKit, the JSONB columns remain `'{}'`. If created via Go, the flat columns remain NULL. Neither service writes to both sets.

### 8. `subscriptions` Table is User-Scoped, Not Agency-Scoped (LOW-MEDIUM)
**File:** `schema_postgres.sql` lines 1258-1272

The `subscriptions` table references `user_id`, not `agency_id`. The billing system (in `billing.remote.ts`) operates at the agency level with `stripe_customer_id` on the `agencies` table. This creates two parallel subscription tracking systems:
1. Agency-level: `agencies.subscription_tier`, `agencies.subscription_id`, `agencies.stripe_customer_id`
2. User-level: `subscriptions` table with `user_id`, `stripe_customer_id`, `stripe_subscription_id`

The `subscriptions` table appears to be a legacy artifact from before multi-tenancy was added. It is not referenced in any Drizzle schema table definition, nor in any remote function.

### 9. `questionnaire_responses` Table Not in Drizzle Schema (LOW)
The `questionnaire_responses` table exists in `schema_postgres.sql` and the Go models, but has no corresponding Drizzle schema definition in `schema.ts`. If SvelteKit ever needs to query this table, it would need to be added. The Go model exists (`QuestionnaireResponse` struct), suggesting it may be accessed by the Go backend.

---

## Opportunities

### 1. Add Database-Level Row-Level Security (RLS)
Currently, tenant isolation relies entirely on application code (`withAgencyScope()`, `getAgencyContext()`). If any developer forgets to scope a query by `agency_id`, data leaks between tenants.

PostgreSQL Row-Level Security could provide a defense-in-depth layer:
```sql
ALTER TABLE consultations ENABLE ROW LEVEL SECURITY;
CREATE POLICY agency_isolation ON consultations
    USING (agency_id = current_setting('app.current_agency_id')::uuid);
```

This would catch missing `WHERE agency_id = ...` clauses at the database level.

### 2. Use Database Sequences for Document Numbers
Replace the application-level read-then-write pattern with database sequences:
```sql
CREATE SEQUENCE IF NOT EXISTS proposal_number_seq_<agency_id>;
SELECT nextval('proposal_number_seq_<agency_id>');
```
Or simpler: use `UPDATE ... RETURNING` in a single statement to atomically increment and return.

### 3. Add `updated_at` Trigger
Many tables have `updated_at` columns that are manually set in application code. A database trigger would ensure consistency:
```sql
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;
```

### 4. Consolidate Status Enums into PostgreSQL ENUM Types
Currently, status values are stored as `VARCHAR` with CHECK constraints. PostgreSQL ENUM types would be more space-efficient and provide the same validation:
```sql
CREATE TYPE proposal_status AS ENUM ('draft', 'ready', 'sent', 'viewed', 'accepted', ...);
```
This is a low-priority optimization but improves documentation and storage efficiency.

### 5. Add `agency_id` to Legacy Tables
Tables like `files`, `emails`, `email_attachments`, `notes`, and `tokens` pre-date multi-tenancy and only have `user_id`. Adding `agency_id` would allow proper tenant-scoped queries and eventual data export/deletion for GDPR.

### 6. Schema Validation CI Step
Add a CI check that compares the Go `schema_postgres.sql`, the Drizzle `schema.ts`, and the cumulative effect of all migrations to detect drift. This could be a simple script that applies all migrations to a fresh DB and diffs against the Go schema.

### 7. Soft Delete for Documents
Contracts, invoices, and proposals are hard-deleted (`DELETE FROM ...`). For a business application dealing with legal documents, soft delete (with `deleted_at` column) would be safer and support audit requirements. The `agencies` table already has `deleted_at` for GDPR compliance -- the same pattern could extend to documents.

---

## Risks

### 1. CRITICAL: Public Endpoints Lack Rate Limiting at DB Level
**Files:** `proposals.remote.ts` (acceptProposal, declineProposal, requestProposalRevision, recordProposalView)

These public endpoints operate by slug with no authentication:
- `acceptProposal` -- creates a contract as a side effect
- `recordProposalView` -- increments `view_count` with `sql\`${proposals.viewCount} + 1\``
- `declineProposal`, `requestProposalRevision`

There is no rate limiting, CAPTCHA, or abuse prevention. An attacker who discovers a proposal slug could:
- Spam `recordProposalView` to inflate view counts
- Call `acceptProposal` to auto-generate contracts without the client's consent
- Call `declineProposal` to reject proposals the client hasn't seen

The slug is a 12-character nanoid (62^12 = ~3.2 * 10^21 possibilities), making brute force infeasible, but slug exposure through email links, browser history, or referrer headers is realistic.

### 2. HIGH: `next_*_number` Counters Can Produce Duplicates Under Load
As detailed in Weakness #5, the proposal/contract/invoice number generators use a non-atomic read-then-write pattern. In production, two users creating proposals simultaneously for the same agency will get duplicate numbers. The database has no unique constraint on `(agency_id, proposal_number)`, so duplicates will be silently created.

**Impact:** Duplicate document numbers in a business context cause confusion, legal issues, and accounting errors.

### 3. HIGH: Cascade Delete on `agencies` Deletes All Business Data
All child tables use `ON DELETE CASCADE` from `agencies(id)`. Deleting an agency row will cascade-delete:
- All consultations, proposals, contracts, invoices, and their line items
- All client records
- All form submissions and responses
- All email logs and audit trail entries
- All team memberships

While the `deleted_at`/`deletion_scheduled_for` soft-delete columns exist on `agencies`, there is no database-level protection against a hard DELETE. If a bug or admin action triggers `DELETE FROM agencies WHERE id = ...`, all agency data is irrecoverably lost.

**Mitigation:** Consider adding a trigger that prevents DELETE on `agencies` unless `deletion_scheduled_for` has passed, or use a separate archive process.

### 4. MEDIUM: Banking Information Stored in Plain Text
**File:** `agency_profiles` table -- columns `bsb`, `account_number`, `account_name`, `tax_file_number`

Bank account details and tax file numbers are stored as plain `VARCHAR`/`TEXT` columns. While these are not as sensitive as credit card numbers (which are handled by Stripe), they are still PII/financial data that should ideally be encrypted at rest at the application level, not just at the PostgreSQL disk level.

### 5. MEDIUM: No Foreign Key on `form_submissions.proposal_id` and `form_submissions.contract_id`
**File:** `schema_postgres.sql` line 587-588

```sql
proposal_id uuid,
contract_id uuid,
```

These are bare UUID columns with no foreign key constraint. Orphaned references are possible if proposals or contracts are deleted. The Drizzle schema does not define FK references for these either (only `proposalId: uuid("proposal_id")` without `.references()`).

### 6. MEDIUM: `consultations.status` CHECK Constraint Mismatch
**Go schema:** `CHECK (status IN ('draft', 'completed', 'archived'))`
**Drizzle schema type:** `'draft' | 'completed' | 'converted'`

The Drizzle TypeScript type includes `'converted'` but the database CHECK constraint only allows `'draft', 'completed', 'archived'`. If SvelteKit tries to set status to `'converted'`, the database will reject it.

### 7. LOW: `agency_activity_log` Uses `ON DELETE CASCADE` from `agencies`
When an agency is deleted, its entire audit trail is cascade-deleted too. For compliance purposes, audit logs should typically be retained even after the entity is deleted. Consider `ON DELETE SET NULL` for `agency_id` or a separate retention policy.

---

## Summary Metrics

| Category | Count |
|----------|-------|
| Tables in migrations | ~30 |
| Tables in Drizzle schema | 22 |
| Tables in Go schema | 30 |
| Migration files | 9 |
| Foreign key constraints | 40+ |
| CHECK constraints | 10+ |
| Indexes | 80+ |
| Critical risks | 1 |
| High risks | 2 |
| Medium risks | 4 |
| Low risks | 1 |

---

## Priority Recommendations

1. **Immediate:** Fix document number race conditions with atomic `UPDATE ... RETURNING` queries
2. **Immediate:** Add rate limiting middleware to public slug-based endpoints
3. **Short-term:** Add unique constraint on `(agency_id, proposal_number)`, `(agency_id, contract_number)`, `(agency_id, invoice_number)`
4. **Short-term:** Fix `consultations.agency_id` to be NOT NULL via migration
5. **Short-term:** Add missing FK constraints on `form_submissions.proposal_id` and `form_submissions.contract_id`
6. **Medium-term:** Resolve the dual JSONB/flat column situation on `consultations` table
7. **Medium-term:** Remove or repurpose the legacy `subscriptions` table
8. **Medium-term:** Add `questionnaire_responses` to Drizzle schema if SvelteKit needs it
9. **Long-term:** Implement Row-Level Security as defense-in-depth for multi-tenancy
10. **Long-term:** Encrypt sensitive financial data (BSB, account numbers, TFN) at application level
