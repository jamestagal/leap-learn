# Wave 3 — Stream N: Database Architecture (Agent Prompt)

**Scope:** Database integrity fixes, Go dead code removal, and schema cleanup.
**RLS is OUT OF SCOPE.** Row-Level Security has been deferred to Wave 4 entirely. Do not implement RLS policies, do not create database roles for RLS, do not modify any connection configuration for RLS. The rationale is documented below.

---

## RLS Deferral Rationale (Wave 4, not Wave 3)

RLS was originally scoped as a 2-3 day item in Stream N. After thorough review, it is deferred because:

1. **Application-level tenant isolation is already solid.** All 21 remote function files in `service-client/src/lib/api/*.remote.ts` use `getAgencyContext()` or `getAgencyId()` to scope every query. The `withAgencyScope()` helper in `db-helpers.ts` enforces this. There are zero known bypass paths.

2. **RLS complexity is underestimated at 2-3 days.** Proper RLS requires:
   - Creating a new `webapp_user` PostgreSQL role
   - Configuring every database connection (SvelteKit Drizzle pool + Go sqlc pool) to `SET app.current_agency_id = '<id>'` on each request
   - Writing `CREATE POLICY` statements for 20+ tables
   - Testing every query path under the restricted role
   - Handling the super-admin bypass case (migrations, admin queries)
   - Realistic estimate: 5-7 days including testing

3. **Silent failure mode is dangerous.** If RLS is misconfigured, queries silently return zero rows instead of throwing errors. This can appear as "working" in development but break production flows in subtle ways (e.g., dashboard shows zero consultations, proposals appear empty). This is harder to debug than an application-level error.

4. **No immediate security gap.** RLS is defense-in-depth — it protects against bugs in the application layer. Since the application layer is consistent and well-tested, the risk of a tenant isolation breach before Wave 4 is low.

**Do not include any RLS work in this stream. It will be properly scoped in Wave 4 with dedicated time and testing.**

---

## Items In Scope (6 items)

### 1. CASCADE Delete Protection (4-6 hrs)

**Problem:** `consultations.userId` has `onDelete: "cascade"` (schema.ts line 1170). If a user row is deleted, ALL their consultations are silently destroyed — including the audit trail. Consultations are business records that should outlive user accounts.

**Fix:**
```sql
-- Migration: 0XX_fix_cascade_delete_protection.sql
ALTER TABLE consultations DROP CONSTRAINT IF EXISTS consultations_user_id_users_id_fk;
ALTER TABLE consultations ADD CONSTRAINT consultations_user_id_users_id_fk
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;

-- Also make userId nullable since SET NULL requires it
ALTER TABLE consultations ALTER COLUMN user_id DROP NOT NULL;
```

**Then update Drizzle schema** (`service-client/src/lib/server/schema.ts` line 1168-1170):
```typescript
// Change from:
userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
// To:
userId: uuid("user_id")
    .references(() => users.id, { onDelete: "set null" }),
```

**CRITICAL: After changing userId to nullable, grep the entire codebase for code that assumes `consultation.userId` is non-null.** Check:
- All `.remote.ts` files that query consultations
- Any `.where(eq(consultations.userId, ...))` — these still work with nullable
- Any destructuring like `const { userId } = consultation` that passes it to a function expecting `string` not `string | null`
- The Go schema (`app/service-core/storage/schema_postgres.sql`) — update the column definition there too for sqlc consistency, even though Go consultation code is being removed (item #3)

**Also audit these other CASCADE relationships while you're at it:**
- `consultations.agencyId` → CASCADE is **correct** (agency deletion should cascade)
- `proposals.agencyId` → CASCADE is **correct**
- `contracts.agencyId` → CASCADE is **correct**
- `invoices.agencyId` → CASCADE is **correct**
- `formSubmissions.formId` → CASCADE is **correct** (form deletion removes its submissions)
- Verify no other `userId` foreign keys have CASCADE where they shouldn't

### 2. Context Key Collision Fix (15 min)

**Problem:** `app/service-core/rest/middleware.go` line 34 uses a string literal `"user"` as a context key:
```go
ctx := context.WithValue(r.Context(), "user", user)
```
And retrieval at line ~298:
```go
user, ok := r.Context().Value("user").(*auth.AccessTokenClaims)
```

String keys risk collision with other packages that might use `"user"` as a context key.

**Fix:** Add a typed context key constant:
```go
// At the top of middleware.go (or in a shared package)
type contextKey string
const userContextKey contextKey = "user"
```
Then replace both the `context.WithValue` call and the `Value()` retrieval to use `userContextKey` instead of `"user"`.

### 3. Remove Go Consultation Dead Code (1-2 days) ⚠️ MOST COMPLEX ITEM

**Background:** The Go consultation endpoints are confirmed dead code — zero frontend calls reach them. All consultation CRUD goes through SvelteKit remote functions. The deprecation comments were added in Wave 2 (server.go lines 57-58). Now it's time to remove the code.

**This is the most intricate item in Stream N. Follow this exact order:**

#### Step 3a: Remove routes from `server.go` (lines 57-81)
Delete all consultation route registrations — both bare paths and `/api/v1/` paths. This is lines 57-81 of `app/service-core/rest/server.go`. Remove the deprecation comment block too.

#### Step 3b: Delete consultation handler files
- Delete `app/service-core/rest/consultation_handler.go`
- Delete `app/service-core/rest/consultation_handler_test.go`
- Delete `app/service-core/rest/consultation_integration_test.go`

#### Step 3c: Remove consultation from Handler struct
In `app/service-core/rest/handler.go`:
- Remove the `consultation` import (line 7: `"service-core/domain/consultation"`)
- Remove `consultationService` field from `Handler` struct (line 24)
- Remove `consultationService` parameter from `NewHandler()` (line 36)
- Remove `consultationService` assignment in the struct literal (line 47)

#### Step 3d: Remove consultation initialization from main.go
In `app/service-core/main.go`:
- Remove the `consultation` import (line 15)
- Remove lines 87-91 (consultationRepo, draftRepo, versionRepo, consultationService initialization)
- Remove line 102 (passing `consultationService` to `NewHandler`)

#### Step 3e: Delete the consultation domain package
Delete the entire directory: `app/service-core/domain/consultation/`
This contains 7 files (~153KB of dead code):
- `dto.go`, `inputs.go`, `model.go`, `repository.go`, `repository_test.go`, `service.go`, `service_test.go`

#### Step 3f: Remove consultation sqlc queries
- Delete `app/service-core/storage/consultation.sql` (the sqlc query file)
- Delete `app/service-core/storage/schema_consultation.sql`
- Delete `app/service-core/storage/schema_consultation_versions.sql`
- Delete `app/service-core/storage/schema_consultation_drafts.sql`
- **Keep** `app/service-core/storage/migrations/20260114000000_consultation_v2.sql` — this is a migration file, not a schema file. Never delete migrations.

#### Step 3g: Regenerate sqlc
Run `sh scripts/run_queries.sh postgres` to regenerate Go types. The generated files (`models.go`, `query_postgres.sql.go`) should no longer include consultation-related structs and queries.

#### Step 3h: Verify compilation
Run `cd app && go build ./...` to confirm no import errors or missing references. **This is where problems will surface.** Common issues:
- Other packages importing the consultation domain (grep for `"service-core/domain/consultation"` across all Go files)
- Test files referencing consultation types
- The storage layer may have shared query files that reference consultation tables

**⚠️ Import cleanup is the hardest part.** After deleting the domain package, the Go compiler will tell you exactly which files still reference it. Fix each one. Do NOT leave commented-out imports — delete them cleanly.

### 4. Duplicate Route Cleanup (2-4 hrs)

**Problem:** `server.go` registers routes at both bare paths and `/api/v1/` paths. The frontend uses only `/api/v1/` for programmatic calls. Bare paths are used by auth form actions only.

**What to REMOVE (bare path duplicates):**
```
Line 42: mux.HandleFunc("/emails", ...)
Line 46: mux.HandleFunc("/files", ...)
Line 47: mux.HandleFunc("/files/{id}", ...)
Line 52: mux.HandleFunc("/notes", ...)
Line 53: mux.HandleFunc("/notes/{id}", ...)
```

**What to KEEP (bare auth paths — used by form actions):**
```
Lines 17-22: /refresh, /logout, /login, /login-callback/{provider}, /login-phone, /login-verify
```

**What to KEEP (API v1 paths):**
```
Lines 25-30: /api/v1/refresh, /api/v1/logout, etc.
Lines 33-39: /api/v1/billing/*
Lines 43, 48-49, 54-55: /api/v1/emails, /api/v1/files/*, /api/v1/notes/*
```

**Note:** The consultation routes (lines 57-81) will already be removed in item #3, so you don't need to handle those here.

**After removing bare routes, verify:**
- `grep -r '"/emails"' service-client/` — make sure no SvelteKit code calls the bare `/emails` path
- `grep -r '"/files"' service-client/` — same for files
- `grep -r '"/notes"' service-client/` — same for notes
- All should be using `/api/v1/` prefix

### 5. Drop Orphaned JSONB Columns (30 min)

**Prerequisite:** Item #3 (Go consultation code removal) MUST be complete first. The Go code references these JSONB columns — removing them before the Go code would break compilation.

**Columns to DROP** (legacy Go-backend JSONB from `consultations` table):
```sql
-- Migration: 0XX_drop_orphaned_jsonb_columns.sql
ALTER TABLE consultations DROP COLUMN IF EXISTS contact_info;
ALTER TABLE consultations DROP COLUMN IF EXISTS business_context;
ALTER TABLE consultations DROP COLUMN IF EXISTS pain_points;
ALTER TABLE consultations DROP COLUMN IF EXISTS goals_objectives;
```

**Columns to KEEP** (actively used array JSONB by SvelteKit):
- `primary_challenges` (jsonb, string array)
- `primary_goals` (jsonb, string array)
- `design_styles` (jsonb, string array)
- `admired_websites` (jsonb, string array)
- `performance_data` (jsonb, object)
- `custom_data` (jsonb, object)

**Update Drizzle schema:** Remove the 4 dropped columns from `service-client/src/lib/server/schema.ts` if they exist there. They may already be absent from Drizzle (since SvelteKit uses flat columns), but verify.

**Update Go schema:** Remove the 4 columns from `app/service-core/storage/schema_postgres.sql`. Then regenerate sqlc: `sh scripts/run_queries.sh postgres`.

### 6. Remove Dead User Payment Code (2-4 hrs)

**Background (from unresolved-questions-answered.md, Database Q3):** The user-level `subscriptions` table and `domain/payment/` service are confirmed dead code. Zero frontend calls reach the `/payments-*` endpoints. The table has 0 rows in production. Agency-level billing at `/api/v1/billing/` is the only active subscription flow.

**Pre-removal check:** Before removing, grep for `BasicPlan` / `PremiumPlan` in auth middleware to confirm no feature gates depend on user-level subscription tiers.

**Removal order:**
1. Remove Go routes from `server.go` (if any `/payments-*` routes exist — check lines carefully, they may have been removed already)
2. Delete `app/service-core/domain/payment/` directory (if it exists)
3. Remove payment handler files from `app/service-core/rest/` (if they exist)
4. Remove sqlc queries referencing `subscriptions` table from `app/service-core/storage/query_postgres.sql`
5. Regenerate sqlc: `sh scripts/run_queries.sh postgres`
6. Create migration to drop the table:
```sql
-- Migration: 0XX_drop_subscriptions_table.sql
DROP TABLE IF EXISTS subscriptions;
-- Also clean up user-level subscription fields from users table:
ALTER TABLE users DROP COLUMN IF EXISTS subscription_id;
ALTER TABLE users DROP COLUMN IF EXISTS subscription_status;
ALTER TABLE users DROP COLUMN IF EXISTS subscription_plan;
ALTER TABLE users DROP COLUMN IF EXISTS subscription_expires_at;
```
7. Update Drizzle schema to remove any references to the `subscriptions` table
8. Remove `zod` if this was the last thing keeping it: `cd service-client && npm uninstall zod` (Zod is confirmed unused per architecture Q3)

---

## Execution Order

Items have dependencies. Execute in this order:

```
1. Context key fix (15 min)           — independent, quick win
2. CASCADE fix (4-6 hrs)              — independent, critical safety fix
3. Go consultation removal (1-2 days) — the big one, must complete before #5
4. Duplicate route cleanup (2-4 hrs)  — do after #3 since #3 modifies server.go
5. Drop JSONB columns (30 min)        — blocked by #3
6. Dead payment code removal (2-4 hrs) — independent of #3-5, can parallel with #4-5
```

Suggested grouping: Do #1 + #2 first (quick, high-impact). Then #3 (largest item). Then #4 + #5 + #6 in parallel or sequence.

---

## Migration File Numbering

Check the current highest migration number in `/migrations/` and continue from there. As of Wave 2 completion, the highest is likely `015_*`. New migrations for this stream:
- `016_fix_cascade_delete_protection.sql` (item #1)
- `017_drop_orphaned_jsonb_columns.sql` (item #5)
- `018_drop_subscriptions_table.sql` (item #6)

**All migrations MUST be idempotent** — use `IF EXISTS` / `IF NOT EXISTS` / `DROP CONSTRAINT IF EXISTS`.

---

## Verification Checklist

After all items are complete:

- [ ] `cd app && go build ./...` compiles with zero errors
- [ ] `cd service-client && npm run check` passes type checking
- [ ] `grep -r "domain/consultation" app/` returns zero results
- [ ] `grep -r "domain/payment" app/` returns zero results
- [ ] No bare routes remain for `/emails`, `/files`, `/notes`, `/consultations` in server.go
- [ ] Bare auth routes (`/login`, `/logout`, `/refresh`, etc.) still present in server.go
- [ ] `/api/v1/billing/*` routes untouched
- [ ] Context key uses typed constant, not string literal
- [ ] `consultations.userId` foreign key is SET NULL, not CASCADE
- [ ] `consultations.user_id` column is nullable
- [ ] 4 legacy JSONB columns (contact_info, business_context, pain_points, goals_objectives) are dropped
- [ ] Array JSONB columns (primary_challenges, primary_goals, design_styles, admired_websites) still present
- [ ] sqlc regenerated after schema changes: `sh scripts/run_queries.sh postgres`
- [ ] No RLS policies created (RLS is Wave 4)
- [ ] Migration files are idempotent
- [ ] No migration files were deleted (only schema/query files)

---

## What This Stream Does NOT Touch

- **RLS policies** — deferred to Wave 4
- **PostgreSQL roles** — no new roles created (Wave 4)
- **Billing routes or code** — `/api/v1/billing/*` is untouched
- **Auth routes or code** — login/logout/refresh is untouched
- **Email/File/Note domain code** — only their duplicate bare routes are removed
- **SvelteKit remote functions** — no changes to any `.remote.ts` files (except checking userId nullability)
- **Migration files** — never delete existing migration files, only create new ones
