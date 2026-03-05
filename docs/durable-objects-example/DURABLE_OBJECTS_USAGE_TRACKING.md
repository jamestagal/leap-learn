# Durable Objects Usage Tracking Implementation Plan

## Speak Phở Real - Real-Time AI Usage Management

> **Document Version:** 1.2
> **Last Updated:** December 2024
> **Status:** Implementation Ready
> **Payment Gateway:** Polar.sh (Primary) - See [POLAR_WEBHOOK_DO_INTEGRATION.md](./POLAR_WEBHOOK_DO_INTEGRATION.md)
> **Session Health & Learning History:** See [SESSION_HEALTH_AND_LEARNING_HISTORY.md](./SESSION_HEALTH_AND_LEARNING_HISTORY.md)

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Problem Statement](#problem-statement)
3. [Architecture Overview](#architecture-overview)
4. [Durable Object Design](#durable-object-design)
5. [D1 Schema Migrations](#d1-schema-migrations)
6. [Implementation Details](#implementation-details)
7. [API Routes](#api-routes)
8. [Frontend Integration](#frontend-integration)
9. [Subscription Plans](#subscription-plans)
10. [Testing Strategy](#testing-strategy)
11. [Deployment Checklist](#deployment-checklist)
12. [Cost Analysis](#cost-analysis)

---

## Executive Summary

This document outlines the implementation of Cloudflare Durable Objects for real-time usage tracking in the Speak Phở Real Vietnamese language coaching app. The primary goal is to enable **zero-latency credit verification** before voice sessions while maintaining accurate billing records through asynchronous database synchronization.

### Key Benefits

| Benefit | Impact |
|---------|--------|
| **Instant credit checks** | User clicks "Start" → immediate yes/no (no DB round-trip) |
| **Real-time session tracking** | Track minutes during active sessions without latency |
| **Async billing sync** | Alarm syncs to D1 every 30s; user never waits |
| **Geographic optimization** | DO instances live near users for low latency |
| **Session recovery** | State persists if browser crashes |
| **Plan enforcement** | Instant upgrade/downgrade reflection |

---

## Problem Statement

### The Challenge

OpenAI's Realtime API costs approximately **$0.30/minute**:
- Audio Input: $0.06/min
- Audio Output: $0.24/min


For a subscription-based app targeting a $15-25/month budget per user, we need to:

1. **Verify credits instantly** before allowing expensive API calls
2. **Track usage in real-time** during active sessions
3. **Enforce plan limits** without degrading user experience
4. **Sync to billing system** without blocking user interactions

### Why Traditional Database Lookups Fail

```
Traditional Flow (High Latency):
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│  User   │───▶│ Worker  │───▶│   D1    │───▶│ OpenAI  │
│ Request │    │         │◀───│ (300ms) │    │ Realtime│
└─────────┘    └─────────┘    └─────────┘    └─────────┘
                   │
                   ▼
            Total: 400-600ms before session starts
```

With Durable Objects, credit checks happen in **<10ms** because the state lives in memory.

---

## Architecture Overview

### High-Level Flow

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          Browser (SvelteKit)                              │
│                                                                           │
│   1. User clicks "Start Practice"                                         │
│   2. POST /api/session/start → Check credits & reserve session            │
│   3. If approved: Connect to OpenAI Realtime API                          │
│   4. During session: Periodic heartbeats update usage                     │
│   5. POST /api/session/end → Finalize usage, release session              │
└───────────────────────────────────┬──────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                       Cloudflare Worker (API)                             │
│                                                                           │
│   /api/session/start  ───────▶  UserUsageObject.startSession()           │
│   /api/session/heartbeat ────▶  UserUsageObject.updateUsage()            │
│   /api/session/end    ───────▶  UserUsageObject.endSession()             │
│   /api/usage/status   ───────▶  UserUsageObject.getStatus()              │
│   /api/realtime-token ───────▶  Token generation (existing)              │
└───────────────────────────────────┬──────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                    Durable Object: UserUsageObject                        │
│                         (One instance per user)                           │
│                                                                           │
│   In-Memory State (instant access):                                       │
│   ├── userId: string                                                      │
│   ├── plan: 'free' | 'basic' | 'pro'                                     │
│   ├── minutesLimit: number (monthly allowance)                           │
│   ├── minutesUsed: number (this billing period)                          │
│   ├── periodStart: ISO date string                                       │
│   ├── activeSession: { id, startTime, lastHeartbeat } | null             │
│   └── pendingSync: boolean                                                │
│                                                                           │
│   Methods:                                                                │
│   ├── hasCredits() → { allowed: boolean, remaining: number }             │
│   ├── startSession() → { sessionId } | { error }                         │
│   ├── updateUsage(minutes) → void                                         │
│   ├── endSession(sessionId) → { minutesUsed }                            │
│   ├── getStatus() → UsageStatus                                          │
│   ├── upgradePlan(plan) → void                                           │
│   └── resetPeriod() → void                                                │
│                                                                           │
│   Alarm (every 30s during active session):                               │
│   └── syncToDatabase() → Push usage to D1 asynchronously                 │
└───────────────────────────────────┬──────────────────────────────────────┘
                                    │
                                    ▼ (async via Alarm, never blocks user)
┌──────────────────────────────────────────────────────────────────────────┐
│                              D1 Database                                  │
│                                                                           │
│   Tables:                                                                 │
│   ├── subscriptions (plan info, limits, billing dates)                   │
│   ├── usage_periods (monthly usage records)                              │
│   ├── usage_sessions (individual session logs)                           │
│   └── usage_sync_log (audit trail of DO → D1 syncs)                      │
└──────────────────────────────────────────────────────────────────────────┘
```


### Why Durable Objects Are Perfect for This

| Feature | How It Helps |
|---------|--------------|
| **In-memory state** | Credit checks are O(1) memory access, not database queries |
| **Single-threaded execution** | No race conditions when checking/updating credits |
| **Persistent storage** | State survives restarts; constructor rehydrates from storage |
| **Alarm API** | Schedule async database syncs without blocking user |
| **Geographic proximity** | DO instantiates near the user/worker for minimal latency |
| **WebSocket support** | Future: Could track usage via persistent connection |

---

## Durable Object Design

### UserUsageObject Class

This is the core Durable Object that manages per-user usage state.

```typescript
// packages/data-ops/src/durable-objects/UserUsageObject.ts

import { DurableObject } from 'cloudflare:workers';

// ════════════════════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ════════════════════════════════════════════════════════════════════════════

export type PlanType = 'free' | 'basic' | 'pro';

export interface ActiveSession {
  id: string;
  startTime: number;      // Unix timestamp (ms)
  lastHeartbeat: number;  // Unix timestamp (ms)
  minutesUsed: number;    // Running total for this session
}

export interface UsageState {
  userId: string;
  plan: PlanType;
  minutesLimit: number;          // Monthly limit based on plan
  minutesUsed: number;           // Total used this billing period
  periodStart: string;           // ISO date (YYYY-MM-DD)
  periodEnd: string;             // ISO date (YYYY-MM-DD)
  activeSession: ActiveSession | null;
  lastSyncedAt: string | null;   // ISO timestamp of last D1 sync
  version: number;               // For optimistic concurrency
}

export interface UsageStatus {
  plan: PlanType;
  minutesUsed: number;
  minutesRemaining: number;
  minutesLimit: number;
  periodStart: string;
  periodEnd: string;
  hasActiveSession: boolean;
  activeSessionMinutes: number;
  percentUsed: number;
}

export interface SessionResult {
  sessionId?: string;
  error?: string;
  minutesUsed?: number;
}

// ════════════════════════════════════════════════════════════════════════════
// PLAN CONFIGURATION
// ════════════════════════════════════════════════════════════════════════════

export const PLAN_CONFIG: Record<PlanType, { minutes: number; price: number }> = {
  free: { minutes: 10, price: 0 },       // 10 minutes/month trial
  basic: { minutes: 100, price: 15 },    // 100 minutes/month @ $15
  pro: { minutes: 500, price: 25 },      // 500 minutes/month @ $25
};

// ════════════════════════════════════════════════════════════════════════════
// DURABLE OBJECT CLASS
// ════════════════════════════════════════════════════════════════════════════

export class UserUsageObject extends DurableObject<Env> {
  private state: UsageState | null = null;
  private initialized = false;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    
    // Block concurrent requests until state is loaded from storage
    ctx.blockConcurrencyWhile(async () => {
      const stored = await ctx.storage.get<UsageState>('state');
      if (stored) {
        this.state = stored;
        this.initialized = true;
      }
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // INITIALIZATION (called when user signs up or first uses voice features)
  // ══════════════════════════════════════════════════════════════════════════

  async initialize(userId: string, plan: PlanType = 'free'): Promise<UsageStatus> {
    const now = new Date();
    const periodStart = this.getMonthStart(now);
    const periodEnd = this.getMonthEnd(now);

    this.state = {
      userId,
      plan,
      minutesLimit: PLAN_CONFIG[plan].minutes,
      minutesUsed: 0,
      periodStart,
      periodEnd,
      activeSession: null,
      lastSyncedAt: null,
      version: 1,
    };

    await this.persist();
    this.initialized = true;

    return this.getStatus();
  }

  // ══════════════════════════════════════════════════════════════════════════
  // CREDIT CHECKING (zero latency - in-memory only!)
  // ══════════════════════════════════════════════════════════════════════════

  async hasCredits(): Promise<{ allowed: boolean; remaining: number; reason?: string }> {
    if (!this.initialized || !this.state) {
      return { allowed: false, remaining: 0, reason: 'User not initialized' };
    }

    // Check if billing period needs reset
    await this.maybeResetPeriod();

    // Calculate remaining (including any active session usage)
    const activeMinutes = this.state.activeSession?.minutesUsed ?? 0;
    const totalUsed = this.state.minutesUsed + activeMinutes;
    const remaining = Math.max(0, this.state.minutesLimit - totalUsed);

    if (remaining <= 0) {
      return { 
        allowed: false, 
        remaining: 0, 
        reason: `Monthly limit reached (${this.state.minutesLimit} minutes on ${this.state.plan} plan)` 
      };
    }

    return { allowed: true, remaining };
  }


  // ══════════════════════════════════════════════════════════════════════════
  // SESSION MANAGEMENT
  // ══════════════════════════════════════════════════════════════════════════

  async startSession(): Promise<SessionResult> {
    // Verify credits first
    const { allowed, remaining, reason } = await this.hasCredits();
    
    if (!allowed) {
      return { error: reason ?? 'No credits available' };
    }

    // Check for existing active session
    if (this.state!.activeSession) {
      // Check if it's a stale session (no heartbeat for 5+ minutes)
      const lastHeartbeat = this.state!.activeSession.lastHeartbeat;
      const staleThreshold = 5 * 60 * 1000; // 5 minutes
      
      if (Date.now() - lastHeartbeat > staleThreshold) {
        // Auto-end stale session
        await this.endSession(this.state!.activeSession.id);
      } else {
        return { error: 'Session already active. End current session first.' };
      }
    }

    // Create new session
    const sessionId = crypto.randomUUID();
    const now = Date.now();

    this.state!.activeSession = {
      id: sessionId,
      startTime: now,
      lastHeartbeat: now,
      minutesUsed: 0,
    };

    await this.persist();

    // Schedule periodic sync alarm (every 30 seconds)
    await this.ctx.storage.setAlarm(Date.now() + 30_000);

    return { sessionId };
  }

  async heartbeat(sessionId: string): Promise<{ minutesUsed: number; remaining: number } | { error: string }> {
    if (!this.state?.activeSession || this.state.activeSession.id !== sessionId) {
      return { error: 'No active session with this ID' };
    }

    const now = Date.now();
    const session = this.state.activeSession;
    
    // Calculate minutes since session start
    const elapsedMs = now - session.startTime;
    const minutesUsed = Math.ceil(elapsedMs / 60_000);

    // Update session
    session.lastHeartbeat = now;
    session.minutesUsed = minutesUsed;

    // Check if we've hit the limit
    const totalUsed = this.state.minutesUsed + minutesUsed;
    const remaining = Math.max(0, this.state.minutesLimit - totalUsed);

    await this.persist();

    // Return warning if running low
    return { minutesUsed, remaining };
  }

  async endSession(sessionId: string): Promise<SessionResult> {
    if (!this.state) {
      return { error: 'User not initialized' };
    }

    // If no active session or wrong session ID, return gracefully
    if (!this.state.activeSession || this.state.activeSession.id !== sessionId) {
      return { minutesUsed: 0 };
    }

    const session = this.state.activeSession;
    
    // Calculate final usage (round up to nearest minute)
    const elapsedMs = Date.now() - session.startTime;
    const minutesUsed = Math.max(1, Math.ceil(elapsedMs / 60_000));

    // Add to period total
    this.state.minutesUsed += minutesUsed;
    this.state.activeSession = null;
    this.state.version++;

    await this.persist();

    // Immediate sync on session end (important for billing accuracy)
    await this.syncToDatabase();

    return { minutesUsed };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // STATUS & REPORTING
  // ══════════════════════════════════════════════════════════════════════════

  async getStatus(): Promise<UsageStatus> {
    if (!this.state) {
      throw new Error('User not initialized');
    }

    await this.maybeResetPeriod();

    const activeMinutes = this.state.activeSession?.minutesUsed ?? 0;
    const totalUsed = this.state.minutesUsed + activeMinutes;
    const remaining = Math.max(0, this.state.minutesLimit - totalUsed);
    const percentUsed = Math.round((totalUsed / this.state.minutesLimit) * 100);

    return {
      plan: this.state.plan,
      minutesUsed: totalUsed,
      minutesRemaining: remaining,
      minutesLimit: this.state.minutesLimit,
      periodStart: this.state.periodStart,
      periodEnd: this.state.periodEnd,
      hasActiveSession: !!this.state.activeSession,
      activeSessionMinutes: activeMinutes,
      percentUsed: Math.min(100, percentUsed),
    };
  }


  // ══════════════════════════════════════════════════════════════════════════
  // PLAN MANAGEMENT (called from Stripe webhook or admin)
  // ══════════════════════════════════════════════════════════════════════════

  async upgradePlan(newPlan: PlanType, resetUsage = false): Promise<UsageStatus> {
    if (!this.state) {
      throw new Error('User not initialized');
    }

    const oldPlan = this.state.plan;
    
    this.state.plan = newPlan;
    this.state.minutesLimit = PLAN_CONFIG[newPlan].minutes;
    
    // Optionally reset usage on upgrade (business decision)
    if (resetUsage) {
      this.state.minutesUsed = 0;
      const now = new Date();
      this.state.periodStart = this.getMonthStart(now);
      this.state.periodEnd = this.getMonthEnd(now);
    }

    this.state.version++;
    await this.persist();

    // Sync plan change to database immediately
    await this.syncToDatabase();

    console.log(`Plan upgraded: ${oldPlan} → ${newPlan} for user ${this.state.userId}`);

    return this.getStatus();
  }

  async downgradePlan(newPlan: PlanType): Promise<UsageStatus> {
    // Downgrade takes effect at next billing period
    // For now, just update the plan (usage persists)
    return this.upgradePlan(newPlan, false);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ALARM HANDLER (async database sync)
  // ══════════════════════════════════════════════════════════════════════════

  async alarm(): Promise<void> {
    console.log(`[Alarm] Triggered for user ${this.state?.userId}`);

    // Sync current state to D1 database
    await this.syncToDatabase();

    // If session still active, schedule next sync
    if (this.state?.activeSession) {
      // Check for stale session (no heartbeat for 10+ minutes)
      const lastHeartbeat = this.state.activeSession.lastHeartbeat;
      const staleThreshold = 10 * 60 * 1000; // 10 minutes

      if (Date.now() - lastHeartbeat > staleThreshold) {
        // Auto-end stale session (user probably closed browser)
        console.log(`[Alarm] Auto-ending stale session for user ${this.state.userId}`);
        await this.endSession(this.state.activeSession.id);
      } else {
        // Schedule next sync in 30 seconds
        await this.ctx.storage.setAlarm(Date.now() + 30_000);
      }
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PRIVATE HELPERS
  // ══════════════════════════════════════════════════════════════════════════

  private async persist(): Promise<void> {
    await this.ctx.storage.put('state', this.state);
  }

  private async maybeResetPeriod(): Promise<void> {
    if (!this.state) return;

    const now = new Date();
    const periodEnd = new Date(this.state.periodEnd);

    // If we're past the period end date, reset for new period
    if (now > periodEnd) {
      console.log(`[Period Reset] New billing period for user ${this.state.userId}`);
      
      // Archive old period usage before reset
      await this.archivePeriodUsage();

      this.state.minutesUsed = 0;
      this.state.periodStart = this.getMonthStart(now);
      this.state.periodEnd = this.getMonthEnd(now);
      this.state.version++;

      await this.persist();
    }
  }

  private async syncToDatabase(): Promise<void> {
    if (!this.state) return;

    const now = new Date().toISOString();

    try {
      // Upsert usage period record
      await this.env.DB.prepare(`
        INSERT INTO usage_periods (
          user_id, period_start, period_end, plan, 
          minutes_used, minutes_limit, synced_at, version
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (user_id, period_start) DO UPDATE SET
          minutes_used = excluded.minutes_used,
          minutes_limit = excluded.minutes_limit,
          plan = excluded.plan,
          synced_at = excluded.synced_at,
          version = excluded.version
      `).bind(
        this.state.userId,
        this.state.periodStart,
        this.state.periodEnd,
        this.state.plan,
        this.state.minutesUsed,
        this.state.minutesLimit,
        now,
        this.state.version
      ).run();

      this.state.lastSyncedAt = now;

      console.log(`[Sync] Usage synced to D1 for user ${this.state.userId}`);
    } catch (error) {
      console.error(`[Sync Error] Failed to sync for user ${this.state.userId}:`, error);
      // Don't throw - we don't want sync failures to break user experience
    }
  }

  private async archivePeriodUsage(): Promise<void> {
    if (!this.state) return;

    try {
      // Final sync of the completed period
      await this.env.DB.prepare(`
        INSERT INTO usage_periods (
          user_id, period_start, period_end, plan,
          minutes_used, minutes_limit, synced_at, version, archived
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
        ON CONFLICT (user_id, period_start) DO UPDATE SET
          minutes_used = excluded.minutes_used,
          archived = 1,
          synced_at = excluded.synced_at
      `).bind(
        this.state.userId,
        this.state.periodStart,
        this.state.periodEnd,
        this.state.plan,
        this.state.minutesUsed,
        this.state.minutesLimit,
        new Date().toISOString(),
        this.state.version
      ).run();
    } catch (error) {
      console.error(`[Archive Error] Failed to archive period:`, error);
    }
  }

  private getMonthStart(date: Date): string {
    return new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0];
  }

  private getMonthEnd(date: Date): string {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split('T')[0];
  }
}
```


---

## D1 Schema Migrations

### New Tables for Usage Tracking

Add these to your existing schema in `packages/data-ops/src/db/schema.ts`:

```typescript
// packages/data-ops/src/db/schema.ts

import { sqliteTable, text, integer, real, index, uniqueIndex } from "drizzle-orm/sqlite-core";

// ════════════════════════════════════════════════════════════════════════════
// EXISTING TABLES (keep as-is)
// ════════════════════════════════════════════════════════════════════════════

export const conversations = sqliteTable("conversations", { /* ... existing ... */ });
export const conversationMessages = sqliteTable("conversation_messages", { /* ... existing ... */ });
export const learningProgress = sqliteTable("learning_progress", { /* ... existing ... */ });

// ════════════════════════════════════════════════════════════════════════════
// NEW: SUBSCRIPTION & USAGE TABLES
// ════════════════════════════════════════════════════════════════════════════

/**
 * Subscriptions table - links users to their plan
 * This is the source of truth for billing; DO reads from here on init
 */
export const subscriptions = sqliteTable("subscriptions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().unique(),
  
  // Plan info
  plan: text("plan", { enum: ["free", "basic", "pro"] }).notNull().default("free"),
  status: text("status", { 
    enum: ["active", "cancelled", "past_due", "trialing"] 
  }).notNull().default("active"),
  
  // Stripe integration
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  stripePriceId: text("stripe_price_id"),
  
  // Billing dates
  currentPeriodStart: text("current_period_start").notNull(), // ISO date
  currentPeriodEnd: text("current_period_end").notNull(),     // ISO date
  cancelAtPeriodEnd: integer("cancel_at_period_end", { mode: "boolean" }).default(false),
  
  // Timestamps
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
}, (table) => ({
  userIdIdx: index("subscriptions_user_id_idx").on(table.userId),
  stripeCustomerIdx: index("subscriptions_stripe_customer_idx").on(table.stripeCustomerId),
}));

/**
 * Usage periods - monthly usage records synced from Durable Objects
 * This is the billing record used for invoicing and analytics
 */
export const usagePeriods = sqliteTable("usage_periods", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  
  // Period info
  periodStart: text("period_start").notNull(), // YYYY-MM-DD
  periodEnd: text("period_end").notNull(),     // YYYY-MM-DD
  
  // Plan at time of usage
  plan: text("plan", { enum: ["free", "basic", "pro"] }).notNull(),
  
  // Usage metrics
  minutesUsed: integer("minutes_used").notNull().default(0),
  minutesLimit: integer("minutes_limit").notNull(),
  
  // Sync metadata
  syncedAt: text("synced_at"),     // ISO timestamp of last DO sync
  version: integer("version").notNull().default(1),
  archived: integer("archived", { mode: "boolean" }).default(false),
  
  // Timestamps
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
}, (table) => ({
  // Unique constraint for upsert operations
  userPeriodUnique: uniqueIndex("usage_periods_user_period_unique")
    .on(table.userId, table.periodStart),
  userIdIdx: index("usage_periods_user_id_idx").on(table.userId),
}));

/**
 * Usage sessions - individual voice session logs
 * Detailed audit trail for support and analytics
 *
 * NOTE: This table is EXTENDED in SESSION_HEALTH_AND_LEARNING_HISTORY.md with:
 * - provider, initial_provider, provider_switched_at (provider tracking)
 * - disconnect_code, disconnect_reason (disconnect tracking)
 * - mode, message_count (session details)
 *
 * Related tables defined in SESSION_HEALTH_AND_LEARNING_HISTORY.md:
 * - session_messages (conversation history for user review)
 * - session_corrections (learning items from coach mode)
 */
export const usageSessions = sqliteTable("usage_sessions", {
  id: text("id").primaryKey(), // Same as session ID from DO
  userId: text("user_id").notNull(),

  // Session timing
  startedAt: integer("started_at", { mode: "timestamp" }).notNull(),
  endedAt: integer("ended_at", { mode: "timestamp" }),

  // Usage
  minutesUsed: integer("minutes_used").notNull().default(0),

  // Context
  topic: text("topic"),
  difficulty: text("difficulty", { enum: ["beginner", "intermediate", "advanced"] }),

  // Metadata
  endReason: text("end_reason", {
    enum: ["user_ended", "limit_reached", "timeout", "error", "stale"]
  }),

  // Link to conversation if we're storing transcripts
  conversationId: text("conversation_id").references(() => conversations.id),
}, (table) => ({
  userIdIdx: index("usage_sessions_user_id_idx").on(table.userId),
  startedAtIdx: index("usage_sessions_started_at_idx").on(table.startedAt),
}));

/**
 * Usage sync log - audit trail of DO → D1 synchronizations
 * Useful for debugging and reconciliation
 */
export const usageSyncLog = sqliteTable("usage_sync_log", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  
  // Sync details
  syncType: text("sync_type", { 
    enum: ["periodic", "session_end", "period_reset", "manual"] 
  }).notNull(),
  minutesAtSync: integer("minutes_at_sync").notNull(),
  version: integer("version").notNull(),
  
  // Timestamp
  syncedAt: integer("synced_at", { mode: "timestamp" }).notNull(),
}, (table) => ({
  userIdIdx: index("usage_sync_log_user_id_idx").on(table.userId),
  syncedAtIdx: index("usage_sync_log_synced_at_idx").on(table.syncedAt),
}));

// ════════════════════════════════════════════════════════════════════════════
// TYPE EXPORTS
// ════════════════════════════════════════════════════════════════════════════

export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;

export type UsagePeriod = typeof usagePeriods.$inferSelect;
export type NewUsagePeriod = typeof usagePeriods.$inferInsert;

export type UsageSession = typeof usageSessions.$inferSelect;
export type NewUsageSession = typeof usageSessions.$inferInsert;

export type UsageSyncLog = typeof usageSyncLog.$inferSelect;
export type NewUsageSyncLog = typeof usageSyncLog.$inferInsert;
```


### Raw SQL Migration

Create this migration file: `packages/data-ops/migrations/0002_add_usage_tracking.sql`

```sql
-- Migration: Add Usage Tracking Tables
-- Date: 2024-12
-- Description: Adds subscriptions and usage tracking for voice coaching sessions

-- ════════════════════════════════════════════════════════════════════════════
-- SUBSCRIPTIONS TABLE
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  
  -- Plan info
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'basic', 'pro')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'past_due', 'trialing')),
  
  -- Stripe integration
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  stripe_price_id TEXT,
  
  -- Billing dates
  current_period_start TEXT NOT NULL,
  current_period_end TEXT NOT NULL,
  cancel_at_period_end INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS subscriptions_user_id_idx ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS subscriptions_stripe_customer_idx ON subscriptions(stripe_customer_id);

-- ════════════════════════════════════════════════════════════════════════════
-- USAGE PERIODS TABLE
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS usage_periods (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  
  -- Period info
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  
  -- Plan at time of usage
  plan TEXT NOT NULL CHECK (plan IN ('free', 'basic', 'pro')),
  
  -- Usage metrics
  minutes_used INTEGER NOT NULL DEFAULT 0,
  minutes_limit INTEGER NOT NULL,
  
  -- Sync metadata
  synced_at TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  archived INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at INTEGER NOT NULL,
  
  -- Unique constraint for upsert
  UNIQUE(user_id, period_start)
);

CREATE INDEX IF NOT EXISTS usage_periods_user_id_idx ON usage_periods(user_id);

-- ════════════════════════════════════════════════════════════════════════════
-- USAGE SESSIONS TABLE
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS usage_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  
  -- Session timing
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  
  -- Usage
  minutes_used INTEGER NOT NULL DEFAULT 0,
  
  -- Context
  topic TEXT,
  difficulty TEXT CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
  
  -- Metadata
  end_reason TEXT CHECK (end_reason IN ('user_ended', 'limit_reached', 'timeout', 'error', 'stale')),
  
  -- Link to conversation
  conversation_id TEXT REFERENCES conversations(id)
);

CREATE INDEX IF NOT EXISTS usage_sessions_user_id_idx ON usage_sessions(user_id);
CREATE INDEX IF NOT EXISTS usage_sessions_started_at_idx ON usage_sessions(started_at);

-- ════════════════════════════════════════════════════════════════════════════
-- USAGE SYNC LOG TABLE
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS usage_sync_log (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  
  -- Sync details
  sync_type TEXT NOT NULL CHECK (sync_type IN ('periodic', 'session_end', 'period_reset', 'manual')),
  minutes_at_sync INTEGER NOT NULL,
  version INTEGER NOT NULL,
  
  -- Timestamp
  synced_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS usage_sync_log_user_id_idx ON usage_sync_log(user_id);
CREATE INDEX IF NOT EXISTS usage_sync_log_synced_at_idx ON usage_sync_log(synced_at);
```

### Running Migrations

```bash
# From project root
cd packages/data-ops

# Generate migration from schema (if using Drizzle Kit)
pnpm drizzle-kit generate

# Or apply raw SQL migration
pnpm wrangler d1 execute viet-coach-db --file=./migrations/0002_add_usage_tracking.sql

# For local development
pnpm wrangler d1 execute viet-coach-db --file=./migrations/0002_add_usage_tracking.sql --local
```


---

## API Routes

### Worker Configuration Update

Update `apps/api/wrangler.jsonc`:

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "viet-coach-api",
  "main": "worker/index.ts",
  "compatibility_date": "2025-06-17",
  "compatibility_flags": ["nodejs_compat"],
  "observability": {
    "enabled": true
  },
  
  // D1 Database binding
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "viet-coach-db",
      "database_id": "your-database-id-here"
    }
  ],
  
  // Durable Objects binding
  "durable_objects": {
    "bindings": [
      {
        "name": "USER_USAGE",
        "class_name": "UserUsageObject"
      }
    ]
  },
  
  // Migrations for Durable Objects
  "migrations": [
    {
      "tag": "v1",
      "new_classes": ["UserUsageObject"]
    }
  ]
}
```

### Environment Type Definition

Update `apps/api/worker-configuration.d.ts`:

```typescript
// apps/api/worker-configuration.d.ts

interface Env {
  // D1 Database
  DB: D1Database;
  
  // Durable Objects
  USER_USAGE: DurableObjectNamespace<import('@repo/data-ops').UserUsageObject>;
  
  // Secrets
  OPENAI_API_KEY: string;
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  
  // Other bindings...
}
```

### Session Management Routes

Create `apps/api/worker/routes/session.ts`:

```typescript
// apps/api/worker/routes/session.ts

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

const app = new Hono<{ Bindings: Env }>();

// ════════════════════════════════════════════════════════════════════════════
// MIDDLEWARE: Get authenticated user ID
// ════════════════════════════════════════════════════════════════════════════

const requireAuth = async (c: any, next: () => Promise<void>) => {
  // Integrate with your auth system (better-auth)
  const session = c.get('session');
  if (!session?.userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  await next();
};

// ════════════════════════════════════════════════════════════════════════════
// GET /api/session/status - Check usage status
// ════════════════════════════════════════════════════════════════════════════

app.get('/status', requireAuth, async (c) => {
  const userId = c.get('session').userId;
  
  try {
    const id = c.env.USER_USAGE.idFromName(userId);
    const stub = c.env.USER_USAGE.get(id);
    
    const status = await stub.getStatus();
    
    return c.json({
      success: true,
      data: status,
    });
  } catch (error) {
    // User might not be initialized yet
    return c.json({
      success: true,
      data: {
        plan: 'free',
        minutesUsed: 0,
        minutesRemaining: 10,
        minutesLimit: 10,
        hasActiveSession: false,
        percentUsed: 0,
      },
    });
  }
});

// ════════════════════════════════════════════════════════════════════════════
// POST /api/session/start - Start a voice practice session
// ════════════════════════════════════════════════════════════════════════════

const startSessionSchema = z.object({
  topic: z.string().optional().default('general'),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional().default('intermediate'),
});

app.post('/start', requireAuth, zValidator('json', startSessionSchema), async (c) => {
  const userId = c.get('session').userId;
  const { topic, difficulty } = c.req.valid('json');
  
  const id = c.env.USER_USAGE.idFromName(userId);
  const stub = c.env.USER_USAGE.get(id);
  
  // Check if user is initialized, initialize if not
  try {
    await stub.getStatus();
  } catch {
    // Initialize with free plan
    await stub.initialize(userId, 'free');
  }
  
  // Attempt to start session
  const result = await stub.startSession();
  
  if (result.error) {
    return c.json({
      success: false,
      error: result.error,
    }, 403);
  }
  
  // Log session start to D1
  const sessionId = result.sessionId!;
  await c.env.DB.prepare(`
    INSERT INTO usage_sessions (id, user_id, started_at, topic, difficulty)
    VALUES (?, ?, ?, ?, ?)
  `).bind(
    sessionId,
    userId,
    Date.now(),
    topic,
    difficulty
  ).run();
  
  return c.json({
    success: true,
    data: {
      sessionId,
      message: 'Session started successfully',
    },
  });
});


// ════════════════════════════════════════════════════════════════════════════
// POST /api/session/heartbeat - Update session usage
// ════════════════════════════════════════════════════════════════════════════

const heartbeatSchema = z.object({
  sessionId: z.string().uuid(),
});

app.post('/heartbeat', requireAuth, zValidator('json', heartbeatSchema), async (c) => {
  const userId = c.get('session').userId;
  const { sessionId } = c.req.valid('json');
  
  const id = c.env.USER_USAGE.idFromName(userId);
  const stub = c.env.USER_USAGE.get(id);
  
  const result = await stub.heartbeat(sessionId);
  
  if ('error' in result) {
    return c.json({
      success: false,
      error: result.error,
    }, 400);
  }
  
  // Warn if running low on credits
  const warning = result.remaining <= 5 
    ? `Warning: Only ${result.remaining} minutes remaining`
    : null;
  
  return c.json({
    success: true,
    data: {
      minutesUsed: result.minutesUsed,
      minutesRemaining: result.remaining,
      warning,
    },
  });
});

// ════════════════════════════════════════════════════════════════════════════
// POST /api/session/end - End a voice practice session
// ════════════════════════════════════════════════════════════════════════════

const endSessionSchema = z.object({
  sessionId: z.string().uuid(),
  conversationId: z.string().optional(),
});

app.post('/end', requireAuth, zValidator('json', endSessionSchema), async (c) => {
  const userId = c.get('session').userId;
  const { sessionId, conversationId } = c.req.valid('json');
  
  const id = c.env.USER_USAGE.idFromName(userId);
  const stub = c.env.USER_USAGE.get(id);
  
  const result = await stub.endSession(sessionId);
  
  // Update session record in D1
  await c.env.DB.prepare(`
    UPDATE usage_sessions 
    SET ended_at = ?, minutes_used = ?, end_reason = ?, conversation_id = ?
    WHERE id = ?
  `).bind(
    Date.now(),
    result.minutesUsed ?? 0,
    'user_ended',
    conversationId ?? null,
    sessionId
  ).run();
  
  // Get updated status
  const status = await stub.getStatus();
  
  return c.json({
    success: true,
    data: {
      sessionMinutes: result.minutesUsed,
      totalMinutesUsed: status.minutesUsed,
      minutesRemaining: status.minutesRemaining,
    },
  });
});

// ════════════════════════════════════════════════════════════════════════════
// GET /api/session/history - Get session history for current period
// ════════════════════════════════════════════════════════════════════════════

app.get('/history', requireAuth, async (c) => {
  const userId = c.get('session').userId;
  
  // Get sessions from last 30 days
  const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
  
  const sessions = await c.env.DB.prepare(`
    SELECT id, started_at, ended_at, minutes_used, topic, difficulty
    FROM usage_sessions
    WHERE user_id = ? AND started_at > ?
    ORDER BY started_at DESC
    LIMIT 50
  `).bind(userId, thirtyDaysAgo).all();
  
  return c.json({
    success: true,
    data: sessions.results,
  });
});

export default app;
```

### Realtime Token Route Update

Update `apps/api/worker/routes/realtime-token.ts` to include credit check:

```typescript
// apps/api/worker/routes/realtime-token.ts

import { Hono } from 'hono';

const app = new Hono<{ Bindings: Env }>();

app.post('/api/realtime-token', async (c) => {
  const session = c.get('session');
  if (!session?.userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  
  // IMPORTANT: Verify user has an active session before giving token
  const id = c.env.USER_USAGE.idFromName(session.userId);
  const stub = c.env.USER_USAGE.get(id);
  
  const status = await stub.getStatus();
  
  if (!status.hasActiveSession) {
    return c.json({ 
      error: 'No active session. Call /api/session/start first.' 
    }, 403);
  }
  
  if (status.minutesRemaining <= 0) {
    return c.json({ 
      error: 'No credits remaining. Please upgrade your plan.' 
    }, 403);
  }
  
  // Create ephemeral token from OpenAI
  const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${c.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-realtime',
      voice: 'coral',
    }),
  });
  
  if (!response.ok) {
    const error = await response.text();
    console.error('OpenAI token error:', error);
    return c.json({ error: 'Failed to create session token' }, 500);
  }
  
  const { client_secret } = await response.json();
  
  return c.json({
    token: client_secret.value,
    expiresAt: client_secret.expires_at,
    minutesRemaining: status.minutesRemaining,
  });
});

export default app;
```


### Polar Webhook Handler (Primary) - See Separate Document

Your project uses **Polar.sh** as the payment gateway. For the complete Polar webhook integration with Durable Objects, see:

📄 **[POLAR_WEBHOOK_DO_INTEGRATION.md](./POLAR_WEBHOOK_DO_INTEGRATION.md)**

This includes:
- Updating `apps/web/src/lib/server/utils/polar.ts` with DO integration
- Modifying the webhook endpoint to pass platform context
- Service binding configuration for cross-worker DO access
- Type definitions for the USER_USAGE binding

---

### Stripe Webhook Handler (Alternative)

```typescript
// apps/api/worker/routes/stripe-webhook.ts

import { Hono } from 'hono';
import Stripe from 'stripe';

const app = new Hono<{ Bindings: Env }>();

// Map Stripe price IDs to plans
const PRICE_TO_PLAN: Record<string, 'free' | 'basic' | 'pro'> = {
  'price_basic_monthly': 'basic',
  'price_pro_monthly': 'pro',
};

app.post('/api/webhooks/stripe', async (c) => {
  const stripe = new Stripe(c.env.STRIPE_SECRET_KEY);
  const signature = c.req.header('stripe-signature');
  
  if (!signature) {
    return c.json({ error: 'Missing signature' }, 400);
  }
  
  let event: Stripe.Event;
  
  try {
    const body = await c.req.text();
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      c.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return c.json({ error: 'Invalid signature' }, 400);
  }
  
  // Handle relevant events
  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription;
      const userId = subscription.metadata.userId;
      
      if (!userId) {
        console.error('No userId in subscription metadata');
        break;
      }
      
      const priceId = subscription.items.data[0]?.price.id;
      const newPlan = PRICE_TO_PLAN[priceId] ?? 'free';
      
      // Update Durable Object
      const id = c.env.USER_USAGE.idFromName(userId);
      const stub = c.env.USER_USAGE.get(id);
      
      try {
        await stub.upgradePlan(newPlan);
        console.log(`Updated plan for user ${userId} to ${newPlan}`);
      } catch {
        // User not initialized yet, will be initialized on first use
        console.log(`User ${userId} not initialized, plan will be set on first use`);
      }
      
      break;
    }
    
    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      const userId = subscription.metadata.userId;
      
      if (userId) {
        const id = c.env.USER_USAGE.idFromName(userId);
        const stub = c.env.USER_USAGE.get(id);
        
        try {
          await stub.downgradePlan('free');
          console.log(`Downgraded user ${userId} to free plan`);
        } catch {
          // User might not exist
        }
      }
      
      break;
    }
  }
  
  return c.json({ received: true });
});

export default app;
```

---

## Frontend Integration

### SvelteKit Practice Session Flow

Update the practice page to integrate with the session API:

```svelte
<!-- apps/web/src/routes/practice/+page.svelte -->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { RealtimeClient } from '$lib/voice/RealtimeClient';
  
  // Session state
  let sessionId: string | null = null;
  let isConnected = false;
  let isLoading = false;
  
  // Usage state
  let usageStatus = {
    plan: 'free',
    minutesUsed: 0,
    minutesRemaining: 10,
    minutesLimit: 10,
    hasActiveSession: false,
    percentUsed: 0,
  };
  
  // Conversation state
  let userTranscript = '';
  let coachTranscript = '';
  let error = '';
  
  // Settings
  let topic = 'daily_life';
  let difficulty = 'intermediate';
  
  // Client
  let client: RealtimeClient | null = null;
  let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  
  // ══════════════════════════════════════════════════════════════════════════
  // LIFECYCLE
  // ══════════════════════════════════════════════════════════════════════════
  
  onMount(async () => {
    await loadUsageStatus();
  });
  
  onDestroy(() => {
    if (sessionId) {
      endSession();
    }
  });
  
  // ══════════════════════════════════════════════════════════════════════════
  // API CALLS
  // ══════════════════════════════════════════════════════════════════════════
  
  async function loadUsageStatus() {
    try {
      const res = await fetch('/api/session/status');
      const data = await res.json();
      if (data.success) {
        usageStatus = data.data;
      }
    } catch (err) {
      console.error('Failed to load usage status:', err);
    }
  }
  
  async function startSession() {
    if (usageStatus.minutesRemaining <= 0) {
      error = 'No credits remaining. Please upgrade your plan.';
      return;
    }
    
    isLoading = true;
    error = '';
    
    try {
      // 1. Start session (reserves credits)
      const startRes = await fetch('/api/session/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, difficulty }),
      });
      
      const startData = await startRes.json();
      
      if (!startData.success) {
        throw new Error(startData.error);
      }
      
      sessionId = startData.data.sessionId;
      
      // 2. Get OpenAI token
      const tokenRes = await fetch('/api/realtime-token', { method: 'POST' });
      const tokenData = await tokenRes.json();
      
      if (tokenData.error) {
        throw new Error(tokenData.error);
      }
      
      // 3. Connect to OpenAI Realtime
      client = new RealtimeClient();
      
      client.onUserTranscript = (text) => {
        userTranscript = text;
      };
      
      client.onCoachResponse = (text, isFinal) => {
        coachTranscript = isFinal ? text : coachTranscript + text;
      };
      
      client.onError = (err) => {
        error = err.message;
        endSession();
      };
      
      await client.connect(tokenData.token);
      
      // 4. Start heartbeat (every 30 seconds)
      heartbeatInterval = setInterval(sendHeartbeat, 30_000);
      
      isConnected = true;
      
      // 5. Send initial greeting
      client.sendTextMessage(
        `Topic: ${topic}, Difficulty: ${difficulty}. Please greet me and start a conversation in Vietnamese.`
      );
      
    } catch (err: any) {
      error = err.message;
      sessionId = null;
    } finally {
      isLoading = false;
    }
  }
  
  async function sendHeartbeat() {
    if (!sessionId) return;
    
    try {
      const res = await fetch('/api/session/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });
      
      const data = await res.json();
      
      if (data.success) {
        usageStatus.minutesUsed = usageStatus.minutesLimit - data.data.minutesRemaining;
        usageStatus.minutesRemaining = data.data.minutesRemaining;
        usageStatus.percentUsed = Math.round(
          (usageStatus.minutesUsed / usageStatus.minutesLimit) * 100
        );
        
        // Show warning if low on credits
        if (data.data.warning) {
          // Could show a toast notification here
          console.warn(data.data.warning);
        }
        
        // Auto-end if out of credits
        if (data.data.minutesRemaining <= 0) {
          error = 'Session ended: Monthly limit reached.';
          await endSession();
        }
      }
    } catch (err) {
      console.error('Heartbeat failed:', err);
    }
  }
  
  async function endSession() {
    // Clear heartbeat
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }
    
    // Disconnect from OpenAI
    client?.disconnect();
    client = null;
    
    // End session on server
    if (sessionId) {
      try {
        const res = await fetch('/api/session/end', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId }),
        });
        
        const data = await res.json();
        
        if (data.success) {
          usageStatus.minutesUsed = data.data.totalMinutesUsed;
          usageStatus.minutesRemaining = data.data.minutesRemaining;
        }
      } catch (err) {
        console.error('Failed to end session:', err);
      }
    }
    
    sessionId = null;
    isConnected = false;
    userTranscript = '';
    coachTranscript = '';
  }
</script>


<!-- Template -->
<div class="min-h-screen bg-gradient-to-b from-emerald-50 to-white py-8">
  <div class="max-w-2xl mx-auto px-4">
    
    <!-- Header with Usage Display -->
    <div class="text-center mb-8">
      <h1 class="text-3xl font-bold text-emerald-800">Speak Phở Real 🍜</h1>
      <p class="text-gray-600">Practice Vietnamese conversation</p>
      
      <!-- Usage Bar -->
      <div class="mt-4 bg-white rounded-xl p-4 shadow-sm">
        <div class="flex justify-between text-sm text-gray-600 mb-1">
          <span>{usageStatus.plan} plan</span>
          <span>{usageStatus.minutesUsed}/{usageStatus.minutesLimit} minutes</span>
        </div>
        <div class="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div 
            class="h-full bg-emerald-500 transition-all duration-300"
            style="width: {usageStatus.percentUsed}%"
            class:bg-amber-500={usageStatus.percentUsed > 75}
            class:bg-red-500={usageStatus.percentUsed > 90}
          ></div>
        </div>
        {#if usageStatus.minutesRemaining <= 5}
          <p class="text-amber-600 text-xs mt-1">
            ⚠️ Low on credits! {usageStatus.minutesRemaining} minutes remaining
          </p>
        {/if}
      </div>
    </div>
    
    {#if !isConnected}
      <!-- Setup Screen -->
      <div class="bg-white rounded-2xl shadow-lg p-6">
        <h2 class="text-xl font-semibold text-gray-800 mb-4">Start a Session</h2>
        
        <!-- Topic & Difficulty Selectors (existing code) -->
        <!-- ... -->
        
        <button
          on:click={startSession}
          disabled={isLoading || usageStatus.minutesRemaining <= 0}
          class="mt-6 w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {#if isLoading}
            ⏳ Connecting...
          {:else if usageStatus.minutesRemaining <= 0}
            🔒 No Credits - Upgrade Plan
          {:else}
            🎤 Start Practice Session ({usageStatus.minutesRemaining} min remaining)
          {/if}
        </button>
        
        {#if usageStatus.minutesRemaining <= 0}
          <a 
            href="/pricing" 
            class="mt-4 block text-center text-emerald-600 hover:text-emerald-700"
          >
            View pricing plans →
          </a>
        {/if}
      </div>
      
    {:else}
      <!-- Active Session (existing UI with usage indicator) -->
      <div class="bg-white rounded-2xl shadow-lg p-6 space-y-6">
        <!-- Session status with live minutes -->
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <div class="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></div>
            <span class="text-sm text-gray-600">
              Connected — {usageStatus.minutesRemaining} min remaining
            </span>
          </div>
        </div>
        
        <!-- Transcripts (existing code) -->
        <!-- ... -->
        
        <button
          on:click={endSession}
          class="w-full py-3 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-50"
        >
          End Session
        </button>
      </div>
    {/if}
    
    <!-- Error Display -->
    {#if error}
      <div class="mt-4 bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
        {error}
      </div>
    {/if}
    
  </div>
</div>
```

---

## Subscription Plans

### Plan Configuration

| Plan | Monthly Price | Minutes Included | Cost per Minute | Target User |
|------|---------------|------------------|-----------------|-------------|
| **Free** | $0 | 10 minutes | N/A | Trial users |
| **Basic** | $15 | 100 minutes | $0.15 | Casual learners |
| **Pro** | $25 | 500 minutes | $0.05 | Serious students |

### Cost Analysis

At ~$0.30/minute API cost:

| Plan | Revenue | API Cost | Margin |
|------|---------|----------|--------|
| Free | $0 | $3 | -$3 (loss leader) |
| Basic | $15 | $30 | -$15 (loss leader) |
| Pro | $25 | $150 | -$125 (unsustainable!) |

**Important**: These margins assume 100% usage. In practice:
- Most free users won't use all 10 minutes
- Basic users typically use 50-70% of allocation
- Churn reduces effective API costs significantly

### Optimizations to Improve Margins

1. **Use `gpt-realtime-mini`** for lower-stakes conversations ($0.15/min vs $0.30/min)
2. **Cache system instructions** to reduce input token costs
3. **Implement idle detection** to auto-end silent sessions
4. **Add overage pricing** for heavy users
5. **Consider annual plans** with slight discount for better retention


---

## Testing Strategy

### Unit Tests for Durable Object

```typescript
// packages/data-ops/src/durable-objects/__tests__/UserUsageObject.test.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UserUsageObject, PLAN_CONFIG } from '../UserUsageObject';

describe('UserUsageObject', () => {
  let mockStorage: Map<string, any>;
  let mockCtx: any;
  let mockEnv: any;
  
  beforeEach(() => {
    mockStorage = new Map();
    
    mockCtx = {
      storage: {
        get: vi.fn((key) => Promise.resolve(mockStorage.get(key))),
        put: vi.fn((key, value) => {
          mockStorage.set(key, value);
          return Promise.resolve();
        }),
        setAlarm: vi.fn(() => Promise.resolve()),
        getAlarm: vi.fn(() => Promise.resolve(null)),
      },
      blockConcurrencyWhile: vi.fn((fn) => fn()),
    };
    
    mockEnv = {
      DB: {
        prepare: vi.fn(() => ({
          bind: vi.fn(() => ({
            run: vi.fn(() => Promise.resolve()),
          })),
        })),
      },
    };
  });
  
  describe('initialize', () => {
    it('should initialize user with free plan by default', async () => {
      const obj = new UserUsageObject(mockCtx, mockEnv);
      const status = await obj.initialize('user-123');
      
      expect(status.plan).toBe('free');
      expect(status.minutesLimit).toBe(PLAN_CONFIG.free.minutes);
      expect(status.minutesUsed).toBe(0);
    });
    
    it('should initialize user with specified plan', async () => {
      const obj = new UserUsageObject(mockCtx, mockEnv);
      const status = await obj.initialize('user-123', 'pro');
      
      expect(status.plan).toBe('pro');
      expect(status.minutesLimit).toBe(PLAN_CONFIG.pro.minutes);
    });
  });
  
  describe('hasCredits', () => {
    it('should return true when user has remaining credits', async () => {
      const obj = new UserUsageObject(mockCtx, mockEnv);
      await obj.initialize('user-123', 'basic');
      
      const result = await obj.hasCredits();
      
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(100);
    });
    
    it('should return false when credits exhausted', async () => {
      const obj = new UserUsageObject(mockCtx, mockEnv);
      await obj.initialize('user-123', 'free');
      
      // Simulate using all credits
      await obj.startSession();
      // Manually set used minutes (would normally happen via heartbeat)
      mockStorage.get('state').minutesUsed = 10;
      await mockCtx.storage.put('state', mockStorage.get('state'));
      
      const result = await obj.hasCredits();
      
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });
  });
  
  describe('startSession', () => {
    it('should create session when credits available', async () => {
      const obj = new UserUsageObject(mockCtx, mockEnv);
      await obj.initialize('user-123');
      
      const result = await obj.startSession();
      
      expect(result.sessionId).toBeDefined();
      expect(result.error).toBeUndefined();
    });
    
    it('should reject when session already active', async () => {
      const obj = new UserUsageObject(mockCtx, mockEnv);
      await obj.initialize('user-123');
      await obj.startSession();
      
      const result = await obj.startSession();
      
      expect(result.error).toContain('already active');
    });
  });
  
  describe('endSession', () => {
    it('should calculate minutes used correctly', async () => {
      const obj = new UserUsageObject(mockCtx, mockEnv);
      await obj.initialize('user-123');
      
      const { sessionId } = await obj.startSession();
      
      // Simulate 2.5 minutes passing
      vi.useFakeTimers();
      vi.advanceTimersByTime(2.5 * 60 * 1000);
      
      const result = await obj.endSession(sessionId!);
      
      // Should round up to 3 minutes
      expect(result.minutesUsed).toBe(3);
      
      vi.useRealTimers();
    });
  });
  
  describe('upgradePlan', () => {
    it('should update plan and limits', async () => {
      const obj = new UserUsageObject(mockCtx, mockEnv);
      await obj.initialize('user-123', 'free');
      
      const status = await obj.upgradePlan('pro');
      
      expect(status.plan).toBe('pro');
      expect(status.minutesLimit).toBe(500);
    });
  });
});
```

### Integration Tests

```typescript
// apps/api/worker/__tests__/session.integration.test.ts

import { describe, it, expect, beforeAll } from 'vitest';
import { unstable_dev } from 'wrangler';
import type { UnstableDevWorker } from 'wrangler';

describe('Session API Integration', () => {
  let worker: UnstableDevWorker;
  
  beforeAll(async () => {
    worker = await unstable_dev('worker/index.ts', {
      experimental: { disableExperimentalWarning: true },
    });
  });
  
  afterAll(async () => {
    await worker.stop();
  });
  
  it('should check usage status', async () => {
    const res = await worker.fetch('/api/session/status', {
      headers: {
        'Cookie': 'session=test-session', // Mock auth
      },
    });
    
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty('plan');
    expect(data.data).toHaveProperty('minutesRemaining');
  });
  
  it('should start and end session', async () => {
    // Start session
    const startRes = await worker.fetch('/api/session/start', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': 'session=test-session',
      },
      body: JSON.stringify({ topic: 'test' }),
    });
    
    expect(startRes.status).toBe(200);
    const startData = await startRes.json();
    expect(startData.data.sessionId).toBeDefined();
    
    // End session
    const endRes = await worker.fetch('/api/session/end', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': 'session=test-session',
      },
      body: JSON.stringify({ sessionId: startData.data.sessionId }),
    });
    
    expect(endRes.status).toBe(200);
  });
});
```


---

## Deployment Checklist

### Pre-Deployment

- [ ] **Database Migration**
  - [ ] Run migration on staging D1 database
  - [ ] Verify all tables created correctly
  - [ ] Test upsert queries work as expected

- [ ] **Durable Object Setup**
  - [ ] Add DO class to `wrangler.jsonc`
  - [ ] Add migration tag for new class
  - [ ] Verify DO binding in worker

- [ ] **Environment Variables**
  - [ ] `OPENAI_API_KEY` set in Workers secrets
  - [ ] `STRIPE_SECRET_KEY` set in Workers secrets
  - [ ] `STRIPE_WEBHOOK_SECRET` set in Workers secrets

- [ ] **Stripe Configuration**
  - [ ] Create products and prices in Stripe
  - [ ] Update `PRICE_TO_PLAN` mapping with real price IDs
  - [ ] Configure webhook endpoint in Stripe dashboard
  - [ ] Test webhook with Stripe CLI

### Deployment Steps

```bash
# 1. Deploy database migration
cd packages/data-ops
pnpm wrangler d1 execute viet-coach-db --file=./migrations/0002_add_usage_tracking.sql

# 2. Deploy Worker with Durable Objects
cd apps/api
pnpm wrangler deploy

# 3. Verify deployment
pnpm wrangler tail  # Watch logs

# 4. Test endpoints
curl https://your-api.workers.dev/api/session/status \
  -H "Authorization: Bearer test-token"
```

### Post-Deployment Verification

- [ ] Test `/api/session/status` returns usage data
- [ ] Test `/api/session/start` creates session
- [ ] Test `/api/session/heartbeat` updates usage
- [ ] Test `/api/session/end` finalizes session
- [ ] Test Stripe webhook updates plan
- [ ] Verify D1 sync logs appear
- [ ] Check Durable Object logs in dashboard

---

## Implementation Timeline

### Phase 1: Foundation (Week 1)

**Day 1-2: Database Schema**
- [ ] Add new tables to schema.ts
- [ ] Generate and run migrations
- [ ] Set up seed data for testing

**Day 3-4: Durable Object Core**
- [ ] Create UserUsageObject class
- [ ] Implement initialize, hasCredits, getStatus
- [ ] Add unit tests

**Day 5: Storage & Sync**
- [ ] Implement persist and alarm methods
- [ ] Add syncToDatabase logic
- [ ] Test alarm scheduling

### Phase 2: API Integration (Week 2)

**Day 1-2: Session Routes**
- [ ] Create /api/session/* endpoints
- [ ] Integrate with auth middleware
- [ ] Add request validation

**Day 3: Realtime Token Update**
- [ ] Add credit check to token endpoint
- [ ] Implement session verification

**Day 4-5: Stripe Webhook**
- [ ] Create webhook handler
- [ ] Implement plan update logic
- [ ] Test with Stripe CLI

### Phase 3: Frontend (Week 3)

**Day 1-2: Usage Display**
- [ ] Add usage status component
- [ ] Implement progress bar
- [ ] Add low-credit warnings

**Day 3-4: Session Flow**
- [ ] Update practice page with session calls
- [ ] Implement heartbeat mechanism
- [ ] Add error handling

**Day 5: Testing & Polish**
- [ ] End-to-end testing
- [ ] Fix edge cases
- [ ] Performance optimization

### Phase 4: Launch (Week 4)

- [ ] Deploy to production
- [ ] Monitor logs and metrics
- [ ] Gather user feedback
- [ ] Iterate on improvements

---

## Cost Analysis

### Durable Objects Pricing

| Resource | Price | Estimate (1000 users) |
|----------|-------|----------------------|
| Requests | $0.15/million | ~$0.15/month |
| Duration | $12.50/million GB-s | ~$1-2/month |
| Storage | $0.20/GB | ~$0.01/month |

**Total DO cost**: ~$2-5/month for 1000 active users

### D1 Database Pricing

| Resource | Free Tier | Paid |
|----------|-----------|------|
| Rows read | 5M/day | $0.001/million |
| Rows written | 100K/day | $0.001/million |
| Storage | 5GB | $0.75/GB |

**Total D1 cost**: Likely within free tier for early growth

### OpenAI Realtime API (Primary Cost!)

| Usage | Minutes | Cost |
|-------|---------|------|
| 100 users × 30 min/month | 3,000 | $900 |
| 100 users × 10 min/month | 1,000 | $300 |

**This is your main cost driver.** The DO/D1 costs are negligible.

---

## Appendix: Quick Reference

### Durable Object Methods

| Method | Purpose | Latency |
|--------|---------|---------|
| `hasCredits()` | Check remaining credits | <10ms |
| `startSession()` | Begin voice session | <10ms |
| `heartbeat()` | Update live usage | <10ms |
| `endSession()` | Finalize session | ~100ms (includes sync) |
| `getStatus()` | Get full usage state | <10ms |
| `upgradePlan()` | Change subscription tier | ~100ms (includes sync) |

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/session/status` | GET | Check usage status |
| `/api/session/start` | POST | Start voice session |
| `/api/session/heartbeat` | POST | Update session usage |
| `/api/session/end` | POST | End voice session |
| `/api/session/history` | GET | Get session history |
| `/api/realtime-token` | POST | Get OpenAI token |
| `/api/webhooks/stripe` | POST | Handle Stripe events |

### Error Codes

| Error | Meaning | User Action |
|-------|---------|-------------|
| `NO_CREDITS` | Monthly limit reached | Upgrade plan |
| `SESSION_ACTIVE` | Session already running | End current session |
| `USER_NOT_INITIALIZED` | First-time user | Auto-initialize |
| `STALE_SESSION` | Session timed out | Start new session |

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | Dec 2024 | Claude | Initial implementation plan |

---

*This document is part of the Speak Phở Real Vietnamese language coaching app.*
