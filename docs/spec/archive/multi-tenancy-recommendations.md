# Multi-Tenancy Implementation Recommendations

## Overview

This document outlines recommended enhancements to the multi-tenancy implementation plan for transforming the WebKit consultation system from single-user to an agency-based SaaS platform. These recommendations address security, data isolation, compliance, and operational concerns.

## Reference Architecture

The plan correctly leverages BetterKit patterns from RaffleKit for:
- Organization switcher component
- Member management interfaces
- Role-based permission patterns

## 1. Slug Collision Resolution

### Problem
Agency slugs must be unique for URL routing (`/agency/[slug]/consultations`), but common business names will cause collisions (e.g., multiple "Smith Law Firm" agencies).

### Recommendation
Implement automatic conflict resolution with sequential suffixes:

```sql
-- Add constraint to prevent invalid characters
ALTER TABLE agencies
ADD CONSTRAINT chk_slug_format 
CHECK (slug ~ '^[a-z0-9][a-z0-9-]*[a-z0-9]$');
```

```go
// service-core/storage/agencies.go
func (s *Storage) GenerateUniqueSlug(baseName string) (string, error) {
    baseSlug := slugify(baseName)
    slug := baseSlug
    suffix := 1
    
    for {
        exists, err := s.SlugExists(slug)
        if err != nil {
            return "", err
        }
        if !exists {
            return slug, nil
        }
        suffix++
        slug = fmt.Sprintf("%s-%d", baseSlug, suffix)
    }
}
```

### Reserved Slugs
Maintain a blocklist of reserved slugs to prevent routing conflicts:
- `api`, `admin`, `settings`, `billing`, `auth`, `login`, `signup`, `dashboard`

---

## 2. Subscription Tier Enforcement

### Problem
Schema includes `subscription_tier` field but plan lacks enforcement logic for feature limits.

### Recommendation
Define explicit tier limits and enforce at the service layer:

```go
// service-core/domain/subscription_limits.go
type TierLimits struct {
    MaxMembers       int
    MaxConsultations int  // per month, -1 = unlimited
    MaxTemplates     int
    Features         []string
}

var TierDefinitions = map[string]TierLimits{
    "free": {
        MaxMembers:       1,
        MaxConsultations: 5,
        MaxTemplates:     1,
        Features:         []string{"basic_proposals"},
    },
    "starter": {
        MaxMembers:       3,
        MaxConsultations: 25,
        MaxTemplates:     5,
        Features:         []string{"basic_proposals", "pdf_export", "email_delivery"},
    },
    "growth": {
        MaxMembers:       10,
        MaxConsultations: 100,
        MaxTemplates:     20,
        Features:         []string{"basic_proposals", "pdf_export", "email_delivery", "analytics", "white_label"},
    },
    "enterprise": {
        MaxMembers:       -1,
        MaxConsultations: -1,
        MaxTemplates:     -1,
        Features:         []string{"*"},
    },
}
```

```go
// Enforcement middleware
func (s *Service) CheckConsultationLimit(agencyID string) error {
    agency, _ := s.storage.GetAgency(agencyID)
    limits := TierDefinitions[agency.SubscriptionTier]
    
    if limits.MaxConsultations == -1 {
        return nil
    }
    
    count, _ := s.storage.GetMonthlyConsultationCount(agencyID)
    if count >= limits.MaxConsultations {
        return ErrConsultationLimitReached
    }
    return nil
}
```

### UI Considerations
- Display usage meters in agency dashboard
- Show upgrade prompts when approaching limits
- Graceful degradation (read-only mode) vs hard blocks

---

## 3. Session Security Hardening

### Problem
Plan mentions agency context in session but lacks explicit security configuration.

### Recommendation

```typescript
// service-client/src/hooks.server.ts
export const handle: Handle = async ({ event, resolve }) => {
    const sessionId = event.cookies.get('session_id');
    
    if (sessionId) {
        const session = await validateSession(sessionId);
        
        if (session) {
            // Verify membership is still active
            const membership = await db.query.agencyMemberships.findFirst({
                where: and(
                    eq(agencyMemberships.userId, session.userId),
                    eq(agencyMemberships.agencyId, session.agencyId),
                    isNull(agencyMemberships.removedAt) // Check not revoked
                )
            });
            
            if (!membership) {
                // Membership revoked - clear session
                event.cookies.delete('session_id', { path: '/' });
                throw redirect(303, '/auth/login?reason=access_revoked');
            }
            
            event.locals.user = session.user;
            event.locals.agency = session.agency;
            event.locals.membership = membership;
        }
    }
    
    return resolve(event);
};
```

### Cookie Configuration
```typescript
// Secure cookie settings
cookies.set('session_id', token, {
    path: '/',
    httpOnly: true,
    secure: true, // HTTPS only
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7 // 7 days
});
```

### Additional Security Measures
- Implement session invalidation on password change
- Add `last_active_at` tracking for idle timeout
- Consider refresh token rotation pattern

---

## 4. Audit Trail Implementation

### Problem
No audit logging for agency-level actions, making it difficult to investigate issues or demonstrate compliance.

### Recommendation
Add an activity log table:

```sql
-- schema_postgres.sql
CREATE TABLE agency_activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_activity_agency_created ON agency_activity_log(agency_id, created_at DESC);
CREATE INDEX idx_activity_entity ON agency_activity_log(entity_type, entity_id);
```

```go
// service-core/audit/logger.go
type AuditAction string

const (
    ActionCreate       AuditAction = "create"
    ActionUpdate       AuditAction = "update"
    ActionDelete       AuditAction = "delete"
    ActionMemberInvite AuditAction = "member_invite"
    ActionMemberRemove AuditAction = "member_remove"
    ActionRoleChange   AuditAction = "role_change"
    ActionSettingsChange AuditAction = "settings_change"
)

func (l *AuditLogger) Log(ctx context.Context, entry AuditEntry) error {
    // Extract request context
    userID := ctx.Value("user_id").(string)
    agencyID := ctx.Value("agency_id").(string)
    ip := ctx.Value("client_ip").(string)
    
    return l.storage.InsertAuditLog(AuditLog{
        AgencyID:   agencyID,
        UserID:     userID,
        Action:     entry.Action,
        EntityType: entry.EntityType,
        EntityID:   entry.EntityID,
        OldValues:  entry.OldValues,
        NewValues:  entry.NewValues,
        IPAddress:  ip,
    })
}
```

### Key Events to Log
- Member added/removed/role changed
- Settings/branding changes
- Consultation created/updated/deleted
- Proposal sent/viewed
- Subscription changes

---

## 5. Role Permissions Matrix

### Problem
Three roles (owner/admin/member) may be limiting; unclear what each role can actually do.

### Recommendation
Define explicit permissions matrix:

```typescript
// service-client/src/lib/server/permissions.ts
export const PERMISSIONS = {
    // Consultation management
    'consultation:create': ['owner', 'admin', 'member'],
    'consultation:view': ['owner', 'admin', 'member'],
    'consultation:edit': ['owner', 'admin', 'member'],
    'consultation:delete': ['owner', 'admin'],
    'consultation:view_all': ['owner', 'admin'], // vs only own
    
    // Proposal management
    'proposal:create': ['owner', 'admin', 'member'],
    'proposal:send': ['owner', 'admin', 'member'],
    'proposal:delete': ['owner', 'admin'],
    
    // Team management
    'member:invite': ['owner', 'admin'],
    'member:remove': ['owner', 'admin'],
    'member:change_role': ['owner'],
    
    // Agency settings
    'settings:view': ['owner', 'admin'],
    'settings:edit': ['owner', 'admin'],
    'branding:edit': ['owner', 'admin'],
    
    // Billing
    'billing:view': ['owner'],
    'billing:manage': ['owner'],
    
    // Templates
    'template:create': ['owner', 'admin'],
    'template:edit': ['owner', 'admin'],
    'template:delete': ['owner'],
} as const;

export function hasPermission(
    role: 'owner' | 'admin' | 'member',
    permission: keyof typeof PERMISSIONS
): boolean {
    return PERMISSIONS[permission].includes(role);
}

export function requirePermission(permission: keyof typeof PERMISSIONS) {
    return (event: RequestEvent) => {
        const membership = event.locals.membership;
        if (!membership || !hasPermission(membership.role, permission)) {
            throw error(403, 'Insufficient permissions');
        }
    };
}
```

### Usage in Remote Functions
```typescript
// service-client/src/routes/api/consultations/[id]/+server.ts
export const DELETE = async (event) => {
    requirePermission('consultation:delete')(event);
    // ... delete logic
};
```

---

## 6. Data Isolation (Critical)

### Problem
Cross-agency data leakage is a critical security risk if queries aren't properly scoped.

### Recommendation
Implement automatic agency filtering at the query layer:

```typescript
// service-client/src/lib/server/db-helpers.ts
export function withAgencyScope<T>(
    event: RequestEvent,
    queryFn: (agencyId: string) => Promise<T>
): Promise<T> {
    const agencyId = event.locals.agency?.id;
    if (!agencyId) {
        throw error(401, 'No agency context');
    }
    return queryFn(agencyId);
}

// Usage in all queries
export async function getConsultations(event: RequestEvent) {
    return withAgencyScope(event, async (agencyId) => {
        return db.query.consultations.findMany({
            where: eq(consultations.agencyId, agencyId),
            orderBy: desc(consultations.createdAt)
        });
    });
}
```

### PostgreSQL Row-Level Security (Optional but Recommended)
```sql
-- Enable RLS for extra protection
ALTER TABLE consultations ENABLE ROW LEVEL SECURITY;

CREATE POLICY consultation_agency_isolation ON consultations
    FOR ALL
    USING (agency_id = current_setting('app.current_agency_id')::uuid);
```

### Testing Data Isolation
```typescript
// Include in test suite
describe('Data Isolation', () => {
    it('should not return consultations from other agencies', async () => {
        const agency1Consultation = await createConsultation(agency1.id);
        const agency2Consultation = await createConsultation(agency2.id);
        
        const results = await getConsultationsForAgency(agency1.id);
        
        expect(results).toContainEqual(expect.objectContaining({ id: agency1Consultation.id }));
        expect(results).not.toContainEqual(expect.objectContaining({ id: agency2Consultation.id }));
    });
});
```

---

## 7. GDPR/Privacy Compliance

### Problem
No strategy for agency data deletion or export.

### Recommendation

### Data Export Endpoint
```typescript
// service-client/src/routes/api/agency/export/+server.ts
export const GET = async (event) => {
    requirePermission('settings:view')(event);
    
    const agencyId = event.locals.agency.id;
    
    const exportData = {
        agency: await db.query.agencies.findFirst({
            where: eq(agencies.id, agencyId)
        }),
        members: await db.query.agencyMemberships.findMany({
            where: eq(agencyMemberships.agencyId, agencyId),
            with: { user: { columns: { email: true, name: true } } }
        }),
        consultations: await db.query.consultations.findMany({
            where: eq(consultations.agencyId, agencyId)
        }),
        proposals: await db.query.proposals.findMany({
            where: eq(proposals.agencyId, agencyId)
        }),
        settings: await db.query.agencyFormOptions.findMany({
            where: eq(agencyFormOptions.agencyId, agencyId)
        }),
        exportedAt: new Date().toISOString()
    };
    
    return new Response(JSON.stringify(exportData, null, 2), {
        headers: {
            'Content-Type': 'application/json',
            'Content-Disposition': `attachment; filename="agency-export-${agencyId}.json"`
        }
    });
};
```

### Agency Deletion (Soft Delete with Grace Period)
```sql
-- Add soft delete columns
ALTER TABLE agencies ADD COLUMN deleted_at TIMESTAMPTZ;
ALTER TABLE agencies ADD COLUMN deletion_scheduled_for TIMESTAMPTZ;
```

```go
// Schedule deletion (30-day grace period)
func (s *Service) ScheduleAgencyDeletion(agencyID string) error {
    deletionDate := time.Now().AddDate(0, 0, 30)
    
    return s.storage.UpdateAgency(agencyID, map[string]interface{}{
        "deletion_scheduled_for": deletionDate,
    })
}

// Background job to permanently delete
func (s *Service) ProcessScheduledDeletions() error {
    agencies, _ := s.storage.GetAgenciesScheduledForDeletion()
    
    for _, agency := range agencies {
        // Cascade delete all agency data
        s.storage.DeleteAgencyData(agency.ID)
        s.auditLog.Log("agency_permanently_deleted", agency.ID)
    }
    return nil
}
```

### Right to be Forgotten
- Anonymize user data in activity logs (retain for compliance)
- Remove PII from consultations when user requests deletion
- Document data retention policies

---

## 8. Config Store Loading Strategy

### Problem
Loading form options per-request may cause flash of default→custom options.

### Recommendation
Load agency config in layout server load:

```typescript
// service-client/src/routes/(app)/+layout.server.ts
export const load: LayoutServerLoad = async ({ locals }) => {
    if (!locals.agency) {
        return { agencyConfig: null };
    }
    
    // Load all form options for this agency
    const formOptions = await db.query.agencyFormOptions.findMany({
        where: eq(agencyFormOptions.agencyId, locals.agency.id)
    });
    
    // Group by category
    const config = formOptions.reduce((acc, opt) => {
        if (!acc[opt.category]) acc[opt.category] = [];
        acc[opt.category].push({
            value: opt.value,
            label: opt.label,
            isDefault: opt.isDefault
        });
        return acc;
    }, {} as AgencyConfig);
    
    return {
        agencyConfig: config,
        agency: locals.agency,
        user: locals.user,
        membership: locals.membership
    };
};
```

```typescript
// service-client/src/lib/stores/agency-config.svelte.ts
import { getContext, setContext } from 'svelte';

const AGENCY_CONFIG_KEY = Symbol('agency-config');

export function setAgencyConfig(config: AgencyConfig) {
    setContext(AGENCY_CONFIG_KEY, config);
}

export function getAgencyConfig(): AgencyConfig {
    return getContext(AGENCY_CONFIG_KEY);
}

// In +layout.svelte
<script>
    let { data, children } = $props();
    setAgencyConfig(data.agencyConfig);
</script>
```

---

## 9. Proposal Templates Clarification

### Problem
Templates marked "Future" in plan but included in Phase 1 schema.

### Recommendation
Clarify intent and consider minimal implementation:

### Option A: Schema Only (Recommended)
Keep `agency_proposal_templates` in schema but don't implement UI. This allows:
- Future-proofing the data model
- Database migrations to stabilize
- Focus on core multi-tenancy first

### Option B: Basic Implementation
If templates are needed for MVP:

```typescript
// Minimal template structure
interface ProposalTemplate {
    id: string;
    agencyId: string;
    name: string;
    description: string;
    
    // Pre-filled defaults
    defaultPackageType: string;
    defaultPricing: Record<string, number>;
    defaultTimeline: string;
    
    // Content blocks
    introTemplate: string;      // Supports {{client_name}} placeholders
    closingTemplate: string;
    termsTemplate: string;
    
    isDefault: boolean;
    createdAt: Date;
}
```

---

## Recommended Phase Reordering

Based on dependencies and risk mitigation:

| Phase | Task | Rationale |
|-------|------|-----------|
| 1 | Database Schema (Go) | Foundation for everything |
| 2 | Drizzle Schema (SvelteKit) | ORM alignment |
| 3 | Agency Context + Permissions Matrix | Security-first |
| 4 | Data Isolation Helpers | Critical before any queries |
| 5 | Remote Functions | Core API layer |
| 6 | Slug-Based Routes | URL structure |
| 7 | Config Store + Layout Loading | Agency customization |
| 8 | Port BetterKit Components | UI for team management |
| 9 | Form Components Update | Consume agency config |
| 10 | Audit Trail | Operational visibility |
| 11 | Testing & Security Review | Validation |

---

## Risk Assessment Summary

| Risk | Severity | Mitigation |
|------|----------|------------|
| Cross-agency data leakage | **Critical** | Data isolation helpers, RLS policies, testing |
| Subscription bypass | High | Enforce limits in service layer, not just UI |
| Session hijacking | High | Secure cookies, membership validation on each request |
| Slug collisions | Medium | Unique constraint, auto-suffix generation |
| GDPR non-compliance | Medium | Export endpoints, deletion workflow |
| Permission escalation | Medium | Explicit permissions matrix, ownership checks |

---

## Implementation Checklist

- [ ] Add slug format constraint and collision resolution
- [ ] Define and enforce subscription tier limits
- [ ] Implement session security with membership validation
- [ ] Create `agency_activity_log` table
- [ ] Define permissions matrix and `hasPermission` helper
- [ ] Implement `withAgencyScope` for all queries
- [ ] Add data export endpoint
- [ ] Implement soft delete with grace period
- [ ] Load agency config in layout.server.ts
- [ ] Clarify template implementation scope
- [ ] Write data isolation tests
- [ ] Security review before launch

---

## Estimated Timeline

With these additions, estimate **2-3 weeks** for full implementation:
- Week 1: Schema, migrations, core security (Phases 1-4)
- Week 2: Remote functions, routing, config (Phases 5-7)
- Week 3: UI components, testing, audit trail (Phases 8-11)

---

*Document created: December 24, 2025*
*Related Plan: dynamic-chasing-fern.md*
