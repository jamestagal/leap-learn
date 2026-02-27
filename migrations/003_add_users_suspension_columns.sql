-- Migration: 003_add_users_suspension_columns
-- Description: Add suspension columns to users table for super-admin account management
-- Date: 2024-01-20
-- Idempotent: Yes (uses IF NOT EXISTS)

-- Suspension tracking columns
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_reason TEXT;

-- Index for finding suspended users
CREATE INDEX IF NOT EXISTS idx_users_suspended ON users(suspended) WHERE suspended = TRUE;
