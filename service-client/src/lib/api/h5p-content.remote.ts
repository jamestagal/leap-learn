/**
 * H5P Content Remote Functions
 *
 * Server-side functions for H5P content management.
 * Calls the Go service-core H5P content endpoints.
 */

import { query, command } from "$app/server";
import { getRequestEvent } from "$app/server";
import * as v from "valibot";
import { env } from "$env/dynamic/private";
import { getOrganisationContext } from "$lib/server/organisation";
import { error } from "@sveltejs/kit";
import type { ContentInfo, ContentListResponse } from "./h5p-content.types";

// =============================================================================
// Types
// =============================================================================

type SafeResponse<T> = {
	success: boolean;
	data?: T;
	message?: string;
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
		throw new Error(
			`H5P API unreachable: ${fetchErr instanceof Error ? fetchErr.message : "connection failed"}`,
		);
	}

	if (!response.ok) {
		const errorBody = await response
			.json()
			.catch(() => ({ message: "Unknown error" }));
		throw new Error(errorBody.message || `H5P API error: ${response.status}`);
	}

	return response.json();
}

// =============================================================================
// List Content
// =============================================================================

const ListContentSchema = v.optional(
	v.object({
		limit: v.optional(v.pipe(v.number(), v.minValue(1), v.maxValue(100))),
		offset: v.optional(v.pipe(v.number(), v.minValue(0))),
	}),
);

export const listContent = query(ListContentSchema, async (filters) => {
	const context = await getOrganisationContext();
	const { limit = 50, offset = 0 } = filters || {};

	const response = await callH5PAPI<ContentListResponse>(
		`/content?orgId=${context.organisationId}&limit=${limit}&offset=${offset}`,
	);

	if (!response.success || !response.data) {
		throw new Error(response.message || "Failed to list content");
	}

	return response.data;
});

// =============================================================================
// Get Content
// =============================================================================

const GetContentSchema = v.object({
	contentId: v.pipe(v.string(), v.uuid()),
});

export const getContent = query(GetContentSchema, async (data) => {
	const context = await getOrganisationContext();

	const response = await callH5PAPI<ContentInfo>(
		`/content/${data.contentId}?orgId=${context.organisationId}`,
	);

	if (!response.success || !response.data) {
		throw new Error(response.message || "Failed to get content");
	}

	return response.data;
});

// =============================================================================
// Delete Content
// =============================================================================

const DeleteContentSchema = v.object({
	contentId: v.pipe(v.string(), v.uuid()),
});

export const deleteContent = command(DeleteContentSchema, async (data) => {
	const context = await getOrganisationContext();

	let response: SafeResponse<{ deleted: boolean }>;
	try {
		response = await callH5PAPI<{ deleted: boolean }>(
			`/content/${data.contentId}?orgId=${context.organisationId}`,
			{ method: "DELETE" },
		);
	} catch (err) {
		throw error(
			500,
			err instanceof Error ? err.message : "Failed to delete content",
		);
	}

	if (!response.success) {
		throw error(500, response.message || "Failed to delete content");
	}

	return { deleted: true };
});

// =============================================================================
// Save Content From Editor
// =============================================================================

const SaveContentSchema = v.object({
	contentId: v.pipe(v.string(), v.uuid()),
	library: v.pipe(v.string(), v.minLength(1)),
	params: v.string(),
	title: v.string(), // May be empty — Go handler defaults to "Untitled"
});

export const saveContentFromEditor = command(
	SaveContentSchema,
	async (data) => {
		const context = await getOrganisationContext();

		let response: SafeResponse<ContentInfo>;
		try {
			response = await callH5PAPI<ContentInfo>(
				`/content/${data.contentId}/save`,
				{
					method: "POST",
					body: JSON.stringify({
						orgId: context.organisationId,
						library: data.library,
						params: JSON.parse(data.params),
						title: data.title || "Untitled",
					}),
				},
			);
		} catch (err) {
			throw error(
				500,
				err instanceof Error ? err.message : "Failed to save content",
			);
		}

		if (!response.success || !response.data) {
			throw error(500, response.message || "Failed to save content");
		}

		return response.data;
	},
);
