# Remote Functions Gotchas

## Exporting Non-Remote Functions From `.remote.ts` Files

**Discovered:** 2026-02-20 (Wave 5 Content Intelligence)
**Impact:** Build fails — `npm run check` passes but `npm run build` crashes

### The Problem

`.remote.ts` files can ONLY export functions wrapped with `query()`, `command()`, `form()`, or `prerender()`. Exporting any other value — regular functions, types, constants, interfaces — causes a build-time error:

```
Error: `contentFetch` exported from src/lib/api/content.remote.ts is invalid
— all exports from this file must be remote functions
```

**The trap:** `npm run check` (svelte-check) does NOT catch this. It only surfaces during `npm run build` when SvelteKit validates remote function module exports. Always run both check AND build before committing.

### Why It Happens

SvelteKit processes `.remote.ts` files specially. On the client, it generates proxies that make HTTP requests to the server. Every export must follow the remote function pattern so SvelteKit knows how to create the client-side proxy. A regular function export breaks this contract.

### The Fix

Move shared server utilities to `$lib/server/*.ts` files (plain server-only modules):

```
BEFORE (broken):
  src/lib/api/content.remote.ts
    export async function contentFetch<T>() { ... }  // BAD
    export const startCrawl = command(...)            // OK

AFTER (working):
  src/lib/server/content-fetch.ts
    export async function contentFetch<T>() { ... }  // OK - plain .ts file

  src/lib/api/content.remote.ts
    import { contentFetch } from "$lib/server/content-fetch";
    export const startCrawl = command(...)            // OK
```

### Rules

1. `.remote.ts` exports: ONLY `query()`, `command()`, `form()`, `prerender()` wrapped functions
2. Type exports: Put in separate `.types.ts` files (e.g., `content.types.ts`, `content-brand.types.ts`)
3. Shared server utilities: Put in `$lib/server/*.ts` files
4. Always run `npm run build` (not just `npm run check`) to catch this class of error

### Files Using This Pattern

- `$lib/server/content-fetch.ts` — shared `contentFetch()` proxy helper
- `$lib/api/content.remote.ts` — imports from `$lib/server/content-fetch`
- `$lib/api/content-brand.remote.ts` — imports from `$lib/server/content-fetch`
- `$lib/api/content-audit.remote.ts` — imports from `$lib/server/content-fetch`
- `$lib/api/content-copy.remote.ts` — imports from `$lib/server/content-fetch`

### Real Incident

Wave 5 Agent A exported `contentFetch` directly from `content.remote.ts` so that brand/audit/copy remote files could import it. `npm run check` passed across all 4 agents. The build failure was only caught during final verification (`npm run build`). Fix: created `$lib/server/content-fetch.ts` and updated all 4 import paths.
