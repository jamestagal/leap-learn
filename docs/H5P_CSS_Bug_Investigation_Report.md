# H5P CSS Rendering Bug

**Investigation Report & Developer Handoff**
LeapLearn LMS — March 2026

---

## Executive Summary

The H5P embed player renders content with JavaScript working correctly (DOM elements created, constructor called), but CSS styles do not visually apply. The content appears unstyled: raw HTML checkboxes instead of styled radio buttons, oversized images, and no layout formatting.

One confirmed root cause was found and fixed: diagnostic JavaScript code added during investigation used Object.defineProperty to intercept the H5P global, which destroyed the H5P library object and prevented H5P.init() from running. This has been removed. However, the CSS rendering issue persists after this fix, indicating there is at least one additional underlying cause.

## Observed Symptoms

- H5P MultiChoice content displays raw HTML checkboxes/radio buttons instead of styled alternatives
- Images appear at full/oversized resolution with no layout constraints
- "No question text provided" message displayed (may be normal if no question was entered in the editor)
- Network tab shows all 24 CSS files load successfully (HTTP 200, correct Content-Type: text/css, expected file sizes)
- JavaScript executes correctly — H5P constructor is called, DOM elements are created with appropriate class names

## Architecture Context

The H5P player uses a Moodle-style embed approach:

1. SvelteKit iframe loads `/api/h5p/play/{contentId}/embed`
2. SvelteKit proxy (`+server.ts`) forwards to Go backend
3. Go renders full HTML page via html/template with `<link>` and `<script>` tags
4. Core CSS/JS served from SvelteKit static/ directory (`/h5p/core/...`)
5. Library CSS/JS served from R2 via Go (`/api/h5p/libraries/{lib-version}/{file}`)
6. H5PIntegration JSON object set inline, h5p.js auto-inits on `$(document).ready()`

## Key Files

| File | Purpose |
|------|---------|
| `app/service-core/rest/h5p_play_route.go` | Embed HTML template, H5PIntegration builder, dependency resolution, CSS/JS URL construction |
| `service-client/src/routes/api/h5p/[...path]/+server.ts` | SvelteKit proxy — forwards to Go, only passes Content-Type and Cache-Control headers |
| `app/service-core/rest/middleware.go` | SecurityHeadersMiddleware — sets X-Frame-Options: DENY (stripped by proxy) |
| `app/service-core/domain/h5p_service.go` | GetLibraryAsset — serves files from R2, detectContentType for MIME types |
| `service-client/static/h5p/core/` | Core H5P CSS/JS files (jquery.js, h5p.js, h5p.css, etc.) |
| `service-client/src/lib/api/h5p-content.remote.ts` | Save flow: JSON.parse(data.params) before sending to Go |
| `service-client/src/lib/components/h5p/H5PEditor.svelte` | Editor component — intercepts form.submit(), reads hidden field values |

---

## Hypotheses Investigated

The following table summarizes every hypothesis tested across multiple debugging sessions. All static-analysis hypotheses have been ruled out. Remaining items require runtime verification.

### Confirmed & Fixed

| Hypothesis | Status | Evidence / Detail |
|------------|--------|-------------------|
| Diagnostic JS destroys H5P global | **FIXED** | Object.defineProperty(window, 'H5P', ...) replaced the already-loaded H5P object with a getter returning undefined. Removed the diagnostic code. This was blocking H5P.init() entirely. |

### Ruled Out by Static Analysis

| Hypothesis | Status | Evidence / Detail |
|------------|--------|-------------------|
| CSS files fail to load | **RULED OUT** | Network tab shows all 24 CSS files returning HTTP 200 with correct Content-Type and file sizes. |
| html/template HTML-escapes JSON | **RULED OUT** | template.JS() is used for IntegrationJSON, which prevents HTML escaping. |
| H5PIntegration undefined when init runs | **RULED OUT** | Set in inline `<script>` in body. h5p.js auto-init fires on $(document).ready which is after DOM parsed. |
| jQuery not loaded before h5p.js | **RULED OUT** | Both are synchronous `<script>` tags in `<head>`, jquery.js listed first. jquery.js sets H5P.jQuery. |
| CSS Content-Type wrong through proxy | **RULED OUT** | Go sets text/css via detectContentType(). Proxy forwards Content-Type header. |
| Content JSON double-wrapping | **RULED OUT** | Go embed handler unwraps wrapper["params"] correctly. Content structure verified through full save chain. |
| X-Frame-Options blocking iframe | **RULED OUT** | Go sets X-Frame-Options: DENY but SvelteKit proxy strips it (only forwards Content-Type + Cache-Control). |
| CSP headers blocking styles | **RULED OUT** | No Content-Security-Policy headers set anywhere. |
| X-Content-Type-Options: nosniff blocking CSS | **RULED OUT** | Header is set by Go middleware but stripped by SvelteKit proxy. |
| AssetPath type mismatch | **RULED OUT** | playCssPath/playJsPath structs match library.json format. |
| metadata_json not populated during install | **RULED OUT** | Installer stores full library.json as metadata_json. Backfill endpoint also available. |
| Template URL escaping | **RULED OUT** | html/template URL normalizer passes through standard URL characters (dots, hyphens, slashes). |
| H5P.init not finding .h5p-content | **RULED OUT** | Element is direct child of `<body>`. jQuery .children('.h5p-content') finds it. |
| Script execution order issue | **RULED OUT** | All core/library scripts in `<head>` are synchronous. jQuery loads first, then h5p.js, then library JS. |
| H5P.t() throwing errors | **RULED OUT** | Returns placeholder strings for missing translations, never throws. |
| R2 key format mismatch | **RULED OUT** | Both embed URLs and installer use machineName-major.minor.patch format. |

### Remaining Hypotheses (Untested — Need Runtime Verification)

| Hypothesis | Status | Evidence / Detail |
|------------|--------|-------------------|
| metadata_json is NULL for some libraries | **UNTESTED** | If metadata_json is NULL for any library in the dependency tree, that library contributes 0 CSS/JS URLs. Logging has been added — check server logs for "Library has NULL or empty metadata_json" warnings. |
| CSS files from R2 are empty or corrupt | **UNTESTED** | Files return 200 with expected sizes, but actual content has not been verified. Download a .css file and inspect its contents. |
| CSS @import or url() references fail | **UNTESTED** | h5p.css uses @import 'font-open-sans.css' and url('../fonts/...'). Library CSS may also have relative url() references. If the base path doesn't resolve correctly, fonts/icons fail. |
| CSS selectors don't match actual DOM | **UNTESTED** | Library CSS may target class names that the JS constructor doesn't produce (version mismatch between CSS and JS from R2). |
| Browser DevTools CSS tab shows rules but they don't apply | **UNTESTED** | Need to inspect a styled element in DevTools > Elements > Computed tab to see which CSS rules match and which are overridden. |

---

## Content JSON Lifecycle

Understanding the full save/load chain is important for ruling out data corruption:

1. **Editor**: H5P editor `getContent()` returns `{title, library, params: {params: {...}, metadata: {...}}}`
2. **SvelteKit save**: `JSON.parse(data.params)` converts the string back to an object before sending to Go
3. **Go storage**: Stored as `json.RawMessage` (jsonb column) — no transformation
4. **Go embed handler**: Unwraps `wrapper["params"]` to get inner content, re-marshals to JSON string
5. **h5p.js init**: `JSON.parse(jsonContent)` → validates it's an Object → passes to `H5P.newRunnable()`
6. **Constructor**: Receives the parsed content object, builds DOM elements

This chain has been verified end-to-end and is not the cause of the CSS issue.

## Code Changes Made During Investigation

Changes that **remain in place** (useful additions):

- Added `urlLibraries: "/api/h5p/libraries"` to H5PIntegration object
- Added `metadata: {title: content.Title}` to H5PIntegration content entry
- Enhanced per-library logging with Info level, version numbers, CSS paths
- Added NULL metadata_json warning logging in libToPlayDependency
- Removed destructive diagnostic script (Object.defineProperty) from embed template
- Removed debug banner HTML/CSS from embed template

Changes that were **reverted**:

- `saveFreq: false` — reverted because xAPI event tracking is needed
- `postUserStatistics: false` — reverted for same reason

## Recommended Next Steps

1. **Check server logs** for "Library has NULL or empty metadata_json" warnings after loading an H5P content item
2. **Download a library CSS file** directly from the R2-served URL and verify its contents are valid CSS
3. **Open DevTools** on the embed iframe, inspect a checkbox/radio element, check Computed styles tab to see which rules match
4. **Compare CSS selectors** in the library CSS against the actual DOM class names produced by the JS constructor
5. **Check CSS @import chains** — open the Network tab, filter by CSS, check if any sub-resources (fonts, imported sheets) fail to load
