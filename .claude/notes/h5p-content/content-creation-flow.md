# H5P Content Creation Flow

## What the User Sees

1. Navigate to `/{orgSlug}/content/new`
2. The H5P Editor loads — standard H5P editor UI (built by H5P team, loaded via ~50 JS/CSS files)
3. User picks a content type (e.g. "Multiple Choice") from the hub browser
4. User fills in questions, answers, feedback, settings
5. Media uploads (images/audio/video) go to R2 temp storage immediately: `h5p-temp/{userId}/{tempId}/{filename}`
6. User clicks **Save**

## Save Flow

```
Browser (H5PEditor.svelte)
  → intercepts form submit, extracts: library, params JSON, title
  → calls saveContentFromEditor() remote function

SvelteKit remote function (h5p-content.remote.ts)
  → POST /api/v1/h5p/content/{contentId}/save
  → sends: orgId, library name, parsed params, title

Go handler (h5p_editor_route.go)
  → resolves library, calls SaveContentFromEditor()

Go domain (content.go)
  1. Look up library by machine name
  2. migrateTempFiles() — moves media from h5p-temp/ → h5p-content/{orgId}/{contentId}/
  3. Rewrite file paths in params JSON
  4. INSERT or UPDATE h5p_content row (create vs update)
  5. Async cleanup of temp files (best-effort)
```

## What Gets Stored Where

| What | Where | Example |
|------|-------|---------|
| Quiz config (questions, answers, settings) | **PostgreSQL** `h5p_content.content_json` (JSONB) | `{"question":"What is 2+2?","answers":[...]}` |
| Media files (images, audio, video) | **R2** `h5p-content/{orgId}/{contentId}/` | `h5p-content/abc123/def456/tmpId_photo.jpg` |
| Content metadata | **PostgreSQL** `h5p_content` row | title, slug, status, library_id, created_by |

## Text-Only vs Media Content

- **Text-only** (e.g. Multiple Choice with no images): everything lives in PostgreSQL `content_json`. Nothing in R2.
- **With media**: image/audio/video files live in R2, `content_json` references them by filename.

## Create vs Edit Mode

- **Create**: generates new UUID client-side, no contentParams loaded, H5P editor starts empty
- **Edit**: uses existing UUID, loads `EditorContentParams` from `/editor/params/{contentId}`, H5P editor pre-populated

Both use the same `H5PEditor.svelte` component and the same save endpoint. Save does upsert logic (INSERT if new, UPDATE if exists).

## Key Files

### Frontend
- `service-client/src/routes/(app)/[organisationSlug]/content/new/+page.svelte` — Create page
- `service-client/src/routes/(app)/[organisationSlug]/content/[contentId]/edit/+page.svelte` — Edit page
- `service-client/src/lib/components/h5p/H5PEditor.svelte` — Editor component
- `service-client/src/lib/api/h5p-content.remote.ts` — Remote functions (save, list, get, delete)

### Backend
- `app/service-core/rest/h5p_editor_route.go` — Editor AJAX endpoints + content save handler
- `app/service-core/domain/h5p/content.go` — Content save logic + temp file migration
- `app/service-core/domain/h5p/temp.go` — Temp file upload/download during editing

## Editor AJAX Endpoints

All at `POST /api/v1/h5p/editor/ajax?action={action}`:

| Action | Purpose |
|--------|---------|
| `content-type-cache` | List installed content types (hub browser) |
| `libraries` | Get multiple library details |
| `translations` | Get library translations |
| `files` | Upload temp file (multipart) |
| `filter` | Echo libraryParameters |
| `library-install` | Install library from Hub |
| `content-hub-metadata-cache` | License and metadata options |

## Temp File Lifecycle

1. Editor uploads file → `POST /api/v1/h5p/editor/ajax?action=files`
2. Stored at `h5p-temp/{userId}/{tempId}/{filename}` in R2
3. Path returned to editor with `#tmp` suffix
4. On save, `migrateTempFiles()` scans params for `#tmp` references
5. Each temp file: download from `h5p-temp/...` → upload to `h5p-content/{orgId}/{contentId}/{tempId}_{filename}`
6. Params rewritten: full path replaced with just filename
7. Async goroutine deletes temp originals (best-effort)

## R2 File Deletion — Known Gaps

| Scenario | R2 cleanup? | Details |
|----------|-------------|---------|
| Save content (temp → permanent) | Yes | `cleanupTempFiles()` removes `h5p-temp/` originals |
| Delete entire content | No | Soft-deletes DB only. R2 files orphaned. |
| Remove image from quiz, re-save | No | Old file stays in R2. No orphan detection. |
| Delete library | Partial | Removes `.h5p` package only, not extracted files |

See: `r2-file-deletion-gaps.md` for full analysis and fix approaches.
See: `r2-asset-library-proposal.md` for the org-level asset library proposal that solves these gaps properly.
