## 12. CLAUDE.md Agent Instructions

# LeapLearn H5P LMS — Agent Instructions

## Project Overview
Multi-tenant H5P Learning Management System built on GoFast stack.
Target domain: leaplearn.io

## Architecture
- Go backend (Core + Admin services) with ConnectRPC
- SvelteKit V5 frontend with Svelte 5 runes
- PostgreSQL with SQLC (Go) and Drizzle (SvelteKit)
- Cloudflare R2 for H5P file storage
- Based on Webkit project patterns (github.com/jamestagal/webkit)

## Critical Rules
1. ALWAYS scope database queries by org_id for tenant isolation
2. Use withOrgScope() helper for all org-scoped operations
3. H5P content.json stored as jsonb — never query into it, retrieve by ID
4. Library dependency resolution uses recursive CTEs, not application-level recursion
5. R2 paths follow: h5p-libraries/{origin}/{packages|extracted}/ and h5p-content/{org_id}/{content_id}/
6. Hub API endpoints are REST (not ConnectRPC) for H5P client compatibility
7. Check existing components in service-client/src/lib/components/ before creating new ones

## Build Commands
- `make gen` — Generate proto + ConnectRPC types
- `make sql` — Run SQLC code generation
- `make migrate` — Apply AtlasGo migrations
- `docker compose up --build` — Start all services
- `sh scripts/keys.sh` — Generate JWT keys (first time only)

## Service Ports
- Client: http://localhost:3000
- Admin: http://localhost:3001
- Core API: http://localhost:4001 (HTTP) / localhost:4002 (gRPC)
- PostgreSQL: localhost:5432
- MinIO (R2 dev): http://localhost:9000 (API) / http://localhost:9001 (console)
- Mailpit: http://localhost:8025
```

---

## 13. Summary of What to Build vs Reuse

| Component | Action | Source |
|-----------|--------|--------|
| Docker Compose / Kubernetes / Helm | Copy + extend | Webkit |
| CI/CD GitHub Actions | Copy directly | Webkit |
| Grafana + monitoring stack | Copy directly | Webkit |
| Terraform infrastructure | Copy + adapt | Webkit |
| Auth (OAuth2, JWT, sessions) | Copy directly | Webkit |
| Multi-tenancy (org scope) | Rename agency → org, add roles | Webkit |
| GDPR data export | Copy + extend | Webkit |
| Subscription tiers | Copy directly | Webkit |
| Org settings / config options | Adapt from agency_form_options | Webkit |
| SvelteKit ConnectRPC client setup | Copy directly | Webkit |
| Svelte 5 shared components | Copy directly | Webkit |
| R2 file storage client | **Build new** | — |
| H5P Hub API (Catharsis replacement) | **Build new** | Catharsis spec |
| H5P Library management | **Build new** | — |
| H5P Content management | **Build new** | — |
| H5P Editor integration | **Build new** | Existing SvelteKit code |
| H5P Player (h5p-standalone) | **Build new** | — |
| Course management | **Build new** | — |
| Enrollment + progress tracking | **Build new** | — |
| xAPI statement recording | **Build new** | — |
| Content generation (CLI tools) | **Adapt** | h5p-cli-creator |
| Multi-step wizard (course builder) | Adapt from consultation wizard | Webkit |
