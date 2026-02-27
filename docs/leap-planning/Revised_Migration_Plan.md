# LeapLearn — Revised Migration Plan

**Strategy: Webkit skeleton + LEAP SvelteKit port + PostgreSQL**

This plan replaces Section 7 ("Migration Execution Plan") of the original Architecture Blueprint. The database schema (Section 3), R2 storage layout (Section 6), environment variables (Section 10), and Docker Compose additions (Section 11) from the blueprint remain valid and should be referenced alongside this plan.

---

## What changes from the original blueprint

| Original Blueprint | Revised Plan |
|---|---|
| Build H5P Library/Content/Hub services as Go ConnectRPC handlers | Port existing LEAP SvelteKit services, swap MongoDB → Drizzle/PostgreSQL |
| Write H5PEditor, H5PPlayer, H5PLibraryBrowser components from scratch | Copy LEAP's 15 H5P components + 12 course components directly |
| Build course builder wizard adapted from Webkit consultation wizard | Port LEAP's existing CourseStructureEditor + ModuleSection + LessonItem |
| 5-week timeline | 6–8 week timeline (more realistic given data migration complexity) |
| ConnectRPC for all H5P/Course APIs | SvelteKit Remote Functions + Drizzle for H5P/Course. Go handles auth, org management, background jobs. ConnectRPC optional for new Go services later |
| AtlasGo for migrations | Raw SQL migrations (matching Webkit's actual pattern) |

## What stays the same

Everything in the blueprint's "What Transfers Directly from Webkit" list (Section 1.3) is confirmed accurate. The PostgreSQL schema (Section 3.2) is well-designed and should be used as-is. The R2 bucket structure (Section 6.2), SQLC queries (Section 8), multi-tenancy scope helper (Section 9), and environment variables (Section 10) are all valid.

---

## Phase 0: Webkit Skeleton Setup (Days 1–3)

**Goal:** A booting LeapLearn project with Webkit's infrastructure, no domain code.

### Tasks

1. Clone Webkit into new `leaplearn/` repo
2. Strip all agency/consultation domain code from:
   - `service-client/src/routes/(app)/[agencySlug]/` → empty shell for `[orgSlug]/`
   - `service-client/src/lib/api/*.remote.ts` → remove agency/consultation/proposal/contract files
   - `service-client/src/lib/components/` → remove agency-specific components, keep shared UI
   - Go backend `rest/` and `grpc/` → remove consultation/note handlers, keep auth/user/billing
3. Rename throughout:
   - `agency` → `organisation` (DB, code, routes, types)
   - `agencySlug` → `orgSlug`
   - `agencyId` → `orgId`
   - `withAgencyScope()` → `withOrgScope()`
   - `agency_memberships` → `org_memberships`
4. Adapt roles: `owner/admin/member` → `owner/admin/teacher/student`
5. Update `org_memberships` schema to include `teacher` and `student` roles
6. Add MinIO service to `docker-compose.yml` (from blueprint Section 11)
7. Verify `docker compose up` boots cleanly with: PostgreSQL, Go Core (auth working), Go Admin, SvelteKit client, NATS, Mailpit, MinIO
8. Verify login flow works end-to-end (Magic Link → JWT → session)

### Deliverable
A running skeleton at `localhost:3000` with login, org creation, member management, and empty org dashboard.

### What you keep from Webkit
- Auth system (OAuth2 + PKCE, Magic Links, EdDSA JWT, token refresh)
- Multi-tenancy (withOrgScope, permissions matrix, subscription tiers)
- Docker Compose (all services), CI/CD (GitHub Actions), monitoring (Grafana LGTM)
- SvelteKit patterns (Remote Functions, Valibot, Svelte 5 runes, DaisyUI)
- Drizzle ORM setup + schema.ts foundation
- Deployment infrastructure (Traefik, Kubernetes/Helm charts)

---

## Phase 1: PostgreSQL Schema + Data Migration Tooling (Week 1)

**Goal:** H5P and course tables in PostgreSQL, migration scripts ready.

### Tasks

1. Create migration files from blueprint Section 3.2 schema:
   - `001_initial_auth.sql` — users, sessions (from Webkit, already exists)
   - `002_organisations.sql` — organisations, org_memberships (adapted from Webkit agencies)
   - `003_h5p_libraries.sql` — h5p_libraries, h5p_library_dependencies, h5p_org_libraries
   - `004_h5p_content.sql` — h5p_content, h5p_content_folders
   - `005_courses.sql` — courses, course_items
   - `006_enrollments_progress.sql` — enrollments, progress_records, xapi_statements
   - `007_h5p_hub.sql` — h5p_hub_registrations, h5p_hub_cache
   - `008_org_config.sql` — org_config_options
2. Run migrations locally: `sh scripts/run_migrations.sh`
3. Update Drizzle `schema.ts` to match all new tables
4. Run `npm run check` in service-client to verify types
5. Write SQLC queries for Go backend (auth-related tables only — Go doesn't need H5P queries)
6. Build MongoDB → PostgreSQL migration script:
   - Map LEAP's 12 Mongoose models to PostgreSQL tables
   - Handle H5P content.json → JSONB column
   - Map LEAP's `tenantId`/`organizationId` → `org_id` UUID
   - Generate UUID primary keys for all records
   - Export R2 storage paths unchanged (R2 bucket structure stays the same)

### Deliverable
All tables created, Drizzle types generated, migration script tested against LEAP's dev MongoDB data.

### Data model mapping

| LEAP MongoDB Model | PostgreSQL Table | Notes |
|---|---|---|
| H5PContent | h5p_content | content.json → JSONB, tenantId → org_id |
| H5PLibrary | h5p_libraries | metadata → metadata_json JSONB |
| H5PHubLibrary | h5p_hub_cache | Flatten into cached registry JSON |
| H5PFolder | h5p_content_folders | path-based hierarchy stays the same |
| H5PProgress | progress_records | Link to enrollments via enrollment_id |
| Course | courses | structure → structure_json JSONB, modules → course_items |
| Product | — | Handle via Stripe/subscription tier instead |
| Subscription | — | Managed by Webkit's existing Stripe integration |
| Tenant | organisations | Direct mapping, add subscription fields |
| Analytics | xapi_statements | Restructure as xAPI append-only log |
| AuditLog | — | Use Webkit's existing audit/logging patterns |
| CacheEntry | h5p_hub_cache | Single cached registry document |

---

## Phase 2: Port H5P Core Services (Weeks 2–3)

**Goal:** H5P editor, player, and hub working in the new stack.

### Week 2: H5P Hub + Library Management

1. Port LEAP's hub endpoints to SvelteKit server routes (they're already SvelteKit):
   - `/api/h5p-hub/sites/+server.ts` — return UUID (from LEAP's existing endpoint)
   - `/api/h5p-hub/content-types/+server.ts` — return registry from `h5p_hub_cache` via Drizzle
   - `/api/h5p-hub/content-types/[machineName]/+server.ts` — stream .h5p from R2
2. Port LEAP's library services, swapping MongoDB for Drizzle:
   - `unifiedLibraryService.js` → `library.remote.ts` (SvelteKit Remote Function)
   - `r2LibraryService.js` → keep as-is (R2 client doesn't change)
   - `h5pHubSync.js` → `hub-sync.remote.ts`
3. Port LEAP's admin library management pages:
   - `LibraryManager.svelte` → copy to `service-client/src/lib/components/h5p/`
   - Admin routes for library install, sync, enable/disable
4. Write Drizzle queries replacing Mongoose calls:
   - `db.select().from(h5pLibraries).where(eq(h5pLibraries.runnable, true))`
   - `db.insert(h5pLibraries).values({...})`
   - Dependency resolution: use blueprint's recursive CTE (Section 8.1) via `db.execute(sql\`...\`)`

### Week 3: H5P Content + Editor + Player

1. Port LEAP's content CRUD:
   - `H5PContent` model operations → `content.remote.ts` with Drizzle
   - Content status management (draft/published/archived)
   - Folder management (h5p_content_folders)
   - Tags, search, filtering
2. Port H5P editor integration:
   - `H5PEditor.svelte` → copy directly (browser-side, no DB dependency)
   - `h5pServerService.js` → adapt for PostgreSQL storage backend
   - `h5pExpressWrapper.js` → keep or port to SvelteKit hooks (evaluate complexity)
   - Editor API routes: library loading, content saving, media upload
3. Port H5P player:
   - `H5PPlayer.svelte` → copy directly
   - `h5pStandaloneService.js` → adapt R2 URLs for library JS/CSS delivery
   - Player config endpoint: resolve dependencies, build preloaded asset lists
4. Port file manager:
   - `H5PFileManager.svelte`, `H5PFilePreview.svelte`, `H5PDragDrop.svelte` → copy
   - Folder CRUD via Drizzle instead of Mongoose
5. Port remaining H5P components:
   - `H5PHubBrowser.svelte`, `H5PBatchImportDialog.svelte`, `H5PInstallationProgress.svelte`
   - `H5PHubStatus.svelte`, `H5PContextMenu.svelte`, `H5PDataTable.svelte`, `H5PQuickStart.svelte`

### Key decision: @lumieducation/h5p-server

LEAP currently uses `@lumieducation/h5p-server` v10.0.4 which provides:
- Content type validation
- Library dependency resolution
- Package import/export (.h5p files)
- Editor integration hooks

**Recommendation:** Keep this dependency in the SvelteKit server-side code. It runs in Node.js (which SvelteKit provides). Replacing its internals with Go would be the single largest rewrite task with the least benefit. Instead, swap its storage backends:
- `FileContentStorage` → custom PostgreSQL + R2 storage adapter
- `FileLibraryStorage` → custom R2 storage adapter
- `DirectoryTemporaryFileStorage` → keep (temp files are ephemeral)

---

## Phase 3: Port Course System (Week 4)

**Goal:** Course creation, enrollment, and student learning experience working.

### Tasks

1. Port course CRUD:
   - `Course.js` model operations → `course.remote.ts` with Drizzle
   - Course structure stored as `structure_json` JSONB (matches LEAP's existing pattern)
   - Course items linking H5P content into course structure
2. Port course components:
   - `CourseStructureEditor.svelte`, `ModuleSection.svelte`, `LessonItem.svelte` → copy
   - `CourseManager.svelte`, `CreateCourseModal.svelte`, `CourseCard.svelte` → copy
   - `ContentTabs.svelte`, `NavigationControls.svelte` → copy
3. Port learning player:
   - `LearningPlayer.svelte`, `NavigationMenu.svelte`, `ProgressBar.svelte` → copy
   - Wire H5P player into course item rendering
4. Port enrollment system:
   - Create `enrollment.remote.ts` with Drizzle queries
   - Enrollment status management (active/completed/dropped/suspended)
   - Link to org membership (students must be org members)
5. Port progress tracking:
   - `H5PProgress.js` operations → Drizzle queries against `progress_records`
   - xAPI statement recording → `xapi_statements` append-only table
   - Course-level progress calculation (% complete, scores)
6. Build instructor dashboard:
   - Port LEAP's instructor routes and views
   - Student progress overview using blueprint's query (Section 8.3)
   - Course analytics (completion rates, average scores, time spent)

### Routes to create

```
service-client/src/routes/(app)/[orgSlug]/
├── courses/
│   ├── +page.svelte              # Course listing
│   ├── create/+page.svelte       # Course builder
│   └── [courseId]/
│       ├── +page.svelte          # Course detail
│       ├── edit/+page.svelte     # Course editor
│       ├── learn/+page.svelte    # Student learning view
│       └── progress/+page.svelte # Instructor progress view
├── content/
│   ├── +page.svelte              # H5P content library
│   ├── create/+page.svelte       # H5P editor
│   ├── generate/+page.svelte     # Bulk generation
│   └── [contentId]/
│       ├── +page.svelte          # Content preview/play
│       └── edit/+page.svelte     # Content edit
├── members/+page.svelte          # Org members (from Webkit)
└── settings/+page.svelte         # Org settings + H5P config
```

---

## Phase 4: Integration + Polish (Weeks 5–6)

**Goal:** Everything connected, subscription enforcement, production-ready.

### Tasks

1. Subscription tier enforcement (from Webkit, adapted for H5P limits):
   - Free: 1 teacher, 50 content items, 1GB storage
   - Starter: 5 teachers, 500 content items, 10GB storage
   - Growth: 25 teachers, unlimited content, 100GB storage
   - Enterprise: unlimited everything
2. Wire Stripe integration (from Webkit's existing billing):
   - Checkout flow for tier upgrades
   - Webhook handling for subscription status changes
   - Usage metering (content count, storage used)
3. Implement content generation service:
   - Port from LEAP if existing, or build fresh
   - Interactive Book generation from structured text
   - Flashcard generation from CSV
4. GDPR data export (extend Webkit's existing endpoints):
   - Org data export (all content, courses, progress)
   - User data export (personal content, progress records)
5. Configure Grafana dashboards for H5P metrics:
   - Content creation/view rates
   - Course completion rates
   - Storage usage per org
   - xAPI statement volume
6. End-to-end testing:
   - Auth flow → org creation → content creation → course building → student enrollment → learning → progress tracking
   - Multi-tenant isolation verification
   - Subscription limit enforcement

---

## Phase 5: Deployment (Week 7)

**Goal:** Production deployment on existing VPS infrastructure.

### Tasks

1. Update `docker-compose.production.yml`:
   - Add MinIO/R2 configuration (or use Cloudflare R2 directly in production)
   - Update service environment variables
   - Configure health checks
2. Run production migration:
   - `VPS_HOST=x.x.x.x VPS_USER=root sh scripts/run_migrations.sh production`
3. Run MongoDB → PostgreSQL data migration against production data
4. Update CI/CD pipeline:
   - Adapt GitHub Actions from Webkit
   - Configure GHCR image builds for leaplearn services
5. DNS configuration for leaplearn.io
6. SSL certificates via Traefik (automatic Let's Encrypt)
7. Smoke test all critical flows in production

---

## Phase 6: Optional — Go Services for New Features (Week 8+)

**Goal:** Add Go-native services where performance matters.

This phase is entirely optional and can happen incrementally over time.

### Candidates for Go services

| Feature | Why Go? |
|---|---|
| xAPI statement ingestion | High-volume append-only writes, Go's concurrency model ideal |
| Hub mirror cron job | Background task that fetches from H5P.org, processes packages |
| Analytics aggregation | CPU-intensive queries, can run as a scheduled Go service |
| Content generation | CPU-bound text processing, Go outperforms Node.js |
| Search indexing | Batch processing of content for full-text search |

### ConnectRPC setup (if desired)

If you decide to add ConnectRPC for new Go services:
1. Define protos in `proto/h5p/v1/` and `proto/course/v1/` (from blueprint Section 4)
2. Use GoFast's `gof model` to scaffold Go handlers
3. Add `@connectrpc/connect-web` to SvelteKit's package.json
4. Create ConnectRPC client in `service-client/src/lib/utils/connectrpc.ts`
5. New features use ConnectRPC; existing ported features stay on Remote Functions + Drizzle

This gives you the option to adopt ConnectRPC incrementally for new services without touching the working H5P/course code.

---

## File count estimate: what gets ported vs rebuilt vs kept

| Category | Files | Action |
|---|---|---|
| Webkit infrastructure (Docker, CI/CD, monitoring, K8s) | ~50 | Keep as-is |
| Webkit auth + multi-tenancy (Go + SvelteKit) | ~30 | Rename agency → org |
| Webkit shared UI components | ~20 | Keep as-is |
| LEAP H5P components (.svelte) | 15 | Copy, minor import path changes |
| LEAP course components (.svelte) | 12 | Copy, minor import path changes |
| LEAP learning components (.svelte) | 3 | Copy directly |
| LEAP general UI components | ~28 | Evaluate overlap with Webkit shared, merge |
| LEAP API endpoints (97 total) | ~50 files | Port to Remote Functions, swap Mongoose → Drizzle |
| LEAP H5P services (13 server files) | 13 | Port, swap storage backends |
| LEAP MongoDB models (12) | 0 | Replaced by Drizzle schema.ts |
| New Drizzle schema.ts | 1 | Write from blueprint Section 3.2 |
| New migration SQL files | ~8 | Write from blueprint Section 3.2 |
| MongoDB → PostgreSQL migration script | 1 | Write new |

**Estimated total effort:** ~100 files to port/adapt, ~10 files to write new, ~100 files kept from Webkit unchanged.

---

## Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| @lumieducation/h5p-server storage adapter complexity | Medium | High | Prototype the PostgreSQL + R2 adapter in Phase 2 Week 2 before committing. If too complex, keep filesystem storage with mounted volume |
| MongoDB → PostgreSQL data migration breaks H5P content.json | Low | High | content.json maps directly to JSONB. Test with real content packages early |
| Drizzle query patterns differ from Mongoose enough to cause bugs | Medium | Medium | Write comprehensive integration tests for each ported service |
| Webkit auth system conflicts with LEAP's better-auth patterns | Low | Medium | Webkit's auth is well-isolated. Replace LEAP's better-auth entirely |
| H5P editor expects Express middleware, SvelteKit doesn't provide it | Medium | High | LEAP already solved this with h5pExpressWrapper.js — port the solution |
| Timeline slips due to unforeseen PostgreSQL migration edge cases | High | Medium | Budget 2 buffer weeks (plan says 7, budget 8–9) |

---

## Decision log

| Decision | Rationale |
|---|---|
| Keep H5P services in SvelteKit, not Go | 45+ endpoints already working, H5P Hub must be REST anyway, @lumieducation/h5p-server is Node.js |
| Use Drizzle for H5P/course data, not SQLC | SvelteKit Remote Functions + Drizzle is Webkit's proven pattern. SQLC adds Go dependency for no benefit here |
| Keep @lumieducation/h5p-server dependency | Provides content validation, package import/export, editor integration. Replacing in Go = weeks of work |
| Adopt ConnectRPC only for new Go services | Avoids rewriting working code. New services (analytics, search, generation) can use it when built |
| Use raw SQL migrations, not AtlasGo | Matches Webkit's actual pattern. Idempotent SQL files are simpler and proven |
| Start from Webkit skeleton, not GoFast template | Webkit has production-proven auth, multi-tenancy, CI/CD. GoFast template would need the same customisations Webkit already has |
