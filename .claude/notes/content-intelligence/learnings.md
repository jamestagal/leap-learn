# Content Intelligence — Learnings

## Demo data seeding pattern

Content intelligence demo data is seeded via `loadDemoData()` in `demo.remote.ts` (NOT a SQL migration), because demo data is agency-scoped and created per-agency via the app UI.

**Insertion order** (FK chain):
1. Crawl job → `crawlJobId`
2. Pages (16) → `pageIdMap`
3. Chunks (48, 3 per page) → linked via `pageId`
4. Brand profile → `brandProfileId`
5. SEO audit → `auditId`
6. SEO issues (17) → linked via `auditId` + optional `pageId`
7. Web copy (6) + Social posts (4) → linked via `brandProfileId` in `contextSources`

**Cleanup order** (children before parents):
contentCopy → seoIssues → seoAudits → brandProfiles → contentChunks → contentPages → contentCrawlJobs

## Constants live in demo-data.ts

All demo content intelligence data (pages, chunks, brand profile, SEO audit/issues, copy, social posts) defined as exported constants in `service-client/src/lib/api/demo-data.ts`. The `demo.remote.ts` file imports and inserts them.

## Murray's Plumbing demo content

- 16 pages: homepage, about, 8 services, blog index + 3 posts, contact, areas
- Brand profile: plumbing-specific with QBCC licensing, Brisbane suburbs, Australian English
- SEO audit: overall score 58 (realistic for a small business site)
- 17 SEO issues: 4 critical, 8 warning, 3 info, 2 opportunity
- 6 web copy pieces: 2 page rewrites, meta title, meta description, blog post, h1 suggestion
- 4 social posts: Facebook, Instagram, LinkedIn, Twitter/X
