<script lang="ts">
	import { CheckCircle2, Circle, AlertCircle, ChevronRight, Sparkles } from 'lucide-svelte';
	import type { SetupChecklistItem } from '$lib/api/organisation-profile.types';

	interface Props {
		items: SetupChecklistItem[];
		completionPercent: number;
		totalRequired: number;
		completedRequired: number;
		isReady: boolean;
		organisationSlug: string;
	}

	let { items, completionPercent, totalRequired, completedRequired, isReady, organisationSlug }: Props =
		$props();

	function getStatusIcon(status: SetupChecklistItem['status']) {
		switch (status) {
			case 'complete':
				return CheckCircle2;
			case 'incomplete':
				return AlertCircle;
			case 'optional':
				return Circle;
		}
	}

	function getStatusColor(status: SetupChecklistItem['status']) {
		switch (status) {
			case 'complete':
				return 'text-success';
			case 'incomplete':
				return 'text-warning';
			case 'optional':
				return 'text-base-content/40';
		}
	}
</script>

<div class="card bg-base-100 border border-base-300">
	<div class="card-body">
		<!-- Header with progress -->
		<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
			<div class="flex items-center gap-3">
				<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
					<Sparkles class="h-5 w-5" />
				</div>
				<div>
					<h3 class="font-semibold">Setup Checklist</h3>
					<p class="text-sm text-base-content/60">
						{completedRequired} of {totalRequired} required steps completed
					</p>
				</div>
			</div>

			{#if isReady}
				<div class="badge badge-success gap-1 shrink-0">
					<CheckCircle2 class="h-3 w-3" />
					Ready
				</div>
			{:else}
				<div class="badge badge-outline border-amber-500 text-amber-600 gap-1 shrink-0">
					<AlertCircle class="h-3 w-3" />
					{totalRequired - completedRequired} remaining
				</div>
			{/if}
		</div>

		<!-- Progress bar -->
		<div class="mb-4">
			<div class="flex justify-between text-xs mb-1">
				<span class="text-base-content/60">Progress</span>
				<span class="font-medium">{completionPercent}%</span>
			</div>
			<progress
				class="progress {isReady ? 'progress-success' : 'progress-warning'} w-full"
				value={completionPercent}
				max="100"
			></progress>
		</div>

		<!-- Checklist items -->
		<div class="space-y-1">
			{#each items as item (item.id)}
				{@const StatusIcon = getStatusIcon(item.status)}
				{@const statusColor = getStatusColor(item.status)}
				<a
					href="/{organisationSlug}/settings/{item.link}"
					class="flex items-center gap-3 p-3 -mx-3 rounded-lg hover:bg-base-200 transition-colors group"
				>
					<div class={statusColor}>
						<StatusIcon class="h-5 w-5" />
					</div>
					<div class="flex-1 min-w-0">
						<div class="flex items-center gap-2">
							<span class="font-medium text-sm">{item.label}</span>
							{#if !item.required}
								<span class="badge badge-ghost badge-xs">Optional</span>
							{/if}
							{#if item.count !== undefined && item.count > 0}
								<span class="badge badge-primary badge-xs">{item.count}</span>
							{/if}
						</div>
						<p class="text-xs text-base-content/60 truncate">{item.description}</p>
					</div>
					<ChevronRight
						class="h-4 w-4 text-base-content/40 group-hover:text-base-content/70 transition-colors"
					/>
				</a>
			{/each}
		</div>

		{#if !isReady}
			<div class="mt-4 pt-4 border-t border-base-300">
				<p class="text-sm text-base-content/60">
					Complete all required steps to start using your organisation.
				</p>
			</div>
		{/if}
	</div>
</div>
