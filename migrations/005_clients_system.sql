-- ============================================================================
-- CLIENTS SYSTEM - Consolidated Migration
-- Creates: clients table with status
-- Links: client_id on consultations, proposals, contracts, invoices, form_submissions
-- ============================================================================

-- ============================================================================
-- TABLE: clients
-- ============================================================================

CREATE TABLE IF NOT EXISTS clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,

    -- Client Information
    business_name TEXT NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    contact_name TEXT,
    notes TEXT,

    -- Status (active/archived)
    status VARCHAR(20) NOT NULL DEFAULT 'active',

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Unique constraint: one email per organisation
    CONSTRAINT clients_organisation_email_unique UNIQUE (organisation_id, email)
);

CREATE INDEX IF NOT EXISTS clients_organisation_idx ON clients(organisation_id);
CREATE INDEX IF NOT EXISTS clients_email_idx ON clients(email);
CREATE INDEX IF NOT EXISTS clients_status_idx ON clients(organisation_id, status);


-- ============================================================================
-- LINK: client_id on core entities
-- ============================================================================

-- Consultations
ALTER TABLE consultations
ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS consultations_client_idx ON consultations(client_id);

-- Proposals
ALTER TABLE proposals
ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS proposals_client_idx ON proposals(client_id);

-- Contracts
ALTER TABLE contracts
ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS contracts_client_idx ON contracts(client_id);

-- Invoices
ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS invoices_client_idx ON invoices(client_id);

-- Form Submissions (FK reference - column already exists from 004)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'form_submissions_client_id_fkey'
        AND table_name = 'form_submissions'
    ) THEN
        ALTER TABLE form_submissions
        ADD CONSTRAINT form_submissions_client_id_fkey
        FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL;
    END IF;
END $$;
