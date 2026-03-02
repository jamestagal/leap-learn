# H5P Embed Player — CSS Architecture & Fixes

## Overview

The H5P embed player renders content inside an iframe served by the Go backend. CSS comes from two sources with different serving chains.

## CSS Serving Architecture

### Two CSS sources in the embed iframe

1. **Core CSS** — Served from SvelteKit static (`/h5p/core/styles/*`)
   - Path: `service-client/static/h5p/core/styles/`
   - Served by: SvelteKit Vite dev server (dev) / SvelteKit static handler (prod)
   - No authentication required
   - Files sourced from the official `h5p-php-library` GitHub repo

2. **Library CSS** — Served from R2 via Go proxy (`/api/h5p/libraries/*`)
   - Path: R2 bucket at `h5p-libraries/extracted/{machineName}-{version}/{path}`
   - Serving chain: Browser → SvelteKit `+server.ts` proxy → Go backend → R2
   - SvelteKit proxy at `service-client/src/routes/api/h5p/[...path]/+server.ts`
   - Go handler at `app/service-core/rest/h5p_route.go` → `handleH5PLibraryAsset()`
   - Unauthenticated (library assets are public)

### Embed HTML generation

- Template: `app/service-core/rest/h5p_play_route.go` → `embedTemplate`
- Core CSS list: `h5pCoreCss` array (same file, ~line 321)
- Library CSS list: Built dynamically from `metadata_json.preloadedCss` of each dependency
- Both generate `<link rel="stylesheet">` tags in the `<head>`

### How the iframe loads

1. `H5PPlayer.svelte` creates `<iframe src="/api/h5p/play/{contentId}/embed?orgId={orgId}">`
2. SvelteKit proxy forwards to Go: `GET /api/v1/h5p/play/{contentId}/embed`
3. Go resolves content → dependencies → CSS/JS paths → renders `embedTemplate`
4. Browser loads the HTML, fetches all CSS/JS from `<link>` and `<script>` tags
5. `h5p.js` initializes from `H5PIntegration` global, creates `.h5p-container` inside `.h5p-content`

## Core CSS Files (canonical order from h5p-php-library)

```go
var h5pCoreCss = []string{
    "/h5p/core/styles/h5p-fonts.css",              // @font-face for Inter, Open Sans, icon fonts
    "/h5p/core/styles/h5p.css",                     // Base H5P styles
    "/h5p/core/styles/h5p-confirmation-dialog.css",
    "/h5p/core/styles/h5p-core-button.css",
    "/h5p/core/styles/h5p-theme.css",               // Theme dialog/button styles (opt-in via .h5p-theme class)
    "/h5p/core/styles/h5p-theme-variables.css",     // CSS custom properties (--h5p-theme-*)
    "/h5p/core/styles/h5p-tooltip.css",
    "/h5p/core/styles/h5p-table.css",
    "/h5p/core/styles/font-open-sans.css",          // Open Sans @font-face (older, kept for compat)
}
```

Source of truth: `h5p-php-library` → `H5PCore::$styles` in `h5p.classes.php`

## H5P Theme System

### How it works

The H5P theme system has two layers:

1. **CSS Custom Properties** (`h5p-theme-variables.css`)
   - `:root` — Defines ALL `--h5p-theme-*` variables (colors, spacing, typography, border-radius)
   - `.h5p-content` / `.h5peditor` — Sets responsive spacing shortcuts (small scale, 0.6)
   - `.h5p-content.h5p-medium` — Medium scale (0.8)
   - `.h5p-content.h5p-large` — Large scale (1.0)
   - **Always active** — Variables are globally available via `:root`

2. **Theme styles** (`h5p-theme.css`)
   - All rules use `.h5p-content:has(.h5p-theme)` selector
   - **Opt-in** — Only applies when `.h5p-theme` class exists inside `.h5p-content`
   - Content type JS adds `.h5p-theme` class (e.g., MultiChoice passes `{ theme: true }` to H5P.Question)
   - Styles dialogs, buttons, close icons using theme variables

### Key CSS variables used by library CSS

```css
var(--h5p-theme-spacing-xs)          /* padding, margins */
var(--h5p-theme-spacing-s)
var(--h5p-theme-spacing-m)
var(--h5p-theme-spacing-l)
var(--h5p-theme-font-size-m)         /* font sizes */
var(--h5p-theme-font-size-l)
var(--h5p-theme-font-size-xl)
var(--h5p-theme-font-name)           /* "Inter", sans-serif */
var(--h5p-theme-alternative-base)    /* answer option backgrounds */
var(--h5p-theme-main-cta-base)       /* primary button color */
var(--h5p-theme-border-radius-medium)
var(--h5p-theme-ui-base)             /* #FFFFFF */
```

Without `h5p-theme-variables.css`, all `var()` references resolve to nothing → invisible layout/spacing/colors.

### Font files

Located in `service-client/static/h5p/core/fonts/`:

| Font | Purpose | Files |
|------|---------|-------|
| Inter | Theme default font (`--h5p-theme-font-name`) | `inter/*.woff2` (6 variants) |
| Open Sans | Classic H5P font | `open-sans/*.woff2` (existing) |
| h5p-core-30 | Core icon font | `h5p-core-30.*` (existing) |
| h5p-theme | Theme icon font (close, copy, download icons) | `h5p-theme.woff2` |
| h5p-hub-publish | Hub publish icons | `h5p-hub-publish.woff2` |

## Embed Template Inline Overrides

The embed template includes a `<style>` block for global overrides. This is the place to add CSS tweaks that affect all content types without modifying library CSS files. Per-org theming CSS will be injected after these defaults and can override them.

```css
body { margin: 0; padding: 0; }
.h5p-content { width: 100%; }

/* Font-weight: library CSS sets 600 everywhere, looks too heavy with system fonts */
.h5p-multichoice .h5p-alternative-container,
.h5p-content .h5p-answer,
.h5p-content .h5p-question-content,
.h5p-theme .h5p-question-introduction,
.h5p-theme .h5p-question-feedback {
  font-weight: normal;
}
.h5p-multichoice .h5p-answer-icon {
  font-weight: normal !important;
}

/* Font-size: shift XL→L and XXL→XL globally (default XL feels too large) */
.h5p-content {
  --h5p-theme-font-size-xl: var(--h5p-theme-font-size-l);
  --h5p-theme-font-size-xxl: var(--h5p-theme-font-size-xl);
}
/* Override hardcoded 1.125em in question.css that bypasses variables */
.h5p-question-introduction {
  font-size: var(--h5p-theme-font-size-l) !important;
}
```

### Override strategy

| Problem | Approach | Why |
|---------|----------|-----|
| font-weight: 600 too heavy | Target specific selectors with `font-weight: normal` | Can't remap a variable — library uses hardcoded `600` |
| font-size XL too large | Remap `--h5p-theme-font-size-xl` variable on `.h5p-content` | One line affects ALL content types using XL |
| question.css hardcoded 1.125em | Direct `!important` override on `.h5p-question-introduction` | Hardcoded value ignores variable remap |

## File Locations Summary

| What | Where |
|------|-------|
| Embed template + CSS list | `app/service-core/rest/h5p_play_route.go` |
| Core CSS files | `service-client/static/h5p/core/styles/` |
| Core font files | `service-client/static/h5p/core/fonts/` |
| Library asset handler (Go) | `app/service-core/rest/h5p_route.go` → `handleH5PLibraryAsset()` |
| Library asset fetcher (service) | `app/service-core/domain/h5p/service.go` → `GetLibraryAsset()` |
| SvelteKit API proxy | `service-client/src/routes/api/h5p/[...path]/+server.ts` |
| H5P Player Svelte component | `service-client/src/lib/components/h5p/H5PPlayer.svelte` |
| H5P standalone (UNUSED) | `service-client/static/h5p-standalone/` — older client-side player, not used by embed |
