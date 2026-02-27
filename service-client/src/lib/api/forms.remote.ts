/**
 * Forms Remote Functions
 *
 * CRUD operations for organisation forms using the Form Builder system.
 * Follows the remote functions pattern with Valibot validation.
 */

import { query, command } from "$app/server";
import * as v from "valibot";
import { db } from "$lib/server/db";
import {
	organisationForms,
	formSubmissions,
	formTemplates,
	fieldOptionSets,
} from "$lib/server/schema";
import { error } from "@sveltejs/kit";
import { getUserId } from "$lib/server/auth";
import { getOrganisationContext, requireOrganisationRole } from "$lib/server/organisation";
import { eq, and, desc, asc, isNull, or, sql } from "drizzle-orm";
import type { RawFormSchema } from "$lib/types/form-builder";

// =============================================================================
// Validation Schemas
// =============================================================================

const FormTypeSchema = v.picklist([
	"questionnaire",
	"consultation",
	"feedback",
	"intake",
	"custom",
]);

const CreateFormSchema = v.object({
	name: v.pipe(v.string(), v.minLength(1), v.maxLength(255)),
	slug: v.pipe(v.string(), v.minLength(1), v.maxLength(255)),
	description: v.optional(v.string()),
	formType: FormTypeSchema,
	schema: v.any(), // FormSchema JSON
	uiConfig: v.optional(v.any()),
	branding: v.optional(v.any()),
	isActive: v.optional(v.boolean()),
	isDefault: v.optional(v.boolean()),
	requiresAuth: v.optional(v.boolean()),
});

const UpdateFormSchema = v.object({
	id: v.pipe(v.string(), v.uuid()),
	name: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(255))),
	slug: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(255))),
	description: v.optional(v.nullable(v.string())),
	formType: v.optional(FormTypeSchema),
	schema: v.optional(v.any()),
	uiConfig: v.optional(v.any()),
	branding: v.optional(v.nullable(v.any())),
	isActive: v.optional(v.boolean()),
	isDefault: v.optional(v.boolean()),
	requiresAuth: v.optional(v.boolean()),
});

const SubmitFormSchema = v.object({
	formId: v.pipe(v.string(), v.uuid()),
	data: v.any(), // Form submission data as JSON
	metadata: v.optional(v.any()),
});

// =============================================================================
// Query Functions (Read Operations)
// =============================================================================

/**
 * Get all forms for the current organisation.
 */
export const getOrganisationForms = query(
	v.optional(
		v.object({
			formType: v.optional(FormTypeSchema),
			activeOnly: v.optional(v.boolean()),
		})
	),
	async (filters) => {
		const context = await getOrganisationContext();
		const { formType, activeOnly = false } = filters || {};

		const conditions = [eq(organisationForms.organisationId, context.organisationId)];

		if (formType) {
			conditions.push(eq(organisationForms.formType, formType));
		}

		if (activeOnly) {
			conditions.push(eq(organisationForms.isActive, true));
		}

		const forms = await db
			.select()
			.from(organisationForms)
			.where(and(...conditions))
			.orderBy(desc(organisationForms.updatedAt));

		return forms;
	}
);

/**
 * Get a single form by ID.
 */
export const getFormById = query(v.pipe(v.string(), v.uuid()), async (formId) => {
	const context = await getOrganisationContext();

	const [form] = await db
		.select()
		.from(organisationForms)
		.where(and(eq(organisationForms.id, formId), eq(organisationForms.organisationId, context.organisationId)));

	if (!form) {
		throw error(404, "Form not found");
	}

	return form;
});

/**
 * Get a form by slug (for public form access).
 * Does not require authentication - used for client-facing forms.
 */
export const getFormBySlug = query(
	v.object({
		organisationSlug: v.pipe(v.string(), v.minLength(1)),
		formSlug: v.pipe(v.string(), v.minLength(1)),
	}),
	async ({ organisationSlug, formSlug }) => {
		// This is a public endpoint - no auth required
		// Import organisations here to avoid circular dependencies
		const { organisations } = await import("$lib/server/schema");

		const [result] = await db
			.select({
				form: organisationForms,
			})
			.from(organisationForms)
			.innerJoin(organisations, eq(organisationForms.organisationId, organisations.id))
			.where(
				and(
					eq(organisations.slug, organisationSlug),
					eq(organisationForms.slug, formSlug),
					eq(organisationForms.isActive, true)
				)
			);

		if (!result) {
			throw error(404, "Form not found");
		}

		return result.form;
	}
);

/**
 * Get the default form for a specific type.
 */
export const getDefaultForm = query(FormTypeSchema, async (formType) => {
	const context = await getOrganisationContext();

	const [form] = await db
		.select()
		.from(organisationForms)
		.where(
			and(
				eq(organisationForms.organisationId, context.organisationId),
				eq(organisationForms.formType, formType),
				eq(organisationForms.isDefault, true),
				eq(organisationForms.isActive, true)
			)
		);

	return form || null;
});

/**
 * Get all system form templates.
 */
export const getFormTemplates = query(
	v.optional(
		v.object({
			category: v.optional(v.string()),
		})
	),
	async (filters) => {
		const { category } = filters || {};

		const conditions = [];
		if (category) {
			conditions.push(eq(formTemplates.category, category));
		}

		const templates = await db
			.select()
			.from(formTemplates)
			.where(conditions.length > 0 ? and(...conditions) : undefined)
			.orderBy(asc(formTemplates.displayOrder), asc(formTemplates.name));

		return templates;
	}
);

/**
 * Get a single system form template by slug.
 */
export const getFormTemplateBySlug = query(
	v.pipe(v.string(), v.minLength(1)),
	async (slug) => {
		const [template] = await db
			.select()
			.from(formTemplates)
			.where(eq(formTemplates.slug, slug));

		if (!template) {
			throw error(404, "Template not found");
		}

		return template;
	}
);

/**
 * Get field option sets (system-wide and organisation-specific).
 */
export const getFieldOptionSets = query(async () => {
	const context = await getOrganisationContext();

	// Get both system-wide options (organisation_id IS NULL) and organisation-specific options
	const optionSets = await db
		.select()
		.from(fieldOptionSets)
		.where(or(isNull(fieldOptionSets.organisationId), eq(fieldOptionSets.organisationId, context.organisationId)))
		.orderBy(asc(fieldOptionSets.name));

	return optionSets;
});

/**
 * Get a specific field option set by slug.
 */
export const getFieldOptionSetBySlug = query(
	v.pipe(v.string(), v.minLength(1)),
	async (slug) => {
		const context = await getOrganisationContext();

		// First try organisation-specific, then fall back to system-wide
		const [optionSet] = await db
			.select()
			.from(fieldOptionSets)
			.where(
				and(
					eq(fieldOptionSets.slug, slug),
					or(isNull(fieldOptionSets.organisationId), eq(fieldOptionSets.organisationId, context.organisationId))
				)
			)
			.orderBy(desc(fieldOptionSets.organisationId)); // Organisation-specific first

		return optionSet || null;
	}
);

/**
 * Get form submissions for a specific form.
 */
export const getFormSubmissions = query(
	v.object({
		formId: v.pipe(v.string(), v.uuid()),
		status: v.optional(v.picklist(["draft", "completed", "processing", "processed", "archived"])),
		limit: v.optional(v.pipe(v.number(), v.minValue(1), v.maxValue(100))),
		offset: v.optional(v.pipe(v.number(), v.minValue(0))),
	}),
	async ({ formId, status, limit = 50, offset = 0 }) => {
		const context = await getOrganisationContext();

		// Verify form belongs to organisation
		const [form] = await db
			.select({ id: organisationForms.id })
			.from(organisationForms)
			.where(and(eq(organisationForms.id, formId), eq(organisationForms.organisationId, context.organisationId)));

		if (!form) {
			throw error(404, "Form not found");
		}

		const conditions = [eq(formSubmissions.formId, formId)];
		if (status) {
			conditions.push(eq(formSubmissions.status, status));
		}

		const submissions = await db
			.select()
			.from(formSubmissions)
			.where(and(...conditions))
			.orderBy(desc(formSubmissions.submittedAt))
			.limit(limit)
			.offset(offset);

		return submissions;
	}
);

// =============================================================================
// Command Functions (Write Operations)
// =============================================================================

/**
 * Create a new form.
 * Requires admin or owner role.
 */
export const createForm = command(CreateFormSchema, async (data) => {
	const context = await requireOrganisationRole(["owner", "admin"]);
	const userId = getUserId();

	// Check for unique slug within organisation
	const [existing] = await db
		.select({ id: organisationForms.id })
		.from(organisationForms)
		.where(and(eq(organisationForms.organisationId, context.organisationId), eq(organisationForms.slug, data.slug)));

	if (existing) {
		throw error(400, "A form with this slug already exists");
	}

	// If this is marked as default, unset other defaults of the same type
	if (data.isDefault) {
		await db
			.update(organisationForms)
			.set({ isDefault: false })
			.where(
				and(eq(organisationForms.organisationId, context.organisationId), eq(organisationForms.formType, data.formType))
			);
	}

	const [form] = await db
		.insert(organisationForms)
		.values({
			organisationId: context.organisationId,
			name: data.name,
			slug: data.slug,
			description: data.description || null,
			formType: data.formType,
			schema: data.schema as RawFormSchema,
			uiConfig: data.uiConfig || {
				layout: "single-column",
				showProgressBar: true,
				showStepNumbers: true,
				submitButtonText: "Submit",
				successMessage: "Thank you for your submission!",
			},
			branding: data.branding || null,
			isActive: data.isActive ?? true,
			isDefault: data.isDefault ?? false,
			requiresAuth: data.requiresAuth ?? false,
			version: 1,
			createdBy: userId,
		})
		.returning();

	return form;
});

/**
 * Update an existing form.
 * Requires admin or owner role.
 */
export const updateForm = command(UpdateFormSchema, async (data) => {
	const context = await requireOrganisationRole(["owner", "admin"]);

	// Verify form belongs to organisation
	const [existing] = await db
		.select()
		.from(organisationForms)
		.where(and(eq(organisationForms.id, data.id), eq(organisationForms.organisationId, context.organisationId)));

	if (!existing) {
		throw error(404, "Form not found");
	}

	// Check slug uniqueness if changing
	if (data.slug && data.slug !== existing.slug) {
		const [slugExists] = await db
			.select({ id: organisationForms.id })
			.from(organisationForms)
			.where(and(eq(organisationForms.organisationId, context.organisationId), eq(organisationForms.slug, data.slug)));

		if (slugExists) {
			throw error(400, "A form with this slug already exists");
		}
	}

	// If setting as default, unset other defaults
	if (data.isDefault) {
		const formType = data.formType || existing.formType;
		await db
			.update(organisationForms)
			.set({ isDefault: false })
			.where(and(eq(organisationForms.organisationId, context.organisationId), eq(organisationForms.formType, formType)));
	}

	// Build update object
	const updates: Record<string, unknown> = {
		updatedAt: new Date(),
	};

	if (data["name"] !== undefined) updates["name"] = data["name"];
	if (data["slug"] !== undefined) updates["slug"] = data["slug"];
	if (data["description"] !== undefined) updates["description"] = data["description"];
	if (data["formType"] !== undefined) updates["formType"] = data["formType"];
	if (data["schema"] !== undefined) {
		updates["schema"] = data["schema"];
		updates["version"] = existing.version + 1;
		// Schema change marks the form as customized (no longer receives push updates)
		if (existing.sourceTemplateId) {
			updates["isCustomized"] = true;
		}
	}
	if (data["uiConfig"] !== undefined) updates["uiConfig"] = data["uiConfig"];
	if (data["branding"] !== undefined) updates["branding"] = data["branding"];
	if (data["isActive"] !== undefined) updates["isActive"] = data["isActive"];
	if (data["isDefault"] !== undefined) updates["isDefault"] = data["isDefault"];
	if (data["requiresAuth"] !== undefined) updates["requiresAuth"] = data["requiresAuth"];

	const [form] = await db
		.update(organisationForms)
		.set(updates)
		.where(eq(organisationForms.id, data.id))
		.returning();

	return form;
});

/**
 * Delete a form.
 * Requires owner role.
 */
export const deleteForm = command(v.pipe(v.string(), v.uuid()), async (formId) => {
	const context = await requireOrganisationRole(["owner"]);

	// Verify form belongs to organisation
	const [existing] = await db
		.select({
			id: organisationForms.id,
			sourceTemplateId: organisationForms.sourceTemplateId,
			isCustomized: organisationForms.isCustomized,
		})
		.from(organisationForms)
		.where(and(eq(organisationForms.id, formId), eq(organisationForms.organisationId, context.organisationId)));

	if (!existing) {
		throw error(404, "Form not found");
	}

	await db.delete(organisationForms).where(eq(organisationForms.id, formId));

	// Decrement usage count on source template (only for non-customized forms)
	if (existing.sourceTemplateId && !existing.isCustomized) {
		await db
			.update(formTemplates)
			.set({ usageCount: sql`GREATEST(usage_count - 1, 0)` })
			.where(eq(formTemplates.id, existing.sourceTemplateId));
	}

	return { success: true };
});

/**
 * Duplicate a form.
 * Requires admin or owner role.
 */
export const duplicateForm = command(
	v.object({
		formId: v.pipe(v.string(), v.uuid()),
		newName: v.optional(v.string()),
		newSlug: v.optional(v.string()),
	}),
	async ({ formId, newName, newSlug }) => {
		const context = await requireOrganisationRole(["owner", "admin"]);
		const userId = getUserId();

		// Get original form
		const [original] = await db
			.select()
			.from(organisationForms)
			.where(and(eq(organisationForms.id, formId), eq(organisationForms.organisationId, context.organisationId)));

		if (!original) {
			throw error(404, "Form not found");
		}

		// Generate unique slug
		const baseSlug = newSlug || `${original.slug}-copy`;
		let slug = baseSlug;
		let counter = 1;

		while (true) {
			const [exists] = await db
				.select({ id: organisationForms.id })
				.from(organisationForms)
				.where(and(eq(organisationForms.organisationId, context.organisationId), eq(organisationForms.slug, slug)));

			if (!exists) break;
			slug = `${baseSlug}-${counter}`;
			counter++;
		}

		const [form] = await db
			.insert(organisationForms)
			.values({
				organisationId: context.organisationId,
				name: newName || `${original.name} (Copy)`,
				slug,
				description: original.description,
				formType: original.formType,
				schema: original.schema,
				uiConfig: original.uiConfig,
				branding: original.branding,
				isActive: false, // Start as inactive
				isDefault: false, // Never duplicate as default
				requiresAuth: original.requiresAuth,
				version: 1,
				createdBy: userId,
			})
			.returning();

		return form;
	}
);

/**
 * Submit a form (public endpoint).
 * Creates a form submission record.
 */
export const submitForm = command(SubmitFormSchema, async ({ formId, data, metadata }) => {
	// Get form (don't require auth - this is a public endpoint)
	const [form] = await db
		.select()
		.from(organisationForms)
		.where(and(eq(organisationForms.id, formId), eq(organisationForms.isActive, true)));

	if (!form) {
		throw error(404, "Form not found or inactive");
	}

	// Create submission
	const [submission] = await db
		.insert(formSubmissions)
		.values({
			formId,
			organisationId: form.organisationId,
			data,
			metadata: metadata || {},
			status: "completed",
			formVersion: form.version,
		})
		.returning();

	return submission;
});

/**
 * Create a new form from a system template.
 * Copies the template schema into a new organisation form.
 * Requires admin or owner role.
 */
export const createFormFromTemplate = command(
	v.object({
		templateId: v.pipe(v.string(), v.uuid()),
		name: v.optional(v.string()),
		slug: v.optional(v.string()),
		formType: v.optional(v.picklist(["questionnaire", "consultation", "feedback", "intake", "custom"])),
	}),
	async ({ templateId, name, slug, formType: overrideFormType }) => {
		const context = await requireOrganisationRole(["owner", "admin"]);
		const userId = getUserId();

		// Get the template
		const [template] = await db
			.select()
			.from(formTemplates)
			.where(eq(formTemplates.id, templateId));

		if (!template) {
			throw error(404, "Template not found");
		}

		// Generate name and slug if not provided
		const formName = name || template.name;
		const baseSlug = slug || template.slug;

		// Ensure unique slug
		let finalSlug = baseSlug;
		let counter = 1;

		while (true) {
			const [exists] = await db
				.select({ id: organisationForms.id })
				.from(organisationForms)
				.where(and(eq(organisationForms.organisationId, context.organisationId), eq(organisationForms.slug, finalSlug)));

			if (!exists) break;
			finalSlug = `${baseSlug}-${counter}`;
			counter++;
		}

		// Determine form type from override or template category
		const categoryToType: Record<string, string> = {
			questionnaire: "questionnaire",
			consultation: "consultation",
			feedback: "feedback",
			intake: "intake",
			general: "custom",
		};
		const formType = overrideFormType || categoryToType[template.category] || "custom";

		// Check if this form type already has an active default
		const [existingDefault] = await db
			.select({ id: organisationForms.id })
			.from(organisationForms)
			.where(
				and(
					eq(organisationForms.organisationId, context.organisationId),
					eq(organisationForms.formType, formType as "questionnaire" | "consultation" | "feedback" | "intake" | "custom"),
					eq(organisationForms.isActive, true),
				),
			);

		// Auto-activate and set as default if no existing form of this type
		const shouldAutoActivate = !existingDefault;

		// Create the form
		const [form] = await db
			.insert(organisationForms)
			.values({
				organisationId: context.organisationId,
				name: formName,
				slug: finalSlug,
				description: template.description,
				formType: formType as "questionnaire" | "consultation" | "feedback" | "intake" | "custom",
				schema: template.schema as RawFormSchema,
				uiConfig: template.uiConfig || {
					layout: "single-column",
					showProgressBar: true,
					showStepNumbers: true,
					submitButtonText: "Submit",
					successMessage: "Thank you for your submission!",
				},
				isActive: shouldAutoActivate,
				isDefault: shouldAutoActivate,
				requiresAuth: false,
				version: 1,
				createdBy: userId,
				sourceTemplateId: templateId,
				isCustomized: false,
			})
			.returning();

		// Increment usage count on template
		await db
			.update(formTemplates)
			.set({ usageCount: sql`usage_count + 1` })
			.where(eq(formTemplates.id, templateId));

		return form;
	}
);

/**
 * Update submission status (for processing workflow).
 */
export const updateSubmissionStatus = command(
	v.object({
		submissionId: v.pipe(v.string(), v.uuid()),
		status: v.picklist(["draft", "completed", "processing", "processed", "archived"]),
		consultationId: v.optional(v.pipe(v.string(), v.uuid())),
	}),
	async ({ submissionId, status, consultationId }) => {
		const context = await getOrganisationContext();

		// Verify submission belongs to organisation
		const [existing] = await db
			.select()
			.from(formSubmissions)
			.where(
				and(eq(formSubmissions.id, submissionId), eq(formSubmissions.organisationId, context.organisationId))
			);

		if (!existing) {
			throw error(404, "Submission not found");
		}

		const updates: Record<string, unknown> = { status };

		if (status === "processed") {
			updates["processedAt"] = new Date();
		}

		if (consultationId) {
			updates["consultationId"] = consultationId;
		}

		const [submission] = await db
			.update(formSubmissions)
			.set(updates)
			.where(eq(formSubmissions.id, submissionId))
			.returning();

		return submission;
	}
);

/**
 * Get all form submissions for the organisation (for the Forms list page).
 * Includes form name and client info.
 */
export const getOrganisationFormSubmissions = query(
	v.optional(
		v.object({
			status: v.optional(
				v.picklist(["draft", "completed", "processing", "processed", "archived"])
			),
			formId: v.optional(v.pipe(v.string(), v.uuid())),
			limit: v.optional(v.pipe(v.number(), v.minValue(1), v.maxValue(100))),
			offset: v.optional(v.pipe(v.number(), v.minValue(0))),
		})
	),
	async (filters) => {
		const context = await getOrganisationContext();
		const { status, formId, limit = 50, offset = 0 } = filters || {};

		const conditions = [eq(formSubmissions.organisationId, context.organisationId)];

		if (status) {
			conditions.push(eq(formSubmissions.status, status));
		}

		if (formId) {
			conditions.push(eq(formSubmissions.formId, formId));
		}

		const submissions = await db
			.select({
				id: formSubmissions.id,
				slug: formSubmissions.slug,
				formId: formSubmissions.formId,
				clientId: formSubmissions.clientId,
				clientBusinessName: formSubmissions.clientBusinessName,
				clientEmail: formSubmissions.clientEmail,
				status: formSubmissions.status,
				currentStep: formSubmissions.currentStep,
				completionPercentage: formSubmissions.completionPercentage,
				data: formSubmissions.data,
				startedAt: formSubmissions.startedAt,
				submittedAt: formSubmissions.submittedAt,
				lastActivityAt: formSubmissions.lastActivityAt,
				createdAt: formSubmissions.createdAt,
				formName: organisationForms.name,
				formType: organisationForms.formType,
			})
			.from(formSubmissions)
			.leftJoin(organisationForms, eq(formSubmissions.formId, organisationForms.id))
			.where(and(...conditions))
			.orderBy(desc(formSubmissions.createdAt))
			.limit(limit)
			.offset(offset);

		return submissions;
	}
);

/**
 * Get a single submission by ID with full details.
 */
export const getSubmissionById = query(v.pipe(v.string(), v.uuid()), async (submissionId) => {
	const context = await getOrganisationContext();

	const [submission] = await db
		.select({
			submission: formSubmissions,
			form: organisationForms,
		})
		.from(formSubmissions)
		.leftJoin(organisationForms, eq(formSubmissions.formId, organisationForms.id))
		.where(
			and(eq(formSubmissions.id, submissionId), eq(formSubmissions.organisationId, context.organisationId))
		);

	if (!submission) {
		throw error(404, "Submission not found");
	}

	return submission;
});

/**
 * Get a submission by slug (for public form access).
 * No auth required - used for client-facing forms.
 */
export const getSubmissionBySlug = query(
	v.pipe(v.string(), v.minLength(1)),
	async (slug) => {
		// Get submission with form and organisation info
		const { organisations } = await import("$lib/server/schema");

		const [result] = await db
			.select({
				submission: formSubmissions,
				form: organisationForms,
				organisation: {
					id: organisations.id,
					name: organisations.name,
					slug: organisations.slug,
					logoUrl: organisations.logoUrl,
					primaryColor: organisations.primaryColor,
					secondaryColor: organisations.secondaryColor,
					accentColor: organisations.accentColor,
					accentGradient: organisations.accentGradient,
				},
			})
			.from(formSubmissions)
			.innerJoin(organisationForms, eq(formSubmissions.formId, organisationForms.id))
			.innerJoin(organisations, eq(formSubmissions.organisationId, organisations.id))
			.where(eq(formSubmissions.slug, slug));

		if (!result) {
			throw error(404, "Form not found");
		}

		return result;
	}
);

/**
 * Create a new submission for a client (organisation initiates).
 * Generates a unique slug for public access.
 */
export const createSubmissionForClient = command(
	v.object({
		formId: v.pipe(v.string(), v.uuid()),
		clientId: v.optional(v.pipe(v.string(), v.uuid())),
		clientBusinessName: v.pipe(v.string(), v.minLength(1), v.maxLength(255)),
		clientEmail: v.pipe(v.string(), v.email(), v.maxLength(255)),
	}),
	async ({ formId, clientId, clientBusinessName, clientEmail }) => {
		const context = await requireOrganisationRole(["owner", "admin", "member"]);

		// Verify form belongs to organisation and is active
		const [form] = await db
			.select()
			.from(organisationForms)
			.where(and(eq(organisationForms.id, formId), eq(organisationForms.organisationId, context.organisationId)));

		if (!form) {
			throw error(404, "Form not found");
		}

		// Generate unique slug
		const generateSlug = () => {
			const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
			let slug = "";
			for (let i = 0; i < 12; i++) {
				slug += chars.charAt(Math.floor(Math.random() * chars.length));
			}
			return slug;
		};

		let slug = generateSlug();
		let attempts = 0;

		// Ensure unique slug
		while (attempts < 10) {
			const [existing] = await db
				.select({ id: formSubmissions.id })
				.from(formSubmissions)
				.where(eq(formSubmissions.slug, slug));

			if (!existing) break;
			slug = generateSlug();
			attempts++;
		}

		// Create submission
		const [submission] = await db
			.insert(formSubmissions)
			.values({
				formId,
				organisationId: context.organisationId,
				slug,
				clientId: clientId || null,
				clientBusinessName,
				clientEmail: clientEmail.toLowerCase(),
				status: "draft",
				currentStep: 0,
				completionPercentage: 0,
				data: {},
				metadata: {},
				formVersion: form.version,
			})
			.returning();

		return submission;
	}
);

/**
 * Create a new submission from a system template.
 * Creates an organisation form copy if one doesn't exist, then creates the submission.
 * Requires admin, owner, or member role.
 */
export const createSubmissionFromTemplate = command(
	v.object({
		templateId: v.pipe(v.string(), v.uuid()),
		clientId: v.optional(v.pipe(v.string(), v.uuid())),
		clientBusinessName: v.pipe(v.string(), v.minLength(1), v.maxLength(255)),
		clientEmail: v.pipe(v.string(), v.email(), v.maxLength(255)),
	}),
	async ({ templateId, clientId, clientBusinessName, clientEmail }) => {
		const context = await requireOrganisationRole(["owner", "admin", "member"]);
		const userId = getUserId();

		// Get the template
		const [template] = await db
			.select()
			.from(formTemplates)
			.where(eq(formTemplates.id, templateId));

		if (!template) {
			throw error(404, "Template not found");
		}

		// Check if organisation already has a form from this template (by slug pattern)
		// We check for exact slug or slug with suffix
		const existingForms = await db
			.select()
			.from(organisationForms)
			.where(
				and(
					eq(organisationForms.organisationId, context.organisationId),
					eq(organisationForms.slug, template.slug)
				)
			);

		let formToUse: typeof organisationForms.$inferSelect | undefined;

		if (existingForms.length > 0) {
			// Use existing form (prefer active one if available)
			formToUse = existingForms.find((f) => f.isActive) || existingForms[0];
		} else {
			// Create organisation form from template
			const categoryToType: Record<string, string> = {
				questionnaire: "questionnaire",
				consultation: "consultation",
				feedback: "feedback",
				intake: "intake",
				general: "custom",
			};
			const formType = categoryToType[template.category] || "custom";

			const [newForm] = await db
				.insert(organisationForms)
				.values({
					organisationId: context.organisationId,
					name: template.name,
					slug: template.slug,
					description: template.description,
					formType: formType as "questionnaire" | "consultation" | "feedback" | "intake" | "custom",
					schema: template.schema as RawFormSchema,
					uiConfig: template.uiConfig || {
						layout: "single-column",
						showProgressBar: true,
						showStepNumbers: true,
						submitButtonText: "Submit",
						successMessage: "Thank you for your submission!",
					},
					isActive: true,
					isDefault: false,
					requiresAuth: false,
					version: 1,
					createdBy: userId,
				})
				.returning();

			formToUse = newForm;
		}

		if (!formToUse) {
			throw error(500, "Failed to create or find form for submission");
		}

		// Generate unique slug for submission
		const generateSlug = () => {
			const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
			let slug = "";
			for (let i = 0; i < 12; i++) {
				slug += chars.charAt(Math.floor(Math.random() * chars.length));
			}
			return slug;
		};

		let slug = generateSlug();
		let attempts = 0;

		while (attempts < 10) {
			const [existing] = await db
				.select({ id: formSubmissions.id })
				.from(formSubmissions)
				.where(eq(formSubmissions.slug, slug));

			if (!existing) break;
			slug = generateSlug();
			attempts++;
		}

		// Create submission
		const [submission] = await db
			.insert(formSubmissions)
			.values({
				formId: formToUse.id,
				organisationId: context.organisationId,
				slug,
				clientId: clientId || null,
				clientBusinessName,
				clientEmail: clientEmail.toLowerCase(),
				status: "draft",
				currentStep: 0,
				completionPercentage: 0,
				data: {},
				metadata: {
					sourceTemplateId: templateId,
					sourceTemplateSlug: template.slug,
				},
				formVersion: formToUse.version,
			})
			.returning();

		return submission;
	}
);

/**
 * Save submission progress (for auto-save in public forms).
 * No auth required - called from public form.
 */
export const saveSubmissionProgress = command(
	v.object({
		submissionId: v.pipe(v.string(), v.uuid()),
		data: v.any(),
		currentStep: v.pipe(v.number(), v.minValue(0)),
		completionPercentage: v.pipe(v.number(), v.minValue(0), v.maxValue(100)),
	}),
	async ({ submissionId, data, currentStep, completionPercentage }) => {
		// Get existing submission
		const [existing] = await db
			.select()
			.from(formSubmissions)
			.where(eq(formSubmissions.id, submissionId));

		if (!existing) {
			throw error(404, "Submission not found");
		}

		// Only allow updates to draft submissions
		if (existing.status !== "draft") {
			throw error(400, "Cannot update a completed submission");
		}

		const updates: Record<string, unknown> = {
			data,
			currentStep,
			completionPercentage,
			lastActivityAt: new Date(),
		};

		// Set startedAt on first save
		if (!existing.startedAt) {
			updates["startedAt"] = new Date();
		}

		const [submission] = await db
			.update(formSubmissions)
			.set(updates)
			.where(eq(formSubmissions.id, submissionId))
			.returning();

		return submission;
	}
);

/**
 * Complete a submission (final submit from public form).
 */
export const completeSubmission = command(
	v.object({
		submissionId: v.pipe(v.string(), v.uuid()),
		data: v.any(),
	}),
	async ({ submissionId, data }) => {
		// Get existing submission
		const [existing] = await db
			.select()
			.from(formSubmissions)
			.where(eq(formSubmissions.id, submissionId));

		if (!existing) {
			throw error(404, "Submission not found");
		}

		if (existing.status === "completed" || existing.status === "processed") {
			throw error(400, "Submission has already been completed");
		}

		const [submission] = await db
			.update(formSubmissions)
			.set({
				data,
				status: "completed",
				completionPercentage: 100,
				submittedAt: new Date(),
				lastActivityAt: new Date(),
			})
			.where(eq(formSubmissions.id, submissionId))
			.returning();

		return submission;
	}
);

/**
 * Delete a submission.
 * Requires owner or admin role.
 */
export const deleteSubmission = command(v.pipe(v.string(), v.uuid()), async (submissionId) => {
	const context = await requireOrganisationRole(["owner", "admin"]);

	// Verify submission belongs to organisation
	const [existing] = await db
		.select({ id: formSubmissions.id })
		.from(formSubmissions)
		.where(
			and(eq(formSubmissions.id, submissionId), eq(formSubmissions.organisationId, context.organisationId))
		);

	if (!existing) {
		throw error(404, "Submission not found");
	}

	await db.delete(formSubmissions).where(eq(formSubmissions.id, submissionId));

	return { success: true };
});

/**
 * Get all system form templates.
 * Alias for getFormTemplates with no filters.
 */
export const getSystemFormTemplates = query(async () => {
	const templates = await db
		.select()
		.from(formTemplates)
		.orderBy(asc(formTemplates.displayOrder), asc(formTemplates.name));

	return templates;
});
