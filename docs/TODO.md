# LeapLearn — Feature Roadmap & TODO

**Last updated:** 2026-03-05
**Source docs:** `Revised_Migration_Plan_v3.md`, `feature-spec-library-tiers.md`, `super-admin-h5p-extension-plan.md`, `h5p-svar-implementation-guide-LEAP.md`, `phase-4-durable-objects-progress-tracking.md`, `text-field-improvements-plan.md`

---

## Status Key

- ✅ Done
- 🔧 In Progress
- 📋 Planned
- 💡 Earmarked (specced but not scheduled)

---

## Phase -1: Pre-Migration Bug Fixes — ✅ COMPLETE

- [x] Fix 401 on library assets (public asset route)
- [x] Fix library file extraction pipeline
- [x] Move hardcoded R2 credentials to env vars
- [x] Wire up content deletion
- [x] Hub credentials in config

---

## Phase 0: Webkit Skeleton Setup — ✅ COMPLETE

- [x] Fork Webkit → LeapLearn repo
- [x] Rename agency → organisation (DB, Drizzle, Go, routes, remote functions)
- [x] Strip business domain code (contracts, proposals, invoices, quotations)
- [x] Add MinIO to Docker Compose
- [x] Navigation/UI cleanup
- [x] Verify boot (`docker compose up --build`)

---

## Phase 1: PostgreSQL Schema + Storage Layer — ✅ COMPLETE

- [x] Migration 001: Initial schema (organisations, users, memberships)
- [x] Migration 002: H5P libraries (h5p_libraries, h5p_library_dependencies, h5p_org_libraries)
- [x] Migration 003: H5P content (h5p_content, h5p_content_folders)
- [x] Migration 004: H5P hub (h5p_hub_cache, cache_entries)
- [x] Migration 005: Courses (courses, course_modules, course_items, enrollments, progress_records)
- [x] Migration 006: Analytics (xapi_statements, audit_logs)
- [x] Drizzle schema matching all migrations
- [x] Go R2 file provider (provider.go, provider_r2.go, provider_s3client.go)
- [x] Go H5P service layer (service.go, installer.go, content.go, editor.go, temp.go, hub_client.go)

---

## Phase 2: Port H5P Services — ✅ COMPLETE

- [x] Hub API endpoints (register, content-types, package download, asset serving)
- [x] Library installer (extraction, dependency resolution, R2 storage)
- [x] Content CRUD (create, read, update, delete with R2 file management)
- [x] Editor integration (Go editor routes, SvelteKit proxy)
- [x] Temp file management (upload during editing, migrate on save)
- [x] H5P Player embed (Go embed handler, h5p-standalone)
- [x] 15 H5P Svelte components ported
- [x] SvelteKit API proxy routes (catch-all + content-user-data)

---

## Phase 3: Courses + Progress — 🔧 IN PROGRESS

### Done
- [x] Migration 008: Phase 3 course updates
- [x] Migration 009: Course sections
- [x] Migration 010: H5P content user state
- [x] Hub API (Catharsis-format endpoints) — built in Phase 1
- [x] xAPI statement recording (Go xAPI route)
- [x] H5P state save — Durable Object implementation (Worker + DO)
- [x] H5P state save — SvelteKit proxy with feature flag (`STATE_SAVE_TARGET`)
- [x] H5P state save — Sync XHR preload in embed template
- [x] H5P state save — E2E tested (save + restore working)

### Remaining — State Save Completion
- [ ] **DO alarm flush to PostgreSQL** — Currently untested because `GO_BACKEND_URL` in Worker points to production. Need to either: (a) deploy Worker to Cloudflare and test with production Go backend, or (b) expose local Go backend via tunnel for testing
- [ ] **Deploy DO Worker to Cloudflare** — `wrangler deploy` the h5p-state Worker, configure production secrets (PUBLIC_KEY_PEM, GO_BACKEND_URL, STATE_SERVICE_TOKEN)
- [ ] **Shadow mode validation** — Run `STATE_SAVE_TARGET=shadow` in production to compare DO vs Go responses before full cutover

### Remaining — Course System
- [ ] Course builder UI polish (drag-and-drop module ordering)
- [ ] Student enrollment flow (enroll, un-enroll, enrollment status)
- [ ] Student learning view (`/learn/[courseId]/[itemId]`) with H5P player
- [ ] **Section/item completion tracking** — Mark sections complete (manual or automatic via xAPI)
- [ ] Instructor progress dashboard (per-student, per-course completion overview)
- [ ] Connect progress_records to actual H5P completion/score events

### Remaining — Course Content Authoring (TipTap v3)
**Spec:** `docs/plans/text-field-improvements-plan.md`
**Status:** `RichTextEditor.svelte` and `AutoResizeTextarea.svelte` components exist but not yet integrated into course text elements

- [ ] **Integrate TipTap v3 into course text/description fields** — Course descriptions, section descriptions, and text-type course items should use RichTextEditor
- [ ] **Auto-resize textareas for short fields** — Use AutoResizeTextarea for titles, short descriptions where rich text is overkill
- [ ] **View mode HTML rendering** — Render rich text content with `{@html sanitizeHtml(content)}` in student learning view
- [ ] **Sanitization** — Ensure DOMPurify-based sanitization for all HTML content display

---

## Phase 3.5: DO Real-Time Progress Tracking — 💡 EARMARKED

**Spec:** `docs/spec/phase-4-durable-objects-progress-tracking.md`
**Prerequisites:** Phase 3 course system complete (enrollment, progress tracking working via direct PostgreSQL writes)
**Architecture:** One DO per enrolment (per student per course), in-memory reads (<10ms), batched async sync to PostgreSQL (≤10s delay)

### Why
Direct PostgreSQL pipeline works but has limitations at scale: lost events on tab close, write amplification (20+ xAPI events → 20 DB writes per quiz), completion race conditions, latency for progress sidebar updates.

### Worker + DO Implementation
- [ ] **EnrolmentProgressObject DO class** — In-memory `Map<courseItemId, ItemProgress>`, `blockConcurrencyWhile` rehydration, alarm-based PostgreSQL sync (10s)
- [ ] **Worker routing** — JWT auth, route xAPI events to correct DO by enrolmentId
- [ ] **DO initialisation on enrollment** — Eagerly create empty tracking state for all course items (DO-only, PostgreSQL rows created lazily on first xAPI event)
- [ ] **recordEvent()** — Process xAPI verbs (completed, scored, answered, experienced), update in-memory state, buffer raw statements
- [ ] **getProgress()** — Zero-I/O in-memory read for learning player sidebar
- [ ] **getCourseCompletion()** — Check all courseItemIds completed (single DO, no SQL aggregation)
- [ ] **Alarm sync to PostgreSQL** — Batch upsert progress_records + append xapi_statements, exponential backoff on failure

### Frontend Integration
- [ ] **Learning player passes enrolmentId** — `/learn/[courseId]/[itemId]` route loads enrolment, passes to H5PPlayer
- [ ] **Progress sidebar reads from DO** — Real-time completion checkmarks, score display
- [ ] **Course completion detection** — DO returns `allCompleted: true` when all items done

### Course Mutation Sync
- [ ] **addCourseItem()** — When teacher adds item to published course, push to all active enrolment DOs
- [ ] **removeCourseItem()** — Soft-remove from courseItemIds (preserve progress history)

### Feature Flag
- [ ] **PROGRESS_TRACKING_TARGET** env var — `go` (direct PostgreSQL), `shadow` (both), `worker` (DO only)
- [ ] Shadow mode: compare DO vs PostgreSQL responses, log discrepancies

---

## Phase 3.5: H5P Content Organisation (SVAR File Manager) — 💡 EARMARKED

**Spec:** `h5p-svar-implementation-guide-LEAP.md`
**Note:** Guide written for MongoDB/Mongoose — needs PostgreSQL/Drizzle adaptation

### Database
- [ ] Verify `h5p_content_folders` table exists (Migration 003)
- [ ] Add any missing columns for SVAR integration (icon, color, metadata)

### Backend
- [ ] Folder CRUD API endpoints (create, rename, move, delete)
- [ ] Content move/copy between folders
- [ ] Batch operations (move multiple, delete multiple)
- [ ] Folder tree query (recursive CTE for nested folders)

### Frontend
- [ ] Install `wx-svelte-filemanager` package
- [ ] Integrate SVAR File Manager into content library page
- [ ] Custom preview panel for H5P content
- [ ] Drag-and-drop between folders
- [ ] Context menu actions (rename, move, delete, duplicate)
- [ ] Breadcrumb navigation
- [ ] Search within file manager

### Storage
- [ ] R2 path updates when content moves between folders
- [ ] Batch import from .h5p files into folders

---

## Phase 4: Polish + Production Readiness — 📋 PLANNED

### 4.1 Subscription Tier Enforcement
- [ ] Define LeapLearn tier limits (teachers, content items, storage, courses)
- [ ] Enforce limits in content creation, course creation, member invites
- [ ] Storage usage tracking per organisation
- [ ] Upgrade prompts when limits hit

### 4.2 Security Hardening
- [ ] Download permission model (enrollment + org membership checks)
- [ ] Library validation on publish (currently always returns true)
- [ ] Public content access control (published/public flag checks)
- [ ] Audit log integration
- [ ] R2 `ILibraryStorage` adapter for production (replace Docker volume)

### 4.3 Monitoring
- [ ] Grafana dashboards for H5P metrics
- [ ] Content serving latency tracking
- [ ] Cache hit rate monitoring
- [ ] R2 storage usage per org
- [ ] Library sync status

### 4.4 GDPR Compliance
- [ ] Extend data export to include H5P content metadata
- [ ] Include progress records and xAPI statements in export
- [ ] Include audit logs in export
- [ ] Content deletion cascade (R2 files + DB records)

### 4.5 Remaining Polish
- [ ] Upload progress tracking (polling endpoint)
- [ ] Content thumbnails
- [ ] Search and filtering improvements
- [ ] Mobile responsive player view

---

## Phase 5: Deployment — 📋 PLANNED

- [ ] Update `docker-compose.production.yml` with H5P config
- [ ] Configure Cloudflare R2 for production (replace MinIO)
- [ ] Deploy DO Worker to Cloudflare (h5p-state)
- [ ] H5P-specific environment variables in production
- [ ] CI/CD pipeline updates for H5P services
- [ ] Post-deploy library sync (manual admin action or automated)
- [ ] R2 bucket creation/verification in deploy script
- [ ] Health checks for H5P endpoints
- [ ] Data migration from LEAP MongoDB (if needed)

---

## Feature Extensions — 💡 EARMARKED

### Library Tiers (Two-Tier Model)
**Spec:** `feature-spec-library-tiers.md`
**Estimated effort:** ~18 hours

- [ ] Add `source` column to `h5p_libraries` table (`official`, `community`, `custom`)
- [ ] Community library registry (JSON manifest in R2)
- [ ] Hub merge logic (combine official H5P.org + community registry in Content Type Browser)
- [ ] Custom library upload endpoint (org-level, paid tier only)
- [ ] UI: Source badges in library browser
- [ ] UI: "Community" and "Custom" tabs in Content Type Browser
- [ ] Tier gating: Custom library upload requires Growth+ subscription
- [ ] Admin: Approve/reject community library submissions

### Super-Admin H5P Extensions
**Spec:** `super-admin-h5p-extension-plan.md`

#### Phase A — Ship with Library Management
- [ ] **H5P Libraries page** (`/admin/h5p-libraries`) — List all installed libraries, version info, dependency tree, install/update/remove actions
- [ ] **H5P Hub Management page** (`/admin/h5p-hub`) — Hub sync status, last sync time, available updates, manual sync trigger, hub connection settings

#### Phase B — Ship with Course System
- [ ] **H5P Content Overview page** (`/admin/h5p-content`) — Cross-org content listing, content type distribution, orphaned content detection, bulk actions
- [ ] **H5P Analytics page** (`/admin/h5p-analytics`) — Platform-wide xAPI stats, most-used content types, completion rates, score distributions

#### Phase C — Advanced Admin
- [ ] **H5P Storage page** (`/admin/h5p-storage`) — R2 usage breakdown by org, library storage vs content storage, cleanup tools, storage quota management
- [ ] **Org-Library Access page** (`/admin/h5p-org-libraries`) — Which orgs have access to which libraries, bulk enable/disable, tier-based access control

### Browser Rendering Worker
**Status:** Worker exists at `workers/browser-rendering/`
- [ ] Define use case (thumbnail generation? PDF export? OG images?)
- [ ] Implement rendering pipeline
- [ ] Connect to content management flow

---

## Suggested Implementation Order

### Immediate (This Sprint)
1. **DO state save: alarm flush testing** — Critical path for state save feature completion
2. **Deploy DO state save Worker to Cloudflare** — Enables production state save
3. **Shadow mode validation** — Confidence check before cutover

### Next Sprint — Core LMS
4. **Student enrollment flow** — Enroll, un-enroll, enrollment status
5. **Student learning view** (`/learn/[courseId]/[itemId]`) — H5P player with course context
6. **Section/item completion tracking** — Manual mark-complete + automatic via xAPI events
7. **TipTap v3 in course text elements** — Rich text for course descriptions, section text, text-type items
8. **Instructor progress dashboard** — Per-student completion overview

### Following Sprint — Scale + Admin
9. **DO real-time progress tracking** (Phase 3.5) — EnrolmentProgressObject DO, replaces direct PostgreSQL for live progress
10. **Super-Admin Phase A** (H5P Libraries + Hub Management pages) — Admin visibility
11. **Subscription tier enforcement** — Revenue/growth blocker

### Pre-Launch
12. **Security hardening** — Download permissions, content access control, audit logs
13. **Production deployment setup** (Docker, R2, CI/CD, DO Workers)
14. **GDPR compliance** — Data export including H5P content + xAPI
15. **Monitoring dashboards** — Grafana for H5P metrics

### Post-Launch Extensions
16. **SVAR File Manager** — Content organisation UX improvement
17. **Library Tiers** — Community + custom library ecosystem
18. **Super-Admin Phase B+C** — Advanced admin tooling
19. **Browser Rendering Worker** — Thumbnails/exports

---

## Reference Documents

| Document | Location | Purpose |
|----------|----------|---------|
| Migration Plan v3 | `docs/leap-planning/Revised_Migration_Plan_v3.md` | Master migration roadmap |
| Library Tiers Spec | `docs/leap-planning/feature-spec-library-tiers.md` | Two-tier library model |
| Super-Admin Plan | `docs/leap-planning/super-admin-h5p-extension-plan.md` | 6 admin pages |
| SVAR File Manager | `docs/leap-planning/h5p-svar-implementation-guide-LEAP.md` | Content organisation UI |
| DO Progress Tracking | `docs/spec/phase-4-durable-objects-progress-tracking.md` | Real-time progress via DOs |
| DO State Save Spec | `docs/spec/phase-4-spec-1-do-state-save.md` | H5P content user state via DOs |
| Text Field Improvements | `docs/plans/text-field-improvements-plan.md` | TipTap v3 + AutoResize rollout |
| Hub Endpoints Plan | `docs/leap-planning/hub-endpoints-plan.md` | Catharsis-format hub API |
| State Save Gotchas | `.claude/notes/state-save/gotchas.md` | DO implementation learnings |
