# Technology Stack

**Analysis Date:** 2026-01-22

## Languages

**Primary:**
- TypeScript 5.0+ - Frontend code and remote functions (`service-client/src`)
- Go 1.24-1.25 - Backend services (`app/service-core`, `app/service-admin`)

**Secondary:**
- Templ - Server-side HTML templating in Go admin service (`app/service-admin/`)
- SQL (PostgreSQL/SQLite) - Query definitions in `app/service-core/storage/sql/`

## Runtime

**Environment:**
- Node.js (LTS version, no .nvmrc file found)
- Go 1.24+ with workspace support (`app/go.work`)

**Package Managers:**
- npm - Frontend (`service-client/package.json`)
- Go modules - Backend (`app/service-core/go.mod`, `app/service-admin/go.mod`)
- Lockfile: `package-lock.json` (npm)

## Frameworks

**Frontend:**
- SvelteKit 2.46.4 - Full-stack framework with remote functions
- Svelte 5.39.11 - UI framework with runes support ($state, $derived, $props)
- Vite 7.1.9 - Build tooling
- TailwindCSS 4.1.6 - Utility CSS framework
- DaisyUI 5.0.35 - Component library built on TailwindCSS

**Backend:**
- gRPC 1.71.0 - Inter-service RPC with Protocol Buffers
- REST APIs - HTTP endpoints in Go services

**Admin UI:**
- Templ 0.3.977 - Type-safe HTML templating in Go

**Testing:**
- Vitest 3.0.0 - Unit testing (frontend)
- Playwright 1.49.1 - E2E testing
- Testing Library (Svelte) 5.2.4 - Component testing utilities

**Build/Dev:**
- SvelteKit adapters:
  - Cloudflare (`@sveltejs/adapter-cloudflare` 7.2.4) - Production
  - Node (`@sveltejs/adapter-node` 5.4.0) - Development
- `@tailwindcss/vite` 4.1.16 - TailwindCSS Vite plugin
- ESLint 9.18.0 - Linting
- Prettier 3.4.2 - Code formatting
  - prettier-plugin-svelte 3.3.3
  - prettier-plugin-tailwindcss 0.6.11

## Key Dependencies

**Database:**
- drizzle-orm 0.45.1 - ORM for TypeScript (`service-client`)
- pg 8.16.3 - PostgreSQL client (`service-client`)
- jackc/pgx/v5 - PostgreSQL driver (Go)
- lib/pq - PostgreSQL Postgres driver (Go)
- sqlc-dev/pqtype - PostgreSQL types for sqlc
- tursodatabase/go-libsql - Turso database support

**Authentication:**
- jose 5.9.3 - JWT handling (TypeScript)
- golang-jwt/jwt/v5 - JWT tokens (Go)
- golang.org/x/oauth2 0.28.0 - OAuth2 support (Go)

**API & External Services:**
- @anthropic-ai/sdk 0.71.2 - Claude AI for proposal generation
- stripe 20.1.0 - Stripe payment processing (TypeScript)
- stripe/stripe-go/v82 - Stripe SDK (Go)
- resend 6.6.0 - Email service API
- nodemailer 7.0.12 - SMTP email sending
- twilio/twilio-go 1.25.1 - Twilio SMS/voice (Go)

**Cloud Storage:**
- cloud.google.com/go/storage 1.51.0 - Google Cloud Storage
- Azure/azure-sdk-for-go/sdk/storage/azblob 1.6.0 - Azure Blob Storage
- aws/aws-sdk-go-v2 1.36.3 - AWS SDK (S3)

**Data Validation:**
- valibot 1.2.0 - Schema validation for remote functions (TypeScript)
- zod 4.1.11 - Schema validation (TypeScript, secondary)

**Rich Text Editor:**
- @tiptap/core 3.15.1 - Rich text editor
- @tiptap/starter-kit 3.15.1 - Pre-configured extensions
- @tiptap/extension-link 3.15.1
- @tiptap/extension-placeholder 3.15.1

**UI Components:**
- lucide-svelte 0.511.0 - Icon library
- paneforge 1.0.2 - Resizable panels
- svelte-dnd-action 0.9.69 - Drag-and-drop
- @floating-ui/dom 1.6.5 - Floating elements positioning

**Utilities:**
- nanoid 5.1.6 - Unique ID generation
- diff 8.0.3 - Diff/patch operations
- dotenv 17.2.3 - Environment variable loading
- winston 3.15.0 - Logging

**Messaging:**
- nats-io/nats.go 1.40.1 - NATS message queue (Go admin service)

**OpenTelemetry:**
- go.opentelemetry.io/otel 1.34.0 - Observability (Go)
- go.opentelemetry.io/otel/sdk 1.34.0
- go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp 0.59.0

**Testing Utilities:**
- @testing-library/jest-dom 6.6.3
- jsdom 26.0.0 - DOM implementation for Node.js

## Configuration

**Environment:**
- Environment variables loaded from `.env` file
- Separate configs for dev (`localhost`), staging, and production (`webkit.au`)
- Per-service environment variable configuration (see docker-compose.yml)

**Build Configuration:**
- `svelte.config.js` - SvelteKit config with dual adapter support
- `vite.config.ts` - Vite build configuration with TailwindCSS and testing plugins
- `tailwind.config.ts` - TailwindCSS customization (not found in current build, using defaults)
- `tsconfig.json` - Strict TypeScript configuration with SvelteKit paths
- `eslint.config.js` - Flat ESLint config with TypeScript and Svelte support
- `.prettierrc` - Prettier formatting (tabs, trailing commas, print width 100)
- `playwright.config.ts` - E2E test configuration

**Go Backend:**
- Go workspace setup (`app/go.work`) for monorepo support
- Air configuration (`.air.toml`) for hot reload during development
- Protocol Buffer definitions in `proto/` directory

## Platform Requirements

**Development:**
- Node.js with npm
- Go 1.24+
- Docker + Docker Compose (for services)
- PostgreSQL 17-alpine (development)
- NATS message queue
- Gotenberg 8 (PDF generation)
- Mailpit (SMTP testing)

**Production:**
- Docker + Docker Compose on Hostinger VPS
- PostgreSQL 16-alpine (pinned version)
- Traefik 2.x (reverse proxy with Let's Encrypt)
- NATS message queue
- GitHub Container Registry (GHCR) for images
- Cloudflare R2 (file storage)

**Service Ports:**
- Client (SvelteKit): 3000 (dev), HTTPS via Traefik (production)
- Admin (Go + Templ): 3001 (HTTP), 3002 (SSE)
- Core (Go gRPC/REST): 4001 (HTTP), 4002 (gRPC)
- PostgreSQL: 5432
- NATS: 8222
- Mailpit: 8025 (Web UI), 1025 (SMTP)
- Gotenberg: 3003 (dev), 3000 (container)

---

*Stack analysis: 2026-01-22*
