<script lang="ts">
	import { goto, invalidateAll } from "$app/navigation";
	import { getToast } from "$lib/ui/toast_store.svelte";
	import { deleteSubmission, updateSubmissionStatus } from "$lib/api/forms.remote";
	import { formatDateTime } from '$lib/utils/formatting';
	import {
		ArrowLeft,
		Copy,
		ExternalLink,
		Clock,
		CheckCircle,
		AlertCircle,
		Archive,
		Building2,
		Mail,
		User,
		Calendar,
		FileText,
		Link,
		Trash2,
		MoreHorizontal,
		Eye,
		Settings2,
		ClipboardList,
		MessageSquare,
		ThumbsUp,
		UserPlus,
		Download,
	} from "lucide-svelte";
	import type { PageProps } from "./$types";

	const toast = getToast();
	let { data }: PageProps = $props();

	let organisationSlug = $derived(data.organisation.slug);
	let submission = $derived(data.submission.submission);
	let form = $derived(data.submission.form);


	// Status configuration
	const statusConfig = {
		draft: { label: "In Progress", icon: Clock, class: "badge-warning", bgClass: "bg-warning/10" },
		completed: {
			label: "Completed",
			icon: CheckCircle,
			class: "badge-success",
			bgClass: "bg-success/10",
		},
		processing: {
			label: "Processing",
			icon: AlertCircle,
			class: "badge-info",
			bgClass: "bg-info/10",
		},
		processed: {
			label: "Processed",
			icon: CheckCircle,
			class: "badge-neutral",
			bgClass: "bg-neutral/10",
		},
		archived: { label: "Archived", icon: Archive, class: "badge-ghost", bgClass: "bg-base-200" },
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

	function getFormUrl() {
		if (!submission.slug) return "";
		return `${window.location.origin}/f/${submission.slug}`;
	}

	function copyLink() {
		navigator.clipboard.writeText(getFormUrl());
		toast.success("Link copied to clipboard");
	}

	async function handleStatusChange(newStatus: string) {
		try {
			await updateSubmissionStatus({
				submissionId: submission.id,
				status: newStatus as "draft" | "completed" | "processing" | "processed" | "archived",
			});
			await invalidateAll();
			toast.success(`Status updated to ${statusConfig[newStatus as keyof typeof statusConfig]?.label || newStatus}`);
		} catch (err) {
			toast.error("Failed to update status", err instanceof Error ? err.message : "");
		}
	}

	// Delete modal state
	let showDeleteModal = $state(false);
	let isDeleting = $state(false);

	function openDeleteModal() {
		showDeleteModal = true;
	}

	function closeDeleteModal() {
		showDeleteModal = false;
	}

	async function confirmDelete() {
		isDeleting = true;
		try {
			await deleteSubmission(submission.id);
			closeDeleteModal();
			toast.success("Submission deleted");
			goto(`/${organisationSlug}/forms`);
		} catch (err) {
			toast.error("Failed to delete", err instanceof Error ? err.message : "");
		} finally {
			isDeleting = false;
		}
	}

	// Parse form data for display
	let formData = $derived(() => {
		if (!submission.data) return null;
		try {
			return typeof submission.data === "string" ? JSON.parse(submission.data) : submission.data;
		} catch {
			return null;
		}
	});

	// Get form schema for field labels
	let formSchema = $derived(() => {
		if (!form?.schema) return null;
		try {
			return typeof form.schema === "string"
				? JSON.parse(form.schema)
				: form.schema;
		} catch {
			return null;
		}
	});

	// Check if step has any filled responses
	function stepHasResponses(step: { fields: Array<{ id: string }> }): boolean {
		const data = formData();
		if (!data) return false;
		return step.fields.some((field) => {
			const value = data[field.id];
			return value !== undefined && value !== null && value !== "";
		});
	}
</script>

<div class="max-w-4xl mx-auto space-y-6">
	<!-- Header with back button (matching Questionnaire Details) -->
	<div class="card bg-base-100 border border-base-300">
		<div class="card-body p-4">
			<!-- Top row: Back + Title -->
			<div class="flex items-start gap-3">
				<a href="/{organisationSlug}/forms" class="btn btn-ghost btn-sm btn-square shrink-0">
					<ArrowLeft class="h-4 w-4" />
				</a>
				<div class="min-w-0 flex-1">
					<h1 class="text-xl font-bold">Form Details</h1>
					<p class="text-base-content/70 text-sm">
						View responses and manage form submission
					</p>
				</div>
			</div>

			<!-- Bottom row: Actions -->
			<div class="flex flex-wrap gap-2 mt-3 pt-3 border-t border-base-200">
				<!-- PDF Download (only show if has responses) -->
				{#if submission.status === "completed" || (formData() && Object.keys(formData()).length > 0)}
					<a
						href="/api/forms/{submission.id}/pdf"
						download
						class="btn btn-outline btn-sm"
					>
						<Download class="h-4 w-4" />
						PDF
					</a>
				{/if}

				<!-- More dropdown (right side) -->
				<div class="dropdown dropdown-end ml-auto">
					<button type="button" tabindex="0" class="btn btn-outline btn-sm gap-1">
						<MoreHorizontal class="h-4 w-4" />
						More
					</button>
					<ul class="dropdown-content z-50 menu p-2 shadow-lg bg-base-100 rounded-box w-52 border border-base-300">
						{#if submission.slug}
							<li>
								<button type="button" onclick={copyLink}>
									<Copy class="h-4 w-4" />
									Copy Link
								</button>
							</li>
							<li>
								<a href="/f/{submission.slug}" target="_blank">
									<ExternalLink class="h-4 w-4" />
									View Public Form
								</a>
							</li>
						{/if}
						<li class="border-t border-base-200 mt-1 pt-1">
							<button type="button" class="text-error" onclick={openDeleteModal}>
								<Trash2 class="h-4 w-4" />
								Delete
							</button>
						</li>
					</ul>
				</div>
			</div>
		</div>
	</div>

	<!-- Status & Progress Card -->
	{#if true}
		{@const status = statusConfig[submission.status as keyof typeof statusConfig]}
		{@const StatusIcon = status?.icon || Clock}
		<div class="card bg-base-100 border border-base-300">
		<div class="card-body">
			<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
				<div class="flex items-center gap-4">
					<div
						class="flex h-12 w-12 items-center justify-center rounded-full {status?.bgClass ||
							'bg-base-200'}"
					>
						<StatusIcon class="h-6 w-6" />
					</div>
					<div>
						<div class="flex items-center gap-2">
							<span class="badge {status?.class || 'badge-ghost'}">
								{status?.label || submission.status}
							</span>
							{#if submission.status === "draft"}
								<span class="text-sm text-base-content/60">
									{submission.completionPercentage || 0}% complete
								</span>
							{/if}
						</div>
						{#if submission.status === "draft"}
							<progress
								class="progress progress-primary w-32 mt-2"
								value={submission.completionPercentage || 0}
								max="100"
							></progress>
						{/if}
					</div>
				</div>

				<!-- Status Actions -->
				<div class="flex items-center gap-2">
					{#if submission.status === "completed"}
						<button
							type="button"
							class="btn btn-sm btn-primary"
							onclick={() => handleStatusChange("processed")}
						>
							Mark as Processed
						</button>
					{/if}
					{#if submission.status === "processed"}
						<button
							type="button"
							class="btn btn-sm btn-ghost"
							onclick={() => handleStatusChange("archived")}
						>
							<Archive class="h-4 w-4" />
							Archive
						</button>
					{/if}
				</div>
			</div>
		</div>
		</div>
	{/if}

	<!-- Details Grid -->
	<div class="grid gap-4 sm:grid-cols-2">
		<!-- Client Info -->
		<div class="card bg-base-100 border border-base-300">
			<div class="card-body">
				<h2 class="card-title text-base">Client Information</h2>
				<div class="space-y-3 mt-2">
					<div class="flex items-center gap-3">
						<Building2 class="h-4 w-4 text-base-content/40 shrink-0" />
						<div>
							<div class="text-xs text-base-content/60">Business Name</div>
							<div class="font-medium">{submission.clientBusinessName || "—"}</div>
						</div>
					</div>
					<div class="flex items-center gap-3">
						<Mail class="h-4 w-4 text-base-content/40 shrink-0" />
						<div>
							<div class="text-xs text-base-content/60">Email</div>
							<div class="font-medium">{submission.clientEmail || "—"}</div>
						</div>
					</div>
					{#if submission.clientId}
						<div class="flex items-center gap-3">
							<User class="h-4 w-4 text-base-content/40 shrink-0" />
							<div>
								<div class="text-xs text-base-content/60">Linked Client</div>
								<div class="font-medium text-sm">Client record linked</div>
							</div>
						</div>
					{/if}
				</div>
			</div>
		</div>

		<!-- Form Info -->
		<div class="card bg-base-100 border border-base-300">
			<div class="card-body">
				<h2 class="card-title text-base">Form Details</h2>
				{#if true}
					{@const FormIcon = getFormTypeIcon(form?.formType || null)}
					<div class="space-y-3 mt-2">
					<div class="flex items-center gap-3">
						<FileText class="h-4 w-4 text-base-content/40 shrink-0" />
						<div>
							<div class="text-xs text-base-content/60">Form Template</div>
							<div class="font-medium">{form?.name || "Unknown"}</div>
						</div>
					</div>
					<div class="flex items-center gap-3">
						<FormIcon class="h-4 w-4 text-base-content/40 shrink-0" />
						<div>
							<div class="text-xs text-base-content/60">Form Type</div>
							<div class="font-medium capitalize">{form?.formType || "Custom"}</div>
						</div>
					</div>
					{#if submission.slug}
						<div class="flex items-center gap-3">
							<Link class="h-4 w-4 text-base-content/40 shrink-0" />
							<div>
								<div class="text-xs text-base-content/60">Public Slug</div>
								<code class="text-xs bg-base-200 px-1.5 py-0.5 rounded">{submission.slug}</code>
							</div>
						</div>
					{/if}
					</div>
				{/if}
			</div>
		</div>

		<!-- Timeline -->
		<div class="card bg-base-100 border border-base-300 sm:col-span-2">
			<div class="card-body">
				<h2 class="card-title text-base">Timeline</h2>
				<div class="flex flex-wrap gap-6 mt-2">
					<div class="flex items-center gap-3">
						<Calendar class="h-4 w-4 text-base-content/40 shrink-0" />
						<div>
							<div class="text-xs text-base-content/60">Created</div>
							<div class="font-medium text-sm">{formatDateTime(submission.createdAt)}</div>
						</div>
					</div>
					{#if submission.startedAt}
						<div class="flex items-center gap-3">
							<Eye class="h-4 w-4 text-base-content/40 shrink-0" />
							<div>
								<div class="text-xs text-base-content/60">Started</div>
								<div class="font-medium text-sm">{formatDateTime(submission.startedAt)}</div>
							</div>
						</div>
					{/if}
					{#if submission.lastActivityAt}
						<div class="flex items-center gap-3">
							<Clock class="h-4 w-4 text-base-content/40 shrink-0" />
							<div>
								<div class="text-xs text-base-content/60">Last Activity</div>
								<div class="font-medium text-sm">{formatDateTime(submission.lastActivityAt)}</div>
							</div>
						</div>
					{/if}
					{#if submission.submittedAt && (submission.status === "completed" || submission.status === "processed" || submission.status === "archived")}
						<div class="flex items-center gap-3">
							<CheckCircle class="h-4 w-4 text-success shrink-0" />
							<div>
								<div class="text-xs text-base-content/60">Submitted</div>
								<div class="font-medium text-sm">{formatDateTime(submission.submittedAt)}</div>
							</div>
						</div>
					{:else if submission.status === "draft"}
						<div class="flex items-center gap-3">
							<Clock class="h-4 w-4 text-base-content/30 shrink-0" />
							<div>
								<div class="text-xs text-base-content/60">Submitted</div>
								<span class="badge badge-ghost badge-sm">Pending</span>
							</div>
						</div>
					{/if}
				</div>
			</div>
		</div>

	</div>

	<!-- Form Responses - Accordion by Schema Steps -->
	{#if formSchema()?.steps && formData() && Object.keys(formData()).length > 0}
		<div class="card bg-base-100 border border-base-300">
			<div class="card-body p-4 sm:p-6">
				<h2 class="card-title text-base mb-4">Form Responses</h2>
				<div class="space-y-4">
					{#each formSchema().steps as step}
						{#if stepHasResponses(step)}
							<div class="collapse collapse-arrow bg-base-200">
								<input type="checkbox" checked />
								<div class="collapse-title font-medium">
									{step.title}
								</div>
								<div class="collapse-content">
									<div class="space-y-3 pt-2">
										{#each step.fields as field}
											{@const value = formData()[field.id]}
											{#if value !== undefined && value !== null && value !== "" && !["heading", "paragraph", "divider"].includes(field.type)}
												<div>
													<span class="text-xs text-base-content/50 block">{field.label}</span>
													{#if Array.isArray(value)}
														<p class="text-sm">{value.join(", ")}</p>
													{:else if typeof value === "boolean"}
														<span class="badge {value ? 'badge-success' : 'badge-ghost'} badge-sm">
															{value ? "Yes" : "No"}
														</span>
													{:else if value === "yes" || value === "Yes"}
														<span class="badge badge-success badge-sm">Yes</span>
													{:else if value === "no" || value === "No"}
														<span class="badge badge-ghost badge-sm">No</span>
													{:else}
														<p class="whitespace-pre-wrap text-sm">{value}</p>
													{/if}
												</div>
											{/if}
										{/each}
									</div>
								</div>
							</div>
						{/if}
					{/each}
				</div>
			</div>
		</div>
	{:else if submission.status === "draft"}
		<div class="card bg-base-100 border border-base-300">
			<div class="card-body items-center text-center py-8">
				<div
					class="flex h-12 w-12 items-center justify-center rounded-full bg-base-200 text-base-content/50 mb-3"
				>
					<FileText class="h-6 w-6" />
				</div>
				<h3 class="text-base font-semibold">No responses yet</h3>
				<p class="text-sm text-base-content/60 max-w-sm">
					The client hasn't started filling out this form yet. Share the link to collect their
					responses.
				</p>
				{#if submission.slug}
					<button type="button" class="btn btn-primary btn-sm mt-3" onclick={copyLink}>
						<Copy class="h-4 w-4" />
						Copy Form Link
					</button>
				{/if}
			</div>
		</div>
	{/if}
</div>

{#if showDeleteModal}
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

