# Content Audit Gotchas

## Markdown Extractor Can't Extract HTML Metadata

The `extractor.go` markdown regex only extracts H1/H2 from markdown format and hardcodes MetaDescription to "".

**Problem**: Jina Reader doesn't reliably convert HTML headings (like `<h1>`, `<meta name="description">`) to markdown format. This causes:
- Missing or inaccurate H1/H2 extraction
- Empty meta descriptions (always "")
- Poor content accuracy scores

**Solution**: Use DataForSEO's `on_page` Meta data instead. It parses the actual HTML directly and provides reliable:
- `title` - Page title from `<title>` tag or `<h1>`
- `description` - From `<meta name="description">`
- `h1_count`, `h2_count` - Actual heading counts from DOM

## DataForSEO Content Field Is Nested

The `content` field in `OnPagePageMeta` is a nested JSON object, not a flat field.

**Problem**: This struct tag doesn't work:
```go
type OnPagePageMeta struct {
  ContentWordCount int `json:"content.plain_text_word_count"`  // WRONG
}
```

Go's json decoder doesn't support nested field paths in tags. The value ends up nil/zero.

**Solution**: Use a nested struct:
```go
type OnPagePageMeta struct {
  Content struct {
    PlainTextWordCount int `json:"plain_text_word_count"`
  } `json:"content"`
}
```

Then access as `meta.Content.PlainTextWordCount`.

## Content Checks Run Inside RunTechnicalAudit When DataForSEO Configured

When DataForSEO is configured, content checks (title, description, H1, H2, word count, images, internal links) run inside `RunTechnicalAudit` using DFS page metadata.

**Impact**:
- The old `RunContentChecks` from content_pages table only runs as fallback when DataForSEO is NOT configured
- Content issues are now part of technical audit results
- DFS issues don't have a local `page_id` (set to `uuid.Nil`) since they come from external API

## DFS Issues Use uuid.Nil for page_id — Must Convert to SQL NULL

DFS-sourced issues don't have a `content_pages` row, so `PageID` is set to `uuid.Nil`.

**Problem**: The `seo_issues.page_id` column has a FK to `content_pages(id)`. The column is nullable (allows NULL), but `uuid.Nil` is NOT null — it's a specific UUID value (`00000000-...`) that doesn't exist in `content_pages`. This causes FK violation, and since inserts happen in a transaction, ONE failure kills ALL issues.

**Solution**: In `batchInsertIssues`, convert `uuid.Nil` to `nil` (SQL NULL) before inserting:
```go
var pageID interface{}
if issue.PageID != uuid.Nil {
    pageID = issue.PageID
}
```

**Also**: Don't "continue" after errors inside a PostgreSQL transaction — once any statement fails, the transaction is dead. Return early instead.

## Content Score Must Normalize by Page Count

**Problem**: The original formula `100 - criticals*15 - warnings*5 - infos*1` uses raw issue counts. Since each page can independently trigger the same checks, larger sites generate proportionally more issues, making the score unfairly low. A 12-page site with H1 issues on 4 pages gets penalty=60, which alone nearly zeroes the score.

**Solution**: Divide raw penalty by page count: `score = 100 - rawPenalty/pageCount`. This measures the density of issues rather than volume.

## DFS-Sourced Issues Store URL in current_value

Since DataForSEO issues don't have a local `page_id`, the page URL is stored in the `current_value` field.

**Frontend Impact**: The `getIssuePageUrl()` function checks `current_value?.startsWith("http")` for ALL issue categories, not just "technical". This allows the frontend to reconstruct page links from DFS data.

## DFS high_loading_time Boolean Is Unreliable

**Problem**: DataForSEO's `Checks["high_loading_time"]` boolean flag is based on their crawler's perspective, not real user experience. It flagged plentify.au homepage as "slow" despite having a 2ms load time and 92% mobile / 100% desktop PageSpeed scores.

**Solution**: Replaced the blind boolean check with `processPageTiming()` which reads actual `PageTiming.LargestContentfulPaint` (or `DOMComplete` fallback) and uses Google Web Vitals thresholds:
- ≤ 2.5s → no issue (Good)
- 2.5–4s → `info` severity (Needs Improvement)
- > 4s → `warning` severity (Poor)

The old `high_loading_time` entry was removed from `technicalChecks` slice and replaced with the function call.

**CRITICAL**: DFS `DOMComplete` is reported in **milliseconds** (e.g. 599 = 599ms = 0.599s), while `LargestContentfulPaint` appears to be in **seconds** (e.g. 2.5 = 2.5s). When falling back to DOMComplete, MUST divide by 1000 to convert to seconds before comparing against thresholds. Without this, a 599ms load time gets reported as "599.0s (warning)" — clearly wrong.

## DFS URL Checks Are Overly Aggressive — Excluded

**Problem**: DataForSEO's boolean flags `seo_friendly_url_characters_check`, `seo_friendly_url_keywords_check`, and `seo_friendly_url_relative_length_check` fire false positives on perfectly normal URLs. For example, `/about/` triggers "URL too long" and `/contact/` triggers "Non-SEO-friendly URL". These flood the report with meaningless INFO issues.

**Solution**: Removed all three from `technicalChecks` slice. Only kept `seo_friendly_url_dynamic_check` which catches actual query-string parameters (a legitimate concern). Added comment in code explaining why.

## PDF Quick Stats Pushed to Empty Page 2

**Problem**: The Quick Stats section used `class="section"` which has `page-break-inside: avoid`. When preceded by the Performance section (which is long with Lighthouse cards + Core Web Vitals + Recommendations), Chromium's layout engine pushed the entire Quick Stats block to page 2, leaving 70% of the page blank.

**Solution**: Changed Quick Stats to `<div style="margin-bottom:32px;">` (inline style, no page-break-inside). This allows it to flow naturally after the Performance section. The Performance section already uses inline style for the same reason.

**Rule of thumb**: Only use `class="section"` (page-break-inside: avoid) for sections where splitting mid-block would look bad (Score Breakdown, Backlink Overview). For sections that follow long content, use inline margin instead to allow natural flow.

## Technical Score Logging

Added comprehensive `slog` output for debugging technical scores:

**Logs include**:
- Summary metrics (total pages, issues by severity)
- Crawl status and errors
- Page count breakdown
- Resource type distribution (JS, CSS, images, etc.)
- Per-page scores

**If technical score is 0**: Check the logs to see:
- Whether DataForSEO crawl succeeded
- How many pages were found
- What issues were detected
- Why score calculation might be returning zero
