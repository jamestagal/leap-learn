/**
 * GDPR Compliance Remote Functions
 *
 * Provides data export, soft delete, and deletion scheduling
 * to comply with GDPR requirements.
 *
 * Key features:
 * - Full data export in JSON format
 * - Soft delete with 30-day grace period
 * - Deletion cancellation during grace period
 * - Activity log anonymization
 */

import { query, command } from "$app/server";
import * as v from "valibot";
import { db } from "$lib/server/db";
import {
	organisations,
	organisationMemberships,
	organisationFormOptions,
	organisationActivityLog,
	users,
} from "$lib/server/schema";
import { getOrganisationContext } from "$lib/server/organisation";
import { requirePermission } from "$lib/server/permissions";
import { logActivity, AUDIT_ACTIONS, ENTITY_TYPES } from "$lib/server/db-helpers";
import { eq } from "drizzle-orm";
import { error } from "@sveltejs/kit";
import { formatDate } from "$lib/utils/formatting";

// =============================================================================
// Constants
// =============================================================================

// Grace period for deletion (in days)
const DELETION_GRACE_PERIOD_DAYS = 30;

// =============================================================================
// Query Functions
// =============================================================================

/**
 * Get the deletion status of the current organisation.
 * Returns null if not scheduled for deletion.
 */
export const getDeletionStatus = query(async () => {
	const context = await getOrganisationContext();

	const [organisation] = await db
		.select({
			deletedAt: organisations.deletedAt,
			deletionScheduledFor: organisations.deletionScheduledFor,
		})
		.from(organisations)
		.where(eq(organisations.id, context.organisationId))
		.limit(1);

	if (!organisation || !organisation.deletionScheduledFor) {
		return null;
	}

	const now = new Date();
	const scheduledDate = new Date(organisation.deletionScheduledFor);
	const daysRemaining = Math.ceil(
		(scheduledDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
	);

	return {
		scheduledFor: organisation.deletionScheduledFor,
		daysRemaining: Math.max(0, daysRemaining),
		canCancel: daysRemaining > 0,
	};
});

/**
 * Export all organisation data for GDPR compliance.
 * Only accessible by organisation owner.
 */
export const exportOrganisationData = query(async () => {
	await requirePermission("data:export");
	const context = await getOrganisationContext();

	// Get organisation details
	const [organisation] = await db
		.select()
		.from(organisations)
		.where(eq(organisations.id, context.organisationId))
		.limit(1);

	if (!organisation) {
		throw error(404, "Organisation not found");
	}

	// Get all members
	const members = await db
		.select({
			id: organisationMemberships.id,
			role: organisationMemberships.role,
			status: organisationMemberships.status,
			displayName: organisationMemberships.displayName,
			invitedAt: organisationMemberships.invitedAt,
			acceptedAt: organisationMemberships.acceptedAt,
			userEmail: users.email,
		})
		.from(organisationMemberships)
		.innerJoin(users, eq(organisationMemberships.userId, users.id))
		.where(eq(organisationMemberships.organisationId, context.organisationId));

	// Get all form options
	const formOptions = await db
		.select()
		.from(organisationFormOptions)
		.where(eq(organisationFormOptions.organisationId, context.organisationId));

	// Get activity log (last 90 days for performance)
	const ninetyDaysAgo = new Date();
	ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

	const activityLog = await db
		.select({
			action: organisationActivityLog.action,
			entityType: organisationActivityLog.entityType,
			createdAt: organisationActivityLog.createdAt,
			metadata: organisationActivityLog.metadata,
		})
		.from(organisationActivityLog)
		.where(eq(organisationActivityLog.organisationId, context.organisationId))
		.limit(1000);

	// Log the export action
	await logActivity(AUDIT_ACTIONS.DATA_EXPORTED, ENTITY_TYPES.ORGANISATION, context.organisationId);

	return {
		exportedAt: new Date().toISOString(),
		exportVersion: "1.0",
		organisation: {
			id: organisation.id,
			name: organisation.name,
			slug: organisation.slug,
			email: organisation.email,
			phone: organisation.phone,
			website: organisation.website,
			branding: {
				logoUrl: organisation.logoUrl,
				primaryColor: organisation.primaryColor,
				secondaryColor: organisation.secondaryColor,
				accentColor: organisation.accentColor,
			},
			subscription: {
				tier: organisation.subscriptionTier,
				status: organisation.status,
			},
			createdAt: organisation.createdAt,
			updatedAt: organisation.updatedAt,
		},
		members: members.map((m) => ({
			id: m.id,
			email: m.userEmail,
			displayName: m.displayName,
			role: m.role,
			status: m.status,
			invitedAt: m.invitedAt,
			acceptedAt: m.acceptedAt,
		})),
		formOptions: formOptions.map((opt) => ({
			category: opt.category,
			value: opt.value,
			label: opt.label,
			isDefault: opt.isDefault,
			isActive: opt.isActive,
			metadata: opt.metadata,
		})),
		activityLog: activityLog.map((a) => ({
			action: a.action,
			entityType: a.entityType,
			createdAt: a.createdAt,
			// Note: Sensitive details omitted for privacy
		})),
	};
});

// =============================================================================
// Command Functions
// =============================================================================

/**
 * Schedule organisation deletion with grace period.
 * Only accessible by organisation owner.
 */
export const scheduleOrganisationDeletion = command(
	v.object({
		confirmationPhrase: v.pipe(v.string(), v.minLength(1)),
	}),
	async (data) => {
		await requirePermission("organisation:delete");
		const context = await getOrganisationContext();

		// Get organisation name for confirmation
		const [organisation] = await db
			.select({ name: organisations.name })
			.from(organisations)
			.where(eq(organisations.id, context.organisationId))
			.limit(1);

		if (!organisation) {
			throw error(404, "Organisation not found");
		}

		// Require exact name match for confirmation
		const expectedPhrase = `delete ${organisation.name}`;
		if (data.confirmationPhrase.toLowerCase() !== expectedPhrase.toLowerCase()) {
			throw error(400, `Please type "delete ${organisation.name}" to confirm deletion`);
		}

		// Check if already scheduled
		const [current] = await db
			.select({ deletionScheduledFor: organisations.deletionScheduledFor })
			.from(organisations)
			.where(eq(organisations.id, context.organisationId))
			.limit(1);

		if (current?.deletionScheduledFor) {
			throw error(400, "Organisation is already scheduled for deletion");
		}

		// Schedule deletion
		const deletionDate = new Date();
		deletionDate.setDate(deletionDate.getDate() + DELETION_GRACE_PERIOD_DAYS);

		await db
			.update(organisations)
			.set({
				deletionScheduledFor: deletionDate,
				updatedAt: new Date(),
			})
			.where(eq(organisations.id, context.organisationId));

		// Log the action
		await logActivity(
			AUDIT_ACTIONS.ORGANISATION_DELETION_SCHEDULED,
			ENTITY_TYPES.ORGANISATION,
			context.organisationId,
			{
				newValues: {
					deletionScheduledFor: deletionDate.toISOString(),
					gracePeriodDays: DELETION_GRACE_PERIOD_DAYS,
				},
			},
		);

		return {
			scheduledFor: deletionDate,
			gracePeriodDays: DELETION_GRACE_PERIOD_DAYS,
			message: `Organisation scheduled for deletion on ${formatDate(deletionDate)}. You can cancel this within ${DELETION_GRACE_PERIOD_DAYS} days.`,
		};
	},
);

/**
 * Cancel a scheduled organisation deletion.
 * Only accessible by organisation owner during grace period.
 */
export const cancelOrganisationDeletion = command(async () => {
	await requirePermission("organisation:delete");
	const context = await getOrganisationContext();

	// Check if scheduled for deletion
	const [organisation] = await db
		.select({
			deletionScheduledFor: organisations.deletionScheduledFor,
			deletedAt: organisations.deletedAt,
		})
		.from(organisations)
		.where(eq(organisations.id, context.organisationId))
		.limit(1);

	if (!organisation) {
		throw error(404, "Organisation not found");
	}

	if (organisation.deletedAt) {
		throw error(400, "Organisation has already been deleted");
	}

	if (!organisation.deletionScheduledFor) {
		throw error(400, "Organisation is not scheduled for deletion");
	}

	// Check if still within grace period
	const now = new Date();
	if (new Date(organisation.deletionScheduledFor) <= now) {
		throw error(400, "Grace period has expired. Deletion cannot be cancelled.");
	}

	// Cancel deletion
	await db
		.update(organisations)
		.set({
			deletionScheduledFor: null,
			updatedAt: new Date(),
		})
		.where(eq(organisations.id, context.organisationId));

	// Log the action
	await logActivity(
		AUDIT_ACTIONS.ORGANISATION_DELETION_CANCELLED,
		ENTITY_TYPES.ORGANISATION,
		context.organisationId,
		{
			oldValues: {
				deletionScheduledFor: organisation.deletionScheduledFor,
			},
		},
	);

	return {
		message: "Organisation deletion has been cancelled. Your organisation will not be deleted.",
	};
});

/**
 * Perform soft delete on an organisation.
 * This is called by a background job after grace period expires.
 * NOT exposed as a user-callable command.
 * @internal - Do not export from .remote.ts files
 */
async function _performSoftDelete(organisationId: string): Promise<void> {
	// Verify grace period has expired
	const [organisation] = await db
		.select({
			deletionScheduledFor: organisations.deletionScheduledFor,
			deletedAt: organisations.deletedAt,
		})
		.from(organisations)
		.where(eq(organisations.id, organisationId))
		.limit(1);

	if (!organisation) {
		throw new Error("Organisation not found");
	}

	if (organisation.deletedAt) {
		throw new Error("Organisation already deleted");
	}

	if (!organisation.deletionScheduledFor) {
		throw new Error("Organisation not scheduled for deletion");
	}

	const now = new Date();
	if (new Date(organisation.deletionScheduledFor) > now) {
		throw new Error("Grace period has not expired");
	}

	// Perform soft delete
	await db
		.update(organisations)
		.set({
			deletedAt: now,
			status: "cancelled",
			updatedAt: now,
		})
		.where(eq(organisations.id, organisationId));

	// Deactivate all memberships
	await db
		.update(organisationMemberships)
		.set({
			status: "suspended",
			updatedAt: now,
		})
		.where(eq(organisationMemberships.organisationId, organisationId));

	// Anonymize activity logs (remove user details, keep actions)
	await db
		.update(organisationActivityLog)
		.set({
			userId: null,
			ipAddress: null,
			userAgent: null,
			metadata: {},
		})
		.where(eq(organisationActivityLog.organisationId, organisationId));

	// Clear user default organisation references
	await db.update(users).set({ defaultOrganisationId: null }).where(eq(users.defaultOrganisationId, organisationId));
}
void _performSoftDelete; // Referenced for future background job use

/**
 * Request personal data export for GDPR.
 * Exports user's data across all organisations they belong to.
 */
export const exportUserData = query(async () => {
	const context = await getOrganisationContext();

	// Get user details
	const [user] = await db
		.select({
			id: users.id,
			email: users.email,
			phone: users.phone,
			avatar: users.avatar,
			created: users.created,
			updated: users.updated,
		})
		.from(users)
		.where(eq(users.id, context.userId))
		.limit(1);

	if (!user) {
		throw error(404, "User not found");
	}

	// Get all memberships
	const memberships = await db
		.select({
			organisationId: organisationMemberships.organisationId,
			organisationName: organisations.name,
			role: organisationMemberships.role,
			status: organisationMemberships.status,
			displayName: organisationMemberships.displayName,
			invitedAt: organisationMemberships.invitedAt,
			acceptedAt: organisationMemberships.acceptedAt,
		})
		.from(organisationMemberships)
		.innerJoin(organisations, eq(organisationMemberships.organisationId, organisations.id))
		.where(eq(organisationMemberships.userId, context.userId));

	return {
		exportedAt: new Date().toISOString(),
		exportVersion: "1.0",
		user: {
			id: user.id,
			email: user.email,
			phone: user.phone,
			avatar: user.avatar,
			accountCreated: user.created,
			lastUpdated: user.updated,
		},
		memberships: memberships.map((m) => ({
			organisationId: m.organisationId,
			organisationName: m.organisationName,
			role: m.role,
			status: m.status,
			displayName: m.displayName,
			invitedAt: m.invitedAt,
			acceptedAt: m.acceptedAt,
		})),
	};
});
