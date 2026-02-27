-- =============================================================================
-- 006_analytics.sql — Enrolment tracking, progress, xAPI statements
-- =============================================================================

-- Learner enrolments in courses
CREATE TABLE IF NOT EXISTS enrolments (
    id            UUID PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT current_timestamp,
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT current_timestamp,

    org_id        UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    course_id     UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    status        VARCHAR(20) NOT NULL DEFAULT 'active',
    enrolled_at   TIMESTAMPTZ NOT NULL DEFAULT current_timestamp,
    completed_at  TIMESTAMPTZ,

    UNIQUE (course_id, user_id),
    CONSTRAINT valid_enrolment_status CHECK (status IN ('active', 'completed', 'withdrawn'))
);

CREATE INDEX IF NOT EXISTS idx_enrolments_org ON enrolments(org_id);
CREATE INDEX IF NOT EXISTS idx_enrolments_course ON enrolments(course_id);
CREATE INDEX IF NOT EXISTS idx_enrolments_user ON enrolments(user_id);
CREATE INDEX IF NOT EXISTS idx_enrolments_status ON enrolments(org_id, status);

-- Per-content progress tracking
CREATE TABLE IF NOT EXISTS progress_records (
    id            UUID PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT current_timestamp,
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT current_timestamp,

    org_id        UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    enrolment_id  UUID NOT NULL REFERENCES enrolments(id) ON DELETE CASCADE,
    content_id    UUID NOT NULL REFERENCES h5p_content(id) ON DELETE CASCADE,
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    score         NUMERIC(5,2),
    max_score     NUMERIC(5,2),
    completion    NUMERIC(5,4) NOT NULL DEFAULT 0,
    completed     BOOLEAN NOT NULL DEFAULT false,
    attempts      INTEGER NOT NULL DEFAULT 0,
    time_spent    INTEGER NOT NULL DEFAULT 0,   -- seconds

    UNIQUE (enrolment_id, content_id)
);

CREATE INDEX IF NOT EXISTS idx_progress_org ON progress_records(org_id);
CREATE INDEX IF NOT EXISTS idx_progress_enrolment ON progress_records(enrolment_id);
CREATE INDEX IF NOT EXISTS idx_progress_content ON progress_records(content_id);
CREATE INDEX IF NOT EXISTS idx_progress_user ON progress_records(user_id);

-- xAPI statement log (append-only)
-- Future: consider time-based partitioning for large deployments
CREATE TABLE IF NOT EXISTS xapi_statements (
    id            UUID PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT current_timestamp,

    org_id        UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content_id    UUID REFERENCES h5p_content(id) ON DELETE SET NULL,

    verb          VARCHAR(255) NOT NULL,
    statement     JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_xapi_org ON xapi_statements(org_id);
CREATE INDEX IF NOT EXISTS idx_xapi_user ON xapi_statements(user_id);
CREATE INDEX IF NOT EXISTS idx_xapi_content ON xapi_statements(content_id);
CREATE INDEX IF NOT EXISTS idx_xapi_org_created ON xapi_statements(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_xapi_verb ON xapi_statements(verb);
