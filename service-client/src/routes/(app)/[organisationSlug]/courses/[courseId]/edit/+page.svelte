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
	} from "lucide-svelte";
	import { FEATURES } from "$lib/config/features";
	import {
		updateCourse,
		addCourseItem,
		removeCourseItem,
		reorderCourseItems,
	} from "$lib/api/courses.remote";
	import type { CourseItemWithContent } from "$lib/api/courses.types";

	let { data }: PageProps = $props();
	let organisationSlug = $derived(data.organisation.slug);
	let course = $derived(data.course);
	let availableContent = $derived(data.availableContent);

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

	// Content picker modal
	let showContentPicker = $state(false);
	let contentPickerTab = $state<"h5p" | "text">("h5p");
	let contentSearch = $state("");
	let addingItem = $state(false);

	// Text item form
	let textItemTitle = $state("");
	let textItemBody = $state("");

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
			});
			await invalidateAll();
			textItemTitle = "";
			textItemBody = "";
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

	// Drag & drop reorder
	let dragIndex = $state<number | null>(null);
	let dragOverIndex = $state<number | null>(null);

	function handleDragStart(index: number) {
		dragIndex = index;
	}

	function handleDragOver(e: DragEvent, index: number) {
		e.preventDefault();
		dragOverIndex = index;
	}

	function handleDragLeave() {
		dragOverIndex = null;
	}

	async function handleDrop(e: DragEvent, targetIndex: number) {
		e.preventDefault();
		if (dragIndex === null || dragIndex === targetIndex) {
			dragIndex = null;
			dragOverIndex = null;
			return;
		}

		// Reorder locally
		const itemsCopy = [...items];
		const removed = itemsCopy.splice(dragIndex, 1);
		if (removed[0]) {
			itemsCopy.splice(targetIndex, 0, removed[0]);
		}
		items = itemsCopy;

		dragIndex = null;
		dragOverIndex = null;

		// Save to server
		const reorderData = itemsCopy.map((item, i) => ({
			id: item.id,
			sortOrder: i,
		}));

		await reorderCourseItems({ courseId: course.id, items: reorderData });
		await invalidateAll();
	}

	function handleDragEnd() {
		dragIndex = null;
		dragOverIndex = null;
	}

	function openContentPicker() {
		contentSearch = "";
		textItemTitle = "";
		textItemBody = "";
		contentPickerTab = "h5p";
		showContentPicker = true;
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

	<!-- Right: Course Items -->
	<div class="lg:col-span-2">
		<div class="card bg-base-100 border border-base-300">
			<div class="card-body">
				<div class="flex items-center justify-between mb-4">
					<h3 class="font-semibold">Course Items ({items.length})</h3>
					<button class="btn btn-primary btn-sm gap-1" onclick={openContentPicker}>
						<Plus class="h-3.5 w-3.5" />
						Add Item
					</button>
				</div>

				{#if items.length === 0}
					<div class="text-center py-8">
						<Puzzle class="h-10 w-10 mx-auto mb-3 opacity-30" />
						<p class="text-base-content/60 mb-3">No items yet. Add H5P content or text items.</p>
						<button class="btn btn-primary btn-sm gap-1" onclick={openContentPicker}>
							<Plus class="h-3.5 w-3.5" />
							Add First Item
						</button>
					</div>
				{:else}
					<div class="space-y-1">
						{#each items as item, i (item.id)}
							<div
								class="flex items-center gap-2 p-3 rounded-lg border transition-colors
									{dragOverIndex === i ? 'border-primary bg-primary/5' : 'border-base-300'}
									{dragIndex === i ? 'opacity-50' : ''}"
								draggable="true"
								ondragstart={() => handleDragStart(i)}
								ondragover={(e) => handleDragOver(e, i)}
								ondragleave={handleDragLeave}
								ondrop={(e) => handleDrop(e, i)}
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
										<span class="font-medium truncate">{item.title}</span>
									</div>
									{#if item.libraryTitle || item.libraryMachineName}
										<span class="text-xs text-base-content/50 ml-6">
											{item.libraryTitle || item.libraryMachineName}
										</span>
									{/if}
								</div>

								<span class="text-xs text-base-content/40 shrink-0">#{i + 1}</span>

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
					<p class="text-xs text-base-content/40 mt-3">Drag items to reorder.</p>
				{/if}
			</div>
		</div>
	</div>
</div>

<!-- Content Picker Modal -->
{#if showContentPicker}
	<div class="modal modal-open" role="dialog">
		<div class="modal-box max-w-2xl">
			<h3 class="text-lg font-bold mb-4">Add Item</h3>

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
