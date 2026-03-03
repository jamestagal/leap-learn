-- =============================================================================
-- 010: H5P Content User State (Save/Resume Progress)
-- =============================================================================
-- Stores user state for H5P content activities (quiz answers, video position,
-- slide position, etc.) so learners can resume where they left off.
-- Scope: per-user, per-content (global — not per-enrolment).

CREATE TABLE IF NOT EXISTS h5p_content_user_state (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content_id UUID NOT NULL REFERENCES h5p_content(id) ON DELETE CASCADE,
    sub_content_id TEXT NOT NULL DEFAULT '0',
    data_type TEXT NOT NULL DEFAULT 'state',
    data JSONB NOT NULL,
    preload BOOLEAN NOT NULL DEFAULT true,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, content_id, sub_content_id, data_type)
);

CREATE INDEX IF NOT EXISTS h5p_content_user_state_lookup_idx
    ON h5p_content_user_state(user_id, content_id);
