# Phase 2: H5P Editor Integration — Implementation Plan

**Status**: Planned
**Prerequisite**: Phase 1 (Library Management + Hub API) ✅
**Goal**: Users can create and edit H5P content natively in LeapLearn

---

## Architecture Decision

Build the H5P editor integration **natively in Go + SvelteKit** rather than running `@lumieducation/h5p-server` as a Node.js sidecar. This eliminates operational complexity (no extra runtime) and gives us full control over the content pipeline.

**Reference**: Lumi `@lumieducation/h5p-server` AJAX endpoint contract (below) used as implementation checklist.

---

## What Already Exists

| Component | Status | Location |
|-----------|--------|----------|
| Library install/extract/serve | ✅ | `domain/h5p/service.go` |
| Library asset serving (JS/CSS/SVG) | ✅ | `GET /api/v1/h5p/libraries/{path}` |
| Hub registry (Catharsis format) | ✅ | `POST /api/v1/h5p/hub/content-types/` |
| Hub package download | ✅ | `GET /api/v1/h5p/hub/content-types/{name}` |
| Dependency tree (recursive CTE) | ✅ | `GetH5PLibraryFullDependencyTree()` |
| Content DB table (`h5p_content`) | ✅ | Schema only — no queries/service |
| File provider (R2/S3/MinIO) | ✅ | `domain/file/provider.go` |
| Per-org library control | ✅ | Enable/disable per org |

---

## Endpoint Map: Lumi Contract → Go Implementation

The H5P editor client makes these AJAX calls. Each maps to a Go handler.

### 1. `GET /ajax?action=content-type-cache` — Content Type Browser

**What it does**: Returns all available content types for the Content Type Browser modal.

**Lumi response shape**:
```json
{
  "apiVersion": {"major": 1, "minor": 26},
  "details": [],
  "libraries": [
    {
      "id": "H5P.Accordion",
      "version": {"major": 1, "minor": 0, "patch": 27},
      "title": "Accordion",
      "summary": "...",
      "icon": "/api/v1/h5p/libraries/H5P.Accordion-1.0.27/icon.svg",
      "installed": true,
      "isUpToDate": true,
      "canInstall": true,
      "restricted": false,
      "isRecommended": true,
      "popularity": 85,
      "screenshots": [...],
      "categories": [...],
      "keywords": [...],
      "owner": "Joubel"
    }
  ],
  "outdated": false,
  "recentlyUsed": [],
  "user": "anonymous"
}
```

**Go implementation**: Adapt existing `GetContentTypeCache()` — already returns merged hub + local data. Need to reshape output to match `IHubInfo` format (add `apiVersion`, `details`, `recentlyUsed`, `user` wrapper fields).

**Existing coverage**: ~90%. Minor reshaping needed.

---

### 2. `GET /ajax?action=libraries&machineName=X&majorVersion=Y&minorVersion=Z` — Library Detail

**What it does**: Returns detailed metadata + semantics for a specific library version. The editor calls this when user selects a content type or when loading sub-library editors.

**Lumi response shape**:
```json
{
  "css": ["/api/v1/h5p/libraries/H5P.Accordion-1.0.27/css/accordion.css"],
  "javascript": ["/api/v1/h5p/libraries/H5P.Accordion-1.0.27/js/accordion.js"],
  "language": {"en": {...}},
  "languages": ["en", "de", "fr"],
  "name": "H5P.Accordion",
  "semantics": [...],
  "title": "Accordion",
  "version": {"major": 1, "minor": 0},
  "defaultLanguage": "en",
  "translations": {},
  "upgradesScript": ""
}
```

**Go implementation — NEW**:
1. Load library from DB by machine_name + version
2. Download `library.json` from R2 (`h5p-libraries/extracted/{name}-{ver}/library.json`)
3. Parse `preloadedCss`, `preloadedJs` arrays → build full URL paths
4. Download `semantics.json` from R2 → return as `semantics` field
5. List language files from R2 (`language/` directory) → return codes + requested translation
6. Return flat JSON (NOT wrapped in `AjaxSuccessResponse`)

**Existing coverage**: 0%. New endpoint. But library files already in R2, just need to read + reshape.

**Key files to read from R2**:
- `h5p-libraries/extracted/{ubername}/library.json` — JS/CSS paths, metadata
- `h5p-libraries/extracted/{ubername}/semantics.json` — editor form schema
- `h5p-libraries/extracted/{ubername}/language/{lang}.json` — translations

---

### 3. `POST /ajax?action=libraries` — Bulk Library Overview

**What it does**: Given an array of library machine names, return basic info for each.

**Request body** (form data):
```json
{"libraries": ["H5P.Accordion 1.0", "H5P.Video 1.5"]}
```

**Response**: `AjaxSuccessResponse` wrapping array of library overviews.

**Go implementation — NEW**: Query `h5p_libraries` for each name, return title + version + restricted flag.

**Existing coverage**: ~50%. DB queries exist, need new handler + response shape.

---

### 4. `POST /ajax?action=translations&language=XX` — Library Translations

**What it does**: Returns translation strings for specified libraries in a given language.

**Request body**: `{"libraries": ["H5P.Accordion 1.0", ...]}`

**Go implementation — NEW**: For each library, download `language/{lang}.json` from R2. Return merged object.

**Existing coverage**: 0%. New, but reads from existing R2 files.

---

### 5. `POST /ajax?action=files` — Temp File Upload ⭐ Critical

**What it does**: Editor uploads images/media during editing (before final save). Returns a temp path the editor uses as `src` attribute.

**Request**: Multipart form with `file` field + `field` JSON metadata.

**Response** (raw, NOT wrapped):
```json
{
  "path": "/api/v1/h5p/temp-files/{tempId}/{filename}",
  "mime": "image/png",
  "width": 800,
  "height": 600
}
```

**Go implementation — NEW**:
1. Accept multipart upload
2. Validate file type against `field` metadata (allowed MIME types)
3. Generate temp ID (UUID)
4. Upload to R2: `h5p-temp/{userId}/{tempId}/{filename}`
5. Optionally detect image dimensions
6. Return path + MIME + dimensions
7. Background cleanup: delete temp files older than 24h (cron job)

**Existing coverage**: 0%. Entirely new. File provider exists but need temp upload flow.

**New R2 path**: `h5p-temp/{user_id}/{temp_id}/{filename}`

---

### 6. `POST /ajax?action=filter` — Content Parameter Validation

**What it does**: Validates and sanitises content parameters against library semantics (XSS prevention).

**Request body**: `{"libraryParameters": "{\"library\":\"H5P.Video 1.5\",\"params\":{...},\"metadata\":{...}}"}`

**Response**: `AjaxSuccessResponse` with validated params.

**Go implementation — DEFER to Phase 3**. For MVP, echo params back unchanged. Full semantic validation (walking the semantics tree, sanitising HTML fields) is complex. Lumi's implementation is ~2000 lines. We can add this incrementally.

**MVP approach**: Return input unchanged. Add HTML sanitisation later.

---

### 7. `POST /ajax?action=library-install` — Install from Editor

**What it does**: User clicks "Install" in Content Type Browser within the editor.

**Go implementation**: Already exists! Route to existing `InstallLibrary()`. Need thin adapter to match response shape (`AjaxSuccessResponse` wrapping updated content type cache).

**Existing coverage**: ~95%. Just need response wrapper.

---

### 8. `POST /ajax?action=library-upload` — Upload .h5p Package

**What it does**: User uploads a .h5p file through the editor. Extract libraries + content.

**Go implementation — PARTIAL NEW**:
1. Accept .h5p multipart upload
2. Call existing `ExtractH5PPackage()` to parse
3. Install extracted libraries using existing `installSingleLibrary()`
4. Save content.json to `h5p_content` table (NEW)
5. Upload content files to R2 (NEW)
6. Return content ID + updated cache

**Existing coverage**: ~60%. Extraction + library install exists. Content save is new.

---

### 9. `GET /params/:contentId` — Load Content for Editing ⭐ Critical

**What it does**: Returns content parameters so the editor can populate its form fields.

**Response** (raw JSON):
```json
{
  "h5p": {
    "title": "My Quiz",
    "mainLibrary": "H5P.QuestionSet",
    "preloadedDependencies": [...]
  },
  "library": "H5P.QuestionSet 1.20",
  "params": {
    "metadata": {"title": "My Quiz"},
    "params": { /* content.json contents */ }
  }
}
```

**Go implementation — NEW**:
1. Load `h5p_content` row by ID (with org scope)
2. Load associated library info
3. Build dependency list from recursive CTE
4. Return structured response

**New SQL queries needed**:
- `GetH5PContent(id, orgId)` — single content by ID
- Content → library join for metadata

---

### 10. `GET /content/:contentId/:file` — Content File Serving ⭐ Critical

**What it does**: Serves content-specific files (images, videos uploaded during editing).

**Go implementation — NEW**:
1. Validate content exists + org access
2. Construct R2 key: `h5p-content/{org_id}/{content_id}/{file_path}`
3. Download + serve with proper MIME type
4. Support Range headers for video streaming

**New R2 path**: `h5p-content/{org_id}/{content_id}/{filename}`

---

### 11. `GET /libraries/:ubername/:file` — Library File Serving

**Already implemented** ✅ at `GET /api/v1/h5p/libraries/{path}`.

Serves from R2 `h5p-libraries/extracted/{ubername}/{file}` with immutable cache headers.

No changes needed.

---

### 12. `GET /temp-files/:file` — Temp File Serving

**What it does**: Serves files uploaded via `POST /ajax?action=files` during editing.

**Go implementation — NEW**:
1. Construct R2 key: `h5p-temp/{path}`
2. Download + serve with MIME type
3. Support Range headers

---

### 13. `GET /download/:contentId` — Export .h5p Package

**What it does**: Packages content + dependencies into a downloadable .h5p file.

**Go implementation — DEFER to Phase 3**. Not needed for editor MVP. Can export later.

---

## Content CRUD Service (NEW)

### New SQL Queries (`storage/queries/h5p_content.sql`)

```sql
-- name: CreateH5PContent :one
INSERT INTO h5p_content (org_id, library_id, created_by, title, slug, description, content_json, tags, folder_path, storage_path, status)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
RETURNING *;

-- name: GetH5PContent :one
SELECT * FROM h5p_content WHERE id = $1 AND org_id = $2 AND deleted_at IS NULL;

-- name: ListH5PContent :many
SELECT c.*, l.machine_name, l.title as library_title
FROM h5p_content c
JOIN h5p_libraries l ON c.library_id = l.id
WHERE c.org_id = $1 AND c.deleted_at IS NULL
ORDER BY c.updated_at DESC
LIMIT $2 OFFSET $3;

-- name: UpdateH5PContent :one
UPDATE h5p_content SET
    title = $3, description = $4, content_json = $5, tags = $6,
    status = $7, updated_at = current_timestamp
WHERE id = $1 AND org_id = $2 AND deleted_at IS NULL
RETURNING *;

-- name: SoftDeleteH5PContent :exec
UPDATE h5p_content SET deleted_at = current_timestamp WHERE id = $1 AND org_id = $2;

-- name: CountH5PContentByOrg :one
SELECT count(*) FROM h5p_content WHERE org_id = $1 AND deleted_at IS NULL;
```

### New Service Methods (`domain/h5p/service.go`)

```
CreateContent(ctx, orgID, userID, libraryName, title, params) → Content
GetContent(ctx, contentID, orgID) → Content
UpdateContent(ctx, contentID, orgID, title, params) → Content
DeleteContent(ctx, contentID, orgID) → error
ListContent(ctx, orgID, limit, offset) → []Content
GetContentParams(ctx, contentID, orgID) → EditorParams
UploadTempFile(ctx, userID, file, fieldMeta) → TempFileResult
GetTempFile(ctx, filePath) → ([]byte, contentType, error)
GetContentFile(ctx, contentID, orgID, filePath) → ([]byte, contentType, error)
CleanupTempFiles(ctx, olderThan) → error
```

---

## New HTTP Routes

### Editor AJAX Router (`rest/h5p_editor_route.go` — NEW)

```
GET  /api/v1/h5p/editor/ajax           → handleEditorAjaxGet (dispatcher by ?action=)
POST /api/v1/h5p/editor/ajax           → handleEditorAjaxPost (dispatcher by ?action=)
GET  /api/v1/h5p/editor/params/{id}    → handleEditorGetParams
GET  /api/v1/h5p/content/{id}/{file}   → handleContentFile
GET  /api/v1/h5p/temp-files/{file}     → handleTempFile
```

### Updated `server.go` Route Registration

```go
// H5P Editor AJAX (authenticated — user must be logged in)
mux.HandleFunc("/api/v1/h5p/editor/ajax", apiHandler.handleEditorAjax)
mux.HandleFunc("/api/v1/h5p/editor/params/", apiHandler.handleEditorGetParams)

// H5P Content Files (authenticated — org scoped)
mux.HandleFunc("/api/v1/h5p/content/", apiHandler.handleContentFileRoute)

// H5P Temp Files (authenticated — user scoped)
mux.HandleFunc("/api/v1/h5p/temp-files/", apiHandler.handleTempFile)
```

---

## H5P Editor Client Configuration

The SvelteKit page that renders the H5P editor must pass these config URLs:

```javascript
{
  ajaxUrl: '/api/v1/h5p/editor/ajax',
  baseUrl: '/api/v1/h5p',
  contentFilesUrl: '/api/v1/h5p/content',
  coreUrl: '/h5p/core',              // Static H5P core JS/CSS
  editorLibraryUrl: '/h5p/editor',   // Static H5P editor JS/CSS
  librariesUrl: '/api/v1/h5p/libraries',
  paramsUrl: '/api/v1/h5p/editor/params',
  downloadUrl: '/api/v1/h5p/download',  // Phase 3
  playUrl: '/api/v1/h5p/play'           // Phase 3
}
```

### H5P Core + Editor Static Assets

The H5P editor requires two sets of static JS/CSS files:
- **H5P Core** (`h5p-core/`): ~20 JS files + CSS (the H5P runtime)
- **H5P Editor** (`h5p-editor/`): ~15 JS files + CSS (the editing UI)

**Options**:
1. **Serve from Go** — add to R2 as `h5p-core/` and `h5p-editor/`, serve via existing asset route
2. **Serve from SvelteKit static** — put in `service-client/static/h5p/`
3. **CDN** — host on Cloudflare CDN

**Recommendation**: Option 2 for dev (simplest), Option 1 for production (R2 CDN). The files are versioned and rarely change.

---

## SvelteKit Frontend

### New Pages

```
service-client/src/routes/(app)/[organisationSlug]/
├── content/
│   ├── +page.server.ts        # List content
│   ├── +page.svelte            # Content list UI
│   ├── new/
│   │   ├── +page.server.ts    # Content type picker
│   │   └── +page.svelte       # "Choose content type" UI
│   ├── [contentId]/
│   │   ├── edit/
│   │   │   ├── +page.server.ts  # Load content for editing
│   │   │   └── +page.svelte     # H5P Editor wrapper
│   │   ├── preview/
│   │   │   ├── +page.server.ts  # Load content for preview
│   │   │   └── +page.svelte     # H5P Player wrapper
│   │   └── +page.server.ts     # Content detail/settings
```

### New Remote Functions

```
service-client/src/lib/api/h5p-content.remote.ts
  - createContent(orgId, libraryName, title)
  - getContent(contentId)
  - updateContent(contentId, title, params)
  - deleteContent(contentId)
  - listContent(filters?)

service-client/src/lib/api/h5p-editor.remote.ts
  - getEditorConfig(contentId?)  → returns H5P editor init config
```

### H5P Editor Svelte Component

```svelte
<!-- H5PEditor.svelte — wraps the H5P editor JS -->
<script lang="ts">
  let { contentId, libraryName, config } = $props();
  let editorContainer: HTMLElement;

  $effect(() => {
    // Initialize H5P editor with config URLs
    // Load H5P core + editor JS
    // Mount editor into container
    // Handle save callback
  });
</script>

<div bind:this={editorContainer} class="h5p-editor-wrapper"></div>
```

---

## Implementation Order

| Step | What | Est. Time | Dependencies |
|------|------|-----------|-------------|
| 1 | Content CRUD SQL queries + sqlc regen | 1 hr | — |
| 2 | Content service methods (Create, Get, Update, Delete, List) | 2 hrs | Step 1 |
| 3 | Temp file upload/serve endpoints | 2 hrs | — |
| 4 | `GET /ajax?action=libraries` (library detail with semantics) | 2 hrs | — |
| 5 | `GET /ajax?action=content-type-cache` (reshape existing) | 1 hr | — |
| 6 | `POST /ajax` dispatcher (libraries, translations, files, filter, install) | 3 hrs | Steps 3-5 |
| 7 | `GET /params/:contentId` (load content for editing) | 1 hr | Step 2 |
| 8 | `GET /content/:contentId/:file` (content file serving) | 1 hr | — |
| 9 | H5P core + editor static assets setup | 2 hrs | — |
| 10 | SvelteKit editor wrapper component | 3 hrs | Steps 4-9 |
| 11 | SvelteKit content list/CRUD pages | 2 hrs | Step 2 |
| 12 | Content save flow (editor → POST ajax → DB + R2) | 3 hrs | Steps 2, 6, 10 |
| 13 | Integration testing (create → edit → save → reload) | 2 hrs | All |
| **Total** | | **~25 hrs (4-5 days)** | |

---

## Deferred to Phase 3

- `POST /ajax?action=filter` — Full semantic validation + XSS sanitisation (MVP: passthrough)
- `POST /ajax?action=get-content` — Download from H5P Content Hub
- `GET /download/:contentId` — Export .h5p package
- Range header support for video streaming (MVP: full file download)
- Content versioning / edit history
- Content locking (concurrent edit prevention)
- Temp file cleanup cron job (MVP: manual or on-save cleanup)
- SVAR file manager integration (folder tree, drag-drop, bulk ops) — port from LEAP's `wx-svelte-filemanager` implementation
- Friendly content slug editing UI

---

## Files to Create/Modify

### New Files

| File | Description | Est. Lines |
|------|-------------|-----------|
| `storage/queries/h5p_content.sql` | Content CRUD queries | ~40 |
| `rest/h5p_editor_route.go` | Editor AJAX handlers | ~350 |
| `domain/h5p/content.go` | Content service methods | ~200 |
| `domain/h5p/temp.go` | Temp file management | ~80 |

### Modified Files

| File | Change |
|------|--------|
| `rest/server.go` | Add 4 new route registrations |
| `domain/h5p/model.go` | Add content + editor response structs |
| `domain/h5p/service.go` | Possibly extend, or keep content methods in new `content.go` |
| `storage/schema_postgres.sql` | No changes needed — tables exist |

### SvelteKit New Files

| File | Description |
|------|-------------|
| `src/lib/api/h5p-content.remote.ts` | Content CRUD remote functions |
| `src/lib/api/h5p-editor.remote.ts` | Editor config remote function |
| `src/lib/components/H5PEditor.svelte` | Editor wrapper component |
| `src/routes/(app)/[organisationSlug]/content/` | Content pages (list, new, edit, preview) |

---

## Key Design Decisions

1. **Single `/ajax` dispatcher** — match Lumi's pattern. One route handles all actions via `?action=` query param. Simplifies H5P editor config (single `ajaxUrl`).

2. **Temp files in R2** — not local filesystem. Enables horizontal scaling. Path: `h5p-temp/{userId}/{tempId}/{filename}`.

3. **Content files in R2** — path: `h5p-content/{orgId}/{contentId}/{filename}`. Org-scoped for multi-tenancy.

4. **MVP filter = passthrough** — full semantic validation is ~2000 lines in Lumi. Defer to Phase 3. For now, trust the editor's client-side validation.

5. **Separate `content.go`** — keep content service methods in own file. `service.go` is already 17KB with library operations.

6. **Auth boundary** — editor AJAX endpoints require authentication (Bearer token). Library file serving remains unauthenticated (needed by H5P player in public-facing contexts).

---

## Resolved Questions

1. **H5P core/editor JS assets** → **Copy from existing LEAP project** at `/Users/benjaminwaller/Projects/H5P-LMS/LEAP/h5p/core` and `h5p/editor`. Commit to `service-client/static/h5p/` for dev. Move to R2 later if needed. These files change infrequently.

2. **Content slug generation** → **Auto-generate from title, don't expose in UI**. For MVP, can even use UUID as slug. Add friendly slug editing later if needed.

3. **Folder structure** → **Defer to Phase 3**. Flat content list sorted by `updated_at` for MVP. The `folder_path` column stays null. Phase 3 will port the SVAR file manager from LEAP (wx-svelte-filemanager v2.2.0 — 815-line component, 9 API endpoints, full folder tree with drag-drop, bulk ops, share links). Reference: `/Users/benjaminwaller/Projects/H5P-LMS/LEAP` file manager integration (completed Aug 2025).

4. **Library language files** → **Confirmed in R2**. The installer uploads ALL files from the zip including `language/*.json` and `semantics.json`. Verified in `service.go` — `extLib.Files` map contains all zip entries, uploaded via `LibraryStorageKey()`.

5. **Image dimension detection** → **Include in MVP**. Go stdlib `image.DecodeConfig()` reads just the header (~10 lines). Supports JPEG, PNG, GIF natively, WebP via `golang.org/x/image/webp`. Without it, editor shows images at wrong aspect ratios.
