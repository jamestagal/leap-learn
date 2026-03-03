# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Plan Mode

- Make the plan extremely concise. Sacrifice grammar for the sake of concision.
- Create new planning documents for each new feature. Don't append them to previous plan files.
- At the end of each plan, give me a list of unresolved questions to answer, if any.

## Project Overview

**LeapLearn** is a multi-tenant H5P Learning Management System built on the GoFast stack (forked from Webkit). It provides interactive content authoring, course management, and learning analytics with organisation-based tenancy.

Target domain: leaplearn.io

## Architecture Overview

This is a microservices application built with:
- **Core Service**: Go backend providing gRPC and REST APIs, database interactions
- **Admin Service**: Go backend with web interface for administration, Server-Sent Events (SSE)
- **Client Service**: SvelteKit frontend application with TypeScript and Svelte 5 runes
- **Database**: PostgreSQL (primary) with SQLC (Go) and Drizzle (SvelteKit)
- **Storage**: Cloudflare R2 for H5P file storage (MinIO for local dev)
- **Message Queue**: NATS for inter-service communication
- **Monitoring**: Grafana and Prometheus integration available

Services communicate via gRPC (internal) and REST APIs (external), with protobuf definitions in `/proto`.

## H5P-Specific Critical Rules

1. H5P `content.json` stored as jsonb — never query into it, retrieve by ID
2. Library dependency resolution uses recursive CTEs, not application-level recursion
3. R2 paths follow: `h5p-libraries/{packages|extracted}/{machineName}-{version}/` and `h5p-content/{org_id}/{content_id}/` and `h5p-temp/{user_id}/{temp_uuid}/`
4. Hub API endpoints are REST (not ConnectRPC) for H5P client compatibility
5. Check existing components in `service-client/src/lib/components/` before creating new ones

## H5P File Storage Architecture

All H5P files are stored in R2 (Cloudflare) via the Go `file.Provider` interface. No filesystem storage.

### Storage Provider
- **Interface**: `app/service-core/domain/file/provider.go` — `Upload`, `Download`, `Remove`, `ListByPrefix`
- **R2 impl**: `app/service-core/domain/file/provider_r2.go` — AWS SDK v2 S3-compatible client
- **Backend selection**: `FILE_PROVIDER` env var (`r2`, `s3`, `gcs`, `azblob`, `local`)

### R2 Path Conventions

| Prefix | Path Pattern | Example |
|--------|-------------|---------|
| Libraries (extracted) | `h5p-libraries/extracted/{name}-{major}.{minor}.{patch}/{filepath}` | `h5p-libraries/extracted/H5P.MultiChoice-1.16.27/css/multichoice.css` |
| Libraries (packages) | `h5p-libraries/packages/{name}-{major}.{minor}.{patch}.h5p` | `h5p-libraries/packages/H5P.MultiChoice-1.16.27.h5p` |
| Content files | `h5p-content/{org_id}/{content_id}/{filename}` | `h5p-content/abc123/def456/tempId_image.jpg` |
| Temp files (editor) | `h5p-temp/{user_id}/{temp_uuid}/{filename}` | `h5p-temp/user123/tmp456/image.jpg` |

### Key Files

| File | Purpose |
|------|---------|
| `app/service-core/domain/file/provider.go` | Storage provider interface + factory |
| `app/service-core/domain/file/provider_r2.go` | R2 implementation |
| `app/service-core/domain/file/provider_s3client.go` | Shared S3 helpers (PutObject/GetObject/DeleteObject/ListObjectsV2) |
| `app/service-core/domain/h5p/installer.go` | Library extraction, `LibraryStorageKey()`, `PackageStorageKey()` |
| `app/service-core/domain/h5p/service.go` | Library install flow, asset serving, hub client |
| `app/service-core/domain/h5p/content.go` | Content CRUD, temp file migration (`migrateTempFiles()`) |
| `app/service-core/domain/h5p/temp.go` | Temp file upload/download during editing |

### Content Save Flow

1. **Author uploads media** → stored at `h5p-temp/{userId}/{tempId}/{filename}`, returned with `#tmp` suffix
2. **Author clicks Save** → `SaveContentFromEditor()` scans params for `#tmp` references
3. **Migrate temp files** → downloads from `h5p-temp/...`, uploads to `h5p-content/{orgId}/{contentId}/{tempId}_{filename}`
4. **Rewrite params** → replaces `"userId/tempId/filename#tmp"` with `"tempId_filename"` (filename only)
5. **Update DB** → `content_json` stored as JSONB with permanent file references
6. **Cleanup** → async delete of temp files (best-effort)

## Multi-Tenancy Architecture

### Database Model (Single Shared Database)

We use **shared database with row-level tenant isolation** — NOT separate databases per organisation. All organisations share the same tables with `organisation_id` columns for data separation.

**Key Tables:**
- `organisations` — Core tenant table with branding, billing, status
- `organisation_memberships` — User-Organisation relationships with roles (owner/admin/member)
- `organisation_form_options` — Customizable form dropdown options per organisation
- `organisation_profiles` — Organisation profile and settings
- `clients` — Scoped by `organisation_id`
- `form_submissions` — Scoped by `organisation_id`

### Data Isolation Pattern

**CRITICAL**: All database queries MUST use the `withOrganisationScope()` helper:

```typescript
// service-client/src/lib/server/db-helpers.ts
const submissions = await withOrganisationScope(organisationId, async (id) => {
    return db.query.formSubmissions.findMany({
        where: eq(formSubmissions.organisationId, id)
    });
});
```

### Form Customization Per Organisation

Organisations can customize dropdown options via `organisation_form_options` table.

**How it works:**
1. Layout loads organisation config in `[organisationSlug]/+layout.server.ts`
2. Config stored via `setOrganisationConfig()` module-level state
3. Form components call `getOrganisationConfig()` for options
4. Falls back to defaults if organisation has no custom options

### Permissions & Roles

Defined in `service-client/src/lib/server/permissions.ts`:
- **Owner**: Full access including billing, member role changes
- **Admin**: Settings, member management (except role changes), templates
- **Member**: Create/edit own content

### Subscription Tiers

Defined in `service-client/src/lib/server/subscription.ts`:
- `free`: 1 member, limited content
- `starter`: 3 members, moderate limits
- `growth`: 10 members, higher limits
- `enterprise`: Unlimited

## Key Files & Locations

### Multi-Tenancy Core
- `service-client/src/lib/server/organisation.ts` — Organisation context helpers (`getOrganisationContext()`, `CURRENT_ORGANISATION_COOKIE`)
- `service-client/src/lib/server/db-helpers.ts` — Data isolation helpers (`withOrganisationScope()`, `withOrganisationScopeAndUserId()`)
- `service-client/src/lib/server/permissions.ts` — Permission matrix (`checkOrganisationAccess()`)
- `service-client/src/lib/server/subscription.ts` — Tier enforcement (`enforceOrganisationLimits()`)
- `service-client/src/lib/stores/organisation-config.svelte.ts` — Form options store

### Schema
- `app/service-core/storage/schema_postgres.sql` — Go backend schema (reference for sqlc)
- `service-client/src/lib/server/schema.ts` — Drizzle schema (SvelteKit)

### Routes
- `service-client/src/routes/(app)/[organisationSlug]/` — Organisation-scoped routes
- `service-client/src/routes/(app)/organisations/` — Organisation management
- `service-client/src/routes/api/` — API endpoints

## Code Organization

### Backend Services (`/app`)
- **service-core/**: Core business logic, database layer, gRPC/REST APIs
- **service-admin/**: Admin interface, SSE server, gRPC client
- **pkg/**: Shared Go packages and utilities
- Go workspace with shared dependencies via `go.work`

### Frontend (`/service-client`)
- SvelteKit application with TypeScript
- Svelte 5 runes (`$state`, `$derived`, `$props`, `$effect`)
- TailwindCSS + DaisyUI for styling
- Vitest for unit testing, Playwright for e2e testing

### Infrastructure
- **proto/**: Protobuf definitions for gRPC services
- **scripts/**: Development automation scripts
- **monitoring/**: Grafana, Prometheus, Loki configs
- **infra/**: Terraform + Kubernetes deployment

## Development Commands

### Initial Setup
```bash
# Generate JWT keys for authentication (first time only)
sh scripts/keys.sh

# Compile SQL queries using sqlc
sh scripts/run_queries.sh postgres

# Generate protobuf code for gRPC
sh scripts/run_grpc.sh
```

### Running the Application
```bash
# Start all services with Docker Compose
docker compose up --build

# Run database migrations (local)
sh scripts/run_migrations.sh

# Run database migrations (production)
VPS_HOST=x.x.x.x VPS_USER=root sh scripts/run_migrations.sh production
```

### Build & Code Generation
```bash
make gen      # Generate proto + ConnectRPC types
make sql      # Run SQLC code generation
make migrate  # Apply migrations
```

### Development Tools
```bash
# Client-specific commands (in service-client/)
npm run dev          # Development server
npm run build        # Production build
npm run check        # TypeScript type checking
npm run test         # Run all tests (e2e + unit)
npm run test:unit    # Unit tests only
npm run test:e2e     # End-to-end tests
npm run lint         # Lint and format check
npm run format       # Auto-format code

# Format all frontend code
sh scripts/format.sh
```

### Service Ports
- Client: http://localhost:3000
- Admin: http://localhost:3001 (HTTP), http://localhost:3002 (SSE)
- Core API: http://localhost:4001 (HTTP), localhost:4002 (gRPC)
- PostgreSQL: localhost:5432
- MinIO (R2 dev): http://localhost:9000 (API) / http://localhost:9001 (console)
- NATS: localhost:8222
- Mailpit: http://localhost:8025 (Web UI), localhost:1025 (SMTP)

## Hot Reload

Both Go services use Air for hot reloading during development (configured via `.air.toml` files).

## Svelte 5 Compliance

This project uses Svelte 5. **NEVER use Svelte 4 patterns.**

```svelte
<!-- Props: Use $props() not export let -->
<script lang="ts">
    let { value, onChange }: Props = $props();
    let { progress = $bindable(0) } = $props(); // Two-way binding
</script>

<!-- State: Use $state() -->
let count = $state(0);
let items = $state([]);

<!-- Derived: Use $derived() -->
let doubled = $derived(count * 2);

<!-- Effects with cleanup -->
$effect(() => {
    const timer = setInterval(() => {}, 1000);
    return () => clearInterval(timer);
});

<!-- Events: Use onclick not on:click -->
<button onclick={handleClick}>Click</button>
<svelte:window onbeforeunload={handleUnload} />

<!-- Event modifiers: Use inline functions -->
<button onclick={(e) => { e.stopPropagation(); handler(); }}>Click</button>

<!-- Snippets instead of slots -->
{#snippet header(data)}
  <h2>{data.title}</h2>
{/snippet}
{@render header({ title: 'Hello' })}
```

## Confirmation Dialogs (CRITICAL)

**NEVER use native `confirm()`.** Always use styled DaisyUI modals with `modal modal-open`. See `.claude/notes/ui/gotchas.md` for full patterns.

Quick reference:
- Single action: `showDeleteModal` + `deletingItem` state + `btn-error` delete button
- Multi action (delete + cancel): generic `confirmModal` object with configurable title/message/actionClass/onConfirm
- Always include: loading spinner, disabled buttons during async, backdrop click to close, item name in bold
- Button colors: `btn-error` for delete/remove, `btn-warning` for cancel/revoke

## SvelteKit Remote Functions

This project uses **SvelteKit Remote Functions** for server-side data operations. Remote functions are server-side functions that can be called from the client.

### Critical Rules

**File Naming & Location:**
- Files MUST use `.remote.ts` extension
- Location: `src/lib/api/*.remote.ts`
- Do NOT place in `src/lib/server/` (reserved for server-only utilities)

**Export Restrictions (CRITICAL):**
- `.remote.ts` files can ONLY export functions wrapped with `query()`, `command()`, `form()`, or `prerender()`
- **Type exports are NOT allowed** — move types to separate `.types.ts` files
- Regular function exports will cause runtime errors

```typescript
// BAD - will cause "all exports must be remote functions" error
export type MyType = { ... };
export interface MyInterface { ... }
export const helper = () => { ... };

// GOOD - only remote function exports
export const getData = query(schema, async (input) => { ... });
export const saveData = command(schema, async (input) => { ... });
```

**Type Export Pattern:**
```typescript
// organisation-profile.types.ts - separate file for types
export type BrandingSettings = { ... };

// organisation-profile.remote.ts - import types, only export remote functions
import type { BrandingSettings } from './organisation-profile.types';
export const updateProfile = command(...);
```

### Why This Restriction Exists

Remote functions are **server-side functions callable from the client**. SvelteKit generates a client proxy that makes HTTP requests. When SvelteKit processes a `.remote.ts` file, it validates that every export follows the pattern. Regular exports will fail.

### Server-Only Utilities Pattern

**For functions called from client components** → Use `.remote.ts` with `query()`/`command()`:

```typescript
// organisation.remote.ts
export const createOrganisation = command(schema, async (data) => {
  // This CAN be called from client components
});
```

**For internal server-only utilities** → Use regular `.ts` files in `$lib/server/`:

```typescript
// $lib/server/beta-invites.ts
export async function markInviteAsUsed(token: string) {
  // ONLY callable from other server code (remote functions, hooks, +page.server.ts)
  await db.update(...)
}
```

### Function Types

| Type | Purpose | Usage |
|------|---------|-------|
| `query` | Read data | Cached, can be called during render |
| `command` | Write data | Cannot be called during render |
| `form` | Form submissions | Works without JS (progressive enhancement) |
| `prerender` | Build-time data | Cached in browser Cache API |

### Validation with Valibot

All functions accepting arguments MUST use Valibot schema validation:

```typescript
// CORRECT - schema as first argument
export const getOrganisation = query(
  v.pipe(v.string(), v.uuid()),
  async (organisationId) => { ... }
);

export const updateOrganisation = command(
  UpdateOrganisationSchema,
  async (data) => { ... }
);

// Functions with no arguments - no schema needed
export const getCurrentUser = query(async () => { ... });
```

### Optional Filter Parameters Pattern (CRITICAL)

For functions that accept optional filter objects, wrap the schema with `v.optional()`:

```typescript
const FiltersSchema = v.optional(
  v.object({
    status: v.optional(v.string()),
    limit: v.optional(v.pipe(v.number(), v.minValue(1), v.maxValue(100))),
    offset: v.optional(v.pipe(v.number(), v.minValue(0)))
  })
);

export const getItems = query(FiltersSchema, async (filters) => {
  const { status, limit = 50, offset = 0 } = filters || {};
});
```

### Request Context

Use `getRequestEvent()` for cookies and session data:

```typescript
import { getRequestEvent } from '$app/server';

export const myFunction = query(async () => {
  const event = getRequestEvent();
  const cookies = event.cookies;
});
```

Note: `route`, `params`, `url` from `getRequestEvent()` reflect the **calling page**, not the endpoint.

### Error Handling

```typescript
import { error, redirect } from '@sveltejs/kit';

export const myQuery = query(async () => {
  if (!authorized) throw error(403, 'Forbidden');
  if (needsLogin) throw redirect(302, '/login');
});
```

- `redirect()` works in `query`, `form`, `prerender` (NOT in `command`)
- `error()` throws HTTP errors in all function types

### Page Data Loading Pattern

SvelteKit remote functions support top-level `await` in components, but **on pages that have `+page.server.ts` AND call `command()` functions with stateful child components, prefer loading data in `+page.server.ts`** to avoid component remount issues.

See `.claude/notes/sveltekit-data-loading/` for full details.

```svelte
<!-- PREFERRED for pages with mutations + stateful components -->
<script lang="ts">
  let { data }: PageProps = $props();
  let items = $derived(data.items);         // reactive to server data
  let selected = $state(null);              // preserved across mutations
</script>
```

**When page has mutations + stateful components (forms, wizards):**
1. Fetch data in `+page.server.ts` `load` function
2. Read from `data` props in `+page.svelte` (no `await`)
3. After mutations, call `invalidateAll()` to re-run server load

**When page is read-only or simple:** Top-level `await` is fine and simpler.

### Remote Functions Files

| File | Purpose |
|------|---------|
| `organisation.remote.ts` | Organisation CRUD, members, form options |
| `organisation-profile.remote.ts` | Organisation profile and settings |
| `clients.remote.ts` | Client management |
| `forms.remote.ts` | Form operations |
| `billing.remote.ts` | Billing and subscriptions |
| `beta-invites.remote.ts` | Beta invite management |
| `reporting.remote.ts` | Reporting and analytics |
| `super-admin.remote.ts` | Super admin operations |
| `super-admin-templates.remote.ts` | Admin template management |
| `gdpr.remote.ts` | Data export, deletion |

### Type Files

| File | Types For |
|------|-----------|
| `organisation-profile.types.ts` | Organisation profile types |
| `agency-profile.types.ts` | Legacy profile types (to be cleaned up) |
| `reporting.types.ts` | Reporting data types |

## Database Migrations

### Migration System Overview

This project uses **raw SQL migrations** with numbered, idempotent files. Base tables are created by the Go backend SQLC schema; migrations handle incremental changes.

```
/migrations/
├── 001_initial_schema.sql    # Fresh start (Phase 0)
├── 002_h5p_libraries.sql     # Phase 1: H5P tables
└── ...
```

### Writing Migrations

All migrations **MUST be idempotent** (safe to run multiple times):

```sql
-- Good: Uses IF NOT EXISTS / IF EXISTS
CREATE TABLE IF NOT EXISTS my_table (...);
ALTER TABLE my_table ADD COLUMN IF NOT EXISTS new_col TEXT;
CREATE INDEX IF NOT EXISTS idx_name ON my_table(col);

-- Bad: Will fail on re-run
CREATE TABLE my_table (...);
ALTER TABLE my_table ADD COLUMN new_col TEXT;
```

### Running Migrations

```bash
# Local development
sh scripts/run_migrations.sh

# Production
VPS_HOST=your-vps-ip VPS_USER=root sh scripts/run_migrations.sh production
```

### Database Development Workflow

When making database changes:

1. **Start services**: `docker compose up`
2. **Create migration file**: Add `migrations/0XX_description.sql` with idempotent SQL
3. **Run migration**: `sh scripts/run_migrations.sh`
4. **Update Drizzle schema**: Add new tables/columns to `service-client/src/lib/server/schema.ts`
5. **Update Go schema** (if Go needs the tables): Modify `app/service-core/storage/schema_postgres.sql`
6. **Regenerate sqlc**: `sh scripts/run_queries.sh postgres`
7. **Type check**: `cd service-client && npm run check`

### Schema Files

| File | Purpose | When to Update |
|------|---------|----------------|
| `migrations/*.sql` | Source of truth for DB structure | Always (create new migration) |
| `service-client/src/lib/server/schema.ts` | Drizzle ORM schema for SvelteKit | After running migration |
| `app/service-core/storage/schema_postgres.sql` | Go sqlc reference schema | Only if Go queries the new tables |

### Important Notes

- **Never use `atlas schema apply` for migrations** — it's declarative and can be destructive
- **Go schema is reference only** — used by sqlc for type generation, not for migrations
- **All schema changes** go through numbered migration files first
- **Migrations run in order** — the script processes `*.sql` files alphabetically
- **Go backend uses `SELECT *`** on users table — new columns require sqlc regeneration

### What `schema_postgres.sql` Should Be Used For

The Go schema file (`app/service-core/storage/schema_postgres.sql`) should **only** be used for:

1. **sqlc code generation** — generating Go types for queries via `sh scripts/run_queries.sh postgres`
2. **Reference documentation** — showing what the full schema looks like in one place

It should **NOT** be used for:

- Schema migrations (use `/migrations/*.sql` instead)
- Atlas sync operations (`atlas schema apply`)
- As the source of truth for DB structure (migrations are the source of truth)

### Go Backend Sync

When adding columns to tables queried by the Go backend (especially `users` table):
1. Update `app/service-core/storage/schema_postgres.sql`
2. Run `sh scripts/run_queries.sh postgres` to regenerate sqlc code
3. Commit the generated files (`models.go`, `query_postgres.sql.go`)
4. Restart `leaplearn-core` service after migration

## Query Development Checklist

When writing or modifying database queries in remote functions:

1. **Read schema first**: Before writing a select query, read the table definition in `service-client/src/lib/server/schema.ts`
2. **Run type check**: Execute `npm run check` before committing to catch schema mismatches
3. **Never ignore TypeScript errors**: They indicate real bugs (e.g., selecting non-existent columns)
4. **Match exact column names**: Use the Drizzle column names, not assumed names
5. **Use Drizzle helpers for arrays**: Never use raw SQL like `` sql`${col} = ANY(${arr})` ``. Use `inArray(column, array)` from drizzle-orm instead — raw SQL doesn't properly escape array values

## Authentication Architecture

### JWT Token Flow

1. **Login**: User authenticates via Magic Link or OAuth
2. **Core Service**: Issues `access_token` (15 min) and `refresh_token` (30 days)
3. **Cookies**: Tokens stored as HTTP-only cookies with domain scope
4. **Refresh**: SvelteKit hooks automatically refresh expired access tokens

### Cookie Security

**Critical**: Cookie `secure` flag must be conditional on environment:

```typescript
const isProduction = env.DOMAIN !== 'localhost';

event.cookies.set("access_token", token, {
  path: "/",
  sameSite: "lax",
  secure: isProduction,  // false for localhost, true for production
  httpOnly: true,
  domain: env.DOMAIN,
  maxAge: ACCESS_TOKEN_MAX_AGE,
});
```

**Why**: `secure: true` cookies only work over HTTPS. Using `secure: true` in local development breaks authentication.

### Key Authentication Files

- `service-client/src/hooks.server.ts` — Auth middleware, token validation
- `service-client/src/lib/server/refresh.ts` — Token refresh logic
- `service-client/src/lib/server/jwt.ts` — JWT verification
- `app/service-core/rest/login_route.go` — Login endpoints, cookie setting

## Organisation Branding

Organisations can customize their branding with:
- `primaryColor` — Main brand color (buttons, links)
- `secondaryColor` — Light background color
- `accentColor` — Accent/highlight color
- `accentGradient` — CSS gradient for premium visual effects (optional, falls back to `accentColor`)
- `logoUrl` — Organisation logo (URL or base64 data URL)

### Branding Files

- `service-client/src/routes/(app)/[organisationSlug]/settings/branding/+page.svelte` — Branding settings UI
- `service-client/src/lib/api/organisation-profile.remote.ts` — Save branding data

## PostgreSQL Version Management

### Version Pinning (CRITICAL)

Always pin PostgreSQL to a specific major version:

```yaml
postgres:
  image: postgres:17-alpine  # Pinned to v17
```

**Why**: PostgreSQL data files are not compatible across major versions. If Docker pulls a newer version, the database will fail to start.

## Key Environment Variables

| Variable | Description |
|----------|-------------|
| `PUBLIC_APP_DOMAIN` | Domain for organisation URLs (e.g., `leaplearn.io`) |
| `DATABASE_URL` | PostgreSQL connection string for Drizzle |
| `DIRECT_URL` | Direct PostgreSQL URL (for migrations) |
| `POSTGRES_*` | PostgreSQL connection details |
| `MINIO_*` | MinIO/R2 storage credentials |

See `docker-compose.yml` for the complete list.

## Production Deployment

### Infrastructure Overview

Production uses:
- **Traefik**: Reverse proxy with automatic Let's Encrypt SSL
- **Docker Compose**: Container orchestration
- **GitHub Container Registry (GHCR)**: Image storage

### CI/CD Pipeline

**To deploy:** GitHub → Actions → "Deploy to Production" → "Run workflow"

### CRITICAL: Never Remove JWT Key Injection Steps

The deploy workflow writes `PRIVATE_KEY_PEM` and `PUBLIC_KEY_PEM` from GitHub Secrets to files before Docker build, then cleans them up. **These steps are essential.** Without them, production containers have no JWT keys and all logins fail.

**Do NOT remove, refactor, or "simplify" these steps.** See `.claude/notes/deployment/gotchas.md`.

### CRITICAL: Health Checks Must Match Container Tooling

- Go services (`debian:bookworm-slim`): use `curl`
- Node service (`node:22-slim`): use `node -e "fetch(...)"`
- **Do NOT use `wget`** in any health check or deploy script.

### Docker Networks

- `traefik-public`: External network connecting services to Traefik
- `leaplearn-internal`: Internal network for service-to-service communication

## Troubleshooting

### Common Issues

**Authentication redirect loop after login:**
- Check cookie `secure` flag matches environment (false for localhost)
- Clear browser cookies and retry

**Database connection failures after Docker restart:**
- Ensure PostgreSQL container is healthy before other services start
- Check `depends_on` with `condition: service_healthy`

**PostgreSQL won't start after Docker update:**
- Check if Docker pulled a newer PostgreSQL version
- Pin to the version matching your data (check `postgres_data` volume)

**Services can't connect to each other:**
- Use container names for internal communication (e.g., `leaplearn-core:4001`)
- Ensure services are on the same Docker network

**Login fails after adding database columns:**
- Go backend uses `SELECT *` on users table — new columns cause struct mismatch
- Run `sh scripts/run_queries.sh postgres` to regenerate sqlc code
- Restart `leaplearn-core` service after migration
- Commit generated files (`models.go`, `query_postgres.sql.go`) before deploying

## Self-Evolving Notes

This project uses a **self-evolving knowledge base** to capture learnings and prevent repeated mistakes.

### Directory Structure

```
.claude/
├── notes/
│   ├── billing/
│   │   ├── learnings.md
│   │   └── gotchas.md
│   ├── deployment/
│   │   ├── learnings.md
│   │   └── gotchas.md
│   ├── ui/
│   │   └── gotchas.md
│   ├── sveltekit-data-loading/
│   │   └── ...
│   └── {feature}/
│       ├── learnings.md
│       └── gotchas.md
```

### When Working on a Feature

1. **Before starting**: Check `.claude/notes/{feature}/` for existing learnings and gotchas
2. **After completing work**: Update the notes with anything new learned
3. **After fixing a bug**: Add the root cause and solution to gotchas.md

### The Magic Phrase

When Claude makes a mistake or misses something important, use:

> "Update the notes in `.claude/notes/{feature}/` so you don't make that mistake again."

This builds institutional knowledge over time and reduces repeated errors.

## What to Build vs Reuse

| Component | Action | Source |
|-----------|--------|--------|
| Docker Compose / Kubernetes / Helm | Copy + extend | Webkit |
| CI/CD GitHub Actions | Copy directly | Webkit |
| Grafana + monitoring stack | Copy directly | Webkit |
| Auth (OAuth2, JWT, sessions) | Copied directly | Webkit |
| Multi-tenancy (org scope) | Renamed agency → organisation | Webkit |
| GDPR data export | Copy + extend | Webkit |
| Subscription tiers | Copied directly | Webkit |
| Org settings / config options | Adapted from agency_form_options | Webkit |
| Svelte 5 shared components | Copied directly | Webkit |
| R2 file storage client | **Done** | Go `file.Provider` interface |
| H5P Hub API | **Done** | Go `hub_client.go` |
| H5P Library management | **Done** | Go installer + DB |
| H5P Content management | **Done** | Go content CRUD + R2 |
| H5P Editor integration | **Done** | Go editor routes + SvelteKit |
| H5P Player (embed) | **Done** | Go embed handler |
| Course management | **Done** | SvelteKit + Drizzle |
| Enrollment + progress tracking | **In progress** | Phase 4 |
| xAPI statement recording | **Done** | Go xAPI route |
