/**
 * Super Admin Remote Functions
 *
 * Remote functions for platform administration.
 * All functions require super admin access.
 */

import { query, command } from "$app/server";
import * as v from "valibot";
import { db } from "$lib/server/db";
import {
	organisations,
	organisationMemberships,
	users,
	organisationActivityLog,
} from "$lib/server/schema";
import { eq, desc, sql, and, like, or, count } from "drizzle-orm";
import {
	requireSuperAdmin,
	setImpersonatedOrganisationId,
	clearImpersonatedOrganisationId,
	SUPER_ADMIN_FLAG,
} from "$lib/server/super-admin";
import { error } from "@sveltejs/kit";

// =============================================================================
// Dashboard Stats
// =============================================================================

export const getSuperAdminStats = query(async () => {
	await requireSuperAdmin();

	// Get total counts
	const [organisationStats] = await db
		.select({
			total: count(),
			active: sql<number>`COUNT(*) FILTER (WHERE ${organisations.status} = 'active')`,
			suspended: sql<number>`COUNT(*) FILTER (WHERE ${organisations.status} = 'suspended')`,
		})
		.from(organisations);

	const [userStats] = await db.select({ total: count() }).from(users);

	// Get organisations by subscription tier
	const tierStats = await db
		.select({
			tier: organisations.subscriptionTier,
			count: count(),
		})
		.from(organisations)
		.groupBy(organisations.subscriptionTier);

	// Get recent organisation signups (last 10)
	const recentOrganisations = await db
		.select({
			id: organisations.id,
			name: organisations.name,
			slug: organisations.slug,
			status: organisations.status,
			subscriptionTier: organisations.subscriptionTier,
			createdAt: organisations.createdAt,
		})
		.from(organisations)
		.orderBy(desc(organisations.createdAt))
		.limit(10);

	// Get super admin count
	const [superAdminStats] = await db
		.select({
			total: sql<number>`COUNT(*) FILTER (WHERE (${users.access} & ${SUPER_ADMIN_FLAG}) != 0)`,
		})
		.from(users);

	return {
		organisations: {
			total: organisationStats?.total ?? 0,
			active: organisationStats?.active ?? 0,
			suspended: organisationStats?.suspended ?? 0,
		},
		users: {
			total: userStats?.total ?? 0,
			superAdmins: superAdminStats?.total ?? 0,
		},
		organisationsByTier: Object.fromEntries(tierStats.map((t) => [t.tier, t.count])),
		recentOrganisations,
	};
});

// =============================================================================
// Organisations Management
// =============================================================================

const OrganisationsFilterSchema = v.optional(
	v.object({
		search: v.optional(v.string()),
		status: v.optional(v.picklist(["active", "suspended", "cancelled"])),
		tier: v.optional(v.string()),
		limit: v.optional(v.pipe(v.number(), v.minValue(1), v.maxValue(100))),
		offset: v.optional(v.pipe(v.number(), v.minValue(0))),
	}),
);

export const getOrganisations = query(OrganisationsFilterSchema, async (filters) => {
	await requireSuperAdmin();

	const { search, status, tier, limit = 50, offset = 0 } = filters || {};

	// Build where conditions
	const conditions = [];

	if (status) {
		conditions.push(eq(organisations.status, status));
	}

	if (tier) {
		conditions.push(eq(organisations.subscriptionTier, tier));
	}

	if (search) {
		conditions.push(
			or(
				like(organisations.name, `%${search}%`),
				like(organisations.slug, `%${search}%`),
				like(organisations.email, `%${search}%`),
			),
		);
	}

	const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

	// Get organisations with member count
	const organisationList = await db
		.select({
			id: organisations.id,
			name: organisations.name,
			slug: organisations.slug,
			email: organisations.email,
			status: organisations.status,
			subscriptionTier: organisations.subscriptionTier,
			isFreemium: organisations.isFreemium,
			createdAt: organisations.createdAt,
			memberCount: sql<number>`(
				SELECT COUNT(*) FROM ${organisationMemberships}
				WHERE ${organisationMemberships.organisationId} = ${organisations.id}
				AND ${organisationMemberships.status} = 'active'
			)`,
		})
		.from(organisations)
		.where(whereClause)
		.orderBy(desc(organisations.createdAt))
		.limit(limit)
		.offset(offset);

	// Get total count for pagination
	const [totalResult] = await db.select({ count: count() }).from(organisations).where(whereClause);

	return {
		organisations: organisationList,
		total: totalResult?.count ?? 0,
		limit,
		offset,
	};
});

export const getOrganisationDetails = query(v.pipe(v.string(), v.uuid()), async (organisationId) => {
	await requireSuperAdmin();

	// Get organisation with profile
	const [organisation] = await db.select().from(organisations).where(eq(organisations.id, organisationId)).limit(1);

	if (!organisation) {
		return null;
	}

	// Get members
	const members = await db
		.select({
			id: organisationMemberships.id,
			userId: organisationMemberships.userId,
			role: organisationMemberships.role,
			status: organisationMemberships.status,
			displayName: organisationMemberships.displayName,
			createdAt: organisationMemberships.createdAt,
			userEmail: users.email,
		})
		.from(organisationMemberships)
		.innerJoin(users, eq(organisationMemberships.userId, users.id))
		.where(eq(organisationMemberships.organisationId, organisationId));

	return {
		organisation,
		members,
	};
});

const UpdateOrganisationStatusSchema = v.object({
	organisationId: v.pipe(v.string(), v.uuid()),
	status: v.optional(v.picklist(["active", "suspended", "cancelled"])),
	subscriptionTier: v.optional(v.string()),
});

export const updateOrganisationStatus = command(UpdateOrganisationStatusSchema, async (data) => {
	const { userId } = await requireSuperAdmin();

	// Fetch current organisation state for audit logging
	const [currentOrganisation] = await db
		.select({ status: organisations.status, subscriptionTier: organisations.subscriptionTier })
		.from(organisations)
		.where(eq(organisations.id, data.organisationId))
		.limit(1);

	const updates: Partial<typeof organisations.$inferInsert> = {
		updatedAt: new Date(),
	};

	if (data.status) {
		updates.status = data.status;
	}

	if (data.subscriptionTier) {
		updates.subscriptionTier = data.subscriptionTier;
	}

	await db.update(organisations).set(updates).where(eq(organisations.id, data.organisationId));

	// Log subscription tier change
	if (data.subscriptionTier && currentOrganisation && data.subscriptionTier !== currentOrganisation.subscriptionTier) {
		const tierOrder = ["free", "starter", "growth", "enterprise"];
		const oldIdx = tierOrder.indexOf(currentOrganisation.subscriptionTier);
		const newIdx = tierOrder.indexOf(data.subscriptionTier);
		const action = newIdx > oldIdx ? "subscription.upgraded" : "subscription.downgraded";

		await db.insert(organisationActivityLog).values({
			organisationId: data.organisationId,
			userId,
			action,
			entityType: "organisation",
			entityId: data.organisationId,
			oldValues: { subscriptionTier: currentOrganisation.subscriptionTier },
			newValues: { subscriptionTier: data.subscriptionTier },
			metadata: { source: "super_admin" },
		});
	}

	// Log status change
	if (data.status && currentOrganisation && data.status !== currentOrganisation.status) {
		await db.insert(organisationActivityLog).values({
			organisationId: data.organisationId,
			userId,
			action: "organisation.status_changed",
			entityType: "organisation",
			entityId: data.organisationId,
			oldValues: { status: currentOrganisation.status },
			newValues: { status: data.status },
			metadata: { source: "super_admin" },
		});
	}

	return { success: true };
});

// =============================================================================
// Organisation Impersonation
// =============================================================================

export const impersonateOrganisation = command(v.pipe(v.string(), v.uuid()), async (organisationId) => {
	await requireSuperAdmin();

	// Verify organisation exists
	const [organisation] = await db
		.select({ id: organisations.id, slug: organisations.slug })
		.from(organisations)
		.where(eq(organisations.id, organisationId))
		.limit(1);

	if (!organisation) {
		return { success: false, error: "Organisation not found" };
	}

	// Set impersonation cookie
	setImpersonatedOrganisationId(organisationId);

	return { success: true, slug: organisation.slug };
});

export const stopImpersonation = command(async () => {
	await requireSuperAdmin();

	clearImpersonatedOrganisationId();

	return { success: true };
});

// =============================================================================
// Users Management
// =============================================================================

const UsersFilterSchema = v.optional(
	v.object({
		search: v.optional(v.string()),
		superAdminOnly: v.optional(v.boolean()),
		ownersOnly: v.optional(v.boolean()),
		limit: v.optional(v.pipe(v.number(), v.minValue(1), v.maxValue(100))),
		offset: v.optional(v.pipe(v.number(), v.minValue(0))),
	}),
);

export const getUsers = query(UsersFilterSchema, async (filters) => {
	await requireSuperAdmin();

	const { search, superAdminOnly, ownersOnly, limit = 50, offset = 0 } = filters || {};

	// Build where conditions
	const conditions = [];

	if (superAdminOnly) {
		conditions.push(sql`(${users.access} & ${SUPER_ADMIN_FLAG}) != 0`);
	}

	if (search) {
		conditions.push(like(users.email, `%${search}%`));
	}

	// Filter for owners only
	if (ownersOnly) {
		conditions.push(
			sql`EXISTS (
				SELECT 1 FROM ${organisationMemberships}
				WHERE ${organisationMemberships.userId} = ${users.id}
				AND ${organisationMemberships.role} = 'owner'
				AND ${organisationMemberships.status} = 'active'
			)`,
		);
	}

	const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

	// Get users first
	const userList = await db
		.select({
			id: users.id,
			email: users.email,
			access: users.access,
			created: users.created,
			suspended: users.suspended,
		})
		.from(users)
		.where(whereClause)
		.orderBy(desc(users.created))
		.limit(limit)
		.offset(offset);

	// Get membership info for these users (organisation name and role)
	const userIds = userList.map((u) => u.id);
	const memberships =
		userIds.length > 0
			? await db
					.select({
						userId: organisationMemberships.userId,
						role: organisationMemberships.role,
						organisationName: organisations.name,
					})
					.from(organisationMemberships)
					.innerJoin(organisations, eq(organisationMemberships.organisationId, organisations.id))
					.where(
						and(
							sql`${organisationMemberships.userId} IN (${sql.join(
								userIds.map((id) => sql`${id}`),
								sql`, `,
							)})`,
							eq(organisationMemberships.status, "active"),
						),
					)
			: [];

	// Group memberships by user - get primary organisation (owner role first, then first organisation)
	const userMembershipMap = new Map<string, { organisationName: string; role: string; count: number }>();
	for (const m of memberships) {
		const existing = userMembershipMap.get(m.userId);
		if (!existing) {
			userMembershipMap.set(m.userId, { organisationName: m.organisationName, role: m.role, count: 1 });
		} else {
			existing.count++;
			// Prefer owner role for display
			if (m.role === "owner" && existing.role !== "owner") {
				existing.organisationName = m.organisationName;
				existing.role = m.role;
			}
		}
	}

	// Get total count for pagination
	const [totalResult] = await db.select({ count: count() }).from(users).where(whereClause);

	return {
		users: userList.map((u) => {
			const membershipInfo = userMembershipMap.get(u.id);
			return {
				...u,
				organisationCount: membershipInfo?.count ?? 0,
				organisationName: membershipInfo?.organisationName ?? null,
				primaryRole: membershipInfo?.role ?? null,
				isSuperAdmin: (u.access & SUPER_ADMIN_FLAG) !== 0,
				isSuspended: u.suspended,
			};
		}),
		total: totalResult?.count ?? 0,
		limit,
		offset,
	};
});

export const getUserDetails = query(v.pipe(v.string(), v.uuid()), async (userId) => {
	await requireSuperAdmin();

	// Get user
	const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);

	if (!user) {
		return null;
	}

	// Get all organisation memberships
	const memberships = await db
		.select({
			id: organisationMemberships.id,
			organisationId: organisationMemberships.organisationId,
			role: organisationMemberships.role,
			status: organisationMemberships.status,
			createdAt: organisationMemberships.createdAt,
			organisationName: organisations.name,
			organisationSlug: organisations.slug,
		})
		.from(organisationMemberships)
		.innerJoin(organisations, eq(organisationMemberships.organisationId, organisations.id))
		.where(eq(organisationMemberships.userId, userId));

	return {
		user: {
			id: user.id,
			email: user.email,
			access: user.access,
			created: user.created,
			isSuperAdmin: (user.access & SUPER_ADMIN_FLAG) !== 0,
			suspended: user.suspended,
			suspendedAt: user.suspendedAt,
			suspendedReason: user.suspendedReason,
		},
		memberships,
	};
});

const UpdateUserAccessSchema = v.object({
	userId: v.pipe(v.string(), v.uuid()),
	grantSuperAdmin: v.optional(v.boolean()),
	revokeSuperAdmin: v.optional(v.boolean()),
});

export const updateUserAccess = command(UpdateUserAccessSchema, async (data) => {
	const admin = await requireSuperAdmin();

	// Cannot modify own super admin status
	if (data.userId === admin.userId) {
		return { success: false, error: "Cannot modify your own super admin status" };
	}

	// Get current user
	const [user] = await db
		.select({ access: users.access })
		.from(users)
		.where(eq(users.id, data.userId))
		.limit(1);

	if (!user) {
		return { success: false, error: "User not found" };
	}

	let newAccess = user.access;

	if (data.grantSuperAdmin) {
		newAccess = newAccess | SUPER_ADMIN_FLAG;
	}

	if (data.revokeSuperAdmin) {
		newAccess = newAccess & ~SUPER_ADMIN_FLAG;
	}

	await db.update(users).set({ access: newAccess }).where(eq(users.id, data.userId));

	return { success: true };
});

// =============================================================================
// Audit Logs
// =============================================================================

const AuditLogsFilterSchema = v.optional(
	v.object({
		organisationId: v.optional(v.pipe(v.string(), v.uuid())),
		action: v.optional(v.string()),
		limit: v.optional(v.pipe(v.number(), v.minValue(1), v.maxValue(100))),
		offset: v.optional(v.pipe(v.number(), v.minValue(0))),
	}),
);

export const getSystemAuditLogs = query(AuditLogsFilterSchema, async (filters) => {
	await requireSuperAdmin();

	const { organisationId, action, limit = 50, offset = 0 } = filters || {};

	// Build where conditions
	const conditions = [];

	if (organisationId) {
		conditions.push(eq(organisationActivityLog.organisationId, organisationId));
	}

	if (action) {
		conditions.push(like(organisationActivityLog.action, `%${action}%`));
	}

	const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

	// Get logs with organisation and user info
	const logs = await db
		.select({
			id: organisationActivityLog.id,
			createdAt: organisationActivityLog.createdAt,
			action: organisationActivityLog.action,
			entityType: organisationActivityLog.entityType,
			entityId: organisationActivityLog.entityId,
			oldValues: organisationActivityLog.oldValues,
			newValues: organisationActivityLog.newValues,
			ipAddress: organisationActivityLog.ipAddress,
			organisationId: organisationActivityLog.organisationId,
			userId: organisationActivityLog.userId,
			organisationName: organisations.name,
			userEmail: users.email,
		})
		.from(organisationActivityLog)
		.leftJoin(organisations, eq(organisationActivityLog.organisationId, organisations.id))
		.leftJoin(users, eq(organisationActivityLog.userId, users.id))
		.where(whereClause)
		.orderBy(desc(organisationActivityLog.createdAt))
		.limit(limit)
		.offset(offset);

	// Get total count
	const [totalResult] = await db
		.select({ count: count() })
		.from(organisationActivityLog)
		.where(whereClause);

	return {
		logs,
		total: totalResult?.count ?? 0,
		limit,
		offset,
	};
});

// =============================================================================
// Freemium Management
// =============================================================================

const FreemiumOrganisationsFilterSchema = v.optional(
	v.object({
		search: v.optional(v.string()),
		reason: v.optional(v.string()),
		limit: v.optional(v.pipe(v.number(), v.minValue(1), v.maxValue(100))),
		offset: v.optional(v.pipe(v.number(), v.minValue(0))),
	}),
);

/**
 * Get all organisations with freemium status
 */
export const getFreemiumOrganisations = query(FreemiumOrganisationsFilterSchema, async (filters) => {
	await requireSuperAdmin();

	const { search, reason, limit = 50, offset = 0 } = filters || {};

	// Build where conditions - always filter for freemium organisations
	const conditions = [eq(organisations.isFreemium, true)];

	if (reason) {
		conditions.push(eq(organisations.freemiumReason, reason));
	}

	if (search) {
		const searchCondition = or(
			like(organisations.name, `%${search}%`),
			like(organisations.slug, `%${search}%`),
			like(organisations.email, `%${search}%`),
		);
		if (searchCondition) {
			conditions.push(searchCondition);
		}
	}

	// conditions always has at least one element (isFreemium filter)
	const whereClause = and(...conditions)!;

	// Get freemium organisations with owner info
	const organisationList = await db
		.select({
			id: organisations.id,
			name: organisations.name,
			slug: organisations.slug,
			email: organisations.email,
			status: organisations.status,
			isFreemium: organisations.isFreemium,
			freemiumReason: organisations.freemiumReason,
			freemiumExpiresAt: organisations.freemiumExpiresAt,
			freemiumGrantedAt: organisations.freemiumGrantedAt,
			freemiumGrantedBy: organisations.freemiumGrantedBy,
			createdAt: organisations.createdAt,
		})
		.from(organisations)
		.where(whereClause)
		.orderBy(desc(organisations.freemiumGrantedAt))
		.limit(limit)
		.offset(offset);

	// Get owner emails for each organisation
	const organisationIds = organisationList.map((a) => a.id);
	const owners =
		organisationIds.length > 0
			? await db
					.select({
						organisationId: organisationMemberships.organisationId,
						ownerEmail: users.email,
					})
					.from(organisationMemberships)
					.innerJoin(users, eq(organisationMemberships.userId, users.id))
					.where(
						and(
							sql`${organisationMemberships.organisationId} IN (${sql.join(
								organisationIds.map((id) => sql`${id}`),
								sql`, `,
							)})`,
							eq(organisationMemberships.role, "owner"),
						),
					)
			: [];

	// Create owner map
	const ownerMap = new Map(owners.map((o) => [o.organisationId, o.ownerEmail]));

	// Get total count
	const [totalResult] = await db.select({ count: count() }).from(organisations).where(whereClause);

	// Get stats by reason
	const reasonStats = await db
		.select({
			reason: organisations.freemiumReason,
			count: count(),
		})
		.from(organisations)
		.where(eq(organisations.isFreemium, true))
		.groupBy(organisations.freemiumReason);

	return {
		organisations: organisationList.map((a) => ({
			...a,
			ownerEmail: ownerMap.get(a.id) || null,
		})),
		total: totalResult?.count ?? 0,
		stats: Object.fromEntries(reasonStats.map((r) => [r.reason || "unknown", r.count])),
		limit,
		offset,
	};
});

/**
 * Revoke freemium status from an organisation
 */
export const revokeOrganisationFreemium = command(v.pipe(v.string(), v.uuid()), async (organisationId) => {
	await requireSuperAdmin();

	const [organisation] = await db
		.select({ id: organisations.id, isFreemium: organisations.isFreemium })
		.from(organisations)
		.where(eq(organisations.id, organisationId))
		.limit(1);

	if (!organisation) {
		throw error(404, "Organisation not found");
	}

	if (!organisation.isFreemium) {
		throw error(400, "Organisation does not have freemium status");
	}

	await db
		.update(organisations)
		.set({
			isFreemium: false,
			// Keep reason and dates for historical record
			updatedAt: new Date(),
		})
		.where(eq(organisations.id, organisationId));

	return { success: true };
});

const UpdateFreemiumExpirySchema = v.object({
	organisationId: v.pipe(v.string(), v.uuid()),
	expiresAt: v.nullable(v.pipe(v.string(), v.isoTimestamp())),
});

/**
 * Update freemium expiry date for an organisation
 */
export const updateFreemiumExpiry = command(UpdateFreemiumExpirySchema, async (data) => {
	await requireSuperAdmin();

	const { organisationId, expiresAt } = data;

	const [organisation] = await db
		.select({ id: organisations.id, isFreemium: organisations.isFreemium })
		.from(organisations)
		.where(eq(organisations.id, organisationId))
		.limit(1);

	if (!organisation) {
		throw error(404, "Organisation not found");
	}

	if (!organisation.isFreemium) {
		throw error(400, "Organisation does not have freemium status");
	}

	await db
		.update(organisations)
		.set({
			freemiumExpiresAt: expiresAt ? new Date(expiresAt) : null,
			updatedAt: new Date(),
		})
		.where(eq(organisations.id, organisationId));

	return { success: true };
});

// =============================================================================
// User Management (Super Admin)
// =============================================================================

const RemoveUserFromOrganisationSchema = v.object({
	userId: v.pipe(v.string(), v.uuid()),
	organisationId: v.pipe(v.string(), v.uuid()),
});

/**
 * Remove a user from a specific organisation
 * Deletes their membership but keeps the user account
 */
export const removeUserFromOrganisation = command(RemoveUserFromOrganisationSchema, async (data) => {
	await requireSuperAdmin();

	const { userId, organisationId } = data;

	// Check membership exists
	const [membership] = await db
		.select({ id: organisationMemberships.id, role: organisationMemberships.role })
		.from(organisationMemberships)
		.where(and(eq(organisationMemberships.userId, userId), eq(organisationMemberships.organisationId, organisationId)))
		.limit(1);

	if (!membership) {
		return { success: false, error: "User is not a member of this organisation" };
	}

	// Prevent removing the only owner
	if (membership.role === "owner") {
		const [ownerCount] = await db
			.select({ count: count() })
			.from(organisationMemberships)
			.where(and(eq(organisationMemberships.organisationId, organisationId), eq(organisationMemberships.role, "owner")));

		if ((ownerCount?.count ?? 0) <= 1) {
			return { success: false, error: "Cannot remove the only owner from an organisation" };
		}
	}

	// Delete the membership
	await db.delete(organisationMemberships).where(eq(organisationMemberships.id, membership.id));

	return { success: true };
});

const SuspendUserSchema = v.object({
	userId: v.pipe(v.string(), v.uuid()),
	reason: v.optional(v.string()),
});

/**
 * Suspend a user account
 * Prevents the user from logging in while preserving all their data
 */
export const suspendUser = command(SuspendUserSchema, async (data) => {
	const admin = await requireSuperAdmin();

	const { userId, reason } = data;

	// Cannot suspend yourself
	if (userId === admin.userId) {
		return { success: false, error: "Cannot suspend your own account" };
	}

	// Check user exists
	const [user] = await db
		.select({ id: users.id, suspended: users.suspended })
		.from(users)
		.where(eq(users.id, userId))
		.limit(1);

	if (!user) {
		return { success: false, error: "User not found" };
	}

	if (user.suspended) {
		return { success: false, error: "User is already suspended" };
	}

	await db
		.update(users)
		.set({
			suspended: true,
			suspendedAt: new Date(),
			suspendedReason: reason || null,
		})
		.where(eq(users.id, userId));

	return { success: true };
});

/**
 * Remove suspension from a user account
 * Restores their ability to log in
 */
export const unsuspendUser = command(v.pipe(v.string(), v.uuid()), async (userId) => {
	await requireSuperAdmin();

	// Check user exists
	const [user] = await db
		.select({ id: users.id, suspended: users.suspended })
		.from(users)
		.where(eq(users.id, userId))
		.limit(1);

	if (!user) {
		return { success: false, error: "User not found" };
	}

	if (!user.suspended) {
		return { success: false, error: "User is not suspended" };
	}

	await db
		.update(users)
		.set({
			suspended: false,
			suspendedAt: null,
			suspendedReason: null,
		})
		.where(eq(users.id, userId));

	return { success: true };
});

/**
 * Permanently delete a user account
 * Removes the user and all their organisation memberships
 */
export const deleteUser = command(v.pipe(v.string(), v.uuid()), async (userId) => {
	const admin = await requireSuperAdmin();

	// Cannot delete yourself
	if (userId === admin.userId) {
		return { success: false, error: "Cannot delete your own account" };
	}

	// Check user exists
	const [user] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1);

	if (!user) {
		return { success: false, error: "User not found" };
	}

	// Check if user is the only owner of any organisation
	const ownedOrganisations = await db
		.select({
			organisationId: organisationMemberships.organisationId,
			organisationName: organisations.name,
		})
		.from(organisationMemberships)
		.innerJoin(organisations, eq(organisationMemberships.organisationId, organisations.id))
		.where(and(eq(organisationMemberships.userId, userId), eq(organisationMemberships.role, "owner")));

	for (const owned of ownedOrganisations) {
		const [ownerCount] = await db
			.select({ count: count() })
			.from(organisationMemberships)
			.where(
				and(eq(organisationMemberships.organisationId, owned.organisationId), eq(organisationMemberships.role, "owner")),
			);

		if ((ownerCount?.count ?? 0) <= 1) {
			return {
				success: false,
				error: `Cannot delete user: they are the only owner of "${owned.organisationName}". Transfer ownership first.`,
			};
		}
	}

	// Delete all memberships first
	await db.delete(organisationMemberships).where(eq(organisationMemberships.userId, userId));

	// Delete the user
	await db.delete(users).where(eq(users.id, userId));

	return { success: true };
});
