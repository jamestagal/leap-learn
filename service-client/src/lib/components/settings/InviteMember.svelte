<script lang="ts">
	import { Mail, Users } from 'lucide-svelte';
	import { getToast } from '$lib/ui/toast_store.svelte';
	import Modal from '$lib/components/shared/Modal.svelte';

	const toast = getToast();
	import { inviteMember } from '$lib/api/organisation.remote';

	interface Props {
		organisation: { id: string; name: string; slug: string };
		showModal: boolean;
		onInvite?: () => void;
	}

	let { organisation, showModal = $bindable(false), onInvite = () => {} }: Props = $props();

	let email = $state('');
	let displayName = $state('');
	let role = $state<'admin' | 'member'>('member');
	let isLoading = $state(false);
	let errors = $state<{ email?: string }>({});

	const roles = [
		{
			value: 'member' as const,
			label: 'Member',
			description: 'Can create and manage forms and client records'
		},
		{
			value: 'admin' as const,
			label: 'Admin',
			description: 'Can manage all forms, clients, and invite members'
		}
	];

	async function handleInvite() {
		// Reset errors
		errors = {};

		// Validate
		if (!email) {
			errors.email = 'Email is required';
			return;
		}

		if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
			errors.email = 'Please enter a valid email address';
			return;
		}

		isLoading = true;

		try {
			await inviteMember({
				email,
				role,
				displayName: displayName.trim() || undefined
			});

			toast.success(`Invitation sent to ${email}`);

			// Reset form
			email = '';
			displayName = '';
			role = 'member';
			showModal = false;

			// Notify parent
			onInvite();
		} catch (error) {
			console.error('Failed to invite member:', error);

			const errorMessage = (error as Error).message || 'Unknown error';

			// Handle specific error messages
			if (errorMessage.includes('already a member')) {
				errors.email = 'This user is already a member of the organisation';
			} else if (errorMessage.includes('already invited')) {
				errors.email = 'This user has already been invited';
			} else if (errorMessage.includes('permission')) {
				errors.email = 'You do not have permission to invite members';
			} else {
				toast.error(`Failed to send invitation: ${errorMessage}`);
				errors.email = errorMessage;
			}
		} finally {
			isLoading = false;
		}
	}

	function handleClose() {
		if (!isLoading) {
			email = '';
			displayName = '';
			role = 'member';
			errors = {};
			showModal = false;
		}
	}
</script>

<Modal bind:isOpen={showModal} title="Invite Team Member" maxWidth="max-w-md">
	{#snippet children()}
		<div class="p-6">
			<div class="flex items-center gap-3 mb-6">
				<div
					class="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"
				>
					<Mail class="h-5 w-5" />
				</div>
				<div>
					<p class="text-base-content/70 text-sm">
						Send an invitation to join {organisation.name}
					</p>
				</div>
			</div>

			<form
				onsubmit={(e) => {
					e.preventDefault();
					handleInvite();
				}}
			>
				<div class="space-y-4">
					<!-- Email Input -->
					<div class="form-control">
						<label for="email" class="label">
							<span class="label-text">Email Address</span>
						</label>
						<input
							id="email"
							type="email"
							bind:value={email}
							placeholder="colleague@example.com"
							class="input input-bordered w-full"
							class:input-error={errors.email}
							disabled={isLoading}
						/>
						{#if errors.email}
							<label class="label">
								<span class="label-text-alt text-error">{errors.email}</span>
							</label>
						{/if}
					</div>

					<!-- Display Name Input (Optional) -->
					<div class="form-control">
						<label for="displayName" class="label">
							<span class="label-text">Display Name</span>
							<span class="label-text-alt text-base-content/50">Optional</span>
						</label>
						<input
							id="displayName"
							type="text"
							bind:value={displayName}
							placeholder="John Smith"
							class="input input-bordered w-full"
							disabled={isLoading}
						/>
					</div>

					<!-- Role Selection -->
					<div class="form-control">
						<label class="label">
							<span class="label-text">Role</span>
						</label>
						<div class="space-y-2">
							{#each roles as roleOption}
								<label
									class="flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors hover:bg-base-200 {role ===
									roleOption.value
										? 'bg-primary/5 border-primary'
										: 'border-base-300'}"
								>
									<input
										type="radio"
										name="role"
										value={roleOption.value}
										bind:group={role}
										disabled={isLoading}
										class="radio radio-primary mt-0.5"
									/>
									<div class="flex-1">
										<div class="font-medium">{roleOption.label}</div>
										<div class="text-base-content/60 text-sm">
											{roleOption.description}
										</div>
									</div>
								</label>
							{/each}
						</div>
					</div>

					<!-- Info Box -->
					<div class="alert alert-info">
						<Users class="h-5 w-5 shrink-0" />
						<div class="text-sm">
							<p class="font-medium mb-1">About Member Roles</p>
							<ul class="space-y-1 text-xs">
								<li>
									• <strong>Members</strong> can create and manage their own forms and client records
								</li>
								<li>
									• <strong>Admins</strong> can manage all organisation work and invite new members
								</li>
								<li>• <strong>Owners</strong> have full control including billing and settings</li>
							</ul>
						</div>
					</div>
				</div>

				<div class="flex justify-end gap-3 mt-6">
					<button type="button" class="btn" onclick={handleClose} disabled={isLoading}>
						Cancel
					</button>
					<button type="submit" class="btn btn-primary" disabled={isLoading || !email}>
						{#if isLoading}
							<span class="loading loading-spinner loading-sm"></span>
						{/if}
						Send Invitation
					</button>
				</div>
			</form>
		</div>
	{/snippet}
</Modal>
