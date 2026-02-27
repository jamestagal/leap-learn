-- Drop legacy JSONB columns from consultation tables.
-- These were used by the Go backend (now removed). SvelteKit uses flat columns.

-- Drop from consultations table
ALTER TABLE consultations DROP COLUMN IF EXISTS contact_info;
ALTER TABLE consultations DROP COLUMN IF EXISTS business_context;
ALTER TABLE consultations DROP COLUMN IF EXISTS pain_points;
ALTER TABLE consultations DROP COLUMN IF EXISTS goals_objectives;

-- Drop from consultation_drafts table
ALTER TABLE consultation_drafts DROP COLUMN IF EXISTS contact_info;
ALTER TABLE consultation_drafts DROP COLUMN IF EXISTS business_context;
ALTER TABLE consultation_drafts DROP COLUMN IF EXISTS pain_points;
ALTER TABLE consultation_drafts DROP COLUMN IF EXISTS goals_objectives;

-- Drop from consultation_versions table
ALTER TABLE consultation_versions DROP COLUMN IF EXISTS contact_info;
ALTER TABLE consultation_versions DROP COLUMN IF EXISTS business_context;
ALTER TABLE consultation_versions DROP COLUMN IF EXISTS pain_points;
ALTER TABLE consultation_versions DROP COLUMN IF EXISTS goals_objectives;

-- Drop JSONB indexes (auto-drop with columns, but explicit for clarity)
DROP INDEX IF EXISTS idx_consultations_contact_business_name;
DROP INDEX IF EXISTS idx_consultations_business_industry;
DROP INDEX IF EXISTS idx_consultations_urgency;
