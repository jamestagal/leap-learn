# H5P Player — Gotchas & Known Issues

## H5P.com "New Look and Feel" Reference

H5P.com launched per-org theming in Feb 2026. Key docs (copied to `docs/plans/h5p-new-custom-theming.md`):
- Preset themes: Daylight (default), Lavender, Mint, Sunset, Custom
- Density: Compact, Comfortable, Wide
- Visibility rollout: Off → Admins only → Everyone
- Our libraries (MultiChoice 1.16.27, Question 1.5.52) already use the new theme system
- Planning doc for our implementation: `docs/plans/h5p-org-theming/h5p-org-theming.md`

## CRITICAL: Missing Core CSS Files Breaks All Styling

**Symptom:** H5P content renders with correct DOM (class names, structure) but no visual styling — raw checkboxes, oversized images, no layout, no spacing.

**Root cause:** The `h5pCoreCss` array in `h5p_play_route.go` was missing 3 files from the official `H5PCore::$styles`:
- `h5p-fonts.css` — @font-face for Inter, Open Sans, icon fonts
- `h5p-theme.css` — Theme dialog/button styles
- `h5p-theme-variables.css` — ALL `--h5p-theme-*` CSS custom property definitions

**Why it breaks everything:** Modern H5P library CSS (MultiChoice 1.16+, Question 1.5+, JoubelUI, Components) uses CSS custom properties (`var(--h5p-theme-spacing-xs)`, `var(--h5p-theme-alternative-base)`, etc.) for ALL spacing, colors, and layout. Without `h5p-theme-variables.css`, every `var()` reference resolves to nothing → invisible styling.

**Fix:** Match `h5pCoreCss` to the canonical order from `h5p-php-library`'s `H5PCore::$styles` in `h5p.classes.php`. Always check this source when upgrading H5P core files.

**Lesson:** When CSS "loads but doesn't apply" (200 OK, valid CSS, correct MIME type), check if the CSS uses variables that depend on another file being loaded first.

---

## CRITICAL: Core CSS Files Must Be Downloaded From h5p-php-library

**Source:** `https://github.com/h5p/h5p-php-library/tree/master/styles/`

**Do NOT** use CSS files from:
- h5p-standalone npm package (different/bundled versions)
- Moodle's H5P integration (may have Moodle-specific modifications)
- CDN builds (may be outdated)

**Font files source:** `https://github.com/h5p/h5p-php-library/tree/master/fonts/`

---

## font-weight: 600 Looks Too Bold

**Symptom:** Answer text in MultiChoice and other content types appears bold/heavy.

**Cause:** The H5P library CSS (multichoice.css) sets `font-weight: 600` on `.h5p-alternative-container`. This is intentional in the new theme. However, if the Inter font doesn't load (or the system fallback sans-serif synthesizes 600), it looks like full bold.

**Current fix:** Global override in embed template inline `<style>`:
```css
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
```

**Better long-term fix:** Ensure Inter font files load correctly. If Inter 600 renders properly, the semibold should look distinct from bold and the override can be removed.

**Location:** `app/service-core/rest/h5p_play_route.go` → embed template `<style>` block

---

## Font Size XL Too Large

**Symptom:** Question text, answer options, and headings across all content types appear oversized.

**Cause:** The H5P theme system defines `--h5p-theme-font-size-xl` as `1.25rem` (large scale) or `~1.125rem` (small scale). Library CSS uses this variable for question intros, answer text, etc. Additionally, `question.css` has a hardcoded `font-size: 1.125em` fallback on `.h5p-question-introduction` that bypasses variable overrides.

**Current fix:** Two overrides in embed template inline `<style>`:

1. **Global variable remap** — shifts the entire font scale down one notch:
```css
.h5p-content {
  --h5p-theme-font-size-xl: var(--h5p-theme-font-size-l);
  --h5p-theme-font-size-xxl: var(--h5p-theme-font-size-xl);
}
```

2. **Direct override** — beats the hardcoded `1.125em` in `question.css:110`:
```css
.h5p-question-introduction {
  font-size: var(--h5p-theme-font-size-l) !important;
}
```

**Per-org theming:** These are defaults for all orgs. Per-org theme CSS (injected after in the cascade) can override the variables back to original values or set custom sizes.

**Location:** `app/service-core/rest/h5p_play_route.go` → embed template `<style>` block

---

## Known Issue: "No question text provided"

**Symptom:** Text "No question text provided" appears above the answer options in MultiChoice content.

**Cause:** This is a **content authoring issue**, not a code bug. The `question` field in the content's `content.json` is empty/missing. The MultiChoice library JS (`H5P.MultiChoice-1.16.27/js/multichoice.js`) displays this placeholder when no question text exists.

**How it happens:** When creating content in the H5P editor, the user doesn't enter text in the question field and saves anyway.

**Fix:** Edit the content in the H5P editor and add question text in the "Question" field.

**Verification:** Check content_json in the database:
```sql
SELECT content_json FROM h5p_content WHERE id = '{content_id}';
```
If the JSON has no `question` key (only `media`, `answers`, `behaviour`), the question text was never entered.

---

## SvelteKit Auth Hooks and the Embed Iframe

**Context:** The embed iframe is same-origin (both on localhost:3000), so it shares cookies with the parent page.

**NOT a problem:** The SvelteKit `hooks.server.ts` auth middleware redirects to `/login` when no `refresh_token` cookie is present. Because the iframe is same-origin, it inherits the parent's cookies → auth works.

**Would be a problem if:** The embed were cross-origin (different domain/port). In that case, cookies wouldn't be shared and the iframe would get 302 redirects for all proxy requests.

**Testing gotcha:** When testing CSS loading with `curl` through the SvelteKit proxy (port 3000), you get 302 redirects unless you include cookies. This does NOT mean the browser has the same issue — the browser has cookies from the logged-in session.

---

## Library CSS Proxy Chain

Library CSS goes through: Browser → SvelteKit proxy → Go → R2

The SvelteKit proxy (`service-client/src/routes/api/h5p/[...path]/+server.ts`):
- Forwards `Content-Type` header exactly as-is
- Adds `Authorization: Bearer {token}` from cookies
- Streams response body through (no buffering)
- Only forwards `Content-Type` and `Cache-Control` response headers

The Go handler (`handleH5PLibraryAsset` in `h5p_route.go`):
- Fetches from R2 at key `h5p-libraries/extracted/{path}`
- Detects Content-Type via `detectContentType()` in `service.go`
- Returns with `Cache-Control: public, max-age=31536000, immutable`
- **Unauthenticated** — no token check for library assets

**Key point:** If CSS appears to load (200 OK) but doesn't apply, the proxy chain is NOT the issue. We verified this thoroughly — CSS content arrives intact through the chain.

---

## h5p-standalone Directory (Unused)

`service-client/static/h5p-standalone/` contains the h5p-standalone npm package (client-side H5P player). This is **NOT used** by the current server-rendered embed player. It was from an earlier implementation approach. Safe to keep for reference or remove.

---

## Debugging CSS Issues in the Embed Player

### Quick diagnostic approach

1. **Check Network tab** (iframe context) — Filter by CSS, verify all files return 200
2. **Check Console** (iframe context) — Look for CORS errors, SecurityError on cssRules
3. **Check Computed styles** — Click an element, see which CSS rules actually apply
4. **Compare core vs library CSS** — If core CSS works but library doesn't, the issue is in the proxy chain or R2 paths

### Diagnostic script (add temporarily to embed template)

```javascript
window.addEventListener('load', function() {
  for (var i = 0; i < document.styleSheets.length; i++) {
    var ss = document.styleSheets[i];
    try {
      console.log('[DIAG] Sheet ' + i + ': ' + ss.href + ' → ' + ss.cssRules.length + ' rules');
    } catch(e) {
      console.log('[DIAG] Sheet ' + i + ': ' + ss.href + ' → ERROR: ' + e.message);
    }
  }
});
```

**Key indicators:**
| Output | Meaning |
|--------|---------|
| Rules = 0 for library sheets | CSS parsed as empty — check for BOM, charset issues |
| SecurityError | Cross-origin CSS — check CORS headers |
| All rules > 0 but no visual effect | CSS variables undefined — check if theme CSS is loaded |
