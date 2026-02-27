# Durable Streams and Electric SQL for hybrid SvelteKit + Go architecture

**Durable Streams is NOT what you think it is** — it's an ElectricSQL project unrelated to Cloudflare, while Electric SQL offers a compelling real-time sync layer that complements your existing architecture without replacing anything. For a solo developer building WebKit, Electric SQL emerges as the strongest candidate for real-time updates, while Cloudflare Queues + Durable Objects remains the right choice for background job processing.

## Critical discovery: Durable Streams has nothing to do with Cloudflare

The first and most important finding: **Durable Streams (github.com/durable-streams/durable-streams) is NOT a Cloudflare technology**. Despite the naming similarity to Cloudflare Durable Objects, it's an open HTTP protocol created by the ElectricSQL team for reliable server-to-client streaming with resume capability.

Durable Streams solves a different problem than you might expect. It addresses **connection fragility** — when browser tabs suspend, networks flap, or WebSocket connections drop, traditional SSE/WebSocket implementations lose in-flight data. Durable Streams provides offset-based resumability, allowing clients to pick up exactly where they left off. Think of it as bringing Kafka-style durability semantics to the server→client delivery path.

The protocol launched in December 2025, but the core has been **battle-tested for 1.5 years** inside Electric's production sync engine, reliably delivering millions of state changes daily. Key implementations include TypeScript client/server (`@durable-streams/client`, `@durable-streams/server`), Go client, and Python client — all MIT/Apache 2.0 licensed with zero usage costs.

| Durable Streams | Cloudflare Queues |
|-----------------|-------------------|
| Server → Client streaming | Worker → Worker messaging |
| HTTP protocol (runs anywhere) | Cloudflare-only binding |
| Reliable delivery to browsers | Background job processing |
| Free (self-hosted) | $0.40/million operations |

**Recommendation for WebKit:** These technologies complement rather than compete. Use Cloudflare Queues for proposal PDF generation and background tasks, and consider Durable Streams only if you need bulletproof streaming to clients (e.g., AI token streaming that survives reconnects). For simpler real-time needs, Electric SQL handles this more elegantly.

## Electric SQL fits your architecture like a glove

Electric SQL is a **production-ready PostgreSQL sync engine** (v1.0 GA released March 2025) that provides real-time data synchronization from Postgres to client applications. The architecture is elegantly simple: your Go backend handles writes, Electric handles reads and sync.

The "local-first" approach means your SvelteKit app talks to a local data store (JavaScript object, SQLite, or PGlite) while Electric syncs data in the background. Network issues become invisible to users — **no loading spinners**, instant reactivity, and automatic offline support. The team includes two co-inventors of CRDTs (Marc Shapiro and Nuno Preguiça), providing deep expertise in distributed systems.

### How sync actually works

Electric uses PostgreSQL's logical replication to consume the Write-Ahead Log, transforming changes into "Shape Logs" — HTTP-streamable change sets. Clients subscribe to Shapes, which are declarative subsets defined by table + where clause:

```typescript
// Subscribe to proposals for current user
const proposalStream = new ShapeStream({
  url: `${ELECTRIC_URL}/v1/shape`,
  params: {
    table: 'proposals',
    where: `owner_id = '${userId}' AND status = 'active'`,
    columns: 'id,title,status,updated_at,client_name'
  }
})
```

Sync uses HTTP with Server-Sent Events, making it **CDN-friendly** — a crucial advantage over WebSocket-based approaches that require persistent connections. Electric tested **1 million concurrent clients** with flat latency and stable memory usage.

### SvelteKit integration pattern

No official Svelte integration exists, but the vanilla TypeScript client works naturally with Svelte stores:

```typescript
// lib/electric.ts
import { ShapeStream, Shape } from '@electric-sql/client'
import { writable } from 'svelte/store'

export function createElectricStore(shapeOptions) {
  const store = writable([])
  const stream = new ShapeStream(shapeOptions)
  const shape = new Shape(stream)
  
  shape.subscribe(({ rows }) => store.set(rows))
  
  return {
    subscribe: store.subscribe,
    cleanup: () => shape.unsubscribe()
  }
}

// In component
const proposals = createElectricStore({
  url: `${PUBLIC_ELECTRIC_URL}/v1/shape`,
  params: { table: 'proposals', where: `agency_id = '${agencyId}'` }
})
```

### Architecture for WebKit proposal generator

```
┌─────────────────────────────────────────────────────┐
│              SvelteKit on Cloudflare Pages          │
│  ┌────────────────┐  ┌────────────────────────────┐│
│  │ Write Actions  │  │ Electric Shape Streams     ││
│  │ (Go API calls) │  │ (real-time proposal data)  ││
│  └───────┬────────┘  └─────────────┬──────────────┘│
└──────────┼─────────────────────────┼───────────────┘
           │                         │ HTTP/SSE
           ▼                         ▼
┌─────────────────┐          ┌───────────────┐
│   Go Backend    │          │   Electric    │
│   (VPS)         │          │   Service     │
│ - REST API      │          │   (VPS)       │
│ - Business logic│          └───────┬───────┘
│ - Auth          │                  │ Logical replication
└────────┬────────┘                  │
         │                           │
         └──────────┬────────────────┘
                    ▼
           ┌───────────────┐
           │  PostgreSQL   │
           │  (proposals,  │
           │   templates,  │
           │   clients)    │
           └───────────────┘
```

## Electric SQL vs Cloudflare Durable Objects vs Convex

For real-time updates in WebKit, here's how the options stack up:

| Aspect | Electric SQL | Durable Objects | Convex |
|--------|--------------|-----------------|--------|
| **Data source** | Your existing PostgreSQL | Per-object SQLite | Proprietary Convex DB |
| **Lock-in** | None (Apache 2.0) | Cloudflare ecosystem | High (full platform) |
| **Self-hosting** | Full support | Not possible | Limited/expensive |
| **Offline support** | Built-in | Manual implementation | Limited |
| **Go integration** | Works alongside | HTTP/WebSocket calls | Replace backend |
| **SvelteKit** | Vanilla TS client | Custom implementation | React-focused |
| **Pricing** | Free (self-host) or managed | Usage-based | Usage-based |
| **Migration effort** | Add service, keep everything | Add to existing | Replace everything |

**Electric SQL wins for WebKit** because it works with your existing PostgreSQL without migration, lets Go remain your backend for writes, and requires no major architectural changes. Convex would mean abandoning your Go backend entirely.

## Practical use cases for the proposal generator

**Real-time proposal status** becomes trivial. When a proposal moves from "draft" to "sent" to "viewed" to "accepted," all connected clients see the change instantly without polling:

```typescript
const proposalStatus = createElectricStore({
  params: { 
    table: 'proposals', 
    where: `id = '${proposalId}'`,
    columns: 'id,status,viewed_at,signed_at' 
  }
})
```

**Collaborative editing** is supported through Electric's Yjs integration (`@electric-sql/y-electric`). Multiple team members can co-edit proposal content with conflict-free merging. The official Notes demo at electric-sql.com/demos/notes shows this in action.

**Offline support** works automatically. If a user's connection drops while reviewing proposals, the app continues working from the local cache. When connectivity returns, Electric catches up via offset-based sync — no data loss, no complex retry logic.

## Production readiness and company backing

Electric SQL has **strong production validation**. Trigger.dev uses it for their Realtime feature, processing millions of updates daily. The company raised approximately **$5M** from Intel Ignite, Lunar Ventures, and Firestreak Ventures. GitHub shows **9,600+ stars**, 86 contributors, and 600,000+ weekly downloads.

Self-hosting costs approximately **$40-90/month**: an Elixir service on a modest VPS ($30-50), fast SSD storage ($10-20), and optional CDN. Electric Cloud (managed service) is in public beta and currently free, with a "generous free tier" promised for GA.

## Alternatives worth knowing about

**PowerSync** is Electric's closest competitor — a Postgres↔SQLite bi-directional sync engine that's also open-source and self-hostable. The main difference: PowerSync focuses on SQLite as the client-side database, while Electric works with any JavaScript data store. PowerSync's free tier includes 2GB sync/month and 500MB hosted storage.

**Replicache/Zero** offers maximum flexibility but more work. You implement push/pull endpoints in Go, giving full control over sync logic. Replicache is now **free and open-source** (the team shifted focus to Zero, currently in alpha). Existing SvelteKit + Replicache examples exist on GitHub.

**PartyKit** (acquired by Cloudflare in April 2024) is the best option if you want to stay entirely in the Cloudflare ecosystem. It runs on Durable Objects with native Yjs support. However, party code must be JavaScript/TypeScript — Go can't run in Workers, so it would communicate with parties via HTTP/WebSocket rather than running directly.

## Decision framework for WebKit

| Requirement | Best Choice |
|-------------|-------------|
| Real-time proposal status | Electric SQL |
| Background job processing (PDF gen) | Cloudflare Queues |
| Stateful edge compute (rate limiting) | Durable Objects |
| Collaborative proposal editing | Electric SQL + Yjs |
| Offline proposal viewing | Electric SQL + PGlite |
| AI streaming with resume | Durable Streams |

## Implementation recommendation

For a solo developer building a SaaS proposal generator, I recommend this pragmatic approach:

**Phase 1 (Immediate):** Keep your current plan of Cloudflare Queues + Durable Objects for background processing. This handles PDF generation, email sending, and webhook delivery well.

**Phase 2 (When you need real-time):** Add Electric SQL as a sidecar service alongside your PostgreSQL. Start with a simple Shape for proposal status updates. The migration is non-invasive — your Go backend continues handling all writes, and you're just adding a new read path.

**Phase 3 (If collaborative editing matters):** Integrate `@electric-sql/y-electric` for real-time co-editing. This builds on the Electric infrastructure you already have.

Electric SQL adds meaningful value over the simpler Cloudflare-only approach **when real-time sync and offline support matter** to your users. For a proposal generator where clients might be reviewing proposals on spotty mobile connections or teams collaborating on drafts, this value is tangible. The ~$50/month self-hosting cost is reasonable given the complexity it abstracts away compared to building custom WebSocket infrastructure.

## Conclusion

Durable Streams turned out to be a red herring for Cloudflare-focused development — it's valuable but solves a narrower problem (reliable client streaming) than its name suggests. Electric SQL is the standout technology here: it slots cleanly into your existing SvelteKit + Go + PostgreSQL architecture, provides production-grade real-time sync with minimal migration effort, and comes with a credible team and funding behind it.

The architecture that emerges is complementary rather than either/or: **Cloudflare Queues** for job processing, **Durable Objects** for stateful edge compute, and **Electric SQL** for real-time data sync to clients. Each technology handles what it's best at, and your Go backend remains the source of truth for business logic.