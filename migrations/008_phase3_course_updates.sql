-- =============================================================================
-- Migration 008: Phase 3 — Course Updates
-- Adds soft-delete, markdown body for course items; published/archived timestamps for courses
-- =============================================================================

-- Soft delete for course items (keeps progress history)
ALTER TABLE course_items ADD COLUMN IF NOT EXISTS removed_at TIMESTAMPTZ;

-- Markdown body for text course items
ALTER TABLE course_items ADD COLUMN IF NOT EXISTS body_markdown TEXT;

-- Published/archived timestamps for courses
ALTER TABLE courses ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
