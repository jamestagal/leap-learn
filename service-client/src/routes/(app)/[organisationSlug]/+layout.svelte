<script lang="ts">
	import { page } from '$app/state';
	import type { Snippet } from 'svelte';
	import { LogOut } from 'lucide-svelte';
	import { env } from '$env/dynamic/public';
	import { setOrganisationConfig } from '$lib/stores/organisation-config.svelte';
	import OrganisationSwitcher from '$lib/components/OrganisationSwitcher.svelte';
	import { FEATURES, NAV_FEATURES } from '$lib/config/features';

	let { children, data }: { children: Snippet; data: import('./$types').LayoutData } = $props();

	// Build current organisation object for switcher
	let currentOrganisationForSwitcher = $derived({
		id: data.organisation.id,
		name: data.organisation.name,
		slug: data.organisation.slug,
		logoUrl: data.organisation.logoUrl,
		logoAvatarUrl: data.organisation.logoAvatarUrl,
		primaryColor: data.organisation.primaryColor,
		role: data.membership.role
	});

	// Helper to get the best logo for avatar display (prefer avatar, fallback to logoUrl)
	let sidebarLogo = $derived(data.organisation.logoAvatarUrl || data.organisation.logoUrl || null);

	// Set organisation config context for child components
	$effect(() => {
		setOrganisationConfig(data.organisationConfig);
	});

	let current = $derived(page.url.pathname);
	let organisationSlug = $derived(data.organisation.slug);
	let canAdmin = $derived(data.membership.role === 'owner' || data.membership.role === 'admin');

	// Navigation items scoped to organisation - using shared feature config for consistency
	let nav = $derived([
		{ label: 'Dashboard', url: `/${organisationSlug}`, icon: NAV_FEATURES.dashboard.icon, color: NAV_FEATURES.dashboard.color },
		{ label: 'Clients', url: `/${organisationSlug}/clients`, icon: FEATURES.clients.icon, color: FEATURES.clients.color },
		{ label: 'Forms', url: `/${organisationSlug}/forms`, icon: FEATURES.forms.icon, color: FEATURES.forms.color },
		{ label: 'Reports', url: `/${organisationSlug}/reports`, icon: FEATURES.reports.icon, color: FEATURES.reports.color }
	]);

	// Admin navigation (only shown to owner/admin)
	let adminNav = $derived([
		{ label: 'Settings', url: `/${organisationSlug}/settings`, icon: NAV_FEATURES.settings.icon, color: NAV_FEATURES.settings.color },
		{ label: 'Members', url: `/${organisationSlug}/settings/members`, icon: NAV_FEATURES.members.icon, color: NAV_FEATURES.members.color }
	]);

	// Check if we're on a form builder page (needs full width layout)
	let isFormBuilderPage = $derived(
		current.includes('/settings/forms/new') ||
			(current.includes('/settings/forms/') && current.match(/\/settings\/forms\/[^/]+$/))
	);

	// Helper to check if nav item is active
	function isActive(itemUrl: string): boolean {
		// Dashboard - exact match only
		if (itemUrl === `/${organisationSlug}`) {
			return current === itemUrl;
		}
		// All other pages - prefix match
		return current.startsWith(itemUrl);
	}

	let sidebarOpen = $state(false);
</script>

<div id="content" class="h-full">
	<!-- Desktop menu -->
	<div
		class="lg:bg-base-300 hidden !overflow-visible lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:flex lg:w-20 lg:flex-col lg:overflow-y-auto lg:pb-4"
	>
		<div class="flex grow flex-col">
			<!-- Organisation Logo or Default (prefer avatar logo for compact display) -->
			<a href="/{organisationSlug}" class="mt-4 flex h-8 shrink-0 items-center justify-center">
				{#if sidebarLogo}
					<img class="h-8 w-8 rounded-lg object-cover" src={sidebarLogo} alt={data.organisation.name} />
				{:else}
					<div
						class="flex h-8 w-8 items-center justify-center rounded-lg text-white font-bold"
						style="background-color: {data.organisation.primaryColor}"
					>
						{data.organisation.name.charAt(0).toUpperCase()}
					</div>
				{/if}
			</a>
			<nav class="mt-8 flex flex-1 flex-col">
				<ul role="list" class="flex flex-1 flex-col items-center space-y-1">
					{#each nav as item (item.url)}
						{@const active = isActive(item.url)}
						<li>
							<div class="tooltip tooltip-right" data-tip={item.label}>
								<a
									href={item.url}
									class="group relative flex cursor-pointer gap-x-3 rounded-md p-3 text-sm/6 font-semibold transition-all duration-200
										{active ? 'bg-base-100' : 'hover:bg-base-100 hover:opacity-80'}"
								>
									<item.icon class="h-6 w-6" style="color: {item.color}" />
									<span class="sr-only">{item.label}</span>
									{#if active}
										<span
											class="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 rounded-r-full"
											style="background-color: {item.color}"
										></span>
									{/if}
								</a>
							</div>
						</li>
					{/each}

					<!-- Admin section -->
					{#if canAdmin}
						<li class="!mt-4 w-full">
							<div class="border-base-100 mx-3 border-t"></div>
						</li>
						{#each adminNav as item (item.url)}
							{@const active = isActive(item.url)}
							<li>
								<div class="tooltip tooltip-right" data-tip={item.label}>
									<a
										href={item.url}
										class="group relative flex cursor-pointer gap-x-3 rounded-md p-3 text-sm/6 font-semibold transition-all duration-200
											{active ? 'bg-base-100' : 'hover:bg-base-100 hover:opacity-80'}"
									>
										<item.icon class="h-6 w-6" style="color: {item.color}" />
										<span class="sr-only">{item.label}</span>
										{#if active}
											<span
												class="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 rounded-r-full"
												style="background-color: {item.color}"
											></span>
										{/if}
									</a>
								</div>
							</li>
						{/each}
					{/if}

					<li class="!mt-auto">
						<div class="tooltip tooltip-right" data-tip="Logout">
							<form
								action={env.PUBLIC_CORE_URL + '/logout'}
								method="post"
								class="group hover:bg-base-100 flex cursor-pointer gap-x-3 rounded-md text-sm/6 font-semibold hover:opacity-80"
							>
								<input type="hidden" name="return_url" value={env.PUBLIC_CLIENT_URL} />
								<button class="cursor-pointer p-3">
									<LogOut class="h-6 w-6" />
									<span class="sr-only">Logout</span>
								</button>
							</form>
						</div>
					</li>
				</ul>
			</nav>
		</div>
	</div>

	<!-- Mobile menu -->
	<div class="bg-base-300 sticky top-0 z-30 flex items-center gap-x-4 px-4 py-3 shadow-sm sm:px-6 lg:hidden">
		<button
			type="button"
			class="-m-2.5 cursor-pointer p-2.5 hover:opacity-60 lg:hidden"
			onclick={() => sidebarOpen = true}
			aria-expanded={sidebarOpen}
			aria-controls="mobile-sidebar"
			aria-label="Open sidebar"
		>
			<svg
				class="size-6"
				fill="none"
				viewBox="0 0 24 24"
				stroke-width="1.5"
				stroke="currentColor"
				aria-hidden="true"
				data-slot="icon"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
				></path>
			</svg>
		</button>
		<!-- Mobile branding -->
		<a href="/{organisationSlug}" class="flex flex-col">
			<span class="text-sm font-semibold leading-tight">LeapLearn</span>
			<span class="text-xs text-base-content/60 leading-tight truncate max-w-40">{data.organisation.name}</span>
		</a>
		<div class="flex-1"></div>
		<OrganisationSwitcher
			currentOrganisation={currentOrganisationForSwitcher}
			organisations={data.userOrganisations}
			isSuperAdmin={data.isSuperAdmin}
		/>
	</div>

	<!-- Sidebar -->
	<div class="modal modal-start" class:modal-open={sidebarOpen} role="dialog" id="mobile-sidebar" aria-label="Navigation menu">
		<div class="modal-box w-full max-w-sm">
			<div class="relative flex-1 px-4 sm:px-6">
				<nav class="flex flex-1 flex-col">
					<ul role="list" class="-mx-2 flex-1 space-y-1">
						{#each nav as item (item.url)}
							{@const active = isActive(item.url)}
							<li>
								<a
									href={item.url}
									onclick={() => sidebarOpen = false}
									class="group relative flex gap-x-3 rounded-md p-2 text-sm/6 font-semibold transition-all duration-200
										{active ? 'bg-base-200' : 'hover:bg-base-200 hover:opacity-80'}"
								>
									<item.icon class="h-6 w-6" style="color: {item.color}" />
									{item.label}
									{#if active}
										<span
											class="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-r-full"
											style="background-color: {item.color}"
										></span>
									{/if}
								</a>
							</li>
						{/each}

						<!-- Admin section -->
						{#if canAdmin}
							<li class="!mt-4">
								<div class="border-base-200 border-t pt-4 text-xs font-medium uppercase text-gray-500">
									Admin
								</div>
							</li>
							{#each adminNav as item (item.url)}
								{@const active = isActive(item.url)}
								<li>
									<a
										href={item.url}
										onclick={() => sidebarOpen = false}
										class="group relative flex gap-x-3 rounded-md p-2 text-sm/6 font-semibold transition-all duration-200
											{active ? 'bg-base-200' : 'hover:bg-base-200 hover:opacity-80'}"
									>
										<item.icon class="h-6 w-6" style="color: {item.color}" />
										{item.label}
										{#if active}
											<span
												class="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-r-full"
												style="background-color: {item.color}"
											></span>
										{/if}
									</a>
								</li>
							{/each}
						{/if}

						<li class="!mt-4">
							<form
								action={env.PUBLIC_CORE_URL + '/logout'}
								method="post"
								class="group hover:bg-base-200 flex gap-x-3 rounded-md text-sm/6 font-semibold hover:opacity-80"
							>
								<input type="hidden" name="return_url" value={env.PUBLIC_CLIENT_URL} />
								<button class="flex cursor-pointer gap-x-3 p-2">
									<LogOut class="h-6 w-6" />
									Logout
								</button>
							</form>
						</li>
					</ul>
				</nav>
			</div>
		</div>
		<div class="modal-backdrop" onclick={() => sidebarOpen = false}></div>
	</div>

	<main class="min-h-full lg:pl-20">
		<!-- Desktop header with organisation switcher -->
		<div class="hidden lg:flex items-center justify-between border-b border-base-300 bg-base-100 px-8 py-3">
			<div class="flex items-center gap-4">
				<div class="flex flex-col">
					<span class="text-lg font-bold leading-tight">LeapLearn</span>
					<span class="text-xs text-base-content/60 leading-tight">{data.organisation.name}</span>
				</div>
				{#if data.membership.displayName}
					<span class="text-sm text-base-content/60 border-l border-base-300 pl-4">
						Welcome, {data.membership.displayName}
					</span>
				{/if}
			</div>
			<OrganisationSwitcher
				currentOrganisation={currentOrganisationForSwitcher}
				organisations={data.userOrganisations}
				isSuperAdmin={data.isSuperAdmin}
			/>
		</div>
		<div
			class="lg:py-6"
			class:px-4={!isFormBuilderPage}
			class:sm:px-6={!isFormBuilderPage}
			class:lg:px-8={!isFormBuilderPage}
			class:xl:px-12={!isFormBuilderPage}
			class:py-10={!isFormBuilderPage}
			class:px-2={isFormBuilderPage}
			class:py-4={isFormBuilderPage}
			class:max-w-[1600px]={!isFormBuilderPage}
		>
			{@render children()}
		</div>
	</main>
</div>
