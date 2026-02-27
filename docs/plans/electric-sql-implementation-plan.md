# Electric SQL Implementation Plan for WebKit

**Date:** 2026-02-06
**Status:** Planned
**Prerequisite Phases:** Critical fixes from Comprehensive Appraisal must be done first

---

## Why Electric SQL

WebKit currently uses NATS + SSE for real-time updates, but it only powers admin panel notifications (33 lines of connection code). Meanwhile, the core user-facing app has zero real-time capability -- proposal status changes, dashboard stats, team activity, and contract signing events all require manual page refresh.

Electric SQL slots into the existing PostgreSQL + Go + SvelteKit architecture without replacing anything. Go handles writes, Electric handles real-time reads, PostgreSQL remains the source of truth.

**What this unlocks:**
- Live proposal status (client views/accepts and agency sees it instantly)
- Real-time dashboard stats
- Team activity feed without polling
- Live invoice payment notifications
- Collaborative proposal editing (Phase 3)
- Offline proposal viewing on mobile (Phase 3)

---

## When To Do This (Logical Ordering)

Electric SQL is **not** the next thing to build. The appraisal identified critical fixes and missing features that must come first. Here's where it fits:

```
CURRENT STATE (Feb 2026)
    │
    ▼
PHASE A: Critical Fixes (1-2 weeks)                    ◄── DO FIRST
    │  - Database backups (pg_dump to R2)
    │  - Document number race conditions
    │  - Contract email notifications
    │  - Go rate limiter thread safety
    │  - BODY_SIZE_LIMIT fix
    │  - Error page fix
    │  - Basic monitoring
    │
    ▼
PHASE B: Launch Readiness (3-4 weeks)                   ◄── DO SECOND
    │  - Rate limiting on public endpoints
    │  - Dashboard stats with real data
    │  - XSS audit on {@html}
    │  - Unique constraints on document numbers
    │  - Remove legacy UI components
    │  - Annual pricing (DONE ✓)
    │
    ▼
PHASE C: Reporting & Business Features (3-4 weeks)      ◄── DO THIRD
    │  - Basic reporting dashboard
    │  - Onboarding wizard
    │  - Contract email notifications
    │
    ▼
PHASE D: Electric SQL Integration (2-3 weeks)           ◄── THIS PLAN
    │  - Deploy Electric service
    │  - Real-time proposal status
    │  - Live dashboard
    │  - Team activity feed
    │  - Deprecate NATS (optional)
    │
    ▼
PHASE E: Client Portal & Recurring Invoices (Q2)
    │
    ▼
PHASE F: Integrations & Localization (Q2-Q3)
```

**Why Phase D and not earlier?**
1. Phases A-B fix things that will lose you customers or data
2. Phase C builds the reporting that justifies Growth/Enterprise pricing
3. Electric SQL adds delight and polish -- important, but not existential
4. Electric SQL requires a stable, well-indexed database -- Phases A-B ensure that

**Why Phase D and not later?**
1. Real-time features dramatically improve daily UX for agency teams
2. It replaces NATS (reduces infrastructure complexity)
3. It enables the client portal (Phase E) to have live updates
4. The reporting dashboard (Phase C) benefits from live data in Phase D

---

## Phase D Breakdown

### D1. Infrastructure Setup (2-3 days)

**Goal:** Electric SQL service running alongside PostgreSQL, accessible from SvelteKit.

**Tasks:**

1. **Enable PostgreSQL logical replication**
   ```sql
   -- Migration: XXX_enable_logical_replication.sql
   -- Must also set in postgresql.conf (via Docker env):
   -- wal_level = logical
   ```
   In `docker-compose.yml` and `docker-compose.production.yml`, add to postgres service:
   ```yaml
   command: ["postgres", "-c", "wal_level=logical"]
   ```

2. **Add Electric SQL service to Docker Compose**
   ```yaml
   # docker-compose.yml (development)
   electric:
     image: electricsql/electric:latest
     container_name: webkit-electric
     environment:
       DATABASE_URL: postgresql://postgres:postgres@postgres:5432/postgres
       ELECTRIC_WRITE_TO_PG_MODE: direct_writes
       AUTH_MODE: insecure  # Dev only -- Electric handles reads, auth is on the write path
     ports:
       - "3005:3000"
     depends_on:
       postgres:
         condition: service_healthy
     networks:
       - webkit-internal
   ```

   ```yaml
   # docker-compose.production.yml
   electric:
     image: electricsql/electric:latest
     container_name: webkit-electric
     restart: unless-stopped
     environment:
       DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@webkit-postgres:5432/${POSTGRES_DB}
       ELECTRIC_WRITE_TO_PG_MODE: direct_writes
       AUTH_MODE: insecure  # Safe because Electric is internal-only, not exposed via Traefik
     networks:
       - webkit-internal
     # NOT exposed via Traefik -- only accessible from SvelteKit internally
   ```

3. **SvelteKit proxy for Electric requests**

   Create a server route that proxies Electric Shape requests from the client browser through SvelteKit (keeps Electric internal, adds auth):
   ```
   service-client/src/routes/api/electric/[...path]/+server.ts
   ```
   This route validates the user's JWT, extracts their `agency_id`, and injects it as a `WHERE` clause filter before proxying to Electric. This is the **multi-tenancy enforcement point** for real-time data.

4. **Install Electric client library**
   ```bash
   cd service-client && npm install @electric-sql/client
   ```

5. **Verify end-to-end:** Insert a row in PostgreSQL, confirm it appears in an Electric Shape stream within milliseconds.

**Key Decision: Electric stays internal.** It's never exposed to the internet. SvelteKit proxies all requests, adding auth + tenant scoping. This matches the existing `withAgencyScope()` pattern.

---

### D2. SvelteKit Integration Layer (2-3 days)

**Goal:** Reusable Svelte 5 primitives for consuming Electric Shapes with tenant isolation.

**Files to create:**

1. **`service-client/src/lib/electric/client.ts`** -- Electric client configuration
   ```typescript
   import { ShapeStream } from '@electric-sql/client'

   const ELECTRIC_PROXY_URL = '/api/electric'

   export function createShapeStream(table: string, where?: string, columns?: string[]) {
     return new ShapeStream({
       url: `${ELECTRIC_PROXY_URL}/v1/shape`,
       params: {
         table,
         ...(where && { where }),
         ...(columns && { columns: columns.join(',') })
       }
     })
   }
   ```

2. **`service-client/src/lib/electric/store.svelte.ts`** -- Svelte 5 rune-based reactive store
   ```typescript
   import { Shape } from '@electric-sql/client'
   import { createShapeStream } from './client'

   export function useShape<T>(table: string, where?: string, columns?: string[]) {
     let rows = $state<T[]>([])
     let isLoading = $state(true)
     let error = $state<Error | null>(null)

     const stream = createShapeStream(table, where, columns)
     const shape = new Shape(stream)

     shape.subscribe(({ rows: newRows }) => {
       rows = newRows as T[]
       isLoading = false
     })

     return {
       get rows() { return rows },
       get isLoading() { return isLoading },
       get error() { return error },
       cleanup: () => stream.unsubscribeAll()
     }
   }
   ```

3. **`service-client/src/lib/electric/shapes.ts`** -- Pre-defined shapes for WebKit entities
   ```typescript
   // Typed shape factories for each entity
   export function proposalShape(agencyId: string) {
     return useShape<Proposal>('proposals', `agency_id = '${agencyId}'`,
       ['id', 'title', 'status', 'client_name', 'total_value', 'updated_at', 'slug'])
   }

   export function contractShape(agencyId: string) { ... }
   export function invoiceShape(agencyId: string) { ... }
   export function activityShape(agencyId: string) { ... }
   ```

**Multi-tenancy enforcement:** The proxy route (from D1) ensures all Shape requests include the authenticated user's `agency_id` in the WHERE clause. Even if a client tries to manipulate the request, the proxy overrides the filter. This mirrors how `withAgencyScope()` works for Drizzle queries.

---

### D3. Real-Time Proposal Status (2-3 days)

**Goal:** When a client views, accepts, or declines a proposal, the agency team sees it live.

**What changes:**

1. **Proposal list page** (`[agencySlug]/proposals/+page.svelte`)
   - Replace the current `load()` data with an Electric Shape subscription
   - Status badges update in real-time (Draft → Sent → Viewed → Accepted)
   - View count increments live when clients open the public link
   - New proposals from team members appear without refresh

2. **Proposal detail page** (`[agencySlug]/proposals/[id]/+page.svelte`)
   - Status changes, client responses appear live
   - "Client is viewing this proposal" indicator (if view tracking is active)

3. **Public proposal page** (`/p/[slug]/+page.svelte`)
   - No Electric needed here -- this is a write path (accept/decline/view recording)
   - The writes trigger PostgreSQL WAL changes that Electric picks up and pushes to the agency side

**Pattern:** Writes still go through existing remote functions (`command()`). Electric only handles the read/subscribe path. No changes to the write path.

---

### D4. Live Dashboard (1-2 days)

**Goal:** Dashboard stats update in real-time without page refresh.

**What changes:**

1. **Dashboard page** (`[agencySlug]/+page.svelte`)
   - Replace placeholder `-` values with live Electric Shape data
   - Total consultations this month (aggregated client-side from Shape)
   - Active proposals count and total value
   - Outstanding invoices count and value
   - Team member count
   - Recent activity feed from `agency_activity_log` Shape

2. **Activity feed component** (new)
   - Subscribe to `agency_activity_log` Shape filtered by agency
   - Show last 10 actions with user avatars, timestamps, entity links
   - New entries slide in at the top in real-time

---

### D5. Team Activity & Notifications (1-2 days)

**Goal:** Replace NATS-powered admin notifications with Electric-powered in-app notifications for the SvelteKit client.

**What changes:**

1. **Notification bell component** (new, in app layout)
   - Subscribe to `agency_activity_log` Shape for actions by other team members
   - Show unread count badge
   - Dropdown with recent team actions
   - "Sarah just sent proposal #P-0042 to Murray's Plumbing"

2. **This replaces NATS for user-facing notifications.** NATS currently pushes events to the admin panel -- Electric pushes events to the actual user-facing app where they matter.

---

### D6. NATS Deprecation Assessment (1 day)

**Goal:** Determine whether NATS can be removed entirely.

**After D3-D5 are complete, assess:**

| NATS Current Use | Electric Replacement | Can Remove? |
|-----------------|---------------------|-------------|
| Admin SSE broadcasts | Electric Shape on activity_log | Yes, if admin panel uses Electric |
| Admin SSE user notifications | Electric Shape with user filter | Yes |
| Core → Admin event relay | Electric reads from same PostgreSQL | Yes |

**If the admin panel (Go/Templ) also needs real-time:**
- Option A: Admin panel subscribes to Electric Shapes via Go client (Electric has a Go client)
- Option B: Keep NATS for admin-only, remove from SvelteKit path

**Most likely outcome:** NATS can be fully removed, simplifying the Docker stack from 6 to 5 services.

---

## Architecture After Phase D

```
┌──────────────────────────────────────────────────┐
│              SvelteKit Client                     │
│  ┌──────────────┐  ┌───────────────────────────┐ │
│  │ Write Path   │  │ Read Path (Real-Time)     │ │
│  │ Remote Funcs │  │ Electric Shape Streams    │ │
│  │ command()    │  │ via /api/electric/ proxy  │ │
│  └──────┬───────┘  └────────────┬──────────────┘ │
└─────────┼──────────────────────┼─────────────────┘
          │                      │ HTTP/SSE (internal)
          ▼                      ▼
┌─────────────────┐      ┌───────────────┐
│ PostgreSQL      │◄─────│ Electric SQL  │
│ (source of      │ WAL  │ (sync engine) │
│  truth)         │ log  │               │
└─────────────────┘      └───────────────┘
          ▲
          │ Writes
┌─────────┴───────┐
│ Go Core Service │
│ (billing, auth, │
│  webhooks)      │
└─────────────────┘
```

**Key points:**
- Go continues to handle auth, billing webhooks, and any business logic that lives server-side
- SvelteKit remote functions (`command()`) continue to handle all writes via Drizzle
- Electric handles all real-time read subscriptions via PostgreSQL WAL
- Multi-tenancy enforced at the proxy layer (same pattern as `withAgencyScope()`)
- NATS removed (or kept only for admin panel if needed)

---

## Effort Estimate

| Task | Effort | Dependencies |
|------|--------|-------------|
| D1. Infrastructure setup | 2-3 days | PostgreSQL WAL config, Docker |
| D2. SvelteKit integration layer | 2-3 days | D1 |
| D3. Real-time proposal status | 2-3 days | D2 |
| D4. Live dashboard | 1-2 days | D2 |
| D5. Team activity & notifications | 1-2 days | D2, D4 |
| D6. NATS deprecation assessment | 1 day | D3, D4, D5 |
| **Total** | **~2-3 weeks** | |

---

## Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| Electric service adds memory/CPU to VPS | Medium | Electric is lightweight (~200MB RAM). Monitor via Phase A monitoring. Can limit Shape cache size. |
| PostgreSQL WAL level change requires restart | Low | One-time restart. No data loss. Schedule during maintenance window. |
| Electric goes down = no real-time (not no data) | Low | Graceful degradation -- app still works via standard Drizzle queries. Electric is read-only overlay. |
| Multi-tenancy leak via Shape requests | High | Proxy route enforces agency_id from JWT. Electric never exposed to internet. Defence matches existing pattern. |
| Electric SQL company viability | Low | Apache 2.0 license, self-hosted, no vendor lock-in. Worst case: freeze on last working version. PostgreSQL data is always portable. |
| WAL disk usage growth | Medium | Configure `wal_keep_size` and monitor. Electric consumes WAL entries, so growth should be bounded. |

---

## Cost Impact

| Item | Development | Production |
|------|-------------|------------|
| Electric service (self-hosted) | Free | ~$0 extra (runs on same VPS) |
| Electric Cloud (managed, if preferred later) | Free beta | "Generous free tier" at GA |
| PostgreSQL WAL overhead | Negligible | ~5-10% more disk I/O |
| npm package | Free | 0 |
| **Net new monthly cost** | **$0** | **$0** (self-hosted on existing VPS) |

---

## Success Criteria

- [ ] Proposal status changes visible to agency team within 1 second of client action
- [ ] Dashboard stats update live without page refresh
- [ ] Team activity feed shows actions from other members in real-time
- [ ] Zero cross-tenant data leakage via Electric Shapes
- [ ] App continues to function normally if Electric service is down (graceful degradation)
- [ ] NATS assessment complete with clear recommendation

---

## Backup Strategy Note

On Hostinger backups: the $6/month daily backup option provides full VPS snapshots (not database-specific). This is a reasonable belt-and-suspenders approach alongside the `pg_dump` to R2:

| Strategy | Cost | Recovery Speed | Granularity |
|----------|------|---------------|-------------|
| Hostinger daily VPS snapshot | $6/mo | Slow (full VPS restore) | Full server state |
| pg_dump to R2 (daily cron) | $0 (R2 free tier) | Fast (restore specific DB) | Database only |
| **Both together** | $6/mo | Best of both options | Full coverage |

Recommendation: **Do both.** The Hostinger backup catches everything (Docker configs, env files, certs). The pg_dump to R2 gives you fast, targeted database recovery. Total cost: $6/month for peace of mind against the existential data loss risk.

---

*Plan authored: 2026-02-06*
