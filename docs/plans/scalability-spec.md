# Scalability & Reliability Spec Plan

**Date:** 2026-02-07
**Source:** `docs/reviews/scalability-review.md`, `docs/COMPREHENSIVE-APPRAISAL.md`

---

## 1. Automated Database Backups to R2

**Priority:** P0 (before payments)
**Effort:** 4-6 hrs
**Dependencies:** R2 credentials already configured in production (`R2_ENDPOINT`, `R2_ACCESS_KEY`, `R2_SECRET_KEY`)

**Issue:** No backup strategy exists. `docker-compose.production.yml` uses `postgres_data` volume with zero backup. Disk failure = total irrecoverable data loss for ALL agencies.

**Current State:**
- `docker-compose.production.yml:156-158` -- volume mount only
- R2 file storage already configured for the core service (file uploads)
- No cron jobs, no backup scripts, no retention policy

**Proposed Fix:**

Add a `backup` service to `docker-compose.production.yml`:

```yaml
backup:
  image: prodrigestivill/postgres-backup-local
  container_name: webkit-backup
  restart: unless-stopped
  environment:
    POSTGRES_HOST: postgres
    POSTGRES_DB: ${POSTGRES_DB:-webkit}
    POSTGRES_USER: ${POSTGRES_USER:-webkit}
    POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    SCHEDULE: "@daily"
    BACKUP_KEEP_DAYS: 30
    BACKUP_KEEP_WEEKS: 4
    BACKUP_KEEP_MONTHS: 6
    HEALTHCHECK_PORT: 8080
  volumes:
    - backup_data:/backups
  networks:
    - webkit-internal
  depends_on:
    postgres:
      condition: service_healthy
```

Then add a cron script on VPS to sync `/backups` to R2 daily:

```bash
#!/bin/bash
# /opt/webkit/scripts/sync-backups-r2.sh
# Run via crontab: 0 3 * * * /opt/webkit/scripts/sync-backups-r2.sh

BACKUP_DIR=$(docker volume inspect webkit_backup_data --format '{{ .Mountpoint }}')
rclone sync "$BACKUP_DIR" r2:webkit-backups/postgres/ --config /opt/webkit/.rclone.conf
```

Alternative (simpler): Single script using `docker exec` + `rclone`:

```bash
#!/bin/bash
# /opt/webkit/scripts/backup-db.sh
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="/tmp/webkit_${TIMESTAMP}.sql.gz"

docker exec webkit-postgres pg_dump -U webkit webkit | gzip > "$BACKUP_FILE"
rclone copy "$BACKUP_FILE" r2:webkit-backups/postgres/ --config /opt/webkit/.rclone.conf
rm "$BACKUP_FILE"

# Prune backups older than 30 days on R2
rclone delete r2:webkit-backups/postgres/ --min-age 30d --config /opt/webkit/.rclone.conf
```

Add crontab: `0 2 * * * /opt/webkit/scripts/backup-db.sh >> /var/log/webkit-backup.log 2>&1`

**Verification:** Monthly restore test to a scratch container:
```bash
docker run --rm -e POSTGRES_PASSWORD=test postgres:16-alpine \
  sh -c "pg_restore --dbname=postgresql://webkit:test@localhost/webkit < backup.sql"
```

---

## 2. Production Monitoring

**Priority:** P0 (before payments)
**Effort:** 2-4 hrs
**Dependencies:** None

**Issue:** Grafana/Prometheus/Loki/Tempo configs exist in `/monitoring/` but are NOT in `docker-compose.production.yml`. Zero active monitoring. `alloy-config.alloy` has a full OTLP pipeline pointing at `tempo:4317`, `loki:3100`, `prometheus:9090` -- none of which run in prod.

**Current State:**
- `monitoring/alloy-config.alloy` -- full pipeline configured (OTLP receiver, batch processors, span metrics, service graph, exporters to Tempo/Loki/Prometheus)
- `monitoring/prometheus.yml` -- empty scrape config (uses remote write from Alloy)
- `monitoring/grafana-datasources.yaml`, `monitoring/grafana-dashboards.yaml` -- pre-configured
- `monitoring/dashboards/observability.json`, `monitoring/dashboards/kubernetes.json` -- dashboard JSONs exist
- Deploy health check at `.github/workflows/deploy-production.yml:126-129` is non-blocking: `curl ... || echo "pending"`

**Proposed Fix (Phase 1 -- external uptime):**

Use Better Stack / Uptime Robot (free tier) for:
- HTTPS ping on `https://api.webkit.au/health` every 60s
- HTTPS ping on `https://app.webkit.au` every 60s
- Alert via email + Slack on downtime

**Proposed Fix (Phase 2 -- full stack):**

Add to `docker-compose.production.yml`:

```yaml
prometheus:
  image: prom/prometheus:latest
  container_name: webkit-prometheus
  restart: unless-stopped
  volumes:
    - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
    - prometheus_data:/prometheus
  command:
    - "--config.file=/etc/prometheus/prometheus.yml"
    - "--enable-feature=remote-write-receiver"
    - "--storage.tsdb.retention.time=30d"
  networks:
    - webkit-internal
  deploy:
    resources:
      limits:
        memory: 512M

grafana:
  image: grafana/grafana:latest
  container_name: webkit-grafana
  restart: unless-stopped
  environment:
    GF_SECURITY_ADMIN_PASSWORD: ${GRAFANA_PASSWORD}
  volumes:
    - ./monitoring/grafana-datasources.yaml:/etc/grafana/provisioning/datasources/datasources.yaml
    - ./monitoring/grafana-dashboards.yaml:/etc/grafana/provisioning/dashboards/dashboards.yaml
    - ./monitoring/dashboards:/var/lib/grafana/dashboards
    - grafana_data:/var/lib/grafana
  networks:
    - traefik-public
    - webkit-internal
  labels:
    - "traefik.enable=true"
    - "traefik.http.routers.webkit-grafana.rule=Host(`grafana.webkit.au`)"
    - "traefik.http.routers.webkit-grafana.entrypoints=websecure"
    - "traefik.http.routers.webkit-grafana.tls.certresolver=letsencrypt"
    - "traefik.http.services.webkit-grafana.loadbalancer.server.port=3000"
  deploy:
    resources:
      limits:
        memory: 256M
```

Sync `monitoring/` dir to VPS in deploy workflow. Add Prometheus scrape targets for Go core `/health` and Node client health endpoints.

**Phase 2 adds ~768MB RAM overhead.** Evaluate VPS capacity first. If tight, stick with Phase 1 + simple log monitoring via `docker logs`.

---

## 3. Rate Limiting on Public Endpoints

**Priority:** P0 (before payments)
**Effort:** 4-6 hrs
**Dependencies:** None (can use Traefik middleware first, Redis later)

**Issue:** Public-facing endpoints have no rate limiting: proposal accept/decline/view, form submissions, contract signing, questionnaire submission. Go rate limiter at `app/service-core/rest/middleware.go:64-100` uses bare `map[string][]time.Time` with no mutex -- will panic under concurrent requests. SvelteKit endpoints have zero rate limiting.

**Current State:**
- `middleware.go:67` -- `clients := make(map[string][]time.Time)` -- not thread-safe, no cleanup of outer map entries (memory leak)
- No rate limiting middleware on SvelteKit remote functions
- Traefik is already the reverse proxy but no rate limit middleware configured

**Proposed Fix (Phase 1 -- Traefik):**

Add rate limiting via Traefik labels in `docker-compose.production.yml`:

```yaml
# On client service (public endpoints)
- "traefik.http.middlewares.rate-limit.ratelimit.average=100"
- "traefik.http.middlewares.rate-limit.ratelimit.burst=50"
- "traefik.http.middlewares.rate-limit.ratelimit.period=1m"
- "traefik.http.routers.webkit-client.middlewares=rate-limit"

# On core API
- "traefik.http.routers.webkit-api.middlewares=rate-limit"
```

**Proposed Fix (Phase 2 -- Fix Go rate limiter):**

Replace `middleware.go:64-100` with `sync.Mutex`-protected map and periodic cleanup:

```go
func RateLimitMiddleware(requestsPerMinute int) Middleware {
    var mu sync.Mutex
    clients := make(map[string][]time.Time)

    // Cleanup goroutine
    go func() {
        for range time.Tick(5 * time.Minute) {
            mu.Lock()
            now := time.Now()
            for ip, times := range clients {
                var valid []time.Time
                for _, t := range times {
                    if now.Sub(t) < time.Minute {
                        valid = append(valid, t)
                    }
                }
                if len(valid) == 0 {
                    delete(clients, ip)
                } else {
                    clients[ip] = valid
                }
            }
            mu.Unlock()
        }
    }()

    return func(next http.HandlerFunc) http.HandlerFunc {
        return func(w http.ResponseWriter, r *http.Request) {
            clientIP := getClientIP(r)
            mu.Lock()
            // ... same logic but under lock
            mu.Unlock()
            next(w, r)
        }
    }
}
```

**Proposed Fix (Phase 3 -- SvelteKit):**

Add IP-based rate limiting middleware in `hooks.server.ts` for public routes:

```typescript
// Simple in-memory rate limiter for public endpoints
const PUBLIC_RATE_LIMIT = new Map<string, number[]>();
const PUBLIC_PATHS = ['/api/proposals/', '/api/contracts/', '/api/questionnaire/'];

// In handle function:
if (PUBLIC_PATHS.some(p => event.url.pathname.startsWith(p))) {
    const ip = event.getClientAddress();
    // ... rate limit check
}
```

---

## 4. Redis Caching Layer

**Priority:** ~~P1 (before launch)~~ **P2 (post-launch, needed at ~200 agencies)** — capacity planning (item #10) confirms current PostgreSQL handles 50 agencies without caching. Redis becomes necessary when DB queries are the bottleneck at scale, not at launch.
**Effort:** 1-2 days
**Dependencies:** None

**Issue:** Every page load hits PostgreSQL for agency config, user data, form options. `getEffectiveTier()` queries DB on every request. Agency branding loaded from DB on every page. No HTTP cache headers for static data.

**Current State:**
- `service-client/src/lib/server/db.ts:22` -- `max: 10` connections
- Agency config loaded in `[agencySlug]/+layout.server.ts` on every navigation
- Subscription tier checked via DB query in subscription.ts on every protected operation
- No cache-control headers on agency logos/branding

**Proposed Fix:**

Add Redis to `docker-compose.production.yml`:

```yaml
redis:
  image: redis:7-alpine
  container_name: webkit-redis
  restart: unless-stopped
  command: ["redis-server", "--maxmemory", "128mb", "--maxmemory-policy", "allkeys-lru"]
  volumes:
    - redis_data:/data
  networks:
    - webkit-internal
  healthcheck:
    test: ["CMD", "redis-cli", "ping"]
    interval: 10s
    timeout: 5s
    retries: 3
```

Add `ioredis` to SvelteKit, create cache helper:

```typescript
// service-client/src/lib/server/cache.ts
import Redis from 'ioredis';

const redis = new Redis({ host: env.REDIS_HOST || 'redis', port: 6379 });

export async function cached<T>(key: string, ttlSeconds: number, fn: () => Promise<T>): Promise<T> {
    const hit = await redis.get(key);
    if (hit) return JSON.parse(hit);
    const result = await fn();
    await redis.setex(key, ttlSeconds, JSON.stringify(result));
    return result;
}

export function invalidate(pattern: string) {
    // Use SCAN + DEL for pattern invalidation
}
```

Cache targets (TTL):
- Agency config/branding: `agency:{id}:config` (5 min)
- Subscription tier: `agency:{id}:tier` (5 min, invalidate on billing webhook)
- Form options: `agency:{id}:form-options` (10 min)
- User session data: `user:{id}:session` (15 min)

Estimated improvement: 50-70% reduction in DB queries per page load.

---

## 5. NATS Message Persistence

**Priority:** P2 (quarterly)
**Effort:** 4-6 hrs
**Dependencies:** None

**Issue:** NATS runs in basic mode. `docker-compose.production.yml:173` -- `command: ["--cluster_name", "webkit"]`. No JetStream. Messages lost during restarts.

**Current State:**
- `app/service-admin/pubsub/nats.go:16` -- `MaxReconnects(5)` with 2s wait
- `app/service-admin/pubsub/broker.go` -- subscribes to `"notifications"` subject
- NATS used only for admin SSE notifications (new consultations, updates) -- not critical path
- If NATS is down, admin dashboard doesn't get live updates (acceptable degradation)

**Proposed Fix (Option A -- Enable JetStream):**

Change NATS command in `docker-compose.production.yml`:

```yaml
nats:
  image: nats:latest
  command: ["--jetstream", "--store_dir=/data", "--cluster_name", "webkit"]
  volumes:
    - nats_data:/data
```

Update `pubsub/nats.go` subscriber to use JetStream:

```go
js, _ := nc.JetStream()
js.Subscribe("notifications", broker.handleNATSMessage, nats.Durable("admin-broker"))
```

**Proposed Fix (Option B -- Evaluate removing NATS):**

NATS is used for exactly one thing: routing SSE notifications from core to admin. Since both services run on the same VPS, could replace with:
- Direct HTTP callback from core to admin
- Shared PostgreSQL LISTEN/NOTIFY
- Embedded pub/sub in the admin service

**Recommendation:** Option A if staying with NATS. Option B if simplifying architecture. Low priority -- current behavior (lost notifications during restart) is acceptable for beta.

---

## 6. Gotenberg Resource Limits in Production

**Priority:** P0 (before payments)
**Effort:** 30 min
**Dependencies:** None

**Issue:** Gotenberg in production (`docker-compose.production.yml:180-185`) has no resource limits, no timeout config, no Chromium restart policy. Dev compose has `memory: 1G` limit and `--chromium-restart-after=50`. A concurrent burst of PDF generation could OOM the VPS and kill PostgreSQL.

**Current State:**
- Dev: `deploy.resources.limits.memory: 1G`, `--chromium-restart-after=50`, `--api-timeout=60s`
- Prod: None of the above -- bare `gotenberg/gotenberg:8` image with defaults

**Proposed Fix:**

Update `docker-compose.production.yml` Gotenberg:

```yaml
gotenberg:
  image: gotenberg/gotenberg:8
  container_name: webkit-gotenberg
  restart: unless-stopped
  command:
    - "gotenberg"
    - "--api-timeout=60s"
    - "--chromium-restart-after=50"
    - "--chromium-max-queue-size=10"
    - "--log-level=warn"
  networks:
    - webkit-internal
  deploy:
    resources:
      limits:
        memory: 1G
      reservations:
        memory: 256M
```

Key additions: `--chromium-max-queue-size=10` prevents unbounded queue, `memory: 1G` prevents OOM cascade.

---

## 7. Zero-Downtime Deployments

**Priority:** P1 (before launch)
**Effort:** 4-6 hrs
**Dependencies:** Health check endpoints must be reliable

**Issue:** `.github/workflows/deploy-production.yml:117` uses `docker compose up -d --force-recreate` which stops all containers before starting new ones. ~10-30s total downtime per deploy. Health check at line 126-129 is non-blocking (`|| echo`).

**Current State:**
- All services recreated simultaneously
- No rolling update capability in Docker Compose
- Active DB connections dropped during restart
- Users lose sessions and in-progress work

**Proposed Fix:**

Replace `--force-recreate` with service-by-service rolling updates:

```yaml
# In deploy-production.yml, replace the deploy script:
script: |
  cd /opt/webkit

  echo "${{ secrets.GITHUB_TOKEN }}" | docker login ghcr.io -u ${{ github.actor }} --password-stdin
  docker compose -f docker-compose.production.yml pull

  # Update infrastructure services first (no downtime impact)
  docker compose -f docker-compose.production.yml up -d --no-deps nats gotenberg

  # Update app services one at a time with health check between
  docker compose -f docker-compose.production.yml up -d --no-deps core
  sleep 10
  curl -f http://localhost:4001/health || exit 1

  docker compose -f docker-compose.production.yml up -d --no-deps admin
  sleep 5

  docker compose -f docker-compose.production.yml up -d --no-deps client
  sleep 10
  curl -f http://localhost:3000 || exit 1

  docker image prune -f
  docker compose -f docker-compose.production.yml ps
```

This reduces downtime to ~2-3s per service instead of ~30s for all. PostgreSQL never restarts during deploys.

**Note:** True zero-downtime requires multiple instances + load balancing (Traefik does support this). That's a P2 effort.

---

## 8. Graceful Shutdown in Go Services

**Priority:** P1 (before launch)
**Effort:** 2-3 hrs
**Dependencies:** None

**Issue:** Both Go services use `select {}` to block forever. `app/service-core/main.go:54` and `app/service-admin/main.go:48`. No SIGTERM handling. `defer clean()` in core may not execute on Docker stop. In-flight requests terminated abruptly.

**Current State:**
- `service-core/main.go:54` -- `select {}`
- `service-admin/main.go:48` -- `select {}`
- `service-core/rest/server.go:131-139` -- HTTP server launched in goroutine, no shutdown reference kept
- `service-admin/pubsub/broker.go:194-212` -- `broker.Close()` exists but never called on shutdown
- `storage_postgres.go:27-29` -- `dbpool.Close()` via `defer clean()` but deferred in main before `select{}` blocks forever

**Proposed Fix for `service-core/main.go`:**

```go
func main() {
    cfg := config.LoadConfig()
    pkg.InitLogger(cfg.LogLevel)

    s, clean, err := storage.NewStorage(cfg)
    if err != nil {
        slog.Error("Error opening database", "error", err)
        panic(err)
    }

    // ... setup handlers ...
    httpServer := rest.RunWithServer(restHandler) // Return *http.Server
    grpc.Run(grpcHandler)

    // Wait for shutdown signal
    quit := make(chan os.Signal, 1)
    signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
    <-quit

    slog.Info("Shutting down...")
    ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
    defer cancel()

    httpServer.Shutdown(ctx)
    clean()
    slog.Info("Shutdown complete")
}
```

Requires `rest.Run()` to return `*http.Server` instead of launching in a fire-and-forget goroutine.

Same pattern for `service-admin/main.go` -- add `broker.Close()` to shutdown sequence.

---

## 9. Cloudflare CDN for Static Assets

**Priority:** P1 (before launch)
**Effort:** 1-2 hrs
**Dependencies:** DNS must be on Cloudflare (likely already -- R2 is Cloudflare)

**Issue:** No CDN. All JS/CSS/font/image delivery served directly from single VPS. No edge caching for public proposal/questionnaire pages.

**Current State:**
- Domain `webkit.au` likely on Cloudflare already (R2 configured)
- Traefik handles SSL termination -- Cloudflare would handle SSL at edge
- SvelteKit serves static assets from Node.js process
- No cache-control headers on static assets

**Proposed Fix:**

1. Enable Cloudflare proxy (orange cloud) on DNS records:
   - `app.webkit.au` -- proxied
   - `api.webkit.au` -- proxied (with SSL mode Full Strict)
   - `admin.webkit.au` -- proxied

2. Cloudflare Page Rules:
   - `app.webkit.au/_app/*` -- Cache Level: Cache Everything, Edge TTL: 1 month (SvelteKit hashed assets)
   - `app.webkit.au/api/*` -- Cache Level: Bypass (dynamic API calls)

3. Cloudflare WAF:
   - Enable Bot Fight Mode
   - Rate limiting rule: 100 req/min per IP on public endpoints

4. Update Traefik SSL: Change to Cloudflare Origin Certificate (longer-lived than Let's Encrypt, avoids renewal issues).

---

## 10. Capacity Planning Roadmap

**Priority:** P2 (quarterly review)
**Effort:** Ongoing

### At 50 Agencies (Current Target)

Already supported with current architecture. Only need:
- Database backups (item 1)
- Monitoring (item 2)
- Resource limits on Gotenberg (item 6)

### At 200 Agencies

Required changes:
- Redis caching (item 4) -- DB queries will be bottleneck without it
- Cloudflare CDN (item 9) -- reduce VPS bandwidth
- Increase SvelteKit pool from `max: 10` to `max: 20` in `db.ts:22`
- Consider PgBouncer between services and PostgreSQL
- Activity log retention policy (archive >90 days)
- Consider upgrading VPS (more RAM for Gotenberg + Redis + monitoring)

Estimated VPS requirements: 8GB RAM, 4 vCPU

### At 1000 Agencies

Required changes:
- Managed PostgreSQL (Supabase, Neon, or DigitalOcean) -- automatic backups, PITR, connection pooling
- Separate Gotenberg to dedicated worker/VPS
- Evaluate Kubernetes migration (existing `infra/` Terraform + K8s manifests)
- Read replicas for dashboard/reporting queries
- Table partitioning for `agency_activity_log`, `email_logs`, `consultation_versions`
- Multi-instance SvelteKit behind Traefik load balancer
- NATS JetStream or replace with PostgreSQL LISTEN/NOTIFY

Estimated infrastructure: 2-3 VPS or managed K8s cluster

---

## Summary Table

| # | Item | Priority | Effort | Dependencies |
|---|------|----------|--------|--------------|
| 1 | Database backups to R2 | P0 | 4-6 hrs | R2 creds exist |
| 2 | Production monitoring | P0 | 2-4 hrs | None |
| 3 | Rate limiting (Traefik + Go fix) | P0 | 4-6 hrs | None |
| 6 | Gotenberg resource limits | P0 | 30 min | None |
| 7 | Zero-downtime deploys | P1 | 4-6 hrs | Health checks |
| 8 | Graceful shutdown (Go) | P1 | 2-3 hrs | None |
| 9 | Cloudflare CDN | P1 | 1-2 hrs | DNS on Cloudflare |
| 4 | Redis caching | P2 (was P1 — deferred per capacity planning) | 1-2 days | None |
| 5 | NATS persistence | P2 | 4-6 hrs | None |
| 10 | Capacity planning | P2 | Ongoing | All above |

**Total P0 effort:** ~10-16 hrs (1-2 focused days)
**Total P1 effort:** ~2-4 days
**Total P2 effort:** Ongoing quarterly

---

## Resolved Questions (2026-02-07)

1. **VPS RAM:** **16GB RAM (Hostinger KVM 4: 4 vCPU, 16GB RAM, 200GB NVMe, 16TB bandwidth).** Plenty of headroom. Redis (~128MB) + full Grafana stack (~768MB) fit comfortably. No VPS upgrade needed for P0/P1 items. Current services likely use 2-4GB total, leaving 12+ GB free.

2. **Cloudflare DNS:** **Yes, `webkit.au` is on Cloudflare.** `infra/setup_cloudflare.sh` manages DNS with Cloudflare API. Wildcard DNS `*.webkit.au` is proxied through Cloudflare. `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` stored as GitHub Secrets. CDN/WAF setup (item #9) is straightforward -- just configure Page Rules.

3. **R2 bucket for backups:** **Create separate `webkit-backups` bucket.** `webkit-files` exists for application file storage. Separate bucket for backups allows different retention policies (30-day rolling vs permanent), separate access controls, and cleaner organization.

4. **Monitoring budget:** **Start with Phase 1 (external uptime monitoring, free tier).** Use Better Stack or Uptime Robot free tier for HTTPS pings on `api.webkit.au/health` and `app.webkit.au`. Zero cost, zero RAM overhead. Add full Grafana stack (Phase 2, ~768MB RAM) only after confirming VPS capacity. Existing monitoring configs (Alloy, Prometheus, Grafana) are pre-built and ready to deploy.

5. **NATS future:** **No additional use cases identified.** NATS used for exactly one thing: routing SSE notifications from core to admin service. No code references NATS for PDF queuing, email queuing, or any other purpose. Keep as-is. Evaluate replacing with PostgreSQL LISTEN/NOTIFY at quarterly review (architecture-spec #10).
