# LeapLearn Landing Page — Visual Style Guide

Use this document when building or adapting landing page components for LeapLearn. It bridges the Plenti education site (source inspiration) with the LeapLearn SvelteKit codebase (target implementation).

---

## Target Stack

| Layer | Technology |
|-------|-----------|
| Framework | SvelteKit + Svelte 5 runes |
| CSS | TailwindCSS v4.1 + DaisyUI v5 |
| Font | Poppins (all weights, via Google Fonts) |
| Icons | lucide-svelte (NOT FontAwesome) |
| Theme | DaisyUI `dim` (default), `light`, `dark` |
| Components | DaisyUI classes (`btn`, `card`, `badge`, etc.) |

---

## Source Reference

The Plenti education site at `/Users/benjaminwaller/Projects/My Plenti Sites WIP/foundationskillstraining/` uses Bootstrap 5 + custom CSS + Heebo/Roboto fonts + FontAwesome. **Do not copy Bootstrap classes.** Use them only as layout references.

### Source Component Mapping

| Plenti Component | LeapLearn Adaptation | Priority |
|-----------------|---------------------|----------|
| `hero.svelte` | Hero section — headline, subtext, CTA buttons | High |
| `feature.svelte` | Feature card grid — 3-col value propositions | High |
| `skills.svelte` | Content type showcase — 4-col icon cards | Medium |
| `cta.svelte` | CTA banner — title, description, button | High |
| `steps.svelte` | How-it-works — numbered steps with description | Medium |
| `testimonial2.svelte` | Testimonials — simple card grid (NO Owl Carousel) | Low |
| `header.svelte` | Navbar — adapt to existing LeapLearn nav or build minimal public nav | Medium |
| `footer.svelte` | Footer — links, newsletter, socials | Low |

---

## Color System

### DaisyUI Theme Tokens (use these, not hardcoded colors)

```
bg-base-100          → Main background
bg-base-200          → Section alternate background (replaces Bootstrap .bg / #f7f8f9)
bg-base-300          → Tertiary background
text-base-content    → Primary text (replaces #757f95 and #333)
text-base-content/70 → Secondary/muted text
bg-primary           → Primary accent (replaces Plenti #00af92 teal)
text-primary         → Primary text accent (replaces Plenti span color)
bg-secondary         → Secondary accent
bg-accent            → Highlight accent
```

### Color Translation from Plenti Source

| Plenti Color | Hex | LeapLearn Replacement |
|-------------|-----|----------------------|
| Teal accent | `#00af92` | `primary` (DaisyUI theme token) |
| Dark heading | `#333` / `#202029` | `text-base-content` |
| Body text | `#757f95` | `text-base-content/70` |
| Light background | `#f7f8f9` | `bg-base-200` |
| White cards | `#fff` | `bg-base-100` |
| Star rating | `#fd8e1f` | `text-warning` |
| Link blue | `#0049d0` | `text-primary` or `link link-primary` |

---

## Typography

### Font Stack

```
font-poppins    → Poppins, sans-serif (defined in app.css --font-poppins)
```

The Plenti site uses Heebo (headings) + Roboto (body). LeapLearn uses **Poppins for everything**. Do not import Heebo or Roboto.

### Heading Scale

Use Tailwind text utilities. Map from Plenti's CSS:

| Element | Plenti Style | Tailwind Equivalent |
|---------|-------------|-------------------|
| Hero title (h1) | 48px, 700, Heebo | `text-4xl md:text-5xl lg:text-6xl font-bold` |
| Section title (h2) | 35px, 700, capitalize | `text-2xl md:text-3xl font-bold` |
| Card title (h4) | 20px, 600 | `text-lg font-semibold` |
| Subtitle (h6) | — | `text-sm font-medium uppercase tracking-wide text-primary` |
| Body text | 16px, 400, 1.8 lh | `text-base leading-relaxed` |
| Small body | 14px | `text-sm` |

### Section Title Pattern

Plenti uses `{title1} <span>{title2}</span>` where span is teal. In LeapLearn:

```svelte
<h2 class="text-2xl md:text-3xl font-bold text-base-content">
  {title1} <span class="text-primary">{title2}</span>
</h2>
```

---

## Layout & Spacing

### Container

Plenti uses Bootstrap `.container` (max-width 1185px). LeapLearn equivalent:

```html
<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
```

### Section Spacing

Plenti uses `py-120` (120px padding). LeapLearn equivalent:

```html
<section class="py-16 md:py-20 lg:py-24">
```

| Plenti Class | Pixels | Tailwind |
|-------------|--------|----------|
| `py-120` | 120px | `py-16 md:py-20 lg:py-24` |
| `pt-120` | 120px | `pt-16 md:pt-20 lg:pt-24` |
| `pb-70` | 70px | `pb-12 md:pb-16` |
| `mb-50` | 50px | `mb-10 md:mb-12` |
| `mt-5` (Bootstrap) | 3rem | `mt-12` |

### Grid System

Replace Bootstrap grid with Tailwind:

| Bootstrap | Tailwind |
|-----------|----------|
| `row` | `grid gap-6` or `flex flex-wrap gap-6` |
| `col-lg-4` | `grid-cols-1 md:grid-cols-2 lg:grid-cols-3` (on parent) |
| `col-xl-3` | `grid-cols-2 md:grid-cols-3 xl:grid-cols-4` (on parent) |
| `col-lg-6` | `grid-cols-1 lg:grid-cols-2` (on parent) |
| `col-lg-7` / `col-lg-5` | `lg:grid-cols-[7fr_5fr]` or `lg:flex` with custom widths |
| `mx-auto` | `mx-auto` (same) |
| `align-items-center` | `items-center` |

---

## Component Patterns

### Cards (DaisyUI)

Replace Plenti's custom card classes with DaisyUI:

```svelte
<!-- Feature card -->
<div class="card bg-base-100 shadow-sm hover:shadow-md transition-shadow">
  <div class="card-body">
    <div class="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
      <Icon class="w-6 h-6 text-primary" />
    </div>
    <h3 class="card-title text-lg">{title}</h3>
    <p class="text-base-content/70">{description}</p>
  </div>
</div>
```

### Buttons

| Plenti Class | DaisyUI Equivalent |
|-------------|-------------------|
| `.theme-btn` | `btn btn-primary` |
| `.cta-btn` | `btn btn-primary btn-lg` |
| `.header-btn` | `btn btn-primary btn-sm` |
| `.header-btn-text` | `btn btn-ghost btn-sm` |

### Icon Cards (Skills/Categories)

Replace FontAwesome with lucide-svelte:

| FontAwesome Icon | Lucide Equivalent |
|-----------------|-------------------|
| `fa-laptop-code` | `Monitor` or `Code` |
| `fa-megaphone` | `Megaphone` |
| `fa-leaf` | `Leaf` |
| `fa-medkit` | `Heart` or `HeartPulse` |
| `fa-fill-drip` | `Palette` |
| `fa-photo-video` | `Image` or `Video` |
| `fa-credit-card` | `CreditCard` |
| `fa-school` | `School` or `GraduationCap` |
| `fa-book-open` | `BookOpen` |
| `fa-users` | `Users` |
| `fa-clock` | `Clock` |
| `fa-search` | `Search` |
| `fa-play` | `Play` |
| `fa-star` | `Star` |
| `fa-quote-right` | `Quote` |
| `fa-envelope` | `Mail` |
| `fa-phone` | `Phone` |
| `fa-bars` | `Menu` |

### Category Color Variants

Plenti uses `category-color-1` through `category-color-8`. Map to DaisyUI/Tailwind:

```svelte
{#each categories as category, i}
  {@const colors = [
    'bg-primary/10 text-primary',
    'bg-secondary/10 text-secondary',
    'bg-accent/10 text-accent',
    'bg-info/10 text-info',
    'bg-success/10 text-success',
    'bg-warning/10 text-warning',
    'bg-error/10 text-error',
    'bg-primary/10 text-primary',
  ]}
  <div class="card {colors[i % colors.length]} ...">
{/each}
```

---

## Section-by-Section Adaptation Notes

### Hero Section

**Source structure:** Full-width hero with decorative shapes, title, subtitle, search bar, background image.

**Adaptation:**
- Drop the animated shapes (shape-1 through shape-4) — they add complexity without value for an LMS landing page
- Drop the search bar — not needed for landing/redirect page
- Keep: headline, subtitle, body text, CTA buttons
- Add: sign-in card for unauthenticated users (already exists in current `+page.svelte`)
- Layout: Two-column on desktop (text left, visual/card right), stacked on mobile

```svelte
<section class="min-h-[80vh] flex items-center py-16 md:py-24">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
      <!-- Left: Text content -->
      <div>
        <p class="text-sm font-medium uppercase tracking-wide text-primary mb-2">
          {subtitle}
        </p>
        <h1 class="text-4xl md:text-5xl lg:text-6xl font-bold text-base-content mb-6">
          {title1} <span class="text-primary">{title2}</span>
        </h1>
        <p class="text-lg text-base-content/70 leading-relaxed mb-8">
          {body}
        </p>
        <div class="flex flex-wrap gap-4">
          <a href="/login" class="btn btn-primary btn-lg">Get Started</a>
          <a href="#features" class="btn btn-ghost btn-lg">Learn More</a>
        </div>
      </div>
      <!-- Right: Visual or sign-in card -->
      <div>
        <!-- Sign-in card or hero image -->
      </div>
    </div>
  </div>
</section>
```

### Feature Cards

**Source:** 6 cards in 3-column grid with icon + title + description.

**Adaptation:** Use DaisyUI card component, lucide icons, 3-column grid.

```svelte
<section class="py-16 md:py-24 bg-base-200">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="text-center max-w-2xl mx-auto mb-12">
      <h2 class="text-2xl md:text-3xl font-bold">
        {title1} <span class="text-primary">{title2}</span>
      </h2>
      <p class="text-base-content/70 mt-4">{subtitle}</p>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {#each features as feature}
        <div class="card bg-base-100 shadow-sm hover:shadow-md transition-shadow">
          <div class="card-body">
            <div class="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <svelte:component this={feature.icon} class="w-6 h-6 text-primary" />
            </div>
            <h3 class="card-title text-lg mt-4">{feature.title}</h3>
            <p class="text-base-content/70 text-sm">{feature.description}</p>
          </div>
        </div>
      {/each}
    </div>
  </div>
</section>
```

### Steps / How It Works

**Source:** 3 numbered steps with text + video player.

**Adaptation:** Numbered steps with DaisyUI `steps` component or custom numbered layout. Drop video player (not relevant for LMS landing).

```svelte
<section class="py-16 md:py-24">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-12">
      <div>
        <h2 class="text-2xl md:text-3xl font-bold mb-4">
          <span class="text-primary">{title}</span>
        </h2>
        <p class="text-base-content/70 mb-8">{description}</p>
        <div class="space-y-6">
          {#each steps as step, i}
            <div class="flex gap-4">
              <div class="flex-shrink-0 w-10 h-10 rounded-full bg-primary text-primary-content flex items-center justify-center font-bold">
                {i + 1}
              </div>
              <div>
                <h3 class="font-semibold text-base-content">{step.title}</h3>
                <p class="text-base-content/70 text-sm mt-1">{step.description}</p>
              </div>
            </div>
          {/each}
        </div>
      </div>
      <div class="flex items-center justify-center">
        <!-- Illustration or screenshot -->
      </div>
    </div>
  </div>
</section>
```

### CTA Banner

**Source:** Two-column with title, description, button, and image.

**Adaptation:**

```svelte
<section class="py-16 md:py-24">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="card bg-primary text-primary-content">
      <div class="card-body p-8 md:p-12 flex flex-col md:flex-row items-center gap-8">
        <div class="flex-1">
          <h2 class="text-2xl md:text-3xl font-bold">{title}</h2>
          <p class="mt-4 opacity-90">{description}</p>
          <a href="/login" class="btn btn-secondary mt-6">{linkTitle}</a>
        </div>
        <div class="flex-shrink-0">
          <img src={imageUrl} alt={imageAlt} class="rounded-lg max-w-xs" />
        </div>
      </div>
    </div>
  </div>
</section>
```

### Testimonials

**Source:** Owl Carousel slider. **Do not use Owl Carousel.**

**Adaptation:** Simple card grid (2-3 columns). No external carousel dependency.

```svelte
<section class="py-16 md:py-24 bg-base-200">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="text-center max-w-2xl mx-auto mb-12">
      <h2 class="text-2xl md:text-3xl font-bold">
        {title1} <span class="text-primary">{title2}</span>
      </h2>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      {#each testimonials as t}
        <div class="card bg-base-100 shadow-sm">
          <div class="card-body">
            <Quote class="w-8 h-8 text-primary/30 mb-2" />
            <p class="text-base-content/70 italic">"{t.quote}"</p>
            <div class="flex items-center gap-3 mt-4">
              <div class="avatar">
                <div class="w-12 rounded-full">
                  <img src={t.image} alt={t.name} />
                </div>
              </div>
              <div>
                <p class="font-semibold text-base-content">{t.name}</p>
                <p class="text-sm text-base-content/50">{t.role}</p>
              </div>
            </div>
          </div>
        </div>
      {/each}
    </div>
  </div>
</section>
```

---

## Alternating Section Backgrounds

The Plenti site alternates between white and light gray backgrounds. In LeapLearn:

```
Section 1 (Hero):       bg-base-100 (or no bg class — inherits)
Section 2 (Features):   bg-base-200
Section 3 (Steps):      bg-base-100
Section 4 (CTA):        bg-primary (or bg-base-100 with primary card)
Section 5 (Testimonials): bg-base-200
```

This pattern works across all DaisyUI themes (light, dark, dim).

---

## Responsive Breakpoints

Follow Tailwind defaults (already configured):

| Breakpoint | Width | Use |
|-----------|-------|-----|
| (default) | < 640px | Mobile: single column, stacked layout |
| `sm` | 640px | Small tablets: minor adjustments |
| `md` | 768px | Tablets: 2-column grids |
| `lg` | 1024px | Desktop: full layouts, sidebars |
| `xl` | 1280px | Large: wider spacing |

---

## What NOT to Bring Over

1. **Bootstrap classes** — No `row`, `col-*`, `container` from Bootstrap. Use Tailwind grid/flex.
2. **FontAwesome** — Use `lucide-svelte` exclusively.
3. **Owl Carousel** — Use CSS scroll-snap or simple grid instead.
4. **Animate.css / WOW.js** — Use Tailwind `transition-*` and `animate-*` or CSS `@keyframes` if needed.
5. **Custom 6,000-line global.css** — Do not import. Extract only design decisions (colors, spacing, typography ratios).
6. **Heebo / Roboto fonts** — Poppins only.
7. **Decorative shapes** — The floating PNG shapes in the hero are theme-specific to Foundation Skills Training. Design fresh if needed.
8. **jQuery plugins** — No jQuery. Svelte handles all interactivity.

---

## Svelte 5 Compliance Reminders

When adapting any Plenti component:

```svelte
<!-- Props: $props() not export let -->
<script lang="ts">
  let { title, description, features }: Props = $props();
</script>

<!-- Events: onclick not on:click -->
<button onclick={handler}>Click</button>

<!-- State: $state() not let x = ... -->
let isOpen = $state(false);

<!-- Derived: $derived() -->
let count = $derived(items.length);
```

---

## Page Routing Context

The landing page lives at `/` (root route). Current behaviour:
- **Authenticated + has org** → redirect to `/[organisationSlug]/dashboard`
- **Authenticated + no org** → show "Create Organisation" card
- **Unauthenticated** → show landing content with sign-in CTA

The new landing page should preserve this logic. The marketing sections (hero, features, steps, CTA, testimonials) are only shown to **unauthenticated** users. Authenticated users still get redirected or see the org creation card.

---

## File Location

New landing page components should go in:
```
service-client/src/lib/components/landing/
  Hero.svelte
  Features.svelte
  HowItWorks.svelte
  CTABanner.svelte
  Testimonials.svelte
  Footer.svelte
```

The root page stays at:
```
service-client/src/routes/(app)/+page.svelte    — orchestrates auth logic + renders landing
service-client/src/routes/(app)/+page.server.ts  — handles redirect for authenticated users
```
