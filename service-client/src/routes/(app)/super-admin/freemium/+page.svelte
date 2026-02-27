<script lang="ts">
	import { Search, RotateCcw, Building2, Gift, ExternalLink, XCircle, Calendar } from 'lucide-svelte';
	import { getFreemiumOrganisations, revokeOrganisationFreemium, updateFreemiumExpiry } from '$lib/api/super-admin.remote';
	import { formatDate } from '$lib/utils/formatting';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { getToast } from '$lib/ui/toast_store.svelte';

	const toast = getToast();

	interface FreemiumOrganisation {
		id: string;
		name: string;
		slug: string;
		email: string;
		status: string;
		isFreemium: boolean;
		freemiumReason: string | null;
		freemiumExpiresAt: Date | null;
		freemiumGrantedAt: Date | null;
		freemiumGrantedBy: string | null;
		createdAt: Date;
		ownerEmail: string | null;
	}

	let organisations = $state<FreemiumOrganisation[]>([]);
	let total = $state(0);
	let stats = $state<Record<string, number>>({});
	let loading = $state(true);
	let error = $state<string | null>(null);

	// Filters
	let search = $state('');
	let reasonFilter = $state('');
	let currentPage = $state(1);
	const pageSize = 20;

	// Expiry modal
	let showExpiryModal = $state(false);
	let selectedOrganisation = $state<FreemiumOrganisation | null>(null);
	let newExpiryDate = $state('');
	let updatingExpiry = $state(false);

	// Revoke confirmation modal
	let showRevokeModal = $state(false);
	let revokingOrganisation = $state<{ id: string; name: string } | null>(null);
	let isRevoking = $state(false);

	let searchDebounce: ReturnType<typeof setTimeout>;

	const reasonLabels: Record<string, string> = {
		beta_tester: 'Beta Tester',
		partner: 'Partner',
		promotional: 'Promotional',
		early_signup: 'Early Signup',
		referral_reward: 'Referral Reward',
		internal: 'Internal'
	};

	async function loadOrganisations() {
		loading = true;
		error = null;
		try {
			const result = await getFreemiumOrganisations({
				search: search || undefined,
				reason: reasonFilter || undefined,
				limit: pageSize,
				offset: (currentPage - 1) * pageSize
			});
			organisations = result.organisations;
			total = result.total;
			stats = result.stats;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load organisations';
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		loadOrganisations();
	});

	function handleSearchInput() {
		clearTimeout(searchDebounce);
		searchDebounce = setTimeout(() => {
			currentPage = 1;
			loadOrganisations();
		}, 300);
	}

	function handleFilterChange() {
		currentPage = 1;
		loadOrganisations();
	}

	function openRevokeModal(organisation: FreemiumOrganisation) {
		revokingOrganisation = { id: organisation.id, name: organisation.name };
		showRevokeModal = true;
	}

	function closeRevokeModal() {
		showRevokeModal = false;
		revokingOrganisation = null;
	}

	async function handleRevoke() {
		if (!revokingOrganisation) return;
		isRevoking = true;
		try {
			await revokeOrganisationFreemium(revokingOrganisation.id);
			closeRevokeModal();
			toast.success('Success', 'Freemium status revoked');
			loadOrganisations();
		} catch (e) {
			toast.error('Error', e instanceof Error ? e.message : 'Failed to revoke freemium');
		} finally {
			isRevoking = false;
		}
	}

	function openExpiryModal(organisation: FreemiumOrganisation) {
		selectedOrganisation = organisation;
		newExpiryDate = organisation.freemiumExpiresAt
			? new Date(organisation.freemiumExpiresAt).toISOString().split('T')[0] ?? ''
			: '';
		showExpiryModal = true;
	}

	async function handleUpdateExpiry() {
		if (!selectedOrganisation) return;

		updatingExpiry = true;
		try {
			await updateFreemiumExpiry({
				organisationId: selectedOrganisation.id,
				expiresAt: newExpiryDate ? new Date(newExpiryDate).toISOString() : null
			});
			toast.success('Success', newExpiryDate ? 'Expiry date updated' : 'Expiry removed (no expiry)');
			showExpiryModal = false;
			selectedOrganisation = null;
			loadOrganisations();
		} catch (e) {
			toast.error('Error', e instanceof Error ? e.message : 'Failed to update expiry');
		} finally {
			updatingExpiry = false;
		}
	}

	function formatDateOrExpiry(date: Date | string | null): string {
		if (!date) return 'No expiry';
		return formatDate(date);
	}

	function getReasonBadgeClass(reason: string | null): string {
		switch (reason) {
			case 'beta_tester':
				return 'badge-primary';
			case 'partner':
				return 'badge-secondary';
			case 'promotional':
				return 'badge-accent';
			case 'early_signup':
				return 'badge-info';
			case 'referral_reward':
				return 'badge-success';
			case 'internal':
				return 'badge-warning';
			default:
				return 'badge-ghost';
		}
	}

	const totalPages = $derived(Math.ceil(total / pageSize));
	const totalFreemium = $derived(Object.values(stats).reduce((a, b) => a + b, 0));
</script>

<svelte:head>
	<title>Freemium Users | Super Admin</title>
</svelte:head>

<div class="space-y-6">
	<!-- Header -->
	<div>
		<h1 class="text-2xl font-bold">Freemium Users</h1>
		<p class="text-base-content/60">Manage organisations with freemium access</p>
	</div>

	<!-- Stats -->
	<div class="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-7">
		<div class="rounded-lg bg-base-200 p-4">
			<div class="text-2xl font-bold">{totalFreemium}</div>
			<div class="text-sm text-base-content/60">Total</div>
		</div>
		{#each Object.entries(reasonLabels) as [key, label]}
			<div class="rounded-lg bg-base-200 p-4">
				<div class="text-2xl font-bold">{stats[key] || 0}</div>
				<div class="text-sm text-base-content/60">{label}</div>
			</div>
		{/each}
	</div>

	<!-- Filters -->
	<div class="flex flex-wrap items-center gap-4">
		<div class="join">
			<span class="btn btn-sm join-item btn-disabled">
				<Search class="h-4 w-4" />
			</span>
			<input
				type="text"
				placeholder="Search by name or email..."
				class="input input-sm input-bordered join-item w-64"
				bind:value={search}
				oninput={handleSearchInput}
			/>
		</div>

		<select
			class="select select-bordered select-sm"
			bind:value={reasonFilter}
			onchange={handleFilterChange}
		>
			<option value="">All Reasons</option>
			{#each Object.entries(reasonLabels) as [key, label]}
				<option value={key}>{label}</option>
			{/each}
		</select>

		<button class="btn btn-ghost btn-sm" onclick={loadOrganisations}>
			<RotateCcw class="h-4 w-4" />
			Refresh
		</button>
	</div>

	<!-- Table -->
	{#if loading}
		<div class="flex justify-center py-12">
			<span class="loading loading-spinner loading-lg"></span>
		</div>
	{:else if error}
		<div class="alert alert-error">
			<span>{error}</span>
		</div>
	{:else if organisations.length === 0}
		<div class="rounded-lg bg-base-200 p-12 text-center">
			<Gift class="mx-auto h-12 w-12 text-base-content/30" />
			<h3 class="mt-4 text-lg font-medium">No freemium organisations</h3>
			<p class="text-base-content/60">Organisations with freemium status will appear here.</p>
		</div>
	{:else}
		<div class="overflow-x-auto rounded-lg border border-base-300">
			<table class="table">
				<thead>
					<tr>
						<th>Organisation</th>
						<th>Owner</th>
						<th>Reason</th>
						<th>Granted</th>
						<th>Expires</th>
						<th>Actions</th>
					</tr>
				</thead>
				<tbody>
					{#each organisations as organisation}
						<tr class="hover">
							<td>
								<div class="flex items-center gap-3">
									<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
										<Building2 class="h-5 w-5 text-primary" />
									</div>
									<div>
										<div class="font-medium">{organisation.name}</div>
										<div class="text-sm text-base-content/50">{organisation.slug}</div>
									</div>
								</div>
							</td>
							<td class="text-sm">{organisation.ownerEmail || '-'}</td>
							<td>
								<span class="badge {getReasonBadgeClass(organisation.freemiumReason)}">
									{reasonLabels[organisation.freemiumReason || ''] || organisation.freemiumReason || 'Unknown'}
								</span>
							</td>
							<td class="text-sm text-base-content/70">
								{formatDate(organisation.freemiumGrantedAt)}
							</td>
							<td class="text-sm text-base-content/70">
								{formatDateOrExpiry(organisation.freemiumExpiresAt)}
							</td>
							<td>
								<div class="flex gap-2">
									<button
										class="btn btn-ghost btn-xs"
										onclick={() => goto(`/super-admin/organisations/${organisation.id}`)}
										title="View organisation"
									>
										<ExternalLink class="h-3 w-3" />
									</button>
									<button
										class="btn btn-ghost btn-xs"
										onclick={() => openExpiryModal(organisation)}
										title="Edit expiry"
									>
										<Calendar class="h-3 w-3" />
									</button>
									<button
										class="btn btn-ghost btn-xs text-error"
										onclick={() => openRevokeModal(organisation)}
										title="Revoke freemium"
									>
										<XCircle class="h-3 w-3" />
									</button>
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<!-- Pagination -->
		{#if totalPages > 1}
			<div class="flex items-center justify-between">
				<div class="text-sm text-base-content/60">
					Showing {(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, total)} of {total}
				</div>
				<div class="join">
					<button
						class="btn btn-sm join-item"
						disabled={currentPage === 1}
						onclick={() => {
							currentPage--;
							loadOrganisations();
						}}
					>
						Previous
					</button>
					<button class="btn btn-sm join-item btn-disabled">
						Page {currentPage} of {totalPages}
					</button>
					<button
						class="btn btn-sm join-item"
						disabled={currentPage === totalPages}
						onclick={() => {
							currentPage++;
							loadOrganisations();
						}}
					>
						Next
					</button>
				</div>
			</div>
		{/if}
	{/if}
</div>

<!-- Edit Expiry Modal -->
{#if showExpiryModal && selectedOrganisation}
	<div class="modal modal-open">
		<div class="modal-box">
			<h3 class="text-lg font-bold">Edit Freemium Expiry</h3>
			<p class="py-2 text-base-content/60">
				Set or remove expiry date for <strong>{selectedOrganisation.name}</strong>
			</p>

			<div class="form-control mt-4">
				<label class="label">
					<span class="label-text">Expiry Date</span>
				</label>
				<input
					type="date"
					class="input input-bordered"
					bind:value={newExpiryDate}
				/>
				<label class="label">
					<span class="label-text-alt text-base-content/50">
						Leave empty for no expiry (permanent freemium)
					</span>
				</label>
			</div>

			<div class="modal-action">
				<button class="btn" onclick={() => (showExpiryModal = false)}>Cancel</button>
				<button class="btn btn-primary" onclick={handleUpdateExpiry} disabled={updatingExpiry}>
					{#if updatingExpiry}
						<span class="loading loading-spinner loading-sm"></span>
					{/if}
					Save
				</button>
			</div>
		</div>
		<div class="modal-backdrop" onclick={() => (showExpiryModal = false)}></div>
	</div>
{/if}
<!-- Revoke Freemium Confirmation Modal -->
{#if showRevokeModal && revokingOrganisation}
	<div class="modal modal-open">
		<div class="modal-box">
			<h3 class="text-lg font-bold">Revoke Freemium</h3>
			<p class="py-4">
				Are you sure you want to revoke freemium status from <strong>{revokingOrganisation.name}</strong>? They will be reverted to the free tier.
			</p>
			<div class="modal-action">
				<button class="btn btn-ghost" onclick={closeRevokeModal} disabled={isRevoking}>
					Cancel
				</button>
				<button class="btn btn-warning" onclick={handleRevoke} disabled={isRevoking}>
					{#if isRevoking}
						<span class="loading loading-spinner loading-sm"></span>
					{/if}
					Revoke Freemium
				</button>
			</div>
		</div>
		<div class="modal-backdrop" onclick={closeRevokeModal}></div>
	</div>
{/if}
