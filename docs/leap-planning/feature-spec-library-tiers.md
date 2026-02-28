# Feature Spec: H5P Library Tiers & Custom Content Types

**Status**: Phase 3 (planned)
**Target**: leaplearn.io
**Date**: 2026-02-28

---

## Market Context

The H5P ecosystem has a distribution bottleneck. The official H5P.org hub only serves content types that have completed a lengthy review process. Dozens of high-quality community types (many by Oliver Tacke and other prolific developers) sit in "review pipeline" or "custom release" status for months or years. Some never make it to the official hub at all — they're built for specific institutions and open-sourced afterwards.

Today, the only way to use these types is to self-host a Catharsis hub server or manually upload .h5p packages to your LMS. Both require technical expertise.

LeapLearn already runs its own hub endpoints (Phase 1). This positions it to solve the distribution problem as a platform.

### Key reference

- Oliver Tacke's content types: https://www.olivertacke.de/labs/h5p-content-types/
- Catharsis hub server: https://www.olivertacke.de/labs/2025/09/25/serve-and-update-h5p-content-types-more-conveniently/
- H5P hub releases: https://h5p.org/post-hub-releases

### Content type pipeline status (as of Feb 2026)

~15 community types in various non-official states:

- **In review pipeline**: 3D Image Hotspots, Animator, Choice Explorer, Content Compiler, Discrete Option Multiple Choice, Image Choice Rounds, Jigsaw Puzzle, Phrase Randomizer, Pick the Symbols, Portfolio, Story Map, Tabs, Timekeeper, Transcript, X-ray
- **In release pipeline**: Bingo, Combination Lock, Information Wall
- **Custom release only**: Chat Simulator, Editable Medium, Editable Text, Idea Board, Idea Board Exercise
- **Awaiting notification**: Content Calendar

---

## Two-Tier Model

### Free: Official + Community Library

Every LeapLearn user gets access to:

1. **Official H5P.org content types** — the ~50+ types on the official hub
2. **LeapLearn Community Library** — curated, quality-vetted community content types not yet (or never) on the official hub

This is the core value proposition. LeapLearn becomes the easiest way to access the full H5P ecosystem without self-hosting anything.

**Curation policy**: LeapLearn team reviews and tests community types before adding them to the community library. Not a free-for-all — quality bar must be maintained. Types must be open-source, functional, and pedagogically useful.

### Paid: Org-Level Custom Library

Organisations on growth/enterprise tiers can:

1. **Upload custom .h5p content types** — proprietary types built for their specific needs
2. **Scope to their organisation** — custom types only available within their org
3. **Manage versions** — update custom types independently of the platform

**Target customers**: universities commissioning bespoke types, training companies with branded content types, agencies building for clients, enterprises with internal content types.

**Tier limits** (suggested):
- Growth: up to 10 custom content types
- Enterprise: unlimited

---

## Technical Architecture

### What already exists

| Component | Status |
|-----------|--------|
| `h5p_libraries` table with storage paths | ✅ |
| `h5p_org_libraries` table for per-org scoping | ✅ |
| Hub registry endpoint returning merged hub + local data | ✅ |
| Library install pipeline (download → extract → R2 → DB) | ✅ |
| Library upload via editor (`POST /ajax?action=library-upload`) | ✅ Phase 2a |
| Content Type Browser showing all available types | ✅ |

### What needs building

#### 1. Library source tracking

Add `source` column to `h5p_libraries`:

```sql
ALTER TABLE h5p_libraries ADD COLUMN IF NOT EXISTS
    source varchar(20) NOT NULL DEFAULT 'official';
-- Values: 'official', 'community', 'custom'

ALTER TABLE h5p_libraries ADD COLUMN IF NOT EXISTS
    uploaded_by_org_id uuid REFERENCES organisations(id) ON DELETE SET NULL;
-- NULL for official + community, set for org-custom
```

The existing `origin` concept (tracking where a library came from) is extended:
- `source = 'official'` — from H5P.org hub
- `source = 'community'` — curated by LeapLearn, not on official hub
- `source = 'custom'` — uploaded by an organisation

#### 2. Community library registry

A second content type source alongside H5P.org. Options:

**Option A — Static JSON in R2** (simplest for launch):
- Maintain a `community-registry.json` file listing community types
- Host the .h5p packages in R2 under `h5p-libraries/community/packages/`
- Hub registry endpoint merges: H5P.org cache + community registry + local install status
- LeapLearn team updates the JSON when adding new community types

**Option B — Database-backed registry** (more flexible):
- `h5p_community_registry` table with metadata per type
- Admin panel for managing community types (add, remove, update)
- More operational overhead but supports growth better

**Recommendation**: Start with Option A. Move to Option B when the community library exceeds ~30 types.

#### 3. Custom library upload endpoint

Extend the existing library upload flow for org-scoped custom types:

```
POST /api/v1/h5p/org-libraries/upload
  - Authenticated (org admin/owner)
  - Accepts .h5p multipart upload
  - Extracts and installs as source='custom', uploaded_by_org_id=orgId
  - Scoped to org via h5p_org_libraries (auto-enabled)
  - Enforces subscription tier limits (custom type count)
```

The extraction and installation logic already exists (`ExtractH5PPackage`, `installSingleLibrary`). The new endpoint is a thin wrapper that sets the source and org scope.

#### 4. Hub registry merge logic

The `GetEditorContentTypeCache` / `GetHubRegistry` methods need to merge three sources:

```
Official (H5P.org cache)
  + Community (LeapLearn community registry)
  + Custom (org-uploaded, filtered by org_id)
  = Combined content type list for Content Type Browser
```

Each entry tagged with its source so the UI can show tabs/filters.

#### 5. Version update management

For official + community types, the update flow is:

1. Hub cache refresh shows newer version available (already implemented)
2. Admin UI shows "Update available" badge per library
3. Admin clicks "Update" → existing `InstallLibrary()` pipeline runs
4. New: "Update All" bulk action for convenience

For custom types, the org admin uploads a new .h5p package. The `UpsertH5PLibrary` ON CONFLICT handles version replacement.

Major version updates (e.g., 1.x → 2.x) may require content migration via `upgrades.js` — defer this complexity to later. Minor/patch updates are drop-in replacements.

---

## UI Additions

### Admin Library Manager (existing, extend)

- Add source badge per library card: "Official" | "Community" | "Custom"
- Add "Updates Available" filter/badge
- Add "Update" button per library (calls existing InstallLibrary)
- Add "Update All" bulk action
- Add "Upload Custom Type" button (paid orgs only)

### Content Type Browser (in editor)

- Source filter tabs: "All" | "Official" | "Community" | "Custom"
- Custom types show org name as publisher
- Community types show LeapLearn as publisher

### Super Admin Panel

- Community library management (add/remove/update community types)
- View all custom types across orgs (for support)

---

## Product Positioning

LeapLearn follows the Lumi model: generous free tier, paid features for organisations with specific needs.

**Free value**: access to the full H5P ecosystem (official + community) without technical setup. This alone is compelling — today you need Moodle + Catharsis + self-hosting to get the same thing.

**Paid value**: custom content type management for organisations that commission or build their own types. These customers already have budget (they're paying developers to build types) — LeapLearn just makes distribution and management easier.

**Moat**: the curated community library. As LeapLearn grows, the community library becomes a unique asset. Developers like Oliver could publish directly to LeapLearn's community library rather than waiting for H5P.org review. This creates a network effect — more types attract more users, more users attract more developers.

---

## Implementation Estimate

| Component | Effort | Phase |
|-----------|--------|-------|
| `source` + `uploaded_by_org_id` columns | 1 hr | 3 |
| Community registry JSON in R2 | 2 hrs | 3 |
| Hub registry merge logic | 3 hrs | 3 |
| Custom type upload endpoint | 2 hrs | 3 |
| Subscription tier enforcement | 1 hr | 3 |
| Admin UI — source badges + update buttons | 3 hrs | 3 |
| Content Type Browser — source filters | 2 hrs | 3 |
| Super admin community management | 3 hrs | 3 |
| "Update All" bulk action | 1 hr | 3 |
| **Total** | **~18 hrs** | |

---

## Open Questions for Phase 3

1. **Developer publishing**: should community developers be able to submit types directly to LeapLearn's community library (like a marketplace), or is it LeapLearn-curated only?
2. **Revenue share**: if custom type upload becomes a marketplace feature, is there a revenue share model with type developers?
3. **Content migration on major version updates**: how to handle `upgrades.js` execution when updating from e.g. 1.x to 2.x?
4. **Type review process**: what's the quality bar for community library inclusion? Automated testing? Manual review?
5. **Deprecation**: how to handle removing a community type that orgs have content built with?
