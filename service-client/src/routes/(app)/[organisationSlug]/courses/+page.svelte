<script lang="ts">
	import type { PageProps } from "./$types";
	import { invalidateAll } from "$app/navigation";
	import { Plus, Search, Trash2, Pencil, Eye, Archive, RotateCcw } from "lucide-svelte";
	import { FEATURES } from "$lib/config/features";
	import { deleteCourse, updateCourse } from "$lib/api/courses.remote";

	let { data }: PageProps = $props();
	let organisationSlug = $derived(data.organisation.slug);
	let allCourses = $derived(data.courses);

	// Filters
	let statusFilter = $state("all");
	let searchQuery = $state("");

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

	function statusBadgeClass(status: string): string {
		switch (status) {
			case "published":
				return "badge-success";
			case "draft":
				return "badge-warning";
			case "archived":
				return "badge-ghost";
			default:
				return "badge-ghost";
		}
	}

	function formatDate(date: Date | string | null): string {
		if (!date) return "—";
		try {
			return new Date(date).toLocaleDateString(undefined, {
				year: "numeric",
				month: "short",
				day: "numeric",
			});
		} catch {
			return "—";
		}
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
{:else}
	<div class="card bg-base-100 border border-base-300">
		<div class="overflow-x-auto">
			<table class="table">
				<thead>
					<tr>
						<th>Title</th>
						<th>Status</th>
						<th>Items</th>
						<th>Enrolled</th>
						<th>Updated</th>
						<th class="w-28"></th>
					</tr>
				</thead>
				<tbody>
					{#each filteredCourses() as course (course.id)}
						<tr class="hover">
							<td>
								<a
									href="/{organisationSlug}/courses/{course.id}"
									class="font-medium hover:underline"
								>
									{course.title}
								</a>
								{#if course.description}
									<p class="text-xs text-base-content/50 mt-0.5 line-clamp-1">
										{course.description}
									</p>
								{/if}
							</td>
							<td>
								<span class="badge badge-sm {statusBadgeClass(course.status)}">
									{course.status}
								</span>
							</td>
							<td class="text-sm">{course.itemCount}</td>
							<td class="text-sm">{course.enrolmentCount}</td>
							<td class="text-sm text-base-content/60">
								{formatDate(course.updatedAt)}
							</td>
							<td>
								<div class="flex gap-1">
									<a
										href="/{organisationSlug}/courses/{course.id}"
										class="btn btn-ghost btn-xs"
										title="View"
									>
										<Eye class="h-3.5 w-3.5" />
									</a>
									<a
										href="/{organisationSlug}/courses/{course.id}/edit"
										class="btn btn-ghost btn-xs"
										title="Edit"
									>
										<Pencil class="h-3.5 w-3.5" />
									</a>
									{#if course.status === "published"}
										<button
											class="btn btn-ghost btn-xs"
											title="Archive"
											onclick={() => handleArchive(course.id)}
										>
											<Archive class="h-3.5 w-3.5" />
										</button>
									{:else if course.status === "archived"}
										<button
											class="btn btn-ghost btn-xs"
											title="Restore to Draft"
											onclick={() => handleRestore(course.id)}
										>
											<RotateCcw class="h-3.5 w-3.5" />
										</button>
									{/if}
									<button
										class="btn btn-ghost btn-xs text-error"
										title="Delete"
										onclick={() => confirmDelete(course.id, course.title)}
									>
										<Trash2 class="h-3.5 w-3.5" />
									</button>
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
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
