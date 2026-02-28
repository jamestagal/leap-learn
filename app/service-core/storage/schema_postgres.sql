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
-- =============================================================================

-- Enable required extensions
create extension if not exists pg_trgm;

-- =============================================================================
-- AUTH & USERS (Go backend queries these directly)
-- =============================================================================

create table if not exists tokens (
    id text primary key not null,
    expires timestamptz not null,
    target text not null,
    callback text not null default ''
);

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
    default_organisation_id uuid,
    suspended boolean not null default false,
    suspended_at timestamptz,
    suspended_reason text,
    unique (email, sub)
);

-- =============================================================================
-- ORGANISATIONS (Go backend resolves slugs, checks memberships)
-- =============================================================================

create table if not exists organisations (
    id uuid primary key not null default gen_random_uuid(),
    created_at timestamptz not null default current_timestamp,
    updated_at timestamptz not null default current_timestamp,
    name text not null,
    slug text not null unique,
    logo_url text not null default '',
    logo_avatar_url text not null default '',
    primary_color text not null default '#4F46E5',
    secondary_color text not null default '#1E40AF',
    accent_color text not null default '#F59E0B',
    accent_gradient text not null default '',
    email text not null default '',
    phone text not null default '',
    website text not null default '',
    status varchar(50) not null default 'active',
    subscription_tier varchar(50) not null default 'free',
    subscription_id text not null default '',
    subscription_end timestamptz,
    stripe_customer_id text not null default '',
    ai_generations_this_month integer not null default 0,
    ai_generations_reset_at timestamptz,
    is_freemium boolean not null default false,
    freemium_reason varchar(50),
    freemium_expires_at timestamptz,
    freemium_granted_at timestamptz,
    freemium_granted_by varchar(255),
    deleted_at timestamptz,
    deletion_scheduled_for timestamptz,
    constraint valid_organisation_status check (status in ('active', 'suspended', 'cancelled'))
);

create table if not exists organisation_memberships (
    id uuid primary key not null default gen_random_uuid(),
    created_at timestamptz not null default current_timestamp,
    updated_at timestamptz not null default current_timestamp,
    user_id uuid not null references users(id) on delete cascade,
    organisation_id uuid not null references organisations(id) on delete cascade,
    role varchar(50) not null default 'member',
    display_name text not null default '',
    status varchar(50) not null default 'active',
    invited_at timestamptz,
    invited_by uuid references users(id) on delete set null,
    accepted_at timestamptz,
    unique(user_id, organisation_id),
    constraint valid_membership_role check (role in ('owner', 'admin', 'member')),
    constraint valid_membership_status check (status in ('active', 'invited', 'suspended'))
);

-- =============================================================================
-- H5P LIBRARIES (Platform-wide — Go Hub API serves these)
-- =============================================================================

create table if not exists h5p_libraries (
    id uuid primary key not null default gen_random_uuid(),
    created_at timestamptz not null default current_timestamp,
    updated_at timestamptz not null default current_timestamp,
    machine_name varchar(255) not null,
    major_version integer not null,
    minor_version integer not null,
    patch_version integer not null,
    title text not null default '',
    origin varchar(20) not null default 'official',
    metadata_json jsonb,
    categories text[],
    keywords text[],
    screenshots text[],
    description text not null default '',
    icon_path text,
    package_path text,
    extracted_path text,
    runnable boolean not null default false,
    restricted boolean not null default false,
    unique (machine_name, major_version, minor_version, patch_version),
    constraint valid_origin check (origin in ('official', 'custom'))
);

create table if not exists h5p_library_dependencies (
    id uuid primary key not null default gen_random_uuid(),
    library_id uuid not null references h5p_libraries(id) on delete cascade,
    depends_on_id uuid not null references h5p_libraries(id) on delete cascade,
    dependency_type varchar(20) not null,
    unique (library_id, depends_on_id, dependency_type),
    constraint valid_dependency_type check (dependency_type in ('preloaded', 'dynamic', 'editor'))
);

create table if not exists h5p_org_libraries (
    id uuid primary key not null default gen_random_uuid(),
    created_at timestamptz not null default current_timestamp,
    org_id uuid not null references organisations(id) on delete cascade,
    library_id uuid not null references h5p_libraries(id) on delete cascade,
    enabled boolean not null default true,
    restricted boolean not null default false,
    unique (org_id, library_id)
);

-- =============================================================================
-- H5P CONTENT (Organisation-scoped — Go serves content files from R2)
-- =============================================================================

create table if not exists h5p_content (
    id uuid primary key not null default gen_random_uuid(),
    created_at timestamptz not null default current_timestamp,
    updated_at timestamptz not null default current_timestamp,
    org_id uuid not null references organisations(id) on delete cascade,
    library_id uuid not null references h5p_libraries(id),
    created_by uuid references users(id) on delete set null,
    title text not null,
    slug text not null,
    description text not null default '',
    content_json jsonb not null default '{}',
    tags text[],
    folder_path text,
    storage_path text,
    status varchar(20) not null default 'draft',
    deleted_at timestamptz,
    unique (org_id, slug),
    constraint valid_content_status check (status in ('draft', 'published', 'archived'))
);

create table if not exists h5p_content_folders (
    id uuid primary key not null default gen_random_uuid(),
    created_at timestamptz not null default current_timestamp,
    updated_at timestamptz not null default current_timestamp,
    org_id uuid not null references organisations(id) on delete cascade,
    parent_id uuid references h5p_content_folders(id) on delete set null,
    name text not null,
    unique (org_id, parent_id, name)
);

-- =============================================================================
-- H5P HUB (Go serves Hub API endpoints)
-- =============================================================================

create table if not exists h5p_hub_registrations (
    id uuid primary key not null default gen_random_uuid(),
    created_at timestamptz not null default current_timestamp,
    updated_at timestamptz not null default current_timestamp,
    org_id uuid not null unique references organisations(id) on delete cascade,
    site_key text not null default '',
    site_secret text not null default '',
    hub_url text not null default 'https://hub-api.h5p.org'
);

create table if not exists h5p_hub_cache (
    id uuid primary key not null default gen_random_uuid(),
    created_at timestamptz not null default current_timestamp,
    cache_key text not null unique,
    data jsonb not null default '{}',
    expires_at timestamptz not null
);

-- =============================================================================
-- COURSES (Go may serve course content APIs)
-- =============================================================================

create table if not exists courses (
    id uuid primary key not null default gen_random_uuid(),
    created_at timestamptz not null default current_timestamp,
    updated_at timestamptz not null default current_timestamp,
    org_id uuid not null references organisations(id) on delete cascade,
    created_by uuid references users(id) on delete set null,
    title text not null,
    slug text not null,
    description text not null default '',
    cover_image text,
    status varchar(20) not null default 'draft',
    deleted_at timestamptz,
    unique (org_id, slug),
    constraint valid_course_status check (status in ('draft', 'published', 'archived'))
);

create table if not exists course_items (
    id uuid primary key not null default gen_random_uuid(),
    created_at timestamptz not null default current_timestamp,
    updated_at timestamptz not null default current_timestamp,
    course_id uuid not null references courses(id) on delete cascade,
    content_id uuid references h5p_content(id) on delete set null,
    sort_order integer not null default 0,
    title text not null default '',
    item_type varchar(20) not null default 'h5p',
    constraint valid_item_type check (item_type in ('h5p', 'text', 'video', 'link'))
);

-- =============================================================================
-- ANALYTICS (Go receives xAPI statements)
-- =============================================================================

create table if not exists enrolments (
    id uuid primary key not null default gen_random_uuid(),
    created_at timestamptz not null default current_timestamp,
    updated_at timestamptz not null default current_timestamp,
    org_id uuid not null references organisations(id) on delete cascade,
    course_id uuid not null references courses(id) on delete cascade,
    user_id uuid not null references users(id) on delete cascade,
    status varchar(20) not null default 'active',
    enrolled_at timestamptz not null default current_timestamp,
    completed_at timestamptz,
    unique (course_id, user_id),
    constraint valid_enrolment_status check (status in ('active', 'completed', 'withdrawn'))
);

create table if not exists progress_records (
    id uuid primary key not null default gen_random_uuid(),
    created_at timestamptz not null default current_timestamp,
    updated_at timestamptz not null default current_timestamp,
    org_id uuid not null references organisations(id) on delete cascade,
    enrolment_id uuid not null references enrolments(id) on delete cascade,
    content_id uuid not null references h5p_content(id) on delete cascade,
    user_id uuid not null references users(id) on delete cascade,
    score numeric(5,2),
    max_score numeric(5,2),
    completion numeric(5,4) not null default 0,
    completed boolean not null default false,
    attempts integer not null default 0,
    time_spent integer not null default 0,
    unique (enrolment_id, content_id)
);

create table if not exists xapi_statements (
    id uuid primary key not null default gen_random_uuid(),
    created_at timestamptz not null default current_timestamp,
    org_id uuid not null references organisations(id) on delete cascade,
    user_id uuid not null references users(id) on delete cascade,
    content_id uuid references h5p_content(id) on delete set null,
    verb varchar(255) not null,
    statement jsonb not null
);
