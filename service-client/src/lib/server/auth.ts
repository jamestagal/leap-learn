/**
 * Auth Helper for Remote Functions
 *
 * Provides authentication utilities for remote functions.
 * Uses getRequestEvent() to access the authenticated user from hooks.server.ts.
 */

import { getRequestEvent } from "$app/server";
import { error } from "@sveltejs/kit";

/**
 * Get the authenticated user ID from the current request.
 * Throws 401 if not authenticated.
 */
export function getUserId(): string {
	const event = getRequestEvent();

	if (!event) {
		throw error(500, "No request event available");
	}

	const userId = event.locals.user?.id;

	if (!userId) {
		throw error(401, "Not authenticated");
	}

	return userId;
}

/**
 * Get the full authenticated user object.
 * Throws 401 if not authenticated.
 */
export function getUser() {
	const event = getRequestEvent();

	if (!event) {
		throw error(500, "No request event available");
	}

	const user = event.locals.user;

	if (!user?.id) {
		throw error(401, "Not authenticated");
	}

	return user;
}

/**
 * Check if the current user is authenticated.
 * Returns false instead of throwing.
 */
export function isAuthenticated(): boolean {
	const event = getRequestEvent();

	if (!event) {
		return false;
	}

	return Boolean(event.locals.user?.id);
}

/**
 * Require authentication - throws 401 if not authenticated.
 * Use as a guard at the start of remote functions.
 */
export function requireAuth(): void {
	getUserId(); // Throws if not authenticated
}

/**
 * Get the access token for the current user.
 * Useful for making authenticated requests to other services.
 */
export function getAccessToken(): string | undefined {
	const event = getRequestEvent();
	return event?.locals.token;
}

/**
 * Get the current organisation ID from the organisation context.
 * Throws 403 if no organisation context is available.
 *
 * This is an async wrapper that calls getOrganisationContext() internally.
 * Use for remote functions that need the organisation ID.
 */
export async function getOrganisationId(): Promise<string> {
	// Import dynamically to avoid circular dependencies
	const { getOrganisationContext } = await import("./organisation");
	const context = await getOrganisationContext();
	return context.organisationId;
}
