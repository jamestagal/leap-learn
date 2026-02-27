import { db } from "$lib/server/db";
import { organisations, organisationMemberships, organisationFormOptions, users } from "$lib/server/schema";
import { eq, and, asc } from "drizzle-orm";
import { groupOptionsByCategory, mergeWithDefaults } from "$lib/stores/organisation-config.svelte";
import type { OrganisationConfig } from "$lib/stores/organisation-config.svelte";
import { getImpersonatedOrganisationId, isSuperAdmin } from "$lib/server/super-admin";

export const load: import("./$types").LayoutServerLoad = async ({ locals }) => {
	const userId = locals.user?.id;

	// Default response without organisation context
	let organisationConfig: OrganisationConfig | null = null;
	let currentOrganisation: {
		id: string;
		name: string;
		slug: string;
		logoUrl: string;
		primaryColor: string;
		secondaryColor: string;
		accentColor: string;
	} | null = null;
	let userRole: "owner" | "admin" | "member" | null = null;

	if (userId) {
		try {
			// Get user's default organisation or first organisation they belong to
			const [user] = await db
				.select({ defaultOrganisationId: users.defaultOrganisationId })
				.from(users)
				.where(eq(users.id, userId))
				.limit(1);

			let organisationId = user?.defaultOrganisationId;

			// If no default organisation, get organisation where user has highest role (owner > admin > member)
			if (!organisationId) {
				const memberships = await db
					.select({
						organisationId: organisationMemberships.organisationId,
						role: organisationMemberships.role,
					})
					.from(organisationMemberships)
					.where(and(eq(organisationMemberships.userId, userId), eq(organisationMemberships.status, "active")));

				// Prioritize by role: owner first, then admin, then member
				const roleOrder: Record<string, number> = { owner: 0, admin: 1, member: 2 };
				const sorted = memberships.sort(
					(a, b) => (roleOrder[a.role] ?? 3) - (roleOrder[b.role] ?? 3),
				);

				if (sorted.length > 0) {
					organisationId = sorted[0]?.organisationId;
				}
			}

			// If user has an organisation, load the context
			if (organisationId) {
				// Get organisation details and user's role
				const [result] = await db
					.select({
						organisationId: organisations.id,
						organisationName: organisations.name,
						organisationSlug: organisations.slug,
						logoUrl: organisations.logoUrl,
						primaryColor: organisations.primaryColor,
						secondaryColor: organisations.secondaryColor,
						accentColor: organisations.accentColor,
						role: organisationMemberships.role,
					})
					.from(organisationMemberships)
					.innerJoin(organisations, eq(organisationMemberships.organisationId, organisations.id))
					.where(
						and(
							eq(organisationMemberships.userId, userId),
							eq(organisationMemberships.organisationId, organisationId),
							eq(organisationMemberships.status, "active"),
							eq(organisations.status, "active"),
						),
					)
					.limit(1);

				if (result) {
					currentOrganisation = {
						id: result.organisationId,
						name: result.organisationName,
						slug: result.organisationSlug,
						logoUrl: result.logoUrl,
						primaryColor: result.primaryColor,
						secondaryColor: result.secondaryColor,
						accentColor: result.accentColor,
					};
					userRole = result.role as "owner" | "admin" | "member";

					// Load form options for this organisation
					const options = await db
						.select({
							category: organisationFormOptions.category,
							value: organisationFormOptions.value,
							label: organisationFormOptions.label,
							isDefault: organisationFormOptions.isDefault,
							sortOrder: organisationFormOptions.sortOrder,
							metadata: organisationFormOptions.metadata,
						})
						.from(organisationFormOptions)
						.where(
							and(eq(organisationFormOptions.organisationId, organisationId), eq(organisationFormOptions.isActive, true)),
						)
						.orderBy(asc(organisationFormOptions.category), asc(organisationFormOptions.sortOrder));

					// Group by category and merge with defaults
					const grouped = groupOptionsByCategory(
						options.map((opt) => ({
							...opt,
							metadata: opt.metadata as Record<string, unknown>,
						})),
					);
					organisationConfig = mergeWithDefaults(grouped);
				}
			}
		} catch (error) {
			// Log error but don't fail the page load
			console.error("Error loading organisation context:", error);
		}
	}

	// Check for super admin impersonation
	const userAccess = locals.user?.access ?? 0;
	const isSuperAdminUser = isSuperAdmin(userAccess);
	const impersonatedOrganisationId = getImpersonatedOrganisationId();

	return {
		access: userAccess,
		subscription_active: locals.user?.subscription_active ?? false,
		organisationConfig,
		currentOrganisation,
		userRole,
		isSuperAdmin: isSuperAdminUser,
		isImpersonating: isSuperAdminUser && !!impersonatedOrganisationId,
		impersonatedOrganisationId: isSuperAdminUser ? impersonatedOrganisationId : undefined,
	};
};
