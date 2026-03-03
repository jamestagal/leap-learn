# Content Aliases — Learnings

## Schema Already Supports Aliases

No schema changes needed. `course_items.content_id` is a nullable FK to `h5p_content.id` — multiple course items can reference the same content_id. Editing the content updates it everywhere. This IS the alias behaviour.

## Content Picker = Lightweight Modal

Decision: simple searchable modal, not SVAR File Manager. The alias picker shows the org's H5P content bank (searchable, filterable by content type), user selects one, creates a `course_item` with the existing `content_id`.

SVAR File Manager is a future feature for a dedicated content library page.

## Link Only for V1

No "copy/duplicate" feature in v1. Link-only covers the primary use case. Duplicate is a future standalone action in the content bank.

## Progress Tracking Caveat

Current `progress_records` unique constraint is `(enrolment_id, content_id)`. Same content twice in one course = one completion marks both done. Accepted for now — Phase 4 fixes this with per-courseItemId tracking.

## Phase 4 Links

- **Per-courseItemId progress:** `EnrolmentProgressObject` uses `courseItemId` as map key. When Phase 4 lands, add `course_item_id` to `progress_records` table and update unique constraint.
- **SVAR File Manager:** Future content library page. The alias picker modal can be retrofitted to use SVAR's selection API.
- **Duplicate content:** Future standalone action. Requires R2 file duplication under new content ID path.
