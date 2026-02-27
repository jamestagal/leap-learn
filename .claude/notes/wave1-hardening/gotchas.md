# Wave 1 Hardening Gotchas

*Updated: 2026-02-08*

## contracts.remote.ts Is a Hotspot

Three streams (C, D, F) all modified `contracts.remote.ts`. They touch different sections:
- Stream C: Document number helper functions (top of file)
- Stream D: `sendContract`, `resendContract`, `signContract` functions (email TODOs)
- Stream F: `createContractFromProposal`, `regenerateContractTerms`, `linkTemplateToContract` (HTML sanitization)

**Lesson:** Always run agents that touch the same file sequentially, not in parallel. Parallel writes cause "file has been unexpectedly modified" errors.

## .returning() Can Return undefined

Drizzle's `.returning()` destructured as `const [result] = await db.update(...).returning()` can give `undefined` if the WHERE clause matches no rows.

**Wrong:**
```typescript
const [contract] = await db.update(contracts).set(...).where(...).returning();
sendEmail(contract); // contract could be undefined
```

**Correct:**
```typescript
const [contract] = await db.update(contracts).set(...).where(...).returning();
if (contract) {
  sendEmail(contract);
}
```

Stream D hit this with `signedContract` on line 1366.

## isomorphic-dompurify Needs jsdom

`isomorphic-dompurify` automatically installs `jsdom` as a dependency for SSR. If you see `ReferenceError: window is not defined`, it means the wrong `dompurify` package was installed (use `isomorphic-dompurify`, NOT `dompurify`).

## Don't Use $env/dynamic/public in Import-Heavy Server Files

`$env/dynamic/public` works fine in `$lib/server/` files, but be aware it causes SvelteKit to evaluate the env at runtime, not build time. For server utilities called from remote functions, this is the correct choice. `$env/static/public` would fail if the env var isn't set at build time.

## Go Email Validation: net/mail.ParseAddress

`strings.Contains(email, "@")` accepts `@`, `a@`, `@b`, etc. Use `net/mail.ParseAddress()` which validates RFC 5322 format. Also add a length check (`len(email) > 254`) since RFC 5321 limits total length.

## MaxBytesReader First Argument

`http.MaxBytesReader(nil, r.Body, maxBytes)` — the first argument is the `ResponseWriter`. Passing `nil` is valid and means it won't write a 413 response automatically. The error surfaces through `io.ReadAll` returning an error, which is then handled by the existing error path.

## Rate Limiter Mutex: Unlock Before I/O

When the rate limit is exceeded, unlock the mutex BEFORE calling `writeResponse`. Otherwise the mutex is held during the HTTP write, blocking all other requests waiting for rate limit checks.

```go
if len(clients[clientIP]) >= requestsPerMinute {
    mu.Unlock()  // Unlock FIRST
    writeResponse(nil, w, r, nil, pkg.BadRequestError{...})
    return
}
```

## Pre-existing Go Test Errors

`repository_test.go`, `performance_test.go`, `workflow_test.go` have compiler errors from legacy Go consultation code (MockQuerier missing methods, wrong arg counts). These are NOT from Wave 1 changes — they're part of the dead Go consultation code identified for future removal in Wave 2.

## Transient 500 Errors During Agent File Writes

When agents modify files while the SvelteKit dev server is running, hot-reload can briefly show 500 errors as the module graph is rebuilding. These resolve on their own within seconds. Don't panic.

## Free Tier Changes Need No Migration

Subscription tier limits are defined in code (`subscription.ts` TIER_DEFINITIONS), not in the database. Changing limits is a code-only change — no migration needed. The database just stores which tier an agency is on.
