<script lang="ts">
	import {
		Users,
		TrendingUp,
		Rocket,
		Check,
		ArrowRight,
		Plus,
		UserPlus
	} from 'lucide-svelte';
	import { FEATURES } from '$lib/config/features';
	import ActivityFeed from '$lib/components/ActivityFeed.svelte';

	let { data } = $props();

	// Core features for the dashboard — ordered to match sidebar navigation
	let coreFeatures = $derived([
		{
			title: 'Clients',
			description: 'Manage learners and organisations enrolled in your courses.',
			icon: Users,
			color: FEATURES.clients.color,
			viewHref: `/${data.organisation.slug}/clients`,
			createHref: `/${data.organisation.slug}/clients?new=true`,
			viewLabel: 'View All',
			createLabel: 'New Client'
		},
		{
			title: 'Forms',
			description: 'Send customizable forms to collect learner details and feedback.',
			icon: FEATURES.forms.icon,
			color: FEATURES.forms.color,
			viewHref: `/${data.organisation.slug}/forms`,
			createHref: `/${data.organisation.slug}/forms/new`,
			viewLabel: 'View All',
			createLabel: 'New Form'
		},
		{
			title: 'Reports',
			description: 'Track activity, engagement, and team performance at a glance.',
			icon: FEATURES.reports.icon,
			color: FEATURES.reports.color,
			viewHref: `/${data.organisation.slug}/reports`,
			createHref: `/${data.organisation.slug}/reports`,
			viewLabel: 'View All',
			createLabel: 'View Reports'
		}
	]);

	// Quick stats loaded from server
	let stats = $derived([
		{
			label: 'Total Clients',
			value: data.clientCount.toString(),
			icon: Users,
			href: `/${data.organisation.slug}/clients`
		},
		{
			label: 'Forms This Month',
			value: data.formSubmissionsThisMonth.toString(),
			icon: FEATURES.forms.icon,
			href: `/${data.organisation.slug}/forms`
		},
		{
			label: 'Team Members',
			value: data.teamMemberCount.toString(),
			icon: Users,
			href: `/${data.organisation.slug}/settings/members`
		}
	]);
</script>

<svelte:head>
	<title>{data.organisation.name} - Dashboard</title>
</svelte:head>

<div class="space-y-8">
	<!-- Welcome Header -->
	<div class="flex items-start justify-between gap-4">
		<div>
			<h1 class="text-2xl font-bold">Welcome to LeapLearn</h1>
			<p class="text-base-content/70 mt-1">
				{#if data.membership.displayName}
					Logged in as {data.membership.displayName} ({data.membership.role})
				{:else}
					You're logged in as {data.membership.role}
				{/if}
			</p>
		</div>
		<a
			href="/{data.organisation.slug}/clients?new=true"
			class="btn btn-sm gap-1.5 shrink-0"
			style="background-color: {FEATURES.clients.color}; border-color: {FEATURES.clients.color}; color: white"
		>
			<UserPlus class="h-4 w-4" />
			<span class="hidden sm:inline">Create New Client</span>
			<span class="sm:hidden">New Client</span>
		</a>
	</div>

	<!-- Onboarding Section (shown until profile is complete) -->
	{#if !data.isProfileComplete}
		<div class="card bg-gradient-to-r from-primary/10 to-secondary/10 border border-primary/20">
			<div class="card-body">
				<h2 class="card-title flex items-center gap-2">
					<Rocket class="h-5 w-5" />
					Get Started with Your Organisation
				</h2>
				<p class="text-base-content/70 text-sm">Complete this step to set up your organisation.</p>

				<div class="space-y-4 mt-4">
					<!-- Step 1: Organisation Settings (Required) -->
					<div class="flex items-start sm:items-center gap-4 flex-col sm:flex-row">
						<div class="flex items-center gap-2">
							<div class="badge badge-outline">Step 1</div>
							{#if data.isProfileComplete}
								<div class="badge badge-success gap-1">
									<Check class="h-3 w-3" /> Complete
								</div>
							{/if}
						</div>
						<div class="flex-1">
							<p class="font-medium">Complete Organisation Settings</p>
							<p class="text-sm text-base-content/60">Add your business details, address, and payment info</p>
						</div>
						{#if !data.isProfileComplete}
							<a href="/{data.organisation.slug}/settings/profile" class="btn btn-sm btn-primary">
								Go to Settings
							</a>
						{/if}
					</div>
				</div>
			</div>
		</div>
	{/if}

	<!-- Quick Stats -->
	<div class="grid gap-4 sm:grid-cols-3">
		{#each stats as stat (stat.label)}
			<a href={stat.href} class="card bg-base-100 hover:bg-base-200 transition-colors border border-base-300">
				<div class="card-body">
					<div class="flex items-center gap-4">
						<div
							class="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10"
							style="background-color: {data.organisation.primaryColor}20"
						>
							<stat.icon class="h-6 w-6" style="color: {data.organisation.primaryColor}" />
						</div>
						<div>
							<p class="text-2xl font-bold">{stat.value}</p>
							<p class="text-sm text-base-content/60">{stat.label}</p>
						</div>
					</div>
				</div>
			</a>
		{/each}
	</div>

	<!-- Core Features Section -->
	<div class="space-y-4">
		<div class="flex items-center justify-between">
			<div>
				<h2 class="text-xl font-semibold">Your Toolkit</h2>
				<p class="text-sm text-base-content/60 mt-0.5">Everything you need to manage your learning platform</p>
			</div>
			{#if data.membership.role === 'owner' || data.membership.role === 'admin'}
				<a href="/{data.organisation.slug}/settings" class="btn btn-sm btn-ghost gap-1.5 text-base-content/70 hover:text-base-content">
					<TrendingUp class="h-4 w-4" />
					Settings
				</a>
			{/if}
		</div>

		<!-- Feature Cards Grid -->
		<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{#each coreFeatures as feature, i}
				<div
					class="group relative overflow-hidden rounded-xl border border-base-300 bg-base-100 transition-all duration-300 hover:border-base-content/20 hover:shadow-lg hover:shadow-base-content/5"
					style="animation: fadeInUp 0.4s ease-out {i * 0.05}s both"
				>
					<!-- Subtle gradient overlay on hover -->
					<div
						class="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
						style="background: linear-gradient(135deg, {feature.color}08 0%, transparent 50%)"
					></div>

					<div class="relative p-5">
						<!-- Header with icon -->
						<div class="flex items-start gap-4">
							<div
								class="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg transition-transform duration-300 group-hover:scale-110"
								style="background-color: {feature.color}15; color: {feature.color}"
							>
								<feature.icon class="h-5 w-5" />
							</div>
							<div class="flex-1 min-w-0">
								<h3 class="font-semibold text-base-content">{feature.title}</h3>
								<p class="mt-1 text-sm text-base-content/60 leading-relaxed line-clamp-2">
									{feature.description}
								</p>
							</div>
						</div>

						<!-- Action buttons -->
						<div class="mt-4 flex items-center gap-2">
							<a
								href={feature.createHref}
								class="btn btn-sm gap-1.5 flex-1 transition-all duration-200"
								style="background-color: {feature.color}; border-color: {feature.color}; color: white"
							>
								<Plus class="h-3.5 w-3.5" />
								{feature.createLabel}
							</a>
							<a
								href={feature.viewHref}
								class="btn btn-sm btn-ghost gap-1 text-base-content/70 hover:text-base-content"
							>
								{feature.viewLabel}
								<ArrowRight class="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
							</a>
						</div>
					</div>

					<!-- Bottom accent line -->
					<div
						class="absolute bottom-0 left-0 h-0.5 w-0 transition-all duration-500 group-hover:w-full"
						style="background-color: {feature.color}"
					></div>
				</div>
			{/each}
		</div>
	</div>

	<!-- Recent Activity -->
	<div class="card bg-base-100 border border-base-300">
		<div class="card-body">
			<h2 class="card-title text-lg">Recent Activity</h2>
			<div class="mt-2">
				<ActivityFeed activities={data.recentActivity} />
			</div>
		</div>
	</div>
</div>

<style>
	@keyframes fadeInUp {
		from {
			opacity: 0;
			transform: translateY(12px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
</style>
