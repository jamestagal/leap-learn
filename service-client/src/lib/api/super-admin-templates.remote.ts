/**
 * Super Admin Form Templates Remote Functions
 *
 * CRUD operations for system form templates, push updates to organisations, and rollback.
 * All functions require super admin access.
 */

import { query, command } from "$app/server";
import * as v from "valibot";
import { db } from "$lib/server/db";
import { formTemplates, organisationForms } from "$lib/server/schema";
import { eq, and, ne, asc, sql } from "drizzle-orm";
import { requireSuperAdmin } from "$lib/server/super-admin";
import { error } from "@sveltejs/kit";

// =============================================================================
// Validation Schemas
// =============================================================================

const CategorySchema = v.picklist([
	"questionnaire",
	"consultation",
	"feedback",
	"intake",
	"general",
]);

const CreateFormTemplateSchema = v.object({
	name: v.pipe(v.string(), v.minLength(1), v.maxLength(255)),
	slug: v.optional(v.pipe(v.string(), v.maxLength(255))),
	description: v.optional(v.string()),
	category: CategorySchema,
	schema: v.any(),
	uiConfig: v.any(),
	isFeatured: v.optional(v.boolean()),
	displayOrder: v.optional(v.number()),
	newUntil: v.optional(v.nullable(v.string())),
});

const UpdateFormTemplateSchema = v.object({
	id: v.pipe(v.string(), v.uuid()),
	name: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(255))),
	slug: v.optional(v.pipe(v.string(), v.maxLength(255))),
	description: v.optional(v.nullable(v.string())),
	category: v.optional(CategorySchema),
	schema: v.optional(v.any()),
	uiConfig: v.optional(v.any()),
	isFeatured: v.optional(v.boolean()),
	displayOrder: v.optional(v.number()),
	newUntil: v.optional(v.nullable(v.string())),
});

const ReorderItemSchema = v.object({
	id: v.pipe(v.string(), v.uuid()),
	displayOrder: v.number(),
});

const ReorderSchema = v.array(ReorderItemSchema);

// =============================================================================
// Helpers
// =============================================================================

function generateSlug(name: string): string {
	return name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 255);
}

async function ensureUniqueSlug(slug: string, excludeId?: string): Promise<string> {
	let candidate = slug;
	let counter = 1;

	while (true) {
		const conditions = [eq(formTemplates.slug, candidate)];
		if (excludeId) {
			conditions.push(ne(formTemplates.id, excludeId));
		}

		const [existing] = await db
			.select({ id: formTemplates.id })
			.from(formTemplates)
			.where(and(...conditions));

		if (!existing) return candidate;
		candidate = `${slug}-${counter}`;
		counter++;
	}
}

// =============================================================================
// Query Functions
// =============================================================================

export const getFormTemplatesAdmin = query(async () => {
	await requireSuperAdmin();

	const templates = await db
		.select()
		.from(formTemplates)
		.orderBy(asc(formTemplates.displayOrder), asc(formTemplates.name));

	return templates;
});

export const getFormTemplateAdmin = query(
	v.pipe(v.string(), v.uuid()),
	async (id) => {
		await requireSuperAdmin();

		const [template] = await db
			.select()
			.from(formTemplates)
			.where(eq(formTemplates.id, id));

		if (!template) {
			throw error(404, "Template not found");
		}

		return template;
	},
);

export const getTemplatePushPreview = query(
	v.pipe(v.string(), v.uuid()),
	async (templateId) => {
		await requireSuperAdmin();

		const [result] = await db
			.select({ count: sql<number>`count(*)::int` })
			.from(organisationForms)
			.where(
				and(
					eq(organisationForms.sourceTemplateId, templateId),
					eq(organisationForms.isCustomized, false),
				),
			);

		return { count: result?.count ?? 0 };
	},
);

// =============================================================================
// Command Functions
// =============================================================================

export const createFormTemplate = command(CreateFormTemplateSchema, async (data) => {
	await requireSuperAdmin();

	// Generate or validate slug
	let slug: string;
	if (data.slug) {
		slug = await ensureUniqueSlug(data.slug);
	} else {
		slug = await ensureUniqueSlug(generateSlug(data.name));
	}

	const [template] = await db
		.insert(formTemplates)
		.values({
			name: data.name,
			slug,
			description: data.description || null,
			category: data.category,
			schema: data.schema,
			uiConfig: data.uiConfig,
			isFeatured: data.isFeatured ?? false,
			displayOrder: data.displayOrder ?? 0,
			newUntil: data.newUntil ? new Date(data.newUntil) : null,
			usageCount: 0,
		})
		.returning();

	return template;
});

export const updateFormTemplate = command(UpdateFormTemplateSchema, async (data) => {
	await requireSuperAdmin();

	const { id, ...updates } = data;

	// Verify template exists
	const [existing] = await db
		.select({ id: formTemplates.id })
		.from(formTemplates)
		.where(eq(formTemplates.id, id));

	if (!existing) {
		throw error(404, "Template not found");
	}

	// Validate slug uniqueness if changing
	if (updates.slug) {
		const [slugConflict] = await db
			.select({ id: formTemplates.id })
			.from(formTemplates)
			.where(and(eq(formTemplates.slug, updates.slug), ne(formTemplates.id, id)));

		if (slugConflict) {
			throw error(400, "A template with this slug already exists");
		}
	}

	// Build update object
	const setValues: Partial<typeof formTemplates.$inferInsert> = {
		updatedAt: new Date(),
	};

	if (updates.name !== undefined) setValues.name = updates.name;
	if (updates.slug !== undefined) setValues.slug = updates.slug;
	if (updates.description !== undefined) setValues.description = updates.description;
	if (updates.category !== undefined) setValues.category = updates.category;
	if (updates.schema !== undefined) setValues.schema = updates.schema;
	if (updates.uiConfig !== undefined) setValues.uiConfig = updates.uiConfig;
	if (updates.isFeatured !== undefined) setValues.isFeatured = updates.isFeatured;
	if (updates.displayOrder !== undefined) setValues.displayOrder = updates.displayOrder;
	if (updates.newUntil !== undefined) {
		setValues.newUntil = updates.newUntil ? new Date(updates.newUntil) : null;
	}

	const [template] = await db
		.update(formTemplates)
		.set(setValues)
		.where(eq(formTemplates.id, id))
		.returning();

	return template;
});

export const deleteFormTemplate = command(
	v.pipe(v.string(), v.uuid()),
	async (id) => {
		await requireSuperAdmin();

		const [existing] = await db
			.select({ id: formTemplates.id })
			.from(formTemplates)
			.where(eq(formTemplates.id, id));

		if (!existing) {
			throw error(404, "Template not found");
		}

		await db.delete(formTemplates).where(eq(formTemplates.id, id));

		return { success: true };
	},
);

export const reorderFormTemplates = command(ReorderSchema, async (items) => {
	await requireSuperAdmin();

	for (const item of items) {
		await db
			.update(formTemplates)
			.set({ displayOrder: item.displayOrder, updatedAt: new Date() })
			.where(eq(formTemplates.id, item.id));
	}

	return { success: true };
});

export const pushTemplateUpdate = command(
	v.pipe(v.string(), v.uuid()),
	async (templateId) => {
		await requireSuperAdmin();

		const [template] = await db
			.select()
			.from(formTemplates)
			.where(eq(formTemplates.id, templateId));

		if (!template) {
			throw error(404, "Template not found");
		}

		const result = await db.execute(sql`
			UPDATE organisation_forms
			SET
				previous_schema = schema,
				schema = ${template.schema}::jsonb,
				ui_config = ${template.uiConfig}::jsonb,
				version = version + 1,
				updated_at = NOW()
			WHERE source_template_id = ${templateId}
				AND is_customized = false
			RETURNING id
		`);

		return {
			updatedCount: result.rowCount ?? 0,
			templateId,
			pushedAt: new Date().toISOString(),
		};
	},
);

export const rollbackTemplatePush = command(
	v.pipe(v.string(), v.uuid()),
	async (templateId) => {
		await requireSuperAdmin();

		const result = await db.execute(sql`
			UPDATE organisation_forms
			SET
				schema = previous_schema,
				previous_schema = NULL,
				version = version + 1,
				updated_at = NOW()
			WHERE source_template_id = ${templateId}
				AND is_customized = false
				AND previous_schema IS NOT NULL
			RETURNING id
		`);

		return { rolledBackCount: result.rowCount ?? 0 };
	},
);
