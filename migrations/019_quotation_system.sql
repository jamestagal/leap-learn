-- Migration 019: Quotation System
--
-- Creates the quotation system tables for building and sending client quotations.
-- Includes reusable scope templates, terms templates, parent quotation templates,
-- junction tables linking templates to their building blocks, the main quotations
-- table, and per-quotation scope sections.
-- Also adds quotation-related columns to organisation_profiles, invoices, and email_logs.
--
-- All statements are idempotent (IF NOT EXISTS / IF EXISTS).

-- ============================================================================
-- 1. quotation_scope_templates - Reusable work item blocks
-- ============================================================================
CREATE TABLE IF NOT EXISTS quotation_scope_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    category VARCHAR(100),
    work_items JSONB NOT NULL DEFAULT '[]'::jsonb,
    default_price DECIMAL(10,2),
    is_active BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_quotation_scope_templates_organisation
    ON quotation_scope_templates(organisation_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_quotation_scope_templates_organisation_slug
    ON quotation_scope_templates(organisation_id, slug);

-- ============================================================================
-- 2. quotation_terms_templates - Reusable terms blocks
-- ============================================================================
CREATE TABLE IF NOT EXISTS quotation_terms_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    is_default BOOLEAN NOT NULL DEFAULT false,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_quotation_terms_templates_organisation
    ON quotation_terms_templates(organisation_id);

-- ============================================================================
-- 3. quotation_templates - Parent templates
-- ============================================================================
CREATE TABLE IF NOT EXISTS quotation_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    category VARCHAR(100),
    default_validity_days INTEGER,
    is_default BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_quotation_templates_organisation
    ON quotation_templates(organisation_id);

CREATE INDEX IF NOT EXISTS idx_quotation_templates_organisation_active
    ON quotation_templates(organisation_id, is_active);

-- ============================================================================
-- 4. quotation_template_sections - Junction: template -> scope templates
-- ============================================================================
CREATE TABLE IF NOT EXISTS quotation_template_sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES quotation_templates(id) ON DELETE CASCADE,
    scope_template_id UUID NOT NULL REFERENCES quotation_scope_templates(id) ON DELETE CASCADE,
    default_section_price DECIMAL(10,2),
    sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_quotation_template_sections_template
    ON quotation_template_sections(template_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_quotation_template_sections_unique
    ON quotation_template_sections(template_id, scope_template_id);

-- ============================================================================
-- 5. quotation_template_terms - Junction: template -> terms templates
-- ============================================================================
CREATE TABLE IF NOT EXISTS quotation_template_terms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES quotation_templates(id) ON DELETE CASCADE,
    terms_template_id UUID NOT NULL REFERENCES quotation_terms_templates(id) ON DELETE CASCADE,
    sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_quotation_template_terms_template
    ON quotation_template_terms(template_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_quotation_template_terms_unique
    ON quotation_template_terms(template_id, terms_template_id);

-- ============================================================================
-- 6. quotations - Main quotation document
-- ============================================================================
CREATE TABLE IF NOT EXISTS quotations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    template_id UUID REFERENCES quotation_templates(id) ON DELETE SET NULL,
    quotation_number VARCHAR(50) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    quotation_name TEXT NOT NULL DEFAULT '',
    status VARCHAR(50) NOT NULL DEFAULT 'draft',
    client_business_name TEXT NOT NULL DEFAULT '',
    client_contact_name TEXT NOT NULL DEFAULT '',
    client_email VARCHAR(255) NOT NULL DEFAULT '',
    client_phone VARCHAR(50) NOT NULL DEFAULT '',
    client_address TEXT NOT NULL DEFAULT '',
    site_address TEXT NOT NULL DEFAULT '',
    site_reference TEXT NOT NULL DEFAULT '',
    prepared_date TIMESTAMPTZ NOT NULL,
    expiry_date TIMESTAMPTZ NOT NULL,
    subtotal DECIMAL(10,2) NOT NULL,
    discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    discount_description TEXT NOT NULL DEFAULT '',
    gst_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    total DECIMAL(10,2) NOT NULL,
    gst_registered BOOLEAN NOT NULL DEFAULT true,
    gst_rate DECIMAL(5,2) NOT NULL DEFAULT 10.00,
    terms_blocks JSONB NOT NULL DEFAULT '[]'::jsonb,
    options_notes TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    view_count INTEGER NOT NULL DEFAULT 0,
    last_viewed_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    declined_at TIMESTAMPTZ,
    decline_reason TEXT NOT NULL DEFAULT '',
    accepted_by_name VARCHAR(255),
    accepted_by_title VARCHAR(255),
    accepted_at TIMESTAMPTZ,
    acceptance_ip VARCHAR(50),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_quotations_organisation
    ON quotations(organisation_id);

CREATE INDEX IF NOT EXISTS idx_quotations_client
    ON quotations(client_id);

CREATE INDEX IF NOT EXISTS idx_quotations_status
    ON quotations(status);

CREATE INDEX IF NOT EXISTS idx_quotations_slug
    ON quotations(slug);

CREATE UNIQUE INDEX IF NOT EXISTS idx_quotations_organisation_number
    ON quotations(organisation_id, quotation_number);

-- ============================================================================
-- 7. quotation_scope_sections - Per-quotation scope sections
-- ============================================================================
CREATE TABLE IF NOT EXISTS quotation_scope_sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    quotation_id UUID NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    work_items JSONB NOT NULL DEFAULT '[]'::jsonb,
    section_price DECIMAL(10,2),
    section_gst DECIMAL(10,2),
    section_total DECIMAL(10,2),
    sort_order INTEGER NOT NULL DEFAULT 0,
    scope_template_id UUID REFERENCES quotation_scope_templates(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_quotation_scope_sections_quotation
    ON quotation_scope_sections(quotation_id);

-- ============================================================================
-- Column additions to existing tables
-- ============================================================================

-- organisation_profiles: quotation numbering and defaults
ALTER TABLE organisation_profiles
    ADD COLUMN IF NOT EXISTS quotation_prefix VARCHAR(20) NOT NULL DEFAULT 'QUO';

ALTER TABLE organisation_profiles
    ADD COLUMN IF NOT EXISTS next_quotation_number INTEGER NOT NULL DEFAULT 1;

ALTER TABLE organisation_profiles
    ADD COLUMN IF NOT EXISTS default_quotation_validity_days INTEGER NOT NULL DEFAULT 60;

-- invoices: link to source quotation
ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS quotation_id UUID REFERENCES quotations(id) ON DELETE SET NULL;

-- email_logs: link to quotation
ALTER TABLE email_logs
    ADD COLUMN IF NOT EXISTS quotation_id UUID REFERENCES quotations(id) ON DELETE SET NULL;
