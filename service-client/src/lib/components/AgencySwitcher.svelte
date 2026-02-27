<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { Building2, ChevronDown, Check, Plus, Settings, Users, Shield } from 'lucide-svelte';
	import { switchOrganisation } from '$lib/api/organisation.remote';
	import type { OrganisationRole } from '$lib/server/schema';

	interface Organisation {
		id: string;
		name: string;
		slug: string;
		logoUrl: string | null;
		logoAvatarUrl?: string | null; // Square avatar logo for nav/UI
		primaryColor: string;
		role: OrganisationRole;
	}

	// Helper to get the best logo for avatar display (prefer avatar, fallback to logoUrl)
	function getAvatarLogo(organisation: Organisation): string | null {
		return organisation.logoAvatarUrl || organisation.logoUrl || null;
	}

	interface Props {
		currentOrganisation: Organisation;
		organisations: Organisation[];
		showManageLink?: boolean;
		isSuperAdmin?: boolean;
	}

	let { currentOrganisation, organisations, showManageLink = true, isSuperAdmin = false }: Props = $props();

	// Local state
	let showDropdown = $state(false);
	let isSwitching = $state<string | null>(null);

	// Derived state
	let otherOrganisations = $derived(organisations.filter((a) => a.id !== currentOrganisation.id));
	let canAdmin = $derived(currentOrganisation.role === 'owner' || currentOrganisation.role === 'admin');

	async function handleOrganisationSelect(organisation: Organisation) {
		if (isSwitching) return;

		try {
			isSwitching = organisation.id;
			showDropdown = false;

			await switchOrganisation(organisation.id);

			// Navigate to the new organisation's dashboard
			await goto(`/${organisation.slug}`);

			// Invalidate all data to refresh with new context
			await invalidateAll();
		} catch (error) {
			console.error('Failed to switch organisation:', error);
			// Still try to navigate even if switch failed
			await goto(`/${organisation.slug}`);
		} finally {
			isSwitching = null;
		}
	}



	function getInitial(name: string): string {
		return name ? name.charAt(0).toUpperCase() : '?';
	}

	function toggleDropdown() {
		showDropdown = !showDropdown;
	}

	function closeDropdown() {
		showDropdown = false;
	}

	// Handle click outside to close dropdown
	function handleClickOutside(event: MouseEvent) {
		const target = event.target as HTMLElement;
		const dropdown = target.closest('.organisation-switcher-container');
		if (!dropdown && showDropdown) {
			showDropdown = false;
		}
	}

	// Add/remove click listener when dropdown opens/closes
	$effect(() => {
		if (!showDropdown) return;
		document.addEventListener('click', handleClickOutside);
		return () => document.removeEventListener('click', handleClickOutside);
	});
</script>

<div class="organisation-switcher-container dropdown dropdown-end">
	<!-- Trigger Button -->
	<button
		class="btn btn-ghost gap-2 px-2"
		onclick={toggleDropdown}
		disabled={isSwitching !== null}
		aria-expanded={showDropdown}
		aria-haspopup="true"
		aria-label="Switch organisation"
	>
		<!-- Organisation Avatar (prefer avatar logo, fallback to horizontal, then initial) -->
		{#if getAvatarLogo(currentOrganisation)}
			<img
				src={getAvatarLogo(currentOrganisation)}
				alt={currentOrganisation.name}
				class="h-8 w-8 rounded-lg object-cover"
			/>
		{:else}
			<div
				class="flex h-8 w-8 items-center justify-center rounded-lg text-white font-bold text-sm"
				style="background-color: {currentOrganisation.primaryColor}"
			>
				{getInitial(currentOrganisation.name)}
			</div>
		{/if}

		<!-- Organisation Info (hidden on mobile) -->
		<div class="hidden sm:flex flex-col items-start">
			<span class="text-sm font-medium truncate max-w-[120px]">{currentOrganisation.name}</span>
			<span class="text-xs text-base-content/60">/{currentOrganisation.slug}</span>
		</div>

		<ChevronDown class="h-4 w-4 text-base-content/60" />
	</button>

	<!-- Dropdown Content -->
	{#if showDropdown}
		<div
			class="dropdown-content menu bg-base-100 rounded-box z-50 mt-2 w-72 p-2 shadow-lg border border-base-300"
			role="menu"
			aria-label="Organisation options"
		>
			<!-- Current Organisation Header -->
			<div class="px-3 py-2">
				<span class="text-xs font-semibold text-base-content/60 uppercase tracking-wide">
					Current Organisation
				</span>
			</div>

			<div class="mx-1 mb-2 flex items-center gap-3 rounded-lg bg-primary/10 p-3">
				{#if getAvatarLogo(currentOrganisation)}
					<img
						src={getAvatarLogo(currentOrganisation)}
						alt={currentOrganisation.name}
						class="h-10 w-10 rounded-lg object-cover"
					/>
				{:else}
					<div
						class="flex h-10 w-10 items-center justify-center rounded-lg text-white font-bold"
						style="background-color: {currentOrganisation.primaryColor}"
					>
						{getInitial(currentOrganisation.name)}
					</div>
				{/if}
				<div class="flex-1 min-w-0">
					<div class="font-medium truncate">{currentOrganisation.name}</div>
					<div class="text-sm text-base-content/60">/{currentOrganisation.slug}</div>
				</div>
				<Check class="h-5 w-5 text-primary" />
			</div>

			<!-- Quick Links for Current Organisation -->
			<div class="divider my-1"></div>

			<li>
				<a href="/{currentOrganisation.slug}" onclick={closeDropdown}>
					<Building2 class="h-4 w-4" />
					Dashboard
				</a>
			</li>
			{#if canAdmin}
				<li>
					<a href="/{currentOrganisation.slug}/settings" onclick={closeDropdown}>
						<Settings class="h-4 w-4" />
						Settings
					</a>
				</li>
				<li>
					<a href="/{currentOrganisation.slug}/settings/members" onclick={closeDropdown}>
						<Users class="h-4 w-4" />
						Team Members
					</a>
				</li>
			{/if}

			<!-- Other Organisations -->
			{#if otherOrganisations.length > 0}
				<div class="divider my-1"></div>

				<div class="px-3 py-2">
					<span class="text-xs font-semibold text-base-content/60 uppercase tracking-wide">
						Switch Organisation
					</span>
				</div>

				{#each otherOrganisations as organisation (organisation.id)}
					<li>
						<button
							class="flex items-center gap-3 w-full"
							onclick={() => handleOrganisationSelect(organisation)}
							disabled={isSwitching === organisation.id}
						>
							{#if getAvatarLogo(organisation)}
								<img
									src={getAvatarLogo(organisation)}
									alt={organisation.name}
									class="h-8 w-8 rounded-lg object-cover"
								/>
							{:else}
								<div
									class="flex h-8 w-8 items-center justify-center rounded-lg text-white font-bold text-sm"
									style="background-color: {organisation.primaryColor}"
								>
									{getInitial(organisation.name)}
								</div>
							{/if}
							<div class="flex-1 min-w-0 text-left">
								<div class="font-medium truncate">{organisation.name}</div>
								<div class="text-xs text-base-content/60">/{organisation.slug}</div>
							</div>
							{#if isSwitching === organisation.id}
								<span class="loading loading-spinner loading-sm"></span>
							{/if}
						</button>
					</li>
				{/each}
			{/if}

			<!-- Manage Link -->
			{#if showManageLink}
				<div class="divider my-1"></div>

				<li>
					<a href="/organisations" class="text-primary" onclick={closeDropdown}>
						<Building2 class="h-4 w-4" />
						Manage Organisations
					</a>
				</li>
				<li>
					<a href="/organisations/create" onclick={closeDropdown}>
						<Plus class="h-4 w-4" />
						Create New Organisation
					</a>
				</li>
			{/if}

			<!-- Super Admin Link -->
			{#if isSuperAdmin}
				<div class="divider my-1"></div>

				<li>
					<a href="/super-admin" class="text-error font-medium" onclick={closeDropdown}>
						<Shield class="h-4 w-4" />
						Super Admin
					</a>
				</li>
			{/if}
		</div>
	{/if}
</div>

<style>
	.organisation-switcher-container {
		position: relative;
	}

	.dropdown-content {
		position: absolute;
		right: 0;
	}
</style>
