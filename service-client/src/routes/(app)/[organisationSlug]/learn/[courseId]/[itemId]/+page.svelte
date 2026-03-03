<script lang="ts">
	import type { PageProps } from "./$types";
	import { invalidateAll } from "$app/navigation";
	import {
		ArrowLeft,
		ChevronLeft,
		ChevronRight,
		ChevronDown,
		CheckCircle,
		Circle,
		List,
		FileText,
		Puzzle,
		Video,
		Clock,
	} from "lucide-svelte";
	import H5PPlayer from "$lib/components/h5p/H5PPlayer.svelte";

	let { data }: PageProps = $props();
	let organisationSlug = $derived(data.organisation.slug);
	let course = $derived(data.course);
	let sections = $derived(data.course.sections);
	let currentItem = $derived(data.currentItem);
	let currentProgress = $derived(data.currentProgress);
	let prevItem = $derived(data.prevItem);
	let nextItem = $derived(data.nextItem);
	let currentIndex = $derived(data.currentIndex);
	let progress = $derived(data.progress);

	let showSidebar = $state(false);

	// Collapsed sections in sidebar
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

	let hasSections = $derived(sections.length > 0);

	// Group progress by section
	function progressForSection(sectionId: string) {
		return progress.filter((p) => p.sectionId === sectionId);
	}

	function ungroupedProgress() {
		return progress.filter((p) => !p.sectionId);
	}

	function sectionCompletedCount(sectionId: string): number {
		return progress.filter((p) => p.sectionId === sectionId && p.completed).length;
	}

	function sectionTotalCount(sectionId: string): number {
		return progress.filter((p) => p.sectionId === sectionId).length;
	}

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

	function formatDuration(minutes: number): string {
		if (minutes < 60) return `${minutes} min`;
		const h = Math.floor(minutes / 60);
		const m = minutes % 60;
		return m > 0 ? `${h}h ${m}m` : `${h}h`;
	}
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

		{#if currentItem.estimatedDurationMinutes}
			<span class="badge badge-ghost badge-sm gap-1">
				<Clock class="h-3 w-3" />
				{formatDuration(currentItem.estimatedDurationMinutes)}
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

				{#if hasSections}
					<!-- Grouped sidebar -->
					{#each sections as section (section.id)}
						{@const sItems = progressForSection(section.id)}
						{@const sCompleted = sectionCompletedCount(section.id)}
						{@const sTotal = sectionTotalCount(section.id)}
						{@const isCollapsed = collapsedSections.has(section.id)}

						{#if sItems.length > 0}
							<button
								class="flex items-center gap-1.5 w-full px-2 py-1.5 rounded-md text-xs hover:bg-base-200 transition-colors text-left"
								onclick={() => toggleSection(section.id)}
							>
								{#if isCollapsed}
									<ChevronRight class="h-3 w-3 text-base-content/40 shrink-0" />
								{:else}
									<ChevronDown class="h-3 w-3 text-base-content/40 shrink-0" />
								{/if}
								<span class="font-semibold flex-1 truncate">{section.title}</span>
								<span class="text-base-content/40">{sCompleted}/{sTotal}</span>
							</button>
							{#if !isCollapsed}
								{#each sItems as item (item.itemId)}
									{@const isCurrent = item.itemId === currentItem.id}
									<a
										href="/{organisationSlug}/learn/{course.id}/{item.itemId}"
										class="flex items-center gap-2 p-2 pl-6 rounded-md text-sm transition-colors
											{isCurrent ? 'bg-primary/10 font-medium' : 'hover:bg-base-200'}"
									>
										{#if item.completed}
											<CheckCircle class="h-4 w-4 text-success shrink-0" />
										{:else}
											<Circle class="h-4 w-4 text-base-content/20 shrink-0" />
										{/if}
										{#if item.itemType === "h5p"}
											<Puzzle class="h-3.5 w-3.5 text-primary/60 shrink-0" />
										{:else if item.itemType === "video"}
											<Video class="h-3.5 w-3.5 text-primary/60 shrink-0" />
										{:else}
											<FileText class="h-3.5 w-3.5 text-base-content/30 shrink-0" />
										{/if}
										<span class="truncate {item.completed && !isCurrent ? 'text-base-content/60' : ''}">
											{item.title}
										</span>
										{#if item.estimatedDurationMinutes}
											<span class="text-[10px] text-base-content/30 shrink-0 ml-auto">{item.estimatedDurationMinutes}m</span>
										{/if}
									</a>
								{/each}
							{/if}
						{/if}
					{/each}

					<!-- Ungrouped items in sidebar -->
					{@const uItems = ungroupedProgress()}
					{#if uItems.length > 0}
						{#each uItems as item (item.itemId)}
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
								{#if item.itemType === "h5p"}
									<Puzzle class="h-3.5 w-3.5 text-primary/60 shrink-0" />
								{:else if item.itemType === "video"}
									<Video class="h-3.5 w-3.5 text-primary/60 shrink-0" />
								{:else}
									<FileText class="h-3.5 w-3.5 text-base-content/30 shrink-0" />
								{/if}
								<span class="truncate {item.completed && !isCurrent ? 'text-base-content/60' : ''}">
									{item.title}
								</span>
								{#if item.estimatedDurationMinutes}
									<span class="text-[10px] text-base-content/30 shrink-0 ml-auto">{item.estimatedDurationMinutes}m</span>
								{/if}
							</a>
						{/each}
					{/if}
				{:else}
					<!-- Flat sidebar -->
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
								{#if item.itemType === "h5p"}
									<Puzzle class="h-3.5 w-3.5 text-primary/60 shrink-0" />
								{:else if item.itemType === "video"}
									<Video class="h-3.5 w-3.5 text-primary/60 shrink-0" />
								{:else}
									<FileText class="h-3.5 w-3.5 text-base-content/30 shrink-0" />
								{/if}
								<span class="truncate {item.completed && !isCurrent ? 'text-base-content/60' : ''}">
									{item.title}
								</span>
								{#if item.estimatedDurationMinutes}
									<span class="text-[10px] text-base-content/30 shrink-0 ml-auto">{item.estimatedDurationMinutes}m</span>
								{/if}
							</a>
						{/each}
					</div>
				{/if}
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

			{#if hasSections}
				{#each sections as section (section.id)}
					{@const sItems = progressForSection(section.id)}
					{@const sCompleted = sectionCompletedCount(section.id)}
					{@const sTotal = sectionTotalCount(section.id)}
					{@const isCollapsed = collapsedSections.has(section.id)}

					{#if sItems.length > 0}
						<button
							class="flex items-center gap-1.5 w-full px-2 py-1.5 rounded-md text-xs hover:bg-base-200 transition-colors text-left"
							onclick={() => toggleSection(section.id)}
						>
							{#if isCollapsed}
								<ChevronRight class="h-3 w-3 text-base-content/40 shrink-0" />
							{:else}
								<ChevronDown class="h-3 w-3 text-base-content/40 shrink-0" />
							{/if}
							<span class="font-semibold flex-1 truncate">{section.title}</span>
							<span class="text-base-content/40">{sCompleted}/{sTotal}</span>
						</button>
						{#if !isCollapsed}
							{#each sItems as item (item.itemId)}
								{@const isCurrent = item.itemId === currentItem.id}
								<a
									href="/{organisationSlug}/learn/{course.id}/{item.itemId}"
									onclick={() => (showSidebar = false)}
									class="flex items-center gap-2 p-2 pl-6 rounded-md text-sm transition-colors
										{isCurrent ? 'bg-primary/10 font-medium' : 'hover:bg-base-200'}"
								>
									{#if item.completed}
										<CheckCircle class="h-4 w-4 text-success shrink-0" />
									{:else}
										<Circle class="h-4 w-4 text-base-content/20 shrink-0" />
									{/if}
									{#if item.itemType === "h5p"}
										<Puzzle class="h-3.5 w-3.5 text-primary/60 shrink-0" />
									{:else if item.itemType === "video"}
										<Video class="h-3.5 w-3.5 text-primary/60 shrink-0" />
									{:else}
										<FileText class="h-3.5 w-3.5 text-base-content/30 shrink-0" />
									{/if}
									<span class="truncate">{item.title}</span>
									{#if item.estimatedDurationMinutes}
										<span class="text-[10px] text-base-content/30 shrink-0 ml-auto">{item.estimatedDurationMinutes}m</span>
									{/if}
								</a>
							{/each}
						{/if}
					{/if}
				{/each}

				{@const uItems = ungroupedProgress()}
				{#if uItems.length > 0}
					{#each uItems as item (item.itemId)}
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
							{#if item.itemType === "h5p"}
								<Puzzle class="h-3.5 w-3.5 text-primary/60 shrink-0" />
							{:else if item.itemType === "video"}
								<Video class="h-3.5 w-3.5 text-primary/60 shrink-0" />
							{:else}
								<FileText class="h-3.5 w-3.5 text-base-content/30 shrink-0" />
							{/if}
							<span class="truncate">{item.title}</span>
						</a>
					{/each}
				{/if}
			{:else}
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
							{#if item.itemType === "h5p"}
								<Puzzle class="h-3.5 w-3.5 text-primary/60 shrink-0" />
							{:else if item.itemType === "video"}
								<Video class="h-3.5 w-3.5 text-primary/60 shrink-0" />
							{:else}
								<FileText class="h-3.5 w-3.5 text-base-content/30 shrink-0" />
							{/if}
							<span class="truncate">{item.title}</span>
						</a>
					{/each}
				</div>
			{/if}

			<div class="modal-action">
				<button class="btn btn-ghost" onclick={() => (showSidebar = false)}>Close</button>
			</div>
		</div>
		<div class="modal-backdrop" onclick={() => (showSidebar = false)}></div>
	</div>
{/if}
