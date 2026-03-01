# Phase 4 — Durable Objects for Real-Time Progress Tracking

**Status:** Planning  
**Target:** After Phase 3 (Courses & Progress) is stable in production  
**Prerequisites:** Phase 3 complete (courses, enrolment, xAPI capture, progress tracking all working via direct PostgreSQL writes)  
**Related:**  
- [Phase 3 — Courses & Progress Tracking](../spec/phase-3-courses-progress.md) — the direct-to-PostgreSQL implementation this optimises  
- [Feature Spec: Library Tiers & Custom Content Types](../spec/feature-spec-library-tiers.md) — community library (parallel work)  
- [LeapLearn Architecture Blueprint](../spec/architecture-blueprint.md) — overall system design  

---

## Why This Phase Exists

Phase 3 implements xAPI capture and progress tracking via a direct pipeline:

```
H5P iframe → postMessage → SvelteKit → Go backend → PostgreSQL
```

This works, but has known limitations that become meaningful at scale:

1. **Reliability** — xAPI events fire via `fetch()` from the browser. If the learner closes the tab, loses connection, or the POST fails, that event is lost silently. For scored/completed events, this means a student can finish a quiz and have their completion never recorded.

2. **Latency** — every xAPI event is a full round-trip: browser → SvelteKit proxy → Go backend (potentially in a specific K8s region) → PostgreSQL write. The learning player sidebar showing progress depends on this completing before it can update.

3. **Write amplification** — a student working through a quiz generates 20+ xAPI events in 30 seconds (one per question answered, plus attempted, scored, completed). Each becomes a separate PostgreSQL write. The database sees N writes where it really only needs 1 final state update.

4. **Completion race conditions** — checking "are all course items completed?" requires a SQL aggregation across `progress_records` joined to `course_items`. Concurrent xAPI events from rapid interactions can race against this check.

Cloudflare Durable Objects solve all four problems with a pattern that maps directly to an established architecture (the AI credit system pattern — per-user stateful object, in-memory reads, batched async writes to durable store).

---

## Architecture Overview

### Current (Phase 3) — Direct Pipeline

```
┌─────────────┐     fetch()      ┌─────────────┐    proxy     ┌─────────────┐
│ H5P iframe  │ ──postMessage──► │  SvelteKit   │ ──────────► │ Go backend  │
│ (browser)   │                  │  :3000       │             │ :4001       │
└─────────────┘                  └─────────────┘             └──────┬──────┘
                                                                    │
                                                              INSERT/UPDATE
                                                                    │
                                                             ┌──────▼──────┐
                                                             │ PostgreSQL  │
                                                             │ :5432       │
                                                             └─────────────┘
```

### Phase 4 — Durable Object Caching Layer

```
┌─────────────┐     fetch()      ┌──────────────────────────────────────────┐
│ H5P iframe  │ ──postMessage──► │  Cloudflare Worker (edge)                │
│ (browser)   │                  │                                          │
└─────────────┘                  │  ┌──────────────────────────────────┐   │
                                 │  │ EnrolmentProgressObject (DO)     │   │
                                 │  │                                  │   │
  ┌─────────────┐  getProgress() │  │  In-memory: Map<itemId, {       │   │
  │ Learning    │ ◄─────────────►│  │    score, completion, attempts, │   │
  │ Player      │   (zero I/O)   │  │    timeSpent, completed         │   │
  │ Sidebar     │                │  │  }>                             │   │
  └─────────────┘                │  │                                  │   │
                                 │  │  DO Storage: persistent backup   │   │
                                 │  │                                  │   │
                                 │  │  Alarm: batch sync (10s)  ──────┼───┼──┐
                                 │  └──────────────────────────────────┘   │  │
                                 └──────────────────────────────────────────┘  │
                                                                               │
                                                              POST /internal   │
                                                              /progress/sync   │
                                                                               │
                                                             ┌─────────────┐   │
                                                             │ Go backend  │◄──┘
                                                             │ :4001       │
                                                             └──────┬──────┘
                                                                    │
                                                              UPSERT (batch)
                                                                    │
                                                             ┌──────▼──────┐
                                                             │ PostgreSQL  │
                                                             └─────────────┘
```

### Two-Tier Data Model

| Tier | Purpose | Latency | Consistency | Consumers |
|------|---------|---------|-------------|-----------|
| **Durable Object** | Real-time student-facing state | <10ms (edge, in-memory) | Immediate | Learning player, progress sidebar, completion checks |
| **PostgreSQL** | Durable reporting store | N/A (async sync) | Eventual (≤10s behind) | Teacher dashboard, course analytics, GDPR exports, aggregation queries |

Students always see their latest progress instantly. Teachers see progress that is at most 10 seconds behind. This is acceptable for any dashboard use case.

---

## Durable Object Design

### Identity Model

One DO per enrolment — one per student per course.

```
DO ID = idFromName(`${enrolmentId}`)
```

This scoping is correct because:
- Progress is per-student, per-course (not per-content-item globally)
- A student enrolled in 3 courses has 3 DOs, each tracking that course's items
- If the same H5P content appears in 2 courses, progress is tracked independently per enrolment
- Matches the `progress_records` table which has a unique constraint on `(enrolment_id, course_item_id)`

### State Shape

```typescript
interface ItemProgress {
    score: number | null;
    maxScore: number | null;
    completion: number;       // 0.0 to 1.0
    completed: boolean;
    attempts: number;
    timeSpent: number;        // seconds
    lastVerb: string;         // last xAPI verb received
    lastUpdated: number;      // timestamp
}

// In-memory state
type ProgressMap = Map<string, ItemProgress>;  // courseItemId → ItemProgress
```

### Class Implementation

```typescript
import { DurableObject } from 'cloudflare:workers';

interface Env {
    GO_BACKEND_URL: string;
    INTERNAL_API_KEY: string;
}

export class EnrolmentProgressObject extends DurableObject {
    private progress: Map<string, ItemProgress>;
    private enrolmentId: string;
    private orgId: string;
    private courseId: string;
    private courseItemIds: string[];       // ordered list of all items in course
    private pendingSync: boolean = false;
    private xapiBuffer: XAPIEvent[] = [];  // buffer raw statements for append-only log

    constructor(ctx: DurableObjectState, env: Env) {
        super(ctx, env);

        // Block all requests until state is rehydrated
        ctx.blockConcurrencyWhile(async () => {
            const stored = await ctx.storage.get([
                'progress', 'enrolmentId', 'orgId', 'courseId', 'courseItemIds'
            ]);

            this.progress = stored.get('progress')
                ? new Map(Object.entries(stored.get('progress') as Record<string, ItemProgress>))
                : new Map();
            this.enrolmentId = (stored.get('enrolmentId') as string) || '';
            this.orgId = (stored.get('orgId') as string) || '';
            this.courseId = (stored.get('courseId') as string) || '';
            this.courseItemIds = (stored.get('courseItemIds') as string[]) || [];
        });
    }

    // ─── Called once on enrolment creation ───────────────────────────

    async initialise(params: {
        enrolmentId: string;
        orgId: string;
        courseId: string;
        courseItemIds: string[];
    }): Promise<void> {
        this.enrolmentId = params.enrolmentId;
        this.orgId = params.orgId;
        this.courseId = params.courseId;
        this.courseItemIds = params.courseItemIds;

        // Initialise empty progress for each course item
        for (const itemId of params.courseItemIds) {
            if (!this.progress.has(itemId)) {
                this.progress.set(itemId, {
                    score: null,
                    maxScore: null,
                    completion: 0,
                    completed: false,
                    attempts: 0,
                    timeSpent: 0,
                    lastVerb: '',
                    lastUpdated: Date.now(),
                });
            }
        }

        await this.ctx.storage.put({
            enrolmentId: this.enrolmentId,
            orgId: this.orgId,
            courseId: this.courseId,
            courseItemIds: this.courseItemIds,
            progress: Object.fromEntries(this.progress),
        });
    }

    // ─── Called when teacher adds item to published course ──────────

    async addCourseItem(courseItemId: string): Promise<void> {
        if (!this.courseItemIds.includes(courseItemId)) {
            this.courseItemIds.push(courseItemId);
            this.progress.set(courseItemId, {
                score: null, maxScore: null, completion: 0,
                completed: false, attempts: 0, timeSpent: 0,
                lastVerb: '', lastUpdated: Date.now(),
            });
            await this.ctx.storage.put({
                courseItemIds: this.courseItemIds,
                progress: Object.fromEntries(this.progress),
            });
        }
    }

    // ─── Called when teacher removes item from published course ─────

    async removeCourseItem(courseItemId: string): Promise<void> {
        this.courseItemIds = this.courseItemIds.filter(id => id !== courseItemId);
        this.progress.delete(courseItemId);
        await this.ctx.storage.put({
            courseItemIds: this.courseItemIds,
            progress: Object.fromEntries(this.progress),
        });
    }

    // ─── Core: record an xAPI event ─────────────────────────────────

    async recordEvent(event: {
        courseItemId: string;
        verb: string;
        score?: number;
        maxScore?: number;
        duration?: number;
        rawStatement: object;
    }): Promise<{ success: boolean; allCompleted: boolean; progress: ItemProgress }> {
        const current = this.progress.get(event.courseItemId) || {
            score: null, maxScore: null, completion: 0,
            completed: false, attempts: 0, timeSpent: 0,
            lastVerb: '', lastUpdated: Date.now(),
        };

        // Update progress based on verb
        switch (event.verb) {
            case 'completed':
                current.completed = true;
                current.completion = 1.0;
                break;

            case 'scored':
                if (event.score !== undefined) {
                    current.score = event.score;
                    current.maxScore = event.maxScore ?? current.maxScore;
                }
                current.attempts += 1;
                break;

            case 'answered':
                current.attempts += 1;
                break;

            case 'experienced':
                // For text/video/link items — mark as completed on view
                if (current.completion === 0) {
                    current.completion = 1.0;
                    current.completed = true;
                }
                break;
        }

        if (event.duration && event.duration > 0) {
            current.timeSpent += event.duration;
        }

        current.lastVerb = event.verb;
        current.lastUpdated = Date.now();
        this.progress.set(event.courseItemId, current);

        // Buffer raw xAPI statement for append-only log sync
        this.xapiBuffer.push({
            orgId: this.orgId,
            userId: '', // set by Worker from JWT before calling DO
            contentId: event.courseItemId,
            courseId: this.courseId,
            verb: event.verb,
            statement: event.rawStatement,
            timestamp: Date.now(),
        });

        // Persist to DO storage immediately (survives DO restarts)
        await this.ctx.storage.put('progress', Object.fromEntries(this.progress));

        // Schedule PostgreSQL sync if not already scheduled
        if (!this.pendingSync) {
            const alarm = await this.ctx.storage.getAlarm();
            if (!alarm) {
                await this.ctx.storage.setAlarm(Date.now() + 10_000); // 10 seconds
                this.pendingSync = true;
            }
        }

        const allCompleted = this.checkAllCompleted();
        return { success: true, allCompleted, progress: current };
    }

    // ─── Read: instant, zero I/O ────────────────────────────────────

    async getProgress(): Promise<{
        enrolmentId: string;
        courseId: string;
        items: Record<string, ItemProgress>;
        allCompleted: boolean;
        completedCount: number;
        totalCount: number;
        overallCompletion: number;
    }> {
        const items = Object.fromEntries(this.progress);
        const completedCount = [...this.progress.values()].filter(p => p.completed).length;
        const totalCount = this.courseItemIds.length;

        return {
            enrolmentId: this.enrolmentId,
            courseId: this.courseId,
            items,
            allCompleted: this.checkAllCompleted(),
            completedCount,
            totalCount,
            overallCompletion: totalCount > 0 ? completedCount / totalCount : 0,
        };
    }

    // ─── Alarm: batch sync to PostgreSQL ────────────────────────────

    async alarm(): Promise<void> {
        try {
            const syncPayload = {
                enrolmentId: this.enrolmentId,
                orgId: this.orgId,
                courseId: this.courseId,
                progress: Object.fromEntries(this.progress),
                allCompleted: this.checkAllCompleted(),
                xapiStatements: this.xapiBuffer,
            };

            const response = await fetch(
                `${this.env.GO_BACKEND_URL}/api/v1/internal/progress/sync`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.env.INTERNAL_API_KEY}`,
                    },
                    body: JSON.stringify(syncPayload),
                }
            );

            if (!response.ok) {
                throw new Error(`Sync failed: ${response.status}`);
            }

            // Clear buffer on successful sync
            this.xapiBuffer = [];
            this.pendingSync = false;

        } catch (error) {
            // Retry — reschedule alarm with backoff
            console.error('Progress sync failed, retrying:', error);
            await this.ctx.storage.setAlarm(Date.now() + 30_000); // 30 second retry
        }
    }

    // ─── Internal ───────────────────────────────────────────────────

    private checkAllCompleted(): boolean {
        if (this.courseItemIds.length === 0) return false;
        for (const itemId of this.courseItemIds) {
            const item = this.progress.get(itemId);
            if (!item || !item.completed) return false;
        }
        return true;
    }
}

interface XAPIEvent {
    orgId: string;
    userId: string;
    contentId: string;
    courseId: string;
    verb: string;
    statement: object;
    timestamp: number;
}
```

---

## Worker Entry Point

The Cloudflare Worker sits in front of the DOs and handles routing, authentication, and user context injection.

```typescript
// src/worker.ts
export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        const url = new URL(request.url);

        // ─── POST /xapi — record an xAPI event ──────────────
        if (url.pathname === '/xapi' && request.method === 'POST') {
            const userId = await authenticateRequest(request, env);
            if (!userId) return new Response('Unauthorized', { status: 401 });

            const body = await request.json() as {
                enrolmentId: string;
                courseItemId: string;
                verb: string;
                score?: number;
                maxScore?: number;
                duration?: number;
                rawStatement: object;
            };

            const id = env.ENROLMENT_PROGRESS.idFromName(body.enrolmentId);
            const obj = env.ENROLMENT_PROGRESS.get(id);

            const result = await obj.recordEvent({
                courseItemId: body.courseItemId,
                verb: body.verb,
                score: body.score,
                maxScore: body.maxScore,
                duration: body.duration,
                rawStatement: body.rawStatement,
            });

            // If all items completed, trigger enrolment completion
            // (the alarm sync will also handle this, but immediate
            //  feedback improves UX)
            if (result.allCompleted) {
                // Fire-and-forget notification to Go backend
                env.ctx.waitUntil(
                    fetch(`${env.GO_BACKEND_URL}/api/v1/internal/enrolments/complete`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${env.INTERNAL_API_KEY}`,
                        },
                        body: JSON.stringify({ enrolmentId: body.enrolmentId }),
                    })
                );
            }

            return Response.json(result);
        }

        // ─── GET /progress/:enrolmentId — read progress ─────
        if (url.pathname.startsWith('/progress/') && request.method === 'GET') {
            const userId = await authenticateRequest(request, env);
            if (!userId) return new Response('Unauthorized', { status: 401 });

            const enrolmentId = url.pathname.split('/progress/')[1];
            const id = env.ENROLMENT_PROGRESS.idFromName(enrolmentId);
            const obj = env.ENROLMENT_PROGRESS.get(id);

            const progress = await obj.getProgress();
            return Response.json(progress);
        }

        // ─── POST /enrolments/init — initialise DO on enrolment ──
        if (url.pathname === '/enrolments/init' && request.method === 'POST') {
            // Called by Go backend when enrolment is created
            const internalKey = request.headers.get('Authorization');
            if (internalKey !== `Bearer ${env.INTERNAL_API_KEY}`) {
                return new Response('Forbidden', { status: 403 });
            }

            const body = await request.json() as {
                enrolmentId: string;
                orgId: string;
                courseId: string;
                courseItemIds: string[];
            };

            const id = env.ENROLMENT_PROGRESS.idFromName(body.enrolmentId);
            const obj = env.ENROLMENT_PROGRESS.get(id);
            await obj.initialise(body);

            return Response.json({ success: true });
        }

        // ─── POST /course-items/add — sync new item to enrolled DOs ──
        if (url.pathname === '/course-items/add' && request.method === 'POST') {
            const internalKey = request.headers.get('Authorization');
            if (internalKey !== `Bearer ${env.INTERNAL_API_KEY}`) {
                return new Response('Forbidden', { status: 403 });
            }

            const body = await request.json() as {
                enrolmentIds: string[];
                courseItemId: string;
            };

            // Fan out to all enrolled DOs
            const results = await Promise.allSettled(
                body.enrolmentIds.map(async (enrolmentId) => {
                    const id = env.ENROLMENT_PROGRESS.idFromName(enrolmentId);
                    const obj = env.ENROLMENT_PROGRESS.get(id);
                    await obj.addCourseItem(body.courseItemId);
                })
            );

            return Response.json({
                success: true,
                updated: results.filter(r => r.status === 'fulfilled').length,
                failed: results.filter(r => r.status === 'rejected').length,
            });
        }

        return new Response('Not Found', { status: 404 });
    },
};

export { EnrolmentProgressObject };
```

### Wrangler Configuration

```toml
# wrangler.toml
name = "leaplearn-progress"
main = "src/worker.ts"
compatibility_date = "2026-02-28"

[durable_objects]
bindings = [
    { name = "ENROLMENT_PROGRESS", class_name = "EnrolmentProgressObject" }
]

[[migrations]]
tag = "v1"
new_classes = ["EnrolmentProgressObject"]

[vars]
GO_BACKEND_URL = "https://api.leaplearn.io"

# INTERNAL_API_KEY set via wrangler secret
```

---

## Go Backend Changes

### New Internal Sync Endpoint

```
POST /api/v1/internal/progress/sync    (internal API key auth, not user-facing)
```

This endpoint receives batched progress data from the DO alarm and writes to PostgreSQL in a single transaction:

```
1. UPSERT progress_records — one row per course item, ON CONFLICT update score/completion/attempts/timeSpent
2. INSERT xapi_statements — append-only, batch insert all buffered statements
3. If allCompleted → UPDATE enrolments SET status='completed', completed_at=NOW()
4. UPDATE enrolments SET progress_pct = (completed_items / total_items * 100)
```

This replaces the per-event writes from Phase 3. The Go backend no longer processes individual xAPI events — it receives pre-aggregated progress snapshots.

### New Internal Completion Endpoint

```
POST /api/v1/internal/enrolments/complete    (internal API key auth)
```

Immediate notification when a student completes all course items. Sets `enrolments.status = 'completed'` and `completed_at = NOW()`. This provides instant completion feedback even before the alarm-based sync fires.

### Enrolment Creation Hook

When `enrolInCourse` creates an enrolment, it must also initialise the DO:

```go
// After inserting enrolment + progress_records in PostgreSQL...

// Initialise the Durable Object
_, err = http.Post(
    fmt.Sprintf("%s/enrolments/init", env.PROGRESS_WORKER_URL),
    "application/json",
    marshalJSON(map[string]interface{}{
        "enrolmentId":   enrolment.ID,
        "orgId":         enrolment.OrgID,
        "courseId":       enrolment.CourseID,
        "courseItemIds":  courseItemIDs,
    }),
)
```

### Course Item Modification Hook

When a teacher adds or removes an item from a published course with active enrolments, the Go backend fans out to the Worker:

```go
// After adding a course item...
enrolmentIDs := queries.GetActiveEnrolmentIDs(ctx, courseID)
if len(enrolmentIDs) > 0 {
    http.Post(
        fmt.Sprintf("%s/course-items/add", env.PROGRESS_WORKER_URL),
        "application/json",
        marshalJSON(map[string]interface{}{
            "enrolmentIds":  enrolmentIDs,
            "courseItemId":  newItem.ID,
        }),
    )
}
```

---

## Frontend Changes

### H5PPlayer xAPI Integration

Replace the Phase 3 direct POST with a Worker POST:

```typescript
// Before (Phase 3):
fetch('/api/h5p/xapi', { ... })

// After (Phase 4):
fetch(`${env.PUBLIC_PROGRESS_WORKER_URL}/xapi`, {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userToken}`,
    },
    body: JSON.stringify({
        enrolmentId: currentEnrolment.id,
        courseItemId: currentCourseItem.id,
        verb: verb,
        score: statement.result?.score?.raw,
        maxScore: statement.result?.score?.max,
        duration: parseDuration(statement.result?.duration),
        rawStatement: statement,
    }),
});
```

### sendBeacon Fallback

Add `beforeunload` handler for reliability:

```typescript
// In LearningPlayer.svelte or H5PPlayer.svelte
window.addEventListener('beforeunload', () => {
    if (pendingEvents.length > 0) {
        navigator.sendBeacon(
            `${env.PUBLIC_PROGRESS_WORKER_URL}/xapi`,
            new Blob(
                [JSON.stringify({
                    enrolmentId: currentEnrolment.id,
                    events: pendingEvents,
                })],
                { type: 'application/json' }
            )
        );
    }
});
```

The Worker would need a `/xapi/batch` endpoint that accepts multiple events in one request for this path.

### Progress Sidebar

Replace Phase 3's server-loaded progress with live Worker reads:

```typescript
// In learning player layout
async function loadProgress(enrolmentId: string) {
    const res = await fetch(
        `${env.PUBLIC_PROGRESS_WORKER_URL}/progress/${enrolmentId}`,
        { headers: { 'Authorization': `Bearer ${userToken}` } }
    );
    return res.json();
}

// Returns instantly from DO in-memory state — no database query
// Can poll every few seconds for multi-tab sync, or use WebSocket (Phase 5)
```

### Teacher Dashboard (No Change)

Teacher-facing dashboards (`/courses/[courseId]` → Learners tab) continue to query PostgreSQL via the existing Go backend. The data is at most 10 seconds behind — acceptable for any dashboard use case.

---

## Cold Start & Rehydration

When a DO hasn't been accessed for a while, Cloudflare evicts it from memory. On next access:

1. The DO constructor runs
2. `blockConcurrencyWhile` loads state from DO persistent storage
3. All subsequent reads are in-memory again

**DO storage is persistent until explicitly deleted.** It survives eviction, restarts, and redeployment. The data is safe.

### Edge Case: DO storage cleared or corrupted

If DO storage is somehow empty but the enrolment exists in PostgreSQL:

```typescript
async getProgress() {
    if (this.progress.size === 0 && this.enrolmentId === '') {
        // DO is uninitialised — rehydrate from PostgreSQL
        const response = await fetch(
            `${this.env.GO_BACKEND_URL}/api/v1/internal/progress/rehydrate/${enrolmentId}`,
            { headers: { 'Authorization': `Bearer ${this.env.INTERNAL_API_KEY}` } }
        );
        const data = await response.json();
        await this.initialise(data);
    }
    // ... return progress
}
```

This provides a safety net — PostgreSQL is always the source of truth for recovery, while the DO is the source of truth for real-time reads.

---

## Data Flow Summary

| Event | Path | Latency |
|-------|------|---------|
| Student answers quiz question | Browser → Worker → DO `recordEvent()` → DO storage | <50ms (edge) |
| Student reads progress sidebar | Browser → Worker → DO `getProgress()` (in-memory) | <10ms (edge) |
| Progress syncs to PostgreSQL | DO alarm → Go backend → PostgreSQL batch upsert | Async (10s interval) |
| Teacher views student progress | SvelteKit → Go backend → PostgreSQL query | Normal DB query |
| Student completes all items | DO detects → Worker notifies Go backend immediately | <100ms |
| Student returns after days | Browser → Worker → DO constructor rehydrates from DO storage | <100ms (cold start) |
| DO storage lost (rare edge case) | DO constructor detects empty → fetches from PostgreSQL → reinitialises | <500ms |

---

## Problem Resolution Matrix

How Phase 4 addresses each Phase 3 limitation:

| Phase 3 Problem | Phase 4 Solution |
|------------------|------------------|
| **Lost events on tab close** | `navigator.sendBeacon()` fallback + DO storage persists on first successful write |
| **Write amplification** (20 DB writes per quiz) | DO accumulates in-memory, alarm syncs 1 batch write every 10s |
| **Completion check race condition** | Local in-memory check in DO, no SQL aggregation needed |
| **Latency on progress reads** | In-memory read from edge DO, no database round-trip |
| **Teacher adds item to published course** | Go backend fans out to Worker → DOs add new item to tracking |
| **Teacher removes item from published course** | Go backend fans out to Worker → DOs remove item, preserve credit for completed work |

---

## Security Considerations

### Authentication

- **Student-facing endpoints** (`/xapi`, `/progress/:id`): JWT validation in Worker. Extract `userId` from token, verify enrolment ownership before allowing DO access.
- **Internal endpoints** (`/enrolments/init`, `/course-items/add`, `/progress/sync`): API key auth. The Go backend and Worker share an `INTERNAL_API_KEY` secret. These endpoints are not exposed to browsers.

### Tenant Isolation

- Each DO is scoped to a single enrolment (single student, single course, single org)
- The Worker validates that the authenticated user owns the enrolment before routing to the DO
- DOs cannot access each other's storage
- The Go sync endpoint validates `orgId` from the DO payload against the enrolment record in PostgreSQL

### Rate Limiting

- H5P content can generate rapid xAPI events (quiz with 50 questions = 50+ events in minutes)
- The DO naturally absorbs this — events update in-memory state, not a database
- Consider a Worker-level rate limit of 100 events/minute per enrolment to prevent abuse
- The alarm-based sync provides natural backpressure — at most 6 syncs per minute per DO

---

## Monitoring & Observability

### Worker Analytics

Cloudflare Workers dashboard provides:
- Request count, latency percentiles, error rates
- DO storage operations count
- Alarm invocation count and success rate

### Custom Metrics (push to Grafana via Go backend)

The sync endpoint in Go should log:
- Sync payload size (number of items updated, number of xAPI statements)
- Sync latency
- Failed syncs (alarm retries)
- Enrolment completion events

### Alerting

- **Sync failure rate > 5%** — indicates Go backend or PostgreSQL issues
- **DO alarm backlog** — if alarms are consistently being rescheduled, indicates persistent sync failures
- **Progress divergence** — periodic check comparing DO state to PostgreSQL (should converge within 30s)

---

## Migration from Phase 3

### Step 1: Deploy Worker + DO (alongside existing pipeline)

Deploy the Cloudflare Worker with the DO class. No traffic routed yet. The Phase 3 direct pipeline continues operating.

### Step 2: Dual-write period

Modify the Go enrolment creation to initialise DOs for new enrolments. Both the Phase 3 direct pipeline and the DO receive events. Compare results for validation.

### Step 3: Backfill existing enrolments

Script that reads all active enrolments from PostgreSQL and calls `/enrolments/init` on the Worker for each, populating DOs with current progress state.

### Step 4: Switch reads

Point the learning player progress sidebar to read from the Worker (`/progress/:enrolmentId`) instead of the Go backend. Verify instant reads.

### Step 5: Switch writes

Point the H5PPlayer xAPI capture to POST to the Worker (`/xapi`) instead of the SvelteKit proxy. The Worker + DO handles events, alarms sync to PostgreSQL.

### Step 6: Remove Phase 3 direct pipeline

Remove the Go `POST /api/v1/h5p/xapi` endpoint (or keep it as the internal sync target only). Remove the SvelteKit proxy route for xAPI. The Worker is now the sole entry point for student progress events.

---

## Implementation Estimate

| Task | Effort | Dependencies |
|------|--------|--------------|
| EnrolmentProgressObject DO class | 4h | None |
| Worker entry point (routing, auth, endpoints) | 3h | DO class |
| Wrangler config + deployment | 1h | Worker |
| Go internal sync endpoint (`/progress/sync`) | 3h | Phase 3 complete |
| Go internal completion endpoint | 1h | Phase 3 complete |
| Go enrolment creation hook (init DO) | 1h | Worker deployed |
| Go course item modification hooks (fan-out) | 2h | Worker deployed |
| Frontend: H5PPlayer xAPI → Worker rewrite | 2h | Worker deployed |
| Frontend: sendBeacon fallback | 1h | xAPI rewrite |
| Frontend: progress sidebar → Worker reads | 2h | Worker deployed |
| Backfill script for existing enrolments | 2h | Worker deployed |
| Dual-write validation + testing | 3h | All above |
| Monitoring integration (sync metrics) | 2h | Sync endpoint |
| **Total** | **~27h (3–4 days)** | |

---

## Future Extensions (Phase 5+)

### WebSocket Progress Updates

DOs natively support WebSockets. Instead of polling `/progress/:enrolmentId`, the learning player could open a WebSocket connection to the DO. Progress updates pushed to the client in real-time — the sidebar updates the instant a quiz is completed, with zero polling.

### Multi-Device Sync

Student starts a course on desktop, continues on mobile. Both devices connect to the same DO (same enrolment ID). WebSocket broadcasts ensure both devices see the same progress state instantly.

### Teacher Real-Time View

A separate DO class (`CourseProgressObject`, one per course) could aggregate progress across all enrolled students. Teachers would see a live dashboard showing student activity as it happens — who's online, who just completed an item, who's struggling (low scores + high attempts). This would use DO-to-DO communication or a fan-out pattern from the enrolment DOs.

### Offline Progress Queue

For environments with unreliable connectivity (schools in rural areas, developing regions), the frontend could queue xAPI events in IndexedDB and batch-send them when connectivity returns. The DO's idempotent design (upsert based on courseItemId) means duplicate events from retries are safe.

---

## Decision Log

| Decision | Rationale |
|----------|-----------|
| One DO per enrolment (not per user, not per course) | Matches `progress_records` unique constraint. Prevents cross-course progress bleed. Keeps DO state small and focused. |
| 10-second alarm interval | Balances real-time student UX with reasonable sync frequency. Configurable — can reduce to 5s if needed. |
| PostgreSQL remains source of truth for reporting | Teacher dashboards need aggregation queries across all students. DOs are per-enrolment, not designed for cross-student queries. |
| DO storage as immediate persistence, PostgreSQL as durable store | DO storage survives restarts but is not a traditional database. PostgreSQL provides ACID guarantees, backup, and disaster recovery. |
| Internal API key auth for backend ↔ Worker communication | Simpler than mTLS for internal service communication. Rotate via Wrangler secrets. |
| Phase 3 first, Phase 4 as optimisation | Validates the data model and business logic before adding infrastructure complexity. Phase 4 is additive — schema and teacher dashboards don't change. |

---

## Open Questions

1. **Alarm interval**: 10 seconds is a reasonable default. Should this be configurable per-org (enterprise customers wanting near-real-time teacher dashboards)?
2. **DO eviction policy**: Cloudflare evicts idle DOs after ~60 seconds. For students who pause for 5 minutes between items, every `recordEvent` call will trigger a cold start (~100ms). Is this acceptable, or should we implement a keep-alive ping?
3. **Storage costs**: DO storage is billed per GB-month. With one DO per enrolment, a course with 500 students = 500 DOs each storing a small progress map. Estimate storage per DO to validate cost assumptions.
4. **Batch xAPI endpoint**: Should the Worker support a `/xapi/batch` endpoint for the `sendBeacon` path, accepting multiple events in one request? Recommend yes — minimal implementation cost, significant reliability improvement.
5. **Progress divergence monitoring**: How aggressively should we check DO ↔ PostgreSQL consistency? A nightly reconciliation job, or real-time comparison on every sync?
