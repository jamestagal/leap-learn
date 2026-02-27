/**
 * Form Builder Type Definitions
 * Based on webkit-form-builder-integration-spec-v2.md
 */

import type { FormBrandingOverrides } from "./branding";

// Re-export for convenience
export type { FormBrandingOverrides };

// ============================================================================
// FORM SCHEMA TYPES
// ============================================================================

/**
 * Branded type for raw schema data from the database.
 * Forces developers to use buildFormSchema() to get a usable FormSchema,
 * ensuring uiConfig is always properly merged.
 */
declare const __rawFormSchema: unique symbol;
export type RawFormSchema = FormSchema & { readonly [__rawFormSchema]: true };

export interface FormSchema {
	version: "1.0";
	steps: FormStep[];
	uiConfig?: UIConfig;
	formOverrides?: FormBrandingOverrides;
}

export interface UIConfig {
	layout?: "single-column" | "two-column" | "card" | "wizard" | "stepper";
	showProgressBar?: boolean;
	showStepNumbers?: boolean;
	submitButtonText?: string;
	successMessage?: string;
	successRedirectUrl?: string;
}

export interface FormStep {
	id: string;
	title: string;
	description?: string;
	fields: FormField[];
}

export interface FormField {
	id: string;
	type: FieldType;
	name: string; // Form field name (used in data)
	label: string;
	description?: string;
	placeholder?: string;
	required: boolean;
	validation?: ValidationRules;
	options?: FieldOption[]; // For select, radio, checkbox
	optionSetSlug?: string; // Reference to field_option_sets
	defaultValue?: unknown;
	conditionalLogic?: ConditionalRule[];
	renderAs?: "default" | "chips"; // Alternative rendering for multiselect
	formatter?: "au-phone" | "currency" | "uppercase"; // Input formatting
	layout?: {
		width: "full" | "half" | "third";
		order: number;
	};
}

export type FieldType =
	| "text"
	| "email"
	| "password"
	| "tel"
	| "url"
	| "textarea"
	| "number"
	| "date"
	| "datetime"
	| "select"
	| "multiselect"
	| "radio"
	| "checkbox"
	| "file"
	| "signature"
	| "rating"
	| "slider"
	| "heading"
	| "paragraph"
	| "divider"; // Layout elements

export interface ValidationRules {
	min?: number;
	max?: number;
	minLength?: number;
	maxLength?: number;
	pattern?: string;
	patternMessage?: string;
	customMessage?: string;
	// File-specific validation
	accept?: string; // MIME types for file input (e.g., "image/*,.pdf")
	maxSize?: number; // Max file size in bytes
}

export interface FieldOption {
	value: string;
	label: string;
}

export interface ConditionalRule {
	field: string; // Field name to check
	operator: "equals" | "notEquals" | "contains" | "greaterThan" | "lessThan";
	value: unknown;
	action: "show" | "hide" | "require";
}

// ============================================================================
// FORM TYPES
// ============================================================================

export type FormType = "questionnaire" | "consultation" | "feedback" | "intake" | "custom";

export interface OrganisationForm {
	id: string;
	organisationId: string;
	name: string;
	slug: string;
	description?: string;
	formType: FormType;
	schema: FormSchema;
	uiConfig: FormUIConfig;
	branding?: FormBrandingOverrides;
	isActive: boolean;
	isDefault: boolean;
	requiresAuth: boolean;
	version: number;
	createdAt: Date;
	updatedAt: Date;
	createdBy?: string;
}

export interface FormUIConfig {
	layout?: "single-column" | "two-column" | "card" | "wizard" | "stepper";
	showProgressBar?: boolean;
	showStepNumbers?: boolean;
	submitButtonText?: string;
	successMessage?: string;
	successRedirectUrl?: string;
}

// ============================================================================
// FORM SUBMISSION TYPES
// ============================================================================

export type SubmissionStatus = "draft" | "completed" | "processing" | "processed" | "archived";

export interface FormSubmission {
	id: string;
	formId: string;
	organisationId: string;
	data: Record<string, unknown>;
	metadata: SubmissionMetadata;
	prospectId?: string;
	consultationId?: string;
	status: SubmissionStatus;
	formVersion: number;
	submittedAt: Date;
	processedAt?: Date;
}

export interface SubmissionMetadata {
	ipAddress?: string;
	userAgent?: string;
	referrer?: string;
	utmSource?: string;
	utmMedium?: string;
	utmCampaign?: string;
}

// ============================================================================
// FIELD OPTION SETS
// ============================================================================

export interface FieldOptionSet {
	id: string;
	organisationId?: string; // NULL = system-wide
	name: string;
	slug: string;
	description?: string;
	options: FieldOption[];
	isSystem: boolean;
	createdAt: Date;
	updatedAt: Date;
}

// ============================================================================
// FORM TEMPLATES
// ============================================================================

export interface FormTemplate {
	id: string;
	name: string;
	slug: string;
	description?: string;
	category: string;
	schema: FormSchema;
	uiConfig: FormUIConfig;
	previewImageUrl?: string;
	isFeatured: boolean;
	displayOrder: number;
	createdAt: Date;
	updatedAt: Date;
}
