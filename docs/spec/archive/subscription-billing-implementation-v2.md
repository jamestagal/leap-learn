# Subscription Billing Implementation Plan v2

## Overview

Implement subscription billing so agencies can pay for WebKit tiers (free → starter → growth → enterprise) using Stripe Checkout. This plan leverages the **existing Go service-core payment infrastructure** rather than rebuilding in SvelteKit.

## Architecture Decision

**Approach:** Extend existing Go service + SvelteKit frontend calls Go APIs

**Rationale:**
- Go service already has Stripe SDK integration with proper webhook verification
- Existing `provider_stripe.go` has `CreateCustomer`, `CreatePaymentCheckout`, `CreatePaymentPortal`, `HandleWebhook`
- Avoids duplicating Stripe logic across two services
- Maintains single source of truth for payment state

---

## Current State Analysis

### What Exists (Go Service)

| File | Functions | Status |
|------|-----------|--------|
| `domain/payment/provider_stripe.go` | `CreateCustomer`, `CreatePaymentPortal`, `CreatePaymentCheckout`, `UpdateSubscription`, `HandleWebhook` | ✅ Working |
| `domain/payment/service.go` | Service layer wrapping provider | ✅ Working |
| `rest/payment_route.go` | REST endpoints for portal, checkout, webhook | ⚠️ User-centric, needs agency support |
| `config/config.go` | `StripeAPIKey`, `StripePriceIDBasic`, `StripePriceIDPremium` | ⚠️ Only 2 price IDs |

### What Exists (SvelteKit)

| File | Purpose | Status |
|------|---------|--------|
| `lib/server/subscription.ts` | `TIER_DEFINITIONS`, enforcement functions, usage stats | ✅ Complete |
| `routes/api/stripe/webhook/+server.ts` | Stripe Connect webhooks (invoice payments) | ✅ Working (different purpose) |
| `routes/(app)/[agencySlug]/settings/payments/` | Stripe Connect setup page | ✅ Working (different purpose) |

### Key Gap

Current Go service manages subscriptions on **users** table. WebKit needs subscriptions on **agencies** table:

```sql
-- agencies table already has these columns:
subscription_tier VARCHAR(50) DEFAULT 'free'
subscription_id TEXT DEFAULT ''
subscription_end TIMESTAMP WITH TIME ZONE
```

---

## Pre-Implementation: Stripe Dashboard Setup

### 1. Create Products & Prices

Create in Stripe Dashboard (Test mode first):

| Product | Monthly Price ID | Yearly Price ID | Monthly $ | Yearly $ |
|---------|-----------------|-----------------|-----------|----------|
| WebKit Starter | `price_starter_monthly` | `price_starter_yearly` | $29 | $290 |
| WebKit Growth | `price_growth_monthly` | `price_growth_yearly` | $79 | $790 |
| WebKit Enterprise | `price_enterprise_monthly` | `price_enterprise_yearly` | $199 | $1,990 |

### 2. Configure Webhook Endpoint

In Stripe Dashboard → Webhooks:
- Endpoint: `https://api.webkit.au/api/v1/billing/webhook` (or your Go service URL)
- Events to send:
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_succeeded`
  - `invoice.payment_failed`

### 3. Environment Variables

Add to `.env` (service-core):

```bash
# Stripe Platform Subscriptions (agencies paying you)
STRIPE_PRICE_STARTER_MONTHLY=price_xxx
STRIPE_PRICE_STARTER_YEARLY=price_xxx
STRIPE_PRICE_GROWTH_MONTHLY=price_xxx
STRIPE_PRICE_GROWTH_YEARLY=price_xxx
STRIPE_PRICE_ENTERPRISE_MONTHLY=price_xxx
STRIPE_PRICE_ENTERPRISE_YEARLY=price_xxx
STRIPE_BILLING_WEBHOOK_SECRET=whsec_xxx
```

---

## Phase 1: Go Service Modifications

### 1.1 Update Config (`config/config.go`)

Add new price ID fields:

```go
// Payment - Platform Subscriptions
StripeAPIKey                  string
StripePriceStarterMonthly     string
StripePriceStarterYearly      string
StripePriceGrowthMonthly      string
StripePriceGrowthYearly       string
StripePriceEnterpriseMonthly  string
StripePriceEnterpriseYearly   string
StripeBillingWebhookSecret    string  // Separate from Connect webhook
SubscriptionSafePeriodDays    int
```

### 1.2 Create Agency Billing Store (`storage/query/agency_billing.sql`)

Add new queries:

```sql
-- name: GetAgencyBillingInfo :one
SELECT 
    a.id,
    a.subscription_tier,
    a.subscription_id,
    a.subscription_end,
    a.stripe_customer_id,
    a.ai_generations_this_month,
    a.ai_generations_reset_at,
    a.is_freemium,
    a.freemium_expires_at
FROM agencies a
WHERE a.id = $1;

-- name: UpdateAgencyStripeCustomer :exec
UPDATE agencies
SET stripe_customer_id = $2, updated_at = NOW()
WHERE id = $1;

-- name: UpdateAgencySubscription :exec
UPDATE agencies
SET 
    subscription_tier = $2,
    subscription_id = $3,
    subscription_end = $4,
    updated_at = NOW()
WHERE id = $1;

-- name: GetAgencyByStripeCustomer :one
SELECT * FROM agencies
WHERE stripe_customer_id = $1;

-- name: DowngradeAgencyToFree :exec
UPDATE agencies
SET 
    subscription_tier = 'free',
    subscription_id = '',
    subscription_end = NULL,
    updated_at = NOW()
WHERE id = $1;
```

### 1.3 Add Database Column (Migration)

Create migration `009_add_stripe_customer_to_agencies.sql`:

```sql
-- +goose Up
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_agencies_stripe_customer ON agencies(stripe_customer_id) WHERE stripe_customer_id != '';

-- +goose Down
DROP INDEX IF EXISTS idx_agencies_stripe_customer;
ALTER TABLE agencies DROP COLUMN IF EXISTS stripe_customer_id;
```

### 1.4 Create Billing Service (`domain/billing/service.go`)

New service specifically for agency billing (separate from existing payment service which handles Connect):

```go
package billing

import (
    "context"
    "fmt"
    "time"
    
    "github.com/stripe/stripe-go/v82"
    "github.com/stripe/stripe-go/v82/checkout/session"
    "github.com/stripe/stripe-go/v82/customer"
    portal "github.com/stripe/stripe-go/v82/billingportal/session"
    "github.com/stripe/stripe-go/v82/webhook"
)

type Service struct {
    cfg   *config.Config
    store store
}

type store interface {
    GetAgencyBillingInfo(ctx context.Context, agencyID uuid.UUID) (query.Agency, error)
    UpdateAgencyStripeCustomer(ctx context.Context, params query.UpdateAgencyStripeCustomerParams) error
    UpdateAgencySubscription(ctx context.Context, params query.UpdateAgencySubscriptionParams) error
    GetAgencyByStripeCustomer(ctx context.Context, customerID string) (query.Agency, error)
    DowngradeAgencyToFree(ctx context.Context, agencyID uuid.UUID) error
}

// TierPricing maps tier + interval to Stripe price ID
func (s *Service) getPriceID(tier, interval string) (string, error) {
    prices := map[string]map[string]string{
        "starter": {
            "month": s.cfg.StripePriceStarterMonthly,
            "year":  s.cfg.StripePriceStarterYearly,
        },
        "growth": {
            "month": s.cfg.StripePriceGrowthMonthly,
            "year":  s.cfg.StripePriceGrowthYearly,
        },
        "enterprise": {
            "month": s.cfg.StripePriceEnterpriseMonthly,
            "year":  s.cfg.StripePriceEnterpriseYearly,
        },
    }
    
    if tierPrices, ok := prices[tier]; ok {
        if priceID, ok := tierPrices[interval]; ok && priceID != "" {
            return priceID, nil
        }
    }
    return "", fmt.Errorf("invalid tier/interval: %s/%s", tier, interval)
}

// tierFromPriceID reverse maps price ID to tier name
func (s *Service) tierFromPriceID(priceID string) string {
    priceToTier := map[string]string{
        s.cfg.StripePriceStarterMonthly:    "starter",
        s.cfg.StripePriceStarterYearly:     "starter",
        s.cfg.StripePriceGrowthMonthly:     "growth",
        s.cfg.StripePriceGrowthYearly:      "growth",
        s.cfg.StripePriceEnterpriseMonthly: "enterprise",
        s.cfg.StripePriceEnterpriseYearly:  "enterprise",
    }
    if tier, ok := priceToTier[priceID]; ok {
        return tier
    }
    return "free"
}

// GetOrCreateCustomer ensures agency has a Stripe customer ID
func (s *Service) GetOrCreateCustomer(ctx context.Context, agencyID uuid.UUID, email, name string) (string, error) {
    stripe.Key = s.cfg.StripeAPIKey
    
    agency, err := s.store.GetAgencyBillingInfo(ctx, agencyID)
    if err != nil {
        return "", err
    }
    
    // Return existing customer if present
    if agency.StripeCustomerID != "" {
        return agency.StripeCustomerID, nil
    }
    
    // Create new Stripe customer
    params := &stripe.CustomerParams{
        Email: stripe.String(email),
        Name:  stripe.String(name),
        Metadata: map[string]string{
            "agency_id": agencyID.String(),
        },
    }
    
    cust, err := customer.New(params)
    if err != nil {
        return "", fmt.Errorf("failed to create Stripe customer: %w", err)
    }
    
    // Store customer ID on agency
    err = s.store.UpdateAgencyStripeCustomer(ctx, query.UpdateAgencyStripeCustomerParams{
        ID:               agencyID,
        StripeCustomerID: cust.ID,
    })
    if err != nil {
        return "", err
    }
    
    return cust.ID, nil
}

// CreateCheckoutSession creates a Stripe Checkout session for subscription
func (s *Service) CreateCheckoutSession(
    ctx context.Context,
    agencyID uuid.UUID,
    agencySlug string,
    email string,
    agencyName string,
    tier string,
    interval string,
) (string, error) {
    stripe.Key = s.cfg.StripeAPIKey
    
    priceID, err := s.getPriceID(tier, interval)
    if err != nil {
        return "", err
    }
    
    customerID, err := s.GetOrCreateCustomer(ctx, agencyID, email, agencyName)
    if err != nil {
        return "", err
    }
    
    params := &stripe.CheckoutSessionParams{
        Customer: stripe.String(customerID),
        Mode:     stripe.String(string(stripe.CheckoutSessionModeSubscription)),
        LineItems: []*stripe.CheckoutSessionLineItemParams{
            {
                Price:    stripe.String(priceID),
                Quantity: stripe.Int64(1),
            },
        },
        SuccessURL: stripe.String(fmt.Sprintf("%s/%s/settings/billing?success=true", s.cfg.ClientURL, agencySlug)),
        CancelURL:  stripe.String(fmt.Sprintf("%s/%s/settings/billing?canceled=true", s.cfg.ClientURL, agencySlug)),
        Metadata: map[string]string{
            "agency_id": agencyID.String(),
            "tier":      tier,
        },
        SubscriptionData: &stripe.CheckoutSessionSubscriptionDataParams{
            Metadata: map[string]string{
                "agency_id": agencyID.String(),
                "tier":      tier,
            },
        },
        AllowPromotionCodes: stripe.Bool(true),
    }
    
    sess, err := session.New(params)
    if err != nil {
        return "", fmt.Errorf("failed to create checkout session: %w", err)
    }
    
    return sess.URL, nil
}

// CreatePortalSession creates a Stripe Billing Portal session
func (s *Service) CreatePortalSession(ctx context.Context, agencyID uuid.UUID, agencySlug string) (string, error) {
    stripe.Key = s.cfg.StripeAPIKey
    
    agency, err := s.store.GetAgencyBillingInfo(ctx, agencyID)
    if err != nil {
        return "", err
    }
    
    if agency.StripeCustomerID == "" {
        return "", fmt.Errorf("agency has no Stripe customer")
    }
    
    params := &stripe.BillingPortalSessionParams{
        Customer:  stripe.String(agency.StripeCustomerID),
        ReturnURL: stripe.String(fmt.Sprintf("%s/%s/settings/billing", s.cfg.ClientURL, agencySlug)),
    }
    
    sess, err := portal.New(params)
    if err != nil {
        return "", fmt.Errorf("failed to create portal session: %w", err)
    }
    
    return sess.URL, nil
}

// HandleWebhook processes Stripe billing webhooks
func (s *Service) HandleWebhook(ctx context.Context, payload []byte, signature string) error {
    stripe.Key = s.cfg.StripeAPIKey
    
    event, err := webhook.ConstructEvent(payload, signature, s.cfg.StripeBillingWebhookSecret)
    if err != nil {
        return fmt.Errorf("webhook signature verification failed: %w", err)
    }
    
    switch event.Type {
    case "checkout.session.completed":
        return s.handleCheckoutCompleted(ctx, event)
    case "customer.subscription.updated":
        return s.handleSubscriptionUpdated(ctx, event)
    case "customer.subscription.deleted":
        return s.handleSubscriptionDeleted(ctx, event)
    case "invoice.payment_failed":
        return s.handlePaymentFailed(ctx, event)
    default:
        // Log but don't error on unhandled events
        return nil
    }
}

func (s *Service) handleCheckoutCompleted(ctx context.Context, event stripe.Event) error {
    var session stripe.CheckoutSession
    if err := json.Unmarshal(event.Data.Raw, &session); err != nil {
        return err
    }
    
    agencyIDStr := session.Metadata["agency_id"]
    if agencyIDStr == "" {
        return fmt.Errorf("no agency_id in session metadata")
    }
    
    agencyID, err := uuid.Parse(agencyIDStr)
    if err != nil {
        return err
    }
    
    // Get subscription details
    sub, err := subscription.Get(session.Subscription.ID, nil)
    if err != nil {
        return err
    }
    
    tier := s.tierFromPriceID(sub.Items.Data[0].Price.ID)
    endDate := time.Unix(sub.CurrentPeriodEnd, 0)
    
    return s.store.UpdateAgencySubscription(ctx, query.UpdateAgencySubscriptionParams{
        ID:              agencyID,
        SubscriptionTier: tier,
        SubscriptionID:   sub.ID,
        SubscriptionEnd:  endDate,
    })
}

func (s *Service) handleSubscriptionUpdated(ctx context.Context, event stripe.Event) error {
    var sub stripe.Subscription
    if err := json.Unmarshal(event.Data.Raw, &sub); err != nil {
        return err
    }
    
    // Find agency by customer ID
    agency, err := s.store.GetAgencyByStripeCustomer(ctx, sub.Customer.ID)
    if err != nil {
        return err
    }
    
    // Handle cancellation at period end
    if sub.CancelAtPeriodEnd {
        // Subscription will end, but don't downgrade yet
        return nil
    }
    
    tier := s.tierFromPriceID(sub.Items.Data[0].Price.ID)
    endDate := time.Unix(sub.CurrentPeriodEnd, 0)
    
    return s.store.UpdateAgencySubscription(ctx, query.UpdateAgencySubscriptionParams{
        ID:              agency.ID,
        SubscriptionTier: tier,
        SubscriptionID:   sub.ID,
        SubscriptionEnd:  endDate,
    })
}

func (s *Service) handleSubscriptionDeleted(ctx context.Context, event stripe.Event) error {
    var sub stripe.Subscription
    if err := json.Unmarshal(event.Data.Raw, &sub); err != nil {
        return err
    }
    
    agency, err := s.store.GetAgencyByStripeCustomer(ctx, sub.Customer.ID)
    if err != nil {
        return err
    }
    
    return s.store.DowngradeAgencyToFree(ctx, agency.ID)
}

func (s *Service) handlePaymentFailed(ctx context.Context, event stripe.Event) error {
    // TODO: Implement dunning - email agency about failed payment
    // For MVP, just log it
    return nil
}
```

### 1.5 Create Billing Routes (`rest/billing_route.go`)

```go
package rest

import (
    "encoding/json"
    "io"
    "net/http"
)

type CheckoutRequest struct {
    Tier     string `json:"tier"`
    Interval string `json:"interval"`
}

type CheckoutResponse struct {
    URL string `json:"url"`
}

type BillingInfoResponse struct {
    Tier             string     `json:"tier"`
    SubscriptionID   string     `json:"subscriptionId"`
    SubscriptionEnd  *time.Time `json:"subscriptionEnd"`
    IsFreemium       bool       `json:"isFreemium"`
    StripeCustomerID string     `json:"stripeCustomerId"`
}

func (h *Handler) handleBillingCheckout(w http.ResponseWriter, r *http.Request) {
    token := extractAccessToken(r)
    claims, err := h.authService.Auth(token, auth.ManageAgency)
    if err != nil {
        writeResponse(h.cfg, w, r, nil, err)
        return
    }
    
    var req CheckoutRequest
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        writeResponse(h.cfg, w, r, nil, pkg.BadRequestError{Message: "Invalid request body"})
        return
    }
    
    // Validate tier
    validTiers := map[string]bool{"starter": true, "growth": true, "enterprise": true}
    if !validTiers[req.Tier] {
        writeResponse(h.cfg, w, r, nil, pkg.BadRequestError{Message: "Invalid tier"})
        return
    }
    
    // Validate interval
    if req.Interval != "month" && req.Interval != "year" {
        writeResponse(h.cfg, w, r, nil, pkg.BadRequestError{Message: "Invalid interval"})
        return
    }
    
    url, err := h.billingService.CreateCheckoutSession(
        r.Context(),
        claims.AgencyID,
        claims.AgencySlug,
        claims.Email,
        claims.AgencyName,
        req.Tier,
        req.Interval,
    )
    if err != nil {
        writeResponse(h.cfg, w, r, nil, err)
        return
    }
    
    writeResponse(h.cfg, w, r, CheckoutResponse{URL: url}, nil)
}

func (h *Handler) handleBillingPortal(w http.ResponseWriter, r *http.Request) {
    token := extractAccessToken(r)
    claims, err := h.authService.Auth(token, auth.ManageAgency)
    if err != nil {
        writeResponse(h.cfg, w, r, nil, err)
        return
    }
    
    url, err := h.billingService.CreatePortalSession(r.Context(), claims.AgencyID, claims.AgencySlug)
    if err != nil {
        writeResponse(h.cfg, w, r, nil, err)
        return
    }
    
    writeResponse(h.cfg, w, r, CheckoutResponse{URL: url}, nil)
}

func (h *Handler) handleBillingInfo(w http.ResponseWriter, r *http.Request) {
    token := extractAccessToken(r)
    claims, err := h.authService.Auth(token, auth.ViewAgency)
    if err != nil {
        writeResponse(h.cfg, w, r, nil, err)
        return
    }
    
    agency, err := h.billingService.GetBillingInfo(r.Context(), claims.AgencyID)
    if err != nil {
        writeResponse(h.cfg, w, r, nil, err)
        return
    }
    
    writeResponse(h.cfg, w, r, agency, nil)
}

func (h *Handler) handleBillingWebhook(w http.ResponseWriter, r *http.Request) {
    const MaxBodyBytes = int64(65536)
    r.Body = http.MaxBytesReader(w, r.Body, MaxBodyBytes)
    
    payload, err := io.ReadAll(r.Body)
    if err != nil {
        writeResponse(h.cfg, w, r, nil, pkg.InternalError{Message: "Error reading body"})
        return
    }
    
    signature := r.Header.Get("Stripe-Signature")
    if err := h.billingService.HandleWebhook(r.Context(), payload, signature); err != nil {
        writeResponse(h.cfg, w, r, nil, err)
        return
    }
    
    w.WriteHeader(http.StatusOK)
}
```

### 1.6 Register Routes (`rest/router.go`)

Add to router setup:

```go
// Billing (Platform Subscriptions)
r.Route("/api/v1/billing", func(r chi.Router) {
    r.Post("/checkout", h.handleBillingCheckout)
    r.Post("/portal", h.handleBillingPortal)
    r.Get("/info", h.handleBillingInfo)
    r.Post("/webhook", h.handleBillingWebhook)  // No auth - Stripe calls this
})
```

---

## Phase 2: SvelteKit Frontend

### 2.1 Create API Client (`lib/api/billing.ts`)

```typescript
import { env } from '$env/dynamic/public';

const API_URL = env.PUBLIC_API_URL || 'http://localhost:8080';

interface CheckoutRequest {
    tier: 'starter' | 'growth' | 'enterprise';
    interval: 'month' | 'year';
}

interface CheckoutResponse {
    url: string;
}

interface BillingInfo {
    tier: string;
    subscriptionId: string;
    subscriptionEnd: string | null;
    isFreemium: boolean;
    stripeCustomerId: string;
}

export async function createCheckoutSession(
    request: CheckoutRequest,
    accessToken: string
): Promise<CheckoutResponse> {
    const response = await fetch(`${API_URL}/api/v1/billing/checkout`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify(request),
    });
    
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create checkout session');
    }
    
    return response.json();
}

export async function createPortalSession(accessToken: string): Promise<CheckoutResponse> {
    const response = await fetch(`${API_URL}/api/v1/billing/portal`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
        },
    });
    
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create portal session');
    }
    
    return response.json();
}

export async function getBillingInfo(accessToken: string): Promise<BillingInfo> {
    const response = await fetch(`${API_URL}/api/v1/billing/info`, {
        headers: {
            'Authorization': `Bearer ${accessToken}`,
        },
    });
    
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to get billing info');
    }
    
    return response.json();
}
```

### 2.2 Create Billing Page (`routes/(app)/[agencySlug]/settings/billing/+page.server.ts`)

```typescript
import type { PageServerLoad } from './$types';
import { getAgencyUsageStats, TIER_DEFINITIONS, type SubscriptionTier } from '$lib/server/subscription';

export const load: PageServerLoad = async ({ locals, parent }) => {
    const { agency } = await parent();
    
    // Get usage stats from existing subscription.ts
    const usageStats = await getAgencyUsageStats(agency.id);
    
    // Define pricing for display
    const tierPricing = {
        starter: {
            name: 'Starter',
            monthlyPrice: 29,
            yearlyPrice: 290,
            limits: TIER_DEFINITIONS.starter,
        },
        growth: {
            name: 'Growth', 
            monthlyPrice: 79,
            yearlyPrice: 790,
            limits: TIER_DEFINITIONS.growth,
        },
        enterprise: {
            name: 'Enterprise',
            monthlyPrice: 199,
            yearlyPrice: 1990,
            limits: TIER_DEFINITIONS.enterprise,
        },
    };
    
    return {
        usageStats,
        tierPricing,
        currentTier: usageStats.tier,
        subscriptionEnd: agency.subscriptionEnd,
        isFreemium: agency.isFreemium,
    };
};
```

### 2.3 Create Billing Page (`routes/(app)/[agencySlug]/settings/billing/+page.svelte`)

```svelte
<script lang="ts">
    import { page } from '$app/state';
    import { getToast } from '$lib/ui/toast_store.svelte';
    import { createCheckoutSession, createPortalSession } from '$lib/api/billing';
    import { 
        CreditCard, 
        Check, 
        Zap, 
        Crown, 
        Star,
        ExternalLink,
        AlertTriangle 
    } from 'lucide-svelte';
    import type { PageProps } from './$types';

    let { data }: PageProps = $props();
    const toast = getToast();

    let selectedInterval = $state<'month' | 'year'>('month');
    let isLoading = $state(false);
    let loadingTier = $state<string | null>(null);

    const { usageStats, tierPricing, currentTier, subscriptionEnd, isFreemium } = data;
    const agencySlug = $page.params.agencySlug;

    // Check URL params for success/canceled
    $effect(() => {
        const success = $page.url.searchParams.get('success');
        const canceled = $page.url.searchParams.get('canceled');
        
        if (success === 'true') {
            toast.success('Subscription activated! Welcome aboard.');
            history.replaceState(null, '', `/${agencySlug}/settings/billing`);
        }
        if (canceled === 'true') {
            toast.info('Checkout canceled');
            history.replaceState(null, '', `/${agencySlug}/settings/billing`);
        }
    });

    async function handleUpgrade(tier: string) {
        loadingTier = tier;
        try {
            const accessToken = ''; // Get from your auth context
            const { url } = await createCheckoutSession(
                { tier: tier as 'starter' | 'growth' | 'enterprise', interval: selectedInterval },
                accessToken
            );
            window.location.href = url;
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to start checkout');
        } finally {
            loadingTier = null;
        }
    }

    async function handleManageBilling() {
        isLoading = true;
        try {
            const accessToken = ''; // Get from your auth context
            const { url } = await createPortalSession(accessToken);
            window.location.href = url;
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to open billing portal');
        } finally {
            isLoading = false;
        }
    }

    function formatPrice(price: number) {
        return new Intl.NumberFormat('en-AU', {
            style: 'currency',
            currency: 'AUD',
            minimumFractionDigits: 0,
        }).format(price);
    }

    const tierIcons = {
        free: Star,
        starter: Star,
        growth: Zap,
        enterprise: Crown,
    };

    const tierOrder = ['starter', 'growth', 'enterprise'] as const;
    const currentTierIndex = tierOrder.indexOf(currentTier as typeof tierOrder[number]);
</script>

<svelte:head>
    <title>Billing | Settings</title>
</svelte:head>

<div class="space-y-8">
    <div>
        <h1 class="text-2xl font-bold">Billing & Subscription</h1>
        <p class="text-base-content/70 mt-1">Manage your WebKit subscription</p>
    </div>

    <!-- Freemium Banner -->
    {#if isFreemium}
        <div class="alert alert-success">
            <Crown class="h-5 w-5" />
            <div>
                <h3 class="font-bold">Freemium Access Active</h3>
                <p class="text-sm">You have full access to all features. Thank you for being an early supporter!</p>
            </div>
        </div>
    {/if}

    <!-- Current Plan -->
    <div class="card bg-base-100 border border-base-300">
        <div class="card-body">
            <h2 class="card-title">Current Plan</h2>
            
            <div class="flex items-center gap-4 mt-4">
                <div class="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                    <svelte:component this={tierIcons[currentTier] || Star} class="h-6 w-6 text-primary" />
                </div>
                <div>
                    <p class="text-xl font-bold capitalize">{currentTier}</p>
                    {#if subscriptionEnd && currentTier !== 'free'}
                        <p class="text-sm text-base-content/60">
                            Renews {new Date(subscriptionEnd).toLocaleDateString('en-AU', { 
                                day: 'numeric', month: 'long', year: 'numeric' 
                            })}
                        </p>
                    {/if}
                </div>
            </div>

            {#if currentTier !== 'free' && !isFreemium}
                <div class="mt-4">
                    <button 
                        class="btn btn-outline btn-sm"
                        onclick={handleManageBilling}
                        disabled={isLoading}
                    >
                        {#if isLoading}
                            <span class="loading loading-spinner loading-sm"></span>
                        {:else}
                            <ExternalLink class="h-4 w-4" />
                        {/if}
                        Manage Billing
                    </button>
                </div>
            {/if}
        </div>
    </div>

    <!-- Usage Stats -->
    <div class="card bg-base-100 border border-base-300">
        <div class="card-body">
            <h2 class="card-title">Usage This Month</h2>
            
            <div class="grid gap-4 mt-4 md:grid-cols-3">
                <!-- Members -->
                <div class="space-y-2">
                    <div class="flex justify-between text-sm">
                        <span>Team Members</span>
                        <span class="font-medium">
                            {usageStats.usage.members.current} / 
                            {usageStats.usage.members.limit === -1 ? '∞' : usageStats.usage.members.limit}
                        </span>
                    </div>
                    {#if usageStats.usage.members.limit !== -1}
                        <progress 
                            class="progress progress-primary" 
                            value={usageStats.usage.members.percentage} 
                            max="100"
                        ></progress>
                    {/if}
                </div>

                <!-- Consultations -->
                <div class="space-y-2">
                    <div class="flex justify-between text-sm">
                        <span>Consultations</span>
                        <span class="font-medium">
                            {usageStats.usage.consultationsThisMonth.current} / 
                            {usageStats.usage.consultationsThisMonth.limit === -1 ? '∞' : usageStats.usage.consultationsThisMonth.limit}
                        </span>
                    </div>
                    {#if usageStats.usage.consultationsThisMonth.limit !== -1}
                        <progress 
                            class="progress progress-primary" 
                            value={usageStats.usage.consultationsThisMonth.percentage} 
                            max="100"
                        ></progress>
                    {/if}
                </div>

                <!-- AI Generations -->
                <div class="space-y-2">
                    <div class="flex justify-between text-sm">
                        <span>AI Generations</span>
                        <span class="font-medium">
                            {usageStats.usage.aiGenerationsThisMonth.current} / 
                            {usageStats.usage.aiGenerationsThisMonth.limit === -1 ? '∞' : usageStats.usage.aiGenerationsThisMonth.limit}
                        </span>
                    </div>
                    {#if usageStats.usage.aiGenerationsThisMonth.limit !== -1}
                        <progress 
                            class="progress progress-primary" 
                            value={usageStats.usage.aiGenerationsThisMonth.percentage} 
                            max="100"
                        ></progress>
                    {/if}
                </div>
            </div>
        </div>
    </div>

    <!-- Pricing Plans -->
    {#if !isFreemium}
        <div class="space-y-4">
            <div class="flex items-center justify-between">
                <h2 class="text-xl font-bold">
                    {currentTier === 'free' ? 'Choose a Plan' : 'Change Plan'}
                </h2>
                
                <div class="join">
                    <button 
                        class="btn btn-sm join-item"
                        class:btn-active={selectedInterval === 'month'}
                        onclick={() => selectedInterval = 'month'}
                    >
                        Monthly
                    </button>
                    <button 
                        class="btn btn-sm join-item"
                        class:btn-active={selectedInterval === 'year'}
                        onclick={() => selectedInterval = 'year'}
                    >
                        Yearly
                        <span class="badge badge-success badge-sm ml-1">Save 17%</span>
                    </button>
                </div>
            </div>

            <div class="grid gap-6 md:grid-cols-3">
                {#each tierOrder as tier, index}
                    {@const pricing = tierPricing[tier]}
                    {@const price = selectedInterval === 'month' ? pricing.monthlyPrice : pricing.yearlyPrice}
                    {@const isCurrentTier = currentTier === tier}
                    {@const isDowngrade = index < currentTierIndex}
                    
                    <div class="card bg-base-100 border-2 {isCurrentTier ? 'border-primary' : 'border-base-300'}">
                        <div class="card-body">
                            {#if isCurrentTier}
                                <div class="badge badge-primary mb-2">Current Plan</div>
                            {/if}
                            
                            <h3 class="card-title">{pricing.name}</h3>
                            
                            <div class="my-4">
                                <span class="text-3xl font-bold">{formatPrice(price)}</span>
                                <span class="text-base-content/60">/{selectedInterval}</span>
                            </div>

                            <ul class="space-y-2 text-sm">
                                <li class="flex items-center gap-2">
                                    <Check class="h-4 w-4 text-success" />
                                    {pricing.limits.maxMembers === -1 ? 'Unlimited' : pricing.limits.maxMembers} team members
                                </li>
                                <li class="flex items-center gap-2">
                                    <Check class="h-4 w-4 text-success" />
                                    {pricing.limits.maxConsultationsPerMonth === -1 ? 'Unlimited' : pricing.limits.maxConsultationsPerMonth} consultations/mo
                                </li>
                                <li class="flex items-center gap-2">
                                    <Check class="h-4 w-4 text-success" />
                                    {pricing.limits.maxAIGenerationsPerMonth === -1 ? 'Unlimited' : pricing.limits.maxAIGenerationsPerMonth} AI generations/mo
                                </li>
                                {#each pricing.limits.features.slice(0, 4) as feature}
                                    <li class="flex items-center gap-2">
                                        <Check class="h-4 w-4 text-success" />
                                        {feature.replace(/_/g, ' ')}
                                    </li>
                                {/each}
                            </ul>

                            <div class="card-actions mt-4">
                                {#if isCurrentTier}
                                    <button class="btn btn-disabled w-full">Current Plan</button>
                                {:else if isDowngrade}
                                    <button 
                                        class="btn btn-outline w-full"
                                        onclick={handleManageBilling}
                                    >
                                        Downgrade
                                    </button>
                                {:else}
                                    <button 
                                        class="btn btn-primary w-full"
                                        onclick={() => handleUpgrade(tier)}
                                        disabled={loadingTier === tier}
                                    >
                                        {#if loadingTier === tier}
                                            <span class="loading loading-spinner loading-sm"></span>
                                        {:else}
                                            Upgrade to {pricing.name}
                                        {/if}
                                    </button>
                                {/if}
                            </div>
                        </div>
                    </div>
                {/each}
            </div>
        </div>
    {/if}
</div>
```

### 2.4 Add Navigation Item

Update `routes/(app)/[agencySlug]/settings/+layout.svelte`:

```svelte
// Add to navigation items array
{ href: `/${agencySlug}/settings/billing`, label: 'Billing', icon: CreditCard }
```

---

## Phase 3: Testing & Verification

### 3.1 Stripe CLI Testing

```bash
# Terminal 1: Start Go service
cd app/service-core && go run .

# Terminal 2: Forward Stripe webhooks
stripe listen --forward-to localhost:8080/api/v1/billing/webhook

# Terminal 3: Test webhook events
stripe trigger checkout.session.completed
stripe trigger customer.subscription.updated
stripe trigger customer.subscription.deleted
```

### 3.2 Manual Test Flow

1. **Free → Starter Upgrade**
   - Navigate to `/[agencySlug]/settings/billing`
   - Select "Starter" plan, click "Upgrade"
   - Complete Stripe Checkout with test card `4242 4242 4242 4242`
   - Verify redirect back with `?success=true`
   - Verify agency `subscription_tier` = 'starter' in database

2. **Billing Portal Access**
   - Click "Manage Billing" button
   - Verify redirect to Stripe Billing Portal
   - Test cancel subscription flow
   - Verify webhook fires and tier reverts to 'free'

3. **Usage Stats Display**
   - Verify usage percentages match actual usage
   - Verify progress bars color correctly at thresholds

### 3.3 Database Verification

```sql
-- Check agency subscription state
SELECT id, name, subscription_tier, subscription_id, subscription_end, stripe_customer_id
FROM agencies WHERE slug = 'your-agency-slug';
```

### 3.4 Build Verification

```bash
# Go service
cd app/service-core && go build ./...

# SvelteKit
cd service-client && npm run build && npm run check
```

---

## Files Summary

### Go Service (service-core)

| File | Action |
|------|--------|
| `config/config.go` | Add 6 price ID fields + billing webhook secret |
| `storage/query/agency_billing.sql` | New file - billing queries |
| `migrations/009_add_stripe_customer.sql` | New migration |
| `domain/billing/service.go` | New file - billing service |
| `rest/billing_route.go` | New file - billing endpoints |
| `rest/router.go` | Register billing routes |
| `main.go` / `wire.go` | Wire up billing service |

### SvelteKit (service-client)

| File | Action |
|------|--------|
| `src/lib/api/billing.ts` | New file - API client |
| `src/routes/(app)/[agencySlug]/settings/billing/+page.server.ts` | New file |
| `src/routes/(app)/[agencySlug]/settings/billing/+page.svelte` | New file |
| `src/routes/(app)/[agencySlug]/settings/+layout.svelte` | Add nav item |

### Environment

| File | Action |
|------|--------|
| `.env` | Add 7 new Stripe variables |
| `.env.example` | Document new variables |

---

## Out of Scope (Future Enhancements)

- [ ] Proration on mid-cycle plan changes
- [ ] Dunning emails for failed payments
- [ ] Usage-based metering sync to Stripe
- [ ] Annual discount promotional codes
- [ ] Team seat add-ons
- [ ] Invoice PDF generation for subscription payments
- [ ] Subscription pause functionality

---

## Estimated Timeline

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Stripe Dashboard Setup | 30 min | None |
| Phase 1: Go Service | 4-6 hours | Stripe setup |
| Phase 2: SvelteKit Frontend | 3-4 hours | Phase 1 |
| Phase 3: Testing | 2-3 hours | Phase 2 |
| **Total** | **10-14 hours** | |

---

## Pattern: Idempotent Billing Status Endpoint

### Problem

After Stripe Checkout redirect, the database may not be updated yet because:
1. Webhooks are asynchronous and can be delayed
2. Local development may not have webhook forwarding running
3. Network issues can delay webhook delivery

This causes a race condition where the user sees their old tier after successful payment.

### Solution: Self-Healing Status Endpoint

The `GetBillingInfo` endpoint accepts an optional `sessionId` parameter. When provided, it:
1. Checks if the database already has the subscription
2. If not, queries Stripe directly for the session status
3. If the session is complete, syncs the subscription to the database
4. Returns the now-correct billing info

```
GET /api/v1/billing/info?agencyId=xxx&sessionId=cs_xxx
```

### Implementation

**Go Service (`domain/billing/service.go`):**

```go
func (s *Service) GetBillingInfo(ctx context.Context, agencyID uuid.UUID, sessionID string) (*BillingInfo, error) {
    // If sessionId provided, check Stripe and sync if DB is behind
    if sessionID != "" {
        if err := s.syncIfNeeded(ctx, agencyID, sessionID); err != nil {
            slog.Warn("Failed to sync from session", "error", err)
        }
    }

    // Now return DB data (which is now up-to-date)
    return s.store.GetAgencyBillingInfo(ctx, agencyID)
}

func (s *Service) syncIfNeeded(ctx context.Context, agencyID uuid.UUID, sessionID string) error {
    // Check if already synced
    info, _ := s.store.GetAgencyBillingInfo(ctx, agencyID)
    if info.SubscriptionID != "" {
        return nil  // Already has subscription, no sync needed
    }

    // Query Stripe for session status
    sess, err := checkout_session.Get(sessionID, &stripe.CheckoutSessionParams{
        Expand: []string{"subscription", "subscription.items.data.price"},
    })
    if err != nil || sess.Status != "complete" {
        return nil
    }

    // Sync to database
    return s.SyncSubscriptionFromSession(ctx, sessionID)
}
```

**SvelteKit (`+page.server.ts`):**

```typescript
export const load: PageServerLoad = async ({ url }) => {
    const sessionId = url.searchParams.get("session_id") || undefined;

    // Pass sessionId - endpoint auto-syncs if needed
    const billingInfo = await getBillingInfo({ sessionId });

    return { billingInfo };
};
```

### Benefits

1. **Self-healing**: Single endpoint that always returns correct data
2. **No race conditions**: Data is correct on first render after redirect
3. **Works without webhooks**: Syncs automatically on page load
4. **Idempotent**: Safe to call multiple times with same sessionId
5. **Simpler frontend**: No polling or manual sync calls needed

### When to Use This Pattern

- Any payment flow with async webhook updates
- Stripe Checkout → redirect → display updated state
- Any integration where external service updates are async
