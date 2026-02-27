# Unresolved Questions -- Answered

**Date:** 2026-02-07
**Method:** Codebase analysis via 8 parallel research agents

---

## Database Spec Questions

### Q1: ip_address type -- keep `inet` or change to `text`?

**Answer: Change DB to `text`.**

SvelteKit is the primary writer of audit logs. Drizzle already uses `text("ip_address")`. The Go schema defines `inet` but there's no Go code doing inet-specific operations (CIDR matching, etc). Aligning DB to `text` is simpler and avoids Drizzle casting issues. Migration: `ALTER TABLE agency_activity_log ALTER COLUMN ip_address TYPE text;`

### Q2: Consultations JSONB vs flat -- is Go still actively writing via JSONB?

~~**Answer: Yes. Go is HEAVILY using JSONB columns (39+ SQL queries).**~~

~~The Go backend actively reads, writes, searches, versions, and validates all 4 JSONB columns (`contact_info`, `business_context`, `pain_points`, `goals_objectives`). Key usage:~~
~~- `consultation.sql`: 39 queries reference JSONB columns~~
~~- `domain/consultation/service.go`: Parses, validates, compares JSONB on every operation~~
~~- `domain/consultation/repository.go`: Draft auto-save, version rollback, change detection all use JSONB~~
~~- Schema comment explicitly states: "Includes both JSONB columns (for Go backend) and flat columns (for SvelteKit compatibility)"~~

~~**Revised recommendation for item #9:** Neither Option A nor Option B is feasible short-term. Keep both column sets. Add a sync trigger or application-level sync so writes from either backend populate both formats. Long-term: migrate all consultation CRUD to SvelteKit, then drop JSONB. This is blocked by the dual-DB architecture decision (architecture-spec #4).~~

**CORRECTION (2026-02-09 audit):** The Go code referencing JSONB exists but is **dead code** — zero frontend calls reach the Go consultation endpoints. All consultation CRUD goes through SvelteKit remote functions using flat columns. The Go consultation routes, JSONB queries, draft system, and version history are orphaned code with no active callers.

**Updated answer: Go has JSONB code but it's never called. No sync needed.**

**Updated recommendation for item #9:** Do nothing now. Deprecate Go consultation routes in Wave 2 (add comment to `server.go`). Remove Go consultation code and drop orphaned JSONB columns in Wave 3 Stream N. No backfill, no sync trigger — there's nothing to sync because only SvelteKit writes consultations. See execution-roadmap.md Decision #3 and database-spec.md resolved question #2 for full rationale.

### Q3: `subscriptions` table -- any Go backend code referencing it?

~~**Answer: Yes. Cannot drop.**~~

~~The Go backend has a complete user-level subscription system using this table:~~
~~- `storage/query_postgres.sql`: 5 queries (Select, Upsert, Update, Delete)~~
~~- `domain/payment/service.go`: Full Stripe webhook handling for user subscriptions~~
~~- `storage/query/models.go`: `Subscription` struct with all columns~~
~~- `rest/server.go`: Routes for `/payments-portal`, `/payments-checkout`, `/payments-update`, `/payments-webhook`~~

~~**Important distinction:** Two subscription systems exist:~~
~~1. **User subscriptions** (`subscriptions` table) -- individual SaaS plans via `domain/payment/`~~
~~2. **Agency subscriptions** (`agencies` table fields) -- platform billing via `domain/billing/`~~

~~**Revised recommendation for item #7:** Do NOT drop `subscriptions` table. Instead, evaluate whether user-level subscriptions are still needed now that billing is agency-based. If user subscriptions are deprecated, remove the Go `payment/service.go` code and THEN drop the table. Requires product decision.~~

**CORRECTION (2026-02-09 audit):** The Go code referencing the `subscriptions` table exists but is **confirmed dead code** — zero frontend calls reach the `/payments-*` endpoints. The agency-level billing at `/api/v1/billing/` is the only active subscription flow.

**Production verification (2026-02-09):**
- `SELECT COUNT(*) FROM subscriptions;` → **0 rows**
- `SELECT COUNT(*) FROM users WHERE subscription_id IS NOT NULL;` → **1 row** (owner's test account with empty strings and `2000-01-01` placeholder date)

**Updated answer: Go references the table but nothing calls the code. Safe to remove.**

**Updated recommendation for item #7:** Remove the entire user-level payment system in Wave 2 Stream I. Order: Go routes (`server.go:32-40`) → `domain/payment/` + handler → sqlc queries → regenerate sqlc → drop `subscriptions` table via migration → clean up user-level fields from `users` table last. Pre-removal verification: grep for `BasicPlan`/`PremiumPlan` in auth middleware to confirm no feature gates depend on them. See execution-roadmap.md Decision #2 and database-spec.md resolved question #3 for full rationale.

### Q4: RLS scope -- main connection or restricted role?

**Answer: Use restricted role for app connections, keep superuser for admin/migrations.**

Recommended approach:
- Create `webapp_user` role for SvelteKit and Go app connections
- Keep `webkit` superuser role for migrations and admin queries
- RLS policies apply to `webapp_user` only
- Super-admin queries bypass RLS by using the superuser connection
- This avoids the complexity of `SET app.current_agency_id` on every admin query

### Q5: Encryption key rotation -- needed from day one?

**Answer: No. Start with single static key.**

For beta/launch, a single AES-256 key via env var is sufficient. Key rotation adds significant complexity (dual-key decryption, re-encryption migration). Add rotation support when compliance requires it or at the 200+ agency milestone.

---

## Architecture Spec Questions

### Q1: Dual-DB direction -- has the team committed to SvelteKit as primary?

**Answer: Yes, SvelteKit is primary. Go handles auth + billing + webhooks only.**

Frontend actively calls only these Go endpoints:
- **Auth:** `/login`, `/login-phone`, `/login-verify`, `/logout`, `/refresh`
- **Billing:** `/api/v1/billing/info`, `/checkout`, `/portal`, `/upgrade`, `/sync-session`, `/session-status`

All entity CRUD (consultations, proposals, contracts, invoices, clients, forms, emails) is handled by SvelteKit remote functions. The Go consultation endpoints exist but the frontend doesn't call them -- they're legacy.

**Action:** Go consultation routes + `domain/consultation/` can be deprecated (Wave 2-3, see execution-roadmap Decision #3). The `subscriptions` table and `payment/` service are confirmed dead code and scheduled for removal in Wave 2 Stream I (see database Q3 correction above).

### Q2: NATS future -- multi-instance planned within 6 months?

**Answer: Not needed for current trajectory. Single VPS is the plan.**

Current architecture is single Hostinger VPS. Capacity planning in scalability-spec targets 200 agencies before considering multi-instance. NATS is used for exactly one thing: admin SSE notifications. Recommendation: keep NATS for now (it works), evaluate replacing with PostgreSQL LISTEN/NOTIFY at the quarterly P2 review.

### Q3: Zod usage -- is `validation.ts` / `http.ts` actively called?

**Answer: No. Both are dead code. Safe to delete.**

- `validation.ts`: Imports Zod, defines `ValidationChain` and `ApiResponseSchemas`. Only imported by `http.ts`.
- `http.ts`: Imports from `validation.ts` and Zod types. **Not imported by any file in the codebase.**
- No other file imports from either `validation.ts` or `http.ts`.
- Zod v4.1.11 is in `package.json` but unused.

**Action:** Delete `validation.ts`, delete `http.ts`, `npm uninstall zod`.

### Q4: JWT key rotation -- account for dual-key support?

**Answer: Not needed for launch.**

Current JWT flow uses single RSA key pair injected via GitHub Secrets into Docker images (being moved to env vars per architecture-spec #6). Key rotation is a post-launch concern. When implemented, use standard JWKS endpoint pattern with `kid` header.

### Q5: Body size limit -- largest expected upload?

**Answer: Logo images (base64 in DB, up to ~2.7MB encoded). 10MB limit is safe.**

Logo uploads are the largest payloads. Currently stored as base64 data URLs in DB. R2 migration (ui-ux-spec #9) will eliminate large base64 payloads. Until then, 10MB covers logos + PDF generation payloads with margin.

---

## UI/UX Spec Questions

### Q1: Button.svelte -- how many components import it? Migrate or delete?

**Answer: Only 2 files import it. Delete.**

Files using `Button.svelte`:
1. `src/routes/(app)/[agencySlug]/consultation/history/+page.svelte`
2. `src/routes/(app)/[agencySlug]/consultation/success/+page.svelte`

**Action:** Replace both usages with inline DaisyUI `btn` classes, then delete `$lib/components/Button.svelte`.

### Q2: R2 bucket -- does one already exist?

**Answer: Yes. `webkit-files` bucket exists and is fully configured.**

R2 is production-ready:
- `docker-compose.production.yml` has `FILE_PROVIDER: r2`, `BUCKET_NAME: webkit-files`
- Go provider at `domain/file/provider_r2.go` uses AWS SDK v2 with R2 endpoint
- Credentials configured via `R2_ENDPOINT`, `R2_ACCESS_KEY`, `R2_SECRET_KEY` env vars

For logo storage, use the existing `webkit-files` bucket with path prefix `agencies/{agencyId}/logo.{ext}`. For database backups, create a separate `webkit-backups` bucket.

### Q3: Currency -- is international expansion on the 2026 roadmap?

**Answer: Product decision needed from you.** Current defaults are all Australian (AUD, GST, ABN, en-AU). The formatting utility extraction (Phase 1 of ui-ux-spec #12 and business-spec #5) should be done regardless -- it's good hygiene and unblocks internationalization later.

### Q4: DOMPurify SSR -- sanitize on storage or render?

**Answer: Both. Defense in depth.**

- **On storage** (primary): Sanitize HTML in `contracts.remote.ts` when generating terms/schedule HTML from templates. Use `isomorphic-dompurify` for server-side sanitization.
- **On render** (secondary): Sanitize at `{@html}` usage sites as a safety net. Since SvelteKit does SSR, `isomorphic-dompurify` handles both server and client rendering.

### Q5: Activity feed -- `agency_activity_log` or separate event stream?

**Answer: Use `agency_activity_log`. No new table needed.**

The table already captures: action, entityType, entityId, createdAt, userId, ipAddress. It has all the data needed for an activity feed. Just query `ORDER BY created_at DESC LIMIT 20` with appropriate formatting per action type.

---

## Business Spec Questions

### Q1: Contract emails -- auto-send or separate button?

**Answer: Auto-send on `sendContract`.**

The current flow is: user clicks "Send Contract" -> status changes to `sent` -> but no email goes out. This is broken UX. `sendContract` should auto-send the email. The UI already has a separate "Resend" action for re-sending. Keep that pattern: Send = send email, Resend = resend email.

### Q2: Reporting charts -- SSR or client-side JS?

**Answer: Server-rendered stats + lightweight client-side charts.**

Use DaisyUI stat cards for KPIs (SSR, zero JS). For charts (revenue bar chart, funnel), use a lightweight library like Chart.js loaded client-side. Keep data fetching via `query()` remote functions (server-rendered). Charts are progressive enhancement -- stats work without JS, charts enhance with JS.

### Q3: Client portal auth -- magic link or email+password?

**Answer: Magic link.**

Consistent with agency auth flow (also magic link / OAuth). Simpler to implement (no password storage, no forgot-password flow). Clients are infrequent users who won't remember passwords anyway.

### Q4: Recurring invoices cron -- VPS crontab vs Cloudflare Worker vs SvelteKit API?

**Answer: VPS crontab hitting SvelteKit API endpoint.**

Simplest approach for single-VPS architecture:
- SvelteKit endpoint: `POST /api/cron/recurring-invoices` with a shared secret token
- VPS crontab: `0 8 * * * curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://app.webkit.au/api/cron/recurring-invoices`
- No new infrastructure needed. Migrate to Cloudflare Worker if/when moving off VPS.

### Q5: International pricing -- multi-currency for WebKit's own pricing?

**Answer: Not for launch. AUD only.**

Focus on AU market first. International pricing adds Stripe multi-currency complexity. When expanding, use Stripe's built-in multi-currency support and store display currency per agency.

### Q6: Free tier changes -- does 10 consultations undermine Starter?

**Answer: Product decision needed from you.** The argument for increasing: more generous free tier drives adoption and word-of-mouth. Starter's value is PDF export + email delivery (which Free doesn't get), not consultation count. Recommendation: increase Free to 10 consultations, keep Starter value in features not limits.

### Q7: Integration priority -- Xero or Slack first?

**Answer: Xero first for AU market.** Australian agencies need accounting integration more than notifications. Xero dominates AU small business accounting. Slack is nice-to-have. Xero integration justifies Growth tier pricing.

### Q8: Template marketplace -- revenue share or free?

**Answer: All free for community building.** At current scale, monetizing templates adds complexity for negligible revenue. Free templates build community, reduce time-to-value for new agencies, and increase platform stickiness. Revisit revenue share after 500+ agencies.

---

## Scalability Spec Questions

### Q1: VPS RAM?

**Answer: 16GB RAM (Hostinger KVM 4: 4 vCPU, 16GB RAM, 200GB NVMe, 16TB bandwidth).**

Plenty of headroom. Redis (~128MB) + full Grafana stack (~768MB) fit comfortably. No VPS upgrade needed for P0/P1 items. Current services likely use 2-4GB total, leaving 12+ GB free.

### Q2: Cloudflare DNS?

**Answer: Yes. `webkit.au` is on Cloudflare.**

Confirmed:
- `infra/setup_cloudflare.sh` manages DNS with Cloudflare API
- Wildcard DNS `*.webkit.au` is proxied through Cloudflare
- `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` stored as GitHub Secrets
- `service-client/wrangler.toml` configures Workers deployment to `app.webkit.au`
- CDN/WAF setup (scalability-spec #9) is straightforward -- just configure Page Rules

### Q3: R2 bucket for backups -- existing or separate?

**Answer: Create separate `webkit-backups` bucket.**

`webkit-files` exists for application file storage. Database backups should be isolated in `webkit-backups` for:
- Different retention policies (30-day rolling for backups vs permanent for files)
- Separate access controls
- Cleaner organization

### Q4: Monitoring budget?

**Answer: Start with Phase 1 (external uptime monitoring, free tier).**

Use Better Stack or Uptime Robot free tier for HTTPS pings on `api.webkit.au/health` and `app.webkit.au`. Zero cost, zero RAM overhead. Add full Grafana stack (Phase 2, ~768MB RAM) only after confirming VPS has capacity. Current monitoring infrastructure (Alloy, Prometheus, Grafana configs) is pre-built and ready to deploy.

### Q5: NATS future -- more use cases planned?

**Answer: No additional use cases identified.**

NATS is used for exactly one thing: routing SSE notifications from core to admin service. No code references NATS for PDF queuing, email queuing, or any other purpose. Keep as-is for now. Evaluate replacing with PostgreSQL LISTEN/NOTIFY at quarterly review (architecture-spec #10).

---

## Additional Findings

### questionnaire_responses table (database-spec #10b)

**Answer: RESOLVED. Not needed in Drizzle schema.**

`questionnaire.remote.ts` does not exist -- the questionnaire system was deprecated in Phase 9 (commit `c5a237c`). The `formSubmissions` table has replaced `questionnaire_responses`. The Go schema still defines the table but it's legacy. Can be dropped in a future migration after confirming no Go code references it.

### Duplicate routes (architecture-spec #9)

**Answer: Frontend uses `/api/v1/` exclusively.**

All SvelteKit-to-Go calls use the `/api/v1/` prefix. Bare routes (`/login`, `/refresh`, `/logout`) are used by form actions directly. Both patterns are needed:
- `/api/v1/billing/*` -- programmatic API calls from remote functions
- `/login`, `/logout`, `/refresh` -- form actions and token refresh

**Action:** Remove bare route duplicates for endpoints that also exist under `/api/v1/` (consultations, files, emails, notes). Keep bare routes for auth endpoints (login/logout/refresh) since form actions post to them directly.
