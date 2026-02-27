# Deployment Learnings

## JWT key flow

The JWT key injection follows this chain:

```
GitHub Secrets (PRIVATE_KEY_PEM, PUBLIC_KEY_PEM)
  -> CI step writes to filesystem before Docker build
    -> Dockerfile COPY bakes into image at /private.pem, /public.pem
      -> Go code reads at runtime via os.ReadFile("/private.pem")
        -> Cleanup step removes files from CI workspace
```

The Go code (`app/pkg/auth/auth.go`) has a fallback chain:
1. Check `JWT_PRIVATE_KEY` env var (currently unused in production)
2. Fall back to `os.ReadFile("/private.pem")`

## Container base images and available tools

| Service | Base Image | Has curl | Has wget | Has node |
|---------|-----------|----------|----------|----------|
| core | `debian:bookworm-slim` | Yes (added) | No | No |
| admin | `debian:bookworm-slim` | Yes (added) | No | No |
| client | `node:22-slim` | No | No | Yes |

## Traefik health check behavior

Traefik respects Docker health check status. If a container is marked `unhealthy`, Traefik removes it from routing and returns 404. The container can be running perfectly fine internally - if the health check command itself fails (e.g., tool not found), Traefik treats it as down.

In Traefik logs, a missing router name (`"-"` in the router field) indicates no matching route, which can mean the backend container is unhealthy.
