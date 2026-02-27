/**
 * Form Builder Components - Public API
 *
 * Usage:
 * import { Builder, formBuilder, generateFormSchema } from '$lib/components/form-builder';
 */

// Main builder component
export { default as Builder } from "./Builder.svelte";

// Individual components (for advanced usage)
export { default as FieldLibrary } from "./FieldLibrary.svelte";
export { default as FormCanvas } from "./FormCanvas.svelte";
export { default as FieldProperties } from "./FieldProperties.svelte";
export { default as PaneHandle } from "./PaneHandle.svelte";

// State management
export { formBuilder } from "./state/form-builder.svelte";

// Utilities
export {
	fieldRegistry,
	getFieldDefinition,
	getFieldsByCategory,
	getInputFields,
	getDisplayElements,
	categoryLabels,
	generateDefaultOptions,
	type FieldDefinition,
	type FieldCategory,
} from "./utils/field-registry";

export {
	generateFormSchema,
	generateTypeScript,
	validateFormData,
	getInitialFormData,
	type GeneratedSchema,
} from "./utils/schema-generator";
