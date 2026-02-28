# LeapLearn — Revised Migration Plan v3

**Strategy: Fix critical H5P bugs first → port working LEAP H5P system into Webkit skeleton → convert MongoDB → PostgreSQL**

This plan supersedes v2. The key change: the LEAP H5P implementation is substantially built and architecturally sound — the issues are specific integration bugs, not fundamental problems. We fix the two critical blockers in LEAP first (establishing a known-working baseline), then port the working code rather than rebuilding from scratch.

---

## What the codebase audit actually found

### Working (port as-is, adapt for PostgreSQL)

| Component | Lines | Status |
|---|---|---|
| H5PPlayer.svelte (h5p-standalone) | ~120 | Production-ready, Svelte 5 compliant |
| h5pServerService.js | 1,810 | Core authoring engine, comprehensive |
| h5pStandaloneService.js | 567 | Content delivery, caching, CDN headers |
| h5pExpressWrapper.js | ~400 | SvelteKit↔Express bridge for editor |
| h5pHubService.js | ~500 | Hub authentication, library fetching |
| dualHubClient.js | ~300 | Catharsis + H5P.org fallback |
| h5pCacheManager.js | ~400 | Two-tier caching (memory + DB) |
| h5pPackageProcessor.js | ~500 | Extraction, validation, security scanning |
| h5pSecurityValidator.js | ~300 | Content security scanning |
| h5pStorageService.js | ~400 | Folder hierarchy, content organisation |
| r2LibraryService.js | ~300 | R2 uploads, signed URLs, metadata |
| Content validation pipeline | ~200 | 6-stage validation, security scoring |
| Public play/embed endpoints | ~400 | Player HTML, CDN caching, CORS |
| Private editor/hub endpoints | ~1,500 | 19 endpoints, AJAX adapter, installs |
| 15 H5P Svelte components | ~2,000 | Editor, player, library browser, folders |
| 12 course components | ~1,500 | Course builder, enrollment, progress |

**Total: ~11,000+ lines of working H5P/course code**

### Known bugs to fix during migration

| Bug | Root cause | Fix | Effort |
|---|---|---|---|
| **401 on library assets** | Browser requests hit authenticated endpoints | Create public asset route for enabled libraries (partially built at `/api/public/h5p/libraries/`) | 2–4 hours |
| **Library files missing from filesystem** | `installFromPackage()` not completing file extraction | Fix extraction pipeline OR bypass by serving directly from R2 (r2LibraryService already uploads) | 4–8 hours |
| **R2 deletion not implemented** | 3 TODO stubs in bulk/filemanager routes | Implement S3 DeleteObject calls | 1–2 hours |
| **Content deletion stub** | Editor delete returns log only | Wire up h5pServerService.deleteContent | 1–2 hours |
| **User progress hardcoded** | TODO placeholders in learn pages | Connect to progress model (already exists) | 2–4 hours |
| **Upload post-processing missing** | TODO: queue for R2 move + extract | Implement inline or via simple job table | 4–8 hours |
| **Hub credentials in-memory only** | TODO in h5pHubService | Store in org config or env vars | 1 hour |
| **Hardcoded R2 credentials** | Credentials in source code | Move to env vars, rotate keys | 30 min |
| **Download token not persisted** | TODO in filemanager/download | Store in PostgreSQL with TTL | 1–2 hours |

**Total bug fix effort: ~16–32 hours (2–4 days)**

### Not yet built (build fresh)

| Feature | Effort | Notes |
|---|---|---|
| PostgreSQL schema + Drizzle ORM | 2–3 days | 12 MongoDB models → PostgreSQL tables |
| xAPI statement recording | 1 day | H5PPlayer already fires events, need capture |
| Public content access control | 2 hours | Add published/public flag check |
| Library validation on publish | 2 hours | Currently always returns true |
| Download permission model | 4 hours | Enrollment + org membership checks |

---

## Architecture: what stays, what changes

### Stays the same

- **h5p-standalone** for student playback (H5PPlayer.svelte)
- **@lumieducation/h5p-server** for authoring/editing (h5pServerService.js)
- **Express wrapper** bridging SvelteKit↔h5p-server (h5pExpressWrapper.js)
- **Dual hub client** with Catharsis primary, H5P.org fallback
- **R2** for library packages and extracted assets
- **Two-tier caching** (memory + database)
- **Multi-tenant isolation** (org-scoped content and libraries)
- **Security pipeline** (package validation, content scanning)

### Changes

| Before (LEAP) | After (Webkit skeleton) |
|---|---|
| MongoDB + Mongoose | PostgreSQL + Drizzle ORM |
| MongoDB text indexes | PostgreSQL full-text search (tsvector) |
| Dynamic collections (`org_{id}_*`) | Single tables with `org_id` column + row-level isolation |
| MongoDB TTL indexes | PostgreSQL scheduled cleanup or `pg_cron` |
| better-auth (SvelteKit) | Webkit JWT auth (Go core service) |
| Polar payments | Webkit Stripe Connect |
| Custom rate limiting | Webkit built-in rate limiting |
| `npm run dev` only | Docker Compose (PostgreSQL, NATS, MinIO, Mailpit) |
| Filesystem H5P storage | R2-only storage (MinIO locally) |
| No CI/CD | Webkit GitHub Actions → VPS deployment |

### The hybrid: @lumieducation/h5p-server + h5p-standalone

This is **intentional and correct**. The v2 plan proposed dropping h5p-server entirely, but the audit shows:

- **h5p-server** handles the genuinely complex parts: editor integration, Hub protocol, library dependency resolution, content validation, AJAX endpoints for the H5P authoring UI. Rewriting this would take months.
- **h5p-standalone** handles the simple part: playing published content. Zero server processing.
- **The 401 bug** is about asset serving paths, not about h5p-server being fundamentally broken.
- **The missing library files** is about the extraction pipeline not completing, not about the architecture being wrong.

Fix these two bugs and the authoring pipeline works end-to-end.

### Library storage strategy during editing

h5p-server's editor requires library files accessible via filesystem (it uses `FileLibraryStorage`). Two environments need different approaches:

| Environment | Strategy | Reason |
|---|---|---|
| **Local dev** | Docker volume mounted into SvelteKit container | Simplest to get working, unblocks editor development immediately |
| **Production** | Custom `ILibraryStorage` adapter reading from R2 | No persistent filesystem on production. Build during Phase 4 polish. |

This avoids blocking editor work on the R2 adapter. Get it working with local filesystem first, abstract later.

---

## Phase -1: Fix critical bugs in LEAP (Days 1–2)

**Goal:** Establish a known-working H5P baseline before starting the migration. This separates "does the H5P flow work?" from "did the Drizzle conversion break something?"

### Why fix before migrating

When porting 11K+ lines of code while simultaneously swapping Mongoose → Drizzle, if something breaks, you need to know: is it the database conversion or a pre-existing bug? Fixing the two critical blockers in LEAP first gives you a **verified working baseline** to port from. If something breaks during migration, you know the original code worked — it's the conversion.

### -1.1 Fix: 401 on library assets (2–4 hours)

**Problem:** H5P editor JavaScript makes browser-side requests to `/api/private/h5p/libraries/...` which require server authentication. The browser doesn't send auth cookies on these sub-requests.

**Fix:**
1. The public endpoint at `/api/public/h5p/libraries/[...path]` already partially exists
2. Complete it: serve library files from R2 (r2LibraryService.getLibraryContent) for globally-enabled libraries
3. Add CORS headers for the editor iframe
4. Update h5pServerService's editor config to point `libraryUrl` at the public endpoint

**Verify:** Open H5P editor in browser → library assets load → no 401 in network tab.

### -1.2 Fix: Library file extraction not completing (4–8 hours)

**Problem:** `installFromPackage()` in h5pServerService uploads the .h5p to R2 but doesn't reliably extract library files to the filesystem or R2 extracted directory.

**Fix:**
1. Trace the extraction flow: `installFromPackage()` → `h5pPackageProcessor.extractPackage()` → file writes
2. Identify where it fails (likely: race condition, missing directory creation, or R2 upload error swallowed)
3. Fix the pipeline so extracted files land in both: local filesystem (for editor) and R2 extracted directory (for player)
4. Add error logging at each extraction step

**Verify:** Install a library from Hub → check filesystem has extracted files → check R2 has extracted files → editor can load library → player can render content using that library.

### -1.3 Quick wins while you're in there (2 hours)

- Move hardcoded R2 credentials to env vars (30 min)
- Hub credentials: store in env/config instead of in-memory (30 min)
- Wire up content deletion (currently just logs) (1 hour)

### Deliverable

LEAP running with: editor loads library assets without 401, library installation extracts files correctly, content can be created in editor and played in h5p-standalone. **This is your known-working baseline.**

---

## Phase 0: Webkit skeleton setup (Days 3–5)

**Goal:** Booting LeapLearn project with Webkit infrastructure, empty domain.

### 0.1 Fork and rename

1. Clone Webkit repo as `leaplearn`
2. Rename agency references → organisation throughout:
   - `agencies` table → `organisations`
   - `agency_memberships` → `org_memberships`
   - `agencySlug` → `orgSlug`
   - `withAgencyScope()` → `withOrgScope()`
3. Strip agency-specific domain code (proposals, contracts, invoices, questionnaires)
4. Keep: auth, organisations, memberships, subscription tiers, settings, branding, Docker infra

### 0.2 Docker environment

Webkit's `docker-compose.yml` already provides PostgreSQL, NATS, Mailpit. Add MinIO for R2:

```yaml
minio:
  image: minio/minio:latest
  ports:
    - "9000:9000"
    - "9001:9001"
  environment:
    MINIO_ROOT_USER: minioadmin
    MINIO_ROOT_PASSWORD: minioadmin
  command: server /data --console-address ":9001"
  volumes:
    - minio_data:/data
```

### 0.3 Verify boot

- `docker compose up` → all services healthy
- Login via magic link (Mailpit) → org creation → member invite → settings page
- MinIO console at `localhost:9001` → create `leaplearn-h5p` bucket

### Deliverable
Running skeleton at `localhost:3000` with login, org creation, member management, MinIO ready.

---

## Phase 1: PostgreSQL schema + port storage layer (Week 1)

**Goal:** Database tables created, Drizzle schema matching, storage services adapted.

### 1.1 Migration files

Create from LEAP's 12 MongoDB models. Key mapping:

```
migrations/
├── 0XX_h5p_libraries.sql
│   → h5p_libraries (from H5PLibrary model)
│   → h5p_library_dependencies (normalised from nested array)
│   → h5p_org_libraries (from enabledForOrgs array)
│
├── 0XX_h5p_content.sql
│   → h5p_content (from H5PContent model, parameters as JSONB)
│   → h5p_content_folders (from H5PFolder model)
│
├── 0XX_h5p_hub.sql
│   → h5p_hub_cache (from H5PHubLibrary model)
│   → cache_entries (from CacheEntry model)
│
├── 0XX_courses.sql
│   → courses (from Course model, structure_json as JSONB)
│   → course_modules (normalised from nested modules array)
│   → course_items (normalised from module contents)
│   → enrollments
│   → progress_records (from H5PProgress, attempts as JSONB)
│
├── 0XX_analytics.sql
│   → xapi_statements (from Analytics model, statement as JSONB)
│   → audit_logs (from AuditLog, changes/security as JSONB)
│
└── 0XX_products.sql
    → products (from Product model)
    → product_prices (normalised from prices array)
```

**Key decisions:**
- Dynamic collections (`org_{id}_*`) become single tables with `org_id` column
- Complex nested objects (attempts, xAPI statements, device info) stay as JSONB
- Simple arrays (tags, features) become PostgreSQL arrays or JSONB
- Denormalised counts (courseStats, contentCount) maintained via triggers or application code

### 1.2 Drizzle schema

Update `service-client/src/lib/server/schema.ts` to match migrations. Run `npm run check` to verify types.

### 1.3 Adapt storage services

Port these LEAP services, replacing Mongoose with Drizzle:

| LEAP service | Changes needed |
|---|---|
| h5pCacheManager.js | Replace MongoDB cache layer with PostgreSQL `cache_entries` table via Drizzle |
| h5pStorageService.js | Replace filesystem paths with R2-only paths, Drizzle for metadata |
| r2LibraryService.js | Minimal changes — already uses S3 client. Update config for MinIO locally |

### 1.4 R2 bucket structure

Configure MinIO with the bucket layout (unchanged from v2):

```
leaplearn-h5p/
├── h5p-libraries/
│   ├── official/packages/
│   ├── official/extracted/
│   └── custom/
├── h5p-content/{org_id}/{content_id}/
└── h5p-assets/
```

### Deliverable
All tables created, Drizzle schema passing type checks, storage services reading/writing PostgreSQL + R2.

---

## Phase 2: Port H5P services (Weeks 2–3)

**Goal:** Full H5P authoring and playback working in the new skeleton. The critical bugs are already fixed in Phase -1, so this phase is purely a data layer port — if something breaks, you know it's the Drizzle conversion.

### 2.1 Port core services

Copy from the **verified working LEAP baseline** and adapt:

| Service | Adaptation needed |
|---|---|
| h5pServerService.js | Replace Mongoose calls with Drizzle. Replace better-auth user format with Webkit JWT user. Keep h5p-server integration intact. |
| h5pStandaloneService.js | Replace MongoDB cache reads with Drizzle. CDN logic unchanged. |
| h5pExpressWrapper.js | Adapt auth extraction from `event.locals` to match Webkit's auth pattern. |
| h5pHubService.js | Credentials already in env vars (fixed in Phase -1). Replace MongoDB calls with Drizzle. |
| dualHubClient.js | Minimal changes — HTTP client, no DB dependency. |
| h5pPackageProcessor.js | No changes — operates on buffers and ZIP files. |
| h5pSecurityValidator.js | No changes — stateless validation. |

### 2.2 Port API routes

Copy LEAP's H5P routes into Webkit's route structure:

```
service-client/src/routes/
├── (app)/[orgSlug]/
│   ├── content/              # Content library (from LEAP)
│   ├── content/[contentId]/  # Content detail/play
│   ├── admin/libraries/      # Library management
│   └── learn/[courseId]/     # Student learning view
└── api/
    ├── public/h5p/           # Player, assets, libraries (already fixed in Phase -1)
    └── private/h5p/          # Editor, hub, filemanager
```

**Decision:** Use SvelteKit API routes (not Remote Functions) for H5P endpoints, since h5p-server requires Express-style request/response handling via the wrapper.

### 2.3 Port remaining bug fixes

The two critical blockers (401 + extraction) were fixed in Phase -1. The remaining lower-priority items get fixed during the port since you're touching these files anyway:

**R2 deletion:** Implement `DeleteObjectCommand` in the 3 stub locations (bulk, filemanager, content delete).

**Upload post-processing:** Implement inline processing (no queue needed initially):
1. Upload .h5p to temp
2. Unzip, parse h5p.json
3. Upload extracted files to R2
4. Insert h5p_content + h5p_libraries rows via Drizzle
5. Clean up temp
6. Return content ID

### 2.4 Port Svelte components

Copy and adapt the 15 H5P components + 12 course components:
- Update imports to use Webkit's alias paths (`$lib/` etc.)
- Replace any Svelte 4 patterns if found (LEAP's H5PPlayer.svelte is already Svelte 5)
- Replace MongoDB-specific data shapes with Drizzle query results
- Adapt auth checks to Webkit's permission model

### Deliverable
Admin can sync libraries from H5P.org, libraries appear in R2 and library browser. Teacher can upload .h5p content, play it via h5p-standalone, edit via h5p-server editor. No 401 errors on assets.

---

## Phase 3: Courses + progress tracking (Weeks 4–5)

**Goal:** Course builder, enrollment, student progress — ported from LEAP's existing components.

### 3.1 Port course system

LEAP has 12 course components already built. Port them:
- Course listing, creation, builder (drag-and-drop module ordering)
- Student enrollment and learning view
- Instructor progress dashboard

Adapt data layer from Mongoose to Drizzle queries against the `courses`, `course_modules`, `course_items`, `enrollments`, and `progress_records` tables.

### 3.2 Implement xAPI recording

H5PPlayer.svelte already has xAPI event handling scaffolding. Wire it up:
- Capture `message` events from h5p-standalone iframe
- POST to `/api/private/h5p/xapi` endpoint
- Insert into `xapi_statements` table (append-only, JSONB statement)
- Update `progress_records` (completion, score, time)

### 3.3 Fix user progress tracking

Replace the hardcoded empty progress in learn pages with actual Drizzle queries against `progress_records` and `enrollments`.

### 3.4 Hub API (Catharsis replacement) — ✅ ALREADY BUILT

The three Catharsis-format hub endpoints are **already implemented** in the Go core service (built during Phase 1 library management work, not during Phase 3 as originally planned):

```
POST /api/v1/h5p/hub/register           → Return { uuid } (site registration)
POST /api/v1/h5p/hub/content-types/     → Return Catharsis-format registry JSON
GET  /api/v1/h5p/hub/content-types/:id  → Stream .h5p package from R2
GET  /api/v1/h5p/libraries/{path...}    → Serve library assets (icons, JS, CSS) from R2
```

All four endpoints are unauthenticated (H5P editor calls them without auth tokens). See `docs/leap-planning/hub-endpoints-plan.md` for full specification.

**⚠️ Important nuance for H5P editor integration:**

The content types registry endpoint (`POST /api/v1/h5p/hub/content-types/`) currently returns **all** H5P.org content types regardless of local install status. This is correct for the Content Type Browser — it shows everything available with "Install" buttons for types not yet installed.

However, when the H5P editor is in **content-creation mode** (user is editing/creating H5P content), it typically only needs **installed** types. The editor's content type selector should filter to locally-installed libraries only, since you can't create content with a library that isn't installed.

Two approaches when Phase 3 reaches editor integration:

1. **Client-side filtering** (simplest): The editor config can filter the registry response to only show installed types in the creation UI, while the Content Type Browser still shows everything.
2. **Query parameter on the endpoint**: Add an optional `?installed_only=true` parameter that makes `GetHubRegistry()` filter to only libraries present in `h5p_libraries`. This keeps the filtering server-side.

Either way, the existing endpoint works as-is for the Content Type Browser. The filtering decision only matters when wiring up the editor's content creation flow.

### Deliverable
Teachers can build courses from H5P content. Students enroll, learn, and have progress tracked. Hub API already functional from Phase 1.

---

## Phase 4: Polish + production readiness (Weeks 6–7)

**Goal:** Subscription enforcement, security hardening, monitoring, remaining polish.

### 4.1 Subscription tier enforcement

Adapt Webkit's existing tier system:

| Tier | Teachers | Content items | Storage | Courses |
|---|---|---|---|---|
| Free | 1 | 50 | 1 GB | 3 |
| Starter | 5 | 500 | 10 GB | 20 |
| Growth | 25 | Unlimited | 100 GB | Unlimited |
| Enterprise | Unlimited | Unlimited | Unlimited | Unlimited |

### 4.2 Security hardening

- Implement download permission model (enrollment + org membership checks)
- Add library validation on publish (currently always returns true)
- Public content access control (check published/public flags)
- Audit log integration with Webkit's existing logging
- Build R2 `ILibraryStorage` adapter for production (replaces Docker volume used in dev)

### 4.3 Monitoring

- Grafana dashboards for H5P metrics (Webkit already has Grafana + Prometheus)
- Content serving latency, cache hit rates, library sync status
- R2 storage usage per org

### 4.4 GDPR compliance

Extend Webkit's existing GDPR data export endpoints to include:
- H5P content metadata
- Progress records and xAPI statements
- Audit logs

### 4.5 Remaining polish from LEAP TODOs

- Upload progress tracking (simple polling endpoint, no WebSocket needed initially)
- Content thumbnails
- Search and filtering improvements
- Mobile responsive player view

---

## Phase 5: Deployment (Week 8)

Webkit's deployment infrastructure is production-proven. Extend it:

### 5.1 Docker updates

Add to `docker-compose.production.yml`:
- MinIO/R2 configuration (or use Cloudflare R2 directly)
- H5P-specific environment variables
- Volume for h5p-server's temp storage

### 5.2 CI/CD

Webkit's GitHub Actions pipeline handles build → push to GHCR → deploy to VPS. Add:
- H5P library sync as a post-deploy step (or manual admin action)
- R2 bucket creation/verification

### 5.3 Data migration (if needed)

If migrating existing LEAP content:
- Export MongoDB collections as JSON
- Transform to match PostgreSQL schema
- Import via psql or migration script
- Re-upload R2 content with new org-scoped paths

---

## Timeline summary

| Phase | Duration | What happens |
|---|---|---|
| **Phase -1: Fix critical bugs** | **Days 1–2** | **Fix 401 + extraction in LEAP. Establish known-working baseline.** |
| Phase 0: Webkit skeleton | Days 3–5 | Fork, rename, strip agency code, add MinIO, verify boot |
| Phase 1: Schema + storage | Week 1–2 | 12 models → PostgreSQL, Drizzle schema, adapt storage services |
| Phase 2: Port H5P services | Weeks 3–4 | Port 11K+ lines from verified baseline. Pure data layer conversion. |
| Phase 3: Courses + progress | Weeks 5–6 | Port course system, xAPI recording, hub API |
| Phase 4: Polish | Weeks 7–8 | Subscriptions, security, R2 storage adapter, monitoring, GDPR |
| Phase 5: Deploy | Week 9 | Production VPS with Traefik, R2, monitoring |

**Total: ~9 weeks** (1 week longer than v2, but dramatically lower risk)

---

## What changed from v2

| v2 said | v3 says | Why |
|---|---|---|
| Drop @lumieducation/h5p-server entirely | Keep it for authoring/editing | 1,810-line service handles genuinely complex editor integration. Rebuilding would take months. |
| Build h5p-standalone player from scratch | Port existing H5PPlayer.svelte | It's already built, Svelte 5 compliant, production-ready |
| Build custom library sync from scratch | Port existing services (hub, dual client, r2) | 1,500+ lines of working hub integration + R2 upload code |
| "Player broken, sync broken" | Specific bugs: 401 on assets, extraction not completing | ~16–32 hours of bug fixes, not a rewrite |
| Fix bugs during migration | Fix critical bugs BEFORE migration (Phase -1) | Isolates "does H5P work?" from "did the Drizzle conversion break it?" Reduces debugging complexity. |
| 8-week rebuild | 9-week port + fix + extend | 1 week longer, but verified working baseline before migration. Much less risk. |

---

## Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| h5p-server's Express dependency conflicts with SvelteKit | Low | High | LEAP's h5pExpressWrapper already solves this. Port it as-is. |
| MongoDB → PostgreSQL data shape mismatches | Medium | Medium | Build comprehensive test suite for each model migration. JSONB handles flexible schemas. |
| Webkit auth pattern breaks h5p-server user context | Medium | Medium | Map Webkit JWT user → H5P user format in h5pServerService. LEAP's pattern works, just adapt the source. |
| R2 extraction pipeline still broken after fix | Low | High | Fallback: serve libraries from R2 directly via public endpoint. Player doesn't need local filesystem. |
| Timeline slips on Mongoose→Drizzle conversion | Medium | Medium | Prioritise: libraries + content first (player works), courses second. Playback functional by Week 3. |
| Existing LEAP content can't be migrated | Low | Low | Content is in MongoDB + R2. Export JSON, transform, import. R2 files don't need to move. |

---

## Decision log

| Decision | Rationale |
|---|---|
| Keep @lumieducation/h5p-server | 1,810 lines of editor integration that works. The bugs are in asset serving paths, not in the framework. |
| Port existing code, not rebuild | 11,000+ lines of working H5P/course code. Rebuilding would be slower and riskier than porting + fixing. |
| Fix critical bugs before migration | Isolates H5P correctness from Drizzle conversion correctness. If Phase 2 breaks, you know the original code worked — it's the port. 1–2 days of upfront investment saves days of confused debugging later. |
| Docker volume for editor libraries (dev) | Simplest way to satisfy h5p-server's FileLibraryStorage requirement. R2 adapter built in Phase 4 for production. |
| Use JSONB for complex nested data | H5P content parameters, xAPI statements, course structure — all naturally JSON. PostgreSQL JSONB gives indexing + querying. |
| Keep h5p-standalone for playback | Already working in LEAP. Zero server load for student content delivery. |
| Single tables with org_id, not dynamic collections | PostgreSQL row-level isolation is simpler and more performant than per-org schemas. Matches Webkit's existing pattern. |
