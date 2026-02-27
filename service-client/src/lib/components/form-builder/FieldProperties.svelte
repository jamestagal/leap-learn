<script lang="ts">
	import { formBuilder } from "./state/form-builder.svelte";
	import { getFieldDefinition } from "./utils/field-registry";
	import type { FormField, FieldOption } from "$lib/types/form-builder";

	// Icons
	import Trash2 from "lucide-svelte/icons/trash-2";
	import Plus from "lucide-svelte/icons/plus";
	import GripVertical from "lucide-svelte/icons/grip-vertical";
	import Settings from "lucide-svelte/icons/settings";
	import X from "lucide-svelte/icons/x";

	// Get selected field reactively
	let field = $derived(formBuilder.selectedField);
	let definition = $derived(field ? getFieldDefinition(field.type) : null);

	// Note: editingOptionIndex reserved for future inline editing feature
	// let editingOptionIndex = $state<number | null>(null);

	function updateField(key: keyof FormField, value: unknown): void {
		if (!field) return;
		formBuilder.updateField(field.id, { [key]: value });
	}

	function updateValidation(key: string, value: unknown): void {
		if (!field) return;
		formBuilder.updateField(field.id, {
			validation: {
				...field.validation,
				[key]: value,
			},
		});
	}

	function addOption(): void {
		if (!field) return;
		formBuilder.addFieldOption(field.id);
	}

	function updateOption(index: number, updates: Partial<FieldOption>): void {
		if (!field) return;
		formBuilder.updateFieldOption(field.id, index, updates);
	}

	function removeOption(index: number): void {
		if (!field) return;
		formBuilder.removeFieldOption(field.id, index);
	}

	function closePanel(): void {
		formBuilder.selectedFieldId = null;
	}
</script>

<div class="flex h-full flex-col">
	{#if field && definition}
		<!-- Panel Header -->
		<div class="border-b border-base-300 p-4 flex items-center justify-between">
			<div>
				<h3 class="font-semibold text-sm">Field Properties</h3>
				<p class="text-xs text-base-content/60">{definition.name}</p>
			</div>
			<button class="btn btn-ghost btn-sm btn-square" onclick={closePanel}>
				<X class="h-4 w-4" />
			</button>
		</div>

		<!-- Scrollable Properties -->
		<div class="flex-1 overflow-y-auto p-4 space-y-4">
			<!-- Basic Properties -->
			<div class="space-y-3">
				<h4 class="text-xs font-medium text-base-content/60 uppercase tracking-wide flex items-center gap-2">
					<Settings class="h-3.5 w-3.5" />
					Basic Settings
				</h4>

				<!-- Label -->
				<div class="form-control">
					<label class="label" for="field-label">
						<span class="label-text text-xs">Label</span>
					</label>
					<input
						id="field-label"
						type="text"
						class="input input-sm input-bordered"
						value={field.label}
						oninput={(e) => updateField("label", e.currentTarget.value)}
						placeholder="Field label"
					/>
				</div>

				<!-- Name (ID) -->
				<div class="form-control">
					<label class="label" for="field-name">
						<span class="label-text text-xs">Name (ID)</span>
					</label>
					<input
						id="field-name"
						type="text"
						class="input input-sm input-bordered font-mono"
						value={field.name}
						oninput={(e) => updateField("name", e.currentTarget.value)}
						placeholder="field_name"
					/>
					<label class="label">
						<span class="label-text-alt text-xs text-base-content/50">Used in form data submission</span>
					</label>
				</div>

				<!-- Placeholder (for input fields) -->
				{#if !["heading", "paragraph", "divider", "checkbox", "radio", "rating", "signature"].includes(field.type)}
					<div class="form-control">
						<label class="label" for="field-placeholder">
							<span class="label-text text-xs">Placeholder</span>
						</label>
						<input
							id="field-placeholder"
							type="text"
							class="input input-sm input-bordered"
							value={field.placeholder || ""}
							oninput={(e) => updateField("placeholder", e.currentTarget.value)}
							placeholder="Enter placeholder text..."
						/>
					</div>
				{/if}

				<!-- Required toggle -->
				{#if !["heading", "paragraph", "divider"].includes(field.type)}
					<div class="form-control">
						<label class="label cursor-pointer justify-start gap-3">
							<input
								type="checkbox"
								class="toggle toggle-sm toggle-primary"
								checked={field.required}
								onchange={(e) => updateField("required", e.currentTarget.checked)}
							/>
							<span class="label-text text-xs">Required field</span>
						</label>
					</div>
				{/if}
			</div>

			<!-- Options (for select, multiselect, radio) -->
			{#if definition.supportsOptions && field.options}
				<div class="space-y-3 pt-3 border-t border-base-300">
					<div class="flex items-center justify-between">
						<h4 class="text-xs font-medium text-base-content/60 uppercase tracking-wide">
							Options
						</h4>
						<button class="btn btn-ghost btn-xs" onclick={addOption}>
							<Plus class="h-3.5 w-3.5" />
							Add
						</button>
					</div>

					{#if field.options.length === 0}
						<div class="text-xs text-base-content/50 text-center py-4 border border-dashed border-base-300 rounded-lg">
							No options added yet
						</div>
					{:else}
						<div class="space-y-2">
							{#each field.options as option, index (option.value)}
								<div class="group flex items-start gap-2 p-2 border border-base-300 rounded-lg bg-base-100 hover:border-primary/30 transition-colors">
									<div class="cursor-grab text-base-content/40 hover:text-base-content/60 mt-1">
										<GripVertical class="h-4 w-4" />
									</div>

									<div class="flex-1 space-y-1.5">
										<input
											type="text"
											class="input input-xs input-bordered w-full"
											value={option.label}
											oninput={(e) => updateOption(index, { label: e.currentTarget.value })}
											placeholder="Option label"
										/>
										<input
											type="text"
											class="input input-xs input-bordered w-full font-mono"
											value={option.value}
											oninput={(e) => updateOption(index, { value: e.currentTarget.value })}
											placeholder="option_value"
										/>
									</div>

									<button
										class="btn btn-ghost btn-xs btn-square text-error opacity-0 group-hover:opacity-100 transition-opacity"
										onclick={() => removeOption(index)}
									>
										<Trash2 class="h-3.5 w-3.5" />
									</button>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			{/if}

			<!-- Validation Rules -->
			{#if definition.supportsValidation && !["heading", "paragraph", "divider"].includes(field.type)}
				<div class="space-y-3 pt-3 border-t border-base-300">
					<h4 class="text-xs font-medium text-base-content/60 uppercase tracking-wide">
						Validation
					</h4>

					{#if ["text", "textarea", "password"].includes(field.type)}
						<div class="grid grid-cols-2 gap-2">
							<div class="form-control">
								<label class="label" for="min-length">
									<span class="label-text text-xs">Min Length</span>
								</label>
								<input
									id="min-length"
									type="number"
									class="input input-sm input-bordered"
									value={field.validation?.minLength ?? ""}
									oninput={(e) => updateValidation("minLength", e.currentTarget.value ? parseInt(e.currentTarget.value) : undefined)}
									min="0"
								/>
							</div>
							<div class="form-control">
								<label class="label" for="max-length">
									<span class="label-text text-xs">Max Length</span>
								</label>
								<input
									id="max-length"
									type="number"
									class="input input-sm input-bordered"
									value={field.validation?.maxLength ?? ""}
									oninput={(e) => updateValidation("maxLength", e.currentTarget.value ? parseInt(e.currentTarget.value) : undefined)}
									min="0"
								/>
							</div>
						</div>
					{/if}

					{#if ["number", "slider", "rating"].includes(field.type)}
						<div class="grid grid-cols-2 gap-2">
							<div class="form-control">
								<label class="label" for="min-value">
									<span class="label-text text-xs">Min Value</span>
								</label>
								<input
									id="min-value"
									type="number"
									class="input input-sm input-bordered"
									value={field.validation?.min ?? ""}
									oninput={(e) => updateValidation("min", e.currentTarget.value ? parseFloat(e.currentTarget.value) : undefined)}
								/>
							</div>
							<div class="form-control">
								<label class="label" for="max-value">
									<span class="label-text text-xs">Max Value</span>
								</label>
								<input
									id="max-value"
									type="number"
									class="input input-sm input-bordered"
									value={field.validation?.max ?? ""}
									oninput={(e) => updateValidation("max", e.currentTarget.value ? parseFloat(e.currentTarget.value) : undefined)}
								/>
							</div>
						</div>
					{/if}

					<!-- Pattern (regex) -->
					{#if ["text", "tel"].includes(field.type)}
						<div class="form-control">
							<label class="label" for="pattern">
								<span class="label-text text-xs">Pattern (Regex)</span>
							</label>
							<input
								id="pattern"
								type="text"
								class="input input-sm input-bordered font-mono"
								value={field.validation?.pattern ?? ""}
								oninput={(e) => updateValidation("pattern", e.currentTarget.value || undefined)}
								placeholder="^[A-Za-z]+$"
							/>
						</div>
					{/if}
				</div>
			{/if}

			<!-- Layout Options -->
			<div class="space-y-3 pt-3 border-t border-base-300">
				<h4 class="text-xs font-medium text-base-content/60 uppercase tracking-wide">
					Layout
				</h4>

				<div class="form-control">
					<label class="label" for="field-width">
						<span class="label-text text-xs">Width</span>
					</label>
					<select
						id="field-width"
						class="select select-sm select-bordered"
						value={field.layout?.width || "full"}
						onchange={(e) =>
							updateField("layout", { ...field.layout, width: e.currentTarget.value as "full" | "half" | "third" })
						}
					>
						<option value="full">Full Width</option>
						<option value="half">Half Width</option>
						<option value="third">One Third</option>
					</select>
				</div>
			</div>

			<!-- Delete Field -->
			<div class="pt-3 border-t border-base-300">
				<button
					class="btn btn-error btn-sm w-full"
					onclick={() => formBuilder.removeField(field.id)}
				>
					<Trash2 class="h-4 w-4" />
					Delete Field
				</button>
			</div>
		</div>
	{:else}
		<!-- No Field Selected -->
		<div class="flex h-full flex-col items-center justify-center text-center p-6">
			<Settings class="h-12 w-12 text-base-content/20 mb-4" />
			<h4 class="font-medium text-sm mb-1">No field selected</h4>
			<p class="text-xs text-base-content/60">
				Click on a field in the canvas to edit its properties
			</p>
		</div>
	{/if}
</div>
