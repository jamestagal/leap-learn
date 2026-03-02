# H5P Per-Organisation Theming

## Context

H5P.com recently launched "Content Look and Feel" — per-org theming with preset themes (Daylight, Lavender, Mint, Sunset), custom themes, density control, and visibility rollout. Our embed player already uses the new H5P theme system (`h5p-theme-variables.css`), which means all `--h5p-theme-*` CSS variables are active. We can replicate and extend H5P.com's feature.

Reference: `.claude/notes/h5p-player/css-architecture.md` for how CSS works in our embed player.

## How H5P.com Does It

### Visibility (rollout control)
- **Off** — disabled for all users (default for existing orgs)
- **Admins only** — preview mode for testing CSS/themes
- **Everyone** — live for all users including learners

### Themes (preset + custom)
- **Daylight** (default) — blue CTA, light backgrounds, WCAG 2.0 AA
- **Lavender** — purple tones
- **Mint** — teal/green tones
- **Sunset** — warm orange/red tones
- **Custom Theme** — org picks colors for: buttons, navigation, backgrounds, answer spaces

### Density
- **Wide** (default) — more spacing, better readability
- **Comfortable** — medium spacing
- **Compact** — tighter spacing

### Supported content types (at launch)
Accordion, Audio Recorder, Chart, Collage, Course Presentation, Dialog Cards, Documentation Tool, Drag and Drop, Drag the Words, Essay, Fill in the Blanks, Find the Hotspots, Flashcards, Guess the Answer, Image Hotspots, Image Slider, Interactive Book, Interactive Video, Mark the Words, Memory Game, Multimedia Choice, Multiple Choice, Page (Column), Question Set, Single Choice Set, Summary, True/False. Plus sub-content: Text, Table, Video, Audio, Link.

### Known limitations
- Chase, Multipoll remain legacy design
- Branching Scenario, Game Map: subcontent gets new theme, container stays legacy
- Density doesn't apply to fixed-height types (Course Presentation, Drag and Drop)

## Technical Architecture

### How it works (our implementation)

The embed HTML is **server-rendered per request** with `orgId` already available in `getPlayContext()`. This is the key enabler — we inject org-specific CSS variable overrides into the template's `<style>` block. No library CSS modification needed.

```
Browser request → SvelteKit proxy → Go handleH5PPlayEmbed()
                                         ↓
                                    Load org theme settings from DB
                                         ↓
                                    Inject CSS variable overrides into <style>
                                         ↓
                                    Render embed HTML with theme
```

### CSS variable mapping

All theming flows through `--h5p-theme-*` CSS custom properties defined in `h5p-theme-variables.css`. Overriding these in a `<style>` block with higher specificity (or later in cascade) changes the entire look.

| Setting | CSS Variable(s) |
|---------|-----------------|
| Primary button color | `--h5p-theme-main-cta-base`, `--h5p-theme-main-cta-light`, `--h5p-theme-main-cta-dark` |
| Button text color | `--h5p-theme-contrast-cta`, `--h5p-theme-contrast-cta-white` |
| Answer background | `--h5p-theme-alternative-base`, `--h5p-theme-alternative-light`, `--h5p-theme-alternative-dark` |
| Secondary button | `--h5p-theme-secondary-cta-base`, `--h5p-theme-secondary-cta-light`, `--h5p-theme-secondary-cta-dark` |
| Text colors | `--h5p-theme-text-primary`, `--h5p-theme-text-secondary`, `--h5p-theme-text-third` |
| Background | `--h5p-theme-background`, `--h5p-theme-ui-base` |
| Borders | `--h5p-theme-stroke-1`, `--h5p-theme-stroke-2`, `--h5p-theme-stroke-3` |
| Border radius | `--h5p-theme-border-radius-large`, `-medium`, `-small` |
| Font | `--h5p-theme-font-name` |
| Correct feedback | `--h5p-theme-feedback-correct-main`, `-secondary`, `-third` |
| Incorrect feedback | `--h5p-theme-feedback-incorrect-main`, `-secondary`, `-third` |

### Density mapping

Density = scaling the spacing and font-size multipliers. The theme variables already support small/medium/large via `.h5p-content`, `.h5p-content.h5p-medium`, `.h5p-content.h5p-large`.

| Density | Implementation |
|---------|---------------|
| Compact | Use default `.h5p-content` (small, scaling: 0.6) |
| Comfortable | Add `.h5p-medium` class to `.h5p-content` div (scaling: 0.8) |
| Wide | Add `.h5p-large` class to `.h5p-content` div (scaling: 1.0) |

## Database Schema

### Migration: `0XX_h5p_theme_settings.sql`

```sql
CREATE TABLE IF NOT EXISTS h5p_theme_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,

    -- Visibility: 'off', 'admins', 'everyone'
    visibility TEXT NOT NULL DEFAULT 'everyone',

    -- Theme preset: 'daylight', 'lavender', 'mint', 'sunset', 'custom'
    theme_preset TEXT NOT NULL DEFAULT 'daylight',

    -- Custom theme colors (only used when theme_preset = 'custom')
    custom_primary_color TEXT,         -- maps to --h5p-theme-main-cta-base
    custom_secondary_color TEXT,       -- maps to --h5p-theme-secondary-cta-base
    custom_background_color TEXT,      -- maps to --h5p-theme-alternative-base
    custom_text_color TEXT,            -- maps to --h5p-theme-text-primary
    custom_ui_background TEXT,         -- maps to --h5p-theme-ui-base
    custom_border_radius TEXT,         -- 'sharp', 'rounded', 'pill'
    custom_font_name TEXT,             -- maps to --h5p-theme-font-name

    -- Density: 'compact', 'comfortable', 'wide'
    density TEXT NOT NULL DEFAULT 'wide',

    -- Custom CSS (advanced, like H5P.com's Custom CSS feature)
    custom_css TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE(organisation_id)
);
```

### Preset theme values

```go
var themePresets = map[string]map[string]string{
    "daylight": {
        "--h5p-theme-main-cta-base":       "#006FBF",
        "--h5p-theme-alternative-base":    "#F1F5FB",
        "--h5p-theme-background":          "#F9FBFF",
        "--h5p-theme-secondary-cta-base":  "#E3E9F1",
    },
    "lavender": {
        "--h5p-theme-main-cta-base":       "#7C3AED",
        "--h5p-theme-alternative-base":    "#F3F0FF",
        "--h5p-theme-background":          "#FAFAFF",
        "--h5p-theme-secondary-cta-base":  "#E8E0F7",
    },
    "mint": {
        "--h5p-theme-main-cta-base":       "#0D9488",
        "--h5p-theme-alternative-base":    "#ECFDF5",
        "--h5p-theme-background":          "#F0FDF9",
        "--h5p-theme-secondary-cta-base":  "#D1FAE5",
    },
    "sunset": {
        "--h5p-theme-main-cta-base":       "#DC2626",
        "--h5p-theme-alternative-base":    "#FEF2F2",
        "--h5p-theme-background":          "#FFFBFB",
        "--h5p-theme-secondary-cta-base":  "#FEE2E2",
    },
}
```

Note: exact color values for Lavender/Mint/Sunset need to be matched to H5P.com's implementation. The above are approximations. Auto-derive light/dark/contrast variants from the base using `color-mix()` in CSS or server-side computation.

## Implementation Plan

### Phase 1: Backend — Theme injection in embed

**Files:**
- `app/service-core/storage/schema_postgres.sql` — add table
- `migrations/0XX_h5p_theme_settings.sql` — migration
- `app/service-core/storage/query_postgres.sql` — sqlc query
- `app/service-core/rest/h5p_play_route.go` — inject theme CSS

**Changes to embed template:**

Add `ThemeCss` field to `embedData`:
```go
type embedData struct {
    Title           string
    CoreCss         []string
    CoreJs          []string
    LibraryCss      []string
    LibraryJs       []string
    IntegrationJSON template.JS
    ThemeCss        template.CSS   // NEW: org theme CSS variable overrides
    DensityClass    string         // NEW: "h5p-medium" or "h5p-large" or ""
}
```

Template changes:
```html
<style>
    body { margin: 0; padding: 0; }
    .h5p-content { width: 100%; }
    {{.ThemeCss}}
</style>
...
<div class="h5p-content {{.DensityClass}}" data-content-id="1"></div>
```

**`handleH5PPlayEmbed` changes:**
1. Query `h5p_theme_settings` for the org
2. Check visibility (if 'off', skip; if 'admins', check user role)
3. Build CSS override string from preset or custom values
4. Pass to template

### Phase 2: Frontend — Settings UI

**Location:** `service-client/src/routes/(app)/[organisationSlug]/settings/h5p-theme/+page.svelte`

**UI sections (matching H5P.com):**

1. **Content Look and Feel Settings** (accordion/collapsible)
   - Visibility radio: Off / Admins only / Everyone

2. **Theme** selector
   - Dropdown with preview swatches: Daylight, Lavender, Mint, Sunset, Custom Theme
   - When "Custom Theme" selected → show color pickers for:
     - Primary button color
     - Secondary button color
     - Background color
     - Text color
     - Answer space color
     - Border radius (sharp/rounded/pill)

3. **Density** selector
   - Radio or dropdown: Compact / Comfortable / Wide
   - Description text for each option

4. **Preview** panel
   - Live iframe showing sample H5P content with current settings
   - Updates in real-time as settings change

5. **Custom CSS** (advanced, collapsible)
   - Code editor textarea
   - Preview/Live toggle (like H5P.com)
   - Warning about potential breakage

**Remote functions:**
- `getH5pThemeSettings(orgId)` — query
- `updateH5pThemeSettings(orgId, settings)` — command

### Phase 3: Custom CSS feature

- Preview vs Live CSS (admin can test before publishing)
- CSS injected after theme variables in embed template
- Sanitize CSS input (strip `<script>`, `url()` with non-https, `@import`)

## Files to Create/Modify

| File | Action |
|------|--------|
| `migrations/0XX_h5p_theme_settings.sql` | Create: new table |
| `app/service-core/storage/schema_postgres.sql` | Update: add table |
| `app/service-core/storage/query_postgres.sql` | Update: add queries |
| `app/service-core/rest/h5p_play_route.go` | Update: inject theme CSS, density class |
| `service-client/src/lib/server/schema.ts` | Update: Drizzle schema |
| `service-client/src/lib/api/h5p-theme.remote.ts` | Create: remote functions |
| `service-client/src/routes/(app)/[organisationSlug]/settings/h5p-theme/+page.svelte` | Create: settings UI |
| `service-client/src/routes/(app)/[organisationSlug]/settings/h5p-theme/+page.server.ts` | Create: page data |

## Unresolved Questions

1. **Exact preset colors** — Need to inspect H5P.com's actual CSS variable values for Lavender, Mint, Sunset themes. Can be done by enabling each theme on H5P.com and reading computed `:root` variables in DevTools.
2. **Auto-derive variant colors** — When org sets a primary color, do we auto-compute `--h5p-theme-main-cta-light` and `--h5p-theme-main-cta-dark`? CSS `color-mix()` could handle this client-side, or we compute server-side.
3. **Visibility + role check** — The embed endpoint currently just checks auth. For "admins only" visibility, we'd need to check org membership role in `handleH5PPlayEmbed`.
4. **Editor theming** — Should the H5P editor also reflect the org theme? Currently editor and player use different CSS paths.
5. **Custom CSS sanitization** — How aggressively to sanitize? H5P.com allows arbitrary CSS. We could use a CSS parser to whitelist properties, or just sanitize for XSS vectors.
6. **Font customization** — Allow orgs to use custom fonts? Would need font upload or Google Fonts integration.
