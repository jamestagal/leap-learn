# Billing System Gotchas

*Updated: 2026-02-01*

## Webhook Race Conditions

**Problem:** After Stripe Checkout redirect, webhooks may not have updated the database yet.

**Wrong approach:**
- Polling with arbitrary delays
- Waiting for webhook with timeout
- Multiple frontend API calls (poll → sync → reload)

**Correct approach:** Use idempotent status endpoint that auto-syncs from Stripe if DB is behind.

## Local Development Webhooks

**Problem:** Stripe webhooks don't reach localhost by default.

**Solution:** Run Stripe CLI webhook forwarding:
```bash
stripe listen --forward-to localhost:4001/api/v1/billing/webhook
```

**Better solution:** Don't rely on webhooks for immediate UI updates - use idempotent sync pattern.

## SvelteKit $effect() Infinite Loops

**Problem:** Using `$derived` values for URL params inside `$effect()` causes infinite re-renders.

**Wrong:**
```typescript
let success = $derived(page.url.searchParams.get('success'));
$effect(() => {
    if (success) { /* triggers infinite loop */ }
});
```

**Correct:**
```typescript
let hasProcessed = $state(false);
$effect(() => {
    if (hasProcessed) return;
    const success = page.url.searchParams.get('success'); // read inside effect
    if (success) {
        hasProcessed = true;
        // handle...
    }
});
```

## Docker Container Restart

After modifying Go code, always restart the webkit-core container:
```bash
docker restart webkit-core
```

Hot reload via Air only works for file changes detected inside the container.

## Database Resets for Testing

Reset agency to free tier:
```bash
docker exec webkit-postgres psql -U postgres -d postgres -c "UPDATE agencies SET subscription_tier = 'free', subscription_id = '', subscription_end = NULL WHERE slug = 'agency-slug';"
```

## Missing Session ID in Redirect URL

**Problem:** After Stripe checkout, URL has `?success=true` but no `session_id` parameter.

**Cause:** The success URL in `CreateCheckoutSession` is missing the `{CHECKOUT_SESSION_ID}` placeholder.

**Wrong:**
```go
SuccessURL: stripe.String(fmt.Sprintf("%s/billing?success=true", baseURL))
```

**Correct:**
```go
SuccessURL: stripe.String(fmt.Sprintf("%s/billing?success=true&session_id={CHECKOUT_SESSION_ID}", baseURL))
```

The `{CHECKOUT_SESSION_ID}` is a Stripe placeholder that gets replaced with the actual session ID.

## Debugging Webhook Issues

**Problem:** Subscription updates aren't happening after checkout.

**How to diagnose:**
1. Check webkit-core logs for "Billing webhook received" entries
2. If missing, webhooks aren't reaching the server
3. For local dev, ensure Stripe CLI is running: `stripe listen --forward-to localhost:4001/api/v1/billing/webhook`

**Quick fix:** Use idempotent pattern - don't rely on webhooks for immediate UI updates.

## Sync Optimization

**Problem:** Unnecessary Stripe API calls when subscription already exists.

**Solution:** Always check DB first in `syncIfNeeded()`:
```go
func (s *Service) syncIfNeeded(ctx context.Context, agencyID uuid.UUID, sessionID string) error {
    // Check if already synced FIRST
    info, _ := s.store.GetAgencyBillingInfo(ctx, agencyID)
    if info.SubscriptionID != "" {
        return nil  // Already has subscription, skip Stripe call
    }
    // ... then query Stripe
}
```

## Verify Session Belongs to Agency

**Problem:** Malicious user could pass any session_id to sync another agency's subscription.

**Solution:** Always verify session metadata matches the requesting agency:
```go
if agencyIDStr, ok := sess.Metadata["agency_id"]; !ok || agencyIDStr != agencyID.String() {
    return nil  // Silently ignore - don't leak info
}
```
