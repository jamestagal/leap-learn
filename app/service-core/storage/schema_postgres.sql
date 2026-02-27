-- =============================================================================
-- GO SCHEMA REFERENCE (sqlc only)
-- =============================================================================
-- This file is used ONLY by sqlc for Go type generation.
-- It is NOT the source of truth for the database schema.
-- The database is managed by sequential SQL migrations in /migrations/.
-- Drizzle schema (service-client/src/lib/server/schema.ts) is the SvelteKit
-- source of truth.
--
-- NEVER use `atlas schema apply` against this file (see CLAUDE.md).
-- Tables listed here may be a subset of what exists in production.
-- Column types/constraints may diverge from Drizzle — see
-- docs/plans/database-spec.md #3.
-- =============================================================================

-- Enable required extensions
create extension if not exists pg_trgm;

-- create "tokens" table
create table if not exists tokens (
    id text primary key not null,
    expires timestamptz not null,
    target text not null,
    callback text not null default ''
);

-- create "users" table
create table if not exists users (
    id uuid primary key not null,
    created timestamptz not null default current_timestamp,
    updated timestamptz not null default current_timestamp,
    email text not null,
    phone text not null default '',
    access bigint not null,
    sub text not null,
    avatar text not null default '',
    customer_id text not null default '',
    subscription_id text not null default '',
    subscription_end timestamptz not null default '2000-01-01 00:00:00',
    api_key text not null default '',
    default_organisation_id uuid,  -- Added for multi-tenancy
    -- Suspension (super-admin controlled)
    suspended boolean not null default false,
    suspended_at timestamptz,
    suspended_reason text,
    unique (email, sub)
);

-- =============================================================================
-- ORGANISATION / MULTI-TENANCY TABLES
-- =============================================================================

-- create "organisations" table - Core tenant table
create table if not exists organisations (
    id uuid primary key not null default gen_random_uuid(),
    created_at timestamptz not null default current_timestamp,
    updated_at timestamptz not null default current_timestamp,

    -- Basic Information
    name text not null,
    slug text not null unique,  -- URL-friendly identifier (e.g., "acme-organisation")

    -- Branding
    logo_url text not null default '',  -- Horizontal logo for documents
    logo_avatar_url text not null default '',  -- Square avatar logo for nav/UI
    primary_color text not null default '#4F46E5',  -- Indigo-600
    secondary_color text not null default '#1E40AF',  -- Blue-800
    accent_color text not null default '#F59E0B',  -- Amber-500
    accent_gradient text not null default '',  -- CSS gradient for backgrounds

    -- Contact
    email text not null default '',
    phone text not null default '',
    website text not null default '',

    -- Status & Billing
    status varchar(50) not null default 'active',
    subscription_tier varchar(50) not null default 'free',  -- free, starter, pro, enterprise
    subscription_id text not null default '',  -- Stripe subscription ID
    subscription_end timestamptz,
    stripe_customer_id text not null default '',  -- Stripe Customer ID for platform billing

    -- AI Generation Rate Limiting
    ai_generations_this_month integer not null default 0,
    ai_generations_reset_at timestamptz,

    -- Freemium access (beta/partner programs)
    is_freemium boolean not null default false,
    freemium_reason varchar(50),  -- beta_tester, partner, promotional, early_signup, referral_reward, internal
    freemium_expires_at timestamptz,
    freemium_granted_at timestamptz,
    freemium_granted_by varchar(255),

    constraint valid_organisation_status check (status in ('active', 'suspended', 'cancelled'))
);

-- create "organisation_memberships" table - User-Organisation relationships
create table if not exists organisation_memberships (
    id uuid primary key not null default gen_random_uuid(),
    created_at timestamptz not null default current_timestamp,
    updated_at timestamptz not null default current_timestamp,

    user_id uuid not null references users(id) on delete cascade,
    organisation_id uuid not null references organisations(id) on delete cascade,

    -- Role within organisation
    role varchar(50) not null default 'member',

    -- User-specific settings within organisation
    display_name text not null default '',  -- Optional override for proposals

    -- Status
    status varchar(50) not null default 'active',
    invited_at timestamptz,
    invited_by uuid references users(id) on delete set null,
    accepted_at timestamptz,

    unique(user_id, organisation_id),

    constraint valid_membership_role check (role in ('owner', 'admin', 'member')),
    constraint valid_membership_status check (status in ('active', 'invited', 'suspended'))
);

-- create "organisation_form_options" table - Configurable form presets per organisation
create table if not exists organisation_form_options (
    id uuid primary key not null default gen_random_uuid(),
    created_at timestamptz not null default current_timestamp,
    updated_at timestamptz not null default current_timestamp,

    organisation_id uuid not null references organisations(id) on delete cascade,

    -- Option category (maps to form components)
    -- Examples: 'budget_range', 'industry', 'business_type', 'digital_presence',
    --           'marketing_channels', 'challenges', 'technical_issues',
    --           'solution_gaps', 'primary_goals', 'secondary_goals',
    --           'success_metrics', 'kpis', 'budget_constraints', 'urgency'
    category varchar(100) not null,

    -- Option details
    value text not null,          -- Internal value (e.g., "under-5k")
    label text not null,          -- Display label (e.g., "Under $5,000")
    sort_order integer not null default 0,
    is_default boolean not null default false,  -- Show by default in quick-add
    is_active boolean not null default true,

    -- Optional metadata
    metadata jsonb not null default '{}',  -- For extra data like color coding

    unique(organisation_id, category, value)
);

-- create "organisation_proposal_templates" table - Proposal customization per organisation
create table if not exists organisation_proposal_templates (
    id uuid primary key not null default gen_random_uuid(),
    created_at timestamptz not null default current_timestamp,
    updated_at timestamptz not null default current_timestamp,

    organisation_id uuid not null references organisations(id) on delete cascade,

    name text not null,
    is_default boolean not null default false,

    -- Template sections (JSONB for flexibility)
    sections jsonb not null default '[]',
    -- Example structure:
    -- [
    --   { "id": "cover", "title": "Cover Page", "enabled": true, "content": "..." },
    --   { "id": "executive_summary", "title": "Executive Summary", "enabled": true },
    --   { "id": "scope", "title": "Project Scope", "enabled": true },
    --   { "id": "pricing", "title": "Pricing", "enabled": true },
    --   { "id": "terms", "title": "Terms & Conditions", "enabled": true, "content": "..." }
    -- ]

    -- Footer/Header content
    header_content text not null default '',
    footer_content text not null default '',

    -- PDF/Document settings
    settings jsonb not null default '{}'
    -- { "font_family": "Inter", "font_size": 12, "margin": "1in" }
);

-- =============================================================================
-- AUDIT TRAIL & COMPLIANCE
-- =============================================================================

-- create "organisation_activity_log" table - Audit trail for compliance
create table if not exists organisation_activity_log (
    id uuid primary key not null default gen_random_uuid(),
    created_at timestamptz not null default current_timestamp,

    organisation_id uuid not null references organisations(id) on delete cascade,
    user_id uuid references users(id) on delete set null,  -- Nullable for system actions

    -- Action details
    action varchar(100) not null,  -- e.g., 'member.invited', 'settings.updated', 'consultation.created'
    entity_type varchar(50) not null,  -- e.g., 'member', 'consultation', 'organisation', 'proposal'
    entity_id uuid,  -- ID of the affected entity

    -- Change details (for auditing)
    old_values jsonb,  -- Previous values (for updates)
    new_values jsonb,  -- New values (for creates/updates)

    -- Request context (for security)
    ip_address text,
    user_agent text,

    -- Additional metadata
    metadata jsonb not null default '{}'
);

-- Add soft delete columns to organisations table (for GDPR compliance)
alter table organisations add column if not exists deleted_at timestamptz;
alter table organisations add column if not exists deletion_scheduled_for timestamptz;

-- Add slug format constraint (lowercase alphanumeric with hyphens, 3-50 chars)
-- Note: This validates new slugs but allows existing invalid ones
alter table organisations drop constraint if exists chk_slug_format;
alter table organisations add constraint chk_slug_format
    check (slug ~ '^[a-z0-9][a-z0-9-]*[a-z0-9]$' or length(slug) = 1);

-- Indexes for organisations
create index if not exists idx_organisations_slug on organisations(slug);
create index if not exists idx_organisations_status on organisations(status);

-- Indexes for organisation_memberships
create index if not exists idx_organisation_memberships_user_id on organisation_memberships(user_id);
create index if not exists idx_organisation_memberships_organisation_id on organisation_memberships(organisation_id);
create index if not exists idx_organisation_memberships_role on organisation_memberships(role);
create index if not exists idx_organisation_memberships_status on organisation_memberships(status);

-- Indexes for organisation_form_options
create index if not exists idx_organisation_form_options_organisation_id on organisation_form_options(organisation_id);
create index if not exists idx_organisation_form_options_category on organisation_form_options(organisation_id, category);
create index if not exists idx_organisation_form_options_active on organisation_form_options(organisation_id, is_active);

-- Indexes for organisation_proposal_templates
create index if not exists idx_organisation_proposal_templates_organisation_id on organisation_proposal_templates(organisation_id);
create index if not exists idx_organisation_proposal_templates_default on organisation_proposal_templates(organisation_id, is_default);

-- Indexes for organisation_activity_log
create index if not exists idx_activity_organisation_created on organisation_activity_log(organisation_id, created_at desc);
create index if not exists idx_activity_entity on organisation_activity_log(entity_type, entity_id);
create index if not exists idx_activity_user on organisation_activity_log(user_id);
create index if not exists idx_activity_action on organisation_activity_log(action);

-- Index for soft deleted organisations
create index if not exists idx_organisations_deleted on organisations(deleted_at) where deleted_at is not null;

-- Index for freemium organisations
create index if not exists idx_organisations_freemium on organisations(is_freemium) where is_freemium = true;

-- Add foreign key for users.default_organisation_id (after organisations table exists)
-- Note: This needs to be run after organisations table is created
alter table users add constraint fk_users_default_organisation
    foreign key (default_organisation_id) references organisations(id) on delete set null;

-- =============================================================================
-- BETA INVITES (Super-Admin Feature)
-- =============================================================================

-- create "beta_invites" table - Manage beta tester invitations
create table if not exists beta_invites (
    id uuid primary key not null default gen_random_uuid(),
    created_at timestamptz not null default current_timestamp,

    -- Invite target
    email varchar(255) not null,

    -- Token for URL (unique per invite, allows re-inviting same email)
    token varchar(100) not null unique,

    -- Status: pending, used, expired, revoked
    status varchar(20) not null default 'pending',

    -- Who created this invite
    created_by uuid references users(id) on delete set null,

    -- Usage tracking
    used_at timestamptz,
    used_by_organisation_id uuid references organisations(id) on delete set null,

    -- Expiration (30 days from creation by default)
    expires_at timestamptz not null,

    -- Optional notes for admin reference
    notes text,

    constraint valid_beta_invite_status check (status in ('pending', 'used', 'expired', 'revoked'))
);

-- Indexes for beta_invites
create index if not exists idx_beta_invites_email on beta_invites(email);
create index if not exists idx_beta_invites_token on beta_invites(token);
create index if not exists idx_beta_invites_status on beta_invites(status);
create index if not exists idx_beta_invites_created_at on beta_invites(created_at);

-- =============================================================================
-- ORGANISATION PROFILES, PACKAGES & ADD-ONS (V2 Foundation)
-- =============================================================================

-- create "organisation_profiles" table - Extended business details for documents
create table if not exists organisation_profiles (
    id uuid primary key not null default gen_random_uuid(),
    created_at timestamptz not null default current_timestamp,
    updated_at timestamptz not null default current_timestamp,

    organisation_id uuid not null unique references organisations(id) on delete cascade,

    -- Business Registration
    abn varchar(20) not null default '',
    acn varchar(20) not null default '',
    legal_entity_name text not null default '',
    trading_name text not null default '',

    -- Address
    address_line_1 text not null default '',
    address_line_2 text not null default '',
    city varchar(100) not null default '',
    state varchar(50) not null default '',
    postcode varchar(20) not null default '',
    country varchar(100) not null default 'Australia',

    -- Banking (for invoice display)
    bank_name varchar(100) not null default '',
    bsb text not null default '',
    account_number text not null default '',
    account_name text not null default '',

    -- Tax & GST
    gst_registered boolean not null default true,
    tax_file_number text not null default '',
    gst_rate decimal(5,2) not null default 10.00,

    -- Social & Branding
    tagline text not null default '',
    social_linkedin text not null default '',
    social_facebook text not null default '',
    social_instagram text not null default '',
    social_twitter text not null default '',
    brand_font varchar(100) not null default '',

    -- Document Defaults
    default_payment_terms varchar(50) not null default 'NET_14',
    invoice_prefix varchar(20) not null default 'INV',
    invoice_footer text not null default '',
    next_invoice_number integer not null default 1,
    contract_prefix varchar(20) not null default 'CON',
    contract_footer text not null default '',
    next_contract_number integer not null default 1,
    proposal_prefix varchar(20) not null default 'PROP',
    next_proposal_number integer not null default 1,

    -- Stripe Connect
    stripe_account_id varchar(255),
    stripe_account_status varchar(50) not null default 'not_connected',
    stripe_onboarding_complete boolean not null default false,
    stripe_connected_at timestamptz,
    stripe_payouts_enabled boolean not null default false,
    stripe_charges_enabled boolean not null default false,

    constraint valid_payment_terms check (default_payment_terms in ('DUE_ON_RECEIPT', 'NET_7', 'NET_14', 'NET_30')),
    constraint valid_stripe_status check (stripe_account_status in ('not_connected', 'pending', 'active', 'restricted', 'disabled'))
);

-- create "organisation_packages" table - Configurable pricing tiers per organisation
create table if not exists organisation_packages (
    id uuid primary key not null default gen_random_uuid(),
    created_at timestamptz not null default current_timestamp,
    updated_at timestamptz not null default current_timestamp,

    organisation_id uuid not null references organisations(id) on delete cascade,

    -- Package Identity
    name varchar(100) not null,
    slug varchar(50) not null,
    description text not null default '',

    -- Pricing Model
    pricing_model varchar(50) not null,

    -- All prices in AUD dollars (DECIMAL for precision)
    setup_fee decimal(10,2) not null default 0.00,
    monthly_price decimal(10,2) not null default 0.00,
    one_time_price decimal(10,2) not null default 0.00,
    hosting_fee decimal(10,2) not null default 0.00,

    -- Terms
    minimum_term_months integer not null default 12,
    cancellation_fee_type varchar(50),
    cancellation_fee_amount decimal(10,2) not null default 0.00,

    -- Included Features (JSONB array of strings)
    included_features jsonb not null default '[]',
    max_pages integer,  -- NULL = unlimited

    -- Display Settings
    display_order integer not null default 0,
    is_featured boolean not null default false,
    is_active boolean not null default true,

    unique(organisation_id, slug),

    constraint valid_pricing_model check (pricing_model in ('subscription', 'lump_sum', 'hybrid')),
    constraint valid_cancellation_fee_type check (cancellation_fee_type is null or cancellation_fee_type in ('none', 'fixed', 'remaining_balance'))
);

-- create "organisation_addons" table - Optional services per package
create table if not exists organisation_addons (
    id uuid primary key not null default gen_random_uuid(),
    created_at timestamptz not null default current_timestamp,
    updated_at timestamptz not null default current_timestamp,

    organisation_id uuid not null references organisations(id) on delete cascade,

    -- Add-on Identity
    name varchar(100) not null,
    slug varchar(50) not null,
    description text not null default '',

    -- Pricing (AUD dollars)
    price decimal(10,2) not null,
    pricing_type varchar(50) not null,
    unit_label varchar(50),  -- e.g., "page", "hour" (for per_unit)

    -- Availability (JSONB array of package slugs, empty = all packages)
    available_packages jsonb not null default '[]',

    -- Display Settings
    display_order integer not null default 0,
    is_active boolean not null default true,

    unique(organisation_id, slug),

    constraint valid_pricing_type check (pricing_type in ('one_time', 'monthly', 'per_unit'))
);

-- Indexes for organisation_profiles
create index if not exists idx_organisation_profiles_organisation_id on organisation_profiles(organisation_id);

-- Indexes for organisation_packages
create index if not exists idx_organisation_packages_organisation_id on organisation_packages(organisation_id);
create index if not exists idx_organisation_packages_slug on organisation_packages(organisation_id, slug);
create index if not exists idx_organisation_packages_active on organisation_packages(organisation_id, is_active);
create index if not exists idx_organisation_packages_display_order on organisation_packages(organisation_id, display_order);

-- Indexes for organisation_addons
create index if not exists idx_organisation_addons_organisation_id on organisation_addons(organisation_id);
create index if not exists idx_organisation_addons_slug on organisation_addons(organisation_id, slug);
create index if not exists idx_organisation_addons_active on organisation_addons(organisation_id, is_active);
create index if not exists idx_organisation_addons_display_order on organisation_addons(organisation_id, display_order);

-- create "organisation_document_branding" table - Per-document branding overrides
create table if not exists organisation_document_branding (
    id uuid primary key not null default gen_random_uuid(),
    created_at timestamptz not null default current_timestamp,
    updated_at timestamptz not null default current_timestamp,

    organisation_id uuid not null references organisations(id) on delete cascade,

    -- Document type: 'contract', 'invoice', 'questionnaire', 'proposal', 'email'
    document_type varchar(50) not null,

    -- Toggle: use custom branding vs organisation defaults
    use_custom_branding boolean not null default false,

    -- Branding overrides (null = use organisation default)
    logo_url text,
    primary_color text,
    accent_color text,
    accent_gradient text,

    unique(organisation_id, document_type),
    constraint valid_document_type check (document_type in ('contract', 'invoice', 'questionnaire', 'proposal', 'email'))
);

-- Indexes for organisation_document_branding
create index if not exists idx_organisation_document_branding_organisation_id on organisation_document_branding(organisation_id);
create index if not exists idx_organisation_document_branding_type on organisation_document_branding(organisation_id, document_type);

-- =============================================================================
-- FORMS SYSTEM (Consolidated Forms)
-- =============================================================================

-- create "form_templates" table - System-wide starting point templates
create table if not exists form_templates (
    id uuid primary key not null default gen_random_uuid(),

    -- Template Info
    name varchar(255) not null,
    slug varchar(255) not null unique,
    description text,
    category varchar(100) not null,

    -- Template Schema
    schema jsonb not null,
    ui_config jsonb not null,

    -- Display
    preview_image_url text,
    is_featured boolean not null default false,
    display_order integer not null default 0,

    -- Admin Controls
    new_until timestamptz,
    usage_count integer not null default 0,

    -- Metadata
    created_at timestamptz not null default current_timestamp,
    updated_at timestamptz not null default current_timestamp
);

-- create "organisation_forms" table - Organisation-specific forms
create table if not exists organisation_forms (
    id uuid primary key not null default gen_random_uuid(),
    organisation_id uuid not null references organisations(id) on delete cascade,

    -- Form Identification
    name varchar(255) not null,
    slug varchar(255) not null,
    description text,
    form_type varchar(50) not null,  -- questionnaire, consultation, feedback, intake, custom

    -- Form Schema (Zod-compatible JSON)
    schema jsonb not null,

    -- UI Configuration
    ui_config jsonb not null default '{"layout": "single-column", "showProgressBar": true, "showStepNumbers": true, "submitButtonText": "Submit", "successMessage": "Thank you for your submission!"}',

    -- Branding Overrides (inherits from organisation if null)
    branding jsonb,

    -- Form Settings
    is_active boolean not null default true,
    is_default boolean not null default false,
    requires_auth boolean not null default false,

    -- Template Tracking
    source_template_id uuid references form_templates(id) on delete set null,
    is_customized boolean not null default false,
    previous_schema jsonb,

    -- Metadata
    version integer not null default 1,
    created_at timestamptz not null default current_timestamp,
    updated_at timestamptz not null default current_timestamp,
    created_by uuid references users(id) on delete set null,

    unique(organisation_id, slug)
);

create index if not exists idx_organisation_forms_organisation_type on organisation_forms(organisation_id, form_type);
create index if not exists idx_organisation_forms_active on organisation_forms(organisation_id, is_active);

-- create "field_option_sets" table - Reusable dropdown options
create table if not exists field_option_sets (
    id uuid primary key not null default gen_random_uuid(),
    organisation_id uuid references organisations(id) on delete cascade,  -- NULL = system-wide

    -- Option Set Info
    name varchar(255) not null,
    slug varchar(255) not null,
    description text,

    -- Options as JSON array: [{"value": "tech", "label": "Technology"}, ...]
    options jsonb not null,

    -- Metadata
    is_system boolean not null default false,
    created_at timestamptz not null default current_timestamp,
    updated_at timestamptz not null default current_timestamp,

    unique(organisation_id, slug)
);

-- create "form_submissions" table - Submitted form data
create table if not exists form_submissions (
    id uuid primary key not null default gen_random_uuid(),
    form_id uuid references organisation_forms(id) on delete cascade,  -- Nullable for system template submissions
    organisation_id uuid not null references organisations(id) on delete cascade,

    -- Public URL slug for sharing
    slug varchar(100) unique,

    -- Client linking
    client_id uuid,  -- FK added via ALTER TABLE after clients table
    client_business_name text not null default '',
    client_email varchar(255) not null default '',

    -- Submission Data (flexible JSONB - matches form schema)
    data jsonb not null,

    -- Progress tracking
    current_step integer not null default 0,
    completion_percentage integer not null default 0,
    started_at timestamptz,
    last_activity_at timestamptz,

    -- Linked Entities
    consultation_id uuid references consultations(id) on delete set null,
    proposal_id uuid,  -- FK added via ALTER TABLE after proposals table
    contract_id uuid,  -- FK added via ALTER TABLE after contracts table

    -- Submission Metadata
    metadata jsonb not null default '{}',

    -- Status: draft, completed, processing, processed, archived
    status varchar(50) not null default 'draft',

    -- Timestamps
    created_at timestamptz not null default current_timestamp,
    submitted_at timestamptz,
    processed_at timestamptz,

    -- Form version at time of submission (for schema evolution)
    form_version integer not null default 1
);

create index if not exists idx_form_submissions_form_id on form_submissions(form_id);
create index if not exists idx_form_submissions_organisation_id on form_submissions(organisation_id);
create index if not exists idx_form_submissions_status on form_submissions(status);
create index if not exists idx_form_submissions_submitted_at on form_submissions(submitted_at);
create index if not exists idx_form_submissions_client_id on form_submissions(client_id);
create index if not exists idx_form_submissions_slug on form_submissions(slug);

-- create "files" table
create table if not exists files (
    id uuid primary key not null,
    created timestamptz not null default current_timestamp,
    updated timestamptz not null default current_timestamp,
    user_id uuid not null,
    file_key text not null,
    file_name text not null,
    file_size bigint not null,
    content_type text not null
);

-- create "emails" table
create table if not exists emails (
    id uuid primary key not null,
    created timestamptz not null default current_timestamp,
    updated timestamptz not null default current_timestamp,
    user_id uuid not null,
    email_to text not null,
    email_from text not null,
    email_subject text not null,
    email_body text not null
);

-- create "email_attachments" table
create table if not exists email_attachments (
    id uuid primary key not null,
    created timestamptz not null default current_timestamp,
    email_id uuid not null,
    file_name text not null,
    content_type text not null
);

-- create "notes" table
create table if not exists notes (
    id uuid primary key not null,
    created timestamptz not null default current_timestamp,
    updated timestamptz not null default current_timestamp,
    user_id uuid not null,
    title text not null,
    category text not null,
    content text not null
);

-- create "consultations" table
create table if not exists consultations (
    id uuid primary key not null default gen_random_uuid(),
    user_id uuid references users(id) on delete set null,
    organisation_id uuid not null references organisations(id) on delete cascade,

    -- Step 1: Contact & Business
    business_name text,
    contact_person text,
    email text,
    phone text,
    website text,
    social_linkedin text,
    social_facebook text,
    social_instagram text,
    industry text,
    business_type text,

    -- Step 2: Situation & Challenges
    website_status text,
    primary_challenges jsonb default '[]',
    urgency_level text,

    -- Step 3: Goals & Budget
    primary_goals jsonb default '[]',
    conversion_goal text,
    budget_range text,
    timeline text,

    -- Step 4: Preferences & Notes
    design_styles jsonb default '[]',
    admired_websites jsonb default '[]',
    consultation_notes text,

    -- Additional fields
    created_by uuid references users(id) on delete set null,
    performance_data jsonb,
    client_id uuid,
    custom_data jsonb,
    form_id uuid,

    -- Metadata
    status varchar(50) not null default 'draft',
    completion_percentage integer not null default 0 check (completion_percentage >= 0 and completion_percentage <= 100),

    -- Timestamps (NOT NULL with defaults for created/updated, nullable for completed)
    created_at timestamptz not null default current_timestamp,
    updated_at timestamptz not null default current_timestamp,
    completed_at timestamptz,

    -- Constraints
    constraint valid_status check (status in ('draft', 'completed', 'archived', 'converted'))
);

-- create "consultation_drafts" table with new structure
create table if not exists consultation_drafts (
    id uuid primary key not null default gen_random_uuid(),
    consultation_id uuid not null references consultations(id) on delete cascade,
    user_id uuid not null references users(id) on delete cascade,
    organisation_id uuid references organisations(id) on delete cascade,

    -- Draft metadata
    auto_saved boolean not null default false,
    draft_notes text,

    -- Timestamps (NOT NULL with defaults)
    created_at timestamptz not null default current_timestamp,
    updated_at timestamptz not null default current_timestamp,

    -- Ensure one active draft per consultation
    unique(consultation_id)
);

-- create "consultation_versions" table
create table if not exists consultation_versions (
    id uuid primary key not null default gen_random_uuid(),
    consultation_id uuid not null references consultations(id) on delete cascade,
    user_id uuid not null references users(id) on delete cascade,
    organisation_id uuid references organisations(id) on delete cascade,
    version_number integer not null,

    -- Snapshot metadata
    status varchar(50) not null,
    completion_percentage integer not null,

    -- Version metadata
    change_summary text,
    changed_fields jsonb not null default '[]',

    -- Timestamps (NOT NULL with default)
    created_at timestamptz not null default current_timestamp,

    -- Ensure unique version numbers per consultation
    unique(consultation_id, version_number)
);

-- Indexes for consultations
create index if not exists idx_consultations_user_id on consultations(user_id);
create index if not exists idx_consultations_organisation_id on consultations(organisation_id);
create index if not exists idx_consultations_status on consultations(status);
create index if not exists idx_consultations_created_at on consultations(created_at);
create index if not exists idx_consultations_updated_at on consultations(updated_at);

-- Indexes for consultation_drafts
create index if not exists idx_consultation_drafts_consultation_id on consultation_drafts(consultation_id);
create index if not exists idx_consultation_drafts_user_id on consultation_drafts(user_id);
create index if not exists idx_consultation_drafts_organisation_id on consultation_drafts(organisation_id);
create index if not exists idx_consultation_drafts_updated_at on consultation_drafts(updated_at);

-- Indexes for consultation_versions
create index if not exists idx_consultation_versions_consultation_id on consultation_versions(consultation_id);
create index if not exists idx_consultation_versions_user_id on consultation_versions(user_id);
create index if not exists idx_consultation_versions_organisation_id on consultation_versions(organisation_id);
create index if not exists idx_consultation_versions_created_at on consultation_versions(created_at);
create index if not exists idx_consultation_versions_version_number on consultation_versions(consultation_id, version_number);

-- =============================================================================
-- CLIENTS (Unified Client Management)
-- =============================================================================

-- create "clients" table - Unified client records per organisation (SvelteKit compatibility)
create table if not exists clients (
    id uuid primary key not null default gen_random_uuid(),
    organisation_id uuid not null references organisations(id) on delete cascade,

    -- Client Information
    business_name text not null,
    email varchar(255) not null,
    phone varchar(50),
    contact_name text,
    notes text,

    -- Status: 'active' | 'archived'
    status varchar(20) not null default 'active',

    -- Metadata
    created_at timestamptz not null default current_timestamp,
    updated_at timestamptz not null default current_timestamp,

    constraint clients_organisation_email_unique unique (organisation_id, email)
);

create index if not exists idx_clients_organisation_id on clients(organisation_id);
create index if not exists idx_clients_email on clients(organisation_id, email);
create index if not exists idx_clients_business_name on clients(organisation_id, business_name);

-- =============================================================================
-- PROPOSALS (V2 Document Generation)
-- =============================================================================

-- create "proposals" table - Client proposals generated from consultations
create table if not exists proposals (
    id uuid primary key not null default gen_random_uuid(),
    created_at timestamptz not null default current_timestamp,
    updated_at timestamptz not null default current_timestamp,

    organisation_id uuid not null references organisations(id) on delete cascade,

    -- Link to consultation (optional - can create standalone proposals)
    consultation_id uuid references consultations(id) on delete set null,

    -- Unified Client link (SvelteKit compatibility)
    client_id uuid,

    -- Document identification
    proposal_number varchar(50) not null,  -- PROP-2025-0001
    slug varchar(100) not null unique,     -- Public URL slug

    -- Status workflow: draft, sent, viewed, accepted, declined, expired
    status varchar(50) not null default 'draft',

    -- Client info (denormalized for standalone proposals or overrides)
    client_business_name text not null default '',
    client_contact_name text not null default '',
    client_email varchar(255) not null default '',
    client_phone varchar(50) not null default '',
    client_website text not null default '',

    -- Cover & Introduction
    title text not null default 'Website Proposal',
    cover_image text,  -- Optional hero image URL

    -- Performance Analysis (manual entry after PageSpeed audit)
    performance_data jsonb not null default '{}',
    -- { performance: 45, accessibility: 78, bestPractices: 82, seo: 65, loadTime: '4.2s', issues: [...] }

    -- The Opportunity (manual research about client's industry/business)
    opportunity_content text not null default '',

    -- Current Issues (checklist items)
    current_issues jsonb not null default '[]',
    -- [{ text: 'Site is not mobile responsive', checked: true }, ...]

    -- Compliance Issues (optional section)
    compliance_issues jsonb not null default '[]',
    -- [{ text: 'WCAG accessibility standards not met', checked: true }, ...]

    -- ROI Analysis (optional section)
    roi_analysis jsonb not null default '{}',
    -- { currentVisitors: 500, projectedVisitors: 1500, conversionRate: 2.5, projectedLeads: 37 }

    -- Performance Standards (metrics the new site will achieve)
    performance_standards jsonb not null default '[]',
    -- [{ label: 'Page Load', value: '<2s' }, { label: 'Mobile Score', value: '95+' }, ...]

    -- Local Advantage (optional section for local SEO focus)
    local_advantage_content text not null default '',

    -- Site Architecture (proposed pages)
    proposed_pages jsonb not null default '[]',
    -- [{ name: 'Home', description: 'Modern homepage with...', features: [...] }, ...]

    -- Implementation Timeline
    timeline jsonb not null default '[]',
    -- [{ week: '1-2', title: 'Discovery & Design', description: '...' }, ...]

    -- Closing section
    closing_content text not null default '',

    -- Package selection
    selected_package_id uuid references organisation_packages(id) on delete set null,
    selected_addons jsonb not null default '[]',  -- addon IDs

    -- Price overrides (if different from package defaults)
    custom_pricing jsonb,  -- { setupFee, monthlyPrice, discountPercent, discountNote }

    -- Validity
    valid_until timestamptz,

    -- Tracking
    view_count integer not null default 0,
    last_viewed_at timestamptz,
    sent_at timestamptz,
    accepted_at timestamptz,
    declined_at timestamptz,

    -- Client response fields (PART 2: Proposal Improvements)
    client_comments text not null default '',           -- Optional comments when client accepts
    decline_reason text not null default '',            -- Optional reason when client declines
    revision_request_notes text not null default '',    -- Required notes for revision requests
    revision_requested_at timestamptz,

    -- New content sections (PART 2: Proposal Improvements)
    executive_summary text not null default '',         -- Brief proposal overview
    next_steps jsonb not null default '[]',             -- Array of {text, completed} items

    -- Consultation data cache (PART 2: Proposal Improvements)
    consultation_pain_points jsonb not null default '{}',   -- Cached from consultation
    consultation_goals jsonb not null default '{}',         -- Cached from consultation
    consultation_challenges jsonb not null default '[]',    -- Array of challenge strings

    -- Creator
    created_by uuid references users(id) on delete set null,

    constraint valid_proposal_status check (status in ('draft', 'ready', 'sent', 'viewed', 'accepted', 'declined', 'revision_requested', 'expired')),
    constraint proposals_organisation_number_unique unique (organisation_id, proposal_number)
);

-- Indexes for proposals
create index if not exists idx_proposals_organisation_id on proposals(organisation_id);
create index if not exists idx_proposals_consultation_id on proposals(consultation_id);
create index if not exists idx_proposals_status on proposals(status);
create index if not exists idx_proposals_slug on proposals(slug);
create index if not exists idx_proposals_created_at on proposals(created_at desc);
create index if not exists idx_proposals_client_email on proposals(client_email);

-- =============================================================================
-- CONTRACTS (V2 Document Generation)
-- =============================================================================

-- create "contract_templates" table - Organisation contract configuration
create table if not exists contract_templates (
    id uuid primary key not null default gen_random_uuid(),
    created_at timestamptz not null default current_timestamp,
    updated_at timestamptz not null default current_timestamp,

    organisation_id uuid not null references organisations(id) on delete cascade,

    name varchar(255) not null,
    description text not null default '',
    version integer not null default 1,

    cover_page_config jsonb not null default '{}',
    terms_content text not null default '',
    signature_config jsonb not null default '{}',

    is_default boolean not null default false,
    is_active boolean not null default true,

    created_by uuid references users(id) on delete set null
);

create index if not exists idx_contract_templates_organisation_id on contract_templates(organisation_id);
create index if not exists idx_contract_templates_active on contract_templates(organisation_id, is_active);

-- create "contract_schedules" table - Package-specific terms
create table if not exists contract_schedules (
    id uuid primary key not null default gen_random_uuid(),
    created_at timestamptz not null default current_timestamp,
    updated_at timestamptz not null default current_timestamp,

    template_id uuid not null references contract_templates(id) on delete cascade,
    package_id uuid references organisation_packages(id) on delete set null,

    name varchar(255) not null,
    display_order integer not null default 0,
    -- Category for organizing the reusable schedule library
    section_category varchar(100) not null default 'custom',
    content text not null default '',

    is_active boolean not null default true
);

create index if not exists idx_contract_schedules_template_id on contract_schedules(template_id);
create index if not exists idx_contract_schedules_package_id on contract_schedules(package_id);

-- create "contracts" table - Generated from proposals
create table if not exists contracts (
    id uuid primary key not null default gen_random_uuid(),
    created_at timestamptz not null default current_timestamp,
    updated_at timestamptz not null default current_timestamp,

    organisation_id uuid not null references organisations(id) on delete cascade,
    proposal_id uuid not null references proposals(id) on delete cascade,
    template_id uuid references contract_templates(id) on delete set null,

    -- Unified Client link (SvelteKit compatibility)
    client_id uuid,

    contract_number varchar(50) not null,
    slug varchar(100) not null unique,
    version integer not null default 1,
    status varchar(50) not null default 'draft',

    client_business_name text not null default '',
    client_contact_name text not null default '',
    client_email varchar(255) not null default '',
    client_phone varchar(50) not null default '',
    client_address text not null default '',

    services_description text not null default '',
    commencement_date timestamptz,
    completion_date timestamptz,
    special_conditions text not null default '',

    total_price decimal(10,2) not null default 0,
    price_includes_gst boolean not null default true,
    payment_terms text not null default '',

    generated_cover_html text,
    generated_terms_html text,
    generated_schedule_html text,

    valid_until timestamptz,

    organisation_signatory_name varchar(255),
    organisation_signatory_title varchar(100),
    organisation_signed_at timestamptz,

    client_signatory_name varchar(255),
    client_signatory_title varchar(100),
    client_signed_at timestamptz,
    client_signature_ip varchar(50),
    client_signature_user_agent text,

    view_count integer not null default 0,
    last_viewed_at timestamptz,
    sent_at timestamptz,

    signed_pdf_url text,

    -- Field visibility - array of field keys to show on public view
    visible_fields jsonb not null default '["services","commencementDate","completionDate","price","paymentTerms","specialConditions"]',
    -- Schedule sections to include from library (array of schedule IDs)
    included_schedule_ids jsonb not null default '[]',

    created_by uuid references users(id) on delete set null,

    constraint valid_contract_status check (status in ('draft', 'sent', 'viewed', 'signed', 'completed', 'expired', 'terminated')),
    constraint contracts_organisation_number_unique unique (organisation_id, contract_number)
);

create index if not exists idx_contracts_organisation_id on contracts(organisation_id);
create index if not exists idx_contracts_proposal_id on contracts(proposal_id);
create index if not exists idx_contracts_status on contracts(status);
create index if not exists idx_contracts_slug on contracts(slug);
create index if not exists idx_contracts_created_at on contracts(created_at desc);

-- create "invoices" table
create table if not exists invoices (
    id uuid primary key not null default gen_random_uuid(),
    created_at timestamptz not null default current_timestamp,
    updated_at timestamptz not null default current_timestamp,

    organisation_id uuid not null references organisations(id) on delete cascade,
    proposal_id uuid references proposals(id) on delete set null,
    contract_id uuid references contracts(id) on delete set null,

    -- Unified Client link (SvelteKit compatibility)
    client_id uuid,

    invoice_number varchar(50) not null,
    slug varchar(100) not null unique,
    status varchar(50) not null default 'draft',

    client_business_name text not null,
    client_contact_name text not null default '',
    client_email varchar(255) not null,
    client_phone varchar(50) not null default '',
    client_address text not null default '',
    client_abn varchar(20) not null default '',

    issue_date timestamptz not null,
    due_date timestamptz not null,

    subtotal decimal(10,2) not null,
    discount_amount decimal(10,2) not null default 0.00,
    discount_description text not null default '',
    gst_amount decimal(10,2) not null default 0.00,
    total decimal(10,2) not null,

    gst_registered boolean not null default true,
    gst_rate decimal(5,2) not null default 10.00,

    payment_terms varchar(50) not null default 'NET_14',
    payment_terms_custom text not null default '',

    notes text not null default '',
    public_notes text not null default '',

    view_count integer not null default 0,
    last_viewed_at timestamptz,
    sent_at timestamptz,
    paid_at timestamptz,

    payment_method varchar(50),
    payment_reference text,
    payment_notes text,

    pdf_url text,
    pdf_generated_at timestamptz,

    -- Stripe Payment
    stripe_payment_link_id varchar(255),
    stripe_payment_link_url text,
    stripe_payment_intent_id varchar(255),
    stripe_checkout_session_id varchar(255),
    online_payment_enabled boolean not null default true,

    created_by uuid references users(id) on delete set null,

    constraint valid_invoice_status check (status in ('draft', 'sent', 'viewed', 'paid', 'overdue', 'cancelled', 'refunded')),
    constraint invoices_organisation_number_unique unique (organisation_id, invoice_number)
);

create index if not exists idx_invoices_organisation_id on invoices(organisation_id);
create index if not exists idx_invoices_status on invoices(status);
create index if not exists idx_invoices_due_date on invoices(due_date);
create index if not exists idx_invoices_slug on invoices(slug);
create index if not exists idx_invoices_number on invoices(organisation_id, invoice_number);

-- create "invoice_line_items" table
create table if not exists invoice_line_items (
    id uuid primary key not null default gen_random_uuid(),
    created_at timestamptz not null default current_timestamp,
    updated_at timestamptz not null default current_timestamp,

    invoice_id uuid not null references invoices(id) on delete cascade,

    description text not null,
    quantity decimal(10,2) not null default 1.00,
    unit_price decimal(10,2) not null,
    amount decimal(10,2) not null,

    is_taxable boolean not null default true,
    sort_order integer not null default 0,
    category varchar(50),

    package_id uuid references organisation_packages(id) on delete set null,
    addon_id uuid references organisation_addons(id) on delete set null
);

create index if not exists idx_invoice_line_items_invoice_id on invoice_line_items(invoice_id);

-- create "email_logs" table for tracking sent emails
create table if not exists email_logs (
    id uuid primary key not null default gen_random_uuid(),
    created_at timestamptz not null default current_timestamp,

    -- Organisation scope
    organisation_id uuid not null references organisations(id) on delete cascade,

    -- Related entities (all optional, at least one should be set)
    proposal_id uuid references proposals(id) on delete set null,
    invoice_id uuid references invoices(id) on delete set null,
    contract_id uuid references contracts(id) on delete set null,
    form_submission_id uuid references form_submissions(id) on delete set null,

    -- Email type
    email_type varchar(50) not null,

    -- Email details
    recipient_email varchar(255) not null,
    recipient_name varchar(255),
    subject varchar(500) not null,
    body_html text not null,

    -- Attachment info
    has_attachment boolean not null default false,
    attachment_filename varchar(255),

    -- Resend tracking
    resend_message_id varchar(100),

    -- Status: pending, sent, delivered, opened, bounced, failed
    status varchar(50) not null default 'pending',

    sent_at timestamptz,
    delivered_at timestamptz,
    opened_at timestamptz,

    -- Error handling
    error_message text,
    retry_count integer not null default 0,

    -- Sender info
    sent_by uuid references users(id) on delete set null
);

-- Indexes for email_logs
create index if not exists idx_email_logs_organisation_id on email_logs(organisation_id);
create index if not exists idx_email_logs_proposal_id on email_logs(proposal_id);
create index if not exists idx_email_logs_invoice_id on email_logs(invoice_id);
create index if not exists idx_email_logs_contract_id on email_logs(contract_id);
create index if not exists idx_email_logs_status on email_logs(status);
create index if not exists idx_email_logs_created_at on email_logs(created_at);

-- Deferred FKs for form_submissions (tables defined after form_submissions)
alter table form_submissions add constraint form_submissions_client_id_fkey
    foreign key (client_id) references clients(id) on delete set null;
alter table form_submissions add constraint form_submissions_proposal_id_fkey
    foreign key (proposal_id) references proposals(id) on delete set null;
alter table form_submissions add constraint form_submissions_contract_id_fkey
    foreign key (contract_id) references contracts(id) on delete set null;

-- create "questionnaire_responses" table for Initial Website Questionnaire
create table if not exists questionnaire_responses (
    id uuid primary key not null default gen_random_uuid(),
    created_at timestamptz not null default current_timestamp,
    updated_at timestamptz not null default current_timestamp,

    -- Organisation scope
    organisation_id uuid not null references organisations(id) on delete cascade,

    -- Public URL slug (questionnaire's own slug for access)
    slug varchar(100) not null unique,

    -- Optional links to other entities (all nullable for standalone questionnaires)
    contract_id uuid references contracts(id) on delete set null,
    proposal_id uuid references proposals(id) on delete set null,
    consultation_id uuid references consultations(id) on delete set null,

    -- Client identification (for standalone questionnaires without linked entities)
    client_business_name text not null default '',
    client_email varchar(255) not null default '',

    -- All responses stored as JSONB (39 fields across 8 sections)
    responses jsonb not null default '{}',

    -- Progress tracking
    current_section integer not null default 0,
    completion_percentage integer not null default 0,

    -- Status: not_started, in_progress, completed
    status varchar(50) not null default 'not_started',

    -- Timestamps
    started_at timestamptz,
    completed_at timestamptz,
    last_activity_at timestamptz default current_timestamp
);

-- Indexes for questionnaire_responses
create index if not exists idx_questionnaire_responses_organisation_id on questionnaire_responses(organisation_id);
create index if not exists idx_questionnaire_responses_slug on questionnaire_responses(slug);
create index if not exists idx_questionnaire_responses_contract_id on questionnaire_responses(contract_id);
create index if not exists idx_questionnaire_responses_proposal_id on questionnaire_responses(proposal_id);
create index if not exists idx_questionnaire_responses_status on questionnaire_responses(organisation_id, status);

