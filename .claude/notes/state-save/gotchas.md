# Save Content State — Gotchas

## H5P Content-User-Data Endpoint Contract

The H5P core client expects a very specific response format:

**GET** must return:
```json
{"success": true, "data": <JSON string or null>}
```
- `data` is the serialized state string, or `null`/`undefined` if no state exists
- Do NOT return `{"success": false}` for missing state — return success with null data

**POST** receives form-encoded (NOT JSON):
```
data=<serialized JSON string>&preload=0&invalidate=0
```
- **CRITICAL**: `invalidate=1` does NOT always mean "delete". H5P sends `invalidate=1` in two cases:
  1. `deleteUserData()` — data is `"0"` or empty → DELETE the saved state
  2. `setUserData({deleteOnChange: true})` — data is actual JSON → SAVE the data (invalidate means "delete when content changes", not "delete now")
  - Only DELETE when `invalidate=1 AND (data=="" OR data=="0")`
- `preload=1`: State should be included in initial page load
- `data` is a JSON string, not a parsed object — store as-is in JSONB column

**GET response values**:
- `data: <string>` (truthy) → H5P restores state
- `data: null` → H5P shows "Data Reset" dialog (state was explicitly cleared)
- `data: false` → H5P treats as "no previous state" (clean start, no dialog)

## saveFreq Must Be a Number, Not Boolean

`H5PIntegration.saveFreq = 10` (number of seconds). Setting it to `true` doesn't work. Setting it to `false` disables state save entirely. We previously had `saveFreq: false` and reverted it because xAPI needs it — but state save is a separate concern from xAPI event tracking. `saveFreq` controls BOTH content state saves AND xAPI statement frequency.

## URL Pattern Uses Colons, Not Braces

The H5P client-side code expects the URL pattern with colons:
```
/api/h5p/content-user-data/:contentId/:dataType/:subContentId
```
NOT `{contentId}`. H5P.js does string replacement on `:contentId` etc.

## SvelteKit Auth Hooks Must Skip /api/ Routes

The auth middleware in `hooks.server.ts` intercepts all non-public routes and redirects to `/login` if unauthenticated. API proxy routes at `/api/*` must be excluded from this check — they handle their own auth via Bearer tokens on the Go backend. Without this, AJAX calls from the H5P iframe get 302'd to `/login` instead of being proxied to Go.

## data-content-id="1" — H5P Uses Hardcoded IDs

The embed HTML has `data-content-id="1"`. H5P core reads this and uses it as the contentId in AJAX URL replacement (`:contentId` → `1`). Since our content IDs are UUIDs, we must pre-bake the UUID into the ajax URL: `"/api/h5p/content-user-data/{UUID}/:dataType/:subContentId"` instead of `"/api/h5p/content-user-data/:contentId/:dataType/:subContentId"`.

## Preloaded contentUserData Format

H5P expects a nested object, NOT an array:
```javascript
contentUserData: { "0": { "state": "{\"answers\":[...]}" } }
```
Format: `{subContentId: {dataType: "JSON string"}}`. Using an array breaks preloading silently.

## Sub-Content IDs

For simple content types (MultiChoice, True/False), `subContentId` is always `"0"`. For compound types (Course Presentation, Interactive Video, Column), each sub-content has its own ID. The table must handle both — the unique constraint includes `sub_content_id`.
