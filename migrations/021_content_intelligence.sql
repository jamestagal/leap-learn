-- ============================================================
-- CONTENT INTELLIGENCE: Core Tables
-- ============================================================

CREATE EXTENSION IF NOT EXISTS vector;

-- Tracks crawl/import jobs per client (or per competitor)
CREATE TABLE IF NOT EXISTS content_crawl_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id UUID NOT NULL REFERENCES organisations(id),
    client_id UUID NOT NULL REFERENCES clients(id),

    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'crawling', 'extracting',
                          'classifying', 'embedding', 'profiling',
                          'complete', 'failed')),

    source_url TEXT NOT NULL,
    crawl_target TEXT NOT NULL DEFAULT 'client'
        CHECK (crawl_target IN ('client', 'competitor')),

    -- Progress tracking (enables resumability)
    pages_discovered INTEGER DEFAULT 0,
    pages_processed INTEGER DEFAULT 0,
    pages_changed INTEGER DEFAULT 0,
    max_depth INTEGER DEFAULT 3,

    crawl_type TEXT NOT NULL DEFAULT 'full'
        CHECK (crawl_type IN ('full', 'incremental', 'targeted')),

    error_message TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crawl_jobs_client ON content_crawl_jobs(client_id);
CREATE INDEX IF NOT EXISTS idx_crawl_jobs_status ON content_crawl_jobs(status);
CREATE INDEX IF NOT EXISTS idx_crawl_jobs_organisation ON content_crawl_jobs(organisation_id);

-- Individual scraped pages (client or competitor)
CREATE TABLE IF NOT EXISTS content_pages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id),
    crawl_job_id UUID REFERENCES content_crawl_jobs(id),

    url TEXT NOT NULL,
    canonical_url TEXT,
    source_type TEXT NOT NULL DEFAULT 'client'
        CHECK (source_type IN ('client', 'competitor')),
    competitor_domain TEXT,              -- Set when source_type = 'competitor'

    page_type TEXT NOT NULL DEFAULT 'unknown'
        CHECK (page_type IN ('homepage', 'about', 'service', 'product',
                             'blog_post', 'case_study', 'testimonial',
                             'contact', 'team', 'faq', 'landing',
                             'category', 'portfolio', 'news', 'other', 'unknown')),
    classification_confidence REAL DEFAULT 0,
    classification_method TEXT
        CHECK (classification_method IN ('url_pattern', 'html_structure', 'llm', 'manual')),

    -- Extracted content
    title TEXT,
    meta_description TEXT,
    h1_tags TEXT[],
    h2_tags TEXT[],
    body_text TEXT,
    markdown_content TEXT,
    word_count INTEGER DEFAULT 0,
    reading_time_minutes INTEGER DEFAULT 0,

    -- Technical metadata
    http_status INTEGER,
    content_hash TEXT,                   -- SHA-256 of body_text for change detection
    schema_types TEXT[],
    has_canonical BOOLEAN DEFAULT FALSE,
    has_robots_meta BOOLEAN DEFAULT FALSE,
    robots_directives TEXT,
    internal_links_count INTEGER DEFAULT 0,
    external_links_count INTEGER DEFAULT 0,
    image_count INTEGER DEFAULT 0,
    images_missing_alt INTEGER DEFAULT 0,

    -- Timestamps
    first_scraped_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_scraped_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    content_changed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(client_id, url)
);

CREATE INDEX IF NOT EXISTS idx_content_pages_client ON content_pages(client_id);
CREATE INDEX IF NOT EXISTS idx_content_pages_type ON content_pages(client_id, page_type);
CREATE INDEX IF NOT EXISTS idx_content_pages_source ON content_pages(client_id, source_type);

-- Content chunks for RAG (vector embeddings)
CREATE TABLE IF NOT EXISTS content_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    page_id UUID NOT NULL REFERENCES content_pages(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES clients(id),
    chunk_index INTEGER NOT NULL,
    chunk_text TEXT NOT NULL,
    token_count INTEGER NOT NULL,
    summary TEXT,

    -- Embedding with model versioning
    embedding vector(768),
    embedding_model TEXT NOT NULL DEFAULT 'bge-base-en-v1.5',

    metadata JSONB DEFAULT '{}',        -- page_type, section_heading, source_type, etc.
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chunks_client ON content_chunks(client_id);
CREATE INDEX IF NOT EXISTS idx_chunks_page ON content_chunks(page_id);
CREATE INDEX IF NOT EXISTS idx_chunks_embedding ON content_chunks
    USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 128);

-- Brand voice profiles per client
CREATE TABLE IF NOT EXISTS brand_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id),
    organisation_id UUID NOT NULL REFERENCES organisations(id),
    version INTEGER NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    -- Structured brand voice profile (generated by AI)
    profile JSONB NOT NULL,

    -- Source tracking
    source_type TEXT NOT NULL DEFAULT 'scrape'
        CHECK (source_type IN ('scrape', 'questionnaire', 'hybrid', 'manual')),
    source_page_ids UUID[],
    source_page_count INTEGER,
    questionnaire_id UUID,
    consultation_id UUID REFERENCES consultations(id),

    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(client_id, version)
);

CREATE INDEX IF NOT EXISTS idx_brand_profiles_client ON brand_profiles(client_id);

-- ============================================================
-- SEO AUDIT: Tables
-- ============================================================

CREATE TABLE IF NOT EXISTS seo_audits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id UUID NOT NULL REFERENCES organisations(id),
    client_id UUID NOT NULL REFERENCES clients(id),
    crawl_job_id UUID REFERENCES content_crawl_jobs(id),

    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'running', 'complete', 'failed')),

    overall_score INTEGER,
    technical_score INTEGER,
    content_score INTEGER,
    backlink_score INTEGER,
    keyword_score INTEGER,

    total_pages INTEGER DEFAULT 0,
    critical_issues INTEGER DEFAULT 0,
    warning_issues INTEGER DEFAULT 0,
    passed_checks INTEGER DEFAULT 0,
    opportunities INTEGER DEFAULT 0,

    audit_config JSONB DEFAULT '{}',
    competitor_domains TEXT[],

    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_seo_audits_client ON seo_audits(client_id);

CREATE TABLE IF NOT EXISTS seo_issues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    audit_id UUID NOT NULL REFERENCES seo_audits(id) ON DELETE CASCADE,
    page_id UUID REFERENCES content_pages(id),
    client_id UUID NOT NULL REFERENCES clients(id),

    category TEXT NOT NULL
        CHECK (category IN ('technical', 'content', 'meta', 'structure',
                            'performance', 'mobile', 'accessibility',
                            'backlinks', 'keywords', 'schema', 'internal_links')),
    severity TEXT NOT NULL
        CHECK (severity IN ('critical', 'warning', 'info', 'opportunity')),
    check_name TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    current_value TEXT,
    recommended_value TEXT,
    impact TEXT,

    ai_fix_available BOOLEAN DEFAULT FALSE,
    ai_fix_content TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_seo_issues_audit ON seo_issues(audit_id);
CREATE INDEX IF NOT EXISTS idx_seo_issues_severity ON seo_issues(audit_id, severity);

CREATE TABLE IF NOT EXISTS backlink_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id),
    audit_id UUID NOT NULL REFERENCES seo_audits(id) ON DELETE CASCADE,

    total_backlinks INTEGER DEFAULT 0,
    referring_domains INTEGER DEFAULT 0,
    dofollow_links INTEGER DEFAULT 0,
    nofollow_links INTEGER DEFAULT 0,
    domain_rank REAL,
    spam_score REAL,

    top_referring_domains JSONB DEFAULT '[]',
    anchor_text_distribution JSONB DEFAULT '[]',
    link_type_distribution JSONB DEFAULT '{}',
    new_lost_trend JSONB DEFAULT '[]',

    fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_backlink_profiles_client ON backlink_profiles(client_id);

CREATE TABLE IF NOT EXISTS keyword_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id),
    audit_id UUID NOT NULL REFERENCES seo_audits(id) ON DELETE CASCADE,

    ranking_keywords JSONB DEFAULT '[]',
    keyword_gaps JSONB DEFAULT '[]',
    cannibalization JSONB DEFAULT '[]',

    total_ranking_keywords INTEGER DEFAULT 0,
    keywords_top_3 INTEGER DEFAULT 0,
    keywords_top_10 INTEGER DEFAULT 0,
    keywords_top_50 INTEGER DEFAULT 0,
    total_keyword_gaps INTEGER DEFAULT 0,
    estimated_traffic INTEGER DEFAULT 0,

    fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_keyword_profiles_client ON keyword_profiles(client_id);

CREATE TABLE IF NOT EXISTS competitor_analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id),
    audit_id UUID REFERENCES seo_audits(id) ON DELETE CASCADE,

    competitor_domain TEXT NOT NULL,
    crawl_job_id UUID REFERENCES content_crawl_jobs(id),

    domain_rank REAL,
    total_backlinks INTEGER,
    referring_domains INTEGER,
    total_ranking_keywords INTEGER,
    estimated_traffic INTEGER,
    common_keywords INTEGER,
    unique_keywords INTEGER,

    -- Content analysis (from competitor crawl)
    content_themes JSONB DEFAULT '[]',
    page_structure JSONB DEFAULT '{}',
    avg_word_count INTEGER,
    content_quality_notes TEXT,

    comparison JSONB DEFAULT '{}',

    fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_competitor_analyses_client ON competitor_analyses(client_id);

-- ============================================================
-- CONTENT GENERATION: Tables
-- ============================================================

CREATE TABLE IF NOT EXISTS content_copy (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id),
    organisation_id UUID NOT NULL REFERENCES organisations(id),
    page_id UUID REFERENCES content_pages(id),
    generated_by UUID REFERENCES users(id),

    copy_type TEXT NOT NULL
        CHECK (copy_type IN ('page_rewrite', 'new_page', 'meta_title',
                             'meta_description', 'h1_suggestion', 'section',
                             'blog_post', 'product_description', 'cta',
                             'site_structure')),

    title TEXT,
    content TEXT NOT NULL,
    target_keyword TEXT,
    target_word_count INTEGER,
    actual_word_count INTEGER,

    seo_score INTEGER,
    readability_score REAL,

    -- Simplified two-state workflow
    status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'final')),

    -- Generation metadata
    prompt_tokens INTEGER,
    completion_tokens INTEGER,
    model_used TEXT,
    generation_config JSONB DEFAULT '{}',

    -- Context tracking (what inputs were used)
    context_sources JSONB DEFAULT '{}',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_content_copy_client ON content_copy(client_id);
CREATE INDEX IF NOT EXISTS idx_content_copy_page ON content_copy(page_id);
CREATE INDEX IF NOT EXISTS idx_content_copy_status ON content_copy(status);
