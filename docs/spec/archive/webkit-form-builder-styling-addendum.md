# WebKit Form Builder: Styling & Agency Branding Addendum

**Addendum to:** webkit-form-builder-integration-spec-v2.md  
**Version:** 1.0  
**Last Updated:** January 2026

---

## Overview

This addendum details the **complete styling architecture** for client-facing forms rendered by the Form Builder system. It ensures that each agency's forms look visually distinct while maintaining a consistent, professional appearance.

**Key Technologies:**
- **Tailwind CSS** - Utility-first CSS framework
- **DaisyUI** - Component library with theming system
- **shadcn-svelte** - Accessible component primitives
- **CSS Variables** - Runtime theme customization

---

## Table of Contents

1. [Styling Architecture](#1-styling-architecture)
2. [Agency Branding System](#2-agency-branding-system)
3. [DaisyUI Theme Integration](#3-daisyui-theme-integration)
4. [TypeScript Interfaces](#4-typescript-interfaces)
5. [FormBranding Component](#5-formbranding-component)
6. [Theme Generator Utility](#6-theme-generator-utility)
7. [Database Schema Updates](#7-database-schema-updates)
8. [Branding UI in Agency Settings](#8-branding-ui-in-agency-settings)
9. [Example Configurations](#9-example-configurations)

---

## 1. Styling Architecture

### 1.1 Two-Layer Styling System

```
┌──────────────────────────────────────────────────────────────────────────┐
│  LAYER 1: Agency Branding (Global)                                       │
│  ─────────────────────────────────                                       │
│  Applied to ALL forms for this agency                                    │
│                                                                          │
│  • Primary/Secondary/Accent colors                                       │
│  • Logo & favicon                                                        │
│  • Font family (headings + body)                                         │
│  • Border radius preference                                              │
│  • Button style (solid, outline, ghost)                                  │
│  • Dark/Light mode preference                                            │
│                                                                          │
│  Stored in: agencies.branding (JSONB)                                    │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Inherits + Can Override
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  LAYER 2: Form-Specific Overrides (Per Form)                             │
│  ──────────────────────────────────────────                              │
│  Optional overrides for specific forms                                   │
│                                                                          │
│  • Background color/image                                                │
│  • Custom header text                                                    │
│  • Submit button text                                                    │
│  • Success message & redirect                                            │
│  • Layout (single-column, two-column, card)                              │
│  • Progress bar style                                                    │
│  • Custom CSS (advanced)                                                 │
│                                                                          │
│  Stored in: agency_forms.branding (JSONB, nullable)                      │
└──────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Styling Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Agency    │     │   DaisyUI   │     │    Form     │     │  Rendered   │
│  Branding   │────▶│   Theme     │────▶│  Branding   │────▶│    Form     │
│   (DB)      │     │ Generation  │     │  Component  │     │    (UI)     │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
      │                                        │
      │                                        │
      ▼                                        ▼
 primaryColor                           CSS Variables
 secondaryColor                         injected at runtime
 fontFamily                             via <style> tag
 borderRadius
 etc.
```

---

## 2. Agency Branding System

### 2.1 What Agencies Can Customize

| Category | Properties | Default |
|----------|------------|---------|
| **Colors** | Primary, Secondary, Accent, Neutral, Base (background), Error, Success, Warning, Info | DaisyUI "light" theme |
| **Typography** | Heading font, Body font, Font sizes | System fonts |
| **Logo** | URL, Height, Position (left/center) | None |
| **Borders** | Radius (none/sm/md/lg/full), Border width | md (0.5rem) |
| **Buttons** | Style (solid/outline/ghost/soft), Roundness | solid |
| **Layout** | Max width, Padding, Card style | 640px |
| **Mode** | Light/Dark/System preference | light |

### 2.2 Color System (DaisyUI Compatible)

DaisyUI uses a semantic color system that maps perfectly to agency branding:

```
DaisyUI Color         Agency Branding Use
─────────────         ───────────────────
primary            →  Main brand color (buttons, links, focus rings)
primary-content    →  Text on primary color
secondary          →  Secondary brand color
secondary-content  →  Text on secondary
accent             →  Highlights, badges
accent-content     →  Text on accent
neutral            →  Dark surfaces, footers
neutral-content    →  Text on neutral
base-100           →  Main background
base-200           →  Subtle background (cards)
base-300           →  Borders, dividers
base-content       →  Main text color
info               →  Informational elements
success            →  Success states
warning            →  Warning states
error              →  Error states, validation
```

---

## 3. DaisyUI Theme Integration

### 3.1 How DaisyUI Themes Work

DaisyUI themes are defined as CSS variables. WebKit will generate a custom theme per agency at runtime.

```css
/* DaisyUI theme structure */
[data-theme="agency-acme-corp"] {
  --p: 220 90% 56%;           /* primary (HSL values) */
  --pf: 220 90% 46%;          /* primary-focus */
  --pc: 0 0% 100%;            /* primary-content */
  
  --s: 280 70% 50%;           /* secondary */
  --sf: 280 70% 40%;          /* secondary-focus */
  --sc: 0 0% 100%;            /* secondary-content */
  
  --a: 45 100% 50%;           /* accent */
  --af: 45 100% 40%;          /* accent-focus */
  --ac: 0 0% 0%;              /* accent-content */
  
  --n: 220 14% 20%;           /* neutral */
  --nf: 220 14% 15%;          /* neutral-focus */
  --nc: 0 0% 100%;            /* neutral-content */
  
  --b1: 0 0% 100%;            /* base-100 (background) */
  --b2: 220 14% 96%;          /* base-200 */
  --b3: 220 14% 90%;          /* base-300 */
  --bc: 220 14% 10%;          /* base-content */
  
  --in: 198 93% 60%;          /* info */
  --su: 158 64% 52%;          /* success */
  --wa: 43 96% 56%;           /* warning */
  --er: 0 91% 71%;            /* error */
  
  --rounded-box: 0.5rem;      /* border radius for cards */
  --rounded-btn: 0.5rem;      /* border radius for buttons */
  --rounded-badge: 1.9rem;    /* border radius for badges */
  --btn-focus-scale: 0.95;    /* button scale on focus */
  --animation-btn: 0.25s;     /* button animation duration */
  --animation-input: 0.2s;    /* input animation duration */
  --btn-text-case: uppercase; /* button text transform */
  --tab-radius: 0.5rem;       /* tab border radius */
}
```

### 3.2 Integration with shadcn-svelte

shadcn-svelte and DaisyUI can coexist. We'll use:
- **DaisyUI** for theming (colors, typography, border-radius)
- **shadcn-svelte** for component primitives (accessibility, behavior)
- **Tailwind** for layout and spacing

```svelte
<!-- Example: Input using both DaisyUI theme + shadcn structure -->
<Input 
  class="input input-bordered w-full"
  placeholder="Enter your email"
/>

<!-- The 'input' and 'input-bordered' classes come from DaisyUI -->
<!-- The component behavior comes from shadcn-svelte -->
<!-- Colors automatically use the agency's theme -->
```

---

## 4. TypeScript Interfaces

### 4.1 AgencyBranding Interface

```typescript
// src/lib/types/branding.ts

/**
 * Complete agency branding configuration
 * Stored in agencies.branding (JSONB)
 */
export interface AgencyBranding {
  // ─────────────────────────────────────────────────────────────
  // COLORS (HSL values without 'hsl()' wrapper, e.g., "220 90% 56%")
  // ─────────────────────────────────────────────────────────────
  colors: {
    primary: string;           // Main brand color
    primaryFocus?: string;     // Darker primary for hover/focus (auto-generated if not set)
    primaryContent?: string;   // Text on primary (auto-calculated if not set)
    
    secondary?: string;        // Secondary brand color
    secondaryFocus?: string;
    secondaryContent?: string;
    
    accent?: string;           // Highlight color
    accentFocus?: string;
    accentContent?: string;
    
    neutral?: string;          // Dark surfaces
    neutralFocus?: string;
    neutralContent?: string;
    
    base100: string;           // Main background
    base200?: string;          // Card background (auto-calculated)
    base300?: string;          // Borders (auto-calculated)
    baseContent?: string;      // Main text color (auto-calculated)
    
    // Semantic colors (optional - defaults provided)
    info?: string;
    success?: string;
    warning?: string;
    error?: string;
  };
  
  // ─────────────────────────────────────────────────────────────
  // TYPOGRAPHY
  // ─────────────────────────────────────────────────────────────
  typography?: {
    headingFont?: string;      // e.g., "Playfair Display, serif"
    bodyFont?: string;         // e.g., "Inter, system-ui, sans-serif"
    
    // Font sizes (rem values)
    baseFontSize?: number;     // Default: 1 (16px)
    headingScale?: number;     // Multiplier for heading sizes, default: 1.25
  };
  
  // ─────────────────────────────────────────────────────────────
  // LOGO
  // ─────────────────────────────────────────────────────────────
  logo?: {
    url: string;               // URL to logo image
    darkUrl?: string;          // Alternative logo for dark mode
    height?: number;           // Height in pixels, default: 40
    position?: "left" | "center";  // Position in form header
  };
  
  // ─────────────────────────────────────────────────────────────
  // BORDERS & SHAPES
  // ─────────────────────────────────────────────────────────────
  borders?: {
    radius?: "none" | "sm" | "md" | "lg" | "xl" | "full";  // Default: "md"
    inputRadius?: "none" | "sm" | "md" | "lg" | "full";    // Input-specific
    buttonRadius?: "none" | "sm" | "md" | "lg" | "full";   // Button-specific
    cardRadius?: "none" | "sm" | "md" | "lg" | "xl";       // Card-specific
  };
  
  // ─────────────────────────────────────────────────────────────
  // BUTTONS
  // ─────────────────────────────────────────────────────────────
  buttons?: {
    style?: "solid" | "outline" | "ghost" | "soft";        // Default: "solid"
    textTransform?: "none" | "uppercase" | "capitalize";   // Default: "none"
    focusScale?: number;       // Scale on focus, default: 0.98
  };
  
  // ─────────────────────────────────────────────────────────────
  // LAYOUT
  // ─────────────────────────────────────────────────────────────
  layout?: {
    maxWidth?: string;         // e.g., "640px", "800px", "100%"
    padding?: string;          // e.g., "1.5rem", "2rem"
    cardStyle?: "flat" | "bordered" | "elevated";  // Default: "bordered"
  };
  
  // ─────────────────────────────────────────────────────────────
  // MODE
  // ─────────────────────────────────────────────────────────────
  mode?: "light" | "dark" | "system";  // Default: "light"
  
  // ─────────────────────────────────────────────────────────────
  // ADVANCED
  // ─────────────────────────────────────────────────────────────
  customCss?: string;          // Raw CSS for advanced customization
}

/**
 * Form-specific branding overrides
 * Stored in agency_forms.branding (JSONB, nullable)
 */
export interface FormBrandingOverrides {
  // Override any AgencyBranding property
  colors?: Partial<AgencyBranding["colors"]>;
  typography?: Partial<AgencyBranding["typography"]>;
  borders?: Partial<AgencyBranding["borders"]>;
  buttons?: Partial<AgencyBranding["buttons"]>;
  layout?: Partial<AgencyBranding["layout"]>;
  mode?: AgencyBranding["mode"];
  
  // Form-specific additions
  background?: {
    color?: string;            // Background color override
    image?: string;            // Background image URL
    overlay?: string;          // Overlay color (for image backgrounds)
  };
  
  header?: {
    title?: string;            // Custom form title
    subtitle?: string;         // Custom subtitle
    showLogo?: boolean;        // Override logo visibility
  };
  
  footer?: {
    text?: string;             // Footer text
    showPoweredBy?: boolean;   // Show "Powered by WebKit"
  };
  
  customCss?: string;          // Form-specific CSS
}

/**
 * Merged branding (agency defaults + form overrides)
 * This is what gets passed to FormBranding component
 */
export interface ResolvedBranding extends AgencyBranding {
  formOverrides?: FormBrandingOverrides;
}
```

### 4.2 Border Radius Mapping

```typescript
// src/lib/utils/branding.ts

export const radiusMap = {
  none: "0",
  sm: "0.25rem",
  md: "0.5rem",
  lg: "0.75rem",
  xl: "1rem",
  full: "9999px"
} as const;

export const buttonStyleMap = {
  solid: "btn-primary",
  outline: "btn-outline btn-primary",
  ghost: "btn-ghost",
  soft: "btn-primary btn-soft"
} as const;

export const cardStyleMap = {
  flat: "",
  bordered: "border border-base-300",
  elevated: "shadow-lg"
} as const;
```

---

## 5. FormBranding Component

### 5.1 Main Component

```svelte
<!-- src/lib/components/form-renderer/FormBranding.svelte -->
<script lang="ts">
  import type { ResolvedBranding, FormBrandingOverrides } from "$lib/types/branding";
  import { generateDaisyTheme } from "$lib/utils/theme-generator";
  import { radiusMap, cardStyleMap } from "$lib/utils/branding";
  import { onMount } from "svelte";
  
  interface Props {
    branding?: ResolvedBranding;
    formOverrides?: FormBrandingOverrides;
    children: any;
  }
  
  let { branding, formOverrides, children }: Props = $props();
  
  // Generate unique theme name for this agency
  const themeName = $derived(
    branding ? `webkit-${hashString(JSON.stringify(branding.colors))}` : "light"
  );
  
  // Generate DaisyUI theme CSS
  const themeCSS = $derived(
    branding ? generateDaisyTheme(themeName, branding) : ""
  );
  
  // Merge agency branding with form overrides
  const resolved = $derived({
    ...branding,
    ...formOverrides,
    colors: { ...branding?.colors, ...formOverrides?.colors },
    typography: { ...branding?.typography, ...formOverrides?.typography },
    borders: { ...branding?.borders, ...formOverrides?.borders },
    layout: { ...branding?.layout, ...formOverrides?.layout }
  });
  
  // Compute layout classes
  const maxWidth = $derived(resolved.layout?.maxWidth || "640px");
  const padding = $derived(resolved.layout?.padding || "1.5rem");
  const cardStyle = $derived(cardStyleMap[resolved.layout?.cardStyle || "bordered"]);
  const borderRadius = $derived(radiusMap[resolved.borders?.cardRadius || "lg"]);
  
  // Background styles
  const backgroundStyle = $derived(() => {
    const bg = formOverrides?.background;
    if (!bg) return "";
    
    let style = "";
    if (bg.color) style += `background-color: ${bg.color};`;
    if (bg.image) {
      style += `background-image: url('${bg.image}');`;
      style += "background-size: cover; background-position: center;";
    }
    return style;
  });
  
  // Font imports
  const fontImports = $derived(() => {
    const fonts: string[] = [];
    const t = resolved.typography;
    
    if (t?.headingFont && !t.headingFont.includes("system")) {
      const fontName = t.headingFont.split(",")[0].trim().replace(/['"]/g, "");
      fonts.push(fontName);
    }
    if (t?.bodyFont && !t.bodyFont.includes("system")) {
      const fontName = t.bodyFont.split(",")[0].trim().replace(/['"]/g, "");
      if (!fonts.includes(fontName)) fonts.push(fontName);
    }
    
    if (fonts.length === 0) return "";
    
    const googleFonts = fonts.map(f => f.replace(/ /g, "+")).join("&family=");
    return `@import url('https://fonts.googleapis.com/css2?family=${googleFonts}:wght@400;500;600;700&display=swap');`;
  });
  
  // Simple hash function for theme name
  function hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36).substring(0, 8);
  }
</script>

<!-- Inject theme CSS -->
<svelte:head>
  {#if fontImports}
    {@html `<style>${fontImports}</style>`}
  {/if}
  {#if themeCSS}
    {@html `<style>${themeCSS}</style>`}
  {/if}
</svelte:head>

<!-- Form wrapper with theme applied -->
<div 
  data-theme={themeName}
  class="form-branding-wrapper min-h-screen"
  style={backgroundStyle}
>
  {#if formOverrides?.background?.overlay}
    <div 
      class="absolute inset-0" 
      style="background-color: {formOverrides.background.overlay};"
    />
  {/if}
  
  <div 
    class="form-branding-container relative mx-auto py-8 px-4"
    style="max-width: {maxWidth}; padding: {padding};"
  >
    <!-- Logo -->
    {#if resolved.logo?.url && formOverrides?.header?.showLogo !== false}
      <div class="mb-6 {resolved.logo.position === 'center' ? 'text-center' : ''}">
        <img 
          src={resolved.logo.url}
          alt="Logo"
          class="inline-block"
          style="height: {resolved.logo.height || 40}px;"
        />
      </div>
    {/if}
    
    <!-- Header -->
    {#if formOverrides?.header?.title}
      <div class="mb-6 text-center">
        <h1 class="text-2xl font-bold text-base-content">
          {formOverrides.header.title}
        </h1>
        {#if formOverrides.header.subtitle}
          <p class="mt-2 text-base-content/70">
            {formOverrides.header.subtitle}
          </p>
        {/if}
      </div>
    {/if}
    
    <!-- Form Card -->
    <div 
      class="bg-base-100 {cardStyle} p-6 sm:p-8"
      style="border-radius: {borderRadius};"
    >
      {@render children()}
    </div>
    
    <!-- Footer -->
    {#if formOverrides?.footer?.text || formOverrides?.footer?.showPoweredBy !== false}
      <div class="mt-6 text-center text-sm text-base-content/50">
        {#if formOverrides?.footer?.text}
          <p>{formOverrides.footer.text}</p>
        {/if}
        {#if formOverrides?.footer?.showPoweredBy !== false}
          <p class="mt-2">
            Powered by <a href="https://webkit.io" class="link link-primary">WebKit</a>
          </p>
        {/if}
      </div>
    {/if}
  </div>
</div>

<style>
  .form-branding-wrapper {
    font-family: var(--font-body, system-ui, sans-serif);
  }
  
  .form-branding-wrapper :global(h1),
  .form-branding-wrapper :global(h2),
  .form-branding-wrapper :global(h3) {
    font-family: var(--font-heading, var(--font-body, system-ui, sans-serif));
  }
</style>
```

### 5.2 Usage in DynamicFormRenderer

```svelte
<!-- src/lib/components/form-renderer/DynamicFormRenderer.svelte -->
<script lang="ts">
  import FormBranding from "./FormBranding.svelte";
  import FieldRenderer from "./FieldRenderer.svelte";
  import { superForm } from "sveltekit-superforms";
  import { zodClient } from "sveltekit-superforms/adapters";
  import { generateZodSchema } from "./utils/schema-generator";
  import { Button } from "$lib/components/ui/button";
  import { Progress } from "$lib/components/ui/progress";
  import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-svelte";
  import type { FormSchema, ResolvedBranding, FieldOption } from "$lib/types/form-builder";
  
  interface Props {
    schema: FormSchema;
    branding?: ResolvedBranding;
    options?: Record<string, FieldOption[]>;
    submitUrl: string;
    onSuccess?: (data: any) => void;
  }
  
  let { schema, branding, options = {}, submitUrl, onSuccess }: Props = $props();
  
  // ... rest of form logic (same as in main spec)
  
  // Get button classes based on branding
  const buttonClass = $derived(() => {
    const style = branding?.buttons?.style || "solid";
    const radius = branding?.borders?.buttonRadius || branding?.borders?.radius || "md";
    
    const styleClasses = {
      solid: "btn btn-primary",
      outline: "btn btn-outline btn-primary",
      ghost: "btn btn-ghost",
      soft: "btn btn-primary btn-soft"
    };
    
    return `${styleClasses[style]} rounded-${radius}`;
  });
</script>

<FormBranding {branding} formOverrides={schema.formOverrides}>
  <form method="POST" action={submitUrl} use:enhance>
    <!-- Progress Bar -->
    {#if totalSteps > 1 && schema.uiConfig?.showProgressBar !== false}
      <div class="mb-8">
        <div class="flex justify-between text-sm text-base-content/70 mb-2">
          <span>Step {currentStepIndex + 1} of {totalSteps}</span>
          <span>{Math.round(((currentStepIndex + 1) / totalSteps) * 100)}%</span>
        </div>
        <Progress value={(currentStepIndex + 1) / totalSteps * 100} class="h-2" />
      </div>
    {/if}
    
    <!-- Step Content -->
    <div class="space-y-6">
      <div class="mb-6">
        <h2 class="text-xl font-semibold text-base-content">{currentStep.title}</h2>
        {#if currentStep.description}
          <p class="mt-1 text-base-content/70">{currentStep.description}</p>
        {/if}
      </div>
      
      <div class="grid grid-cols-2 gap-4">
        {#each currentStep.fields as field (field.id)}
          <FieldRenderer 
            {field}
            value={$form[field.name]}
            error={$errors[field.name]?.[0]}
            options={getFieldOptions(field)}
            onchange={(v) => $form[field.name] = v}
          />
        {/each}
      </div>
    </div>
    
    <!-- Navigation Buttons -->
    <div class="flex justify-between mt-8 pt-6 border-t border-base-300">
      <Button 
        type="button"
        variant="ghost"
        onclick={goBack}
        disabled={isFirstStep}
        class={isFirstStep ? "invisible" : ""}
      >
        <ArrowLeft class="w-4 h-4 mr-2" />
        Back
      </Button>
      
      <Button 
        type="submit"
        class={buttonClass}
        disabled={$submitting}
      >
        {#if $submitting}
          <Loader2 class="w-4 h-4 mr-2 animate-spin" />
          {isLastStep ? "Submitting..." : "Validating..."}
        {:else if isLastStep}
          <Check class="w-4 h-4 mr-2" />
          {schema.uiConfig?.submitButtonText || "Submit"}
        {:else}
          Continue
          <ArrowRight class="w-4 h-4 ml-2" />
        {/if}
      </Button>
    </div>
  </form>
</FormBranding>
```

---

## 6. Theme Generator Utility

### 6.1 Generate DaisyUI Theme from AgencyBranding

```typescript
// src/lib/utils/theme-generator.ts

import type { AgencyBranding } from "$lib/types/branding";
import { radiusMap } from "./branding";

/**
 * Generates a DaisyUI theme CSS string from AgencyBranding
 */
export function generateDaisyTheme(themeName: string, branding: AgencyBranding): string {
  const c = branding.colors;
  const b = branding.borders || {};
  const btn = branding.buttons || {};
  const t = branding.typography || {};
  
  // Auto-calculate missing colors
  const primaryFocus = c.primaryFocus || darkenHSL(c.primary, 10);
  const primaryContent = c.primaryContent || getContrastColor(c.primary);
  
  const secondary = c.secondary || shiftHue(c.primary, 30);
  const secondaryFocus = c.secondaryFocus || darkenHSL(secondary, 10);
  const secondaryContent = c.secondaryContent || getContrastColor(secondary);
  
  const accent = c.accent || shiftHue(c.primary, 180);
  const accentFocus = c.accentFocus || darkenHSL(accent, 10);
  const accentContent = c.accentContent || getContrastColor(accent);
  
  const neutral = c.neutral || "220 14% 20%";
  const neutralFocus = c.neutralFocus || darkenHSL(neutral, 5);
  const neutralContent = c.neutralContent || "0 0% 100%";
  
  const base100 = c.base100;
  const base200 = c.base200 || darkenHSL(base100, 3);
  const base300 = c.base300 || darkenHSL(base100, 8);
  const baseContent = c.baseContent || getContrastColor(base100);
  
  // Semantic colors with defaults
  const info = c.info || "198 93% 60%";
  const success = c.success || "158 64% 52%";
  const warning = c.warning || "43 96% 56%";
  const error = c.error || "0 91% 71%";
  
  // Border radius
  const roundedBox = radiusMap[b.cardRadius || b.radius || "lg"];
  const roundedBtn = radiusMap[b.buttonRadius || b.radius || "md"];
  
  // Button styles
  const btnTextCase = btn.textTransform || "none";
  const btnFocusScale = btn.focusScale || 0.98;
  
  // Typography
  const fontBody = t.bodyFont || "system-ui, sans-serif";
  const fontHeading = t.headingFont || fontBody;
  
  return `
    [data-theme="${themeName}"] {
      /* Primary */
      --p: ${c.primary};
      --pf: ${primaryFocus};
      --pc: ${primaryContent};
      
      /* Secondary */
      --s: ${secondary};
      --sf: ${secondaryFocus};
      --sc: ${secondaryContent};
      
      /* Accent */
      --a: ${accent};
      --af: ${accentFocus};
      --ac: ${accentContent};
      
      /* Neutral */
      --n: ${neutral};
      --nf: ${neutralFocus};
      --nc: ${neutralContent};
      
      /* Base */
      --b1: ${base100};
      --b2: ${base200};
      --b3: ${base300};
      --bc: ${baseContent};
      
      /* Semantic */
      --in: ${info};
      --su: ${success};
      --wa: ${warning};
      --er: ${error};
      
      /* Shapes */
      --rounded-box: ${roundedBox};
      --rounded-btn: ${roundedBtn};
      --rounded-badge: 1.9rem;
      
      /* Buttons */
      --btn-focus-scale: ${btnFocusScale};
      --btn-text-case: ${btnTextCase};
      --animation-btn: 0.2s;
      --animation-input: 0.2s;
      
      /* Typography */
      --font-body: ${fontBody};
      --font-heading: ${fontHeading};
    }
  `;
}

/**
 * Darken an HSL color by reducing lightness
 */
function darkenHSL(hsl: string, amount: number): string {
  const [h, s, l] = parseHSL(hsl);
  return `${h} ${s}% ${Math.max(0, l - amount)}%`;
}

/**
 * Shift hue of an HSL color
 */
function shiftHue(hsl: string, degrees: number): string {
  const [h, s, l] = parseHSL(hsl);
  return `${(h + degrees) % 360} ${s}% ${l}%`;
}

/**
 * Get contrasting text color (black or white)
 */
function getContrastColor(hsl: string): string {
  const [h, s, l] = parseHSL(hsl);
  // Simple luminance check - if lightness > 60%, use dark text
  return l > 60 ? "0 0% 0%" : "0 0% 100%";
}

/**
 * Parse HSL string into components
 */
function parseHSL(hsl: string): [number, number, number] {
  const parts = hsl.split(/\s+/);
  const h = parseFloat(parts[0]) || 0;
  const s = parseFloat(parts[1]) || 0;
  const l = parseFloat(parts[2]) || 0;
  return [h, s, l];
}
```

---

## 7. Database Schema Updates

### 7.1 Agency Branding Column

The `agencies` table should have a `branding` JSONB column:

```sql
-- Add branding column to agencies table (if not exists)
ALTER TABLE agencies 
ADD COLUMN IF NOT EXISTS branding JSONB DEFAULT '{
  "colors": {
    "primary": "220 90% 56%",
    "base100": "0 0% 100%"
  },
  "mode": "light"
}'::jsonb;

-- Add form-specific branding to agency_forms
-- (Already in spec as 'branding JSONB DEFAULT NULL')
```

### 7.2 Default Branding for New Agencies

```typescript
// Default branding applied when agency is created
export const defaultAgencyBranding: AgencyBranding = {
  colors: {
    primary: "220 90% 56%",      // Blue
    secondary: "280 70% 50%",    // Purple
    accent: "45 100% 50%",       // Yellow
    neutral: "220 14% 20%",
    base100: "0 0% 100%",        // White background
    info: "198 93% 60%",
    success: "158 64% 52%",
    warning: "43 96% 56%",
    error: "0 91% 71%"
  },
  typography: {
    bodyFont: "Inter, system-ui, sans-serif",
    headingFont: "Inter, system-ui, sans-serif"
  },
  borders: {
    radius: "md",
    cardRadius: "lg"
  },
  buttons: {
    style: "solid",
    textTransform: "none"
  },
  layout: {
    maxWidth: "640px",
    cardStyle: "bordered"
  },
  mode: "light"
};
```

---

## 8. Branding UI in Agency Settings

### 8.1 Branding Settings Page

```svelte
<!-- src/routes/(app)/settings/branding/+page.svelte -->
<script lang="ts">
  import { superForm } from "sveltekit-superforms";
  import { zodClient } from "sveltekit-superforms/adapters";
  import { brandingSchema } from "$lib/schemas/branding";
  import ColorPicker from "$lib/components/ui/color-picker.svelte";
  import FontSelector from "$lib/components/ui/font-selector.svelte";
  import PreviewFrame from "./PreviewFrame.svelte";
  import { Button } from "$lib/components/ui/button";
  import { Card } from "$lib/components/ui/card";
  import { Tabs, TabsList, TabsTrigger, TabsContent } from "$lib/components/ui/tabs";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import { Select } from "$lib/components/ui/select";
  import { toast } from "svelte-sonner";
  
  let { data } = $props();
  
  const { form, enhance, submitting } = superForm(data.form, {
    validators: zodClient(brandingSchema),
    onResult: ({ result }) => {
      if (result.type === "success") {
        toast.success("Branding updated successfully");
      }
    }
  });
  
  // Live preview updates
  let previewBranding = $derived($form);
</script>

<div class="container py-8 max-w-6xl">
  <div class="flex justify-between items-center mb-8">
    <div>
      <h1 class="text-2xl font-bold">Brand Settings</h1>
      <p class="text-muted-foreground">
        Customize how your forms look to clients
      </p>
    </div>
    <Button type="submit" form="branding-form" disabled={$submitting}>
      {$submitting ? "Saving..." : "Save Changes"}
    </Button>
  </div>
  
  <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
    <!-- Settings Panel -->
    <div>
      <form id="branding-form" method="POST" use:enhance>
        <Tabs defaultValue="colors">
          <TabsList class="grid w-full grid-cols-4">
            <TabsTrigger value="colors">Colors</TabsTrigger>
            <TabsTrigger value="typography">Typography</TabsTrigger>
            <TabsTrigger value="logo">Logo</TabsTrigger>
            <TabsTrigger value="style">Style</TabsTrigger>
          </TabsList>
          
          <!-- Colors Tab -->
          <TabsContent value="colors" class="space-y-6 mt-6">
            <Card.Root class="p-6">
              <Card.Header class="px-0 pt-0">
                <Card.Title>Brand Colors</Card.Title>
                <Card.Description>
                  Set your primary brand colors
                </Card.Description>
              </Card.Header>
              
              <div class="grid gap-4">
                <div class="grid gap-2">
                  <Label>Primary Color</Label>
                  <ColorPicker 
                    bind:value={$form.colors.primary}
                    presets={["220 90% 56%", "142 76% 36%", "346 77% 50%", "24 95% 53%"]}
                  />
                  <p class="text-xs text-muted-foreground">
                    Used for buttons, links, and focus states
                  </p>
                </div>
                
                <div class="grid gap-2">
                  <Label>Secondary Color</Label>
                  <ColorPicker 
                    bind:value={$form.colors.secondary}
                    presets={["280 70% 50%", "190 80% 45%", "30 90% 55%", "320 70% 50%"]}
                  />
                </div>
                
                <div class="grid gap-2">
                  <Label>Background Color</Label>
                  <ColorPicker 
                    bind:value={$form.colors.base100}
                    presets={["0 0% 100%", "220 14% 96%", "30 20% 98%", "0 0% 98%"]}
                  />
                </div>
              </div>
            </Card.Root>
          </TabsContent>
          
          <!-- Typography Tab -->
          <TabsContent value="typography" class="space-y-6 mt-6">
            <Card.Root class="p-6">
              <Card.Header class="px-0 pt-0">
                <Card.Title>Fonts</Card.Title>
              </Card.Header>
              
              <div class="grid gap-4">
                <div class="grid gap-2">
                  <Label>Heading Font</Label>
                  <FontSelector 
                    bind:value={$form.typography.headingFont}
                    fonts={[
                      { value: "Inter, sans-serif", label: "Inter" },
                      { value: "Playfair Display, serif", label: "Playfair Display" },
                      { value: "Poppins, sans-serif", label: "Poppins" },
                      { value: "Roboto, sans-serif", label: "Roboto" },
                      { value: "system-ui, sans-serif", label: "System Default" }
                    ]}
                  />
                </div>
                
                <div class="grid gap-2">
                  <Label>Body Font</Label>
                  <FontSelector 
                    bind:value={$form.typography.bodyFont}
                    fonts={[
                      { value: "Inter, sans-serif", label: "Inter" },
                      { value: "Open Sans, sans-serif", label: "Open Sans" },
                      { value: "Roboto, sans-serif", label: "Roboto" },
                      { value: "system-ui, sans-serif", label: "System Default" }
                    ]}
                  />
                </div>
              </div>
            </Card.Root>
          </TabsContent>
          
          <!-- Logo Tab -->
          <TabsContent value="logo" class="space-y-6 mt-6">
            <Card.Root class="p-6">
              <Card.Header class="px-0 pt-0">
                <Card.Title>Logo</Card.Title>
              </Card.Header>
              
              <div class="grid gap-4">
                <div class="grid gap-2">
                  <Label>Logo URL</Label>
                  <Input 
                    type="url"
                    bind:value={$form.logo.url}
                    placeholder="https://yourdomain.com/logo.png"
                  />
                </div>
                
                <div class="grid gap-2">
                  <Label>Logo Height (px)</Label>
                  <Input 
                    type="number"
                    bind:value={$form.logo.height}
                    min={20}
                    max={120}
                  />
                </div>
                
                <div class="grid gap-2">
                  <Label>Position</Label>
                  <Select.Root bind:value={$form.logo.position}>
                    <Select.Trigger>
                      <Select.Value />
                    </Select.Trigger>
                    <Select.Content>
                      <Select.Item value="left">Left</Select.Item>
                      <Select.Item value="center">Center</Select.Item>
                    </Select.Content>
                  </Select.Root>
                </div>
              </div>
            </Card.Root>
          </TabsContent>
          
          <!-- Style Tab -->
          <TabsContent value="style" class="space-y-6 mt-6">
            <Card.Root class="p-6">
              <Card.Header class="px-0 pt-0">
                <Card.Title>Style</Card.Title>
              </Card.Header>
              
              <div class="grid gap-4">
                <div class="grid gap-2">
                  <Label>Border Radius</Label>
                  <Select.Root bind:value={$form.borders.radius}>
                    <Select.Trigger>
                      <Select.Value />
                    </Select.Trigger>
                    <Select.Content>
                      <Select.Item value="none">None (Sharp)</Select.Item>
                      <Select.Item value="sm">Small</Select.Item>
                      <Select.Item value="md">Medium</Select.Item>
                      <Select.Item value="lg">Large</Select.Item>
                      <Select.Item value="full">Full (Pill)</Select.Item>
                    </Select.Content>
                  </Select.Root>
                </div>
                
                <div class="grid gap-2">
                  <Label>Button Style</Label>
                  <Select.Root bind:value={$form.buttons.style}>
                    <Select.Trigger>
                      <Select.Value />
                    </Select.Trigger>
                    <Select.Content>
                      <Select.Item value="solid">Solid</Select.Item>
                      <Select.Item value="outline">Outline</Select.Item>
                      <Select.Item value="ghost">Ghost</Select.Item>
                      <Select.Item value="soft">Soft</Select.Item>
                    </Select.Content>
                  </Select.Root>
                </div>
                
                <div class="grid gap-2">
                  <Label>Card Style</Label>
                  <Select.Root bind:value={$form.layout.cardStyle}>
                    <Select.Trigger>
                      <Select.Value />
                    </Select.Trigger>
                    <Select.Content>
                      <Select.Item value="flat">Flat</Select.Item>
                      <Select.Item value="bordered">Bordered</Select.Item>
                      <Select.Item value="elevated">Elevated (Shadow)</Select.Item>
                    </Select.Content>
                  </Select.Root>
                </div>
              </div>
            </Card.Root>
          </TabsContent>
        </Tabs>
      </form>
    </div>
    
    <!-- Live Preview Panel -->
    <div class="lg:sticky lg:top-8 lg:self-start">
      <Card.Root>
        <Card.Header>
          <Card.Title>Live Preview</Card.Title>
          <Card.Description>See how your forms will look</Card.Description>
        </Card.Header>
        <Card.Content class="p-0">
          <PreviewFrame branding={previewBranding} />
        </Card.Content>
      </Card.Root>
    </div>
  </div>
</div>
```

---

## 9. Example Configurations

### 9.1 Law Firm (Professional, Conservative)

```json
{
  "colors": {
    "primary": "220 40% 25%",
    "secondary": "35 40% 45%",
    "accent": "35 70% 50%",
    "base100": "30 20% 98%",
    "neutral": "220 20% 15%"
  },
  "typography": {
    "headingFont": "Playfair Display, serif",
    "bodyFont": "Source Sans Pro, sans-serif"
  },
  "borders": {
    "radius": "sm",
    "cardRadius": "sm"
  },
  "buttons": {
    "style": "solid",
    "textTransform": "uppercase"
  },
  "layout": {
    "cardStyle": "bordered"
  }
}
```

**Result:** Navy and gold theme with serif headings, sharp corners, formal feel.

### 9.2 Creative Agency (Bold, Modern)

```json
{
  "colors": {
    "primary": "346 77% 50%",
    "secondary": "190 80% 45%",
    "accent": "45 100% 50%",
    "base100": "0 0% 100%",
    "neutral": "0 0% 10%"
  },
  "typography": {
    "headingFont": "Poppins, sans-serif",
    "bodyFont": "Inter, sans-serif"
  },
  "borders": {
    "radius": "lg",
    "buttonRadius": "full"
  },
  "buttons": {
    "style": "solid"
  },
  "layout": {
    "cardStyle": "elevated"
  }
}
```

**Result:** Coral pink with cyan accents, pill-shaped buttons, bold shadows.

### 9.3 Tech Startup (Clean, Minimal)

```json
{
  "colors": {
    "primary": "142 76% 36%",
    "secondary": "220 14% 50%",
    "base100": "0 0% 100%",
    "neutral": "220 14% 20%"
  },
  "typography": {
    "headingFont": "Inter, sans-serif",
    "bodyFont": "Inter, sans-serif"
  },
  "borders": {
    "radius": "md"
  },
  "buttons": {
    "style": "outline"
  },
  "layout": {
    "cardStyle": "flat",
    "maxWidth": "560px"
  }
}
```

**Result:** Green accent, outline buttons, flat cards, minimal feel.

### 9.4 E-commerce (Warm, Inviting)

```json
{
  "colors": {
    "primary": "24 95% 53%",
    "secondary": "45 90% 50%",
    "accent": "346 77% 50%",
    "base100": "30 30% 98%",
    "neutral": "30 15% 20%"
  },
  "typography": {
    "headingFont": "DM Sans, sans-serif",
    "bodyFont": "DM Sans, sans-serif"
  },
  "borders": {
    "radius": "lg",
    "cardRadius": "xl"
  },
  "buttons": {
    "style": "solid"
  },
  "layout": {
    "cardStyle": "elevated"
  }
}
```

**Result:** Warm orange/amber theme, rounded cards, friendly feel.

---

## Summary

This addendum provides:

1. **Complete TypeScript interfaces** for agency branding
2. **DaisyUI theme generation** from branding config
3. **FormBranding component** for client-facing forms
4. **Branding settings UI** for agency admins
5. **Four example configurations** for different agency types

The system allows complete visual customization while maintaining:
- Consistent behavior (validation, accessibility)
- Dark/light mode support
- Responsive layouts
- Font loading optimization

**Integration with existing spec:**
- Add `AgencyBranding` interface to `src/lib/types/branding.ts`
- Add `FormBranding.svelte` to `src/lib/components/form-renderer/`
- Add `theme-generator.ts` to `src/lib/utils/`
- Add `/settings/branding` route for agency customization
- Update `DynamicFormRenderer.svelte` to use `FormBranding` wrapper
