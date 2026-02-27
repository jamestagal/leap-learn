-- =============================================================================
-- 001_initial_schema.sql — LeapLearn skeleton tables (fresh start)
-- =============================================================================
-- 15 tables: schema_migrations, tokens, users, organisations,
-- organisation_memberships, organisation_form_options, organisation_activity_log,
-- beta_invites, organisation_profiles, form_templates, organisation_forms,
-- field_option_sets, clients, form_submissions
--
-- All statements are idempotent (CREATE TABLE IF NOT EXISTS).
-- =============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- =============================================================================
-- MIGRATION TRACKING
-- =============================================================================

CREATE TABLE IF NOT EXISTS schema_migrations (
    version   INTEGER PRIMARY KEY,
    filename  TEXT NOT NULL,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT current_timestamp
);

-- =============================================================================
-- AUTH (Go backend only — not in Drizzle)
-- =============================================================================

CREATE TABLE IF NOT EXISTS tokens (
    id       TEXT PRIMARY KEY NOT NULL,
    expires  TIMESTAMPTZ NOT NULL,
    target   TEXT NOT NULL,
    callback TEXT NOT NULL DEFAULT ''
);

-- =============================================================================
-- USERS
-- =============================================================================

CREATE TABLE IF NOT EXISTS users (
    id                       UUID PRIMARY KEY NOT NULL,
    created                  TIMESTAMPTZ NOT NULL DEFAULT current_timestamp,
    updated                  TIMESTAMPTZ NOT NULL DEFAULT current_timestamp,
    email                    TEXT NOT NULL,
    phone                    TEXT NOT NULL DEFAULT '',
    access                   BIGINT NOT NULL,
    sub                      TEXT NOT NULL,
    avatar                   TEXT NOT NULL DEFAULT '',
    customer_id              TEXT NOT NULL DEFAULT '',
    subscription_id          TEXT NOT NULL DEFAULT '',
    subscription_end         TIMESTAMPTZ NOT NULL DEFAULT '2000-01-01 00:00:00',
    api_key                  TEXT NOT NULL DEFAULT '',
    default_organisation_id  UUID,
    suspended                BOOLEAN NOT NULL DEFAULT false,
    suspended_at             TIMESTAMPTZ,
    suspended_reason         TEXT,
    UNIQUE (email, sub)
);

-- =============================================================================
-- ORGANISATIONS (Core tenant table)
-- =============================================================================

CREATE TABLE IF NOT EXISTS organisations (
    id                        UUID PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
    created_at                TIMESTAMPTZ NOT NULL DEFAULT current_timestamp,
    updated_at                TIMESTAMPTZ NOT NULL DEFAULT current_timestamp,
    name                      TEXT NOT NULL,
    slug                      TEXT NOT NULL UNIQUE,
    logo_url                  TEXT NOT NULL DEFAULT '',
    logo_avatar_url           TEXT NOT NULL DEFAULT '',
    primary_color             TEXT NOT NULL DEFAULT '#4F46E5',
    secondary_color           TEXT NOT NULL DEFAULT '#1E40AF',
    accent_color              TEXT NOT NULL DEFAULT '#F59E0B',
    accent_gradient           TEXT NOT NULL DEFAULT '',
    email                     TEXT NOT NULL DEFAULT '',
    phone                     TEXT NOT NULL DEFAULT '',
    website                   TEXT NOT NULL DEFAULT '',
    status                    VARCHAR(50) NOT NULL DEFAULT 'active',
    subscription_tier         VARCHAR(50) NOT NULL DEFAULT 'free',
    subscription_id           TEXT NOT NULL DEFAULT '',
    subscription_end          TIMESTAMPTZ,
    stripe_customer_id        TEXT NOT NULL DEFAULT '',
    ai_generations_this_month INTEGER NOT NULL DEFAULT 0,
    ai_generations_reset_at   TIMESTAMPTZ,
    is_freemium               BOOLEAN NOT NULL DEFAULT false,
    freemium_reason           VARCHAR(50),
    freemium_expires_at       TIMESTAMPTZ,
    freemium_granted_at       TIMESTAMPTZ,
    freemium_granted_by       VARCHAR(255),
    deleted_at                TIMESTAMPTZ,
    deletion_scheduled_for    TIMESTAMPTZ,
    CONSTRAINT valid_organisation_status CHECK (status IN ('active', 'suspended', 'cancelled'))
);

ALTER TABLE organisations DROP CONSTRAINT IF EXISTS chk_slug_format;
ALTER TABLE organisations ADD CONSTRAINT chk_slug_format
    CHECK (slug ~ '^[a-z0-9][a-z0-9-]*[a-z0-9]$' OR length(slug) = 1);

-- Deferred FK: users.default_organisation_id -> organisations.id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_users_default_organisation'
    ) THEN
        ALTER TABLE users ADD CONSTRAINT fk_users_default_organisation
            FOREIGN KEY (default_organisation_id) REFERENCES organisations(id) ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_organisations_slug ON organisations(slug);
CREATE INDEX IF NOT EXISTS idx_organisations_status ON organisations(status);
CREATE INDEX IF NOT EXISTS idx_organisations_deleted ON organisations(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_organisations_freemium ON organisations(is_freemium) WHERE is_freemium = true;

-- =============================================================================
-- ORGANISATION MEMBERSHIPS
-- =============================================================================

CREATE TABLE IF NOT EXISTS organisation_memberships (
    id               UUID PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT current_timestamp,
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT current_timestamp,
    user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organisation_id  UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    role             VARCHAR(50) NOT NULL DEFAULT 'member',
    display_name     TEXT NOT NULL DEFAULT '',
    status           VARCHAR(50) NOT NULL DEFAULT 'active',
    invited_at       TIMESTAMPTZ,
    invited_by       UUID REFERENCES users(id) ON DELETE SET NULL,
    accepted_at      TIMESTAMPTZ,
    UNIQUE(user_id, organisation_id),
    CONSTRAINT valid_membership_role CHECK (role IN ('owner', 'admin', 'member')),
    CONSTRAINT valid_membership_status CHECK (status IN ('active', 'invited', 'suspended'))
);

CREATE INDEX IF NOT EXISTS idx_organisation_memberships_user_id ON organisation_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_organisation_memberships_organisation_id ON organisation_memberships(organisation_id);
CREATE INDEX IF NOT EXISTS idx_organisation_memberships_role ON organisation_memberships(role);
CREATE INDEX IF NOT EXISTS idx_organisation_memberships_status ON organisation_memberships(status);

-- =============================================================================
-- ORGANISATION FORM OPTIONS
-- =============================================================================

CREATE TABLE IF NOT EXISTS organisation_form_options (
    id               UUID PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT current_timestamp,
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT current_timestamp,
    organisation_id  UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    category         VARCHAR(100) NOT NULL,
    value            TEXT NOT NULL,
    label            TEXT NOT NULL,
    sort_order       INTEGER NOT NULL DEFAULT 0,
    is_default       BOOLEAN NOT NULL DEFAULT false,
    is_active        BOOLEAN NOT NULL DEFAULT true,
    metadata         JSONB NOT NULL DEFAULT '{}',
    UNIQUE(organisation_id, category, value)
);

CREATE INDEX IF NOT EXISTS idx_organisation_form_options_organisation_id ON organisation_form_options(organisation_id);
CREATE INDEX IF NOT EXISTS idx_organisation_form_options_category ON organisation_form_options(organisation_id, category);
CREATE INDEX IF NOT EXISTS idx_organisation_form_options_active ON organisation_form_options(organisation_id, is_active);

-- =============================================================================
-- AUDIT TRAIL
-- =============================================================================

CREATE TABLE IF NOT EXISTS organisation_activity_log (
    id               UUID PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT current_timestamp,
    organisation_id  UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    user_id          UUID REFERENCES users(id) ON DELETE SET NULL,
    action           VARCHAR(100) NOT NULL,
    entity_type      VARCHAR(50) NOT NULL,
    entity_id        UUID,
    old_values       JSONB,
    new_values       JSONB,
    ip_address       TEXT,
    user_agent       TEXT,
    metadata         JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_activity_organisation_created ON organisation_activity_log(organisation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_entity ON organisation_activity_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_user ON organisation_activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_action ON organisation_activity_log(action);

-- =============================================================================
-- BETA INVITES
-- =============================================================================

CREATE TABLE IF NOT EXISTS beta_invites (
    id                       UUID PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
    created_at               TIMESTAMPTZ NOT NULL DEFAULT current_timestamp,
    email                    VARCHAR(255) NOT NULL,
    token                    VARCHAR(100) NOT NULL UNIQUE,
    status                   VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_by               UUID REFERENCES users(id) ON DELETE SET NULL,
    used_at                  TIMESTAMPTZ,
    used_by_organisation_id  UUID REFERENCES organisations(id) ON DELETE SET NULL,
    expires_at               TIMESTAMPTZ NOT NULL,
    notes                    TEXT,
    CONSTRAINT valid_beta_invite_status CHECK (status IN ('pending', 'used', 'expired', 'revoked'))
);

CREATE INDEX IF NOT EXISTS idx_beta_invites_email ON beta_invites(email);
CREATE INDEX IF NOT EXISTS idx_beta_invites_token ON beta_invites(token);
CREATE INDEX IF NOT EXISTS idx_beta_invites_status ON beta_invites(status);
CREATE INDEX IF NOT EXISTS idx_beta_invites_created_at ON beta_invites(created_at);

-- =============================================================================
-- ORGANISATION PROFILES (extended business details)
-- =============================================================================

CREATE TABLE IF NOT EXISTS organisation_profiles (
    id                      UUID PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT current_timestamp,
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT current_timestamp,
    organisation_id         UUID NOT NULL UNIQUE REFERENCES organisations(id) ON DELETE CASCADE,
    abn                     VARCHAR(20) NOT NULL DEFAULT '',
    acn                     VARCHAR(20) NOT NULL DEFAULT '',
    legal_entity_name       TEXT NOT NULL DEFAULT '',
    trading_name            TEXT NOT NULL DEFAULT '',
    address_line_1          TEXT NOT NULL DEFAULT '',
    address_line_2          TEXT NOT NULL DEFAULT '',
    city                    VARCHAR(100) NOT NULL DEFAULT '',
    state                   VARCHAR(50) NOT NULL DEFAULT '',
    postcode                VARCHAR(20) NOT NULL DEFAULT '',
    country                 VARCHAR(100) NOT NULL DEFAULT 'Australia',
    bank_name               VARCHAR(100) NOT NULL DEFAULT '',
    bsb                     TEXT NOT NULL DEFAULT '',
    account_number          TEXT NOT NULL DEFAULT '',
    account_name            TEXT NOT NULL DEFAULT '',
    gst_registered          BOOLEAN NOT NULL DEFAULT true,
    tax_file_number         TEXT NOT NULL DEFAULT '',
    tagline                 TEXT NOT NULL DEFAULT '',
    social_linkedin         TEXT NOT NULL DEFAULT '',
    social_facebook         TEXT NOT NULL DEFAULT '',
    social_instagram        TEXT NOT NULL DEFAULT '',
    social_twitter          TEXT NOT NULL DEFAULT '',
    brand_font              VARCHAR(100) NOT NULL DEFAULT '',
    default_payment_terms   VARCHAR(50) NOT NULL DEFAULT 'NET_14',
    onboarding_completed_at TIMESTAMPTZ,
    CONSTRAINT valid_payment_terms CHECK (default_payment_terms IN ('DUE_ON_RECEIPT', 'NET_7', 'NET_14', 'NET_30'))
);

CREATE INDEX IF NOT EXISTS idx_organisation_profiles_organisation_id ON organisation_profiles(organisation_id);

-- =============================================================================
-- FORM TEMPLATES (system-wide)
-- =============================================================================

CREATE TABLE IF NOT EXISTS form_templates (
    id                UUID PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
    name              VARCHAR(255) NOT NULL,
    slug              VARCHAR(255) NOT NULL UNIQUE,
    description       TEXT,
    category          VARCHAR(100) NOT NULL,
    schema            JSONB NOT NULL,
    ui_config         JSONB NOT NULL,
    preview_image_url TEXT,
    is_featured       BOOLEAN NOT NULL DEFAULT false,
    display_order     INTEGER NOT NULL DEFAULT 0,
    new_until         TIMESTAMPTZ,
    usage_count       INTEGER NOT NULL DEFAULT 0,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT current_timestamp,
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT current_timestamp
);

-- =============================================================================
-- ORGANISATION FORMS
-- =============================================================================

CREATE TABLE IF NOT EXISTS organisation_forms (
    id                  UUID PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
    organisation_id     UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    name                VARCHAR(255) NOT NULL,
    slug                VARCHAR(255) NOT NULL,
    description         TEXT,
    form_type           VARCHAR(50) NOT NULL,
    schema              JSONB NOT NULL,
    ui_config           JSONB NOT NULL DEFAULT '{"layout": "single-column", "showProgressBar": true, "showStepNumbers": true, "submitButtonText": "Submit", "successMessage": "Thank you for your submission!"}',
    branding            JSONB,
    is_active           BOOLEAN NOT NULL DEFAULT true,
    is_default          BOOLEAN NOT NULL DEFAULT false,
    requires_auth       BOOLEAN NOT NULL DEFAULT false,
    source_template_id  UUID REFERENCES form_templates(id) ON DELETE SET NULL,
    is_customized       BOOLEAN NOT NULL DEFAULT false,
    previous_schema     JSONB,
    version             INTEGER NOT NULL DEFAULT 1,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT current_timestamp,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT current_timestamp,
    created_by          UUID REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE(organisation_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_organisation_forms_organisation_type ON organisation_forms(organisation_id, form_type);
CREATE INDEX IF NOT EXISTS idx_organisation_forms_active ON organisation_forms(organisation_id, is_active);

-- =============================================================================
-- FIELD OPTION SETS
-- =============================================================================

CREATE TABLE IF NOT EXISTS field_option_sets (
    id               UUID PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
    organisation_id  UUID REFERENCES organisations(id) ON DELETE CASCADE,
    name             VARCHAR(255) NOT NULL,
    slug             VARCHAR(255) NOT NULL,
    description      TEXT,
    options          JSONB NOT NULL,
    is_system        BOOLEAN NOT NULL DEFAULT false,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT current_timestamp,
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT current_timestamp,
    UNIQUE(organisation_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_field_option_sets_organisation_id ON field_option_sets(organisation_id);

-- =============================================================================
-- CLIENTS
-- =============================================================================

CREATE TABLE IF NOT EXISTS clients (
    id               UUID PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
    organisation_id  UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    business_name    TEXT NOT NULL,
    email            VARCHAR(255) NOT NULL,
    phone            VARCHAR(50),
    contact_name     TEXT,
    notes            TEXT,
    website          TEXT NOT NULL DEFAULT '',
    status           VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at       TIMESTAMPTZ NOT NULL DEFAULT current_timestamp,
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT current_timestamp,
    CONSTRAINT clients_organisation_email_unique UNIQUE (organisation_id, email)
);

CREATE INDEX IF NOT EXISTS idx_clients_organisation_id ON clients(organisation_id);
CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(organisation_id, email);
CREATE INDEX IF NOT EXISTS idx_clients_business_name ON clients(organisation_id, business_name);

-- =============================================================================
-- FORM SUBMISSIONS
-- =============================================================================

CREATE TABLE IF NOT EXISTS form_submissions (
    id                    UUID PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
    form_id               UUID REFERENCES organisation_forms(id) ON DELETE CASCADE,
    organisation_id       UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    slug                  VARCHAR(100) UNIQUE,
    client_id             UUID REFERENCES clients(id) ON DELETE SET NULL,
    client_business_name  TEXT NOT NULL DEFAULT '',
    client_email          VARCHAR(255) NOT NULL DEFAULT '',
    data                  JSONB NOT NULL,
    current_step          INTEGER NOT NULL DEFAULT 0,
    completion_percentage INTEGER NOT NULL DEFAULT 0,
    started_at            TIMESTAMPTZ,
    last_activity_at      TIMESTAMPTZ,
    metadata              JSONB NOT NULL DEFAULT '{}',
    status                VARCHAR(50) NOT NULL DEFAULT 'draft',
    created_at            TIMESTAMPTZ NOT NULL DEFAULT current_timestamp,
    submitted_at          TIMESTAMPTZ,
    processed_at          TIMESTAMPTZ,
    form_version          INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_form_submissions_form_id ON form_submissions(form_id);
CREATE INDEX IF NOT EXISTS idx_form_submissions_organisation_id ON form_submissions(organisation_id);
CREATE INDEX IF NOT EXISTS idx_form_submissions_status ON form_submissions(status);
CREATE INDEX IF NOT EXISTS idx_form_submissions_submitted_at ON form_submissions(submitted_at);
CREATE INDEX IF NOT EXISTS idx_form_submissions_client_id ON form_submissions(client_id);
CREATE INDEX IF NOT EXISTS idx_form_submissions_slug ON form_submissions(slug);
