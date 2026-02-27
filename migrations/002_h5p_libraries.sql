-- =============================================================================
-- 002_h5p_libraries.sql — H5P library management tables
-- =============================================================================

-- Platform-wide library registry (no org_id — libraries are shared)
CREATE TABLE IF NOT EXISTS h5p_libraries (
    id              UUID PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT current_timestamp,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT current_timestamp,

    -- Identity (composite unique)
    machine_name    VARCHAR(255) NOT NULL,
    major_version   INTEGER NOT NULL,
    minor_version   INTEGER NOT NULL,
    patch_version   INTEGER NOT NULL,
    title           TEXT NOT NULL DEFAULT '',

    -- Provenance
    origin          VARCHAR(20) NOT NULL DEFAULT 'official',

    -- Full library.json stored as JSONB
    metadata_json   JSONB,

    -- Discovery / filtering
    categories      TEXT[],
    keywords        TEXT[],
    screenshots     TEXT[],
    description     TEXT NOT NULL DEFAULT '',
    icon_path       TEXT,

    -- R2 storage paths
    package_path    TEXT,
    extracted_path  TEXT,

    -- Flags
    runnable        BOOLEAN NOT NULL DEFAULT false,
    restricted      BOOLEAN NOT NULL DEFAULT false,

    UNIQUE (machine_name, major_version, minor_version, patch_version),
    CONSTRAINT valid_origin CHECK (origin IN ('official', 'custom'))
);

CREATE INDEX IF NOT EXISTS idx_h5p_libraries_machine_name ON h5p_libraries(machine_name);
CREATE INDEX IF NOT EXISTS idx_h5p_libraries_runnable ON h5p_libraries(runnable) WHERE runnable = true;

-- Normalised dependency graph for recursive CTE resolution
CREATE TABLE IF NOT EXISTS h5p_library_dependencies (
    id              UUID PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
    library_id      UUID NOT NULL REFERENCES h5p_libraries(id) ON DELETE CASCADE,
    depends_on_id   UUID NOT NULL REFERENCES h5p_libraries(id) ON DELETE CASCADE,
    dependency_type VARCHAR(20) NOT NULL,

    UNIQUE (library_id, depends_on_id, dependency_type),
    CONSTRAINT valid_dependency_type CHECK (dependency_type IN ('preloaded', 'dynamic', 'editor'))
);

CREATE INDEX IF NOT EXISTS idx_h5p_lib_deps_library ON h5p_library_dependencies(library_id);
CREATE INDEX IF NOT EXISTS idx_h5p_lib_deps_depends_on ON h5p_library_dependencies(depends_on_id);

-- Per-org library enablement / restriction
CREATE TABLE IF NOT EXISTS h5p_org_libraries (
    id           UUID PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT current_timestamp,
    org_id       UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    library_id   UUID NOT NULL REFERENCES h5p_libraries(id) ON DELETE CASCADE,
    enabled      BOOLEAN NOT NULL DEFAULT true,
    restricted   BOOLEAN NOT NULL DEFAULT false,

    UNIQUE (org_id, library_id)
);

CREATE INDEX IF NOT EXISTS idx_h5p_org_libs_org ON h5p_org_libraries(org_id);
CREATE INDEX IF NOT EXISTS idx_h5p_org_libs_library ON h5p_org_libraries(library_id);
