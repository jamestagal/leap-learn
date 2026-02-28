# Catharsis-Format Hub Endpoints — Implementation Plan

**Status**: Planned — implement during Phase 3 (Content Management)
**Prerequisite**: Phase 2 (Library Management) complete ✅
**Trigger**: When H5P editor integration begins (editor's Content Type Browser needs these endpoints)

---

## Why These Endpoints Exist

The H5P editor's Content Type Browser hardcodes communication with `api.h5p.org/v1`. To control the content type experience (serve from our own R2 storage, add custom content types, avoid H5P.org dependency at runtime), we implement the same three endpoints Catharsis documents. The H5P editor is then configured to point at our hub URL instead of H5P.org.

These endpoints are **public/unauthenticated** — the H5P editor client calls them without bearer tokens. They use `x-www-form-urlencoded` request bodies (not JSON), matching the H5P Hub protocol exactly.

---

## Endpoint Specifications

### 1. `POST /api/v1/h5p/hub/register`

**Purpose**: Site registration. H5P clients call this on first connection to get a UUID.

**Request**:
- Content-Type: `application/x-www-form-urlencoded`
- Body fields: `uuid` (optional, client-generated), `platform_name`, `platform_version`, `h5p_version`, `type`

**Response**:
```json
{"uuid": "a1b2c3d4-e5f6-..."}
```

**Implementation**:
- If `uuid` field is provided and non-empty, echo it back
- Otherwise, generate a new UUID with `uuid.New()`
- No database write required for MVP (fire-and-forget)
- Optionally store in `h5p_hub_registrations` table for analytics later

**Handler**: ~15 lines. Parse form, return UUID.

---

### 2. `POST /api/v1/h5p/hub/content-types`

**Purpose**: Return the full content type registry. This is the critical endpoint — the editor's Content Type Browser renders entirely from this response.

**Request**:
- Content-Type: `application/x-www-form-urlencoded`
- Body fields: `uuid`, `platform_name`, `platform_version`, `h5p_version`, `core_api_version`, `type`, `local_id` (all mostly ignored but must not reject them)

**Response** (must match H5P Hub format exactly):
```json
{
  "contentTypes": [
    {
      "id": "H5P.Accordion",
      "version": {"major": 1, "minor": 0, "patch": 27},
      "coreApiVersionNeeded": {"major": 1, "minor": 26},
      "title": "Accordion",
      "summary": "Create vertically stacked expandable items",
      "description": "...",
      "icon": "/api/v1/h5p/libraries/H5P.Accordion-1.0/icon.svg",
      "createdAt": "2016-01-01 00:00:00",
      "updatedAt": "2024-06-01 00:00:00",
      "isRecommended": true,
      "popularity": 85,
      "screenshots": [{"url": "...", "alt": "..."}],
      "license": {"id": "MIT", "attributes": {...}},
      "owner": "Joubel",
      "example": "https://h5p.org/accordion",
      "tutorial": "",
      "keywords": ["accordion", "collapsible"],
      "categories": ["Multimedia"]
    }
  ],
  "apiVersion": {"major": 1, "minor": 26},
  "outdated": false
}
```

**Implementation** — new service method `GetHubRegistry(baseURL string)`:

1. Call existing `getCachedHubData(ctx)` to get H5P.org registry (already cached 24h in `h5p_hub_cache`)
2. Get installed libraries from `ListH5PLibraries(ctx)` to enrich with local data
3. For each content type, build the registry entry:
   - Preserve `isRecommended`, `popularity`, `coreApiVersionNeeded` from H5P.org data (these are the fields the editor is picky about)
   - **Rewrite icon URLs** to local paths: `{baseURL}/api/v1/h5p/libraries/{machineName}-{major}.{minor}/icon.svg`
   - Keep screenshots pointing to H5P.org (or omit — editor doesn't break without them)
   - If a library is installed locally with a newer version than H5P.org shows, use the local version numbers
4. Return the merged array wrapped in `{"contentTypes": [...], "apiVersion": {...}, "outdated": false}`

**Key fields the editor cares about** (from user feedback):
- `isRecommended`: true → appears in default "Recommended" view. Set true for standard H5P types.
- `popularity`: integer → ordering within categories. Use H5P.org values.
- `coreApiVersionNeeded`: `{"major": 1, "minor": N}` → editor greys out types incompatible with running core version. Source from each library's `library.json` `coreApi` field.
- `icon`: must be absolute URL or path resolving relative to hub base URL.

**New model** — `HubRegistryResponse`:
```go
type HubRegistryResponse struct {
    ContentTypes []HubContentType `json:"contentTypes"`
    APIVersion   HubVersion       `json:"apiVersion"`
    Outdated     bool             `json:"outdated"`
}
```

Note: `HubContentType` already exists in `model.go` with all required fields. The existing struct from H5P.org deserialization can be reused directly — just rewrite the `Icon` field before serialization.

---

### 3. `GET /api/v1/h5p/hub/content-types/{machineName}`

**Purpose**: Download .h5p package for a content type. The H5P editor calls this when user clicks "Install".

**Request**: GET with machineName in URL path (e.g., `H5P.Accordion`)

**Response**: Binary `.h5p` file with `Content-Type: application/zip`

**Implementation** — new service method `GetPackageOrProxy(ctx, machineName string) ([]byte, error)`:

1. Look up library in DB: `GetH5PLibraryByMachineName(ctx, machineName)`
2. If found and `package_path` is set → download from R2 via `fileProvider.Download(ctx, packagePath)`
3. If not found or no package stored → proxy from H5P.org:
   - Call `hubClient.DownloadPackage(machineName)` to get the bytes
   - Store in R2 at `PackageStorageKey(...)` for future requests
   - Return the bytes
4. Handler sets `Content-Type: application/zip`, `Content-Disposition: attachment; filename="{machineName}.h5p"` and writes raw bytes

**Important**: This does NOT use `writeResponse()` (which wraps in `{"success": true, "data": ...}`) — it writes raw binary directly to the response writer.

---

### 4. `GET /api/v1/h5p/libraries/{path...}` (Asset Serving)

**Purpose**: Serve library files (icons, JS, CSS) from R2 storage. Required for icon URLs in the registry and later for the H5P player/editor to load library assets.

**Request**: GET with path like `H5P.Accordion-1.0.15/icon.svg` or `H5P.Accordion-1.0.15/scripts/accordion.js`

**Response**: File content with appropriate Content-Type header

**Implementation** — new service method `GetLibraryAsset(ctx, assetPath string) ([]byte, string, error)`:

1. Construct R2 key: `h5p-libraries/extracted/{assetPath}`
2. Download via `fileProvider.Download(ctx, key)`
3. Detect content type from file extension using existing `detectContentType()`
4. Return bytes + content type

**Handler**: Extracts the path after `/api/v1/h5p/libraries/`, calls service, writes raw bytes with Content-Type header.

**Note**: This endpoint will be heavily used in Phase 3+ when the H5P player needs to load library JS/CSS at runtime. Building it now for icons also lays groundwork.

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `rest/h5p_hub_route.go` | **CREATE** | 4 handler functions (~120 lines total) |
| `rest/server.go` | **MODIFY** | Add 4 route registrations |
| `domain/h5p/service.go` | **MODIFY** | Add `GetHubRegistry()`, `GetPackageOrProxy()`, `GetLibraryAsset()` methods (~100 lines) |
| `domain/h5p/model.go` | **MODIFY** | Add `HubRegistryResponse` struct (3 lines) |

No migrations, no SQLC changes, no new dependencies.

---

## Existing Infrastructure Leveraged

| What | Where | How Used |
|------|-------|----------|
| Hub cache (24h TTL) | `h5p_hub_cache` table + `getCachedHubData()` | Registry data source |
| Library metadata | `h5p_libraries` table + `ListH5PLibraries()` | Enrich with local install info |
| Package storage | R2 `h5p-libraries/packages/` | Serve .h5p downloads |
| Extracted files | R2 `h5p-libraries/extracted/` | Serve icons and assets |
| File provider | `file.Provider` interface | `Download()` for R2 reads |
| Hub client | `HubClient.DownloadPackage()` | Proxy downloads from H5P.org |
| Content type detection | `detectContentType()` | MIME types for asset serving |
| `HubContentType` struct | `model.go` | Already has all fields H5P editor expects |

---

## H5P Editor Configuration (Phase 3)

When integrating the H5P editor, configure it to point at our hub:

```javascript
// H5P editor init options
{
  hubRegistrationUrl: '/api/v1/h5p/hub/register',
  hubContentTypesEndpoint: '/api/v1/h5p/hub/content-types',
  // The editor constructs download URLs from the content-types endpoint base
}
```

If using `@lumieducation/h5p-server`, override the `contentTypeCacheRefreshEndpoint` config. If building a custom editor integration, intercept the XHR calls to `api.h5p.org` and redirect to our endpoints.

---

## CORS Considerations

These endpoints must allow requests from the SvelteKit client origin. The existing `corsMiddleware` in `server.go` handles this via `cfg.ClientURL`. Since these are same-origin requests (Go API called from the same deployment), CORS should work without changes.

If the H5P editor runs in an iframe or different origin, the CORS middleware may need updating to allow additional origins. Cross that bridge in Phase 3.

---

## Testing Approach

1. **Unit**: Mock `store` and `fileProvider` interfaces to test service methods
2. **Integration**: Hit endpoints with curl/httpie, verify JSON shape matches H5P Hub format
3. **E2E**: Configure H5P editor to point at local hub endpoints, verify Content Type Browser loads and displays types correctly
4. **Regression**: Ensure existing `/api/v1/h5p/content-type-cache` (used by our admin UI) still works — it's separate from the hub endpoints

### Quick curl verification:
```bash
# Register
curl -X POST http://localhost:4001/api/v1/h5p/hub/register \
  -d "uuid=test&platform_name=LeapLearn&h5p_version=1.26"

# Content types
curl -X POST http://localhost:4001/api/v1/h5p/hub/content-types \
  -d "uuid=test&platform_name=LeapLearn"

# Download package (after installing a library)
curl -o test.h5p http://localhost:4001/api/v1/h5p/hub/content-types/H5P.Accordion

# Icon
curl http://localhost:4001/api/v1/h5p/libraries/H5P.Accordion-1.0.15/icon.svg
```

---

## Estimated Effort

~3-4 hours total:
- Models + service methods: 1.5 hrs
- Route handlers: 1 hr
- Testing + verification: 1 hr

Low risk — thin API layer over existing infrastructure.
