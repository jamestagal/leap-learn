-- Migration 007: Add consultation option sets and customData/formId columns
-- Idempotent: safe to run multiple times

-- ============================================================
-- New Option Sets
-- ============================================================

-- Website Status (3 options)
INSERT INTO field_option_sets (id, slug, name, description, options, is_system, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'website-status',
  'Website Status',
  'Current state of client website',
  '[
    {"value": "none", "label": "No Current Website"},
    {"value": "refresh", "label": "Needs Refresh"},
    {"value": "rebuild", "label": "Complete Rebuild"}
  ]'::jsonb,
  true,
  NOW(),
  NOW()
)
ON CONFLICT ON CONSTRAINT field_option_sets_organisation_id_slug_key DO NOTHING;

-- Conversion Goals (7 options)
INSERT INTO field_option_sets (id, slug, name, description, options, is_system, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'conversion-goals',
  'Conversion Goals',
  'Desired conversion actions for website',
  '[
    {"value": "phone-calls", "label": "Phone Calls"},
    {"value": "form-submissions", "label": "Form Submissions"},
    {"value": "email-inquiries", "label": "Email Inquiries"},
    {"value": "bookings", "label": "Bookings / Appointments"},
    {"value": "purchases", "label": "Online Purchases"},
    {"value": "quote-requests", "label": "Quote Requests"},
    {"value": "newsletter-signups", "label": "Newsletter Signups"}
  ]'::jsonb,
  true,
  NOW(),
  NOW()
)
ON CONFLICT ON CONSTRAINT field_option_sets_organisation_id_slug_key DO NOTHING;

-- Design Styles (5 options)
INSERT INTO field_option_sets (id, slug, name, description, options, is_system, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'design-styles',
  'Design Styles',
  'Visual design style preferences',
  '[
    {"value": "modern-clean", "label": "Modern & Clean"},
    {"value": "bold-creative", "label": "Bold & Creative"},
    {"value": "corporate-professional", "label": "Corporate & Professional"},
    {"value": "minimalist", "label": "Minimalist"},
    {"value": "traditional-classic", "label": "Traditional & Classic"}
  ]'::jsonb,
  true,
  NOW(),
  NOW()
)
ON CONFLICT ON CONSTRAINT field_option_sets_organisation_id_slug_key DO NOTHING;

-- ============================================================
-- Update Existing Option Sets
-- ============================================================

-- Urgency Levels - match hardcoded labels
UPDATE field_option_sets
SET options = '[
  {"value": "low", "label": "Low - Exploratory phase"},
  {"value": "medium", "label": "Medium - Planning for next quarter"},
  {"value": "high", "label": "High - Need to start within weeks"},
  {"value": "critical", "label": "Critical - Urgent need"}
]'::jsonb,
updated_at = NOW()
WHERE slug = 'urgency-levels' AND organisation_id IS NULL;

-- Budget Ranges - match hardcoded values
UPDATE field_option_sets
SET options = '[
  {"value": "under-2k", "label": "Under $2,000"},
  {"value": "2k-5k", "label": "$2,000 - $5,000"},
  {"value": "5k-10k", "label": "$5,000 - $10,000"},
  {"value": "10k-20k", "label": "$10,000 - $20,000"},
  {"value": "20k-plus", "label": "$20,000+"},
  {"value": "tbd", "label": "To Be Determined"}
]'::jsonb,
updated_at = NOW()
WHERE slug = 'budget-ranges' AND organisation_id IS NULL;

-- Primary Challenges - merge with hardcoded values
UPDATE field_option_sets
SET options = '[
  {"value": "lead-generation", "label": "Lead Generation"},
  {"value": "conversion-rate", "label": "Low Conversion Rates"},
  {"value": "brand-awareness", "label": "Brand Awareness"},
  {"value": "customer-retention", "label": "Customer Retention"},
  {"value": "competition", "label": "Competitive Pressure"},
  {"value": "technology-adoption", "label": "Technology Adoption"},
  {"value": "customer-experience", "label": "Customer Experience"},
  {"value": "digital-transformation", "label": "Digital Transformation"},
  {"value": "outdated-website", "label": "Outdated Website"},
  {"value": "poor-mobile", "label": "Poor Mobile Experience"},
  {"value": "seo-issues", "label": "SEO / Search Visibility"},
  {"value": "no-online-presence", "label": "No Online Presence"},
  {"value": "credibility", "label": "Lack of Credibility/Trust"},
  {"value": "manual-processes", "label": "Too Many Manual Processes"},
  {"value": "other", "label": "Other"}
]'::jsonb,
updated_at = NOW()
WHERE slug = 'primary-challenges' AND organisation_id IS NULL;

-- Primary Goals - match hardcoded values
UPDATE field_option_sets
SET options = '[
  {"value": "increase-revenue", "label": "Increase Revenue"},
  {"value": "generate-leads", "label": "Generate More Leads"},
  {"value": "improve-conversion", "label": "Improve Conversion Rates"},
  {"value": "build-brand", "label": "Build Brand Awareness"},
  {"value": "launch-product", "label": "Launch New Product/Service"},
  {"value": "improve-retention", "label": "Improve Customer Retention"},
  {"value": "enhance-experience", "label": "Enhance Customer Experience"},
  {"value": "digital-presence", "label": "Establish Digital Presence"},
  {"value": "competitive-advantage", "label": "Gain Competitive Advantage"},
  {"value": "automate-processes", "label": "Automate Business Processes"},
  {"value": "credibility", "label": "Build Credibility & Trust"},
  {"value": "other", "label": "Other"}
]'::jsonb,
updated_at = NOW()
WHERE slug = 'primary-goals' AND organisation_id IS NULL;

-- ============================================================
-- Add customData and formId columns to consultations
-- ============================================================

-- Add customData for unmapped dynamic form fields
ALTER TABLE consultations
ADD COLUMN IF NOT EXISTS custom_data JSONB DEFAULT '{}';

-- Add formId to track which form was used
ALTER TABLE consultations
ADD COLUMN IF NOT EXISTS form_id UUID REFERENCES organisation_forms(id) ON DELETE SET NULL;

-- Index for form_id lookups
CREATE INDEX IF NOT EXISTS idx_consultations_form_id ON consultations(form_id);
