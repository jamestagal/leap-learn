<script lang="ts">
	import type { PageProps } from "./$types";
	import { invalidateAll } from "$app/navigation";
	import {
		ArrowLeft,
		Plus,
		Trash2,
		GripVertical,
		Puzzle,
		FileText,
		Search,
		Save,
		ChevronDown,
		ChevronRight,
		FolderPlus,
		Clock,
		Pencil,
	} from "lucide-svelte";
	import { FEATURES } from "$lib/config/features";
	import {
		updateCourse,
		addCourseItem,
		removeCourseItem,
		reorderCourseItems,
		updateCourseItem,
		createSection,
		updateSection,
		deleteSection,
		reorderSections,
	} from "$lib/api/courses.remote";
	import type { CourseItemWithContent, CourseSection } from "$lib/api/courses.types";

	let { data }: PageProps = $props();
	let organisationSlug = $derived(data.organisation.slug);
	let course = $derived(data.course);
	let availableContent = $derived(data.availableContent);
	let contentUsageCounts = $derived(data.contentUsageCounts);

	// Editable course fields
	let editTitle = $state("");
	let editDescription = $state("");
	let savingCourse = $state(false);

	// Initialize editable fields when course loads
	$effect(() => {
		editTitle = course.title;
		editDescription = course.description || "";
	});

	// Item list (local copy for drag operations)
	let items = $state<CourseItemWithContent[]>([]);
	$effect(() => {
		items = [...course.items];
	});

	// Sections (local copy)
	let sections = $state<CourseSection[]>([]);
	$effect(() => {
		sections = [...course.sections];
	});

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

	// Group items by section
	let ungroupedItems = $derived(items.filter((i) => !i.sectionId));
	function sectionItems(sectionId: string) {
		return items.filter((i) => i.sectionId === sectionId);
	}

	// Content picker modal
	let showContentPicker = $state(false);
	let contentPickerTab = $state<"h5p" | "text">("h5p");
	let contentSearch = $state("");
	let addingItem = $state(false);
	let addToSectionId = $state<string | null>(null);

	// Text item form
	let textItemTitle = $state("");
	let textItemBody = $state("");
	let textItemDuration = $state<number | null>(null);

	// Section form
	let showSectionForm = $state(false);
	let sectionTitle = $state("");
	let creatingSectionLoading = $state(false);

	// Editing section
	let editingSectionId = $state<string | null>(null);
	let editingSectionTitle = $state("");
	let savingSectionLoading = $state(false);

	// Editing item duration
	let editingItemId = $state<string | null>(null);
	let editingItemDuration = $state<number | null>(null);
	let savingItemLoading = $state(false);

	// Filtered H5P content for picker
	let filteredContent = $derived(() => {
		if (!contentSearch.trim()) return availableContent;
		const q = contentSearch.toLowerCase();
		return availableContent.filter(
			(c) =>
				c.title.toLowerCase().includes(q) ||
				c.libraryTitle?.toLowerCase().includes(q),
		);
	});

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

	// Save course details
	async function saveCourseDetails() {
		savingCourse = true;
		try {
			await updateCourse({
				courseId: course.id,
				title: editTitle.trim(),
				description: editDescription.trim(),
			});
			await invalidateAll();
		} finally {
			savingCourse = false;
		}
	}

	// Add H5P content item
	async function handleAddH5PItem(contentId: string, contentTitle: string) {
		addingItem = true;
		try {
			await addCourseItem({
				courseId: course.id,
				itemType: "h5p",
				contentId,
				title: contentTitle,
				sectionId: addToSectionId,
			});
			await invalidateAll();
			showContentPicker = false;
		} finally {
			addingItem = false;
		}
	}

	// Add text item
	async function handleAddTextItem() {
		if (!textItemTitle.trim()) return;
		addingItem = true;
		try {
			await addCourseItem({
				courseId: course.id,
				itemType: "text",
				title: textItemTitle.trim(),
				bodyMarkdown: textItemBody.trim() || undefined,
				sectionId: addToSectionId,
				estimatedDurationMinutes: textItemDuration,
			});
			await invalidateAll();
			textItemTitle = "";
			textItemBody = "";
			textItemDuration = null;
			showContentPicker = false;
		} finally {
			addingItem = false;
		}
	}

	// Remove item
	function confirmRemoveItem(itemId: string, title: string) {
		confirmModal = {
			title: "Remove Item",
			message: `Remove <strong>${title}</strong> from this course? Existing progress records will be preserved.`,
			actionLabel: "Remove",
			actionClass: "btn-error",
			onConfirm: async () => {
				await removeCourseItem(itemId);
				await invalidateAll();
			},
		};
	}

	// Create section
	async function handleCreateSection() {
		if (!sectionTitle.trim()) return;
		creatingSectionLoading = true;
		try {
			await createSection({
				courseId: course.id,
				title: sectionTitle.trim(),
			});
			await invalidateAll();
			sectionTitle = "";
			showSectionForm = false;
		} finally {
			creatingSectionLoading = false;
		}
	}

	// Save section title
	async function handleSaveSection() {
		if (!editingSectionId || !editingSectionTitle.trim()) return;
		savingSectionLoading = true;
		try {
			await updateSection({
				sectionId: editingSectionId,
				title: editingSectionTitle.trim(),
			});
			await invalidateAll();
			editingSectionId = null;
		} finally {
			savingSectionLoading = false;
		}
	}

	// Delete section
	function confirmDeleteSection(sectionId: string, title: string) {
		confirmModal = {
			title: "Delete Section",
			message: `Delete section <strong>${title}</strong>? Items in this section will become ungrouped (not deleted).`,
			actionLabel: "Delete",
			actionClass: "btn-error",
			onConfirm: async () => {
				await deleteSection(sectionId);
				await invalidateAll();
			},
		};
	}

	// Save item duration
	async function handleSaveItemDuration() {
		if (!editingItemId) return;
		savingItemLoading = true;
		try {
			await updateCourseItem({
				itemId: editingItemId,
				estimatedDurationMinutes: editingItemDuration,
			});
			await invalidateAll();
			editingItemId = null;
		} finally {
			savingItemLoading = false;
		}
	}

	// Drag & drop reorder
	let dragIndex = $state<number | null>(null);
	let dragOverIndex = $state<number | null>(null);
	let dragContext = $state<string | null>(null); // sectionId or 'ungrouped'
	let dragOverContext = $state<string | null>(null);

	function handleDragStart(index: number, context: string) {
		dragIndex = index;
		dragContext = context;
	}

	function handleDragOver(e: DragEvent, index: number, context: string) {
		e.preventDefault();
		dragOverIndex = index;
		dragOverContext = context;
	}

	function handleDragLeave() {
		dragOverIndex = null;
		dragOverContext = null;
	}

	async function handleDrop(e: DragEvent, targetIndex: number, targetContext: string) {
		e.preventDefault();
		if (dragIndex === null || dragContext === null) {
			resetDrag();
			return;
		}

		// Get source items list
		const sourceItems = dragContext === "ungrouped"
			? ungroupedItems
			: sectionItems(dragContext);
		const sourceItem = sourceItems[dragIndex];

		if (!sourceItem) {
			resetDrag();
			return;
		}

		// Build new flat order: go through sections in order, then ungrouped
		const newOrder: Array<{ id: string; sectionId: string | null; sortOrder: number }> = [];
		let sortCounter = 0;

		// Determine target section ID
		const targetSectionId = targetContext === "ungrouped" ? null : targetContext;
		const sourceSectionId = dragContext === "ungrouped" ? null : dragContext;

		// Same context reorder
		if (dragContext === targetContext && dragIndex === targetIndex) {
			resetDrag();
			return;
		}

		// Build the new ordering
		// Collect all items grouped by their context
		const allContexts: Array<{ contextId: string; items: CourseItemWithContent[] }> = [];

		// Sections in order
		for (const section of sections) {
			allContexts.push({
				contextId: section.id,
				items: [...sectionItems(section.id)],
			});
		}
		// Ungrouped
		allContexts.push({
			contextId: "ungrouped",
			items: [...ungroupedItems],
		});

		// Remove the dragged item from its source
		for (const ctx of allContexts) {
			if (ctx.contextId === (dragContext === "ungrouped" ? "ungrouped" : dragContext)) {
				ctx.items = ctx.items.filter((item) => item.id !== sourceItem.id);
			}
		}

		// Insert into target
		for (const ctx of allContexts) {
			if (ctx.contextId === (targetContext === "ungrouped" ? "ungrouped" : targetContext)) {
				ctx.items.splice(targetIndex, 0, sourceItem);
			}
		}

		// Flatten with new sort orders and section assignments
		for (const ctx of allContexts) {
			for (const item of ctx.items) {
				newOrder.push({
					id: item.id,
					sectionId: ctx.contextId === "ungrouped" ? null : ctx.contextId,
					sortOrder: sortCounter++,
				});
			}
		}

		resetDrag();

		// Save to server
		await reorderCourseItems({ courseId: course.id, items: newOrder });
		await invalidateAll();
	}

	function handleDragEnd() {
		resetDrag();
	}

	function resetDrag() {
		dragIndex = null;
		dragOverIndex = null;
		dragContext = null;
		dragOverContext = null;
	}

	function openContentPicker(sectionId: string | null = null) {
		contentSearch = "";
		textItemTitle = "";
		textItemBody = "";
		textItemDuration = null;
		contentPickerTab = "h5p";
		addToSectionId = sectionId;
		showContentPicker = true;
	}

	function formatDuration(minutes: number | null): string {
		if (!minutes) return "";
		if (minutes < 60) return `${minutes} min`;
		const h = Math.floor(minutes / 60);
		const m = minutes % 60;
		return m > 0 ? `${h}h ${m}m` : `${h}h`;
	}

	function totalDuration(itemList: CourseItemWithContent[]): number {
		return itemList.reduce((sum, item) => sum + (item.estimatedDurationMinutes || 0), 0);
	}
</script>

<!-- Header -->
<div class="mb-6">
	<a href="/{organisationSlug}/courses/{course.id}" class="btn btn-ghost btn-sm gap-1 mb-4">
		<ArrowLeft class="h-4 w-4" />
		Back to Course
	</a>
	<h1 class="text-2xl font-bold flex items-center gap-2">
		<FEATURES.courses.icon class="h-7 w-7" style="color: {FEATURES.courses.color}" />
		Edit Course
	</h1>
</div>

<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
	<!-- Left: Course Details -->
	<div class="lg:col-span-1">
		<div class="card bg-base-100 border border-base-300">
			<div class="card-body">
				<h3 class="font-semibold mb-3">Course Details</h3>

				<div class="form-control mb-3">
					<label class="label" for="edit-title">
						<span class="label-text text-sm">Title</span>
					</label>
					<input
						id="edit-title"
						type="text"
						class="input input-bordered input-sm"
						bind:value={editTitle}
					/>
				</div>

				<div class="form-control mb-4">
					<label class="label" for="edit-desc">
						<span class="label-text text-sm">Description</span>
					</label>
					<textarea
						id="edit-desc"
						class="textarea textarea-bordered textarea-sm h-20"
						bind:value={editDescription}
					></textarea>
				</div>

				<button
					class="btn btn-primary btn-sm gap-1"
					onclick={saveCourseDetails}
					disabled={savingCourse || !editTitle.trim()}
				>
					{#if savingCourse}
						<span class="loading loading-spinner loading-xs"></span>
					{:else}
						<Save class="h-3.5 w-3.5" />
					{/if}
					Save Details
				</button>
			</div>
		</div>
	</div>

	<!-- Right: Course Structure -->
	<div class="lg:col-span-2">
		<div class="card bg-base-100 border border-base-300">
			<div class="card-body">
				<div class="flex items-center justify-between mb-4">
					<h3 class="font-semibold">Course Structure ({items.length} items)</h3>
					<div class="flex gap-2">
						<button
							class="btn btn-ghost btn-sm gap-1"
							onclick={() => (showSectionForm = !showSectionForm)}
						>
							<FolderPlus class="h-3.5 w-3.5" />
							Add Section
						</button>
						<button class="btn btn-primary btn-sm gap-1" onclick={() => openContentPicker(null)}>
							<Plus class="h-3.5 w-3.5" />
							Add Item
						</button>
					</div>
				</div>

				<!-- Add Section Form -->
				{#if showSectionForm}
					<div class="border border-base-300 rounded-lg p-3 mb-4 bg-base-200/50">
						<div class="flex items-center gap-2">
							<input
								type="text"
								class="input input-bordered input-sm flex-1"
								placeholder="Section title..."
								bind:value={sectionTitle}
								onkeydown={(e) => e.key === "Enter" && handleCreateSection()}
							/>
							<button
								class="btn btn-primary btn-sm"
								onclick={handleCreateSection}
								disabled={creatingSectionLoading || !sectionTitle.trim()}
							>
								{#if creatingSectionLoading}
									<span class="loading loading-spinner loading-xs"></span>
								{/if}
								Add
							</button>
							<button class="btn btn-ghost btn-sm" onclick={() => (showSectionForm = false)}>
								Cancel
							</button>
						</div>
					</div>
				{/if}

				{#if items.length === 0 && sections.length === 0}
					<div class="text-center py-8">
						<Puzzle class="h-10 w-10 mx-auto mb-3 opacity-30" />
						<p class="text-base-content/60 mb-3">No items yet. Add sections and content to build your course.</p>
						<button class="btn btn-primary btn-sm gap-1" onclick={() => openContentPicker(null)}>
							<Plus class="h-3.5 w-3.5" />
							Add First Item
						</button>
					</div>
				{:else}
					<!-- Sections -->
					{#each sections as section, sectionIdx (section.id)}
						{@const sItems = sectionItems(section.id)}
						{@const isCollapsed = collapsedSections.has(section.id)}
						{@const sectionDuration = totalDuration(sItems)}
						<div class="border border-base-300 rounded-lg mb-3">
							<!-- Section Header -->
							<div class="flex items-center gap-2 p-3 bg-base-200/50 rounded-t-lg">
								<button
									class="btn btn-ghost btn-xs btn-square"
									onclick={() => toggleSection(section.id)}
								>
									{#if isCollapsed}
										<ChevronRight class="h-4 w-4" />
									{:else}
										<ChevronDown class="h-4 w-4" />
									{/if}
								</button>

								{#if editingSectionId === section.id}
									<input
										type="text"
										class="input input-bordered input-xs flex-1"
										bind:value={editingSectionTitle}
										onkeydown={(e) => e.key === "Enter" && handleSaveSection()}
									/>
									<button
										class="btn btn-primary btn-xs"
										onclick={handleSaveSection}
										disabled={savingSectionLoading}
									>
										{#if savingSectionLoading}
											<span class="loading loading-spinner loading-xs"></span>
										{/if}
										Save
									</button>
									<button
										class="btn btn-ghost btn-xs"
										onclick={() => (editingSectionId = null)}
									>
										Cancel
									</button>
								{:else}
									<span class="font-semibold text-sm flex-1">{section.title}</span>
									<span class="text-xs text-base-content/50">
										{sItems.length} item{sItems.length !== 1 ? "s" : ""}
										{#if sectionDuration > 0}
											&middot; {formatDuration(sectionDuration)}
										{/if}
									</span>
									<button
										class="btn btn-ghost btn-xs"
										title="Rename section"
										onclick={() => {
											editingSectionId = section.id;
											editingSectionTitle = section.title;
										}}
									>
										<Pencil class="h-3 w-3" />
									</button>
									<button
										class="btn btn-ghost btn-xs"
										title="Add item to section"
										onclick={() => openContentPicker(section.id)}
									>
										<Plus class="h-3 w-3" />
									</button>
									<button
										class="btn btn-ghost btn-xs text-error"
										title="Delete section"
										onclick={() => confirmDeleteSection(section.id, section.title)}
									>
										<Trash2 class="h-3 w-3" />
									</button>
								{/if}
							</div>

							<!-- Section Items -->
							{#if !isCollapsed}
								<div class="p-1">
									{#if sItems.length === 0}
										<div
											class="text-center py-4 text-sm text-base-content/40 border border-dashed border-base-300 rounded-lg m-2"
											ondragover={(e) => handleDragOver(e, 0, section.id)}
											ondragleave={handleDragLeave}
											ondrop={(e) => handleDrop(e, 0, section.id)}
											role="listitem"
										>
											Drag items here or click + to add
										</div>
									{:else}
										{#each sItems as item, i (item.id)}
											{@const isDragOver = dragOverIndex === i && dragOverContext === section.id}
											{@const isDragging = dragIndex === i && dragContext === section.id}
											<div
												class="flex items-center gap-2 p-2 mx-1 rounded-lg transition-colors
													{isDragOver ? 'border border-primary bg-primary/5' : 'border border-transparent'}
													{isDragging ? 'opacity-50' : ''}"
												draggable="true"
												ondragstart={() => handleDragStart(i, section.id)}
												ondragover={(e) => handleDragOver(e, i, section.id)}
												ondragleave={handleDragLeave}
												ondrop={(e) => handleDrop(e, i, section.id)}
												ondragend={handleDragEnd}
												role="listitem"
											>
												<div class="cursor-grab text-base-content/30 hover:text-base-content/60">
													<GripVertical class="h-4 w-4" />
												</div>

												<div class="flex-1 min-w-0">
													<div class="flex items-center gap-2">
														{#if item.itemType === "h5p"}
															<Puzzle class="h-4 w-4 text-info shrink-0" />
														{:else}
															<FileText class="h-4 w-4 text-base-content/50 shrink-0" />
														{/if}
														<span class="font-medium truncate text-sm">{item.title}</span>
														{#if item.estimatedDurationMinutes}
															<span class="badge badge-ghost badge-xs gap-0.5 shrink-0">
																<Clock class="h-2.5 w-2.5" />
																{formatDuration(item.estimatedDurationMinutes)}
															</span>
														{/if}
													</div>
													{#if item.libraryTitle || item.libraryMachineName}
														<span class="text-xs text-base-content/50 ml-6">
															{item.libraryTitle || item.libraryMachineName}
														</span>
													{/if}
												</div>

												<button
													class="btn btn-ghost btn-xs"
													title="Set duration"
													onclick={() => {
														editingItemId = item.id;
														editingItemDuration = item.estimatedDurationMinutes;
													}}
												>
													<Clock class="h-3 w-3" />
												</button>

												<button
													class="btn btn-ghost btn-xs text-error"
													title="Remove item"
													onclick={() => confirmRemoveItem(item.id, item.title)}
												>
													<Trash2 class="h-3.5 w-3.5" />
												</button>
											</div>
										{/each}
									{/if}
								</div>
							{/if}
						</div>
					{/each}

					<!-- Ungrouped Items -->
					{#if ungroupedItems.length > 0 || sections.length > 0}
						{#if ungroupedItems.length > 0}
							{@const ungroupedDuration = totalDuration(ungroupedItems)}
							<div class="mt-2">
								{#if sections.length > 0}
									<div class="flex items-center gap-2 px-2 py-1 mb-1">
										<span class="text-xs font-semibold text-base-content/50 uppercase">Ungrouped</span>
										<span class="text-xs text-base-content/40">
											{ungroupedItems.length} item{ungroupedItems.length !== 1 ? "s" : ""}
											{#if ungroupedDuration > 0}
												&middot; {formatDuration(ungroupedDuration)}
											{/if}
										</span>
									</div>
								{/if}
								<div class="space-y-1">
									{#each ungroupedItems as item, i (item.id)}
										{@const isDragOver = dragOverIndex === i && dragOverContext === "ungrouped"}
										{@const isDragging = dragIndex === i && dragContext === "ungrouped"}
										<div
											class="flex items-center gap-2 p-2 rounded-lg transition-colors
												{isDragOver ? 'border border-primary bg-primary/5' : 'border border-transparent'}
												{isDragging ? 'opacity-50' : ''}"
											draggable="true"
											ondragstart={() => handleDragStart(i, "ungrouped")}
											ondragover={(e) => handleDragOver(e, i, "ungrouped")}
											ondragleave={handleDragLeave}
											ondrop={(e) => handleDrop(e, i, "ungrouped")}
											ondragend={handleDragEnd}
											role="listitem"
										>
											<div class="cursor-grab text-base-content/30 hover:text-base-content/60">
												<GripVertical class="h-4 w-4" />
											</div>

											<div class="flex-1 min-w-0">
												<div class="flex items-center gap-2">
													{#if item.itemType === "h5p"}
														<Puzzle class="h-4 w-4 text-info shrink-0" />
													{:else}
														<FileText class="h-4 w-4 text-base-content/50 shrink-0" />
													{/if}
													<span class="font-medium truncate text-sm">{item.title}</span>
													{#if item.estimatedDurationMinutes}
														<span class="badge badge-ghost badge-xs gap-0.5 shrink-0">
															<Clock class="h-2.5 w-2.5" />
															{formatDuration(item.estimatedDurationMinutes)}
														</span>
													{/if}
												</div>
												{#if item.libraryTitle || item.libraryMachineName}
													<span class="text-xs text-base-content/50 ml-6">
														{item.libraryTitle || item.libraryMachineName}
													</span>
												{/if}
											</div>

											<button
												class="btn btn-ghost btn-xs"
												title="Set duration"
												onclick={() => {
													editingItemId = item.id;
													editingItemDuration = item.estimatedDurationMinutes;
												}}
											>
												<Clock class="h-3 w-3" />
											</button>

											<button
												class="btn btn-ghost btn-xs text-error"
												title="Remove item"
												onclick={() => confirmRemoveItem(item.id, item.title)}
											>
												<Trash2 class="h-3.5 w-3.5" />
											</button>
										</div>
									{/each}
								</div>
							</div>
						{/if}
					{/if}

					<p class="text-xs text-base-content/40 mt-3">Drag items to reorder or move between sections.</p>
				{/if}
			</div>
		</div>
	</div>
</div>

<!-- Content Picker Modal -->
{#if showContentPicker}
	<div class="modal modal-open" role="dialog">
		<div class="modal-box max-w-2xl">
			<h3 class="text-lg font-bold mb-4">
				Add Item
				{#if addToSectionId}
					{@const s = sections.find((s) => s.id === addToSectionId)}
					{#if s}
						<span class="text-sm font-normal text-base-content/60">to {s.title}</span>
					{/if}
				{/if}
			</h3>

			<!-- Tabs -->
			<div class="tabs tabs-bordered mb-4">
				<button
					class="tab {contentPickerTab === 'h5p' ? 'tab-active' : ''}"
					onclick={() => (contentPickerTab = "h5p")}
				>
					<Puzzle class="h-4 w-4 mr-1" />
					H5P Content
				</button>
				<button
					class="tab {contentPickerTab === 'text' ? 'tab-active' : ''}"
					onclick={() => (contentPickerTab = "text")}
				>
					<FileText class="h-4 w-4 mr-1" />
					Text Item
				</button>
			</div>

			{#if contentPickerTab === "h5p"}
				<!-- H5P Content Search -->
				<div class="relative mb-4">
					<Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-base-content/40" />
					<input
						type="text"
						placeholder="Search content..."
						class="input input-bordered input-sm w-full pl-9"
						bind:value={contentSearch}
					/>
				</div>

				<!-- Content List -->
				<div class="max-h-80 overflow-y-auto space-y-1">
					{#if filteredContent().length === 0}
						<div class="text-center py-6">
							<p class="text-base-content/60">
								{availableContent.length === 0
									? "No H5P content available. Create content first."
									: "No content matches your search."}
							</p>
						</div>
					{:else}
						{#each filteredContent() as content (content.id)}
							{@const alreadyAdded = items.some((item) => item.contentId === content.id)}
							{@const usageCount = contentUsageCounts[content.id] || 0}
							<button
								class="flex items-center gap-3 w-full p-3 rounded-lg border border-base-300 text-left
									{alreadyAdded ? 'opacity-50 cursor-not-allowed' : 'hover:border-primary hover:bg-primary/5 cursor-pointer'}"
								onclick={() => !alreadyAdded && handleAddH5PItem(content.id, content.title)}
								disabled={addingItem || alreadyAdded}
							>
								<Puzzle class="h-5 w-5 text-info shrink-0" />
								<div class="flex-1 min-w-0">
									<div class="font-medium truncate">{content.title}</div>
									<div class="text-xs text-base-content/50">
										{content.libraryTitle || content.libraryName}
										{#if content.libraryVersion}
											<span class="ml-1">v{content.libraryVersion}</span>
										{/if}
										{#if usageCount > 0}
											<span class="badge badge-outline badge-xs ml-1">Used in {usageCount} {usageCount === 1 ? 'course' : 'courses'}</span>
										{/if}
									</div>
								</div>
								{#if alreadyAdded}
									<span class="badge badge-ghost badge-sm">Added</span>
								{:else if addingItem}
									<span class="loading loading-spinner loading-xs"></span>
								{:else}
									<Plus class="h-4 w-4 text-base-content/40" />
								{/if}
							</button>
						{/each}
					{/if}
				</div>
			{:else}
				<!-- Text Item Form -->
				<div class="space-y-4">
					<div class="form-control">
						<label class="label" for="text-title">
							<span class="label-text">Title <span class="text-error">*</span></span>
						</label>
						<input
							id="text-title"
							type="text"
							class="input input-bordered input-sm"
							placeholder="e.g. Introduction"
							bind:value={textItemTitle}
						/>
					</div>
					<div class="form-control">
						<label class="label" for="text-body">
							<span class="label-text">Content (Markdown)</span>
						</label>
						<textarea
							id="text-body"
							class="textarea textarea-bordered h-32"
							placeholder="Write your content here..."
							bind:value={textItemBody}
						></textarea>
					</div>
					<div class="form-control">
						<label class="label" for="text-duration">
							<span class="label-text">Estimated Duration (minutes)</span>
						</label>
						<input
							id="text-duration"
							type="number"
							class="input input-bordered input-sm w-32"
							placeholder="e.g. 5"
							min="1"
							max="600"
							bind:value={textItemDuration}
						/>
					</div>
					<button
						class="btn btn-primary btn-sm gap-1"
						onclick={handleAddTextItem}
						disabled={addingItem || !textItemTitle.trim()}
					>
						{#if addingItem}
							<span class="loading loading-spinner loading-xs"></span>
						{/if}
						Add Text Item
					</button>
				</div>
			{/if}

			<div class="modal-action">
				<button
					class="btn btn-ghost"
					onclick={() => (showContentPicker = false)}
					disabled={addingItem}
				>
					Close
				</button>
			</div>
		</div>
		<div class="modal-backdrop" onclick={() => !addingItem && (showContentPicker = false)}></div>
	</div>
{/if}

<!-- Duration Editor Modal -->
{#if editingItemId}
	<div class="modal modal-open" role="dialog">
		<div class="modal-box max-w-sm">
			<h3 class="text-lg font-bold mb-4">Estimated Duration</h3>
			<div class="form-control">
				<label class="label" for="item-duration">
					<span class="label-text">Duration in minutes</span>
				</label>
				<input
					id="item-duration"
					type="number"
					class="input input-bordered input-sm w-32"
					placeholder="e.g. 5"
					min="1"
					max="600"
					bind:value={editingItemDuration}
				/>
				<label class="label">
					<span class="label-text-alt text-base-content/50">Leave empty for no estimate</span>
				</label>
			</div>
			<div class="modal-action">
				<button class="btn btn-ghost" onclick={() => (editingItemId = null)} disabled={savingItemLoading}>
					Cancel
				</button>
				<button class="btn btn-primary btn-sm" onclick={handleSaveItemDuration} disabled={savingItemLoading}>
					{#if savingItemLoading}
						<span class="loading loading-spinner loading-xs"></span>
					{/if}
					Save
				</button>
			</div>
		</div>
		<div class="modal-backdrop" onclick={() => !savingItemLoading && (editingItemId = null)}></div>
	</div>
{/if}

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
