# Super-Admin H5P Extension Plan

## Overview

Extend LeapLearn's existing Webkit super-admin module with H5P-specific management capabilities. The super-admin module already handles org management, user management, beta invites, and form templates. This plan adds platform-wide H5P administration.

## Existing Super-Admin Features (from Webkit)

- `/super-admin/` — Dashboard with platform stats
- `/super-admin/organisations/` — Browse/manage all orgs, suspend, change tier
- `/super-admin/organisations/[id]/` — Individual org detail + impersonation
- `/super-admin/users/` — User management, suspension, access control
- `/super-admin/templates/` — Global form template CRUD
- `/super-admin/beta-invites/` — Beta invite system

## New H5P Admin Pages

### 1. H5P Library Management (`/super-admin/h5p-libraries/`)

**Purpose**: Platform-wide library administration (libraries are org-agnostic).

**Features**:
- Browse all installed H5P libraries with version, dependency count, content usage count
- Upload new .h5p library packages (drag-drop)
- Update existing libraries to newer versions
- Delete unused libraries (with dependency check)
- View library dependency tree
- Enable/disable libraries globally
- Bulk install from H5P Hub

**Data source**: `h5p_libraries`, `h5p_library_dependencies` tables

**Priority**: HIGH — needed before any content can be created

### 2. H5P Hub Management (`/super-admin/h5p-hub/`)

**Purpose**: Manage H5P Hub connection and library discovery.

**Features**:
- Hub registration status and API key management (`h5p_hub_registrations` table)
- Browse Hub content type cache (`h5p_hub_cache` table)
- Trigger cache refresh
- Install libraries from Hub (one-click)
- View installation history and logs
- Per-org Hub access restrictions via `h5p_org_libraries`

**Data source**: `h5p_hub_registrations`, `h5p_hub_cache` tables

**Priority**: HIGH — enables library discovery and installation

### 3. Content Overview (`/super-admin/h5p-content/`)

**Purpose**: Cross-org content audit and management.

**Features**:
- Browse all H5P content across all orgs (with org filter)
- Content usage stats (views, completions, avg score)
- Storage usage per content item
- Flag/unflag content for review
- Bulk operations (delete orphaned content, re-index)
- Content type distribution chart

**Data source**: `h5p_content`, `h5p_content_folders`, `progress_records` tables

**Priority**: MEDIUM — useful but not blocking

### 4. Platform Analytics (`/super-admin/analytics/`)

**Purpose**: System-wide learning analytics dashboard.

**Features**:
- Total learners, active learners (7d/30d)
- Content completion rates by type
- Most/least used content types
- xAPI statement volume and trends
- Per-org usage comparison
- Storage consumption (R2 bucket stats)
- Course enrollment trends

**Data source**: `xapi_statements`, `progress_records`, `enrolments`, `courses` tables

**Priority**: MEDIUM — valuable for platform health monitoring

### 5. Storage Management (`/super-admin/storage/`)

**Purpose**: R2/MinIO storage monitoring and management.

**Features**:
- Total storage used vs quota
- Per-org storage breakdown
- Library storage vs content storage split
- Orphaned file detection and cleanup
- Storage quota management per subscription tier

**Data source**: R2 API + `h5p_content`, `h5p_libraries` tables

**Priority**: LOW — nice to have, not urgent

### 6. Org Library Access (`/super-admin/org-libraries/`)

**Purpose**: Manage which libraries each org can access.

**Features**:
- View org-library mappings (`h5p_org_libraries` table)
- Restrict specific content types per org/tier
- Bulk enable/disable libraries for org groups
- Default library set per subscription tier

**Data source**: `h5p_org_libraries` table

**Priority**: LOW — needed for enterprise tier differentiation

## Implementation Order

### Phase A: Foundation (with Phase 2 — Hub API + Library Management)
1. `/super-admin/h5p-libraries/` — Library list, upload, delete
2. `/super-admin/h5p-hub/` — Hub browsing, one-click install

### Phase B: Content & Courses (with Phase 3-4)
3. `/super-admin/h5p-content/` — Cross-org content browser
4. `/super-admin/analytics/` — Basic stats dashboard

### Phase C: Advanced (Phase 5+)
5. `/super-admin/storage/` — Storage monitoring
6. `/super-admin/org-libraries/` — Per-org library restrictions

## Technical Notes

- All super-admin remote functions go in `super-admin.remote.ts` (extend existing)
- Or create `super-admin-h5p.remote.ts` for H5P-specific functions
- Use `requireSuperAdmin()` guard on all functions
- Super-admin queries skip org scoping (platform-wide access)
- Reuse existing DaisyUI table/card patterns from org management pages
- Super-admin flag: `users.access | 65536` (bit 16)

## Components to Leverage

From LEAP project (already copied):
- `LibraryManager.svelte` — Adapt for super-admin library page
- `LibraryCard.svelte` — Library display cards
- `H5PHubBrowser.svelte` — Hub browsing UI
- `H5PInstallationProgress.svelte` — Installation progress tracking
- `H5PDataTable.svelte` — Data tables for content/analytics
- `ContentBrowser.svelte` — Cross-org content browsing

From existing Webkit super-admin:
- Organisation list/detail page patterns
- User management table patterns
- Stats card layout from dashboard
- Modal patterns for confirmations
