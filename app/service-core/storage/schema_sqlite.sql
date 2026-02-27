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
    default_organisation_id UUID,
    suspended BOOLEAN NOT NULL DEFAULT 0,
    suspended_at DATETIME,
    suspended_reason TEXT,
    UNIQUE (email, sub)
);

-- =============================================================================
-- ORGANISATIONS
-- =============================================================================

CREATE TABLE IF NOT EXISTS organisations (
    id UUID PRIMARY KEY NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    logo_url TEXT NOT NULL DEFAULT '',
    logo_avatar_url TEXT NOT NULL DEFAULT '',
    primary_color TEXT NOT NULL DEFAULT '#4F46E5',
    secondary_color TEXT NOT NULL DEFAULT '#1E40AF',
    accent_color TEXT NOT NULL DEFAULT '#F59E0B',
    accent_gradient TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    website TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'active',
    subscription_tier TEXT NOT NULL DEFAULT 'free',
    subscription_id TEXT NOT NULL DEFAULT '',
    subscription_end DATETIME,
    stripe_customer_id TEXT NOT NULL DEFAULT '',
    ai_generations_this_month INTEGER NOT NULL DEFAULT 0,
    ai_generations_reset_at DATETIME,
    is_freemium BOOLEAN NOT NULL DEFAULT 0,
    freemium_reason TEXT,
    freemium_expires_at DATETIME,
    freemium_granted_at DATETIME,
    freemium_granted_by TEXT,
    deleted_at DATETIME,
    deletion_scheduled_for DATETIME,
    CHECK (status IN ('active', 'suspended', 'cancelled'))
);

CREATE TABLE IF NOT EXISTS organisation_memberships (
    id UUID PRIMARY KEY NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member',
    display_name TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'active',
    invited_at DATETIME,
    invited_by UUID REFERENCES users(id) ON DELETE SET NULL,
    accepted_at DATETIME,
    UNIQUE(user_id, organisation_id),
    CHECK (role IN ('owner', 'admin', 'member')),
    CHECK (status IN ('active', 'invited', 'suspended'))
);
