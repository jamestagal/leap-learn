<script lang="ts">
	import { page } from '$app/state';
	import type { Snippet } from 'svelte';
	import { Building2, Package, PlusSquare, Users, Palette, FileText, CreditCard, Sparkles, FileStack, Receipt, ClipboardCheck } from 'lucide-svelte';
	import SetupChecklist from '$lib/components/settings/SetupChecklist.svelte';
	import Breadcrumbs from '$lib/components/settings/Breadcrumbs.svelte';
	import { getSetupChecklist } from '$lib/api/organisation-profile.remote';

	let { children, data }: { children: Snippet; data: import('./$types').LayoutData } = $props();

	// Load checklist data when on settings index
	let checklistPromise = $derived.by(() => {
		if (page.url.pathname === `/${data.organisation.slug}/settings`) {
			return getSetupChecklist();
		}
		return null;
	});

	let current = $derived(page.url.pathname);
	let organisationSlug = $derived(data.organisation.slug);

	// Check if we're on a form builder page (needs full width, no sidebar)
	let isFormBuilderPage = $derived(
		current.includes('/settings/forms/new') ||
			(current.includes('/settings/forms/') && current.match(/\/settings\/forms\/[^/]+$/))
	);

	// Settings navigation items
	let settingsNav = $derived([
		{
			label: 'Organisation Profile',
			url: `/${organisationSlug}/settings/profile`,
			icon: Building2,
			description: 'Business details, address, banking'
		},
		{
			label: 'Branding',
			url: `/${organisationSlug}/settings/branding`,
			icon: Palette,
			description: 'Logo, colors, social links'
		},
		{
			label: 'Packages',
			url: `/${organisationSlug}/settings/packages`,
			icon: Package,
			description: 'Pricing tiers and features'
		},
		{
			label: 'Add-ons',
			url: `/${organisationSlug}/settings/addons`,
			icon: PlusSquare,
			description: 'Optional services'
		},
		{
			label: 'Contracts',
			url: `/${organisationSlug}/settings/contracts`,
			icon: FileText,
			description: 'Contract templates & terms'
		},
		{
			label: 'Quotations',
			url: `/${organisationSlug}/settings/quotations`,
			icon: ClipboardCheck,
			description: 'Quotation templates & pricing'
		},
		{
			label: 'Forms',
			url: `/${organisationSlug}/settings/forms`,
			icon: FileStack,
			description: 'Client-facing forms & questionnaires'
		},
		{
			label: 'Members',
			url: `/${organisationSlug}/settings/members`,
			icon: Users,
			description: 'Team management'
		},
		{
			label: 'Payments',
			url: `/${organisationSlug}/settings/payments`,
			icon: CreditCard,
			description: 'Stripe Connect & online payments'
		},
		{
			label: 'Billing',
			url: `/${organisationSlug}/settings/billing`,
			icon: Receipt,
			description: 'Subscription & usage'
		},
		{
			label: 'Demo Data',
			url: `/${organisationSlug}/settings/demo`,
			icon: Sparkles,
			description: 'Load or clear sample data'
		}
	]);

	// Check if on main settings page (no sub-route)
	let isSettingsIndex = $derived(current === `/${organisationSlug}/settings`);

	// Derive current section label from settingsNav for breadcrumbs
	let currentSectionLabel = $derived(
		settingsNav.find((item) => current.startsWith(item.url))?.label ?? ''
	);
</script>

{#if isSettingsIndex}
	<!-- Settings index page with navigation cards -->
	<div>
		<div class="mb-6">
			<h1 class="text-2xl font-bold">Settings</h1>
			<p class="text-base-content/70 mt-1">Manage your organisation configuration</p>
		</div>

		<!-- Setup Checklist -->
		{#if checklistPromise}
			{#await checklistPromise}
				<div class="mb-6">
					<div class="card bg-base-100 border border-base-300 animate-pulse">
						<div class="card-body">
							<div class="h-6 bg-base-300 rounded w-1/3 mb-4"></div>
							<div class="h-4 bg-base-300 rounded w-2/3 mb-2"></div>
							<div class="h-2 bg-base-300 rounded w-full"></div>
						</div>
					</div>
				</div>
			{:then checklist}
				{#if checklist}
					<div class="mb-6">
						<SetupChecklist
							items={checklist.items}
							completionPercent={checklist.completionPercent}
							totalRequired={checklist.totalRequired}
							completedRequired={checklist.completedRequired}
							isReady={checklist.isReady}
							organisationSlug={organisationSlug}
						/>
					</div>
				{/if}
			{:catch}
				<!-- Silently fail if checklist can't load -->
			{/await}
		{/if}

		<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{#each settingsNav as item (item.url)}
				<a
					href={item.url}
					class="card bg-base-100 hover:bg-base-200 transition-colors border border-base-300"
				>
					<div class="card-body">
						<div class="flex items-center gap-3">
							<div
								class="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"
							>
								<item.icon class="h-5 w-5" />
							</div>
							<div>
								<h2 class="card-title text-base">{item.label}</h2>
								<p class="text-sm text-base-content/60">{item.description}</p>
							</div>
						</div>
					</div>
				</a>
			{/each}
		</div>
	</div>
{:else if isFormBuilderPage}
	<!-- Form builder pages: full width, no sidebar -->
	{@render children()}
{:else}
	<!-- Sub-page with sidebar navigation -->
	<div class="flex flex-col lg:flex-row gap-6">
		<!-- Sidebar navigation (desktop) -->
		<aside class="hidden lg:block w-64 flex-shrink-0">
			<div class="sticky top-6">
				<h2 class="text-sm font-semibold text-base-content/60 uppercase tracking-wider mb-3">
					Settings
				</h2>
				<nav class="space-y-1">
					{#each settingsNav as item (item.url)}
						<a
							href={item.url}
							class="flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors
								{current.startsWith(item.url)
								? 'bg-primary/10 text-primary font-medium'
								: 'hover:bg-base-200 text-base-content/80'}"
						>
							<item.icon class="h-4 w-4" />
							{item.label}
						</a>
					{/each}
				</nav>
			</div>
		</aside>

		<!-- Mobile Section Navigation -->
		<div class="lg:hidden border-b border-base-300 bg-base-100 -mx-4 px-2 mb-4">
			<div class="flex overflow-x-auto py-2 gap-1 scrollbar-none">
				{#each settingsNav as item (item.url)}
					<a
						href={item.url}
						class="btn btn-sm shrink-0 gap-1 {current.startsWith(item.url) ? 'btn-primary' : 'btn-ghost'}"
					>
						<item.icon class="h-3.5 w-3.5" />
						{item.label}
					</a>
				{/each}
			</div>
		</div>

		<!-- Main content -->
		<main class="flex-1 min-w-0">
			{#if currentSectionLabel}
				<div class="mb-4">
					<Breadcrumbs crumbs={[
						{ label: 'Settings', href: `/${organisationSlug}/settings` },
						{ label: currentSectionLabel }
					]} />
				</div>
			{/if}
			{@render children()}
		</main>
	</div>
{/if}
