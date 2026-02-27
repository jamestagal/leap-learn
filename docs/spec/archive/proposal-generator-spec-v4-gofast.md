# Website Proposal Generator - Technical Specification
## Version 4.0 - GoFast Architecture with Detailed Implementation

## Executive Summary

A professional proposal generation system for web design agencies, built on the GoFast microservices architecture. The system creates data-driven, personalized proposals combining consultation notes with automated website analysis to deliver professional proposals with shareable links and PDF exports.

## Core Architecture Changes

### From Cloudflare-Centric to GoFast Microservices

**Previous Architecture (v3):**
- Monolithic SvelteKit app on Cloudflare Pages
- Cloudflare D1, KV, R2 for all infrastructure
- Edge-first deployment

**New GoFast Architecture (v4):**
- **service-core** (Go): Business logic, API endpoints, database interactions
- **service-admin** (Go + HTMX): Admin dashboard for managing proposals and clients  
- **service-client** (SvelteKit): Public-facing proposal creation and viewing
- **PostgreSQL**: Primary database (with SQLite/Turso support)
- **NATS**: Inter-service event streaming
- **Cloudflare R2**: Still available for file storage via GoFast's file provider system

## Technology Stack

### Backend Services

#### Core Service (Go)
- **Framework**: Native Go with gRPC and REST
- **Database**: PostgreSQL (primary), SQLite/Turso support
- **ORM**: sqlc for type-safe queries
- **Auth**: JWT with public/private key pairs
- **File Storage**: Provider pattern supporting R2, S3, GCS, Azure Blob
- **Email**: Provider pattern supporting multiple services
- **Architecture**: Domain-Driven Design with clean separation

#### Admin Service (Go + HTMX)
- **Framework**: Go with HTMX for interactive UI
- **Real-time**: Server-Sent Events (SSE) for live updates
- **Communication**: gRPC client to Core Service
- **UI**: Server-rendered with HTMX for interactivity

#### Client Service (SvelteKit)
- **Framework**: SvelteKit 5 with Svelte 5 runes
- **Styling**: Tailwind CSS + DaisyUI
- **Auth**: JWT verification via jose
- **API Client**: REST calls to Core Service

## Detailed Project Structure

```
webkit/
├── app/
│   ├── pkg/                              # Shared packages
│   │   ├── auth/
│   │   ├── logger/
│   │   └── validators/
│   ├── service-core/                     # Core business logic service
│   │   ├── config/
│   │   ├── domain/
│   │   │   ├── consultation/
│   │   │   │   ├── service.go
│   │   │   │   ├── model.go
│   │   │   │   ├── repository.go
│   │   │   │   └── validator.go
│   │   │   ├── audit/
│   │   │   │   ├── service.go
│   │   │   │   ├── provider.go         # PageSpeed API integration
│   │   │   │   ├── cache.go            # Audit caching logic
│   │   │   │   └── model.go
│   │   │   ├── proposal/
│   │   │   │   ├── service.go
│   │   │   │   ├── builder.go          # Proposal builder pattern
│   │   │   │   ├── calculator.go       # ROI calculations
│   │   │   │   ├── templates.go        # Template management
│   │   │   │   └── model.go
│   │   │   ├── package/
│   │   │   │   ├── service.go
│   │   │   │   ├── pricing.go
│   │   │   │   └── model.go
│   │   │   ├── addon/
│   │   │   │   ├── service.go
│   │   │   │   └── model.go
│   │   │   ├── analytics/
│   │   │   │   ├── service.go
│   │   │   │   ├── tracker.go
│   │   │   │   └── model.go
│   │   │   └── pdf/
│   │   │       ├── service.go
│   │   │       ├── generator.go
│   │   │       └── templates/
│   │   ├── grpc/
│   │   │   ├── handler.go
│   │   │   └── server.go
│   │   ├── rest/
│   │   │   ├── handler.go
│   │   │   ├── middleware.go
│   │   │   └── routes.go
│   │   └── storage/
│   │       ├── migrations/
│   │       └── query/
│   └── service-admin/                    # Admin dashboard service
│       ├── web/
│       │   ├── templates/
│       │   │   ├── base.html
│       │   │   ├── consultations/
│       │   │   ├── proposals/
│       │   │   └── analytics/
│       │   └── static/
│       ├── grpc/
│       └── sse/
├── service-client/                        # SvelteKit frontend
│   ├── src/
│   │   ├── lib/
│   │   │   ├── components/
│   │   │   │   ├── consultation/
│   │   │   │   │   ├── ClientInfoForm.svelte
│   │   │   │   │   ├── BusinessContext.svelte
│   │   │   │   │   ├── PainPointsCapture.svelte
│   │   │   │   │   ├── GoalsObjectives.svelte
│   │   │   │   │   ├── BudgetTimeline.svelte
│   │   │   │   │   └── ConsultationNotes.svelte
│   │   │   │   ├── audit/
│   │   │   │   │   ├── AuditRunner.svelte
│   │   │   │   │   ├── AuditResults.svelte
│   │   │   │   │   ├── PerformanceMetrics.svelte
│   │   │   │   │   ├── IssuesList.svelte
│   │   │   │   │   └── CompetitorComparison.svelte
│   │   │   │   ├── proposal/
│   │   │   │   │   ├── ProposalBuilder.svelte
│   │   │   │   │   ├── ProposalPreview.svelte
│   │   │   │   │   ├── ExecutiveSummary.svelte
│   │   │   │   │   ├── CurrentState.svelte
│   │   │   │   │   ├── ProposedSolution.svelte
│   │   │   │   │   ├── ROICalculator.svelte
│   │   │   │   │   ├── Timeline.svelte
│   │   │   │   │   ├── Investment.svelte
│   │   │   │   │   ├── CaseStudies.svelte
│   │   │   │   │   └── NextSteps.svelte
│   │   │   │   ├── package/
│   │   │   │   │   ├── PackageSelector.svelte
│   │   │   │   │   ├── PackageComparison.svelte
│   │   │   │   │   ├── FeatureList.svelte
│   │   │   │   │   └── PricingDisplay.svelte
│   │   │   │   ├── addons/
│   │   │   │   │   ├── AddonSelector.svelte
│   │   │   │   │   ├── AddonCard.svelte
│   │   │   │   │   └── AddonPricing.svelte
│   │   │   │   ├── shared/
│   │   │   │   │   ├── StepIndicator.svelte
│   │   │   │   │   ├── ProgressBar.svelte
│   │   │   │   │   ├── SaveDraft.svelte
│   │   │   │   │   ├── ErrorBoundary.svelte
│   │   │   │   │   ├── LoadingStates.svelte
│   │   │   │   │   ├── Toast.svelte
│   │   │   │   │   └── Modal.svelte
│   │   │   │   └── analytics/
│   │   │   │       ├── ProposalMetrics.svelte
│   │   │   │       ├── ViewTracker.svelte
│   │   │   │       └── ConversionChart.svelte
│   │   │   ├── stores/
│   │   │   │   ├── consultation.svelte.ts
│   │   │   │   ├── proposal.svelte.ts
│   │   │   │   ├── audit.svelte.ts
│   │   │   │   ├── packages.svelte.ts
│   │   │   │   ├── addons.svelte.ts
│   │   │   │   └── analytics.svelte.ts
│   │   │   ├── services/
│   │   │   │   ├── api.ts
│   │   │   │   ├── auth.ts
│   │   │   │   ├── consultation.service.ts
│   │   │   │   ├── audit.service.ts
│   │   │   │   ├── proposal.service.ts
│   │   │   │   └── pdf.service.ts
│   │   │   ├── utils/
│   │   │   │   ├── formatting.ts
│   │   │   │   ├── validation.ts
│   │   │   │   ├── calculations.ts
│   │   │   │   └── debounce.ts
│   │   │   └── types/
│   │   │       ├── consultation.ts
│   │   │       ├── proposal.ts
│   │   │       ├── audit.ts
│   │   │       ├── package.ts
│   │   │       └── addon.ts
│   │   └── routes/
│   │       ├── +layout.svelte
│   │       ├── +layout.server.ts
│   │       ├── +page.svelte              # Dashboard
│   │       ├── (app)/                    # Protected routes
│   │       │   ├── +layout.svelte        # App shell
│   │       │   ├── +layout.server.ts     # Auth guard
│   │       │   ├── consultation/         # Multi-step consultation flow
│   │       │   │   ├── +layout.svelte    # Consultation wrapper
│   │       │   │   ├── +page.svelte      # Step 1: Client info
│   │       │   │   ├── +page.server.ts
│   │       │   │   ├── business/
│   │       │   │   │   ├── +page.svelte  # Step 2: Business context
│   │       │   │   │   └── +page.server.ts
│   │       │   │   ├── challenges/
│   │       │   │   │   ├── +page.svelte  # Step 3: Pain points
│   │       │   │   │   └── +page.server.ts
│   │       │   │   ├── goals/
│   │       │   │   │   ├── +page.svelte  # Step 4: Goals & objectives
│   │       │   │   │   └── +page.server.ts
│   │       │   │   ├── audit/
│   │       │   │   │   ├── +page.svelte  # Step 5: Run website audit
│   │       │   │   │   └── +page.server.ts
│   │       │   │   ├── package/
│   │       │   │   │   ├── +page.svelte  # Step 6: Select package
│   │       │   │   │   └── +page.server.ts
│   │       │   │   ├── customize/
│   │       │   │   │   ├── +page.svelte  # Step 7: Add-ons & customization
│   │       │   │   │   └── +page.server.ts
│   │       │   │   └── review/
│   │       │   │       ├── +page.svelte  # Step 8: Review & generate
│   │       │   │       └── +page.server.ts
│   │       │   ├── consultations/
│   │       │   │   ├── +page.svelte      # List all consultations
│   │       │   │   ├── +page.server.ts
│   │       │   │   └── [id]/
│   │       │   │       ├── +page.svelte  # View consultation details
│   │       │   │       ├── +page.server.ts
│   │       │   │       ├── edit/
│   │       │   │       │   ├── +page.svelte
│   │       │   │       │   └── +page.server.ts
│   │       │   │       └── proposal/
│   │       │   │           ├── +page.svelte  # Generate proposal from consultation
│   │       │   │           └── +page.server.ts
│   │       │   ├── proposals/
│   │       │   │   ├── +page.svelte      # List all proposals
│   │       │   │   ├── +page.server.ts
│   │       │   │   ├── drafts/
│   │       │   │   │   └── +page.svelte  # Draft proposals
│   │       │   │   ├── sent/
│   │       │   │   │   └── +page.svelte  # Sent proposals
│   │       │   │   └── [id]/
│   │       │   │       ├── +page.svelte  # View/edit proposal
│   │       │   │       ├── +page.server.ts
│   │       │   │       ├── edit/
│   │       │   │       │   ├── +page.svelte
│   │       │   │       │   └── +page.server.ts
│   │       │   │       ├── preview/
│   │       │   │       │   └── +page.svelte
│   │       │   │       └── send/
│   │       │   │           ├── +page.svelte  # Send proposal screen
│   │       │   │           └── +page.server.ts
│   │       │   ├── analytics/
│   │       │   │   ├── +page.svelte      # Analytics dashboard
│   │       │   │   ├── +page.server.ts
│   │       │   │   └── [proposalId]/
│   │       │   │       └── +page.svelte  # Proposal-specific analytics
│   │       │   └── settings/
│   │       │       ├── +page.svelte
│   │       │       ├── packages/
│   │       │       │   ├── +page.svelte  # Manage packages
│   │       │       │   └── +page.server.ts
│   │       │       ├── addons/
│   │       │       │   ├── +page.svelte  # Manage add-ons
│   │       │       │   └── +page.server.ts
│   │       │       ├── templates/
│   │       │       │   ├── +page.svelte  # Manage templates
│   │       │       │   └── +page.server.ts
│   │       │       └── profile/
│   │       │           └── +page.svelte  # User profile
│   │       ├── proposal/                 # Public routes
│   │       │   └── [slug]/
│   │       │       ├── +page.svelte      # Public proposal view
│   │       │       ├── +page.server.ts   # Track analytics
│   │       │       └── +layout.svelte    # Minimal public layout
│   │       ├── login/
│   │       │   ├── +page.svelte
│   │       │   └── +page.server.ts
│   │       └── api/                      # API routes (if needed for client-side)
│   │           ├── proposals/
│   │           │   └── [id]/
│   │           │       └── pdf/
│   │           │           └── +server.ts
│   │           └── analytics/
│   │               └── track/
│   │                   └── +server.ts
│   └── static/
│       ├── fonts/
│       ├── images/
│       └── templates/
└── proto/                                 # Shared protocol buffers
    ├── consultation.proto
    ├── proposal.proto
    └── audit.proto
```

## Detailed Data Models

### Consultation Data Structure

```typescript
// service-client/src/lib/types/consultation.ts

export interface ConsultationData {
  // Contact Information
  contact: {
    businessName: string;
    contactName: string;
    title?: string;
    email: string;
    phone?: string;
    preferredContact: 'email' | 'phone' | 'text';
    website: string;
  };
  
  // Business Context (from consultation call)
  business: {
    industry: Industry;
    location: string;
    yearsInBusiness?: number;
    teamSize?: number;
    monthlyTraffic?: number;
    currentConversionRate?: number;
    avgCustomerValue?: number;
    
    // Industry-specific details
    practiceAreas?: string[];      // Law firms
    specialties?: string[];         // Medical
    productCategories?: string[];   // E-commerce
    serviceAreas?: string[];        // Service businesses
    
    // Current digital presence
    currentSetup: {
      platform?: 'WordPress' | 'Wix' | 'Squarespace' | 'Custom' | 'None';
      ageOfSite?: number;
      lastUpdate?: string;
      currentHost?: string;
      monthlyMaintenance?: number;
      hasSSL?: boolean;
      mobileResponsive?: boolean;
    };
    
    // Marketing & SEO
    marketing: {
      currentSEO?: boolean;
      paidAds?: boolean;
      socialMedia?: string[];
      emailMarketing?: boolean;
      contentMarketing?: boolean;
    };
  };
  
  // Pain Points & Challenges
  challenges: {
    primary: Challenge[];
    technical: TechnicalIssue[];
    business: BusinessImpact[];
    urgency: 'emergency' | 'high' | 'medium' | 'low';
    costOfInaction?: number;
  };
  
  // Goals & Objectives
  goals: {
    primaryGoal: Goal;
    secondaryGoals: Goal[];
    successMetrics: Metric[];
    desiredOutcomes: string[];
    timeline: {
      ideal: string;
      mustLaunchBy?: string;
      flexibilityNotes?: string;
    };
  };
  
  // Budget & Decision Process
  budget: {
    range: BudgetRange;
    hasBeenDiscussed: boolean;
    isFlexible: boolean;
    decisionMaker: string;
    decisionProcess: string;
    approvalNeeded: boolean;
    competingQuotes: number;
    competitorNames?: string[];
  };
  
  // Consultation Metadata
  consultation: {
    id: string;
    date: string;
    duration: number; // minutes
    salesRep: string;
    callRecording?: string;
    nextSteps: string[];
    followUpDate?: string;
    personalNotes?: string;
    competitorsDiscussed?: Competitor[];
    referencesMade?: Reference[];
    objections?: string[];
    commitmentLevel: 1 | 2 | 3 | 4 | 5;
  };
}

interface Challenge {
  description: string;
  impact: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  costEstimate?: number;
}

interface TechnicalIssue {
  type: 'performance' | 'security' | 'mobile' | 'seo' | 'accessibility';
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
}

interface BusinessImpact {
  area: 'revenue' | 'efficiency' | 'reputation' | 'growth';
  description: string;
  estimatedLoss?: number;
}

interface Goal {
  description: string;
  priority: 'must-have' | 'should-have' | 'nice-to-have';
  timeline?: string;
}

interface Metric {
  name: string;
  currentValue?: number;
  targetValue: number;
  measurementMethod: string;
}

interface BudgetRange {
  min: number;
  max: number;
  preferred?: number;
  type: 'monthly' | 'one-time' | 'annual';
}

interface Competitor {
  name: string;
  strengths: string[];
  weaknesses: string[];
  pricing?: string;
}

interface Reference {
  projectName: string;
  url?: string;
  relevance: string;
}
```

### Proposal Data Structure

```typescript
// service-client/src/lib/types/proposal.ts

export interface ProposalData {
  id: string;
  slug: string;
  consultation: ConsultationData;
  audit: AuditResult;
  
  // Proposal Configuration
  config: {
    package: Package;
    addons: Addon[];
    customizations: Customization[];
    timeline: Timeline;
    investment: Investment;
  };
  
  // Generated Sections
  sections: {
    executiveSummary: ExecutiveSummary;
    currentState: CurrentStateAnalysis;
    proposedSolution: ProposedSolution;
    roi: ROIAnalysis;
    caseStudies: CaseStudy[];
    implementation: ImplementationPlan;
    terms: TermsAndConditions;
    nextSteps: NextSteps;
  };
  
  // Metadata
  metadata: {
    createdAt: string;
    updatedAt: string;
    sentAt?: string;
    viewedAt?: string;
    acceptedAt?: string;
    expiresAt: string;
    status: ProposalStatus;
    version: number;
    internalNotes?: string;
  };
  
  // Analytics
  analytics: {
    views: number;
    downloads: number;
    timeSpentSeconds: number[];
    mostViewedSections: string[];
    clientInteractions: Interaction[];
  };
}

interface Package {
  id: string;
  name: string;
  type: 'starter' | 'growth' | 'enterprise' | 'custom';
  monthlyPrice: number;
  setupFee?: number;
  features: Feature[];
  limitations?: string[];
}

interface Addon {
  id: string;
  name: string;
  category: string;
  price: number;
  billingType: 'monthly' | 'one-time';
  description: string;
  value: string;
}

interface Timeline {
  phases: Phase[];
  totalDuration: string;
  startDate?: string;
  launchDate?: string;
}

interface Phase {
  name: string;
  duration: string;
  deliverables: string[];
  milestones: string[];
}

interface Investment {
  monthly: number;
  setup?: number;
  total: number;
  savings: number;
  paymentTerms: string;
  guarantees: string[];
}

interface ROIAnalysis {
  currentMetrics: Metrics;
  projectedMetrics: Metrics;
  improvements: Improvement[];
  breakEvenMonths: number;
  threeYearValue: number;
}

interface Metrics {
  traffic: number;
  conversionRate: number;
  avgOrderValue: number;
  monthlyRevenue: number;
  customerAcquisitionCost: number;
}

interface Improvement {
  metric: string;
  currentValue: number | string;
  projectedValue: number | string;
  percentChange: number;
  dollarImpact?: number;
}
```

## Component Implementation Details

### Key Svelte 5 Components

#### 1. Multi-Step Consultation Flow

```svelte
<!-- service-client/src/routes/(app)/consultation/+layout.svelte -->
<script lang="ts">
  import { page } from '$app/state';
  import { consultationStore } from '$lib/stores/consultation.svelte';
  import StepIndicator from '$lib/components/shared/StepIndicator.svelte';
  import SaveDraft from '$lib/components/shared/SaveDraft.svelte';
  
  const steps = [
    { path: '/consultation', label: 'Client Info', icon: 'user' },
    { path: '/consultation/business', label: 'Business Context', icon: 'building' },
    { path: '/consultation/challenges', label: 'Pain Points', icon: 'alert' },
    { path: '/consultation/goals', label: 'Goals', icon: 'target' },
    { path: '/consultation/audit', label: 'Website Audit', icon: 'search' },
    { path: '/consultation/package', label: 'Package', icon: 'package' },
    { path: '/consultation/customize', label: 'Customize', icon: 'settings' },
    { path: '/consultation/review', label: 'Review', icon: 'check' }
  ];
  
  let currentStep = $derived(
    steps.findIndex(s => page.url.pathname === s.path) + 1
  );
  
  let progress = $derived((currentStep / steps.length) * 100);
</script>

<div class="consultation-flow">
  <header class="flow-header">
    <StepIndicator {steps} {currentStep} />
    <div class="flow-actions">
      <SaveDraft store={consultationStore} />
      <span class="text-sm text-gray-500">
        Autosaved {consultationStore.lastSaved}
      </span>
    </div>
  </header>
  
  <div class="flow-progress">
    <div class="progress-bar" style="width: {progress}%"></div>
  </div>
  
  <main class="flow-content">
    {@render children()}
  </main>
  
  <footer class="flow-navigation">
    {#if currentStep > 1}
      <a href={steps[currentStep - 2].path} class="btn-secondary">
        Previous
      </a>
    {/if}
    
    {#if currentStep < steps.length}
      <button 
        onclick={consultationStore.saveAndContinue}
        class="btn-primary"
        disabled={!consultationStore.currentStepValid}
      >
        Continue
      </button>
    {:else}
      <button 
        onclick={consultationStore.generateProposal}
        class="btn-success"
      >
        Generate Proposal
      </button>
    {/if}
  </footer>
</div>
```

#### 2. Audit Runner Component

```svelte
<!-- service-client/src/lib/components/audit/AuditRunner.svelte -->
<script lang="ts">
  import { auditStore } from '$lib/stores/audit.svelte';
  import PerformanceMetrics from './PerformanceMetrics.svelte';
  import IssuesList from './IssuesList.svelte';
  
  interface Props {
    url: string;
    onComplete?: (result: AuditResult) => void;
  }
  
  let { url, onComplete }: Props = $props();
  
  let isRunning = $state(false);
  let progress = $state(0);
  let status = $state<'idle' | 'running' | 'complete' | 'error'>('idle');
  
  async function runAudit() {
    isRunning = true;
    status = 'running';
    progress = 0;
    
    const interval = setInterval(() => {
      if (progress < 90) progress += 10;
    }, 500);
    
    try {
      const result = await auditStore.runAudit(url);
      clearInterval(interval);
      progress = 100;
      status = 'complete';
      onComplete?.(result);
    } catch (error) {
      clearInterval(interval);
      status = 'error';
    } finally {
      isRunning = false;
    }
  }
  
  $effect(() => {
    if (url) runAudit();
  });
</script>

<div class="audit-runner">
  {#if status === 'running'}
    <div class="audit-progress">
      <h3>Analyzing Website Performance</h3>
      <div class="progress-bar">
        <div class="progress-fill" style="width: {progress}%"></div>
      </div>
      <p class="text-sm">
        {#if progress < 30}
          Connecting to {url}...
        {:else if progress < 60}
          Running performance tests...
        {:else if progress < 90}
          Analyzing SEO and accessibility...
        {:else}
          Generating report...
        {/if}
      </p>
    </div>
  {:else if status === 'complete' && auditStore.currentAudit}
    <div class="audit-results">
      <PerformanceMetrics audit={auditStore.currentAudit} />
      <IssuesList issues={auditStore.currentAudit.issues} />
    </div>
  {:else if status === 'error'}
    <div class="audit-error">
      <p>Failed to analyze website. Please check the URL and try again.</p>
      <button onclick={runAudit}>Retry</button>
    </div>
  {/if}
</div>
```

#### 3. Package Selector Component

```svelte
<!-- service-client/src/lib/components/package/PackageSelector.svelte -->
<script lang="ts">
  import { packagesStore } from '$lib/stores/packages.svelte';
  import PackageComparison from './PackageComparison.svelte';
  import FeatureList from './FeatureList.svelte';
  
  interface Props {
    recommendedPackage?: string;
    onSelect: (pkg: Package) => void;
  }
  
  let { recommendedPackage, onSelect }: Props = $props();
  
  let packages = $state(packagesStore.packages);
  let selectedPackage = $state<Package | null>(null);
  let showComparison = $state(false);
  
  $effect(() => {
    if (recommendedPackage && packages.length) {
      selectedPackage = packages.find(p => p.type === recommendedPackage) || null;
    }
  });
</script>

<div class="package-selector">
  <div class="packages-grid">
    {#each packages as pkg}
      <div 
        class="package-card"
        class:selected={selectedPackage?.id === pkg.id}
        class:recommended={pkg.type === recommendedPackage}
      >
        {#if pkg.type === recommendedPackage}
          <span class="badge-recommended">Recommended</span>
        {/if}
        
        <h3>{pkg.name}</h3>
        <div class="price">
          <span class="amount">${pkg.monthlyPrice}</span>
          <span class="period">/month</span>
        </div>
        
        <FeatureList features={pkg.features} compact />
        
        <button 
          onclick={() => {
            selectedPackage = pkg;
            onSelect(pkg);
          }}
          class="btn-select"
        >
          Select {pkg.name}
        </button>
      </div>
    {/each}
  </div>
  
  <button 
    onclick={() => showComparison = true}
    class="btn-link"
  >
    Compare all packages
  </button>
  
  {#if showComparison}
    <PackageComparison 
      {packages} 
      selected={selectedPackage}
      onClose={() => showComparison = false}
    />
  {/if}
</div>
```

## Database Schema

```sql
-- PostgreSQL Schema (extends existing GoFast tables)

-- Consultations table
CREATE TABLE IF NOT EXISTS consultations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    user_id UUID NOT NULL REFERENCES users(id),
    
    -- Client Information
    business_name TEXT NOT NULL,
    contact_name TEXT NOT NULL,
    contact_title TEXT,
    email TEXT NOT NULL,
    phone TEXT,
    website TEXT,
    preferred_contact TEXT DEFAULT 'email',
    
    -- Business Context
    industry TEXT NOT NULL,
    location TEXT NOT NULL,
    years_in_business INTEGER,
    team_size INTEGER,
    monthly_traffic INTEGER,
    current_platform TEXT,
    
    -- Consultation Data (JSONB for flexibility)
    business_data JSONB,
    challenges JSONB,
    goals JSONB,
    budget JSONB,
    
    -- Metadata
    consultation_date TIMESTAMPTZ,
    duration_minutes INTEGER,
    sales_rep TEXT,
    notes TEXT,
    next_steps JSONB,
    commitment_level INTEGER CHECK (commitment_level BETWEEN 1 AND 5),
    status TEXT DEFAULT 'scheduled',
    
    -- Indexes
    INDEX idx_consultations_user (user_id),
    INDEX idx_consultations_status (status),
    INDEX idx_consultations_date (consultation_date)
);

-- Audits table (cached website audits)
CREATE TABLE IF NOT EXISTS audits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    url TEXT NOT NULL,
    domain TEXT NOT NULL,
    audit_type TEXT DEFAULT 'full',
    
    -- Audit Results (JSONB)
    scores JSONB NOT NULL,
    metrics JSONB NOT NULL,
    issues JSONB,
    opportunities JSONB,
    
    expires_at TIMESTAMPTZ DEFAULT (CURRENT_TIMESTAMP + INTERVAL '7 days'),
    
    INDEX idx_audits_url (url),
    INDEX idx_audits_expires (expires_at)
);

-- Proposals table
CREATE TABLE IF NOT EXISTS proposals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    user_id UUID NOT NULL REFERENCES users(id),
    consultation_id UUID REFERENCES consultations(id),
    audit_id UUID REFERENCES audits(id),
    
    -- Proposal Identification
    slug TEXT UNIQUE NOT NULL,
    version INTEGER DEFAULT 1,
    
    -- Client Information
    client_name TEXT NOT NULL,
    client_email TEXT,
    client_phone TEXT,
    website_url TEXT,
    
    -- Proposal Configuration
    package_id UUID REFERENCES packages(id),
    package_config JSONB,
    addons JSONB,
    customizations JSONB,
    
    -- Proposal Content
    sections JSONB NOT NULL,
    timeline JSONB,
    investment JSONB,
    
    -- Status & Tracking
    status TEXT DEFAULT 'draft',
    valid_until TIMESTAMPTZ DEFAULT (CURRENT_TIMESTAMP + INTERVAL '30 days'),
    sent_at TIMESTAMPTZ,
    viewed_at TIMESTAMPTZ,
    accepted_at TIMESTAMPTZ,
    rejected_at TIMESTAMPTZ,
    rejection_reason TEXT,
    
    -- Analytics
    view_count INTEGER DEFAULT 0,
    download_count INTEGER DEFAULT 0,
    time_spent_seconds INTEGER[],
    
    -- Files
    pdf_file_id UUID REFERENCES files(id),
    
    INDEX idx_proposals_user (user_id),
    INDEX idx_proposals_slug (slug),
    INDEX idx_proposals_status (status),
    INDEX idx_proposals_consultation (consultation_id)
);

-- Packages table
CREATE TABLE IF NOT EXISTS packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    description TEXT,
    monthly_price DECIMAL(10,2) NOT NULL,
    setup_fee DECIMAL(10,2),
    
    features JSONB NOT NULL,
    limitations JSONB,
    
    is_active BOOLEAN DEFAULT TRUE,
    display_order INTEGER DEFAULT 0,
    
    INDEX idx_packages_type (type),
    INDEX idx_packages_active (is_active)
);

-- Add-ons table
CREATE TABLE IF NOT EXISTS addons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT,
    
    monthly_price DECIMAL(10,2),
    one_time_price DECIMAL(10,2),
    
    value_proposition TEXT,
    
    is_active BOOLEAN DEFAULT TRUE,
    display_order INTEGER DEFAULT 0,
    
    INDEX idx_addons_category (category),
    INDEX idx_addons_active (is_active)
);

-- Proposal Templates
CREATE TABLE IF NOT EXISTS proposal_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    name TEXT NOT NULL,
    description TEXT,
    industry TEXT,
    package_type TEXT,
    
    sections JSONB NOT NULL,
    default_timeline JSONB,
    
    is_default BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    
    INDEX idx_templates_industry (industry),
    INDEX idx_templates_default (is_default)
);

-- Proposal Analytics Events
CREATE TABLE IF NOT EXISTS proposal_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    proposal_id UUID NOT NULL REFERENCES proposals(id),
    
    event_type TEXT NOT NULL,
    event_data JSONB,
    
    ip_address TEXT,
    user_agent TEXT,
    referer TEXT,
    
    session_id TEXT,
    
    INDEX idx_analytics_proposal (proposal_id),
    INDEX idx_analytics_event (event_type),
    INDEX idx_analytics_session (session_id)
);
```

## Service Architecture Details

### Core Service Domain Structure

```go
// app/service-core/domain/consultation/service.go

package consultation

import (
    "context"
    "time"
    "service-core/storage/query"
)

type Service struct {
    store *query.Queries
}

func NewService(store *query.Queries) *Service {
    return &Service{store: store}
}

func (s *Service) CreateConsultation(ctx context.Context, input CreateConsultationInput) (*Consultation, error) {
    // Validate input
    if err := input.Validate(); err != nil {
        return nil, err
    }
    
    // Create consultation
    consultation := &Consultation{
        ID:           generateID(),
        UserID:       input.UserID,
        BusinessName: input.BusinessName,
        ContactName:  input.ContactName,
        Email:        input.Email,
        // ... map other fields
        CreatedAt:    time.Now(),
        Status:       "scheduled",
    }
    
    // Save to database
    if err := s.store.CreateConsultation(ctx, consultation); err != nil {
        return nil, err
    }
    
    return consultation, nil
}

func (s *Service) UpdateConsultation(ctx context.Context, id string, updates UpdateConsultationInput) error {
    // Implementation
}

func (s *Service) GetConsultation(ctx context.Context, id string) (*Consultation, error) {
    // Implementation
}

func (s *Service) ListConsultations(ctx context.Context, userID string, filters ListFilters) ([]*Consultation, error) {
    // Implementation
}
```

### REST API Implementation

```go
// app/service-core/rest/handlers/consultation.go

package handlers

import (
    "encoding/json"
    "net/http"
    "service-core/domain/consultation"
)

type ConsultationHandler struct {
    service *consultation.Service
}

func (h *ConsultationHandler) Create(w http.ResponseWriter, r *http.Request) {
    var input consultation.CreateConsultationInput
    if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
        http.Error(w, err.Error(), http.StatusBadRequest)
        return
    }
    
    // Get user from context
    userID := getUserIDFromContext(r.Context())
    input.UserID = userID
    
    result, err := h.service.CreateConsultation(r.Context(), input)
    if err != nil {
        http.Error(w, err.Error(), http.StatusInternalServerError)
        return
    }
    
    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(result)
}

func (h *ConsultationHandler) List(w http.ResponseWriter, r *http.Request) {
    // Implementation
}

func (h *ConsultationHandler) Get(w http.ResponseWriter, r *http.Request) {
    // Implementation
}

func (h *ConsultationHandler) Update(w http.ResponseWriter, r *http.Request) {
    // Implementation
}
```

## Deployment Strategy

### Development Environment

```bash
# 1. Clone repository and setup
git clone <repository>
cd webkit

# 2. Generate JWT keys
sh scripts/keys.sh

# 3. Configure environment
cp .env.example .env
# Edit .env with your configuration

# 4. Start services with Docker Compose
docker compose up --build

# 5. Run database migrations
sh scripts/atlas.sh

# 6. Access services
# Client: http://localhost:3000
# Admin: http://localhost:3001
# Core API: http://localhost:4001
# NATS Monitor: http://localhost:8222
```

### Production Deployment Options

#### Option 1: Kubernetes (Recommended for Scale)

```bash
# Setup Kubernetes cluster
cd kube
sh setup.sh

# Deploy application
kubectl apply -f config/

# Monitor deployment
kubectl get pods -n webkit
```

#### Option 2: Docker with Cloud Run

```bash
# Build and push images
docker build -t gcr.io/project/service-core:latest ./app/service-core
docker build -t gcr.io/project/service-admin:latest ./app/service-admin
docker build -t gcr.io/project/service-client:latest ./service-client

# Deploy to Cloud Run
gcloud run deploy service-core --image gcr.io/project/service-core:latest
gcloud run deploy service-admin --image gcr.io/project/service-admin:latest
gcloud run deploy service-client --image gcr.io/project/service-client:latest
```

## Testing Strategy

### Unit Tests

```go
// app/service-core/domain/consultation/service_test.go

package consultation_test

import (
    "testing"
    "context"
    "service-core/domain/consultation"
)

func TestCreateConsultation(t *testing.T) {
    // Setup
    store := setupTestStore()
    service := consultation.NewService(store)
    
    // Test
    input := consultation.CreateConsultationInput{
        BusinessName: "Test Company",
        ContactName:  "John Doe",
        Email:        "john@test.com",
    }
    
    result, err := service.CreateConsultation(context.Background(), input)
    
    // Assert
    assert.NoError(t, err)
    assert.NotNil(t, result)
    assert.Equal(t, "Test Company", result.BusinessName)
}
```

### Integration Tests

```typescript
// service-client/tests/consultation-flow.test.ts

import { test, expect } from '@playwright/test';

test('complete consultation flow', async ({ page }) => {
  // Login
  await page.goto('/login');
  await page.fill('[name=email]', 'test@example.com');
  await page.fill('[name=password]', 'password');
  await page.click('button[type=submit]');
  
  // Start consultation
  await page.goto('/consultation');
  
  // Fill client info
  await page.fill('[name=businessName]', 'Test Company');
  await page.fill('[name=contactName]', 'John Doe');
  await page.fill('[name=email]', 'john@test.com');
  await page.click('button:text("Continue")');
  
  // Continue through steps...
  
  // Generate proposal
  await page.click('button:text("Generate Proposal")');
  
  // Verify proposal created
  await expect(page).toHaveURL(/\/proposals\/[a-z0-9-]+/);
});
```

## Monitoring & Observability

### Metrics Collection

```go
// app/pkg/metrics/metrics.go

package metrics

import (
    "github.com/prometheus/client_golang/prometheus"
)

var (
    ProposalsCreated = prometheus.NewCounter(
        prometheus.CounterOpts{
            Name: "proposals_created_total",
            Help: "Total number of proposals created",
        },
    )
    
    ConsultationsCompleted = prometheus.NewCounter(
        prometheus.CounterOpts{
            Name: "consultations_completed_total",
            Help: "Total number of consultations completed",
        },
    )
    
    AuditDuration = prometheus.NewHistogram(
        prometheus.HistogramOpts{
            Name: "audit_duration_seconds",
            Help: "Time taken to complete website audit",
        },
    )
)

func init() {
    prometheus.MustRegister(ProposalsCreated)
    prometheus.MustRegister(ConsultationsCompleted)
    prometheus.MustRegister(AuditDuration)
}
```

### Grafana Dashboard Configuration

```json
{
  "dashboard": {
    "title": "Proposal Generator Metrics",
    "panels": [
      {
        "title": "Proposals Created",
        "targets": [
          {
            "expr": "rate(proposals_created_total[5m])"
          }
        ]
      },
      {
        "title": "Consultation Conversion Rate",
        "targets": [
          {
            "expr": "proposals_created_total / consultations_completed_total * 100"
          }
        ]
      },
      {
        "title": "Audit Performance",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, audit_duration_seconds)"
          }
        ]
      }
    ]
  }
}
```

## Security Considerations

### Authentication Flow

```typescript
// service-client/src/lib/services/auth.ts

import { jose } from 'jose';

export class AuthService {
  private publicKey: CryptoKey;
  
  async verifyToken(token: string): Promise<boolean> {
    try {
      const { payload } = await jose.jwtVerify(
        token,
        this.publicKey,
        {
          issuer: 'webkit',
          audience: 'webkit-client'
        }
      );
      
      return payload.exp > Date.now() / 1000;
    } catch {
      return false;
    }
  }
  
  async refreshToken(refreshToken: string): Promise<string> {
    const response = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken })
    });
    
    if (!response.ok) throw new Error('Failed to refresh token');
    
    const { accessToken } = await response.json();
    return accessToken;
  }
}
```

## Performance Optimization

### Caching Strategy

```go
// app/service-core/domain/audit/cache.go

package audit

import (
    "context"
    "encoding/json"
    "time"
    "github.com/go-redis/redis/v8"
)

type Cache struct {
    client *redis.Client
    ttl    time.Duration
}

func NewCache(client *redis.Client) *Cache {
    return &Cache{
        client: client,
        ttl:    7 * 24 * time.Hour, // 7 days
    }
}

func (c *Cache) Get(ctx context.Context, url string) (*AuditResult, error) {
    key := "audit:" + url
    
    data, err := c.client.Get(ctx, key).Result()
    if err == redis.Nil {
        return nil, nil
    }
    if err != nil {
        return nil, err
    }
    
    var result AuditResult
    if err := json.Unmarshal([]byte(data), &result); err != nil {
        return nil, err
    }
    
    return &result, nil
}

func (c *Cache) Set(ctx context.Context, url string, result *AuditResult) error {
    key := "audit:" + url
    
    data, err := json.Marshal(result)
    if err != nil {
        return err
    }
    
    return c.client.Set(ctx, key, data, c.ttl).Err()
}
```

## Conclusion

This enhanced specification provides a comprehensive blueprint for implementing the proposal generator using the GoFast architecture. The detailed component structures, routes, and implementation examples ensure a clear development path while maintaining the flexibility and scalability benefits of the microservices approach.
