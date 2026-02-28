<script lang="ts">
	/**
	 * H5P Library Manager
	 *
	 * Two-tab view: Hub (browse & install from H5P Hub) and Installed (manage installed libraries).
	 * Data is passed as props from +page.server.ts, mutations use remote functions.
	 */
	import { invalidateAll } from "$app/navigation";
	import { getToast } from "$lib/ui/toast_store.svelte";
	import {
		Search,
		Download,
		Trash2,
		Package,
		RefreshCw,
		CircleCheck,
		CircleAlert,
		BookOpen,
		Grid3x3,
		List,
		Star,
	} from "lucide-svelte";
	import type { ContentTypeCacheEntry, LibraryInfo } from "$lib/api/h5p.types";

	type Props = {
		contentTypes: ContentTypeCacheEntry[];
		installedLibraries: LibraryInfo[];
		hasAdminPermission: boolean;
	};

	let { contentTypes, installedLibraries, hasAdminPermission }: Props = $props();
	const toast = getToast();

	// --- UI State ---
	let searchQuery = $state("");
	let activeTab = $state<"hub" | "installed">("hub");
	let viewMode = $state<"grid" | "list">("grid");
	let isInstalling = $state<string | null>(null);
	let isDeleting = $state<string | null>(null);
	let isRefreshing = $state(false);

	// Confirm modal state (DaisyUI pattern — never use confirm())
	let confirmModal = $state<{
		title: string;
		message: string;
		actionLabel: string;
		actionClass: string;
		onConfirm: () => Promise<void>;
	} | null>(null);
	let isConfirming = $state(false);

	// --- Derived ---
	let filteredContentTypes = $derived.by(() => {
		if (!searchQuery.trim()) return contentTypes;
		const q = searchQuery.toLowerCase();
		return contentTypes.filter(
			(ct) =>
				ct.title?.toLowerCase().includes(q) ||
				ct.summary?.toLowerCase().includes(q) ||
				ct.description?.toLowerCase().includes(q) ||
				ct.keywords?.some((k) => k.toLowerCase().includes(q)),
		);
	});

	let filteredInstalled = $derived.by(() => {
		if (!searchQuery.trim()) return installedLibraries;
		const q = searchQuery.toLowerCase();
		return installedLibraries.filter(
			(lib) =>
				lib.title?.toLowerCase().includes(q) ||
				lib.machineName?.toLowerCase().includes(q) ||
				lib.description?.toLowerCase().includes(q),
		);
	});

	let hubStats = $derived({
		total: contentTypes.length,
		installed: contentTypes.filter((ct) => ct.installed).length,
		available: contentTypes.filter((ct) => !ct.installed).length,
	});

	// --- Actions ---
	function extractErrorMessage(err: unknown): string {
		if (typeof err === "object" && err !== null) {
			const e = err as Record<string, unknown>;
			// SvelteKit HttpError — message is in body.message
			if (typeof e.body === "object" && e.body !== null) {
				const body = e.body as Record<string, unknown>;
				if (typeof body.message === "string") return body.message;
			}
			if (typeof e.message === "string") return e.message;
		}
		if (err instanceof Error) return err.message;
		if (typeof err === "string") return err;
		return "Unknown error";
	}

	async function handleInstall(machineName: string, title: string) {
		if (!hasAdminPermission) {
			toast.error("Admin permissions required", "Only admins can install libraries.");
			return;
		}
		isInstalling = machineName;
		try {
			const { installLibrary } = await import("$lib/api/h5p.remote");
			await installLibrary({ machineName });
			toast.success("Library installed", `${title} has been installed successfully.`);
			await invalidateAll();
		} catch (err: unknown) {
			console.error("Install error:", err);
			const msg = extractErrorMessage(err);
			toast.error("Installation failed", `Could not install ${title}: ${msg}`);
		} finally {
			isInstalling = null;
		}
	}

	function openDeleteModal(machineName: string, title: string) {
		confirmModal = {
			title: "Delete Library",
			message: `Are you sure you want to delete <strong>${title}</strong>? This cannot be undone.`,
			actionLabel: "Delete",
			actionClass: "btn-error",
			onConfirm: async () => {
				isDeleting = machineName;
				try {
					const { deleteLibrary } = await import("$lib/api/h5p.remote");
					await deleteLibrary({ machineName });
					toast.success("Library deleted", `${title} has been removed.`);
					await invalidateAll();
				} catch (err: unknown) {
					console.error("Delete error:", err);
					const msg = extractErrorMessage(err);
					toast.error("Delete failed", `Could not delete ${title}: ${msg}`);
				} finally {
					isDeleting = null;
				}
			},
		};
	}

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

	async function handleRefresh() {
		isRefreshing = true;
		try {
			await invalidateAll();
			toast.success("Refreshed", "Library data has been refreshed.");
		} finally {
			isRefreshing = false;
		}
	}
</script>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
		<div>
			<h1 class="text-2xl font-bold">H5P Libraries</h1>
			<p class="text-base-content/60 mt-1 text-sm">
				Browse the H5P Hub and manage installed libraries
			</p>
		</div>
		<button
			class="btn btn-outline btn-sm gap-2"
			onclick={handleRefresh}
			disabled={isRefreshing}
		>
			<RefreshCw class="h-4 w-4 {isRefreshing ? 'animate-spin' : ''}" />
			Refresh
		</button>
	</div>

	<!-- Tabs -->
	<div class="flex items-center gap-4 border-b border-base-300">
		<button
			class="pb-2 text-sm font-medium transition-colors {activeTab === 'hub'
				? 'border-b-2 border-primary text-primary'
				: 'text-base-content/60 hover:text-base-content'}"
			onclick={() => { activeTab = 'hub'; searchQuery = ''; }}
		>
			Hub ({contentTypes.length})
		</button>
		<button
			class="pb-2 text-sm font-medium transition-colors {activeTab === 'installed'
				? 'border-b-2 border-primary text-primary'
				: 'text-base-content/60 hover:text-base-content'}"
			onclick={() => { activeTab = 'installed'; searchQuery = ''; }}
		>
			Installed ({installedLibraries.length})
		</button>

		<!-- View mode toggle (hub tab only) -->
		{#if activeTab === "hub"}
			<div class="ml-auto flex items-center gap-1 rounded-lg bg-base-200 p-1">
				<button
					class="rounded px-2 py-1 text-xs transition-colors {viewMode === 'grid'
						? 'bg-base-100 shadow-sm'
						: 'text-base-content/60'}"
					onclick={() => (viewMode = "grid")}
				>
					<Grid3x3 class="h-4 w-4" />
				</button>
				<button
					class="rounded px-2 py-1 text-xs transition-colors {viewMode === 'list'
						? 'bg-base-100 shadow-sm'
						: 'text-base-content/60'}"
					onclick={() => (viewMode = "list")}
				>
					<List class="h-4 w-4" />
				</button>
			</div>
		{/if}
	</div>

	<!-- Search -->
	<div class="relative">
		<Search class="text-base-content/40 absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
		<input
			type="text"
			class="input input-bordered w-full pl-10"
			placeholder={activeTab === "hub"
				? "Search content types..."
				: "Search installed libraries..."}
			bind:value={searchQuery}
		/>
	</div>

	<!-- Hub Stats (hub tab only) -->
	{#if activeTab === "hub"}
		<div class="stats stats-horizontal shadow w-full">
			<div class="stat py-3">
				<div class="stat-title text-xs">Available</div>
				<div class="stat-value text-lg">{hubStats.total}</div>
			</div>
			<div class="stat py-3">
				<div class="stat-title text-xs">Installed</div>
				<div class="stat-value text-lg text-success">{hubStats.installed}</div>
			</div>
			<div class="stat py-3">
				<div class="stat-title text-xs">Not Installed</div>
				<div class="stat-value text-lg">{hubStats.available}</div>
			</div>
		</div>
	{/if}

	<!-- Content: Hub Tab -->
	{#if activeTab === "hub"}
		{#if filteredContentTypes.length === 0}
			<div class="flex flex-col items-center justify-center py-16 text-center">
				<BookOpen class="text-base-content/20 mb-4 h-12 w-12" />
				<p class="text-lg font-medium">
					{searchQuery ? "No content types match your search" : "No content types available"}
				</p>
				<p class="text-base-content/60 mt-1 text-sm">
					{searchQuery ? "Try a different search term." : "Check back later or refresh."}
				</p>
			</div>
		{:else if viewMode === "grid"}
			<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
				{#each filteredContentTypes as ct (ct.id)}
					{@const isAlreadyInstalled = ct.installed}
					{@const installing = isInstalling === ct.id}
					<div class="card bg-base-100 border border-base-300 shadow-sm transition-shadow hover:shadow-md">
						<div class="card-body p-4">
							<div class="flex items-start justify-between gap-2">
								<h3 class="card-title text-sm leading-tight">{ct.title}</h3>
								{#if isAlreadyInstalled}
									<span class="badge badge-success badge-sm gap-1 shrink-0">
										<CircleCheck class="h-3 w-3" />
										Installed
									</span>
								{/if}
							</div>

							{#if ct.summary}
								<p class="text-base-content/60 line-clamp-2 text-xs">{ct.summary}</p>
							{/if}

							<div class="mt-2 flex flex-wrap items-center gap-2 text-xs text-base-content/50">
								<span>v{ct.majorVersion}.{ct.minorVersion}.{ct.patchVersion}</span>
								{#if ct.popularity}
									<span class="flex items-center gap-1">
										<Star class="h-3 w-3" />
										{ct.popularity}
									</span>
								{/if}
								{#if ct.isRecommended}
									<span class="badge badge-primary badge-xs">Recommended</span>
								{/if}
							</div>

							{#if ct.owner}
								<p class="text-base-content/40 text-xs">by {ct.owner}</p>
							{/if}

							<div class="card-actions mt-3 justify-end">
								{#if isAlreadyInstalled}
									{#if ct.updateAvailable}
										<button
											class="btn btn-warning btn-xs gap-1"
											onclick={() => handleInstall(ct.id, ct.title)}
											disabled={installing}
										>
											{#if installing}
												<span class="loading loading-spinner loading-xs"></span>
											{:else}
												<Download class="h-3 w-3" />
											{/if}
											Update
										</button>
									{:else if hasAdminPermission}
										<button
											class="btn btn-ghost btn-xs gap-1"
											onclick={() => handleInstall(ct.id, ct.title)}
											disabled={installing}
										>
											{#if installing}
												<span class="loading loading-spinner loading-xs"></span>
												Reinstalling...
											{:else}
												<RefreshCw class="h-3 w-3" />
												Reinstall
											{/if}
										</button>
									{:else}
										<span class="text-success text-xs">Up to date</span>
									{/if}
								{:else if hasAdminPermission}
									<button
										class="btn btn-primary btn-xs gap-1"
										onclick={() => handleInstall(ct.id, ct.title)}
										disabled={installing}
									>
										{#if installing}
											<span class="loading loading-spinner loading-xs"></span>
											Installing...
										{:else}
											<Download class="h-3 w-3" />
											Install
										{/if}
									</button>
								{:else}
									<span class="text-base-content/40 flex items-center gap-1 text-xs">
										<CircleAlert class="h-3 w-3" />
										Admin required
									</span>
								{/if}
							</div>
						</div>
					</div>
				{/each}
			</div>
		{:else}
			<!-- List view -->
			<div class="overflow-x-auto">
				<table class="table table-sm">
					<thead>
						<tr>
							<th>Library</th>
							<th>Version</th>
							<th>Owner</th>
							<th>Status</th>
							<th class="text-right">Action</th>
						</tr>
					</thead>
					<tbody>
						{#each filteredContentTypes as ct (ct.id)}
							{@const isAlreadyInstalled = ct.installed}
							{@const installing = isInstalling === ct.id}
							<tr class="hover">
								<td>
									<div>
										<p class="font-medium">{ct.title}</p>
										{#if ct.summary}
											<p class="text-base-content/60 line-clamp-1 text-xs">{ct.summary}</p>
										{/if}
									</div>
								</td>
								<td class="text-xs">v{ct.majorVersion}.{ct.minorVersion}.{ct.patchVersion}</td>
								<td class="text-base-content/60 text-xs">{ct.owner || "—"}</td>
								<td>
									{#if isAlreadyInstalled}
										<span class="badge badge-success badge-sm gap-1">
											<CircleCheck class="h-3 w-3" />
											Installed
										</span>
									{:else}
										<span class="badge badge-ghost badge-sm">Available</span>
									{/if}
								</td>
								<td class="text-right">
									{#if isAlreadyInstalled && ct.updateAvailable}
										<button
											class="btn btn-warning btn-xs gap-1"
											onclick={() => handleInstall(ct.id, ct.title)}
											disabled={installing}
										>
											{#if installing}
												<span class="loading loading-spinner loading-xs"></span>
											{/if}
											Update
										</button>
									{:else if isAlreadyInstalled && hasAdminPermission}
										<button
											class="btn btn-ghost btn-xs gap-1"
											onclick={() => handleInstall(ct.id, ct.title)}
											disabled={installing}
										>
											{#if installing}
												<span class="loading loading-spinner loading-xs"></span>
											{:else}
												<RefreshCw class="h-3 w-3" />
											{/if}
											Reinstall
										</button>
									{:else if !isAlreadyInstalled && hasAdminPermission}
										<button
											class="btn btn-primary btn-xs gap-1"
											onclick={() => handleInstall(ct.id, ct.title)}
											disabled={installing}
										>
											{#if installing}
												<span class="loading loading-spinner loading-xs"></span>
												Installing...
											{:else}
												<Download class="h-3 w-3" />
												Install
											{/if}
										</button>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}

	<!-- Content: Installed Tab -->
	{:else}
		{#if filteredInstalled.length === 0}
			<div class="flex flex-col items-center justify-center py-16 text-center">
				<Package class="text-base-content/20 mb-4 h-12 w-12" />
				<p class="text-lg font-medium">
					{searchQuery ? "No installed libraries match your search" : "No libraries installed yet"}
				</p>
				<p class="text-base-content/60 mt-1 text-sm">
					{searchQuery
						? "Try a different search term."
						: "Browse the Hub tab to install content types."}
				</p>
			</div>
		{:else}
			<div class="overflow-x-auto">
				<table class="table table-sm">
					<thead>
						<tr>
							<th>Library</th>
							<th>Machine Name</th>
							<th>Version</th>
							<th>Runnable</th>
							{#if hasAdminPermission}
								<th class="text-right">Actions</th>
							{/if}
						</tr>
					</thead>
					<tbody>
						{#each filteredInstalled as lib (lib.id)}
							{@const deleting = isDeleting === lib.machineName}
							<tr class="hover">
								<td class="font-medium">{lib.title || lib.machineName}</td>
								<td class="text-base-content/60 font-mono text-xs">{lib.machineName}</td>
								<td class="text-xs">v{lib.majorVersion}.{lib.minorVersion}.{lib.patchVersion}</td>
								<td>
									{#if lib.runnable}
										<span class="badge badge-success badge-sm">Yes</span>
									{:else}
										<span class="badge badge-ghost badge-sm">No</span>
									{/if}
								</td>
								{#if hasAdminPermission}
									<td class="text-right">
										<div class="flex items-center justify-end gap-2">
											<button
												class="btn btn-ghost btn-xs gap-1"
												onclick={() => handleInstall(lib.machineName, lib.title || lib.machineName)}
												disabled={isInstalling === lib.machineName}
											>
												{#if isInstalling === lib.machineName}
													<span class="loading loading-spinner loading-xs"></span>
												{:else}
													<RefreshCw class="h-3 w-3" />
												{/if}
												Reinstall
											</button>
											<button
												class="btn btn-error btn-outline btn-xs gap-1"
												onclick={() => openDeleteModal(lib.machineName, lib.title || lib.machineName)}
												disabled={deleting}
											>
												{#if deleting}
													<span class="loading loading-spinner loading-xs"></span>
												{:else}
													<Trash2 class="h-3 w-3" />
												{/if}
												Delete
											</button>
										</div>
									</td>
								{/if}
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	{/if}
</div>

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
