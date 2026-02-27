CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER NOT NULL PRIMARY KEY,
    filename VARCHAR(255) NOT NULL,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Seed existing migrations (they've already been applied)
INSERT INTO schema_migrations (version, filename) VALUES
    (1, '001_add_organisations_freemium_columns.sql'),
    (2, '002_create_beta_invites_table.sql'),
    (3, '003_add_users_suspension_columns.sql'),
    (4, '004_form_builder_system.sql'),
    (5, '005_clients_system.sql'),
    (6, '006_form_templates_admin.sql'),
    (7, '007_consultation_option_sets.sql'),
    (8, '008_seed_full_discovery_template.sql'),
    (9, '009_add_stripe_customer_to_organisations.sql'),
    (10, '010_add_unique_doc_number_constraints.sql'),
    (11, '011_fix_schema_drift.sql'),
    (12, '012_add_form_submission_fks.sql'),
    (13, '013_create_migration_tracking.sql')
ON CONFLICT (version) DO NOTHING;
