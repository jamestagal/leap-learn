-- Migration 008: Update Full Discovery template with correct 4-step consultation schema
-- Replaces the generic 6-step schema from migration 004 with the proper consultation-mapped schema
-- Idempotent: uses ON CONFLICT to upsert

INSERT INTO form_templates (
  slug,
  name,
  description,
  category,
  schema,
  ui_config,
  is_featured,
  display_order,
  updated_at
) VALUES (
  'full-discovery',
  'Full Discovery',
  'Comprehensive 4-step consultation form covering contact info, challenges, goals, and preferences. Maps directly to consultations table for proposal generation.',
  'consultation',
  '{
    "version": "1.0",
    "steps": [
      {
        "id": "contact",
        "title": "Contact & Business",
        "description": "Basic contact and business information",
        "fields": [
          {"id": "business_name", "type": "text", "name": "businessName", "label": "Business Name", "required": true, "layout": {"width": "half"}},
          {"id": "contact_person", "type": "text", "name": "contactPerson", "label": "Contact Person", "required": true, "layout": {"width": "half"}},
          {"id": "email", "type": "email", "name": "email", "label": "Email Address", "required": true, "layout": {"width": "half"}},
          {"id": "phone", "type": "tel", "name": "phone", "label": "Phone Number", "formatter": "au-phone", "layout": {"width": "half"}},
          {"id": "website", "type": "url", "name": "website", "label": "Current Website", "placeholder": "https://", "layout": {"width": "full"}},
          {"id": "industry", "type": "select", "name": "industry", "label": "Industry", "required": true, "optionSetSlug": "industries", "layout": {"width": "half"}},
          {"id": "business_type", "type": "select", "name": "businessType", "label": "Business Type", "required": true, "optionSetSlug": "business-types", "layout": {"width": "half"}},
          {"id": "social_heading", "type": "heading", "name": "social_heading", "label": "Social Media (Optional)", "required": false},
          {"id": "social_linkedin", "type": "url", "name": "socialLinkedin", "label": "LinkedIn", "placeholder": "https://linkedin.com/company/...", "required": false, "layout": {"width": "full"}},
          {"id": "social_facebook", "type": "url", "name": "socialFacebook", "label": "Facebook", "required": false, "layout": {"width": "half"}},
          {"id": "social_instagram", "type": "url", "name": "socialInstagram", "label": "Instagram", "required": false, "layout": {"width": "half"}}
        ]
      },
      {
        "id": "situation",
        "title": "Situation & Challenges",
        "description": "Current website status and business challenges",
        "fields": [
          {"id": "website_status", "type": "radio", "name": "websiteStatus", "label": "Current Website Status", "required": false, "optionSetSlug": "website-status", "layout": {"width": "full"}},
          {"id": "primary_challenges", "type": "multiselect", "name": "primaryChallenges", "label": "Primary Challenges", "description": "Select all that apply", "required": false, "optionSetSlug": "primary-challenges", "renderAs": "chips", "layout": {"width": "full"}},
          {"id": "urgency_level", "type": "select", "name": "urgencyLevel", "label": "Project Urgency", "required": false, "optionSetSlug": "urgency-levels", "layout": {"width": "full"}}
        ]
      },
      {
        "id": "goals",
        "title": "Goals & Budget",
        "description": "Project objectives and investment expectations",
        "fields": [
          {"id": "primary_goals", "type": "multiselect", "name": "primaryGoals", "label": "Primary Goals", "description": "What do you want to achieve?", "required": false, "optionSetSlug": "primary-goals", "renderAs": "chips", "layout": {"width": "full"}},
          {"id": "conversion_goal", "type": "radio", "name": "conversionGoal", "label": "Desired Conversion Action", "description": "What action should visitors take?", "required": false, "optionSetSlug": "conversion-goals", "layout": {"width": "full"}},
          {"id": "budget_range", "type": "select", "name": "budgetRange", "label": "Budget Range", "required": true, "optionSetSlug": "budget-ranges", "layout": {"width": "half"}},
          {"id": "timeline", "type": "select", "name": "timeline", "label": "Timeline", "required": false, "optionSetSlug": "timeline-preferences", "layout": {"width": "half"}}
        ]
      },
      {
        "id": "preferences",
        "title": "Preferences & Notes",
        "description": "Design preferences and additional information",
        "fields": [
          {"id": "design_styles", "type": "multiselect", "name": "designStyles", "label": "Design Style Preferences", "required": false, "optionSetSlug": "design-styles", "renderAs": "chips", "layout": {"width": "full"}},
          {"id": "admired_websites", "type": "textarea", "name": "admiredWebsites", "label": "Admired Websites", "placeholder": "List any websites you admire and why...", "required": false, "layout": {"width": "full"}},
          {"id": "consultation_notes", "type": "textarea", "name": "consultationNotes", "label": "Additional Notes", "placeholder": "Any other information that would help us understand your needs...", "required": false, "layout": {"width": "full"}}
        ]
      }
    ]
  }'::jsonb,
  '{
    "layout": "wizard",
    "showProgressBar": true,
    "showStepNumbers": true,
    "submitButtonText": "Complete Consultation",
    "successMessage": "Thank you! Your consultation has been submitted successfully."
  }'::jsonb,
  true,
  11,
  NOW()
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  schema = EXCLUDED.schema,
  ui_config = EXCLUDED.ui_config,
  is_featured = EXCLUDED.is_featured,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();
