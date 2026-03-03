# R2 File Deletion Gaps

## Current State

The R2 `file.Provider` has a working `Remove()` method, but it's only called for temp file cleanup after content save. Two significant gaps exist.

## Gap 1: Content Deletion Doesn't Remove R2 Files

**Location**: `app/service-core/domain/h5p/content.go:151-156`

`DeleteContent()` only soft-deletes the DB row via `SoftDeleteH5PContent`. Files at `h5p-content/{orgId}/{contentId}/` are never removed from R2.

**Impact**: Every deleted content item leaves orphaned files in R2 indefinitely.

**Fix approach**:
- On delete, call `fileProvider.ListByPrefix("h5p-content/{orgId}/{contentId}/")` to find all files
- Call `fileProvider.Remove()` for each
- Run async (like temp cleanup) since it's best-effort
- Consider: soft-delete means content could be restored — maybe defer R2 cleanup to a hard-delete or scheduled purge of old soft-deleted items

## Gap 2: Orphaned Files on Content Re-Save

**Location**: `app/service-core/domain/h5p/content.go` — `SaveContentFromEditor()`

When a user edits content and removes an image (but keeps the content), the old file stays in R2. `SaveContentFromEditor` doesn't compare old vs new params to detect files that are no longer referenced.

**Impact**: Every time a user replaces or removes media from content, the old files are orphaned.

**Fix approach (without asset library)**:
- Before saving updated params, load current `content_json` from DB
- Extract file references from old params (scan for filenames matching content storage path)
- Extract file references from new params
- Diff: files in old but not in new = orphaned
- Delete orphaned files from R2 (async, best-effort)

**Fix approach (with asset library — preferred)**:
- Files belong to the org's asset library, not to individual content
- Content references assets by ID/path
- No orphans on content edit — asset still exists in library
- Explicit deletion from asset library triggers R2 removal
- See: `r2-asset-library-proposal.md`

## Gap 3: Library Deletion (Minor)

**Location**: `app/service-core/domain/h5p/service.go:608-630`

`DeleteLibrary()` only removes the `.h5p` package file. Extracted files at `h5p-libraries/extracted/{name}-{version}/` are left behind.

**Impact**: Low priority — libraries are rarely deleted and the extracted files are shared/reusable. But technically leaks storage.

**Fix**: Use `ListByPrefix("h5p-libraries/extracted/{name}-{version}/")` + batch delete.

## Priority

1. **Asset library** (future feature) — solves Gap 2 properly and adds user value
2. **Gap 1** (content deletion cleanup) — straightforward, should be done soon
3. **Gap 3** (library deletion cleanup) — low priority
