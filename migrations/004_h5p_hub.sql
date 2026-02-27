-- =============================================================================
-- 004_h5p_hub.sql — H5P Hub integration tables
-- =============================================================================

-- Per-org Hub API registration
CREATE TABLE IF NOT EXISTS h5p_hub_registrations (
    id           UUID PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT current_timestamp,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT current_timestamp,

    org_id       UUID NOT NULL UNIQUE REFERENCES organisations(id) ON DELETE CASCADE,

    site_key     TEXT NOT NULL DEFAULT '',
    site_secret  TEXT NOT NULL DEFAULT '',
    hub_url      TEXT NOT NULL DEFAULT 'https://api.h5p.org'
);

CREATE INDEX IF NOT EXISTS idx_h5p_hub_reg_org ON h5p_hub_registrations(org_id);

-- Cached Hub content-type responses (TTL-based)
CREATE TABLE IF NOT EXISTS h5p_hub_cache (
    id          UUID PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT current_timestamp,

    cache_key   TEXT NOT NULL UNIQUE,
    data        JSONB NOT NULL DEFAULT '{}',
    expires_at  TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_h5p_hub_cache_key ON h5p_hub_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_h5p_hub_cache_expires ON h5p_hub_cache(expires_at);
