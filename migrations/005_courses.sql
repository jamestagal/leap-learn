-- =============================================================================
-- 005_courses.sql — Course structure tables
-- =============================================================================

-- Courses (org-scoped containers of learning content)
CREATE TABLE IF NOT EXISTS courses (
    id            UUID PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT current_timestamp,
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT current_timestamp,

    org_id        UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    created_by    UUID REFERENCES users(id) ON DELETE SET NULL,

    title         TEXT NOT NULL,
    slug          TEXT NOT NULL,
    description   TEXT NOT NULL DEFAULT '',
    cover_image   TEXT,

    status        VARCHAR(20) NOT NULL DEFAULT 'draft',
    deleted_at    TIMESTAMPTZ,

    UNIQUE (org_id, slug),
    CONSTRAINT valid_course_status CHECK (status IN ('draft', 'published', 'archived'))
);

CREATE INDEX IF NOT EXISTS idx_courses_org ON courses(org_id);
CREATE INDEX IF NOT EXISTS idx_courses_status ON courses(org_id, status);
CREATE INDEX IF NOT EXISTS idx_courses_deleted ON courses(deleted_at) WHERE deleted_at IS NOT NULL;

-- Ordered items within a course (H5P content references)
CREATE TABLE IF NOT EXISTS course_items (
    id            UUID PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT current_timestamp,
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT current_timestamp,

    course_id     UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    content_id    UUID REFERENCES h5p_content(id) ON DELETE SET NULL,

    sort_order    INTEGER NOT NULL DEFAULT 0,
    title         TEXT NOT NULL DEFAULT '',
    item_type     VARCHAR(20) NOT NULL DEFAULT 'h5p',

    CONSTRAINT valid_item_type CHECK (item_type IN ('h5p', 'text', 'video', 'link'))
);

CREATE INDEX IF NOT EXISTS idx_course_items_course ON course_items(course_id);
CREATE INDEX IF NOT EXISTS idx_course_items_content ON course_items(content_id);
CREATE INDEX IF NOT EXISTS idx_course_items_sort ON course_items(course_id, sort_order);
