# Billing System Learnings

*Updated: 2026-02-01*

## Idempotent Billing Status Pattern

When implementing payment flows with async webhook updates, use the **idempotent status endpoint pattern**:

1. Accept optional `sessionId` parameter on status endpoints
2. If provided, check Stripe directly and sync to DB if behind
3. Return the now-correct data

This eliminates race conditions between checkout redirect and webhook processing.

**Why this pattern is best:**
- Server-side sync is simpler than client-side polling → sync → reload sequences
- Single endpoint that always returns truth
- Self-healing - works even if previous sync failed
- No frontend complexity - data is correct on first render

**Evolution of approaches tried:**
1. ❌ Wait for webhook with arbitrary delay - unreliable
2. ❌ Poll Stripe + call sync endpoint + reload - complex, race conditions
3. ✅ Idempotent endpoint with auto-sync - simple, robust

**Implementation:**
- `GetBillingInfo(ctx, agencyID, sessionID)` - auto-syncs if sessionID provided
- `syncIfNeeded()` - checks DB first, only queries Stripe if subscription missing
- Server-side load passes `session_id` from URL to endpoint
- Frontend just shows success toast - no API calls needed

**Files:**
- `app/service-core/domain/billing/service.go` - `syncIfNeeded()` helper
- `service-client/src/routes/(app)/[agencySlug]/settings/billing/+page.server.ts`
- `service-client/src/lib/api/billing.remote.ts`

## Stripe SDK Compatibility

The Stripe Go SDK v82 doesn't expose `CurrentPeriodEnd` directly on subscription structs. Use JSON marshaling to extract:

```go
subJSON, _ := json.Marshal(subscription)
var rawSub map[string]interface{}
_ = json.Unmarshal(subJSON, &rawSub)
if periodEnd, ok := rawSub["current_period_end"].(float64); ok {
    endDate = time.Unix(int64(periodEnd), 0)
}
```

## Success URL with Session ID

Stripe Checkout success URLs support the `{CHECKOUT_SESSION_ID}` placeholder:

```go
SuccessURL: stripe.String(fmt.Sprintf("%s/%s/settings/billing?success=true&session_id={CHECKOUT_SESSION_ID}", baseURL, agencySlug))
```

This is replaced by Stripe with the actual session ID on redirect.

---

## Phase 3: Remaining Work (Testing & Production)

*Added: 2026-02-04*

### 1. Stripe Dashboard Setup

Create products and prices in Stripe Dashboard (Test mode first, then Production):

| Product | Monthly Price | Yearly Price |
|---------|---------------|--------------|
| WebKit Starter | $29/mo | $290/yr |
| WebKit Growth | $79/mo | $790/yr |
| WebKit Enterprise | $199/mo | $1,990/yr |

After creating, copy the price IDs (e.g., `price_xxx`).

### 2. Environment Variables

Add to `.env` (service-core) with real Stripe price IDs:

```bash
STRIPE_PRICE_STARTER_MONTHLY=price_xxx
STRIPE_PRICE_STARTER_YEARLY=price_xxx
STRIPE_PRICE_GROWTH_MONTHLY=price_xxx
STRIPE_PRICE_GROWTH_YEARLY=price_xxx
STRIPE_PRICE_ENTERPRISE_MONTHLY=price_xxx
STRIPE_PRICE_ENTERPRISE_YEARLY=price_xxx
STRIPE_BILLING_WEBHOOK_SECRET=whsec_xxx
```

### 3. Configure Webhook Endpoint (Stripe Dashboard)

In Stripe Dashboard → Webhooks → Add endpoint:
- **URL:** `https://api.webkit.au/api/v1/billing/webhook`
- **Events to send:**
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_succeeded`
  - `invoice.payment_failed`

Copy the webhook signing secret to `STRIPE_BILLING_WEBHOOK_SECRET`.

### 4. Local Testing

```bash
# Terminal 1: Start services
docker compose up

# Terminal 2: Forward Stripe webhooks to local
stripe listen --forward-to localhost:4001/api/v1/billing/webhook

# Terminal 3: Test webhook events
stripe trigger checkout.session.completed
stripe trigger customer.subscription.updated
stripe trigger customer.subscription.deleted
```

### 5. End-to-End Test Flow

1. Navigate to `/{agencySlug}/settings/billing`
2. Select "Starter" plan, click "Upgrade"
3. Complete checkout with test card `4242 4242 4242 4242`
4. Verify redirect back with `?success=true&session_id=cs_xxx`
5. Verify agency `subscription_tier` updated in database
6. Test "Manage Billing" portal access
7. Test subscription cancellation flow

### 6. Database Verification

```sql
SELECT id, name, subscription_tier, subscription_id, subscription_end, stripe_customer_id
FROM agencies WHERE slug = 'your-agency-slug';
```

### 7. Production Deployment Checklist

- [ ] Create Stripe products/prices in Production mode
- [ ] Add production price IDs to production env
- [ ] Configure production webhook endpoint in Stripe
- [ ] Run migration on production: `VPS_HOST=x.x.x.x VPS_USER=root sh scripts/run_migrations.sh production`
- [ ] Restart webkit-core service
- [ ] Test with real card (can refund immediately)
