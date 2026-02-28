-- Migration 007: Update H5P Hub URL from api.h5p.org to hub-api.h5p.org
-- H5P announced migration to new hub endpoint (February 2026).
-- Old hub (api.h5p.org) will no longer receive content type updates.

-- Update default for new rows
ALTER TABLE h5p_hub_registrations
    ALTER COLUMN hub_url SET DEFAULT 'https://hub-api.h5p.org';

-- Update existing rows still pointing to the old hub
UPDATE h5p_hub_registrations
    SET hub_url = 'https://hub-api.h5p.org'
    WHERE hub_url = 'https://api.h5p.org';

-- Clear cached hub data so it re-fetches from the new endpoint
DELETE FROM h5p_hub_cache WHERE cache_key = 'content-type-cache';
