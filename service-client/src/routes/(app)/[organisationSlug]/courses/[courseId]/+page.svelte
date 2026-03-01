<script lang="ts">
	import type { PageProps } from "./$types";
	import { invalidateAll, goto } from "$app/navigation";
	import {
		ArrowLeft,
		Pencil,
		Puzzle,
		Users,
		BarChart3,
		Send,
		Trash2,
		FileText,
	} from "lucide-svelte";
	import { FEATURES } from "$lib/config/features";
	import { updateCourse, deleteCourse, publishCourse } from "$lib/api/courses.remote";

	let { data }: PageProps = $props();
	let organisationSlug = $derived(data.organisation.slug);
	let course = $derived(data.course);
	let enrolmentsList = $derived(data.enrolments);
	let progressStats = $derived(data.progressStats);

	// Tabs
	let activeTab = $state<"content" | "learners" | "settings">("content");

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

	function confirmDeleteCourse() {
		confirmModal = {
			title: "Delete Course",
			message: `Are you sure you want to delete <strong>${course.title}</strong>? Enrolled students will lose access.`,
			actionLabel: "Delete",
			actionClass: "btn-error",
			onConfirm: async () => {
				await deleteCourse(course.id);
				await goto(`/${organisationSlug}/courses`);
			},
		};
	}

	let publishing = $state(false);

	async function handlePublish() {
		publishing = true;
		try {
			await publishCourse(course.id);
			await invalidateAll();
		} catch (err) {
			// Show error inline
			alert(err instanceof Error ? err.message : "Failed to publish");
		} finally {
			publishing = false;
		}
	}

	async function handleStatusChange(newStatus: "draft" | "archived") {
		await updateCourse({ courseId: course.id, status: newStatus });
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

<!-- Header -->
<div class="mb-6">
	<a href="/{organisationSlug}/courses" class="btn btn-ghost btn-sm gap-1 mb-4">
		<ArrowLeft class="h-4 w-4" />
		Back to Courses
	</a>
	<div class="flex items-start justify-between">
		<div>
			<h1 class="text-2xl font-bold flex items-center gap-2">
				<FEATURES.courses.icon class="h-7 w-7" style="color: {FEATURES.courses.color}" />
				{course.title}
			</h1>
			{#if course.description}
				<p class="text-base-content/60 mt-1">{course.description}</p>
			{/if}
			<div class="flex items-center gap-3 mt-2">
				<span class="badge {statusBadgeClass(course.status)}">{course.status}</span>
				<span class="text-sm text-base-content/50">{course.items.length} items</span>
				<span class="text-sm text-base-content/50">{progressStats.totalEnrolments} enrolled</span>
			</div>
		</div>
		<div class="flex gap-2">
			{#if course.status === "draft"}
				<button
					class="btn btn-primary btn-sm gap-1"
					onclick={handlePublish}
					disabled={publishing || course.items.length === 0}
					title={course.items.length === 0 ? "Add at least one item before publishing" : "Publish course"}
				>
					{#if publishing}
						<span class="loading loading-spinner loading-xs"></span>
					{:else}
						<Send class="h-3.5 w-3.5" />
					{/if}
					Publish
				</button>
			{:else if course.status === "published"}
				<button
					class="btn btn-ghost btn-sm gap-1"
					onclick={() => handleStatusChange("archived")}
				>
					Archive
				</button>
			{:else if course.status === "archived"}
				<button
					class="btn btn-ghost btn-sm gap-1"
					onclick={() => handleStatusChange("draft")}
				>
					Restore to Draft
				</button>
			{/if}
			<a href="/{organisationSlug}/courses/{course.id}/edit" class="btn btn-ghost btn-sm gap-1">
				<Pencil class="h-3.5 w-3.5" />
				Edit
			</a>
		</div>
	</div>
</div>

<!-- Tabs -->
<div class="tabs tabs-bordered mb-6">
	<button
		class="tab {activeTab === 'content' ? 'tab-active' : ''}"
		onclick={() => (activeTab = "content")}
	>
		<Puzzle class="h-4 w-4 mr-1" />
		Content ({course.items.length})
	</button>
	<button
		class="tab {activeTab === 'learners' ? 'tab-active' : ''}"
		onclick={() => (activeTab = "learners")}
	>
		<Users class="h-4 w-4 mr-1" />
		Learners ({progressStats.totalEnrolments})
	</button>
	<button
		class="tab {activeTab === 'settings' ? 'tab-active' : ''}"
		onclick={() => (activeTab = "settings")}
	>
		<BarChart3 class="h-4 w-4 mr-1" />
		Settings
	</button>
</div>

<!-- Content Tab -->
{#if activeTab === "content"}
	{#if course.items.length === 0}
		<div class="card bg-base-100 border border-base-300 p-8 text-center">
			<Puzzle class="h-10 w-10 mx-auto mb-3 opacity-30" />
			<h3 class="text-lg font-semibold mb-2">No content yet</h3>
			<p class="text-base-content/60 mb-4">Add H5P activities or text items to this course.</p>
			<div class="flex justify-center">
				<a href="/{organisationSlug}/courses/{course.id}/edit" class="btn btn-primary btn-sm gap-1">
					<Pencil class="h-3.5 w-3.5" />
					Open Course Editor
				</a>
			</div>
		</div>
	{:else}
		<div class="card bg-base-100 border border-base-300">
			<div class="overflow-x-auto">
				<table class="table">
					<thead>
						<tr>
							<th class="w-10">#</th>
							<th>Title</th>
							<th>Type</th>
							<th>Content Type</th>
						</tr>
					</thead>
					<tbody>
						{#each course.items as item, i (item.id)}
							<tr class="hover">
								<td class="text-base-content/50">{i + 1}</td>
								<td class="font-medium">{item.title}</td>
								<td>
									{#if item.itemType === "h5p"}
										<span class="badge badge-sm badge-info gap-1">
											<Puzzle class="h-3 w-3" />
											H5P
										</span>
									{:else}
										<span class="badge badge-sm badge-ghost gap-1">
											<FileText class="h-3 w-3" />
											Text
										</span>
									{/if}
								</td>
								<td class="text-sm text-base-content/60">
									{item.libraryTitle || item.libraryMachineName || "—"}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	{/if}

<!-- Learners Tab -->
{:else if activeTab === "learners"}
	<!-- Stats Row -->
	<div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
		<div class="stat bg-base-100 border border-base-300 rounded-lg p-4">
			<div class="stat-title text-xs">Total Enrolled</div>
			<div class="stat-value text-2xl">{progressStats.totalEnrolments}</div>
		</div>
		<div class="stat bg-base-100 border border-base-300 rounded-lg p-4">
			<div class="stat-title text-xs">Active</div>
			<div class="stat-value text-2xl">{progressStats.activeEnrolments}</div>
		</div>
		<div class="stat bg-base-100 border border-base-300 rounded-lg p-4">
			<div class="stat-title text-xs">Completed</div>
			<div class="stat-value text-2xl">{progressStats.completedEnrolments}</div>
		</div>
		<div class="stat bg-base-100 border border-base-300 rounded-lg p-4">
			<div class="stat-title text-xs">Completion Rate</div>
			<div class="stat-value text-2xl">{progressStats.completionRate}%</div>
		</div>
	</div>

	{#if enrolmentsList.length === 0}
		<div class="card bg-base-100 border border-base-300 p-8 text-center">
			<Users class="h-10 w-10 mx-auto mb-3 opacity-30" />
			<h3 class="text-lg font-semibold mb-2">No learners yet</h3>
			<p class="text-base-content/60">Learners will appear here once they enrol in this course.</p>
		</div>
	{:else}
		<div class="card bg-base-100 border border-base-300">
			<div class="overflow-x-auto">
				<table class="table">
					<thead>
						<tr>
							<th>Learner</th>
							<th>Status</th>
							<th>Progress</th>
							<th>Enrolled</th>
							<th>Completed</th>
						</tr>
					</thead>
					<tbody>
						{#each enrolmentsList as enrolment (enrolment.id)}
							<tr class="hover">
								<td>
									<div class="flex items-center gap-2">
										{#if enrolment.user.avatar}
											<img
												src={enrolment.user.avatar}
												alt=""
												class="h-8 w-8 rounded-full"
											/>
										{:else}
											<div class="h-8 w-8 rounded-full bg-base-300 flex items-center justify-center text-xs font-bold">
												{enrolment.user.email.charAt(0).toUpperCase()}
											</div>
										{/if}
										<span class="text-sm">{enrolment.user.email}</span>
									</div>
								</td>
								<td>
									<span
										class="badge badge-sm {enrolment.status === 'completed'
											? 'badge-success'
											: enrolment.status === 'active'
												? 'badge-info'
												: 'badge-ghost'}"
									>
										{enrolment.status}
									</span>
								</td>
								<td>
									<div class="flex items-center gap-2">
										<progress
											class="progress progress-primary w-20"
											value={enrolment.progress.percentage}
											max="100"
										></progress>
										<span class="text-xs text-base-content/60">
											{enrolment.progress.completedItems}/{enrolment.progress.totalItems}
										</span>
									</div>
								</td>
								<td class="text-sm text-base-content/60">
									{formatDate(enrolment.enrolledAt)}
								</td>
								<td class="text-sm text-base-content/60">
									{formatDate(enrolment.completedAt)}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	{/if}

<!-- Settings Tab -->
{:else if activeTab === "settings"}
	<div class="max-w-2xl space-y-6">
		<!-- Course Info -->
		<div class="card bg-base-100 border border-base-300">
			<div class="card-body">
				<h3 class="text-lg font-semibold mb-4">Course Information</h3>
				<dl class="space-y-3">
					<div class="flex justify-between">
						<dt class="text-base-content/60">Status</dt>
						<dd><span class="badge {statusBadgeClass(course.status)}">{course.status}</span></dd>
					</div>
					<div class="flex justify-between">
						<dt class="text-base-content/60">Created</dt>
						<dd>{formatDate(course.createdAt)}</dd>
					</div>
					<div class="flex justify-between">
						<dt class="text-base-content/60">Last Updated</dt>
						<dd>{formatDate(course.updatedAt)}</dd>
					</div>
					{#if course.publishedAt}
						<div class="flex justify-between">
							<dt class="text-base-content/60">Published</dt>
							<dd>{formatDate(course.publishedAt)}</dd>
						</div>
					{/if}
					<div class="flex justify-between">
						<dt class="text-base-content/60">Slug</dt>
						<dd class="font-mono text-sm">{course.slug}</dd>
					</div>
				</dl>
			</div>
		</div>

		<!-- Danger Zone -->
		<div class="card bg-base-100 border border-error/30">
			<div class="card-body">
				<h3 class="text-lg font-semibold text-error mb-2">Danger Zone</h3>
				<p class="text-sm text-base-content/60 mb-4">
					Deleting this course will remove it from all learners' dashboards. This action is soft-delete and can be reversed by an admin.
				</p>
				<button class="btn btn-error btn-sm gap-1 w-fit" onclick={confirmDeleteCourse}>
					<Trash2 class="h-3.5 w-3.5" />
					Delete Course
				</button>
			</div>
		</div>
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
