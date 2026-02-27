-- ============================================================================
-- FORM BUILDER SYSTEM - Consolidated Migration
-- Creates: organisation_forms, form_submissions, form_templates, field_option_sets
-- Seeds: field option sets, form templates (general + specialized)
-- Links: email_logs.form_submission_id
-- ============================================================================

-- ============================================================================
-- TABLE: organisation_forms (Design Time)
-- ============================================================================

CREATE TABLE IF NOT EXISTS organisation_forms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,

    -- Form Identification
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    description TEXT,
    form_type VARCHAR(50) NOT NULL CHECK (form_type IN (
        'questionnaire',
        'consultation',
        'feedback',
        'intake',
        'custom'
    )),

    -- Form Schema (JSON)
    schema JSONB NOT NULL,

    -- UI Configuration
    ui_config JSONB NOT NULL DEFAULT '{
        "layout": "single-column",
        "showProgressBar": true,
        "showStepNumbers": true,
        "submitButtonText": "Submit",
        "successMessage": "Thank you for your submission!"
    }'::jsonb,

    -- Branding Overrides (inherits from agency if null)
    branding JSONB DEFAULT NULL,

    -- Form Settings
    is_active BOOLEAN DEFAULT true,
    is_default BOOLEAN DEFAULT false,
    requires_auth BOOLEAN DEFAULT false,

    -- Metadata
    version INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES users(id),

    -- Constraints
    UNIQUE(organisation_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_organisation_forms_organisation_type ON organisation_forms(organisation_id, form_type);
CREATE INDEX IF NOT EXISTS idx_organisation_forms_active ON organisation_forms(organisation_id, is_active);
CREATE INDEX IF NOT EXISTS idx_organisation_forms_schema ON organisation_forms USING GIN (schema);


-- ============================================================================
-- TABLE: form_submissions (Runtime)
-- ============================================================================

CREATE TABLE IF NOT EXISTS form_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_id UUID REFERENCES organisation_forms(id) ON DELETE CASCADE,
    organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,

    -- Submission Data
    data JSONB NOT NULL,

    -- Public access slug
    slug VARCHAR(100),

    -- Client linking
    client_id UUID,  -- FK added after clients table created
    client_business_name TEXT NOT NULL DEFAULT '',
    client_email VARCHAR(255) NOT NULL DEFAULT '',

    -- Progress tracking
    current_step INTEGER NOT NULL DEFAULT 0,
    completion_percentage INTEGER NOT NULL DEFAULT 0,
    started_at TIMESTAMPTZ,
    last_activity_at TIMESTAMPTZ,

    -- Linked Entities
    consultation_id UUID REFERENCES consultations(id) ON DELETE SET NULL,
    proposal_id UUID,
    contract_id UUID,

    -- Submission Metadata
    metadata JSONB DEFAULT '{}'::jsonb,

    -- Status
    status VARCHAR(50) DEFAULT 'draft' CHECK (status IN (
        'draft',
        'completed',
        'processing',
        'processed',
        'archived'
    )),

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    submitted_at TIMESTAMP WITH TIME ZONE,
    processed_at TIMESTAMP WITH TIME ZONE,

    -- Form version at time of submission
    form_version INTEGER NOT NULL DEFAULT 1
);

CREATE UNIQUE INDEX IF NOT EXISTS form_submissions_slug_idx ON form_submissions(slug) WHERE slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_submissions_form ON form_submissions(form_id);
CREATE INDEX IF NOT EXISTS idx_submissions_organisation ON form_submissions(organisation_id);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON form_submissions(status);
CREATE INDEX IF NOT EXISTS idx_submissions_data ON form_submissions USING GIN (data);
CREATE INDEX IF NOT EXISTS idx_submissions_submitted ON form_submissions(submitted_at DESC);
CREATE INDEX IF NOT EXISTS form_submissions_client_idx ON form_submissions(client_id);
CREATE INDEX IF NOT EXISTS form_submissions_proposal_idx ON form_submissions(proposal_id);
CREATE INDEX IF NOT EXISTS form_submissions_contract_idx ON form_submissions(contract_id);


-- ============================================================================
-- TABLE: form_templates (System-wide starting points)
-- ============================================================================

CREATE TABLE IF NOT EXISTS form_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    category VARCHAR(100) NOT NULL,
    schema JSONB NOT NULL,
    ui_config JSONB NOT NULL,
    preview_image_url TEXT,
    is_featured BOOLEAN DEFAULT false,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- ============================================================================
-- TABLE: field_option_sets (Reusable dropdown options)
-- ============================================================================

CREATE TABLE IF NOT EXISTS field_option_sets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    description TEXT,
    options JSONB NOT NULL,
    is_system BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(organisation_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_field_option_sets_organisation ON field_option_sets(organisation_id);
CREATE INDEX IF NOT EXISTS idx_field_option_sets_system ON field_option_sets(is_system) WHERE is_system = true;


-- ============================================================================
-- LINK: email_logs.form_submission_id
-- ============================================================================

ALTER TABLE email_logs
ADD COLUMN IF NOT EXISTS form_submission_id UUID REFERENCES form_submissions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS email_logs_form_submission_idx ON email_logs(form_submission_id);

COMMENT ON COLUMN email_logs.email_type IS 'Types: proposal_sent, invoice_sent, contract_sent, form_sent, payment_reminder, custom';


-- ============================================================================
-- SEED: Field Option Sets (system-wide, organisation_id = NULL)
-- ============================================================================

INSERT INTO field_option_sets (name, slug, options, is_system) VALUES
('Industries', 'industries', '[
    {"value": "technology", "label": "Technology & Software"},
    {"value": "healthcare", "label": "Healthcare & Medical"},
    {"value": "finance", "label": "Finance & Banking"},
    {"value": "retail", "label": "Retail & E-commerce"},
    {"value": "manufacturing", "label": "Manufacturing"},
    {"value": "education", "label": "Education"},
    {"value": "real-estate", "label": "Real Estate"},
    {"value": "hospitality", "label": "Hospitality & Tourism"},
    {"value": "legal", "label": "Legal Services"},
    {"value": "marketing", "label": "Marketing & Advertising"},
    {"value": "construction", "label": "Construction"},
    {"value": "automotive", "label": "Automotive"},
    {"value": "food-beverage", "label": "Food & Beverage"},
    {"value": "entertainment", "label": "Entertainment & Media"},
    {"value": "nonprofit", "label": "Non-Profit"},
    {"value": "other", "label": "Other"}
]'::jsonb, true)
ON CONFLICT (organisation_id, slug) DO NOTHING;

INSERT INTO field_option_sets (name, slug, options, is_system) VALUES
('Business Types', 'business-types', '[
    {"value": "startup", "label": "Startup (< 2 years)"},
    {"value": "small-business", "label": "Small Business (2-10 employees)"},
    {"value": "medium-business", "label": "Medium Business (11-50 employees)"},
    {"value": "enterprise", "label": "Enterprise (50+ employees)"},
    {"value": "freelancer", "label": "Freelancer / Sole Proprietor"},
    {"value": "agency", "label": "Agency"},
    {"value": "nonprofit", "label": "Non-Profit Organization"}
]'::jsonb, true)
ON CONFLICT (organisation_id, slug) DO NOTHING;

INSERT INTO field_option_sets (name, slug, options, is_system) VALUES
('Budget Ranges', 'budget-ranges', '[
    {"value": "under-1k", "label": "Under $1,000"},
    {"value": "1k-5k", "label": "$1,000 - $5,000"},
    {"value": "5k-10k", "label": "$5,000 - $10,000"},
    {"value": "10k-25k", "label": "$10,000 - $25,000"},
    {"value": "25k-50k", "label": "$25,000 - $50,000"},
    {"value": "50k-100k", "label": "$50,000 - $100,000"},
    {"value": "100k-plus", "label": "$100,000+"},
    {"value": "ongoing", "label": "Ongoing Retainer"},
    {"value": "not-sure", "label": "Not Sure Yet"}
]'::jsonb, true)
ON CONFLICT (organisation_id, slug) DO NOTHING;

INSERT INTO field_option_sets (name, slug, options, is_system) VALUES
('Urgency Levels', 'urgency-levels', '[
    {"value": "low", "label": "Low - No rush, exploring options"},
    {"value": "medium", "label": "Medium - Want to start within 1-3 months"},
    {"value": "high", "label": "High - Need to start within 2-4 weeks"},
    {"value": "urgent", "label": "Urgent - Need to start immediately"}
]'::jsonb, true)
ON CONFLICT (organisation_id, slug) DO NOTHING;

INSERT INTO field_option_sets (name, slug, options, is_system) VALUES
('Digital Presence', 'digital-presence', '[
    {"value": "website", "label": "Company Website"},
    {"value": "ecommerce", "label": "E-commerce Store"},
    {"value": "blog", "label": "Blog"},
    {"value": "social-facebook", "label": "Facebook"},
    {"value": "social-instagram", "label": "Instagram"},
    {"value": "social-linkedin", "label": "LinkedIn"},
    {"value": "social-twitter", "label": "Twitter/X"},
    {"value": "social-youtube", "label": "YouTube"},
    {"value": "social-tiktok", "label": "TikTok"},
    {"value": "mobile-app", "label": "Mobile App"},
    {"value": "none", "label": "No Digital Presence"}
]'::jsonb, true)
ON CONFLICT (organisation_id, slug) DO NOTHING;

INSERT INTO field_option_sets (name, slug, options, is_system) VALUES
('Marketing Channels', 'marketing-channels', '[
    {"value": "seo", "label": "SEO / Organic Search"},
    {"value": "ppc", "label": "PPC / Paid Ads"},
    {"value": "social-media", "label": "Social Media Marketing"},
    {"value": "email", "label": "Email Marketing"},
    {"value": "content", "label": "Content Marketing"},
    {"value": "influencer", "label": "Influencer Marketing"},
    {"value": "affiliate", "label": "Affiliate Marketing"},
    {"value": "referral", "label": "Referral Program"},
    {"value": "events", "label": "Events & Trade Shows"},
    {"value": "pr", "label": "Public Relations"},
    {"value": "direct-mail", "label": "Direct Mail"},
    {"value": "cold-outreach", "label": "Cold Outreach"},
    {"value": "partnerships", "label": "Strategic Partnerships"},
    {"value": "print", "label": "Print Advertising"},
    {"value": "radio-tv", "label": "Radio/TV Advertising"},
    {"value": "word-of-mouth", "label": "Word of Mouth"},
    {"value": "none", "label": "No Active Marketing"}
]'::jsonb, true)
ON CONFLICT (organisation_id, slug) DO NOTHING;

INSERT INTO field_option_sets (name, slug, options, is_system) VALUES
('Primary Challenges', 'primary-challenges', '[
    {"value": "outdated-website", "label": "Outdated website design"},
    {"value": "poor-mobile", "label": "Poor mobile experience"},
    {"value": "slow-performance", "label": "Slow website performance"},
    {"value": "low-conversions", "label": "Low conversion rates"},
    {"value": "poor-seo", "label": "Poor search engine rankings"},
    {"value": "no-leads", "label": "Not generating enough leads"},
    {"value": "brand-mismatch", "label": "Website doesn''t match brand"},
    {"value": "hard-to-update", "label": "Difficult to update content"},
    {"value": "security-concerns", "label": "Security vulnerabilities"},
    {"value": "no-analytics", "label": "No analytics or insights"},
    {"value": "poor-ux", "label": "Confusing user experience"},
    {"value": "no-ecommerce", "label": "Need e-commerce capabilities"},
    {"value": "integration-issues", "label": "Integration problems"},
    {"value": "accessibility", "label": "Accessibility compliance"},
    {"value": "scalability", "label": "Can''t handle growth"},
    {"value": "competitor-gap", "label": "Falling behind competitors"},
    {"value": "no-online-presence", "label": "No online presence at all"},
    {"value": "rebrand", "label": "Going through rebrand"},
    {"value": "merger", "label": "Company merger/acquisition"},
    {"value": "other", "label": "Other challenges"}
]'::jsonb, true)
ON CONFLICT (organisation_id, slug) DO NOTHING;

INSERT INTO field_option_sets (name, slug, options, is_system) VALUES
('Primary Goals', 'primary-goals', '[
    {"value": "increase-sales", "label": "Increase online sales"},
    {"value": "generate-leads", "label": "Generate more leads"},
    {"value": "build-brand", "label": "Build brand awareness"},
    {"value": "improve-ux", "label": "Improve user experience"},
    {"value": "modernize", "label": "Modernize design"},
    {"value": "improve-seo", "label": "Improve search rankings"},
    {"value": "mobile-first", "label": "Better mobile experience"},
    {"value": "faster-site", "label": "Faster website performance"},
    {"value": "easier-updates", "label": "Easier content management"},
    {"value": "integrate-tools", "label": "Integrate with other tools"},
    {"value": "expand-market", "label": "Expand to new markets"},
    {"value": "reduce-costs", "label": "Reduce operational costs"},
    {"value": "compliance", "label": "Meet compliance requirements"},
    {"value": "customer-service", "label": "Improve customer service"},
    {"value": "competitive-edge", "label": "Gain competitive advantage"}
]'::jsonb, true)
ON CONFLICT (organisation_id, slug) DO NOTHING;

INSERT INTO field_option_sets (name, slug, options, is_system) VALUES
('Success Metrics', 'success-metrics', '[
    {"value": "traffic-increase", "label": "Increased website traffic"},
    {"value": "conversion-rate", "label": "Higher conversion rate"},
    {"value": "lead-volume", "label": "More leads generated"},
    {"value": "revenue-growth", "label": "Revenue growth"},
    {"value": "bounce-rate", "label": "Lower bounce rate"},
    {"value": "time-on-site", "label": "Longer time on site"},
    {"value": "page-views", "label": "More page views per visit"},
    {"value": "search-rankings", "label": "Better search rankings"},
    {"value": "mobile-traffic", "label": "Increased mobile traffic"},
    {"value": "customer-satisfaction", "label": "Customer satisfaction scores"},
    {"value": "support-tickets", "label": "Fewer support tickets"},
    {"value": "cart-abandonment", "label": "Lower cart abandonment"},
    {"value": "email-signups", "label": "More email signups"},
    {"value": "social-engagement", "label": "Social media engagement"},
    {"value": "brand-mentions", "label": "Brand mentions/PR"}
]'::jsonb, true)
ON CONFLICT (organisation_id, slug) DO NOTHING;

INSERT INTO field_option_sets (name, slug, options, is_system) VALUES
('Project Types', 'project-types', '[
    {"value": "new-website", "label": "New Website"},
    {"value": "redesign", "label": "Website Redesign"},
    {"value": "ecommerce", "label": "E-commerce Store"},
    {"value": "landing-page", "label": "Landing Page"},
    {"value": "web-app", "label": "Web Application"},
    {"value": "mobile-app", "label": "Mobile App"},
    {"value": "branding", "label": "Branding & Identity"},
    {"value": "seo", "label": "SEO & Marketing"},
    {"value": "maintenance", "label": "Ongoing Maintenance"},
    {"value": "other", "label": "Other"}
]'::jsonb, true)
ON CONFLICT (organisation_id, slug) DO NOTHING;

INSERT INTO field_option_sets (name, slug, options, is_system) VALUES
('Timeline Preferences', 'timeline-preferences', '[
    {"value": "asap", "label": "ASAP - As soon as possible"},
    {"value": "1-month", "label": "Within 1 month"},
    {"value": "1-3-months", "label": "1-3 months"},
    {"value": "3-6-months", "label": "3-6 months"},
    {"value": "flexible", "label": "Flexible / No rush"}
]'::jsonb, true)
ON CONFLICT (organisation_id, slug) DO NOTHING;

INSERT INTO field_option_sets (name, slug, options, is_system) VALUES
('Communication Preferences', 'communication-preferences', '[
    {"value": "email", "label": "Email"},
    {"value": "phone", "label": "Phone Call"},
    {"value": "video", "label": "Video Call"},
    {"value": "in-person", "label": "In-Person Meeting"}
]'::jsonb, true)
ON CONFLICT (organisation_id, slug) DO NOTHING;

INSERT INTO field_option_sets (name, slug, options, is_system) VALUES
('Rating Scale', 'rating-scale', '[
    {"value": "1", "label": "1 - Very Poor"},
    {"value": "2", "label": "2 - Poor"},
    {"value": "3", "label": "3 - Average"},
    {"value": "4", "label": "4 - Good"},
    {"value": "5", "label": "5 - Excellent"}
]'::jsonb, true)
ON CONFLICT (organisation_id, slug) DO NOTHING;

INSERT INTO field_option_sets (name, slug, options, is_system) VALUES
('Yes No Maybe', 'yes-no-maybe', '[
    {"value": "yes", "label": "Yes"},
    {"value": "no", "label": "No"},
    {"value": "maybe", "label": "Maybe / Not Sure"}
]'::jsonb, true)
ON CONFLICT (organisation_id, slug) DO NOTHING;


-- ============================================================================
-- SEED: Form Templates (General)
-- ============================================================================

INSERT INTO form_templates (name, slug, description, category, schema, ui_config, is_featured, display_order)
VALUES (
    'Contact Form',
    'contact-form',
    'Simple contact form for general inquiries. Captures name, email, phone, and message.',
    'general',
    '{"version": "1.0", "steps": [{"id": "contact", "title": "Get in Touch", "description": "We''d love to hear from you. Fill out the form below and we''ll get back to you soon.", "fields": [{"id": "full_name", "type": "text", "name": "full_name", "label": "Full Name", "placeholder": "John Smith", "required": true, "validation": {"minLength": 2, "maxLength": 100}, "layout": {"width": "full", "order": 0}}, {"id": "email", "type": "email", "name": "email", "label": "Email Address", "placeholder": "john@example.com", "required": true, "layout": {"width": "half", "order": 1}}, {"id": "phone", "type": "tel", "name": "phone", "label": "Phone Number", "placeholder": "(555) 123-4567", "required": false, "layout": {"width": "half", "order": 2}}, {"id": "subject", "type": "text", "name": "subject", "label": "Subject", "placeholder": "How can we help?", "required": true, "validation": {"minLength": 5, "maxLength": 200}, "layout": {"width": "full", "order": 3}}, {"id": "message", "type": "textarea", "name": "message", "label": "Message", "placeholder": "Tell us more about your inquiry...", "required": true, "validation": {"minLength": 20, "maxLength": 2000}, "layout": {"width": "full", "order": 4}}]}]}'::jsonb,
    '{"layout": "single-column", "showProgressBar": false, "showStepNumbers": false, "submitButtonText": "Send Message", "successMessage": "Thank you for reaching out! We''ll get back to you within 24 hours."}'::jsonb,
    true, 1
) ON CONFLICT (slug) DO NOTHING;

INSERT INTO form_templates (name, slug, description, category, schema, ui_config, is_featured, display_order)
VALUES (
    'Customer Feedback',
    'customer-feedback',
    'Collect customer satisfaction feedback with ratings and comments.',
    'feedback',
    '{"version": "1.0", "steps": [{"id": "feedback", "title": "Share Your Feedback", "description": "Your feedback helps us improve. Please take a moment to share your experience.", "fields": [{"id": "overall_rating", "type": "rating", "name": "overall_rating", "label": "Overall Experience", "description": "How would you rate your overall experience with us?", "required": true, "layout": {"width": "full", "order": 0}}, {"id": "service_quality", "type": "select", "name": "service_quality", "label": "Service Quality", "required": true, "optionSetSlug": "rating-scale", "layout": {"width": "half", "order": 1}}, {"id": "communication", "type": "select", "name": "communication", "label": "Communication", "required": true, "optionSetSlug": "rating-scale", "layout": {"width": "half", "order": 2}}, {"id": "would_recommend", "type": "radio", "name": "would_recommend", "label": "Would you recommend us to others?", "required": true, "optionSetSlug": "yes-no-maybe", "layout": {"width": "full", "order": 3}}, {"id": "what_went_well", "type": "textarea", "name": "what_went_well", "label": "What went well?", "placeholder": "Tell us what you liked about working with us...", "required": false, "layout": {"width": "full", "order": 4}}, {"id": "improvements", "type": "textarea", "name": "improvements", "label": "What could we improve?", "placeholder": "Any suggestions for how we can do better...", "required": false, "layout": {"width": "full", "order": 5}}]}]}'::jsonb,
    '{"layout": "single-column", "showProgressBar": false, "showStepNumbers": false, "submitButtonText": "Submit Feedback", "successMessage": "Thank you for your feedback! We truly appreciate you taking the time to help us improve."}'::jsonb,
    true, 2
) ON CONFLICT (slug) DO NOTHING;

INSERT INTO form_templates (name, slug, description, category, schema, ui_config, is_featured, display_order)
VALUES (
    'Project Inquiry',
    'project-inquiry',
    'Detailed project inquiry form to qualify leads and understand project requirements.',
    'intake',
    '{"version": "1.0", "steps": [{"id": "contact_info", "title": "Contact Information", "description": "Let''s start with your contact details.", "fields": [{"id": "company_name", "type": "text", "name": "company_name", "label": "Company Name", "placeholder": "Your Company", "required": true, "layout": {"width": "full", "order": 0}}, {"id": "contact_name", "type": "text", "name": "contact_name", "label": "Your Name", "placeholder": "John Smith", "required": true, "layout": {"width": "half", "order": 1}}, {"id": "email", "type": "email", "name": "email", "label": "Email", "placeholder": "john@company.com", "required": true, "layout": {"width": "half", "order": 2}}, {"id": "phone", "type": "tel", "name": "phone", "label": "Phone", "required": false, "layout": {"width": "half", "order": 3}}, {"id": "website", "type": "url", "name": "website", "label": "Current Website", "placeholder": "https://yourcompany.com", "required": false, "layout": {"width": "half", "order": 4}}]}, {"id": "project_details", "title": "Project Details", "description": "Tell us about your project requirements.", "fields": [{"id": "project_type", "type": "select", "name": "project_type", "label": "Project Type", "required": true, "optionSetSlug": "project-types", "layout": {"width": "half", "order": 0}}, {"id": "industry", "type": "select", "name": "industry", "label": "Industry", "required": true, "optionSetSlug": "industries", "layout": {"width": "half", "order": 1}}, {"id": "project_description", "type": "textarea", "name": "project_description", "label": "Project Description", "placeholder": "Describe your project in detail...", "required": true, "validation": {"minLength": 50}, "layout": {"width": "full", "order": 2}}, {"id": "primary_goals", "type": "multiselect", "name": "primary_goals", "label": "Primary Goals", "description": "Select all that apply", "required": true, "optionSetSlug": "primary-goals", "layout": {"width": "full", "order": 3}}]}, {"id": "budget_timeline", "title": "Budget & Timeline", "description": "Help us understand your budget and timeline expectations.", "fields": [{"id": "budget_range", "type": "select", "name": "budget_range", "label": "Budget Range", "required": true, "optionSetSlug": "budget-ranges", "layout": {"width": "half", "order": 0}}, {"id": "timeline", "type": "select", "name": "timeline", "label": "Desired Timeline", "required": true, "optionSetSlug": "timeline-preferences", "layout": {"width": "half", "order": 1}}, {"id": "urgency", "type": "radio", "name": "urgency", "label": "How urgent is this project?", "required": true, "optionSetSlug": "urgency-levels", "layout": {"width": "full", "order": 2}}, {"id": "additional_notes", "type": "textarea", "name": "additional_notes", "label": "Additional Notes", "placeholder": "Anything else you''d like us to know...", "required": false, "layout": {"width": "full", "order": 3}}, {"id": "preferred_contact", "type": "radio", "name": "preferred_contact", "label": "Preferred Contact Method", "required": true, "optionSetSlug": "communication-preferences", "layout": {"width": "full", "order": 4}}]}]}'::jsonb,
    '{"layout": "single-column", "showProgressBar": true, "showStepNumbers": true, "submitButtonText": "Submit Inquiry", "successMessage": "Thank you for your inquiry! We''ll review your project details and get back to you within 1-2 business days."}'::jsonb,
    true, 3
) ON CONFLICT (slug) DO NOTHING;

INSERT INTO form_templates (name, slug, description, category, schema, ui_config, is_featured, display_order)
VALUES (
    'Client Onboarding',
    'client-onboarding',
    'Comprehensive new client onboarding questionnaire to gather all necessary information.',
    'intake',
    '{"version": "1.0", "steps": [{"id": "business_info", "title": "Business Information", "fields": [{"id": "heading_business", "type": "heading", "name": "heading_business", "label": "Tell us about your business", "required": false, "layout": {"width": "full", "order": 0}}, {"id": "business_name", "type": "text", "name": "business_name", "label": "Business Name", "required": true, "layout": {"width": "full", "order": 1}}, {"id": "business_type", "type": "select", "name": "business_type", "label": "Business Type", "required": true, "optionSetSlug": "business-types", "layout": {"width": "half", "order": 2}}, {"id": "industry", "type": "select", "name": "industry", "label": "Industry", "required": true, "optionSetSlug": "industries", "layout": {"width": "half", "order": 3}}, {"id": "business_description", "type": "textarea", "name": "business_description", "label": "Business Description", "placeholder": "Briefly describe what your business does and who you serve...", "required": true, "validation": {"minLength": 50, "maxLength": 1000}, "layout": {"width": "full", "order": 4}}, {"id": "website", "type": "url", "name": "website", "label": "Current Website (if any)", "placeholder": "https://", "required": false, "layout": {"width": "full", "order": 5}}]}, {"id": "primary_contact", "title": "Primary Contact", "fields": [{"id": "contact_name", "type": "text", "name": "contact_name", "label": "Full Name", "required": true, "layout": {"width": "full", "order": 0}}, {"id": "contact_title", "type": "text", "name": "contact_title", "label": "Job Title", "required": false, "layout": {"width": "half", "order": 1}}, {"id": "contact_email", "type": "email", "name": "contact_email", "label": "Email", "required": true, "layout": {"width": "half", "order": 2}}, {"id": "contact_phone", "type": "tel", "name": "contact_phone", "label": "Phone", "required": true, "layout": {"width": "half", "order": 3}}, {"id": "preferred_contact", "type": "radio", "name": "preferred_contact", "label": "Preferred Contact Method", "required": true, "optionSetSlug": "communication-preferences", "layout": {"width": "half", "order": 4}}, {"id": "best_times", "type": "text", "name": "best_times", "label": "Best Times to Contact", "placeholder": "e.g., Weekdays 9am-5pm EST", "required": false, "layout": {"width": "full", "order": 5}}]}, {"id": "current_situation", "title": "Current Situation", "fields": [{"id": "digital_presence", "type": "multiselect", "name": "digital_presence", "label": "Current Digital Presence", "description": "Select all that apply", "required": true, "optionSetSlug": "digital-presence", "layout": {"width": "full", "order": 0}}, {"id": "marketing_channels", "type": "multiselect", "name": "marketing_channels", "label": "Current Marketing Channels", "description": "Select all that you currently use", "required": false, "optionSetSlug": "marketing-channels", "layout": {"width": "full", "order": 1}}, {"id": "primary_challenges", "type": "multiselect", "name": "primary_challenges", "label": "Primary Challenges", "description": "What challenges are you facing?", "required": true, "optionSetSlug": "primary-challenges", "layout": {"width": "full", "order": 2}}]}, {"id": "goals_expectations", "title": "Goals & Expectations", "fields": [{"id": "primary_goals", "type": "multiselect", "name": "primary_goals", "label": "Primary Goals", "description": "What do you want to achieve?", "required": true, "optionSetSlug": "primary-goals", "layout": {"width": "full", "order": 0}}, {"id": "success_metrics", "type": "multiselect", "name": "success_metrics", "label": "How will you measure success?", "required": true, "optionSetSlug": "success-metrics", "layout": {"width": "full", "order": 1}}, {"id": "budget_range", "type": "select", "name": "budget_range", "label": "Budget Range", "required": true, "optionSetSlug": "budget-ranges", "layout": {"width": "half", "order": 2}}, {"id": "timeline", "type": "select", "name": "timeline", "label": "Desired Timeline", "required": true, "optionSetSlug": "timeline-preferences", "layout": {"width": "half", "order": 3}}, {"id": "additional_info", "type": "textarea", "name": "additional_info", "label": "Anything Else?", "placeholder": "Share any additional information that would help us understand your needs...", "required": false, "layout": {"width": "full", "order": 4}}]}]}'::jsonb,
    '{"layout": "single-column", "showProgressBar": true, "showStepNumbers": true, "submitButtonText": "Complete Onboarding", "successMessage": "Welcome aboard! We''ve received your information and will be in touch shortly to schedule our kickoff call."}'::jsonb,
    true, 4
) ON CONFLICT (slug) DO NOTHING;

INSERT INTO form_templates (name, slug, description, category, schema, ui_config, is_featured, display_order)
VALUES (
    'Quick Quote Request',
    'quick-quote',
    'Fast quote request form for prospects who want a quick estimate.',
    'general',
    '{"version": "1.0", "steps": [{"id": "quote_request", "title": "Request a Quote", "description": "Get a quick estimate for your project.", "fields": [{"id": "name", "type": "text", "name": "name", "label": "Your Name", "required": true, "layout": {"width": "half", "order": 0}}, {"id": "email", "type": "email", "name": "email", "label": "Email", "required": true, "layout": {"width": "half", "order": 1}}, {"id": "project_type", "type": "select", "name": "project_type", "label": "What do you need?", "required": true, "optionSetSlug": "project-types", "layout": {"width": "half", "order": 2}}, {"id": "budget_range", "type": "select", "name": "budget_range", "label": "Budget Range", "required": true, "optionSetSlug": "budget-ranges", "layout": {"width": "half", "order": 3}}, {"id": "project_summary", "type": "textarea", "name": "project_summary", "label": "Brief Project Summary", "placeholder": "In a few sentences, describe what you''re looking for...", "required": true, "validation": {"minLength": 20, "maxLength": 500}, "layout": {"width": "full", "order": 4}}]}]}'::jsonb,
    '{"layout": "single-column", "showProgressBar": false, "showStepNumbers": false, "submitButtonText": "Get Quote", "successMessage": "Thanks! We''ll send you a quote estimate within 24 hours."}'::jsonb,
    false, 5
) ON CONFLICT (slug) DO NOTHING;


-- ============================================================================
-- SEED: Form Templates (Specialized)
-- ============================================================================

INSERT INTO form_templates (name, slug, description, category, schema, ui_config, is_featured, display_order)
VALUES (
    'Website Questionnaire',
    'website-questionnaire',
    'Comprehensive questionnaire for gathering client requirements for website projects. Includes 8 sections covering personal info, business details, content requirements, and design preferences.',
    'questionnaire',
    '{"version": "1.0", "steps": [{"id": "personal", "title": "Personal Information", "description": "Please provide your contact information so we can reach you during the project.", "fields": [{"id": "first_name", "type": "text", "name": "first_name", "label": "First Name", "placeholder": "Enter your first name", "required": true, "layout": {"width": "half", "order": 1}}, {"id": "last_name", "type": "text", "name": "last_name", "label": "Last Name", "placeholder": "Enter your last name", "required": true, "layout": {"width": "half", "order": 2}}, {"id": "email", "type": "email", "name": "email", "label": "Email Address", "description": "We''ll use this to send project updates", "placeholder": "your@email.com", "required": true, "layout": {"width": "full", "order": 3}}]}, {"id": "company", "title": "Company Details", "description": "Tell us about your company for our records.", "fields": [{"id": "company_name", "type": "text", "name": "company_name", "label": "Company Name", "description": "Your registered business name", "placeholder": "Your Company Pty Ltd", "required": true, "layout": {"width": "full", "order": 1}}, {"id": "registered_address", "type": "textarea", "name": "registered_address", "label": "Registered Business Address", "description": "Your official business address for legal documents", "placeholder": "123 Business Street\nCity, State 1234", "required": true, "layout": {"width": "full", "order": 2}}]}, {"id": "display", "title": "Display Information", "description": "This information will be displayed publicly on your website.", "fields": [{"id": "displayed_business_name", "type": "text", "name": "displayed_business_name", "label": "Business Name to Display", "description": "This can be a trading name or brand name", "placeholder": "Your Brand Name", "required": true, "layout": {"width": "full", "order": 1}}, {"id": "displayed_address", "type": "textarea", "name": "displayed_address", "label": "Address to Display", "description": "Leave blank if you don''t want to display an address", "required": false, "layout": {"width": "full", "order": 2}}, {"id": "displayed_phone", "type": "tel", "name": "displayed_phone", "label": "Phone Number", "placeholder": "04XX XXX XXX", "required": false, "layout": {"width": "half", "order": 3}}, {"id": "displayed_email", "type": "email", "name": "displayed_email", "label": "Email to Display", "placeholder": "contact@yourbusiness.com", "required": false, "layout": {"width": "half", "order": 4}}, {"id": "social_media_accounts", "type": "textarea", "name": "social_media_accounts", "label": "Social Media Accounts", "placeholder": "Facebook: facebook.com/yourbusiness\nInstagram: @yourbusiness", "required": false, "layout": {"width": "full", "order": 5}}, {"id": "opening_hours", "type": "textarea", "name": "opening_hours", "label": "Opening Hours", "placeholder": "Monday - Friday: 9am - 5pm\nSaturday: 10am - 2pm", "required": false, "layout": {"width": "full", "order": 6}}]}, {"id": "domain", "title": "Domain & Technical", "description": "Tell us about your existing domain and online presence.", "fields": [{"id": "has_domain", "type": "radio", "name": "has_domain", "label": "Do you already have a domain name?", "required": true, "options": [{"value": "yes", "label": "Yes, I have a domain"}, {"value": "no", "label": "No, I need one"}], "layout": {"width": "full", "order": 1}}, {"id": "domain_name", "type": "text", "name": "domain_name", "label": "Domain Name", "placeholder": "yourbusiness.com.au", "required": false, "layout": {"width": "full", "order": 2}}, {"id": "has_google_business", "type": "radio", "name": "has_google_business", "label": "Do you have a Google Business Profile?", "required": true, "options": [{"value": "yes", "label": "Yes"}, {"value": "no", "label": "No"}], "layout": {"width": "full", "order": 3}}]}, {"id": "business", "title": "About Your Business", "description": "Help us understand your business so we can tell your story effectively.", "fields": [{"id": "business_story", "type": "textarea", "name": "business_story", "label": "Tell us your story/background", "description": "This will help us write your About page", "placeholder": "How did your business start? What drives you?", "required": true, "validation": {"minLength": 50}, "layout": {"width": "full", "order": 1}}, {"id": "areas_served", "type": "textarea", "name": "areas_served", "label": "Areas/Regions Served", "placeholder": "e.g., Sydney Metropolitan Area, All of NSW", "required": true, "layout": {"width": "full", "order": 2}}, {"id": "target_customers", "type": "textarea", "name": "target_customers", "label": "Who are your target customers?", "placeholder": "Describe your ideal customers", "required": true, "layout": {"width": "full", "order": 3}}, {"id": "top_services", "type": "textarea", "name": "top_services", "label": "Top 3-4 Services/Products", "placeholder": "1. Service One\n2. Service Two\n3. Service Three", "required": true, "layout": {"width": "full", "order": 4}}, {"id": "differentiators", "type": "textarea", "name": "differentiators", "label": "What sets you apart from competitors?", "required": true, "layout": {"width": "full", "order": 5}}]}, {"id": "content", "title": "Website Content", "description": "Tell us what content and functionality you want.", "fields": [{"id": "pages_wanted", "type": "textarea", "name": "pages_wanted", "label": "What pages do you want?", "placeholder": "e.g., Home, About Us, Services, Contact", "required": true, "layout": {"width": "full", "order": 1}}, {"id": "customer_actions", "type": "textarea", "name": "customer_actions", "label": "What actions do you want visitors to take?", "placeholder": "e.g., Call us, Submit enquiry form, Book appointment", "required": true, "layout": {"width": "full", "order": 2}}, {"id": "key_information", "type": "textarea", "name": "key_information", "label": "What key information must visitors see?", "required": true, "layout": {"width": "full", "order": 3}}, {"id": "calls_to_action", "type": "textarea", "name": "calls_to_action", "label": "Primary Call-to-Action Text", "placeholder": "e.g., ''Get a Free Quote'', ''Book Now''", "required": true, "layout": {"width": "full", "order": 4}}]}, {"id": "design", "title": "Website Design", "description": "Help us understand your design preferences.", "fields": [{"id": "competitor_websites", "type": "textarea", "name": "competitor_websites", "label": "Competitor Websites", "placeholder": "List your main competitors'' websites", "required": false, "layout": {"width": "full", "order": 1}}, {"id": "reference_websites", "type": "textarea", "name": "reference_websites", "label": "Websites you like (for inspiration)", "placeholder": "List 2-5 websites you like and what you like about them", "required": true, "layout": {"width": "full", "order": 2}}, {"id": "aesthetic_description", "type": "textarea", "name": "aesthetic_description", "label": "Describe your desired look and feel", "placeholder": "e.g., Modern and minimal, Professional and corporate", "required": true, "layout": {"width": "full", "order": 3}}, {"id": "branding_guidelines", "type": "textarea", "name": "branding_guidelines", "label": "Existing Branding Guidelines", "placeholder": "Do you have existing brand colors, fonts, or style guides?", "required": false, "layout": {"width": "full", "order": 4}}]}, {"id": "final", "title": "Final Details", "description": "Just a few more details to help us deliver your project.", "fields": [{"id": "timeline", "type": "text", "name": "timeline", "label": "Timeline / Desired Launch Date", "placeholder": "e.g., ASAP, Within 4 weeks, No rush", "required": true, "layout": {"width": "full", "order": 1}}, {"id": "google_analytics", "type": "radio", "name": "google_analytics", "label": "Would you like Google Analytics set up?", "required": true, "options": [{"value": "yes", "label": "Yes"}, {"value": "no", "label": "No"}], "layout": {"width": "full", "order": 2}}, {"id": "referral_source", "type": "text", "name": "referral_source", "label": "How did you hear about us?", "required": false, "layout": {"width": "full", "order": 3}}, {"id": "other_services_interest", "type": "multiselect", "name": "other_services_interest", "label": "Are you interested in any other services?", "required": false, "options": [{"value": "seo", "label": "SEO"}, {"value": "social_media", "label": "Social Media Management"}, {"value": "ppc", "label": "Pay-Per-Click Advertising"}, {"value": "content", "label": "Content Writing"}, {"value": "branding", "label": "Branding & Logo Design"}], "layout": {"width": "full", "order": 4}}]}]}'::jsonb,
    '{"layout": "wizard", "showProgressBar": true, "showStepNumbers": true, "submitButtonText": "Submit Questionnaire", "successMessage": "Thank you for completing the questionnaire! We''ll review your responses and be in touch soon."}'::jsonb,
    true, 10
) ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name, description = EXCLUDED.description, category = EXCLUDED.category,
    schema = EXCLUDED.schema, ui_config = EXCLUDED.ui_config, is_featured = EXCLUDED.is_featured,
    display_order = EXCLUDED.display_order, updated_at = NOW();

INSERT INTO form_templates (name, slug, description, category, schema, ui_config, is_featured, display_order)
VALUES (
    'Full Discovery',
    'full-discovery',
    'Deep dive questionnaire for comprehensive project discovery. Covers goals, audience, competitors, features, content, and timeline.',
    'consultation',
    '{"version": "1.0", "steps": [{"id": "contact", "title": "Contact Information", "description": "Let''s start with your contact details.", "fields": [{"id": "contact_name", "type": "text", "name": "contact_name", "label": "Your Name", "placeholder": "John Smith", "required": true, "layout": {"width": "half", "order": 1}}, {"id": "email", "type": "email", "name": "email", "label": "Email Address", "placeholder": "john@company.com", "required": true, "layout": {"width": "half", "order": 2}}, {"id": "phone", "type": "tel", "name": "phone", "label": "Phone Number", "required": false, "layout": {"width": "half", "order": 3}}, {"id": "company_name", "type": "text", "name": "company_name", "label": "Company Name", "required": true, "layout": {"width": "half", "order": 4}}, {"id": "company_description", "type": "textarea", "name": "company_description", "label": "What does your company do?", "required": true, "layout": {"width": "full", "order": 5}}, {"id": "current_website", "type": "text", "name": "current_website", "label": "Current Website (if any)", "required": false, "layout": {"width": "full", "order": 6}}]}, {"id": "goals", "title": "Goals & Objectives", "description": "Help us understand what you want to achieve.", "fields": [{"id": "primary_goal", "type": "select", "name": "primary_goal", "label": "Primary Goal", "required": true, "options": [{"value": "generate_leads", "label": "Generate more leads"}, {"value": "increase_sales", "label": "Increase online sales"}, {"value": "build_brand", "label": "Build brand awareness"}, {"value": "improve_credibility", "label": "Improve credibility"}, {"value": "customer_service", "label": "Better customer service"}, {"value": "information", "label": "Provide information"}, {"value": "other", "label": "Other"}], "layout": {"width": "full", "order": 1}}, {"id": "secondary_goals", "type": "multiselect", "name": "secondary_goals", "label": "Secondary Goals", "required": false, "options": [{"value": "seo", "label": "Improve search rankings"}, {"value": "mobile", "label": "Better mobile experience"}, {"value": "speed", "label": "Faster performance"}, {"value": "design", "label": "More professional design"}, {"value": "functionality", "label": "Add new features"}, {"value": "content", "label": "Better content management"}], "layout": {"width": "full", "order": 2}}, {"id": "success_metrics", "type": "textarea", "name": "success_metrics", "label": "How will you measure success?", "required": true, "layout": {"width": "full", "order": 3}}, {"id": "problems_to_solve", "type": "textarea", "name": "problems_to_solve", "label": "What problems are you trying to solve?", "required": true, "layout": {"width": "full", "order": 4}}]}, {"id": "audience", "title": "Target Audience", "description": "Understanding your audience helps us design for them.", "fields": [{"id": "target_customers", "type": "textarea", "name": "target_customers", "label": "Who are your ideal customers?", "required": true, "layout": {"width": "full", "order": 1}}, {"id": "customer_pain_points", "type": "textarea", "name": "customer_pain_points", "label": "What problems do your customers face?", "required": true, "layout": {"width": "full", "order": 2}}, {"id": "customer_motivations", "type": "textarea", "name": "customer_motivations", "label": "What motivates them to buy?", "required": true, "layout": {"width": "full", "order": 3}}, {"id": "geographic_focus", "type": "text", "name": "geographic_focus", "label": "Geographic Focus", "required": true, "layout": {"width": "full", "order": 4}}]}, {"id": "competitors", "title": "Competitors & Market", "description": "Help us understand your competitive landscape.", "fields": [{"id": "main_competitors", "type": "textarea", "name": "main_competitors", "label": "Main Competitors", "required": true, "layout": {"width": "full", "order": 1}}, {"id": "competitor_strengths", "type": "textarea", "name": "competitor_strengths", "label": "What do competitors do well?", "required": false, "layout": {"width": "full", "order": 2}}, {"id": "competitor_weaknesses", "type": "textarea", "name": "competitor_weaknesses", "label": "Where do competitors fall short?", "required": false, "layout": {"width": "full", "order": 3}}, {"id": "differentiators", "type": "textarea", "name": "differentiators", "label": "What makes you different?", "required": true, "layout": {"width": "full", "order": 4}}]}, {"id": "features", "title": "Features & Content", "description": "What functionality and content do you need?", "fields": [{"id": "required_pages", "type": "multiselect", "name": "required_pages", "label": "Required Pages", "required": true, "options": [{"value": "home", "label": "Home"}, {"value": "about", "label": "About Us"}, {"value": "services", "label": "Services"}, {"value": "products", "label": "Products"}, {"value": "portfolio", "label": "Portfolio"}, {"value": "blog", "label": "Blog"}, {"value": "testimonials", "label": "Testimonials"}, {"value": "faq", "label": "FAQ"}, {"value": "contact", "label": "Contact"}, {"value": "pricing", "label": "Pricing"}], "layout": {"width": "full", "order": 1}}, {"id": "required_features", "type": "multiselect", "name": "required_features", "label": "Required Features", "required": false, "options": [{"value": "contact_form", "label": "Contact Form"}, {"value": "quote_form", "label": "Quote Request"}, {"value": "booking", "label": "Online Booking"}, {"value": "newsletter", "label": "Newsletter Signup"}, {"value": "live_chat", "label": "Live Chat"}, {"value": "maps", "label": "Google Maps"}, {"value": "social_feed", "label": "Social Feed"}, {"value": "video", "label": "Video"}, {"value": "search", "label": "Site Search"}, {"value": "member_area", "label": "Member Area"}], "layout": {"width": "full", "order": 2}}, {"id": "content_status", "type": "select", "name": "content_status", "label": "Content Status", "required": true, "options": [{"value": "have_all", "label": "I have all content ready"}, {"value": "have_some", "label": "I have some content"}, {"value": "need_help", "label": "I need help creating content"}, {"value": "migrate", "label": "Migrate from existing site"}], "layout": {"width": "full", "order": 3}}, {"id": "additional_features", "type": "textarea", "name": "additional_features", "label": "Additional Features or Integrations", "required": false, "layout": {"width": "full", "order": 4}}]}, {"id": "timeline", "title": "Timeline & Budget", "description": "Help us understand your constraints.", "fields": [{"id": "deadline", "type": "text", "name": "deadline", "label": "Target Launch Date", "required": true, "layout": {"width": "half", "order": 1}}, {"id": "budget_range", "type": "select", "name": "budget_range", "label": "Budget Range", "required": true, "options": [{"value": "under_5k", "label": "Under $5,000"}, {"value": "5k_10k", "label": "$5,000 - $10,000"}, {"value": "10k_20k", "label": "$10,000 - $20,000"}, {"value": "20k_50k", "label": "$20,000 - $50,000"}, {"value": "over_50k", "label": "Over $50,000"}, {"value": "discuss", "label": "Let''s discuss"}], "layout": {"width": "half", "order": 2}}, {"id": "decision_timeline", "type": "select", "name": "decision_timeline", "label": "Decision Timeline", "required": true, "options": [{"value": "immediately", "label": "Ready to start immediately"}, {"value": "1_week", "label": "Within 1 week"}, {"value": "2_4_weeks", "label": "Within 2-4 weeks"}, {"value": "1_3_months", "label": "1-3 months"}, {"value": "just_exploring", "label": "Just exploring options"}], "layout": {"width": "full", "order": 3}}, {"id": "design_inspiration", "type": "textarea", "name": "design_inspiration", "label": "Design Inspiration", "required": false, "layout": {"width": "full", "order": 4}}, {"id": "additional_notes", "type": "textarea", "name": "additional_notes", "label": "Anything Else?", "required": false, "layout": {"width": "full", "order": 5}}]}]}'::jsonb,
    '{"layout": "wizard", "showProgressBar": true, "showStepNumbers": true, "submitButtonText": "Submit Discovery", "successMessage": "Thank you for completing the discovery questionnaire! We''ll review your responses and prepare a detailed proposal."}'::jsonb,
    true, 11
) ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name, description = EXCLUDED.description, category = EXCLUDED.category,
    schema = EXCLUDED.schema, ui_config = EXCLUDED.ui_config, is_featured = EXCLUDED.is_featured,
    display_order = EXCLUDED.display_order, updated_at = NOW();

INSERT INTO form_templates (name, slug, description, category, schema, ui_config, is_featured, display_order)
VALUES (
    'E-commerce Intake',
    'ecommerce-intake',
    'Specialized questionnaire for e-commerce projects. Covers products, payment processing, shipping, and integrations.',
    'intake',
    '{"version": "1.0", "steps": [{"id": "business", "title": "Business Information", "description": "Tell us about your business.", "fields": [{"id": "contact_name", "type": "text", "name": "contact_name", "label": "Contact Name", "required": true, "layout": {"width": "half", "order": 1}}, {"id": "email", "type": "email", "name": "email", "label": "Email Address", "required": true, "layout": {"width": "half", "order": 2}}, {"id": "business_name", "type": "text", "name": "business_name", "label": "Business Name", "required": true, "layout": {"width": "half", "order": 3}}, {"id": "phone", "type": "tel", "name": "phone", "label": "Phone Number", "required": false, "layout": {"width": "half", "order": 4}}, {"id": "current_website", "type": "text", "name": "current_website", "label": "Current Website (if any)", "required": false, "layout": {"width": "full", "order": 5}}, {"id": "business_stage", "type": "select", "name": "business_stage", "label": "Business Stage", "required": true, "options": [{"value": "new", "label": "New business - first online store"}, {"value": "existing_new_store", "label": "Existing business - first online store"}, {"value": "migration", "label": "Migrating from another platform"}, {"value": "redesign", "label": "Redesigning existing store"}], "layout": {"width": "full", "order": 6}}]}, {"id": "products", "title": "Products & Catalog", "description": "Tell us about what you''re selling.", "fields": [{"id": "product_types", "type": "multiselect", "name": "product_types", "label": "What type of products?", "required": true, "options": [{"value": "physical", "label": "Physical products"}, {"value": "digital", "label": "Digital downloads"}, {"value": "services", "label": "Services"}, {"value": "subscriptions", "label": "Subscriptions"}, {"value": "memberships", "label": "Memberships"}, {"value": "courses", "label": "Online courses"}], "layout": {"width": "full", "order": 1}}, {"id": "product_count", "type": "select", "name": "product_count", "label": "How many products/SKUs?", "required": true, "options": [{"value": "under_25", "label": "Under 25"}, {"value": "25_100", "label": "25 - 100"}, {"value": "100_500", "label": "100 - 500"}, {"value": "500_1000", "label": "500 - 1,000"}, {"value": "over_1000", "label": "Over 1,000"}], "layout": {"width": "half", "order": 2}}, {"id": "product_variants", "type": "radio", "name": "product_variants", "label": "Do products have variants?", "required": true, "options": [{"value": "yes", "label": "Yes"}, {"value": "no", "label": "No"}, {"value": "some", "label": "Some products"}], "layout": {"width": "half", "order": 3}}, {"id": "product_categories", "type": "textarea", "name": "product_categories", "label": "Main Product Categories", "required": true, "layout": {"width": "full", "order": 4}}, {"id": "pricing_model", "type": "multiselect", "name": "pricing_model", "label": "Pricing Model", "required": true, "options": [{"value": "fixed", "label": "Fixed pricing"}, {"value": "tiered", "label": "Tiered/volume pricing"}, {"value": "wholesale", "label": "Wholesale pricing"}, {"value": "member_pricing", "label": "Member-only pricing"}, {"value": "quote", "label": "Request a quote"}], "layout": {"width": "full", "order": 5}}]}, {"id": "payment", "title": "Payment & Checkout", "description": "How will customers pay?", "fields": [{"id": "payment_methods", "type": "multiselect", "name": "payment_methods", "label": "Required Payment Methods", "required": true, "options": [{"value": "credit_card", "label": "Credit/Debit Cards"}, {"value": "paypal", "label": "PayPal"}, {"value": "afterpay", "label": "Afterpay"}, {"value": "klarna", "label": "Klarna"}, {"value": "apple_pay", "label": "Apple Pay"}, {"value": "google_pay", "label": "Google Pay"}, {"value": "bank_transfer", "label": "Bank Transfer"}], "layout": {"width": "full", "order": 1}}, {"id": "payment_processor", "type": "select", "name": "payment_processor", "label": "Preferred Payment Processor", "required": false, "options": [{"value": "stripe", "label": "Stripe"}, {"value": "square", "label": "Square"}, {"value": "paypal", "label": "PayPal Commerce"}, {"value": "braintree", "label": "Braintree"}, {"value": "no_preference", "label": "No preference"}, {"value": "other", "label": "Other"}], "layout": {"width": "full", "order": 2}}, {"id": "currencies", "type": "multiselect", "name": "currencies", "label": "Currencies", "required": true, "options": [{"value": "aud", "label": "AUD"}, {"value": "usd", "label": "USD"}, {"value": "eur", "label": "EUR"}, {"value": "gbp", "label": "GBP"}, {"value": "nzd", "label": "NZD"}], "layout": {"width": "full", "order": 3}}, {"id": "checkout_features", "type": "multiselect", "name": "checkout_features", "label": "Checkout Features", "required": false, "options": [{"value": "guest_checkout", "label": "Guest checkout"}, {"value": "one_page", "label": "One-page checkout"}, {"value": "saved_cards", "label": "Save payment methods"}, {"value": "gift_cards", "label": "Gift cards"}, {"value": "discount_codes", "label": "Discount codes"}, {"value": "order_notes", "label": "Order notes"}], "layout": {"width": "full", "order": 4}}]}, {"id": "shipping", "title": "Shipping & Fulfillment", "description": "How will orders be fulfilled?", "fields": [{"id": "ships_physical", "type": "radio", "name": "ships_physical", "label": "Do you ship physical products?", "required": true, "options": [{"value": "yes", "label": "Yes"}, {"value": "no", "label": "No - digital only"}, {"value": "both", "label": "Both physical and digital"}], "layout": {"width": "full", "order": 1}}, {"id": "shipping_regions", "type": "multiselect", "name": "shipping_regions", "label": "Shipping Regions", "required": false, "options": [{"value": "local", "label": "Local/metro only"}, {"value": "national", "label": "Australia-wide"}, {"value": "nz", "label": "New Zealand"}, {"value": "asia_pacific", "label": "Asia Pacific"}, {"value": "usa_canada", "label": "USA/Canada"}, {"value": "europe", "label": "Europe"}, {"value": "worldwide", "label": "Worldwide"}], "layout": {"width": "full", "order": 2}}, {"id": "shipping_carriers", "type": "multiselect", "name": "shipping_carriers", "label": "Preferred Shipping Carriers", "required": false, "options": [{"value": "auspost", "label": "Australia Post"}, {"value": "sendle", "label": "Sendle"}, {"value": "dhl", "label": "DHL"}, {"value": "fedex", "label": "FedEx"}, {"value": "ups", "label": "UPS"}, {"value": "courier", "label": "Local courier"}, {"value": "pickup", "label": "Click & Collect"}], "layout": {"width": "full", "order": 3}}, {"id": "fulfillment_method", "type": "select", "name": "fulfillment_method", "label": "Fulfillment Method", "required": false, "options": [{"value": "self", "label": "Self-fulfilled"}, {"value": "3pl", "label": "Third-party logistics"}, {"value": "dropship", "label": "Dropshipping"}, {"value": "mixed", "label": "Mixed"}], "layout": {"width": "full", "order": 4}}]}, {"id": "integrations", "title": "Integrations & Timeline", "description": "Technical requirements and project timeline.", "fields": [{"id": "integrations_needed", "type": "multiselect", "name": "integrations_needed", "label": "Required Integrations", "required": false, "options": [{"value": "accounting", "label": "Accounting (Xero, MYOB, QuickBooks)"}, {"value": "inventory", "label": "Inventory management"}, {"value": "erp", "label": "ERP system"}, {"value": "crm", "label": "CRM"}, {"value": "email_marketing", "label": "Email marketing (Mailchimp, Klaviyo)"}, {"value": "social", "label": "Social media selling"}, {"value": "marketplace", "label": "Marketplaces (eBay, Amazon)"}, {"value": "reviews", "label": "Reviews platform"}, {"value": "loyalty", "label": "Loyalty/rewards program"}], "layout": {"width": "full", "order": 1}}, {"id": "current_systems", "type": "textarea", "name": "current_systems", "label": "Current Systems/Software", "required": false, "layout": {"width": "full", "order": 2}}, {"id": "budget_range", "type": "select", "name": "budget_range", "label": "Budget Range", "required": true, "options": [{"value": "under_5k", "label": "Under $5,000"}, {"value": "5k_10k", "label": "$5,000 - $10,000"}, {"value": "10k_25k", "label": "$10,000 - $25,000"}, {"value": "25k_50k", "label": "$25,000 - $50,000"}, {"value": "over_50k", "label": "Over $50,000"}], "layout": {"width": "half", "order": 3}}, {"id": "timeline", "type": "select", "name": "timeline", "label": "Target Launch", "required": true, "options": [{"value": "asap", "label": "ASAP"}, {"value": "1_2_months", "label": "1-2 months"}, {"value": "3_4_months", "label": "3-4 months"}, {"value": "6_months", "label": "6+ months"}, {"value": "flexible", "label": "Flexible"}], "layout": {"width": "half", "order": 4}}, {"id": "additional_notes", "type": "textarea", "name": "additional_notes", "label": "Additional Information", "required": false, "layout": {"width": "full", "order": 5}}]}]}'::jsonb,
    '{"layout": "wizard", "showProgressBar": true, "showStepNumbers": true, "submitButtonText": "Submit E-commerce Brief", "successMessage": "Thank you! We''ll review your e-commerce requirements and prepare a detailed proposal."}'::jsonb,
    true, 12
) ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name, description = EXCLUDED.description, category = EXCLUDED.category,
    schema = EXCLUDED.schema, ui_config = EXCLUDED.ui_config, is_featured = EXCLUDED.is_featured,
    display_order = EXCLUDED.display_order, updated_at = NOW();
