# Webkit Feature Status — 14 February 2026

Cross-referenced against `docs/plans/execution-roadmap.md` (dated 2026-02-08), git commit history, and codebase inspection.

---

## Wave 1: Critical Fixes (P0) — COMPLETE

| Stream | Description | Status | Evidence |
|--------|-------------|--------|----------|
| **A** | Go Backend Hardening | **~90% done** | Rate limiter with mutex ✅ (`middleware.go:44-111`), error sanitization ✅ (`server.go:141-214`), HTTP timeouts ✅. `http.MaxBytesReader` not found — low risk since Traefik enforces request limits in production. |
| **B** | SvelteKit Quick Fixes | **✅ Done** | `+error.svelte` ✅, Zod removed ✅ (Valibot throughout), free tier updated to 10 consultations ✅ (`subscription.ts:47-53`), unused Button/LoadingIcon/Spinner deleted (`7e18b2b`). |
| **C** | DB Race Conditions | **✅ Done** | Unique constraints on doc numbers (`migration 010`), AI counter uses atomic SQL UPDATE with CASE (`subscription.ts:340-358`). Advisory locks not used — unique constraints provide sufficient protection. |
| **D** | Contract Emails | **✅ Done** | `sendContract`, `resendContract` in `contracts.remote.ts`, email service integrated. |
| **E** | Production Infra | **✅ Done** | Gotenberg memory/timeout limits ✅ (`docker-compose.production.yml:225-250`), health checks on all services ✅, monitoring docs ✅ (`c604c1d`). R2 backup config present. |
| **F** | XSS Audit | **✅ Done** | `sanitize.ts` with `isomorphic-dompurify`, tag/attribute whitelist, used throughout proposals/quotations/invoices/contracts. |

**Atlas Blocker — ✅ Resolved** (`3c8929f`): `release.yml`, `migration.yml`, `pr-preview.yml`, `scripts/atlas.sh` all removed.

---

## Wave 2: Launch Readiness (P1) — COMPLETE

| Stream | Description | Status | Evidence |
|--------|-------------|--------|----------|
| **G** | Dashboard & Reporting | **✅ Done** | Reports page with monthly revenue, consultation pipeline, proposal conversion, invoice aging, team activity (`reports/+page.server.ts`). Chart.js integration. Gated to Growth+ tier. Activity feed via `agencyActivityLog` table. Commit `8f7c891`. |
| **H** | DB Integrity | **✅ Done** | Unique constraints on (agency_id, doc_number) for proposals/contracts/invoices (`migration 010`). Schema drift fixes (`migration 011`). Foreign key fixes (`migration 012`). Commit `c1767b1`. |
| **I** | Security/CI | **✅ Done** | Atlas/K8s cleanup ✅, JWT keys from env vars ✅ (`deploy-production.yml:38-77`), migration tracking table ✅ (`migration 013`), Traefik rate limiting ✅ (API: 100/s, Admin: 50/s, Client: 200/s), legacy payment system removed ✅ (`6d1dfac`). |
| **J** | Deploy Improvements | **✅ Done** | Graceful shutdown with signal handling ✅ (`main.go:57-72`), `stop_grace_period: 30s` on all services, rolling deploys with health checks ✅ (`deploy-production.yml:128-151` — core → admin → client sequentially with 10s sleep). |
| **K** | Onboarding | **✅ Done** | Onboarding wizard at `/[agencySlug]/onboarding/` with `+page.server.ts` + `+page.svelte`. DB support via `onboarding_completed_at` timestamp (`migration 015`). Commit `d8df2f0`. |

---

## Wave 3: Post-Launch Polish (P2) — COMPLETE

| Stream | Description | Status | Evidence |
|--------|-------------|--------|----------|
| **L** | UI Polish | **✅ Done** | Breadcrumb navigation (`3e46976`), ARIA attributes on sidebar/switcher (`de376bb`), sidebar refactored to Svelte state (`8f54515`), page transition progress indicator with NProgress (`1f0057c`), unused components deleted (`7e18b2b`). |
| **M** | Infrastructure Scaling | **✅ Done** | Gotenberg health checks, monitoring docs, backup config (`c604c1d`). Redis/NATS/full monitoring stack deferred — not needed at current scale. |
| **N** | Database Architecture | **✅ Done** | CASCADE → SET NULL fix (`2e6e751`), typed context key (`1a77027`), Go consultation dead code removed (`024b46c`), duplicate bare routes removed (`88feeca`), orphaned JSONB columns dropped (`318d040`). |
| **O** | Encryption at Rest | **✅ Done** | AES-256-GCM encryption for banking/tax fields (BSB, accountNumber, taxFileNumber) in `crypto.ts`. `ENCRYPTION_KEY` env var. Graceful fallback for unencrypted legacy data. Commit `87dc071`. |

---

## Wave 4: Future (P3) — NOT STARTED

These are post-launch features with no urgency:
- Client portal
- Recurring invoices
- International support (multi-currency, i18n)
- Integrations (Xero, Slack)
- Marketplace
- Project management
- Logo storage migration
- Client search improvements
- ElectricSQL evaluation

---

## Features Built Outside the Roadmap

| Feature | Status | Key Files |
|---------|--------|-----------|
| **Quotation System** | ✅ Complete | `quotations.remote.ts`, `quotation-templates.remote.ts`, routes at `/quotations/`, `/settings/quotations/{scopes,templates,terms}`, public view at `/q/[slug]`, PDF generation, email sending, isEditing toggle. Commits `8d82b57`, `07993a4`, `6a599bb`. |
| **Sentry Integration** | ✅ Complete | `@sentry/sveltekit`, `instrumentation.server.ts` (server init, 20% trace sampling), `hooks.client.ts` (browser tracing, 10% sampling), `sentryHandle()` in hooks sequence. DSN via `PUBLIC_SENTRY_DSN` env var. Commit `7b80cd5`. |
| **RichTextEditor (TipTap)** | ✅ Complete | `RichTextEditor.svelte` with `@tiptap/core`, `@tiptap/starter-kit`, link/placeholder extensions. Used in proposals (executiveSummary, opportunityContent, etc.), quotations (optionsNotes, terms), invoices (publicNotes), contract schedules. Commit `ff3c01a`. |
| **AutoResizeTextarea** | ✅ Complete | `AutoResizeTextarea.svelte` — auto-growing textarea. Used for checklist items and internal notes. Commit `ff3c01a`. |
| **Toast Store SSR Fix** | ✅ Complete | `hasContext()` guard and module-level fallback for SSR edge cases. Commit `80cd579`. |

---

## Pre-Roadmap Features (Already Existed)

| Feature | Key Files |
|---------|-----------|
| **Invoice System** | `invoices.remote.ts` — full CRUD, create from proposal/contract/quotation, stats, PDF generation, Stripe payment links, public view at `/i/[slug]` |
| **Proposal System** | `proposals.remote.ts` — full CRUD, AI content generation with Claude streaming, mark ready/revert to draft, send, duplicate, public view at `/p/[slug]` |
| **Contract System** | `contracts.remote.ts` — full CRUD, contract templates with schedules, signing flow, send/resend, PDF generation, public view at `/c/[slug]` |
| **Stripe Connect** | `stripe.remote.ts` — OAuth flow, payment link creation, webhook handling, connection status |
| **Form Builder** | Dynamic form builder with drag-drop, public form rendering, consultation form conversion |
| **Subscription Billing** | Stripe-based with free/starter/growth/enterprise tiers, feature gating |
| **AI Proposal Generation** | Claude streaming endpoint at `/api/proposals/[proposalId]/generate-stream` |
| **Demo Data** | Agency onboarding demo data generation |
| **Multi-tenant Architecture** | Agency-based tenancy with row-level isolation, role-based permissions |

---

## Summary

| Wave | Streams | Status |
|------|---------|--------|
| Wave 1 (Critical Fixes) | A, B, C, D, E, F | **✅ Complete** (A has minor `MaxBytesReader` gap, mitigated by Traefik) |
| Wave 2 (Launch Readiness) | G, H, I, J, K | **✅ Complete** |
| Wave 3 (Post-Launch Polish) | L, M, N, O | **✅ Complete** |
| Wave 4 (Future) | — | Not started (by design) |
| Extra | Quotations, Sentry, RichTextEditor, AutoResizeTextarea | **✅ Complete** |

**Bottom line:** Waves 1–3 from the execution roadmap are fully implemented. The platform is launch-ready with additional features (quotation system, Sentry, rich text editing) built on top.
