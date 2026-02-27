# LeapLearn H5P LMS — GoFast Architecture Blueprint

## Purpose

This document provides a complete architectural specification for migrating the LeapLearn H5P LMS platform from its current SvelteKit + MongoDB stack to a GoFast-based architecture (Go + ConnectRPC + PostgreSQL + SvelteKit). It is designed to be handed off to a developer agent for implementation.

The architecture is derived from the **Webkit project** (`github.com/jamestagal/webkit`), a multi-tenant SaaS agency proposal generator already built on GoFast. Webkit's proven patterns for multi-tenancy, authentication, role-based access, and SvelteKit integration are reused directly, with the agency/consultation domain replaced by H5P content management, course delivery, and learning management.

---

## 1. System Overview

### 1.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        LeapLearn Platform                               │
│                                                                         │
│  ┌──────────────┐   ConnectRPC    ┌──────────────┐                     │
│  │  SvelteKit   │◄──────────────►│  Go Core     │                     │
│  │  Client      │   (type-safe)   │  Service     │                     │
│  │  :3000       │                 │  :4001/:4002 │                     │
│  └──────┬───────┘                 └──────┬───────┘                     │
│         │                                │                              │
│  ┌──────┴───────┐                 ┌──────┴───────┐                     │
│  │  SvelteKit   │   ConnectRPC    │  Go Admin    │                     │
│  │  Admin       │◄──────────────►│  Service     │                     │
│  │  :3001       │                 │  :3001/:3002 │                     │
│  └──────────────┘                 └──────┬───────┘                     │
│                                          │                              │
│                                   ┌──────┴───────┐                     │
│                                   │  PostgreSQL  │                     │
│                                   │  :5432       │                     │
│                                   └──────────────┘                     │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                    Cloudflare R2 (File Storage)                   │  │
│  │  ├── h5p-libraries/official/packages/*.h5p                       │  │
│  │  ├── h5p-libraries/official/extracted/{name}-{ver}/              │  │
│  │  ├── h5p-libraries/custom/packages/*.h5p                         │  │
│  │  ├── h5p-libraries/custom/extracted/{name}-{ver}/                │  │
│  │  ├── h5p-content/{org_id}/{content_id}/                          │  │
│  │  └── h5p-assets/icons/ screenshots/                              │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Technology Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Frontend | SvelteKit V5 + Svelte 5 Runes + TailwindCSS | Reuse Webkit's `service-client` patterns |
| API Layer | ConnectRPC (Protobuf) | End-to-end type safety Go ↔ TypeScript |
| Backend | Go 1.25+ | Two services: Core + Admin (same as Webkit) |
| Database | PostgreSQL 18 | Single shared DB with row-level tenant isolation |
| File Storage | Cloudflare R2 (S3-compatible) | H5P libraries, content packages, media assets |
| Migrations | AtlasGo | Declarative schema management |
| SQL Queries | SQLC | Compile-time type-safe Go from raw SQL |
| Auth | OAuth2 + PKCE, Magic Links, JWT (EdDSA) | Directly from Webkit |
| Monitoring | Grafana LGTM (Loki, Tempo, Prometheus, OTel) | Directly from Webkit |
| Deployment | Docker Compose (dev) + Kubernetes + Helm (prod) | Directly from Webkit |
| CI/CD | GitHub Actions | Directly from Webkit |

### 1.3 What Transfers Directly from Webkit

These components require minimal or no modification:

- `docker-compose.yml` / `docker-compose.production.yml` / `docker-compose.monitoring.yml`
- `grafana/` — dashboards, datasources, provisioning
- `monitoring/` — Prometheus, Loki, Tempo configs
- `infra/` — Terraform infrastructure
- `kube/` — Kubernetes manifests + Helm charts
- `scripts/keys.sh` — JWT key generation
- `scripts/atlas.sh` — migration runner
- `scripts/run_queries.sh` — SQLC compilation
- `scripts/format.sh` — code formatting
- `.github/workflows/` — CI/CD pipelines
- `.claude/` — agent configuration
- Auth system (OAuth2, JWT, session management)
- Multi-tenancy core pattern (`withOrgScope()` adapted from `withAgencyScope()`)
- Role-based access control system
- Subscription tier enforcement
- GDPR data export endpoints
- Mailpit integration for dev email

---

## 2. Project Directory Structure

```
leaplearn/
├── .claude/                          # Agent configuration (from Webkit)
├── .github/workflows/                # CI/CD pipelines (from Webkit)
├── .planning/codebase/               # Architecture docs, planning
│
├── app/                              # Go backend application
│   ├── cmd/
│   │   ├── core/main.go              # Core service entrypoint
│   │   └── admin/main.go             # Admin service entrypoint
│   ├── internal/
│   │   ├── auth/                     # Auth middleware, JWT, OAuth (from Webkit)
│   │   ├── config/                   # Environment config (from Webkit)
│   │   ├── database/                 # DB connection, transaction helpers
│   │   ├── middleware/               # Logging, CORS, rate limiting
│   │   ├── r2/                       # NEW: Cloudflare R2 client wrapper
│   │   │   ├── client.go             # S3-compatible client for R2
│   │   │   ├── upload.go             # Upload with multipart support
│   │   │   ├── download.go           # Download + streaming
│   │   │   └── presign.go            # Pre-signed URL generation
│   │   │
│   │   ├── h5p/                      # NEW: H5P domain logic
│   │   │   ├── hub/                  # Catharsis-replacement hub service
│   │   │   │   ├── handler.go        # ConnectRPC handlers for hub API
│   │   │   │   ├── registry.go       # Content type registry builder
│   │   │   │   ├── mirror.go         # Mirror from H5P.org (scheduled)
│   │   │   │   └── queries.go        # SQLC query wrappers
│   │   │   ├── library/              # Library management
│   │   │   │   ├── handler.go        # CRUD handlers
│   │   │   │   ├── dependency.go     # Dependency graph resolver
│   │   │   │   ├── installer.go      # .h5p package install/extract
│   │   │   │   └── queries.go
│   │   │   ├── content/              # H5P content management
│   │   │   │   ├── handler.go        # Content CRUD handlers
│   │   │   │   ├── package.go        # .h5p packaging/extraction
│   │   │   │   ├── player.go         # Content delivery for h5p-standalone
│   │   │   │   └── queries.go
│   │   │   └── generator/            # Automated content generation
│   │   │       ├── handler.go        # Generation API handlers
│   │   │       ├── interactive_book.go
│   │   │       ├── flashcards.go
│   │   │       └── dialog_cards.go
│   │   │
│   │   ├── course/                   # NEW: Course/LMS domain
│   │   │   ├── handler.go            # Course CRUD handlers
│   │   │   ├── enrollment.go         # Student enrollment management
│   │   │   ├── progress.go           # Progress tracking
│   │   │   ├── path.go               # Learning path logic
│   │   │   └── queries.go
│   │   │
│   │   ├── org/                      # ADAPTED from Webkit: agencies → orgs
│   │   │   ├── handler.go            # Org CRUD + membership handlers
│   │   │   ├── membership.go         # Role management
│   │   │   ├── subscription.go       # Tier enforcement
│   │   │   ├── settings.go           # Per-org H5P settings
│   │   │   └── queries.go
│   │   │
│   │   └── user/                     # ADAPTED from Webkit
│   │       ├── handler.go
│   │       ├── profile.go
│   │       └── queries.go
│   │
│   ├── go.mod
│   └── go.sum
│
├── proto/                            # Protobuf service definitions
│   ├── auth/v1/auth.proto            # (from Webkit)
│   ├── user/v1/user.proto            # (from Webkit, adapted)
│   ├── org/v1/org.proto              # (adapted from agency.proto)
│   ├── h5p/v1/
│   │   ├── hub.proto                 # NEW: Hub API service
│   │   ├── library.proto             # NEW: Library management
│   │   ├── content.proto             # NEW: Content management
│   │   └── generator.proto           # NEW: Content generation
│   ├── course/v1/
│   │   ├── course.proto              # NEW: Course management
│   │   ├── enrollment.proto          # NEW: Enrollment service
│   │   └── progress.proto            # NEW: Progress tracking
│   └── buf.yaml
│
├── migrations/                       # AtlasGo SQL migrations
│   ├── 001_initial_auth.sql          # (from Webkit)
│   ├── 002_organisations.sql         # (adapted from agencies)
│   ├── 003_h5p_libraries.sql         # NEW
│   ├── 004_h5p_content.sql           # NEW
│   ├── 005_courses.sql               # NEW
│   ├── 006_enrollments_progress.sql  # NEW
│   └── schema.sql                    # Declarative target schema
│
├── service-client/                   # SvelteKit frontend (main app)
│   ├── src/
│   │   ├── lib/
│   │   │   ├── components/
│   │   │   │   ├── h5p/              # NEW: H5P-specific components
│   │   │   │   │   ├── H5PEditor.svelte
│   │   │   │   │   ├── H5PPlayer.svelte
│   │   │   │   │   ├── H5PLibraryBrowser.svelte
│   │   │   │   │   ├── H5PContentCard.svelte
│   │   │   │   │   └── H5PUploader.svelte
│   │   │   │   ├── course/           # NEW: Course components
│   │   │   │   │   ├── CourseBuilder.svelte
│   │   │   │   │   ├── CourseCard.svelte
│   │   │   │   │   ├── LearningPath.svelte
│   │   │   │   │   └── ProgressTracker.svelte
│   │   │   │   ├── org/              # ADAPTED from Webkit agency components
│   │   │   │   │   ├── OrgSwitcher.svelte
│   │   │   │   │   ├── MemberManager.svelte
│   │   │   │   │   └── RoleSelector.svelte
│   │   │   │   └── shared/           # (from Webkit: buttons, forms, modals)
│   │   │   ├── server/
│   │   │   │   ├── db/               # Drizzle ORM for SvelteKit direct DB
│   │   │   │   │   ├── schema.ts
│   │   │   │   │   └── index.ts
│   │   │   │   └── r2.ts             # R2 client for server-side operations
│   │   │   ├── stores/               # Svelte 5 runes-based stores
│   │   │   └── utils/
│   │   │       └── connectrpc.ts     # ConnectRPC client setup (from Webkit)
│   │   ├── routes/
│   │   │   ├── (auth)/               # Auth routes (from Webkit)
│   │   │   │   ├── login/
│   │   │   │   └── callback/
│   │   │   ├── (app)/                # Authenticated app routes
│   │   │   │   ├── orgs/             # Org listing/creation
│   │   │   │   │   ├── +page.svelte
│   │   │   │   │   └── create/+page.svelte
│   │   │   │   └── [orgSlug]/        # Org-scoped routes (from Webkit pattern)
│   │   │   │       ├── +layout.svelte
│   │   │   │       ├── +page.svelte  # Org dashboard
│   │   │   │       ├── courses/
│   │   │   │       │   ├── +page.svelte          # Course listing
│   │   │   │       │   ├── create/+page.svelte   # Course builder wizard
│   │   │   │       │   └── [courseId]/
│   │   │   │       │       ├── +page.svelte      # Course detail
│   │   │   │       │       ├── edit/+page.svelte
│   │   │   │       │       ├── learn/+page.svelte  # Student view
│   │   │   │       │       └── progress/+page.svelte
│   │   │   │       ├── content/
│   │   │   │       │   ├── +page.svelte          # H5P content library
│   │   │   │       │   ├── create/+page.svelte   # H5P editor
│   │   │   │       │   ├── [contentId]/
│   │   │   │       │   │   ├── +page.svelte      # Content preview/play
│   │   │   │       │   │   └── edit/+page.svelte
│   │   │   │       │   └── generate/+page.svelte # Bulk generation wizard
│   │   │   │       ├── members/+page.svelte
│   │   │   │       └── settings/+page.svelte     # Org settings + H5P config
│   │   │   └── api/
│   │   │       ├── h5p-hub/          # Catharsis-replacement endpoints
│   │   │       │   ├── sites/+server.ts
│   │   │       │   ├── content-types/+server.ts
│   │   │       │   └── content-types/[machineName]/+server.ts
│   │   │       ├── h5p/              # H5P editor/player API routes
│   │   │       │   ├── libraries/[...path]/+server.ts
│   │   │       │   └── content/[contentId]/+server.ts
│   │   │       ├── org/export/+server.ts     # GDPR export (from Webkit)
│   │   │       └── user/export/+server.ts    # GDPR export (from Webkit)
│   │   └── app.html
│   ├── package.json
│   ├── svelte.config.js
│   └── tailwind.config.js
│
├── shared/types/                     # Shared TypeScript types (from Webkit)
├── landing/                          # Marketing site (from Webkit)
├── grafana/                          # Monitoring dashboards (from Webkit)
├── monitoring/                       # Prom/Loki/Tempo config (from Webkit)
├── infra/                            # Terraform (from Webkit)
├── kube/                             # Kubernetes + Helm (from Webkit)
├── scripts/                          # Utility scripts (from Webkit)
├── docs/                             # Documentation
│
├── docker-compose.yml                # Local dev (from Webkit, add R2 mock)
├── docker-compose.production.yml     # Production (from Webkit)
├── docker-compose.monitoring.yml     # Monitoring (from Webkit)
├── gofast.json                       # GoFast CLI config
├── .env.example
├── .env.production.example
├── CLAUDE.md                         # Agent instructions
└── README.md
```

---

## 3. Database Schema

### 3.1 Design Principles

- **Single shared database** with row-level tenant isolation via `org_id` (adapted from Webkit's `agency_id` pattern)
- **`jsonb` columns** for flexible H5P data (content.json payloads, library metadata)
- **Relational tables** for structured data (users, orgs, courses, enrollments, progress)
- **SQLC** for all Go backend queries; **Drizzle ORM** for SvelteKit server-side direct DB access

### 3.2 Complete Schema

```sql
-- ============================================================
-- CORE TABLES (adapted from Webkit)
-- ============================================================

-- Users (from Webkit, minimal changes)
CREATE TABLE users (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email       TEXT UNIQUE NOT NULL,
    name        TEXT NOT NULL DEFAULT '',
    avatar_url  TEXT NOT NULL DEFAULT '',
    role        INT NOT NULL DEFAULT 0,  -- global platform role (bitwise RBAC)
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at  TIMESTAMPTZ
);

-- Organisations (adapted from Webkit agencies)
CREATE TABLE organisations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,
    slug            TEXT UNIQUE NOT NULL,
    description     TEXT NOT NULL DEFAULT '',
    logo_url        TEXT NOT NULL DEFAULT '',
    domain          TEXT NOT NULL DEFAULT '',

    -- Subscription / tier enforcement (from Webkit)
    subscription_tier   TEXT NOT NULL DEFAULT 'free'
        CHECK (subscription_tier IN ('free', 'starter', 'growth', 'enterprise')),
    stripe_customer_id  TEXT NOT NULL DEFAULT '',
    stripe_subscription_id TEXT NOT NULL DEFAULT '',

    -- H5P-specific settings
    hub_url             TEXT NOT NULL DEFAULT '',  -- custom hub URL, empty = use built-in
    max_storage_bytes   BIGINT NOT NULL DEFAULT 5368709120,  -- 5GB default
    storage_used_bytes  BIGINT NOT NULL DEFAULT 0,

    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at  TIMESTAMPTZ
);

-- Org memberships (from Webkit agency_memberships)
CREATE TABLE org_memberships (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id      UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role        TEXT NOT NULL DEFAULT 'student'
        CHECK (role IN ('owner', 'admin', 'teacher', 'student')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(org_id, user_id)
);

CREATE INDEX idx_org_memberships_org ON org_memberships(org_id);
CREATE INDEX idx_org_memberships_user ON org_memberships(user_id);

-- ============================================================
-- H5P LIBRARY TABLES
-- ============================================================

-- Master library registry (all installed libraries across the platform)
CREATE TABLE h5p_libraries (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    machine_name    TEXT NOT NULL,
    major_version   INT NOT NULL,
    minor_version   INT NOT NULL,
    patch_version   INT NOT NULL,
    title           TEXT NOT NULL DEFAULT '',
    description     TEXT NOT NULL DEFAULT '',

    -- Classification
    runnable        BOOLEAN NOT NULL DEFAULT false,  -- is this a top-level content type?
    origin          TEXT NOT NULL DEFAULT 'official'
        CHECK (origin IN ('official', 'custom')),
    
    -- Storage references (paths in R2)
    package_path    TEXT NOT NULL DEFAULT '',   -- e.g. "official/packages/H5P.Flashcards-1.5.4.h5p"
    extracted_path  TEXT NOT NULL DEFAULT '',   -- e.g. "official/extracted/H5P.Flashcards-1.5/"
    icon_path       TEXT NOT NULL DEFAULT '',   -- e.g. "official/extracted/H5P.Flashcards-1.5/icon.svg"

    -- Full library.json stored as jsonb for flexibility
    metadata_json   JSONB NOT NULL DEFAULT '{}',
    
    -- Hub display info
    categories      TEXT[] NOT NULL DEFAULT '{}',
    keywords        TEXT[] NOT NULL DEFAULT '{}',
    author          TEXT NOT NULL DEFAULT '',
    license         TEXT NOT NULL DEFAULT '',
    screenshots     TEXT[] NOT NULL DEFAULT '{}',

    -- Core API version required
    core_api_major  INT NOT NULL DEFAULT 1,
    core_api_minor  INT NOT NULL DEFAULT 24,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(machine_name, major_version, minor_version, patch_version)
);

CREATE INDEX idx_h5p_libraries_machine ON h5p_libraries(machine_name);
CREATE INDEX idx_h5p_libraries_runnable ON h5p_libraries(runnable) WHERE runnable = true;
CREATE INDEX idx_h5p_libraries_origin ON h5p_libraries(origin);

-- Library dependency graph (relational join table)
CREATE TABLE h5p_library_dependencies (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    library_id          UUID NOT NULL REFERENCES h5p_libraries(id) ON DELETE CASCADE,
    depends_on_id       UUID NOT NULL REFERENCES h5p_libraries(id) ON DELETE CASCADE,
    dependency_type     TEXT NOT NULL DEFAULT 'preloaded'
        CHECK (dependency_type IN ('preloaded', 'dynamic', 'editor')),
    UNIQUE(library_id, depends_on_id, dependency_type)
);

CREATE INDEX idx_h5p_lib_deps_lib ON h5p_library_dependencies(library_id);
CREATE INDEX idx_h5p_lib_deps_dep ON h5p_library_dependencies(depends_on_id);

-- Per-org library enablement (which content types each org can use)
CREATE TABLE h5p_org_libraries (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id      UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    library_id  UUID NOT NULL REFERENCES h5p_libraries(id) ON DELETE CASCADE,
    enabled     BOOLEAN NOT NULL DEFAULT true,
    restricted  BOOLEAN NOT NULL DEFAULT false,  -- only admins/teachers can use
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(org_id, library_id)
);

CREATE INDEX idx_h5p_org_libs_org ON h5p_org_libraries(org_id);

-- ============================================================
-- H5P CONTENT TABLES
-- ============================================================

-- Individual H5P content items
CREATE TABLE h5p_content (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    created_by      UUID NOT NULL REFERENCES users(id),

    -- Content metadata
    title           TEXT NOT NULL,
    description     TEXT NOT NULL DEFAULT '',
    slug            TEXT NOT NULL DEFAULT '',
    
    -- Library reference
    library_id      UUID NOT NULL REFERENCES h5p_libraries(id),
    
    -- The actual H5P content payload — stored as jsonb
    -- This is the content.json from inside the .h5p package
    content_json    JSONB NOT NULL DEFAULT '{}',

    -- Storage references (paths in R2)
    package_path    TEXT NOT NULL DEFAULT '',    -- "content/{org_id}/{id}/package.h5p"
    content_path    TEXT NOT NULL DEFAULT '',    -- "content/{org_id}/{id}/"
    
    -- Organisation + status
    status          TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'published', 'archived')),
    
    -- File manager virtual path (from SVAR File Manager pattern)
    folder_path     TEXT NOT NULL DEFAULT '/',
    
    -- Metadata
    tags            TEXT[] NOT NULL DEFAULT '{}',
    file_size_bytes BIGINT NOT NULL DEFAULT 0,
    view_count      INT NOT NULL DEFAULT 0,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_h5p_content_org ON h5p_content(org_id);
CREATE INDEX idx_h5p_content_library ON h5p_content(library_id);
CREATE INDEX idx_h5p_content_status ON h5p_content(org_id, status);
CREATE INDEX idx_h5p_content_folder ON h5p_content(org_id, folder_path);
CREATE INDEX idx_h5p_content_tags ON h5p_content USING GIN(tags);

-- Content folders for file-manager-style organisation
CREATE TABLE h5p_content_folders (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id      UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    path        TEXT NOT NULL,          -- "/presentations/unit-1"
    parent_path TEXT NOT NULL DEFAULT '/',
    created_by  UUID NOT NULL REFERENCES users(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(org_id, path)
);

CREATE INDEX idx_h5p_folders_org ON h5p_content_folders(org_id, parent_path);

-- ============================================================
-- COURSE / LMS TABLES
-- ============================================================

-- Courses
CREATE TABLE courses (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    created_by      UUID NOT NULL REFERENCES users(id),
    title           TEXT NOT NULL,
    description     TEXT NOT NULL DEFAULT '',
    slug            TEXT NOT NULL DEFAULT '',
    cover_image_url TEXT NOT NULL DEFAULT '',
    
    status          TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'published', 'archived')),
    
    -- Course structure stored as ordered jsonb
    -- Allows flexible section/module/lesson hierarchy
    structure_json  JSONB NOT NULL DEFAULT '[]',

    -- Settings
    is_self_paced       BOOLEAN NOT NULL DEFAULT true,
    require_sequential  BOOLEAN NOT NULL DEFAULT false,
    passing_score       INT NOT NULL DEFAULT 70,
    
    published_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_courses_org ON courses(org_id);
CREATE INDEX idx_courses_status ON courses(org_id, status);

-- Course items (links H5P content into course structure)
CREATE TABLE course_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id       UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    content_id      UUID REFERENCES h5p_content(id) ON DELETE SET NULL,
    
    -- Positioning
    section_index   INT NOT NULL DEFAULT 0,
    item_index      INT NOT NULL DEFAULT 0,
    
    -- Item metadata
    title           TEXT NOT NULL DEFAULT '',
    item_type       TEXT NOT NULL DEFAULT 'h5p'
        CHECK (item_type IN ('h5p', 'text', 'video', 'link', 'assignment')),
    
    -- For non-H5P items (text blocks, external links, etc.)
    item_data_json  JSONB NOT NULL DEFAULT '{}',
    
    -- Completion criteria
    required        BOOLEAN NOT NULL DEFAULT true,
    
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_course_items_course ON course_items(course_id);
CREATE INDEX idx_course_items_content ON course_items(content_id);

-- Student enrollments
CREATE TABLE enrollments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id       UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    org_id          UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    
    status          TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'completed', 'dropped', 'suspended')),
    
    enrolled_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at    TIMESTAMPTZ,
    
    -- Overall progress
    progress_pct    INT NOT NULL DEFAULT 0 CHECK (progress_pct BETWEEN 0 AND 100),
    score           INT,
    
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(course_id, user_id)
);

CREATE INDEX idx_enrollments_course ON enrollments(course_id);
CREATE INDEX idx_enrollments_user ON enrollments(user_id);
CREATE INDEX idx_enrollments_org ON enrollments(org_id);

-- Per-item progress tracking
CREATE TABLE progress_records (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    enrollment_id   UUID NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
    course_item_id  UUID NOT NULL REFERENCES course_items(id) ON DELETE CASCADE,
    
    status          TEXT NOT NULL DEFAULT 'not_started'
        CHECK (status IN ('not_started', 'in_progress', 'completed', 'failed')),
    
    score           INT,
    max_score       INT,
    time_spent_sec  INT NOT NULL DEFAULT 0,
    attempts        INT NOT NULL DEFAULT 0,
    
    -- xAPI / H5P state data
    state_json      JSONB NOT NULL DEFAULT '{}',
    
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(enrollment_id, course_item_id)
);

CREATE INDEX idx_progress_enrollment ON progress_records(enrollment_id);
CREATE INDEX idx_progress_item ON progress_records(course_item_id);

-- xAPI statements (append-only log)
CREATE TABLE xapi_statements (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organisations(id),
    user_id         UUID NOT NULL REFERENCES users(id),
    content_id      UUID REFERENCES h5p_content(id),
    course_id       UUID REFERENCES courses(id),
    
    verb            TEXT NOT NULL,       -- "completed", "answered", "attempted", etc.
    statement_json  JSONB NOT NULL,      -- full xAPI statement
    
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_xapi_org ON xapi_statements(org_id);
CREATE INDEX idx_xapi_user ON xapi_statements(org_id, user_id);
CREATE INDEX idx_xapi_content ON xapi_statements(content_id);
CREATE INDEX idx_xapi_created ON xapi_statements(created_at DESC);

-- ============================================================
-- H5P HUB TABLES (Catharsis replacement)
-- ============================================================

-- Hub registrations (H5P clients register with our hub)
CREATE TABLE h5p_hub_registrations (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_uuid   UUID NOT NULL DEFAULT gen_random_uuid(),
    site_url    TEXT NOT NULL DEFAULT '',
    core_version TEXT NOT NULL DEFAULT '',
    platform    TEXT NOT NULL DEFAULT '',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Cached hub registry (regenerated periodically)
-- Stored as a single jsonb document for fast retrieval
CREATE TABLE h5p_hub_cache (
    id              TEXT PRIMARY KEY DEFAULT 'current',
    registry_json   JSONB NOT NULL DEFAULT '{}',
    generated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ORG SETTINGS TABLES
-- ============================================================

-- Per-org configurable form options (from Webkit agency_form_options pattern)
-- Used for H5P content categories, tags, learning objectives, etc.
CREATE TABLE org_config_options (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id      UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    category    TEXT NOT NULL,       -- 'content_category', 'difficulty_level', 'subject_area', etc.
    label       TEXT NOT NULL,
    value       TEXT NOT NULL,
    sort_order  INT NOT NULL DEFAULT 0,
    is_default  BOOLEAN NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(org_id, category, value)
);

CREATE INDEX idx_org_config_org ON org_config_options(org_id, category);
```

---

## 4. Protobuf Service Definitions

### 4.1 H5P Hub Service (Catharsis Replacement)

```protobuf
// proto/h5p/v1/hub.proto
syntax = "proto3";
package h5p.v1;

option go_package = "leaplearn/proto/h5p/v1;h5pv1";

import "google/protobuf/timestamp.proto";

// H5PHubService replaces H5P.org's Content Type Hub API.
// Serves both official H5P content types and custom LeapLearn content types.
// Implements the same protocol as Catharsis/H5P.org so standard H5P clients work.
service H5PHubService {
    // Register a site with the hub (returns UUID)
    rpc RegisterSite(RegisterSiteRequest) returns (RegisterSiteResponse);
    
    // Get full content type registry
    rpc GetContentTypes(GetContentTypesRequest) returns (GetContentTypesResponse);
    
    // Download a content type package (.h5p file)
    // Note: This is served as a file download via REST, not gRPC
    // Implemented as a SvelteKit server route: GET /api/h5p-hub/content-types/:machineName
    
    // Admin: mirror official content types from H5P.org
    rpc MirrorFromH5POrg(MirrorFromH5POrgRequest) returns (MirrorFromH5POrgResponse);
    
    // Admin: add custom content type to hub
    rpc AddCustomContentType(AddCustomContentTypeRequest) returns (AddCustomContentTypeResponse);
    
    // Admin: regenerate hub registry cache
    rpc RegenerateRegistry(RegenerateRegistryRequest) returns (RegenerateRegistryResponse);
}

message RegisterSiteRequest {
    string uuid = 1;
    string site_url = 2;
    string platform_name = 3;
    string platform_version = 4;
    string h5p_version = 5;
    string core_api_version = 6;
}

message RegisterSiteResponse {
    string uuid = 1;
}

message GetContentTypesRequest {
    string uuid = 1;              // Site UUID from registration
    string current_locale = 2;    // Language preference
    // Usage stats (sent by H5P clients, logged but not required)
    int32 num_authors = 3;
    int32 libraries_count = 4;
}

message GetContentTypesResponse {
    repeated ContentTypeInfo content_types = 1;
    string api_version_major = 2;
    string api_version_minor = 3;
}

message ContentTypeInfo {
    string id = 1;               // machine name
    VersionInfo version = 2;
    VersionInfo core_api_version_needed = 3;
    string title = 4;
    string summary = 5;
    string description = 6;
    string icon = 7;             // URL to icon
    repeated string screenshots = 8;
    repeated string categories = 9;
    repeated string keywords = 10;
    string author = 11;
    string license = 12;
    string origin = 13;          // "official" or "custom"
    bool is_recommended = 14;
    int32 popularity = 15;
    google.protobuf.Timestamp created_at = 16;
    google.protobuf.Timestamp updated_at = 17;
}

message VersionInfo {
    int32 major = 1;
    int32 minor = 2;
    int32 patch = 3;
}

message MirrorFromH5POrgRequest {}
message MirrorFromH5POrgResponse {
    int32 libraries_added = 1;
    int32 libraries_updated = 2;
    repeated string errors = 3;
}

message AddCustomContentTypeRequest {
    // File upload handled separately; this registers metadata
    string machine_name = 1;
    string title = 2;
    string description = 3;
    string package_r2_path = 4;
    repeated string categories = 5;
    repeated string keywords = 6;
}

message AddCustomContentTypeResponse {
    string library_id = 1;
}

message RegenerateRegistryRequest {}
message RegenerateRegistryResponse {
    int32 content_types_count = 1;
}
```

### 4.2 H5P Library Service

```protobuf
// proto/h5p/v1/library.proto
syntax = "proto3";
package h5p.v1;

option go_package = "leaplearn/proto/h5p/v1;h5pv1";

service H5PLibraryService {
    // List all libraries (admin: all, org: enabled only)
    rpc ListLibraries(ListLibrariesRequest) returns (ListLibrariesResponse);
    
    // Get library with full dependency tree
    rpc GetLibrary(GetLibraryRequest) returns (GetLibraryResponse);
    
    // Install library from .h5p package (uploads to R2, extracts, registers)
    rpc InstallLibrary(InstallLibraryRequest) returns (InstallLibraryResponse);
    
    // Enable/disable library for an org
    rpc SetOrgLibraryStatus(SetOrgLibraryStatusRequest) returns (SetOrgLibraryStatusResponse);
    
    // Resolve full dependency tree for a library
    rpc ResolveDependencies(ResolveDependenciesRequest) returns (ResolveDependenciesResponse);
    
    // Delete library (admin only)
    rpc DeleteLibrary(DeleteLibraryRequest) returns (DeleteLibraryResponse);
}

message ListLibrariesRequest {
    string org_id = 1;              // empty = all (platform admin)
    bool runnable_only = 2;         // only top-level content types
    string origin_filter = 3;       // "official", "custom", or empty for all
    int32 page = 4;
    int32 page_size = 5;
}

message ListLibrariesResponse {
    repeated LibraryInfo libraries = 1;
    int32 total_count = 2;
}

message LibraryInfo {
    string id = 1;
    string machine_name = 2;
    int32 major_version = 3;
    int32 minor_version = 4;
    int32 patch_version = 5;
    string title = 6;
    string description = 7;
    bool runnable = 8;
    string origin = 9;
    string icon_url = 10;
    bool enabled = 11;         // for org context
    bool restricted = 12;      // for org context
    int32 dependency_count = 13;
    int32 content_count = 14;  // how many content items use this
}

message GetLibraryRequest {
    string library_id = 1;
    bool include_dependencies = 2;
}

message GetLibraryResponse {
    LibraryInfo library = 1;
    repeated LibraryInfo dependencies = 2;
}

message InstallLibraryRequest {
    string package_r2_path = 1;    // uploaded .h5p file path in R2
    string origin = 2;             // "official" or "custom"
}

message InstallLibraryResponse {
    string library_id = 1;
    string machine_name = 2;
    int32 dependencies_installed = 3;
}

message SetOrgLibraryStatusRequest {
    string org_id = 1;
    string library_id = 2;
    bool enabled = 3;
    bool restricted = 4;
}

message SetOrgLibraryStatusResponse {}

message ResolveDependenciesRequest {
    string library_id = 1;
    string dependency_type = 2;  // "preloaded", "dynamic", "editor", or "all"
}

message ResolveDependenciesResponse {
    repeated LibraryInfo resolved = 1;  // topologically sorted
}

message DeleteLibraryRequest {
    string library_id = 1;
}

message DeleteLibraryResponse {}
```

### 4.3 H5P Content Service

```protobuf
// proto/h5p/v1/content.proto
syntax = "proto3";
package h5p.v1;

option go_package = "leaplearn/proto/h5p/v1;h5pv1";

import "google/protobuf/timestamp.proto";

service H5PContentService {
    rpc CreateContent(CreateContentRequest) returns (CreateContentResponse);
    rpc GetContent(GetContentRequest) returns (GetContentResponse);
    rpc UpdateContent(UpdateContentRequest) returns (UpdateContentResponse);
    rpc DeleteContent(DeleteContentRequest) returns (DeleteContentResponse);
    rpc ListContent(ListContentRequest) returns (ListContentResponse);
    
    // Content delivery for h5p-standalone player
    rpc GetPlayerConfig(GetPlayerConfigRequest) returns (GetPlayerConfigResponse);
    
    // File manager operations
    rpc ListFolder(ListFolderRequest) returns (ListFolderResponse);
    rpc CreateFolder(CreateFolderRequest) returns (CreateFolderResponse);
    rpc MoveContent(MoveContentRequest) returns (MoveContentResponse);
    
    // xAPI / state management
    rpc SaveUserState(SaveUserStateRequest) returns (SaveUserStateResponse);
    rpc GetUserState(GetUserStateRequest) returns (GetUserStateResponse);
    rpc RecordXAPIStatement(RecordXAPIStatementRequest) returns (RecordXAPIStatementResponse);
}

message CreateContentRequest {
    string org_id = 1;
    string title = 2;
    string description = 3;
    string library_id = 4;
    string content_json = 5;       // content.json as string (parsed to jsonb on server)
    string folder_path = 6;
    repeated string tags = 7;
}

message CreateContentResponse {
    string content_id = 1;
    string upload_url = 2;         // pre-signed R2 URL for media uploads
}

message GetContentRequest {
    string content_id = 1;
    string org_id = 2;
}

message GetContentResponse {
    H5PContentInfo content = 1;
}

message H5PContentInfo {
    string id = 1;
    string org_id = 2;
    string title = 3;
    string description = 4;
    string library_id = 5;
    string library_name = 6;       // machine name for display
    string content_json = 7;
    string status = 8;
    string folder_path = 9;
    repeated string tags = 10;
    int64 file_size_bytes = 11;
    int32 view_count = 12;
    string created_by = 13;
    google.protobuf.Timestamp created_at = 14;
    google.protobuf.Timestamp updated_at = 15;
}

message UpdateContentRequest {
    string content_id = 1;
    string org_id = 2;
    string title = 3;
    string description = 4;
    string content_json = 5;
    string status = 6;
    repeated string tags = 7;
}

message UpdateContentResponse {}

message DeleteContentRequest {
    string content_id = 1;
    string org_id = 2;
}

message DeleteContentResponse {}

message ListContentRequest {
    string org_id = 1;
    string folder_path = 2;
    string status_filter = 3;
    string library_filter = 4;
    string search_query = 5;
    int32 page = 6;
    int32 page_size = 7;
}

message ListContentResponse {
    repeated H5PContentInfo content = 1;
    int32 total_count = 2;
}

message GetPlayerConfigRequest {
    string content_id = 1;
    string org_id = 2;
}

message GetPlayerConfigResponse {
    string content_json = 1;
    string library_name = 2;
    repeated string preloaded_js = 3;    // R2 URLs for library JS files
    repeated string preloaded_css = 4;   // R2 URLs for library CSS files
    string h5p_json = 5;                 // h5p.json metadata
}

message ListFolderRequest {
    string org_id = 1;
    string path = 2;
    string search = 3;
}

message ListFolderResponse {
    repeated FolderItem items = 1;
}

message FolderItem {
    string id = 1;
    string name = 2;
    string type = 3;       // "folder" or "file"
    string path = 4;
    int64 size = 5;
    string content_type = 6;   // H5P library name (for files)
    google.protobuf.Timestamp updated_at = 7;
}

message CreateFolderRequest {
    string org_id = 1;
    string name = 2;
    string parent_path = 3;
}

message CreateFolderResponse {
    string path = 1;
}

message MoveContentRequest {
    string org_id = 1;
    string content_id = 2;
    string target_folder_path = 3;
}

message MoveContentResponse {}

message SaveUserStateRequest {
    string content_id = 1;
    string user_id = 2;
    string data_id = 3;
    string state_json = 4;
}

message SaveUserStateResponse {}

message GetUserStateRequest {
    string content_id = 1;
    string user_id = 2;
    string data_id = 3;
}

message GetUserStateResponse {
    string state_json = 1;
}

message RecordXAPIStatementRequest {
    string org_id = 1;
    string content_id = 2;
    string course_id = 3;
    string verb = 4;
    string statement_json = 5;
}

message RecordXAPIStatementResponse {}
```

### 4.4 Course Service

```protobuf
// proto/course/v1/course.proto
syntax = "proto3";
package course.v1;

option go_package = "leaplearn/proto/course/v1;coursev1";

import "google/protobuf/timestamp.proto";

service CourseService {
    rpc CreateCourse(CreateCourseRequest) returns (CreateCourseResponse);
    rpc GetCourse(GetCourseRequest) returns (GetCourseResponse);
    rpc UpdateCourse(UpdateCourseRequest) returns (UpdateCourseResponse);
    rpc DeleteCourse(DeleteCourseRequest) returns (DeleteCourseResponse);
    rpc ListCourses(ListCoursesRequest) returns (ListCoursesResponse);
    rpc PublishCourse(PublishCourseRequest) returns (PublishCourseResponse);
    
    // Course items (H5P content within a course)
    rpc AddCourseItem(AddCourseItemRequest) returns (AddCourseItemResponse);
    rpc RemoveCourseItem(RemoveCourseItemRequest) returns (RemoveCourseItemResponse);
    rpc ReorderCourseItems(ReorderCourseItemsRequest) returns (ReorderCourseItemsResponse);
}

service EnrollmentService {
    rpc EnrollStudent(EnrollStudentRequest) returns (EnrollStudentResponse);
    rpc UnenrollStudent(UnenrollStudentRequest) returns (UnenrollStudentResponse);
    rpc ListEnrollments(ListEnrollmentsRequest) returns (ListEnrollmentsResponse);
    rpc GetStudentProgress(GetStudentProgressRequest) returns (GetStudentProgressResponse);
    rpc UpdateProgress(UpdateProgressRequest) returns (UpdateProgressResponse);
}

// Message definitions follow standard CRUD patterns.
// Omitted for brevity — generate with: gof model course title:string description:string
// then extend generated messages with the additional fields above.

message CreateCourseRequest {
    string org_id = 1;
    string title = 2;
    string description = 3;
    bool is_self_paced = 4;
    bool require_sequential = 5;
    int32 passing_score = 6;
}

message CreateCourseResponse {
    string course_id = 1;
}

message GetCourseRequest {
    string course_id = 1;
    string org_id = 2;
}

message GetCourseResponse {
    CourseInfo course = 1;
    repeated CourseItemInfo items = 2;
}

message CourseInfo {
    string id = 1;
    string org_id = 2;
    string title = 3;
    string description = 4;
    string slug = 5;
    string status = 6;
    string cover_image_url = 7;
    bool is_self_paced = 8;
    bool require_sequential = 9;
    int32 passing_score = 10;
    int32 enrolled_count = 11;
    int32 item_count = 12;
    google.protobuf.Timestamp created_at = 13;
    google.protobuf.Timestamp published_at = 14;
}

message CourseItemInfo {
    string id = 1;
    string content_id = 2;
    string title = 3;
    string item_type = 4;
    string library_name = 5;
    int32 section_index = 6;
    int32 item_index = 7;
    bool required = 8;
}

message ListCoursesRequest {
    string org_id = 1;
    string status_filter = 2;
    string search_query = 3;
    int32 page = 4;
    int32 page_size = 5;
}

message ListCoursesResponse {
    repeated CourseInfo courses = 1;
    int32 total_count = 2;
}

// Enrollment messages
message EnrollStudentRequest {
    string course_id = 1;
    string user_id = 2;
    string org_id = 3;
}

message EnrollStudentResponse {
    string enrollment_id = 1;
}

message GetStudentProgressRequest {
    string enrollment_id = 1;
}

message GetStudentProgressResponse {
    int32 progress_pct = 1;
    int32 score = 2;
    string status = 3;
    repeated ItemProgress items = 4;
}

message ItemProgress {
    string course_item_id = 1;
    string title = 2;
    string status = 3;
    int32 score = 4;
    int32 max_score = 5;
    int32 time_spent_sec = 6;
    int32 attempts = 7;
}

// Remaining messages follow the same pattern — generate scaffolding with gof.
message UpdateCourseRequest { string course_id = 1; string org_id = 2; string title = 3; string description = 4; }
message UpdateCourseResponse {}
message DeleteCourseRequest { string course_id = 1; string org_id = 2; }
message DeleteCourseResponse {}
message PublishCourseRequest { string course_id = 1; string org_id = 2; }
message PublishCourseResponse {}
message AddCourseItemRequest { string course_id = 1; string content_id = 2; string title = 3; string item_type = 4; int32 section_index = 5; int32 item_index = 6; }
message AddCourseItemResponse { string item_id = 1; }
message RemoveCourseItemRequest { string course_id = 1; string item_id = 2; }
message RemoveCourseItemResponse {}
message ReorderCourseItemsRequest { string course_id = 1; repeated string item_ids = 2; }
message ReorderCourseItemsResponse {}
message UnenrollStudentRequest { string enrollment_id = 1; }
message UnenrollStudentResponse {}
message ListEnrollmentsRequest { string course_id = 1; string org_id = 2; int32 page = 3; int32 page_size = 4; }
message ListEnrollmentsResponse { repeated EnrollmentInfo enrollments = 1; int32 total_count = 2; }
message EnrollmentInfo { string id = 1; string user_id = 2; string user_name = 3; string status = 4; int32 progress_pct = 5; }
message UpdateProgressRequest { string enrollment_id = 1; string course_item_id = 2; string status = 3; int32 score = 4; int32 max_score = 5; int32 time_spent_sec = 6; }
message UpdateProgressResponse {}
```

---

## 5. Catharsis Hub Integration — Implementation Detail

The H5P Hub API must be served as **standard HTTP REST endpoints** (not ConnectRPC) because H5P clients expect specific HTTP content types and form-encoded POST bodies. Implement these as SvelteKit server routes.

### 5.1 Endpoint Mapping

| H5P Client Expects | SvelteKit Route | Method | Implementation |
|---------------------|-----------------|--------|----------------|
| `POST /v1/sites` | `/api/h5p-hub/sites/+server.ts` | POST | Return `{ uuid: crypto.randomUUID() }` |
| `POST /v1/content-types/` | `/api/h5p-hub/content-types/+server.ts` | POST | Return full registry JSON from `h5p_hub_cache` |
| `GET /v1/content-types/:name` | `/api/h5p-hub/content-types/[machineName]/+server.ts` | GET | Stream .h5p from R2 |
| `GET /libraries/:name/icon.svg` | `/api/h5p-hub/libraries/[...path]/+server.ts` | GET | Serve icon from R2 |

### 5.2 Hub Registry JSON Format

The registry JSON returned by `/v1/content-types/` must match the H5P.org format:

```typescript
// service-client/src/routes/api/h5p-hub/content-types/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals }) => {
    // Fetch cached registry from PostgreSQL
    const registry = await locals.db
        .select()
        .from(h5pHubCache)
        .where(eq(h5pHubCache.id, 'current'))
        .limit(1);

    if (registry.length === 0) {
        return json({ contentTypes: [], apiVersion: { major: 1, minor: 27 } });
    }

    return json(registry[0].registryJson);
};
```

### 5.3 Registry Regeneration (Go backend)

```go
// app/internal/h5p/hub/registry.go
func (s *HubService) RegenerateRegistry(ctx context.Context) error {
    // Query all runnable libraries
    libraries, err := s.queries.ListRunnableLibraries(ctx)
    if err != nil {
        return err
    }

    contentTypes := make([]ContentTypeEntry, 0, len(libraries))
    for _, lib := range libraries {
        contentTypes = append(contentTypes, ContentTypeEntry{
            ID:      lib.MachineName,
            Version: Version{Major: lib.MajorVersion, Minor: lib.MinorVersion, Patch: lib.PatchVersion},
            CoreAPIVersionNeeded: Version{Major: lib.CoreApiMajor, Minor: lib.CoreApiMinor},
            Title:       lib.Title,
            Summary:     lib.Description,
            Description: lib.Description,
            Icon:        fmt.Sprintf("/api/h5p-hub/libraries/%s-%d.%d/icon.svg", lib.MachineName, lib.MajorVersion, lib.MinorVersion),
            Categories:  lib.Categories,
            Keywords:    lib.Keywords,
            Owner:       lib.Author,
            License:     lib.License,
            // Screenshots served from R2
            Screenshots: buildScreenshotURLs(lib),
            IsRecommended: lib.Origin == "official",
        })
    }

    registry := HubRegistry{
        ContentTypes: contentTypes,
        APIVersion:   Version{Major: 1, Minor: 27},
    }

    registryJSON, _ := json.Marshal(registry)
    return s.queries.UpsertHubCache(ctx, UpsertHubCacheParams{
        ID:           "current",
        RegistryJSON: registryJSON,
    })
}
```

### 5.4 H5P Editor Configuration

When initializing the H5P editor in SvelteKit, point it to your hub:

```typescript
// service-client/src/lib/components/h5p/H5PEditor.svelte
const hubUrl = `${window.location.origin}/api/h5p-hub`;

// Pass to H5P editor initialization
const integration = {
    hubRegistrationUrl: `${hubUrl}/sites`,
    hubContentTypesEndpoint: `${hubUrl}/content-types/`,
    // ... other config
};
```

---

## 6. R2 File Storage Layer

### 6.1 Go R2 Client

```go
// app/internal/r2/client.go
package r2

import (
    "context"
    "io"
    "github.com/aws/aws-sdk-go-v2/service/s3"
)

type Client struct {
    s3Client   *s3.Client
    bucketName string
}

func NewClient(accountID, accessKeyID, secretKey, bucketName string) *Client {
    // S3-compatible client pointing to R2 endpoint
    // Endpoint: https://{accountID}.r2.cloudflarestorage.com
}

func (c *Client) Upload(ctx context.Context, key string, body io.Reader, contentType string) error { ... }
func (c *Client) Download(ctx context.Context, key string) (io.ReadCloser, error) { ... }
func (c *Client) Delete(ctx context.Context, key string) error { ... }
func (c *Client) PresignGetURL(ctx context.Context, key string, expiry time.Duration) (string, error) { ... }
func (c *Client) ListPrefix(ctx context.Context, prefix string) ([]string, error) { ... }
```

### 6.2 R2 Bucket Organisation

```
leaplearn-h5p-bucket/
├── h5p-libraries/
│   ├── official/
│   │   ├── packages/
│   │   │   ├── H5P.Flashcards-1.5.4.h5p
│   │   │   ├── H5P.InteractiveBook-1.7.1.h5p
│   │   │   └── ...
│   │   └── extracted/
│   │       ├── H5P.Flashcards-1.5/
│   │       │   ├── icon.svg
│   │       │   ├── library.json
│   │       │   ├── presave.js
│   │       │   └── ...
│   │       └── H5P.InteractiveBook-1.7/
│   │           └── ...
│   └── custom/
│       ├── packages/
│       └── extracted/
│
├── h5p-content/
│   └── {org_id}/
│       └── {content_id}/
│           ├── content/
│           │   ├── content.json
│           │   └── images/
│           │       └── ...
│           └── h5p.json
│
└── h5p-assets/
    └── screenshots/
```

---

## 7. Migration Execution Plan

### Phase 0: Bootstrap (Day 1-2)

1. Copy Webkit infrastructure skeleton into new `leaplearn/` repo
2. Strip agency/consultation domain code
3. Rename `agency` → `organisation` throughout
4. Adapt roles from `owner/admin/member` to `owner/admin/teacher/student`
5. Verify Docker Compose boots cleanly with empty domain
6. Run `gof model` for initial scaffolding of H5P models

### Phase 1: Database + H5P Hub (Week 1)

1. Create migration files from schema above
2. Run `make migrate` to apply schema
3. Write SQLC queries for `h5p_libraries`, `h5p_hub_cache`
4. Implement R2 client package
5. Implement hub registry regeneration
6. Build SvelteKit hub API routes (3 endpoints)
7. Test with H5P editor pointing to local hub

### Phase 2: Library Management (Week 2)

1. Implement `H5PLibraryService` ConnectRPC handlers
2. Build .h5p package installer (extract ZIP, parse library.json, store in R2, register in DB)
3. Implement dependency graph resolver (recursive CTE query)
4. Build `h5p_org_libraries` enablement API
5. Create admin UI for library management in SvelteKit

### Phase 3: Content Management (Week 3)

1. Implement `H5PContentService` ConnectRPC handlers
2. Build content CRUD with R2 storage
3. Implement h5p-standalone player config endpoint
4. Build H5P editor integration in SvelteKit
5. Implement xAPI statement recording
6. Build content folder/file manager UI

### Phase 4: Course System (Week 4)

1. Implement `CourseService` and `EnrollmentService`
2. Build course builder wizard (adapted from Webkit consultation wizard)
3. Implement progress tracking
4. Build student course view with H5P content delivery
5. Build teacher dashboard with progress analytics

### Phase 5: Polish + Deploy (Week 5)

1. Implement content generation service (Interactive Book, Flashcards from CSV)
2. Add subscription tier enforcement for storage/content limits
3. GDPR export endpoints for org/user data
4. Configure Grafana dashboards for H5P-specific metrics
5. Deploy to Kubernetes using Webkit's Helm charts
6. DNS configuration for leaplearn.io

---

## 8. Key SQLC Queries

### 8.1 Library Dependency Resolution (Recursive CTE)

```sql
-- name: ResolveDependencyTree :many
WITH RECURSIVE dep_tree AS (
    -- Base case: direct dependencies
    SELECT
        d.depends_on_id AS library_id,
        d.dependency_type,
        1 AS depth
    FROM h5p_library_dependencies d
    WHERE d.library_id = $1
    
    UNION ALL
    
    -- Recursive case: transitive dependencies
    SELECT
        d.depends_on_id,
        d.dependency_type,
        dt.depth + 1
    FROM h5p_library_dependencies d
    JOIN dep_tree dt ON dt.library_id = d.library_id
    WHERE dt.depth < 20  -- prevent infinite recursion
)
SELECT DISTINCT
    l.id, l.machine_name, l.major_version, l.minor_version, l.patch_version,
    l.title, l.extracted_path, l.metadata_json
FROM dep_tree dt
JOIN h5p_libraries l ON l.id = dt.library_id
ORDER BY l.machine_name;
```

### 8.2 Org-Scoped Content Listing

```sql
-- name: ListContentByOrg :many
SELECT
    c.id, c.title, c.description, c.status, c.folder_path, c.tags,
    c.file_size_bytes, c.view_count, c.created_at, c.updated_at,
    l.machine_name AS library_name,
    u.name AS author_name
FROM h5p_content c
JOIN h5p_libraries l ON l.id = c.library_id
JOIN users u ON u.id = c.created_by
WHERE c.org_id = $1
    AND c.deleted_at IS NULL
    AND ($2::text = '' OR c.status = $2)
    AND ($3::text = '' OR c.folder_path = $3)
    AND ($4::text = '' OR c.title ILIKE '%' || $4 || '%')
ORDER BY c.updated_at DESC
LIMIT $5 OFFSET $6;
```

### 8.3 Student Progress Dashboard

```sql
-- name: GetCourseProgressForStudent :many
SELECT
    ci.id AS course_item_id,
    ci.title,
    ci.item_type,
    ci.section_index,
    ci.item_index,
    ci.required,
    l.machine_name AS library_name,
    COALESCE(pr.status, 'not_started') AS status,
    pr.score,
    pr.max_score,
    pr.time_spent_sec,
    pr.attempts,
    pr.completed_at
FROM course_items ci
LEFT JOIN h5p_content hc ON hc.id = ci.content_id
LEFT JOIN h5p_libraries l ON l.id = hc.library_id
LEFT JOIN progress_records pr ON pr.course_item_id = ci.id
    AND pr.enrollment_id = $1
WHERE ci.course_id = $2
ORDER BY ci.section_index, ci.item_index;
```

---

## 9. Multi-Tenancy Scope Helper

Adapted directly from Webkit's `withAgencyScope()`:

```go
// app/internal/middleware/org_scope.go
package middleware

import (
    "context"
    "errors"
)

type OrgContextKey struct{}

func WithOrgScope(ctx context.Context) (string, error) {
    orgID, ok := ctx.Value(OrgContextKey{}).(string)
    if !ok || orgID == "" {
        return "", errors.New("org_id not found in context")
    }
    return orgID, nil
}
```

```typescript
// service-client/src/lib/server/org-scope.ts
// Adapted from Webkit's withAgencyScope()
export async function withOrgScope<T>(
    orgId: string,
    fn: (id: string) => Promise<T>
): Promise<T> {
    if (!orgId) throw new Error('Organisation ID required');
    return fn(orgId);
}
```

---

## 10. Environment Variables

```env
# .env.example (extends Webkit's .env.example)

# === FROM WEBKIT (unchanged) ===
PUBLIC_APP_DOMAIN=leaplearn.io
DATABASE_URL=postgres://postgres:postgres@postgres:5432/leaplearn?sslmode=disable
DIRECT_URL=postgres://postgres:postgres@localhost:5432/leaplearn?sslmode=disable
JWT_PRIVATE_KEY_PATH=./keys/private.pem
JWT_PUBLIC_KEY_PATH=./keys/public.pem
OAUTH_GITHUB_CLIENT_ID=
OAUTH_GITHUB_CLIENT_SECRET=
OAUTH_GOOGLE_CLIENT_ID=
OAUTH_GOOGLE_CLIENT_SECRET=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
POSTMARK_SERVER_TOKEN=

# === NEW: Cloudflare R2 ===
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=leaplearn-h5p
R2_PUBLIC_URL=https://h5p-cdn.leaplearn.io  # Custom domain for R2 bucket

# === NEW: H5P Configuration ===
H5P_HUB_MIRROR_ENABLED=true
H5P_HUB_MIRROR_CRON=0 3 * * *  # Mirror from H5P.org at 3am daily
H5P_CORE_API_MAJOR=1
H5P_CORE_API_MINOR=27
```

---

## 11. Docker Compose Additions

Add to Webkit's `docker-compose.yml`:

```yaml
services:
  # ... existing services from Webkit (postgres, core, admin, client, mailpit) ...

  # MinIO for local R2 development
  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    ports:
      - "9000:9000"
      - "9001:9001"  # MinIO console
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    volumes:
      - minio_data:/data

  # Create default bucket on startup
  minio-init:
    image: minio/mc:latest
    depends_on:
      - minio
    entrypoint: >
      /bin/sh -c "
      sleep 5;
      mc alias set local http://minio:9000 minioadmin minioadmin;
      mc mb local/leaplearn-h5p --ignore-existing;
      mc anonymous set download local/leaplearn-h5p/h5p-libraries;
      "

volumes:
  minio_data:
```

---

## 12. CLAUDE.md Agent Instructions

```markdown
# LeapLearn H5P LMS — Agent Instructions

## Project Overview
Multi-tenant H5P Learning Management System built on GoFast stack.
Target domain: leaplearn.io

## Architecture
- Go backend (Core + Admin services) with ConnectRPC
- SvelteKit V5 frontend with Svelte 5 runes
- PostgreSQL with SQLC (Go) and Drizzle (SvelteKit)
- Cloudflare R2 for H5P file storage
- Based on Webkit project patterns (github.com/jamestagal/webkit)

## Critical Rules
1. ALWAYS scope database queries by org_id for tenant isolation
2. Use withOrgScope() helper for all org-scoped operations
3. H5P content.json stored as jsonb — never query into it, retrieve by ID
4. Library dependency resolution uses recursive CTEs, not application-level recursion
5. R2 paths follow: h5p-libraries/{origin}/{packages|extracted}/ and h5p-content/{org_id}/{content_id}/
6. Hub API endpoints are REST (not ConnectRPC) for H5P client compatibility
7. Check existing components in service-client/src/lib/components/ before creating new ones

## Build Commands
- `make gen` — Generate proto + ConnectRPC types
- `make sql` — Run SQLC code generation
- `make migrate` — Apply AtlasGo migrations
- `docker compose up --build` — Start all services
- `sh scripts/keys.sh` — Generate JWT keys (first time only)

## Service Ports
- Client: http://localhost:3000
- Admin: http://localhost:3001
- Core API: http://localhost:4001 (HTTP) / localhost:4002 (gRPC)
- PostgreSQL: localhost:5432
- MinIO (R2 dev): http://localhost:9000 (API) / http://localhost:9001 (console)
- Mailpit: http://localhost:8025
```

---

## 13. Summary of What to Build vs Reuse

| Component | Action | Source |
|-----------|--------|--------|
| Docker Compose / Kubernetes / Helm | Copy + extend | Webkit |
| CI/CD GitHub Actions | Copy directly | Webkit |
| Grafana + monitoring stack | Copy directly | Webkit |
| Terraform infrastructure | Copy + adapt | Webkit |
| Auth (OAuth2, JWT, sessions) | Copy directly | Webkit |
| Multi-tenancy (org scope) | Rename agency → org, add roles | Webkit |
| GDPR data export | Copy + extend | Webkit |
| Subscription tiers | Copy directly | Webkit |
| Org settings / config options | Adapt from agency_form_options | Webkit |
| SvelteKit ConnectRPC client setup | Copy directly | Webkit |
| Svelte 5 shared components | Copy directly | Webkit |
| R2 file storage client | **Build new** | — |
| H5P Hub API (Catharsis replacement) | **Build new** | Catharsis spec |
| H5P Library management | **Build new** | — |
| H5P Content management | **Build new** | — |
| H5P Editor integration | **Build new** | Existing SvelteKit code |
| H5P Player (h5p-standalone) | **Build new** | — |
| Course management | **Build new** | — |
| Enrollment + progress tracking | **Build new** | — |
| xAPI statement recording | **Build new** | — |
| Content generation (CLI tools) | **Adapt** | h5p-cli-creator |
| Multi-step wizard (course builder) | Adapt from consultation wizard | Webkit |
