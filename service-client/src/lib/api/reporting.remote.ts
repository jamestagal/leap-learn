import { query } from "$app/server";
import * as v from "valibot";
import { db } from "$lib/server/db";
import { organisationActivityLog, organisationMemberships } from "$lib/server/schema";
import { getOrganisationContext } from "$lib/server/organisation";
import { eq, desc } from "drizzle-orm";

const ActivityFiltersSchema = v.optional(
	v.object({
		limit: v.optional(v.pipe(v.number(), v.minValue(1), v.maxValue(50))),
	}),
);

export const getRecentActivity = query(ActivityFiltersSchema, async (filters) => {
	const context = await getOrganisationContext();
	const limit = filters?.limit ?? 10;

	const activities = await db
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
		.where(eq(organisationActivityLog.organisationId, context.organisationId))
		.orderBy(desc(organisationActivityLog.createdAt))
		.limit(limit);

	// Resolve user names for activities with userId
	const userIds = [...new Set(activities.filter((a) => a.userId).map((a) => a.userId!))];
	let userMap = new Map<string, string>();

	if (userIds.length > 0) {
		const members = await db
			.select({
				userId: organisationMemberships.userId,
				displayName: organisationMemberships.displayName,
			})
			.from(organisationMemberships)
			.where(eq(organisationMemberships.organisationId, context.organisationId));

		for (const m of members) {
			if (m.displayName) userMap.set(m.userId, m.displayName);
		}
	}

	return activities.map((a) => ({
		...a,
		createdAt: a.createdAt.toISOString(),
		userName: a.userId ? (userMap.get(a.userId) ?? "Unknown") : "System",
	}));
});
