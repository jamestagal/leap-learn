# Wave 1 Hardening Learnings

*Updated: 2026-02-08*
*Branch: feature/wave-1-critical-fixes*
*Commit: 04e42d1*

## Execution Approach

Wave 1 was planned in `docs/plans/execution-roadmap.md` as 6 streams with a dependency graph:
- Group 1 (parallel): Streams A, B, C, E
- Sequential after Group 1: Stream D (blocked by C), Stream F (blocked by D)

Ran 4 agents in parallel for Group 1, then D and F sequentially. Total: ~45 minutes for all 6 streams.

**Why sequential for D and F:** Both touch `contracts.remote.ts` at different sections. D adds email imports/calls, F adds sanitization imports/wrapping. Running them in parallel would cause merge conflicts on the import block.

## Atomic Document Numbers (UPDATE...RETURNING)

**Pattern:** Use `UPDATE ... SET counter = counter + 1 ... RETURNING counter - 1` to atomically get-and-increment in a single query. Eliminates read-then-write race conditions.

**File:** `service-client/src/lib/server/document-numbers.ts`

```typescript
const result = await db.execute(sql`
  UPDATE agency_profiles
  SET ${sql.identifier(counter)} = ${sql.identifier(counter)} + 1,
      updated_at = NOW()
  WHERE agency_id = ${agencyId}
  RETURNING ${sql.identifier(counter)} - 1 AS current_number,
            ${sql.identifier(prefixCol)} AS prefix
`);
```

**Why `counter - 1`:** The RETURNING clause runs after the UPDATE, so `counter` is already incremented. Subtract 1 to get the value before increment (the number we want to use).

**Call sites rewired (9 total):**
- `proposals.remote.ts` — proposal numbers, contract numbers from proposals
- `contracts.remote.ts` — contract numbers
- `invoices.remote.ts` — invoice numbers (4 creation paths)

## Atomic AI Generation Counter (SQL CASE)

**Pattern:** Use a single UPDATE with CASE WHEN to handle month-reset logic atomically.

**File:** `service-client/src/lib/server/subscription.ts:339-356`

The old code did: read counter → check if reset needed → update. Two queries = race condition window. New code does it in one query with CASE expressions for both the counter and the reset timestamp.

## Remote Functions Cannot Call Remote Functions

**Problem:** `.remote.ts` files export functions wrapped in `query()`/`command()`. SvelteKit generates client proxies for these. You can't import one remote function into another remote function.

**Solution:** Extract shared logic into `$lib/server/*.ts` (regular server-only files). Both remote functions and other server code can import these.

**Example:** `sendContractEmail` in `email.remote.ts` and `sendContract` in `contracts.remote.ts` both need to send contract emails. Created `$lib/server/contract-emails.ts` with the shared logic.

## Non-Blocking Email Pattern

**Pattern:** Fire-and-forget with `.catch()` for notification emails that shouldn't block the primary operation.

```typescript
sendContractEmailToClient(contract, context.userId).catch((err) =>
  console.error("Failed to send contract email:", err)
);
```

**Why:** Contract send/sign operations should succeed even if email delivery fails. The email is logged in `emailLogs` table regardless, so failed sends can be retried from the UI.

## DOMPurify SSR (isomorphic-dompurify)

**Package:** `isomorphic-dompurify` — works in both Node.js (SSR) and browser. Uses `jsdom` on the server, native DOM in the browser. Drop-in replacement for `dompurify`.

**Defense in depth:** Sanitize both:
1. On storage (server-side in `contracts.remote.ts` when generating HTML from templates)
2. On render (client-side in `{@html sanitizeHtml(content)}`)

**Config:** Allow rich formatting tags (tables, styled text, images) but block scripts, iframes, event handlers. The `style` attribute is allowed because contract templates use inline styles.

## Go Rate Limiter Thread Safety

**Problem:** `map[string][]time.Time` accessed concurrently by HTTP handlers without synchronization.

**Fix:** `sync.Mutex` protecting all map operations + background eviction goroutine (every 5 min) to prevent unbounded map growth from unique IPs.

**Key detail:** Unlock the mutex BEFORE calling `writeResponse` on rate limit exceeded — don't hold the lock during I/O.

## Dead Code Identification

Two parallel Explore agents confirmed:
- **Go user-level payment system** (~800 lines) — zero frontend callers, env vars commented out. Safe to remove in Wave 2.
- **Go consultation JSONB endpoints** (39+ queries) — frontend handles all CRUD via SvelteKit remote functions. Go code is unused.
- **Zod** — `validation.ts` and `http.ts` were dead code, unused imports. Safely deleted along with the zod package.
- **Button.svelte** — only 2 usages, both trivially replaced with DaisyUI `btn` classes.

## Files Changed Summary

| Stream | New Files | Modified | Deleted |
|--------|-----------|----------|---------|
| A: Go Backend | — | `middleware.go`, `server.go` | — |
| B: SvelteKit | — | `Dockerfile`, `+error.svelte`, `subscription.ts`, 2 consultation pages | `Button.svelte`, `validation.ts`, `http.ts` |
| C: Race Conditions | `document-numbers.ts` | `proposals.remote.ts`, `contracts.remote.ts`, `invoices.remote.ts`, `subscription.ts` | — |
| D: Contract Emails | `contract-emails.ts` | `contracts.remote.ts` | — |
| E: Infrastructure | `backup-db.sh`, `rclone-r2.conf.example` | `docker-compose.production.yml` | — |
| F: XSS Audit | `sanitize.ts` | `contracts.remote.ts`, 3 Svelte contract pages | — |
