/**
 * Billing Remote Functions
 *
 * Server-side functions for organisation subscription billing.
 * Calls the Go service-core billing endpoints.
 */

import { query, command } from "$app/server";
import { getRequestEvent } from "$app/server";
import * as v from "valibot";
import { env } from "$env/dynamic/private";
import { db } from "$lib/server/db";
import { users } from "$lib/server/schema";
import { eq } from "drizzle-orm";
import { getOrganisationContext } from "$lib/server/organisation";
import { hasPermission } from "$lib/server/permissions";
import { error } from "@sveltejs/kit";

// =============================================================================
// Types
// =============================================================================

type BillingInfo = {
	organisationId: string;
	name: string;
	tier: string;
	subscriptionId: string;
	subscriptionEnd: string | null;
	stripeCustomerId: string;
	isFreemium: boolean;
	freemiumExpiresAt: string | null;
};

type URLResponse = {
	url: string;
};

type SafeResponse<T> = {
	success: boolean;
	data?: T;
	message?: string;
	code?: number;
};

// =============================================================================
// Validation Schemas
// =============================================================================

const CreateCheckoutSchema = v.object({
	tier: v.picklist(["starter", "growth", "enterprise"]),
	interval: v.picklist(["month", "year"]),
});

const UpgradeSubscriptionSchema = v.object({
	tier: v.picklist(["starter", "growth", "enterprise"]),
	interval: v.picklist(["month", "year"]),
});

// =============================================================================
// Helper to call Go service
// =============================================================================

async function callBillingAPI<T>(
	endpoint: string,
	options: RequestInit = {},
): Promise<SafeResponse<T>> {
	const event = getRequestEvent();
	const accessToken = event.cookies.get("access_token");

	const response = await fetch(`${env.CORE_URL}/api/v1/billing${endpoint}`, {
		...options,
		headers: {
			"Content-Type": "application/json",
			...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
			...options.headers,
		},
	});

	if (!response.ok) {
		const errorBody = await response.json().catch(() => ({ message: "Unknown error" }));
		throw error(response.status, errorBody.message || `Billing API error: ${response.status}`);
	}

	return response.json();
}

// =============================================================================
// Billing Info
// =============================================================================

const GetBillingInfoSchema = v.optional(
	v.object({
		sessionId: v.optional(v.string()),
	}),
);

/**
 * Get the current organisation's billing information.
 * If sessionId is provided, auto-syncs from Stripe if DB is behind.
 * This makes the endpoint idempotent - always returns the truth.
 */
export const getBillingInfo = query(GetBillingInfoSchema, async (params) => {
	const context = await getOrganisationContext();

	if (!hasPermission(context.role, "billing:view")) {
		throw error(403, "Permission denied: billing:view");
	}

	let endpoint = `/info?organisationId=${context.organisationId}`;
	if (params?.sessionId) {
		endpoint += `&sessionId=${encodeURIComponent(params.sessionId)}`;
	}

	const response = await callBillingAPI<BillingInfo>(endpoint);

	if (!response.success || !response.data) {
		throw error(500, response.message || "Failed to get billing info");
	}

	return response.data;
});

// =============================================================================
// Checkout Session Status
// =============================================================================

type CheckoutSessionStatus = {
	status: string; // "complete", "expired", "open"
	paymentStatus: string; // "paid", "unpaid", "no_payment_required"
	subscriptionId: string;
	tier: string;
	customerId: string;
	subscriptionEnd?: number;
};

const GetSessionStatusSchema = v.object({
	sessionId: v.pipe(v.string(), v.minLength(1)),
});

/**
 * Get the status of a checkout session directly from Stripe.
 * Used to poll for subscription updates after checkout redirect.
 */
export const getCheckoutSessionStatus = query(GetSessionStatusSchema, async (data) => {
	const response = await callBillingAPI<CheckoutSessionStatus>(
		`/session-status?sessionId=${encodeURIComponent(data.sessionId)}`,
	);

	if (!response.success || !response.data) {
		throw error(500, response.message || "Failed to get session status");
	}

	return response.data;
});

// =============================================================================
// Checkout Session
// =============================================================================

/**
 * Create a Stripe Checkout session for upgrading the organisation subscription.
 * Returns a URL to redirect the user to Stripe's hosted checkout page.
 */
export const createCheckoutSession = command(CreateCheckoutSchema, async (data) => {
	const context = await getOrganisationContext();

	if (!hasPermission(context.role, "billing:manage")) {
		throw error(403, "Permission denied: billing:manage");
	}

	// Get user email for Stripe customer
	const [user] = await db
		.select({ email: users.email })
		.from(users)
		.where(eq(users.id, context.userId))
		.limit(1);

	if (!user) {
		throw error(500, "User not found");
	}

	const response = await callBillingAPI<URLResponse>("/checkout", {
		method: "POST",
		body: JSON.stringify({
			organisationId: context.organisationId,
			organisationSlug: context.organisation.slug,
			organisationName: context.organisation.name,
			email: user.email,
			tier: data.tier,
			interval: data.interval,
		}),
	});

	if (!response.success || !response.data) {
		throw error(500, response.message || "Failed to create checkout session");
	}

	return response.data;
});

// =============================================================================
// Billing Portal
// =============================================================================

/**
 * Create a Stripe Billing Portal session for managing the subscription.
 * Returns a URL to redirect the user to Stripe's billing portal.
 */
export const createPortalSession = command(async () => {
	const context = await getOrganisationContext();

	if (!hasPermission(context.role, "billing:manage")) {
		throw error(403, "Permission denied: billing:manage");
	}

	const response = await callBillingAPI<URLResponse>(
		`/portal?organisationId=${context.organisationId}&organisationSlug=${context.organisation.slug}`,
		{
			method: "POST",
		},
	);

	if (!response.success || !response.data) {
		throw error(500, response.message || "Failed to create portal session");
	}

	return response.data;
});

// =============================================================================
// Sync Subscription from Session
// =============================================================================

const SyncSessionSchema = v.object({
	sessionId: v.pipe(v.string(), v.minLength(1)),
});

/**
 * Sync subscription from a completed checkout session.
 * Called after polling confirms the session is complete to update the database.
 * This ensures the database is updated even if webhooks are delayed.
 */
export const syncSubscriptionFromSession = command(SyncSessionSchema, async (data) => {
	const context = await getOrganisationContext();

	if (!hasPermission(context.role, "billing:manage")) {
		throw error(403, "Permission denied: billing:manage");
	}

	const response = await callBillingAPI<{ success: boolean }>(
		`/sync-session?sessionId=${encodeURIComponent(data.sessionId)}`,
		{
			method: "POST",
		},
	);

	if (!response.success) {
		throw error(500, response.message || "Failed to sync subscription");
	}

	return { success: true };
});

// =============================================================================
// Upgrade Subscription (with proration)
// =============================================================================

/**
 * Upgrade an existing subscription with proration.
 * Used when user already has a paid subscription and wants to upgrade to a higher tier.
 * Stripe will calculate the prorated amount and charge immediately.
 */
export const upgradeSubscription = command(UpgradeSubscriptionSchema, async (data) => {
	const context = await getOrganisationContext();

	if (!hasPermission(context.role, "billing:manage")) {
		throw error(403, "Permission denied: billing:manage");
	}

	const response = await callBillingAPI<{ success: boolean }>("/upgrade", {
		method: "POST",
		body: JSON.stringify({
			organisationId: context.organisationId,
			tier: data.tier,
			interval: data.interval,
		}),
	});

	if (!response.success) {
		throw error(500, response.message || "Failed to upgrade subscription");
	}

	return { success: true };
});
