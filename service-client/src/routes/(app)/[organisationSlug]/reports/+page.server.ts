import type { PageServerLoad } from "./$types";
import { hasFeature } from "$lib/server/subscription";
import { db } from "$lib/server/db";
import {
	organisationActivityLog,
	organisationMemberships,
} from "$lib/server/schema";
import { eq, and, gte, count } from "drizzle-orm";

export const load: PageServerLoad = async ({ parent }) => {
	const { organisation } = await parent();

	// Tier gate: analytics feature required (Growth+ only)
	const canAccessReports = await hasFeature("analytics");

	if (!canAccessReports) {
		return {
			gated: true as const,
			organisation,
		};
	}

	const organisationId = organisation.id;

	// Team activity (actions per member in last 30 days)
	const thirtyDaysAgo = new Date();
	thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

	const teamActivity = await db
		.select({
			userId: organisationActivityLog.userId,
			actionCount: count(),
		})
		.from(organisationActivityLog)
		.where(
			and(
				eq(organisationActivityLog.organisationId, organisationId),
				gte(organisationActivityLog.createdAt, thirtyDaysAgo),
			),
		)
		.groupBy(organisationActivityLog.userId);

	// Resolve user names for team activity
	const memberNames = await db
		.select({
			userId: organisationMemberships.userId,
			displayName: organisationMemberships.displayName,
		})
		.from(organisationMemberships)
		.where(eq(organisationMemberships.organisationId, organisationId));

	const nameMap = new Map(memberNames.map((m) => [m.userId, m.displayName || "Unknown"]));

	return {
		gated: false as const,
		organisation,
		teamActivity: teamActivity.map((t) => ({
			name: nameMap.get(t.userId ?? "") ?? "System",
			actions: Number(t.actionCount),
		})),
	};
};
