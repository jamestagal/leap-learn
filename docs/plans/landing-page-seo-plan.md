# Landing Page & SEO Overhaul Plan

## Context

Webkit has no public landing page. Root `/` redirects unauthenticated users to `/login`. `app.html` still references "GoFast" (the template). No `robots.txt`, no sitemap, no meta tags, no JSON-LD. The app interior uses DaisyUI v5 + Poppins font + dim/light themes — but nothing public showcases the product or its features (consultations, proposals, quotations, contracts, invoices, forms, AI generation).

## 1. Install `svelte-seo` + Fix `app.html`

**Install:** `npm i -D svelte-seo` (v2.0.0 — Svelte 5 compatible)

**Fix `app.html`:**
- Title: "Webkit — Client Consultation & Proposal Platform for Web Agencies"
- Description: updated to match product
- Add `og:image` fallback meta tag
- Keep Poppins font loading as-is

**Files:** `service-client/src/app.html`, `service-client/package.json`

## 2. Make `/` a Public Route

**File:** `service-client/src/hooks.server.ts`

Add `event.url.pathname === "/"` to the `isPublicRoute` check so unauthenticated users see the landing page instead of being redirected to login.

## 3. Create Landing Page

**New files:**
- `service-client/src/routes/+page.svelte` — Landing page component
- `service-client/src/routes/+page.server.ts` — Check if user is authenticated → redirect to `/{agencySlug}` if so (preserves current UX for logged-in users)

**Design approach:** Use the app's existing DaisyUI design system (light theme for marketing, Poppins font, DaisyUI component classes). Take visual cues from the app interior — cards, clean spacing, Lucide icons — but in a marketing layout.

**Sections:**
1. **Hero** — Headline, subheadline, CTA buttons (Get Started Free / See Demo), hero illustration or screenshot mockup
2. **Features grid** — 8 core features with Lucide icons: Consultations, Proposals, Quotations, Contracts, Invoices, Forms, Client Management, AI Generation
3. **How it works** — 3-step flow (Create Agency → Customize Forms → Send Proposals)
4. **Pricing** — 4-tier cards (Free/Starter/Growth/Enterprise) pulled from actual `TIER_DEFINITIONS` data
5. **Social proof / trust signals** — placeholder section for testimonials
6. **CTA footer** — Final call-to-action with sign-up link

**Styling:**
- Force `data-theme="light"` on landing page wrapper (marketing pages should be light)
- Use DaisyUI classes: `btn-primary`, `card`, `hero`, `stats`, etc.
- Gradient accents using the app's blue/purple palette
- Responsive: mobile-first grid layout

## 4. SEO Infrastructure

### 4a. `SvelteSeo` Component on Landing Page

```svelte
<SvelteSeo
  title="Webkit — Client Consultation & Proposal Platform for Web Agencies"
  description="Create professional consultations, proposals, quotations, contracts and invoices. Customizable forms, agency branding, AI generation. Free tier available."
  canonical="https://app.webkit.au"
  openGraph={{
    title: "Webkit — Proposals & Consultations for Web Agencies",
    type: "website",
    url: "https://app.webkit.au",
    site_name: "Webkit",
    images: [{ url: "https://app.webkit.au/og-image.png", width: 1200, height: 630 }]
  }}
  twitter={{ card: "summary_large_image", site: "@webkitau" }}
  jsonLd={{
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "Webkit",
    "applicationCategory": "BusinessApplication",
    "operatingSystem": "Web",
    "description": "...",
    "offers": {
      "@type": "AggregateOffer",
      "lowPrice": "0",
      "priceCurrency": "AUD",
      "offerCount": "4"
    }
  }}
/>
```

### 4b. Static SEO Files

**`service-client/static/robots.txt`:**
```
User-agent: *
Allow: /
Disallow: /api/
Disallow: /super-admin/
Disallow: /login/
Sitemap: https://app.webkit.au/sitemap.xml
```

### 4c. Sitemap Route

**New file:** `service-client/src/routes/sitemap.xml/+server.ts`
- Returns XML sitemap with static pages (`/`, `/login`)
- Set `Content-Type: application/xml`
- Add to public routes in hooks

### 4d. OG Image

**New file:** `service-client/static/og-image.png`
- 1200×630px branded image for social sharing
- Can be generated or designed separately (placeholder initially)

## 5. Additional SEO & Branding Improvements

### 5a. Per-Page SEO on Public Routes

Add `SvelteSeo` to existing public pages with contextual JSON-LD:
- `/p/[slug]` (proposals) — `@type: Offer` schema
- `/q/[slug]` (quotations) — `@type: Offer` schema
- `/i/[slug]` (invoices) — noindex (private financial data)
- `/f/[slug]` (forms) — `@type: WebPage` schema
- `/login` — basic meta tags, noindex

### 5b. Favicon Update

Current `favicon.svg` may still be GoFast. Verify and replace if needed.

### 5c. Canonical URL Consistency

Add `<link rel="canonical">` via SvelteSeo on all public routes to prevent duplicate content indexing.

## Key Files to Create/Modify

| File | Action |
|------|--------|
| `src/app.html` | Fix title/description from GoFast |
| `src/hooks.server.ts` | Add `/` and `/sitemap.xml` to public routes |
| `src/routes/+page.svelte` | NEW — Landing page |
| `src/routes/+page.server.ts` | NEW — Redirect authenticated users |
| `src/routes/sitemap.xml/+server.ts` | NEW — XML sitemap |
| `static/robots.txt` | NEW |
| `static/og-image.png` | NEW (placeholder) |
| `src/routes/p/[slug]/+page.svelte` | Add SvelteSeo |
| `src/routes/q/[slug]/+page.svelte` | Add SvelteSeo |
| `src/routes/i/[slug]/+page.svelte` | Add SvelteSeo + noindex |
| `src/routes/f/[slug]/+page.svelte` | Add SvelteSeo |
| `src/routes/login/+page.svelte` | Add SvelteSeo + noindex |

## Implementation Order

1. Install svelte-seo, fix app.html
2. Make `/` public in hooks, create redirect logic for auth users
3. Build landing page (hero → features → pricing → CTA)
4. Add robots.txt + sitemap
5. Add SvelteSeo to public routes (/p/, /q/, /i/, /f/, /login)
6. Verify: `npm run check`, manual test of landing page + SEO tags

## Unresolved Questions

1. **Domain**: Landing page at `app.webkit.au/` or is there a separate `webkit.au` site? (Plan assumes `app.webkit.au` since that's where the client service runs)
2. **OG image**: Want me to generate a branded placeholder or will you provide one?
3. **Twitter/social handles**: Do you have a `@webkitau` Twitter handle or similar for social meta tags?
4. **Pricing amounts**: The tier definitions have limits but no prices. Should the pricing section show actual AUD prices or just "Contact us" / "Free" labels?
5. **Screenshots/mockups**: Want the landing page hero to include app screenshots, or keep it abstract with icons/illustrations for now?
