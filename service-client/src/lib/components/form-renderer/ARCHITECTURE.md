# Form Renderer Architecture

## Overview

The form renderer system renders dynamic multi-step forms with agency branding, validation, and multiple layout modes. Forms are defined as JSON schemas (`FormSchema`) and rendered by `DynamicForm.svelte`.

## Component Hierarchy

```
FormBranding          (theme, logo, header, card wrapper)
  DynamicForm         (orchestrates steps, validation, state)
    FormSidebar       (wizard layout - step navigation)
    FormStep          (step title/description container)
      FieldRenderer   (renders individual fields by type)
    FormNav           (Back / Continue / Submit buttons)
```

## File Structure

```
form-renderer/
  DynamicForm.svelte       Main renderer - multi-step, validation, layouts
  FieldRenderer.svelte     Routes field types to appropriate input
  FormBranding.svelte      Applies DaisyUI theme, renders logo/header/card
  FormStep.svelte          Step title and description wrapper
  FormNav.svelte           Navigation buttons with primary color styling
  FormSidebar.svelte       Wizard sidebar - step list, progress, completion
  index.ts                 Module exports
  utils/
    theme-generator.ts     Generates DaisyUI theme CSS from branding colors
```

## Key Design Decisions

### 1. Colors: HSL Format Required

**The branding system expects HSL space-separated values, NOT hex.**

```typescript
// CORRECT - what the theme generator needs
colors.primary = "220 90% 56%";

// WRONG - hex will produce invalid CSS
colors.primary = "#4F46E5";
```

**Why:** The theme generator calls `toCommaHSL()` which splits by whitespace and joins with commas. A hex value like `#4F46E5` has no whitespace, so it passes through unchanged. The resulting CSS `--p: #4F46E5;` makes `hsl(var(--p))` invalid.

**The fix:** Always convert hex to HSL when constructing branding from database values:

```typescript
import { hexToHsl } from "$lib/components/form-renderer/utils/theme-generator";

function toHsl(hex: string | null | undefined): string | undefined {
  if (!hex) return undefined;
  return hex.startsWith("#") ? hexToHsl(hex) : hex;
}

const colors = {
  ...defaultAgencyBranding.colors,
  primary: toHsl(agency.primaryColor) || defaultAgencyBranding.colors.primary,
};
```

The database stores colors as hex (`primary_color TEXT DEFAULT '#4F46E5'`). The `defaultAgencyBranding` uses HSL. Every page that constructs `ResolvedBranding` from DB values must convert.

### 2. Theme CSS Variable Flow

```
Agency DB (hex)
  → hexToHsl() → "220 90% 56%" (space-separated)
    → theme-generator.ts → toCommaHSL() → "220, 90%, 56%" (comma-separated)
      → CSS: --p: 220, 90%, 56%;
        → Components use: hsl(var(--p)), hsla(var(--p), 0.1)
```

The generated theme is injected into `<svelte:head>` as a `<style>` tag with `[data-theme="webkit-HASH"]` selector. The `FormBranding` wrapper div applies `data-theme={themeName}` so all children inherit the CSS variables.

**DaisyUI v5 compatibility:** This project uses DaisyUI v5 (oklch-based) but the custom theme generator uses legacy `--p`, `--s`, `--a`, `--b1`, `--bc` variable names with HSL values. This works because the custom `[data-theme]` selector overrides DaisyUI's built-in theme variables.

### 3. Preview Mode Behavior

When `previewMode={true}`:
- Validation is skipped on step advancement
- All sidebar steps are clickable (free navigation)
- **Step completion is always `false`** - no green checkmarks appear
- **Progress is always 0%** - no false progress indicators
- The form is purely for visual/UX preview, not data entry

This prevents steps with no required fields from incorrectly showing as "complete" in preview.

### 4. Step Completion Logic (Non-Preview)

Steps are marked complete only when:
1. The user has **visited past them** (`index < currentStepIndex`)
2. AND all required fields in the step have non-empty values

```typescript
// Step is only complete if visited AND data-filled
const isVisited = index < currentStepIndex;
const isComplete = isVisited && stepCompletion[index];
```

This prevents prefilled data (e.g., from client picker) from showing steps as complete before the user has actually reviewed them.

### 5. Layout Modes

| Layout | Sidebar | Navigation | Width |
|--------|---------|-----------|-------|
| `single-column` | No | Bottom buttons + progress bar | 640px |
| `two-column` | No | Bottom buttons + progress bar | 640px |
| `wizard` | Yes (desktop) | FormNav below content | 1024px |
| `card` | No | Bottom buttons | 640px |

The wizard layout renders `FormSidebar` on desktop and a mobile progress bar on smaller screens. Users advance via the "Continue" button (FormNav), not by clicking unvisited sidebar steps.

### 6. Sidebar Navigation Rules

- **Active step:** Blue indicator circle, blue title text, pulsing dot
- **Visited + complete:** Green checkmark indicator
- **Visited + incomplete:** Gray number (can click to go back)
- **Unvisited:** Gray number, disabled (opacity 0.4, no click)
- **Preview/ReadOnly:** All steps clickable regardless of visit status

### 7. FormBranding Wrapper

`FormBranding` wraps ALL form content (including sidebar in wizard mode). It:
- Generates and injects theme CSS via `<svelte:head>`
- Applies `data-theme` for CSS variable scoping
- Renders logo, title/subtitle header, premium card with accent line
- Applies gradient background, noise texture overlay
- Forces `color-scheme: light` to prevent browser dark mode interference
- Imports premium fonts (DM Sans, DM Serif Display)

All child components (FormSidebar, FormNav, FieldRenderer) use `hsl(var(--p))` etc. in their scoped `<style>` blocks, inheriting the theme from FormBranding's `data-theme` attribute.

### 8. Form Data Flow

```
Schema defaults (getInitialFormData)
  → merged with initialData prop (if any)
    → user edits via handleFieldChange
      → validation on step advance (validateStep)
        → onStepChange callback (save progress)
          → onSubmit callback (final submit)
```

### 9. Option Sets

Fields can reference reusable option sets via `optionSetSlug`:

```typescript
// Field definition
{ type: "select", optionSetSlug: "industry", ... }

// DynamicForm resolves options from two sources:
// 1. options prop: Record<string, FieldOption[]>
// 2. optionSets prop: { slug, options }[] (raw DB format)
// Both are merged into resolvedOptions
```

### 10. Read-Only Mode

When `readOnly={true}`:
- All fields render as disabled/non-interactive
- No submit/save buttons shown
- Sidebar allows free navigation (like preview)
- Two-column grid applied for better data display
- Max width increased to 900px

## Pages That Render DynamicForm

| Page | Mode | Branding Source |
|------|------|-----------------|
| `/forms/[agencySlug]/[formSlug]` | Normal (submit) | Agency DB colors (hex→HSL) |
| `/(app)/[agencySlug]/consultation` | Normal (submit) | Agency DB colors (hex→HSL) |
| `/(app)/[agencySlug]/consultation/edit/[id]` | Edit (save+submit) | Agency DB colors (hex→HSL) |
| `/(app)/[agencySlug]/consultation/view/[id]` | Read-only | Agency DB colors (hex→HSL) |
| `/(app)/[agencySlug]/settings/forms/preview/[slug]` | Preview | Hardcoded HSL defaults |

## Schema vs UIConfig: Two-Column Architecture

The `agency_forms` table stores form data in **two separate columns**:

| Column | Purpose | Version Bump? |
|--------|---------|---------------|
| `schema` (jsonb) | Structural: steps, fields, validation | Yes |
| `ui_config` (jsonb) | Cosmetic: layout, buttons, progress bar | No |

**Why separate?** Changing layout from wizard to simple shouldn't:
- Bump the form version (version tracks structural changes)
- Mark template-derived forms as "customized" (which blocks push updates)

### Unified Access Pattern

Use `buildFormSchema()` to merge on read, `extractUiConfig()` to split on write:

```typescript
import { buildFormSchema, extractUiConfig } from "$lib/components/form-builder/utils/schema-generator";

// READING: Merge uiConfig into schema for rendering
const schema = buildFormSchema(form.schema, form.uiConfig);
// schema.uiConfig now contains the merged UI settings

// WRITING: Extract uiConfig back to separate column
const { schema: schemaOnly, uiConfig } = extractUiConfig(builderSchema);
await updateForm({ id, schema: schemaOnly, uiConfig });
```

**The `ui_config` column wins** when both sources have a value — it's the source of truth for UI settings. The layout toggle on the settings/forms page writes directly to this column.

### Where These Are Used

| Context | Read | Write |
|---------|------|-------|
| Form Editor (Builder) | `buildFormSchema()` | `extractUiConfig()` |
| Preview Page | `buildFormSchema()` | N/A |
| Public Form Page | `buildFormSchema()` | N/A |
| Consultation (new/edit/view) | `buildFormSchema()` | N/A |
| Super-Admin Template Editor | `buildFormSchema()` | `extractUiConfig()` |
| Settings Layout Toggle | N/A | Updates `uiConfig` only |

## Common Pitfalls

1. **Passing hex colors directly** - Always use `hexToHsl()` when building branding from DB values
2. **Steps showing false completion** - Ensure `previewMode` disables completion tracking
3. **Sidebar colors not showing** - Check that the component is inside `<FormBranding>` wrapper
4. **DaisyUI variable conflicts** - The custom theme uses legacy `--p` variable names; ensure no DaisyUI utility classes override them in the same element
5. **exactOptionalPropertyTypes** - When setting optional color properties, use conditional assignment (`if (value) colors.prop = value`) not `prop: value || undefined`
6. **FormOverrides merging** - DynamicForm merges both `branding.formOverrides` and `schema.formOverrides` into `mergedFormOverrides`, with schema taking priority
7. **Schema/UIConfig split** - Never pass `form.schema` directly to DynamicForm or Builder. Always use `buildFormSchema(form.schema, form.uiConfig)` to merge the separate DB columns. Raw `form.schema` won't have layout settings from the `ui_config` column
