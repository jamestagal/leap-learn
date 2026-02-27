-- Add performance_data column to seo_audits for Google PageSpeed Insights results.
-- Stores Lighthouse scores, Core Web Vitals, and recommendations as JSONB.
ALTER TABLE seo_audits ADD COLUMN IF NOT EXISTS performance_data JSONB DEFAULT '{}';
