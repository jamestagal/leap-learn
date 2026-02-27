# Architecture & Code Quality Review

**Date:** 2026-02-06
**Reviewer:** Architecture Review Agent
**Scope:** Full codebase -- service architecture, code quality, security, multi-tenancy, API design, DevOps

---

## Strengths

### 1. Well-Designed Multi-Tenancy Pattern

The shared-database with row-level isolation is the right choice for this stage of the product. Key positives:

- **`withAgencyScope()` wrapper** (`service-client/src/lib/server/db-helpers.ts`) provides a consistent, hard-to-bypass pattern for scoping queries. Centralizing tenant resolution in `getAgencyContext()` means queries can't accidentally forget the scope.
- **Unique constraints** on `(agency_id, slug)` pairs across packages, addons, and forms prevent cross-tenant collisions at the database level.
- **`verifyMembership()` and `verifyConsultationAccess()`** double-check ownership before returning data, providing defense-in-depth beyond query-level filtering.
- **Cascade deletes** (`onDelete: "cascade"`) on agency foreign keys ensure orphan data doesn't leak when an agency is removed.

### 2. Comprehensive Permission System

The permissions model in `service-client/src/lib/server/permissions.ts` is exceptionally well-structured:

- **Declarative permission matrix** -- all 60+ permissions defined in one constant, easily auditable.
- **`requirePermission()` guards** used consistently in remote functions before any data access.
- **Resource ownership helpers** (`canAccessResource`, `canModifyResource`, `canDeleteResource`) cleanly separate "view_all" vs "view_own" logic.
- **Role hierarchy** with numeric weights enables easy comparisons.

### 3. Thoughtful Authentication Architecture

- **EdDSA JWT** signing with separate public/private keys per service is a strong choice -- faster than RSA, more secure than HMAC.
- **Token refresh** is handled transparently in `hooks.server.ts` with proper error handling for both page requests and remote function calls.
- **Cookie security** correctly conditionalized on environment (`secure: isProduction`).
- **2FA flow** with session tokens and phone verification adds a meaningful security layer.

### 4. SvelteKit Remote Functions Pattern

The adoption of SvelteKit remote functions with Valibot validation is a strong architectural choice:

- **Schema-first validation** on every endpoint entry point.
- **Clear separation** between `.remote.ts` (client-callable) and `$lib/server/` (internal utilities).
- **Type-safe end-to-end** -- Drizzle schema types flow through to the remote function return values.
- **Consistent error handling** using SvelteKit's `error()` and `redirect()`.

### 5. Solid DevOps Foundation

- **Multi-stage Docker builds** with separate dev/build/prod targets.
- **Hot reload** in development via Air (Go) and SvelteKit's native dev server.
- **Health checks** on PostgreSQL with proper `depends_on` conditions.
- **Traefik** with automatic Let's Encrypt in production is mature infrastructure for a single-VPS deployment.
- **Matrix builds** in CI for parallel image creation across services.

### 6. GDPR Compliance Implementation

- **Data export** covers all major entity types with structured JSON output.
- **Soft delete with 30-day grace period** allows deletion cancellation.
- **Activity log anonymization** on agency deletion.
- **Audit trail** captures IP addresses, user agents, and before/after values.

### 7. Domain-Driven Design in Go Backend

The Go service-core follows clean architecture principles:

- **Domain layer** (`domain/`) with separate packages per business concept (billing, consultation, email, etc.).
- **Repository pattern** for consultation data access.
- **Service layer** with dependency injection via constructor functions.
- **Provider abstraction** for email, file storage, and payment -- enabling easy provider swaps.

---

## Weaknesses

### 1. Dual-Database Access Creates Consistency Risks (Critical)

**Both the Go backend (service-core) and SvelteKit frontend (service-client) connect directly to the same PostgreSQL database.** This is the single most concerning architectural issue.

- **service-core** uses sqlc-generated queries via `storage/query/`.
- **service-client** uses Drizzle ORM with its own schema definition in `$lib/server/schema.ts`.
- There is **no single source of truth** for data access -- a consultation can be created via the Go REST API **or** via SvelteKit remote functions with completely different validation, authorization, and business rules.
- **Schema drift risk** is acknowledged in CLAUDE.md ("Go schema is reference only") but remains dangerous. A migration that adds a column only to the Drizzle schema creates silent mismatches.
- **No database-level constraints** enforce business rules that are currently only in application code (e.g., subscription limits, member counts).

**Impact:** Data corruption, inconsistent business rule enforcement, and subtle bugs as the two codepaths diverge over time.

### 2. Rate Limiter Is In-Memory and Non-Thread-Safe (High)

The `RateLimitMiddleware` in `service-core/rest/middleware.go` uses an in-memory `map[string][]time.Time`:

```go
clients := make(map[string][]time.Time)
```

- **Not thread-safe** -- concurrent requests can cause data races on the map (Go maps are not safe for concurrent use).
- **Not distributed** -- only limits per-instance, useless in any multi-instance deployment.
- **No eviction** -- the map grows unbounded as new IPs arrive; only entries for a given IP are cleaned on that IP's next request.

**Impact:** Potential panics from map race conditions; ineffective rate limiting; memory leak in production.

### 3. Email Validation Is Trivially Bypassable (High)

In `service-core/rest/middleware.go`:

```go
func isValidEmail(email string) bool {
    return strings.Contains(email, "@") && strings.Contains(email, ".")
}
```

This accepts `@.`, `a@b.`, and many other invalid formats. The SvelteKit side uses Valibot's proper email validation, but the Go API accepts garbage data directly.

**Impact:** Invalid email addresses stored in the database; failed email deliveries; potential injection vectors.

### 4. Context Key Collision Risk (Medium)

In `service-core/rest/middleware.go`:

```go
ctx := context.WithValue(r.Context(), "user", user)
```

Using a bare string `"user"` as a context key violates Go best practices and risks key collisions with other middleware or libraries. Should use a custom unexported type as documented in the `context` package.

### 5. writeResponse() Leaks Internal Error Messages (Medium)

The default error case in `service-core/rest/server.go` returns `err.Error()` directly to the client:

```go
default:
    json.NewEncoder(w).Encode(map[string]interface{}{
        "success": false,
        "message": err.Error(),
        "code":    500,
    })
```

This can expose internal implementation details, stack traces, or database error messages to end users.

**Impact:** Information disclosure; potential security vulnerability.

### 6. Duplicate Route Registration (Low-Medium)

Every route in `service-core/rest/server.go` is registered twice -- once at `/path` and again at `/api/v1/path`:

```go
mux.HandleFunc("/consultations", apiHandler.handleConsultationsCollection)
mux.HandleFunc("/api/v1/consultations", apiHandler.handleConsultationsCollection)
```

This doubles the attack surface and maintenance burden. The legacy paths should be deprecated and removed.

### 7. CORS Allows Only Single Origin (Low-Medium)

The production CORS middleware in `server.go` only allows `cfg.ClientURL`:

```go
w.Header().Set("Access-Control-Allow-Origin", cfg.ClientURL)
```

The admin service also needs API access, but is not included. Meanwhile, the separate `CORSMiddleware` in `middleware.go` supports multiple origins but appears unused.

### 8. No Request Body Size Limits on Go API (Medium)

The `validateJSONInput` function reads the entire body with `io.ReadAll(r.Body)` without any size limit. The SvelteKit Dockerfile sets `BODY_SIZE_LIMIT=Infinity`. This opens both services to denial-of-service via large request bodies.

### 9. NATS Usage Is Minimal and Poorly Justified (Low)

NATS is deployed as a service dependency but appears to only be used for admin service pub/sub. The connection code (`pubsub/nats.go`) is only 33 lines. For the current use case, NATS adds operational complexity without clear benefit -- SSE or simple HTTP polling would suffice.

### 10. Mixed Validation Libraries (Low)

The codebase uses **both Zod and Valibot** for validation:

- `service-client/src/lib/server/validation.ts` -- Zod-based validation utilities.
- `service-client/src/lib/api/*.remote.ts` -- Valibot-based schemas.

This creates confusion about which to use and adds bundle size for two libraries doing the same thing.

---

## Opportunities

### 1. Consolidate Data Access to a Single Path

The most impactful improvement would be choosing either Go or SvelteKit as the **sole** data access layer:

- **Option A:** Keep SvelteKit remote functions as the primary data layer (current trajectory). Move the remaining Go REST endpoints (billing, auth) to thin proxies or eliminate them. The Go backend becomes auth-only.
- **Option B:** Keep Go as the data layer. SvelteKit remote functions call Go APIs instead of querying the DB directly. More traditional, but adds latency and requires Go to support all the entity types SvelteKit currently handles.

Option A is more pragmatic given the current codebase state.

### 2. Add Database-Level Enforcement of Business Rules

Use PostgreSQL features to enforce critical invariants:

- **Row-Level Security (RLS)** policies to enforce `agency_id` scoping at the database level, making it impossible to read cross-tenant data even if application code has bugs.
- **Check constraints** on status columns to prevent invalid state transitions.
- **Triggers** for auto-incrementing document numbers (invoice, contract, proposal) to prevent race conditions.

### 3. Improve Test Coverage

Current test coverage is concentrated in Go consultation domain tests and SvelteKit consultation workflow tests. There are no tests for:

- Remote functions (the primary data access layer).
- Permission guards and multi-tenancy isolation.
- GDPR data export/deletion.
- Billing flow integration.
- Contract and invoice generation.

Adding integration tests for remote functions would provide the highest ROI.

### 4. Implement API Versioning Strategy

The current `/api/v1/` prefix suggests versioning intent, but both versioned and unversioned paths point to the same handlers. A proper versioning strategy should be adopted before the API has external consumers.

### 5. Add Structured Logging Correlation

Requests across Go and SvelteKit services lack a shared correlation ID. Adding a `X-Request-ID` header that propagates through both services would make debugging production issues significantly easier.

### 6. Connection Pool Tuning

The SvelteKit database pool (`db.ts`) is set to `max: 10` connections. For a single-VPS deployment, this is reasonable, but should be configurable via environment variable for production tuning.

### 7. Formalize the Proto Definitions

The protobuf definitions (`proto/main.proto`) only define `AuthService`, `UserService`, and `NoteService`. The consultation domain and billing are handled entirely via REST. Either migrate these to gRPC for consistency, or remove gRPC entirely if REST is the preferred communication pattern.

---

## Risks

### 1. Single VPS is a Single Point of Failure (High)

The entire production stack (PostgreSQL, NATS, Traefik, all 3 application services, Gotenberg) runs on a single Hostinger VPS. There is:

- **No database backup strategy** visible in the codebase or CI/CD.
- **No automated failover** or redundancy.
- **No volume backup** for `postgres_data`.
- The `docker image prune -f` in the deploy script could remove images needed for rollback.

**Impact:** A single disk failure, VPS crash, or botched deployment loses all data and takes the platform offline.

### 2. JWT Keys Baked into Docker Images (High)

The CI/CD pipeline writes JWT keys to disk during build and copies them into the Docker image:

```yaml
- name: Create key files (for Go services)
  run: |
    echo "${{ secrets.PRIVATE_KEY_PEM }}" > app/${{ matrix.service }}/private.pem
    echo "${{ secrets.PUBLIC_KEY_PEM }}" > app/${{ matrix.service }}/public.pem
```

While these are cleaned up from the runner, **the keys are baked into the Docker image layers**. Anyone with access to the GHCR registry can extract them. They should be injected at runtime via environment variables or secrets management.

### 3. No Migration Rollback Strategy (Medium-High)

Migrations are forward-only SQL files with `IF NOT EXISTS` guards. There are no:

- **Down migrations** to reverse a bad migration.
- **Migration tracking** (no `schema_migrations` table to record which migrations have run).
- **Automated migration execution** in CI/CD -- migrations are run manually.

**Impact:** A bad migration in production requires manual intervention and potentially data recovery.

### 4. Super Admin Impersonation Lacks Audit Trail Differentiation (Medium)

When a super admin impersonates an agency via `getVirtualOwnerContext()`, they receive a full "owner" context. Any actions they take are logged under the super admin's user ID, but there is no flag indicating the action was performed via impersonation. This makes it difficult to distinguish legitimate owner actions from super admin interventions.

### 5. Stripe Webhook Verification Location Is Unclear (Medium)

The billing webhook endpoint (`/api/v1/billing/webhook`) handles Stripe webhook events, but the codebase doesn't show explicit Stripe signature verification in the handler chain. If webhook payloads aren't verified, an attacker could forge billing events to upgrade agencies for free.

### 6. AI Generation Rate Limiting Has Race Conditions (Medium)

The `incrementAIGenerationCount` function in `subscription.ts` does a read-then-write:

```typescript
const currentCount = agency.aiGenerationsThisMonth ?? 0;
await db.update(agencies).set({
    aiGenerationsThisMonth: currentCount + 1,
});
```

Under concurrent requests, multiple invocations can read the same count and increment to the same value, allowing burst-through of rate limits.

### 7. `BODY_SIZE_LIMIT=Infinity` in SvelteKit Production (Medium)

The SvelteKit Dockerfile sets `BODY_SIZE_LIMIT=Infinity`:

```dockerfile
CMD PORT=3000 BODY_SIZE_LIMIT=Infinity node build
```

This removes the default body size protection, enabling denial-of-service via large payloads. This was likely set to support file uploads (logo images, PDFs) but should be replaced with a specific, reasonable limit.

### 8. No Database Connection Encryption (Low-Medium)

The PostgreSQL connections from both Go and SvelteKit services do not specify SSL mode. In the Docker internal network this is acceptable, but if the database is ever moved to an external host, credentials would be transmitted in cleartext.

### 9. Private Key in Source Control (Low -- Development Only)

The files `service-core/private.pem` and `service-core/public.pem` exist in the source tree. While the production keys are injected via CI secrets, having any `.pem` files checked into git (even development ones) creates bad habits and could cause confusion about which keys are in use.

---

## Summary Scorecard

| Area | Rating | Notes |
|------|--------|-------|
| Service Architecture | B | Good separation, but dual-DB access is a liability |
| Code Organization | A- | Clean monorepo, clear conventions, good file naming |
| Authentication & Security | B+ | Solid JWT/cookie flow; some input validation gaps |
| Multi-Tenancy | A | Excellent isolation pattern with defense-in-depth |
| API Design | B- | Functional but inconsistent (REST + gRPC + Remote Functions) |
| Code Quality | B+ | TypeScript is strong; Go has some rough edges |
| Test Coverage | C | Concentrated in consultation domain; most features untested |
| DevOps & CI/CD | B- | Good Docker setup; no backups, no rollback, key-in-image risk |
| GDPR/Compliance | A- | Comprehensive for current scale |
| Documentation | A | CLAUDE.md is outstanding; clear conventions documented |

**Overall Grade: B+**

The platform demonstrates strong architectural fundamentals, particularly in multi-tenancy isolation and permission design. The most critical improvements needed are: (1) consolidating data access to eliminate the dual-database-access risk, (2) implementing production backup/recovery, and (3) addressing the rate limiter thread-safety and body size limit issues.
