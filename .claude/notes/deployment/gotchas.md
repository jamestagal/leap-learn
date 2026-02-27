# Deployment Gotchas

## NEVER remove JWT key injection from deploy workflow

**Date:** 2026-02-11
**Severity:** P0 - breaks all authentication

The deploy workflow (`deploy-production.yml`) has critical steps that inject JWT PEM files from GitHub Secrets into the Docker build context:

1. **Before build:** Write `secrets.PRIVATE_KEY_PEM` and `secrets.PUBLIC_KEY_PEM` to files in the service directories
2. **During build:** Dockerfile `COPY` picks them up and bakes them into the production image at `/private.pem` and `/public.pem`
3. **After build:** Clean up the key files from the CI workspace

**What happens if removed:** The Go auth code (`app/pkg/auth/auth.go`) tries env var `JWT_PRIVATE_KEY` first, then falls back to reading `/private.pem` from disk. If neither exists, `GenerateTokens()` fails and login returns HTTP 500 "Error creating auth tokens".

**Key files needed per service:**
- `service-core`: `private.pem` + `public.pem` (signs and verifies tokens)
- `service-admin`: `public.pem` only (verifies tokens)
- `service-client`: `public.pem` only (verifies tokens)

**The docker-compose.production.yml `${JWT_PRIVATE_KEY}` env vars are NOT a replacement.** They are empty on the VPS. The file-based approach via Dockerfile COPY is the actual mechanism.

**Root cause of 2026-02-11 outage:** Wave 2 Stream J refactored `deploy-production.yml` and removed the key injection steps. The production containers were built without JWT keys, breaking all authentication.

## Health checks must match container tooling

**Date:** 2026-02-11
**Severity:** P0 - causes site-wide 404

Docker health checks in `docker-compose.production.yml` must use tools that exist in the container:

- **Go services** (`debian:bookworm-slim`): Use `curl` (added to Dockerfile). Do NOT use `wget`.
- **Node service** (`node:22-slim`): Use `node -e "fetch(...)"`. Do NOT use `wget` or `curl`.

**What happens if wrong:** Traefik excludes unhealthy containers from routing, causing 404 for all requests. The service is actually running fine but Traefik won't send traffic to it.

**The deploy script health checks (`deploy-production.yml`) run on the VPS host**, not inside containers, so they should use `curl` (available on the VPS).
