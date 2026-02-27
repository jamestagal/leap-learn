-- Fix consultations.user_id CASCADE -> SET NULL
-- Prevents silent destruction of consultation records when a user is deleted.
-- Consultations are business records that should outlive user accounts.

ALTER TABLE consultations DROP CONSTRAINT IF EXISTS consultations_user_id_users_id_fk;
ALTER TABLE consultations DROP CONSTRAINT IF EXISTS consultations_user_id_fkey;
ALTER TABLE consultations ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE consultations ADD CONSTRAINT consultations_user_id_users_id_fk
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
