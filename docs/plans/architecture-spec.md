# Architecture & Code Quality Spec

**Date:** 2026-02-07
**Source:** `docs/reviews/architecture-review.md`, Architecture section of `docs/COMPREHENSIVE-APPRAISAL.md`

---

## 1. Fix Go Rate Limiter Thread Safety

**Priority:** P0 (before payments)
**Effort:** 1-2 hrs
**Dependencies:** None

**Issue:** `RateLimitMiddleware` in `app/service-core/rest/middleware.go:64-100` uses bare `map[string][]time.Time` (line 67) shared across goroutines. Go maps are not concurrent-safe -- will panic under load.

**Current State:**
```go
// middleware.go:67
clients := make(map[string][]time.Time)
// Accessed without any synchronization in the closure (lines 75-95)
```

No mutex, no sync.Map, no eviction. Map grows unbounded.

**Proposed Fix:**
1. Add `sync.Mutex` wrapping all map access in the closure
2. Add periodic eviction goroutine (every 5 min, purge IPs with no requests in last minute)
3. OR replace with `sync.Map` for simpler concurrency but keep eviction
4. Consider `http.MaxBytesReader` for body size limiting in `validateJSONInput` (line 213) while here

**Files:** `app/service-core/rest/middleware.go`

---

## 2. Set Reasonable BODY_SIZE_LIMIT

**Priority:** P0 (before payments)
**Effort:** 15 min
**Dependencies:** None

**Issue:** `service-client/Dockerfile:39` sets `BODY_SIZE_LIMIT=Infinity`. Enables DoS via large payloads.

**Current State:**
```dockerfile
CMD PORT=3000 BODY_SIZE_LIMIT=Infinity node build
```

**Proposed Fix:**
1. Change to `BODY_SIZE_LIMIT=10485760` (10MB) -- sufficient for logo uploads, PDF generation payloads
2. Also add `http.MaxBytesReader` to Go's `validateJSONInput` (`middleware.go:211-228`): wrap `r.Body` with `http.MaxBytesReader(w, r.Body, 10<<20)` before `io.ReadAll`

**Files:** `service-client/Dockerfile:39`, `app/service-core/rest/middleware.go:211-228`

---

## 3. Fix Go Email Validation

**Priority:** P0 (before payments)
**Effort:** 30 min
**Dependencies:** None

**Issue:** `isValidEmail` at `middleware.go:356-358` accepts `@.`, `a@b.`, etc. Only checks for presence of `@` and `.`.

**Current State:**
```go
func isValidEmail(email string) bool {
    return strings.Contains(email, "@") && strings.Contains(email, ".")
}
```

**Proposed Fix:**
1. Use `net/mail.ParseAddress()` from Go stdlib -- proper RFC 5322 validation
2. Add length check (max 254 chars per RFC)
3. Optionally add `net.LookupMX` for domain verification on critical paths

**Files:** `app/service-core/rest/middleware.go:356-358`

---

## 4. Address Dual-Database Access Pattern

**Priority:** P1 (before launch)
**Effort:** Ongoing (architectural decision)
**Dependencies:** Team alignment on direction

**Issue:** Both Go (`app/service-core/storage/query/`) via sqlc and SvelteKit (`service-client/src/lib/server/schema.ts`) via Drizzle query PostgreSQL directly. Different validation, auth, and business rules per codepath. Schema drift already exists (see database review).

**Current State:**
- Go handles: auth/login, billing/payments, consultations CRUD, emails, files, notes
- SvelteKit handles: all entity CRUD via remote functions, multi-tenancy, permissions
- Overlap: consultations are accessible from both paths

**Proposed Fix (Option A -- recommended, matches current trajectory):**
1. Audit which Go REST endpoints are still called by frontend (check `service-client/src/lib/server/http.ts` usage)
2. Migrate remaining Go data endpoints to SvelteKit remote functions (consultations, notes, files already mostly in SvelteKit)
3. Keep Go for: auth/login (JWT issuance), billing webhooks (Stripe verification), email sending (SMTP)
4. Go becomes auth + webhooks + background jobs only
5. Remove direct DB queries from Go for entities SvelteKit already handles

**Alternative (simpler, short-term):** Add CI step that compares Go schema, Drizzle schema, and migrations to flag drift. Use `diff` on column lists extracted from each.

**Files:** `app/service-core/rest/server.go` (route list), `service-client/src/lib/api/*.remote.ts` (remote functions)

---

## 5. Consolidate Validation Libraries (Zod vs Valibot)

**Priority:** P2 (quarterly)
**Effort:** 4-8 hrs
**Dependencies:** None

**Issue:** Two validation libraries in SvelteKit:
- `service-client/src/lib/server/validation.ts` -- Zod-based (lines 1, 81-120)
- `service-client/src/lib/server/http.ts` -- imports Zod types (line 4)
- All `.remote.ts` files -- Valibot-based (project standard per CLAUDE.md)

**Current State:** Zod used in `validation.ts` (ValidationChain, ApiResponseSchemas) and `http.ts` (HttpClient validateWith). Valibot used in all remote functions. Two libraries in bundle.

**Proposed Fix:**
1. Check if `validation.ts` and `http.ts` Zod features are actively used (grep for imports)
2. If unused: delete `validation.ts`, remove Zod from `http.ts`, uninstall `zod` from `package.json`
3. If used: rewrite `validation.ts` utilities with Valibot equivalents, update `http.ts` to accept Valibot schemas
4. Standardize on Valibot per CLAUDE.md conventions

**Files:** `service-client/src/lib/server/validation.ts`, `service-client/src/lib/server/http.ts`

---

## 6. Audit JWT Key Handling in CI/CD

**Priority:** P1 (before launch)
**Effort:** 2-4 hrs
**Dependencies:** None

**Issue:** CI/CD writes PEM keys to disk then COPYs into Docker image layers. Keys extractable from GHCR registry.

**Current State:**
- `.github/workflows/deploy-production.yml:41-42` writes secrets to `app/$service/private.pem`
- `app/service-core/Dockerfile:53-54` copies PEM files into prod image layer
- Keys cleaned from runner (line 71-72) but already in image layers

**Proposed Fix:**
1. Remove `COPY *.pem` from production Dockerfile stages
2. Pass keys as environment variables in `docker-compose.production.yml`:
   ```yaml
   environment:
     - JWT_PRIVATE_KEY=${JWT_PRIVATE_KEY}
     - JWT_PUBLIC_KEY=${JWT_PUBLIC_KEY}
   ```
3. Update Go auth service to read keys from env vars (base64-encoded) instead of files
4. Update SvelteKit to read public key from env var
5. Store keys as Docker secrets or env vars on VPS, not in image

**Files:** `app/service-core/Dockerfile:53-54`, `service-client/Dockerfile:10,23,36`, `.github/workflows/deploy-production.yml:38-47`, Go auth key loading code

---

## 7. Add Migration Rollback Strategy

**Priority:** P1 (before launch)
**Effort:** 4-8 hrs
**Dependencies:** None

**Issue:** Migrations are forward-only SQL. No tracking table, no down migrations, no CI execution. `scripts/run_migrations.sh` runs all files every time (relying on `IF NOT EXISTS`).

**Current State:**
- 9 migration files in `migrations/` -- all idempotent
- No `schema_migrations` table to track which have run
- No down/rollback files
- Manual execution via `scripts/run_migrations.sh`

**Proposed Fix:**
1. Add `schema_migrations` table (migration 010):
   ```sql
   CREATE TABLE IF NOT EXISTS schema_migrations (
     version TEXT PRIMARY KEY,
     applied_at TIMESTAMPTZ DEFAULT NOW()
   );
   ```
2. Update `run_migrations.sh` to check table before running each file, record after success
3. Add companion `*.down.sql` files for destructive migrations (new tables can use `DROP TABLE IF EXISTS`)
4. Add migration step to CI/CD deploy pipeline (after image push, before health check)
5. Short-term: at minimum, add pre-deploy `pg_dump` snapshot as rollback safety net

**Files:** `scripts/run_migrations.sh`, `migrations/` directory

---

## 8. Fix Internal Error Messages Leaking to Clients

**Priority:** P0 (before payments)
**Effort:** 1 hr
**Dependencies:** None

**Issue:** `writeResponse` default case at `server.go:247-252` returns raw `err.Error()` to client. Can expose DB errors, stack traces, implementation details.

**Current State:**
```go
// server.go:247-252
default:
    json.NewEncoder(w).Encode(map[string]interface{}{
        "success": false,
        "message": err.Error(),  // <-- leaks internals
        "code":    500,
    })
```

**Proposed Fix:**
1. Replace `err.Error()` with generic `"An internal error occurred"`
2. Keep `slog.Error("Error", "error", err)` on line 244 for server-side logging
3. Optionally add request ID to response for support correlation

**Files:** `app/service-core/rest/server.go:243-253`

---

## 9. Address Duplicate Route Registration

**Priority:** P2 (quarterly)
**Effort:** 2-4 hrs
**Dependencies:** Confirm which paths frontend uses

**Issue:** Every route registered twice in `server.go` -- once at `/path` and once at `/api/v1/path` (e.g., lines 17-30, 52-65, 68-81). Doubles attack surface and maintenance.

**Current State:** ~30 duplicate registrations in `server.go:12-93`. Frontend appears to use `/api/v1/` prefix based on billing routes (lines 43-49 are only `/api/v1/`).

**Proposed Fix:**
1. Grep frontend codebase for API URL patterns to confirm which prefix is used
2. If all frontend uses `/api/v1/`: remove bare `/path` routes
3. If mixed: update frontend to consistently use `/api/v1/`, then remove bare routes
4. Add redirect middleware from old paths to `/api/v1/` for transition period if needed

**Files:** `app/service-core/rest/server.go:12-93`

---

## 10. Evaluate NATS Complexity vs Current Usage

**Priority:** P2 (quarterly)
**Effort:** 2-4 hrs
**Dependencies:** None

**Issue:** NATS deployed as infrastructure dependency but only used in admin service for pub/sub notifications. 33 lines of code (`app/service-admin/pubsub/nats.go`). Adds operational complexity, restart risk (messages lost -- no persistence).

**Current State:**
- `app/service-admin/pubsub/nats.go` -- 33 lines, just connection setup
- `app/service-admin/pubsub/broker.go` -- broker abstraction
- Used only in admin service for SSE notifications
- NATS container in `docker-compose.yml`

**Proposed Fix (evaluate, don't rush):**
1. Audit actual pub/sub usage in admin service -- what events, what frequency
2. If only admin SSE notifications: replace with PostgreSQL LISTEN/NOTIFY (zero new infrastructure)
3. OR replace with simple HTTP polling / webhook pattern
4. If keeping NATS: enable JetStream for message persistence
5. Decision point: if planning to scale to multi-instance, keep NATS; if staying single-VPS, remove

**Files:** `app/service-admin/pubsub/nats.go`, `app/service-admin/pubsub/broker.go`, `docker-compose.yml`

---

## 11. Fix Context Key Collision Risk

**Priority:** P2 (quarterly)
**Effort:** 15 min
**Dependencies:** None

**Issue:** `middleware.go:32` uses bare string `"user"` as context key. Risks collision with other packages.

**Current State:**
```go
ctx := context.WithValue(r.Context(), "user", user)
// Retrieved at middleware.go:263
user, ok := r.Context().Value("user").(*auth.AccessTokenClaims)
```

**Proposed Fix:**
1. Define unexported key type:
   ```go
   type contextKey string
   const userContextKey contextKey = "user"
   ```
2. Update `WithValue` and `Value` calls to use typed key
3. Update `GetUserFromContext` (line 262) and `RequireAuth` (line 268)

**Files:** `app/service-core/rest/middleware.go:32,263`

---

## Summary Priority Table

| # | Issue | Priority | Effort | Blocked By |
|---|-------|----------|--------|------------|
| 1 | Rate limiter thread safety | P0 | 1-2 hrs | -- |
| 2 | BODY_SIZE_LIMIT | P0 | 15 min | -- |
| 3 | Email validation | P0 | 30 min | -- |
| 8 | Error message leaking | P0 | 1 hr | -- |
| 4 | Dual-DB access | P1 | Ongoing | Team decision |
| 6 | JWT keys in Docker layers | P1 | 2-4 hrs | -- |
| 7 | Migration rollback strategy | P1 | 4-8 hrs | -- |
| 5 | Zod/Valibot consolidation | P2 | 4-8 hrs | -- |
| 9 | Duplicate routes | P2 | 2-4 hrs | Frontend audit |
| 10 | NATS evaluation | P2 | 2-4 hrs | Scale decision |
| 11 | Context key collision | P2 | 15 min | -- |

**Total P0 effort: ~3-4 hrs**
**Total P1 effort: ~10-20 hrs (excluding dual-DB which is ongoing)**
**Total P2 effort: ~13-21 hrs**

---

## Resolved Questions (2026-02-07)

1. **Dual-DB direction:** **Yes, SvelteKit is primary. Go handles auth + billing + webhooks only.** Frontend actively calls only: Auth (`/login`, `/login-phone`, `/login-verify`, `/logout`, `/refresh`) and Billing (`/api/v1/billing/*` -- 6 endpoints). All entity CRUD (consultations, proposals, contracts, invoices, clients, forms, emails) is SvelteKit remote functions. Go consultation routes + `domain/consultation/` are legacy (frontend doesn't call them). **Note:** Go `domain/payment/service.go` handles user-level subscriptions via `/payments-*` routes -- evaluate if still needed.

2. **NATS future:** **No multi-instance planned. Single VPS is the plan.** Current trajectory targets 200 agencies before considering multi-instance. NATS used for exactly one thing: admin SSE notifications. No other use cases in code. Keep NATS as-is. Evaluate replacing with PostgreSQL LISTEN/NOTIFY at quarterly P2 review.

3. **Zod usage:** **Dead code. Safe to delete.** `validation.ts` imported only by `http.ts`. `http.ts` not imported by ANY file in codebase. Zero active usage. **Action:** Delete `validation.ts`, delete `http.ts`, `npm uninstall zod`.

4. **JWT key rotation:** **Not needed for launch.** Single RSA key pair is sufficient. When implemented later, use standard JWKS endpoint pattern with `kid` header. Env-var approach in #6 does not need dual-key support initially.

5. **Body size limit:** **10MB is safe.** Logo images are the largest payloads (base64 data URLs, up to ~2.7MB encoded). R2 migration (ui-ux-spec #9) will eliminate large base64 payloads. Until then, 10MB covers logos + PDF generation with margin. R2 bucket `webkit-files` already exists and is production-ready.

### Additional Resolution

**Item #9 (Duplicate routes):** **Frontend uses `/api/v1/` exclusively for programmatic calls.** Bare routes (`/login`, `/logout`, `/refresh`) used by form actions directly. **Action:** Remove bare route duplicates for endpoints also under `/api/v1/` (consultations, files, emails, notes). Keep bare auth routes since form actions post to them.
