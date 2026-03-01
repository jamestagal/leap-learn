# Phase 3 — Courses & Progress Tracking

**Status:** Planning
**Target:** Weeks 5–6 of migration timeline
**Prerequisites:** Phase 2 complete (H5P authoring + playback working)
**Related:** [Library Tiers & Custom Content Types](../leap-planning/feature-spec-library-tiers.md) — super-admin library management, community/custom library tiers (separate spec)

---

## Scope

This plan covers course creation, the student learning experience, enrolment, xAPI-based progress tracking, and the permission/navigation changes to support them.

It does **not** cover super-admin H5P library management or the three-tier library model (official / community / custom). Those are specified separately in `feature-spec-library-tiers.md` and can be implemented in parallel.

---

## What already exists

### Database (ready — no migrations needed)

All tables exist in both Go `schema_postgres.sql` and Drizzle `schema.ts`:

| Table | Key columns | Status |
|---|---|---|
| `courses` | org_id, title, slug, status (draft/published/archived), cover_image | ✅ |
| `course_items` | course_id, content_id (→ h5p_content), sort_order, item_type (h5p/text/video/link) | ✅ |
| `enrolments` | org_id, course_id, user_id, status (active/completed/withdrawn) | ✅ |
| `progress_records` | enrolment_id, content_id, user_id, score, max_score, completion, completed, attempts, time_spent | ✅ |
| `xapi_statements` | org_id, user_id, content_id, verb, statement (jsonb) | ✅ |

Drizzle types exported: `Course`, `CourseItem`, `Enrolment`, `ProgressRecord`, `XapiStatement` + Insert variants.

### Frontend components (partially built)

| Component | Location | Status |
|---|---|---|
| `CourseCard.svelte` | `lib/components/courses/` | Exists — needs review + wiring |
| `CourseManager.svelte` | `lib/components/courses/` | Exists — needs review + wiring |
| `CourseStructureEditor.svelte` | `lib/components/courses/` | Exists — needs review + wiring |
| `LearningPlayer.svelte` | `lib/components/learning/` | Exists — needs review + wiring |

### What does NOT exist yet

- Course routes (`/[organisationSlug]/courses/*`, `/[organisationSlug]/learn/*`)
- Course remote functions (`courses.remote.ts`, `enrolments.remote.ts`)
- xAPI capture endpoint (Go + SvelteKit proxy)
- Progress tracking wiring (H5PPlayer → xAPI → progress_records)

---

## Step 1: Course Remote Functions

Create `service-client/src/lib/api/courses.remote.ts`:

```
getCourses(filters?)        → query   — list org courses with item counts
getCourse(courseId)          → query   — single course with items + content details
createCourse(data)          → command — title, description, cover_image
updateCourse(data)          → command — title, description, status, cover_image
deleteCourse(courseId)       → command — soft delete (set deleted_at)
reorderCourseItems(data)    → command — [{id, sortOrder}] batch update
addCourseItem(data)         → command — course_id, content_id, item_type, title
removeCourseItem(itemId)    → command — soft delete (set removed_at timestamp)
updateCourseItem(data)      → command — title, item_type
publishCourse(courseId)     → command — set status='published', validate has ≥1 item
```

Key patterns:
- All queries use `withOrganisationScope()`
- `getCourse` joins `course_items` → `h5p_content` → `h5p_libraries` for content type info
- `publishCourse` validates: at least 1 item, all linked H5P content is published
- Slug auto-generated from title via `slugify()`, uniqueness enforced by DB constraint

---

## Step 2: Enrolment & Progress Remote Functions

Create `service-client/src/lib/api/enrolments.remote.ts`:

```
enrolInCourse(courseId)          → command — create enrolment, init progress_records for each item
withdrawFromCourse(courseId)     → command — set status='withdrawn'
getMyEnrolments(filters?)       → query   — current user's enrolments with course info + progress summary
getCourseEnrolments(courseId)    → query   — all enrolments for a course (teacher/admin view)
getMyProgress(courseId)          → query   — detailed per-item progress for current user
getCourseProgress(courseId)      → query   — aggregated progress for all learners (teacher view)
```

### Enrolment flow

1. `enrolInCourse` → insert `enrolments` row (status=active)
2. **No progress_records pre-initialisation.** Progress rows are created lazily — on first xAPI event for H5P items, or on first view for text/video/link items. This avoids the race condition where a teacher adds items after students enrol.
3. Return enrolment with progress summary

### Non-H5P item progress

All item types participate in completion tracking:

- **H5P items**: progress created/updated via xAPI events (scored, completed, etc.)
- **Text/link items**: marked complete automatically on first view — the learning player sends an "experienced" event when the student navigates to the item
- **Video items**: marked complete on first view (Phase 3). Phase 4 can add duration-based tracking.

This keeps completion math clean: a course with 5 items (3 H5P + 1 text + 1 video) is 100% complete when all 5 are done, not just 3/3 H5P items.

### Progress aggregation queries

**Important:** Total items comes from `course_items` (the source of truth), NOT from `progress_records` count. This handles items added after enrolment — missing progress rows are treated as "not started."

**Per-learner course progress:**
```sql
SELECT
    e.id, e.status, e.enrolled_at, e.completed_at,
    (SELECT COUNT(*) FROM course_items ci
     WHERE ci.course_id = e.course_id AND ci.removed_at IS NULL) as total_items,
    COUNT(pr.id) FILTER (WHERE pr.completed) as completed_items,
    SUM(pr.time_spent) as total_time
FROM enrolments e
LEFT JOIN progress_records pr ON pr.enrolment_id = e.id
WHERE e.course_id = $1 AND e.user_id = $2
GROUP BY e.id
```

**Course-wide dashboard (teacher view):**
```sql
SELECT
    u.email, u.avatar,
    e.enrolled_at, e.status,
    COUNT(pr.id) FILTER (WHERE pr.completed) as completed_items,
    (SELECT COUNT(*) FROM course_items ci
     WHERE ci.course_id = e.course_id AND ci.removed_at IS NULL) as total_items,
    AVG(pr.score) FILTER (WHERE pr.score IS NOT NULL) as avg_score,
    SUM(pr.time_spent) as total_time
FROM enrolments e
JOIN users u ON u.id = e.user_id
LEFT JOIN progress_records pr ON pr.enrolment_id = e.id
WHERE e.course_id = $1
GROUP BY u.id, e.id
ORDER BY e.enrolled_at DESC
```

**Note on `enrolment_id` scoping:** The `progress_records` table has both `enrolment_id` and `user_id` (denormalised). Always query through `enrolment_id` to avoid cross-course progress bleed if the same H5P content appears in multiple courses. The unique constraint is on `(enrolment_id, content_id)`, not `(user_id, content_id)`.

---

## Step 3: xAPI Capture Endpoint

### 3.1 Go REST endpoint

Create handler in `app/service-core/rest/xapi_route.go`:

```
POST /api/v1/h5p/xapi    (authenticated)
```

Request body:
```json
{
    "contentId": "uuid",
    "verb": "completed",
    "statement": { /* raw xAPI statement from H5P */ }
}
```

Handler logic:
1. Parse JWT → extract user_id
2. Validate content_id exists in `h5p_content`
3. Look up org_id from content
4. **Verify user is an org member** (permissive check — don't require active enrolment, since content can be played from the content library outside of course context)
5. Insert into `xapi_statements` (append-only)
6. If verb is `completed` or `scored` → UPSERT `progress_records` (create if missing — lazy initialisation):
   - `completed = true` if verb is `completed`
   - `score`, `max_score` from statement result
   - `attempts += 1`
   - `time_spent += duration` from statement
   - `completion = 1.0` if completed
7. Check if all active course_items in enrolment are completed → if yes, set `enrolments.status='completed'`, `completed_at=now()`

### 3.2 SvelteKit proxy route

Already handled — the existing H5P proxy at `service-client/src/routes/api/h5p/[...path]/+server.ts` forwards `/api/h5p/xapi` to `/api/v1/h5p/xapi` automatically.

### 3.3 H5PPlayer xAPI integration

The existing `H5PPlayer.svelte` (or `LearningPlayer.svelte`) needs a `message` event listener on the h5p-standalone iframe:

```typescript
// Client-side xAPI buffer for retry on failure
let pendingStatements: Array<{contentId: string, verb: string, statement: object}> = [];

window.addEventListener('message', (event) => {
    if (event.data?.context === 'h5p' && event.data?.statement) {
        const verb = event.data.statement.verb?.display?.['en-US']
            || event.data.statement.verb?.id?.split('/').pop();

        const payload = { contentId, verb, statement: event.data.statement };
        sendXapiStatement(payload);
    }
});

async function sendXapiStatement(payload) {
    try {
        const res = await fetch('/api/h5p/xapi', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error(res.statusText);
        // Flush any previously failed statements
        retryPending();
    } catch {
        pendingStatements.push(payload);
    }
}

async function retryPending() {
    const batch = [...pendingStatements];
    pendingStatements = [];
    for (const stmt of batch) {
        try {
            await fetch('/api/h5p/xapi', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(stmt)
            });
        } catch {
            pendingStatements.push(stmt);
        }
    }
}

// sendBeacon fallback — flush pending statements on tab close
window.addEventListener('beforeunload', () => {
    for (const stmt of pendingStatements) {
        navigator.sendBeacon('/api/h5p/xapi', JSON.stringify(stmt));
    }
});
```

**Reliability:** The buffer + `sendBeacon` fallback prevents the most common data loss scenario (learner closes tab after completing a quiz but before the POST succeeds). This is not a full offline queue — just an in-memory retry buffer that gets flushed via beacon on unload.

Key verbs to handle: `attempted`, `answered`, `completed`, `scored`, `experienced`, `interacted`.

---

## Step 4: Course Routes (Teacher/Admin)

### Route structure

```
service-client/src/routes/(app)/[organisationSlug]/
├── courses/
│   ├── +page.svelte              # Course listing (grid of CourseCards)
│   ├── +page.server.ts           # Load courses
│   ├── new/
│   │   └── +page.svelte          # Create course form
│   ├── [courseId]/
│   │   ├── +page.svelte          # Course detail — structure, enrollees, stats
│   │   ├── +page.server.ts       # Load course + items + enrolments
│   │   └── edit/
│   │       └── +page.svelte      # CourseStructureEditor — drag/drop items
```

### 4.1 Course listing (`/courses`)

- Grid of `CourseCard` components
- Filter by status: All / Draft / Published / Archived
- Search by title
- "New Course" button → `/courses/new`
- Each card shows: title, description excerpt, cover image, item count, enrolment count, status badge

### 4.2 Create course (`/courses/new`)

Simple form:
- Title (required)
- Description (textarea)
- Cover image upload (optional — use file provider)
- On create → redirect to `/courses/[courseId]/edit`

### 4.3 Course detail (`/courses/[courseId]`)

Tabbed view:
- **Content** tab: ordered list of items with drag-to-reorder, "Add content" button, item type icons
- **Learners** tab: enrolment list with progress bars, scores, time spent (teacher dashboard)
- **Settings** tab: title, description, cover image, status toggle, delete

### 4.4 Course builder (`/courses/[courseId]/edit`)

Uses `CourseStructureEditor.svelte` (already exists). Wire to remote functions:
- Load course items via `getCourse(courseId)`
- Drag to reorder → `reorderCourseItems()`
- Remove item → confirm dialog → `removeCourseItem()` (soft delete — sets `removed_at`, keeps progress history)
- Publish button → `publishCourse()` with validation feedback

#### Content picker modal ("Add Item")

Triggered by "Add Content" button. DaisyUI modal with tabs:

- **H5P Content tab** (default): searchable grid of the org's published H5P content. Shows title, content type icon, thumbnail. Click to add → `addCourseItem({ itemType: 'h5p', contentId })`. No preview — teacher already knows their content from the content library.
- **Text tab**: title input + simple textarea (plain text/basic markdown for Phase 3). Saved as a course item with `itemType: 'text'` and body stored in a `body_markdown` TEXT column on `course_items`. Rendered client-side with `marked` or similar. Column named `body_markdown` (not `body` or `text_content`) to self-document that it contains markdown.
- **Video/link items**: Deferred to Phase 4. Phase 3 focuses on H5P + text items only. This simplifies the builder significantly while covering the core use case (interactive H5P content structured into courses with text instructions between activities).

#### Course status state machine

```
draft → published → archived
  ↑         ↓
  └── (unpublish back to draft)
```

- **draft → published**: requires ≥1 active item, all H5P content published. Sets `published_at`.
- **published → draft** (unpublish): allowed. Existing enrolments remain active, enrolled students keep access. No new enrolments while in draft.
- **published → archived**: allowed. Enrolled students can still view progress and revisit content (read-only). No new enrolments. No edits allowed.
- **archived → draft**: allowed (re-activate). Clears `archived_at`.
- **draft → archived**: not allowed (must publish first).

#### Course settings (Settings tab)

Phase 3 settings exposed in the Settings tab:

| Setting | Type | Default | Description |
|---|---|---|---|
| Title | text | required | Course display name |
| Description | textarea | optional | Course overview text |
| Cover image | file upload | placeholder | Reuses existing R2 upload flow. R2 path: `course-assets/{org_id}/{course_id}/cover.{ext}`. Max 2MB. No crop/resize — rendered with `object-fit: cover`. Default: auto-generated gradient with first letter (like org avatars). If upload flow is tightly coupled to branding, extract generic upload utility first. |
| Status | select | draft | draft / published / archived (state machine above) |
| Delete | danger button | — | Soft delete with confirmation dialog |

Deferred to Phase 4: `is_self_paced`, `require_sequential`, `passing_score`, `max_attempts`, `certificate_enabled`. Schema columns for these may already exist — they're not exposed in the UI yet.

---

## Step 5: Learning Routes (Student)

### Route structure

```
service-client/src/routes/(app)/[organisationSlug]/
├── learn/
│   ├── +page.svelte              # My learning dashboard — enrolled courses
│   ├── +page.server.ts           # Load enrolments + progress
│   └── [courseId]/
│       ├── +page.svelte          # Course overview — item list + progress
│       ├── +page.server.ts       # Load course + my progress
│       └── [itemId]/
│           └── +page.svelte      # Learning player — H5P content in context
```

### 5.1 My learning dashboard (`/learn`)

- List of enrolled courses as cards
- Each card: course title, overall progress bar (% complete), time spent, continue button
- **Default sort**: most recently active first (last progress update timestamp). Completed courses sort to the bottom.
- "Browse courses" link → `/courses` (published courses in this org)
- **Archived courses**: still visible to enrolled students with an "Archived" badge. Content remains accessible read-only. No "Enrol" button for archived courses.

### 5.2 Course overview (`/learn/[courseId]`)

- Course header: title, description, progress ring
- Ordered item list with per-item completion status (completed / in-progress / not started)
- Score shown where applicable
- Click item → `/learn/[courseId]/[itemId]`
- "Enrol" button if not enrolled, "Continue" button if enrolled

### 5.3 Learning player (`/learn/[courseId]/[itemId]`)

- Previous / Next navigation between course items
- Course progress sidebar (collapsible on mobile)
- H5P content rendered via `LearningPlayer.svelte` / `H5PPlayer.svelte`
- xAPI events captured automatically (Step 3)
- On completion → auto-advance to next item (optional, configurable)
- Text/video/link items render inline

---

## Step 6: Permissions & Access Control

### Course permissions (extend existing permission matrix)

**Naming note:** "Member" in this matrix corresponds to the learner role in the UI. Members ARE learners — there is no separate student/learner role. Learners are unlimited for free/starter/growth tiers (only enterprise may set a cap). The primary tier limit is `maxCourses`, enforced on course creation.

| Action | Owner | Admin | Member (= Learner) |
|---|---|---|---|
| Create course | ✅ | ✅ | ❌ |
| Edit own course | ✅ | ✅ | ❌ |
| Edit any course | ✅ | ✅ | ❌ |
| Delete course | ✅ | ✅ | ❌ |
| Publish course | ✅ | ✅ | ❌ |
| View course learners | ✅ | ✅ | ❌ |
| Enrol in course | ✅ | ✅ | ✅ |
| View own progress | ✅ | ✅ | ✅ |

Update `service-client/src/lib/server/permissions.ts` to add `course:create`, `course:edit`, `course:delete`, `course:publish`, `course:view_learners`, `enrolment:enrol`, `enrolment:view_own` entries.

### Enrolment access control

- Only org members can enrol in that org's courses
- Course must be `status='published'` to accept enrolments (not draft, not archived)
- Self-enrolment default (Phase 4 can add invite-only courses)
- Withdrawn learners can re-enrol
- `maxCourses` tier limit checked on course creation: count courses where `deleted_at IS NULL` in the org
- `maxLearners` only checked at enrolment if the field is non-NULL (enterprise contracts only)

---

## Step 7: Navigation Updates

### Organisation sidebar

Add between "Content" and "Settings":

```
Courses        → /[orgSlug]/courses       (owner/admin only)
Learn          → /[orgSlug]/learn         (all org members)
Reports        → /[orgSlug]/reports       (already exists)
```

If user is both admin and learner, show both "Courses" and "Learn".

---

## Implementation Order

| # | Task | Est. | Dependencies |
|---|---|---|---|
| 1 | Course remote functions (`courses.remote.ts`) | 4h | Schema exists |
| 2 | Course listing + create routes | 3h | Step 1 |
| 3 | Course builder + content picker modal | 5h | Steps 1-2 |
| 4 | Enrolment remote functions (`enrolments.remote.ts`) | 3h | Schema exists |
| 5 | xAPI Go endpoint + SvelteKit proxy + auth check | 4h | Schema exists |
| 6 | xAPI capture in H5PPlayer + sendBeacon reliability | 3h | Step 5 |
| 7 | Learning dashboard + course overview routes | 4h | Steps 4, 6 |
| 8 | Learning player route (H5P in course context) | 5h | Step 7 |
| 9 | Course detail — learner progress tab | 3h | Steps 4, 8 |
| 10 | Permissions, tier limits + navigation updates | 3h | All above |
| 11 | Integration buffer (component rewiring, edge cases) | 4h | All above |
| **Total** | | **~41h (5 days)** | |

**Note on estimate:** Bumped from original 31h. Step 8 (learning player) is the most integration-heavy screen — combines H5P iframe rendering, xAPI event capture, navigation state, and progress sidebar. The 4h buffer in step 11 accounts for LEAP component rewiring and the archived/unpublished course edge cases.

### Parallelization Plan (Agent Teams)

Three independent dependency chains allow parallel execution:

```
Chain A (Course CRUD):     1 → 2 → 3
Chain B (Enrolment):       4 (standalone)
Chain C (xAPI):            5 → 6
                              ↘
                           7 → 8 → 9  (merges B + C)
                                        ↘
                                      10 → 11 (merges all)
```

**Parallelized waves:**

| Wave | Agents | Steps | Wall-clock |
|------|--------|-------|------------|
| 1 | 3 parallel | **Step 1** (course remote fns) + **Step 4** (enrolment remote fns) + **Step 5** (xAPI Go endpoint) | ~4h |
| 2 | 2 parallel | **Step 2** (course routes) + **Step 6** (xAPI capture in H5PPlayer) | ~3h |
| 3 | 2 parallel | **Step 3** (course builder + content picker) + **Step 7** (learning dashboard) | ~5h |
| 4 | sequential | **Step 8** (learning player) | 5h |
| 5 | sequential | **Step 9** (learner progress tab) | 3h |
| 6 | sequential | **Steps 10+11** (permissions + integration) | 7h |

**Timeline: ~27h wall-clock (~3.5 days) vs 41h sequential (5 days).**

Wave 1 is the biggest win — the three remote function / endpoint files have zero code overlap and only depend on the existing schema. Waves 2–3 parallelize because course CRUD UI and xAPI/learning paths don't touch the same files. Steps 8–11 are sequential because the learning player depends on everything upstream.

### Component Strategy

**Approach: hybrid — evaluate each LEAP component during implementation.**

The LEAP-era course components exist but were built against a different data model (MongoDB, different API patterns, Svelte 4). Decision per component:

| Component | Decision | Rationale |
|---|---|---|
| `CourseCard.svelte` | **Rewire** | Simple presentational component — just needs new props + routes |
| `CourseStructureEditor.svelte` | **Rewire** | Drag-drop logic is non-trivial to rebuild; adapt to remote functions |
| `ProgressBar.svelte` | **Keep as-is** | Already generic, works unchanged |
| `LearningPlayer.svelte` | **Rebuild** | Good layout reference but too coupled to LEAP API patterns; use as design template, build fresh with remote functions |
| `CourseManager.svelte` | **Rebuild** | LEAP-era patterns throughout; faster to build fresh following content page patterns |
| `H5PPlayer.svelte` | **Rewire** | h5p-standalone integration + xAPI scaffolding worth keeping; just fix endpoints |

**Rule of thumb:** If >60% of the component's logic needs rewriting, build fresh using the content page patterns already working in the codebase. If the hard part is already solved (drag-drop, iframe messaging), rewire it.

---

## Critical Design Decisions (Pre-Implementation)

### Decision 1: Student Identity Model

**Current state:** The membership system has three roles — `owner`, `admin`, `member`. There is NO "student" or "learner" role. Every user who joins an organisation becomes a `member` and counts against `maxMembers` tier limits.

**The problem:** If learners are org members, a free-tier org (1 member) can't have any students. Even a growth-tier org (10 members) conflates content creators with learners.

**Recommended approach — reuse `member` role, separate learner limits:**

1. **Members ARE learners.** The `member` role already exists and grants the right permissions (view own content, no admin access). No new role needed.
2. **Add `maxLearners` to subscription tiers** — separate from `maxMembers`. Admins/owners don't count against learner limits.
3. **Enrolment table already scopes learning** — `enrolments` tracks who is enrolled in what course. A member who hasn't enrolled in anything simply sees an empty `/learn` dashboard.
4. **Phase 4 can add granular roles** — e.g., `instructor` role that can create courses but isn't an admin. Keep Phase 3 simple.

**Tier model — course-based, unlimited learners:**

Learners are nearly free (reading from R2 + small xAPI writes). Capping learners penalises teachers at the moment the product is proving its value. Courses are the unit of creator investment and correlate with storage and platform value extracted.

```
free:       maxCourses=5,   maxStorageMB=2048,   maxCustomTypes=0,  aiCredits=0,    maxLearners=NULL (unlimited)
starter:    maxCourses=20,  maxStorageMB=10240,  maxCustomTypes=0,  aiCredits=50,   maxLearners=NULL (unlimited)
growth:     maxCourses=100, maxStorageMB=51200,  maxCustomTypes=10, aiCredits=200,  maxLearners=NULL (unlimited)
enterprise: negotiated (all values custom, maxLearners may be set for 10k+ deployments)
```

`maxLearners` field exists in the schema for enterprise contracts but is NULL (unlimited) for free/starter/growth. Enforcement checks `maxCourses` on course creation and only checks `maxLearners` at enrolment time if the field is set (non-NULL).

`maxCustomTypes` and `aiCredits` are forward-looking — not enforced in Phase 3 but present in the type definition for when library tiers and AI generation ship.

**Files to update:**
- `service-client/src/lib/server/subscription.ts` — replace current `TierLimits` with new model (`maxCourses`, `maxStorageMB`, `maxCustomTypes`, `aiCredits`, `maxLearners`)
- `service-client/src/lib/server/permissions.ts` — add `course:*` and `enrolment:*` permission entries

### Decision 2: Enrolment Flow (How Students Access Courses)

**Phase 3 approach (simplest):**

1. Admin/owner invites user to org → user becomes `member`
2. Member visits `/[orgSlug]/learn` → sees published courses
3. Member clicks "Enrol" on a course → self-enrolment (no approval needed)
4. All org members can see all published courses; enrolment just initialises progress tracking

**Authentication required:** Yes — students must be authenticated org members. No public/anonymous access for Phase 3. This is the right call because:
- xAPI data needs a `user_id` to track against
- Progress must be per-user
- Org-scoping requires knowing who the user is

**Phase 4 extensions (defer):**
- Public course catalog (browse without login, enrol prompts signup)
- Invite-only courses (specific member list)
- Course access codes / enrolment keys
- External LTI launch (SSO from another LMS)

### Decision 3: xAPI Data Flow (End-to-End)

The full pipeline:

```
H5P Content (iframe)
  → postMessage with xAPI statement
    → H5PPlayer.svelte captures the event
      → POST /api/h5p/xapi (SvelteKit proxy)
        → POST /api/v1/h5p/xapi (Go backend)
          → INSERT xapi_statements (append-only log)
          → UPSERT progress_records (score, completion, attempts, time_spent)
          → CHECK enrolment completeness → UPDATE enrolments.status if all items done
```

**What gets tracked per student:**
- Each H5P activity interaction (scored, completed, attempted, answered)
- Score and max score per content item
- Number of attempts
- Time spent per content item
- Overall course completion percentage
- Course completion timestamp

**Per-student visibility:**
- **Student sees:** their own progress per course item (scores, completion status, time spent) via `/learn/[courseId]`
- **Teacher/admin sees:** all enrolled students with per-student breakdowns via `/courses/[courseId]` → Learners tab
- **Aggregated course stats:** average score, completion rate, total enrolments

**Note on existing H5PPlayer.svelte:** The LEAP-era `H5PPlayer.svelte` already has xAPI tracking scaffolding (`setupTracking()`, `trackProgress()`), but it posts to `/api/private/progress/track` which doesn't exist. This needs rewiring to post to `/api/h5p/xapi` (the Go endpoint via SvelteKit proxy). The `LearningPlayer.svelte` also has progress tracking stubs that call `/api/private/courses/` and `/api/private/progress` — these need rewriting to use remote functions.

---

## Existing Component Adaptation Notes

The LEAP-era course components exist but need significant adaptation:

| Component | Issues | Effort |
|---|---|---|
| `CourseCard.svelte` | Uses `/learn/`, `/instructor/` routes that don't exist. References `course.instructors`, `course.enrolledCount`, `course.estimatedHours` — shapes from LEAP's MongoDB model. API calls to `/api/private/courses/`. Auth check is simple `currentUser.role === 'admin'` not org-scoped. | Medium — rewire props + routes |
| `CourseManager.svelte` | Likely full rewrite — LEAP-era patterns throughout | High |
| `CourseStructureEditor.svelte` | Drag-drop structure may be reusable but needs remote function wiring | Medium |
| `LearningPlayer.svelte` | Good structure (sidebar + content area), but uses mock data and LEAP API patterns. xAPI tracking calls wrong endpoints. | Medium — rewire to remote functions |
| `H5PPlayer.svelte` | Closest to working — uses h5p-standalone, has xAPI scaffolding. Needs endpoint rewire and org context. | Low |
| `ProgressBar.svelte` | Generic, works as-is | None |
| Other course components | `ContentTabs`, `LessonItem`, `ModuleSection`, `NavigationControls`, `MobileLayout`, `VideoPlayer`, `VirtualList` — review on implementation | TBD |

---

## Schema Migrations Needed

**Phase 3 migration** (new — `0XX_phase3_course_updates.sql`):

```sql
-- Soft delete for course items
ALTER TABLE course_items ADD COLUMN IF NOT EXISTS removed_at TIMESTAMPTZ;

-- Markdown body for text course items (self-documenting name — contains markdown, not HTML)
ALTER TABLE course_items ADD COLUMN IF NOT EXISTS body_markdown TEXT;

-- Published/archived timestamps for courses
ALTER TABLE courses ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
```

Check if these columns already exist in schema before writing migration — some may have been added in the architecture blueprint.

Potential future migrations (Phase 4):
- `course_settings` JSONB column for per-course config (self-enrol vs invite-only, completion certificate, etc.)
- `certificates` table if we add completion certificates
- `course_categories` / `course_tags` for discovery

---

## Decisions Made

### From feedback review (round 1)

- ✅ **Member = learner.** No separate role.
- ✅ **Store all xAPI events.** Disk is cheap, analytics value is high.
- ✅ **Progress tracks all item types.** Text/link = auto-complete on view. Video = auto-complete on view (Phase 3). H5P = xAPI-driven.
- ✅ **Soft-delete course items.** `removed_at` timestamp preserves progress history.
- ✅ **Archived courses readable.** Enrolled students keep access, no new enrolments.
- ✅ **Lazy progress init.** No pre-creation of progress_records — avoids race condition when items added after enrolment.
- ✅ **xAPI reliability.** In-memory retry buffer + `sendBeacon` on tab close.
- ✅ **xAPI auth check.** Verify user is org member (permissive — don't require enrolment since content playable outside courses).
- ✅ **Video/link items deferred to Phase 4.** Phase 3 = H5P + text only. Simplifies builder.
- ✅ **Course status state machine.** draft ↔ published → archived ↔ draft.

### From open questions review (round 2)

- ✅ **Unlimited learners for free/starter/growth.** Learners are nearly free (R2 reads + small xAPI writes). Capping learners penalises teachers at the moment the product proves its value. `maxLearners` kept in schema for enterprise contracts only (NULL = unlimited).
- ✅ **Course-based tier limits.** Courses are the unit of creator investment — correlates with storage, platform value, and creator commitment. Primary limit axis: `maxCourses`. Secondary: `maxStorageMB`. Forward-looking: `maxCustomTypes` (library tiers spec), `aiCredits` (future AI generation).
- ✅ **Tier numbers.** free=5 courses/2GB, starter=20/10GB, growth=100/50GB, enterprise=negotiated.
- ✅ **Text items: `body_markdown` TEXT column.** Self-documenting column name. Markdown rendered client-side with `marked` or similar. No JSONB — structured blocks are Phase 4+ if ever.
- ✅ **Cover image: reuse R2 upload flow.** R2 path: `course-assets/{org_id}/{course_id}/cover.{ext}`. Max 2MB, no crop/resize, `object-fit: cover` in CourseCard. Extract generic upload utility if current flow is branding-specific.

## No remaining open questions — plan is ready for implementation.