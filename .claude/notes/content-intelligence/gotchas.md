# Content Intelligence — Gotchas

## CONTENT_URL env var required for local dev

All content intelligence pages use `contentFetch()` (in `$lib/server/content-fetch.ts`) to proxy requests to the Go content service. This requires `CONTENT_URL` in `service-client/.env`:

```
CONTENT_URL=http://localhost:5001
```

Without it, `env["CONTENT_URL"]` is `undefined` and all content pages fail silently with fetch errors. The Go content service runs in Docker on port 5001.

## Vector columns need explicit `null`, not Drizzle defaults

The `content_chunks.embedding` column is `vector(768)` — nullable but with **no DEFAULT clause**. When Drizzle omits a field from INSERT, it generates `DEFAULT` in SQL, but PostgreSQL rejects `DEFAULT` for columns without a defined default.

**Fix**: Always pass `embedding: null` explicitly when inserting chunks without embeddings.

This applies to any pgvector column — they're nullable but have no DEFAULT.

## Brand profile JSONB schema (expected by brand page)

The brand page (`/content/[clientId]/brand/+page.svelte`) expects a deeply nested profile structure. Key field names:

- `personality_traits` — string[] (NOT `voice_traits`)
- `tone_guidelines` — `{ default, promotional, educational }` (NOT flat `tone` string)
- `vocabulary` — `{ formality_level, industry_jargon[], avoided_terms[], signature_phrases[] }`
- `sentence_structure` — `{ avg_length, active_passive, uses_contractions }`
- `messaging_pillars` — `{ theme, evidence }[]` (NOT `{ name, description }[]`)
- `constraints` — `{ always[], never[] }`
- `competitive_positioning` — `{ differentiators[], industry_norms[], gaps_to_fill[] }`

The Go content service returns the JSONB as-is from PostgreSQL, so the stored shape must match exactly.

## Migration tracking can mark failed migrations as applied

The `run_migrations.sh` script records a migration in `schema_migrations` even if `psql` partially failed (e.g., pgvector extension not available). To re-run a migration:

```bash
docker exec -i webkit-postgres psql -U postgres -d postgres -c "DELETE FROM schema_migrations WHERE version = 21;"
sh scripts/run_migrations.sh
```

## Content intelligence data flow

All content intelligence pages (except the client list dashboard) fetch through the Go content service, NOT directly from Drizzle:

```
Browser → Remote Function → contentFetch() → Go Content Service (port 5001) → PostgreSQL
```

Only `/[agencySlug]/content` (client list) uses direct Drizzle queries. Every other page (overview, pages, brand, audit, copy, social) requires the Go service running.

## Crawler discards `<title>` tags — all pages show "Untitled"

**Status**: Known bug, not yet fixed.

3 bugs in the title extraction pipeline:

1. **`transport.go:45-79`** — CF Browser Rendering returns `MarkdownResponse` with both `Content` and `Title` fields. The transport layer discards `Title` and only passes `Content` through.
2. **`crawler.go:375-392`** — Fallback `extractTitleFromMarkdown()` only looks for markdown `# ` headings. If the page has a `<title>` tag but no `<h1>`, title is empty.
3. **`extractor.go:35-39`** — `ExtractPageData()` also only reads H1 markdown headings for the title.

**Fix path**: Store the `Title` from `MarkdownResponse` in the transport layer and pass it through to `ExtractPageData()`, using HTML `<title>` as primary and H1 markdown as fallback.

## Overview SEO score defaults to 100 when no audit exists

**Status**: Fixed in `handle_overview.go`.

The `fetchSEOOverview` function calculated `100 - (0 + 0 + 0) = 100` when no audit records existed, making it look like a perfect score. Fixed by adding a `SELECT EXISTS(...)` check — returns score 0 when no audit has been run.
