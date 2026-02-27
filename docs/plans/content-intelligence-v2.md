# Content Intelligence Module — Revised Specification (V2)

**Version:** 2.0
**Date:** February 2026
**Status:** Specification — Pre-Development
**Scope:** Phases 1-3 + Social Media Copy (Crawl + Audit + Copy Generation + Social)
**Dependencies:** Existing Webkit platform (SvelteKit + Go + PostgreSQL + Cloudflare)

---

## What Changed From V1

- **Scope reduced to Phases 1-3.** Social media management (Phase 4) and integration polish (Phase 5) deferred to future spec.
- **Firecrawl eliminated.** Replaced with Colly (Go crawler) + Cloudflare Browser Rendering. Saves ~$83-700/month, removes third-party dependency.
- **DataForSEO pricing corrected.** No minimum commitment — pure pay-as-you-go.
- **Two entry paths defined.** Path A (existing website) and Path B (new website / no site to crawl).
- **Questionnaire + Consultation data integrated as first-class input** for brand profiling and content generation.
- **Social media copy generator added** as lightweight Feature 6 — same AI pipeline, platform-specific prompts. No scheduling/publishing integration.
- **Client Overview Dashboard (Option C)** replaces redirect at `/content/[clientId]` with status overview + guided next steps.
- **Re-crawl & generation history** — crawl runs and generated copy tracked with timestamps, version-aware.
- **AI context visibility** — shows users what data sources are available/used per client for transparency.
- **Simpler copy status workflow.** Two states (draft/final) instead of four. Full approval workflow deferred.
- **NATS job queue architecture defined** for background pipeline work.
- **Embedding model versioning added** to content_chunks table.
- **English only** — multi-language support deferred.
- **Tenant isolation defined** for content-service Go microservice (agency_id validation on every request).
- **Export format specified** — per-page structured content with markdown/Word/plain text options.
- **SEO audit → proposal integration** — audit summary feeds into proposal generation for upsell value.
- **Competitor crawl limits set** — max 3 competitors, 15 core pages each.

---

## Executive Summary

Content Intelligence transforms Webkit from a client lifecycle tool into an AI-powered content engine. The core loop: extract client content (or gather context for new sites), build a brand + competitive profile, run SEO audits, and generate targeted copy — all informed by the client's actual voice, industry position, and strategic goals.

### Two Entry Paths

**Path A — Existing Website (site revamp/refresh)**
1. Enter client URL → Webkit crawls and extracts all content
2. AI builds brand voice profile from scraped content + questionnaire data
3. SEO audit runs (technical + content + backlinks + keywords)
4. AI generates deliverables: improved page copy, meta descriptions, new pages

**Path B — New Website (no existing site)**
1. Client completes Webkit Questionnaire (business context, brand, competitors, goals)
2. Webkit crawls up to 3 competitor sites specified in questionnaire (10-15 core pages each)
3. AI builds competitive landscape profile + keyword research for the industry
4. Brand voice profile built from questionnaire data (industry, tone preferences, audience)
5. AI generates deliverables: page copy, site structure, meta descriptions — informed by competitor intelligence and client brief

Both paths converge at the same AI generation layer. The difference is the context assembly: Path A uses scraped content + SEO data, Path B uses questionnaire data + competitor intelligence.

---

## Architecture Overview

### The Shared Foundation

```
┌─────────────────────────────────────────────────────────────┐
│                   CONTENT INTELLIGENCE ENGINE                │
│                                                             │
│  ┌──────────────┐   ┌──────────────┐   ┌───────────────┐  │
│  │ Colly Crawler │   │ Brand Voice  │   │ Content       │  │
│  │ + CF Browser  │──▸│ Profiler     │──▸│ Knowledge     │  │
│  │ Rendering     │   │ (AI)         │   │ Base (pgvec)  │  │
│  └──────────────┘   └──────────────┘   └──────┬────────┘  │
│                                                │            │
│  ┌──────────────┐                              │            │
│  │ Questionnaire │──▸ (feeds profiler          │            │
│  │ + Consultation│    directly for Path B)      │            │
│  │ Data          │                              │            │
│  └──────────────┘                              │            │
│                                                │            │
│  ┌─────────────────────────────────────────────▼────────┐  │
│  │              Unified AI Generation Layer               │  │
│  │  (Brand profile + RAG chunks + SEO data + brief)      │  │
│  └──────┬────────────┬────────────┬──────────────────────┘  │
│         │            │            │                          │
│    ┌────▼────┐ ┌─────▼─────┐ ┌───▼───┐                    │
│    │ SEO     │ │ Copy      │ │ Meta  │                    │
│    │ Audit   │ │ Gen       │ │ Gen   │                    │
│    └─────────┘ └───────────┘ └───────┘                    │
└─────────────────────────────────────────────────────────────┘
```

### Crawler Architecture: Colly + Cloudflare Browser Rendering

**Why this combination:**
- **Colly** (github.com/gocolly/colly, 25k stars, active) handles crawl orchestration: URL queue, deduplication, depth limiting, rate limiting, robots.txt compliance, concurrent scheduling
- **Cloudflare Browser Rendering** handles page rendering: JavaScript execution, clean markdown extraction, link discovery — as a managed API within the existing CF ecosystem
- **Jina Reader** (r.jina.ai) as zero-config fallback for edge cases

**Why not Firecrawl:** Eliminates $83-700/month dependency. Colly + CF Browser Rendering covers the same functionality within the existing infrastructure. Client sites are typically 20-100 pages — no need for a managed crawling SaaS.

**Why not raw Playwright/ChromeDP:** Both require running headless browser processes on the server. CF Browser Rendering provides the same rendering as a managed API — no browser process management, memory leaks, or crash handling.

**Colly's role is orchestration only.** Its built-in HTTP fetcher is bypassed. Instead, for each URL:
1. Colly queues the URL and manages scheduling/deduplication
2. The custom transport calls CF Browser Rendering `/markdown` for content extraction
3. CF Browser Rendering `/links` returns discovered URLs for Colly to queue
4. Colly continues until depth limit or no new URLs

```go
// Simplified: Colly with CF Browser Rendering backend
c := colly.NewCollector(
    colly.MaxDepth(3),
    colly.Async(true),
)

c.Limit(&colly.LimitRule{
    DomainGlob:  "*",
    Parallelism: 3,
    Delay:       2 * time.Second,
})

// Override transport to use CF Browser Rendering
c.WithTransport(&cfBrowserTransport{
    workerURL: "https://browser-rendering.your-worker.workers.dev",
})
```

**CF Browser Rendering capacity:**
- Workers Paid ($5/mo): 10 hours/month, 10 concurrent browsers
- At ~30 sec/page: ~1,200 pages/month included free
- Overage: $0.09/browser-hour
- For 50 clients × 50 pages = 2,500 pages/month ≈ ~21 hours ≈ ~$1/month overage

### New Microservice: `content-service` (Go)

```
content-service/
├── cmd/
│   └── server/main.go
├── internal/
│   ├── crawler/
│   │   ├── crawler.go          # Colly-based crawl coordinator
│   │   ├── transport.go        # CF Browser Rendering HTTP transport
│   │   ├── classifier.go       # Three-layer page type classification
│   │   ├── sitemap.go          # Sitemap.xml parser
│   │   └── robots.go           # robots.txt handling (Colly built-in + custom)
│   ├── profiler/
│   │   ├── profiler.go         # Profile generation orchestrator
│   │   ├── voice.go            # Brand voice extraction (from scrape OR questionnaire)
│   │   ├── themes.go           # Content theme extraction
│   │   └── questionnaire.go    # Questionnaire data → profile context builder
│   ├── seo/
│   │   ├── content.go          # On-page content SEO checks
│   │   ├── technical.go        # Technical SEO via DataForSEO On-Page
│   │   ├── backlinks.go        # Backlink analysis via DataForSEO
│   │   ├── keywords.go         # Keyword research + gap analysis
│   │   ├── competitors.go      # Competitor SEO comparison
│   │   └── report.go           # SEO report generation
│   ├── generator/
│   │   ├── copy.go             # Website copy generation
│   │   ├── meta.go             # Meta descriptions, titles, schema
│   │   └── context.go          # Context assembly (brand + RAG + SEO + brief)
│   ├── embeddings/
│   │   ├── embed.go            # Text → vector embedding
│   │   └── search.go           # Similarity search
│   ├── jobs/
│   │   ├── queue.go            # NATS job queue manager
│   │   ├── crawl_job.go        # Crawl pipeline job handler
│   │   ├── audit_job.go        # Audit pipeline job handler
│   │   └── generate_job.go     # Generation job handler
│   └── handlers/
│       ├── crawl.go
│       ├── audit.go
│       ├── generate.go
│       └── reports.go
├── pkg/
│   ├── dataforseo/             # DataForSEO API client
│   │   ├── client.go
│   │   ├── backlinks.go
│   │   ├── keywords.go
│   │   ├── onpage.go
│   │   └── labs.go
│   ├── cfbrowser/              # CF Browser Rendering client
│   │   ├── client.go
│   │   ├── markdown.go
│   │   └── links.go
│   ├── jina/                   # Jina Reader fallback client
│   │   └── client.go
│   └── models/
│       ├── content.go
│       └── seo.go
└── migrations/
    └── 001_content_intelligence.sql
```

### NATS Job Queue Architecture

All long-running operations run as background jobs via NATS (already in Webkit's stack):

```
NATS Subjects:
  content.crawl.start      → Initiates crawl pipeline
  content.crawl.page       → Process individual page (extract, classify, chunk, embed)
  content.crawl.complete   → Crawl finished, trigger profiling
  content.profile.generate → Generate/regenerate brand profile
  content.audit.start      → Initiate SEO audit pipeline
  content.audit.section    → Process audit section (technical/backlinks/keywords/content)
  content.audit.complete   → Audit finished, calculate scores
  content.generate.copy    → Generate copy for a page
  content.generate.bulk    → Bulk generation job
```

**Concurrency limits per provider:**
- CF Browser Rendering: 10 concurrent (Workers Paid limit)
- DataForSEO: 5 concurrent (reasonable default, adjustable)
- Anthropic API: 10 concurrent (based on tier)
- Workers AI (embeddings): 20 concurrent (generous free tier)

**Pipeline resumability:** Each job phase is idempotent. If a crawl fails at page 35 of 50, the `content_crawl_jobs.pages_processed` counter lets it resume from page 35. Each `content_pages` record is upserted by `(client_id, url)` unique constraint, so re-processing a page just overwrites.

### New SvelteKit Routes

```
/[agencySlug]/content/                          # Content Intelligence dashboard (client list)
├── /[agencySlug]/content/import                # Import client website (enter URL)
│                                                # OR start from questionnaire (Path B)
├── /[agencySlug]/content/[clientId]/           # Client Overview Dashboard (see Feature 7)
│   ├── /pages                                  # All scraped pages with status
│   ├── /brand                                  # Brand voice profile viewer/editor
│   ├── /audit                                  # SEO audit dashboard
│   │   ├── /issues                             # Issues by category/severity
│   │   ├── /backlinks                          # Backlink profile
│   │   ├── /keywords                           # Rankings + gaps
│   │   └── /competitors                        # Competitor comparison
│   ├── /copy                                   # AI copy workspace
│   │   ├── /generate                           # New copy generation
│   │   └── /[copyId]                           # Copy editor
│   └── /social                                 # Social media copy (see Feature 6)
│       ├── /generate                           # Generate social post
│       └── /[postId]                           # Post editor
└── /[agencySlug]/content/reports               # Generated reports
```

Note: Routes scoped under `[agencySlug]` to match existing Webkit routing patterns and multi-tenant architecture.

---

## Path B: New Website Client Flow

### Context Sources

For clients without an existing website, the Content Intelligence system draws from two existing Webkit data sources:

**1. Full Website Questionnaire (37+ fields, 8 sections)**

Already captures:
- Business name, industry, years in operation
- Services/products offered (detailed descriptions)
- Target audience demographics and psychographics
- Brand personality descriptors, preferred tone
- Competitor website URLs (2-5 typically provided)
- Design preferences, color preferences
- Required pages list (e.g., "Home, About, Services, Blog, Contact, FAQ")
- Must-have features, nice-to-have features
- Content they can provide vs. need help creating
- Geographic service areas
- Unique selling propositions

**2. Consultation Data (39 fields, 4 steps)**

Additional context:
- Primary challenges and pain points
- Primary goals (lead generation, sales, brand awareness, etc.)
- Conversion goals (specific outcomes)
- Budget range and timeline
- Urgency level
- Admired websites with reasons
- Performance data (if migrating from an old site)

### Questionnaire Extensions for Content Intelligence

Add a new page/section to the existing Full Website Questionnaire template — NOT a separate form. The client is already in the flow of answering questions, so a "Content Strategy" page at the end feels natural. All fields are optional.

Agencies who need different or more specific content intel questions can create their own questionnaire templates via the form builder. The content intelligence system consumes questionnaire responses generically — it pulls from whatever fields exist, not hardcoded field IDs.

```
Page/Section: "Content Strategy" (new page appended to existing questionnaire template)

- target_keywords: TEXT[]
  "What search terms do you think your customers use to find businesses like yours?"
  (Free text, comma-separated. AI will expand and refine these.)

- competitor_urls: TEXT[] (already exists in questionnaire as "admired_websites")
  Rename/relabel: "List up to 3 competitor websites in your industry"
  (These become the crawl targets for Path B. Max 3.)

- content_tone_samples: TEXT
  "Paste a paragraph from any website, email, or brochure that sounds like your brand"
  (Raw text input. Even one paragraph gives the AI a voice anchor.)

- content_topics: TEXT[]
  "What topics should your website cover? List 5-10 subjects you want to be known for."

- local_areas: TEXT[]
  "What suburbs, cities, or regions do you serve?"
  (Feeds into local SEO keyword generation)
```

These fields are **optional** — the system works without them but produces better output with them. The default Webkit questionnaire template includes them; agency-created templates may or may not.

### Path B Pipeline

```
1. Agency creates client + sends questionnaire
2. Client completes questionnaire (including competitor URLs)
3. Agency triggers "Content Intelligence" for this client
4. System detects: no client website URL → Path B mode
   ┌──────────────────────────────────────────────────┐
   │ Path B: New Website                               │
   │                                                   │
   │ a. Crawl competitor sites (up to 3, 15 pages ea)  │
   │    - Core pages only: homepage, about, services,  │
   │      key blog posts. Skip policies, legal, etc.   │
   │ b. Classify competitor pages                      │
   │ c. Extract competitor content themes              │
   │ d. Run keyword research for client industry       │
   │    (DataForSEO: keyword_suggestions,              │
   │     keyword_ideas, competitors_domain)             │
   │ e. Build competitive landscape profile            │
   │ f. Build brand voice from questionnaire data      │
   │    (tone samples, personality, industry)          │
   │ g. Generate recommended site structure            │
   │ h. Generate copy for each recommended page        │
   └──────────────────────────────────────────────────┘
5. Agency reviews generated site structure + copy
6. Edit, approve, export for development handoff
```

### Brand Voice Profile: Two Sources

The `brand_profiles.profile` JSONB structure is the same regardless of source. The `generated_by` field tracks origin:

```
generated_by: 'scrape'          → Path A: built from scraped website content
generated_by: 'questionnaire'   → Path B: built from questionnaire + consultation data
generated_by: 'hybrid'          → Path A with questionnaire enhancements
generated_by: 'manual'          → Agency manually created/edited
```

**Path A generation prompt context:**
- 10-15 best pages from scraped content
- Questionnaire data (if available) for strategic intent

**Path B generation prompt context:**
- Questionnaire: brand personality, tone preferences, content tone samples
- Consultation: industry, goals, target audience, admired websites
- Competitor content themes (from competitor crawls)
- Industry norms (from keyword research)

**Path A+B hybrid (recommended for site revamps):**
When a client has BOTH an existing site AND completed a questionnaire, the profiler merges both inputs. The questionnaire captures where the client *wants* to go; the scraped content captures where they *are*. The profile notes divergences — e.g., "Current tone is formal/corporate but questionnaire indicates desire for approachable/friendly."

---

## Database Schema

### Changes from V1

- Added `embedding_model` to `content_chunks` (future-proofs model migration)
- Added `source_type` to `brand_profiles` ('scrape', 'questionnaire', 'hybrid', 'manual')
- Added `questionnaire_id` and `consultation_id` to `brand_profiles` (links to input data)
- Simplified `content_copy.status` to two states: 'draft' and 'final'
- Removed all social media tables (deferred)
- Removed `social_accounts`, `social_posts`, `social_templates` tables
- Added `competitor_crawl_jobs` linking table

### Core Tables

```sql
-- ============================================================
-- CONTENT INTELLIGENCE: Core Tables
-- ============================================================

CREATE EXTENSION IF NOT EXISTS vector;

-- Tracks crawl/import jobs per client (or per competitor)
CREATE TABLE IF NOT EXISTS content_crawl_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID NOT NULL REFERENCES agencies(id),
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
CREATE INDEX IF NOT EXISTS idx_crawl_jobs_agency ON content_crawl_jobs(agency_id);

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
    agency_id UUID NOT NULL REFERENCES agencies(id),
    version INTEGER NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    -- Structured brand voice profile (generated by AI)
    profile JSONB NOT NULL,
    /*
    {
      "personality_traits": ["Confident", "Professional", "Approachable"],
      "tone_guidelines": {
        "default": "Warm and knowledgeable",
        "promotional": "Enthusiastic but not salesy",
        "educational": "Clear and authoritative"
      },
      "vocabulary": {
        "formality_level": "semi-formal",
        "industry_jargon": ["terms", "they", "use"],
        "avoided_terms": ["terms", "they", "never", "use"],
        "signature_phrases": ["phrases", "they", "repeat"]
      },
      "sentence_structure": {
        "avg_length": "medium",
        "active_passive": "predominantly_active",
        "uses_contractions": true
      },
      "messaging_pillars": [
        { "theme": "Quality craftsmanship", "evidence": "..." }
      ],
      "constraints": {
        "always": ["Use Australian spelling", "Reference local areas"],
        "never": ["Use American spelling", "Make unsubstantiated claims"]
      },
      "competitive_positioning": {
        "differentiators": ["..."],
        "industry_norms": ["..."],
        "gaps_to_fill": ["..."]
      }
    }
    */

    -- Source tracking
    source_type TEXT NOT NULL DEFAULT 'scrape'
        CHECK (source_type IN ('scrape', 'questionnaire', 'hybrid', 'manual')),
    source_page_ids UUID[],
    source_page_count INTEGER,
    questionnaire_id UUID,              -- Links to questionnaire_responses or form_submissions
    consultation_id UUID REFERENCES consultations(id),

    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(client_id, version)
);

CREATE INDEX IF NOT EXISTS idx_brand_profiles_client ON brand_profiles(client_id);

-- ============================================================
-- SEO AUDIT: Tables (unchanged from V1)
-- ============================================================

CREATE TABLE IF NOT EXISTS seo_audits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID NOT NULL REFERENCES agencies(id),
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
    content_themes JSONB DEFAULT '[]',       -- Main topics/themes found
    page_structure JSONB DEFAULT '{}',       -- Page types and counts
    avg_word_count INTEGER,
    content_quality_notes TEXT,              -- AI-generated summary

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
    agency_id UUID NOT NULL REFERENCES agencies(id),
    page_id UUID REFERENCES content_pages(id),
    generated_by UUID REFERENCES users(id),

    copy_type TEXT NOT NULL
        CHECK (copy_type IN ('page_rewrite', 'new_page', 'meta_title',
                             'meta_description', 'h1_suggestion', 'section',
                             'blog_post', 'product_description', 'cta',
                             'site_structure', 'social_post')),

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
    /*
    For social_post copy_type, generation_config includes:
    {
      "platform": "facebook|instagram|linkedin|twitter",
      "post_goal": "engagement|traffic|awareness|promotion",
      "topic": "user-provided topic or brief",
      "tone_override": "optional tone for this specific post",
      "include_hashtags": true,
      "include_cta": true,
      "include_emoji": true
    }
    */

    -- Context tracking (what inputs were used)
    context_sources JSONB DEFAULT '{}',
    /*
    {
      "brand_profile_id": "uuid",
      "brand_source": "hybrid",
      "rag_chunks_used": 5,
      "seo_issues_referenced": 3,
      "questionnaire_id": "uuid",
      "consultation_id": "uuid",
      "competitor_domains_referenced": ["competitor1.com", "competitor2.com"]
    }
    */

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_content_copy_client ON content_copy(client_id);
CREATE INDEX IF NOT EXISTS idx_content_copy_page ON content_copy(page_id);
CREATE INDEX IF NOT EXISTS idx_content_copy_status ON content_copy(status);
```

---

## External API Integration

### Cloudflare Browser Rendering (Page Extraction)

Already within Webkit's Cloudflare ecosystem. Used as the rendering backend for Colly.

| Endpoint | Purpose | Use Case |
|----------|---------|----------|
| `/markdown` | Page → clean LLM-ready markdown | Primary content extraction |
| `/links` | Discover all outbound URLs | URL discovery for crawl frontier |
| `/scrape` | Extract via CSS selectors | Targeted extraction (testimonials, products) |
| `/json` | AI-powered structured extraction | Extract specific fields (prices, team members) |

**Pricing:** Workers Paid ($5/mo): 10 hours/month free. Overage $0.09/hour.

### Jina Reader (Fallback Extractor)

Prepend `https://r.jina.ai/` to any URL → get clean markdown. Zero config.

**Use for:** Fallback when CF Browser Rendering fails (anti-bot, timeouts). ~$0.02/million tokens.

### DataForSEO (SEO Data) — Path A Only

Pure pay-as-you-go, no minimum commitment.

| API | Purpose | Est. Cost/Client |
|-----|---------|-----------------|
| On-Page API | Technical SEO audit | ~$0.50 |
| Backlinks API | Backlink profile analysis | ~$0.80 |
| DataForSEO Labs | Keyword research + competitor gaps | ~$1.20 |
| Keywords Data API | Search volume + CPC | ~$0.30 |

**Total per full audit: ~$2.80** (reduced from V1 estimate — no SERP API needed in V2)

For Path B clients (no site), only keyword research + competitor analysis APIs are used (~$1.50/client).

### Anthropic API (AI Generation) — Existing Integration

**Models:**
- Claude Sonnet: Brand profiling, copy generation, SEO recommendations
- Claude Haiku: Page classification, meta descriptions, quick scoring

**Prompt caching:** Brand profile cached as system prompt. Subsequent calls read at 0.1× rate. ~75% savings on repeat calls per client.

### Workers AI (Embeddings) — Existing Infrastructure

`@cf/baai/bge-base-en-v1.5` — 768 dimensions, free on Workers Paid.

---

## Feature Specifications

### Feature 1: Website Content Import & Brand Profiling

#### Path A: Existing Website

1. Agency navigates to `/[agencySlug]/content/import`
2. Selects client, enters website URL
3. System validates URL, fetches robots.txt
4. **Crawl:** Colly orchestrates, CF Browser Rendering extracts
   - Sitemap.xml parsed first (if available)
   - Link discovery via `/links` for pages not in sitemap
   - Max depth: 3 (configurable). Max pages: 200 (safety limit)
5. **Classify:** Three-layer classification on each page
6. **Chunk:** Body text → 400-600 token chunks, 15% overlap
7. **Embed:** Chunks → Workers AI → pgvector
8. **Profile:** Top 10-15 pages + questionnaire data (if available) → Claude Sonnet → brand profile
9. Dashboard shows: all pages, types, brand profile, content stats

#### Path B: New Website

1. Agency navigates to `/[agencySlug]/content/import`
2. Selects client (no website URL) → system detects Path B
3. **Gather context:** Pull questionnaire + consultation data for this client
4. **Crawl competitors:** Up to 3 competitor URLs from questionnaire (15 core pages each)
   - Same crawl pipeline as Path A but tagged as `source_type: 'competitor'`
5. **Keyword research:** DataForSEO keyword_suggestions + keyword_ideas for industry + location
6. **Competitive landscape:** Analyse competitor content themes, page structures, word counts
7. **Profile:** Questionnaire data + competitor themes → Claude Sonnet → brand profile
8. **Generate site structure:** Recommended pages based on competitor analysis + industry norms
9. Dashboard shows: competitor analysis, brand profile, recommended site structure, keyword opportunities

#### Three-Layer Page Classification (unchanged from V1)

```
Layer 1: URL pattern matching (~70% accuracy, free)
Layer 2: HTML structure analysis (~80% accuracy, free)
Layer 3: LLM classification via Haiku (~95% accuracy, ~$0.0004/page)
  → Only fires for pages not confidently classified by layers 1-2
```

#### Re-Crawl Strategy (Simplified from V1)

**Default: Monthly incremental for all clients.**
- Change detection: SHA-256 hash of body_text (not raw HTML)
- On-demand full re-crawl available via UI
- Weekly re-crawl as explicit agency opt-in (shown with estimated cost)
- No automatic HEAD request polling (too unreliable across servers)

---

### Feature 2: SEO Audit (Path A Only)

Unchanged from V1 spec. Key points:

- Combines scraped content analysis + DataForSEO data
- Content SEO checks run against `content_pages` data (no extra API calls)
- Technical checks via DataForSEO On-Page API
- Backlink analysis via DataForSEO Backlinks API
- Keyword research + gaps via DataForSEO Labs API
- Competitor comparison (up to 3 domains, from questionnaire or manual entry)
- Overall score: weighted composite (technical 25%, content 30%, backlinks 25%, keywords 20%)
- PDF report via existing Gotenberg integration

**For Path B clients:** No SEO audit (no site to audit). Instead, the competitor analysis and keyword research provide the strategic context. The "SEO" value for new sites is baked into the copy generation — every generated page targets keywords and follows SEO best practices informed by the competitive research.

---

### Feature 3: AI Copy Generation

#### Context Assembly (Both Paths)

Every generation call assembles context from available sources:

```
Tier 1: Brand Voice Profile (~500-1,000 tokens) — ALWAYS PRESENT
  Path A: from scraped content (+ questionnaire if available)
  Path B: from questionnaire + competitor themes
  Cached via Anthropic prompt caching (system prompt)

Tier 2: Content Context (~1,500-2,500 tokens) — VARIES BY PATH
  Path A: RAG-retrieved chunks from client's own content (pgvector)
  Path B: RAG-retrieved chunks from competitor content + questionnaire brief

Tier 3: SEO Context (~500-1,000 tokens) — WHEN AVAILABLE
  Path A: target keyword + competitor analysis + page issues from audit
  Path B: target keyword + competitor analysis + industry keyword research

Tier 4: Client Brief (~200-500 tokens) — WHEN AVAILABLE
  Consultation data: goals, challenges, target audience, conversion goals
  Questionnaire data: required pages, feature requirements, content topics
```

#### Copy Types

| Copy Type | Available In | Input | Output |
|-----------|-------------|-------|--------|
| Page rewrite | Path A | Existing page + SEO issues + keyword | Improved copy in brand voice |
| New page | Both | Purpose + keyword + brand profile | Full page copy with headings |
| Site structure | Path B | Competitor analysis + questionnaire | Recommended pages + hierarchy |
| Meta title | Both | Page content/purpose + keyword | 50-60 char title tag |
| Meta description | Both | Page content/purpose + keyword | 150-160 char description |
| H1 suggestion | Both | Page purpose + keyword | 20-70 char heading |
| Blog post | Both | Topic + keyword + brand profile | 1000-2500 word article |
| Product description | Both | Product details + brand voice | 150-400 words |

#### Copy Audit Workflow (Path A)

1. View all pages with content quality scores
2. Per-page view: current content, SEO issues, keyword analysis
3. "Generate improved copy" → AI with full context
4. Side-by-side diff: original vs. generated
5. Edit in place → mark as final
6. Bulk generation for all flagged pages
7. Export as structured document for handoff

#### Copy Generation Workflow (Path B)

1. View recommended site structure (generated from competitor + questionnaire analysis)
2. Adjust page list: add/remove/rename pages
3. Per-page: set target keyword (suggested from research), purpose, notes
4. "Generate copy" → AI uses brand profile + competitor context + keyword data
5. Edit in place → mark as final
6. Export as structured document for development handoff

---

### Feature 4: Content Export

#### Per-Page Structured Content

Generated copy is stored per-page with structured sections. Each page's content follows a consistent structure that maps to common website layouts:

```json
{
  "page_slug": "services/web-design",
  "page_type": "service",
  "target_keyword": "web design Brisbane",
  "meta": {
    "title": "Professional Web Design Brisbane | Agency Name",
    "description": "Award-winning web design in Brisbane..."
  },
  "sections": [
    {
      "type": "hero",
      "heading": "...",
      "subheading": "...",
      "cta_text": "...",
      "cta_url": "/contact"
    },
    {
      "type": "intro",
      "body": "..."
    },
    {
      "type": "services_list",
      "heading": "...",
      "items": [
        { "title": "...", "description": "...", "icon_suggestion": "..." }
      ]
    },
    {
      "type": "cta_banner",
      "heading": "...",
      "body": "...",
      "cta_text": "...",
      "cta_url": "..."
    },
    {
      "type": "testimonial",
      "placeholder": true,
      "note": "Add client testimonial here"
    },
    {
      "type": "faq",
      "heading": "...",
      "items": [
        { "question": "...", "answer": "..." }
      ]
    }
  ],
  "word_count": 850,
  "seo_notes": "Primary keyword used 3x. H1 contains keyword. Internal links to /about and /contact."
}
```

Section types supported: `hero`, `intro`, `services_list`, `features_grid`, `cta_banner`, `testimonial`, `faq`, `team`, `process_steps`, `pricing`, `portfolio`, `stats`, `body_text`, `sidebar`. Not every page uses every type — the AI selects appropriate sections based on page purpose.

#### Export Formats

Three export options via `POST /api/content/copy/export/:clientId`:

**1. Markdown (`.md` per page, bundled as `.zip`)**
Default developer handoff format. Each page is a separate `.md` file with YAML frontmatter:

```markdown
---
title: "Professional Web Design Brisbane"
slug: services/web-design
page_type: service
target_keyword: web design Brisbane
meta_title: "Professional Web Design Brisbane | Agency Name"
meta_description: "Award-winning web design in Brisbane..."
---

# Professional Web Design Brisbane

[Hero subheading text...]

**[Get a Free Quote →](/contact)**

## Our Web Design Services

### Responsive Design
[Description...]

### E-Commerce Solutions
[Description...]

---

## Frequently Asked Questions

**Q: How long does a website take?**
A: [Answer...]
```

**2. Word Document (`.docx`)**
For agencies who hand off to non-technical content editors or clients for review. Single document with all pages as chapters, table of contents, page metadata in callout boxes. Generated via existing Gotenberg integration.

**3. Plain Text (`.txt` per page, bundled as `.zip`)**
Minimal format for copy-paste into any CMS. No markup, no frontmatter. Just headings (ALL CAPS) and body text with clear section separators:

```
PAGE: Services - Web Design
TARGET KEYWORD: web design Brisbane
META TITLE: Professional Web Design Brisbane | Agency Name
META DESCRIPTION: Award-winning web design in Brisbane...

========================================

PROFESSIONAL WEB DESIGN BRISBANE

[Hero subheading text...]

CTA: Get a Free Quote → /contact

----------------------------------------

OUR WEB DESIGN SERVICES

Responsive Design
[Description...]

E-Commerce Solutions
[Description...]
```

#### Export Scope Options

- **All final copy** — only pages marked `status: 'final'`
- **All copy** — both draft and final (drafts clearly marked)
- **Single page** — export one page at a time
- **Selected pages** — checkbox selection from copy list

---

### Feature 5: SEO Audit → Proposal Integration

When an agency has run an SEO audit for a client (Path A), the audit summary automatically becomes available as a data source for proposal generation. This turns the audit into an upsell tool — the agency can show the client what's wrong and propose fixing it.

#### How It Works

1. Agency runs SEO audit for a client (Feature 2)
2. Audit completes with scores and issues
3. Agency creates or edits a proposal for the same client
4. Proposal generator detects available SEO audit data
5. An "SEO Summary" section is offered as an optional proposal block
6. If included, the section is auto-generated from audit data

#### Proposal SEO Summary Section

The generated section uses traffic-light indicators for quick visual scanning:

```
SEO Health Summary for [client domain]
Audited: [date]

Overall Score: 62/100

🔴 Technical SEO: 45/100
   - 12 critical issues (broken links, missing meta tags, slow page speed)
   - Estimated fix effort: 2-3 days

🟡 Content Quality: 58/100
   - 8 pages with thin content (<300 words)
   - 5 pages missing H1 tags
   - Estimated fix effort: 1-2 days copywriting

🟢 Backlink Profile: 72/100
   - 340 referring domains
   - Healthy dofollow/nofollow ratio
   - 3 toxic links to disavow

🟡 Keyword Performance: 63/100
   - Ranking for 89 keywords (12 in top 10)
   - 45 keyword gaps vs. competitors
   - Top opportunity: "web design brisbane" (vol: 2,400, current: not ranking)

Recommended Actions:
1. Fix 12 critical technical issues (priority: immediate)
2. Rewrite 8 thin content pages with SEO-optimized copy
3. Target 10 high-opportunity keyword gaps
4. Disavow 3 toxic backlinks

Estimated Impact: +35-50% organic traffic within 6 months
```

#### Implementation

- **Data source:** `seo_audits` + `seo_issues` tables (already populated by Feature 2)
- **Generation:** Claude Haiku summarises the audit data into proposal-friendly language
- **Insertion point:** Proposals already support sections/blocks — this is a new block type `seo_summary`
- **Editable:** Agency can edit the generated summary before including in proposal
- **No extra API calls:** All data already exists from the audit; this is just a presentation layer

#### UX Flow

In the proposal editor, when SEO audit data exists for the client:
- A badge appears: "SEO audit available — add to proposal?"
- Clicking it generates and inserts the SEO summary section
- The section is editable like any other proposal block
- Traffic-light indicators render as colored badges in the proposal PDF/view

#### SEO Data in Proposal Settings

The Proposal Settings page becomes the single location for all external data source toggles — granular, per-source control over what gets pulled into proposals.

**Granular Data Source Toggles:**

```
Proposal Data Sources
─────────────────────────────────────────────
☑ SEO Audit
  ├── ☑ Technical Summary (score + top issues)
  ├── ☑ Content Issues (thin content, missing meta)
  ├── ☑ Keyword Gaps (competitor opportunities)
  ├── ☑ Backlink Profile (domain rank, referring domains)
  └── ☑ Competitor Comparison (side-by-side metrics)

☑ PageSpeed (standalone, from consultation)
  ├── ☑ Performance Score
  ├── ☑ Core Web Vitals
  └── ☑ Key Recommendations

☐ [Future data sources appear here]
─────────────────────────────────────────────
```

Each toggle is independent — an agency can include the SEO keyword gaps and backlink profile but exclude the technical summary, for example. When a data source is enabled, the proposal editor shows a badge ("SEO audit available" / "PageSpeed data available") for clients that have the relevant data.

**PageSpeed Location:**

PageSpeed currently lives on the consultation page as a quick "run this check" action. With the dedicated SEO audit that includes technical performance data from DataForSEO, there's overlap. The approach:

- **Keep** the quick PageSpeed check on the consultation page for convenience — it's lightweight, free (Google API), and useful even without a full audit
- **SEO audit is the canonical source** for proposal data when both exist — it's more comprehensive (DataForSEO covers speed metrics + hundreds of other technical checks)
- **Proposal settings lists both** as separate toggleable sources: "SEO Audit" (comprehensive, from content intelligence) and "PageSpeed standalone" (quick check, from consultation)
- If a client has both, agencies choose which to include — no automatic merging, no confusion about which numbers are "correct"
- Agencies who haven't run a full audit can still pull in PageSpeed data from the consultation

---

### Feature 6: Social Media Copy Generator

#### Philosophy

Lightweight, AI-only. No scheduling, no publishing, no API integrations with social platforms. The agency generates copy, previews it, copies it, and pastes it into their existing social media tool (Buffer, Hootsuite, Meta Business Suite, native platform). This is a "content factory" feature — not a social media management tool.

#### Why This Belongs in V2 (Not Deferred)

The social media copy generator reuses 100% of the existing AI pipeline. Same brand voice profile, same RAG context, same 4-tier context assembly. The only new code is platform-specific prompt templates and a lightweight UI. It's ~2-3 days of work on top of what's already built, and agencies will ask for it the moment they see the brand profiling + copy generation working.

#### Supported Platforms

| Platform | Max Length | Tone | Special Rules |
|----------|-----------|------|---------------|
| Facebook | ~500 chars (optimal) | Conversational, story-driven | Links allowed, emoji moderate, hashtags 2-3 |
| Instagram | 2,200 chars (caption) | Visual-first, lifestyle | Hashtag block (15-20), emoji heavy, no links in caption |
| LinkedIn | ~1,300 chars (optimal) | Professional, thought-leadership | Minimal hashtags (3-5), no emoji in headlines, line breaks for readability |
| X / Twitter | 280 chars | Punchy, direct | No hashtags in body (thread if needed), strong hooks, minimal emoji |

#### Context Assembly (Same 4-Tier Pipeline)

Social posts use the same context assembly as web copy but with a social-specific system prompt:

```
Tier 1: Brand Voice Profile (system prompt, cached)
Tier 2: RAG chunks relevant to post topic (2-3 chunks)
Tier 3: SEO context (target keyword if relevant, trending topics)
Tier 4: Post brief (topic, goal, platform rules, CTA preference)
```

The AI model receives platform-specific constraints as part of the prompt:
- Character limits (enforced, not just suggested)
- Platform conventions (hashtag style, emoji usage, tone)
- Post goal (engagement, traffic, awareness, promotion)
- CTA format (link in bio, swipe up, click link, etc.)

#### Generation Flow

1. User navigates to `/content/[clientId]/social/generate`
2. Selects platform (Facebook / Instagram / LinkedIn / X)
3. Enters topic or brief ("Announce our new web design packages", "Share a tip about site speed")
4. Optionally selects post goal (engagement / traffic / awareness / promotion)
5. Optionally selects tone override (or use brand voice default)
6. Clicks "Generate" → AI produces 3 variations
7. User picks best variation (or regenerates)
8. Edit in-place → copy to clipboard → paste into social platform
9. Saved as `content_copy` with `copy_type: 'social_post'` and `generation_config.platform`

#### Three Variations Pattern

Each generation produces 3 variations with different angles:
- **Variation A**: Informative — leads with the value/insight
- **Variation B**: Engaging — leads with a question or hook
- **Variation C**: Story-driven — leads with a narrative or analogy

User selects one as the base, then edits. This avoids the "I don't love this one" regeneration loop.

#### Social Copy List View

`/content/[clientId]/social` shows all generated social posts with:
- Platform icon + name
- Topic/title preview
- Post goal badge
- Status (draft/final)
- Created date
- Copy-to-clipboard button (one-click for quick grab)

Filterable by platform and status.

#### API Endpoints

```
POST   /api/content/generate/social      # Generate social post (returns 3 variations)
GET    /api/content/social/:clientId      # List social posts for client
PATCH  /api/content/copy/:copyId         # Update (same as web copy — shared table)
DELETE /api/content/copy/:copyId         # Delete (same as web copy — shared table)
```

The generate endpoint is new; list/update/delete reuse the existing `content_copy` endpoints since social posts are stored in the same table with `copy_type: 'social_post'`.

#### Cost

Negligible additional cost. Social posts are short (~100-500 tokens output). 3 variations ≈ ~$0.002 per generation with Claude Haiku. Even generating 50 social posts/month adds <$0.10 to the per-client cost.

---

### Feature 7: Client Overview Dashboard (Option C)

#### The Problem

Currently, `/content/[clientId]` redirects to `/pages`. This means:
- New users don't know what features are available or what to do next
- There's no single place to see the status of all content intelligence work for a client
- After a crawl completes, users have to manually navigate to each section
- No visibility into which AI data sources are available for this client

#### The Solution: Smart Landing Page + Post-Crawl Prompt

Replace the redirect with an overview dashboard that serves two purposes:
1. **Status Overview** — at-a-glance view of what's been done and what's available
2. **Guided Next Steps** — after key events (crawl complete, profile generated), show contextual prompts for what to do next

#### Dashboard Layout

```
┌─────────────────────────────────────────────────────────┐
│  Client: Plentify Web Designs                          │
│  Website: plentify.au  •  Last crawled: 2 days ago     │
│                                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │ 📄 Pages    │  │ 🎨 Brand    │  │ 🔍 Audit    │    │
│  │ 47 pages    │  │ Profile     │  │ Score: 62   │    │
│  │ crawled     │  │ Active v2   │  │ /100        │    │
│  │ ✅ Complete │  │ ✅ Ready    │  │ ✅ Complete │    │
│  └─────────────┘  └─────────────┘  └─────────────┘    │
│                                                         │
│  ┌─────────────┐  ┌─────────────┐                      │
│  │ ✍️ Copy     │  │ 📱 Social   │                      │
│  │ 12 pieces   │  │ 8 posts     │                      │
│  │ 5 final     │  │ 3 final     │                      │
│  │ ✅ Active   │  │ ✅ Active   │                      │
│  └─────────────┘  └─────────────┘                      │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │  AI Context Sources Available                    │   │
│  │  ✅ Brand Profile (v2, hybrid)                  │   │
│  │  ✅ 47 pages crawled (1,240 RAG chunks)         │   │
│  │  ✅ SEO Audit (score: 62, 15 issues)            │   │
│  │  ✅ Consultation data (39 fields)               │   │
│  │  ⬜ Questionnaire data (not completed)          │   │
│  │  → More data = better AI output                  │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Recent Activity                                │   │
│  │  • Generated 3 Facebook posts (2 hrs ago)       │   │
│  │  • Re-crawled website (yesterday)               │   │
│  │  • Updated brand profile to v2 (3 days ago)     │   │
│  │  • SEO audit completed, score 62 (1 week ago)   │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

#### Feature Status Cards

Each card shows:
- **Feature name + icon** (Pages, Brand, Audit, Copy, Social)
- **Key metric** (page count, profile version, score, copy count, post count)
- **Status indicator**: `✅ Complete/Ready/Active`, `🔄 In Progress`, `⬜ Not Started`, `❌ Failed`
- **Click → navigates to that feature's page**

Status is derived from existing data (no new table needed):
- **Pages**: `content_crawl_jobs` latest status + `content_pages` count
- **Brand**: `brand_profiles` where `is_active = true` → version number + source_type
- **Audit**: `seo_audits` latest → overall_score + status
- **Copy**: `content_copy` count by status (draft/final), filtered by `copy_type != 'social_post'`
- **Social**: `content_copy` count where `copy_type = 'social_post'`, by status

#### AI Context Sources Panel

This panel answers the user's question: "How much data is the AI using?" It shows what data is available for this client and what's missing:

| Source | Check | Display When Present | Display When Missing |
|--------|-------|---------------------|---------------------|
| Brand Profile | `brand_profiles` exists and `is_active` | "✅ Brand Profile (v{version}, {source_type})" | "⬜ No brand profile — generate one" |
| Crawled Pages | `content_pages` count > 0 | "✅ {count} pages crawled ({chunk_count} RAG chunks)" | "⬜ No pages crawled — import website" |
| SEO Audit | `seo_audits` with `status = 'complete'` | "✅ SEO Audit (score: {score}, {issues} issues)" | "⬜ No audit — run SEO audit" |
| Consultation | `consultations` for this client | "✅ Consultation data ({field_count} fields)" | "⬜ No consultation data" |
| Questionnaire | `form_submissions` / questionnaire for this client | "✅ Questionnaire ({section_count} sections)" | "⬜ Questionnaire not completed" |

**Why this matters:** Some clients might only have a crawl and brand profile. Others have a full consultation, questionnaire, crawl, audit, AND brand profile. The AI uses whatever is available — but more data = richer context = better output. Showing this to the agency creates a natural incentive to gather more data before generating content.

The missing items link directly to the relevant action (e.g., "No audit — run SEO audit" links to `/content/[clientId]/audit` with a prompt to start).

#### Post-Crawl Wizard (One-Time Guided Prompt)

After a crawl completes for the first time, a dismissible wizard banner appears at the top of the overview:

```
┌─────────────────────────────────────────────────────────┐
│  🎉 Crawl Complete! 47 pages imported from plentify.au  │
│                                                          │
│  Recommended next steps:                                │
│  1. ✅ Generate Brand Profile  [Generate →]             │
│  2. ⬜ Run SEO Audit          [Start Audit →]           │
│  3. ⬜ Generate Website Copy   [Go to Copy →]           │
│  4. ⬜ Create Social Posts     [Go to Social →]          │
│                                                          │
│  [Dismiss]                                              │
└─────────────────────────────────────────────────────────┘
```

The wizard tracks completion of each step and checks them off. Steps auto-detect completion from the data (brand profile exists → step 1 checked). Once all steps are done or the user dismisses it, the banner doesn't reappear.

**Storage:** Wizard state stored in `localStorage` keyed by `clientId`. No database table needed — it's a purely client-side UX aid.

#### Implementation

- **Replace** `content/[clientId]/+page.svelte` (currently just redirects to `/pages`)
- **New data loading** in `content/[clientId]/+page.server.ts` — aggregate counts from crawl_jobs, brand_profiles, seo_audits, content_copy, form_submissions
- **No new API endpoints** — all data is already available via existing remote functions, or can be added as a single aggregate query
- **New remote function**: `getClientContentOverview(clientId)` → returns all status counts in one call

---

### Re-Crawl & Generation History

#### Crawl History

The `content_crawl_jobs` table already records every crawl run with timestamps, page counts, and status. The overview dashboard surfaces this as a "Recent Activity" timeline and the Pages section shows crawl history.

**Crawl history view** (accessible from Pages tab or overview):
- List of all crawl jobs for this client, newest first
- Each row: date, type (full/incremental), pages discovered/processed, status, duration
- "Re-crawl" button triggers a new full or incremental crawl
- Change detection: after re-crawl, pages with updated `content_hash` are flagged as "Content Changed" with `content_changed_at` timestamp

**Incremental vs Full re-crawl:**
- **Full**: Re-crawls all pages from scratch. Used for major site updates.
- **Incremental**: Only re-visits known pages + discovers new ones from sitemap. SHA-256 hash comparison skips unchanged pages. Faster and cheaper.

#### Generation History

Every generated piece of content (web copy, social post, meta tag) is stored as a `content_copy` row with `created_at`. The copy list view shows all generated content chronologically. There's no explicit versioning — each generation is a new row. If a user regenerates copy for the same page, both the old and new versions exist as separate entries.

**Why no overwrite:** Agencies may want to compare variations or reference previous generations. Drafts are cheap (just text in the database). The status workflow (draft → final) handles the "which one is the real one" question.

**Activity timeline on overview dashboard:**
- Pulls from `content_crawl_jobs`, `brand_profiles`, `seo_audits`, `content_copy` ordered by `created_at`
- Shows: "Generated 3 Facebook posts", "Re-crawled website (incremental, 2 pages changed)", "Updated brand profile to v2", "SEO audit completed, score 62"
- Limited to last 20 items

#### Brand Profile Versioning

Brand profiles already have a `version` INTEGER column with `UNIQUE(client_id, version)`. Each regeneration creates a new version. The `is_active` flag marks which version is current. This means:
- Full history of brand profile evolution is preserved
- Agency can compare v1 (scrape only) vs v2 (hybrid with questionnaire) vs v3 (manually edited)
- Rolling back to a previous version is possible by flipping `is_active`

---

### SEO Audit Data Presentation

#### Dashboard Approach

The SEO audit dashboard (`/content/[clientId]/audit`) presents data in a structured, section-by-section layout designed for agency consumption — comprehensive enough to demonstrate value to clients, but not overwhelming.

#### Dashboard Structure

**Main Audit Page (`/audit`)**
- **Hero section**: Overall score (0-100) as a large gauge/ring with color coding (0-39 red, 40-69 amber, 70-100 green)
- **Category score cards** (4 cards): Technical, Content, Backlinks, Keywords — each with score + mini-gauge + issue count
- **Quick stats row**: Total pages analysed, Critical issues, Warnings, Passed checks, Opportunities
- **Issue summary**: Top 5 critical issues with one-line descriptions and "Fix →" links
- **Audit history**: Previous audit runs with date + score (shows improvement over time)

**Issues Page (`/audit/issues`)**
- Filterable by category (technical, content, meta, etc.) and severity (critical, warning, info, opportunity)
- Each issue card: title, description, affected page URL, current value vs recommended value, estimated impact
- Issues with `ai_fix_available = true` show an "AI Fix" badge — clicking it generates a fix via the copy generation pipeline
- Sortable by severity, category, or page

**Keywords Page (`/audit/keywords`)**
- **Ranking keywords table**: keyword, position, search volume, CPC, URL ranking, trend
- **Keyword gaps section**: keywords competitors rank for but client doesn't, with difficulty + volume
- **Cannibalization alerts**: multiple pages competing for the same keyword
- **Opportunity score** per keyword gap (volume × 1/difficulty)

**Backlinks Page (`/audit/backlinks`)**
- **Summary stats**: Total backlinks, referring domains, dofollow/nofollow ratio, domain rank, spam score
- **Top referring domains**: table with domain, backlinks count, domain rank
- **Anchor text distribution**: pie/bar chart of anchor text variety
- **New/lost trend**: line chart of backlink acquisition over time
- **Toxic links**: flagged links that should be disavowed

**Competitors Page (`/audit/competitors`)**
- **Comparison table**: client vs up to 3 competitors across key metrics (domain rank, backlinks, ranking keywords, estimated traffic)
- **Content comparison**: avg word count, page types, content themes per competitor
- **Keyword overlap matrix**: shared vs unique keywords between client and each competitor
- **Gap analysis**: "Competitor X ranks for these keywords but you don't" with opportunity scoring

#### Design Principles

- Uses the existing DaisyUI component library — stats, cards, tables, badges, progress bars
- Color-coded severity throughout (red = critical, amber = warning, green = passed, blue = opportunity)
- Every data point links to the relevant page or action
- Charts use simple SVG-based gauges or DaisyUI progress bars (no heavy chart library needed for most views)
- Mobile-responsive: tables collapse to card layouts on mobile
- All data loads from the existing `seo_audits`, `seo_issues`, `backlink_profiles`, `keyword_profiles`, `competitor_analyses` tables — no new data fetching needed
- **Design reference:** The SOH SEO Visual Analysis component (`docs/plans/soh-seo-visual-analysis.tsx`) demonstrates the target UX pattern — collapsible sections with chevron toggles, circular score indicators with color-coded borders, per-page breakdown with issues + recommendations, "current value vs recommended" presentation, and color-coded heading hierarchy (H1/H2/H3 blocks). Apply the same patterns to the broader audit categories (technical, content, backlinks, keywords, competitors)

#### Export to PDF

The audit dashboard includes an "Export PDF Report" button that generates a standalone SEO health report via Gotenberg — not as part of a proposal, but as its own document. This serves as a sales tool: agencies hand a client a professional "here's your SEO health" report to demonstrate value and justify engagement.

The PDF includes: overall score with category breakdown, top critical issues with recommended fixes, keyword opportunity summary, backlink profile highlights, and competitor positioning. Generated via `POST /api/content/audit/:auditId/report` (already in the API spec).

---

## Tenant Isolation Architecture (content-service)

### Current Webkit Pattern

The existing Webkit services use a two-layer auth model:

**Layer 1 — Go Backend (service-core):**
- Validates JWT on every request
- JWT contains: `user_id`, `access` (permission bits), `email`, `avatar`, `subscription_active`
- JWT does NOT contain `agency_id`
- Go middleware stores user in request context
- Go does not enforce agency-level data isolation (it doesn't know which agency)

**Layer 2 — SvelteKit (service-client):**
- Validates JWT (same token)
- Resolves agency from cookie → default agency → first membership via `getAgencyContext()`
- Verifies user is a member of the agency on every request
- All database queries use `withAgencyScope(agencyId, ...)` helper
- Agency ID is never trusted from client input — always resolved server-side

### content-service Auth Pattern

The new `content-service` Go microservice follows a hybrid approach: it receives requests from SvelteKit (which has already validated agency membership) but also validates independently.

**Request flow:**
```
Browser → SvelteKit → content-service (Go)
                ↓               ↓
         validates JWT    validates JWT
         resolves agency  validates agency_id header
         checks membership
         passes agency_id
         in X-Agency-ID header
```

**content-service middleware:**

```go
func AuthMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        // 1. Validate JWT (same as service-core)
        token := r.Header.Get("Authorization")
        claims, err := auth.ValidateAccessToken(token)
        if err != nil {
            http.Error(w, "unauthorized", 401)
            return
        }

        // 2. Read agency_id from header (set by SvelteKit)
        agencyID := r.Header.Get("X-Agency-ID")
        if agencyID == "" {
            http.Error(w, "missing agency context", 400)
            return
        }

        // 3. Verify user is member of this agency
        //    (prevents SvelteKit bypass or direct API access)
        isMember, err := db.CheckAgencyMembership(claims.ID, agencyID)
        if err != nil || !isMember {
            http.Error(w, "forbidden", 403)
            return
        }

        // 4. Store both in context
        ctx := context.WithValue(r.Context(), "user_id", claims.ID)
        ctx = context.WithValue(ctx, "agency_id", agencyID)
        next.ServeHTTP(w, r.WithContext(ctx))
    })
}
```

**Every database query in content-service scopes by `agency_id`:**

```go
// All queries MUST include agency_id WHERE clause
func GetClientPages(ctx context.Context, clientID, agencyID uuid.UUID) ([]ContentPage, error) {
    return db.Query(`
        SELECT * FROM content_pages cp
        JOIN clients c ON cp.client_id = c.id
        WHERE cp.client_id = $1 AND c.agency_id = $2
    `, clientID, agencyID)
}
```

**Key principles:**
- content-service never trusts agency_id from the request alone — it validates JWT + membership
- All queries join through `clients.agency_id` to ensure data isolation
- Direct API access (bypassing SvelteKit) is possible but requires valid JWT + agency membership
- NATS job messages include `agency_id` — job handlers validate before processing
- Background jobs (re-crawl, scheduled audits) re-validate agency context on execution

---

## API Endpoints (content-service)

### Crawling & Import
```
POST   /api/content/crawl                  # Start crawl (client or competitor)
GET    /api/content/crawl/:jobId           # Job status + progress
POST   /api/content/crawl/:jobId/cancel    # Cancel running crawl
GET    /api/content/pages/:clientId        # List scraped pages (filterable by source_type)
GET    /api/content/pages/:clientId/:pageId # Single page details
PATCH  /api/content/pages/:clientId/:pageId # Manual type override
```

### Brand Profiling
```
GET    /api/content/brand/:clientId        # Active brand profile
POST   /api/content/brand/:clientId/generate # Generate (auto-detects Path A/B)
PUT    /api/content/brand/:clientId        # Manual edit
```

### SEO Audit (Path A only)
```
POST   /api/content/audit/:clientId        # Start audit
GET    /api/content/audit/:auditId         # Results
GET    /api/content/audit/:auditId/issues  # Issues (filterable)
GET    /api/content/audit/:auditId/backlinks
GET    /api/content/audit/:auditId/keywords
GET    /api/content/audit/:auditId/competitors
POST   /api/content/audit/:auditId/report  # Generate PDF
```

### Content Generation
```
POST   /api/content/generate/copy          # Generate copy (single page)
POST   /api/content/generate/meta          # Generate meta title + description
POST   /api/content/generate/structure     # Generate site structure (Path B)
POST   /api/content/generate/bulk          # Bulk generation
POST   /api/content/generate/social        # Generate social post (3 variations)
GET    /api/content/copy/:clientId         # List generated copy (filterable by copy_type)
GET    /api/content/social/:clientId       # List social posts (shorthand for copy_type=social_post)
PATCH  /api/content/copy/:copyId           # Update status/content
DELETE /api/content/copy/:copyId           # Delete draft
POST   /api/content/copy/export/:clientId  # Export all final copy as document
```

### Client Overview
```
GET    /api/content/overview/:clientId     # Aggregate status for overview dashboard
```

All endpoints require `agency_id` scoping via auth middleware (matching Webkit's existing pattern).

---

## Cost Analysis (Revised)

### Per-Client Costs

| Component | Path A (Existing Site) | Path B (New Site) |
|-----------|----------------------|-------------------|
| CF Browser Rendering | ~$0.04 (50 pages) | ~$0.04 (45 competitor pages) |
| DataForSEO | ~$2.80 (full audit) | ~$1.50 (keywords + competitors only) |
| Anthropic (profiling) | ~$0.12 | ~$0.12 |
| Anthropic (copy gen) | ~$1.50 (5 rewrites) | ~$2.50 (10 new pages) |
| Workers AI (embeddings) | ~$0.00 | ~$0.00 |
| Anthropic (social posts) | ~$0.05 (25 posts) | ~$0.05 (25 posts) |
| R2 storage | ~$0.02 | ~$0.02 |
| **Total per client** | **~$4.53** | **~$4.23** |

### Fixed Monthly Infrastructure

| Component | Monthly Cost |
|-----------|-------------|
| Cloudflare Workers Paid | $5.00 (already paying) |
| PostgreSQL hosting (incremental) | ~$10.00 |
| **Total new fixed costs** | **~$15/month** |

Note: Firecrawl ($83-700/mo) and Ayrshare ($49-599/mo) eliminated. DataForSEO is pure pay-as-you-go with no monthly minimum.

### Revenue Impact

Content Intelligence features justify tier increases:

| Tier | Current | With Content Intelligence | Margin per client |
|------|---------|--------------------------|-------------------|
| Starter | $29/mo | $49/mo | +$20 vs ~$4.50 cost |
| Growth | $79/mo | $129/mo | +$50 vs ~$4.50 cost |

**Break-even:** 1 paying client on any tier covers infrastructure. Margins are excellent.

---

## Development Roadmap (Revised)

### Phase 1: Foundation + Crawl (Weeks 1-5) — COMPLETE

- [x] `content-service` Go microservice scaffolding
- [x] Database migration (all tables above)
- [x] Colly integration with CF Browser Rendering custom transport
- [x] CF Browser Rendering `/markdown` + `/links` client (`pkg/cfbrowser/`)
- [x] Jina Reader fallback client (`pkg/jina/`)
- [x] Sitemap.xml parser
- [x] Three-layer page classification pipeline
- [x] Content chunking (400-600 tokens, 15% overlap)
- [x] Workers AI embedding pipeline (pgvector)
- [x] NATS job queue for crawl pipeline
- [x] Brand voice profile generation
  - [x] Path A: from scraped content
  - [x] Path B: from questionnaire + consultation data
  - [x] Hybrid: merged inputs
- [ ] Questionnaire extensions (optional content strategy fields) — deferred, system works without them
- [x] ~~R2 storage for markdown snapshots~~ — stored in `content_pages.markdown_content` column instead (simpler)
- [x] SvelteKit: `/content/import` (both paths)
- [x] SvelteKit: `/content/[clientId]/pages`
- [x] SvelteKit: `/content/[clientId]/brand` profile viewer/editor

### Phase 2: SEO Audit (Weeks 6-9) — COMPLETE

- [x] DataForSEO Go client (`pkg/dataforseo/`)
- [x] On-Page API integration
- [x] Backlinks API integration
- [x] DataForSEO Labs integration (keywords + gaps)
- [x] Content SEO checks (from scraped content — no API needed)
- [x] Competitor crawl pipeline (crawl competitors, analyse themes)
- [x] Competitor comparison (DataForSEO + content analysis)
- [x] SEO score calculation engine
- [x] NATS job queue for audit pipeline
- [x] SvelteKit: audit pages (overview, technical, content, backlinks, keywords, competitors)
- [x] PDF report generation via Gotenberg

### Phase 3: AI Copy Generation (Weeks 10-13) — COMPLETE

- [x] RAG retrieval pipeline (pgvector similarity search)
- [x] Context assembly module (brand + RAG + SEO + brief)
- [x] Copy generation prompts (all types in capability matrix)
- [x] Path A: page-by-page copy audit + rewrite
- [x] Path B: site structure generation + new page copy
- [ ] Side-by-side diff view (Path A) — deferred to post-Phase 3
- [x] In-place editing + status tracking
- [ ] Bulk generation — deferred to post-Phase 3
- [x] Export to structured document (Markdown/Text/PDF via Gotenberg)
- [x] SvelteKit: `/content/[clientId]/copy/generate` (copy list + generate + editor routes)

### Phase 3b: Social Media + Overview Dashboard + Import UX (Weeks 14-15) — COMPLETE

#### Wave 8: Go Backend — Social Generate + Overview Endpoint (2 parallel agents) — COMPLETE

**Agent A: Social Media Generation Endpoint**
- [x] `POST /api/content/generate/social` — sync handler in `rest/handle_social.go` + `generator/social.go`
- [x] Platform-specific prompt templates (Facebook, Instagram, LinkedIn, X)
- [x] Three-variation generation pattern (informative, engaging, story-driven)
- [x] Character limit enforcement per platform (280/500/1300/2200)
- [x] Reuse existing 4-tier context assembly from `generator/context.go`
- [x] `GET /api/content/social/:clientId` — list social posts with `?platform=` and `?page_id=` filters
- [x] ~~NATS subject~~ Synchronous endpoint (Haiku ~2-3s, no async needed)
- [x] Migration `022_add_social_post_copy_type.sql` — adds `social_post` to CHECK constraint
- [x] Request fields: topic (required), post_goal (optional), tone_override (optional), page_id (optional)
- [x] Hashtags + all config persisted in `generation_config` JSONB

**Agent B: Overview Aggregate Endpoint**
- [x] `GET /api/content/overview/:clientId` — single endpoint in `rest/handle_overview.go`
- [x] Aggregate: crawl stats (page count + last crawled + job status), SEO issue counts by severity + calculated score, copy counts by type/status, brand profile status, questionnaire completion
- [x] Recent activity feed (last 20 items from content_copy, content_pages, brand_profiles sorted by recency)
- [x] 6 parallel goroutines via sync.WaitGroup, partial data on individual query failure

#### Wave 9: SvelteKit UI — Social + Overview + Import Improvements (3 parallel agents)

**Agent A: Social Media UI**
- [x] `/content/[clientId]/social/+page.svelte` — social post list with platform filter + status filter
- [x] `/content/[clientId]/social/generate/+page.svelte` — generation form (platform picker, topic, goal, tone override)
- [x] Three-variation display with select → edit → copy-to-clipboard flow
- [x] `/content/[clientId]/social/[postId]/+page.svelte` — post editor with save/status toggle
- [x] `content-social.remote.ts` — remote functions (generateSocial, getSocialPosts)
- [x] Add "Social" tab to `[clientId]/+layout.svelte` navigation

**Agent B: Client Overview Dashboard**
- [x] Replace `content/[clientId]/+page.svelte` redirect with overview dashboard
- [x] Feature status cards (Pages, Brand, Audit, Copy, Social) — clickable, derived from overview endpoint data
- [x] AI Context Sources panel — checklist of available/missing data sources with action links
- [x] Recent Activity timeline — last 20 items with relative timestamps
- [x] Post-crawl wizard banner (dismissible, localStorage state, auto-detects step completion)
- [x] `content-overview.remote.ts` — `getClientContentOverview(clientId)` remote function
- [x] Update `[clientId]/+page.server.ts` to load overview data

**Agent C: Import Page UX Improvements**
- [x] Auto-populate URL field when selecting existing client with a `website` value
  - Watch `selectedClientId` changes via `$effect`, lookup client from list, set URL if non-empty
  - User can still override (different domain, subdomain, etc.)
- [x] Inline client creation — "Quick Create" option when client doesn't exist
  - Minimal form: business name + website URL (both required)
  - Creates client via existing `createClient` remote function
  - Auto-selects the new client and populates URL field
  - Collapsible form section: "Client not listed? Create one →"

#### Wave 10: Tests for Phase 3b (2 parallel agents) — COMPLETE

- [x] Go tests: social generation handler (platform validation, char limits, 3 variations)
- [x] Go tests: overview aggregate endpoint (correct counts, empty client, partial data, SEO score calculation)
- [x] Go tests: generator pure functions (system prompts, user messages, platformTitle, angleName)
- [x] SvelteKit: Valibot schema validation (GenerateSocialSchema, GetSocialSchema, ClientIdSchema)
- [x] SvelteKit: social page component render tests (empty state, post count, generate button, platform pills, status tabs)

### Post-Phase 3: Stabilise + Iterate

- [ ] Performance tuning (pgvector HNSW parameters, NATS throughput)
- [ ] Re-crawl scheduling (monthly default, opt-in weekly)
- [ ] Change detection notifications
- [ ] Proposal enrichment (feed content intelligence into proposal generation)
- [ ] SEO data toggle in Proposal Settings page
- [ ] User feedback → iterate on generation quality

---

## Risk Assessment (Revised)

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| CF Browser Rendering rate limits during bulk crawls | High | Medium | NATS queue with 10 concurrent max; backoff on 429s |
| Brand profile quality varies by input quality | High | Medium | Hybrid mode (scrape + questionnaire); manual editing always available |
| DataForSEO API reliability | Medium | Medium | Cache all responses; retry with exponential backoff |
| Copy generation quality inconsistency | Medium | Medium | Always human-in-the-loop; never auto-publish |
| pgvector performance | Low | Low | ~25k vectors at 50 clients — well within comfortable range |
| Colly maintenance/breaking changes | Low | Low | Thin wrapper; could swap for raw HTTP + custom queue if needed |
| CF Browser Rendering pricing changes | Low | Medium | Jina Reader as full fallback; extraction logic abstracted behind interface |

---

## What NOT to Build (V2)

| Feature | Reason | Alternative |
|---------|--------|-------------|
| Social media publishing/scheduling | Agencies already use Hootsuite/Buffer/Meta Business Suite. Webkit generates copy only. | Buffer, Hootsuite, native platforms |
| Social content calendar | Different product category. Not core to content generation value. | Hootsuite, Later, Sprout Social |
| Rank tracking over time | Adds ongoing DataForSEO cost; not needed for one-time audits | SE Ranking, AccuRanker |
| Link building outreach | Different workflow entirely | Pitchbox, BuzzStream |
| Full CMS | Agencies already have WordPress/Webflow | Existing CMS tools |
| Image generation | External tools more capable | Canva, DALL-E |
| Full approval workflow for copy | Overkill for 1-3 person agencies in V1 | Add when agencies request it |
| Automatic re-crawl scheduling | Monthly manual trigger is sufficient for V1 | Add cron-based scheduling later |
| Ad campaign management | Different domain | Meta Ads, Google Ads |

---

## Resolved Decisions

All questions from the initial V2 draft have been resolved:

| # | Question | Decision |
|---|----------|----------|
| 1 | Questionnaire extension approach | New page/section appended to existing Full Website Questionnaire — not a separate form. Agencies can create their own templates via form builder. System consumes responses generically. |
| 2 | Competitor crawl limits | Max 3 competitors, 15 core pages each (homepage, about, services, key blog posts). Skip policies, legal, etc. |
| 3 | Content export format | Three formats: Markdown (.md per page, .zip bundle), Word (.docx single document), Plain text (.txt per page, .zip bundle). Per-page structured content with hero/CTAs/services/FAQ sections. |
| 4 | SEO audit in proposals | Audit summary auto-generates a proposal section with traffic-light indicators per category. Upsell tool for agencies. New proposal block type: `seo_summary`. |
| 5 | Multi-language support | English only for V2. Multi-language deferred. |
| 6 | Tenant isolation | content-service validates JWT + agency membership on every request. All queries scope by `agency_id`. SvelteKit passes agency context via `X-Agency-ID` header. See "Tenant Isolation Architecture" section. |
| 7 | Social media approach | Lightweight copy generation only — no publishing, scheduling, or platform API integrations. Same AI pipeline with platform-specific prompts. Stored in `content_copy` with `copy_type: 'social_post'`. |
| 8 | Client overview UX | Option C — Smart Landing Page (overview dashboard) replaces redirect at `/content/[clientId]`. Shows feature status cards, AI context sources panel, recent activity timeline, and post-crawl wizard. |
| 9 | Re-crawl / generation history | Crawl history from `content_crawl_jobs`, generation history from `content_copy` rows (no overwrite). Brand profiles versioned with `version` + `is_active`. Activity timeline on overview. |
| 10 | AI context visibility | Overview dashboard shows which data sources are available per client (brand profile, crawled pages, SEO audit, consultation, questionnaire) with counts and missing-data prompts. |
| 11 | SEO data in proposals | Granular per-source toggles in Proposal Settings page. SEO Audit has sub-toggles (technical, content, keywords, backlinks, competitors). PageSpeed standalone remains as separate source from consultation. Agencies choose which to include per-proposal. SEO audit is canonical when both exist. |
| 12 | Audit data presentation | Section-by-section dashboard: main scores → issues (filterable) → keywords (rankings + gaps) → backlinks (profile + trends) → competitors (comparison matrix). DaisyUI components, color-coded severity, mobile-responsive. |

---

## Wave 1 Foundation — Completed (2026-02-20)

All 5 foundation pieces built and committed (`11d3db9` on `feature/content-intelligence`):

- **Agent A**: Migration `021_content_intelligence.sql` (10 tables, pgvector, HNSW index) + Drizzle schema
- **Agent B**: Go `content-service` scaffold (26 routes, auth middleware, Dockerfile)
- **Agent C**: `app/pkg/cfbrowser/` + `app/pkg/jina/` Go clients
- **Agent D**: `app/pkg/dataforseo/` Go client (on-page, backlinks, keywords, labs)
- **Agent E**: `workers/browser-rendering/` Cloudflare Worker (Puppeteer)

### Follow-ups before Wave 2 — ALL COMPLETE

- [x] Add `content` service block to `docker-compose.production.yml` before deploying
- [x] Add unit tests for `app/pkg/cfbrowser/` and `app/pkg/dataforseo/` packages (Wave 7)
- [x] Generate `public.pem` via setup script for JWT validation in content-service (`scripts/run_keys.sh` line 11)

---

## Implementation Learnings

### contentFetch must live in `$lib/server/`, not `.remote.ts`

**Wave 5 discovery**: `.remote.ts` files can ONLY export `query()`/`command()`/`form()`/`prerender()` wrapped functions. Exporting a regular helper function like `contentFetch` passes `npm run check` but fails at `npm run build` with: `"all exports from this file must be remote functions"`.

**Fix**: Moved `contentFetch` to `$lib/server/content-fetch.ts` (a plain server-only utility file). All `content-*.remote.ts` files import it from there. This matches the established pattern where `$lib/server/` holds internal utilities and `.remote.ts` holds only the client-callable remote function exports.
