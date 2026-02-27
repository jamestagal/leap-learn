# External Integrations

**Analysis Date:** 2026-01-22

## APIs & External Services

**AI Services:**
- Claude API (Anthropic) - AI-powered proposal generation
  - SDK: `@anthropic-ai/sdk` 0.71.2
  - Auth: `ANTHROPIC_API_KEY` environment variable
  - Implementation: `service-client/src/lib/server/services/claude.service.ts`
  - Model: Claude Haiku 4.5 (claude-haiku-4-5-20251001) for cost efficiency
  - Used for: Generating proposal content sections via `service-client/src/routes/api/proposals/[proposalId]/generate-stream/+server.ts`

**Payment Processing:**
- Stripe - Payment processing and subscriptions
  - SDK: `stripe` 20.1.0 (TypeScript), `stripe/stripe-go/v82` (Go)
  - Auth: `STRIPE_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
  - Implementation: `service-client/src/lib/api/stripe.remote.ts`
  - Webhooks: `service-client/src/routes/api/stripe/webhook/+server.ts` (handles checkout, payments, account updates)
  - OAuth2: Stripe Connect for agency account linking via `service-client/src/routes/api/stripe/connect/+server.ts`
  - Callback: `service-client/src/routes/api/stripe/callback/+server.ts`
  - Used for: Invoice payments, subscription management, payout processing

**SMS/Voice:**
- Twilio - SMS and phone authentication
  - SDK: `twilio/twilio-go` 1.25.1 (Go)
  - Auth: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_SERVICE_SID`
  - Used for: Phone-based authentication (optional, alternate to email)

**OAuth Authentication:**
- Google OAuth 2.0
  - Credentials: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
  - Default auth provider in development
- GitHub OAuth
  - Credentials: `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`
  - Optional alternate auth provider

**File Storage & CDN:**
- Cloudflare R2 - Object storage (production default)
  - Bucket: `webkit-files`
  - Endpoint: `R2_ENDPOINT` (https://c41e127fa4130b910482efa823edd9d2.r2.cloudflarestorage.com)
  - Auth: `R2_ACCESS_KEY`, `R2_SECRET_KEY`
  - Alternative providers:
    - AWS S3 (S3_REGION, S3_ACCESS_KEY, S3_SECRET_KEY)
    - Google Cloud Storage (GOOGLE_APPLICATION_CREDENTIALS)
    - Azure Blob Storage (AZBLOB_ACCOUNT_NAME, AZBLOB_ACCOUNT_KEY)
    - Local filesystem (LOCAL_FILE_DIR for development)

**Website Performance Analysis:**
- Google PageSpeed Insights API
  - Auth: `PAGESPEED_API_KEY`
  - Used for: Consultation questionnaire page speed audits

## Data Storage

**Databases:**
- PostgreSQL 16-alpine (production), 17-alpine (development)
  - Connection: `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`
  - Client: Drizzle ORM (`drizzle-orm` 0.45.1, `pg` 8.16.3)
  - Location: Docker container `webkit-postgres` on internal network
  - Schema: `service-client/src/lib/server/schema.ts` (Drizzle definitions mirror Go backend)
  - Direct connection for SvelteKit remote functions: `service-client/src/lib/server/db.ts`

**Database Alternatives:**
- SQLite (via `modernc.org/sqlite`)
- Turso/LibSQL (via `github.com/tursodatabase/go-libsql`)
  - Connection: `TURSO_URL`, `TURSO_TOKEN`

**File Storage:**
- Cloudflare R2 (production)
- AWS S3 (alternative)
- Google Cloud Storage (alternative)
- Azure Blob Storage (alternative)
- Local filesystem (development)

**Caching:**
- Not explicitly configured
- Browser Cache API for prerender data

## Authentication & Identity

**Auth Provider:**
- Google OAuth 2.0 (default, configurable via `AUTH_PROVIDER` env var)
- Alternate providers: GitHub OAuth, Twilio SMS, local/custom

**Implementation:**
- JWT tokens (access_token: 15 min, refresh_token: 30 days)
- HTTP-only cookies (`access_token`, `refresh_token`)
- Token refresh via `service-client/src/lib/server/refresh.ts`
- JWT verification: `service-client/src/lib/server/jwt.ts`
- Auth hooks: `service-client/src/hooks.server.ts`
- Login endpoints: `app/service-core/rest/login_route.go`
- Magic Link authentication support
- User context extraction: `service-client/src/lib/server/auth.ts`

## Email Services

**Email Provider:**
- Resend API (production)
  - SDK: `resend` 6.6.0
  - Auth: `RESEND_API_KEY`
  - Implementation: `service-client/src/lib/server/services/email.service.ts`

**SMTP (Local Development):**
- Mailpit (development email testing)
  - Host: `mailpit` (Docker)
  - Port: 1025 (SMTP)
  - Web UI: 8025
  - No authentication required
  - Client: `nodemailer` 7.0.12

**Alternate Email Providers (Not currently used):**
- SendGrid (`SENDGRID_API_KEY`)
- Postmark (`POSTMARK_API_KEY`)
- AWS SES (SES_ACCESS_KEY, SES_SECRET_KEY, SES_REGION)
- Generic SMTP (SMTP_HOST, SMTP_PORT, SMTP_USERNAME, SMTP_PASSWORD)

**Email Operations:**
- Sending: `sendEmail()` in email service
- Attachments: PDF documents (proposals, invoices, contracts)
- Templates: HTML email rendering in remote functions
- Tracking: Email history stored in database

## Monitoring & Observability

**Error Tracking:**
- Not detected in current configuration

**Logs:**
- Winston 3.15.0 - Structured logging library
- Log levels configurable via `LOG_LEVEL` environment variable
- Streamed to Docker stdout/stderr

**OpenTelemetry:**
- go.opentelemetry.io/otel 1.34.0 - Instrumenting Go services
- go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp 0.59.0
- Exporters for GCP (GoogleCloudPlatform/opentelemetry-operations-go)
- Not actively configured but infrastructure available

**Monitoring Stack (Separate deployment):**
- Grafana - Metrics visualization (configured in `monitoring/`)
- Prometheus - Metrics collection
- Loki - Log aggregation

## CI/CD & Deployment

**Hosting:**
- Hostinger VPS (production)
- GitHub Container Registry (GHCR) for Docker images

**CI Pipeline:**
- GitHub Actions
  - Build workflow: Builds Docker images for core, admin, client services
  - Deploy workflow: One-click deployment to production
  - Secrets: VPS_HOST, VPS_USER, VPS_SSH_KEY, PRIVATE_KEY_PEM, PUBLIC_KEY_PEM

**Container Orchestration:**
- Docker Compose (development and production)
- Reverse Proxy: Traefik 2.x (production with automatic Let's Encrypt)

**Container Registry:**
- GitHub Container Registry (ghcr.io)
  - Images: ghcr.io/jamestagal/webkit/service-core-r, service-admin-r, service-client-r

## Environment Configuration

**Required Environment Variables:**

Development (.env file):
- `DATABASE_PROVIDER` - postgres (default), sqlite, turso
- `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`
- `AUTH_PROVIDER` - google (default), github, local
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `PAYMENT_PROVIDER` - local (default), stripe
- `STRIPE_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- `EMAIL_PROVIDER` - smtp (dev), resend (production)
- `RESEND_API_KEY`
- `SMTP_HOST`, `SMTP_PORT` (Mailpit for local development)
- `FILE_PROVIDER` - r2 (production), local (development)
- `R2_ENDPOINT`, `R2_ACCESS_KEY`, `R2_SECRET_KEY`
- `ANTHROPIC_API_KEY` - Claude API for proposal generation
- `GOTENBERG_URL` - PDF generation service
- `PAGESPEED_API_KEY` - Google PageSpeed API
- `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN` - Cloudflare configuration

**Secrets Location:**
- `.env` file (local development) - DO NOT COMMIT
- GitHub Actions Secrets (production deployment)
- Environment variables passed via Docker Compose

**Cookie Security:**
- `secure` flag conditional on environment (false for localhost, true for production)
- Domain scoping via `DOMAIN` environment variable
- HTTP-only, SameSite=Lax

## Webhooks & Callbacks

**Incoming Webhooks:**
- Stripe webhook endpoint: `/api/stripe/webhook` (POST)
  - Events: checkout.session.completed, payment_intent.succeeded, account.updated, account.application.deauthorized
  - Implementation: `service-client/src/routes/api/stripe/webhook/+server.ts`

**Outgoing Webhooks/Callbacks:**
- Stripe OAuth callback: `/api/stripe/callback` (GET)
- Stripe Connect: `/api/stripe/connect` (POST)
- Agency callback notifications (not detected, may be in Go backend)

**Data Export Endpoints:**
- GDPR export: `/api/agency/export` and `/api/user/export`
- Implementation: `service-client/src/routes/api/agency/export/+server.ts`, `service-client/src/routes/api/user/export/+server.ts`

## PDF Generation

**Service:**
- Gotenberg 8 (open-source PDF generation)
  - Container: `webkit-gotenberg`
  - URL: `http://gotenberg:3000` (internal), `http://localhost:3003` (dev)
  - Method: HTML to PDF via Chromium

**PDF Endpoints:**
- Proposals: `/api/proposals/[proposalId]/pdf` (`service-client/src/routes/api/proposals/[proposalId]/pdf/+server.ts`)
- Invoices: `/api/invoices/[invoiceId]/pdf`
- Contracts: `/api/contracts/[contractId]/pdf`
- Questionnaires: `/api/questionnaires/[questionnaireId]/pdf`
- Form submissions: `/api/forms/[submissionId]/pdf`

**Usage:**
- PDF generation on-demand via HTTP POST to Gotenberg
- PDFs attached to emails via fetch from PDF endpoints
- Memory limits: 1GB max, 512MB reserved

---

*Integration audit: 2026-01-22*
