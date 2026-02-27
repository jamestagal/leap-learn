# Sentry Integration for SvelteKit Client Service

## Context

Webkit has no application-level error tracking. Errors are logged to console via Winston but aren't collected, aggregated, or alerted on. The existing `docs/ops/monitoring-setup.md` covers uptime monitoring (BetterStack/UptimeRobot pinging health endpoints) — that stays as-is. Sentry fills a different gap: error tracking with stack traces, performance tracing, and auto-instrumentation of SvelteKit load functions, remote functions, and DB queries.

SvelteKit 2.31+ added `experimental.tracing` and `experimental.instrumentation` support. Webkit runs **2.49.4** — fully compatible. Sentry's `@sentry/sveltekit` SDK hooks into this natively.

**Scope:** SvelteKit client service only. Go services already have OpenTelemetry deps in go.mod but aren't instrumented — that's a separate future task.

**Free tier:** 5,000 errors/month, 1 user, performance monitoring, tracing, email alerts. More than enough for current scale.

## Files to Create

| File | Purpose |
|------|---------|
| `service-client/src/instrumentation.server.ts` | Server-side Sentry init (early boot, enables auto-instrumentation) |
| `service-client/src/hooks.client.ts` | Client-side Sentry init + error handler |

## Files to Modify

| File | Change |
|------|--------|
| `service-client/svelte.config.js` | Add `experimental.tracing` and `experimental.instrumentation` |
| `service-client/vite.config.ts` | Add `sentrySvelteKit()` Vite plugin |
| `service-client/src/hooks.server.ts` | Wrap `handle` with `Sentry.sentryHandle()`, add `handleError` export |
| `service-client/src/routes/+error.svelte` | No change needed (already works) |
| `docker-compose.yml` | Add `PUBLIC_SENTRY_DSN` and `SENTRY_AUTH_TOKEN` env vars to client service |
| `docker-compose.production.yml` | Add `PUBLIC_SENTRY_DSN` env var to client service |
| `docs/ops/monitoring-setup.md` | Add Sentry section documenting the setup |

## Implementation Steps

### 1. Install SDK

```bash
cd service-client && npm install @sentry/sveltekit
```

### 2. svelte.config.js — Enable tracing + instrumentation

```js
kit: {
    adapter: isCloudflare ? adapterCloudflare() : adapterNode(),
    alias: {},
    experimental: {
        remoteFunctions: true,
        tracing: { server: true },
        instrumentation: { server: true },
    },
},
```

### 3. vite.config.ts — Add Sentry Vite plugin

```ts
import { sentrySvelteKit } from "@sentry/sveltekit";

export default defineConfig({
    plugins: [tailwindcss(), sentrySvelteKit({ autoUploadSourceMaps: false }), sveltekit()],
    // ... rest unchanged
});
```

`autoUploadSourceMaps: false` — we don't have a Sentry auth token in CI yet. Can enable later.

### 4. src/instrumentation.server.ts — Server init (NEW FILE)

```ts
import * as Sentry from "@sentry/sveltekit";
import { env } from "$env/dynamic/public";

Sentry.init({
    dsn: env.PUBLIC_SENTRY_DSN,
    environment: env.PUBLIC_APP_DOMAIN === "webkit.au" ? "production" : "development",
    tracesSampleRate: 0.2, // 20% of transactions in production
    profilesSampleRate: 0, // Disabled on free tier
    // Don't send expected errors
    beforeSend(event) {
        // Skip 401/403 — expected auth redirects
        const status = event.contexts?.response?.status_code;
        if (status === 401 || status === 403) return null;
        return event;
    },
});
```

Key: This file runs at server boot before any request handling, enabling auto-instrumentation of DB queries, fetch calls, and SvelteKit internals.

### 5. src/hooks.server.ts — Wrap existing handle + add handleError

```ts
import * as Sentry from "@sentry/sveltekit";

// Existing handle stays the same, just sequence with sentryHandle()
export const handle = sequence(Sentry.sentryHandle(), existingHandle);

export const handleError = Sentry.handleErrorWithSentry((e) => {
    // Optional: custom error processing
    logger.error("Unhandled error", e.error);
});
```

Need to import `sequence` from `@sveltejs/kit/hooks` and rename current `handle` to something like `authHandle`.

### 6. src/hooks.client.ts — Client-side init (NEW FILE)

```ts
import * as Sentry from "@sentry/sveltekit";
import { env } from "$env/dynamic/public";

Sentry.init({
    dsn: env.PUBLIC_SENTRY_DSN,
    environment: "browser",
    tracesSampleRate: 0.1, // 10% of browser transactions
    replaysSessionSampleRate: 0, // Disabled (free tier)
    replaysOnErrorSampleRate: 0, // Disabled (free tier)
    integrations: [Sentry.browserTracingIntegration()],
});

export const handleError = Sentry.handleErrorWithSentry();
```

### 7. Environment Variables

**docker-compose.yml** (dev — client service):
```yaml
PUBLIC_SENTRY_DSN: "" # Empty = Sentry disabled locally
```

**docker-compose.production.yml** (prod — client service):
```yaml
PUBLIC_SENTRY_DSN: ${SENTRY_DSN} # Set in VPS env or GitHub Secrets
```

`PUBLIC_` prefix makes it available to both server and client bundles in SvelteKit.

### 8. docs/ops/monitoring-setup.md — Add Sentry section

Document the setup, how to get a DSN, what's tracked, how to view errors.

## What Gets Auto-Instrumented (No Code Changes)

- All `load` functions (server + universal)
- All remote functions (`query()`, `command()`, `form()`)
- Database queries (Drizzle → pg driver)
- Fetch calls from server hooks
- Client-side page navigations + web vitals
- Unhandled exceptions (server + client)

## What We're NOT Doing (Keep Simple)

- No source map upload (requires Sentry auth token in CI — do later)
- No session replay (paid feature / quota concern)
- No Go service integration (separate task)
- No custom spans or breadcrumbs (auto-instrumentation is sufficient for now)
- No Sentry Crons or Release tracking

## Unresolved Questions

1. **Do you have a Sentry account already, or should I include signup steps in the docs?** The DSN comes from creating a SvelteKit project in Sentry's dashboard.

## Verification

1. `npm run check` — no type errors
2. `npm run dev` — app starts without Sentry errors (DSN empty = SDK disabled)
3. Set `PUBLIC_SENTRY_DSN` to real DSN → trigger a test error → confirm it appears in Sentry dashboard
4. Check Sentry "Performance" tab shows traced requests
