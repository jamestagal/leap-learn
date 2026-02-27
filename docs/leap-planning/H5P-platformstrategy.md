# H5P platform strategy: Catharsis hub integration and GoFast migration analysis

**For LeapLearn.io's H5P LMS platform, Catharsis serves best as a reference specification rather than a direct deployment target, while GoFast represents a significant but potentially valuable architectural upgrade.** Catharsis's tiny API surface (just 2–3 endpoints) can be reimplemented natively in your SvelteKit stack backed by Cloudflare R2, eliminating dependency on H5P.org without adding a separate Node.js server. GoFast's Go + ConnectRPC + PostgreSQL stack offers genuine production advantages — end-to-end type safety, compiled performance, and built-in observability — but demands a substantial rewrite and Go expertise. The Catharsis integration is a near-term win; the GoFast migration is a longer-term architectural bet.

---

## Catharsis is a blueprint, not a deployment target

**Catharsis** (v0.1.7, MIT license, by Oliver Tacke) is a Node.js server that acts as a drop-in replacement for H5P.org's Content Type Hub API at `api.h5p.org/v1`. It mirrors official H5P content types, serves custom/unofficial ones, and exposes the same endpoints that H5P clients expect. The project has **110 commits**, 2 contributors, and is deployed at `catharsis.snordian.de` and `libs.xr-energy.eu`. It is early-stage (0.x versioning, 11 open issues) but functional in production.

The architecture is entirely file-based — no database. Libraries live in `assets/libraries/`, packaged `.h5p` archives in `assets/exports/`, and a generated `hub-registry.json` serves as the content type catalog. Configuration lives in `.catharsis-config.json` with options for port, domain, rate limiting, and mirror sources with cron schedules. The CLI handles server management, mirroring from H5P.org, and library add/remove operations.

**Catharsis cannot run on Cloudflare Workers.** It depends on Node.js `fs` operations, runs as a persistent HTTP server, uses PID files and child process spawning, and implements in-process cron scheduling. Cloudflare Containers (beta) could theoretically host it, but would require persistent volume mounting for its file-based storage — an awkward fit. The better path for LeapLearn.io is to treat Catharsis as a protocol reference and reimplement its endpoints directly.

## The H5P Hub API is remarkably simple to replicate

H5P clients communicate with the hub through just three endpoints, all of which Catharsis documents clearly:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/sites` | POST | Client registration — returns a UUID (no real validation) |
| `/content-types/` | POST | Returns full content type registry as JSON |
| `/content-types/{machineName}` | GET | Downloads `.h5p` package file for a specific content type |

The `/content-types/` response is a JSON object containing a `contentTypes` array. Each entry includes machine name, version info (`major`, `minor`, `patch`), `coreApiVersionNeeded`, title, description, categories, keywords, icon URL, screenshot URLs, license, and owner. H5P clients POST registration data and usage statistics (as `x-www-form-urlencoded`) and receive this registry in return. Icons are served from `/libraries/{machineName}-{version}/icon.svg` and screenshots from `/files/`.

For LeapLearn.io, the mapping to your existing infrastructure is direct:

| Catharsis component | Your R2 + MongoDB equivalent |
|---------------------|------------------------------|
| `assets/libraries/` | R2: `official/extracted/{machineName}-{version}/` |
| `assets/exports/` | R2: `official/packages/{machineName}-{version}.h5p` |
| `assets/manifest.json` | MongoDB collection for content type metadata |
| `hub-registry.json` | Dynamically generated from MongoDB, cached in KV or R2 |
| `assets/files/` | R2: `official/assets/screenshots/` |

You can implement `/api/h5p-hub/sites` (return a UUID), `/api/h5p-hub/content-types/` (return registry JSON from MongoDB metadata), and `/api/h5p-hub/content-types/:machineName` (serve `.h5p` from R2) as SvelteKit server routes. This runs natively on Cloudflare's edge, integrates with your existing R2 bucket structure, and eliminates the need for a separate Node.js server entirely.

## Catharsis handles custom content types through a straightforward add-and-register flow

For official content types, Catharsis mirrors from `https://api.h5p.org/v1/content-types` either manually or on a cron schedule. The `referToOrigin` flag per content type controls whether downloads redirect to H5P.org or serve locally. For custom/unofficial content types, you add `.h5p` files via `libraries add /path/to/file.h5p`, then run `update` to regenerate the registry. Metadata (descriptions, screenshots, categories) is managed through `assets/manifest.json` — currently edited manually, as CLI-based manifest editing is listed as a TODO.

**The mixed setup is key**: official and custom content types coexist in the same registry. Each entry tracks its `origin` and `referToOrigin` independently. This means you could mirror all official H5P content types while simultaneously serving your own custom LeapLearn content types from the same hub endpoint. Your SvelteKit reimplementation should store an `origin` and `isCustom` flag per content type in MongoDB to replicate this flexibility.

One important note: **H5P clients hardcode `api.h5p.org/v1`** as the hub URL. Clients must be configured to point to your custom endpoint. In WordPress this requires modifying `h5p.classes.php` or using Oliver Tacke's "H5P Content Type Repository Manager" plugin. For your custom LMS, you control the H5P editor initialization and can set the hub URL directly.

---

## GoFast delivers a production-grade Go + SvelteKit stack for $40

**GoFast** (by Mateusz Piórowski) is a paid application generator that scaffolds a full-stack project with **Go 1.25+ backend, SvelteKit V5 frontend, ConnectRPC for API communication, and PostgreSQL 18 for storage**. The CLI (`gof`) generates complete CRUD scaffolding from model definitions, including database migrations, type-safe SQL queries, Protobuf service definitions, and ConnectRPC handlers. At **$40 one-time** (currently 60% off with code GOF60), it's a code generator — you own the output.

The V2 CLI (current) is at **v2.17.0** with 65 releases, 293 commits, and was last updated February 22, 2026. The GitHub organization is at `github.com/gofast-live`, and the open-source predecessor SGSG (`github.com/mpiorowski/sgsg`, 274 stars) demonstrates the same architectural patterns. The community is small — **37 stars** on the CLI repo, ~100+ paid users, Discord-based support — but the maintainer is an experienced Tech Lead with a consistent development track record.

GoFast V2 is deliberately opinionated, centering on one stack: ConnectRPC + PostgreSQL + SQLC + SvelteKit V5. V1 offered more provider choices (Next.js, Vue.js, HTMX, Turso, SQLite, multiple payment/email/storage providers). V2 trades flexibility for focus.

## ConnectRPC is GoFast's standout architectural choice

The most consequential technical decision in GoFast is **ConnectRPC** — Buf's HTTP-native RPC framework that provides end-to-end type safety through Protocol Buffers. Unlike tRPC (TypeScript-to-TypeScript only), ConnectRPC generates typed interfaces across Go and TypeScript from a single `.proto` definition. Adding a field to a Protobuf message immediately surfaces compile errors in both the Go backend and the SvelteKit frontend.

ConnectRPC supports three wire protocols simultaneously: the HTTP-native Connect protocol (JSON, cURL-friendly), native gRPC, and gRPC-Web — all from the same handler. No Envoy proxy is needed (unlike traditional gRPC-Web). It integrates directly with Go's standard `net/http` server and works with existing middleware. On the frontend, `@connectrpc/connect-web` provides fully typed TypeScript clients that work with SvelteKit's SSR, Form Actions, and Runes.

The development workflow centers on **four code generation pipelines**: SQLC generates type-safe Go from SQL queries (`make sql`), Protobuf/ConnectRPC generates Go server stubs and TypeScript client types (`make gen`), AtlasGo handles declarative schema migrations (`make migrate`), and `gof model` scaffolds all of the above from a simple definition like `gof model post title:string body:string published:bool`. Supported column types map to `text`, `numeric`, `timestamptz`, and `boolean` in PostgreSQL.

## What GoFast ships out of the box versus what you build

GoFast's value proposition is the infrastructure you don't have to build. The generated project includes:

- **Authentication**: OAuth2 with PKCE (GitHub, Google, Phone), Magic Links, 2FA, JWTs signed with **EdDSA** (Ed25519) with proper key rotation — no Auth0 or Clerk dependency
- **Authorization**: Bitwise RBAC with optional ABAC for complex scenarios
- **Payments**: Stripe integration with checkout, portal, and webhook handling
- **File storage**: S3/Cloudflare R2 integration (`gof add s3`)
- **Email**: Postmark integration (`gof add postmark`)
- **Monitoring**: Full Grafana LGTM stack — Loki for logs, Tempo for traces, Prometheus for metrics, OpenTelemetry auto-instrumentation, pre-built dashboards
- **Deployment**: Docker Compose for local dev, Kubernetes with Helm charts, CloudNativePG for PostgreSQL, GitHub Actions CI/CD with staging/production environments, Terraform support

What you must build yourself: all business logic, custom API endpoints beyond generated CRUD, complex authorization rules, frontend pages/components, third-party integrations beyond the included providers, and testing infrastructure.

## Migration from SvelteKit + MongoDB carries real costs

Moving LeapLearn.io from SvelteKit + MongoDB to GoFast's stack is not an incremental upgrade — it's a significant architectural shift across multiple dimensions:

| Dimension | Current (SvelteKit + MongoDB) | GoFast (Go + SvelteKit + PostgreSQL) |
|-----------|-------------------------------|--------------------------------------|
| Backend language | JavaScript/TypeScript | Go |
| API layer | REST or SvelteKit server routes | ConnectRPC with Protobuf |
| Database | MongoDB (schemaless documents) | PostgreSQL (relational, migration-based) |
| Query layer | MongoDB driver or Mongoose | SQLC (raw SQL, compile-time type-safe) |
| Type safety | TypeScript only | Cross-language via Protobuf |
| Deployment | Vercel/serverless-friendly | Docker/Kubernetes (more control, more ops) |

The **MongoDB to PostgreSQL migration** is the hardest part. H5P content is stored as JSON documents with nested structures — this maps naturally to MongoDB's document model. PostgreSQL handles this via `jsonb` columns, but you lose MongoDB's native document querying. Every data model needs redesigning: users, courses, progress tracking, permissions, and H5P content storage. SQLC requires writing raw SQL for every query — a fundamentally different mental model from Mongoose or MongoDB's aggregation pipeline.

**Go proficiency is non-negotiable.** The backend is pure Go with standard library patterns, dependency injection, and strategy pattern. If your team is JavaScript/TypeScript-focused, the learning curve is substantial. The Protobuf/ConnectRPC toolchain adds another layer of complexity (protoc, buf, code generation pipelines).

The deployment model also shifts. Your current SvelteKit stack likely deploys to Vercel or Cloudflare Pages. GoFast targets **Docker + Kubernetes** — significantly more infrastructure to manage, though the included Helm charts and CI/CD pipelines reduce the setup burden. GoFast's monitoring stack (Grafana + OTel) is genuinely excellent for production observability but adds operational overhead.

## A phased approach minimizes migration risk

Given that LeapLearn.io is actively running, an all-at-once migration is high-risk. If you decide GoFast's architecture is worth pursuing, consider three phases:

**Phase 0 — Evaluate**: Purchase GoFast ($40), run `gof init`, generate a test project with models resembling your H5P content types, and evaluate the generated code quality. Review the open-source predecessor SGSG (`github.com/mpiorowski/sgsg`) for free architectural insight before purchasing.

**Phase 1 — Catharsis hub integration (immediate)**: Implement the H5P Hub API endpoints in your current SvelteKit stack. This is independent of any backend migration, works with your existing R2 bucket structure, and removes H5P.org dependency today. Build the three endpoints (`/sites`, `/content-types/`, `/content-types/:machineName`), store content type metadata in MongoDB, serve `.h5p` files from R2.

**Phase 2 — Backend extraction (if pursuing GoFast)**: Introduce the Go backend alongside SvelteKit for new features, using ConnectRPC. Keep your existing SvelteKit server routes operational while gradually moving business logic to Go services. This lets you validate ConnectRPC's type-safety benefits without a full rewrite.

**Phase 3 — Data migration (long-term)**: Migrate from MongoDB to PostgreSQL incrementally, starting with relational data (users, roles, course enrollments) where PostgreSQL excels, and moving H5P content storage last (using `jsonb` columns for document-like data).

## Conclusion

The two topics have different timelines and risk profiles. **Catharsis integration is a clear near-term win** — the H5P Hub API is simple enough to reimplement in a few SvelteKit server routes backed by your existing R2 and MongoDB infrastructure. Use Catharsis's source code and `hub-registry.json` format as your specification. The key endpoints are well-documented, the response formats are straightforward, and you already have the storage layer in place.

**GoFast migration is a strategic architectural decision** that trades JavaScript simplicity for Go performance, cross-language type safety via ConnectRPC, and production-grade observability. The framework is actively maintained (v2.17.0, Feb 2026) and architecturally sound, but carries real costs: Go learning curve, MongoDB-to-PostgreSQL data model redesign, and Kubernetes deployment complexity. The $40 entry point makes evaluation cheap — the question is whether the long-term benefits of compiled performance, Protobuf type safety, and built-in monitoring justify the migration investment for LeapLearn.io's specific needs. For an LMS serving H5P content to potentially many concurrent users, Go's performance characteristics and PostgreSQL's relational modeling of users, courses, and permissions are genuine advantages worth the exploratory investment.