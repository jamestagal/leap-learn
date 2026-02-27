# LeapLearn — Revised Migration Plan v2

**Strategy: Webkit skeleton + fresh H5P build with h5p-standalone + PostgreSQL**

This plan supersedes v1. The key change: since LEAP's H5P player and library sync are both broken, we build H5P fresh inside the Webkit skeleton rather than porting broken code. We also drop `@lumieducation/h5p-server` in favour of the simpler `h5p-standalone` player + custom library/content management.

---

## Core architectural decision

### Why drop @lumieducation/h5p-server

The Lumi h5p-server framework is designed for Express.js applications with filesystem storage. Integrating it into SvelteKit requires:
- An Express middleware wrapper (h5pExpressWrapper.js)
- Custom storage adapters for every storage backend (file, R2, PostgreSQL)
- Complex dependency resolution that duplicates what we can do with a simple recursive SQL query
- Editor integration hooks that fight SvelteKit's request handling

LEAP has attempted multiple implementations of this integration and none are working. The framework adds complexity without proportional value.

### What replaces it

| Concern | Old approach (Lumi) | New approach |
|---|---|---|
| **Playing content** | h5p-server rendering pipeline | `h5p-standalone` — point at a URL, it plays |
| **Library storage** | FileLibraryStorage adapter | R2 bucket with extracted library files, metadata in PostgreSQL |
| **Content storage** | FileContentStorage adapter | R2 bucket with extracted content, content.json in PostgreSQL JSONB |
| **Library syncing** | h5p-server + custom hub service | Direct HTTP fetch from H5P.org API → extract ZIP → upload to R2 → register in PostgreSQL |
| **Dependency resolution** | h5p-server's LibraryManager | Recursive CTE query in PostgreSQL (blueprint Section 8.1) |
| **Package import** | h5p-server's PackageImporter | Custom: unzip .h5p → parse h5p.json/library.json → upload files to R2 → insert DB records |
| **Content editing** | h5p-server's editor integration | Phase 2: custom editor integration or external creation + import |

---

## Phase 0: Webkit Skeleton Setup (Days 1–3)

**Goal:** A booting LeapLearn project with Webkit's infrastructure, empty domain.

*Unchanged from v1 — see Revised_Migration_Plan.md Phase 0.*

### Deliverable
Running skeleton at `localhost:3000` with login, org creation, member management, empty org dashboard, MinIO (local R2).

---

## Phase 1: PostgreSQL Schema + R2 Setup (Week 1)

**Goal:** Database tables ready, R2 bucket structure in place, library sync pipeline working.

### 1.1 Database migrations

Create migration files from the Architecture Blueprint Section 3.2. For this phase, only the H5P library tables are needed:

```
migrations/
├── 001_initial_auth.sql          # From Webkit (exists)
├── 002_organisations.sql         # Adapted from Webkit agencies (Phase 0)
├── 003_h5p_libraries.sql         # NEW: h5p_libraries, h5p_library_dependencies, h5p_org_libraries
├── 004_h5p_content.sql           # NEW: h5p_content, h5p_content_folders
└── 005_h5p_hub.sql               # NEW: h5p_hub_cache
```

Update Drizzle `schema.ts` to match. Run `npm run check`.

### 1.2 R2 bucket structure

Set up MinIO locally (from docker-compose) with the bucket layout from Blueprint Section 6.2:

```
leaplearn-h5p/
├── h5p-libraries/
│   ├── official/
│   │   ├── packages/          # Original .h5p files
│   │   └── extracted/         # Extracted library folders (served to player)
│   └── custom/
│       ├── packages/
│       └── extracted/
├── h5p-content/
│   └── {org_id}/
│       └── {content_id}/
│           ├── content/
│           │   └── content.json
│           └── h5p.json
└── h5p-assets/
    └── screenshots/
```

### 1.3 Library sync pipeline

Build a SvelteKit server-side service that:

1. **Fetches the H5P.org content type registry:**
   ```typescript
   // POST https://api.h5p.org/v1/content-types/
   // Returns JSON with contentTypes array
   ```

2. **Downloads .h5p packages:**
   ```typescript
   // GET https://api.h5p.org/v1/content-types/{machineName}
   // Returns .h5p file (ZIP archive)
   ```

3. **Extracts and processes each package:**
   ```typescript
   // Unzip .h5p → parse library.json → extract version info
   // For each library in the package:
   //   - Upload extracted files to R2: h5p-libraries/official/extracted/{name}-{version}/
   //   - Upload original .h5p to R2: h5p-libraries/official/packages/{name}-{version}.h5p
   //   - Insert/update h5p_libraries row in PostgreSQL
   //   - Insert h5p_library_dependencies rows
   ```

4. **Builds the hub registry cache:**
   ```typescript
   // Query all runnable libraries from PostgreSQL
   // Build registry JSON matching H5P.org format
   // Store in h5p_hub_cache table
   ```

This is a **Remote Function** (`library-sync.remote.ts`) triggered from an admin page, not a background cron job. Keep it simple — admin clicks "Sync Libraries," it runs.

### 1.4 Admin library management page

Build `service-client/src/routes/(app)/[orgSlug]/admin/libraries/+page.svelte`:

- List all synced libraries (from h5p_libraries table)
- "Sync from H5P.org" button (calls the sync pipeline)
- Show sync status/progress
- Enable/disable libraries per org (h5p_org_libraries table)
- Display library metadata (icon, title, version, dependency count)

### Deliverable
Admin can click "Sync Libraries," libraries download from H5P.org, extract to R2, and appear in the library listing with correct metadata.

---

## Phase 2: H5P Player + Content Management (Weeks 2–3)

**Goal:** Create H5P content, store in R2 + PostgreSQL, play it with h5p-standalone.

### 2.1 h5p-standalone player component

```svelte
<!-- src/lib/components/h5p/H5PPlayer.svelte -->
<script lang="ts">
  let { contentId, orgId } = $props();
  let container: HTMLDivElement;
  let loading = $state(true);
  let error = $state('');

  $effect(() => {
    if (!container) return;

    import('h5p-standalone').then(({ H5P }) => {
      // Content served from R2 via SvelteKit API route (handles auth + org scoping)
      const contentUrl = `/api/h5p/content/${contentId}`;

      new H5P(container, {
        h5pJsonPath: contentUrl,
        frameJs: '/h5p/frame.bundle.js',    // Self-hosted from node_modules
        frameCss: '/h5p/styles/h5p.css',
      }).then(() => {
        loading = false;
      }).catch(err => {
        error = err.message;
        loading = false;
      });
    });
  });
</script>

{#if loading}
  <div class="skeleton h-64 w-full"></div>
{:else if error}
  <div class="alert alert-error">{error}</div>
{/if}
<div bind:this={container}></div>
```

### 2.2 Content serving API route

The player needs to fetch content files. Build a SvelteKit server route that:

1. Validates user auth + org membership
2. Resolves content from PostgreSQL (get library_id, content_path)
3. Resolves all library dependencies (recursive CTE from Blueprint Section 8.1)
4. Serves `h5p.json` dynamically (built from DB metadata + dependency list)
5. Proxies library/content files from R2 (or redirects to R2 public URLs)

```
/api/h5p/content/[contentId]/+server.ts          → serves h5p.json
/api/h5p/content/[contentId]/content/+server.ts   → proxies content files from R2
/api/h5p/libraries/[...path]/+server.ts           → proxies library files from R2
```

**Alternative (simpler):** If R2 bucket has public read access, h5p.json can reference R2 URLs directly and the player fetches files from R2 without proxying. CORS must be configured on the R2 bucket.

### 2.3 Content creation (import-based, no editor yet)

For the initial release, content creation works via .h5p file upload:

1. Admin/teacher uploads a .h5p file (created externally using H5P.org or Lumi desktop app)
2. Server-side processing:
   - Unzip the .h5p package
   - Parse h5p.json to identify the main library and content
   - Parse content/content.json
   - Upload extracted files to R2: `h5p-content/{org_id}/{content_id}/`
   - Store content.json as JSONB in h5p_content table
   - Register any new libraries found in the package
3. Content appears in the content library, playable via h5p-standalone

```typescript
// content.remote.ts
export const uploadContent = command(
  v.object({
    orgId: v.pipe(v.string(), v.uuid()),
    title: v.string(),
    // File handled via form upload, not in schema
  }),
  async (data) => {
    const event = getRequestEvent();
    const formData = await event.request.formData();
    const file = formData.get('h5pFile') as File;

    // 1. Unzip
    // 2. Parse h5p.json
    // 3. Upload to R2
    // 4. Insert into h5p_content
    // 5. Return content ID
  }
);
```

### 2.4 Content library page

Build `service-client/src/routes/(app)/[orgSlug]/content/+page.svelte`:

- Grid/list view of all H5P content in this org
- Upload .h5p button
- Content cards showing: title, content type, status, thumbnail, last modified
- Click to preview/play (opens H5PPlayer component)
- Content status management (draft/published/archived)
- Folder-based organisation (from h5p_content_folders)

### 2.5 Content detail/play page

Build `service-client/src/routes/(app)/[orgSlug]/content/[contentId]/+page.svelte`:

- Full-width H5PPlayer component
- Content metadata sidebar (title, type, author, dates, tags)
- Edit metadata
- Delete content
- Duplicate content
- Move to folder

### Deliverable
Teacher can upload .h5p files, see them in the content library, and play them. Libraries are served from R2, content is stored in R2 + PostgreSQL.

---

## Phase 3: H5P Hub API + Course System (Week 4–5)

**Goal:** Self-hosted hub replacing H5P.org dependency, basic course builder.

### 3.1 Hub API endpoints (Catharsis replacement)

Three REST endpoints matching the H5P.org protocol (from Blueprint Section 5):

```
/api/h5p-hub/sites/+server.ts                        → POST: return { uuid }
/api/h5p-hub/content-types/+server.ts                 → POST: return registry from h5p_hub_cache
/api/h5p-hub/content-types/[machineName]/+server.ts   → GET: stream .h5p from R2
```

This allows any H5P client (including a future in-app editor) to use LeapLearn as its content type hub instead of api.h5p.org.

### 3.2 Course system

Build courses using the Blueprint Section 3.2 schema (courses, course_items, enrollments, progress_records):

**Routes:**
```
[orgSlug]/courses/+page.svelte              # Course listing
[orgSlug]/courses/create/+page.svelte       # Course builder
[orgSlug]/courses/[courseId]/+page.svelte    # Course detail
[orgSlug]/courses/[courseId]/learn/+page.svelte    # Student view
[orgSlug]/courses/[courseId]/progress/+page.svelte # Instructor view
```

**Remote Functions:**
```typescript
// course.remote.ts
export const createCourse = command(CreateCourseSchema, async (data) => { ... });
export const getCourse = query(v.pipe(v.string(), v.uuid()), async (courseId) => { ... });
export const listCourses = query(CourseFiltersSchema, async (filters) => { ... });
export const publishCourse = command(v.pipe(v.string(), v.uuid()), async (courseId) => { ... });

// enrollment.remote.ts
export const enrollStudent = command(EnrollSchema, async (data) => { ... });
export const getStudentProgress = query(v.pipe(v.string(), v.uuid()), async (enrollmentId) => { ... });
export const updateProgress = command(ProgressSchema, async (data) => { ... });
```

**Course builder** links H5P content items into an ordered structure. The `structure_json` JSONB column stores the section/module hierarchy, and `course_items` table links to h5p_content entries.

### 3.3 xAPI statement recording

When h5p-standalone fires xAPI events, capture them:

```typescript
// In H5PPlayer.svelte, listen for xAPI events
window.addEventListener('message', (event) => {
  if (event.data?.context === 'h5p' && event.data?.statement) {
    recordXAPIStatement({
      orgId,
      contentId,
      courseId,
      verb: event.data.statement.verb.id,
      statementJson: JSON.stringify(event.data.statement)
    });
  }
});
```

Store in the `xapi_statements` append-only table for analytics.

### Deliverable
Self-hosted hub API working. Teachers can build courses from H5P content items. Students can enroll, learn, and have progress tracked.

---

## Phase 4: Polish + H5P Editor (Weeks 6–7)

**Goal:** In-app content editing, subscription enforcement, production polish.

### 4.1 H5P Editor integration (optional but valuable)

Two options for in-app editing:

**Option A: Lumi H5P Editor (web component)**
Use `@lumieducation/h5p-webcomponents` which provides an `<h5p-editor>` web component. This is lighter than the full h5p-server — it needs:
- A content type list endpoint (your hub API provides this)
- A library files endpoint (your R2 serves this)
- A content save endpoint (your content.remote.ts handles this)

**Option B: Embed H5P.org editor in iframe**
Point an iframe at H5P.org's editor, intercept the save to capture the .h5p file, then process it through your upload pipeline. Simpler but dependent on H5P.org availability.

**Recommendation:** Start with Option B for speed, build Option A when you have bandwidth. Users can always create content externally and upload .h5p files regardless.

### 4.2 Subscription tier enforcement

Adapt Webkit's existing tier system (from Blueprint Section 9, Webkit `subscription.ts`):

| Tier | Teachers | Content items | Storage | Courses |
|---|---|---|---|---|
| Free | 1 | 50 | 1 GB | 3 |
| Starter | 5 | 500 | 10 GB | 20 |
| Growth | 25 | Unlimited | 100 GB | Unlimited |
| Enterprise | Unlimited | Unlimited | Unlimited | Unlimited |

### 4.3 Remaining polish

- GDPR data export (extend Webkit's existing endpoints)
- Grafana dashboards for H5P metrics
- Content generation (Flashcards from CSV, Interactive Book from text)
- Search/filtering improvements
- Mobile responsive course player

---

## Phase 5: Deployment (Week 8)

*Unchanged from v1 — see Revised_Migration_Plan.md Phase 5.*

---

## What we're NOT building (and why)

| Component | Why skip |
|---|---|
| `@lumieducation/h5p-server` integration | Root cause of LEAP's instability. h5p-standalone + custom layer is simpler and more reliable |
| ConnectRPC for H5P services | H5P Hub must be REST. Content/library management works well as SvelteKit Remote Functions + Drizzle. No benefit to adding Go/ConnectRPC here |
| Custom H5P editor (Phase 1–3) | Editor is the hardest part. Get the player + content management solid first. Import via .h5p upload covers the use case initially |
| MongoDB compatibility layer | Clean break. All new code targets PostgreSQL from day one |
| Go-based H5P services | H5P ecosystem is JavaScript. Fighting that by rewriting in Go adds cost with no performance benefit for content serving |

---

## Timeline summary

| Phase | Duration | Deliverable |
|---|---|---|
| Phase 0: Webkit skeleton | Days 1–3 | Booting app with auth, orgs, Docker |
| Phase 1: Schema + library sync | Week 1 | Libraries synced from H5P.org to R2 + PostgreSQL |
| Phase 2: Player + content management | Weeks 2–3 | Upload .h5p → play content via h5p-standalone |
| Phase 3: Hub API + courses | Weeks 4–5 | Self-hosted hub, course builder, enrollment, progress |
| Phase 4: Editor + polish | Weeks 6–7 | In-app editing, subscription tiers, analytics |
| Phase 5: Deployment | Week 8 | Production on VPS with Traefik + monitoring |

---

## Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| h5p-standalone can't handle all content types | Low | High | h5p-standalone supports all standard H5P types. Test with your most complex content types in Phase 2 Week 2 |
| R2 CORS issues block player | Medium | Medium | Configure CORS on R2 bucket. Fallback: proxy through SvelteKit server route |
| .h5p extraction misses edge cases | Medium | Medium | Study H5P spec carefully. Test with 10+ different content types early |
| Library dependency graph has cycles | Low | Medium | Blueprint's recursive CTE has depth limit (20). PostgreSQL handles this natively |
| Users expect in-app editor from day 1 | Medium | Medium | Communicate that .h5p upload is the initial workflow. Editor comes in Phase 4 |
| Timeline slips | High | Medium | Core value (player + content library) delivered by end of Week 3. Courses and editor can ship later |

---

## Decision log

| Decision | Rationale |
|---|---|
| Drop @lumieducation/h5p-server | Multiple failed integration attempts in LEAP. Framework complexity doesn't justify benefit over simpler approach |
| Use h5p-standalone for player | Battle-tested, minimal dependencies, works with R2/CDN, active maintenance (v3.8.0, Jan 2025) |
| Build custom library sync | It's just: HTTP fetch → unzip → upload to R2 → insert PostgreSQL. No framework needed |
| Import-first content creation | .h5p upload is reliable and well-understood. Defer editor integration to Phase 4 |
| Build fresh in Webkit skeleton | No working H5P code to port from LEAP. Clean slate with PostgreSQL from day one |
| Keep H5P services in SvelteKit | H5P ecosystem is JavaScript. h5p-standalone is a JS library. SvelteKit Remote Functions + Drizzle is the natural fit |
