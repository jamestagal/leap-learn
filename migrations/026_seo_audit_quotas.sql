-- 026: Add SEO audit quota tracking columns to organisations
-- Tracks monthly SEO audit usage for tier-based quota enforcement
-- Re-audit tracking uses existing seo_audits table (organisation_id + client_id + created_at)

ALTER TABLE organisations ADD COLUMN IF NOT EXISTS seo_audits_this_month INTEGER NOT NULL DEFAULT 0;
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS seo_audits_reset_at TIMESTAMPTZ;
