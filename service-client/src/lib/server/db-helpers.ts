/**
 * Data Isolation Helpers for Multi-Tenant Operations
 *
 * CRITICAL: All database operations MUST use these helpers to ensure
 * proper data isolation between organisations.
 *
 * These helpers:
 * - Enforce organisation scoping on all queries
 * - Prevent cross-organisation data leakage
 * - Provide audit logging for sensitive operations
 */

import { db } from "$lib/server/db";
import { getOrganisationContext, type OrganisationContext } from "$lib/server/organisation";
import {
	organisationActivityLog,
	type OrganisationActivityLogInsert,
} from "$lib/server/schema";
import { getRequestEvent } from "$app/server";

// =============================================================================
// Organisation-Scoped Query Wrapper
// =============================================================================

/**
 * Execute a function with guaranteed organisation scoping.
 * This is the primary pattern for all organisation-scoped database operations.
 *
 * @example
 * const consultations = await withOrganisationScope(async (organisationId) => {
 *   return db.select().from(consultations)
 *     .where(eq(consultations.organisationId, organisationId));
 * });
 */
export async function withOrganisationScope<T>(
	queryFn: (organisationId: string, context: OrganisationContext) => Promise<T>,
): Promise<T> {
	const context = await getOrganisationContext();
	return queryFn(context.organisationId, context);
}

/**
 * Execute a function with organisation scoping, also providing user ID.
 * Use this when you need to filter by both organisation and user.
 */
export async function withUserOrganisationScope<T>(
	queryFn: (organisationId: string, userId: string, context: OrganisationContext) => Promise<T>,
): Promise<T> {
	const context = await getOrganisationContext();
	const userId = context.userId;
	return queryFn(context.organisationId, userId, context);
}


// =============================================================================
// Audit Logging
// =============================================================================

/**
 * Log an activity to the audit trail.
 * Call this for all sensitive operations.
 */
export async function logActivity(
	action: string,
	entityType: string,
	entityId?: string,
	details?: {
		oldValues?: Record<string, unknown>;
		newValues?: Record<string, unknown>;
		metadata?: Record<string, unknown>;
	},
): Promise<void> {
	try {
		const context = await getOrganisationContext();
		const event = getRequestEvent();

		// Extract IP and User Agent from request
		// IP address must be null (not 'unknown') for inet column type
		const ipAddress =
			event?.request.headers.get("x-forwarded-for") ||
			event?.request.headers.get("cf-connecting-ip") ||
			null;
		const userAgent = event?.request.headers.get("user-agent") || "unknown";

		const logEntry: OrganisationActivityLogInsert = {
			organisationId: context.organisationId,
			userId: context.userId,
			action,
			entityType,
			entityId,
			oldValues: details?.oldValues,
			newValues: details?.newValues,
			ipAddress,
			userAgent,
			metadata: details?.metadata ?? {},
		};

		await db.insert(organisationActivityLog).values(logEntry);
	} catch (err) {
		// Don't fail the main operation if logging fails
		console.error("Failed to log activity:", err);
	}
}

/**
 * Batch log multiple activities (for bulk operations).
 */
export async function logActivities(
	entries: Array<{
		action: string;
		entityType: string;
		entityId?: string;
		oldValues?: Record<string, unknown>;
		newValues?: Record<string, unknown>;
		metadata?: Record<string, unknown>;
	}>,
): Promise<void> {
	if (entries.length === 0) return;

	try {
		const context = await getOrganisationContext();
		const event = getRequestEvent();

		// IP address must be null (not 'unknown') for inet column type
		const ipAddress =
			event?.request.headers.get("x-forwarded-for") ||
			event?.request.headers.get("cf-connecting-ip") ||
			null;
		const userAgent = event?.request.headers.get("user-agent") || "unknown";

		const logEntries: OrganisationActivityLogInsert[] = entries.map((entry) => ({
			organisationId: context.organisationId,
			userId: context.userId,
			action: entry.action,
			entityType: entry.entityType,
			entityId: entry.entityId,
			oldValues: entry.oldValues,
			newValues: entry.newValues,
			ipAddress,
			userAgent,
			metadata: entry.metadata ?? {},
		}));

		await db.insert(organisationActivityLog).values(logEntries);
	} catch (err) {
		console.error("Failed to log activities:", err);
	}
}

// =============================================================================
// Common Action Types for Audit Logging
// =============================================================================

export const AUDIT_ACTIONS = {
	// Organisation
	ORGANISATION_CREATED: "organisation.created",
	ORGANISATION_UPDATED: "organisation.updated",
	ORGANISATION_BRANDING_UPDATED: "organisation.branding_updated",
	ORGANISATION_DELETED: "organisation.deleted",
	ORGANISATION_DELETION_SCHEDULED: "organisation.deletion_scheduled",
	ORGANISATION_DELETION_CANCELLED: "organisation.deletion_cancelled",

	// Members
	MEMBER_INVITED: "member.invited",
	MEMBER_ACCEPTED: "member.accepted",
	MEMBER_REMOVED: "member.removed",
	MEMBER_ROLE_CHANGED: "member.role_changed",

	// Settings
	SETTINGS_UPDATED: "settings.updated",
	FORM_OPTIONS_UPDATED: "form_options.updated",
	TEMPLATE_CREATED: "template.created",
	TEMPLATE_UPDATED: "template.updated",
	TEMPLATE_DELETED: "template.deleted",

	// Security
	LOGIN: "security.login",
	LOGOUT: "security.logout",
	PASSWORD_CHANGED: "security.password_changed",
	API_KEY_GENERATED: "security.api_key_generated",

	// Data
	DATA_EXPORTED: "data.exported",

	// Subscriptions & Billing
	SUBSCRIPTION_UPGRADED: "subscription.upgraded",
	SUBSCRIPTION_DOWNGRADED: "subscription.downgraded",
	SUBSCRIPTION_CHANGED: "subscription.changed",
	PAYMENT_RECEIVED: "payment.received",
	STRIPE_CONNECTED: "stripe.connected",
	STRIPE_DISCONNECTED: "stripe.disconnected",
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

// =============================================================================
// Entity Types for Audit Logging
// =============================================================================

export const ENTITY_TYPES = {
	ORGANISATION: "organisation",
	MEMBER: "member",
	TEMPLATE: "template",
	FORM_OPTION: "form_option",
	USER: "user",
} as const;

export type EntityType = (typeof ENTITY_TYPES)[keyof typeof ENTITY_TYPES];
