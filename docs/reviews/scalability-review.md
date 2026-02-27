# Scalability, Performance & Reliability Review

**Date:** 2026-02-06
**Reviewer:** Scalability Reviewer (Automated)
**Scope:** Full stack review of WebKit SaaS platform production readiness

---

## Executive Summary

WebKit is a multi-tenant SaaS platform running on a single Hostinger VPS with Docker Compose. The architecture is well-structured for an early-stage product (0-50 agencies) but has significant scalability bottlenecks and single-points-of-failure that will require attention before scaling beyond ~100 concurrent agencies or handling production-critical workloads.

**Overall Readiness Score: 5/10** (suitable for beta/early customers, not for scale)

---

## SWOT Analysis

### Strengths

**S1. Provider-Agnostic Design**
The Go core service has excellent provider abstraction for file storage (R2, S3, GCS, Azure Blob, local), email (Postmark, SendGrid, Resend, SES, SMTP), auth (Google, GitHub, etc.), and payments (Stripe). This allows switching providers without code changes and prevents vendor lock-in. Config-driven selection via environment variables is the right pattern.

**S2. Database Schema is Well-Indexed**
The Drizzle schema in `service-client/src/lib/server/schema.ts` includes appropriate indexes on all major query paths:
- `agency_id` indexes on every tenant-scoped table
- Composite indexes for common filter patterns (e.g., `(agencyId, status)` on clients, `(agencyId, isActive)` on forms)
- Slug indexes for public URL lookups on proposals, contracts, invoices
- Status indexes for filtered list queries

**S3. Data Isolation Pattern is Solid**
The `withAgencyScope()` / `withUserAgencyScope()` helpers in `db-helpers.ts` enforce tenant isolation at the service layer. Every query that touches tenant data goes through these wrappers, which prevents accidental cross-tenant data leakage. The role-based filtering (member vs admin/owner) within these wrappers is also well-implemented.

**S4. Connection Pooling Configured**
Both database access paths use connection pooling:
- Go core service: `pgxpool` with default pool settings (`storage_postgres.go:23`)
- SvelteKit client: `pg.Pool` with `max: 10`, `idleTimeoutMillis: 30000`, `connectionTimeoutMillis: 2000` (`db.ts:16-25`)

**S5. Webhook Security**
The billing webhook handler uses `MaxBytesReader` to limit payload size (64KB) and verifies Stripe signatures via the `Stripe-Signature` header (`billing_route.go:224-236`).

**S6. Subscription Tier Enforcement at Service Layer**
Rate limiting by subscription tier (free: 5 consultations/month, starter: 25, etc.) is enforced server-side in `subscription.ts`, not just in the UI. Functions like `enforceConsultationLimit()` and `enforceAIGenerationLimit()` throw HTTP 403 errors when limits are exceeded.

**S7. Audit Trail Infrastructure**
The `agencyActivityLog` table and `logActivity()` helper provide comprehensive audit logging with IP address, user agent, old/new values, and action categorization. Activity logging is fire-and-forget (won't block the main operation if logging fails).

---

### Weaknesses

**W1. Single VPS = Complete Single Point of Failure** (Critical)
All services (Core, Admin, Client, PostgreSQL, NATS, Gotenberg) run on a single Hostinger VPS. There is:
- No redundancy for any service
- No load balancing
- No auto-scaling capability
- No failover mechanism
- No geographic distribution

*Impact:* A VPS crash, disk failure, or Hostinger outage causes total platform downtime. Estimated availability: ~99.0-99.5% at best, compared to industry SaaS standard of 99.9%.

**W2. No Database Backup Strategy** (Critical)
The production `docker-compose.production.yml` uses a Docker volume (`postgres_data`) for PostgreSQL data but has:
- No automated backup jobs configured
- No backup verification or test restores
- No point-in-time recovery (PITR) capability
- No backup to external storage
- No disaster recovery plan documented

*Impact:* A volume corruption, accidental deletion, or VPS loss results in complete, irrecoverable data loss for all agencies.

**W3. NATS Has No Message Persistence** (High)
NATS is configured in basic mode (no JetStream) with `--cluster_name webkit` only (`docker-compose.production.yml:173`). The Go NATS client has `MaxReconnects(5)` (`nats.go:17`).
- Messages are fire-and-forget; if NATS is down, messages are silently lost
- No message replay or delivery guarantees
- If the admin service restarts while messages are in-flight, they are dropped

*Impact:* SSE notifications (new consultations, updates) may be silently lost during service restarts or network blips. Not critical for current use case (notifications only) but would be problematic if NATS were used for critical workflows.

**W4. Rate Limiting is In-Memory and Non-Distributed** (High)
The `RateLimitMiddleware` in `middleware.go:64-100` uses an in-memory `map[string][]time.Time` for rate tracking:
- Resets on every service restart
- No shared state if services were horizontally scaled
- No rate limiting on the SvelteKit client endpoints at all
- No rate limiting on public endpoints (contract signing, questionnaire submission, proposal viewing)
- The memory map grows unbounded - no periodic cleanup of the outer map entries

*Impact:* Public-facing endpoints (proposal view, contract signing, questionnaire) are vulnerable to abuse. An attacker could increment view counts, spam form submissions, or attempt brute-force attacks.

**W5. No Caching Layer** (High)
There is no Redis, in-memory cache, or CDN configured anywhere:
- Every page load hits PostgreSQL for agency config, user data, form options
- Subscription tier checks (`getEffectiveTier()`) query the database on every request
- Agency branding/config is loaded from DB on every page within the agency scope
- No HTTP cache headers set for static-like data (logos, branding)
- No CDN for static assets (JS, CSS, fonts)

*Impact:* Database becomes the bottleneck much earlier than necessary. At 100+ agencies with concurrent users, PostgreSQL connection limits will be hit. Estimated: each page load generates 3-8 DB queries for context/config alone.

**W6. AI Generation Counter Has Race Condition** (Medium)
`incrementAIGenerationCount()` in `subscription.ts:338-370` performs a read-then-write pattern:
```
1. SELECT aiGenerationsThisMonth
2. UPDATE SET aiGenerationsThisMonth = currentCount + 1
```
If two concurrent AI generation requests occur, both may read the same count and write `count + 1`, effectively losing one increment. This allows agencies to exceed their AI generation limits.

**W7. Gotenberg PDF Generation is Resource-Constrained** (Medium)
Gotenberg runs a headless Chromium browser for PDF generation with:
- Memory limit: 1GB (dev), uncapped (production)
- `--chromium-restart-after=50` (dev only, not set in production)
- No timeout configuration in production
- Single instance - if Chromium crashes or hangs, all PDF generation stalls

At scale (multiple agencies generating proposals/contracts/invoices simultaneously), Gotenberg can become a severe bottleneck and memory hog.

**W8. SSE Scalability Concerns** (Medium)
The EventBroker in `broker.go` maintains all connected clients in an in-memory map with a single `sync.RWMutex`:
- `handleNATSMessage()` acquires a write lock (`broker.mut.Lock()`) for every incoming message, blocking all other operations
- For broadcast messages, iterates over ALL connected clients (O(n) per message)
- No heartbeat/keepalive mechanism visible - stale connections may accumulate
- Buffer per client is 100 messages - if a client falls behind, it's disconnected

At 1000+ concurrent SSE connections, the mutex contention and O(n) broadcast will cause noticeable latency.

**W9. Database Connection Limits Will Hit a Ceiling** (Medium)
With two services making direct DB connections:
- SvelteKit: `max: 10` connections (`db.ts:22`)
- Go core: pgxpool defaults (likely 4 * num_cpu or default 100)
- PostgreSQL Alpine default `max_connections` = 100

In production, the combined pool may approach or exceed 100 connections, especially under load with long-running queries or during PDF generation. No `pgbouncer` or external connection pooler is configured.

**W10. Deployment Causes Downtime** (Medium)
The CI/CD pipeline (`deploy-production.yml:117`) uses `docker compose up -d --force-recreate`, which:
- Stops all existing containers before starting new ones
- No rolling update capability
- No blue-green deployment
- Health check waits 30 seconds then does a non-blocking curl (`|| echo ...`)
- Database connections drop during restart

*Impact:* Every deployment causes ~10-30 seconds of complete downtime. Active users lose their sessions and in-progress work.

---

### Opportunities

**O1. Add PgBouncer for Connection Pooling**
Insert PgBouncer between services and PostgreSQL to:
- Reduce total connections needed
- Enable connection multiplexing across services
- Make it safe to scale to multiple SvelteKit or Core instances
- Estimated effort: 2-4 hours (Docker service + config)

**O2. Add Redis for Caching and Rate Limiting**
A single Redis instance would solve multiple problems simultaneously:
- Cache agency configs, branding, and tier data (TTL: 5 minutes)
- Distributed rate limiting across services
- Session data if needed for horizontal scaling
- Server-side caching for subscription tier checks
- Estimated improvement: 50-70% reduction in DB queries per page load

**O3. Cloudflare CDN + WAF (Low Effort, High Impact)**
The domain `webkit.au` likely already uses Cloudflare (R2 is Cloudflare's storage). Enabling:
- Static asset CDN would offload JS/CSS/font/image delivery
- WAF rules for DDoS protection on public endpoints
- Edge caching for public proposal/questionnaire pages
- Bot protection for form submissions
- Estimated effort: 1-2 hours to configure

**O4. Automated Database Backups**
Add a cron container or script that:
- Runs `pg_dump` daily to R2/S3 (already have cloud storage configured)
- Maintains 30-day retention
- Tests restore to a separate container weekly
- Estimated effort: 4-8 hours

**O5. Enable NATS JetStream for Persistence**
Change NATS configuration to enable JetStream for at-least-once delivery:
- Messages survive service restarts
- Message replay for debugging
- Dead letter queue for failed deliveries
- Estimated effort: 4-8 hours (config change + subscriber updates)

**O6. Migrate to Managed PostgreSQL**
Moving to a managed database (e.g., Supabase, Neon, or DigitalOcean Managed DB) would provide:
- Automatic backups and PITR
- High availability with read replicas
- Automated security patches
- Connection pooling built-in
- Monitoring and alerting

**O7. Container Orchestration Upgrade Path**
The `infra/` directory already contains Terraform and Kubernetes manifests (albeit seemingly not in active use). The path to K8s is partially prepared:
- Service mesh for inter-service communication
- Horizontal pod autoscaling
- Rolling deployments with zero downtime
- Resource limits and health checks per pod

---

### Risks

**R1. Data Loss from Catastrophic Failure** (Severity: Critical, Likelihood: Low-Medium)
Without backups, a disk failure, Docker volume corruption, or accidental `docker volume rm` would result in total, irrecoverable data loss for ALL agencies simultaneously. This is an existential business risk.

*Mitigation:* Implement automated backups to R2 immediately. This is the #1 priority.

**R2. Production VPS Resource Exhaustion** (Severity: High, Likelihood: Medium)
Running 6 containers (core, admin, client, postgres, nats, gotenberg) on a single VPS with Gotenberg's Chromium consuming up to 1GB+ RAM per PDF generation. If multiple agencies generate PDFs concurrently, the VPS may OOM-kill critical services (like PostgreSQL).

*Mitigation:* Add resource limits in production compose, monitor memory usage, consider separating Gotenberg to a dedicated worker.

**R3. Stripe Webhook Reliability** (Severity: High, Likelihood: Low)
The billing webhook handler at `/api/v1/billing/webhook` returns errors directly. If the server is down during a Stripe webhook delivery, Stripe will retry but:
- No idempotency key tracking is visible in the webhook handler
- If the server processes a webhook but crashes before responding 200, Stripe retries and the operation may be applied twice
- The billing service code (not fully examined) should implement idempotent processing

*Mitigation:* Ensure webhook handlers are idempotent (check if already processed before applying state changes). The `.claude/notes/billing/` mentions this pattern exists.

**R4. Multi-Tenant Query Performance Degradation** (Severity: Medium, Likelihood: Medium)
As agencies accumulate data, queries scanning large tables (proposals, consultations, invoices, form_submissions) will slow down even with indexes. Key concerns:
- `agency_activity_log` grows unboundedly (no retention/archival policy)
- `email_logs` grows with every sent email
- `consultation_versions` grows with every edit
- No table partitioning strategy

*Capacity estimates:*
- 100 agencies, 50 consultations/month each = 5,000 rows/month in consultations
- Each consultation generates ~3 proposals, ~1 contract, ~2 invoices
- After 1 year: ~60K consultations, ~180K proposals, ~120K invoices, ~1M+ activity log entries
- PostgreSQL should handle this volume well with current indexes up to ~10M total rows

**R5. Secret Management** (Severity: Medium, Likelihood: Low)
Secrets are passed via environment variables in `docker-compose.production.yml` which references a `.env` file on the VPS. These secrets (Stripe keys, DB password, API keys) are:
- Stored in plaintext on the VPS filesystem
- Not rotated automatically
- No secret versioning or audit trail
- GitHub Secrets used for CI/CD (good) but deployed as env vars (less good)

*Mitigation:* Consider Docker secrets, HashiCorp Vault, or cloud-based secret management.

**R6. No Health Monitoring or Alerting** (Severity: Medium, Likelihood: High)
The monitoring stack (Grafana, Prometheus, Loki, Tempo) has configuration files in `/monitoring/` and `alloy-config.alloy` but these services are NOT included in the production `docker-compose.production.yml`. There is:
- No active monitoring in production
- No alerting for service failures
- No disk space monitoring
- No database performance monitoring
- The deployment health check is a single non-blocking curl

*Impact:* Issues may go undetected for hours or days until a user reports them.

**R7. SvelteKit Remote Functions and Cloudflare Adapter Conflict** (Severity: Low, Likelihood: Low)
`svelte.config.js` shows the app can use either the Cloudflare or Node adapter, but production uses the Node adapter on a VPS. The Cloudflare adapter path exists but SvelteKit Remote Functions and direct PostgreSQL access via `pg.Pool` may not work on Cloudflare Workers (which don't support TCP connections natively). If the team ever wants to move to Cloudflare Pages, significant refactoring would be needed.

**R8. No Graceful Shutdown** (Severity: Low, Likelihood: Medium)
The Go core service's `main.go` uses `select {}` to block forever after starting HTTP and gRPC servers. There is no signal handling for graceful shutdown:
- In-flight requests are terminated abruptly on `docker stop`
- Database connections may not be properly closed
- The `defer clean()` for database cleanup may not execute on SIGTERM

---

## Capacity Estimates

| Scale | Agencies | Concurrent Users | DB Rows (1yr) | Feasibility |
|-------|----------|-------------------|---------------|-------------|
| Current | 1-10 | 5-20 | <100K | Fully supported |
| Near-term | 10-50 | 20-100 | 100K-500K | Supported with current architecture |
| Growth | 50-200 | 100-500 | 500K-2M | Needs caching, backups, monitoring |
| Scale | 200-1000 | 500-2000 | 2M-10M | Needs managed DB, CDN, multi-server |
| Enterprise | 1000+ | 2000+ | 10M+ | Needs K8s, read replicas, partitioning |

---

## Priority Recommendations

### Immediate (Before accepting paying customers)

1. **Implement automated database backups** to R2/S3 with daily schedule and 30-day retention
2. **Deploy production monitoring** - at minimum, Prometheus + Grafana for resource usage, or a managed service like Uptime Robot/Better Stack for availability alerts
3. **Add resource limits** to production Gotenberg and NATS containers to prevent OOM cascade

### Short-term (Next 1-3 months)

4. **Add Redis** for caching agency configs and distributed rate limiting
5. **Add rate limiting to public endpoints** (proposal view, contract signing, questionnaire submission)
6. **Fix AI generation counter race condition** using `UPDATE ... SET count = count + 1` (atomic increment)
7. **Implement graceful shutdown** in Go services for clean connection cleanup
8. **Add Cloudflare CDN** for static assets and public-facing pages

### Medium-term (3-6 months)

9. **Migrate to managed PostgreSQL** for automatic backups, HA, and connection pooling
10. **Implement zero-downtime deployments** (rolling restart or blue-green)
11. **Enable NATS JetStream** for message persistence
12. **Add activity log retention policy** (archive to cold storage after 90 days)

### Long-term (6-12 months)

13. **Evaluate Kubernetes** migration using existing `infra/` Terraform configs
14. **Add read replicas** for query-heavy operations (dashboards, reports)
15. **Table partitioning** for high-growth tables (activity_log, email_logs)
16. **Multi-region deployment** for geographic distribution

---

## Files Examined

| File | Key Findings |
|------|-------------|
| `docker-compose.yml` | 6 services, dev config, proper healthchecks |
| `docker-compose.production.yml` | Single VPS, no monitoring, no backups |
| `service-client/src/hooks.server.ts` | Auth middleware, token refresh, proper error handling |
| `service-client/src/lib/server/db.ts` | pg.Pool with max:10, proper timeouts |
| `service-client/src/lib/server/schema.ts` | Well-indexed, 20+ tables, proper FK constraints |
| `service-client/src/lib/server/db-helpers.ts` | Solid tenant isolation via withAgencyScope() |
| `service-client/src/lib/server/subscription.ts` | Tier enforcement, race condition in AI counter |
| `app/service-core/main.go` | Clean dependency injection, no graceful shutdown |
| `app/service-core/storage/storage_postgres.go` | pgxpool, no custom pool config |
| `app/service-core/rest/middleware.go` | In-memory rate limiter, security headers |
| `app/service-core/rest/server.go` | CORS, health checks, HTTP timeout config |
| `app/service-core/rest/billing_route.go` | Stripe webhook with signature verification |
| `app/service-core/config/config.go` | Provider-agnostic config, proper env validation |
| `app/service-admin/pubsub/broker.go` | SSE broker with mutex, no heartbeat |
| `app/service-admin/pubsub/nats.go` | Basic NATS, MaxReconnects(5), no JetStream |
| `monitoring/alloy-config.alloy` | OTLP pipeline configured but not deployed to prod |
| `monitoring/prometheus.yml` | Empty scrape config (uses remote write) |
| `.github/workflows/deploy-production.yml` | Force-recreate deployment, weak health check |
| `service-client/svelte.config.js` | Dual adapter (Cloudflare/Node), remote functions |
