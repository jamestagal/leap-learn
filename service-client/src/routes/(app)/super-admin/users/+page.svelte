<script lang="ts">
	import {
		Search,
		ChevronLeft,
		ChevronRight,
		Users,
		Shield,
		ShieldOff,
		Building2,
		Ban,
		Trash2,
		UserMinus
	} from 'lucide-svelte';
	import {
		getUsers,
		getUserDetails,
		updateUserAccess,
		removeUserFromOrganisation,
		suspendUser,
		unsuspendUser,
		deleteUser
	} from '$lib/api/super-admin.remote';
	import { onMount } from 'svelte';
	import { formatDate } from '$lib/utils/formatting';
	import { getToast } from '$lib/ui/toast_store.svelte';

	const toast = getToast();

	interface User {
		id: string;
		email: string;
		access: number;
		created: Date;
		organisationCount: number;
		organisationName: string | null;
		primaryRole: string | null;
		isSuperAdmin: boolean;
		isSuspended: boolean;
	}

	interface UserDetails {
		user: {
			id: string;
			email: string;
			access: number;
			created: Date;
			isSuperAdmin: boolean;
			suspended: boolean;
			suspendedAt: Date | null;
			suspendedReason: string | null;
		};
		memberships: Array<{
			id: string;
			organisationId: string;
			role: string;
			status: string;
			createdAt: Date;
			organisationName: string;
			organisationSlug: string;
		}>;
	}

	let users = $state<User[]>([]);
	let total = $state(0);
	let loading = $state(true);
	let error = $state<string | null>(null);

	// Filters
	let search = $state('');
	let superAdminOnly = $state(false);
	let ownersOnly = $state(false);
	let currentPage = $state(1);
	const pageSize = 20;

	let searchDebounce: ReturnType<typeof setTimeout>;

	// Detail modal
	let showDetailModal = $state(false);
	let selectedUser = $state<UserDetails | null>(null);
	let loadingDetails = $state(false);
	let updating = $state(false);

	// Delete confirmation
	let showDeleteConfirm = $state(false);
	let deleteConfirmEmail = $state('');

	// Remove from organisation confirmation
	let showRemoveOrganisationConfirm = $state(false);
	let removingOrganisation = $state<{ organisationId: string; organisationName: string } | null>(null);
	let isRemovingFromOrganisation = $state(false);

	async function loadUsers() {
		loading = true;
		error = null;
		try {
			const result = await getUsers({
				search: search || undefined,
				superAdminOnly: superAdminOnly || undefined,
				ownersOnly: ownersOnly || undefined,
				limit: pageSize,
				offset: (currentPage - 1) * pageSize
			});
			users = result.users;
			total = result.total;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load users';
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		loadUsers();
	});

	function handleSearchInput() {
		clearTimeout(searchDebounce);
		searchDebounce = setTimeout(() => {
			currentPage = 1;
			loadUsers();
		}, 300);
	}

	function handleFilterChange() {
		currentPage = 1;
		loadUsers();
	}

	async function openUserDetails(userId: string) {
		loadingDetails = true;
		showDetailModal = true;
		try {
			selectedUser = await getUserDetails(userId);
		} catch (e) {
			toast.error('Error', 'Failed to load user details');
			showDetailModal = false;
		} finally {
			loadingDetails = false;
		}
	}

	async function handleToggleSuperAdmin() {
		if (!selectedUser) return;
		updating = true;
		try {
			const result = await updateUserAccess({
				userId: selectedUser.user.id,
				grantSuperAdmin: !selectedUser.user.isSuperAdmin,
				revokeSuperAdmin: selectedUser.user.isSuperAdmin
			});

			if (result.success) {
				toast.success(
					'Updated',
					selectedUser.user.isSuperAdmin ? 'Super admin access revoked' : 'Super admin access granted'
				);
				selectedUser = await getUserDetails(selectedUser.user.id);
				await loadUsers();
			} else {
				toast.error('Error', result.error || 'Failed to update user');
			}
		} catch (e) {
			toast.error('Error', e instanceof Error ? e.message : 'Failed to update user');
		} finally {
			updating = false;
		}
	}

	function openRemoveOrganisationModal(organisationId: string, organisationName: string) {
		removingOrganisation = { organisationId, organisationName };
		showRemoveOrganisationConfirm = true;
	}

	function closeRemoveOrganisationModal() {
		showRemoveOrganisationConfirm = false;
		removingOrganisation = null;
	}

	async function handleRemoveFromOrganisation() {
		if (!selectedUser || !removingOrganisation) return;
		isRemovingFromOrganisation = true;
		try {
			const result = await removeUserFromOrganisation({
				userId: selectedUser.user.id,
				organisationId: removingOrganisation.organisationId
			});

			if (result.success) {
				const name = removingOrganisation.organisationName;
				closeRemoveOrganisationModal();
				toast.success('Removed', `User removed from ${name}`);
				selectedUser = await getUserDetails(selectedUser.user.id);
				await loadUsers();
			} else {
				toast.error('Error', result.error || 'Failed to remove user');
			}
		} catch (e) {
			toast.error('Error', e instanceof Error ? e.message : 'Failed to remove user');
		} finally {
			isRemovingFromOrganisation = false;
		}
	}

	async function handleToggleSuspension() {
		if (!selectedUser) return;
		updating = true;
		try {
			let result;
			if (selectedUser.user.suspended) {
				result = await unsuspendUser(selectedUser.user.id);
			} else {
				result = await suspendUser({ userId: selectedUser.user.id });
			}

			if (result.success) {
				toast.success(
					'Updated',
					selectedUser.user.suspended ? 'User account restored' : 'User account suspended'
				);
				selectedUser = await getUserDetails(selectedUser.user.id);
				await loadUsers();
			} else {
				toast.error('Error', result.error || 'Failed to update user');
			}
		} catch (e) {
			toast.error('Error', e instanceof Error ? e.message : 'Failed to update user');
		} finally {
			updating = false;
		}
	}

	async function handleDeleteUser() {
		if (!selectedUser) return;
		if (deleteConfirmEmail !== selectedUser.user.email) {
			toast.error('Error', 'Email does not match');
			return;
		}

		updating = true;
		try {
			const result = await deleteUser(selectedUser.user.id);

			if (result.success) {
				toast.success('Deleted', 'User permanently deleted');
				showDeleteConfirm = false;
				showDetailModal = false;
				deleteConfirmEmail = '';
				await loadUsers();
			} else {
				toast.error('Error', result.error || 'Failed to delete user');
			}
		} catch (e) {
			toast.error('Error', e instanceof Error ? e.message : 'Failed to delete user');
		} finally {
			updating = false;
		}
	}

	// formatDate imported from '$lib/utils/formatting'

	function getRoleBadgeClass(role: string): string {
		switch (role) {
			case 'owner':
				return 'badge-primary';
			case 'admin':
				return 'badge-secondary';
			default:
				return 'badge-ghost';
		}
	}

	let totalPages = $derived(Math.ceil(total / pageSize));
</script>

<div>
	<div class="mb-6">
		<h1 class="text-2xl font-bold">Users</h1>
		<p class="text-base-content/70">Manage all users on the platform</p>
	</div>

	<!-- Filters -->
	<div class="mb-6 space-y-3">
		<!-- Search - full width -->
		<div class="relative">
			<Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-base-content/40" />
			<input
				type="text"
				placeholder="Search by email..."
				class="input input-bordered w-full pl-10"
				bind:value={search}
				oninput={handleSearchInput}
			/>
		</div>

		<!-- Filter checkboxes -->
		<div class="flex flex-wrap gap-4">
			<label class="label cursor-pointer justify-start gap-2">
				<input
					type="checkbox"
					class="checkbox checkbox-sm checkbox-error"
					bind:checked={superAdminOnly}
					onchange={handleFilterChange}
				/>
				<span class="label-text">Super admins only</span>
			</label>
			<label class="label cursor-pointer justify-start gap-2">
				<input
					type="checkbox"
					class="checkbox checkbox-sm checkbox-primary"
					bind:checked={ownersOnly}
					onchange={handleFilterChange}
				/>
				<span class="label-text">Owners only</span>
			</label>
		</div>
	</div>

	{#if loading}
		<div class="flex items-center justify-center py-12">
			<span class="loading loading-spinner loading-lg"></span>
		</div>
	{:else if error}
		<div class="alert alert-error">
			<span>{error}</span>
		</div>
	{:else if users.length === 0}
		<div class="text-center py-12">
			<Users class="mx-auto h-12 w-12 text-base-content/30" />
			<h3 class="mt-4 text-lg font-medium">No users found</h3>
			<p class="text-base-content/60">Try adjusting your search</p>
		</div>
	{:else}
		<!-- Mobile: Card Layout -->
		<div class="space-y-3 lg:hidden">
			{#each users as user (user.id)}
				<button
					class="w-full text-left rounded-lg border border-base-300 p-4 hover:bg-base-200/50 transition-colors"
					onclick={() => openUserDetails(user.id)}
				>
					<div class="flex items-start justify-between gap-3">
						<div class="min-w-0 flex-1">
							<p class="font-medium text-sm truncate">{user.email}</p>
							{#if user.organisationName}
								<p class="text-xs text-base-content/60 mt-1">
									{user.organisationName}
									{#if user.organisationCount > 1}
										<span class="text-base-content/40">+{user.organisationCount - 1}</span>
									{/if}
								</p>
							{:else}
								<p class="text-xs text-base-content/40 mt-1">No organisation</p>
							{/if}
						</div>
						<div class="flex flex-col items-end gap-1 shrink-0">
							{#if user.isSuspended}
								<span class="badge badge-warning badge-sm gap-1">
									<Ban class="h-3 w-3" />
									Suspended
								</span>
							{/if}
							{#if user.isSuperAdmin}
								<span class="badge badge-error badge-sm gap-1">
									<Shield class="h-3 w-3" />
									Admin
								</span>
							{/if}
							{#if user.primaryRole === 'owner'}
								<span class="badge badge-primary badge-sm">Owner</span>
							{:else if user.primaryRole === 'admin'}
								<span class="badge badge-secondary badge-sm">Admin</span>
							{:else if user.primaryRole === 'member'}
								<span class="badge badge-ghost badge-sm">Member</span>
							{/if}
						</div>
					</div>
					<div class="mt-2 text-xs text-base-content/60">
						Created {formatDate(user.created)}
					</div>
				</button>
			{/each}
		</div>

		<!-- Desktop: Table Layout -->
		<div class="hidden lg:block overflow-x-auto rounded-lg border border-base-300">
			<table class="table">
				<thead class="bg-base-200">
					<tr>
						<th>Email</th>
						<th>Organisation</th>
						<th>Account Type</th>
						<th>Status</th>
						<th>Created</th>
						<th></th>
					</tr>
				</thead>
				<tbody>
					{#each users as user (user.id)}
						<tr class="hover:bg-base-200/50">
							<td>{user.email}</td>
							<td>
								{#if user.organisationName}
									<div>
										<span class="font-medium">{user.organisationName}</span>
										{#if user.organisationCount > 1}
											<span class="text-base-content/50 text-xs ml-1">+{user.organisationCount - 1}</span>
										{/if}
									</div>
								{:else}
									<span class="text-base-content/40">-</span>
								{/if}
							</td>
							<td>
								<div class="flex flex-wrap gap-1">
									{#if user.isSuperAdmin}
										<span class="badge badge-error badge-sm gap-1">
											<Shield class="h-3 w-3" />
											Super Admin
										</span>
									{/if}
									{#if user.primaryRole === 'owner'}
										<span class="badge badge-primary badge-sm">Owner</span>
									{:else if user.primaryRole === 'admin'}
										<span class="badge badge-secondary badge-sm">Admin</span>
									{:else if user.primaryRole === 'member'}
										<span class="badge badge-ghost badge-sm">Member</span>
									{:else if !user.isSuperAdmin}
										<span class="text-base-content/40">-</span>
									{/if}
								</div>
							</td>
							<td>
								{#if user.isSuspended}
									<span class="badge badge-warning badge-sm gap-1">
										<Ban class="h-3 w-3" />
										Suspended
									</span>
								{:else}
									<span class="text-success text-sm">Active</span>
								{/if}
							</td>
							<td class="text-sm text-base-content/60">{formatDate(user.created)}</td>
							<td>
								<button class="btn btn-ghost btn-xs" onclick={() => openUserDetails(user.id)}>
									View
								</button>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<!-- Pagination -->
		{#if totalPages > 1}
			<div class="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
				<p class="text-sm text-base-content/60">
					Showing {(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, total)} of {total}
				</p>
				<div class="flex items-center gap-2">
					<button
						class="btn btn-ghost btn-sm"
						disabled={currentPage === 1}
						onclick={() => {
							currentPage--;
							loadUsers();
						}}
					>
						<ChevronLeft class="h-4 w-4" />
						<span class="hidden sm:inline">Previous</span>
					</button>
					<span class="text-sm">
						{currentPage} / {totalPages}
					</span>
					<button
						class="btn btn-ghost btn-sm"
						disabled={currentPage === totalPages}
						onclick={() => {
							currentPage++;
							loadUsers();
						}}
					>
						<span class="hidden sm:inline">Next</span>
						<ChevronRight class="h-4 w-4" />
					</button>
				</div>
			</div>
		{/if}
	{/if}
</div>

<!-- User Detail Modal -->
{#if showDetailModal}
	<div class="modal modal-open">
		<div class="modal-box max-w-2xl">
			{#if loadingDetails}
				<div class="flex items-center justify-center py-8">
					<span class="loading loading-spinner loading-lg"></span>
				</div>
			{:else if selectedUser}
				<h3 class="text-lg font-bold">User Details</h3>

				<div class="mt-4 space-y-4">
					<!-- Email and badges -->
					<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
						<div class="min-w-0">
							<p class="text-sm text-base-content/60">Email</p>
							<p class="font-medium break-all">{selectedUser.user.email}</p>
						</div>
						<div class="flex flex-wrap gap-1 shrink-0 self-start sm:self-center">
							{#if selectedUser.user.suspended}
								<span class="badge badge-warning gap-1">
									<Ban class="h-3 w-3" />
									Suspended
								</span>
							{/if}
							{#if selectedUser.user.isSuperAdmin}
								<span class="badge badge-error gap-1">
									<Shield class="h-3 w-3" />
									Super Admin
								</span>
							{/if}
						</div>
					</div>

					<div>
						<p class="text-sm text-base-content/60">Account Created</p>
						<p>{formatDate(selectedUser.user.created)}</p>
					</div>

					{#if selectedUser.user.suspended && selectedUser.user.suspendedAt}
						<div class="alert alert-warning">
							<Ban class="h-4 w-4" />
							<div>
								<p class="font-medium">Account suspended on {formatDate(selectedUser.user.suspendedAt)}</p>
								{#if selectedUser.user.suspendedReason}
									<p class="text-sm">Reason: {selectedUser.user.suspendedReason}</p>
								{/if}
							</div>
						</div>
					{/if}

					<div class="divider"></div>

					<!-- Organisation Memberships -->
					<div>
						<h4 class="font-medium flex items-center gap-2">
							<Building2 class="h-4 w-4" />
							Organisation Memberships ({selectedUser.memberships.length})
						</h4>
						{#if selectedUser.memberships.length > 0}
							<div class="mt-2 space-y-2">
								{#each selectedUser.memberships as membership (membership.id)}
									<div
										class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-lg border border-base-300 p-3"
									>
										<div class="min-w-0">
											<a
												href="/super-admin/organisations/{membership.organisationId}"
												class="font-medium hover:text-primary"
											>
												{membership.organisationName}
											</a>
											<p class="text-sm text-base-content/60">/{membership.organisationSlug}</p>
										</div>
										<div class="flex items-center gap-2 shrink-0 self-start sm:self-center">
											<span
												class="badge {getRoleBadgeClass(membership.role)} badge-sm capitalize"
											>
												{membership.role}
											</span>
											<button
												class="btn btn-ghost btn-xs text-error"
												onclick={() =>
													openRemoveOrganisationModal(membership.organisationId, membership.organisationName)}
												disabled={updating}
												title="Remove from organisation"
											>
												<UserMinus class="h-4 w-4" />
											</button>
										</div>
									</div>
								{/each}
							</div>
						{:else}
							<p class="mt-2 text-base-content/60">No organisation memberships</p>
						{/if}
					</div>

					<div class="divider"></div>

					<!-- Admin Actions -->
					<div class="space-y-4">
						<h4 class="font-medium">Admin Actions</h4>

						<!-- Super Admin Access -->
						<div class="rounded-lg border border-base-300 p-4">
							<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
								<div>
									<p class="font-medium">Super Admin Access</p>
									<p class="text-sm text-base-content/60">
										Grant full platform access including all organisations and users.
									</p>
								</div>
								<button
									class="btn btn-sm {selectedUser.user.isSuperAdmin ? 'btn-warning' : 'btn-outline'} gap-2 shrink-0"
									onclick={handleToggleSuperAdmin}
									disabled={updating}
								>
									{#if updating}
										<span class="loading loading-spinner loading-sm"></span>
									{:else if selectedUser.user.isSuperAdmin}
										<ShieldOff class="h-4 w-4" />
										Revoke
									{:else}
										<Shield class="h-4 w-4" />
										Grant
									{/if}
								</button>
							</div>
						</div>

						<!-- Suspend User -->
						<div class="rounded-lg border border-base-300 p-4">
							<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
								<div>
									<p class="font-medium">Account Suspension</p>
									<p class="text-sm text-base-content/60">
										{#if selectedUser.user.suspended}
											Restore login access. User data remains intact.
										{:else}
											Temporarily block login. All user data is preserved.
										{/if}
									</p>
								</div>
								<button
									class="btn btn-sm {selectedUser.user.suspended ? 'btn-success' : 'btn-warning'} gap-2 shrink-0"
									onclick={handleToggleSuspension}
									disabled={updating}
								>
									{#if updating}
										<span class="loading loading-spinner loading-sm"></span>
									{:else if selectedUser.user.suspended}
										Restore
									{:else}
										<Ban class="h-4 w-4" />
										Suspend
									{/if}
								</button>
							</div>
						</div>

						<!-- Delete User -->
						<div class="rounded-lg border border-error/30 bg-error/5 p-4">
							<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
								<div>
									<p class="font-medium text-error">Delete User</p>
									<p class="text-sm text-base-content/60">
										Permanently remove account and all memberships. Cannot be undone.
									</p>
								</div>
								<button
									class="btn btn-sm btn-error btn-outline gap-2 shrink-0"
									onclick={() => (showDeleteConfirm = true)}
									disabled={updating}
								>
									<Trash2 class="h-4 w-4" />
									Delete
								</button>
							</div>
						</div>
					</div>
				</div>

				<div class="modal-action">
					<button class="btn btn-ghost" onclick={() => (showDetailModal = false)}>Close</button>
				</div>
			{/if}
		</div>
		<button
			type="button"
			class="modal-backdrop bg-black/50"
			onclick={() => (showDetailModal = false)}
			aria-label="Close modal"
		></button>
	</div>
{/if}

<!-- Delete Confirmation Modal -->
{#if showDeleteConfirm && selectedUser}
	<div class="modal modal-open" style="z-index: 60;">
		<div class="modal-box">
			<h3 class="text-lg font-bold text-error">Delete User Account</h3>
			<div class="py-4">
				<p class="text-base-content/80">
					This will permanently delete the user account and remove them from all organisations. This
					action cannot be undone.
				</p>
				<div class="mt-4">
					<label class="label">
						<span class="label-text">Type the user's email to confirm:</span>
					</label>
					<p class="text-sm font-mono bg-base-200 p-2 rounded mb-2">{selectedUser.user.email}</p>
					<input
						type="text"
						class="input input-bordered w-full"
						placeholder="Enter email to confirm"
						bind:value={deleteConfirmEmail}
					/>
				</div>
			</div>
			<div class="modal-action">
				<button
					class="btn btn-ghost"
					onclick={() => {
						showDeleteConfirm = false;
						deleteConfirmEmail = '';
					}}
				>
					Cancel
				</button>
				<button
					class="btn btn-error"
					onclick={handleDeleteUser}
					disabled={updating || deleteConfirmEmail !== selectedUser.user.email}
				>
					{#if updating}
						<span class="loading loading-spinner loading-sm"></span>
					{:else}
						Delete User
					{/if}
				</button>
			</div>
		</div>
		<button
			type="button"
			class="modal-backdrop bg-black/50"
			onclick={() => {
				showDeleteConfirm = false;
				deleteConfirmEmail = '';
			}}
			aria-label="Close modal"
		></button>
	</div>
{/if}
<!-- Remove from Organisation Confirmation Modal -->
{#if showRemoveOrganisationConfirm && removingOrganisation}
	<div class="modal modal-open" style="z-index: 60;">
		<div class="modal-box">
			<h3 class="text-lg font-bold">Remove from Organisation</h3>
			<p class="py-4">
				Are you sure you want to remove this user from <strong>{removingOrganisation.organisationName}</strong>?
			</p>
			<div class="modal-action">
				<button class="btn btn-ghost" onclick={closeRemoveOrganisationModal} disabled={isRemovingFromOrganisation}>
					Cancel
				</button>
				<button class="btn btn-error" onclick={handleRemoveFromOrganisation} disabled={isRemovingFromOrganisation}>
					{#if isRemovingFromOrganisation}
						<span class="loading loading-spinner loading-sm"></span>
					{/if}
					Remove
				</button>
			</div>
		</div>
		<button
			type="button"
			class="modal-backdrop bg-black/50"
			onclick={closeRemoveOrganisationModal}
			aria-label="Close modal"
		></button>
	</div>
{/if}
