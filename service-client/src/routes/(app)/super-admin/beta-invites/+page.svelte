<script lang="ts">
	import { Search, Mail, RotateCcw, X, Plus, Send, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-svelte';
	import { getBetaInvites, createBetaInvite, revokeBetaInvite, resendBetaInvite } from '$lib/api/beta-invites.remote';
	import { formatDate, formatDateTime } from '$lib/utils/formatting';
	import { onMount } from 'svelte';
	import { getToast } from '$lib/ui/toast_store.svelte';

	const toast = getToast();

	interface BetaInvite {
		id: string;
		email: string;
		token: string;
		status: string;
		createdAt: Date;
		expiresAt: Date;
		usedAt: Date | null;
		usedByOrganisationId: string | null;
		notes: string | null;
		createdByEmail: string | null;
		isExpired: boolean;
	}

	interface Stats {
		pending: number;
		used: number;
		expired: number;
		revoked: number;
	}

	let invites = $state<BetaInvite[]>([]);
	let total = $state(0);
	let stats = $state<Stats>({ pending: 0, used: 0, expired: 0, revoked: 0 });
	let loading = $state(true);
	let error = $state<string | null>(null);

	// Filters
	let search = $state('');
	let statusFilter = $state<'pending' | 'used' | 'expired' | 'revoked' | ''>('');
	let currentPage = $state(1);
	const pageSize = 20;

	// Create invite modal
	let showCreateModal = $state(false);
	let newInviteEmail = $state('');
	let newInviteNotes = $state('');
	let creating = $state(false);

	// Revoke confirmation modal
	let showRevokeModal = $state(false);
	let revokingInvite = $state<{ id: string; email: string } | null>(null);
	let isRevoking = $state(false);

	let searchDebounce: ReturnType<typeof setTimeout>;

	async function loadInvites() {
		loading = true;
		error = null;
		try {
			const result = await getBetaInvites({
				search: search || undefined,
				status: statusFilter || undefined,
				limit: pageSize,
				offset: (currentPage - 1) * pageSize
			});
			invites = result.invites;
			total = result.total;
			stats = result.stats;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load invites';
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		loadInvites();
	});

	function handleSearchInput() {
		clearTimeout(searchDebounce);
		searchDebounce = setTimeout(() => {
			currentPage = 1;
			loadInvites();
		}, 300);
	}

	function handleFilterChange() {
		currentPage = 1;
		loadInvites();
	}

	async function handleCreateInvite() {
		if (!newInviteEmail.trim()) {
			toast.error('Error', 'Email is required');
			return;
		}

		creating = true;
		try {
			await createBetaInvite({
				email: newInviteEmail.trim(),
				notes: newInviteNotes.trim() || undefined
			});
			toast.success('Success', 'Invite created and email sent!');
			showCreateModal = false;
			newInviteEmail = '';
			newInviteNotes = '';
			loadInvites();
		} catch (e) {
			toast.error('Error', e instanceof Error ? e.message : 'Failed to create invite');
		} finally {
			creating = false;
		}
	}

	function openRevokeModal(inviteId: string, email: string) {
		revokingInvite = { id: inviteId, email };
		showRevokeModal = true;
	}

	function closeRevokeModal() {
		showRevokeModal = false;
		revokingInvite = null;
	}

	async function handleRevoke() {
		if (!revokingInvite) return;
		isRevoking = true;
		try {
			await revokeBetaInvite(revokingInvite.id);
			closeRevokeModal();
			toast.success('Success', 'Invite revoked');
			loadInvites();
		} catch (e) {
			toast.error('Error', e instanceof Error ? e.message : 'Failed to revoke invite');
		} finally {
			isRevoking = false;
		}
	}

	async function handleResend(inviteId: string) {
		try {
			await resendBetaInvite(inviteId);
			toast.success('Success', 'Invite email resent!');
		} catch (e) {
			toast.error('Error', e instanceof Error ? e.message : 'Failed to resend invite');
		}
	}

	// formatDate and formatDateTime imported from '$lib/utils/formatting'

	function getStatusBadgeClass(status: string, isExpired: boolean): string {
		if (status === 'pending' && isExpired) return 'badge-warning';
		switch (status) {
			case 'pending':
				return 'badge-info';
			case 'used':
				return 'badge-success';
			case 'expired':
				return 'badge-warning';
			case 'revoked':
				return 'badge-error';
			default:
				return 'badge-ghost';
		}
	}

	function getStatusIcon(status: string, isExpired: boolean) {
		if (status === 'pending' && isExpired) return AlertCircle;
		switch (status) {
			case 'pending':
				return Clock;
			case 'used':
				return CheckCircle;
			case 'expired':
				return AlertCircle;
			case 'revoked':
				return XCircle;
			default:
				return Clock;
		}
	}

	const totalPages = $derived(Math.ceil(total / pageSize));
</script>

<svelte:head>
	<title>Beta Invites | Super Admin</title>
</svelte:head>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-bold">Beta Invites</h1>
			<p class="text-base-content/60">Manage beta tester invitations</p>
		</div>
		<button class="btn btn-primary" onclick={() => (showCreateModal = true)}>
			<Plus class="h-4 w-4" />
			Create Invite
		</button>
	</div>

	<!-- Stats -->
	<div class="grid grid-cols-4 gap-4">
		<div class="rounded-lg bg-base-200 p-4">
			<div class="text-2xl font-bold text-info">{stats.pending}</div>
			<div class="text-sm text-base-content/60">Pending</div>
		</div>
		<div class="rounded-lg bg-base-200 p-4">
			<div class="text-2xl font-bold text-success">{stats.used}</div>
			<div class="text-sm text-base-content/60">Used</div>
		</div>
		<div class="rounded-lg bg-base-200 p-4">
			<div class="text-2xl font-bold text-warning">{stats.expired}</div>
			<div class="text-sm text-base-content/60">Expired</div>
		</div>
		<div class="rounded-lg bg-base-200 p-4">
			<div class="text-2xl font-bold text-error">{stats.revoked}</div>
			<div class="text-sm text-base-content/60">Revoked</div>
		</div>
	</div>

	<!-- Filters -->
	<div class="flex flex-wrap items-center gap-4">
		<div class="join">
			<span class="btn btn-sm join-item btn-disabled">
				<Search class="h-4 w-4" />
			</span>
			<input
				type="text"
				placeholder="Search by email..."
				class="input input-sm input-bordered join-item w-64"
				bind:value={search}
				oninput={handleSearchInput}
			/>
		</div>

		<select
			class="select select-bordered select-sm"
			bind:value={statusFilter}
			onchange={handleFilterChange}
		>
			<option value="">All Status</option>
			<option value="pending">Pending</option>
			<option value="used">Used</option>
			<option value="expired">Expired</option>
			<option value="revoked">Revoked</option>
		</select>

		<button class="btn btn-ghost btn-sm" onclick={loadInvites}>
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
	{:else if invites.length === 0}
		<div class="rounded-lg bg-base-200 p-12 text-center">
			<Mail class="mx-auto h-12 w-12 text-base-content/30" />
			<h3 class="mt-4 text-lg font-medium">No invites found</h3>
			<p class="text-base-content/60">Create your first beta invite to get started.</p>
		</div>
	{:else}
		<div class="overflow-x-auto rounded-lg border border-base-300">
			<table class="table">
				<thead>
					<tr>
						<th>Email</th>
						<th>Status</th>
						<th>Created</th>
						<th>Expires</th>
						<th>Notes</th>
						<th>Actions</th>
					</tr>
				</thead>
				<tbody>
					{#each invites as invite}
						{@const StatusIcon = getStatusIcon(invite.status, invite.isExpired)}
						<tr class="hover">
							<td>
								<div class="font-medium">{invite.email}</div>
								{#if invite.createdByEmail}
									<div class="text-xs text-base-content/50">
										by {invite.createdByEmail}
									</div>
								{/if}
							</td>
							<td>
								<span class="badge {getStatusBadgeClass(invite.status, invite.isExpired)} gap-1">
									<StatusIcon class="h-3 w-3" />
									{invite.isExpired && invite.status === 'pending' ? 'Expired' : invite.status}
								</span>
							</td>
							<td class="text-sm text-base-content/70">{formatDate(invite.createdAt)}</td>
							<td class="text-sm text-base-content/70">{formatDate(invite.expiresAt)}</td>
							<td class="max-w-xs truncate text-sm text-base-content/60">
								{invite.notes || '-'}
							</td>
							<td>
								{#if invite.status === 'pending' && !invite.isExpired}
									<div class="flex gap-2">
										<button
											class="btn btn-ghost btn-xs"
											onclick={() => handleResend(invite.id)}
											title="Resend email"
										>
											<Send class="h-3 w-3" />
										</button>
										<button
											class="btn btn-ghost btn-xs text-error"
											onclick={() => openRevokeModal(invite.id, invite.email)}
											title="Revoke invite"
										>
											<X class="h-3 w-3" />
										</button>
									</div>
								{:else if invite.status === 'used'}
									<span class="text-xs text-base-content/50">
										Used {invite.usedAt ? formatDateTime(invite.usedAt) : ''}
									</span>
								{:else}
									<span class="text-xs text-base-content/50">-</span>
								{/if}
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
							loadInvites();
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
							loadInvites();
						}}
					>
						Next
					</button>
				</div>
			</div>
		{/if}
	{/if}
</div>

<!-- Create Invite Modal -->
{#if showCreateModal}
	<div class="modal modal-open">
		<div class="modal-box">
			<h3 class="text-lg font-bold">Create Beta Invite</h3>
			<p class="py-2 text-base-content/60">
				Send an invite email to grant enterprise access during beta.
			</p>

			<div class="form-control mt-4">
				<label class="label">
					<span class="label-text">Email Address</span>
				</label>
				<input
					type="email"
					placeholder="beta@example.com"
					class="input input-bordered"
					bind:value={newInviteEmail}
				/>
			</div>

			<div class="form-control mt-4">
				<label class="label">
					<span class="label-text">Notes (optional)</span>
				</label>
				<textarea
					placeholder="Internal notes about this invite..."
					class="textarea textarea-bordered"
					bind:value={newInviteNotes}
				></textarea>
			</div>

			<div class="modal-action">
				<button class="btn" onclick={() => (showCreateModal = false)}>Cancel</button>
				<button class="btn btn-primary" onclick={handleCreateInvite} disabled={creating}>
					{#if creating}
						<span class="loading loading-spinner loading-sm"></span>
					{/if}
					Send Invite
				</button>
			</div>
		</div>
		<div class="modal-backdrop" onclick={() => (showCreateModal = false)}></div>
	</div>
{/if}

<!-- Revoke Confirmation Modal -->
{#if showRevokeModal && revokingInvite}
	<div class="modal modal-open">
		<div class="modal-box">
			<h3 class="text-lg font-bold">Revoke Invite</h3>
			<p class="py-4">
				Are you sure you want to revoke the invite for <strong>{revokingInvite.email}</strong>?
			</p>
			<div class="modal-action">
				<button class="btn btn-ghost" onclick={closeRevokeModal} disabled={isRevoking}>
					Cancel
				</button>
				<button class="btn btn-warning" onclick={handleRevoke} disabled={isRevoking}>
					{#if isRevoking}
						<span class="loading loading-spinner loading-sm"></span>
					{/if}
					Revoke
				</button>
			</div>
		</div>
		<div class="modal-backdrop" onclick={closeRevokeModal}></div>
	</div>
{/if}
