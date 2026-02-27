-- create "tokens" table
CREATE TABLE IF NOT EXISTS tokens (
    id TEXT PRIMARY KEY NOT NULL,
    expires DATETIME NOT NULL,
    target TEXT NOT NULL,
    callback TEXT NOT NULL DEFAULT ''
);

-- create "users" table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY NOT NULL,
    created DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    email TEXT NOT NULL,
    phone TEXT NOT NULL DEFAULT '',
    access INTEGER NOT NULL,
    sub TEXT NOT NULL,
    avatar TEXT NOT NULL DEFAULT '',
    customer_id TEXT NOT NULL DEFAULT '',
    subscription_id TEXT NOT NULL DEFAULT '',
    subscription_end DATETIME NOT NULL DEFAULT '2000-01-01 00:00:00',
    api_key TEXT NOT NULL DEFAULT '',
    UNIQUE (email, sub)
);

-- create "files" table
CREATE TABLE IF NOT EXISTS files (
    id UUID PRIMARY KEY NOT NULL,
    created DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    user_id UUID NOT NULL,
    file_key TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    content_type TEXT NOT NULL
);

-- create "emails" table
CREATE TABLE IF NOT EXISTS emails (
    id UUID PRIMARY KEY NOT NULL,
    created DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    user_id UUID NOT NULL,
    email_to TEXT NOT NULL,
    email_from TEXT NOT NULL,
    email_subject TEXT NOT NULL,
    email_body TEXT NOT NULL
);

-- create "email_attachments" table
CREATE TABLE IF NOT EXISTS email_attachments (
    id UUID PRIMARY KEY NOT NULL,
    created DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    email_id UUID NOT NULL,
    file_name TEXT NOT NULL,
    content_type TEXT NOT NULL
);

-- create "notes" table
CREATE TABLE IF NOT EXISTS notes (
    id UUID PRIMARY KEY NOT NULL,
    created DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    user_id UUID NOT NULL,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    content TEXT NOT NULL
);

-- create "consultations" table with new structure (SQLite compatible)
CREATE TABLE IF NOT EXISTS consultations (
    id TEXT PRIMARY KEY NOT NULL, -- UUID as TEXT in SQLite
    user_id TEXT NOT NULL, -- UUID as TEXT, references users(id)

    -- Contact Information (JSON as TEXT in SQLite)
    contact_info TEXT NOT NULL DEFAULT '{}',
    -- {
    --   "business_name": "string",
    --   "contact_person": "string",
    --   "email": "string",
    --   "phone": "string",
    --   "website": "string",
    --   "social_media": {
    --     "linkedin": "string",
    --     "facebook": "string",
    --     "instagram": "string"
    --   }
    -- }

    -- Business Context (JSON as TEXT in SQLite)
    business_context TEXT NOT NULL DEFAULT '{}',
    -- {
    --   "industry": "string",
    --   "business_type": "string",
    --   "team_size": "number",
    --   "current_platform": "string",
    --   "digital_presence": ["string"],
    --   "marketing_channels": ["string"]
    -- }

    -- Pain Points & Challenges (JSON as TEXT in SQLite)
    pain_points TEXT NOT NULL DEFAULT '{}',
    -- {
    --   "primary_challenges": ["string"],
    --   "technical_issues": ["string"],
    --   "urgency_level": "string", // "low", "medium", "high", "critical"
    --   "impact_assessment": "string",
    --   "current_solution_gaps": ["string"]
    -- }

    -- Goals & Objectives (JSON as TEXT in SQLite)
    goals_objectives TEXT NOT NULL DEFAULT '{}',
    -- {
    --   "primary_goals": ["string"],
    --   "secondary_goals": ["string"],
    --   "success_metrics": ["string"],
    --   "kpis": ["string"],
    --   "timeline": {
    --     "desired_start": "string",
    --     "target_completion": "string",
    --     "milestones": ["string"]
    --   },
    --   "budget_range": "string",
    --   "budget_constraints": ["string"]
    -- }

    -- Metadata
    status TEXT NOT NULL DEFAULT 'draft',
    completion_percentage INTEGER DEFAULT 0 CHECK (completion_percentage >= 0 AND completion_percentage <= 100),

    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,

    -- Constraints
    CHECK (status IN ('draft', 'completed', 'archived')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- create "consultation_drafts" table with new structure (SQLite compatible)
CREATE TABLE IF NOT EXISTS consultation_drafts (
    id TEXT PRIMARY KEY NOT NULL, -- UUID as TEXT in SQLite
    consultation_id TEXT NOT NULL, -- UUID as TEXT
    user_id TEXT NOT NULL, -- UUID as TEXT

    -- Draft data (same structure as consultations, JSON as TEXT)
    contact_info TEXT NOT NULL DEFAULT '{}',
    business_context TEXT NOT NULL DEFAULT '{}',
    pain_points TEXT NOT NULL DEFAULT '{}',
    goals_objectives TEXT NOT NULL DEFAULT '{}',

    -- Draft metadata
    auto_saved BOOLEAN DEFAULT 1,
    draft_notes TEXT,

    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    -- Ensure one active draft per consultation
    UNIQUE(consultation_id),
    FOREIGN KEY (consultation_id) REFERENCES consultations(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- create "consultation_versions" table with new structure (SQLite compatible)
CREATE TABLE IF NOT EXISTS consultation_versions (
    id TEXT PRIMARY KEY NOT NULL, -- UUID as TEXT in SQLite
    consultation_id TEXT NOT NULL, -- UUID as TEXT
    user_id TEXT NOT NULL, -- UUID as TEXT
    version_number INTEGER NOT NULL,

    -- Snapshot of consultation data at this version (JSON as TEXT)
    contact_info TEXT NOT NULL DEFAULT '{}',
    business_context TEXT NOT NULL DEFAULT '{}',
    pain_points TEXT NOT NULL DEFAULT '{}',
    goals_objectives TEXT NOT NULL DEFAULT '{}',
    status TEXT NOT NULL,
    completion_percentage INTEGER NOT NULL,

    -- Version metadata
    change_summary TEXT,
    changed_fields TEXT, -- JSON array as TEXT

    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    -- Ensure unique version numbers per consultation
    UNIQUE(consultation_id, version_number),
    FOREIGN KEY (consultation_id) REFERENCES consultations(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for consultations
CREATE INDEX IF NOT EXISTS idx_consultations_user_id ON consultations(user_id);
CREATE INDEX IF NOT EXISTS idx_consultations_status ON consultations(status);
CREATE INDEX IF NOT EXISTS idx_consultations_created_at ON consultations(created_at);
CREATE INDEX IF NOT EXISTS idx_consultations_updated_at ON consultations(updated_at);

-- Indexes for consultation_drafts
CREATE INDEX IF NOT EXISTS idx_consultation_drafts_consultation_id ON consultation_drafts(consultation_id);
CREATE INDEX IF NOT EXISTS idx_consultation_drafts_user_id ON consultation_drafts(user_id);
CREATE INDEX IF NOT EXISTS idx_consultation_drafts_updated_at ON consultation_drafts(updated_at);

-- Indexes for consultation_versions
CREATE INDEX IF NOT EXISTS idx_consultation_versions_consultation_id ON consultation_versions(consultation_id);
CREATE INDEX IF NOT EXISTS idx_consultation_versions_user_id ON consultation_versions(user_id);
CREATE INDEX IF NOT EXISTS idx_consultation_versions_created_at ON consultation_versions(created_at);
CREATE INDEX IF NOT EXISTS idx_consultation_versions_version_number ON consultation_versions(consultation_id, version_number);