<script lang="ts">
	import type { PageProps } from "./$types";
	import { invalidateAll } from "$app/navigation";
	import { Plus, Trash2, Pencil } from "lucide-svelte";
	import { FEATURES } from "$lib/config/features";
	import { deleteContent } from "$lib/api/h5p-content.remote";

	let { data }: PageProps = $props();
	let organisationSlug = $derived(data.organisation.slug);

	// Confirm modal state (DaisyUI pattern — never use confirm())
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

	function confirmDelete(contentId: string, title: string) {
		confirmModal = {
			title: "Delete Content",
			message: `Are you sure you want to delete <strong>${title}</strong>? This action cannot be undone.`,
			actionLabel: "Delete",
			actionClass: "btn-error",
			onConfirm: async () => {
				await deleteContent({ contentId });
				await invalidateAll();
			},
		};
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

	function formatDate(dateStr: string): string {
		try {
			return new Date(dateStr).toLocaleDateString(undefined, {
				year: "numeric",
				month: "short",
				day: "numeric",
			});
		} catch {
			return dateStr;
		}
	}
</script>

<!-- Page Header -->
<div class="flex items-center justify-between mb-6">
	<div>
		<h1 class="text-2xl font-bold flex items-center gap-2">
			<FEATURES.content.icon class="h-7 w-7" style="color: {FEATURES.content.color}" />
			Content
		</h1>
		<p class="text-base-content/60 mt-1">Create and manage interactive H5P learning content.</p>
	</div>
	<a href="/{organisationSlug}/content/new" class="btn btn-primary gap-2">
		<Plus class="h-4 w-4" />
		Create Content
	</a>
</div>

<!-- Content Table -->
{#if data.contentItems.length === 0}
	<div class="card bg-base-100 border border-base-300 p-12 text-center">
		<FEATURES.content.icon class="h-12 w-12 mx-auto mb-4 opacity-30" style="color: {FEATURES.content.color}" />
		<h3 class="text-lg font-semibold mb-2">No content yet</h3>
		<p class="text-base-content/60 mb-6">Get started by creating your first interactive H5P content.</p>
		<div class="flex justify-center">
			<a href="/{organisationSlug}/content/new" class="btn btn-primary gap-2">
				<Plus class="h-4 w-4" />
				Create Content
			</a>
		</div>
	</div>
{:else}
	<div class="card bg-base-100 border border-base-300">
		<div class="overflow-x-auto">
			<table class="table">
				<thead>
					<tr>
						<th>Title</th>
						<th>Content Type</th>
						<th>Status</th>
						<th>Updated</th>
						<th class="w-20"></th>
					</tr>
				</thead>
				<tbody>
					{#each data.contentItems as item (item.id)}
						<tr class="hover">
							<td>
								<a
									href="/{organisationSlug}/content/{item.id}/edit"
									class="font-medium hover:underline"
								>
									{item.title}
								</a>
							</td>
							<td>
								<span class="text-sm text-base-content/70">
									{item.libraryTitle || item.libraryName}
								</span>
								<span class="text-xs text-base-content/40 ml-1">
									v{item.libraryVersion}
								</span>
							</td>
							<td>
								<span class="badge badge-sm {statusBadgeClass(item.status)}">
									{item.status}
								</span>
							</td>
							<td class="text-sm text-base-content/60">
								{formatDate(item.updatedAt)}
							</td>
							<td>
								<div class="flex gap-1">
									<a
										href="/{organisationSlug}/content/{item.id}/edit"
										class="btn btn-ghost btn-xs"
										title="Edit"
									>
										<Pencil class="h-3.5 w-3.5" />
									</a>
									<button
										class="btn btn-ghost btn-xs text-error"
										title="Delete"
										onclick={() => confirmDelete(item.id, item.title)}
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
		{#if data.total > data.contentItems.length}
			<div class="px-4 py-3 border-t border-base-300 text-sm text-base-content/60">
				Showing {data.contentItems.length} of {data.total} items
			</div>
		{/if}
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
