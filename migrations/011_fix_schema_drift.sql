-- Migration 011: Fix schema drift between Drizzle and actual database
-- Addresses type mismatches, missing NOT NULL constraints, and missing constraints

-- 1. Fix organisation_activity_log.ip_address type from inet to text
ALTER TABLE organisation_activity_log ALTER COLUMN ip_address TYPE text;

-- 2. Clean up NULL organisation_id rows in consultations, then set NOT NULL
DELETE FROM consultations WHERE organisation_id IS NULL;
ALTER TABLE consultations ALTER COLUMN organisation_id SET NOT NULL;

-- 3. Update consultations status CHECK to include 'converted'
ALTER TABLE consultations DROP CONSTRAINT IF EXISTS valid_status;
ALTER TABLE consultations ADD CONSTRAINT valid_status CHECK (status IN ('draft', 'completed', 'archived', 'converted'));

-- 4. Add unique constraint on clients (organisation_id, email) if not exists
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'clients_organisation_email_unique'
    ) THEN
        ALTER TABLE clients ADD CONSTRAINT clients_organisation_email_unique UNIQUE (organisation_id, email);
    END IF;
END $$;
