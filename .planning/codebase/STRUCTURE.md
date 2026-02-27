# Codebase Structure

**Analysis Date:** 2026-01-22

## Directory Layout

```
webkit/
├── app/                                    # Go backend services
│   ├── service-core/                       # Core business logic service
│   ├── service-admin/                      # Admin panel service
│   └── pkg/                                # Shared Go packages (auth, utilities)
├── service-client/                         # SvelteKit frontend application
├── proto/                                  # Protobuf definitions for gRPC
├── migrations/                             # PostgreSQL migration files
├── scripts/                                # Development automation scripts
├── docs/                                   # Documentation
├── infra/                                  # Kubernetes and infrastructure-as-code
├── monitoring/                             # Grafana, Prometheus configurations
├── docker-compose.yml                      # Local development environment
└── docker-compose.production.yml           # Production environment
```

## Directory Purposes

**`app/service-core/`:**
- Purpose: Core backend service handling business logic, database, REST/gRPC APIs
- Contains: Domain services, REST handlers, gRPC handlers, storage/query layer, configuration
- Key files: `main.go`, `config/config.go`, `rest/server.go`, `grpc/server.go`

**`app/service-core/domain/`:**
- Purpose: Domain-driven design modules, each handling a business domain
- Contains: consultation/, email/, file/, login/, payment/, note/, user/, proposal/, audit/, addon/, analytics/, pdf/
- Pattern: Each domain has service.go (business logic), repository.go (data access), and provider.go (external integrations)
- Example: `domain/consultation/service.go` orchestrates consultation operations

**`app/service-core/rest/`:**
- Purpose: HTTP REST API handlers and routes
- Contains: handler.go (HTTP request handlers), server.go (route definitions), *_route.go files for specific endpoints
- Pattern: Handler struct holds all domain services; each route file maps URLs to handler methods
- Key file: `app/service-core/rest/server.go` - defines all REST endpoints

**`app/service-core/grpc/`:**
- Purpose: gRPC service implementation for internal service communication
- Contains: server.go, handler.go, *_grpc.go files for service implementations
- Pattern: gRPC clients in Admin service call methods here
- Used by: Admin service for user/note operations, SSE notifications

**`app/service-core/storage/`:**
- Purpose: Database layer - schema definitions, query wrappers, connection management
- Contains: schema_postgres.sql (table definitions), sql/ directory with raw SQL queries, query.go (sqlc-generated)
- Key: sqlc compiles SQL queries to type-safe Go code
- Location: `storage/query_postgres.sql.go` (generated)

**`app/service-admin/`:**
- Purpose: Admin web interface and server-sent events (SSE) for real-time notifications
- Contains: REST handlers, SSE server, web templates (templ framework), gRPC client wrapper, authentication
- Key: Communicates with Core service via gRPC, sends events to connected clients via SSE

**`app/service-admin/web/`:**
- Purpose: HTML templates using templ framework (Go template language)
- Contains: base templates, components (button, input, modal, drawer), pages (users, notes, login)
- Pattern: templ files compile to Go code that generates HTML
- Location: `web/templates/base_templ.go`, `web/pages/`, `web/components/`

**`app/pkg/`:**
- Purpose: Shared Go packages used by multiple services
- Contains: auth/, str/ (string utilities), testing/
- Key: `auth/auth.go` - JWT token generation/validation, `auth/service.go` - authentication service

**`service-client/src/`:**
- Purpose: SvelteKit frontend application
- Contains: routes (pages), components, remote functions (API), stores, server utilities, styling

**`service-client/src/routes/`:**
- Purpose: SvelteKit file-based routing
- Pattern: Directory structure maps to URL routes; `+page.svelte` renders page content, `+layout.svelte` for layout, `+page.server.ts` for server-only code
- Key directories:
  - `(app)/` - Protected routes (require authentication)
  - `(app)/[agencySlug]/` - Agency-scoped routes (consultation, proposals, forms, etc.)
  - `(app)/super-admin/` - Super admin panel
  - `login/` - Authentication pages
  - `c/` - Client public consultation form
  - `q/` - Client public questionnaire
  - `p/` - Client public proposal view
  - `invite/` - Agency invite acceptance
  - `api/` - API endpoints (GDPR export)

**`service-client/src/lib/api/`:**
- Purpose: Remote functions - server-side functions callable from client components
- Contains: *.remote.ts files (query/command functions), *.types.ts files (TypeScript types)
- CRITICAL: Must use `.remote.ts` extension; only remote function exports allowed (no regular functions/types)
- Pattern: `export const functionName = query/command(schema, async (input) => { ... })`
- Key files:
  - `consultation.remote.ts` - Consultation CRUD
  - `proposals.remote.ts` - Proposal CRUD
  - `agency.remote.ts` - Agency management
  - `forms.remote.ts` - Form builder operations
  - `contracts.remote.ts` - Contract CRUD
  - `email.remote.ts` - Email operations
  - `questionnaire.remote.ts` - Questionnaire operations

**`service-client/src/lib/server/`:**
- Purpose: Server-only utilities (cannot be accessed from client)
- Contains: Database connection, authentication, permissions, agency context, helpers
- Key files:
  - `db.ts` - Drizzle ORM database instance
  - `schema.ts` - Drizzle table definitions (mirrors PostgreSQL schema)
  - `auth.ts` - User/agency ID extraction from request
  - `agency.ts` - Agency context and validation
  - `permissions.ts` - Role-based access control (RBAC) checks
  - `db-helpers.ts` - Data isolation helpers (`withAgencyScope()`)
  - `refresh.ts` - JWT token refresh logic
  - `super-admin.ts` - Super admin impersonation

**`service-client/src/lib/components/`:**
- Purpose: Reusable Svelte components for UI
- Contains: Form inputs (Input, Select, Textarea), layout (SideNavigation, Card, Tabs), specialized components
- Pattern: Components use Svelte 5 runes (`$props`, `$state`, `$derived`, `$effect`)
- Subdirectories by feature: consultation/, proposal/, contracts/, forms/, questionnaire/, emails/, addons/, analytics/, audit/, package/, settings/

**`service-client/src/lib/stores/`:**
- Purpose: Reactive state management using Svelte 5 runes
- Contains: agency-config.svelte.ts (form dropdown options), consultation-draft.svelte.ts, and other feature-specific stores
- Pattern: File-based stores using `$state` for reactive variables
- Usage: Components import and use stores via `import { store } from '$lib/stores/...'`

**`service-client/src/lib/schema/`:**
- Purpose: Valibot validation schemas for form inputs and remote function parameters
- Contains: consultation.ts, proposals.ts, contracts.ts, forms.ts (schema definitions)
- Pattern: Define schema once, use in remote function parameter validation
- Used by: Remote functions automatically validate inputs against schema

**`service-client/src/lib/utils/`:**
- Purpose: Helper functions for date formatting, validation, DOM utilities
- Contains: Utility functions shared across components and routes

**`service-client/src/lib/types/`:**
- Purpose: TypeScript type definitions
- Contains: User types, Agency types, Consultation types, API response types

**`proto/`:**
- Purpose: Protocol Buffer definitions for gRPC service contracts
- Contains: *.proto files defining service interfaces and message types
- Key files:
  - `main.proto` - Core service definitions (AuthService, UserService, NoteService)
  - `user.proto` - User message definitions
  - `note.proto` - Note message definitions
- Generated code: `app/service-core/proto/*.pb.go` (generated from .proto files)

**`migrations/`:**
- Purpose: PostgreSQL migration files for schema changes
- Contains: Numbered SQL files (001_*.sql, 002_*.sql, etc.)
- Pattern: Idempotent migrations using `IF NOT EXISTS`
- Example: `001_add_agencies_freemium_columns.sql`

**`scripts/`:**
- Purpose: Development automation scripts
- Key scripts:
  - `run_keys.sh` - Generate JWT keys
  - `run_grpc.sh` - Generate gRPC code from .proto files
  - `run_queries.sh` - Generate sqlc code from SQL
  - `format.sh` - Format frontend code
  - `atlas.sh` - Run database migrations
  - `run_migrations.sh` - Apply migrations locally/on production

## Key File Locations

**Entry Points:**
- `app/service-core/main.go` - Core service startup
- `app/service-admin/main.go` - Admin service startup
- `service-client/src/routes/+page.svelte` - Frontend landing page
- `service-client/svelte.config.js` - SvelteKit configuration

**Configuration:**
- `app/service-core/config/config.go` - Core service config loading
- `app/service-admin/config/config.go` - Admin service config loading
- `service-client/svelte.config.js` - Frontend build config
- `.env` - Local environment variables
- `docker-compose.yml` - Local development setup

**Core Logic (Consultation Example):**
- Domain: `app/service-core/domain/consultation/service.go`
- Repository: `app/service-core/domain/consultation/repository.go`
- REST handlers: `app/service-core/rest/` (routes that call domain services)
- Frontend remote: `service-client/src/lib/api/consultation.remote.ts`
- Frontend components: `service-client/src/lib/components/consultation/`
- Frontend routes: `service-client/src/routes/(app)/[agencySlug]/consultation/`

**Testing:**
- Go tests: Alongside source files (e.g., `app/service-core/integration/consultation_test.go`)
- Frontend unit tests: `service-client/src/lib/api/consultation.remote.test.ts` and component tests
- Frontend e2e tests: `service-client/tests/`
- Fixtures: `service-client/src/lib/tests/` and `app/service-core/integration/fixtures.go`

**Database Schema:**
- Go backend: `app/service-core/storage/schema_postgres.sql`
- SvelteKit: `service-client/src/lib/server/schema.ts` (Drizzle ORM mirror)

## Naming Conventions

**Files:**
- TypeScript/JavaScript: camelCase (e.g., `consultation.remote.ts`, `agency-config.svelte.ts`)
- Go: snake_case packages, camelCase functions (e.g., `package main`, `func handleLogin()`)
- Svelte components: PascalCase (e.g., `Button.svelte`, `ConsultationForm.svelte`)
- SQL: UPPER_CASE keywords, snake_case identifiers (e.g., `CREATE TABLE consultations`)

**Directories:**
- Go packages: kebab-case or snake_case (e.g., `service-core`, `domain`, `rest`)
- SvelteKit routes: kebab-case with [brackets] for params (e.g., `[agencySlug]`, `consultation-edit`)
- Svelte components: Grouped by feature in subdirectories (e.g., `components/consultation/`, `components/forms/`)
- Remote functions: Grouped by domain (e.g., `api/consultation.remote.ts`, `api/proposals.remote.ts`)

**Functions:**
- Go: camelCase (e.g., `func NewConsultationService()`)
- TypeScript: camelCase (e.g., `export const getConsultation()`, `export const createConsultation()`)
- Remote functions: verb+noun pattern (e.g., `getConsultation`, `createConsultation`, `updateConsultation`)

**Variables:**
- Go: camelCase (e.g., `consultationService`, `agencyId`)
- TypeScript: camelCase (e.g., `consultationId`, `agencyConfig`)
- Constants: UPPER_SNAKE_CASE (e.g., `AGENCY_SCOPE_TIMEOUT`, `JWT_SECRET`)

**Types:**
- TypeScript interfaces: PascalCase (e.g., `Consultation`, `Agency`, `User`)
- Go structs: PascalCase (e.g., `Consultation`, `ConsultationService`)
- Valibot schemas: PascalCase + "Schema" suffix (e.g., `CreateConsultationSchema`)

## Where to Add New Code

**New Feature (Consultation-like CRUD):**
- Backend domain: `app/service-core/domain/[feature]/service.go` (business logic)
- Backend domain: `app/service-core/domain/[feature]/repository.go` (data access)
- Backend REST: `app/service-core/rest/[feature]_route.go` (HTTP handlers)
- Database: `app/service-core/storage/schema_postgres.sql` (add table)
- Frontend remote: `service-client/src/lib/api/[feature].remote.ts` (server functions)
- Frontend schema: `service-client/src/lib/schema/[feature].ts` (Valibot validation)
- Frontend types: `service-client/src/lib/types/[feature].ts` (TypeScript types)
- Frontend routes: `service-client/src/routes/(app)/[agencySlug]/[feature]/` (pages)
- Frontend components: `service-client/src/lib/components/[feature]/` (UI components)

**New Component/Module:**
- Svelte component: `service-client/src/lib/components/[feature]/FeatureName.svelte`
- Component tests: `service-client/src/lib/components/[feature]/FeatureName.spec.ts`
- Styling: Use TailwindCSS classes in component; no separate CSS files needed

**Shared Utilities:**
- Frontend helpers: `service-client/src/lib/utils/`
- Go helpers: `app/pkg/`
- Type definitions: `service-client/src/lib/types/`

**API Endpoints:**
- REST routes: `app/service-core/rest/server.go` (register route) + `app/service-core/rest/[feature]_route.go` (implement handler)
- gRPC services: `proto/[feature].proto` (define service) → generate code → implement in `app/service-core/grpc/[feature]_grpc.go`

**Database Changes:**
1. Create migration: `migrations/NNN_description.sql`
2. Update Go schema: `app/service-core/storage/schema_postgres.sql`
3. Update Drizzle schema: `service-client/src/lib/server/schema.ts`
4. If Go queries affected: Add SQL to `app/service-core/storage/sql/` → run `sh scripts/run_queries.sh postgres`

**Authentication/Authorization:**
- Roles: Update `service-client/src/lib/server/permissions.ts` (RBAC matrix)
- Permissions: Add permission check before sensitive operations
- Token claims: Update JWT payload in `app/service-core/domain/login/service.go`

## Special Directories

**`node_modules/`:**
- Purpose: Installed npm dependencies
- Generated: Yes (run `npm install`)
- Committed: No (in .gitignore)

**`.git/`:**
- Purpose: Git repository metadata
- Generated: Yes (git init)
- Committed: No (core Git data)

**`build/`, `dist/`, `.svelte-kit/`:**
- Purpose: Build artifacts
- Generated: Yes (npm run build)
- Committed: No (in .gitignore)

**`postgres_data/`:**
- Purpose: Docker volume for PostgreSQL data (local dev)
- Generated: Yes (docker compose up)
- Committed: No (data should not be in repo)

---

*Structure analysis: 2026-01-22*
