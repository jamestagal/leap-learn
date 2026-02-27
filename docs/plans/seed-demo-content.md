# Plan: Seed Content Intelligence Demo Data

## Purpose

Extend `loadDemoData()` to populate the Murray's Plumbing demo client with content intelligence data. New agencies see the full platform — consultation through to content intelligence — from one button click.

## Approach: Extend loadDemoData() (NOT a migration)

Demo data is agency-scoped and created per-agency via the app. A migration can't know the target agency. Instead:

1. Add content intelligence constants to `demo-data.ts`
2. Extend `loadDemoData()` in `demo.remote.ts` to insert content rows after existing flow
3. Extend `clearDemoData()` to delete content rows before existing cleanup
4. Import new Drizzle schema tables into `demo.remote.ts`

## Files to Modify

| File | Changes |
|------|---------|
| `service-client/src/lib/api/demo-data.ts` | Add `DEMO_CRAWL_JOB`, `DEMO_CONTENT_PAGES`, `DEMO_CHUNKS`, `DEMO_BRAND_PROFILE`, `DEMO_SEO_AUDIT`, `DEMO_SEO_ISSUES`, `DEMO_WEB_COPY`, `DEMO_SOCIAL_POSTS` constants |
| `service-client/src/lib/api/demo.remote.ts` | Import content tables from schema. Add steps 8-16 to `loadDemoData()`. Add content cleanup to `clearDemoData()`. Update client website URL. Return `clientId` in response. |
| `service-client/src/routes/(app)/[agencySlug]/settings/demo/+page.svelte` | Add content intelligence cards + explore links. Import new icons (`Globe`, `Search`, `Brain`, `PenTool`, `Share2`). |
| `service-client/src/lib/server/schema.ts` | No changes (tables already exist) |

## Data to Seed

### 1. Fix client website URL at the source

Update `DEMO_CONSULTATION.website` in `demo-data.ts` from `"https://murraysplumbing.com.au"` to `"https://www.murrayplumbinggroup.com.au/"`.

Then include `website` in the existing client insert in `loadDemoData()`:
```typescript
// demo.remote.ts — existing client insert (add website field)
await db.insert(clients).values({
  id: clientId,
  agencyId,
  businessName: DEMO_CONSULTATION.businessName,
  email: DEMO_CONSULTATION.email,
  phone: DEMO_CONSULTATION.phone,
  contactName: DEMO_CONSULTATION.contactPerson,
  website: DEMO_CONSULTATION.website,  // ← ADD THIS
  notes: "Demo client for Murray's Plumbing scenario",
});
```

No separate `db.update()` needed — the URL is correct from the start.

### 2. Crawl Job (1 completed)
- status: `'complete'`, source_url: `'https://www.murrayplumbinggroup.com.au/'`
- pages_discovered: 16, pages_processed: 16, crawl_type: `'full'`
- started_at: `new Date(Date.now() - 3*24*60*60*1000)` (3 days ago)
- completed_at: 3 minutes after started_at

### 3. Content Pages (16 pages)

Based on actual site structure of murrayplumbinggroup.com.au:

| # | path | page_type | title | word_count |
|---|------|-----------|-------|------------|
| 1 | / | homepage | Murray Plumbing Group — Licensed Plumbers Brisbane | 920 |
| 2 | /about | about | About Us — Murray Plumbing Group | 580 |
| 3 | /services | service | Our Plumbing Services | 640 |
| 4 | /services/emergency-plumbing | service | 24/7 Emergency Plumbing Brisbane | 520 |
| 5 | /services/blocked-drains | service | Blocked Drain Clearing & Repair | 480 |
| 6 | /services/hot-water-systems | service | Hot Water System Installation & Repair | 550 |
| 7 | /services/gas-fitting | service | Gas Fitting & Gas Plumbing Brisbane | 460 |
| 8 | /services/bathroom-renovations | service | Bathroom Renovations Brisbane | 590 |
| 9 | /services/commercial-plumbing | service | Commercial Plumbing Services | 510 |
| 10 | /services/roof-plumbing | service | Roof Plumbing & Guttering | 440 |
| 11 | /blog | blog_post | Plumbing Tips & News | 320 |
| 12 | /blog/prevent-blocked-drains | blog_post | 5 Ways to Prevent Blocked Drains | 1100 |
| 13 | /blog/hot-water-guide | blog_post | Complete Guide to Hot Water Systems | 1250 |
| 14 | /blog/plumbing-emergency-tips | blog_post | What to Do in a Plumbing Emergency | 900 |
| 15 | /contact | contact | Contact Murray Plumbing Group | 290 |
| 16 | /areas-we-service | landing | Areas We Service — Brisbane & Surrounds | 680 |

Each page: http_status 200, content_hash md5(url), 2-3 paragraph plumbing-specific markdown, ~155 char meta_description.

### 4. Content Chunks (48 — 3 per page)
- chunk_text: realistic ~150 word section text per page
- embedding: NULL (don't fake vectors)
- embedding_model: `'bge-base-en-v1.5'`
- metadata: `{ page_type, section_heading }`

### 5. Brand Profile (1 active)
```json
{
  "brand_name": "Murray Plumbing Group",
  "industry": "Plumbing & Home Services",
  "tone": "Trustworthy and straightforward, friendly but professional",
  "voice_traits": ["reliable", "experienced", "local", "down-to-earth", "Australian"],
  "target_audience": "Homeowners and businesses in Brisbane needing reliable plumbing",
  "key_messages": [
    "Licensed, insured Brisbane plumbers",
    "24/7 emergency plumbing — always on call",
    "Upfront pricing, no hidden costs",
    "Family-owned since 2005"
  ],
  "vocabulary_preferences": {
    "use": ["licensed", "reliable", "local", "upfront pricing", "Brisbane"],
    "avoid": ["cheap", "budget", "discount", "DIY"]
  },
  "content_style": "Clear, no-nonsense. Lead with problem, then solution. Use Brisbane suburb names. Mention licensing."
}
```
- version: 1, is_active: true, source_type: `'hybrid'`, source_page_count: 16

### 6. SEO Audit (1 completed, score 58)

Scores: overall 58, technical 65, content 52, backlink 40, keyword 48. 16 total pages, 4 critical, 8 warning, 20 passed, 5 opportunities.

**17 SEO Issues:**

| severity | category | check_name | title |
|----------|----------|------------|-------|
| critical | performance | slow_page_load | Homepage loads in 5.1s (target: <2.5s) |
| critical | meta | missing_meta_desc | 4 service pages missing meta descriptions |
| critical | content | thin_content | Gas fitting page only 460 words |
| critical | mobile | not_responsive | Contact form breaks on mobile |
| warning | technical | no_ssl_redirect | HTTP→HTTPS not enforced |
| warning | meta | duplicate_titles | Emergency/blocked drains similar titles |
| warning | content | low_readability | Hot Water Guide below threshold |
| warning | structure | missing_h1 | Areas page missing H1 |
| warning | internal_links | orphan_pages | Roof plumbing 1 internal link |
| warning | schema | missing_schema | No LocalBusiness structured data |
| warning | content | keyword_stuffing | "plumber Brisbane" 18x on homepage |
| warning | images | missing_alt_text | 12 images missing alt text |
| info | technical | robots_txt | robots.txt allows all (review) |
| info | meta | long_meta_desc | About page 178 chars |
| info | content | no_blog_dates | Blog posts missing dates |
| opportunity | keywords | keyword_gap | Missing "emergency plumber near me" |
| opportunity | backlinks | low_backlinks | 8 referring domains (avg: 35) |

Each issue has description, current_value, recommended_value, impact text.

### 7. Web Copy (6 pieces)

| copy_type | title | status | target_keyword | word_count |
|-----------|-------|--------|----------------|------------|
| page_rewrite | Homepage — Rewritten | final | plumber brisbane | 980 |
| page_rewrite | About Us — Rewritten | draft | plumbing company brisbane | 640 |
| meta_title | Homepage Meta Title | final | — | 10 |
| meta_description | Homepage Meta Description | final | plumber brisbane | 22 |
| blog_post | When to Call a Plumber vs DIY | draft | plumbing diy | 1350 |
| h1_suggestion | Services Page H1 | final | — | 8 |

Each: model_used `'claude-3-5-haiku-20241022'`, realistic token counts, generation_config JSONB, context_sources referencing brand_profile_id.

### 8. Social Posts (4 across platforms)

| platform | angle | topic | post_goal | status | chars |
|----------|-------|-------|-----------|--------|-------|
| facebook | engaging | Emergency plumbing services | awareness | final | 420 |
| instagram | story_driven | Behind the scenes bathroom reno | engagement | draft | 1200 |
| linkedin | informative | Why plumbing maintenance saves money | traffic | final | 880 |
| twitter | engaging | Quick tip: pipe burst response | engagement | draft | 260 |

Each: copy_type `'social_post'`, generation_config with platform/angle/topic/hashtags/post_goal/prompt_version. Real-sounding plumbing content with Brisbane locality.

## Insertion Order in loadDemoData()

After existing steps 0-7 (client → consultation → proposal → contract → invoice → quotation):

```
(Client insert already includes correct website URL from DEMO_CONSULTATION.website)
8.  Insert crawl job → crawlJobId
9.  Insert 16 pages (each gets UUID) → pageIds map
10. Insert 48 chunks (3 per page, NULL embeddings)
11. Insert brand profile → brandProfileId
12. Insert SEO audit → auditId
13. Insert 17 SEO issues (referencing auditId, some referencing pageIds)
14. Insert 6 web copy (referencing clientId, some referencing pageIds, brandProfileId in context_sources)
15. Insert 4 social posts (copy_type = 'social_post', generation_config JSONB)
```

## Cleanup Order in clearDemoData()

Before existing deletion (quotations → invoices → contracts → proposals → consultations → clients), add content cleanup:

```
1. Delete content_copy WHERE client_id IN demoClientIds
2. Delete seo_issues WHERE client_id IN demoClientIds
3. Delete seo_audits WHERE client_id IN demoClientIds
4. Delete brand_profiles WHERE client_id IN demoClientIds
5. Delete content_chunks WHERE client_id IN demoClientIds
6. Delete content_pages WHERE client_id IN demoClientIds
7. Delete content_crawl_jobs WHERE client_id IN demoClientIds
   ... then existing cleanup continues
```

## Content Guidelines

- Write realistic 2-3 paragraph markdown per page (plumbing-specific, Brisbane locality)
- Social posts: real platform-specific formatting (Instagram hashtags, LinkedIn professional tone, Twitter concise)
- SEO issue descriptions: specific, actionable (not lorem ipsum)
- Web copy content: realistic AI-generated-looking content with plumbing terminology
- All copy/social timestamps: staggered over last 2 weeks for realistic activity timeline

## What NOT to Seed

- Embeddings (NULL — fake vectors make RAG return garbage)
- Backlink/keyword profiles (deep analytics, not needed for demo overview)
- Competitor analyses (requires separate crawl jobs, overkill for demo)
- Second crawl job (one completed crawl is enough)

## Demo Settings Page UI Updates

File: `service-client/src/routes/(app)/[agencySlug]/settings/demo/+page.svelte`

### Consolidated Content Intelligence Card

Instead of 5 separate cards (which would look disconnected), add **one full-width card** that groups all content intelligence sub-items under a single umbrella. This communicates that these features are part of one integrated module.

Add after existing 5 cards (Consultation, Proposal, Contract, Invoice, Quotation):

```svelte
<!-- Full-width Content Intelligence card — spans both columns -->
<div class="sm:col-span-2 p-4 rounded-lg bg-base-200 border border-base-300">
  <div class="flex items-center gap-3 mb-3">
    <Brain class="h-5 w-5 text-primary" />
    <p class="font-medium text-sm">Content Intelligence</p>
  </div>
  <div class="flex flex-wrap gap-2">
    <span class="badge badge-sm badge-ghost">16 pages crawled</span>
    <span class="badge badge-sm badge-ghost">Brand profile</span>
    <span class="badge badge-sm badge-ghost">SEO audit 58/100</span>
    <span class="badge badge-sm badge-ghost">6 copy pieces</span>
    <span class="badge badge-sm badge-ghost">4 social posts</span>
  </div>
</div>
```

This visually distinguishes it from the single-entity cards above while clearly showing it's one module with multiple data types inside.

### New Explore Link

Add **one** explore link for Content Intelligence (links to the overview dashboard, which itself links out to pages/social/copy/audit):

```svelte
<a href="/{data.agency.slug}/content/{clientId}" class="btn btn-outline btn-sm">
  <Brain class="h-4 w-4" />
  View Content Intelligence
</a>
```

**Getting the clientId:** `loadDemoData()` already returns `{ created: { clientId } }`. For the "already loaded" case, add a `getDemoClientId` query:

```typescript
// demo.remote.ts
export const getDemoClientId = query(async () => {
  const { agencyId } = await getAgencyContext();
  const [demo] = await db.select({ id: clients.id })
    .from(clients)
    .where(and(eq(clients.agencyId, agencyId), like(clients.businessName, 'Demo:%')))
    .limit(1);
  return demo?.id ?? null;
});
```

In +page.svelte, call on mount alongside `getDemoDataStatus()` and store as `let demoClientId = $state<string | null>(null)`.

### Load Confirmation Modal

Add one Content Intelligence item to the grid (keeping it clean):

```svelte
<div class="flex items-center gap-2 text-sm p-2 bg-base-200 rounded">
  <Brain class="h-4 w-4 text-primary" />
  <span>Content Intelligence</span>
</div>
```

This makes the grid 7 items total (Client, Consultation, Proposal, Contract, Invoice, Quotation, Content Intelligence). Keep `sm:grid-cols-2` — the 7th item just sits alone on the last row, which looks fine. Or optionally use `sm:grid-cols-3` if preferred.

### Clear Confirmation Modal

Add one line to the delete warning list:
```svelte
<li>All content intelligence data (pages, brand profile, SEO audit, copy, social posts)</li>
```

## Verification

After loading demo data:
1. Demo settings page: 6 cards visible (5 entity cards + 1 full-width Content Intelligence card with badge sub-items)
2. Explore links: "View Content Intelligence" links to correct client overview dashboard
3. Load modal: 7 items (6 existing + Content Intelligence)
4. Clear modal: includes content intelligence in deletion list
5. Overview dashboard: 16 pages, brand active, score 58, 6 copy, 4 social
6. Social list: 4 posts, correct platform badges
7. Copy list: 6 pieces, mixed draft/final
8. Pages list: 16 pages, correct page_types
9. SEO audit: score 58, 17 issues breakdown
10. Activity timeline: recent items from staggered timestamps
11. Brand profile: plumbing-specific voice
12. Import page: URL auto-populated from client.website

## Unresolved Questions

None — using real plumbing content, real site structure, realistic data throughout.
