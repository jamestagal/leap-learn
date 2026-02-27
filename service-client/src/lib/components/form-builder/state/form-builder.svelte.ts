/**
 * Form Builder State Management
 *
 * Manages the state for the form builder UI including:
 * - Form schema (steps, fields)
 * - Selected field for editing
 * - Drag and drop state
 */

import type { FormSchema, FormStep, FormField, FieldType, FieldOption } from "$lib/types/form-builder";
import { getFieldDefinition, generateDefaultOptions } from "../utils/field-registry";

// Generate unique ID
const generateId = () => crypto.randomUUID().slice(0, 8);

// Generate field name from type
function generateFieldName(type: FieldType, existingNames: string[]): string {
	const baseName = type.replace(/-/g, "_");
	if (!existingNames.includes(baseName)) {
		return baseName;
	}
	let counter = 1;
	while (existingNames.includes(`${baseName}_${counter}`)) {
		counter++;
	}
	return `${baseName}_${counter}`;
}

/**
 * Form Builder State Class
 * Uses Svelte 5 runes for reactive state management
 */
class FormBuilderState {
	// Form schema
	schema: FormSchema = $state({
		version: "1.0",
		steps: [
			{
				id: generateId(),
				title: "Step 1",
				fields: [],
			},
		],
	});

	// Currently selected step index
	activeStepIndex: number = $state(0);

	// Currently selected field ID for properties panel
	selectedFieldId: string | null = $state(null);

	// Current active step (guaranteed to exist since we always have at least one step)
	get activeStep(): FormStep {
		const step = this.schema.steps[this.activeStepIndex];
		if (!step) {
			// This should never happen since we maintain at least one step
			// and keep activeStepIndex in bounds
			return this.schema.steps[0]!;
		}
		return step;
	}

	// All field names (for unique name generation)
	get allFieldNames(): string[] {
		return this.schema.steps.flatMap((step) => step.fields.map((f) => f.name));
	}

	// Get selected field
	get selectedField(): FormField | null {
		if (!this.selectedFieldId) return null;
		for (const step of this.schema.steps) {
			const field = step.fields.find((f) => f.id === this.selectedFieldId);
			if (field) return field;
		}
		return null;
	}

	// ─────────────────────────────────────────────────────────────
	// STEP MANAGEMENT
	// ─────────────────────────────────────────────────────────────

	addStep = (title?: string) => {
		const stepNumber = this.schema.steps.length + 1;
		const newStep: FormStep = {
			id: generateId(),
			title: title || `Step ${stepNumber}`,
			fields: [],
		};
		this.schema.steps.push(newStep);
		this.activeStepIndex = this.schema.steps.length - 1;
	};

	removeStep = (stepId: string) => {
		if (this.schema.steps.length <= 1) return; // Keep at least one step
		const index = this.schema.steps.findIndex((s) => s.id === stepId);
		if (index === -1) return;

		this.schema.steps = this.schema.steps.filter((s) => s.id !== stepId);

		// Adjust active step if needed
		if (this.activeStepIndex >= this.schema.steps.length) {
			this.activeStepIndex = this.schema.steps.length - 1;
		}
	};

	updateStep = (stepId: string, updates: Partial<FormStep>) => {
		this.schema.steps = this.schema.steps.map((step) =>
			step.id === stepId ? { ...step, ...updates } : step
		);
	};

	moveStep = (fromIndex: number, toIndex: number) => {
		if (fromIndex < 0 || fromIndex >= this.schema.steps.length) return;
		if (toIndex < 0 || toIndex >= this.schema.steps.length) return;

		const steps = [...this.schema.steps];
		const [removed] = steps.splice(fromIndex, 1);
		if (!removed) return; // Safety check
		steps.splice(toIndex, 0, removed);
		this.schema.steps = steps;

		// Update active step index if needed
		if (this.activeStepIndex === fromIndex) {
			this.activeStepIndex = toIndex;
		}
	};

	// ─────────────────────────────────────────────────────────────
	// FIELD MANAGEMENT
	// ─────────────────────────────────────────────────────────────

	addField = (type: FieldType, stepIndex?: number) => {
		const targetStepIndex = stepIndex ?? this.activeStepIndex;
		const definition = getFieldDefinition(type);
		if (!definition) return;

		const targetStep = this.schema.steps[targetStepIndex];
		if (!targetStep) return; // Safety check

		const newField: FormField = {
			id: generateId(),
			type,
			name: generateFieldName(type, this.allFieldNames),
			label: definition.defaultLabel,
			required: false,
			layout: {
				width: "full",
				order: targetStep.fields.length,
			},
		};

		// Add optional properties only if they have values
		if (definition.defaultPlaceholder) {
			newField.placeholder = definition.defaultPlaceholder;
		}
		if (definition.supportsOptions) {
			newField.options = generateDefaultOptions();
		}

		targetStep.fields.push(newField);
		this.selectedFieldId = newField.id;
	};

	removeField = (fieldId: string) => {
		for (const step of this.schema.steps) {
			const index = step.fields.findIndex((f) => f.id === fieldId);
			if (index !== -1) {
				step.fields = step.fields.filter((f) => f.id !== fieldId);
				if (this.selectedFieldId === fieldId) {
					this.selectedFieldId = null;
				}
				return;
			}
		}
	};

	updateField = (fieldId: string, updates: Partial<FormField>) => {
		for (const step of this.schema.steps) {
			step.fields = step.fields.map((field) =>
				field.id === fieldId ? { ...field, ...updates } : field
			);
		}
	};

	duplicateField = (fieldId: string) => {
		for (let stepIndex = 0; stepIndex < this.schema.steps.length; stepIndex++) {
			const step = this.schema.steps[stepIndex];
			if (!step) continue; // Safety check
			const fieldIndex = step.fields.findIndex((f) => f.id === fieldId);
			if (fieldIndex !== -1) {
				const original = step.fields[fieldIndex];
				if (!original) continue; // Safety check
				const duplicate: FormField = {
					...JSON.parse(JSON.stringify(original)),
					id: generateId(),
					name: generateFieldName(original.type, this.allFieldNames),
				};
				step.fields.splice(fieldIndex + 1, 0, duplicate);
				this.selectedFieldId = duplicate.id;
				return;
			}
		}
	};

	moveField = (fieldId: string, toStepIndex: number, toPosition: number) => {
		// Find and remove field from current location
		let field: FormField | null = null;
		for (const step of this.schema.steps) {
			const index = step.fields.findIndex((f) => f.id === fieldId);
			if (index !== -1) {
				const removed = step.fields.splice(index, 1)[0];
				if (removed) field = removed;
				break;
			}
		}

		if (!field) return;

		// Insert at new location
		const targetStep = this.schema.steps[toStepIndex];
		if (!targetStep) return; // Safety check
		targetStep.fields.splice(toPosition, 0, field);

		// Update order values
		targetStep.fields.forEach((f, idx) => {
			if (f.layout) {
				f.layout.order = idx;
			}
		});
	};

	// ─────────────────────────────────────────────────────────────
	// FIELD OPTIONS MANAGEMENT
	// ─────────────────────────────────────────────────────────────

	addFieldOption = (fieldId: string) => {
		for (const step of this.schema.steps) {
			step.fields = step.fields.map((field) => {
				if (field.id === fieldId && field.options) {
					const newOption: FieldOption = {
						value: `option${field.options.length + 1}`,
						label: `Option ${field.options.length + 1}`,
					};
					return {
						...field,
						options: [...field.options, newOption],
					};
				}
				return field;
			});
		}
	};

	updateFieldOption = (fieldId: string, optionIndex: number, updates: Partial<FieldOption>) => {
		for (const step of this.schema.steps) {
			step.fields = step.fields.map((field) => {
				if (field.id === fieldId && field.options && field.options[optionIndex]) {
					const newOptions = [...field.options];
					const existing = newOptions[optionIndex];
					if (existing) {
						newOptions[optionIndex] = { ...existing, ...updates };
					}
					return { ...field, options: newOptions };
				}
				return field;
			});
		}
	};

	removeFieldOption = (fieldId: string, optionIndex: number) => {
		for (const step of this.schema.steps) {
			step.fields = step.fields.map((field) => {
				if (field.id === fieldId && field.options) {
					return {
						...field,
						options: field.options.filter((_, idx) => idx !== optionIndex),
					};
				}
				return field;
			});
		}
	};

	// Load options from an option set
	loadFieldOptions = (fieldId: string, options: FieldOption[]) => {
		for (const step of this.schema.steps) {
			step.fields = step.fields.map((field) => {
				if (field.id === fieldId) {
					return { ...field, options: [...options] };
				}
				return field;
			});
		}
	};

	// ─────────────────────────────────────────────────────────────
	// DND HANDLERS
	// ─────────────────────────────────────────────────────────────

	handleDndConsider = (stepIndex: number, e: CustomEvent<{ items: FormField[] }>) => {
		const step = this.schema.steps[stepIndex];
		if (step) {
			step.fields = e.detail.items;
		}
	};

	handleDndFinalize = (stepIndex: number, e: CustomEvent<{ items: FormField[] }>) => {
		const step = this.schema.steps[stepIndex];
		if (!step) return;
		step.fields = e.detail.items;
		// Update order values
		step.fields.forEach((f, idx) => {
			if (f.layout) {
				f.layout.order = idx;
			}
		});
	};

	// ─────────────────────────────────────────────────────────────
	// SCHEMA MANAGEMENT
	// ─────────────────────────────────────────────────────────────

	loadSchema = (schema: FormSchema) => {
		this.schema = JSON.parse(JSON.stringify(schema));
		this.activeStepIndex = 0;
		this.selectedFieldId = null;
	};

	exportSchema = (): FormSchema => {
		return JSON.parse(JSON.stringify(this.schema));
	};

	reset = () => {
		this.schema = {
			version: "1.0",
			steps: [
				{
					id: generateId(),
					title: "Step 1",
					fields: [],
				},
			],
		};
		this.activeStepIndex = 0;
		this.selectedFieldId = null;
	};

	// Check if schema has fields
	get hasFields(): boolean {
		return this.schema.steps.some((step) => step.fields.length > 0);
	}

	// Total field count
	get totalFieldCount(): number {
		return this.schema.steps.reduce((acc, step) => acc + step.fields.length, 0);
	}
}

// Export singleton instance
export const formBuilder = new FormBuilderState();
