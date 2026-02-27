/**
 * Super Admin Utilities
 *
 * Provides super admin access control and utilities for platform administration.
 * Super admins can manage all organisations, users, and view system-wide data.
 */

import { error } from "@sveltejs/kit";
import { db } from "$lib/server/db";
import { organisations, users } from "$lib/server/schema";
import { eq } from "drizzle-orm";
import { getUserId } from "$lib/server/auth";
import { getRequestEvent } from "$app/server";
import type { OrganisationContext } from "$lib/server/organisation";

// =============================================================================
// Super Admin Access Flag
// =============================================================================

/**
 * Super admin access flag (bit 16 = 65536)
 * Consistent with existing access flag pattern used for BasicPlan/PremiumPlan
 */
export const SUPER_ADMIN_FLAG = 0x0000000000010000; // 65536

/**
 * Check if a user has super admin access based on their access flags.
 */
export function isSuperAdmin(access: number): boolean {
	return (access & SUPER_ADMIN_FLAG) !== 0;
}

// =============================================================================
// Super Admin Cookie for Organisation Impersonation
// =============================================================================

const SUPER_ADMIN_ORGANISATION_COOKIE = "super_admin_organisation_id";

/**
 * Get the organisation ID the super admin is currently impersonating.
 */
export function getImpersonatedOrganisationId(): string | undefined {
	const event = getRequestEvent();
	return event?.cookies.get(SUPER_ADMIN_ORGANISATION_COOKIE);
}

/**
 * Set the organisation ID for super admin impersonation.
 */
export function setImpersonatedOrganisationId(organisationId: string): void {
	const event = getRequestEvent();
	event?.cookies.set(SUPER_ADMIN_ORGANISATION_COOKIE, organisationId, {
		path: "/",
		httpOnly: true,
		secure: process.env["NODE_ENV"] === "production",
		sameSite: "lax",
		maxAge: 60 * 60 * 4, // 4 hours (shorter for security)
	});
}

/**
 * Clear the super admin impersonation cookie.
 */
export function clearImpersonatedOrganisationId(): void {
	const event = getRequestEvent();
	event?.cookies.delete(SUPER_ADMIN_ORGANISATION_COOKIE, { path: "/" });
}

// =============================================================================
// Super Admin Guards
// =============================================================================

/**
 * Result type for requireSuperAdmin.
 */
export interface SuperAdminContext {
	userId: string;
	email: string;
	access: number;
}

/**
 * Require super admin access. Throws 403 if user is not a super admin.
 */
export async function requireSuperAdmin(): Promise<SuperAdminContext> {
	const userId = getUserId();

	const [user] = await db
		.select({
			id: users.id,
			email: users.email,
			access: users.access,
		})
		.from(users)
		.where(eq(users.id, userId))
		.limit(1);

	if (!user) {
		throw error(403, "User not found");
	}

	if (!isSuperAdmin(user.access)) {
		throw error(403, "Super admin access required");
	}

	return {
		userId: user.id,
		email: user.email,
		access: user.access,
	};
}

/**
 * Check if the current user is a super admin without throwing.
 */
export async function checkIsSuperAdmin(): Promise<boolean> {
	try {
		const userId = getUserId();

		const [user] = await db
			.select({ access: users.access })
			.from(users)
			.where(eq(users.id, userId))
			.limit(1);

		return user ? isSuperAdmin(user.access) : false;
	} catch {
		return false;
	}
}

// =============================================================================
// Virtual Organisation Context for Super Admin Impersonation
// =============================================================================

/**
 * Get a virtual "owner" organisation context for super admin impersonation.
 * This allows super admins to access any organisation as if they were the owner.
 */
export async function getVirtualOwnerContext(
	userId: string,
	organisationId: string,
): Promise<OrganisationContext | null> {
	// Verify user is super admin
	const [user] = await db
		.select({ access: users.access })
		.from(users)
		.where(eq(users.id, userId))
		.limit(1);

	if (!user || !isSuperAdmin(user.access)) {
		return null;
	}

	// Get organisation details
	const [organisation] = await db
		.select({
			id: organisations.id,
			name: organisations.name,
			slug: organisations.slug,
			logoUrl: organisations.logoUrl,
			primaryColor: organisations.primaryColor,
			secondaryColor: organisations.secondaryColor,
			accentColor: organisations.accentColor,
			status: organisations.status,
		})
		.from(organisations)
		.where(eq(organisations.id, organisationId))
		.limit(1);

	if (!organisation) {
		return null;
	}

	// Return virtual owner context
	return {
		organisationId: organisation.id,
		userId,
		role: "owner", // Super admins get owner-level access
		organisation: {
			id: organisation.id,
			name: organisation.name,
			slug: organisation.slug,
			logoUrl: organisation.logoUrl,
			primaryColor: organisation.primaryColor,
			secondaryColor: organisation.secondaryColor,
			accentColor: organisation.accentColor,
			status: organisation.status,
		},
	};
}
