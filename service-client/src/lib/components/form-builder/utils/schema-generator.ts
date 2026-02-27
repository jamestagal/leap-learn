/**
 * Schema Generator - Converts FormSchema to Zod validation schema
 *
 * Generates Zod schemas from form builder field definitions for runtime validation.
 */

import * as v from "valibot";
import type { FormSchema, FormField, UIConfig, RawFormSchema } from "$lib/types/form-builder";

// Type for the generated schema output
export type GeneratedSchema = v.GenericSchema;

/**
 * Generate a Valibot schema from a FormField definition
 */
function generateFieldSchema(field: FormField): v.GenericSchema {
	switch (field.type) {
		case "text":
		case "password":
		case "textarea": {
			const validations: v.BaseValidation<string, string, v.BaseIssue<string>>[] = [];
			if (field.validation?.minLength) {
				validations.push(v.minLength(field.validation.minLength));
			}
			if (field.validation?.maxLength) {
				validations.push(v.maxLength(field.validation.maxLength));
			}
			if (field.validation?.pattern) {
				validations.push(v.regex(new RegExp(field.validation.pattern)));
			}
			const stringSchema =
				validations.length > 0 ? v.pipe(v.string(), ...validations) : v.string();
			return field.required ? stringSchema : v.optional(stringSchema);
		}

		case "email": {
			const emailSchema = v.pipe(v.string(), v.email());
			// Optional email fields: allow empty string (user left it blank)
			return field.required
				? emailSchema
				: v.optional(v.union([v.literal(""), emailSchema]));
		}

		case "url": {
			const urlSchema = v.pipe(v.string(), v.url());
			// Optional URL fields: allow empty string (user left it blank)
			return field.required
				? urlSchema
				: v.optional(v.union([v.literal(""), urlSchema]));
		}

		case "tel": {
			const telSchema = field.validation?.pattern
				? v.pipe(v.string(), v.regex(new RegExp(field.validation.pattern)))
				: v.string();
			return field.required ? telSchema : v.optional(telSchema);
		}

		case "number":
		case "slider":
		case "rating": {
			const numValidations: v.BaseValidation<number, number, v.BaseIssue<number>>[] = [];
			if (field.validation?.min !== undefined) {
				numValidations.push(v.minValue(field.validation.min));
			}
			if (field.validation?.max !== undefined) {
				numValidations.push(v.maxValue(field.validation.max));
			}
			const numSchema =
				numValidations.length > 0 ? v.pipe(v.number(), ...numValidations) : v.number();
			return field.required ? numSchema : v.optional(numSchema);
		}

		case "date":
		case "datetime":
			return field.required ? v.date() : v.optional(v.date());

		case "select":
		case "radio": {
			if (field.options && field.options.length > 0) {
				const values = field.options.map((opt) => opt.value);
				const picklist = v.picklist(values as [string, ...string[]]);
				return field.required ? picklist : v.optional(picklist);
			}
			return field.required ? v.string() : v.optional(v.string());
		}

		case "multiselect": {
			if (field.options && field.options.length > 0) {
				const values = field.options.map((opt) => opt.value);
				const arr = v.array(v.picklist(values as [string, ...string[]]));
				return field.required ? arr : v.optional(arr);
			}
			const arr = v.array(v.string());
			return field.required ? arr : v.optional(arr);
		}

		case "checkbox":
			return field.required ? v.boolean() : v.optional(v.boolean());

		case "file":
			// File validation is handled separately
			return v.optional(v.any());

		case "signature":
			// Signature is stored as base64 string
			return field.required ? v.string() : v.optional(v.string());

		// Display elements don't need validation
		case "heading":
		case "paragraph":
		case "divider":
			return v.optional(v.any());

		default:
			return field.required ? v.string() : v.optional(v.string());
	}
}

/**
 * Generate a complete Valibot schema from a FormSchema
 * Handles multi-step forms by flattening all fields
 */
export function generateFormSchema(formSchema: FormSchema): v.GenericSchema {
	const schemaShape: Record<string, v.GenericSchema> = {};

	for (const step of formSchema.steps) {
		for (const field of step.fields) {
			// Skip display elements
			if (["heading", "paragraph", "divider"].includes(field.type)) {
				continue;
			}
			schemaShape[field.name] = generateFieldSchema(field);
		}
	}

	return v.object(schemaShape);
}

/**
 * Generate TypeScript type definition as string (for code export)
 */
export function generateTypeScript(formSchema: FormSchema): string {
	const lines: string[] = ["// Generated TypeScript types", ""];

	const fields: string[] = [];
	for (const step of formSchema.steps) {
		for (const field of step.fields) {
			if (["heading", "paragraph", "divider"].includes(field.type)) {
				continue;
			}

			const tsType = getTypeScriptType(field);
			const optional = field.required ? "" : "?";
			fields.push(`  ${field.name}${optional}: ${tsType};`);
		}
	}

	lines.push("export interface FormData {");
	lines.push(...fields);
	lines.push("}");

	return lines.join("\n");
}

/**
 * Get TypeScript type for a field
 */
function getTypeScriptType(field: FormField): string {
	switch (field.type) {
		case "text":
		case "email":
		case "password":
		case "tel":
		case "url":
		case "textarea":
		case "signature":
			return "string";

		case "number":
		case "slider":
		case "rating":
			return "number";

		case "date":
		case "datetime":
			return "Date";

		case "checkbox":
			return "boolean";

		case "select":
		case "radio":
			if (field.options && field.options.length > 0) {
				return field.options.map((opt) => `"${opt.value}"`).join(" | ");
			}
			return "string";

		case "multiselect":
			if (field.options && field.options.length > 0) {
				const union = field.options.map((opt) => `"${opt.value}"`).join(" | ");
				return `(${union})[]`;
			}
			return "string[]";

		case "file":
			return "File | null";

		default:
			return "unknown";
	}
}

/**
 * Validate form data against a FormSchema.
 * If `fieldNames` is provided, only those fields are validated (for per-step validation).
 */
export function validateFormData(
	formSchema: FormSchema,
	data: Record<string, unknown>,
	fieldNames?: string[]
): { success: true; data: Record<string, unknown> } | { success: false; errors: Record<string, string> } {
	let schema: v.GenericSchema;

	if (fieldNames) {
		// Build schema for only the specified fields (step validation)
		const schemaShape: Record<string, v.GenericSchema> = {};
		for (const step of formSchema.steps) {
			for (const field of step.fields) {
				if (["heading", "paragraph", "divider"].includes(field.type)) continue;
				if (fieldNames.includes(field.name)) {
					schemaShape[field.name] = generateFieldSchema(field);
				}
			}
		}
		schema = v.object(schemaShape);
	} else {
		schema = generateFormSchema(formSchema);
	}

	const result = v.safeParse(schema, data);

	if (result.success) {
		return { success: true, data: result.output as Record<string, unknown> };
	}

	// Convert Valibot errors to a simple object
	const errors: Record<string, string> = {};
	if (result.issues) {
		for (const issue of result.issues) {
			const path = issue.path?.map((p) => String(p.key)).join(".") || "unknown";
			errors[path] = issue.message;
		}
	}

	return { success: false, errors };
}

/**
 * Get initial form data with default values
 */
export function getInitialFormData(formSchema: FormSchema): Record<string, unknown> {
	const data: Record<string, unknown> = {};

	for (const step of formSchema.steps) {
		for (const field of step.fields) {
			if (["heading", "paragraph", "divider"].includes(field.type)) {
				continue;
			}

			// Set default values based on field type
			switch (field.type) {
				case "text":
				case "email":
				case "password":
				case "tel":
				case "url":
				case "textarea":
				case "signature":
					data[field.name] = "";
					break;

				case "number":
				case "slider":
					data[field.name] = field.validation?.min ?? 0;
					break;

				case "rating":
					data[field.name] = 0;
					break;

				case "checkbox":
					data[field.name] = false;
					break;

				case "select":
				case "radio":
					data[field.name] = "";
					break;

				case "multiselect":
					data[field.name] = [];
					break;

				case "date":
				case "datetime":
					data[field.name] = null;
					break;

				case "file":
					data[field.name] = null;
					break;

				default:
					data[field.name] = null;
			}
		}
	}

	return data;
}

/**
 * Build a complete FormSchema by merging the separate uiConfig column into the schema.
 *
 * The database stores `schema` and `ui_config` as separate columns.
 * The `ui_config` column is the source of truth for UI settings (layout, buttons, etc).
 * This function merges them into a single FormSchema for rendering components.
 *
 * Use this whenever loading a form from the database for rendering or editing.
 */
export function buildFormSchema(schema: RawFormSchema | unknown, uiConfig?: unknown): FormSchema {
	const s = (typeof schema === "string" ? JSON.parse(schema) : schema) as FormSchema;
	if (uiConfig && typeof uiConfig === "object") {
		const parsed = (typeof uiConfig === "string" ? JSON.parse(uiConfig) : uiConfig) as UIConfig;
		return { ...s, uiConfig: { ...s.uiConfig, ...parsed } };
	}
	return s;
}

/**
 * Extract uiConfig from a FormSchema for saving to the separate DB column.
 *
 * Returns the schema without uiConfig (for the `schema` column) and
 * the uiConfig separately (for the `ui_config` column).
 *
 * Use this when saving from the Builder, which stores uiConfig inside the schema.
 */
export function extractUiConfig(schema: FormSchema): {
	schema: Omit<FormSchema, "uiConfig">;
	uiConfig: UIConfig | undefined;
} {
	const { uiConfig, ...schemaWithoutUiConfig } = schema;
	return { schema: schemaWithoutUiConfig, uiConfig: uiConfig || undefined };
}
