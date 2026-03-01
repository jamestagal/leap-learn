<script lang="ts">
	import type { PageProps } from "./$types";
	import { invalidateAll } from "$app/navigation";
	import {
		ArrowLeft,
		CheckCircle,
		Circle,
		Puzzle,
		FileText,
		Play,
		LogOut,
	} from "lucide-svelte";
	import { enrolInCourse, withdrawFromCourse } from "$lib/api/enrolments.remote";

	let { data }: PageProps = $props();
	let organisationSlug = $derived(data.organisation.slug);
	let course = $derived(data.course);
	let progress = $derived(data.progress);

	let isEnrolled = $derived(progress !== null);

	// Calculate summary
	let totalItems = $derived(progress ? progress.length : course.items.length);
	let completedItems = $derived(progress ? progress.filter((p) => p.completed).length : 0);
	let percentage = $derived(totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0);

	// Get the first incomplete item ID for "Continue" button
	let nextItemId = $derived(() => {
		if (!progress) return course.items[0]?.id || null;
		const incomplete = progress.find((p) => !p.completed);
		if (incomplete) return incomplete.itemId;
		return progress.length > 0 ? progress[0]!.itemId : null;
	});

	let enrolling = $state(false);

	// Confirm modal
	let confirmModal = $state<{
		title: string;
		message: string;
		actionLabel: string;
		actionClass: string;
		onConfirm: () => Promise<void>;
	} | null>(null);
	let isConfirming = $state(false);

	async function handleConfirm() {
		if (!confirmModal) return;
		isConfirming = true;
		try {
			await confirmModal.onConfirm();
		} finally {
			isConfirming = false;
			confirmModal = null;
		}
	}

	async function handleEnrol() {
		enrolling = true;
		try {
			await enrolInCourse(course.id);
			await invalidateAll();
		} finally {
			enrolling = false;
		}
	}

	function confirmWithdraw() {
		confirmModal = {
			title: "Withdraw from Course",
			message: `Are you sure you want to withdraw from <strong>${course.title}</strong>? Your progress will be preserved but you will lose access.`,
			actionLabel: "Withdraw",
			actionClass: "btn-warning",
			onConfirm: async () => {
				await withdrawFromCourse(course.id);
				await invalidateAll();
			},
		};
	}
</script>

<!-- Header -->
<div class="mb-6">
	<a href="/{organisationSlug}/learn" class="btn btn-ghost btn-sm gap-1 mb-4">
		<ArrowLeft class="h-4 w-4" />
		Back to Learn
	</a>

	<div class="flex items-start justify-between">
		<div>
			<h1 class="text-2xl font-bold">{course.title}</h1>
			{#if course.description}
				<p class="text-base-content/60 mt-1">{course.description}</p>
			{/if}
		</div>

		{#if isEnrolled}
			<div class="flex gap-2">
				{#if nextItemId()}
					<a
						href="/{organisationSlug}/learn/{course.id}/{nextItemId()}"
						class="btn btn-primary btn-sm gap-1"
					>
						<Play class="h-3.5 w-3.5" />
						{completedItems > 0 ? "Continue" : "Start"}
					</a>
				{/if}
				<button class="btn btn-ghost btn-sm gap-1 text-warning" onclick={confirmWithdraw}>
					<LogOut class="h-3.5 w-3.5" />
					Withdraw
				</button>
			</div>
		{:else if course.status === "published"}
			<button
				class="btn btn-primary btn-sm gap-1"
				onclick={handleEnrol}
				disabled={enrolling}
			>
				{#if enrolling}
					<span class="loading loading-spinner loading-xs"></span>
				{:else}
					<Play class="h-3.5 w-3.5" />
				{/if}
				Enrol
			</button>
		{/if}
	</div>
</div>

<!-- Progress Summary (enrolled only) -->
{#if isEnrolled}
	<div class="card bg-base-100 border border-base-300 p-4 mb-6">
		<div class="flex items-center justify-between mb-2">
			<span class="text-sm font-medium">Your Progress</span>
			<span class="text-sm text-base-content/60">{completedItems}/{totalItems} items completed</span>
		</div>
		<progress class="progress progress-primary w-full" value={percentage} max="100"></progress>
		<span class="text-xs text-base-content/50 mt-1">{percentage}% complete</span>
	</div>
{/if}

<!-- Item List -->
<div class="card bg-base-100 border border-base-300">
	<div class="card-body p-0">
		<h3 class="font-semibold px-5 pt-5 pb-3">Course Content ({totalItems} items)</h3>
		<div class="divide-y divide-base-300">
			{#if isEnrolled && progress}
				{#each progress as item, i (item.itemId)}
					<a
						href="/{organisationSlug}/learn/{course.id}/{item.itemId}"
						class="flex items-center gap-3 px-5 py-3 hover:bg-base-200/50 transition-colors"
					>
						{#if item.completed}
							<CheckCircle class="h-5 w-5 text-success shrink-0" />
						{:else}
							<Circle class="h-5 w-5 text-base-content/20 shrink-0" />
						{/if}
						<div class="flex-1 min-w-0">
							<div class="flex items-center gap-2">
								{#if item.itemType === "h5p"}
									<Puzzle class="h-4 w-4 text-info shrink-0" />
								{:else}
									<FileText class="h-4 w-4 text-base-content/50 shrink-0" />
								{/if}
								<span class="font-medium truncate {item.completed ? 'text-base-content/60' : ''}">{item.title}</span>
							</div>
							{#if item.score !== null}
								<span class="text-xs text-base-content/50 ml-6">
									Score: {item.score}{item.maxScore ? `/${item.maxScore}` : ''}
								</span>
							{/if}
						</div>
						<span class="text-xs text-base-content/40">#{i + 1}</span>
					</a>
				{/each}
			{:else}
				{#each course.items as item, i (item.id)}
					<div class="flex items-center gap-3 px-5 py-3">
						<Circle class="h-5 w-5 text-base-content/20 shrink-0" />
						<div class="flex-1 min-w-0 flex items-center gap-2">
							{#if item.itemType === "h5p"}
								<Puzzle class="h-4 w-4 text-info shrink-0" />
							{:else}
								<FileText class="h-4 w-4 text-base-content/50 shrink-0" />
							{/if}
							<span class="font-medium truncate">{item.title}</span>
						</div>
						<span class="text-xs text-base-content/40">#{i + 1}</span>
					</div>
				{/each}
			{/if}
		</div>
	</div>
</div>

<!-- Confirm Modal -->
{#if confirmModal}
	<div class="modal modal-open" role="dialog">
		<div class="modal-box">
			<h3 class="text-lg font-bold">{confirmModal.title}</h3>
			<p class="py-4">{@html confirmModal.message}</p>
			<div class="modal-action">
				<button
					class="btn btn-ghost"
					onclick={() => (confirmModal = null)}
					disabled={isConfirming}
				>
					Cancel
				</button>
				<button
					class="btn {confirmModal.actionClass}"
					onclick={handleConfirm}
					disabled={isConfirming}
				>
					{#if isConfirming}
						<span class="loading loading-spinner loading-sm"></span>
					{/if}
					{confirmModal.actionLabel}
				</button>
			</div>
		</div>
		<div class="modal-backdrop" onclick={() => !isConfirming && (confirmModal = null)}></div>
	</div>
{/if}
