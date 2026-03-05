# Specification: Real-Time AI Usage Management

## Goal
Implement Cloudflare Durable Objects for zero-latency credit verification before voice sessions, enabling real-time usage tracking with subscription plan enforcement while maintaining accurate billing records through asynchronous D1 database synchronization.

## User Stories
- As a subscriber, I want instant feedback when starting a practice session so I know immediately if I have credits remaining
- As a free user, I want to see my usage limits clearly so I understand when to upgrade

## Specific Requirements

**Durable Object: UserUsageObject**
- Create a Durable Object class that maintains per-user usage state in memory
- Store: userId, plan ('free'|'basic'|'pro'), minutesLimit, minutesUsed, periodStart, periodEnd, activeSession
- Implement `blockConcurrencyWhile` in constructor to rehydrate state from storage
- Use alarm API to sync to D1 every 30 seconds during active sessions
- Auto-detect stale sessions (no heartbeat for 10+ minutes) and clean them up

**Session Start API (POST /api/private/session/start)**
- Check credits via DO `hasCredits()` method before allowing session
- Create new session with UUID, track startTime and lastHeartbeat
- Return sessionId on success or error message if credits exhausted
- Log session start to `usage_sessions` table in D1
- Schedule first alarm for periodic sync

**Session Heartbeat API (POST /api/private/session/heartbeat)**
- Accept sessionId in request body
- Update lastHeartbeat timestamp and calculate minutesUsed
- Return current minutesUsed and minutesRemaining
- Include warning message when remaining minutes <= 5
- Validate session belongs to authenticated user

**Session End API (POST /api/private/session/end)**
- Calculate final minutes used (round up to nearest minute)
- Add session minutes to period total
- Clear activeSession state
- Trigger immediate sync to D1
- Update `usage_sessions` record with endedAt and end_reason

**Subscription Plan Enforcement**
- Free plan: 10 minutes/month
- Basic plan: 100 minutes/month at $15/month
- Pro plan: 500 minutes/month at $25/month
- Instant plan updates via DO `upgradePlan()` method when Polar webhook fires
- Automatic period reset when periodEnd date passes

**D1 Database Schema Extensions**
- Add `usage_periods` table: user_id, period_start, period_end, plan, minutes_used, minutes_limit, synced_at, version, archived
- Add `usage_sessions` table: id, user_id, started_at, ended_at, minutes_used, topic, difficulty, end_reason
- Add unique constraint on (user_id, period_start) for upsert operations
- Add indexes on user_id and started_at columns

**Polar Webhook Integration**
- Modify `handleWebhook.onSubscriptionUpdated` to call DO `upgradePlan()` or `downgradePlan()`
- Pass platform context from webhook endpoint to handler function
- Map Polar product metadata.plan to usage plan types ('free'|'basic'|'pro')
- Use internal API call pattern since SvelteKit Pages and DO live in separate workers
- Create `/api/internal/update-plan` endpoint in API worker for cross-worker DO access

**Usage Status API (GET /api/private/session/status)**
- Return current usage status from DO `getStatus()` method
- Include: plan, minutesUsed, minutesRemaining, minutesLimit, periodStart, periodEnd, hasActiveSession, percentUsed
- Initialize user with free plan if not yet initialized
- Auto-reset period if current date is past periodEnd

**Realtime Token Endpoint Update**
- Modify existing `/api/private/realtime-token` to verify active session exists
- Reject token requests if no active session (must call /session/start first)
- Reject token requests if minutesRemaining <= 0
- Include minutesRemaining in response for client awareness

**Usage Display UI Component**
- Create progress bar showing minutes used vs limit
- Display plan name and current period dates
- Show percentage used with color coding: green < 75%, amber 75-90%, red > 90%
- Display warning message when <= 5 minutes remaining
- Show "Upgrade Plan" link when credits exhausted

## Existing Code to Leverage

**Database Schema (`apps/web/src/lib/server/database/schema.ts`)**
- Existing `subscription` table already tracks Polar subscriptions with plan field
- Use same pattern for new `usage_periods` and `usage_sessions` tables
- Follow existing timestamp convention (integer mode: 'timestamp')
- Follow existing enum pattern for status fields

**Polar Webhook Handler (`apps/web/src/lib/server/utils/polar.ts`)**
- Existing `handleWebhook.onSubscriptionUpdated` handles subscription events
- Already maps `product.plan` from database for plan type
- Add DO update call after D1 update completes
- Use existing `getDb()` pattern for database access

**Realtime Token Endpoint (`apps/web/src/routes/api/private/realtime-token/+server.ts`)**
- Existing pattern for authenticated API endpoints
- Add session verification before token generation
- Use existing error handling pattern with SvelteKit `error()` function

**App Types (`apps/web/src/app.d.ts`)**
- Existing `App.Platform.env` interface has DB binding
- Add USER_USAGE DurableObjectNamespace binding type
- Existing `App.Locals` has session and user for auth checks

**API Worker (`apps/api/worker/index.ts`)**
- Existing pattern for handling REST endpoints
- Add Durable Object binding to wrangler.jsonc
- Create internal endpoint for cross-worker DO updates

## Out of Scope
- Metered/pay-per-use billing (credits are monthly allowance only)
- Overage charges when exceeding plan limits
- Real-time WebSocket updates for usage changes
- Admin dashboard for usage analytics
- Usage export or reporting features
- Rollover of unused minutes to next period
- Mid-cycle plan changes with prorated credits
- Multiple concurrent sessions per user
- Usage alerts via email or push notifications
- Historical usage graphs or trend analysis
