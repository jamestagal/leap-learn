# UI/UX Review -- WebKit SaaS Platform

**Reviewer**: Claude (UI/UX Specialist)
**Date**: 2026-02-06
**Branch**: feature/subscription-billing
**Scope**: Full platform UI/UX from the perspective of a web agency owner

---

## Executive Summary

WebKit is a well-structured SaaS platform with a clean, consistent visual language built on DaisyUI + TailwindCSS. The primary user flows (consultation > proposal > contract > invoice) are logically connected and the multi-tenancy experience is thoughtfully implemented. However, there are several areas where polish, consistency, and UX refinement could meaningfully improve the daily experience for agency owners and the impression made on their end-clients.

---

## Strengths

### 1. Strong Design System Foundation
- **Centralized feature config** (`service-client/src/lib/config/features.ts`) provides consistent icons, colors, and descriptions across Dashboard, Sidebar, and page headers. This is uncommon and valuable -- changes propagate automatically.
- **DaisyUI + TailwindCSS** is used consistently. Almost all pages use the same card/border/spacing patterns (`card bg-base-100 border border-base-300`), creating visual coherence.
- **Dark mode support** is built in via DaisyUI's theme system (`app.css:2-7`).

### 2. Thoughtful Multi-Tenant Experience
- **Agency Switcher** (`AgencySwitcher.svelte`) is well-designed: shows current agency with avatar/logo fallback, quick links for Settings/Members, and clear "Switch Agency" section. Loading states during switch are handled.
- **Icon-only desktop sidebar** (`[agencySlug]/+layout.svelte:91-178`) with tooltip labels is space-efficient. Active state uses a colored left-border indicator that matches each feature's designated color.
- **Mobile hamburger menu** (`[agencySlug]/+layout.svelte:180-293`) properly duplicates sidebar nav with labels visible, and uses DaisyUI's `dialog` pattern for the overlay.

### 3. Client-Facing Pages Are Polished
- **Public Proposal** (`/p/[slug]/+page.svelte`) is the strongest client-facing page. It features full-bleed sections, agency branding (logo, colors, gradients), performance score cards, ROI analysis, timeline visualization, and a three-option response system (accept/decline/request revision). The pricing card with gradient header is visually impressive.
- **Public Invoice** (`/i/[slug]/+page.svelte`) has print-ready CSS with `@media print` rules, a "PAID" watermark overlay, Stripe payment integration, and PDF download capability.
- **Public Contract** (`/c/[slug]/+page.svelte`) has a clean 3-column layout with sidebar for pricing and signature, preview mode banner, and proper legal signing flow with checkbox consent.

### 4. Progressive Disclosure in Creation Flows
- **Proposal creation** (`proposals/new/+page.svelte`) uses a 3-step wizard (Client > Package > Confirm) with DaisyUI's `steps` component.
- **Invoice creation** (`invoices/new/+page.svelte`) uses progressive modes (standalone/from-proposal/from-contract) that reveal relevant fields only when needed.
- **Contract creation** (`contracts/new/+page.svelte`) has good empty states when no proposals or templates exist, guiding users to create prerequisites.

### 5. Good Onboarding UX
- **Dashboard onboarding** (`[agencySlug]/+page.svelte:186-272`) shows a 2-step getting started flow (Complete Profile > Load Demo Data) with step locking, completion badges, and a demo data system.
- **Settings Setup Checklist** (`settings/+layout.svelte:104-131`) provides a completion progress bar when the settings index loads.

### 6. Comprehensive Branding System
- **Branding page** (`settings/branding/+page.svelte`) supports two logo types (horizontal + avatar), three brand colors with hex input + color picker, CSS gradient field, live preview with sample buttons, and per-document-type branding overrides (contracts, invoices, questionnaires, emails).
- Branding propagates to public proposals, contracts, invoices, sidebar, and the agency switcher.

### 7. Form Builder
- **Three-panel layout** (`form-builder/Builder.svelte`) with Field Library, Canvas, and Properties/Preview using `paneforge` for resizable panels.
- **18 field types** across files in `form-builder/fields/` (text, email, phone, date, file upload, signature, rating, slider, multi-select, etc.).
- Full width layout detection in the parent layout (`isFormBuilderPage` conditional padding).

---

## Weaknesses

### ~~1. Duplicate Toast Systems~~ RESOLVED
~~Two separate toast implementations existed.~~ The legacy `Toast.svelte` was removed. The codebase now uses only `toast_store.svelte.ts` via `getToast()`.

### ~~2. Inconsistent Component Usage~~ PARTIALLY RESOLVED
The legacy `Input.svelte` was removed along with 20+ other unused components (Badge, Card, Select, Textarea, Dropdown, etc.). Pages now use DaisyUI classes directly. The custom `Button.svelte` still exists and should be audited for alignment with DaisyUI.

### 3. Dashboard Stats Are Placeholder
The dashboard (`[agencySlug]/+page.svelte:100-120`) shows three stats cards, but two display hardcoded `-` values:
```typescript
{ label: 'Completed This Month', value: '-', ... },
{ label: 'Team Members', value: '-', ... }
```
The "Recent Activity" section is also a placeholder: "Activity feed coming soon..."

**Impact**: The first thing an agency owner sees after login is a dashboard with incomplete data. This undermines confidence in the platform.

### 4. Error Page Has Issues
`+error.svelte` has:
- A **typo**: "Somethign went wrong" (line 8).
- References `admin@gofast.live` -- the old product name, not `webkit.au`.
- Minimal styling with no logo or branding.

**Impact**: When errors occur, the page looks unfinished and references the wrong product.

### 5. No Breadcrumb Navigation -- UPDATED
The unused `Breadcrumbs.svelte` component was removed. The underlying issue remains: users in deep settings pages have no breadcrumb trail. A new implementation would be needed.

**Impact**: Users in deep pages may feel lost, especially in the settings hierarchy.

### 6. Mobile Sidebar Uses Dialog/Modal Pattern
The mobile navigation (`[agencySlug]/+layout.svelte:218-293`) uses a `<dialog id="sidebar">` with `modal.showModal()` / `modal.close()`. While functional, this:
- Doesn't animate the drawer sliding in (dialog animations are limited).
- Uses `showModal()` via direct DOM manipulation (`document.getElementById`) rather than Svelte state, which is an anti-pattern.
- The hamburger button returns `undefined` from `showModal()` -- an odd workaround to satisfy type checking.

**Impact**: Less polished mobile experience compared to a proper slide-out drawer.

### ~~7. SideNavigation.svelte Appears Unused~~ RESOLVED
`SideNavigation.svelte` was removed as dead code.

### 8. Two Different Loading/Spinner Patterns
Pages use multiple loading indicators:
- DaisyUI's `loading loading-spinner loading-sm` (most common).
- Lucide's `Loader2` icon with `animate-spin` class.
- Custom `Loading.svelte` (referenced in the login page).
- The custom `Button.svelte` has its own SVG spinner.

No single loading component is used consistently.

### 9. No Keyboard Shortcut Support
The icon-only sidebar has no keyboard shortcuts for navigation (e.g., `Ctrl+1` for Dashboard, `Ctrl+N` for New Consultation). For a tool used daily by agency staff, this would be a significant productivity enhancement.

### 10. Search is Not Instant
The client search (`clients/+page.svelte:232-259`) requires pressing Enter or clicking a "Search" button. Modern SaaS apps debounce search input and filter results in real-time. The current pattern requires explicit action.

---

## Opportunities

### 1. Unified Component Library -- MOSTLY RESOLVED
Legacy components removed: `Input.svelte`, `Toast.svelte`, `SideNavigation.svelte`, `Badge.svelte`, `Card.svelte`, `Select.svelte`, `Textarea.svelte`, `Dropdown.svelte`, `Breadcrumbs.svelte`, `Calendar.svelte`, `Chart.svelte`, `ImageCropper.svelte`, `MenuLink.svelte`, `Number.svelte`, `PinCode.svelte`, `ProductCard.svelte`, `Ratings.svelte`, `Tabs.svelte`, `Timeline.svelte`, `ToggleButton.svelte`, `ToolBox.svelte`, `YoutubeEmbed.svelte`, `ChipSelector.svelte`, `ProgressBar.svelte`, `SaveDraft.svelte`, `StepIndicator.svelte`, `Accordion.svelte`.

**Remaining**: Audit `Button.svelte` for DaisyUI alignment.

### 2. Dashboard Metrics
Populate the dashboard with real data:
- Completed consultations this month (query exists, just not wired up).
- Team member count.
- Revenue from paid invoices.
- Conversion rate (proposals sent vs. accepted).
- Recent activity feed (last 5 actions across all entity types).

### 3. Proposal View Analytics
The `analytics/` components directory has `ProposalMetrics.svelte`, `ViewTracker.svelte`, and `ConversionChart.svelte`. If not already integrated, these could provide agency owners with insight into how clients interact with proposals (time spent on sections, number of views before decision).

### 4. Empty State Consistency
Most entity list pages have good empty states (clients, contracts, invoices), but they should be audited for consistency. The empty state pattern should always include: icon, title, description, primary action button.

### 5. Form Validation UX
The login page uses DaisyUI's `validator` class with `validator-hint`, but most other forms use plain `required` attributes with no inline validation feedback. Adding consistent inline validation (red borders, helper text) across all forms would improve the experience.

### 6. Batch Operations
Currently there is no way to select multiple items (clients, invoices, etc.) for batch operations (archive, export, email). As agencies scale, this becomes important.

### 7. Confirmation Dialogs
The client delete flow uses `window.confirm()` (`clients/+page.svelte:193`), while other destructive actions (clear demo data) use custom DaisyUI modals. Standardize on the custom modal pattern for all destructive actions.

### 8. Responsive Table Improvements
The clients page (`clients/+page.svelte:314-494`) has separate mobile card and desktop table layouts, which is good. This pattern should be applied consistently to all list views (proposals, contracts, invoices, consultation history).

---

## Risks

### 1. XSS via `{@html}` Usage
Multiple client-facing pages render user-generated content with `{@html}`:
- `p/[slug]/+page.svelte` -- `{@html parseMarkdown(proposal.opportunityContent)}` (lines 362, 606, 715)
- `c/[slug]/+page.svelte` -- `{@html contract.generatedTermsHtml}` (line 250), `{@html schedule.content}` (line 266)

The `parseMarkdown` function in proposals does escape HTML entities first (`.replace(/&/g, '&amp;')` etc.), which is good. However, the contract page renders `generatedTermsHtml` and `generatedScheduleHtml` directly. If these values come from a rich text editor with insufficient sanitization, XSS is possible.

**Recommendation**: Ensure all `{@html}` content passes through DOMPurify or equivalent on the server before storage.

### 2. Logo Storage as Base64 Data URLs
The branding page (`settings/branding/+page.svelte:152-158`) converts uploaded logos to base64 data URLs via `FileReader.readAsDataURL()` and stores them in `brandingData.logoUrl`. Base64-encoded images can be very large (a 2MB PNG becomes ~2.7MB base64), and storing them in the database increases:
- Database row size.
- Network payload on every page load that references the agency.
- Memory usage when rendering lists of agencies.

**Recommendation**: Upload logos to object storage (S3, R2) and store URLs instead.

### 3. Agency Switcher Click-Outside Handler
The `AgencySwitcher.svelte` (lines 83-98) attaches a `click` event listener to `document` when the dropdown opens and removes it on cleanup. This is a common pattern but has subtle issues:
- The cleanup in `$effect` fires when `showDropdown` becomes false, but the listener is already removed. If the component unmounts while open, the listener could leak.
- Using DaisyUI's built-in dropdown behavior (via `dropdown` + `tabindex`) would be more robust.

### 4. Missing ARIA Attributes
- Sidebar navigation links (`[agencySlug]/+layout.svelte`) have `sr-only` labels for icons, which is good.
- However, the mobile sidebar toggle button lacks `aria-expanded` state.
- The AgencySwitcher dropdown lacks `aria-haspopup`, `aria-expanded`, and proper `role` attributes.
- Form error messages are not linked to inputs via `aria-describedby`.
- The proposal response buttons (accept/decline/revision) don't have `aria-pressed` state.

### 5. No Loading State for Page Transitions
When navigating between pages, there is no global loading indicator. SvelteKit supports this via `navigating` store, and adding a top-bar progress indicator (NProgress-style) would prevent users from wondering if their click registered.

### 6. Hardcoded AUD Currency
All formatting functions use `'en-AU'` locale and `'AUD'` currency. This is fine for an Australian-focused product but would need parameterization for international expansion. The currency is hardcoded in at least:
- `contracts/new/+page.svelte:72`
- `invoices/new/+page.svelte:256`
- `p/[slug]/+page.svelte:113`
- `i/[slug]/+page.svelte:65`
- `settings/billing/+page.svelte:123`

### 7. Consultation Form Depends on Unverified External Data
The consultation page (`consultation/+page.svelte:78-95`) has a cascading fallback for form selection: default form > first form > fallback template > error. If all three are missing, the user sees a plain text error. The DynamicForm component receives `data.optionSets` from the server, and if this data is malformed, the form could crash without a graceful fallback.

---

## Component-Specific Notes

### ~~Toast Store Dual Implementation~~ RESOLVED
Legacy `Toast.svelte` was removed. Only `toast_store.svelte.ts` remains (active, used by all pages via `getToast()`).

### Feature Color Consistency
The feature config assigns each core feature a distinct color. These colors are used in:
- Dashboard cards (icon background + button style)
- Sidebar icons
- Page headers

This creates a strong visual identity per feature type. The colors are well-distributed across the spectrum (indigo, violet, cyan, emerald, pink, teal).

### Form Builder Quality
The form builder is the most complex UI component. Key observations:
- Uses `paneforge` for resizable panels -- a mature approach.
- 18 field types with dedicated `.svelte` components.
- Live preview with branding integration.
- Template system for pre-built form configurations.
- Schema export/import capability.

This is a competitive feature. The main improvement opportunity is adding undo/redo support.

---

## Priority Recommendations

| Priority | Item | Effort |
|----------|------|--------|
| **P0** | Fix error page typo and contact email | 5 min |
| **P0** | Audit `{@html}` usage for XSS safety | 2 hrs |
| **P1** | Populate dashboard stats with real data | 4 hrs |
| ~~**P1**~~ | ~~Remove or reconcile duplicate Toast system~~ | ~~DONE~~ |
| **P1** | ~~Remove legacy Input.svelte~~ DONE / Audit Button.svelte alignment with DaisyUI | 1 hr |
| **P2** | Add breadcrumb navigation to settings subpages | 2 hrs |
| **P2** | Add page transition loading indicator | 1 hr |
| **P2** | Improve mobile sidebar with proper drawer animation | 3 hrs |
| **P2** | Add ARIA attributes to interactive components | 3 hrs |
| **P3** | Move logo storage from base64 to object storage | 4 hrs |
| **P3** | Add keyboard shortcuts for power users | 4 hrs |
| **P3** | Implement instant/debounced search | 2 hrs |
