-- Add website column to clients table for auto-populating crawl URLs
ALTER TABLE clients ADD COLUMN IF NOT EXISTS website TEXT NOT NULL DEFAULT '';
