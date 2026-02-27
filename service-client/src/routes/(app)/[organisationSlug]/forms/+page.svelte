<script lang="ts">
	import { page } from "$app/stores";
	import { invalidateAll, goto } from "$app/navigation";
	import { getToast } from "$lib/ui/toast_store.svelte";
	import { deleteSubmission } from "$lib/api/forms.remote";
	import { formatDate, formatDateTime } from '$lib/utils/formatting';
	import {
		FileStack,
		Trash2,
		MoreVertical,
		Eye,
		Clock,
		CheckCircle,
		AlertCircle,
		Archive,
		Plus,
		Link,
		Building2,
		Mail,
		ExternalLink,
		ClipboardList,
		MessageSquare,
		ThumbsUp,
		UserPlus,
		Settings2,
	} from "lucide-svelte";
	import type { PageProps } from "./$types";

	const toast = getToast();
	let { data }: PageProps = $props();

	let organisationSlug = $derived(data.organisation.slug);

	// Status configuration
	const statusConfig = {
		draft: { label: "In Progress", icon: Clock, class: "badge-warning" },
		completed: { label: "Completed", icon: CheckCircle, class: "badge-success" },
		processing: { label: "Processing", icon: AlertCircle, class: "badge-info" },
		processed: { label: "Processed", icon: CheckCircle, class: "badge-neutral" },
		archived: { label: "Archived", icon: Archive, class: "badge-ghost" },
	} as const;

	// Form type icons
	const formTypeIcons: Record<string, typeof ClipboardList> = {
		questionnaire: ClipboardList,
		consultation: MessageSquare,
		feedback: ThumbsUp,
		intake: UserPlus,
		custom: Settings2,
	};

	function getFormTypeIcon(type: string | null) {
		return formTypeIcons[type || ""] || Settings2;
	}

	// Status counts
	let statusCounts = $derived({
		all: data.submissions.length,
		draft: data.submissions.filter((s) => s.status === "draft").length,
		completed: data.submissions.filter((s) => s.status === "completed").length,
		processing: data.submissions.filter((s) => s.status === "processing").length,
		processed: data.submissions.filter((s) => s.status === "processed").length,
		archived: data.submissions.filter((s) => s.status === "archived").length,
	});

	function handleStatusFilter(status: string | null) {
		const url = new URL($page.url);
		if (status) {
			url.searchParams.set("status", status);
		} else {
			url.searchParams.delete("status");
		}
		goto(url.toString());
	}

	// Delete modal state
	let showDeleteModal = $state(false);
	let deletingSubmission = $state<{ id: string } | null>(null);
	let isDeleting = $state(false);

	function openDeleteModal(id: string) {
		deletingSubmission = { id };
		showDeleteModal = true;
	}

	function closeDeleteModal() {
		showDeleteModal = false;
		deletingSubmission = null;
	}

	async function confirmDelete() {
		if (!deletingSubmission) return;
		isDeleting = true;
		try {
			await deleteSubmission(deletingSubmission.id);
			closeDeleteModal();
			await invalidateAll();
			toast.success("Submission deleted");
		} catch (err) {
			toast.error("Failed to delete", err instanceof Error ? err.message : "");
		} finally {
			isDeleting = false;
		}
	}

	function copyLink(slug: string) {
		const url = `${window.location.origin}/f/${slug}`;
		navigator.clipboard.writeText(url);
		toast.success("Link copied to clipboard");
	}


</script>

<div class="space-y-6">
	<!-- Page Header -->
	<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
		<div>
			<h1 class="text-2xl font-bold">Forms</h1>
			<p class="text-base-content/70 mt-1">Manage client forms and submissions</p>
		</div>
		<div class="flex gap-2">
			<a href="/{organisationSlug}/settings/forms" class="btn btn-ghost">
				<Settings2 class="h-4 w-4" />
				Manage Templates
			</a>
			<a href="/{organisationSlug}/forms/new" class="btn btn-primary">
				<Plus class="h-4 w-4" />
				New Form
			</a>
		</div>
	</div>

	<!-- Status Tabs -->
	<div class="tabs tabs-boxed bg-base-200 p-1 w-fit">
		<button
			class="tab"
			class:tab-active={!data.statusFilter}
			onclick={() => handleStatusFilter(null)}
		>
			All ({statusCounts.all})
		</button>
		<button
			class="tab"
			class:tab-active={data.statusFilter === "draft"}
			onclick={() => handleStatusFilter("draft")}
		>
			In Progress ({statusCounts.draft})
		</button>
		<button
			class="tab"
			class:tab-active={data.statusFilter === "completed"}
			onclick={() => handleStatusFilter("completed")}
		>
			Completed ({statusCounts.completed})
		</button>
		<button
			class="tab"
			class:tab-active={data.statusFilter === "processed"}
			onclick={() => handleStatusFilter("processed")}
		>
			Processed ({statusCounts.processed})
		</button>
	</div>

	{#if data.submissions.length === 0}
		<!-- Empty state -->
		<div class="card bg-base-100 border border-base-300">
			<div class="card-body items-center text-center py-12">
				<div
					class="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary mb-4"
				>
					<FileStack class="h-8 w-8" />
				</div>
				<h3 class="text-lg font-semibold">No forms yet</h3>
				<p class="text-base-content/60 max-w-sm">
					Create a form for a client to collect their information. You can choose from templates or
					start from scratch.
				</p>
				<a href="/{organisationSlug}/forms/new" class="btn btn-primary mt-4">
					<Plus class="h-4 w-4" />
					Create First Form
				</a>
			</div>
		</div>
	{:else}
		<!-- Mobile Card Layout -->
		<div class="space-y-3 md:hidden">
			{#each data.submissions as submission (submission.id)}
				{@const status = statusConfig[submission.status as keyof typeof statusConfig]}
				{@const StatusIcon = status?.icon || Clock}
				{@const FormIcon = getFormTypeIcon(submission.formType)}
				<div class="card bg-base-100 border border-base-300">
					<div class="card-body p-4">
						<div class="flex items-start justify-between gap-2">
							<a href="/{organisationSlug}/forms/{submission.id}" class="flex-1 min-w-0">
								<div class="flex items-center gap-2 flex-wrap">
									<span class="font-medium truncate">{submission.clientBusinessName || "No client"}</span>
									<span class="badge {status?.class || 'badge-ghost'} badge-sm gap-1">
										<StatusIcon class="h-3 w-3" />
										{status?.label || submission.status}
									</span>
								</div>
								<p class="text-sm text-base-content/70 mt-1 truncate">
									{submission.clientEmail || "No email"}
								</p>
							</a>
							<div class="flex items-start gap-2">
								<div class="text-right shrink-0">
									<div class="font-semibold">{submission.completionPercentage || 0}%</div>
								</div>
								<div class="dropdown dropdown-end">
									<button type="button" tabindex="0" class="btn btn-ghost btn-sm btn-square">
										<MoreVertical class="h-4 w-4" />
									</button>
									<ul class="dropdown-content z-50 menu p-2 shadow-lg bg-base-100 rounded-box w-52 border border-base-300">
										{#if submission.slug}
											<li>
												<a href="/f/{submission.slug}" target="_blank" rel="noopener">
													<ExternalLink class="h-4 w-4" />
													View Public Form
												</a>
											</li>
											<li>
												<button type="button" onclick={() => copyLink(submission.slug || "")}>
													<Link class="h-4 w-4" />
													Copy Link
												</button>
											</li>
										{/if}
										<li>
											<a href="/{organisationSlug}/forms/{submission.id}">
												<Eye class="h-4 w-4" />
												{(submission.completionPercentage || 0) > 0 ? "View Responses" : "View Details"}
											</a>
										</li>
										<li class="border-t border-base-300 mt-1 pt-1">
											<button type="button" class="text-error" onclick={() => openDeleteModal(submission.id)}>
												<Trash2 class="h-4 w-4" />
												Delete
											</button>
										</li>
									</ul>
								</div>
							</div>
						</div>
						<a href="/{organisationSlug}/forms/{submission.id}" class="block">
							<div class="mt-2">
								<progress
									class="progress progress-primary w-full h-2"
									value={submission.completionPercentage || 0}
									max="100"
								></progress>
							</div>
							<div class="flex items-center justify-between mt-2 pt-2 border-t border-base-200 text-sm text-base-content/60">
								<span>
									<FormIcon class="h-3 w-3 inline mr-1" />
									{submission.formName || "Unknown Form"}
								</span>
								<span>{formatDate(submission.createdAt)}</span>
							</div>
						</a>
					</div>
				</div>
			{/each}
		</div>

		<!-- Desktop Table Layout -->
		<div class="hidden md:block card bg-base-100 border border-base-300 overflow-visible">
			<div class="overflow-visible">
				<table class="table">
					<thead>
						<tr class="bg-base-200">
							<th>Client</th>
							<th>Form</th>
							<th>Status</th>
							<th>Progress</th>
							<th>Created</th>
							<th class="w-10"></th>
						</tr>
					</thead>
					<tbody>
						{#each data.submissions as submission (submission.id)}
							{@const status = statusConfig[submission.status as keyof typeof statusConfig]}
							{@const StatusIcon = status?.icon || Clock}
							{@const FormIcon = getFormTypeIcon(submission.formType)}
							<tr class="hover:bg-base-50">
								<td>
									<div class="flex flex-col">
										<div class="flex items-center gap-2">
											<Building2 class="h-4 w-4 text-base-content/40" />
											<span class="font-medium">{submission.clientBusinessName || "—"}</span>
										</div>
										<div class="flex items-center gap-2 mt-0.5">
											<Mail class="h-3 w-3 text-base-content/40" />
											<span class="text-xs text-base-content/60">
												{submission.clientEmail || "—"}
											</span>
										</div>
									</div>
								</td>
								<td>
									<div class="flex items-center gap-2">
										<FormIcon class="h-4 w-4 text-base-content/40" />
										<span>{submission.formName || "Unknown Form"}</span>
									</div>
								</td>
								<td>
									<span class="badge {status?.class || 'badge-ghost'} badge-sm gap-1">
										<StatusIcon class="h-3 w-3" />
										{status?.label || submission.status}
									</span>
								</td>
								<td>
									{#if submission.status === "draft"}
										<div class="flex items-center gap-2">
											<progress
												class="progress progress-primary w-16"
												value={submission.completionPercentage || 0}
												max="100"
											></progress>
											<span class="text-xs text-base-content/60">
												{submission.completionPercentage || 0}%
											</span>
										</div>
									{:else}
										<span class="text-xs text-base-content/60">
											{formatDateTime(submission.submittedAt)}
										</span>
									{/if}
								</td>
								<td>
									<span class="text-sm text-base-content/70">
										{formatDate(submission.createdAt)}
									</span>
								</td>
								<td>
									<div class="dropdown dropdown-end">
										<button type="button" tabindex="0" class="btn btn-ghost btn-sm btn-square">
											<MoreVertical class="h-4 w-4" />
										</button>
										<ul
											class="dropdown-content z-10 menu p-2 shadow-lg bg-base-100 rounded-box w-52 border border-base-300"
										>
											{#if submission.slug}
												<li>
													<a href="/f/{submission.slug}" target="_blank" rel="noopener">
														<ExternalLink class="h-4 w-4" />
														View Public Form
													</a>
												</li>
												<li>
													<button type="button" onclick={() => copyLink(submission.slug || "")}>
														<Link class="h-4 w-4" />
														Copy Link
													</button>
												</li>
											{/if}
											<li>
												<a href="/{organisationSlug}/forms/{submission.id}">
													<Eye class="h-4 w-4" />
													{(submission.completionPercentage || 0) > 0 ? "View Responses" : "View Details"}
												</a>
											</li>
											<li class="border-t border-base-300 mt-1 pt-1">
												<button
													type="button"
													class="text-error"
													onclick={() => openDeleteModal(submission.id)}
												>
													<Trash2 class="h-4 w-4" />
													Delete
												</button>
											</li>
										</ul>
									</div>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	{/if}
</div>

{#if showDeleteModal && deletingSubmission}
	<div class="modal modal-open">
		<div class="modal-box">
			<h3 class="text-lg font-bold">Delete Submission</h3>
			<p class="py-4">
				Are you sure you want to delete this form submission? This action cannot be undone.
			</p>
			<div class="modal-action">
				<button class="btn btn-ghost" onclick={closeDeleteModal} disabled={isDeleting}>
					Cancel
				</button>
				<button class="btn btn-error" onclick={confirmDelete} disabled={isDeleting}>
					{#if isDeleting}
						<span class="loading loading-spinner loading-sm"></span>
					{/if}
					Delete
				</button>
			</div>
		</div>
		<div class="modal-backdrop" onclick={closeDeleteModal}></div>
	</div>
{/if}
