# Content Audit Learnings

## DataForSEO Integration Architecture

### Two-Phase Audit System

**Phase 1: DataForSEO Crawl**
- Crawls entire website, captures on-page metadata from actual HTML
- Returns pages with title, description, H1/H2 counts, word counts, images, internal links
- Crawl results stored in `audit_crawl_results` table (transient data)

**Phase 2: Technical Audit (Scoring)**
- Runs checks against crawl results or fallback content_pages data
- Generates issues with category, severity, affected pages
- Stores issues in `audit_issues` table for frontend display
- Calculates technical score from issue severity distribution

### Metadata Source Priority

When DataForSEO is configured:
1. **Primary**: DataForSEO's `on_page` Meta (parsed from actual HTML)
2. **Fallback**: content_pages table (only if DFS not configured)

Never rely on Jina Reader markdown extraction for HTML metadata.

## Issue Storage Pattern

### DFS-Sourced Issues (When Configured)

```go
// No local page_id since page only exists in external API
type AuditIssue struct {
  PageID    uuid.UUID  // uuid.Nil for DFS-sourced
  CurrentValue string   // Stores page URL: "https://example.com/page"
  Category  string      // "technical", "performance", "content", etc.
  Severity  string      // "critical", "major", "minor"
}
```

**Frontend Usage**: When PageID is nil, use CurrentValue (which is a URL) to navigate to page.

### Content_Pages Table (Fallback)

Only used when DataForSEO is NOT configured. Stores local page records with title, description, H1, H2, word_count.

## Scoring Algorithm

**Technical Score** = (1 - (Total Issue Weight / Max Possible Weight)) × 100

Where:
- `critical` severity = 10 points per issue
- `major` severity = 5 points per issue
- `minor` severity = 1 point per issue
- Max possible weight = `page_count × 10` (if all critical)

**Result**: 0-100 score, where 100 is perfect.

## Content Check Categories

When DataForSEO is configured, these content checks run inside `RunTechnicalAudit`:

| Check | Source | Rule |
|-------|--------|------|
| Title | `on_page.title` | Must exist and be 30-60 chars |
| Description | `on_page.description` | Must exist, 120-160 chars preferred |
| H1 Presence | `on_page.h1_count` | Must have exactly 1 H1 |
| H2 Presence | `on_page.h2_count` | Should have at least 1 H2 |
| Word Count | `content.plain_text_word_count` | Should be 300+ words |
| Images | `images.length` | Should have at least 1 image |
| Internal Links | `internal_links.length` | Should have at least 3 internal links |

## Logging for Debugging

All audit runs log detailed information to `slog`:

- **Crawl Level**: Status, error messages, page counts
- **Page Level**: Per-page score, issue count, resource breakdown
- **Summary**: Total pages, issue distribution by severity

**When score is 0 or unexpected**: Check logs for:
- Crawl completion status
- Page count (if 0, crawl failed or no pages found)
- Issue detection (are rules firing correctly?)
- Score calculation (math verification)

## Key Files

| File | Purpose |
|------|---------|
| `audit_repository.go` | Database operations for audits, crawls, issues |
| `technical_audit.go` | `RunTechnicalAudit()` - main audit logic |
| `content_checker.go` | Content validation rules and check functions |
| `scorer.go` | Score calculation from issues |
| `extractor.go` | Fallback markdown extraction (avoid if DFS available) |
| `dataseo_types.go` | DataForSEO API response types |
