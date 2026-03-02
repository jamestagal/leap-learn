# Native H5P Player (Moodle Approach)

## Problem
h5p-standalone is a client-side wrapper not designed for backend-powered LMS. CSS/UI broken because it bundles outdated/incomplete core files and relies on client-side library.json fetching.

## Solution
Server-rendered embed page (like Moodle's embed.php). Go serves complete HTML with all CSS/JS pre-resolved. SvelteKit just renders `<iframe>`.

## Changes

### 1. Store preloadedCss/preloadedJs during install

**installer.go** — Add fields to `LibraryJSON` struct:
```go
PreloadedCss []assetPath `json:"preloadedCss,omitempty"`
PreloadedJs  []assetPath `json:"preloadedJs,omitempty"`
```

**service.go** — Serialize full library.json as `metadata_json` in UpsertH5PLibrary:
```go
metaJSON, _ := json.Marshal(lj) // lj is LibraryJSON with Css/Js fields
MetadataJson: pqtype.NullRawMessage{RawMessage: metaJSON, Valid: true}
```

No schema migration needed — `metadata_json` is already jsonb.

### 2. Copy H5P core files from Moodle joubel

Copy from `/Users/benjaminwaller/Projects/Moodle/moodle-5.0.2/h5p/h5plib/v127/joubel/core/` to `service-client/static/h5p-core/`:
- `styles/` (h5p.css, h5p-confirmation-dialog.css, h5p-core-button.css, h5p-tooltip.css, h5p-table.css, font-open-sans.css)
- `js/` (jquery.js, h5p.js, h5p-event-dispatcher.js, h5p-x-api-event.js, h5p-x-api.js, h5p-content-type.js, h5p-confirmation-dialog.js, h5p-action-bar.js, request-queue.js, h5p-tooltip.js)
- `fonts/` (h5p icon fonts + Open Sans)

### 3. Build embed endpoint

**New route**: `GET /api/v1/h5p/play/{contentId}/embed`

Returns complete HTML page:
```html
<!doctype html>
<html class="h5p-iframe">
<head>
  <meta charset="utf-8">
  <!-- Core CSS -->
  <link rel="stylesheet" href="/h5p-core/styles/h5p.css">
  <link rel="stylesheet" href="/h5p-core/styles/h5p-confirmation-dialog.css">
  <link rel="stylesheet" href="/h5p-core/styles/h5p-core-button.css">
  <link rel="stylesheet" href="/h5p-core/styles/h5p-tooltip.css">
  <link rel="stylesheet" href="/h5p-core/styles/h5p-table.css">
  <!-- Library CSS (from dependency tree, resolved server-side) -->
  <link rel="stylesheet" href="/api/h5p/libraries/H5P.MultiChoice-1.16.14/styles/multichoice.css">
  ...
  <!-- Core JS -->
  <script src="/h5p-core/js/jquery.js"></script>
  <script src="/h5p-core/js/h5p.js"></script>
  <script src="/h5p-core/js/h5p-event-dispatcher.js"></script>
  ...
</head>
<body>
  <div class="h5p-content" data-content-id="1"></div>
  <script>
    H5PIntegration = { ... };
  </script>
</body>
</html>
```

H5PIntegration structure (matching Moodle):
```json
{
  "baseUrl": "https://app.leaplearn.io",
  "url": "/api/h5p",
  "contents": {
    "cid-1": {
      "library": "H5P.MultiChoice 1.16",
      "jsonContent": "{...}",  // the content.json params
      "fullScreen": false,
      "styles": [...library CSS URLs...],
      "scripts": [...library JS URLs...],
      "displayOptions": { "frame": true, "copyright": true, ... },
      "contentUrl": "/api/h5p/play/{id}/content"
    }
  },
  "core": {
    "styles": ["/h5p-core/styles/h5p.css", ...],
    "scripts": ["/h5p-core/js/jquery.js", ...]
  },
  "l10n": { "H5P": { ... } }
}
```

### 4. Update SvelteKit H5PPlayer.svelte

Replace h5p-standalone with simple iframe:
```svelte
<iframe
  src="/api/h5p/play/{contentId}/embed"
  class="h5p-iframe"
  style="width:100%;border:none;"
  title={title}
></iframe>
```

Use postMessage for xAPI events (h5p.js already dispatches these).

### 5. Backfill existing libraries

One-time script: for each library in DB, download library.json from R2, extract preloadedCss/preloadedJs, update metadata_json.

## Library CSS/JS URL format

Three-part version in URLs (matching R2 keys):
`/api/h5p/libraries/{machineName}-{major}.{minor}.{patch}/{cssPath}`

This avoids the two→three part version resolution that caused issues before.

## Unresolved Questions

1. Should we serve the embed HTML from Go (simpler) or from a SvelteKit route (can share auth more easily)?
2. Do we need iframe resize communication (postMessage) for dynamic content height?
3. Should the embed page be unauthenticated (content URLs still need auth) or pass auth via query param/cookie?
