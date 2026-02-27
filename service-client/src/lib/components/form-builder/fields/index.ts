/**
 * Form Builder Field Components
 *
 * Individual field components for the form builder.
 * These are used in the builder preview and can be imported
 * by the form renderer.
 */

// Re-export all field components
export { default as TextField } from "./TextField.svelte";
export { default as EmailField } from "./EmailField.svelte";
export { default as PhoneField } from "./PhoneField.svelte";
export { default as UrlField } from "./UrlField.svelte";
export { default as PasswordField } from "./PasswordField.svelte";
export { default as TextareaField } from "./TextareaField.svelte";
export { default as NumberField } from "./NumberField.svelte";
export { default as SelectField } from "./SelectField.svelte";
export { default as MultiSelectField } from "./MultiSelectField.svelte";
export { default as RadioField } from "./RadioField.svelte";
export { default as CheckboxField } from "./CheckboxField.svelte";
export { default as DateField } from "./DateField.svelte";
export { default as DateTimeField } from "./DateTimeField.svelte";
export { default as RatingField } from "./RatingField.svelte";
export { default as SliderField } from "./SliderField.svelte";
export { default as FileUploadField } from "./FileUploadField.svelte";
export { default as SignatureField } from "./SignatureField.svelte";

// Common field props interface
export interface FieldProps {
	id: string;
	name: string;
	label: string;
	description?: string;
	placeholder?: string;
	required?: boolean;
	disabled?: boolean;
	error?: string;
	value: unknown;
	onchange: (value: unknown) => void;
}

// Props with options (select, multiselect, radio)
export interface OptionFieldProps extends FieldProps {
	options: Array<{ value: string; label: string }>;
}

// Props with validation
export interface ValidatedFieldProps extends FieldProps {
	minLength?: number;
	maxLength?: number;
	min?: number;
	max?: number;
	pattern?: string;
}
