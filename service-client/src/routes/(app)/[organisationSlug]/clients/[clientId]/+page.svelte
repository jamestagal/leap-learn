<script lang="ts">
	import { invalidateAll } from "$app/navigation";
	import { getToast } from "$lib/ui/toast_store.svelte";
	import { updateClient, archiveClient, restoreClient } from "$lib/api/clients.remote";
	import { formatDate } from '$lib/utils/formatting';
	import {
		ArrowLeft,
		Mail,
		Phone,
		User,
		Pencil,
		Archive,
		RotateCcw,
		X,
		Loader2,
		StickyNote,
	} from "lucide-svelte";
	import { FEATURES } from "$lib/config/features";
	import type { PageProps } from "./$types";

	const toast = getToast();
	let { data }: PageProps = $props();

	let organisationSlug = $derived(data.organisation.slug);
	let client = $derived(data.client);

	// Edit modal state
	let showEditModal = $state(false);
	let isSaving = $state(false);
	let formData = $state({
		businessName: "",
		email: "",
		phone: "",
		contactName: "",
		notes: "",
	});

	function openEditModal() {
		formData = {
			businessName: client.businessName,
			email: client.email,
			phone: client.phone || "",
			contactName: client.contactName || "",
			notes: client.notes || "",
		};
		showEditModal = true;
	}

	async function handleUpdate() {
		if (!formData.businessName.trim() || !formData.email.trim()) {
			toast.error("Business name and email are required");
			return;
		}

		isSaving = true;
		try {
			await updateClient({
				id: client.id,
				businessName: formData.businessName.trim(),
				email: formData.email.trim(),
				phone: formData.phone.trim() || null,
				contactName: formData.contactName.trim() || null,
				notes: formData.notes.trim() || null,
			});
			showEditModal = false;
			await invalidateAll();
			toast.success("Client updated successfully");
		} catch (err) {
			toast.error("Failed to update client", err instanceof Error ? err.message : "");
		} finally {
			isSaving = false;
		}
	}

	async function handleArchive() {
		try {
			await archiveClient(client.id);
			await invalidateAll();
			toast.success("Client archived");
		} catch (err) {
			toast.error("Failed to archive client", err instanceof Error ? err.message : "");
		}
	}

	async function handleRestore() {
		try {
			await restoreClient(client.id);
			await invalidateAll();
			toast.success("Client restored");
		} catch (err) {
			toast.error("Failed to restore client", err instanceof Error ? err.message : "");
		}
	}
</script>

<div class="space-y-6">
	<!-- Header with Back Button -->
	<div class="flex items-start gap-4">
		<a href="/{organisationSlug}/clients" class="btn btn-ghost btn-sm btn-square mt-1">
			<ArrowLeft class="h-4 w-4" />
		</a>
		<div class="flex-1">
			<div class="flex items-center gap-3">
				<h1 class="text-2xl font-bold">{client.businessName}</h1>
				{#if client.status === "archived"}
					<span class="badge badge-ghost">Archived</span>
				{/if}
			</div>
			<div class="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-base-content/70">
				<span class="flex items-center gap-1">
					<Mail class="h-4 w-4" />
					{client.email}
				</span>
				{#if client.phone}
					<span class="flex items-center gap-1">
						<Phone class="h-4 w-4" />
						{client.phone}
					</span>
				{/if}
				{#if client.contactName}
					<span class="flex items-center gap-1">
						<User class="h-4 w-4" />
						{client.contactName}
					</span>
				{/if}
			</div>
		</div>
		<div class="flex gap-2">
			<button type="button" class="btn btn-outline btn-sm" onclick={openEditModal}>
				<Pencil class="h-4 w-4" />
				Edit
			</button>
			{#if client.status === "active"}
				<button type="button" class="btn btn-outline btn-sm" onclick={handleArchive}>
					<Archive class="h-4 w-4" />
					Archive
				</button>
			{:else}
				<button type="button" class="btn btn-outline btn-sm" onclick={handleRestore}>
					<RotateCcw class="h-4 w-4" />
					Restore
				</button>
			{/if}
		</div>
	</div>

	<!-- Notes Card (if exists) -->
	{#if client.notes}
		<div class="card bg-base-100 border border-base-300">
			<div class="card-body p-4">
				<div class="flex items-center gap-2 text-sm font-medium text-base-content/70">
					<StickyNote class="h-4 w-4" />
					Notes
				</div>
				<p class="text-sm whitespace-pre-wrap">{client.notes}</p>
			</div>
		</div>
	{/if}

	<!-- Client Details Card -->
	<div class="card bg-base-100 border border-base-300">
		<div class="card-body p-4 sm:p-6">
			<h2 class="text-lg font-semibold mb-4">Client Details</h2>
			<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
				<div>
					<span class="text-sm text-base-content/60">Business Name</span>
					<p class="font-medium">{client.businessName}</p>
				</div>
				<div>
					<span class="text-sm text-base-content/60">Email</span>
					<p class="font-medium">{client.email}</p>
				</div>
				{#if client.contactName}
					<div>
						<span class="text-sm text-base-content/60">Contact Name</span>
						<p class="font-medium">{client.contactName}</p>
					</div>
				{/if}
				{#if client.phone}
					<div>
						<span class="text-sm text-base-content/60">Phone</span>
						<p class="font-medium">{client.phone}</p>
					</div>
				{/if}
				<div>
					<span class="text-sm text-base-content/60">Status</span>
					<p class="font-medium capitalize">{client.status}</p>
				</div>
				<div>
					<span class="text-sm text-base-content/60">Created</span>
					<p class="font-medium">{formatDate(client.createdAt)}</p>
				</div>
			</div>
		</div>
	</div>
</div>

<!-- Edit Client Modal -->
{#if showEditModal}
<dialog class="modal modal-open">
	<div class="modal-box">
		<button type="button" class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2" onclick={() => showEditModal = false} disabled={isSaving}>
			<X class="h-4 w-4" />
		</button>

		<div class="flex items-center gap-3 mb-4">
			<div class="flex h-10 w-10 items-center justify-center rounded-full" style="background-color: {FEATURES.clients.colorLight}; color: {FEATURES.clients.color}">
				<Pencil class="h-5 w-5" />
			</div>
			<h3 class="font-bold text-lg">Edit Client</h3>
		</div>

		<form onsubmit={(e) => { e.preventDefault(); handleUpdate(); }}>
			<div class="space-y-4">
				<div class="form-control">
					<label class="label" for="edit-businessName">
						<span class="label-text">Business Name <span class="text-error">*</span></span>
					</label>
					<input
						type="text"
						id="edit-businessName"
						class="input input-bordered"
						bind:value={formData.businessName}
						required
					/>
				</div>

				<div class="form-control">
					<label class="label" for="edit-email">
						<span class="label-text">Email <span class="text-error">*</span></span>
					</label>
					<input
						type="email"
						id="edit-email"
						class="input input-bordered"
						bind:value={formData.email}
						required
					/>
				</div>

				<div class="grid grid-cols-2 gap-4">
					<div class="form-control">
						<label class="label" for="edit-contactName">
							<span class="label-text">Contact Name</span>
						</label>
						<input
							type="text"
							id="edit-contactName"
							class="input input-bordered"
							bind:value={formData.contactName}
						/>
					</div>

					<div class="form-control">
						<label class="label" for="edit-phone">
							<span class="label-text">Phone</span>
						</label>
						<input
							type="tel"
							id="edit-phone"
							class="input input-bordered"
							bind:value={formData.phone}
						/>
					</div>
				</div>

				<div class="form-control">
					<label class="label" for="edit-notes">
						<span class="label-text">Notes</span>
					</label>
					<textarea
						id="edit-notes"
						class="textarea textarea-bordered"
						rows="3"
						bind:value={formData.notes}
					></textarea>
				</div>
			</div>

			<div class="modal-action">
				<button type="button" class="btn btn-ghost" onclick={() => showEditModal = false} disabled={isSaving}>
					Cancel
				</button>
				<button type="submit" class="btn btn-primary" disabled={isSaving}>
					{#if isSaving}
						<Loader2 class="h-4 w-4 animate-spin" />
						Saving...
					{:else}
						Save Changes
					{/if}
				</button>
			</div>
		</form>
	</div>
	<form method="dialog" class="modal-backdrop">
		<button type="button" onclick={() => showEditModal = false} disabled={isSaving}>close</button>
	</form>
</dialog>
{/if}
