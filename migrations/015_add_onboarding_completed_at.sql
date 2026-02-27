-- Add onboarding completion tracking to agency profiles
ALTER TABLE organisation_profiles ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

-- Backfill: mark all existing agency profiles as onboarding-complete
-- so the wizard only triggers for newly created organisations
UPDATE organisation_profiles SET onboarding_completed_at = NOW() WHERE onboarding_completed_at IS NULL;
