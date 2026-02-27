# Content Intelligence — Pricing & Marketing Strategy

## Decisions (Agreed)

1. **Monthly reset, no rollover** — audit limits reset each billing cycle
2. **3 free re-audits per client/month** — first audit counts against quota, next 3 re-audits on same client are free, after that they count
3. **No add-on packs at launch** — simple tiers, upsell to Growth
4. **$199 fixed price for Enterprise** — transparent, no "contact us"

---

## Cost Per Audit

Based on DataForSEO Prices.xlsx + actual code analysis:

| Component | Cost/request | Requests per 12-page site | Subtotal |
|-----------|-------------|--------------------------|----------|
| On-Page (technical) | $0.0015/page | 12 | $0.018 |
| Keywords (ranked) | $0.04/task | 1 | $0.04 |
| Competitors | $0.075/task | 1 | $0.075 |
| PageSpeed | Free (Google API) | 1 | $0.00 |
| **Subtotal (no backlinks)** | | | **~$0.09** |
| Backlinks (summary) | $0.02/task | 1 | $0.02 |
| Backlinks (list) | $0.04/task | 1 | $0.04 |
| Backlinks (anchors) | $0.04/task | 1 | $0.04 |
| **Total (with backlinks)** | | | **~$0.19** |

Phase 1 (no backlinks): ~$0.09/audit → negligible cost
Phase 2 (with backlinks): ~$0.19/audit + $100/mo minimum commitment

---

## Updated Tier Structure

| | Free | Starter ($29) | Growth ($79) | Enterprise ($199) |
|---|---|---|---|---|
| Team members | 1 | 3 | 10 | Unlimited |
| Consultations/mo | 10 | 25 | 100 | Unlimited |
| AI generations/mo | 5 | 25 | 100 | Unlimited |
| Templates | 3 | 5 | 20 | Unlimited |
| **SEO Audits/mo** | **0** | **5** | **15** | **Unlimited** |
| **Re-audits/client** | — | **3 free** | **3 free** | **3 free** |
| **Backlink Analysis** | No | No | **Yes** | **Yes** |
| PDF export | No | Yes | Yes | Yes |
| Custom branding | No | No | Yes | Yes |
| Priority support | No | No | No | Yes |

### Revenue vs Cost at Scale

| Scenario | Agencies | Monthly Rev | DFS Cost | Margin |
|----------|---------|-------------|----------|--------|
| Early (20 agencies) | 15 Starter, 5 Growth | $830 | ~$10 | 99% |
| Growing (100 agencies) | 50S, 35G, 15E | $5,740 | ~$150 | 97% |
| Scale (200 agencies) | 80S, 80G, 40E | $14,100 | ~$450 | 97% |

Backlinks $100/mo minimum becomes sensible at ~7+ Growth subscribers (~100 audits/mo).

---

## Implementation Plan

### 1. subscription.ts — Add SEO audit limits

Add to `TierLimits` interface:
```typescript
maxSeoAuditsPerMonth: number;    // -1 = unlimited
maxFreeReauditsPerClient: number; // re-audits before counting against quota
backlinkAnalysis: boolean;
```

Add to `TierFeature` type:
```typescript
| "seo_audits"
| "backlink_analysis"
```

Update `TIER_DEFINITIONS`:
- free: `maxSeoAuditsPerMonth: 0, maxFreeReauditsPerClient: 0, backlinkAnalysis: false`
- starter: `maxSeoAuditsPerMonth: 5, maxFreeReauditsPerClient: 3, backlinkAnalysis: false`, add `"seo_audits"` to features
- growth: `maxSeoAuditsPerMonth: 15, maxFreeReauditsPerClient: 3, backlinkAnalysis: true`, add `"seo_audits"`, `"backlink_analysis"` to features
- enterprise: `maxSeoAuditsPerMonth: -1, maxFreeReauditsPerClient: 3, backlinkAnalysis: true`, add both features

Add functions:
- `canRunSeoAudit(agencyId, clientId)` — checks monthly quota + re-audit logic
- `incrementSeoAuditCount(agencyId)` — atomic increment
- `enforceSeoAuditLimit(agencyId, clientId)` — throws on violation

### 2. Database — Audit tracking columns

New migration `0XX_seo_audit_quotas.sql`:
```sql
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS seo_audits_this_month INTEGER DEFAULT 0;
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS seo_audits_reset_at TIMESTAMPTZ;
```

Re-audit tracking: Query `seo_audits` table by `agency_id + client_id + created_at >= start_of_month` to count per-client audits. No new table needed.

### 3. LandingPage.svelte — Add Content Intelligence

**Feature grid** — Add new feature card:
```
icon: BarChart3 (or Search)
title: "Content Intelligence"
description: "SEO audits with technical analysis, keyword research, competitor insights, and PageSpeed performance. Generate branded PDF reports for clients."
```

**Pricing cards** — Add to each tier:
- Free: (no mention, or "—")
- Starter: "5 SEO audits/month", "3 re-audits per client"
- Growth: "15 SEO audits/month", "Backlink analysis", "3 re-audits per client"
- Enterprise: "Unlimited SEO audits", "Backlink analysis", "3 re-audits per client"

**Enterprise pricing** — Change from "Custom" / "Contact Us" to "$199/month" / "Get Started".

### 4. Billing page (+page.svelte) — Update tier cards

Add SEO audit features to each tier's features array. Add SEO Audits usage bar to Usage Stats section (alongside Members, Consultations, AI Generations).

### 5. Schema — Add Drizzle columns

In `schema.ts`, add to `agencies` table:
```typescript
seoAuditsThisMonth: integer("seo_audits_this_month").default(0),
seoAuditsResetAt: timestamp("seo_audits_reset_at", { withTimezone: true }),
```

### 6. Content service — Enforce limits

In the audit trigger endpoint (Go), call SvelteKit to check quota before starting an audit. OR: check in the SvelteKit remote function that triggers the audit.

Preferred: Check in the `.remote.ts` function that triggers audit creation, before calling the Go content-service API.

---

## Files to Modify

| File | Changes |
|------|---------|
| `service-client/src/lib/server/subscription.ts` | Add SEO audit limits, features, checking functions |
| `service-client/src/lib/server/schema.ts` | Add seoAuditsThisMonth, seoAuditsResetAt columns |
| `service-client/src/lib/components/LandingPage.svelte` | Add CI feature card, update tier features, fix Enterprise pricing |
| `service-client/src/routes/(app)/[agencySlug]/settings/billing/+page.svelte` | Add CI to tier cards, add SEO usage bar |
| `migrations/0XX_seo_audit_quotas.sql` | Add quota tracking columns |
| Content audit remote function | Add `enforceSeoAuditLimit()` call before triggering audit |

---

## Phased Rollout

**Phase 1 (Now)**: Launch with Technical + Keywords + Competitors + PageSpeed. No backlinks. ~$0.09/audit.

**Phase 2 (When ~7+ Growth subs)**: Enable Backlinks API. $100/mo minimum covers ~1,560 calls. Growth+ tiers get backlink analysis.

**Phase 3 (Future)**: Proposal integration — auto-enrich proposals with audit data. Already spec'd in content-intelligence-v2.md Feature 5.
