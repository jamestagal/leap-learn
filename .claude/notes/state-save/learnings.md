# Save Content State — Learnings

## Architecture: Go/PG Now, Durable Objects Later

Decision: Build PostgreSQL-backed Go endpoints (Option A) now. Migrate to Durable Objects in Phase 4.

### Why PG first
- ~5.5h of work, gives learners immediate state resume
- DB write load (600 writes/min at 100 concurrent learners) is acceptable at current scale
- The `h5p_content_user_state` table becomes the persistent store that Phase 4's DO syncs to

### Migration path to Phase 4
- Go endpoints serve GET/POST for content-user-data
- SvelteKit proxy at `/api/h5p/content-user-data/[...path]` forwards to Go
- When Phase 4 lands: change SvelteKit proxy to forward to Cloudflare Worker instead
- Worker's DO stores state in-memory, batches writes to same PG table via alarm sync
- API contract (endpoint paths, request/response shape) stays identical

## State Scope: Global (Per-User, Per-Content)

Decision: per-user, per-content scope. Matches Moodle/WordPress behaviour. No enrolment FK needed in the table.

### Phase 4 expansion: Per-enrolment scoping
When Phase 4's DO identity model is in place, state can be scoped to enrolmentId for formal assessments (fresh attempts per course). Implementation:
- DO key changes from `contentId:subContentId:dataType` to `enrolmentId:contentId:subContentId:dataType`
- PG table gets optional `enrolment_id UUID REFERENCES enrolments(id)` column
- Existing global state (enrolment_id = NULL) continues to work as default

## H5PIntegration Config

Must add to Go embed handler (`h5p_play_route.go`):
```javascript
H5PIntegration.saveFreq = 10; // seconds (false to disable)
H5PIntegration.user = { name: "...", mail: "..." };
H5PIntegration.ajax = {
    contentUserData: "/api/h5p/content-user-data/:contentId/:dataType/:subContentId"
};
```

## Save Timing (h5p.js)

H5P core has two save triggers:
- **Auto-save timer**: fires every `saveFreq` seconds (10s). Calls `instance.getCurrentState()` and POSTs if state changed.
- **xAPI event save**: on `completed` or `progressed` verbs, cancels the timer and saves after **3 seconds** (h5p.js line 247-248).
- **No beforeunload save**: H5P does NOT save on page unload. If the user navigates away within 3s of answering, state may be lost.

Practical testing: answer a question, wait 3-5 seconds, then navigate away.

## Content Type Support

All primary types support state save: Quiz, Interactive Video, Course Presentation, Multiple Choice, True/False, Fill in the Blanks, Essay, Column, Mark the Words. Drag and Drop partially resets after "check" (H5P limitation, not platform issue).
