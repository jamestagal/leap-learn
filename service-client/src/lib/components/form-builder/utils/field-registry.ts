/**
 * Field Registry - Defines available field types for the form builder
 *
 * This registry maps field types to their configurations, icons, and default values.
 * Used by FieldLibrary to show available fields and by FormCanvas for rendering.
 */

import type { FieldType } from "$lib/types/form-builder";

// Field category for organizing in the library
export type FieldCategory = "input" | "selection" | "date" | "advanced" | "display";

// Field definition for the registry
export interface FieldDefinition {
	type: FieldType;
	name: string;
	description: string;
	category: FieldCategory;
	icon: string; // Lucide icon name
	defaultLabel: string;
	defaultPlaceholder?: string;
	supportsOptions?: boolean; // For select, multiselect, radio, checkbox
	supportsValidation?: boolean;
	defaultValidation?: {
		minLength?: number;
		maxLength?: number;
		min?: number;
		max?: number;
	};
}

// All available field types
export const fieldRegistry: FieldDefinition[] = [
	// Input fields
	{
		type: "text",
		name: "Text Input",
		description: "Single line text input",
		category: "input",
		icon: "TextCursorInput",
		defaultLabel: "Text Field",
		defaultPlaceholder: "Enter text...",
		supportsValidation: true,
	},
	{
		type: "email",
		name: "Email",
		description: "Email address input",
		category: "input",
		icon: "Mail",
		defaultLabel: "Email Address",
		defaultPlaceholder: "your@email.com",
		supportsValidation: true,
	},
	{
		type: "tel",
		name: "Phone",
		description: "Phone number input",
		category: "input",
		icon: "Phone",
		defaultLabel: "Phone Number",
		defaultPlaceholder: "+61 400 000 000",
		supportsValidation: true,
	},
	{
		type: "url",
		name: "URL",
		description: "Website URL input",
		category: "input",
		icon: "Link",
		defaultLabel: "Website",
		defaultPlaceholder: "https://example.com",
		supportsValidation: true,
	},
	{
		type: "password",
		name: "Password",
		description: "Password input with masking",
		category: "input",
		icon: "Lock",
		defaultLabel: "Password",
		defaultPlaceholder: "Enter password...",
		supportsValidation: true,
	},
	{
		type: "textarea",
		name: "Text Area",
		description: "Multi-line text input",
		category: "input",
		icon: "AlignLeft",
		defaultLabel: "Description",
		defaultPlaceholder: "Enter your message...",
		supportsValidation: true,
	},
	{
		type: "number",
		name: "Number",
		description: "Numeric input",
		category: "input",
		icon: "Hash",
		defaultLabel: "Number",
		defaultPlaceholder: "0",
		supportsValidation: true,
		defaultValidation: { min: 0 },
	},

	// Selection fields
	{
		type: "select",
		name: "Dropdown",
		description: "Single selection dropdown",
		category: "selection",
		icon: "ChevronDown",
		defaultLabel: "Select Option",
		defaultPlaceholder: "Choose an option...",
		supportsOptions: true,
	},
	{
		type: "multiselect",
		name: "Multi-Select",
		description: "Multiple selection dropdown",
		category: "selection",
		icon: "ListChecks",
		defaultLabel: "Select Options",
		defaultPlaceholder: "Choose options...",
		supportsOptions: true,
	},
	{
		type: "radio",
		name: "Radio Group",
		description: "Single choice radio buttons",
		category: "selection",
		icon: "Circle",
		defaultLabel: "Choose One",
		supportsOptions: true,
	},
	{
		type: "checkbox",
		name: "Checkbox",
		description: "Single checkbox toggle",
		category: "selection",
		icon: "CheckSquare",
		defaultLabel: "I agree",
	},

	// Date fields
	{
		type: "date",
		name: "Date Picker",
		description: "Date selection",
		category: "date",
		icon: "Calendar",
		defaultLabel: "Date",
		defaultPlaceholder: "Select date...",
	},
	{
		type: "datetime",
		name: "Date & Time",
		description: "Date and time selection",
		category: "date",
		icon: "CalendarClock",
		defaultLabel: "Date & Time",
		defaultPlaceholder: "Select date and time...",
	},

	// Advanced fields
	{
		type: "rating",
		name: "Rating",
		description: "Star rating input",
		category: "advanced",
		icon: "Star",
		defaultLabel: "Rating",
		defaultValidation: { min: 1, max: 5 },
	},
	{
		type: "slider",
		name: "Slider",
		description: "Range slider input",
		category: "advanced",
		icon: "SlidersHorizontal",
		defaultLabel: "Range",
		defaultValidation: { min: 0, max: 100 },
	},
	{
		type: "signature",
		name: "Signature",
		description: "Digital signature capture",
		category: "advanced",
		icon: "PenTool",
		defaultLabel: "Signature",
	},
	{
		type: "file",
		name: "File Upload",
		description: "File attachment upload",
		category: "advanced",
		icon: "Upload",
		defaultLabel: "Upload File",
	},

	// Display elements
	{
		type: "heading",
		name: "Heading",
		description: "Section heading text",
		category: "display",
		icon: "Heading",
		defaultLabel: "Section Title",
	},
	{
		type: "paragraph",
		name: "Paragraph",
		description: "Descriptive text block",
		category: "display",
		icon: "Text",
		defaultLabel: "Description text goes here...",
	},
	{
		type: "divider",
		name: "Divider",
		description: "Visual separator line",
		category: "display",
		icon: "Minus",
		defaultLabel: "",
	},
];

// Get field definition by type
export function getFieldDefinition(type: FieldType): FieldDefinition | undefined {
	return fieldRegistry.find((f) => f.type === type);
}

// Get fields by category
export function getFieldsByCategory(category: FieldCategory): FieldDefinition[] {
	return fieldRegistry.filter((f) => f.category === category);
}

// Get all input fields (excludes display elements)
export function getInputFields(): FieldDefinition[] {
	return fieldRegistry.filter((f) => f.category !== "display");
}

// Get display elements only
export function getDisplayElements(): FieldDefinition[] {
	return fieldRegistry.filter((f) => f.category === "display");
}

// Category labels for UI
export const categoryLabels: Record<FieldCategory, string> = {
	input: "Text Inputs",
	selection: "Selection",
	date: "Date & Time",
	advanced: "Advanced",
	display: "Display Elements",
};

// Generate default options for fields that support them
export function generateDefaultOptions(): Array<{ value: string; label: string }> {
	return [
		{ value: "option1", label: "Option 1" },
		{ value: "option2", label: "Option 2" },
		{ value: "option3", label: "Option 3" },
	];
}
