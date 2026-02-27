# LeapLearn GoFast Architecture Blueprint — Verification Report

**Cross-referencing the Architecture Blueprint against the Webkit codebase and LEAP project**
*February 2026*

---

## Executive Summary

This report verifies every claim made in the LeapLearn GoFast Architecture Blueprint against the actual Webkit codebase (`github.com/jamestagal/webkit`) and audits what has already been built in the current LEAP project. The goal is to provide a clear picture of what transfers directly, what needs adaptation, and where the blueprint diverges from reality.

**Key finding:** The blueprint is largely accurate about Webkit's infrastructure, auth, multi-tenancy, and database patterns. However, there is one significant discrepancy: the blueprint claims ConnectRPC provides end-to-end type safety between Go and SvelteKit, but **Webkit does not use ConnectRPC for frontend-to-backend communication**. SvelteKit communicates with Go via standard REST/HTTP and accesses PostgreSQL directly via Drizzle ORM. gRPC is only used internally between Go services.

**LEAP project status:** The existing LEAP codebase is a nearly feature-complete H5P LMS with 97 API endpoints, 69 components, 12 MongoDB models, 45 pages, and comprehensive H5P integration (editor, player, hub, file manager, library management). A migration to GoFast would replace a substantial amount of working code.

---

## 1. Current LEAP Project Audit

The LEAP project is built on SvelteKit + MongoDB + better-auth and already has significant functionality:

| Area | Scale | Details |
|------|-------|---------|
| H5P Integration | 45+ endpoints | Full editor (lumieducation/h5p-server v10), player (standalone + embedded), file manager, hub integration (Catharsis + H5P.org fallback), library management |
| Course System | 16 pages | Course CRUD, module structure, completion criteria (sequential/free/mastery), instructor dashboard, student enrollment |
| Authentication | better-auth | Email OTP + Google OAuth, organization multi-tenancy (10 orgs/user), session management with org context |
| Components | 69 total | 28 general UI, 15 H5P-specific, 13 course, 4 auth, 3 analytics, 3 library, 2 learning |
| Database | 12 models | H5PContent, H5PLibrary, H5PFolder, H5PHubLibrary, H5PProgress, Course, Product, Subscription, Tenant, Analytics, AuditLog, CacheEntry |
| Storage | R2 + filesystem | Cloudflare R2 with filesystem fallback, asset extraction, thumbnail generation |
| Payments | Polar integration | Checkout, webhooks, product management, subscription tracking |
| Admin Panel | 10 pages | Users, products, subscriptions, libraries, analytics, H5P hub config |
| Documentation | 35+ files | Architecture docs, implementation guides, test strategies, shared patterns |

**⚠️ Migration implication:** Moving to GoFast means rewriting 288 source files, 97 API endpoints, and 12 data models. The H5P integration alone (12 services, 45+ endpoints) represents weeks of work that would need to be rebuilt in Go.

---

## 2. Blueprint Verification Matrix

Each claim from the Architecture Blueprint is verified against the actual Webkit codebase.

### 2.1 Authentication System

| Blueprint Claim | Status | Evidence |
|----------------|--------|----------|
| OAuth2 + PKCE | ✅ VERIFIED | `oauth2.GenerateVerifier()` and `oauth2.S256ChallengeOption()` in `login/service.go:244-360` |
| Magic Links | ✅ VERIFIED | Email provider creates login URL with state/email, 15-min expiration, callback at `/login-callback/email` |
| JWT with EdDSA (Ed25519) | ✅ VERIFIED | `jwt.ParseEdPrivateKeyFromPEM` in `auth.go:142`, `jose.importSPKI` with EdDSA in `jwt.ts:30` |
| HTTP-only cookies | ✅ VERIFIED | `login_route.go:32-51` sets Secure conditionally, HttpOnly: true, SameSite: Lax |
| Token auto-refresh | ✅ VERIFIED | `hooks.server.ts` validates access token, calls `refresh()` on expiration, updates both cookies |
| Rate limiting | ✅ VERIFIED | Traefik middleware: 100 avg/s API, 50 avg/s admin, 200 avg/s client |

### 2.2 Multi-Tenancy

| Blueprint Claim | Status | Evidence |
|----------------|--------|----------|
| `withAgencyScope()` helper | ✅ VERIFIED | `db-helpers.ts:40-45` wraps all queries with agency context enforcement |
| Agency memberships (owner/admin/member) | ✅ VERIFIED | `schema.ts:107-137` agencyMemberships table with role column, unique(userId, agencyId) |
| `[agencySlug]` routing | ✅ VERIFIED | `routes/(app)/[agencySlug]/` with 19 subdirectories, `getAgencyContextBySlug()` handler |
| Row-level tenant isolation | ✅ VERIFIED | Every query adds `eq(table.agencyId, agencyId)`, `verifyConsultationAccess()` checks isolation |
| 50+ permission matrix | ✅ VERIFIED | `permissions.ts`: 50+ permissions, `requirePermission`/`requireAllPermissions`/`requireAnyPermission` guards |
| Subscription tiers (4 levels) | ✅ VERIFIED | free/starter/growth/enterprise with member, consultation, AI generation, storage limits |
| Freemium support | ✅ VERIFIED | `isFreemium` flag with reason tracking (beta_tester, partner, promotional, etc.) |

### 2.3 ConnectRPC / API Communication

> **🔴 CRITICAL DISCREPANCY:** The blueprint claims ConnectRPC provides end-to-end type safety between Go and SvelteKit. This is **NOT accurate** for the current Webkit codebase.

| Blueprint Claim | Status | Evidence |
|----------------|--------|----------|
| ConnectRPC for Go↔SvelteKit communication | ❌ DISCREPANCY | No `@connectrpc` imports in SvelteKit. Frontend uses REST `fetch()` to `http://core:4001/api/v1/*` |
| Standard gRPC for internal services | ✅ VERIFIED | Admin service connects to Core via gRPC on port 4002 (`CORE_URI: core:4002`) |
| Protobuf definitions exist | ✅ VERIFIED | 3 proto files: `main.proto`, `user.proto`, `note.proto` with AuthService, UserService, NoteService |
| SQLC for Go queries | ✅ VERIFIED | `sqlc.yaml` generates Go types from `schema_postgres.sql` into `storage/query/` |
| Drizzle ORM for SvelteKit | ✅ VERIFIED | `schema.ts` (2,302 lines), direct PostgreSQL access bypassing Go backend for most operations |
| SvelteKit Remote Functions | ✅ VERIFIED | 29 `.remote.ts` files using `query()`/`command()` from `$app/server` with Valibot validation |

**Actual communication architecture:** SvelteKit → REST HTTP → Go Core (port 4001) for auth/billing. SvelteKit → Drizzle → PostgreSQL directly for most data operations. Go Admin → gRPC → Go Core (port 4002) for internal service communication. The blueprint's ConnectRPC vision represents GoFast's intended architecture, not what Webkit currently implements.

### 2.4 SvelteKit Frontend Patterns

| Blueprint Claim | Status | Evidence |
|----------------|--------|----------|
| Svelte 5 with runes | ✅ VERIFIED | `$props()`, `$state()`, `$derived()`, `$effect()` used throughout. Svelte v5.39.11 |
| SvelteKit Remote Functions | ✅ VERIFIED | 29 `.remote.ts` files, `experimental.remoteFunctions: true` in `svelte.config.js` |
| Valibot validation | ✅ VERIFIED | All remote functions use Valibot schemas as first argument (v1.2.0) |
| TailwindCSS + DaisyUI | ✅ VERIFIED | TailwindCSS v4 (`@import tailwindcss`), DaisyUI v5 (`@plugin daisyui`) |
| Snippets instead of slots | ✅ VERIFIED | `{@render children()}` pattern used throughout, no `<slot>` usage |
| 87 components | ✅ VERIFIED | 13 component categories including settings, consultation, contracts, proposals, form-builder |

### 2.5 Infrastructure

| Blueprint Claim | Status | Evidence |
|----------------|--------|----------|
| Docker Compose (dev + prod) | ✅ VERIFIED | 8 dev services (core, admin, client, content, postgres, nats, mailpit, gotenberg), 7 production services with Traefik |
| Grafana monitoring stack | ✅ VERIFIED | Full OTEL: Alloy + Loki + Tempo + Prometheus + Grafana Enterprise, pre-built dashboards |
| GitHub Actions CI/CD | ✅ VERIFIED | 5 workflows: deploy-production, build-and-deploy, lint-go, lint-ts, pr validation |
| Kubernetes + Helm | ✅ VERIFIED | 17 K8s manifests, Terraform IaC, RKE2 cluster setup. Currently standby (VPS active) |
| Raw SQL migrations | ✅ VERIFIED | 26 idempotent migration files with tracking table, local + production runner script |
| JWT key generation script | ✅ VERIFIED | `scripts/run_keys.sh` generates Ed25519 key pairs |
| Content service (undocumented) | ⚠️ PARTIAL | Port 5001 content intelligence service exists but is NOT mentioned in blueprint |
| Gotenberg PDF service | ⚠️ PARTIAL | Port 3003 PDF generation service exists but is NOT mentioned in blueprint |

### 2.6 Database Patterns

| Blueprint Claim | Status | Evidence |
|----------------|--------|----------|
| PostgreSQL with pgvector | ✅ VERIFIED | Dev: `pgvector/pgvector:pg17`, Prod: `pgvector/pgvector:pg16` |
| Single shared DB, row-level isolation | ✅ VERIFIED | All tables scoped by `agency_id`, `withAgencyScope()` enforces at query level |
| SQLC for Go backend | ✅ VERIFIED | `sqlc.yaml` with `pgx/v5`, generates `models.go` + `query_postgres.sql.go` |
| Drizzle ORM for SvelteKit | ✅ VERIFIED | 2,302-line `schema.ts` mirroring PostgreSQL schema exactly |
| AtlasGo for migrations | ❌ DISCREPANCY | Uses raw SQL migration files (not Atlas declarative). `scripts/run_migrations.sh` processes numbered `.sql` files |

---

## 3. Gap Analysis

### 3.1 Significant Discrepancies

| Area | Blueprint Says | Reality |
|------|---------------|---------|
| **ConnectRPC** | End-to-end type safety via ConnectRPC between Go and SvelteKit | NOT IMPLEMENTED. SvelteKit uses REST `fetch()` and direct Drizzle ORM. gRPC only for Go-to-Go internal comms |
| **AtlasGo migrations** | Declarative schema management with AtlasGo | Uses raw SQL migration files with a custom bash runner (`scripts/run_migrations.sh`), not Atlas |
| **Proto definitions** | Rich protobuf with H5P, Course, Hub services | Only 3 proto files exist: `main.proto`, `user.proto`, `note.proto` with basic CRUD services |
| **Content service** | Not mentioned in blueprint | Fully implemented content intelligence service on port 5001 with SEO, DataForSEO, PageSpeed, AI integration |
| **Gotenberg** | Not mentioned | PDF generation service (HTML to PDF) running on port 3003 |
| **DB version** | PostgreSQL 18 | Dev: pg17, Prod: pg16. Version asymmetry is a risk (data files incompatible across majors) |

### 3.2 What Transfers Accurately

These blueprint claims are fully verified and can be relied upon for migration planning:

| Component | Transfer Confidence |
|-----------|-------------------|
| Auth system (OAuth2 + PKCE, Magic Links, EdDSA JWT) | **HIGH** — Fully implemented, well-tested, production-proven |
| Multi-tenancy (withAgencyScope, roles, permissions) | **HIGH** — 50+ permissions, 3-tier roles, resource ownership, audit logging |
| Subscription tiers + freemium | **HIGH** — 4 tiers with enforced limits, freemium support with reasons |
| Docker Compose + CI/CD | **HIGH** — 8 dev services, 7 prod services, Traefik SSL, rolling deploys |
| Monitoring (Grafana LGTM) | **HIGH** — Full OTEL stack with pre-built dashboards |
| SvelteKit patterns (Remote Functions, Svelte 5) | **HIGH** — 29 remote files, Valibot, runes throughout |
| Kubernetes infrastructure | **MEDIUM** — Built but currently standby (VPS production) |
| SQLC query generation | **MEDIUM** — Works for Go backend, but most data access goes through Drizzle in SvelteKit |

---

## 4. Recommendations

### 4.1 Blueprint Corrections Needed

1. **ConnectRPC section:** Rewrite to reflect that Webkit currently uses REST + Drizzle, not ConnectRPC. The blueprint should clarify that ConnectRPC is the *target architecture from GoFast's template*, not what Webkit currently has. New H5P/Course proto definitions would be built from scratch.

2. **Migration system:** Change "AtlasGo" references to "raw SQL migrations with idempotent files" which is the actual pattern Webkit uses.

3. **Missing services:** Add the content intelligence service (port 5001) and Gotenberg (port 3003) to the service inventory.

4. **PostgreSQL version:** Change "PostgreSQL 18" to reflect actual versions (pg16 production, pg17 development).

### 4.2 Migration Risk Assessment

**What you're replacing:** The LEAP project has 288 source files, 97 API endpoints, 69 components, 12 MongoDB models, 12 H5P services, and 45 pages. This is not a skeleton — it's a functioning application.

**What you're gaining:** Go's compiled performance, PostgreSQL's relational model (better for users/courses/enrollments), production-grade observability, and Webkit's battle-tested auth/multi-tenancy patterns.

**What you're losing:** All existing H5P integration work (the most complex part), MongoDB's native document model for H5P content.json, and time-to-market on current features.

### 4.3 Suggested Path Forward

**Option A (Conservative):** Keep LEAP on SvelteKit + MongoDB. Implement the Catharsis hub replacement as SvelteKit server routes (3 endpoints). Focus on shipping features rather than replatforming.

**Option B (Hybrid):** Use Webkit's Go backend for new services (course enrollment, progress tracking, analytics) while keeping H5P integration in SvelteKit. Gradually migrate as Go expertise builds.

**Option C (Full Migration):** Follow the blueprint's 5-phase plan but with corrected assumptions. Budget 8–12 weeks (not 5) given the H5P integration complexity and the ConnectRPC setup that needs to be built from GoFast's template rather than transferred from Webkit.
