-- Migration 024: Add progress tracking column to seo_audits.
-- Stores per-section progress as JSONB so the frontend can show real-time status
-- during the ~2 minute audit process instead of a generic spinner.

ALTER TABLE seo_audits ADD COLUMN IF NOT EXISTS progress JSONB DEFAULT '{}';
