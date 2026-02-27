-- Migration: Add stripe_customer_id to organisations for platform billing
-- This column stores the Stripe Customer ID for organisations subscribing to WebKit tiers

-- Add stripe_customer_id column to organisations table
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT DEFAULT '';

-- Create index for efficient lookup by Stripe customer ID (used in webhook handlers)
CREATE INDEX IF NOT EXISTS idx_organisations_stripe_customer ON organisations(stripe_customer_id) WHERE stripe_customer_id != '';
