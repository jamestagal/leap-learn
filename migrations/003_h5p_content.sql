-- =============================================================================
-- 003_h5p_content.sql — H5P content and virtual folders
-- =============================================================================

-- Organisation-scoped H5P content items
CREATE TABLE IF NOT EXISTS h5p_content (
    id            UUID PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT current_timestamp,
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT current_timestamp,

    org_id        UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    library_id    UUID NOT NULL REFERENCES h5p_libraries(id),
    created_by    UUID REFERENCES users(id) ON DELETE SET NULL,

    -- Identity
    title         TEXT NOT NULL,
    slug          TEXT NOT NULL,
    description   TEXT NOT NULL DEFAULT '',

    -- Content payload (retrieve by ID only — never query into)
    content_json  JSONB NOT NULL DEFAULT '{}',

    -- Discovery
    tags          TEXT[],

    -- Virtual folder path (denormalised for fast listing)
    folder_path   TEXT,

    -- R2 storage location
    storage_path  TEXT,

    -- Status
    status        VARCHAR(20) NOT NULL DEFAULT 'draft',
    deleted_at    TIMESTAMPTZ,

    UNIQUE (org_id, slug),
    CONSTRAINT valid_content_status CHECK (status IN ('draft', 'published', 'archived'))
);

CREATE INDEX IF NOT EXISTS idx_h5p_content_org ON h5p_content(org_id);
CREATE INDEX IF NOT EXISTS idx_h5p_content_library ON h5p_content(library_id);
CREATE INDEX IF NOT EXISTS idx_h5p_content_status ON h5p_content(org_id, status);
CREATE INDEX IF NOT EXISTS idx_h5p_content_folder ON h5p_content(org_id, folder_path);
CREATE INDEX IF NOT EXISTS idx_h5p_content_deleted ON h5p_content(deleted_at) WHERE deleted_at IS NOT NULL;
-- GIN index for array-contains queries on tags
CREATE INDEX IF NOT EXISTS idx_h5p_content_tags ON h5p_content USING GIN (tags);

-- Virtual folder tree for organising content
CREATE TABLE IF NOT EXISTS h5p_content_folders (
    id         UUID PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT current_timestamp,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT current_timestamp,

    org_id     UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    parent_id  UUID REFERENCES h5p_content_folders(id) ON DELETE SET NULL,
    name       TEXT NOT NULL,

    UNIQUE (org_id, parent_id, name)
);

CREATE INDEX IF NOT EXISTS idx_h5p_folders_org ON h5p_content_folders(org_id);
CREATE INDEX IF NOT EXISTS idx_h5p_folders_parent ON h5p_content_folders(parent_id);
