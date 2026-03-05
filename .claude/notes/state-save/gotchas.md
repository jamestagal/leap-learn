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

---

## Phase 4: Durable Object (DO) State Save

### JWT in Worker
- LeapLearn JWTs use **EdDSA (Ed25519)**, NOT RS256
- User ID is in `payload.id`, NOT `payload.sub` — matches `AccessTokenClaims` in `app/pkg/auth/auth.go`
- Worker caches `CryptoKey` in module-level variable (survives across requests, cleared on redeploy)

### DO Design
- Identity: `idFromName(\`${userId}:${contentId}\`)` — one DO per user per content
- `ctx.storage.put()` on every write — ensures state survives DO eviction
- Alarm at 30s intervals batches rapid saves into one flush
- Exponential backoff on flush failure: 30s → 60s → 120s → 240s → 300s max
- `retryCount` is instance-level (not persisted) — resets on DO eviction, which is fine since a fresh instance re-reads from storage

### Feature Flag (`STATE_SAVE_TARGET`)
- `go` (default): All traffic to Go — no regression risk
- `shadow`: GETs from Go, POSTs to Go + Worker in parallel — validates Worker without user impact
- `worker`: Full cutover — Go receives data only via alarm flush
- Shadow mode catches Worker errors silently — never fails the primary write

### Service Token Auth (DO → Go flush)
- `X-Api-Key` + `X-User-Id` headers used for DO → Go flush calls
- Follows `task_route.go` pattern exactly
- Skips org membership check — JWT was already verified at Worker, org membership checked at embed page load
- `StateServiceToken` is optional in config — empty string = feature disabled

### SvelteKit Proxy
- Dedicated route at `api/h5p/content-user-data/[...path]/` takes precedence over catch-all `api/h5p/[...path]/`
- Must read body as text once for shadow mode (can't stream to two targets)
- `access_token` cookie → `Authorization: Bearer` header forwarding (same as catch-all)

### CORS
- `X-Api-Key` and `X-User-Id` added to allowed headers defensively
- DO alarm fetch is server-side (Workers runtime) — doesn't trigger browser CORS

### Worker Secrets: PUBLIC_KEY_PEM Must Be Piped from File
- `wrangler secret put PUBLIC_KEY_PEM` with manual paste **mangles the PEM** — multi-line keys lose newlines or get extra whitespace
- Always pipe from the actual key file: `cat ../../app/service-core/public.pem | npx wrangler secret put PUBLIC_KEY_PEM`
- Symptom of a broken key: Worker returns **401 Unauthorized** on every request, DO stays empty, `verifyJWT` catches the `importSPKI` error silently and returns `null`
- After fixing the secret, you must restart `wrangler dev` for the new secret to take effect
