-- 009_course_sections.sql
-- Add course sections (grouping) and estimated duration on items.

-- Course Sections — optional grouping within a course
CREATE TABLE IF NOT EXISTS course_sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS course_sections_course_idx ON course_sections(course_id);
CREATE INDEX IF NOT EXISTS course_sections_sort_idx ON course_sections(course_id, sort_order);

-- Add section_id to course_items (nullable — ungrouped items have NULL)
ALTER TABLE course_items ADD COLUMN IF NOT EXISTS section_id UUID REFERENCES course_sections(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS course_items_section_idx ON course_items(section_id);

-- Add estimated_duration_minutes to course_items (nullable — not set = NULL)
ALTER TABLE course_items ADD COLUMN IF NOT EXISTS estimated_duration_minutes INTEGER;
