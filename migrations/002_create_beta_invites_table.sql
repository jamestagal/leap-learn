-- Migration: 002_create_beta_invites_table
-- Description: Create beta_invites table for managing beta tester invitations
-- Date: 2024-01-20
-- Idempotent: Yes (uses IF NOT EXISTS)

-- Beta invites table
CREATE TABLE IF NOT EXISTS beta_invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Invite details
    email VARCHAR(255) NOT NULL,
    token VARCHAR(100) NOT NULL UNIQUE,

    -- Status: pending, used, expired, revoked
    status VARCHAR(20) NOT NULL DEFAULT 'pending',

    -- Tracking
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    used_at TIMESTAMPTZ,
    used_by_organisation_id UUID REFERENCES organisations(id) ON DELETE SET NULL,

    -- Expiry and notes
    expires_at TIMESTAMPTZ NOT NULL,
    notes TEXT
);

-- Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_beta_invites_email ON beta_invites(email);
CREATE INDEX IF NOT EXISTS idx_beta_invites_token ON beta_invites(token);
CREATE INDEX IF NOT EXISTS idx_beta_invites_status ON beta_invites(status);
