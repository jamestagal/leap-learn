-- Migration 028: Rename agency → organisation across all remaining tables
-- All idempotent

-- Core table renames
ALTER TABLE IF EXISTS organisations RENAME TO organisations;
ALTER TABLE IF EXISTS organisation_memberships RENAME TO organisation_memberships;
ALTER TABLE IF EXISTS organisation_form_options RENAME TO organisation_form_options;
ALTER TABLE IF EXISTS organisation_activity_log RENAME TO organisation_activity_log;
ALTER TABLE IF EXISTS organisation_profiles RENAME TO organisation_profiles;
ALTER TABLE IF EXISTS organisation_packages RENAME TO organisation_packages;
ALTER TABLE IF EXISTS organisation_addons RENAME TO organisation_addons;
ALTER TABLE IF EXISTS organisation_forms RENAME TO organisation_forms;
ALTER TABLE IF EXISTS organisation_stripe_accounts RENAME TO organisation_stripe_accounts;
ALTER TABLE IF EXISTS organisation_custom_fields RENAME TO organisation_custom_fields;
ALTER TABLE IF EXISTS organisation_email_templates RENAME TO organisation_email_templates;

-- Column renames on renamed tables
DO $$ BEGIN
  ALTER TABLE organisations RENAME COLUMN organisation_id TO organisation_id;
EXCEPTION WHEN undefined_column THEN NULL;
END $$;

-- organisation_memberships
DO $$ BEGIN
  ALTER TABLE organisation_memberships RENAME COLUMN organisation_id TO organisation_id;
EXCEPTION WHEN undefined_column THEN NULL;
END $$;

-- organisation_form_options
DO $$ BEGIN
  ALTER TABLE organisation_form_options RENAME COLUMN organisation_id TO organisation_id;
EXCEPTION WHEN undefined_column THEN NULL;
END $$;

-- organisation_activity_log
DO $$ BEGIN
  ALTER TABLE organisation_activity_log RENAME COLUMN organisation_id TO organisation_id;
EXCEPTION WHEN undefined_column THEN NULL;
END $$;

-- organisation_profiles
DO $$ BEGIN
  ALTER TABLE organisation_profiles RENAME COLUMN organisation_id TO organisation_id;
EXCEPTION WHEN undefined_column THEN NULL;
END $$;

-- organisation_packages
DO $$ BEGIN
  ALTER TABLE organisation_packages RENAME COLUMN organisation_id TO organisation_id;
EXCEPTION WHEN undefined_column THEN NULL;
END $$;

-- organisation_addons
DO $$ BEGIN
  ALTER TABLE organisation_addons RENAME COLUMN organisation_id TO organisation_id;
EXCEPTION WHEN undefined_column THEN NULL;
END $$;

-- organisation_forms
DO $$ BEGIN
  ALTER TABLE organisation_forms RENAME COLUMN organisation_id TO organisation_id;
EXCEPTION WHEN undefined_column THEN NULL;
END $$;

-- users table
DO $$ BEGIN
  ALTER TABLE users RENAME COLUMN default_organisation_id TO default_organisation_id;
EXCEPTION WHEN undefined_column THEN NULL;
END $$;

-- beta_invites table
DO $$ BEGIN
  ALTER TABLE beta_invites RENAME COLUMN used_by_organisation_id TO used_by_organisation_id;
EXCEPTION WHEN undefined_column THEN NULL;
END $$;

-- clients table
DO $$ BEGIN
  ALTER TABLE clients RENAME COLUMN organisation_id TO organisation_id;
EXCEPTION WHEN undefined_column THEN NULL;
END $$;

-- form_submissions table
DO $$ BEGIN
  ALTER TABLE form_submissions RENAME COLUMN organisation_id TO organisation_id;
EXCEPTION WHEN undefined_column THEN NULL;
END $$;

-- field_option_sets table
DO $$ BEGIN
  ALTER TABLE field_option_sets RENAME COLUMN organisation_id TO organisation_id;
EXCEPTION WHEN undefined_column THEN NULL;
END $$;

-- stripe_accounts (if exists)
DO $$ BEGIN
  ALTER TABLE organisation_stripe_accounts RENAME COLUMN organisation_id TO organisation_id;
EXCEPTION WHEN undefined_column OR undefined_table THEN NULL;
END $$;
