<script lang="ts">
	import { Users, UserPlus, MoreVertical, UserCog, Trash2, Pencil, Mail, X } from 'lucide-svelte';
	import { getToast } from '$lib/ui/toast_store.svelte';
	import Modal from '$lib/components/shared/Modal.svelte';

	const toast = getToast();
	import InviteMember from '$lib/components/settings/InviteMember.svelte';
	import {
		updateMemberRole,
		removeMember,
		updateMyDisplayName,
		updateMemberDisplayName,
		cancelInvitation,
		resendInvitation
	} from '$lib/api/organisation.remote';
	import { invalidate } from '$app/navigation';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let organisation = $derived(data.organisation);
	let currentUserRole = $derived(data.membership.role);
	let currentMembershipId = $derived(data.membership.id);
	let members = $derived(data.members || []);

	// Modal states
	let showInviteModal = $state(false);
	let showRoleModal = $state(false);
	let showNameModal = $state(false);
	let selectedMember = $state<(typeof members)[0] | null>(null);
	let newRole = $state<'admin' | 'member'>('member');
	let editingDisplayName = $state('');
	let isUpdating = $state(false);

	// Generic confirm modal state
	let confirmModal = $state<{
		title: string;
		message: string;
		actionLabel: string;
		actionClass: string;
		onConfirm: () => Promise<void>;
	} | null>(null);
	let isConfirming = $state(false);

	function closeConfirmModal() {
		confirmModal = null;
	}

	async function handleConfirmAction() {
		if (!confirmModal) return;
		isConfirming = true;
		try {
			await confirmModal.onConfirm();
			closeConfirmModal();
		} catch {
			// Error handling is done inside the onConfirm callback
		} finally {
			isConfirming = false;
		}
	}

	// Check if current user can manage a member
	function canManageMember(member: (typeof members)[0]) {
		if (currentUserRole === 'owner') return true;
		if (currentUserRole === 'admin' && member.role === 'member') return true;
		return false;
	}

	// Check if current user can change roles (only owner)
	function canChangeRole() {
		return currentUserRole === 'owner';
	}

	// Open role change modal
	function openRoleModal(member: (typeof members)[0]) {
		selectedMember = member;
		newRole = member.role === 'owner' ? 'admin' : (member.role as 'admin' | 'member');
		showRoleModal = true;
	}

	// Update member role
	async function handleUpdateRole() {
		if (!selectedMember || !newRole) return;

		isUpdating = true;
		try {
			await updateMemberRole({
				membershipId: selectedMember.id,
				role: newRole
			});

			toast.success('Role updated successfully');
			showRoleModal = false;
			selectedMember = null;

			await invalidate('load:members');
		} catch (error) {
			toast.error((error as Error).message || 'Failed to update role');
		} finally {
			isUpdating = false;
		}
	}

	// Remove member from organisation
	function handleRemoveMember(member: (typeof members)[0]) {
		confirmModal = {
			title: 'Remove Member',
			message: `Remove ${member.displayName || member.userEmail} from ${organisation.name}?`,
			actionLabel: 'Remove',
			actionClass: 'btn-error',
			onConfirm: async () => {
				try {
					await removeMember(member.id);
					toast.success('Member removed');
					await invalidate('load:members');
				} catch (error) {
					toast.error((error as Error).message || 'Failed to remove member');
					throw error;
				}
			}
		};
	}

	// Handle successful invite
	async function handleInviteSuccess() {
		showInviteModal = false;
		await invalidate('load:members');
	}

	// Check if member is current user
	function isCurrentUser(member: (typeof members)[0]) {
		return member.id === currentMembershipId;
	}

	// Track member being edited for name modal
	let editingMember = $state<(typeof members)[0] | null>(null);

	// Open name edit modal for any member
	function openNameModal(member: (typeof members)[0]) {
		editingMember = member;
		editingDisplayName = member.displayName || '';
		showNameModal = true;
	}

	// Check if current user can edit a member's display name
	function canEditDisplayName(member: (typeof members)[0]) {
		// Can always edit your own name
		if (isCurrentUser(member)) return true;
		// Owners/admins can edit other members (except other owners)
		if ((currentUserRole === 'owner' || currentUserRole === 'admin') && member.role !== 'owner') {
			return true;
		}
		return false;
	}

	// Update display name (self or other member)
	async function handleUpdateDisplayName() {
		if (!editingDisplayName.trim()) {
			toast.error('Please enter a display name');
			return;
		}

		isUpdating = true;
		try {
			if (editingMember && isCurrentUser(editingMember)) {
				// Editing own name
				await updateMyDisplayName({ displayName: editingDisplayName.trim() });
			} else if (editingMember) {
				// Editing another member's name
				await updateMemberDisplayName({
					membershipId: editingMember.id,
					displayName: editingDisplayName.trim()
				});
			}
			toast.success('Display name updated');
			showNameModal = false;
			editingMember = null;
			await invalidate('load:members');
		} catch (error) {
			toast.error((error as Error).message || 'Failed to update display name');
		} finally {
			isUpdating = false;
		}
	}

	// Get role badge classes
	function getRoleBadgeClass(role: string) {
		switch (role) {
			case 'owner':
				return 'badge-primary';
			case 'admin':
				return 'badge-secondary';
			default:
				return 'badge-ghost';
		}
	}

	// Check if member is pending (hasn't logged in yet)
	function isPending(member: (typeof members)[0]) {
		return member.acceptedAt === null;
	}

	// Handle resend invitation
	async function handleResendInvitation(member: (typeof members)[0]) {
		try {
			await resendInvitation(member.id);
			toast.success(`Invitation resent to ${member.userEmail}`);
		} catch (error) {
			toast.error((error as Error).message || 'Failed to resend invitation');
		}
	}

	// Handle cancel invitation
	function handleCancelInvitation(member: (typeof members)[0]) {
		confirmModal = {
			title: 'Cancel Invitation',
			message: `Cancel invitation for ${member.userEmail}? This will remove them from the organisation.`,
			actionLabel: 'Cancel Invitation',
			actionClass: 'btn-warning',
			onConfirm: async () => {
				try {
					await cancelInvitation(member.id);
					toast.success('Invitation cancelled');
					await invalidate('load:members');
				} catch (error) {
					toast.error((error as Error).message || 'Failed to cancel invitation');
					throw error;
				}
			}
		};
	}
</script>

<div class="space-y-6">
	<!-- Page Header -->
	<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
		<div>
			<h1 class="text-2xl font-bold">Team Members</h1>
			<p class="text-base-content/70 mt-1">
				Manage who has access to {organisation.name}
			</p>
		</div>
		{#if currentUserRole === 'owner' || currentUserRole === 'admin'}
			<button class="btn btn-primary" onclick={() => (showInviteModal = true)}>
				<UserPlus class="h-4 w-4" />
				Invite Member
			</button>
		{/if}
	</div>

	<!-- Members List -->
	{#if members.length === 0}
		<div class="card bg-base-100 border border-base-300">
			<div class="card-body items-center text-center py-12">
				<div
					class="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary mb-4"
				>
					<Users class="h-8 w-8" />
				</div>
				<h3 class="text-lg font-semibold">No Team Members Yet</h3>
				<p class="text-base-content/60 max-w-sm">
					Invite team members to collaborate on consultations, proposals, and more.
				</p>
			</div>
		</div>
	{:else}
		<!-- Desktop Table View -->
		<div class="card bg-base-100 border border-base-300 hidden sm:block overflow-visible">
			<div class="overflow-visible">
				<table class="table">
					<thead>
						<tr>
							<th>Member</th>
							<th>Email</th>
							<th>Role</th>
							<th>Status</th>
							<th class="text-right">Actions</th>
						</tr>
					</thead>
					<tbody>
						{#each members as member}
							<tr class="hover:bg-base-200/50">
								<td>
									<div class="flex items-center gap-3">
										<div class="avatar placeholder">
											<div
												class="bg-primary/10 text-primary w-10 h-10 rounded-full flex items-center justify-center"
											>
												{#if member.userAvatar}
													<img
														src={member.userAvatar}
														alt={member.displayName || member.userEmail}
													/>
												{:else}
													<span class="text-sm">
														{(member.displayName || member.userEmail || '?').charAt(0).toUpperCase()}
													</span>
												{/if}
											</div>
										</div>
										<div class="flex items-center gap-2">
											<span class="font-medium">
												{member.displayName || 'Unnamed'}
											</span>
											{#if canEditDisplayName(member)}
												<button
													class="btn btn-ghost btn-xs btn-square"
													onclick={() => openNameModal(member)}
													title="Edit display name"
												>
													<Pencil class="h-3 w-3" />
												</button>
											{/if}
											{#if isCurrentUser(member)}
												<span class="badge badge-outline badge-xs">You</span>
											{/if}
										</div>
									</div>
								</td>
								<td class="text-base-content/70">
									{member.userEmail}
								</td>
								<td>
									<span class="badge {getRoleBadgeClass(member.role)} capitalize">
										{member.role}
									</span>
								</td>
								<td>
									{#if isPending(member)}
										<span class="badge badge-warning badge-sm">Pending</span>
									{:else}
										<span class="badge badge-success badge-sm">Active</span>
									{/if}
								</td>
								<td class="text-right">
									{#if canManageMember(member) && member.role !== 'owner'}
										{#if isPending(member)}
											<!-- Pending member actions: Resend and Cancel -->
											<div class="flex items-center justify-end gap-1">
												<button
													class="btn btn-ghost btn-sm btn-square"
													onclick={() => handleResendInvitation(member)}
													title="Resend invitation"
												>
													<Mail class="h-4 w-4" />
												</button>
												<button
													class="btn btn-ghost btn-sm btn-square text-error"
													onclick={() => handleCancelInvitation(member)}
													title="Cancel invitation"
												>
													<X class="h-4 w-4" />
												</button>
											</div>
										{:else}
											<!-- Active member actions: Role change and Remove -->
											<div class="dropdown dropdown-end">
												<div tabindex="0" role="button" class="btn btn-ghost btn-sm btn-square">
													<MoreVertical class="h-4 w-4" />
												</div>
												<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
												<ul
													tabindex="0"
													class="dropdown-content menu bg-base-100 rounded-box z-50 w-52 p-2 shadow-lg border border-base-300"
												>
													{#if canChangeRole()}
														<li>
															<button onclick={() => openRoleModal(member)}>
																<UserCog class="h-4 w-4" />
																Change Role
															</button>
														</li>
													{/if}
													<li>
														<button
															class="text-error"
															onclick={() => handleRemoveMember(member)}
														>
															<Trash2 class="h-4 w-4" />
															Remove
														</button>
													</li>
												</ul>
											</div>
										{/if}
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>

		<!-- Mobile Card View -->
		<div class="space-y-3 sm:hidden">
			{#each members as member}
				<div class="card bg-base-100 border border-base-300">
					<div class="card-body p-4">
						<div class="flex items-start gap-3">
							<!-- Avatar -->
							<div class="avatar placeholder">
								<div
									class="bg-primary/10 text-primary w-12 h-12 rounded-full flex items-center justify-center"
								>
									{#if member.userAvatar}
										<img
											src={member.userAvatar}
											alt={member.displayName || member.userEmail}
										/>
									{:else}
										<span class="text-base">
											{(member.displayName || member.userEmail || '?').charAt(0).toUpperCase()}
										</span>
									{/if}
								</div>
							</div>

							<!-- Member Info -->
							<div class="flex-1 min-w-0">
								<div class="flex items-center gap-2 flex-wrap">
									<span class="font-semibold">
										{member.displayName || 'Unnamed'}
									</span>
									{#if canEditDisplayName(member)}
										<button
											class="btn btn-ghost btn-xs btn-square"
											onclick={() => openNameModal(member)}
											title="Edit display name"
										>
											<Pencil class="h-3 w-3" />
										</button>
									{/if}
									{#if isCurrentUser(member)}
										<span class="badge badge-outline badge-xs">You</span>
									{/if}
								</div>
								<p class="text-sm text-base-content/60 truncate">{member.userEmail}</p>
								<div class="flex items-center gap-2 mt-2">
									<span class="badge {getRoleBadgeClass(member.role)} badge-sm capitalize">
										{member.role}
									</span>
									{#if isPending(member)}
										<span class="badge badge-warning badge-sm">Pending</span>
									{:else}
										<span class="badge badge-success badge-sm">Active</span>
									{/if}
								</div>
							</div>

							<!-- Actions -->
							{#if canManageMember(member) && member.role !== 'owner'}
								{#if isPending(member)}
									<!-- Pending member actions for mobile -->
									<div class="flex flex-col gap-1">
										<button
											class="btn btn-ghost btn-sm btn-square"
											onclick={() => handleResendInvitation(member)}
											title="Resend invitation"
										>
											<Mail class="h-4 w-4" />
										</button>
										<button
											class="btn btn-ghost btn-sm btn-square text-error"
											onclick={() => handleCancelInvitation(member)}
											title="Cancel invitation"
										>
											<X class="h-4 w-4" />
										</button>
									</div>
								{:else}
									<div class="dropdown dropdown-end">
										<div tabindex="0" role="button" class="btn btn-ghost btn-sm btn-square">
											<MoreVertical class="h-4 w-4" />
										</div>
										<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
										<ul
											tabindex="0"
											class="dropdown-content menu bg-base-100 rounded-box z-50 w-52 p-2 shadow-lg border border-base-300"
										>
											{#if canChangeRole()}
												<li>
													<button onclick={() => openRoleModal(member)}>
														<UserCog class="h-4 w-4" />
														Change Role
													</button>
												</li>
											{/if}
											<li>
												<button
													class="text-error"
													onclick={() => handleRemoveMember(member)}
												>
													<Trash2 class="h-4 w-4" />
													Remove
												</button>
											</li>
										</ul>
									</div>
								{/if}
							{/if}
						</div>
					</div>
				</div>
			{/each}
		</div>
	{/if}

	<!-- Member count -->
	<div class="text-sm text-base-content/50">
		{members.length} member{members.length !== 1 ? 's' : ''} in this organisation
	</div>
</div>

<!-- Invite Member Modal -->
<InviteMember organisation={organisation} bind:showModal={showInviteModal} onInvite={handleInviteSuccess} />

<!-- Role Change Modal -->
<Modal bind:isOpen={showRoleModal} title="Change Member Role" maxWidth="max-w-md">
	{#snippet children()}
		{#if selectedMember}
			<div class="p-6 space-y-4">
				<p class="text-base-content/70">
					Change role for <strong>{selectedMember.displayName || selectedMember.userEmail}</strong>
				</p>

				<div class="form-control">
					<label class="label">
						<span class="label-text">Select Role</span>
					</label>
					<div class="space-y-2">
						<label
							class="flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors hover:bg-base-200 {newRole ===
							'member'
								? 'bg-primary/5 border-primary'
								: 'border-base-300'}"
						>
							<input
								type="radio"
								name="role"
								value="member"
								bind:group={newRole}
								disabled={isUpdating}
								class="radio radio-primary mt-0.5"
							/>
							<div class="flex-1">
								<div class="font-medium">Member</div>
								<div class="text-base-content/60 text-sm">
									Can create and manage their own consultations and proposals
								</div>
							</div>
						</label>
						<label
							class="flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors hover:bg-base-200 {newRole ===
							'admin'
								? 'bg-primary/5 border-primary'
								: 'border-base-300'}"
						>
							<input
								type="radio"
								name="role"
								value="admin"
								bind:group={newRole}
								disabled={isUpdating}
								class="radio radio-primary mt-0.5"
							/>
							<div class="flex-1">
								<div class="font-medium">Admin</div>
								<div class="text-base-content/60 text-sm">
									Can manage all organisation work and invite new members
								</div>
							</div>
						</label>
					</div>
				</div>

				<div class="flex justify-end gap-3 pt-4">
					<button class="btn" onclick={() => (showRoleModal = false)} disabled={isUpdating}>
						Cancel
					</button>
					<button class="btn btn-primary" onclick={handleUpdateRole} disabled={isUpdating}>
						{#if isUpdating}
							<span class="loading loading-spinner loading-sm"></span>
						{/if}
						Update Role
					</button>
				</div>
			</div>
		{/if}
	{/snippet}
</Modal>

<!-- Confirm Action Modal -->
{#if confirmModal}
	<div class="modal modal-open">
		<div class="modal-box">
			<h3 class="text-lg font-bold">{confirmModal.title}</h3>
			<p class="py-4">{confirmModal.message}</p>
			<div class="modal-action">
				<button class="btn btn-ghost" onclick={closeConfirmModal} disabled={isConfirming}>
					Cancel
				</button>
				<button
					class="btn {confirmModal.actionClass}"
					onclick={handleConfirmAction}
					disabled={isConfirming}
				>
					{#if isConfirming}
						<span class="loading loading-spinner loading-sm"></span>
					{/if}
					{confirmModal.actionLabel}
				</button>
			</div>
		</div>
		<div class="modal-backdrop" onclick={closeConfirmModal}></div>
	</div>
{/if}

<!-- Edit Display Name Modal -->
<Modal bind:isOpen={showNameModal} title="Edit Display Name" maxWidth="max-w-md">
	{#snippet children()}
		<div class="p-6 space-y-4">
			{#if editingMember && !isCurrentUser(editingMember)}
				<p class="text-base-content/70">
					Edit display name for <strong>{editingMember.userEmail}</strong>
				</p>
			{:else}
				<p class="text-base-content/70">
					This name will be shown to other team members in this organisation.
				</p>
			{/if}

			<div class="form-control">
				<label class="label" for="displayName">
					<span class="label-text">Display Name</span>
				</label>
				<input
					id="displayName"
					type="text"
					class="input input-bordered w-full"
					placeholder={editingMember && !isCurrentUser(editingMember) ? "Enter name" : "Enter your name"}
					bind:value={editingDisplayName}
					disabled={isUpdating}
				/>
			</div>

			<div class="flex justify-end gap-3 pt-4">
				<button class="btn" onclick={() => { showNameModal = false; editingMember = null; }} disabled={isUpdating}>
					Cancel
				</button>
				<button class="btn btn-primary" onclick={handleUpdateDisplayName} disabled={isUpdating}>
					{#if isUpdating}
						<span class="loading loading-spinner loading-sm"></span>
					{/if}
					Save Name
				</button>
			</div>
		</div>
	{/snippet}
</Modal>
