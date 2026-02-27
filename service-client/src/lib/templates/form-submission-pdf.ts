/**
 * Form Submission PDF HTML Template
 *
 * Generates professional A4 form submission PDF for Gotenberg conversion.
 * Uses DYNAMIC sections based on form schema (unlike hardcoded questionnaire template).
 * Uses inline styles for maximum PDF compatibility.
 */

import type { Organisation, OrganisationProfile } from "$lib/server/schema";
import type { FormSchema, FormStep, FormField } from "$lib/types/form-builder";
import { formatDate as _formatDate } from "$lib/utils/formatting";

export interface FormSubmissionPdfData {
	submission: {
		id: string;
		clientBusinessName: string;
		clientEmail: string;
		data: Record<string, unknown>;
		status: string;
		submittedAt: Date | string | null;
		createdAt: Date | string;
	};
	form: {
		name: string;
		schema: FormSchema | string;
	};
	organisation: Organisation;
	profile: OrganisationProfile | null;
}

/**
 * Format a date for display, returning "Not provided" for null values
 */
function formatDate(date: Date | string | null): string {
	if (!date) return "Not provided";
	return _formatDate(date, "long");
}

/**
 * Get status badge styling
 */
function getStatusStyle(status: string): { bg: string; text: string } {
	switch (status) {
		case "completed":
			return { bg: "#dcfce7", text: "#166534" };
		case "draft":
		case "in_progress":
			return { bg: "#fef3c7", text: "#92400e" };
		case "processed":
			return { bg: "#dbeafe", text: "#1e40af" };
		case "archived":
			return { bg: "#f3f4f6", text: "#6b7280" };
		default:
			return { bg: "#f3f4f6", text: "#6b7280" };
	}
}

/**
 * Format a value for display, handling empty/null values
 */
function formatValue(value: unknown): string {
	if (value === null || value === undefined || value === "") {
		return '<span style="color: #9ca3af; font-style: italic;">Not provided</span>';
	}
	if (typeof value === "boolean") {
		return value ? "Yes" : "No";
	}
	if (Array.isArray(value)) {
		if (value.length === 0) {
			return '<span style="color: #9ca3af; font-style: italic;">Not provided</span>';
		}
		return value.join(", ");
	}
	if (typeof value === "string") {
		// Handle yes/no string values
		if (value.toLowerCase() === "yes") return "Yes";
		if (value.toLowerCase() === "no") return "No";
		// Escape HTML and preserve line breaks
		return value
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/\n/g, "<br>");
	}
	return String(value);
}

/**
 * Format yes/no values with visual indicator
 */
function formatYesNo(value: unknown): string {
	if (value === null || value === undefined || value === "") {
		return '<span style="color: #9ca3af; font-style: italic;">Not provided</span>';
	}
	const isYes =
		value === "yes" || value === true || value === "true" || value === "Yes";
	const isNo =
		value === "no" || value === false || value === "false" || value === "No";

	if (isYes) {
		return '<span style="display: inline-block; padding: 2px 10px; background: #dcfce7; color: #166534; border-radius: 4px; font-weight: 500;">Yes</span>';
	}
	if (isNo) {
		return '<span style="display: inline-block; padding: 2px 10px; background: #fee2e2; color: #991b1b; border-radius: 4px; font-weight: 500;">No</span>';
	}
	return formatValue(value);
}

/**
 * Check if a field is a yes/no type based on its options
 */
function isYesNoField(field: FormField): boolean {
	if (field.type !== "radio" && field.type !== "select") return false;
	if (!field.options || field.options.length !== 2) return false;

	const values = field.options.map((o) => o.value.toLowerCase());
	return values.includes("yes") && values.includes("no");
}

/**
 * Render a field row
 */
function renderField(label: string, value: unknown, isYesNo = false): string {
	const formattedValue = isYesNo ? formatYesNo(value) : formatValue(value);
	return `
		<div style="margin-bottom: 16px;">
			<div style="font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">${label}</div>
			<div style="font-size: 14px; color: #374151; line-height: 1.6;">${formattedValue}</div>
		</div>
	`;
}

/**
 * Render a section
 */
function renderSection(
	number: number,
	title: string,
	content: string,
	accentColor: string,
): string {
	return `
		<div style="margin-bottom: 32px; page-break-inside: avoid;">
			<div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 2px solid ${accentColor};">
				<div style="width: 32px; height: 32px; background: ${accentColor}; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px;">${number}</div>
				<h2 style="font-size: 18px; font-weight: 600; color: #111827; margin: 0;">${title}</h2>
			</div>
			<div style="padding-left: 44px;">
				${content}
			</div>
		</div>
	`;
}

/**
 * Render dynamic sections from form schema
 */
function renderDynamicSections(
	steps: FormStep[],
	data: Record<string, unknown>,
	accentColor: string,
): string {
	return steps
		.map((step, index) => {
			// Skip layout-only fields (heading, paragraph, divider)
			const dataFields = step.fields.filter(
				(f) => !["heading", "paragraph", "divider"].includes(f.type),
			);

			const fieldsHtml = dataFields
				.map((field) => {
					const value = data[field.id];
					// Skip empty values
					if (value === undefined || value === null || value === "") {
						return "";
					}

					const isYesNo = isYesNoField(field);
					return renderField(field.label, value, isYesNo);
				})
				.filter(Boolean)
				.join("");

			// Skip sections with no filled fields
			if (!fieldsHtml) return "";

			return renderSection(index + 1, step.title, fieldsHtml, accentColor);
		})
		.filter(Boolean)
		.join("");
}

/**
 * Generate form submission PDF HTML
 */
export function generateFormSubmissionPdfHtml(
	data: FormSubmissionPdfData,
): string {
	const { submission, form, organisation } = data;

	// Parse schema if it's a string
	const schema: FormSchema =
		typeof form.schema === "string" ? JSON.parse(form.schema) : form.schema;

	// Parse submission data if needed
	const submissionData: Record<string, unknown> =
		typeof submission.data === "string"
			? JSON.parse(submission.data)
			: submission.data;

	const statusStyle = getStatusStyle(submission.status);

	// Use organisation branding
	const logoUrl = organisation.logoUrl;
	const accentColor = organisation.primaryColor || "#6366f1";

	// Render all sections from schema
	const sectionsHtml = renderDynamicSections(
		schema.steps,
		submissionData,
		accentColor,
	);

	// Format status for display
	const statusLabel = submission.status.replace("_", " ");

	return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>${form.name} - ${submission.clientBusinessName || "Response"}</title>
	<style>
		@page {
			size: A4;
			margin: 15mm;
		}
		* {
			margin: 0;
			padding: 0;
			box-sizing: border-box;
		}
		body {
			font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
			font-size: 14px;
			line-height: 1.5;
			color: #374151;
			background: white;
		}
		.container {
			max-width: 800px;
			margin: 0 auto;
		}
	</style>
</head>
<body>
	<div class="container">
		<!-- Header -->
		<div style="display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 24px; margin-bottom: 24px; border-bottom: 3px solid ${accentColor};">
			<div>
				${
					logoUrl
						? `<img src="${logoUrl}" alt="${organisation.name}" style="max-height: 50px; max-width: 180px; object-fit: contain; margin-bottom: 8px;">`
						: `<div style="font-size: 22px; font-weight: bold; color: ${accentColor};">${organisation.name}</div>`
				}
			</div>
			<div style="text-align: right;">
				<div style="font-size: 22px; font-weight: bold; color: #111827; margin-bottom: 4px;">${form.name}</div>
				<div style="font-size: 14px; color: #6b7280;">Form Submission</div>
			</div>
		</div>

		<!-- Client Info Box -->
		<div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin-bottom: 32px; border-left: 4px solid ${accentColor};">
			<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
				<div>
					<div style="font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">Client</div>
					<div style="font-size: 16px; font-weight: 600; color: #111827;">${submission.clientBusinessName || "Not provided"}</div>
				</div>
				<div style="text-align: right;">
					<div style="font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">Status</div>
					<span style="display: inline-block; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 600; background: ${statusStyle.bg}; color: ${statusStyle.text}; text-transform: capitalize;">
						${statusLabel}
					</span>
				</div>
				<div>
					<div style="font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">Email</div>
					<div style="font-size: 14px; color: #374151;">${submission.clientEmail || "Not provided"}</div>
				</div>
				<div style="text-align: right;">
					<div style="font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">Submitted</div>
					<div style="font-size: 14px; color: #374151;">${formatDate(submission.submittedAt)}</div>
				</div>
			</div>
		</div>

		<!-- Dynamic Sections -->
		${sectionsHtml}

		<!-- Footer -->
		<div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 12px; color: #9ca3af;">
			<div>Generated on ${formatDate(new Date())} by ${organisation.name}</div>
			${organisation.website ? `<div style="margin-top: 4px;">${organisation.website}</div>` : ""}
		</div>
	</div>
</body>
</html>`;
}
