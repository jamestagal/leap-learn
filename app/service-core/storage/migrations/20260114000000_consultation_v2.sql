-- Migration: Consultation Form v2 - Flat Column Structure
-- This migration converts the consultations table from JSONB columns to flat columns.
--
-- Changes:
-- - Removes: contactInfo, businessContext, painPoints, goalsObjectives JSONB columns
-- - Adds: Individual flat columns for each field
-- - Removes: userId, completionPercentage, completedAt (no longer needed in v2)
-- - Updates: status values remain the same (draft, completed, converted)

-- ================================================
-- STEP 1: Add new v2 columns (if they don't exist)
-- ================================================

-- Step 1: Contact & Business columns
ALTER TABLE consultations ADD COLUMN IF NOT EXISTS business_name TEXT;
ALTER TABLE consultations ADD COLUMN IF NOT EXISTS contact_person TEXT;
ALTER TABLE consultations ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE consultations ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE consultations ADD COLUMN IF NOT EXISTS website TEXT;
ALTER TABLE consultations ADD COLUMN IF NOT EXISTS social_linkedin TEXT;
ALTER TABLE consultations ADD COLUMN IF NOT EXISTS social_facebook TEXT;
ALTER TABLE consultations ADD COLUMN IF NOT EXISTS social_instagram TEXT;
ALTER TABLE consultations ADD COLUMN IF NOT EXISTS industry TEXT;
ALTER TABLE consultations ADD COLUMN IF NOT EXISTS business_type TEXT;

-- Step 2: Situation & Challenges columns
ALTER TABLE consultations ADD COLUMN IF NOT EXISTS website_status TEXT DEFAULT 'none';
ALTER TABLE consultations ADD COLUMN IF NOT EXISTS primary_challenges TEXT[] DEFAULT '{}';
ALTER TABLE consultations ADD COLUMN IF NOT EXISTS urgency_level TEXT DEFAULT 'low';

-- Step 3: Goals & Budget columns
ALTER TABLE consultations ADD COLUMN IF NOT EXISTS primary_goals TEXT[] DEFAULT '{}';
ALTER TABLE consultations ADD COLUMN IF NOT EXISTS conversion_goal TEXT;
ALTER TABLE consultations ADD COLUMN IF NOT EXISTS budget_range TEXT DEFAULT 'tbd';
ALTER TABLE consultations ADD COLUMN IF NOT EXISTS timeline TEXT;

-- Step 4: Preferences & Notes columns
ALTER TABLE consultations ADD COLUMN IF NOT EXISTS design_styles TEXT[];
ALTER TABLE consultations ADD COLUMN IF NOT EXISTS admired_websites TEXT;
ALTER TABLE consultations ADD COLUMN IF NOT EXISTS consultation_notes TEXT;

-- ================================================
-- STEP 2: Migrate data from JSONB to flat columns
-- ================================================

-- Migrate contactInfo JSONB to flat columns
UPDATE consultations
SET
    business_name = COALESCE(contact_info->>'business_name', business_name),
    contact_person = COALESCE(contact_info->>'contact_person', contact_person),
    email = COALESCE(contact_info->>'email', email),
    phone = COALESCE(contact_info->>'phone', phone),
    website = COALESCE(contact_info->>'website', website),
    social_linkedin = COALESCE(contact_info->'social_media'->>'linkedin', social_linkedin),
    social_facebook = COALESCE(contact_info->'social_media'->>'facebook', social_facebook),
    social_instagram = COALESCE(contact_info->'social_media'->>'instagram', social_instagram)
WHERE contact_info IS NOT NULL;

-- Migrate businessContext JSONB to flat columns
UPDATE consultations
SET
    industry = COALESCE(business_context->>'industry', industry),
    business_type = COALESCE(business_context->>'business_type', business_type)
WHERE business_context IS NOT NULL;

-- Migrate painPoints JSONB to flat columns
UPDATE consultations
SET
    primary_challenges = COALESCE(
        (SELECT ARRAY(SELECT jsonb_array_elements_text(pain_points->'primary_challenges'))),
        primary_challenges
    ),
    urgency_level = COALESCE(pain_points->>'urgency_level', urgency_level)
WHERE pain_points IS NOT NULL AND pain_points->'primary_challenges' IS NOT NULL;

-- Migrate goalsObjectives JSONB to flat columns
UPDATE consultations
SET
    primary_goals = COALESCE(
        (SELECT ARRAY(SELECT jsonb_array_elements_text(goals_objectives->'primary_goals'))),
        primary_goals
    ),
    budget_range = COALESCE(goals_objectives->>'budget_range', budget_range)
WHERE goals_objectives IS NOT NULL AND goals_objectives->'primary_goals' IS NOT NULL;

-- ================================================
-- STEP 3: Set defaults and constraints
-- ================================================

-- Make required columns NOT NULL (after data migration)
UPDATE consultations SET email = '' WHERE email IS NULL;
UPDATE consultations SET industry = 'other' WHERE industry IS NULL OR industry = '';
UPDATE consultations SET business_type = 'small-business' WHERE business_type IS NULL OR business_type = '';
UPDATE consultations SET website_status = 'none' WHERE website_status IS NULL;
UPDATE consultations SET urgency_level = 'low' WHERE urgency_level IS NULL;
UPDATE consultations SET budget_range = 'tbd' WHERE budget_range IS NULL;

-- Add NOT NULL constraints to required fields
ALTER TABLE consultations ALTER COLUMN email SET NOT NULL;
ALTER TABLE consultations ALTER COLUMN industry SET NOT NULL;
ALTER TABLE consultations ALTER COLUMN business_type SET NOT NULL;
ALTER TABLE consultations ALTER COLUMN website_status SET NOT NULL;
ALTER TABLE consultations ALTER COLUMN urgency_level SET NOT NULL;
ALTER TABLE consultations ALTER COLUMN budget_range SET NOT NULL;

-- Make user_id nullable (v2 doesn't use it)
ALTER TABLE consultations ALTER COLUMN user_id DROP NOT NULL;

-- Set defaults for array columns
ALTER TABLE consultations ALTER COLUMN primary_challenges SET DEFAULT '{}';
ALTER TABLE consultations ALTER COLUMN primary_goals SET DEFAULT '{}';

-- ================================================
-- STEP 4: Add check constraints for valid values
-- ================================================

-- Add check constraints for enum-like values (optional, for data integrity)
-- Note: These may need to be adjusted based on existing data
-- ALTER TABLE consultations ADD CONSTRAINT chk_website_status
--     CHECK (website_status IN ('none', 'refresh', 'rebuild'));
-- ALTER TABLE consultations ADD CONSTRAINT chk_urgency_level
--     CHECK (urgency_level IN ('low', 'medium', 'high', 'critical'));
-- ALTER TABLE consultations ADD CONSTRAINT chk_timeline
--     CHECK (timeline IS NULL OR timeline IN ('asap', '1-3-months', '3-6-months', 'flexible'));

-- ================================================
-- STEP 5: Drop old JSONB columns (OPTIONAL - run manually after verifying data)
-- ================================================
-- WARNING: Only run these after verifying the data migration was successful!
--
-- ALTER TABLE consultations DROP COLUMN IF EXISTS contact_info;
-- ALTER TABLE consultations DROP COLUMN IF EXISTS business_context;
-- ALTER TABLE consultations DROP COLUMN IF EXISTS pain_points;
-- ALTER TABLE consultations DROP COLUMN IF EXISTS goals_objectives;
-- ALTER TABLE consultations DROP COLUMN IF EXISTS user_id;
-- ALTER TABLE consultations DROP COLUMN IF EXISTS completion_percentage;
-- ALTER TABLE consultations DROP COLUMN IF EXISTS completed_at;

-- ================================================
-- VERIFICATION QUERY
-- ================================================
-- Run this to verify the migration:
-- SELECT id, email, industry, business_type, website_status, urgency_level, budget_range FROM consultations LIMIT 5;
