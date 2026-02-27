/**
 * Organisation Context Helper for Remote Functions
 *
 * Provides organisation context utilities for multi-tenant operations.
 * Uses getRequestEvent() to access the current organisation from cookies/session.
 *
 * Adapted from BetterKit organization middleware patterns.
 */

import { getRequestEvent } from "$app/server";
import { error } from "@sveltejs/kit";
import { db } from "$lib/server/db";
import { organisations, organisationMemberships, users } from "$lib/server/schema";
import { eq, and } from "drizzle-orm";
import { getUserId } from "$lib/server/auth";
import type { OrganisationRole } from "$lib/server/schema";
import {
	getImpersonatedOrganisationId,
	getVirtualOwnerContext,
	isSuperAdmin,
} from "$lib/server/super-admin";

// Cookie name for storing current organisation
const CURRENT_ORGANISATION_COOKIE = "current_organisation_id";

/**
 * Organisation context returned by getOrganisationContext()
 */
export interface OrganisationContext {
	organisationId: string;
	userId: string;
	role: OrganisationRole;
	organisation: {
		id: string;
		name: string;
		slug: string;
		logoUrl: string;
		primaryColor: string;
		secondaryColor: string;
		accentColor: string;
		status: string;
	};
}

/**
 * Get the current organisation context for the authenticated user (read-only).
 *
 * Resolution order:
 * 1. Organisation ID from cookie (if user has access)
 * 2. User's default organisation (if set)
 * 3. First organisation user belongs to
 *
 * NOTE: This function is safe for use in query() functions as it doesn't
 * modify cookies. Use setOrganisationCookie() in commands if needed.
 *
 * Throws 403 if user has no organisation access.
 */
export async function getOrganisationContext(): Promise<OrganisationContext> {
	const userId = getUserId();
	const event = getRequestEvent();

	// Check for super admin impersonation first
	const impersonatedOrganisationId = getImpersonatedOrganisationId();
	if (impersonatedOrganisationId) {
		// Verify user is super admin
		const [user] = await db
			.select({ access: users.access })
			.from(users)
			.where(eq(users.id, userId))
			.limit(1);

		if (user && isSuperAdmin(user.access)) {
			const virtualContext = await getVirtualOwnerContext(userId, impersonatedOrganisationId);
			if (virtualContext) {
				return virtualContext;
			}
		}
	}

	// Try to get organisation ID from cookie
	let organisationId = event?.cookies.get(CURRENT_ORGANISATION_COOKIE);

	// If cookie has organisation ID, verify user has access
	if (organisationId) {
		const membership = await verifyMembership(userId, organisationId);
		if (!membership) {
			// Don't delete cookie in read-only context - just ignore it
			organisationId = undefined;
		}
	}

	// If no valid cookie, try user's default organisation
	if (!organisationId) {
		const [user] = await db
			.select({ defaultOrganisationId: users.defaultOrganisationId })
			.from(users)
			.where(eq(users.id, userId))
			.limit(1);

		if (user?.defaultOrganisationId) {
			const membership = await verifyMembership(userId, user.defaultOrganisationId);
			if (membership) {
				organisationId = user.defaultOrganisationId;
			}
		}
	}

	// If still no organisation, get organisation where user has highest role (owner > admin > member)
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
			organisationId = sorted[0]!.organisationId;
		}
	}

	// If user has no organisations, throw error
	if (!organisationId) {
		throw error(403, "No organisation access. Please create or join an organisation.");
	}

	// Get full context with organisation details
	const context = await getFullOrganisationContext(userId, organisationId);

	if (!context) {
		throw error(403, "Organisation access denied");
	}

	return context;
}

/**
 * Set the organisation cookie. Call this from command() functions after mutations.
 */
export function setOrganisationCookie(organisationId: string): void {
	const event = getRequestEvent();
	event?.cookies.set(CURRENT_ORGANISATION_COOKIE, organisationId, {
		path: "/",
		httpOnly: true,
		secure: process.env["NODE_ENV"] === "production",
		sameSite: "lax",
		maxAge: 60 * 60 * 24 * 30, // 30 days
	});
}

/**
 * Get organisation context for a specific organisation slug.
 * Used by slug-based routes like /[organisationSlug]/...
 */
export async function getOrganisationContextBySlug(slug: string): Promise<OrganisationContext> {
	const userId = getUserId();

	// Get organisation by slug
	const [organisation] = await db.select().from(organisations).where(eq(organisations.slug, slug)).limit(1);

	if (!organisation) {
		throw error(404, "Organisation not found");
	}

	// Verify user membership
	const context = await getFullOrganisationContext(userId, organisation.id);

	if (!context) {
		throw error(403, "You do not have access to this organisation");
	}

	return context;
}

/**
 * Switch the current organisation context.
 * Updates the cookie to the new organisation.
 */
export async function switchOrganisation(organisationId: string): Promise<void> {
	const userId = getUserId();
	const event = getRequestEvent();

	// Verify user has access to this organisation
	const membership = await verifyMembership(userId, organisationId);

	if (!membership) {
		throw error(403, "You do not have access to this organisation");
	}

	// Update cookie
	event?.cookies.set(CURRENT_ORGANISATION_COOKIE, organisationId, {
		path: "/",
		httpOnly: true,
		secure: process.env["NODE_ENV"] === "production",
		sameSite: "lax",
		maxAge: 60 * 60 * 24 * 30, // 30 days
	});
}

/**
 * Require a specific role to access an operation.
 * Throws 403 if user doesn't have required role.
 */
export async function requireOrganisationRole(
	allowedRoles: OrganisationRole[],
	organisationId?: string,
): Promise<OrganisationContext> {
	const context = organisationId
		? await getFullOrganisationContext(getUserId(), organisationId)
		: await getOrganisationContext();

	if (!context) {
		throw error(403, "Organisation access denied");
	}

	if (!allowedRoles.includes(context.role)) {
		throw error(403, `This action requires one of these roles: ${allowedRoles.join(", ")}`);
	}

	return context;
}

/**
 * Check if user has a specific role in the current organisation.
 * Returns false instead of throwing.
 */
export async function hasOrganisationRole(
	allowedRoles: OrganisationRole[],
	organisationId?: string,
): Promise<boolean> {
	try {
		const context = organisationId
			? await getFullOrganisationContext(getUserId(), organisationId)
			: await getOrganisationContext();

		return context ? allowedRoles.includes(context.role) : false;
	} catch {
		return false;
	}
}

/**
 * Get the current organisation ID without full context.
 * Returns undefined if user has no organisation.
 */
export async function getCurrentOrganisationId(): Promise<string | undefined> {
	try {
		const context = await getOrganisationContext();
		return context.organisationId;
	} catch {
		return undefined;
	}
}

// =============================================================================
// Internal Helpers
// =============================================================================

/**
 * Verify that a user has access to an organisation.
 * Returns the membership if valid, null otherwise.
 */
async function verifyMembership(userId: string, organisationId: string) {
	const [membership] = await db
		.select()
		.from(organisationMemberships)
		.where(
			and(
				eq(organisationMemberships.userId, userId),
				eq(organisationMemberships.organisationId, organisationId),
				eq(organisationMemberships.status, "active"),
			),
		)
		.limit(1);

	return membership || null;
}

/**
 * Get full organisation context with organisation details and role.
 */
async function getFullOrganisationContext(
	userId: string,
	organisationId: string,
): Promise<OrganisationContext | null> {
	// Get membership and organisation in one query
	const [result] = await db
		.select({
			membershipId: organisationMemberships.id,
			role: organisationMemberships.role,
			organisationId: organisations.id,
			organisationName: organisations.name,
			organisationSlug: organisations.slug,
			logoUrl: organisations.logoUrl,
			primaryColor: organisations.primaryColor,
			secondaryColor: organisations.secondaryColor,
			accentColor: organisations.accentColor,
			status: organisations.status,
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

	if (!result) {
		return null;
	}

	return {
		organisationId: result.organisationId,
		userId,
		role: result.role as OrganisationRole,
		organisation: {
			id: result.organisationId,
			name: result.organisationName,
			slug: result.organisationSlug,
			logoUrl: result.logoUrl,
			primaryColor: result.primaryColor,
			secondaryColor: result.secondaryColor,
			accentColor: result.accentColor,
			status: result.status,
		},
	};
}

// =============================================================================
// Role Permission Helpers
// =============================================================================

/**
 * Check if a role can perform admin actions.
 */
export function canAdminister(role: OrganisationRole): boolean {
	return role === "owner" || role === "admin";
}

/**
 * Check if a role can manage members.
 */
export function canManageMembers(role: OrganisationRole): boolean {
	return role === "owner" || role === "admin";
}

/**
 * Check if a role can update organisation settings.
 */
export function canUpdateSettings(role: OrganisationRole): boolean {
	return role === "owner" || role === "admin";
}

/**
 * Check if a role can delete the organisation.
 */
export function canDeleteOrganisation(role: OrganisationRole): boolean {
	return role === "owner";
}

/**
 * Check if a role can transfer ownership.
 */
export function canTransferOwnership(role: OrganisationRole): boolean {
	return role === "owner";
}

// =============================================================================
// Slug Utilities
// =============================================================================

/**
 * Reserved slugs that cannot be used as organisation slugs.
 */
export const RESERVED_SLUGS = [
	"admin",
	"dashboard",
	"settings",
	"organisations",
	"api",
	"auth",
	"super-admin",
	"consultation",
	"login",
	"logout",
	"signup",
	"register",
	"profile",
	"account",
];

/**
 * Generate a slug from an organisation name.
 */
export function generateSlug(name: string): string {
	return name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "")
		.slice(0, 50);
}

/**
 * Check if a slug is valid (not reserved and proper format).
 */
export function isValidSlug(slug: string): boolean {
	if (RESERVED_SLUGS.includes(slug)) {
		return false;
	}

	// Must be lowercase alphanumeric with hyphens, 3-50 chars
	return /^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/.test(slug);
}

/**
 * Check if a slug is available (not already in use).
 */
export async function isSlugAvailable(slug: string): Promise<boolean> {
	if (!isValidSlug(slug)) {
		return false;
	}

	const [existing] = await db
		.select({ id: organisations.id })
		.from(organisations)
		.where(eq(organisations.slug, slug))
		.limit(1);

	return !existing;
}
