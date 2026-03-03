# Feature Investigation: Content Aliases & Save Content State

**Status:** Research / Decision needed
**Date:** 2026-03-03

---

## 1. Content Aliases (Shared/Reusable Content)

### What Moodle Does

In Moodle, an H5P content alias is a shortcut to a master H5P file in the Content Bank. When added to a course as an alias, updates to the original file propagate to all courses using it. This avoids content duplication and ensures consistency across an organisation.

### Current LeapLearn Architecture

**We already support this pattern — no schema changes needed.**

The existing `course_items.content_id` is a nullable FK to `h5p_content.id`. Multiple course items across different courses can reference the same `content_id`. Editing the H5P content in the content bank updates it everywhere it's used — this IS the alias behaviour.

```
h5p_content (id: abc-123, title: "Cell Biology Quiz")
    ├── course_items row in "Biology 101"  (content_id → abc-123)
    ├── course_items row in "Science Intro" (content_id → abc-123)
    └── course_items row in "Revision Pack" (content_id → abc-123)
```

No alias table, sync mechanism, or duplicate storage needed.

### What Needs Building

#### A. Content Picker in Course Editor

Currently course items are created with new content. Add a "Link existing content" flow:

1. Button in course editor: "Add existing content"
2. Modal shows org's H5P content bank (searchable, filterable by content type)
3. Selecting content creates a `course_item` with `content_id` pointing to the existing record
4. Title can be overridden per course item or inherited from the content

#### B. Usage Tracking

Admins editing shared content need to know the blast radius:

- "Used in X courses" badge on content items in the content bank
- Confirmation dialog when editing: "This content is used in 3 courses. Changes will affect all of them."
- Query: `SELECT COUNT(DISTINCT course_id) FROM course_items WHERE content_id = $1 AND removed_at IS NULL`

#### C. Copy vs Link Option

Some orgs may want to fork content for a specific course (independent copy) vs link to the shared original:

- "Link" = share `content_id` (alias behaviour, updates propagate)
- "Copy" = duplicate `h5p_content` row + content files in R2, new `content_id` (independent)
- UI: toggle or dropdown when adding existing content to a course

### Progress Tracking Caveat

**Current behaviour:** `progress_records` has a UNIQUE constraint on `(enrolment_id, content_id)`. If the same content appears twice in one course, completing it once marks both course items as complete.

**Phase 4 fix:** The Durable Objects spec already plans to track progress per `course_item_id` instead of per `content_id`, which resolves this. The `EnrolmentProgressObject` uses `courseItemId` as the map key.

**Decision needed:** Is the current per-content progress acceptable until Phase 4, or does this need addressing sooner?

### Implementation Estimate

| Task | Effort |
|------|--------|
| Content picker modal + search | ~4h |
| Usage count query + badge | ~1h |
| "Edit affects N courses" warning | ~1h |
| Copy vs Link toggle | ~3h (includes R2 file duplication) |
| **Total** | **~9h** |

No migration required. No schema changes. Pure UI + one new remote function for content duplication.

---

## 2. Save Content State (Resume Progress)

### The Problem

xAPI tracks learning events (answered, scored, completed) but does NOT save the user's in-progress state within an activity. Without content state saving:

- A learner halfway through a 50-question quiz who closes the tab loses all progress
- Interactive Videos don't remember the playback position
- Course Presentations don't remember which slide the user was on
- Drag and Drop activities reset completely

This makes xAPI progress tracking feel broken from the learner's perspective — the system says "in progress" but the activity starts from scratch.

### How H5P Content State Works

H5P core has built-in support for saving/restoring user state. The host platform must:

1. **Provide two endpoints** for state CRUD
2. **Set `contentUserStateSaveInterval`** in the H5P integration config (typically 10 seconds)
3. **Preload state on content init** so the content type can restore from saved state

#### API Contract

```
GET  /content-user-data/:contentId/:dataType/:subContentId
POST /content-user-data/:contentId/:dataType/:subContentId
```

- `contentId` — the H5P content UUID
- `dataType` — typically `"state"` (could also be `"resume"` for some types)
- `subContentId` — `"0"` for the main content, or a sub-content ID for compound types (e.g., individual slides in a Course Presentation)

**GET** returns previously saved state JSON (or empty if none).
**POST** receives `{ data: <serialized JSON>, preload: 0|1, invalidate: 0|1 }`.

#### Client-Side Behaviour

1. On content init, H5P core fetches saved state for all sub-contents
2. State is passed to the content type's constructor — the content type renders with previous answers pre-filled
3. Every `contentUserStateSaveInterval` ms, H5P core asks the content type to serialize its current state
4. Serialized state is POSTed to the host platform
5. On explicit "retry" or "show solution", some content types invalidate saved state

#### Integration Config

The Go embed player must include this in the `H5PIntegration` object:

```javascript
H5PIntegration.saveFreq = 10; // seconds (false to disable)
H5PIntegration.user = { name: "...", mail: "..." };
H5PIntegration.ajax = {
    contentUserData: "/api/h5p/content-user-data/:contentId/:dataType/:subContentId"
};
```

### Content Type Support

Most popular content types support state save:

| Content Type | State Save | Notes |
|-------------|-----------|-------|
| Quiz (Question Set) | Yes | Saves answered questions, restores on reload |
| Interactive Video | Yes | Saves playback position and answered interactions |
| Course Presentation | Yes | Saves current slide position |
| Drag and Drop | Partial | Saves placed items, but "check" resets state |
| Fill in the Blanks | Yes | Saves entered text |
| Mark the Words | Yes | Saves selected words |
| Multiple Choice | Yes | Saves selected answers |
| True/False | Yes | Saves selected answer |
| Essay | Yes | Saves entered text |
| Column | Yes | Saves state of all sub-contents |

Not all content types fully restore state (e.g., some don't restore after "check" is pressed). This is an H5P content type limitation, not a platform issue.

### Storage Options

#### Option A: PostgreSQL (Simple, Pre-Phase 4)

New table + Go endpoints. Works immediately, no Cloudflare dependency.

```sql
CREATE TABLE IF NOT EXISTS h5p_content_user_state (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    content_id UUID NOT NULL REFERENCES h5p_content(id) ON DELETE CASCADE,
    sub_content_id TEXT NOT NULL DEFAULT '0',
    data_type TEXT NOT NULL DEFAULT 'state',
    data JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, content_id, sub_content_id, data_type)
);

CREATE INDEX IF NOT EXISTS h5p_content_user_state_lookup_idx
    ON h5p_content_user_state(user_id, content_id);
```

**Go endpoints (~80 lines):**

```go
// GET /api/v1/h5p/content-user-data/{contentId}/{dataType}/{subContentId}
func (h *Handler) handleGetContentUserData(w http.ResponseWriter, r *http.Request) {
    userID := getUserID(r)
    contentID := chi.URLParam(r, "contentId")
    dataType := chi.URLParam(r, "dataType")
    subContentID := chi.URLParam(r, "subContentId")

    state, err := h.queries.GetContentUserState(r.Context(), GetContentUserStateParams{
        UserID:       userID,
        ContentID:    contentID,
        DataType:     dataType,
        SubContentID: subContentID,
    })
    if err != nil {
        // No state found — return empty success
        json.NewEncoder(w).Encode(map[string]any{"success": true, "data": nil})
        return
    }
    json.NewEncoder(w).Encode(map[string]any{"success": true, "data": state.Data})
}

// POST /api/v1/h5p/content-user-data/{contentId}/{dataType}/{subContentId}
func (h *Handler) handleSetContentUserData(w http.ResponseWriter, r *http.Request) {
    userID := getUserID(r)
    contentID := chi.URLParam(r, "contentId")
    dataType := chi.URLParam(r, "dataType")
    subContentID := chi.URLParam(r, "subContentId")

    var body struct {
        Data       json.RawMessage `json:"data"`
        Preload    int             `json:"preload"`
        Invalidate int             `json:"invalidate"`
    }
    json.NewDecoder(r.Body).Decode(&body)

    if body.Invalidate == 1 {
        h.queries.DeleteContentUserState(r.Context(), DeleteContentUserStateParams{
            UserID: userID, ContentID: contentID, DataType: dataType, SubContentID: subContentID,
        })
    } else {
        h.queries.UpsertContentUserState(r.Context(), UpsertContentUserStateParams{
            UserID: userID, ContentID: contentID, DataType: dataType,
            SubContentID: subContentID, Data: body.Data,
        })
    }
    json.NewEncoder(w).Encode(map[string]any{"success": true})
}
```

**Pros:** Simple, works now, no infrastructure changes.
**Cons:** Adds DB writes every 10 seconds per active learner. At 100 concurrent learners, that's 600 writes/min. Acceptable for early scale but becomes the same write amplification problem Phase 4 solves for xAPI.

#### Option B: Durable Objects (Phase 4)

Store content state in the `EnrolmentProgressObject` alongside xAPI progress.

```typescript
// Add to EnrolmentProgressObject state
private contentState: Map<string, Map<string, string>>;
// Key: `${contentId}:${subContentId}:${dataType}` → serialized JSON

async handleContentUserData(request: Request): Promise<Response> {
    const { contentId, dataType, subContentId } = parseParams(request);
    const key = `${contentId}:${subContentId}:${dataType}`;

    if (request.method === 'GET') {
        const data = this.contentState.get(key) || null;
        return Response.json({ success: true, data });
    }

    // POST
    const { data, invalidate } = await request.json();
    if (invalidate) {
        this.contentState.delete(key);
    } else {
        this.contentState.set(key, data);
    }
    await this.ctx.storage.put('contentState', Object.fromEntries(this.contentState));
    return Response.json({ success: true });
}
```

**Pros:** Zero DB writes during interaction, state persisted in DO storage, batched to PG on alarm sync. Scales effortlessly.
**Cons:** Requires Phase 4 infrastructure (Cloudflare Worker + Durable Objects).

#### Recommended Approach

**Build Option A now, migrate to Option B in Phase 4.**

- Option A is ~4h of work and gives learners immediate state save
- The DB write load is acceptable at current scale
- The Go endpoints and H5P integration config work identically regardless of backend — migrating to DO later is just a routing change (SvelteKit proxy points to Worker instead of Go)
- The table serves as the durable store that Phase 4's DO syncs to anyway

### State Scope Decision

| Scope | Behaviour | Use Case |
|-------|-----------|----------|
| **Per-user, per-content** (global) | Same state regardless of which course | Content bank / standalone practice |
| **Per-enrolment** | Fresh state for each course containing the content | Formal assessments, separate attempts per course |

**Recommendation:** Start with per-user, per-content (Option A table design above). This is simpler and matches what Moodle/WordPress do. Phase 4 can add per-enrolment scoping via the DO's enrolment-scoped identity.

### Implementation Estimate (Option A)

| Task | Effort |
|------|--------|
| Migration: `h5p_content_user_state` table | ~30min |
| SQLC queries (get, upsert, delete) | ~30min |
| Go endpoints (GET + POST) | ~2h |
| Update `h5p_play_route.go` — add `saveFreq` + `ajax.contentUserData` to H5PIntegration | ~1h |
| SvelteKit proxy route for `/api/h5p/content-user-data/[...path]` | ~30min |
| Test with Quiz, Interactive Video, Course Presentation | ~1h |
| **Total** | **~5.5h** |

---

## Decisions (Resolved 2026-03-03)

### Q1: Per-item or per-content progress?
**Decision:** Accept per-content tracking for now. Fix in Phase 4.

Same content appearing twice in one course is an edge case. When it happens, "completing one marks both done" is arguably correct (same quiz = same knowledge). Phase 4's `EnrolmentProgressObject` already plans to use `courseItemId` as the map key, which resolves this properly without a schema migration now.

→ **Phase 4 link:** Per-courseItemId tracking in `EnrolmentProgressObject`. When implemented, add `course_item_id` to `progress_records` and update the unique constraint from `(enrolment_id, content_id)` to `(enrolment_id, course_item_id)`.

### Q2: Save state — build now (PG) or wait for Phase 4 (DO)?
**Decision:** Build Option A (PostgreSQL + Go endpoints) now.

State save is table stakes for a usable LMS — learners losing quiz progress kills adoption. The PG table becomes the durable store that Phase 4's DO syncs to anyway. Migration path: swap the SvelteKit proxy route from Go to Cloudflare Worker later. The Go endpoint API contract and H5PIntegration config are identical regardless of backend.

→ **Phase 4 link:** The `h5p_content_user_state` table remains as the persistent store. The DO adds an in-memory cache layer (`contentState: Map<string, string>`) that batches writes to PG via alarm sync, eliminating per-interaction DB load.

### Q3: State scope — global or per-enrolment?
**Decision:** Per-user, per-content (global) for now.

Matches Moodle and WordPress H5P behaviour. Simpler schema (no enrolment FK needed). Covers the primary use case: learner resumes where they left off regardless of which course.

→ **Future feature:** Per-enrolment scoping. When Phase 4's DO identity model is in place, state can be scoped to `enrolmentId` for formal assessments where fresh attempts per course are required. This would mean the DO stores state keyed by `enrolmentId:contentId:subContentId:dataType` instead of `userId:contentId:subContentId:dataType`. The PG table would need an optional `enrolment_id` column added at that point.

### Q4: Content type verification
**Decision:** Verified — all primary types support state save.

Quiz (Question Set), Interactive Video, Course Presentation, Multiple Choice, True/False, Fill in the Blanks, Essay, Column, Mark the Words all support state save. Drag and Drop partially resets after "check" — this is an H5P content type limitation, not a platform issue. Quick manual test recommended after implementation.

### Q5: Copy vs Link for v1?
**Decision:** Link only for v1. Defer copy/duplicate.

Copy requires duplicating content files in R2 (potentially hundreds of MB), building a progress-fork mechanism, and handling divergence. Link-only covers the primary alias use case.

→ **Future feature:** "Duplicate content" as a standalone action in the content bank (not coupled to the course editor). When built, this would: create a new `h5p_content` row, copy all R2 files to a new content ID path, and return a fully independent content item. Consider adding this alongside the SVAR File Manager content library page.

### Content picker approach
**Decision:** Lightweight searchable modal, not SVAR File Manager.

The alias picker is a focused component: show org's H5P content, search/filter by title and content type, select one. This is a simple modal, not a file management UI. SVAR File Manager is better suited for a dedicated content bank/library page (future feature) where admins manage all H5P content, uploads, and media assets. Building the picker as a lightweight modal avoids blocking on the larger file manager decision.

→ **Future feature:** SVAR File Manager integration for a full content library page with tree navigation, drag-drop, multi-select, bulk operations. The alias picker modal can be retrofitted to use SVAR's selection API when the content library page is built.
