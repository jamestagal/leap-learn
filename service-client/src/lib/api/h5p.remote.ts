/**
 * H5P Remote Functions
 *
 * Server-side functions for H5P library management.
 * Calls the Go service-core H5P endpoints.
 */

import { query, command } from "$app/server";
import { getRequestEvent } from "$app/server";
import * as v from "valibot";
import { env } from "$env/dynamic/private";
import { getOrganisationContext } from "$lib/server/organisation";
import { hasPermission } from "$lib/server/permissions";
import { error } from "@sveltejs/kit";

// =============================================================================
// Types
// =============================================================================

type SafeResponse<T> = {
	success: boolean;
	data?: T;
	message?: string;
	code?: number;
};

type ContentTypeCacheEntry = {
	id: string;
	title: string;
	summary: string;
	description: string;
	icon: string;
	majorVersion: number;
	minorVersion: number;
	patchVersion: number;
	isRecommended: boolean;
	popularity: number;
	screenshots: { url: string; alt: string }[];
	keywords: string[];
	categories: string[];
	owner: string;
	example: string;
	installed: boolean;
	localVersion: string;
	updateAvailable: boolean;
};

type LibraryInfo = {
	id: string;
	machineName: string;
	majorVersion: number;
	minorVersion: number;
	patchVersion: number;
	title: string;
	description: string;
	icon: string;
	runnable: boolean;
	origin: string;
	installed: boolean;
};

// =============================================================================
// Helper to call Go service
// =============================================================================

async function callH5PAPI<T>(
	endpoint: string,
	options: RequestInit = {},
): Promise<SafeResponse<T>> {
	const event = getRequestEvent();
	const accessToken = event.cookies.get("access_token");

	let response: Response;
	try {
		response = await fetch(`${env.CORE_URL}/api/v1/h5p${endpoint}`, {
			...options,
			headers: {
				"Content-Type": "application/json",
				...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
				...options.headers,
			},
		});
	} catch (fetchErr) {
		// Connection refused, network error, etc. — throw regular Error so callers can catch
		throw new Error(`H5P API unreachable: ${fetchErr instanceof Error ? fetchErr.message : "connection failed"}`);
	}

	if (!response.ok) {
		const errorBody = await response.json().catch(() => ({ message: "Unknown error" }));
		// Throw regular Error (not SvelteKit error()) so page.server.ts can catch gracefully
		throw new Error(errorBody.message || `H5P API error: ${response.status}`);
	}

	return response.json();
}

// =============================================================================
// Content Type Cache (Hub Browser)
// =============================================================================

/**
 * Get cached content type list from the H5P Hub.
 * Includes install status for each content type.
 */
export const getContentTypeCache = query(async () => {
	const response = await callH5PAPI<ContentTypeCacheEntry[]>("/content-type-cache");

	if (!response.success || !response.data) {
		throw new Error(response.message || "Failed to get content type cache");
	}

	return response.data;
});

// =============================================================================
// Install Library
// =============================================================================

const InstallLibrarySchema = v.object({
	machineName: v.pipe(v.string(), v.minLength(1)),
});

/**
 * Install an H5P library from the Hub.
 * Platform-wide operation — requires admin permissions.
 */
export const installLibrary = command(InstallLibrarySchema, async (data) => {
	const context = await getOrganisationContext();

	if (!hasPermission(context.role, "settings:edit")) {
		throw error(403, "Permission denied: only admins can install libraries");
	}

	let response: SafeResponse<LibraryInfo>;
	try {
		response = await callH5PAPI<LibraryInfo>("/install", {
			method: "POST",
			body: JSON.stringify({ machineName: data.machineName }),
		});
	} catch (err) {
		throw error(500, err instanceof Error ? err.message : "Failed to connect to H5P service");
	}

	if (!response.success || !response.data) {
		throw error(500, response.message || "Failed to install library");
	}

	return response.data;
});

// =============================================================================
// List Installed Libraries
// =============================================================================

/**
 * Get all installed H5P libraries.
 */
export const getInstalledLibraries = query(async () => {
	const response = await callH5PAPI<LibraryInfo[]>("/libraries");

	if (!response.success || !response.data) {
		throw new Error(response.message || "Failed to get installed libraries");
	}

	return response.data;
});

// =============================================================================
// Delete Library
// =============================================================================

const DeleteLibrarySchema = v.object({
	machineName: v.pipe(v.string(), v.minLength(1)),
});

/**
 * Delete an H5P library.
 * Platform-wide operation — requires admin permissions.
 */
export const deleteLibrary = command(DeleteLibrarySchema, async (data) => {
	const context = await getOrganisationContext();

	if (!hasPermission(context.role, "settings:edit")) {
		throw error(403, "Permission denied: only admins can delete libraries");
	}

	let response: SafeResponse<{ deleted: boolean }>;
	try {
		response = await callH5PAPI<{ deleted: boolean }>(
			`/libraries/${encodeURIComponent(data.machineName)}`,
			{ method: "DELETE" },
		);
	} catch (err) {
		throw error(500, err instanceof Error ? err.message : "Failed to connect to H5P service");
	}

	if (!response.success) {
		throw error(500, response.message || "Failed to delete library");
	}

	return { deleted: true };
});

// =============================================================================
// Org Library Enable/Disable
// =============================================================================

const OrgLibrarySchema = v.object({
	libraryId: v.pipe(v.string(), v.uuid()),
});

/**
 * Enable a library for the current organisation.
 */
export const enableOrgLibrary = command(OrgLibrarySchema, async (data) => {
	const context = await getOrganisationContext();

	if (!hasPermission(context.role, "settings:edit")) {
		throw error(403, "Permission denied");
	}

	let response: SafeResponse<{ enabled: boolean }>;
	try {
		response = await callH5PAPI<{ enabled: boolean }>("/org-libraries/enable", {
			method: "POST",
			body: JSON.stringify({
				orgId: context.organisationId,
				libraryId: data.libraryId,
			}),
		});
	} catch (err) {
		throw error(500, err instanceof Error ? err.message : "Failed to connect to H5P service");
	}

	if (!response.success) {
		throw error(500, response.message || "Failed to enable library");
	}

	return { enabled: true };
});

/**
 * Disable a library for the current organisation.
 */
export const disableOrgLibrary = command(OrgLibrarySchema, async (data) => {
	const context = await getOrganisationContext();

	if (!hasPermission(context.role, "settings:edit")) {
		throw error(403, "Permission denied");
	}

	let response: SafeResponse<{ disabled: boolean }>;
	try {
		response = await callH5PAPI<{ disabled: boolean }>("/org-libraries/disable", {
			method: "POST",
			body: JSON.stringify({
				orgId: context.organisationId,
				libraryId: data.libraryId,
			}),
		});
	} catch (err) {
		throw error(500, err instanceof Error ? err.message : "Failed to connect to H5P service");
	}

	if (!response.success) {
		throw error(500, response.message || "Failed to disable library");
	}

	return { disabled: true };
});
