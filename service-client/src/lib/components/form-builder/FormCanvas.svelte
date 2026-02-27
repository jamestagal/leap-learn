<script lang="ts">
	import { formBuilder } from "./state/form-builder.svelte";
	import { getFieldDefinition } from "./utils/field-registry";
	import { flip } from "svelte/animate";
	import { dndzone } from "svelte-dnd-action";
	import type { FormField } from "$lib/types/form-builder";

	// Icons
	import GripVertical from "lucide-svelte/icons/grip-vertical";
	import Trash2 from "lucide-svelte/icons/trash-2";
	import Copy from "lucide-svelte/icons/copy";
	import Plus from "lucide-svelte/icons/plus";
	import ChevronLeft from "lucide-svelte/icons/chevron-left";
	import ChevronRight from "lucide-svelte/icons/chevron-right";

	// Field icons
	import TextCursorInput from "lucide-svelte/icons/text-cursor-input";
	import Mail from "lucide-svelte/icons/mail";
	import Phone from "lucide-svelte/icons/phone";
	import Link from "lucide-svelte/icons/link";
	import Lock from "lucide-svelte/icons/lock";
	import AlignLeft from "lucide-svelte/icons/align-left";
	import Hash from "lucide-svelte/icons/hash";
	import ChevronDown from "lucide-svelte/icons/chevron-down";
	import ListChecks from "lucide-svelte/icons/list-checks";
	import Circle from "lucide-svelte/icons/circle";
	import CheckSquare from "lucide-svelte/icons/check-square";
	import Calendar from "lucide-svelte/icons/calendar";
	import CalendarClock from "lucide-svelte/icons/calendar-clock";
	import Star from "lucide-svelte/icons/star";
	import SlidersHorizontal from "lucide-svelte/icons/sliders-horizontal";
	import PenTool from "lucide-svelte/icons/pen-tool";
	import Upload from "lucide-svelte/icons/upload";
	import Heading from "lucide-svelte/icons/heading";
	import Text from "lucide-svelte/icons/text";
	import Minus from "lucide-svelte/icons/minus";
	// Icon map - using typeof for correct Lucide icon typing
	const iconMap: Record<string, typeof TextCursorInput> = {
		TextCursorInput,
		Mail,
		Phone,
		Link,
		Lock,
		AlignLeft,
		Hash,
		ChevronDown,
		ListChecks,
		Circle,
		CheckSquare,
		Calendar,
		CalendarClock,
		Star,
		SlidersHorizontal,
		PenTool,
		Upload,
		Heading,
		Text,
		Minus,
	};

	function getIcon(field: FormField): typeof TextCursorInput {
		const def = getFieldDefinition(field.type);
		if (def) {
			const icon = iconMap[def.icon];
			if (icon) return icon;
		}
		return TextCursorInput;
	}

	const flipDurationMs = 200;

	function handleDndConsider(e: CustomEvent<{ items: FormField[] }>) {
		formBuilder.handleDndConsider(formBuilder.activeStepIndex, e);
	}

	function handleDndFinalize(e: CustomEvent<{ items: FormField[] }>) {
		formBuilder.handleDndFinalize(formBuilder.activeStepIndex, e);
	}

	function selectField(fieldId: string) {
		formBuilder.selectedFieldId = fieldId;
	}

	function deleteField(fieldId: string, e: MouseEvent) {
		e.stopPropagation();
		formBuilder.removeField(fieldId);
	}

	function duplicateField(fieldId: string, e: MouseEvent) {
		e.stopPropagation();
		formBuilder.duplicateField(fieldId);
	}
</script>

<div class="flex h-full flex-col">
	<!-- Step Navigation -->
	{#if formBuilder.schema.steps.length > 1}
		<div class="border-b border-base-300 p-3">
			<div class="flex items-center gap-2">
				<button
					class="btn btn-ghost btn-sm btn-square"
					disabled={formBuilder.activeStepIndex === 0}
					onclick={() => (formBuilder.activeStepIndex = Math.max(0, formBuilder.activeStepIndex - 1))}
				>
					<ChevronLeft class="h-4 w-4" />
				</button>
				<div class="flex-1 text-center">
					<span class="text-sm font-medium">
						Step {formBuilder.activeStepIndex + 1} of {formBuilder.schema.steps.length}
					</span>
					<span class="text-xs text-base-content/60 block">
						{formBuilder.activeStep.title}
					</span>
				</div>
				<button
					class="btn btn-ghost btn-sm btn-square"
					disabled={formBuilder.activeStepIndex === formBuilder.schema.steps.length - 1}
					onclick={() =>
						(formBuilder.activeStepIndex = Math.min(
							formBuilder.schema.steps.length - 1,
							formBuilder.activeStepIndex + 1
						))}
				>
					<ChevronRight class="h-4 w-4" />
				</button>
			</div>
		</div>
	{/if}

	<!-- Canvas Area -->
	<div class="flex-1 overflow-y-auto p-4 bg-base-200/50">
		{#if formBuilder.activeStep.fields.length === 0}
			<!-- Empty State -->
			<div class="flex flex-col items-center justify-center h-64 text-center">
				<div class="rounded-full bg-base-300 p-4 mb-4">
					<Plus class="h-6 w-6 text-base-content/60" />
				</div>
				<h4 class="font-medium text-sm mb-1">No fields added</h4>
				<p class="text-xs text-base-content/60">
					Click on fields from the left panel to add them
				</p>
			</div>
		{:else}
			<!-- Fields List with DnD -->
			<div
				class="space-y-2"
				use:dndzone={{
					items: formBuilder.activeStep.fields,
					flipDurationMs,
					dropTargetStyle: {},
					type: "form-fields",
				}}
				onconsider={handleDndConsider}
				onfinalize={handleDndFinalize}
			>
				{#each formBuilder.activeStep.fields as field (field.id)}
					{@const Icon = getIcon(field)}
					{@const isSelected = formBuilder.selectedFieldId === field.id}
					{@const definition = getFieldDefinition(field.type)}
					<div
						class="group border rounded-lg bg-base-100 transition-all cursor-pointer
							{isSelected ? 'border-primary ring-2 ring-primary/20' : 'border-base-300 hover:border-primary/50'}"
						animate:flip={{ duration: flipDurationMs }}
						onclick={() => selectField(field.id)}
						role="button"
						tabindex="0"
						onkeydown={(e) => e.key === "Enter" && selectField(field.id)}
					>
						<!-- Field Header -->
						<div class="flex items-center gap-2 p-3">
							<!-- Drag Handle -->
							<div class="cursor-grab active:cursor-grabbing text-base-content/40 hover:text-base-content/60 touch-none">
								<GripVertical class="h-4 w-4" />
							</div>

							<!-- Field Icon & Label -->
							<Icon class="h-4 w-4 text-base-content/60" />
							<div class="flex-1 min-w-0">
								<span class="text-sm font-medium truncate block">
									{field.label || definition?.name || field.type}
								</span>
								<span class="text-xs text-base-content/50 truncate block">
									{field.name}
									{#if field.required}
										<span class="text-error">*</span>
									{/if}
								</span>
							</div>

							<!-- Actions -->
							<div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
								<button
									class="btn btn-ghost btn-xs btn-square"
									onclick={(e) => duplicateField(field.id, e)}
									title="Duplicate field"
								>
									<Copy class="h-3.5 w-3.5" />
								</button>
								<button
									class="btn btn-ghost btn-xs btn-square text-error hover:bg-error/10"
									onclick={(e) => deleteField(field.id, e)}
									title="Delete field"
								>
									<Trash2 class="h-3.5 w-3.5" />
								</button>
							</div>
						</div>

						<!-- Field Preview -->
						{#if !["heading", "paragraph", "divider"].includes(field.type)}
							<div class="px-3 pb-3 pt-0">
								<div class="bg-base-200/50 rounded p-2 text-xs text-base-content/50">
									{#if field.type === "text" || field.type === "email" || field.type === "tel" || field.type === "url" || field.type === "password"}
										<div class="h-8 border border-base-300 rounded bg-base-100 px-2 flex items-center">
											{field.placeholder || "Enter text..."}
										</div>
									{:else if field.type === "textarea"}
										<div class="h-16 border border-base-300 rounded bg-base-100 p-2">
											{field.placeholder || "Enter text..."}
										</div>
									{:else if field.type === "select" || field.type === "multiselect"}
										<div class="h-8 border border-base-300 rounded bg-base-100 px-2 flex items-center justify-between">
											<span>{field.placeholder || "Select..."}</span>
											<ChevronDown class="h-3 w-3" />
										</div>
									{:else if field.type === "checkbox"}
										<label class="flex items-center gap-2">
											<input type="checkbox" class="checkbox checkbox-sm" disabled />
											<span>{field.label}</span>
										</label>
									{:else if field.type === "radio" && field.options}
										<div class="space-y-1">
											{#each field.options.slice(0, 3) as option}
												<label class="flex items-center gap-2">
													<input type="radio" class="radio radio-sm" disabled />
													<span>{option.label}</span>
												</label>
											{/each}
											{#if field.options.length > 3}
												<span class="text-xs">+{field.options.length - 3} more</span>
											{/if}
										</div>
									{:else if field.type === "date" || field.type === "datetime"}
										<div class="h-8 border border-base-300 rounded bg-base-100 px-2 flex items-center justify-between">
											<span>Select date...</span>
											<Calendar class="h-3 w-3" />
										</div>
									{:else if field.type === "rating"}
										<div class="flex gap-1">
											{#each Array(5) as _, i}
												<Star class="h-4 w-4 {i < 3 ? 'fill-warning text-warning' : 'text-base-300'}" />
											{/each}
										</div>
									{:else if field.type === "slider"}
										<input type="range" class="range range-sm" disabled />
									{:else if field.type === "file"}
										<div class="h-16 border-2 border-dashed border-base-300 rounded flex items-center justify-center">
											<Upload class="h-4 w-4 mr-2" />
											<span>Upload file</span>
										</div>
									{:else if field.type === "signature"}
										<div class="h-20 border border-base-300 rounded bg-base-100 flex items-center justify-center">
											<PenTool class="h-4 w-4 mr-2" />
											<span>Sign here</span>
										</div>
									{:else if field.type === "number"}
										<div class="h-8 border border-base-300 rounded bg-base-100 px-2 flex items-center">
											0
										</div>
									{/if}
								</div>
							</div>
						{:else if field.type === "heading"}
							<div class="px-3 pb-3">
								<h3 class="text-lg font-semibold">{field.label}</h3>
							</div>
						{:else if field.type === "paragraph"}
							<div class="px-3 pb-3">
								<p class="text-sm text-base-content/70">{field.label}</p>
							</div>
						{:else if field.type === "divider"}
							<div class="px-3 pb-3">
								<hr class="border-base-300" />
							</div>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Step Actions -->
	<div class="border-t border-base-300 p-3 flex items-center justify-between">
		<div class="text-xs text-base-content/60">
			{formBuilder.activeStep.fields.length} field{formBuilder.activeStep.fields.length !== 1
				? "s"
				: ""}
		</div>
		<button class="btn btn-ghost btn-sm" onclick={() => formBuilder.addStep()}>
			<Plus class="h-4 w-4" />
			Add Step
		</button>
	</div>
</div>

<style>
	/* Drag and drop visual feedback */
	:global([data-is-dragging="true"]) {
		opacity: 0.8;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
		z-index: 50;
	}

	:global(.dnd-shadow-item) {
		border: 2px dashed hsl(var(--bc) / 0.2) !important;
		background: hsl(var(--b2) / 0.5) !important;
	}
</style>
