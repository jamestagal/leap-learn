<script lang="ts">
	import { ChevronDown, Building2, Plus, Check } from 'lucide-svelte';

	interface Organisation {
		id: string;
		name: string;
		slug: string;
		logoUrl: string;
		logoAvatarUrl: string;
		primaryColor: string;
		role: 'owner' | 'admin' | 'member';
	}

	interface Props {
		currentOrganisation: Organisation;
		organisations: Organisation[];
		isSuperAdmin?: boolean;
	}

	let { currentOrganisation, organisations, isSuperAdmin = false }: Props = $props();

	let isOpen = $state(false);

	function toggleDropdown() {
		isOpen = !isOpen;
	}

	function closeDropdown() {
		isOpen = false;
	}

	// Get initials for avatar fallback
	function getInitials(name: string): string {
		return name.charAt(0).toUpperCase();
	}
</script>

<div class="relative">
	<button
		type="button"
		class="btn btn-ghost btn-sm gap-2"
		onclick={toggleDropdown}
		aria-expanded={isOpen}
		aria-haspopup="true"
	>
		{#if currentOrganisation.logoAvatarUrl || currentOrganisation.logoUrl}
			<img
				class="h-6 w-6 rounded object-cover"
				src={currentOrganisation.logoAvatarUrl || currentOrganisation.logoUrl}
				alt={currentOrganisation.name}
			/>
		{:else}
			<div
				class="flex h-6 w-6 items-center justify-center rounded text-white text-xs font-bold"
				style="background-color: {currentOrganisation.primaryColor || '#4F46E5'}"
			>
				{getInitials(currentOrganisation.name)}
			</div>
		{/if}
		<span class="hidden sm:inline text-sm">{currentOrganisation.name}</span>
		<ChevronDown class="h-4 w-4 opacity-60" />
	</button>

	{#if isOpen}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="fixed inset-0 z-40" onclick={closeDropdown} onkeydown={closeDropdown}></div>
		<div class="absolute right-0 z-50 mt-2 w-64 rounded-lg border border-base-300 bg-base-100 shadow-lg">
			<div class="p-2">
				<div class="px-3 py-2 text-xs font-semibold text-base-content/50 uppercase tracking-wider">
					Organisations
				</div>
				<ul class="menu menu-sm p-0">
					{#each organisations as org (org.id)}
						<li>
							<a
								href="/{org.slug}"
								class="flex items-center gap-3 rounded-lg px-3 py-2 {org.id === currentOrganisation.id ? 'bg-primary/10' : ''}"
								onclick={closeDropdown}
							>
								{#if org.logoAvatarUrl || org.logoUrl}
									<img
										class="h-7 w-7 rounded object-cover shrink-0"
										src={org.logoAvatarUrl || org.logoUrl}
										alt={org.name}
									/>
								{:else}
									<div
										class="flex h-7 w-7 items-center justify-center rounded text-white text-xs font-bold shrink-0"
										style="background-color: {org.primaryColor || '#4F46E5'}"
									>
										{getInitials(org.name)}
									</div>
								{/if}
								<div class="flex-1 min-w-0">
									<div class="font-medium truncate">{org.name}</div>
									<div class="text-xs text-base-content/50 capitalize">{org.role}</div>
								</div>
								{#if org.id === currentOrganisation.id}
									<Check class="h-4 w-4 text-primary shrink-0" />
								{/if}
							</a>
						</li>
					{/each}
				</ul>

				<div class="border-t border-base-200 mt-2 pt-2">
					<a
						href="/organisations/new"
						class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-base-200 transition-colors"
						onclick={closeDropdown}
					>
						<div class="flex h-7 w-7 items-center justify-center rounded bg-base-200">
							<Plus class="h-4 w-4" />
						</div>
						<span>Create Organisation</span>
					</a>
				</div>

				{#if isSuperAdmin}
					<div class="border-t border-base-200 mt-2 pt-2">
						<a
							href="/super-admin"
							class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-base-200 transition-colors"
							onclick={closeDropdown}
						>
							<div class="flex h-7 w-7 items-center justify-center rounded bg-warning/20">
								<Building2 class="h-4 w-4 text-warning" />
							</div>
							<span>Super Admin</span>
						</a>
					</div>
				{/if}
			</div>
		</div>
	{/if}
</div>
