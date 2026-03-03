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
		ChevronDown,
		ChevronRight,
		Clock,
	} from "lucide-svelte";
	import { enrolInCourse, withdrawFromCourse } from "$lib/api/enrolments.remote";

	let { data }: PageProps = $props();
	let organisationSlug = $derived(data.organisation.slug);
	let course = $derived(data.course);
	let sections = $derived(data.sections);
	let progress = $derived(data.progress);

	let isEnrolled = $derived(progress !== null);

	// Calculate summary
	let totalItems = $derived(progress ? progress.length : course.items.length);
	let completedItems = $derived(progress ? progress.filter((p) => p.completed).length : 0);
	let percentage = $derived(totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0);

	// Total course duration
	let totalDuration = $derived(
		course.items.reduce((sum, item) => sum + (item.estimatedDurationMinutes || 0), 0),
	);

	// Get the first incomplete item ID for "Continue" button
	let nextItemId = $derived(() => {
		if (!progress) return course.items[0]?.id || null;
		const incomplete = progress.find((p) => !p.completed);
		if (incomplete) return incomplete.itemId;
		return progress.length > 0 ? progress[0]!.itemId : null;
	});

	let enrolling = $state(false);

	// Collapsed sections
	let collapsedSections = $state<Set<string>>(new Set());

	function toggleSection(sectionId: string) {
		const next = new Set(collapsedSections);
		if (next.has(sectionId)) {
			next.delete(sectionId);
		} else {
			next.add(sectionId);
		}
		collapsedSections = next;
	}

	// Group items by section for display
	function itemsForSection(sectionId: string) {
		if (progress) {
			return progress.filter((p) => p.sectionId === sectionId);
		}
		return course.items.filter((i) => i.sectionId === sectionId);
	}

	function ungroupedItems() {
		if (progress) {
			return progress.filter((p) => !p.sectionId);
		}
		return course.items.filter((i) => !i.sectionId);
	}

	function sectionCompletedCount(sectionId: string): number {
		if (!progress) return 0;
		return progress.filter((p) => p.sectionId === sectionId && p.completed).length;
	}

	function sectionTotalCount(sectionId: string): number {
		if (progress) {
			return progress.filter((p) => p.sectionId === sectionId).length;
		}
		return course.items.filter((i) => i.sectionId === sectionId).length;
	}

	function sectionDuration(sectionId: string): number {
		return course.items
			.filter((i) => i.sectionId === sectionId)
			.reduce((sum, i) => sum + (i.estimatedDurationMinutes || 0), 0);
	}

	let hasSections = $derived(sections.length > 0);

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

	function formatDuration(minutes: number): string {
		if (minutes < 60) return `${minutes} min`;
		const h = Math.floor(minutes / 60);
		const m = minutes % 60;
		return m > 0 ? `${h}h ${m}m` : `${h}h`;
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
			<div class="flex items-center gap-3 mt-2 text-sm text-base-content/50">
				<span>{totalItems} items</span>
				{#if totalDuration > 0}
					<span class="flex items-center gap-1">
						<Clock class="h-3.5 w-3.5" />
						{formatDuration(totalDuration)}
					</span>
				{/if}
			</div>
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

<!-- Course Content -->
<div class="card bg-base-100 border border-base-300">
	<div class="card-body p-0">
		<h3 class="font-semibold px-5 pt-5 pb-3">
			Course Content ({totalItems} items)
		</h3>

		{#if hasSections}
			<!-- Sectioned layout -->
			{#each sections as section (section.id)}
				{@const sTotal = sectionTotalCount(section.id)}
				{@const sCompleted = sectionCompletedCount(section.id)}
				{@const sDuration = sectionDuration(section.id)}
				{@const isCollapsed = collapsedSections.has(section.id)}
				{@const sItems = itemsForSection(section.id)}

				<div class="border-t border-base-300">
					<!-- Section Header -->
					<button
						class="flex items-center gap-3 w-full px-5 py-3 hover:bg-base-200/50 transition-colors text-left"
						onclick={() => toggleSection(section.id)}
					>
						{#if isCollapsed}
							<ChevronRight class="h-4 w-4 text-base-content/40 shrink-0" />
						{:else}
							<ChevronDown class="h-4 w-4 text-base-content/40 shrink-0" />
						{/if}
						<div class="flex-1 min-w-0">
							<span class="font-semibold text-sm">{section.title}</span>
						</div>
						<div class="flex items-center gap-2 text-xs text-base-content/50 shrink-0">
							{#if sDuration > 0}
								<span class="flex items-center gap-0.5">
									<Clock class="h-3 w-3" />
									{formatDuration(sDuration)}
								</span>
							{/if}
							{#if isEnrolled}
								<span>{sCompleted}/{sTotal}</span>
							{:else}
								<span>{sTotal} item{sTotal !== 1 ? "s" : ""}</span>
							{/if}
						</div>
					</button>

					<!-- Section Items -->
					{#if !isCollapsed}
						<div class="divide-y divide-base-300">
							{#each sItems as item}
								{@const itemId = "itemId" in item ? item.itemId : item.id}
								{@const isCompleted = "completed" in item ? item.completed : false}
								{@const itemType = item.itemType}
								{@const title = item.title}
								{@const score = "score" in item ? item.score : null}
								{@const maxScore = "maxScore" in item ? item.maxScore : null}
								{@const duration = "estimatedDurationMinutes" in item ? item.estimatedDurationMinutes : null}

								{#if isEnrolled}
									<a
										href="/{organisationSlug}/learn/{course.id}/{itemId}"
										class="flex items-center gap-3 px-5 pl-12 py-3 hover:bg-base-200/50 transition-colors"
									>
										{#if isCompleted}
											<CheckCircle class="h-5 w-5 text-success shrink-0" />
										{:else}
											<Circle class="h-5 w-5 text-base-content/20 shrink-0" />
										{/if}
										<div class="flex-1 min-w-0">
											<div class="flex items-center gap-2">
												{#if itemType === "h5p"}
													<Puzzle class="h-4 w-4 text-info shrink-0" />
												{:else}
													<FileText class="h-4 w-4 text-base-content/50 shrink-0" />
												{/if}
												<span class="font-medium truncate {isCompleted ? 'text-base-content/60' : ''}">{title}</span>
												{#if duration}
													<span class="text-xs text-base-content/40">{formatDuration(duration)}</span>
												{/if}
											</div>
											{#if score !== null}
												<span class="text-xs text-base-content/50 ml-6">
													Score: {score}{maxScore ? `/${maxScore}` : ''}
												</span>
											{/if}
										</div>
									</a>
								{:else}
									<div class="flex items-center gap-3 px-5 pl-12 py-3">
										<Circle class="h-5 w-5 text-base-content/20 shrink-0" />
										<div class="flex-1 min-w-0 flex items-center gap-2">
											{#if itemType === "h5p"}
												<Puzzle class="h-4 w-4 text-info shrink-0" />
											{:else}
												<FileText class="h-4 w-4 text-base-content/50 shrink-0" />
											{/if}
											<span class="font-medium truncate">{title}</span>
											{#if duration}
												<span class="text-xs text-base-content/40">{formatDuration(duration)}</span>
											{/if}
										</div>
									</div>
								{/if}
							{/each}
						</div>
					{/if}
				</div>
			{/each}

			<!-- Ungrouped items -->
			{@const uItems = ungroupedItems()}
			{#if uItems.length > 0}
				<div class="border-t border-base-300">
					<div class="divide-y divide-base-300">
						{#each uItems as item}
							{@const itemId = "itemId" in item ? item.itemId : item.id}
							{@const isCompleted = "completed" in item ? item.completed : false}
							{@const itemType = item.itemType}
							{@const title = item.title}
							{@const score = "score" in item ? item.score : null}
							{@const maxScore = "maxScore" in item ? item.maxScore : null}
							{@const duration = "estimatedDurationMinutes" in item ? item.estimatedDurationMinutes : null}

							{#if isEnrolled}
								<a
									href="/{organisationSlug}/learn/{course.id}/{itemId}"
									class="flex items-center gap-3 px-5 py-3 hover:bg-base-200/50 transition-colors"
								>
									{#if isCompleted}
										<CheckCircle class="h-5 w-5 text-success shrink-0" />
									{:else}
										<Circle class="h-5 w-5 text-base-content/20 shrink-0" />
									{/if}
									<div class="flex-1 min-w-0">
										<div class="flex items-center gap-2">
											{#if itemType === "h5p"}
												<Puzzle class="h-4 w-4 text-info shrink-0" />
											{:else}
												<FileText class="h-4 w-4 text-base-content/50 shrink-0" />
											{/if}
											<span class="font-medium truncate {isCompleted ? 'text-base-content/60' : ''}">{title}</span>
											{#if duration}
												<span class="text-xs text-base-content/40">{formatDuration(duration)}</span>
											{/if}
										</div>
										{#if score !== null}
											<span class="text-xs text-base-content/50 ml-6">
												Score: {score}{maxScore ? `/${maxScore}` : ''}
											</span>
										{/if}
									</div>
								</a>
							{:else}
								<div class="flex items-center gap-3 px-5 py-3">
									<Circle class="h-5 w-5 text-base-content/20 shrink-0" />
									<div class="flex-1 min-w-0 flex items-center gap-2">
										{#if itemType === "h5p"}
											<Puzzle class="h-4 w-4 text-info shrink-0" />
										{:else}
											<FileText class="h-4 w-4 text-base-content/50 shrink-0" />
										{/if}
										<span class="font-medium truncate">{title}</span>
										{#if duration}
											<span class="text-xs text-base-content/40">{formatDuration(duration)}</span>
										{/if}
									</div>
								</div>
							{/if}
						{/each}
					</div>
				</div>
			{/if}
		{:else}
			<!-- Flat layout (no sections) -->
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
									{#if item.estimatedDurationMinutes}
										<span class="text-xs text-base-content/40">{formatDuration(item.estimatedDurationMinutes)}</span>
									{/if}
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
								{#if item.estimatedDurationMinutes}
									<span class="text-xs text-base-content/40">{formatDuration(item.estimatedDurationMinutes)}</span>
								{/if}
							</div>
							<span class="text-xs text-base-content/40">#{i + 1}</span>
						</div>
					{/each}
				{/if}
			</div>
		{/if}
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
