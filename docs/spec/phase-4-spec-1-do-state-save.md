# Phase 4 Spec 1 — Durable Objects for H5P State Save

**Status:** Draft
**Date:** 2026-03-04
**Prerequisites:** Content state save working via Go/PostgreSQL (implemented in Phase 3.5)
**Related:**
- [Phase 4 — Durable Objects for Progress Tracking](phase-4-durable-objects-progress-tracking.md) — parent outline
- [Feature: Content Aliases & State Save](feature-content-aliases-and-state-save.md) — the Go/PG implementation this optimises

---

## Goal

Move H5P content-user-data (state save/restore) from the current Go → PostgreSQL direct-write path to a Cloudflare Worker + Durable Object caching layer. State reads become instant (<10ms, in-memory). Writes batch to PostgreSQL via alarm-based flush through the existing Go endpoint, reducing write amplification from N writes per learner session to ~1 write per 30 seconds.

The H5P client-side protocol (URL pattern, request/response format) stays identical. The cutover uses a feature flag with shadow writes so it can be validated in production before switching reads.

---

## Architecture Overview

### Current Flow (Phase 3.5)

```
H5P iframe                    SvelteKit (:3000)              Go backend (:4001)          PostgreSQL
    │                              │                              │                          │
    │  POST /api/h5p/content-      │                              │                          │
    │  user-data/:contentId/...    │                              │                          │
    ├─────────────────────────────►│  proxy (catch-all route)     │                          │
    │                              ├─────────────────────────────►│  UPSERT                  │
    │                              │                              ├─────────────────────────►│
    │                              │◄─────────────────────────────┤                          │
    │◄─────────────────────────────┤  {"success":true,"data":...} │                          │
```

Every state save is a full round-trip through SvelteKit → Go → PostgreSQL. At `saveFreq: 10` (every 10 seconds), a classroom of 100 learners generates 600 writes/min.

### Phase 4 Flow (Durable Objects)

```
H5P iframe                    SvelteKit (:3000)           CF Worker (edge)              Go (:4001)      PostgreSQL
    │                              │                          │                            │                │
    │  POST /api/h5p/content-      │                          │                            │                │
    │  user-data/:contentId/...    │  ┌─────────────────┐     │                            │                │
    ├─────────────────────────────►│  │ Feature flag:    │     │                            │                │
    │                              │  │ STATE_SAVE_TARGET│     │                            │                │
    │                              │  └───────┬─────────┘     │                            │                │
    │                              │          │               │                            │                │
    │                              │  if "worker" or "shadow" │                            │                │
    │                              │  ────────────────────────►│                            │                │
    │                              │                          │  ContentStateObject (DO)   │                │
    │                              │                          │  ┌────────────────────┐    │                │
    │                              │                          │  │ In-memory state    │    │                │
    │                              │                          │  │ GET: <10ms read    │    │                │
    │                              │                          │  │ POST: memory write │    │                │
    │                              │                          │  └────────┬───────────┘    │                │
    │                              │                          │           │                │                │
    │                              │◄─────────────────────────┤           │ alarm (30s)    │                │
    │◄─────────────────────────────┤                          │           │ flush batch    │                │
    │                              │                          │           ├───────────────►│  UPSERT batch  │
    │                              │                          │           │                ├───────────────►│
    │                              │                          │           │◄───────────────┤                │
```

100 learners at `saveFreq: 10` → 600 DO memory writes/min, but only ~200 PostgreSQL writes/min (batched per-user every 30s). GET requests never hit PostgreSQL at all.

---

## Cloudflare Worker Setup

### New Files

```
workers/
└── h5p-state/
    ├── wrangler.toml
    ├── src/
    │   ├── index.ts          # Worker entry point, routing
    │   ├── auth.ts           # JWT verification
    │   └── content-state.ts  # ContentStateObject DO class
    ├── package.json
    └── tsconfig.json
```

### wrangler.toml

```toml
name = "leaplearn-h5p-state"
main = "src/index.ts"
compatibility_date = "2024-12-01"

[durable_objects]
bindings = [
  { name = "CONTENT_STATE", class_name = "ContentStateObject" }
]

[[migrations]]
tag = "v1"
new_classes = ["ContentStateObject"]

[vars]
GO_BACKEND_URL = "https://api.leaplearn.io"

# Secrets (set via `wrangler secret put`):
# PUBLIC_KEY_PEM        — JWT verification key (Ed25519 public key)
# STATE_SERVICE_TOKEN   — X-Api-Key for DO → Go flush calls
```

### Service Binding (DO → Go Backend)

The DO flushes accumulated state to Go's existing endpoint:

```
POST https://api.leaplearn.io/api/v1/h5p/content-user-data/{contentId}/{dataType}/{subContentId}
X-Api-Key: <STATE_SERVICE_TOKEN>
X-User-Id: <userId UUID>
Content-Type: application/x-www-form-urlencoded

data=<JSON string>&preload=1&invalidate=0
```

This keeps all PostgreSQL write logic in the Go backend (single source of truth for DB operations). The Worker never talks to PostgreSQL directly.

**STATE_SERVICE_TOKEN** is a long-lived internal secret validated via `X-Api-Key` header, following the existing service-to-service auth pattern (see `task_route.go` with `TASK_TOKEN`). When present, Go skips JWT verification and org membership checks, reading the user ID from `X-User-Id` instead.

### Deployment

```bash
cd workers/h5p-state
wrangler secret put PUBLIC_KEY_PEM    # paste JWT public key
wrangler secret put STATE_SERVICE_TOKEN  # paste internal service token
wrangler deploy
```

---

## Durable Object: ContentStateObject

### Identity Model

One DO per user per content item:

```
DO ID = idFromName(`${userId}:${contentId}`)
```

This matches the current PostgreSQL scope: per-user, per-content (global, not per-enrolment). The `h5p_content_user_state` table has a unique constraint on `(user_id, content_id, sub_content_id, data_type)`.

### State Shape

```typescript
interface ContentState {
  userId: string;
  contentId: string;
  entries: Map<string, string>;  // key = `${subContentId}:${dataType}`, value = JSON string
  preloadFlags: Map<string, boolean>;  // same key → preload flag
  dirty: boolean;               // has unsaved changes since last flush
  lastFlush: number;            // timestamp of last successful flush to Go
}
```

### Class Implementation

```typescript
import { DurableObject } from 'cloudflare:workers';

interface Env {
  CONTENT_STATE: DurableObjectNamespace;
  GO_BACKEND_URL: string;
  STATE_SERVICE_TOKEN: string;
  PUBLIC_KEY_PEM: string;
}

export class ContentStateObject extends DurableObject {
  private env: Env;
  private userId: string = '';
  private contentId: string = '';
  private entries: Map<string, string> = new Map();
  private preloadFlags: Map<string, boolean> = new Map();
  private dirty: boolean = false;
  private lastFlush: number = 0;
  private retryCount: number = 0;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.env = env;

    ctx.blockConcurrencyWhile(async () => {
      const stored = await ctx.storage.get([
        'userId', 'contentId', 'entries', 'preloadFlags', 'lastFlush'
      ]);

      this.userId = (stored.get('userId') as string) || '';
      this.contentId = (stored.get('contentId') as string) || '';
      this.lastFlush = (stored.get('lastFlush') as number) || 0;

      const rawEntries = stored.get('entries') as Record<string, string> | undefined;
      if (rawEntries) {
        this.entries = new Map(Object.entries(rawEntries));
      }

      const rawPreload = stored.get('preloadFlags') as Record<string, boolean> | undefined;
      if (rawPreload) {
        this.preloadFlags = new Map(Object.entries(rawPreload));
      }
    });
  }

  // ─── GET: Read state ─────────────────────────────────────
  async getState(subContentId: string, dataType: string): Promise<Response> {
    const key = `${subContentId}:${dataType}`;
    const value = this.entries.get(key);

    if (value === undefined) {
      // No state saved — return false (NOT null, see gotchas)
      return Response.json({ success: true, data: false });
    }

    return Response.json({ success: true, data: value });
  }

  // ─── POST: Write state ────────────────────────────────────
  async setState(params: {
    subContentId: string;
    dataType: string;
    data: string;
    preload: boolean;
    invalidate: boolean;
    userId: string;
    contentId: string;
  }): Promise<Response> {
    // Initialise identity on first write
    if (!this.userId) {
      this.userId = params.userId;
      this.contentId = params.contentId;
      await this.ctx.storage.put({ userId: this.userId, contentId: this.contentId });
    }

    const key = `${params.subContentId}:${params.dataType}`;

    // Handle invalidate + empty data = DELETE
    if (params.invalidate && (params.data === '' || params.data === '0')) {
      this.entries.delete(key);
      this.preloadFlags.delete(key);
    } else {
      this.entries.set(key, params.data);
      this.preloadFlags.set(key, params.preload);
    }

    // Persist to DO storage (survives eviction)
    await this.ctx.storage.put({
      entries: Object.fromEntries(this.entries),
      preloadFlags: Object.fromEntries(this.preloadFlags),
    });

    // Mark dirty and schedule alarm if not already set
    this.dirty = true;
    const currentAlarm = await this.ctx.storage.getAlarm();
    if (!currentAlarm) {
      await this.ctx.storage.setAlarm(Date.now() + 30_000); // 30 seconds
    }

    return Response.json({ success: true });
  }

  // ─── GET ALL: Preload states for initial page render ──────
  async getPreloadStates(): Promise<Response> {
    const result: Record<string, Record<string, string>> = {};

    for (const [key, value] of this.entries) {
      const preload = this.preloadFlags.get(key);
      if (!preload) continue;

      const [subContentId, dataType] = key.split(':');
      if (!result[subContentId]) result[subContentId] = {};
      result[subContentId][dataType] = value;
    }

    return Response.json({ success: true, data: result });
  }

  // ─── ALARM: Flush dirty state to Go backend ───────────────
  async alarm(): Promise<void> {
    if (!this.dirty || this.entries.size === 0) return;

    try {
      // Flush each entry to Go's existing endpoint
      for (const [key, value] of this.entries) {
        const [subContentId, dataType] = key.split(':');
        const preload = this.preloadFlags.get(key) ? '1' : '0';

        const url = `${this.env.GO_BACKEND_URL}/api/v1/h5p/content-user-data/${this.contentId}/${dataType}/${subContentId}`;

        const body = new URLSearchParams({
          data: value,
          preload: preload,
          invalidate: '0',
        });

        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-Api-Key': this.env.STATE_SERVICE_TOKEN,
            'X-User-Id': this.userId,
          },
          body: body.toString(),
        });

        if (!res.ok) {
          throw new Error(`Flush failed: ${res.status} ${await res.text()}`);
        }
      }

      this.dirty = false;
      this.lastFlush = Date.now();
      await this.ctx.storage.put({ lastFlush: this.lastFlush });

    } catch (err) {
      // Retry with exponential backoff (max 5 min)
      const delay = Math.min(30_000 * Math.pow(2, Math.min(this.retryCount || 0, 4)), 300_000);
      await this.ctx.storage.setAlarm(Date.now() + delay);
      this.retryCount = (this.retryCount || 0) + 1;
      console.error('State flush failed, retrying in', delay, 'ms:', err);
      return;
    }

    // Reset retry counter on success
    this.retryCount = 0;
  }
}
```

### Key Design Decisions

1. **`ctx.storage.put()` on every write**: Ensures state survives DO eviction. Cost is minimal (DO storage is fast, local to the instance).

2. **Alarm at 30s intervals**: Batches multiple rapid saves into one flush cycle. During a quiz with `saveFreq: 10`, 3 saves accumulate before one flush.

3. **Flush iterates all entries**: Simple and correct. A user's state is typically 1-5 entries (one per sub-content). No need for change tracking — just re-flush everything.

4. **Exponential backoff on flush failure**: If Go backend is down, retries at 30s → 60s → 120s → 240s → 300s (max). State is safe in DO storage meanwhile.

---

## Worker API Routes

### JWT Authentication

```typescript
// src/auth.ts
import { importSPKI, jwtVerify } from 'jose';

let cachedKey: CryptoKey | null = null;

export async function verifyJWT(token: string, publicKeyPem: string): Promise<{
  userId: string;
  email: string;
} | null> {
  try {
    if (!cachedKey) {
      // LeapLearn JWTs use EdDSA (Ed25519), NOT RS256
      cachedKey = await importSPKI(publicKeyPem, 'EdDSA');
    }

    const { payload } = await jwtVerify(token, cachedKey);
    return {
      // Go backend puts user ID in 'id' claim (not 'sub')
      // See: app/pkg/auth/auth.go AccessTokenClaims
      userId: payload.id as string,
      email: payload.email as string,
    };
  } catch {
    return null;
  }
}
```

The Worker verifies JWTs locally using the same `PUBLIC_KEY_PEM` that the Go backend uses. No round-trip to Go for auth. The key is cached in Worker memory across requests.

**Important:** LeapLearn uses **EdDSA (Ed25519)** for JWT signing, not RSA. The `id` claim contains the user UUID (not the standard `sub` claim). See `app/pkg/auth/auth.go` for the canonical claim structure.

**Token extraction**: The H5P iframe's AJAX calls go through the SvelteKit proxy, which reads the `access_token` cookie and forwards it as `Authorization: Bearer <token>`. The Worker reads this header.

### Route Handler

```typescript
// src/index.ts
import { verifyJWT } from './auth';

export { ContentStateObject } from './content-state';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Route: /content-user-data/:contentId/:dataType/:subContentId
    const match = url.pathname.match(
      /^\/content-user-data\/([^/]+)\/([^/]+)\/([^/]+)$/
    );
    if (!match) {
      return new Response('Not found', { status: 404 });
    }

    const [, contentId, dataType, subContentId] = match;

    // Auth: verify JWT from Authorization header
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token) {
      return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const user = await verifyJWT(token, env.PUBLIC_KEY_PEM);
    if (!user) {
      return Response.json({ success: false, error: 'Invalid token' }, { status: 401 });
    }

    // Route to DO instance (one per user+content)
    const doId = env.CONTENT_STATE.idFromName(`${user.userId}:${contentId}`);
    const stub = env.CONTENT_STATE.get(doId);

    if (request.method === 'GET') {
      return stub.getState(subContentId, dataType);

    } else if (request.method === 'POST') {
      // H5P sends form-encoded data
      const formData = await request.formData();

      return stub.setState({
        subContentId,
        dataType,
        data: formData.get('data') as string || '',
        preload: formData.get('preload') === '1',
        invalidate: formData.get('invalidate') === '1',
        userId: user.userId,
        contentId,
      });
    }

    return new Response('Method not allowed', { status: 405 });
  },
};
```

### Request/Response Contract

Identical to the current Go endpoint — the H5P client sees no difference:

**GET** `/content-user-data/:contentId/:dataType/:subContentId`

```json
{"success": true, "data": "<JSON string>"}   // state exists
{"success": true, "data": false}              // no state (clean start)
```

**POST** `/content-user-data/:contentId/:dataType/:subContentId`

```
Content-Type: application/x-www-form-urlencoded
Body: data=<JSON string>&preload=0&invalidate=0
```

```json
{"success": true}
```

---

## Go Backend Changes

### Service Token Validation

Add a new auth path in `h5p_content_state_route.go` for internal service calls from the DO flush. The existing codebase uses `X-Api-Key` for service-to-service auth (see `task_route.go` with `TASK_TOKEN`). Follow the same pattern:

```go
// In handleContentUserData(), before the existing JWT auth:

// Check for internal service token first (DO flush calls)
if apiKey := r.Header.Get("X-Api-Key"); apiKey == h.cfg.StateServiceToken {
    userIdStr := r.Header.Get("X-User-Id")
    userID, err := uuid.Parse(userIdStr)
    if err != nil {
        writeResponse(h.cfg, w, r, nil, pkg.BadRequestError{Message: "X-User-Id required"})
        return
    }
    // Service token auth: skip org membership check (the DO already received
    // a request from an authenticated user whose org membership was verified
    // when the embed page was served)
    // ... dispatch to GET/POST handler with userID ...
    return
}

// Normal JWT auth (existing flow) ...
```

**Why skip org membership check for service token calls:** The DO flush writes on behalf of a user whose JWT was already verified when the Worker received the original request. The Worker verified the JWT, and the original embed page load already checked org membership. Re-checking on every flush would require the GO backend to do a DB lookup that the DO is trying to avoid.

**New env var:** `STATE_SERVICE_TOKEN` — a long-lived secret shared between the Worker and Go backend. Set via `wrangler secret put` on the Worker side and as an env var in Docker Compose for Go.

### Alarm Flush Headers

Update the DO alarm flush to use `X-Api-Key` instead of `Authorization: Bearer`:

```typescript
// In ContentStateObject.alarm():
const res = await fetch(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'X-Api-Key': this.env.STATE_SERVICE_TOKEN,
    'X-User-Id': this.userId,
  },
  body: body.toString(),
});
```

---

## SvelteKit Proxy Changes

### Feature Flag

Add `STATE_SAVE_TARGET` environment variable with three modes:

| Value | GET reads from | POST writes to | Description |
|-------|---------------|----------------|-------------|
| `go` | Go backend | Go backend | Current behaviour (default) |
| `shadow` | Go backend | Go backend + Worker | Shadow writes to Worker for validation |
| `worker` | Worker | Worker | Full cutover, Go receives async flush only |

### Proxy Implementation

```typescript
// service-client/src/routes/api/h5p/content-user-data/[...path]/+server.ts

import { env } from '$env/dynamic/private';

const GO_URL = env.CORE_API_URL;       // e.g. http://leaplearn-core:4001
const WORKER_URL = env.H5P_STATE_WORKER_URL;  // e.g. https://leaplearn-h5p-state.workers.dev
const TARGET = env.STATE_SAVE_TARGET || 'go';

async function proxyTo(url: string, request: Request, token: string): Promise<Response> {
  return fetch(url, {
    method: request.method,
    headers: {
      'Content-Type': request.headers.get('Content-Type') || '',
      'Authorization': `Bearer ${token}`,
    },
    body: request.method === 'POST' ? await request.text() : undefined,
    duplex: request.method === 'POST' ? 'half' : undefined,
  });
}

export async function GET({ params, request, cookies }) {
  const token = cookies.get('access_token');
  const path = params.path;

  if (TARGET === 'worker') {
    return proxyTo(`${WORKER_URL}/content-user-data/${path}`, request, token);
  }

  // 'go' and 'shadow' both read from Go
  return proxyTo(`${GO_URL}/api/v1/h5p/content-user-data/${path}`, request, token);
}

export async function POST({ params, request, cookies }) {
  const token = cookies.get('access_token');
  const path = params.path;

  if (TARGET === 'go') {
    return proxyTo(`${GO_URL}/api/v1/h5p/content-user-data/${path}`, request, token);
  }

  if (TARGET === 'shadow') {
    // Write to Go (primary) and Worker (shadow) in parallel
    const bodyText = await request.text();

    const [goRes, _workerRes] = await Promise.all([
      fetch(`${GO_URL}/api/v1/h5p/content-user-data/${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Bearer ${token}`,
        },
        body: bodyText,
      }),
      fetch(`${WORKER_URL}/content-user-data/${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Bearer ${token}`,
        },
        body: bodyText,
      }).catch(err => {
        console.error('Shadow write to Worker failed:', err);
        return null;  // Never fail the primary write
      }),
    ]);

    return goRes;  // Return Go response to client
  }

  // TARGET === 'worker'
  return proxyTo(`${WORKER_URL}/content-user-data/${path}`, request, token);
}
```

### Key Points

- Shadow mode never fails the primary write — Worker errors are caught and logged
- The H5P client sees no difference regardless of target mode
- The proxy reads `access_token` from cookies and forwards as Bearer header (existing pattern)

---

## Cutover Strategy

### Phase A: Shadow Writes (1-2 weeks)

```
STATE_SAVE_TARGET=shadow
```

1. Deploy Worker + DO to Cloudflare
2. Set `STATE_SAVE_TARGET=shadow` in SvelteKit env
3. All GETs still served by Go (source of truth)
4. All POSTs write to both Go and Worker in parallel
5. Monitor: Worker error rate, DO storage metrics, alarm execution
6. Validate: Query a few DO instances to confirm state matches PostgreSQL

**Success criteria:** Worker shadow writes succeed >99.9% over 1-2 weeks, DO state matches PostgreSQL for sampled users.

### Phase B: Switch Reads (1 day)

```
STATE_SAVE_TARGET=worker
```

1. Set `STATE_SAVE_TARGET=worker`
2. GETs now served by Worker (instant, from DO memory)
3. POSTs go to Worker only; Go receives data via alarm flush
4. Monitor: State restore accuracy, learner experience, flush success rate
5. Rollback plan: Set `STATE_SAVE_TARGET=go` — Go still has all data in PostgreSQL

**Success criteria:** No learner-reported state loss, flush backlog stays near zero.

### Phase C: Cleanup (after 1 week stable)

1. Remove shadow mode code from SvelteKit proxy
2. Remove `STATE_SAVE_TARGET` flag (Worker becomes the only path)
3. Keep Go endpoint alive (still receives flush writes)
4. Optionally: Remove the direct H5P → SvelteKit → Go proxy for state endpoints

---

## Future: Per-Enrolment Scoping

Currently state is scoped per-user, per-content (global). When a learner encounters the same H5P content in two courses, they share state. This matches Moodle/WordPress behaviour and is correct for the current use case.

When per-enrolment scoping is needed (e.g., formal assessments where each course enrolment should have independent state):

1. **DO key changes**: `idFromName(\`${userId}:${contentId}\`)` → `idFromName(\`${enrolmentId}:${contentId}\`)`
2. **PostgreSQL table**: Add optional `enrolment_id UUID REFERENCES enrolments(id)` column to `h5p_content_user_state`
3. **URL pattern changes**: Learning player passes `enrolmentId` as a query param or header
4. **Existing global state** (`enrolment_id = NULL`) continues working as default

This is documented here but **not implemented in this spec**. It will be addressed when the course progress tracking DO (Spec 3) is implemented and the learning player has enrolment context readily available.

---

## Lessons from Phase 3.5 Implementation

These bugs were discovered during the Go/PG implementation and must be carried into the DO implementation:

### 1. `invalidate=1` Does NOT Always Mean Delete

H5P's auto-save calls `setUserData({deleteOnChange: true})`, which sends `invalidate=1` alongside real state data. Only treat as a DELETE when `invalidate=1 AND (data==="" OR data==="0")`. When `invalidate=1` but `data` has actual JSON, it's a normal save. The DO's `setState()` already handles this correctly.

### 2. GET Response: `false` vs `null` vs String

- `data: "..."` (truthy string) → H5P restores state
- `data: null` → H5P shows "Data Reset" dialog (state was explicitly cleared)
- `data: false` → H5P treats as "no previous state" (clean start, no dialog)

Return `false` for missing state, never `null`.

### 3. `data-content-id="1"` — Pre-bake UUIDs

The embed HTML uses `data-content-id="1"`. H5P replaces `:contentId` with `1` in AJAX URLs. The Go embed handler pre-bakes the real UUID into the URL. The Worker doesn't need to worry about this (it receives the already-resolved UUID from the proxy).

### 4. SvelteKit Auth Hooks Skip `/api/` Routes

The auth middleware in `hooks.server.ts` skips `/api/*` paths (added during Phase 3.5). This is essential for the proxy to forward requests to the Worker without SvelteKit intercepting them.

### 5. Form-Encoded POST, Not JSON

H5P sends `application/x-www-form-urlencoded` POST data via jQuery AJAX. The Worker must use `request.formData()`, not `request.json()`.

See `.claude/notes/state-save/gotchas.md` for the full list.

---

## Out of Scope

- **xAPI event buffering** — Separate concern, handled in Spec 3 (Per-courseItemId Progress)
- **R2 storage migration** — Handled in Spec 2 (R2 Library Storage Adapter)
- **Per-enrolment state** — Documented above, not implemented
- **State migration tool** — Existing PostgreSQL state will be loaded into DOs on first access (cold start reads from Go, then cached)
- **Admin UI for state management** — No dashboard for viewing/clearing learner state
- **WebSocket real-time sync** — H5P uses polling (saveFreq), not WebSockets
- **Multi-region DO placement** — Single region is fine for AU-focused initial user base
