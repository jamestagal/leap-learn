/**
 * Dashboard Page Server Load
 *
 * Loads data for the organisation dashboard including:
 * - Team member count (from organisationMemberships)
 * - Client count (from clients table)
 * - Form submissions this month (from formSubmissions)
 * - Profile completeness check (from organisationProfiles)
 * - Recent activity feed (from organisationActivityLog)
 */

import type { PageServerLoad } from "./$types";
import { db } from "$lib/server/db";
import {
	organisationProfiles,
	organisationMemberships,
	organisationActivityLog,
	clients,
	formSubmissions,
} from "$lib/server/schema";
import { eq, count, and, gte, desc } from "drizzle-orm";

export const load: PageServerLoad = async ({ parent }) => {
	// Get organisation context from layout
	const { organisation } = await parent();
	const organisationId = organisation.id;

	// First of current month for time-scoped queries
	const firstOfMonth = new Date();
	firstOfMonth.setDate(1);
	firstOfMonth.setHours(0, 0, 0, 0);

	// Run all stat queries in parallel
	const [
		clientStats,
		submissionStats,
		teamStats,
		profile,
		activities,
	] = await Promise.all([
		// 1. Total clients (active status)
		db
			.select({ count: count() })
			.from(clients)
			.where(eq(clients.organisationId, organisationId)),

		// 2. Form submissions this month
		db
			.select({ count: count() })
			.from(formSubmissions)
			.where(
				and(
					eq(formSubmissions.organisationId, organisationId),
					gte(formSubmissions.submittedAt, firstOfMonth),
				),
			),

		// 3. Team members (active memberships)
		db
			.select({ count: count() })
			.from(organisationMemberships)
			.where(
				and(
					eq(organisationMemberships.organisationId, organisationId),
					eq(organisationMemberships.status, "active"),
				),
			),

		// Profile completeness check
		db
			.select({
				abn: organisationProfiles.abn,
				legalEntityName: organisationProfiles.legalEntityName,
				addressLine1: organisationProfiles.addressLine1,
				city: organisationProfiles.city,
				state: organisationProfiles.state,
				postcode: organisationProfiles.postcode,
			})
			.from(organisationProfiles)
			.where(eq(organisationProfiles.organisationId, organisationId))
			.limit(1),

		// Recent activity (last 10 items)
		db
			.select({
				id: organisationActivityLog.id,
				createdAt: organisationActivityLog.createdAt,
				action: organisationActivityLog.action,
				entityType: organisationActivityLog.entityType,
				entityId: organisationActivityLog.entityId,
				userId: organisationActivityLog.userId,
				newValues: organisationActivityLog.newValues,
			})
			.from(organisationActivityLog)
			.where(eq(organisationActivityLog.organisationId, organisationId))
			.orderBy(desc(organisationActivityLog.createdAt))
			.limit(10),
	]);

	// Resolve user names for activity feed
	const userIds = [
		...new Set(activities.filter((a) => a.userId).map((a) => a.userId!)),
	];
	let userMap = new Map<string, string>();

	if (userIds.length > 0) {
		const members = await db
			.select({
				userId: organisationMemberships.userId,
				displayName: organisationMemberships.displayName,
			})
			.from(organisationMemberships)
			.where(eq(organisationMemberships.organisationId, organisationId));

		for (const m of members) {
			if (m.displayName) userMap.set(m.userId, m.displayName);
		}
	}

	const recentActivity = activities.map((a) => ({
		id: a.id,
		createdAt: a.createdAt.toISOString(),
		action: a.action,
		entityType: a.entityType,
		entityId: a.entityId,
		userId: a.userId,
		userName: a.userId ? (userMap.get(a.userId) ?? "Unknown") : "System",
		newValues: a.newValues as Record<string, unknown> | null,
	}));

	// Check if there are any clients (indicating demo data or real data)
	const clientCount = Number(clientStats[0]?.count ?? 0);

	// Profile is complete if key business fields are filled
	const profileRow = profile[0];
	const isProfileComplete = !!(
		profileRow &&
		profileRow.legalEntityName &&
		profileRow.addressLine1 &&
		profileRow.city &&
		profileRow.state &&
		profileRow.postcode
	);

	return {
		clientCount,
		formSubmissionsThisMonth: Number(submissionStats[0]?.count ?? 0),
		teamMemberCount: Number(teamStats[0]?.count ?? 0),
		recentActivity,
		hasDemoData: clientCount > 0,
		isProfileComplete,
		isNewOrganisation: clientCount === 0,
	};
};
