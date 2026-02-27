-- Migration 027: Strip Webkit business domain tables
-- LeapLearn fork: Remove contracts, proposals, invoices, quotations, content intelligence

DROP TABLE IF EXISTS quotations CASCADE;
DROP TABLE IF EXISTS quotation_templates CASCADE;
DROP TABLE IF EXISTS quotation_terms_templates CASCADE;
DROP TABLE IF EXISTS quotation_scope_templates CASCADE;
DROP TABLE IF EXISTS contract_schedules CASCADE;
DROP TABLE IF EXISTS contracts CASCADE;
DROP TABLE IF EXISTS contract_templates CASCADE;
DROP TABLE IF EXISTS proposals CASCADE;
DROP TABLE IF EXISTS organisation_proposal_templates CASCADE;
DROP TABLE IF EXISTS invoices CASCADE;
DROP TABLE IF EXISTS email_logs CASCADE;
DROP TABLE IF EXISTS page_content_copy CASCADE;
DROP TABLE IF EXISTS seo_audits CASCADE;
DROP TABLE IF EXISTS brand_profiles CASCADE;
DROP TABLE IF EXISTS content_crawl_jobs CASCADE;
DROP TABLE IF EXISTS organisation_document_branding CASCADE;
DROP TABLE IF EXISTS consultation_versions CASCADE;
DROP TABLE IF EXISTS consultation_drafts CASCADE;
DROP TABLE IF EXISTS consultations CASCADE;
