# H5P CSS renders but doesn't apply: the missing class and broken font paths

**The most likely root cause is that your `<html>` element lacks `class="h5p-iframe"`.** Nearly every base style in H5P's core `h5p.css` is scoped to the selector `html.h5p-iframe`, meaning all CSS files can load with HTTP 200 and correct MIME types, yet zero rules will match if this class is absent. A secondary cause — and the specific reason you see raw checkboxes instead of styled radio buttons — is that **H5PFontIcons font files are almost certainly failing to load** due to relative `url()` path resolution breaking when CSS is served through your Go proxy from Cloudflare R2. These two issues together fully explain every symptom: no layout formatting, oversized images, and native HTML form controls.

---

## The `h5p-iframe` class gates all H5P base styling

The canonical embed template from `h5p/h5p-php-library/embed.php` produces this exact structure:

```html
<html lang="en" class="h5p-iframe">
<head>
  <meta charset="utf-8">
  <title>Content Title</title>
  <!-- scripts first, then stylesheets -->
  <script src="/h5p/core/js/jquery.js"></script>
  <script src="/h5p/core/js/h5p.js"></script>
  <!-- ... more core + library scripts ... -->
  <link rel="stylesheet" href="/h5p/core/styles/h5p.css">
  <!-- ... more core + library stylesheets ... -->
</head>
<body>
  <div class="h5p-content" data-content-id="123"></div>
  <script>H5PIntegration = { /* ... */ };</script>
</body>
</html>
```

The critical detail is **`class="h5p-iframe"` on the `<html>` element**. The core `h5p.css` contains these selectors that only match with this class present:

```css
html.h5p-iframe, html.h5p-iframe > body {
  font-family: Sans-Serif;
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 0;
}

html.h5p-iframe .h5p-content {
  font-size: 16px;
  line-height: 1.5em;
  width: 100%;
  height: auto;
}
```

Without `html.h5p-iframe`, the body retains its **default 8px margin**, content divs don't get `width: 100%` or the base `font-size: 16px`, and every `em`/`rem`-based measurement in library CSS cascades incorrectly. This single missing class explains oversized images (no width constraint), broken layout (no margin reset, no box model normalization), and general visual chaos despite all CSS files loading successfully. Every H5P implementation — Moodle, WordPress, Drupal, Lumieducation's Node.js library, and `h5p-standalone` — puts this class on the `<html>` element without exception.

---

## Raw checkboxes mean the H5PFontIcons font files aren't loading

H5P MultiChoice does **not** use native `<input type="radio">` elements visually. Instead, multichoice.css hides the native input with `opacity: 0` and renders a custom radio circle via a `::before` pseudo-element on the `.h5p-label` class:

```css
.h5p-answers .h5p-answer .h5p-alternative-container .h5p-label::before {
  font-family: 'H5PFontIcons';
  content: '\e606';  /* empty circle glyph */
}
```

The **H5PFontIcons** font is defined in `H5P.FontIcons/styles/h5p-font-icons.css` via an `@font-face` rule that references font files using relative paths like `url('../fonts/h5p-font-icons.woff')`. When the browser can't load this font, the `::before` pseudo-element renders as invisible or a tofu square, and the native `<input>` becomes the only visible element — producing the exact "raw HTML checkboxes" symptom you describe.

Here's why this breaks in your architecture: your library CSS is served from `https://yoursite.com/api/h5p/libraries/H5P.FontIcons-1.0/styles/h5p-font-icons.css`. The browser resolves the relative `url('../fonts/h5p-font-icons.woff')` to `https://yoursite.com/api/h5p/libraries/H5P.FontIcons-1.0/fonts/h5p-font-icons.woff`. If your Go backend's route pattern doesn't match this resolved path, or if R2 serves the font with a wrong Content-Type, the font silently fails. **Check your browser's Network tab filtered to "Font"** — you'll almost certainly see 404s or CORS errors on the H5PFontIcons files, plus the JoubelUI `joubel.*` font files and possibly FontAwesome files.

---

## h5p.js does not dynamically load CSS in embed mode

A critical architectural distinction that directly affects your implementation: **h5p.js has two completely different code paths for CSS**, and understanding which one applies to your setup determines whether you've built the embed page correctly.

In **iframe mode** (the parent page contains `<div class="h5p-iframe-wrapper"><iframe class="h5p-iframe" ...>` and h5p.js creates the iframe document), h5p.js reads `H5PIntegration.core.styles` and `H5PIntegration.contents["cid-X"].styles` and dynamically injects `<link>` tags into the iframe's `<head>`. It builds the entire iframe document via `srcdoc`, including `<html class="h5p-iframe">`.

In **embed mode** (your approach — serving a complete HTML page via `embed.php` or Go template), h5p.js does **not** inject CSS dynamically. It expects all `<link>` tags to already exist in the `<head>`. The `H5P.init()` function simply scans for `.h5p-content` elements, reads `data-content-id`, looks up `H5PIntegration.contents["cid-X"]`, instantiates the content type library, and calls `attach()`. No CSS loading happens. This means your Go template must pre-render every single CSS `<link>` tag — core styles, plus all library dependency styles resolved from each library's `preloadedCss` in its `library.json`.

The `styles` and `scripts` arrays inside `H5PIntegration.contents["cid-X"]` are consumed only in iframe mode. In embed mode, they're largely informational. However, you should still populate them since some content types may reference them at runtime.

---

## The complete dependency chain your Go template must render

For a MultiChoice content type, the full CSS dependency chain (from `library.json` `preloadedCss` fields, resolved recursively) is:

- **Core CSS**: `h5p.css`, `h5p-confirmation-dialog.css`, `h5p-core-button.css`
- **H5P.FontIcons 1.0**: `styles/h5p-font-icons.css` (defines the `@font-face` for radio/checkbox icons)
- **FontAwesome 4.5**: `h5p-font-awesome.min.css` (action bar icons, etc.)
- **H5P.JoubelUI 1.3**: `css/joubel-icon.css`, `css/joubel-ui.css`, `css/joubel-score-bar.css`, and other `joubel-*.css` files
- **H5P.Question 1.5**: `styles/question.css`
- **H5P.MultiChoice 1.16**: `css/multichoice.css`

Each library's CSS files contain `url()` references to sibling directories (fonts, images). **Every one of these relative paths must resolve correctly through your proxy.** The `@font-face` in `h5p-font-icons.css` points to `../fonts/h5p-font-icons.woff` — relative to the CSS file's URL as the browser sees it. If your Go route for library files is `/api/h5p/libraries/{lib}/{file}`, the CSS file is at `/api/h5p/libraries/H5P.FontIcons-1.0/styles/h5p-font-icons.css`, and the font resolves to `/api/h5p/libraries/H5P.FontIcons-1.0/fonts/h5p-font-icons.woff`. Your Go router must handle this path.

---

## What h5p.js adds to the DOM at runtime

Even in embed mode, h5p.js and the content type libraries modify the DOM during initialization. Understanding this hierarchy is essential for verifying that CSS selectors will match:

```
html.h5p-iframe                          ← must be in your template
  body                                   ← no class required
    div.h5p-content[data-content-id]     ← must be in your template
      div.h5p-container[role=document]   ← added by H5P.Question JS
        div.h5p-question.h5p-multichoice ← added by MultiChoice JS
          div.h5p-question-content
            ul.h5p-answers[role=listbox]
              li.h5p-answer[role=option]
                div.h5p-alternative-container
                  span.h5p-alternative-inner
                    input.h5p-input[type=radio]  ← hidden by CSS
                    label.h5p-label              ← ::before renders icon
```

The `h5p-container` div with `role="document"` is **created by H5P.Question's JavaScript**, not by h5p.js core and not in your template. The `h5p-frame` or `h5p-no-frame` class is added to the `.h5p-content` element by h5p.js based on `displayOptions.frame`. These classes are added during `H5P.init()` execution, so they depend on JavaScript running correctly — which you've confirmed it does.

---

## Concrete debugging steps and the fix

**Step 1: Add `class="h5p-iframe"` to your Go template's `<html>` element.** Your Go `html/template` should produce:

```html
<!doctype html>
<html class="h5p-iframe" lang="en">
<head>
  <meta charset="utf-8">
  {{range .Scripts}}<script src="{{.}}"></script>{{end}}
  {{range .Styles}}<link rel="stylesheet" href="{{.}}">{{end}}
</head>
<body>
  <div class="h5p-content" data-content-id="{{.ContentID}}"></div>
  <script>H5PIntegration = {{.Integration}};</script>
</body>
</html>
```

Note the canonical embed.php uses `<!doctype html>` (lowercase, no closing angle bracket issues) and loads scripts before stylesheets in the head.

**Step 2: Verify font file paths resolve through your proxy.** Open DevTools → Network → filter by "Font". You should see requests for `h5p-font-icons.woff`, `joubel.woff`, and `fontawesome-webfont.woff`. If these show 404, your Go router isn't matching the resolved relative paths from the CSS `url()` declarations. The fix is ensuring your `/api/h5p/libraries/{lib}/{file}` route accepts nested paths like `/api/h5p/libraries/H5P.FontIcons-1.0/fonts/h5p-font-icons.woff` — not just single-level file paths.

**Step 3: Check for BOM or encoding issues in R2-served CSS.** Fetch one of your library CSS files with `curl -s URL | xxd | head` and verify the first bytes are not `EF BB BF` (UTF-8 BOM). A BOM before the first CSS rule can cause the browser to silently skip that rule. This is uncommon but worth checking since R2 serves files as uploaded.

**Step 4: Inspect computed styles.** In DevTools, select the `<html>` element inside your iframe and check computed styles. With `class="h5p-iframe"` present, you should see `margin: 0`, `padding: 0`, `width: 100%`, `height: 100%`. On the `.h5p-content` div, you should see `font-size: 16px`. If these don't appear even after adding the class, there's a CSS loading order or specificity issue.

**Step 5: Confirm the `data-content-id` matches the H5PIntegration key.** The attribute must be a number (e.g., `data-content-id="123"`) and the H5PIntegration key must be `"cid-123"` — the `cid-` prefix is mandatory. A mismatch means `H5P.init()` finds the div but can't look up the content configuration, so no content type gets instantiated.

---

## Why no existing Go implementation exists to reference

There are **zero Go-based H5P implementations** in public repositories. The H5P ecosystem consists of the PHP reference library, Lumieducation's `@lumieducation/h5p-server` (Node.js/TypeScript), and the client-side `h5p-standalone` player. The H5P documentation explicitly notes that creating a new platform integration is "very hard work." Your Go backend is pioneering territory, which is why the embed page structure details matter so much — there's no existing Go template to copy from, and the required HTML structure is only implicitly documented through PHP source code.

---

## Conclusion

The fix is almost certainly a two-line change. First, add `class="h5p-iframe"` to your `<html>` element — this is the gate that enables all H5P base CSS selectors. Second, ensure your Go router handles the nested font file paths that CSS `url()` references resolve to when library CSS is served through your proxy. The raw-checkbox symptom specifically points to the **H5PFontIcons** `@font-face` failing: `multichoice.css` hides native inputs and renders custom radio circles via `::before` pseudo-elements using this font family. If the font can't load, the pseudo-element is invisible and the hidden native input becomes the only interactive element. After fixing the `<html>` class and font paths, verify by checking DevTools → Computed Styles on `<html>` for `margin: 0` and the Network → Font tab for successful `h5p-font-icons.woff` loads.