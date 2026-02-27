# Architecture

**Analysis Date:** 2026-01-22

## Pattern Overview

**Overall:** Distributed multi-service architecture with shared single-database multi-tenancy model, gRPC for internal service communication, and REST APIs for external clients.

**Key Characteristics:**
- Three independent services (Core, Admin, Client) deployed separately but communicating via gRPC
- Single PostgreSQL database shared across all services with row-level agency isolation
- Microservices pattern with domain-driven design in Go backends
- SvelteKit remote functions for type-safe frontend-to-backend communication
- NATS message broker for cross-service events (SSE notifications)
- JWT-based authentication with automatic token refresh

## Layers

**Core Service (Go Backend - `app/service-core/`):**
- Purpose: Business logic, database access, REST/gRPC APIs
- Location: `app/service-core/`
- Contains: Domain services (consultation, payment, email, file, user, login, note), REST handlers, gRPC handlers, storage/queries, configuration
- Depends on: PostgreSQL, external integrations (Stripe, email providers, file storage)
- Used by: Client frontend (via REST), Admin service (via gRPC), external integrations (webhooks)

**Admin Service (Go Backend - `app/service-admin/`):**
- Purpose: Admin panel, server-sent events (SSE) for real-time notifications, gRPC client wrapper
- Location: `app/service-admin/`
- Contains: Web templates (templ), REST handlers, SSE handler, gRPC client, authentication, pubsub broker connection
- Depends on: Core service (gRPC), NATS message broker, PostgreSQL (read-only)
- Used by: Administrators via web UI, SSE for real-time updates

**Client Service (SvelteKit Frontend - `service-client/`):**
- Purpose: User-facing application, remote functions as server-side API, Svelte 5 components
- Location: `service-client/src/`
- Contains: Remote functions (query/command), routes, components, stores, server utilities, hooks
- Depends on: Core service (REST), PostgreSQL (direct for remote functions), authentication
- Used by: Agency users, clients accessing forms/proposals

**Storage Layer (Shared Across Services):**
- Purpose: Data persistence and isolation
- Location: `app/service-core/storage/`, `service-client/src/lib/server/schema.ts`
- Contains: PostgreSQL schema, Drizzle ORM schema (for SvelteKit), sqlc queries (for Go)
- Pattern: Row-level isolation via `agency_id` columns; all queries filtered by agency context

**Authentication & Authorization:**
- Purpose: JWT-based auth, token refresh, role-based access control (RBAC)
- Location: `service-client/src/hooks.server.ts`, `service-client/src/lib/server/auth.ts`, `app/service-core/domain/login/`
- Pattern: Magic link + optional 2FA, tokens stored in HTTP-only cookies, automatic refresh via hooks

## Data Flow

**User Login Flow:**

1. User submits email/phone in Client frontend (`service-client/src/routes/login/`)
2. Client → Core REST (`POST /login`) → Core validates, sends magic link/OTP
3. User verifies code
4. Core → JWT tokens created, stored in cookies
5. Hooks validate token on every request, auto-refresh when expiring

**Consultation Creation Flow:**

1. Agency member opens form in Client frontend
2. Client loads agency context via `[agencySlug]/+layout.server.ts` → queries database
3. Frontend form submission → Remote function `createConsultation()` (`service-client/src/lib/api/consultation.remote.ts`)
4. Remote function validates agency context via `getAgencyId()`, inserts via Drizzle ORM
5. Database row includes `agency_id` for isolation
6. Admin service receives SSE event via NATS broker about new consultation
7. Administrators see real-time update on admin panel

**Multi-Tenancy Isolation:**

1. Client request includes authentication (JWT in cookie)
2. Hooks extract user ID → fetch default agency or specified agency
3. Remote function calls `getAgencyId()` → retrieves from request context
4. ALL queries use `withAgencyScope()` wrapper → enforces `WHERE agency_id = <agencyId>`
5. Cross-agency queries are impossible at query level (not trusting frontend)

**State Management:**

- **Frontend state:** Svelte 5 runes (`$state`, `$derived`, `$effect`) in `.svelte` files and `.svelte.ts` stores
- **Server state:** Remote function results cached by SvelteKit's `query()` function
- **Agency config state:** Loaded once in `[agencySlug]/+layout.server.ts`, passed to all child components
- **Session state:** User info and tokens in `event.locals`, available to all server functions

## Key Abstractions

**Remote Functions (Frontend ↔ Backend Communication):**
- Purpose: Type-safe server function calls from client components
- Examples: `service-client/src/lib/api/consultation.remote.ts`, `agency.remote.ts`, `proposals.remote.ts`
- Pattern: `query()` for reads (cacheable), `command()` for writes, `form()` for form submissions
- Validation: All functions with parameters use Valibot schemas as first argument
- Location: `service-client/src/lib/api/*.remote.ts` (CRITICAL: `.remote.ts` extension required)

**Domain Services (Go Backend Business Logic):**
- Purpose: Encapsulate domain-specific operations
- Examples: `app/service-core/domain/consultation/` (service.go, repository.go), `app/service-core/domain/payment/`, `app/service-core/domain/email/`
- Pattern: Service struct depends on repository and external providers; called from REST/gRPC handlers
- Repository pattern: Abstracts database queries, returns domain models

**Agency Context & Data Isolation:**
- Purpose: Ensure multi-tenant data safety
- Location: `service-client/src/lib/server/agency.ts`, `service-client/src/lib/server/db-helpers.ts`
- Pattern: `getAgencyContext()` retrieves auth context → `withAgencyScope()` enforces filtering
- Critical: All remote functions must call `getAgencyId()` or use helpers like `getAgencyConsultations()`

**Stores for Reactive UI State:**
- Purpose: Manage frontend state with reactivity
- Examples: `service-client/src/lib/stores/agency-config.svelte.ts` (form options), consultation state
- Pattern: Svelte 5 runes (`$state`, `$derived`), file-based state management
- Location: `service-client/src/lib/stores/`

## Entry Points

**Frontend Entry Point:**
- Location: `service-client/src/routes/+page.svelte`, `service-client/svelte.config.js`
- Triggers: User navigates to app URL
- Responsibilities: Render landing page or dashboard based on auth state

**Backend (Core) Entry Point:**
- Location: `app/service-core/main.go`
- Triggers: Service startup
- Responsibilities: Load config, connect to database, initialize domain services, start REST + gRPC servers

**Admin Service Entry Point:**
- Location: `app/service-admin/main.go`
- Triggers: Service startup
- Responsibilities: Connect to Core gRPC, NATS broker, start REST web server + SSE server

**Client Route Entry Points (Agency-Scoped):**
- Location: `service-client/src/routes/(app)/[agencySlug]/`
- Triggers: User navigates to agency URL (e.g., `/acme-agency/consultation/`)
- Responsibilities: Validate agency access, load agency context, render protected pages

**Public Route Entry Points (No Auth Required):**
- Location: `service-client/src/routes/login/`, `service-client/src/routes/invite/`, `service-client/src/routes/q/` (questionnaire), `service-client/src/routes/p/` (proposal public view)
- Triggers: Unauthenticated users
- Responsibilities: Render login, invites, public questionnaires, proposal previews

## Error Handling

**Strategy:** Multi-layer error handling - HTTP errors from routes, domain validation errors, database constraint violations, external API failures.

**Patterns:**

**Server Routes (SvelteKit):**
- Use `throw error(status, message)` from `@sveltejs/kit` for route-level errors
- Example: `throw error(403, "Agency access denied")` (`service-client/src/lib/server/agency.ts`)
- Example: `throw error(404, "Agency not found")` (`service-client/src/routes/(app)/[agencySlug]/+layout.server.ts`)
- Redirects via `throw redirect(302, '/login')` for unauthorized access

**Remote Functions:**
- Throw `Error` with message for validation failures
- Example: `throw new Error("Consultation not found")` (`service-client/src/lib/api/consultation.remote.ts:60`)
- Client-side catch blocks handle these errors and show user-friendly messages
- Valibot schema validation happens before function body executes

**Go REST Handlers:**
- Return HTTP status codes (200, 400, 403, 404, 500)
- JSON error response body with message
- Middleware logs all errors with context

**Validation:**
- Frontend: Valibot schema validation in remote functions (`service-client/src/lib/schema/`)
- Backend: Domain service validation (e.g., checking business rules before database insert)
- Database: Constraints enforce data integrity (unique emails, valid statuses via CHECK)

## Cross-Cutting Concerns

**Logging:**
- Go: `log/slog` standard library structured logging (`app/service-core/main.go:27`, `app/pkg/`)
- Frontend: Browser console (development) + Sentry (production)

**Validation:**
- Frontend: Valibot schemas for all remote function inputs
- Backend: Domain service validation before persistence
- Database: CHECK constraints on enum columns (role, status, etc.)

**Authentication:**
- JWT tokens (access + refresh) issued by Core service
- Stored in HTTP-only cookies with domain and path restrictions
- Automatic refresh via `service-client/src/lib/server/refresh.ts` when expiring
- Hooks validate on every request (`service-client/src/hooks.server.ts`)

**Authorization (Role-Based Access Control):**
- Roles defined: owner, admin, member (`service-client/src/lib/server/permissions.ts`)
- Agency membership status: active, invited, suspended
- Permission checks via `requirePermission()` helpers before sensitive operations
- Location: `service-client/src/lib/server/permissions.ts`

**Multi-Tenancy Isolation:**
- All database queries filtered by `agency_id` using `withAgencyScope()` wrapper
- Never trust client-sent agency_id; always derive from authenticated user context
- Go backend queries use explicit WHERE clauses on agency_id
- Schema enforces unique constraints within agency (e.g., form slug unique per agency)

---

*Architecture analysis: 2026-01-22*
