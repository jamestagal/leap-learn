<script lang="ts">
	import { formBuilder } from "./state/form-builder.svelte";
	import {
		fieldRegistry,
		categoryLabels,
		type FieldCategory,
		type FieldDefinition,
	} from "./utils/field-registry";
	import type { FieldType } from "$lib/types/form-builder";

	// Lucide icons
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
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
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

	function getIcon(iconName: string): typeof TextCursorInput {
		return iconMap[iconName] || TextCursorInput;
	}

	// Group fields by category
	const categories: FieldCategory[] = ["input", "selection", "date", "advanced", "display"];

	function getFieldsByCategory(category: FieldCategory): FieldDefinition[] {
		return fieldRegistry.filter((f) => f.category === category);
	}

	function handleAddField(type: FieldType) {
		formBuilder.addField(type);
	}
</script>

<div class="flex h-full flex-col">
	<!-- Panel Header -->
	<div class="border-b border-base-300 p-4">
		<h3 class="font-semibold text-sm">Fields</h3>
		<p class="text-xs text-base-content/60">Click to add fields to your form</p>
	</div>

	<!-- Scrollable Fields List -->
	<div class="flex-1 overflow-y-auto p-3">
		{#each categories as category}
			{@const fields = getFieldsByCategory(category)}
			{#if fields.length > 0}
				<div class="mb-4">
					<h4 class="mb-2 text-xs font-medium text-base-content/60 uppercase tracking-wide">
						{categoryLabels[category]}
					</h4>
					<div class="grid grid-cols-2 gap-1.5">
						{#each fields as field}
							{@const Icon = getIcon(field.icon)}
							<button
								type="button"
								class="btn btn-ghost btn-sm h-auto py-2 px-2 justify-start gap-2 text-xs font-normal border border-base-300 hover:border-primary/50"
								onclick={() => handleAddField(field.type)}
							>
								<Icon class="h-3.5 w-3.5 shrink-0 text-base-content/60" />
								<span class="truncate">{field.name}</span>
							</button>
						{/each}
					</div>
				</div>
			{/if}
		{/each}
	</div>
</div>
