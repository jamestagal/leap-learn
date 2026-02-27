# Spec 2, Phase 1: Proposals

## Overview

Build a Proposal Builder/Editor that allows agencies to create professional, publicly shareable proposals from consultation data. Proposals combine:
- **Auto-populated data** from consultations and agency profile (via Data Pipeline)
- **Manual entry sections** for audit results, research, and custom content
- **Package selection** from pre-configured agency packages/addons

**Public URL Pattern**: `/p/{slug}` on main domain

---

## 1. Database Schema

### 1.1 Proposals Table

**File**: [schema.ts](service-client/src/lib/server/schema.ts)

```typescript
export const proposals = pgTable('proposals', {
    id: uuid('id').primaryKey().defaultRandom(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),

    agencyId: uuid('agency_id').notNull()
        .references(() => agencies.id, { onDelete: 'cascade' }),

    // Link to consultation (optional - can create standalone proposals)
    consultationId: uuid('consultation_id')
        .references(() => consultations.id, { onDelete: 'set null' }),

    // Document identification
    proposalNumber: varchar('proposal_number', { length: 50 }).notNull(), // PROP-2025-0001
    slug: varchar('slug', { length: 100 }).notNull().unique(), // Public URL slug

    // Status workflow
    status: varchar('status', { length: 50 }).notNull().default('draft'),
    // draft, sent, viewed, accepted, declined, expired

    // Client info (denormalized for standalone proposals or overrides)
    clientBusinessName: text('client_business_name').default(''),
    clientContactName: text('client_contact_name').default(''),
    clientEmail: varchar('client_email', { length: 255 }).default(''),
    clientPhone: varchar('client_phone', { length: 50 }).default(''),
    clientWebsite: text('client_website').default(''),

    // Cover & Introduction
    title: text('title').default('Website Proposal'),
    coverImage: text('cover_image'), // Optional hero image URL

    // Performance Analysis (manual entry after PageSpeed audit)
    performanceData: jsonb('performance_data').default({}),
    // { performance: 45, accessibility: 78, bestPractices: 82, seo: 65, loadTime: '4.2s', issues: [...] }

    // The Opportunity (manual research about client's industry/business)
    opportunityContent: text('opportunity_content').default(''),

    // Current Issues (checklist items)
    currentIssues: jsonb('current_issues').default([]),
    // [{ text: 'Site is not mobile responsive', checked: true }, ...]

    // Compliance Issues (optional section)
    complianceIssues: jsonb('compliance_issues').default([]),
    // [{ text: 'WCAG accessibility standards not met', checked: true }, ...]

    // ROI Analysis (optional section)
    roiAnalysis: jsonb('roi_analysis').default({}),
    // { currentVisitors: 500, projectedVisitors: 1500, conversionRate: 2.5, projectedLeads: 37 }

    // Performance Standards (metrics the new site will achieve)
    performanceStandards: jsonb('performance_standards').default([]),
    // [{ label: 'Page Load', value: '<2s' }, { label: 'Mobile Score', value: '95+' }, ...]

    // Local Advantage (optional section for local SEO focus)
    localAdvantageContent: text('local_advantage_content').default(''),

    // Site Architecture (proposed pages)
    proposedPages: jsonb('proposed_pages').default([]),
    // [{ name: 'Home', description: 'Modern homepage with...', features: [...] }, ...]

    // Implementation Timeline
    timeline: jsonb('timeline').default([]),
    // [{ week: '1-2', title: 'Discovery & Design', description: '...' }, ...]

    // Closing section
    closingContent: text('closing_content').default(''),

    // Package selection
    selectedPackageId: uuid('selected_package_id')
        .references(() => agencyPackages.id, { onDelete: 'set null' }),
    selectedAddons: jsonb('selected_addons').default([]), // addon IDs

    // Price overrides (if different from package defaults)
    customPricing: jsonb('custom_pricing').default(null),
    // { setupFee: '750.00', monthlyPrice: '199.00', discountPercent: 10, discountNote: 'Early bird' }

    // Validity
    validUntil: timestamp('valid_until', { withTimezone: true }),

    // Tracking
    viewCount: integer('view_count').default(0),
    lastViewedAt: timestamp('last_viewed_at', { withTimezone: true }),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    declinedAt: timestamp('declined_at', { withTimezone: true }),

    // Creator
    createdBy: uuid('created_by')
        .references(() => users.id, { onDelete: 'set null' })
}, (table) => ({
    agencyIdx: index('proposals_agency_idx').on(table.agencyId),
    consultationIdx: index('proposals_consultation_idx').on(table.consultationId),
    statusIdx: index('proposals_status_idx').on(table.status)
}));
```

### 1.2 Type Definitions

```typescript
// Proposal status enum
export type ProposalStatus = 'draft' | 'sent' | 'viewed' | 'accepted' | 'declined' | 'expired';

// Performance data from PageSpeed audit
export interface PerformanceData {
    performance?: number;      // 0-100
    accessibility?: number;    // 0-100
    bestPractices?: number;    // 0-100
    seo?: number;              // 0-100
    loadTime?: string;         // e.g., "4.2s"
    issues?: string[];         // List of key issues found
}

// Checklist item for issues
export interface ChecklistItem {
    text: string;
    checked: boolean;
}

// ROI analysis data
export interface RoiAnalysis {
    currentVisitors?: number;
    projectedVisitors?: number;
    conversionRate?: number;
    projectedLeads?: number;
    averageProjectValue?: number;
    projectedRevenue?: number;
}

// Performance standard metric
export interface PerformanceStandard {
    label: string;
    value: string;
    icon?: string;
}

// Proposed page in site architecture
export interface ProposedPage {
    name: string;
    description?: string;
    features?: string[];
}

// Timeline phase
export interface TimelinePhase {
    week: string;
    title: string;
    description: string;
}

// Custom pricing overrides
export interface CustomPricing {
    setupFee?: string;
    monthlyPrice?: string;
    oneTimePrice?: string;
    hostingFee?: string;
    discountPercent?: number;
    discountNote?: string;
}
```

---

## 2. Remote Functions

### 2.1 Proposal Remote Functions

**New file**: `service-client/src/lib/api/proposals.remote.ts`

| Function | Type | Description |
|----------|------|-------------|
| `getProposals(filters?)` | query | List proposals with optional status filter |
| `getProposal(id)` | query | Get single proposal with related data |
| `getProposalBySlug(slug)` | query | Get proposal by public slug (for public view) |
| `createProposal(data)` | command | Create from consultation or standalone |
| `updateProposal(data)` | command | Update proposal fields |
| `deleteProposal(id)` | command | Delete proposal |
| `duplicateProposal(id)` | command | Create copy of existing proposal |
| `sendProposal(id)` | command | Mark as sent, update sentAt |
| `recordProposalView(slug)` | command | Increment view count (public, no auth) |
| `updateProposalStatus(id, status)` | command | Change status |
| `generateProposalSlug()` | query | Generate unique slug |

### 2.2 Create Proposal Flow

```typescript
// When creating from consultation
async function createProposal(data: {
    consultationId?: string;
    selectedPackageId?: string;
    title?: string;
}) {
    const agency = await getAgencyContext();
    const profile = await getAgencyProfile();

    // Generate proposal number
    const proposalNumber = generateDocumentNumber(
        profile.proposalPrefix || 'PROP',
        profile.nextProposalNumber || 1
    );

    // Generate unique slug
    const slug = await generateUniqueSlug();

    // If from consultation, pre-fill client data
    let clientData = {};
    if (data.consultationId) {
        const consultation = await getConsultation(data.consultationId);
        const contactInfo = consultation.contactInfo;
        clientData = {
            clientBusinessName: contactInfo.businessName,
            clientContactName: `${contactInfo.firstName} ${contactInfo.lastName}`,
            clientEmail: contactInfo.email,
            clientPhone: contactInfo.phone,
            clientWebsite: contactInfo.websiteUrl
        };
    }

    // Create proposal
    const proposal = await db.insert(proposals).values({
        agencyId: agency.id,
        consultationId: data.consultationId,
        proposalNumber,
        slug,
        title: data.title || 'Website Proposal',
        selectedPackageId: data.selectedPackageId,
        ...clientData
    }).returning();

    // Increment next proposal number
    await updateAgencyProfile({
        nextProposalNumber: (profile.nextProposalNumber || 1) + 1
    });

    return proposal;
}
```

---

## 3. Data Pipeline Integration

### 3.1 Proposal Merge Fields

Extend `data-pipeline.service.ts` to support proposal context:

```typescript
// Add to MergeFieldData interface
interface MergeFieldData {
    agency: AgencyMergeFields;
    client: ClientMergeFields;
    proposal: ProposalMergeFields;  // NEW
}

interface ProposalMergeFields {
    number: string;           // PROP-2025-0001
    title: string;
    package_name: string;
    setup_fee: string;        // Formatted currency
    monthly_price: string;
    one_time_price: string;
    total: string;            // Calculated total
    valid_until: string;      // Formatted date
    created_date: string;
    addons_list: string;      // Comma-separated addon names
    addons_total: string;     // Total addon cost
}

// Build proposal merge fields
function buildProposalMergeFields(
    proposal: Proposal,
    package?: AgencyPackage,
    addons?: AgencyAddon[]
): ProposalMergeFields {
    const customPricing = proposal.customPricing;

    const setupFee = customPricing?.setupFee ?? package?.setupFee ?? '0.00';
    const monthlyPrice = customPricing?.monthlyPrice ?? package?.monthlyPrice ?? '0.00';
    const oneTimePrice = customPricing?.oneTimePrice ?? package?.oneTimePrice ?? '0.00';

    const addonsTotal = addons?.reduce((sum, a) => sum + parseFloat(a.price), 0) ?? 0;

    return {
        number: proposal.proposalNumber,
        title: proposal.title,
        package_name: package?.name ?? '',
        setup_fee: formatCurrency(parseFloat(setupFee)),
        monthly_price: formatCurrency(parseFloat(monthlyPrice)),
        one_time_price: formatCurrency(parseFloat(oneTimePrice)),
        total: formatCurrency(parseFloat(setupFee) + parseFloat(oneTimePrice) + addonsTotal),
        valid_until: proposal.validUntil ? formatDate(proposal.validUntil) : '',
        created_date: formatDate(proposal.createdAt),
        addons_list: addons?.map(a => a.name).join(', ') ?? '',
        addons_total: formatCurrency(addonsTotal)
    };
}
```

---

## 4. Permissions

**File**: [permissions.ts](service-client/src/lib/server/permissions.ts)

```typescript
// Add to PERMISSIONS object
'proposals:view': ['owner', 'admin', 'member'],
'proposals:create': ['owner', 'admin', 'member'],
'proposals:edit': ['owner', 'admin', 'member'],  // Own proposals only for member
'proposals:delete': ['owner', 'admin'],
'proposals:send': ['owner', 'admin', 'member'],
```

---

## 5. UI Routes

### 5.1 Internal Routes (Agency Dashboard)

```
service-client/src/routes/(app)/[agencySlug]/proposals/
├── +page.svelte                    # Proposal list
├── +page.server.ts                 # Load proposals
├── new/+page.svelte                # Create proposal (select consultation or standalone)
├── new/+page.server.ts
├── [proposalId]/+page.svelte       # Edit proposal (full editor)
├── [proposalId]/+page.server.ts
├── [proposalId]/preview/+page.svelte  # Preview as client sees it
```

### 5.2 Public Route

```
service-client/src/routes/p/
├── [slug]/+page.svelte             # Public proposal view
├── [slug]/+page.server.ts          # Load by slug, record view
```

---

## 6. UI Components

### 6.1 Component Structure

```
service-client/src/lib/components/proposals/
├── ProposalList.svelte             # List with status badges, actions
├── ProposalCard.svelte             # Card for list view
├── ProposalStatusBadge.svelte      # Status indicator
├── ProposalEditor.svelte           # Main editor container
├── sections/
│   ├── CoverSection.svelte         # Title, cover image
│   ├── ClientInfoSection.svelte    # Client details (from consultation)
│   ├── PerformanceSection.svelte   # PageSpeed audit entry
│   ├── OpportunitySection.svelte   # Rich text for opportunity
│   ├── IssuesSection.svelte        # Checklist editor
│   ├── PackageSection.svelte       # Package selector + addons
│   ├── PricingSection.svelte       # Price display/override
│   ├── RoiSection.svelte           # ROI calculator
│   ├── StandardsSection.svelte     # Performance metrics editor
│   ├── ArchitectureSection.svelte  # Proposed pages editor
│   ├── TimelineSection.svelte      # Implementation timeline
│   ├── ClosingSection.svelte       # Closing message
├── editors/
│   ├── ChecklistEditor.svelte      # Add/remove/toggle checklist items
│   ├── MetricsEditor.svelte        # Key-value metrics (standards)
│   ├── PagesEditor.svelte          # Page architecture editor
│   ├── TimelineEditor.svelte       # Week-by-week timeline
│   ├── PerformanceInput.svelte     # Score inputs (0-100)
├── public/
│   ├── ProposalPublicView.svelte   # Full public proposal render
│   ├── PublicCover.svelte          # Cover with logo, title
│   ├── PublicPerformance.svelte    # Performance scores display
│   ├── PublicPricing.svelte        # Package + pricing display
│   ├── PublicTimeline.svelte       # Visual timeline
│   ├── PublicFooter.svelte         # Agency contact info
```

### 6.2 Editor Layout

The ProposalEditor uses a vertical section-based layout:

```svelte
<script lang="ts">
    import CoverSection from './sections/CoverSection.svelte';
    import ClientInfoSection from './sections/ClientInfoSection.svelte';
    // ... other imports

    let { proposal, consultation, packages, addons }: Props = $props();

    let formData = $state({ ...proposal });
    let isSaving = $state(false);
</script>

<div class="max-w-4xl mx-auto space-y-8">
    <!-- Section navigation sidebar (sticky) -->
    <aside class="fixed left-4 top-24 hidden xl:block">
        <nav class="space-y-2">
            <a href="#cover" class="block text-sm">Cover</a>
            <a href="#performance" class="block text-sm">Performance</a>
            <!-- ... -->
        </nav>
    </aside>

    <!-- Editor sections -->
    <CoverSection bind:data={formData} />
    <ClientInfoSection bind:data={formData} {consultation} />
    <PerformanceSection bind:data={formData} />
    <OpportunitySection bind:data={formData} />
    <IssuesSection bind:data={formData} />
    <PackageSection bind:data={formData} {packages} {addons} />
    <PricingSection bind:data={formData} />
    <RoiSection bind:data={formData} />
    <StandardsSection bind:data={formData} />
    <ArchitectureSection bind:data={formData} />
    <TimelineSection bind:data={formData} />
    <ClosingSection bind:data={formData} />

    <!-- Sticky footer with actions -->
    <div class="sticky bottom-0 bg-base-100 border-t p-4">
        <div class="flex justify-between">
            <a href="preview" class="btn btn-ghost">Preview</a>
            <div class="flex gap-2">
                <button class="btn btn-outline" onclick={saveDraft}>Save Draft</button>
                <button class="btn btn-primary" onclick={sendProposal}>Send to Client</button>
            </div>
        </div>
    </div>
</div>
```

---

## 7. Public View Design

### 7.1 Structure (Based on OCB Law Group Example)

```svelte
<!-- ProposalPublicView.svelte -->
<script lang="ts">
    let { proposal, agency, package: pkg, addons }: Props = $props();
</script>

<article class="proposal-public bg-base-100 min-h-screen">
    <!-- Cover Section -->
    <header class="relative h-[60vh] flex items-center justify-center">
        {#if proposal.coverImage}
            <img src={proposal.coverImage} alt="" class="absolute inset-0 w-full h-full object-cover" />
            <div class="absolute inset-0 bg-black/50"></div>
        {/if}
        <div class="relative text-center text-white z-10">
            <img src={agency.logoUrl} alt={agency.name} class="h-16 mx-auto mb-8" />
            <h1 class="text-4xl font-bold">{proposal.title}</h1>
            <p class="text-xl mt-4">Prepared for {proposal.clientBusinessName}</p>
            <p class="mt-2 opacity-80">{formatDate(proposal.createdAt)}</p>
        </div>
    </header>

    <!-- Performance Analysis -->
    {#if hasPerformanceData(proposal.performanceData)}
        <section class="py-16 px-8 max-w-4xl mx-auto">
            <h2 class="text-2xl font-bold mb-8">Current Website Performance Analysis</h2>
            <div class="grid grid-cols-4 gap-4">
                <ScoreCard label="Performance" score={proposal.performanceData.performance} />
                <ScoreCard label="Accessibility" score={proposal.performanceData.accessibility} />
                <ScoreCard label="Best Practices" score={proposal.performanceData.bestPractices} />
                <ScoreCard label="SEO" score={proposal.performanceData.seo} />
            </div>
            {#if proposal.performanceData.issues?.length}
                <div class="mt-8">
                    <h3 class="font-semibold mb-4">Key Issues Identified</h3>
                    <ul class="space-y-2">
                        {#each proposal.performanceData.issues as issue}
                            <li class="flex items-start gap-2">
                                <span class="text-error">✕</span>
                                <span>{issue}</span>
                            </li>
                        {/each}
                    </ul>
                </div>
            {/if}
        </section>
    {/if}

    <!-- The Opportunity -->
    {#if proposal.opportunityContent}
        <section class="py-16 px-8 bg-base-200">
            <div class="max-w-4xl mx-auto">
                <h2 class="text-2xl font-bold mb-8">The Opportunity</h2>
                <div class="prose max-w-none">
                    {@html sanitizeHtml(proposal.opportunityContent)}
                </div>
            </div>
        </section>
    {/if}

    <!-- Current Site Issues -->
    {#if proposal.currentIssues?.length}
        <section class="py-16 px-8 max-w-4xl mx-auto">
            <h2 class="text-2xl font-bold mb-8">Current Site Issues We'll Solve</h2>
            <ul class="grid gap-3 sm:grid-cols-2">
                {#each proposal.currentIssues as issue}
                    <li class="flex items-center gap-3 p-4 bg-base-200 rounded-lg">
                        <span class="text-success">✓</span>
                        <span>{issue.text}</span>
                    </li>
                {/each}
            </ul>
        </section>
    {/if}

    <!-- Package & Pricing -->
    {#if pkg}
        <section class="py-16 px-8 bg-primary text-primary-content">
            <div class="max-w-4xl mx-auto">
                <h2 class="text-2xl font-bold mb-8">Your {pkg.name} Package</h2>
                <div class="grid md:grid-cols-2 gap-8">
                    <div>
                        <p class="text-lg opacity-90 mb-6">{pkg.description}</p>
                        {#if pkg.includedFeatures?.length}
                            <h3 class="font-semibold mb-4">What's Included</h3>
                            <ul class="space-y-2">
                                {#each pkg.includedFeatures as feature}
                                    <li class="flex items-center gap-2">
                                        <span>✓</span>
                                        <span>{feature}</span>
                                    </li>
                                {/each}
                            </ul>
                        {/if}
                    </div>
                    <div class="bg-white/10 rounded-xl p-6">
                        <PricingBreakdown {proposal} {pkg} {addons} />
                    </div>
                </div>
            </div>
        </section>
    {/if}

    <!-- ROI Analysis -->
    <!-- Performance Standards -->
    <!-- Site Architecture -->
    <!-- Timeline -->
    <!-- Closing & Contact -->
</article>
```

---

## 8. Implementation Tasks

### Phase 1: Database (Est. 0.5 days)
- [ ] Add `proposals` table to schema.ts
- [ ] Add type exports and interfaces
- [ ] Add SQL to schema_postgres.sql
- [ ] Run Atlas migration
- [ ] Run sqlc query generation

### Phase 2: Remote Functions (Est. 1 day)
- [ ] Create proposals.remote.ts with all CRUD operations
- [ ] Add Valibot validation schemas
- [ ] Implement slug generation (nanoid or similar)
- [ ] Add audit logging calls
- [ ] Add permission checks

### Phase 3: Data Pipeline Extension (Est. 0.5 days)
- [ ] Add ProposalMergeFields interface
- [ ] Implement buildProposalMergeFields function
- [ ] Add proposal context to getProjectData

### Phase 4: Permissions (Est. 0.25 days)
- [ ] Add proposal permissions to permissions.ts
- [ ] Update permission checks in remote functions

### Phase 5: UI - Proposal List (Est. 0.5 days)
- [ ] Create ProposalList.svelte component
- [ ] Create ProposalCard.svelte with status badges
- [ ] Create list route with filters
- [ ] Wire up to remote functions

### Phase 6: UI - Proposal Editor (Est. 2 days)
- [ ] Create ProposalEditor.svelte container
- [ ] Create all section components (12 sections)
- [ ] Create all editor components (5 editors)
- [ ] Implement autosave functionality
- [ ] Add section navigation

### Phase 7: UI - Public View (Est. 1 day)
- [ ] Create public route at /p/[slug]
- [ ] Create ProposalPublicView.svelte
- [ ] Create all public section components
- [ ] Implement view tracking
- [ ] Add responsive styling

### Phase 8: Testing (Est. 0.5 days)
- [ ] Test proposal CRUD operations
- [ ] Test public view access
- [ ] Test view tracking
- [ ] Test permission enforcement
- [ ] Test consultation data flow

---

## 9. Key Files to Modify/Create

| File | Changes |
|------|---------|
| [schema.ts](service-client/src/lib/server/schema.ts) | Add proposals table + types |
| [schema_postgres.sql](app/service-core/storage/schema_postgres.sql) | Add SQL for proposals table |
| [permissions.ts](service-client/src/lib/server/permissions.ts) | Add 5 proposal permissions |
| [data-pipeline.service.ts](service-client/src/lib/server/services/data-pipeline.service.ts) | Add proposal merge fields |
| NEW: proposals.remote.ts | Proposal remote functions |
| NEW: proposals/ routes | 5 new route files |
| NEW: proposals/ components | ~20 new component files |

---

## 10. Data Flow Diagram

```
┌─────────────────┐
│  Consultation   │
│  (existing)     │
└────────┬────────┘
         │ consultationId
         ▼
┌─────────────────┐     ┌─────────────────┐
│    Proposal     │────▶│  Agency Package │
│    (new)        │     │  (existing)     │
└────────┬────────┘     └─────────────────┘
         │                      │
         ▼                      ▼
┌─────────────────┐     ┌─────────────────┐
│  Data Pipeline  │◀────│  Agency Addons  │
│  Merge Fields   │     │  (existing)     │
└────────┬────────┘     └─────────────────┘
         │
         ▼
┌─────────────────┐
│  Public View    │
│  /p/{slug}      │
└─────────────────┘
```

---

## 11. Patterns to Follow

### Remote Functions
- Use `query()` for reads, `command()` for mutations
- Use Valibot (NOT Zod) for validation
- Use `getAgencyContext()` for auth
- Call `logActivity()` for audit trail
- Call `.refresh()` on queries after mutations

### Svelte 5
- Use `$state()` for mutable state
- Use `$derived()` for computed values
- Use `$props()` for component props
- Use `onclick` not `on:click`
- Use `bind:value` for two-way binding

### Public Route
- No auth required for viewing
- Record view count via command (fire-and-forget)
- Sanitize any HTML content before rendering
- Handle expired/invalid slugs gracefully

---

## 12. Security Considerations

1. **Slug Generation**: Use cryptographically random slugs (nanoid) to prevent enumeration
2. **Public Access**: Only expose necessary fields in public view
3. **HTML Sanitization**: Sanitize opportunityContent and closingContent before rendering
4. **Rate Limiting**: Consider rate limiting view recording endpoint
5. **Expiry**: Respect validUntil date, show "expired" message after

---

## 13. Future Enhancements (Out of Scope)

- PDF export (Spec 2, later phase)
- Email sending with tracking
- Accept/Decline actions from client
- Comments/feedback system
- Version history
- A/B testing different proposals
