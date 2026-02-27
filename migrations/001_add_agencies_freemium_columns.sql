-- Migration: 001_add_organisations_freemium_columns
-- Description: Add freemium access columns to organisations table for beta/partner programs
-- Date: 2024-01-20
-- Idempotent: Yes (uses IF NOT EXISTS)

-- Freemium tracking columns
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS is_freemium BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS freemium_reason VARCHAR(50);
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS freemium_expires_at TIMESTAMPTZ;
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS freemium_granted_at TIMESTAMPTZ;
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS freemium_granted_by VARCHAR(255);

-- Index for efficient freemium queries
CREATE INDEX IF NOT EXISTS idx_organisations_freemium ON organisations(is_freemium) WHERE is_freemium = TRUE;
