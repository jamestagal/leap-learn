<script lang="ts">
	import type { PageProps } from "./$types";
	import { invalidateAll } from "$app/navigation";
	import {
		ArrowLeft,
		ChevronLeft,
		ChevronRight,
		CheckCircle,
		Circle,
		List,
	} from "lucide-svelte";
	import H5PPlayer from "$lib/components/h5p/H5PPlayer.svelte";

	let { data }: PageProps = $props();
	let organisationSlug = $derived(data.organisation.slug);
	let course = $derived(data.course);
	let currentItem = $derived(data.currentItem);
	let currentProgress = $derived(data.currentProgress);
	let prevItem = $derived(data.prevItem);
	let nextItem = $derived(data.nextItem);
	let currentIndex = $derived(data.currentIndex);
	let progress = $derived(data.progress);

	let showSidebar = $state(false);

	// xAPI tracking
	let xapiBuffer: Array<{ contentId: string; verb: string; statement: unknown }> = [];

	async function sendXapi(contentId: string, verb: string, statement: unknown) {
		try {
			await fetch("/api/h5p/xapi", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ contentId, verb, statement }),
			});
		} catch (err) {
			console.error("xAPI send failed:", err);
			xapiBuffer.push({ contentId, verb, statement });
		}
	}

	function extractVerb(verbObj: { id?: string } | string): string {
		const id = typeof verbObj === "string" ? verbObj : verbObj?.id || "";
		const parts = id.split("/");
		return parts[parts.length - 1] || "unknown";
	}

	// Flush buffered xAPI on page unload
	function flushXapiBuffer() {
		for (const item of xapiBuffer) {
			try {
				navigator.sendBeacon("/api/h5p/xapi", JSON.stringify(item));
			} catch {
				// Best effort
			}
		}
		xapiBuffer = [];
	}

	// Total progress
	let totalItems = $derived(progress.length);
	let completedItems = $derived(progress.filter((p) => p.completed).length);
	let percentage = $derived(totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0);
</script>

<svelte:window onbeforeunload={flushXapiBuffer} />

<!-- Compact Header -->
<div class="flex items-center justify-between mb-4">
	<div class="flex items-center gap-2">
		<a href="/{organisationSlug}/learn/{course.id}" class="btn btn-ghost btn-sm btn-square">
			<ArrowLeft class="h-4 w-4" />
		</a>
		<div>
			<div class="text-xs text-base-content/50">{course.title}</div>
			<h1 class="text-lg font-bold leading-tight">{currentItem.title}</h1>
		</div>
	</div>

	<div class="flex items-center gap-2">
		<!-- Progress Badge -->
		<span class="text-xs text-base-content/50">{currentIndex + 1} of {course.items.length}</span>

		{#if currentProgress?.completed}
			<span class="badge badge-success badge-sm gap-1">
				<CheckCircle class="h-3 w-3" />
				Complete
			</span>
		{/if}

		<!-- Sidebar Toggle -->
		<button
			class="btn btn-ghost btn-sm btn-square lg:hidden"
			onclick={() => (showSidebar = !showSidebar)}
		>
			<List class="h-4 w-4" />
		</button>
	</div>
</div>

<div class="flex gap-4">
	<!-- Main Content Area -->
	<div class="flex-1 min-w-0">
		{#if currentItem.itemType === "h5p" && currentItem.contentId}
			<!-- H5P Player -->
			<H5PPlayer
				contentId={currentItem.contentId}
				organisationId={course.orgId}
				onXAPIStatement={(stmt) => {
					const verb = extractVerb(
						(stmt as { verb?: { id?: string } | string }).verb ?? "",
					);
					if (currentItem.contentId) {
						sendXapi(currentItem.contentId, verb, stmt);
					}
				}}
				onComplete={() => setTimeout(() => invalidateAll(), 1000)}
			/>
		{:else if currentItem.itemType === "text"}
			<!-- Text Content -->
			<div class="card bg-base-100 border border-base-300">
				<div class="card-body prose max-w-none">
					<h2>{currentItem.title}</h2>
					{#if currentItem.bodyMarkdown}
						<p class="whitespace-pre-wrap">{currentItem.bodyMarkdown}</p>
					{:else}
						<p class="text-base-content/50 italic">No content.</p>
					{/if}
				</div>
			</div>
		{/if}

		<!-- Prev / Next Navigation -->
		<div class="flex items-center justify-between mt-4">
			{#if prevItem}
				<a
					href="/{organisationSlug}/learn/{course.id}/{prevItem.id}"
					class="btn btn-ghost btn-sm gap-1"
				>
					<ChevronLeft class="h-4 w-4" />
					Previous
				</a>
			{:else}
				<div></div>
			{/if}

			{#if nextItem}
				<a
					href="/{organisationSlug}/learn/{course.id}/{nextItem.id}"
					class="btn btn-primary btn-sm gap-1"
				>
					Next
					<ChevronRight class="h-4 w-4" />
				</a>
			{:else}
				<a
					href="/{organisationSlug}/learn/{course.id}"
					class="btn btn-ghost btn-sm gap-1"
				>
					Back to Overview
				</a>
			{/if}
		</div>
	</div>

	<!-- Sidebar: Item List (desktop always visible, mobile toggle) -->
	<div class="hidden lg:block w-72 shrink-0">
		<div class="card bg-base-100 border border-base-300 sticky top-4">
			<div class="card-body p-3">
				<div class="flex items-center justify-between mb-2">
					<span class="text-sm font-semibold">Progress</span>
					<span class="text-xs text-base-content/50">{percentage}%</span>
				</div>
				<progress class="progress progress-primary w-full mb-3" value={percentage} max="100"></progress>

				<div class="space-y-0.5">
					{#each progress as item (item.itemId)}
						{@const isCurrent = item.itemId === currentItem.id}
						<a
							href="/{organisationSlug}/learn/{course.id}/{item.itemId}"
							class="flex items-center gap-2 p-2 rounded-md text-sm transition-colors
								{isCurrent ? 'bg-primary/10 font-medium' : 'hover:bg-base-200'}"
						>
							{#if item.completed}
								<CheckCircle class="h-4 w-4 text-success shrink-0" />
							{:else}
								<Circle class="h-4 w-4 text-base-content/20 shrink-0" />
							{/if}
							<span class="truncate {item.completed && !isCurrent ? 'text-base-content/60' : ''}">
								{item.title}
							</span>
						</a>
					{/each}
				</div>
			</div>
		</div>
	</div>
</div>

<!-- Mobile Sidebar Modal -->
{#if showSidebar}
	<div class="modal modal-open lg:hidden" role="dialog">
		<div class="modal-box">
			<h3 class="font-semibold mb-3">Course Items</h3>
			<div class="mb-3">
				<progress class="progress progress-primary w-full" value={percentage} max="100"></progress>
				<span class="text-xs text-base-content/50">{completedItems}/{totalItems} complete</span>
			</div>
			<div class="space-y-0.5">
				{#each progress as item (item.itemId)}
					{@const isCurrent = item.itemId === currentItem.id}
					<a
						href="/{organisationSlug}/learn/{course.id}/{item.itemId}"
						onclick={() => (showSidebar = false)}
						class="flex items-center gap-2 p-2 rounded-md text-sm transition-colors
							{isCurrent ? 'bg-primary/10 font-medium' : 'hover:bg-base-200'}"
					>
						{#if item.completed}
							<CheckCircle class="h-4 w-4 text-success shrink-0" />
						{:else}
							<Circle class="h-4 w-4 text-base-content/20 shrink-0" />
						{/if}
						<span class="truncate">{item.title}</span>
					</a>
				{/each}
			</div>
			<div class="modal-action">
				<button class="btn btn-ghost" onclick={() => (showSidebar = false)}>Close</button>
			</div>
		</div>
		<div class="modal-backdrop" onclick={() => (showSidebar = false)}></div>
	</div>
{/if}
