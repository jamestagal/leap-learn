<script lang="ts">
	import { page } from "$app/stores";
	import { invalidateAll, goto, replaceState } from "$app/navigation";
	import { getToast } from "$lib/ui/toast_store.svelte";
	import { createClient, updateClient, archiveClient, restoreClient, deleteClient } from "$lib/api/clients.remote";
	import { formatDate } from '$lib/utils/formatting';
	import {
		Users,
		Plus,
		MoreVertical,
		Building2,
		Mail,
		Phone,
		User,
		Pencil,
		Archive,
		RotateCcw,
		Trash2,
		Search,
		FileText,
		X,
		Loader2,
	} from "lucide-svelte";
	import { FEATURES } from "$lib/config/features";
	import type { PageProps } from "./$types";

	const toast = getToast();
	let { data }: PageProps = $props();

	let organisationSlug = $derived(data.organisation.slug);

	// Search state - sync with URL param reactively
	let searchInput = $state("");
	let isSearching = $state(false);

	// Keep search input in sync with data.search from URL
	$effect(() => {
		searchInput = data.search || "";
	});

	// Modal state
	let showCreateModal = $state(false);
	let showEditModal = $state(false);
	let showDeleteModal = $state(false);
	let editingClient = $state<(typeof data.clients)[0] | null>(null);
	let deletingClient = $state<(typeof data.clients)[0] | null>(null);
	let isSaving = $state(false);
	let isDeleting = $state(false);

	// Form state
	let formData = $state({
		businessName: "",
		email: "",
		phone: "",
		contactName: "",
		notes: "",
	});

	// Auto-open create modal if ?new=true in URL (one-shot)
	let newParamHandled = false;
	$effect(() => {
		if (!newParamHandled && $page.url.searchParams.get("new") === "true") {
			newParamHandled = true;
			showCreateModal = true;
			replaceState(new URL($page.url.pathname, $page.url.origin), {});
		}
	});

	// Status counts
	let statusCounts = $derived({
		active: data.clients.filter((c) => c.status === "active").length,
		archived: data.clients.filter((c) => c.status === "archived").length,
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

	function handleSearch() {
		isSearching = true;
		const url = new URL($page.url);
		if (searchInput.trim()) {
			url.searchParams.set("search", searchInput.trim());
		} else {
			url.searchParams.delete("search");
		}
		goto(url.toString()).finally(() => {
			isSearching = false;
		});
	}

	function clearSearch() {
		searchInput = "";
		const url = new URL($page.url);
		url.searchParams.delete("search");
		goto(url.toString());
	}

	function openCreateModal() {
		formData = { businessName: "", email: "", phone: "", contactName: "", notes: "" };
		showCreateModal = true;
	}

	function openEditModal(client: (typeof data.clients)[0]) {
		editingClient = client;
		formData = {
			businessName: client.businessName,
			email: client.email,
			phone: client.phone || "",
			contactName: client.contactName || "",
			notes: client.notes || "",
		};
		showEditModal = true;
	}

	async function handleCreate() {
		if (!formData.businessName.trim() || !formData.email.trim()) {
			toast.error("Business name and email are required");
			return;
		}

		isSaving = true;
		try {
			await createClient({
				businessName: formData.businessName.trim(),
				email: formData.email.trim(),
				phone: formData.phone.trim() || null,
				contactName: formData.contactName.trim() || null,
				notes: formData.notes.trim() || null,
			});
			showCreateModal = false;
			await invalidateAll();
			toast.success("Client created successfully");
		} catch (err) {
			toast.error("Failed to create client", err instanceof Error ? err.message : "");
		} finally {
			isSaving = false;
		}
	}

	async function handleUpdate() {
		if (!editingClient || !formData.businessName.trim() || !formData.email.trim()) {
			toast.error("Business name and email are required");
			return;
		}

		isSaving = true;
		try {
			await updateClient({
				id: editingClient.id,
				businessName: formData.businessName.trim(),
				email: formData.email.trim(),
				phone: formData.phone.trim() || null,
				contactName: formData.contactName.trim() || null,
				notes: formData.notes.trim() || null,
			});
			showEditModal = false;
			editingClient = null;
			await invalidateAll();
			toast.success("Client updated successfully");
		} catch (err) {
			toast.error("Failed to update client", err instanceof Error ? err.message : "");
		} finally {
			isSaving = false;
		}
	}

	async function handleArchive(clientId: string) {
		try {
			await archiveClient(clientId);
			await invalidateAll();
			toast.success("Client archived");
		} catch (err) {
			toast.error("Failed to archive client", err instanceof Error ? err.message : "");
		}
	}

	async function handleRestore(clientId: string) {
		try {
			await restoreClient(clientId);
			await invalidateAll();
			toast.success("Client restored");
		} catch (err) {
			toast.error("Failed to restore client", err instanceof Error ? err.message : "");
		}
	}

	function openDeleteModal(client: (typeof data.clients)[0]) {
		deletingClient = client;
		showDeleteModal = true;
	}

	function closeDeleteModal() {
		showDeleteModal = false;
		deletingClient = null;
	}

	async function confirmDelete() {
		if (!deletingClient) return;

		isDeleting = true;
		try {
			await deleteClient(deletingClient.id);
			closeDeleteModal();
			await invalidateAll();
			toast.success("Client deleted");
		} catch (err) {
			toast.error("Failed to delete client", err instanceof Error ? err.message : "");
		} finally {
			isDeleting = false;
		}
	}


</script>

<div class="space-y-6">
	<!-- Page Header -->
	<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
		<div>
			<h1 class="text-2xl font-bold flex items-center gap-2">
				<Users class="h-7 w-7" style="color: {FEATURES.clients.color}" />
				Clients
			</h1>
			<p class="text-base-content/70 mt-1">Manage your client relationships</p>
		</div>
		<button type="button" class="btn btn-primary" onclick={openCreateModal}>
			<Plus class="h-4 w-4" />
			New Client
		</button>
	</div>

	<!-- Search Bar -->
	<div class="flex gap-2">
		<div class="relative flex-1 max-w-md">
			<Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-base-content/40" />
			<input
				type="text"
				class="input input-bordered w-full pl-10 pr-10"
				placeholder="Search clients..."
				bind:value={searchInput}
				onkeydown={(e) => e.key === "Enter" && handleSearch()}
			/>
			{#if searchInput}
				<button
					type="button"
					class="absolute right-3 top-1/2 -translate-y-1/2 btn btn-ghost btn-xs btn-circle"
					onclick={clearSearch}
				>
					<X class="h-3 w-3" />
				</button>
			{/if}
		</div>
		<button type="button" class="btn btn-outline" onclick={handleSearch} disabled={isSearching}>
			{#if isSearching}
				<span class="loading loading-spinner loading-sm"></span>
			{:else}
				Search
			{/if}
		</button>
	</div>

	<!-- Status Tabs -->
	<div class="tabs tabs-boxed bg-base-200 p-1 w-fit">
		<button
			class="tab"
			class:tab-active={!data.statusFilter || data.statusFilter === "active"}
			onclick={() => handleStatusFilter(null)}
		>
			Active ({statusCounts.active})
		</button>
		<button
			class="tab"
			class:tab-active={data.statusFilter === "archived"}
			onclick={() => handleStatusFilter("archived")}
		>
			Archived ({statusCounts.archived})
		</button>
	</div>

	{#if data.clients.length === 0}
		<!-- Empty state -->
		<div class="card bg-base-100 border border-base-300">
			<div class="card-body items-center text-center py-12">
				<div
					class="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary mb-4"
				>
					<Users class="h-8 w-8" />
				</div>
				{#if data.search}
					<h3 class="text-lg font-semibold">No clients found</h3>
					<p class="text-base-content/60 max-w-sm">
						No clients match your search "{data.search}". Try a different search term.
					</p>
					<button type="button" class="btn btn-outline mt-4" onclick={clearSearch}>
						Clear Search
					</button>
				{:else if data.statusFilter === "archived"}
					<h3 class="text-lg font-semibold">No archived clients</h3>
					<p class="text-base-content/60 max-w-sm">
						Archived clients will appear here. You can archive clients from the client list.
					</p>
				{:else}
					<h3 class="text-lg font-semibold">No clients yet</h3>
					<p class="text-base-content/60 max-w-sm">
						Add your first client to start tracking their projects and documents.
					</p>
					<button type="button" class="btn btn-primary mt-4" onclick={openCreateModal}>
						<Plus class="h-4 w-4" />
						Add First Client
					</button>
				{/if}
			</div>
		</div>
	{:else}
		<!-- Mobile Card Layout -->
		<div class="space-y-3 md:hidden">
			{#each data.clients as client (client.id)}
				<div class="card bg-base-100 border border-base-300">
					<div class="card-body p-4">
						<div class="flex items-start justify-between gap-2">
							<a href="/{organisationSlug}/clients/{client.id}" class="flex-1 min-w-0">
								<div class="flex items-center gap-2">
									<span class="font-medium truncate">{client.businessName}</span>
									{#if client.status === "archived"}
										<span class="badge badge-ghost badge-sm">Archived</span>
									{/if}
								</div>
								<div class="flex items-center gap-2 mt-1 text-sm text-base-content/70">
									<Mail class="h-3 w-3" />
									<span class="truncate">{client.email}</span>
								</div>
								{#if client.phone}
									<div class="flex items-center gap-2 mt-0.5 text-sm text-base-content/60">
										<Phone class="h-3 w-3" />
										<span>{client.phone}</span>
									</div>
								{/if}
							</a>
							<div class="dropdown dropdown-end">
								<button type="button" tabindex="0" class="btn btn-ghost btn-sm btn-square">
									<MoreVertical class="h-4 w-4" />
								</button>
								<ul class="dropdown-content z-50 menu p-2 shadow-lg bg-base-100 rounded-box w-52 border border-base-300">
									<li>
										<a href="/{organisationSlug}/clients/{client.id}">
											<FileText class="h-4 w-4" />
											View Client Hub
										</a>
									</li>
									<li>
										<button type="button" onclick={() => openEditModal(client)}>
											<Pencil class="h-4 w-4" />
											Edit
										</button>
									</li>
									{#if client.status === "active"}
										<li>
											<button type="button" onclick={() => handleArchive(client.id)}>
												<Archive class="h-4 w-4" />
												Archive
											</button>
										</li>
									{:else}
										<li>
											<button type="button" onclick={() => handleRestore(client.id)}>
												<RotateCcw class="h-4 w-4" />
												Restore
											</button>
										</li>
									{/if}
									<li class="border-t border-base-300 mt-1 pt-1">
										<button type="button" class="text-error" onclick={() => openDeleteModal(client)}>
											<Trash2 class="h-4 w-4" />
											Delete
										</button>
									</li>
								</ul>
							</div>
						</div>
						{#if client.contactName}
							<div class="flex items-center gap-2 mt-2 pt-2 border-t border-base-200 text-sm text-base-content/60">
								<User class="h-3 w-3" />
								<span>{client.contactName}</span>
							</div>
						{/if}
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
							<th>Business Name</th>
							<th>Contact</th>
							<th>Email</th>
							<th>Phone</th>
							<th>Created</th>
							<th class="w-10"></th>
						</tr>
					</thead>
					<tbody>
						{#each data.clients as client (client.id)}
							<tr class="hover:bg-base-50 cursor-pointer" onclick={() => goto(`/${organisationSlug}/clients/${client.id}`)}>
								<td>
									<div class="flex items-center gap-2">
										<Building2 class="h-4 w-4 text-base-content/40" />
										<span class="font-medium">{client.businessName}</span>
										{#if client.status === "archived"}
											<span class="badge badge-ghost badge-sm">Archived</span>
										{/if}
									</div>
								</td>
								<td>
									{#if client.contactName}
										<div class="flex items-center gap-2">
											<User class="h-4 w-4 text-base-content/40" />
											<span>{client.contactName}</span>
										</div>
									{:else}
										<span class="text-base-content/40">—</span>
									{/if}
								</td>
								<td>
									<div class="flex items-center gap-2">
										<Mail class="h-3 w-3 text-base-content/40" />
										<span class="text-sm">{client.email}</span>
									</div>
								</td>
								<td>
									{#if client.phone}
										<div class="flex items-center gap-2">
											<Phone class="h-3 w-3 text-base-content/40" />
											<span class="text-sm">{client.phone}</span>
										</div>
									{:else}
										<span class="text-base-content/40">—</span>
									{/if}
								</td>
								<td>
									<span class="text-sm text-base-content/70">
										{formatDate(client.createdAt)}
									</span>
								</td>
								<td onclick={(e) => e.stopPropagation()}>
									<div class="dropdown dropdown-end">
										<button type="button" tabindex="0" class="btn btn-ghost btn-sm btn-square">
											<MoreVertical class="h-4 w-4" />
										</button>
										<ul class="dropdown-content z-10 menu p-2 shadow-lg bg-base-100 rounded-box w-52 border border-base-300">
											<li>
												<a href="/{organisationSlug}/clients/{client.id}">
													<FileText class="h-4 w-4" />
													View Client Hub
												</a>
											</li>
											<li>
												<button type="button" onclick={() => openEditModal(client)}>
													<Pencil class="h-4 w-4" />
													Edit
												</button>
											</li>
											{#if client.status === "active"}
												<li>
													<button type="button" onclick={() => handleArchive(client.id)}>
														<Archive class="h-4 w-4" />
														Archive
													</button>
												</li>
											{:else}
												<li>
													<button type="button" onclick={() => handleRestore(client.id)}>
														<RotateCcw class="h-4 w-4" />
														Restore
													</button>
												</li>
											{/if}
											<li class="border-t border-base-300 mt-1 pt-1">
												<button type="button" class="text-error" onclick={() => openDeleteModal(client)}>
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

<!-- Create Client Modal -->
{#if showCreateModal}
<dialog class="modal modal-open">
	<div class="modal-box">
		<button type="button" class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2" onclick={() => showCreateModal = false} disabled={isSaving}>
			<X class="h-4 w-4" />
		</button>

		<div class="flex items-center gap-3 mb-4">
			<div class="flex h-10 w-10 items-center justify-center rounded-full" style="background-color: {FEATURES.clients.colorLight}; color: {FEATURES.clients.color}">
				<Users class="h-5 w-5" />
			</div>
			<h3 class="font-bold text-lg">New Client</h3>
		</div>

		<form onsubmit={(e) => { e.preventDefault(); handleCreate(); }}>
			<div class="space-y-4">
				<div class="form-control">
					<label class="label" for="businessName">
						<span class="label-text">Business Name <span class="text-error">*</span></span>
					</label>
					<input
						type="text"
						id="businessName"
						class="input input-bordered"
						bind:value={formData.businessName}
						placeholder="Acme Corp"
						required
					/>
				</div>

				<div class="form-control">
					<label class="label" for="email">
						<span class="label-text">Email <span class="text-error">*</span></span>
					</label>
					<input
						type="email"
						id="email"
						class="input input-bordered"
						bind:value={formData.email}
						placeholder="contact@acme.com"
						required
					/>
				</div>

				<div class="grid grid-cols-2 gap-4">
					<div class="form-control">
						<label class="label" for="contactName">
							<span class="label-text">Contact Name</span>
						</label>
						<input
							type="text"
							id="contactName"
							class="input input-bordered"
							bind:value={formData.contactName}
							placeholder="John Smith"
						/>
					</div>

					<div class="form-control">
						<label class="label" for="phone">
							<span class="label-text">Phone</span>
						</label>
						<input
							type="tel"
							id="phone"
							class="input input-bordered"
							bind:value={formData.phone}
							placeholder="0412 345 678"
						/>
					</div>
				</div>

				<div class="form-control">
					<label class="label" for="notes">
						<span class="label-text">Notes</span>
					</label>
					<textarea
						id="notes"
						class="textarea textarea-bordered"
						rows="2"
						bind:value={formData.notes}
						placeholder="Optional notes about this client..."
					></textarea>
				</div>
			</div>

			<div class="modal-action">
				<button type="button" class="btn btn-ghost" onclick={() => showCreateModal = false} disabled={isSaving}>
					Cancel
				</button>
				<button type="submit" class="btn btn-primary" disabled={isSaving}>
					{#if isSaving}
						<Loader2 class="h-4 w-4 animate-spin" />
						Creating...
					{:else}
						<Plus class="h-4 w-4" />
						Create Client
					{/if}
				</button>
			</div>
		</form>
	</div>
	<form method="dialog" class="modal-backdrop">
		<button type="button" onclick={() => showCreateModal = false} disabled={isSaving}>close</button>
	</form>
</dialog>
{/if}

<!-- Edit Client Modal -->
{#if showEditModal && editingClient}
<dialog class="modal modal-open">
	<div class="modal-box">
		<button type="button" class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2" onclick={() => { showEditModal = false; editingClient = null; }} disabled={isSaving}>
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
						rows="2"
						bind:value={formData.notes}
					></textarea>
				</div>
			</div>

			<div class="modal-action">
				<button type="button" class="btn btn-ghost" onclick={() => { showEditModal = false; editingClient = null; }} disabled={isSaving}>
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
		<button type="button" onclick={() => { showEditModal = false; editingClient = null; }} disabled={isSaving}>close</button>
	</form>
</dialog>
{/if}

<!-- Delete Confirmation Modal -->
{#if showDeleteModal && deletingClient}
	<div class="modal modal-open">
		<div class="modal-box">
			<h3 class="text-lg font-bold">Delete Client</h3>
			<p class="py-4">
				Are you sure you want to permanently delete <strong>{deletingClient.businessName}</strong>? This action cannot be undone.
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
