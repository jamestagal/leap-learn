# Phase 3.5 — H5P Playback Integration

**Status:** Ready for implementation
**Target:** Immediately after Phase 3 (courses/progress CRUD complete, playback non-functional)
**Prerequisites:** Phase 3 complete (routes, enrolment, xAPI wiring all in place)
**Estimate:** ~10h (1.5 days)

---

## Problem

Phase 3 built the full course/enrolment/xAPI pipeline, but the learning player shows a placeholder where H5P content should render. Three pieces are missing:

1. **No play endpoint** — h5p-standalone needs content params + library dependency list served as JSON. The existing editor params endpoint (`GET /api/v1/h5p/editor/params/{contentId}`) is close but returns editor-specific data, not play-ready data.
2. **h5p-standalone not installed** — the npm package that renders H5P content client-side isn't in `package.json`.
3. **H5PPlayer.svelte is LEAP-era scaffolding** — calls non-existent endpoints (`/api/public/h5p/play/`, `/api/public/h5p/assets/`), needs full rewrite.

---

## Architecture Decision: Endpoint Strategy

**Option A** — Reuse editor params endpoint for playback
**Option B** — New dedicated play endpoint ✅

Going with **Option B** because:

- Editor params returns `EditorContentParams { H5P, Library, Params }` — this doesn't include the resolved dependency file list (CSS/JS paths) that h5p-standalone needs
- Play endpoint needs different auth (learner access vs admin-only editor access)
- Play endpoint should be lightweight (no editor dependencies in response)
- Separation keeps editor and player concerns clean

---

## Architecture Decision: h5p-standalone Loading Strategy

**Option A** — `npm install h5p-standalone` + import in Svelte component
**Option B** — Serve h5p-standalone dist files statically + dynamic script load ✅

Going with **Option B** because:

- h5p-standalone modifies `window.H5P` global state — not SSR-safe
- It needs to run inside the browser only, after DOM mount
- The existing H5PEditor.svelte already uses dynamic script loading for the H5P editor
- Keeps bundle size clean (h5p-standalone is ~200KB and only needed on learning player pages)
- CDN fallback possible for faster initial loads

**Approach:** Download h5p-standalone dist files into `service-client/static/h5p-standalone/`, load via `<script>` tag in the component's `onMount`.

---

## 1. Go Play Endpoints

### Primary Endpoint: `GET /api/v1/h5p/play/{contentId}?orgId={orgId}`

**Auth:** JWT (any org member — learner access, not admin-only)

**Purpose:** Return everything h5p-standalone needs to render content.

### Serve Endpoints (for h5p-standalone)

h5p-standalone internally fetches `h5p.json` and `content/content.json` from the paths provided. It also resolves content asset paths (images, videos) relative to the content URL. Using real HTTP URLs (not Blob URLs) ensures h5p-standalone's internal relative path resolution works correctly for both JSON fetching and content asset loading.

```
GET /api/v1/h5p/play/{contentId}/h5p.json         → constructed h5p.json (library + dependencies)
GET /api/v1/h5p/play/{contentId}/content/content.json → content_json from DB
```

Both endpoints share the same auth as the primary play endpoint (JWT, org membership). They're lightweight — the data is already available from the same queries used by the primary endpoint.

### Response Shape (primary endpoint)

```json
{
  "contentId": "uuid",
  "title": "Quiz: Cell Biology",
  "library": "H5P.QuestionSet 1.20",
  "contentJson": { ... },
  "dependencies": [
    {
      "machineName": "H5P.JoubelUI",
      "majorVersion": 1,
      "minorVersion": 3,
      "patchVersion": 11,
      "preloadedCss": ["css/joubel-ui.css"],
      "preloadedJs": ["js/joubel-ui.js"]
    },
    {
      "machineName": "H5P.QuestionSet",
      "majorVersion": 1,
      "minorVersion": 20,
      "patchVersion": 7,
      "preloadedCss": ["css/question-set.css"],
      "preloadedJs": ["js/question-set.js"]
    }
  ],
  "librariesBaseUrl": "/api/h5p/libraries",
  "contentFilesBaseUrl": "/api/h5p/content-files/{orgId}/{contentId}"
}
```

### Implementation

```go
func (h *Handler) handleH5PPlay(w http.ResponseWriter, r *http.Request) {
    contentID := chi.URLParam(r, "contentId")
    orgID := r.URL.Query().Get("orgId")

    // 1. Get content row (includes content_json, library_id)
    content, err := h.queries.GetH5PContent(r.Context(), contentID, orgID)

    // 2. Get main library info
    mainLib, err := h.queries.GetH5PLibrary(r.Context(), content.LibraryID)

    // 3. Resolve full dependency tree (recursive CTE, topological order)
    deps, err := h.queries.GetH5PLibraryFullDependencyTree(r.Context(), content.LibraryID)

    // 4. For each dependency, extract preloadedCss/preloadedJs from metadata_json
    dependencies := []PlayDependency{}
    for _, dep := range deps {
        var meta LibraryMetadata
        json.Unmarshal(dep.MetadataJson, &meta)
        dependencies = append(dependencies, PlayDependency{
            MachineName:  dep.MachineName,
            MajorVersion: dep.MajorVersion,
            MinorVersion: dep.MinorVersion,
            PatchVersion: dep.PatchVersion,
            PreloadedCss: meta.PreloadedCss, // []string from library.json
            PreloadedJs:  meta.PreloadedJs,  // []string from library.json
        })
    }

    // 5. Append the main library itself (it's not in its own dependency tree)
    var mainMeta LibraryMetadata
    json.Unmarshal(mainLib.MetadataJson, &mainMeta)
    dependencies = append(dependencies, PlayDependency{
        MachineName:  mainLib.MachineName,
        MajorVersion: mainLib.MajorVersion,
        MinorVersion: mainLib.MinorVersion,
        PatchVersion: mainLib.PatchVersion,
        PreloadedCss: mainMeta.PreloadedCss,
        PreloadedJs:  mainMeta.PreloadedJs,
    })

    // 6. Return play params
    json.NewEncoder(w).Encode(PlayResponse{
        ContentID:           content.ID,
        Title:               content.Title,
        Library:             fmt.Sprintf("%s %d.%d", mainLib.MachineName, mainLib.MajorVersion, mainLib.MinorVersion),
        ContentJson:         content.ContentJson,
        Dependencies:        dependencies,
        LibrariesBaseUrl:    "/api/h5p/libraries",
        ContentFilesBaseUrl: fmt.Sprintf("/api/h5p/content-files/%s/%s", orgID, content.ID),
    })
}
```

### Go Types

```go
type PlayDependency struct {
    MachineName  string   `json:"machineName"`
    MajorVersion int      `json:"majorVersion"`
    MinorVersion int      `json:"minorVersion"`
    PatchVersion int      `json:"patchVersion"`
    PreloadedCss []string `json:"preloadedCss"`
    PreloadedJs  []string `json:"preloadedJs"`
}

type PlayResponse struct {
    ContentID           string          `json:"contentId"`
    Title               string          `json:"title"`
    Library             string          `json:"library"`
    ContentJson         json.RawMessage `json:"contentJson"`
    Dependencies        []PlayDependency `json:"dependencies"`
    LibrariesBaseUrl    string          `json:"librariesBaseUrl"`
    ContentFilesBaseUrl string          `json:"contentFilesBaseUrl"`
}

// LibraryMetadata — subset of library.json relevant to playback
type LibraryMetadata struct {
    PreloadedCss []CssPath `json:"preloadedCss"`
    PreloadedJs  []JsPath  `json:"preloadedJs"`
}

type CssPath struct {
    Path string `json:"path"`
}

type JsPath struct {
    Path string `json:"path"`
}
```

**Note on PreloadedCss/PreloadedJs format:** H5P library.json stores these as arrays of objects: `[{"path": "css/foo.css"}]`. The Go endpoint extracts just the path strings for the `preloadedCss`/`preloadedJs` arrays in the response. Actually — keep the original format `[{"path": "..."}]` to stay consistent with H5P conventions. The Svelte component will map `.path` when building URLs.

### Serve Endpoint Implementations

```go
// ~20 lines total — reuses the same queries as handleH5PPlay

func (h *Handler) handleH5PPlayH5PJson(w http.ResponseWriter, r *http.Request) {
    contentID := chi.URLParam(r, "contentId")
    orgID := r.URL.Query().Get("orgId")

    // Same auth + data fetch as handleH5PPlay (can extract to shared helper)
    content, _ := h.queries.GetH5PContent(r.Context(), contentID, orgID)
    mainLib, _ := h.queries.GetH5PLibrary(r.Context(), content.LibraryID)
    deps, _ := h.queries.GetH5PLibraryFullDependencyTree(r.Context(), content.LibraryID)

    // Build h5p.json with preloadedDependencies (includes patchVersion for path resolution)
    preloaded := []map[string]interface{}{}
    for _, dep := range deps {
        preloaded = append(preloaded, map[string]interface{}{
            "machineName":  dep.MachineName,
            "majorVersion": dep.MajorVersion,
            "minorVersion": dep.MinorVersion,
            "patchVersion": dep.PatchVersion,
        })
    }
    // Include main library itself
    preloaded = append(preloaded, map[string]interface{}{
        "machineName":  mainLib.MachineName,
        "majorVersion": mainLib.MajorVersion,
        "minorVersion": mainLib.MinorVersion,
        "patchVersion": mainLib.PatchVersion,
    })

    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(map[string]interface{}{
        "mainLibrary":           mainLib.MachineName,
        "preloadedDependencies": preloaded,
    })
}

func (h *Handler) handleH5PPlayContentJson(w http.ResponseWriter, r *http.Request) {
    contentID := chi.URLParam(r, "contentId")
    orgID := r.URL.Query().Get("orgId")

    content, _ := h.queries.GetH5PContent(r.Context(), contentID, orgID)

    w.Header().Set("Content-Type", "application/json")
    w.Write(content.ContentJson) // jsonb column, already valid JSON
}
```

### Route Registration

```go
// In server.go — add to existing H5P routes
r.Get("/api/v1/h5p/play/{contentId}", h.withAuth(h.handleH5PPlay))
r.Get("/api/v1/h5p/play/{contentId}/h5p.json", h.withAuth(h.handleH5PPlayH5PJson))
r.Get("/api/v1/h5p/play/{contentId}/content/content.json", h.withAuth(h.handleH5PPlayContentJson))
r.Get("/api/v1/h5p/play/{contentId}/content/*", h.withAuth(h.handleH5PPlayContentFile))
```

### Auth: Learner Access

The existing editor params endpoint checks `admin` role. The play endpoint should check **org membership only** (any member can play content they're enrolled in). The `withAuth` middleware already extracts user + validates JWT. The handler verifies orgId membership:

```go
// Verify user is member of org (existing pattern from xapi_route.go)
isMember, err := h.queries.IsOrgMember(r.Context(), userID, orgID)
if !isMember {
    http.Error(w, "Forbidden", http.StatusForbidden)
    return
}
```

### Existing Infrastructure Reused

| What | Already exists | Location |
|------|---------------|----------|
| `GetH5PContent(contentID, orgID)` | ✅ | `query_postgres.sql` |
| `GetH5PLibraryFullDependencyTree(libID)` | ✅ | `query_postgres.sql` (recursive CTE) |
| `GetH5PLibrary(libID)` | ✅ | `query_postgres.sql` |
| Library asset serving | ✅ | `GET /api/v1/h5p/libraries/{name}-{ver}/{path}` (unauthenticated, immutable cache) |
| Content file serving | ✅ | `GET /api/v1/h5p/content-files/{orgId}/{contentId}/{path}` |
| SvelteKit proxy | ✅ | `/api/h5p/[...path]` → Go backend |
| JWT auth middleware | ✅ | `withAuth()` |
| Org membership check | ✅ | `IsOrgMember()` pattern in `xapi_route.go` |

**New code required:** ~100 lines in Go (4 handlers + types + shared helper). No new SQL queries needed.

---

## 2. h5p-standalone Setup

### Installation

```bash
# Download dist files (not npm install — we serve statically)
cd service-client
mkdir -p static/h5p-standalone

# Option A: npm pack + extract dist
npm pack h5p-standalone --pack-destination /tmp
tar -xzf /tmp/h5p-standalone-*.tgz -C /tmp
cp -r /tmp/package/dist/* static/h5p-standalone/

# Option B: Direct from CDN/GitHub release (simpler)
curl -L https://cdn.jsdelivr.net/npm/h5p-standalone@3/dist/main.bundle.js \
  -o static/h5p-standalone/main.bundle.js
curl -L https://cdn.jsdelivr.net/npm/h5p-standalone@3/dist/frame.bundle.js \
  -o static/h5p-standalone/frame.bundle.js
curl -L https://cdn.jsdelivr.net/npm/h5p-standalone@3/dist/styles/h5p.css \
  -o static/h5p-standalone/styles/h5p.css
```

### Files Required

```
service-client/static/h5p-standalone/
├── main.bundle.js       # H5P standalone player (loads into window.H5PStandalone)
├── frame.bundle.js      # Frame script (loaded by player inside iframe)
└── styles/
    └── h5p.css          # Frame CSS
```

### Verification

After setup, these URLs should serve correctly:
- `http://localhost:3000/h5p-standalone/main.bundle.js`
- `http://localhost:3000/h5p-standalone/frame.bundle.js`
- `http://localhost:3000/h5p-standalone/styles/h5p.css`

---

## 3. H5PPlayer.svelte Rewrite

### Props

```typescript
interface H5PPlayerProps {
    contentId: string;
    organisationId: string;
    courseItemId?: string;        // for xAPI routing (Phase 3 direct, Phase 4 Worker)
    enrolmentId?: string;        // for xAPI routing (Phase 4 Worker)
    onXAPIStatement?: (statement: XAPIStatement) => void;
    onComplete?: () => void;
    onScore?: (score: number, maxScore: number) => void;
    className?: string;
}
```

### Implementation

```svelte
<script lang="ts">
    import { onMount, onDestroy } from 'svelte';

    let {
        contentId,
        organisationId,
        courseItemId,
        enrolmentId,
        onXAPIStatement,
        onComplete,
        onScore,
        className = '',
    }: H5PPlayerProps = $props();

    let containerEl: HTMLDivElement;
    let loading = $state(true);
    let error = $state<string | null>(null);
    let playerReady = $state(false);

    // Track listener for cleanup on destroy
    let xapiHandler: ((event: any) => void) | null = null;

    onMount(async () => {
        try {
            // 1. Fetch play params from Go backend (via SvelteKit proxy)
            const res = await fetch(
                `/api/h5p/play/${contentId}?orgId=${organisationId}`
            );
            if (!res.ok) throw new Error(`Failed to load content: ${res.status}`);
            const playData = await res.json();

            // 2. Load h5p-standalone script (idempotent — skip if already loaded)
            if (!window.H5PStandalone) {
                await loadScript('/h5p-standalone/main.bundle.js');
            }

            // 3. Register xAPI listener BEFORE H5P init
            //    Some content types fire xAPI events during initialisation.
            //    Registering after init would miss those events.
            xapiHandler = (event: any) => {
                const statement = event.data?.statement;
                if (!statement) return;

                const verb = extractVerb(statement);
                onXAPIStatement?.(statement);

                if (verb === 'completed') {
                    onComplete?.();
                }
                if (verb === 'scored' && statement.result?.score) {
                    onScore?.(
                        statement.result.score.raw,
                        statement.result.score.max
                    );
                }
            };

            // H5P global may already exist from a previous player instance
            if (window.H5P?.externalDispatcher) {
                window.H5P.externalDispatcher.on('xAPI', xapiHandler);
            } else {
                // h5p-standalone creates window.H5P during init — defer listener
                // registration to after init (see step 5 below)
            }

            // 4. Initialise h5p-standalone with serve endpoint URLs
            //    h5p-standalone fetches h5p.json and content/content.json from
            //    these real HTTP URLs. Content asset paths (images, videos) in
            //    content.json resolve relative to contentJsonPath automatically.
            const proxyBase = `/api/h5p/play/${contentId}`;

            const { H5P } = window.H5PStandalone;
            await new H5P(containerEl, {
                id: contentId,
                h5pJsonPath: `${proxyBase}/h5p.json?orgId=${organisationId}`,
                contentJsonPath: `${proxyBase}/content/content.json?orgId=${organisationId}`,
                librariesPath: playData.librariesBaseUrl,
                frameJs: '/h5p-standalone/frame.bundle.js',
                frameCss: '/h5p-standalone/styles/h5p.css',
                frame: false,
                copyright: false,
                export: false,
                icon: false,
                fullScreen: false,
            });

            // 5. If H5P.externalDispatcher wasn't available before init,
            //    register now (it was created by h5p-standalone during step 4)
            if (window.H5P?.externalDispatcher && xapiHandler) {
                // Safe to call .on() again — it won't duplicate if already registered
                // (but in practice, the pre-init registration above handles most cases)
                window.H5P.externalDispatcher.on('xAPI', xapiHandler);
            }

            playerReady = true;
        } catch (e) {
            error = e instanceof Error ? e.message : 'Failed to load H5P content';
            console.error('H5PPlayer error:', e);
        } finally {
            loading = false;
        }
    });

    // Clean up on component destroy — prevents listener accumulation
    // when navigating between course items
    onDestroy(() => {
        if (xapiHandler && window.H5P?.externalDispatcher) {
            window.H5P.externalDispatcher.off('xAPI', xapiHandler);
        }
        xapiHandler = null;
    });

    // ─── Helpers ─────────────────────────────────────────────

    function extractVerb(statement: any): string {
        const verbId = statement.verb?.id || '';
        return verbId.split('/').pop() || '';
    }

    function loadScript(src: string): Promise<void> {
        return new Promise((resolve, reject) => {
            if (document.querySelector(`script[src="${src}"]`)) {
                resolve();
                return;
            }
            const script = document.createElement('script');
            script.src = src;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error(`Failed to load: ${src}`));
            document.head.appendChild(script);
        });
    }
</script>

{#if loading}
    <div class="flex items-center justify-center min-h-[400px]">
        <span class="loading loading-spinner loading-lg"></span>
    </div>
{:else if error}
    <div class="alert alert-error">
        <span>{error}</span>
    </div>
{/if}

<div
    bind:this={containerEl}
    class="h5p-player-container {className}"
    class:hidden={loading || !!error}
></div>

<style>
    .h5p-player-container {
        width: 100%;
        min-height: 400px;
    }
    .h5p-player-container :global(.h5p-iframe-wrapper) {
        width: 100% !important;
    }
    .h5p-player-container :global(.h5p-iframe) {
        width: 100% !important;
    }
</style>
```

### Why Serve Endpoints, Not Blob URLs

h5p-standalone fetches `h5p.json` and `content/content.json` from the paths provided, but it also resolves sub-resource paths (library assets, content files like images/videos) **relative to those URLs**. When the base URL is a `blob:` URL, relative path resolution breaks — `new URL('images/foo.png', 'blob:http://...')` fails because blob URLs don't support relative resolution.

Real HTTP serve endpoints ensure:
1. h5p-standalone can fetch the JSON files normally
2. Content asset paths in `content.json` (e.g., `images/foo.png`) resolve relative to the content URL
3. Library paths constructed from `preloadedDependencies` resolve correctly against `librariesPath`

The serve endpoints are lightweight (~20 lines each) and reuse the same queries as the primary play endpoint.

### Library Asset Resolution

h5p-standalone resolves library assets using `librariesPath`. When it needs a file from `H5P.JoubelUI-1.3.11`, it fetches:

```
{librariesPath}/H5P.JoubelUI-1.3.11/{filepath}
```

Our existing library asset endpoint matches this pattern exactly:

```
GET /api/v1/h5p/libraries/H5P.JoubelUI-1.3.11/css/joubel-ui.css
```

Via the SvelteKit proxy at `/api/h5p/libraries/...`, this just works. The `librariesBaseUrl` in the play response is set to `/api/h5p/libraries` and h5p-standalone appends `/{machineName}-{major}.{minor}.{patch}/{filepath}`.

**Library path format:** h5p-standalone constructs library directory names from `preloadedDependencies` in h5p.json. When `patchVersion` is included, paths are `{machineName}-{major}.{minor}.{patch}`, matching our R2 extracted paths exactly. The serve endpoint (`handleH5PPlayH5PJson`) always includes `patchVersion` in `preloadedDependencies` to ensure this.

### Content File Resolution

Content files (images, videos uploaded with H5P content) are stored in R2 at `h5p-content/{orgId}/{contentId}/{filepath}` and served by the existing endpoint:

```
GET /api/v1/h5p/content-files/{orgId}/{contentId}/{filepath}
```

h5p-standalone resolves content asset paths (e.g., `images/image-abc.png`) relative to the URL it fetched `content/content.json` from. Since our serve endpoint provides `content.json` at a real HTTP URL (`/api/h5p/play/{contentId}/content/content.json`), we need the Go backend to also serve content files relative to that path.

**Approach:** Add a catch-all route under the play path for content files:

```
GET /api/v1/h5p/play/{contentId}/content/{filepath...}
```

This handler proxies to the existing content-files R2 storage. h5p-standalone fetches content.json from `/api/h5p/play/{contentId}/content/content.json`, then resolves `images/foo.png` as `/api/h5p/play/{contentId}/content/images/foo.png` — which the catch-all serves from R2.

```go
func (h *Handler) handleH5PPlayContentFile(w http.ResponseWriter, r *http.Request) {
    contentID := chi.URLParam(r, "contentId")
    filepath := chi.URLParam(r, "*") // everything after /content/

    // orgId may not be in query string — content file requests come from
    // h5p-standalone resolving relative paths (e.g., images/foo.png) against
    // the content.json URL. Look up orgId from the content record.
    orgID := r.URL.Query().Get("orgId")
    if orgID == "" {
        content, err := h.queries.GetH5PContentOrgID(r.Context(), contentID)
        if err != nil {
            http.Error(w, "Not found", http.StatusNotFound)
            return
        }
        orgID = content.OrganisationID
    }

    // Reuse existing content file serving logic
    key := fmt.Sprintf("h5p-content/%s/%s/%s", orgID, contentID, filepath)
    h.serveR2File(w, r, key)
}
```

**Note:** `GetH5PContentOrgID` is a lightweight query (`SELECT organisation_id FROM h5p_content WHERE id = $1`). If this query doesn't exist, add it, or reuse `GetH5PContent` and extract the org ID. Alternatively, cache orgId in the endpoint session or pass it via a cookie.

Route registration:
```go
r.Get("/api/v1/h5p/play/{contentId}/content/*", h.withAuth(h.handleH5PPlayContentFile))
```

**No regex rewriting needed.** h5p-standalone handles all relative path resolution internally when given real HTTP URLs.

---

## 4. Learning Player Integration

### Changes to `/learn/[courseId]/[itemId]/+page.svelte`

Replace the placeholder with H5PPlayer component:

```svelte
<!-- Before (placeholder) -->
<div class="card bg-base-100 shadow-xl">
    <div class="card-body items-center text-center">
        <p>H5P player loading...</p>
    </div>
</div>

<!-- After -->
{#if currentItem.contentId}
    <H5PPlayer
        contentId={currentItem.contentId}
        organisationId={data.organisationId}
        courseItemId={currentItem.id}
        enrolmentId={data.enrolmentId}
        onXAPIStatement={handleXAPIStatement}
        onComplete={handleComplete}
        onScore={handleScore}
    />
{:else if currentItem.bodyMarkdown}
    <!-- Text-only course item (no H5P content) -->
    <div class="prose max-w-none">
        {@html renderMarkdown(currentItem.bodyMarkdown)}
    </div>
{/if}
```

### Changes to `/learn/[courseId]/[itemId]/+page.server.ts`

Add `organisationId` and `enrolmentId` to the returned data:

```typescript
// Add to the load function return
return {
    course,
    progress,
    currentItem,
    currentProgress: currentProgress || null,
    prevItem,
    nextItem,
    currentIndex,
    organisationId: params.organisationSlug,  // needed by H5PPlayer
    enrolmentId: progress.enrolmentId,        // needed for Phase 4 Worker routing
};
```

**Note:** `organisationId` is needed for the play endpoint's `orgId` query param. The learning player route already has `organisationSlug` from the URL params — we need the actual UUID. Either:
- (a) Load it from the organisation context (already available in layout)
- (b) Include it in the course response from `getCourse()`
- (c) Use the enrolment's orgId

The simplest path: the `getCourse()` remote function already returns `course.organisationId`. Use that.

### xAPI Flow (unchanged from Phase 3)

The learning player's existing xAPI wiring stays. H5PPlayer fires `onXAPIStatement` → learning player POSTs to `/api/h5p/xapi`. The Phase 3 Go endpoint handles progress tracking. No changes needed to the xAPI pipeline.

The key difference from the old H5PPlayer.svelte: xAPI events are dispatched via **callbacks** (not postMessage). The learning player page handles routing to the backend.

---

## 5. Implementation Checklist

### Step 1: h5p-standalone dist files (30 min)

- [ ] Download `main.bundle.js`, `frame.bundle.js`, `styles/h5p.css` from h5p-standalone v3
- [ ] Place in `service-client/static/h5p-standalone/`
- [ ] Verify serving at `http://localhost:3000/h5p-standalone/main.bundle.js`
- [ ] Add `static/h5p-standalone/` to `.gitignore` with a setup script, OR commit the dist files (they're ~200KB total, acceptable)

### Step 2: Go play endpoints (2.5h)

- [ ] Create new `h5p_play_route.go` with `PlayResponse`, `PlayDependency` types
- [ ] Implement `handleH5PPlay` — primary endpoint returning play params
- [ ] Implement `handleH5PPlayH5PJson` — serve constructed h5p.json (with patchVersion in preloadedDependencies)
- [ ] Implement `handleH5PPlayContentJson` — serve content_json from DB
- [ ] Implement `handleH5PPlayContentFile` — proxy content files from R2 (catch-all route)
- [ ] Register all routes:
  - `r.Get("/api/v1/h5p/play/{contentId}", h.withAuth(h.handleH5PPlay))`
  - `r.Get("/api/v1/h5p/play/{contentId}/h5p.json", h.withAuth(h.handleH5PPlayH5PJson))`
  - `r.Get("/api/v1/h5p/play/{contentId}/content/content.json", h.withAuth(h.handleH5PPlayContentJson))`
  - `r.Get("/api/v1/h5p/play/{contentId}/content/*", h.withAuth(h.handleH5PPlayContentFile))`
- [ ] Test: `curl` all endpoints return correct JSON / files
- [ ] Verify dependency tree is complete, topologically ordered, includes patchVersion

### Step 3: H5PPlayer.svelte rewrite (3.5h)

- [ ] Replace existing `H5PPlayer.svelte` with new implementation
- [ ] Dynamic script loading for `main.bundle.js`
- [ ] Fetch play endpoint for metadata
- [ ] Initialise h5p-standalone with serve endpoint URLs (h5pJsonPath, contentJsonPath)
- [ ] xAPI listener registered BEFORE H5P init (catches init-time events)
- [ ] `onDestroy` cleanup removes xAPI listener (prevents accumulation across course items)
- [ ] Loading state + error handling UI
- [ ] Test with real H5P content (quiz, interactive video, course presentation)

### Step 4: Learning player integration (2h)

- [ ] Replace placeholder in `/learn/[courseId]/[itemId]/+page.svelte` with `<H5PPlayer>`
- [ ] Pass correct props (contentId, organisationId, courseItemId, enrolmentId)
- [ ] Wire `onXAPIStatement` to existing xAPI POST logic
- [ ] Wire `onComplete` to progress refresh (`invalidateAll()`)
- [ ] Test text-only course items (bodyMarkdown) still render correctly
- [ ] Test xAPI flow end-to-end: play content → answer quiz → verify progress updated

### Step 5: Verification (1.5h)

- [ ] Library assets load correctly (check Network tab for 404s)
- [ ] Content files (images) display inside H5P content
- [ ] xAPI statements captured in `xapi_statements` table
- [ ] Progress updates in `progress_records` table
- [ ] Course completion triggers when all items done
- [ ] sendBeacon fallback works on tab close
- [ ] Multiple content types work: Quiz, Interactive Video, Course Presentation, Drag and Drop

---

## Known Risks

### h5p-standalone xAPI dispatcher registration timing

The `H5P.externalDispatcher` object is created by h5p-standalone during initialisation. If `window.H5P` doesn't exist before init, we can't register the xAPI listener pre-init. The implementation handles this with a two-phase approach: attempt registration before init (for cases where `window.H5P` already exists from a previous player instance), then ensure registration after init.

**Mitigation:** If duplicate events are observed, add a guard to `xapiHandler` to deduplicate by statement ID.

### Content types with unusual asset path patterns

Most H5P content types reference files as `images/xxx.png`, `videos/xxx.mp4` etc., which resolve correctly relative to the content URL. Some exotic content types may use absolute paths or cross-reference other content.

**Mitigation:** Test with the most common content types first (Quiz, Interactive Video, Course Presentation, Drag and Drop). Add specific handling if edge cases are found.

### h5p-standalone version compatibility

We're pinning to h5p-standalone v3. If this version has bugs or missing features, updating may change the expected API.

**Mitigation:** Commit the dist files to the repo (they're ~200KB) rather than fetching from CDN at build time. This locks the version.

---

## What This Does NOT Change

- **xAPI pipeline** — unchanged (learning player → Go backend → PostgreSQL)
- **Editor** — unchanged (H5PEditor.svelte continues to work as-is)
- **Library management** — unchanged (install, enable/disable, delete)
- **Content CRUD** — unchanged (create, edit, save via editor)
- **Course structure** — unchanged (courses, course_items, enrolment)
- **Progress tracking** — unchanged (progress_records, auto-completion)
- **Phase 4 compatibility** — H5PPlayer callbacks make it trivial to swap xAPI routing from Go backend to Cloudflare Worker later

---

## Dependency on Phase 4

Phase 4 (Durable Objects) will change where xAPI events are sent:

```
Phase 3:  H5PPlayer → onXAPIStatement → learning player → /api/h5p/xapi (Go)
Phase 4:  H5PPlayer → onXAPIStatement → learning player → /xapi (CF Worker)
```

The H5PPlayer component itself doesn't change — only the learning player's `handleXAPIStatement` function changes the destination URL. This is intentional — H5PPlayer fires callbacks, the parent decides where to route them.
