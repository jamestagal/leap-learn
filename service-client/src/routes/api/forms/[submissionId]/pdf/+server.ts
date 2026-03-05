/**
 * Form Submission PDF Generation API Endpoint
 *
 * GET /api/forms/[submissionId]/pdf - Download form submission as PDF
 *
 * Uses Gotenberg for HTML-to-PDF conversion with professional template.
 * Requires authentication and organisation membership.
 */

import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import {
	formSubmissions,
	organisationForms,
	organisations,
	organisationProfiles,
	organisationMemberships,
} from "$lib/server/schema";
import { and, eq } from "drizzle-orm";
import { generateFormSubmissionPdfHtml } from "$lib/templates/form-submission-pdf";
import { generatePdf } from "$lib/server/pdf";

export const GET: RequestHandler = async ({ params, locals }) => {
	const { submissionId } = params;

	if (!submissionId) {
		return json({ error: "Submission ID is required" }, { status: 400 });
	}

	// Require authentication
	const userId = locals.user?.id;
	if (!userId) {
		throw error(401, "Authentication required");
	}

	try {
		// Fetch submission with form
		const [result] = await db
			.select({
				submission: formSubmissions,
				form: organisationForms,
			})
			.from(formSubmissions)
			.leftJoin(
				organisationForms,
				eq(formSubmissions.formId, organisationForms.id),
			)
			.where(eq(formSubmissions.id, submissionId));

		if (!result || !result.submission) {
			return json({ error: "Submission not found" }, { status: 404 });
		}

		const { submission, form } = result;

		if (!form) {
			return json({ error: "Form not found" }, { status: 404 });
		}

		// Verify user is an active member of the submission's organisation
		const [membership] = await db
			.select({ id: organisationMemberships.id })
			.from(organisationMemberships)
			.where(
				and(
					eq(organisationMemberships.userId, userId),
					eq(
						organisationMemberships.organisationId,
						submission.organisationId,
					),
					eq(organisationMemberships.status, "active"),
				),
			);

		if (!membership) {
			throw error(403, "Access denied");
		}

		// Fetch organisation and profile
		const [organisation, profile] = await Promise.all([
			db.query.organisations.findFirst({
				where: eq(organisations.id, submission.organisationId),
			}),
			db.query.organisationProfiles.findFirst({
				where: eq(
					organisationProfiles.organisationId,
					submission.organisationId,
				),
			}),
		]);

		if (!organisation) {
			return json({ error: "Organisation not found" }, { status: 404 });
		}

		// Generate HTML
		const html = generateFormSubmissionPdfHtml({
			submission: {
				id: submission.id,
				clientBusinessName: submission.clientBusinessName,
				clientEmail: submission.clientEmail,
				data: submission.data as Record<string, unknown>,
				status: submission.status,
				submittedAt: submission.submittedAt,
				createdAt: submission.createdAt,
			},
			form: {
				name: form.name,
				schema: form.schema,
			},
			organisation,
			profile: profile || null,
		});

		// Generate PDF with shared utility (includes timeout)
		const pdfBuffer = await generatePdf(html);

		// Generate filename from client business name and form name
		const clientName = submission.clientBusinessName
			? submission.clientBusinessName
					.toLowerCase()
					.replace(/[^a-z0-9]+/g, "-")
					.replace(/^-|-$/g, "")
			: "submission";
		const formName = form.name
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-|-$/g, "");
		const dateStr = new Date().toISOString().split("T")[0];
		const filename = `${formName}-${clientName}-${dateStr}.pdf`;

		return new Response(pdfBuffer, {
			status: 200,
			headers: {
				"Content-Type": "application/pdf",
				"Content-Disposition": `attachment; filename="${filename}"`,
				"Content-Length": pdfBuffer.byteLength.toString(),
				"Cache-Control": "private, max-age=60",
			},
		});
	} catch (err) {
		// Re-throw SvelteKit errors (401, 403, etc.)
		if (err && typeof err === "object" && "status" in err) {
			throw err;
		}
		console.error("PDF generation error:", err);
		const message =
			err instanceof Error ? err.message : "PDF generation failed";
		return json({ error: message }, { status: 500 });
	}
};
