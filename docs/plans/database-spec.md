# Database & Data Integrity Spec Plan

**Date:** 2026-02-07
**Source:** `docs/reviews/database-review.md`, `docs/COMPREHENSIVE-APPRAISAL.md`

---

## 1. Fix Document Number Race Conditions

**Priority:** P0 (before payments) | **Effort:** 2-4 hrs

**Issue:** `getNextProposalNumber`, `getNextContractNumber`, and all invoice creation paths use read-then-write pattern. Two concurrent requests read same `next_*_number`, produce duplicate document numbers.

**Current State:**

- `service-client/src/lib/api/proposals.remote.ts:199-225` -- reads `nextProposalNumber`, generates number, then writes `nextProposalNumber + 1` in separate query
- `service-client/src/lib/api/contracts.remote.ts:142-168` -- identical pattern for contracts
- `service-client/src/lib/api/invoices.remote.ts` -- same pattern at lines ~535, ~677, ~905, ~1188, ~1255 (5 separate call sites!)

```typescript
// CURRENT (race-prone)
const nextNumber = profile?.nextProposalNumber || 1;
const proposalNumber = generateDocumentNumber(prefix, nextNumber);
await db.update(agencyProfiles).set({ nextProposalNumber: nextNumber + 1 })...;
```

**Proposed Fix:**

A. Create a shared atomic helper in `service-client/src/lib/server/document-numbers.ts`:

```typescript
import { sql } from "drizzle-orm";
import { db } from "$lib/server/db";

export async function getNextDocumentNumber(
  agencyId: string,
  type: 'proposal' | 'contract' | 'invoice'
): Promise<{ prefix: string; number: number }> {
  const column = {
    proposal: 'next_proposal_number',
    contract: 'next_contract_number',
    invoice: 'next_invoice_number',
  }[type];

  const prefixColumn = {
    proposal: 'proposal_prefix',
    contract: 'contract_prefix',
    invoice: 'invoice_prefix',
  }[type];

  const [result] = await db.execute(sql`
    UPDATE agency_profiles
    SET ${sql.identifier(column)} = ${sql.identifier(column)} + 1
    WHERE agency_id = ${agencyId}
    RETURNING ${sql.identifier(column)} - 1 AS current_number,
              ${sql.identifier(prefixColumn)} AS prefix
  `);

  if (!result) throw new Error('Agency profile not found');
  return {
    prefix: result.prefix || type.toUpperCase().slice(0, 4),
    number: result.current_number,
  };
}
```

B. Replace all 7+ call sites in proposals.remote.ts, contracts.remote.ts, invoices.remote.ts.

C. Remove standalone `getNextProposalNumber` and `getNextContractNumber` functions.

**Dependencies:** None

---

## 2. Add Unique Constraints on Document Numbers

**Priority:** P1 (before launch) | **Effort:** 1-2 hrs

**Issue:** No DB-level uniqueness on `(agency_id, proposal_number)`, `(agency_id, contract_number)`, `(agency_id, invoice_number)`. Duplicates silently created.

**Current State:**

- `proposals` table: index `idx_proposals_slug` exists, no unique on `(agency_id, proposal_number)`
- `contracts` table: no such constraint
- `invoices` table: index `idx_invoices_number ON invoices(agency_id, invoice_number)` exists but NOT unique
- Go schema (`schema_postgres.sql`): same -- no unique constraints on doc numbers

**Proposed Fix:** New migration `010_add_document_number_constraints.sql`:

```sql
-- Unique constraints on document numbers per agency
-- Safe: first deduplicate any existing dupes (unlikely in dev)
ALTER TABLE proposals
ADD CONSTRAINT proposals_agency_number_unique
UNIQUE (agency_id, proposal_number);

ALTER TABLE contracts
ADD CONSTRAINT contracts_agency_number_unique
UNIQUE (agency_id, contract_number);

ALTER TABLE invoices
ADD CONSTRAINT invoices_agency_number_unique
UNIQUE (agency_id, invoice_number);
```

Must wrap in DO block with IF NOT EXISTS check for idempotency:
```sql
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'proposals_agency_number_unique') THEN
    ALTER TABLE proposals ADD CONSTRAINT proposals_agency_number_unique UNIQUE (agency_id, proposal_number);
  END IF;
  -- repeat for contracts, invoices
END $$;
```

Update Drizzle schema `schema.ts` to add matching unique constraints on proposals, contracts, invoices tables.

**Dependencies:** Item #1 (fix race condition first, then add constraint)

---

## 3. Fix Schema Drift Between Go, Drizzle, and Migrations

**Priority:** P1 (before launch) | **Effort:** 4-6 hrs (revised from 2-3 hrs — see audit note below)

**Issue:** Three schema sources drift. The drift is primarily **column-level** (types, nullability, constraints, missing columns) rather than table-level. Table-level divergence between Go and Drizzle is intentional — each backend only defines tables it queries.

**Audit correction (2026-02-09):** The original roadmap claimed "5 mismatches, 2-3 hrs". Independent verification found 5+ confirmed column-level mismatches plus the need to document the intentional table-level split. The table-level divergence (~10 tables exist in Go but not Drizzle, and vice versa) is by design and should be documented, not fixed. The column-level drift is the real risk and requires migrations + Go schema updates + sqlc regeneration.

**BLOCKER:** Atlas workflows MUST be removed before running any migrations in this item. See execution-roadmap "BLOCKER: Remove Legacy Atlas Workflows" section. If Atlas fires after these migrations, it could revert them.

### Confirmed column-level mismatches:

| Column | Go Schema | Drizzle Schema | DB (migrations) | Action |
|--------|-----------|---------------|-----------------|--------|
| `agency_activity_log.ip_address` | `inet` (line 190) | `text("ip_address")` (line 211) | `inet` (schema_postgres.sql:190) | Migrate DB to `text`. Update Go schema. SvelteKit is the primary writer; no Go code does inet-specific operations. |
| `consultations.agency_id` | nullable (line 661) | `.notNull()` (line 1158) | nullable (schema_postgres.sql:661) | Add migration to set NOT NULL. Update Go schema. |
| `email_logs.form_submission_id` | MISSING from Go schema | present in Drizzle (line 1106) | added in migration 004 | Add column to Go `schema_postgres.sql`. Regenerate sqlc. |
| `consultations.status` CHECK | `('draft','completed','archived')` | type `'draft'\|'completed'\|'converted'` | `('draft','completed','archived')` | Add `'converted'` to CHECK constraint. Both values valid — `archived` (Go legacy) and `converted` (SvelteKit active). |
| `clients` unique constraint | MISSING from Go schema | `unique().on(table.agencyId, table.email)` (line 523) | present in migration 005 | Add to Go schema. |

### Intentional table-level divergence (DOCUMENT ONLY — do not fix):

**Tables in Go schema but not Drizzle (~10):** `tokens`, `files`, `emails`, `email_attachments`, `notes`, `questionnaire_responses`, `subscriptions`, `form_field_options`, `form_submission_values`, `agency_form_options` (some of these). These are Go-only tables that SvelteKit doesn't query.

**Tables in Drizzle but not Go:** Minimal — the Go schema has been partially kept in sync and includes most SvelteKit tables. Any remaining gaps are tables Go doesn't query.

**Action:** Add a header comment block to `schema_postgres.sql` documenting this split (see execution-roadmap blocker section for the exact comment).

### Proposed Fix:

A. Migration `011_fix_schema_drift.sql`:

```sql
-- Fix ip_address column type to match Drizzle (text, not inet)
ALTER TABLE agency_activity_log ALTER COLUMN ip_address TYPE text;

-- Fix consultations.agency_id to NOT NULL
-- Only safe if no NULL values exist
DO $$ BEGIN
  UPDATE consultations SET agency_id = user_id WHERE agency_id IS NULL;
  ALTER TABLE consultations ALTER COLUMN agency_id SET NOT NULL;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Fix consultations.status CHECK to include both 'archived' and 'converted'
ALTER TABLE consultations DROP CONSTRAINT IF EXISTS valid_status;
ALTER TABLE consultations ADD CONSTRAINT valid_status
  CHECK (status IN ('draft', 'completed', 'archived', 'converted'));
```

B. Update Go `schema_postgres.sql`:
- Change `agency_activity_log.ip_address` from `inet` to `text`
- Add `form_submission_id` to `email_logs`
- Add `CONSTRAINT clients_agency_email_unique UNIQUE (agency_id, email)` to `clients`
- Fix `consultations.agency_id` to `NOT NULL`
- Add `'converted'` to `consultations.status` CHECK

C. Regenerate sqlc: `sh scripts/run_queries.sh postgres`

D. Add header comment to `schema_postgres.sql` documenting its role as sqlc-only reference.

**Dependencies:** Atlas workflows must be removed first (blocker).

---

## 4. Fix AI Generation Counter Race Condition

**Priority:** P1 (before launch) | **Effort:** 1 hr

**Issue:** `incrementAIGenerationCount()` reads count, then writes `count + 1`. Under concurrent AI generation requests, increments lost.

**Current State:** `service-client/src/lib/server/subscription.ts:338-370`

```typescript
// CURRENT (race-prone)
const currentCount = agency.aiGenerationsThisMonth ?? 0;
await db.update(agencies).set({
    aiGenerationsThisMonth: currentCount + 1,
})...;
```

**Proposed Fix:** Use atomic SQL increment:

```typescript
export async function incrementAIGenerationCount(agencyId: string): Promise<void> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // Atomic: reset if new month, otherwise increment
  await db.execute(sql`
    UPDATE agencies
    SET ai_generations_this_month = CASE
      WHEN ai_generations_reset_at IS NULL OR ai_generations_reset_at < ${startOfMonth}
      THEN 1
      ELSE ai_generations_this_month + 1
    END,
    ai_generations_reset_at = CASE
      WHEN ai_generations_reset_at IS NULL OR ai_generations_reset_at < ${startOfMonth}
      THEN ${now}
      ELSE ai_generations_reset_at
    END
    WHERE id = ${agencyId}
  `);
}
```

Single atomic UPDATE, no read needed.

**Dependencies:** None

---

## 5. Address CASCADE DELETE Risk on Agencies

**Priority:** P2 (quarterly) | **Effort:** 4-8 hrs

**Issue:** `DELETE FROM agencies WHERE id = X` cascade-deletes ALL consultations, proposals, contracts, invoices, clients, email logs, audit trail. No DB-level guard against accidental hard delete.

**Current State:** Every child table uses `ON DELETE CASCADE` from `agencies(id)`. Soft delete columns exist (`deleted_at`, `deletion_scheduled_for`) but nothing prevents a hard DELETE.

**Proposed Fix:**

A. Add a trigger that blocks DELETE unless `deletion_scheduled_for` has passed:

```sql
CREATE OR REPLACE FUNCTION prevent_premature_agency_deletion()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.deletion_scheduled_for IS NULL
     OR OLD.deletion_scheduled_for > NOW() THEN
    RAISE EXCEPTION 'Cannot delete agency before scheduled deletion date. Use soft delete first.';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_agency_deletion
BEFORE DELETE ON agencies
FOR EACH ROW EXECUTE FUNCTION prevent_premature_agency_deletion();
```

B. Change `agency_activity_log` FK to `ON DELETE SET NULL` instead of CASCADE (preserve audit trail after deletion).

**Dependencies:** None

---

## 6. Encrypt Banking Info

**Priority:** P2 (quarterly) | **Effort:** 1-2 days

**Issue:** `agency_profiles` stores BSB, account number, account name, TFN as plain text.

**Current State:** `service-client/src/lib/server/schema.ts:291-293`, `schema_postgres.sql:309-313`

```typescript
bsb: varchar("bsb", { length: 10 }).notNull().default(""),
accountNumber: varchar("account_number", { length: 30 }).notNull().default(""),
taxFileNumber: varchar("tax_file_number", { length: 20 }).notNull().default(""),
```

**Proposed Fix:**

A. Application-level encryption using `pgcrypto` or Node.js `crypto`:
- Encrypt on write, decrypt on read
- Store encrypted values in existing columns (increase varchar lengths)
- Use environment variable for encryption key

B. Simpler alternative: Use PostgreSQL `pgcrypto` extension:
```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
-- Then encrypt/decrypt in app layer using AES-256
```

C. Add encrypt/decrypt helpers in `service-client/src/lib/server/crypto.ts`.

D. Migrate existing plaintext values to encrypted.

**Dependencies:** Encryption key management (env var or secrets manager)

---

## 7. Remove Legacy User-Level Payment System

**Priority:** P1 (Wave 2) | **Effort:** 2-3 hrs
**Decision (2026-02-08): REMOVE. Confirmed dead code via codebase investigation.**

**Issue:** Entire user-level subscription system (`domain/payment/`, `/payments-*` routes, `subscriptions` table, user-level Stripe fields) is legacy code from before agency-based billing. Zero frontend calls. Env vars commented out.

**Scope of removal (in order):**
1. Delete Go routes in `server.go` (lines 32-40)
2. Delete `domain/payment/` directory (service.go, provider.go, provider_stripe.go, provider_local.go)
3. Delete `rest/payment_route.go`
4. Remove sqlc queries for subscriptions from `query_postgres.sql`
5. Regenerate sqlc: `sh scripts/run_queries.sh postgres`
6. Migration: `DROP TABLE IF EXISTS subscriptions;`
7. Migration: Remove `customer_id`, `subscription_id`, `subscription_end` from `users` table (most disruptive, do last)
8. Clean up auth permission constants (`BasicPlan`, `PremiumPlan`, `GetPayments`, `CreatePayment`)
9. Remove commented-out env vars (`STRIPE_PRICE_ID_BASIC`, `STRIPE_PRICE_ID_PREMIUM`)

**Pre-removal verification:**
- Grep for `BasicPlan`/`PremiumPlan` in auth middleware -- confirm not gating features
- Check production: `SELECT COUNT(*) FROM subscriptions;` and `SELECT COUNT(*) FROM users WHERE subscription_id != '';`

**What to keep:** Agency-level billing (`domain/billing/`, `/api/v1/billing/*`, `agencies.subscription_*` columns) is actively used and unaffected

---

## 8. Row-Level Security for Multi-Tenancy

**Priority:** P2 (quarterly) | **Effort:** 2-3 days

**Issue:** Tenant isolation relies entirely on application code (`withAgencyScope()`, `getAgencyContext()`). Missed `WHERE agency_id = ...` leaks data between tenants.

**Current State:** No RLS policies exist. All isolation is app-level.

**Proposed Fix:**

A. Create a DB role for application connections:
```sql
CREATE ROLE webapp_user;
```

B. Enable RLS on all agency-scoped tables and create policies:
```sql
ALTER TABLE consultations ENABLE ROW LEVEL SECURITY;
CREATE POLICY agency_isolation ON consultations
  USING (agency_id = current_setting('app.current_agency_id')::uuid);
-- Repeat for: proposals, contracts, invoices, clients, form_submissions,
-- agency_packages, agency_addons, email_logs, agency_activity_log, etc.
```

C. Set session variable on each DB connection:
```typescript
await db.execute(sql`SET app.current_agency_id = ${agencyId}`);
```

D. Needs careful testing -- must not break admin/super-admin queries.

**Dependencies:** Connection pooling strategy (SET per-transaction vs per-connection)

---

## 9. Dual JSONB + Flat Columns on Consultations

**Priority:** P3 (defer) | **Effort:** Minimal now, 1-2 days when cleaning up Go code
**Decision (2026-02-08): DO NOTHING NOW. Deprecate Go consultation code later.**

**Issue:** `consultations` table has JSONB columns (`contact_info`, `business_context`, `pain_points`, `goals_objectives`) for Go backend AND flat columns (`business_name`, `email`, `industry`, etc.) for SvelteKit.

**Key finding (2026-02-08 investigation):** This is NOT a "two backends writing the same record" problem. Go consultation endpoints are completely unused by the frontend. SvelteKit handles ALL consultation CRUD via Drizzle using flat columns. The 39+ Go JSONB queries are orphaned -- no active code path reaches them from the UI. The data coherence risk is theoretical, not active.

**Action plan:**
1. **Wave 1/2:** Do nothing. Not causing bugs, no active conflict
2. **Wave 2-3:** Mark Go consultation routes as deprecated in `server.go`. Optionally add logging middleware to confirm no external caller
3. **Wave 3:** Remove Go consultation code (`domain/consultation/`, sqlc queries, handler). JSONB columns become inert. Drop in a future migration
4. **Don't backfill.** All real consultations were created through SvelteKit -- nothing to migrate

**Worth salvaging (P3 feature):** Go's draft auto-save (`consultation_drafts`) and version history (`consultation_versions`) are genuinely useful UX patterns. The tables already exist but only have JSONB columns. Re-implement in SvelteKit as a future feature: add flat columns to draft/version tables, write SvelteKit remote functions for auto-save and version rollback. Use the Go implementation as a reference for the UX pattern.

**Dependencies:** None (no action needed now)

---

## 10. Additional Issues from Review

### 10a. Missing FK on `form_submissions.proposal_id` / `contract_id`

**Priority:** P1 | **Effort:** 30 min

**Current:** `schema_postgres.sql:586-587` -- bare `uuid` columns, no FK.
**Fix:**

```sql
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'form_submissions_proposal_id_fkey') THEN
    ALTER TABLE form_submissions ADD CONSTRAINT form_submissions_proposal_id_fkey
    FOREIGN KEY (proposal_id) REFERENCES proposals(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'form_submissions_contract_id_fkey') THEN
    ALTER TABLE form_submissions ADD CONSTRAINT form_submissions_contract_id_fkey
    FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE SET NULL;
  END IF;
END $$;
```

### 10b. `questionnaire_responses` Missing from Drizzle Schema

**Priority:** P2 | **Effort:** 30 min

**Current:** Table exists in Go schema (line 1214) and DB, not in `schema.ts`.
**Fix:** Add Drizzle table definition if SvelteKit needs to query it. Currently questionnaire remote functions exist in `questionnaire.remote.ts` -- check if they use raw SQL or a different approach.

---

## Resolved Questions (2026-02-07, updated 2026-02-09)

1. **ip_address type:** **Change DB to `text`.** SvelteKit is the primary writer of audit logs. Drizzle already uses `text("ip_address")`. No Go code does inet-specific operations (CIDR matching). Migration: `ALTER TABLE agency_activity_log ALTER COLUMN ip_address TYPE text;`

2. **Consultations JSONB vs flat (SUPERSEDED 2026-02-08/09):** ~~Go is HEAVILY using JSONB (39+ SQL queries).~~ **Correction:** While Go has 39+ JSONB queries defined, independent investigation confirmed these endpoints are completely unused by the frontend. Zero SvelteKit code calls the Go consultation routes. All consultation CRUD flows through Drizzle using flat columns. The Go JSONB system is orphaned dead code, not an active dependency. **See item #9 for the resolved action plan: do nothing now, deprecate Go consultation routes, remove later.**

3. **subscriptions table (SUPERSEDED 2026-02-08/09):** ~~Go backend DOES reference it. Cannot drop.~~ **Correction:** While Go code references the `subscriptions` table, the entire user-level payment system (`domain/payment/`, `/payments-*` routes) has zero frontend integration — no SvelteKit code calls these endpoints. Production verification confirmed: `subscriptions` table has 0 rows; `users` table has 1 row with subscription data (test account with empty strings and a 2000-01-01 placeholder date). **Decision: REMOVE.** See item #7 for ordered removal steps, now slotted into Wave 2 Stream I.

4. **RLS scope:** **Use restricted role for app connections, keep superuser for admin/migrations.** Create `webapp_user` role for SvelteKit and Go connections. Keep `webkit` superuser for migrations and admin queries. RLS policies apply to `webapp_user` only. Super-admin bypasses RLS via superuser connection.

5. **Encryption key rotation:** **No. Start with single static AES-256 key via env var.** Key rotation adds significant complexity (dual-key decryption, re-encryption migration). Add rotation support at 200+ agency milestone or when compliance requires it.

### Additional Resolutions

**Item #10b (questionnaire_responses):** **RESOLVED -- not needed.** `questionnaire.remote.ts` does not exist. Questionnaire system was deprecated in Phase 9 (commit `c5a237c`). `formSubmissions` table has replaced `questionnaire_responses`. Can drop the Go schema table in a future migration.

**Atlas workflows (2026-02-09 audit):** Three CI/CD workflows (`release.yml`, `migration.yml`, `pr-preview.yml`) plus two scripts (`scripts/atlas.sh`, `consultation-domain.yml`) use `atlas schema apply` — directly violating CLAUDE.md line 470. These must be removed before any Wave 2 migration work. See execution-roadmap "BLOCKER" section for full details.

**Schema drift scope (2026-02-09 audit):** Item #3 originally claimed "5 mismatches, 2-3 hrs". Actual scope: 5+ confirmed column-level mismatches (effort revised to 4-6 hrs) plus intentional table-level divergence that should be documented, not fixed. See item #3 for corrected details.
