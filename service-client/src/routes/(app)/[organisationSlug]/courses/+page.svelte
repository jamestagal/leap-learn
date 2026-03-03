<script lang="ts">
	import type { PageProps } from "./$types";
	import { invalidateAll } from "$app/navigation";
	import { Plus, Search, Trash2, Archive, RotateCcw, LayoutGrid, List } from "lucide-svelte";
	import { FEATURES } from "$lib/config/features";
	import { deleteCourse, updateCourse } from "$lib/api/courses.remote";
	import CourseCard from "$lib/components/courses/CourseCard.svelte";

	let { data }: PageProps = $props();
	let organisationSlug = $derived(data.organisation.slug);
	let allCourses = $derived(data.courses);

	// Filters
	let statusFilter = $state("all");
	let searchQuery = $state("");
	let viewMode = $state<"card" | "list">("card");

	let filteredCourses = $derived(() => {
		let result = allCourses;
		if (statusFilter !== "all") {
			result = result.filter((c) => c.status === statusFilter);
		}
		if (searchQuery.trim()) {
			const q = searchQuery.toLowerCase();
			result = result.filter((c) => c.title.toLowerCase().includes(q));
		}
		return result;
	});

	// Confirm modal state
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

	function confirmDelete(courseId: string, title: string) {
		confirmModal = {
			title: "Delete Course",
			message: `Are you sure you want to delete <strong>${title}</strong>? This will soft-delete the course. Enrolled students will lose access.`,
			actionLabel: "Delete",
			actionClass: "btn-error",
			onConfirm: async () => {
				await deleteCourse(courseId);
				await invalidateAll();
			},
		};
	}

	async function handleArchive(courseId: string) {
		await updateCourse({ courseId, status: "archived" });
		await invalidateAll();
	}

	async function handleRestore(courseId: string) {
		await updateCourse({ courseId, status: "draft" });
		await invalidateAll();
	}
</script>

<!-- Page Header -->
<div class="flex items-center justify-between mb-6">
	<div>
		<h1 class="text-2xl font-bold flex items-center gap-2">
			<FEATURES.courses.icon class="h-7 w-7" style="color: {FEATURES.courses.color}" />
			Courses
		</h1>
		<p class="text-base-content/60 mt-1">Create and manage learning courses.</p>
	</div>
	<a href="/{organisationSlug}/courses/new" class="btn btn-primary gap-2">
		<Plus class="h-4 w-4" />
		New Course
	</a>
</div>

<!-- Filters -->
<div class="flex flex-wrap items-center gap-3 mb-4">
	<div class="join">
		{#each [{ value: "all", label: "All" }, { value: "draft", label: "Draft" }, { value: "published", label: "Published" }, { value: "archived", label: "Archived" }] as filter}
			<button
				class="btn btn-sm join-item {statusFilter === filter.value ? 'btn-active' : ''}"
				onclick={() => (statusFilter = filter.value)}
			>
				{filter.label}
			</button>
		{/each}
	</div>
	<div class="relative flex-1 max-w-xs">
		<Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-base-content/40" />
		<input
			type="text"
			placeholder="Search courses..."
			class="input input-bordered input-sm w-full pl-9"
			bind:value={searchQuery}
		/>
	</div>
	<div class="ml-auto join">
		<button
			class="btn btn-sm join-item {viewMode === 'card' ? 'btn-active' : ''}"
			onclick={() => (viewMode = "card")}
			title="Card view"
		>
			<LayoutGrid class="h-4 w-4" />
		</button>
		<button
			class="btn btn-sm join-item {viewMode === 'list' ? 'btn-active' : ''}"
			onclick={() => (viewMode = "list")}
			title="List view"
		>
			<List class="h-4 w-4" />
		</button>
	</div>
</div>

<!-- Course List -->
{#if allCourses.length === 0}
	<div class="card bg-base-100 border border-base-300 p-12 text-center">
		<FEATURES.courses.icon
			class="h-12 w-12 mx-auto mb-4 opacity-30"
			style="color: {FEATURES.courses.color}"
		/>
		<h3 class="text-lg font-semibold mb-2">No courses yet</h3>
		<p class="text-base-content/60 mb-6">Get started by creating your first course.</p>
		<div class="flex justify-center">
			<a href="/{organisationSlug}/courses/new" class="btn btn-primary gap-2">
				<Plus class="h-4 w-4" />
				New Course
			</a>
		</div>
	</div>
{:else if filteredCourses().length === 0}
	<div class="card bg-base-100 border border-base-300 p-8 text-center">
		<p class="text-base-content/60">No courses match your filters.</p>
	</div>
{:else if viewMode === "card"}
	<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
		{#each filteredCourses() as course (course.id)}
			<div class="relative group">
				<CourseCard
					title={course.title}
					description={course.description}
					status={course.status}
					itemCount={course.itemCount}
					enrolmentCount={course.enrolmentCount}
					totalDurationMinutes={course.totalDurationMinutes}
					coverImage={course.coverImage}
					href="/{organisationSlug}/courses/{course.id}"
					editHref="/{organisationSlug}/courses/{course.id}/edit"
					view="card"
				/>
				<!-- Overlay actions on hover -->
				<div class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
					{#if course.status === "published"}
						<button
							class="btn btn-xs btn-ghost bg-base-100/80"
							title="Archive"
							onclick={() => handleArchive(course.id)}
						>
							<Archive class="h-3 w-3" />
						</button>
					{:else if course.status === "archived"}
						<button
							class="btn btn-xs btn-ghost bg-base-100/80"
							title="Restore"
							onclick={() => handleRestore(course.id)}
						>
							<RotateCcw class="h-3 w-3" />
						</button>
					{/if}
					<button
						class="btn btn-xs btn-ghost bg-base-100/80 text-error"
						title="Delete"
						onclick={() => confirmDelete(course.id, course.title)}
					>
						<Trash2 class="h-3 w-3" />
					</button>
				</div>
			</div>
		{/each}
	</div>
{:else}
	<div class="space-y-2">
		{#each filteredCourses() as course (course.id)}
			<div class="relative group">
				<CourseCard
					title={course.title}
					description={course.description}
					status={course.status}
					itemCount={course.itemCount}
					enrolmentCount={course.enrolmentCount}
					totalDurationMinutes={course.totalDurationMinutes}
					coverImage={course.coverImage}
					href="/{organisationSlug}/courses/{course.id}"
					editHref="/{organisationSlug}/courses/{course.id}/edit"
					view="list"
				/>
				<!-- Actions on hover -->
				<div class="absolute top-1/2 -translate-y-1/2 right-20 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
					{#if course.status === "published"}
						<button
							class="btn btn-xs btn-ghost"
							title="Archive"
							onclick={() => handleArchive(course.id)}
						>
							<Archive class="h-3 w-3" />
						</button>
					{:else if course.status === "archived"}
						<button
							class="btn btn-xs btn-ghost"
							title="Restore"
							onclick={() => handleRestore(course.id)}
						>
							<RotateCcw class="h-3 w-3" />
						</button>
					{/if}
					<button
						class="btn btn-xs btn-ghost text-error"
						title="Delete"
						onclick={() => confirmDelete(course.id, course.title)}
					>
						<Trash2 class="h-3 w-3" />
					</button>
				</div>
			</div>
		{/each}
	</div>
{/if}

<!-- Confirm Modal (DaisyUI) -->
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
