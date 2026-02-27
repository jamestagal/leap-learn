# UI/UX & Layout Spec Plan

**Date**: 2026-02-07
**Branch**: feature/subscription-billing
**Status**: Planning

---

## 1. Fix Error Page Typo & Wrong Domain

**Priority**: P0 | **Effort**: 5 min | **Dependencies**: None

**Issue**: Error page has typo "Somethign" and references defunct domain `gofast.live`.

**Current State** (`service-client/src/routes/+error.svelte:7,12`):
```svelte
{page.status} | {page.error?.message || "Somethign went wrong"}
...
<a href="mailto:admin@gofast.live" ...>
```

**Proposed Fix**:
- Line 7: Change `"Somethign went wrong"` to `"Something went wrong"`
- Line 12: Change `admin@gofast.live` to `support@webkit.au`
- Consider adding WebKit logo/branding to error page

---

## 2. Audit {@html} Usage for XSS -- Add DOMPurify

**Priority**: P0 | **Effort**: 2-3 hrs | **Dependencies**: `npm install dompurify`

**Issue**: Contract pages render HTML without sanitization. Proposals use `parseMarkdown()` which escapes HTML first (safe). Contract pages render raw HTML directly.

**Current State** -- Unsafe usages:
- `service-client/src/routes/c/[slug]/+page.svelte:250` -- `{@html contract.generatedTermsHtml}`
- `service-client/src/routes/c/[slug]/+page.svelte:266` -- `{@html schedule.content}`
- `service-client/src/routes/c/[slug]/+page.svelte:279` -- `{@html contract.generatedScheduleHtml}`
- `service-client/src/routes/(app)/[agencySlug]/settings/contracts/[templateId]/schedules/+page.svelte:292` -- `{@html schedule.content}`
- `service-client/src/routes/(app)/[agencySlug]/contracts/[contractId]/+page.svelte:1037` -- `{@html schedule.content}`

**Safe usages** (no action needed):
- `service-client/src/routes/p/[slug]/+page.svelte:362,606,715` -- `parseMarkdown()` escapes HTML entities before processing

**Proposed Fix**:
1. Install `dompurify` + `@types/dompurify`
2. Create `$lib/utils/sanitize.ts`:
   ```typescript
   import DOMPurify from 'dompurify';
   export function sanitizeHtml(html: string): string {
     return DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
   }
   ```
3. Sanitize on the **server side** before storage in `contracts.remote.ts` when generating HTML from templates (defense-in-depth)
4. Also sanitize on render side for all 5 unsafe usages listed above
5. Note: DOMPurify needs `isomorphic-dompurify` for SSR or sanitize server-side only

---

## 3. Populate Dashboard Stats with Real Data

**Priority**: P1 | **Effort**: 4-6 hrs | **Dependencies**: None

**Issue**: 2 of 3 dashboard stats show hardcoded `-`. Activity feed is placeholder.

**Current State** (`service-client/src/routes/(app)/[agencySlug]/+page.svelte:100-120`):
```typescript
{ label: 'Completed This Month', value: '-', ... },
{ label: 'Team Members', value: '-', ... }
```
Activity feed at line 372-379 shows "Activity feed coming soon..."

**Current Server Load** (`+page.server.ts`): Only queries `consultations` count and profile completeness. No team member count, no monthly stats, no activity log.

**Proposed Fix**:
1. Update `+page.server.ts` to query:
   - Team member count: `SELECT count(*) FROM agency_memberships WHERE agency_id = ? AND status = 'active'`
   - Completed this month: `SELECT count(*) FROM consultations WHERE agency_id = ? AND created_at >= date_trunc('month', now())`
   - Recent activity: `SELECT * FROM agency_activity_log WHERE agency_id = ? ORDER BY created_at DESC LIMIT 5`
2. Wire `stats` array to use server data instead of `-`
3. Replace activity placeholder with real activity feed using `agency_activity_log` table
4. Format activity items with icons per action type, relative timestamps

---

## 4. Add Breadcrumb Navigation to Settings Subpages

**Priority**: P2 | **Effort**: 2 hrs | **Dependencies**: None (old Breadcrumbs.svelte removed)

**Issue**: Deep settings pages (e.g., `/settings/contracts/[id]/schedules`) have no breadcrumb trail. Users must rely on sidebar nav or back button.

**Current State** (`service-client/src/routes/(app)/[agencySlug]/settings/+layout.svelte`):
- Settings index shows card grid (good)
- Sub-pages show sidebar nav but no breadcrumbs above content
- Mobile shows horizontal scroll tabs for settings nav

**Proposed Fix**:
1. Create new `$lib/components/Breadcrumbs.svelte` (fresh implementation)
   - Accept `items: { label: string; href?: string }[]` prop
   - Use DaisyUI `breadcrumbs` component: `<div class="breadcrumbs text-sm">`
   - Last item rendered as plain text (current page), others as links
2. Add breadcrumbs in settings `+layout.svelte` above `{@render children()}` for non-index pages
3. Build breadcrumb items from URL path segments + `settingsNav` label mapping
4. Example: `Settings > Contracts > Template Name > Schedules`

---

## 5. Fix Mobile Sidebar DOM Manipulation Anti-Pattern

**Priority**: P2 | **Effort**: 1-2 hrs | **Dependencies**: None

**Issue**: Mobile sidebar uses `document.getElementById('sidebar')` for DOM manipulation instead of Svelte state.

**Current State** (`service-client/src/routes/(app)/[agencySlug]/+layout.svelte:73-86`):
```typescript
function showModal(): undefined {
    const modal = document.getElementById('sidebar') as HTMLDialogElement;
    if (modal) { modal.showModal(); }
    return undefined;  // odd type workaround
}
```

**Proposed Fix**:
1. Replace with Svelte state: `let sidebarOpen = $state(false)`
2. Use DaisyUI drawer component or conditional `modal-open` class:
   ```svelte
   <dialog id="sidebar" class="modal modal-start" class:modal-open={sidebarOpen}>
   ```
3. Toggle via `sidebarOpen = !sidebarOpen` instead of DOM queries
4. Remove `showModal()` / `closeModal()` functions
5. Add `aria-expanded={sidebarOpen}` to hamburger button
6. Close on navigation: `onclick={() => { sidebarOpen = false }}`
7. Close on backdrop click: `onclick={() => sidebarOpen = false}` on backdrop

---

## 6. Unify Loading/Spinner Patterns

**Priority**: P2 | **Effort**: 2-3 hrs | **Dependencies**: None

**Issue**: 4 different spinner implementations across the codebase.

**Current State**:
| Implementation | Location | Usage |
|---|---|---|
| DaisyUI `loading loading-spinner` | 30+ files | Most common, inline |
| `Spinner.svelte` (Loader2 wrapper) | `$lib/components/Spinner.svelte` | Centered Loader2 |
| `LoadingIcon.svelte` (custom SVG) | `$lib/assets/icons/LoadingIcon.svelte` | Circle + arc SVG |
| `loading.svelte` (fullscreen overlay) | `src/routes/loading.svelte` | Fixed overlay with SVG |
| `Button.svelte` inline SVG | `$lib/components/Button.svelte:60-73` | Custom arc SVG in buttons |

**Proposed Fix**:
1. Standardize on DaisyUI's `loading loading-spinner` for inline spinners (already most common)
2. Keep `Spinner.svelte` but refactor to use DaisyUI classes instead of Loader2
3. Remove `LoadingIcon.svelte` -- replace usages with DaisyUI spinner
4. Keep `loading.svelte` as fullscreen overlay (different purpose)
5. Refactor `Button.svelte` to use DaisyUI's `loading loading-spinner` instead of custom SVG
6. Grep for `Loader2.*animate-spin` across all files and replace with `<span class="loading loading-spinner">`

---

## 7. Add ARIA Attributes to Interactive Components

**Priority**: P2 | **Effort**: 2-3 hrs | **Dependencies**: #5 (sidebar fix)

**Issue**: Missing ARIA attributes on key interactive components.

**Current State**:
- `AgencySwitcher.svelte:96-124`: Trigger button missing `aria-expanded`, `aria-haspopup`, `role`
- `+layout.svelte:182-186`: Hamburger button missing `aria-expanded`
- `+layout.svelte:218`: Dialog sidebar missing `aria-label`
- Proposal response buttons (`p/[slug]/+page.svelte`): No `aria-pressed`
- Form errors not linked via `aria-describedby`
- ARIA attributes already present: `sr-only` labels on sidebar icons (good), `aria-hidden` on hamburger SVG (good)

**Proposed Fix**:
1. AgencySwitcher: Add `aria-expanded={showDropdown}`, `aria-haspopup="true"`, `role="button"` to trigger
2. Dropdown content: Add `role="menu"`, items get `role="menuitem"`
3. Hamburger: Add `aria-expanded={sidebarOpen}` (after #5), `aria-controls="sidebar"`
4. Dialog: Add `aria-label="Navigation menu"`
5. Proposal buttons: Add `aria-pressed` for accept/decline state
6. Low-effort, high-accessibility-impact changes

---

## 8. Add Page Transition Loading Indicator (NProgress-style)

**Priority**: P2 | **Effort**: 1-2 hrs | **Dependencies**: None

**Issue**: No visual feedback during SvelteKit page navigations. Users may click links and not know navigation started.

**Current State**: `navigating` store is not imported or used anywhere in the codebase (grep returned only `DynamicForm.svelte` which uses it for form nav, not page transitions).

**Proposed Fix**:
1. Install `nprogress` (or build minimal CSS-only bar)
2. Create `$lib/components/NavigationProgress.svelte`:
   ```svelte
   <script>
     import { navigating } from '$app/stores';
     $effect(() => { if ($navigating) NProgress.start(); else NProgress.done(); });
   </script>
   ```
3. Add to root `+layout.svelte` (app-wide)
4. Style: thin colored bar at top of viewport (2-3px), use agency primary color if available
5. Alternative: Pure CSS implementation with DaisyUI `progress` + Svelte transition (zero deps)

---

## 9. Move Logo Storage from Base64 to Object Storage (R2)

**Priority**: P3 | **Effort**: 4-6 hrs | **Dependencies**: R2 bucket setup, Cloudflare account

**Issue**: Logos stored as base64 data URLs in database. 2MB image = ~2.7MB base64 in DB row. Loaded on every page that references agency.

**Current State** (`service-client/src/routes/(app)/[agencySlug]/settings/branding/+page.svelte:152-158`):
```typescript
reader.readAsDataURL(file);  // Converts to base64
brandingData.logoUrl = result;  // Stored in DB as text
```
Two logo fields: `logoUrl` (horizontal) and `logoAvatarUrl` (square avatar).

**Proposed Fix**:
1. Create R2 bucket `webkit-assets` (or use existing)
2. Create upload endpoint in `agency-profile.remote.ts`:
   - Accept file via FormData
   - Upload to R2: `agencies/{agencyId}/logo.{ext}` and `agencies/{agencyId}/avatar.{ext}`
   - Return public URL
3. Update branding page to upload file to R2 instead of base64 conversion
4. Store R2 URL in `logoUrl`/`logoAvatarUrl` columns (no schema change needed)
5. Migration: Script to extract base64 from existing rows, upload to R2, update URLs
6. Add image size validation (max 1MB recommended) and resize on upload

---

## 10. Add Instant/Debounced Search for Clients

**Priority**: P3 | **Effort**: 1-2 hrs | **Dependencies**: None

**Issue**: Client search requires pressing Enter or clicking Search button. Modern UX expects instant filtering.

**Current State** (`service-client/src/routes/(app)/[agencySlug]/clients/+page.svelte:232-258`):
```svelte
<input ... onkeydown={(e) => e.key === "Enter" && handleSearch()} />
<button ... onclick={handleSearch}>Search</button>
```
Search navigates via URL params (`goto(url.toString())`).

**Proposed Fix**:
1. Add debounced search with 300ms delay:
   ```typescript
   let debounceTimer: ReturnType<typeof setTimeout>;
   $effect(() => {
     clearTimeout(debounceTimer);
     debounceTimer = setTimeout(() => handleSearch(), 300);
     return () => clearTimeout(debounceTimer);
   });
   ```
2. Remove explicit Search button (keep X clear button)
3. Show subtle loading indicator in search input during navigation
4. Keep URL param sync for shareable search URLs
5. Consider client-side filtering if list is small (<100 clients)

---

## 11. Audit Button.svelte for DaisyUI Alignment

**Priority**: P1 | **Effort**: 1-2 hrs | **Dependencies**: None

**Issue**: Custom `Button.svelte` uses pre-DaisyUI color system (`bg-gray-800`, `bg-danger`, `bg-primary-4`, `bg-secondary-4`) that doesn't map to DaisyUI theme colors.

**Current State** (`service-client/src/lib/components/Button.svelte:38-46`):
```typescript
const buttonStyles = {
    action: "shadow-xs bg-gray-800 text-white border border-gray-700",
    outline: "shadow-xs bg-transparent border border-primary-4",  // primary-4 not a DaisyUI class
    danger: "shadow-xs bg-danger text-white",  // bg-danger doesn't exist in DaisyUI
    success: "shadow-xs bg-success text-white",
    warning: "shadow-xs bg-warning text-white",
    primary: "shadow-xs bg-primary text-white",
    secondary: "shadow-xs bg-secondary-4 text-white",  // secondary-4 not a DaisyUI class
};
```
Also has custom `rounded-xl`, `scale-100 active:scale-95` which DaisyUI buttons handle natively.

**Proposed Fix**:
Option A -- **Migrate to DaisyUI btn classes** (recommended):
- Map variants to DaisyUI: `action` -> `btn-neutral`, `outline` -> `btn-outline`, `danger` -> `btn-error`, etc.
- Remove custom styles, use `btn btn-sm btn-primary` etc.
- Keep `isLoading` behavior but use DaisyUI spinner

Option B -- **Delete Button.svelte entirely**:
- Grep for all usages (check import count)
- Replace with inline DaisyUI `btn` classes at call sites
- Most pages already use raw DaisyUI buttons -- Button.svelte may be legacy

**Decision needed**: Check usage count to determine if migration or deletion is easier.

---

## 12. Hardcoded AUD Currency -- Plan for Internationalization

**Priority**: P3 | **Effort**: 3-5 hrs (utility extraction), weeks (full i18n) | **Dependencies**: None

**Issue**: `'en-AU'` locale and `'AUD'` currency hardcoded in 40+ locations across 20+ files. Prevents international expansion.

**Current State**: Scattered across routes, remote functions, templates, and components. Examples:
- `service-client/src/routes/p/[slug]/+page.svelte:115` -- `currency: 'AUD'`
- `service-client/src/lib/templates/email-templates.ts:53` -- `currency: "AUD"`
- `service-client/src/lib/server/services/data-pipeline.service.ts:611` -- `currency: "AUD"`
- `service-client/src/lib/server/prompts/proposal-system.ts:17` -- `All currency in AUD`

**Proposed Fix** (phased):

Phase 1 (do now): Extract utilities
1. Create `$lib/utils/format.ts` with `formatCurrency(amount, currency?)` and `formatDate(date, locale?)`
2. Default to AUD/en-AU but accept overrides
3. Find-and-replace all inline `Intl.NumberFormat` and `toLocaleDateString` calls
4. Single source of truth for format defaults

Phase 2 (future): Agency-level currency
1. Add `currency` and `locale` columns to `agencies` table
2. Pass agency currency through layout data
3. Format functions read from agency context

Phase 3 (future): Full i18n
- Out of scope for now. Track as roadmap item.

---

## RESOLVED Items

These were identified in reviews but have already been fixed:

| Item | Status |
|---|---|
| Duplicate Toast systems (Toast.svelte + toast_store) | RESOLVED -- Toast.svelte removed |
| Legacy components (Input, Badge, Card, Select, Textarea, Dropdown, Breadcrumbs, Calendar, Chart, ImageCropper, MenuLink, Number, PinCode, ProductCard, Ratings, Tabs, Timeline, ToggleButton, ToolBox, YoutubeEmbed, ChipSelector, ProgressBar, SaveDraft, StepIndicator, SideNavigation, Accordion) | RESOLVED -- all removed |

---

## Additional Findings (Not in Original Reviews)

### A. `confirm()` Usage Across Codebase

20+ destructive actions use `window.confirm()` instead of DaisyUI modals. Files include: clients, contracts, invoices, proposals, forms, packages, addons, members, schedules, super-admin pages.

**Recommendation (P3)**: Create reusable `ConfirmModal.svelte` component and migrate destructive actions to use it. Lower priority since `confirm()` works and is accessible by default.

### B. AgencySwitcher Click-Outside Handler

`AgencySwitcher.svelte:86-91` adds document event listener in `$effect`. While functional with cleanup, could leak if component unmounts while open.

**Recommendation (P3)**: Replace with Svelte `use:clickOutside` action or DaisyUI's native dropdown behavior.

---

## Implementation Order

| Phase | Items | Total Effort |
|---|---|---|
| **Immediate** (P0) | #1 Error page, #2 XSS audit | 3 hrs |
| **Pre-launch** (P1) | #3 Dashboard stats, #11 Button audit | 6-8 hrs |
| **Post-launch** (P2) | #4 Breadcrumbs, #5 Mobile sidebar, #6 Spinners, #7 ARIA, #8 NProgress | 9-13 hrs |
| **Quarterly** (P3) | #9 R2 logos, #10 Search, #12 Currency, A confirm modals, B click-outside | 12-18 hrs |

---

## Resolved Questions (2026-02-07)

1. **Button.svelte:** **Only 2 files import it. Delete it.** Files: `consultation/history/+page.svelte` and `consultation/success/+page.svelte`. Replace both with inline DaisyUI `btn` classes, then delete `$lib/components/Button.svelte`.

2. **R2 bucket:** **Yes, `webkit-files` exists and is production-ready.** `docker-compose.production.yml` has `FILE_PROVIDER: r2`, `BUCKET_NAME: webkit-files`. Go provider at `domain/file/provider_r2.go` uses AWS SDK v2. For logo storage, use path prefix `agencies/{agencyId}/logo.{ext}` in existing bucket.

3. **Currency:** **Product decision needed.** Formatting utility extraction (Phase 1) should be done regardless -- good hygiene, unblocks future i18n. Default to AUD for launch.

4. **DOMPurify SSR:** **Both -- defense in depth.** Sanitize on storage (in `contracts.remote.ts` when generating HTML) as primary defense. Also sanitize at `{@html}` render sites as safety net. Use `isomorphic-dompurify` for SSR compatibility.

5. **Activity feed:** **Use `agency_activity_log`. No new table needed.** Table already captures action, entityType, entityId, createdAt, userId, ipAddress. Query `ORDER BY created_at DESC LIMIT 20` with formatting per action type.
