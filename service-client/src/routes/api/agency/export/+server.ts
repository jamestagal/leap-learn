/**
 * Organisation Data Export API Endpoint
 *
 * GET /api/organisation/export - Download organisation data as JSON file
 *
 * GDPR compliance endpoint for data portability.
 * Only accessible by organisation owners.
 */

import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { exportOrganisationData } from "$lib/api/gdpr.remote";

export const GET: RequestHandler = async () => {
	try {
		const exportData = await exportOrganisationData();

		const jsonString = JSON.stringify(exportData, null, 2);
		const filename = `organisation-export-${exportData.organisation.slug}-${new Date().toISOString().split("T")[0]}.json`;

		return new Response(jsonString, {
			status: 200,
			headers: {
				"Content-Type": "application/json",
				"Content-Disposition": `attachment; filename="${filename}"`,
				"Cache-Control": "no-store",
			},
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : "Export failed";
		const status = (err as { status?: number })?.status || 500;

		return json({ error: message }, { status });
	}
};
