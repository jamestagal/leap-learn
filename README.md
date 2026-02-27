# Webkit - Agency Proposal Generator

A multi-tenant SaaS platform for web agencies to create professional client consultations and proposals.

## Features

### Multi-Tenancy Architecture
- **Agency-based tenancy**: Each agency has isolated data with customizable branding
- **Role-based access**: Owner, Admin, and Member roles with granular permissions
- **Subscription tiers**: Free, Starter, Growth, and Enterprise with enforced limits
- **GDPR compliance**: Data export endpoints for agencies and users

### Consultation System
- **Multi-step wizard**: Guided consultation form with progress tracking
- **Auto-save drafts**: Changes saved automatically as users progress
- **Agency-configurable options**: Customize dropdown options per agency (industries, budget ranges, etc.)
- **View/Edit/History**: Full consultation lifecycle management

### Technical Stack
- **Frontend**: SvelteKit with Svelte 5 runes, TypeScript, TailwindCSS
- **Backend**: Go microservices (Core + Admin), gRPC/REST APIs
- **Database**: PostgreSQL with Drizzle ORM (SvelteKit) and SQLC (Go)
- **Remote Functions**: Direct database access from SvelteKit server-side code

## Quick Start

### Prerequisites
- Docker and Docker Compose
- Node.js 20+
- Go 1.21+

### Setup

1. Generate JWT keys:
```bash
sh scripts/keys.sh
```

2. Compile SQL queries:
```bash
sh scripts/run_queries.sh postgres
```

3. Start services:
```bash
docker compose up --build
```

4. Run database migrations:
```bash
sh scripts/atlas.sh postgres
```

5. Access the application:
- Client: http://localhost:3000
- Admin: http://localhost:3001

## Multi-Tenancy Architecture

### Database Model (Single Shared Database)

We use a **shared database with row-level tenant isolation** - all agencies share the same tables with `agency_id` columns for data separation.

```
┌─────────────────────────────────────────────────────────────────┐
│                    PostgreSQL Database                          │
├─────────────────────────────────────────────────────────────────┤
│  agencies              │  Users create/join agencies            │
│  agency_memberships    │  User-Agency relationships + roles     │
│  agency_form_options   │  Customizable form dropdowns           │
│  consultations         │  Scoped by agency_id                   │
│  consultation_drafts   │  Scoped by agency_id                   │
└─────────────────────────────────────────────────────────────────┘
```

### Data Isolation

All queries use the `withAgencyScope()` helper to enforce tenant isolation:

```typescript
// Example: Get consultations for current agency only
const consultations = await withAgencyScope(agencyId, async (id) => {
    return db.query.consultations.findMany({
        where: eq(consultations.agencyId, id)
    });
});
```

### Form Customization Per Agency

Each agency can customize form dropdown options via the `agency_form_options` table:

| Category | What It Controls |
|----------|------------------|
| `industry` | Industry dropdown options |
| `business_type` | Business type options |
| `budget_range` | Budget range options |
| `urgency_level` | Urgency level options |
| `primary_challenges` | Challenge checkboxes |
| `digital_presence` | Digital presence options |
| `marketing_channels` | Marketing channel options |
| ... | 14 total categories |

## Route Structure

### Agency-Scoped Routes
```
/agencies                           # List/manage agencies
/agencies/create                    # Create new agency
/[agencySlug]/                      # Agency dashboard
/[agencySlug]/consultation          # New consultation
/[agencySlug]/consultation/history  # Consultation list
/[agencySlug]/consultation/view/[id]
/[agencySlug]/consultation/edit/[id]
```

### API Endpoints
```
/api/agency/export    # GDPR: Export agency data
/api/user/export      # GDPR: Export user data
```

## Environment Variables

Key variables in `docker-compose.yml`:

| Variable | Description |
|----------|-------------|
| `PUBLIC_APP_DOMAIN` | Domain for agency URLs (e.g., `webkit.au`) |
| `DATABASE_URL` | PostgreSQL connection string |
| `DIRECT_URL` | Direct PostgreSQL URL (for migrations) |

## Development

### Service Ports
- Client: http://localhost:3000
- Admin: http://localhost:3001 (HTTP), http://localhost:3002 (SSE)
- Core: http://localhost:4001 (HTTP), localhost:4002 (gRPC)
- PostgreSQL: localhost:5432
- Mailpit: http://localhost:8025

### Useful Commands
```bash
# Format frontend code
sh scripts/format.sh

# Run tests
cd service-client && npm run test

# Apply schema changes
sh scripts/atlas.sh postgres
```

## Documentation

- [Multi-Tenancy Recommendations](docs/spec/multi-tenancy-recommendations.md)
- [Remote Functions Guide](docs/user-guides/remote-functions.md)
- [Svelte 5 Patterns](docs/SVELTE5_UPDATES.md)
- [Environment Config](docs/deployment/environment-config.md)

## Monitoring

For Grafana monitoring, see `/monitoring` folder.
For Kubernetes deployment, see `/infra` folder.
