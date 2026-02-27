-- Migration 012: Add foreign key constraints to form_submissions
-- Clean orphaned references first, then add FK constraints

-- Clean orphaned proposal references
UPDATE form_submissions SET proposal_id = NULL
WHERE proposal_id IS NOT NULL AND proposal_id NOT IN (SELECT id FROM proposals);

-- Clean orphaned contract references
UPDATE form_submissions SET contract_id = NULL
WHERE contract_id IS NOT NULL AND contract_id NOT IN (SELECT id FROM contracts);

-- Clean orphaned client references
UPDATE form_submissions SET client_id = NULL
WHERE client_id IS NOT NULL AND client_id NOT IN (SELECT id FROM clients);

-- Add FK: form_submissions.proposal_id -> proposals(id) ON DELETE SET NULL
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'form_submissions_proposal_id_fkey'
    ) THEN
        ALTER TABLE form_submissions ADD CONSTRAINT form_submissions_proposal_id_fkey
            FOREIGN KEY (proposal_id) REFERENCES proposals(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Add FK: form_submissions.contract_id -> contracts(id) ON DELETE SET NULL
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'form_submissions_contract_id_fkey'
    ) THEN
        ALTER TABLE form_submissions ADD CONSTRAINT form_submissions_contract_id_fkey
            FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Add FK: form_submissions.client_id -> clients(id) ON DELETE SET NULL
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'form_submissions_client_id_fkey'
    ) THEN
        ALTER TABLE form_submissions ADD CONSTRAINT form_submissions_client_id_fkey
            FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL;
    END IF;
END $$;
