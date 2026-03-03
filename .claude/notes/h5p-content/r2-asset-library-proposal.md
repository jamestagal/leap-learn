# Proposal: Organisation Asset Library

## Problem

Currently, media files are tied to individual H5P content items. This creates three problems:

1. **Orphaned files** — removing an image from content leaves the file in R2 forever
2. **No reuse** — same image uploaded to 5 quizzes = 5 copies in R2
3. **No visibility** — orgs can't see what files they have or how much storage they're using

## Concept

An org-level asset library where users upload, browse, and manage media files. H5P content references assets rather than owning copies.

## How It Would Work

### Upload Flow (New)
1. User uploads image in H5P editor → goes to asset library (not temp storage)
2. Asset record created in DB with org scope
3. File stored at `h5p-assets/{orgId}/{assetId}/{filename}` in R2
4. H5P content params reference the asset path
5. Same asset reusable across multiple content items

### Upload Flow (Backward Compatible)
1. Keep existing temp upload flow for H5P editor compatibility
2. On content save, `migrateTempFiles()` creates asset records instead of dumping files into content folder
3. Content params rewritten to reference asset paths
4. Transparent to the H5P editor JS — it doesn't need to know about the asset library

### Deletion Flow
- **Delete asset from library**: check if any content references it → warn with list of linked content → remove from R2
- **Delete content**: just remove DB row + `h5p_content_assets` rows. Assets stay in library for reuse.
- **Remove image from content**: just remove the reference. Asset stays in library.

### Asset Usage Tracking

Every asset shows where it's used. This is powered by the `h5p_content_assets` junction table.

**Per-asset indicators:**
- **Usage badge**: "Used in 3 items" / "Unused" label on each asset card
- **Linked content list**: expandable panel or tooltip showing content titles that reference the asset
- **Status color**: green = in use, grey = unused, red = referenced by deleted (soft-deleted) content only

**Filtering:**
- Filter by: "In use" / "Unused" / "All"
- "Unused" filter helps org admins find assets safe to delete and reclaim storage

**Deletion safety:**
- Deleting an asset with active references shows a confirmation modal listing each linked content item by title
- E.g. "This image is used in **Maths Quiz 1** and **Onboarding Module**. Removing it will break these items."
- Option to remove from content first, then delete asset — or force delete with acknowledgment

### Browse/Manage UI
- Asset library page at `/{orgSlug}/assets` (or within content settings)
- Grid view of images/videos/audio with thumbnails
- Each card shows: thumbnail, filename, type icon, file size, usage badge
- Click asset → detail panel with full metadata, preview, linked content list
- Bulk delete (with usage warnings), search by filename, filter by type/usage
- Storage usage dashboard per org (ties into subscription tier limits)

## Proposed Schema

```sql
CREATE TABLE IF NOT EXISTS h5p_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    org_id UUID NOT NULL REFERENCES organisations(id),
    uploaded_by UUID NOT NULL REFERENCES users(id),
    filename TEXT NOT NULL,           -- original filename
    storage_key TEXT NOT NULL,        -- R2 path: h5p-assets/{orgId}/{assetId}/{filename}
    mime_type TEXT NOT NULL,
    file_size BIGINT NOT NULL,        -- bytes
    width INTEGER,                    -- image/video dimensions (nullable)
    height INTEGER,
    alt_text TEXT DEFAULT '',
    tags TEXT[],
    deleted_at TIMESTAMPTZ            -- soft delete
);

CREATE INDEX IF NOT EXISTS idx_h5p_assets_org ON h5p_assets(org_id) WHERE deleted_at IS NULL;

-- Junction table: which content uses which assets
CREATE TABLE IF NOT EXISTS h5p_content_assets (
    content_id UUID NOT NULL REFERENCES h5p_content(id),
    asset_id UUID NOT NULL REFERENCES h5p_assets(id),
    PRIMARY KEY (content_id, asset_id)
);
```

## R2 Path Convention

```
h5p-assets/{orgId}/{assetId}/{filename}
```

Single copy per asset. Multiple content items reference the same path.

## Subscription Tier Integration

| Tier | Storage Limit | Asset Count |
|------|--------------|-------------|
| Free | 100 MB | 50 |
| Starter | 1 GB | 500 |
| Growth | 10 GB | 5,000 |
| Enterprise | Custom | Unlimited |

Enforce via `enforceOrganisationLimits()` on upload.

## H5P Editor Integration Options

### Option A: Custom File Picker (More Work, Better UX)
- Replace H5P's default file upload widget with custom asset browser
- Users pick from existing assets or upload new ones
- Requires patching H5P editor JS or using editor override hooks

### Option B: Transparent Backend (Less Work, Good Enough)
- Keep H5P editor's native file upload unchanged
- Backend intercepts uploads, creates asset records transparently
- On save, map temp files → assets (dedup by hash if same file uploaded again)
- H5P editor never knows about the asset library

**Recommendation**: Start with Option B. It's backward compatible, requires no H5P editor changes, and solves the orphan/reuse problems. Add Option A later as a UX enhancement.

## Implementation Phases

### Phase A: Backend Asset Tracking
- Add `h5p_assets` and `h5p_content_assets` tables
- Modify `migrateTempFiles()` to create asset records
- Modify `SaveContentFromEditor()` to populate junction table
- Deduplicate by file hash (optional, prevents duplicate uploads)

### Phase B: Content Deletion Cleanup
- `DeleteContent()` removes `h5p_content_assets` rows (cascade)
- Assets with zero references flagged but NOT auto-deleted (user may want them)
- Add "unreferenced assets" view for org admins

### Phase C: Asset Library UI
- Browse/search assets page
- Usage count per asset
- Bulk delete with confirmation
- Storage usage dashboard

### Phase D: Enhanced Upload (Optional)
- Custom file picker in H5P editor
- Pick from existing assets
- Drag-and-drop upload to asset library directly

## Benefits

- **No more orphaned files** — assets have explicit lifecycle
- **Storage savings** — deduplicated across content items
- **User visibility** — orgs can see and manage their media
- **Tier enforcement** — storage limits per subscription
- **Foundation for** — content templates, shared media libraries, org-level branding assets
