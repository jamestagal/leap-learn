<script lang="ts">
	import { Building2, Users, Shield, Clock } from 'lucide-svelte';
	import { getSuperAdminStats } from '$lib/api/super-admin.remote';
	import { formatDate } from '$lib/utils/formatting';
	import { onMount } from 'svelte';

	interface Stats {
		organisations: {
			total: number;
			active: number;
			suspended: number;
		};
		users: {
			total: number;
			superAdmins: number;
		};
		organisationsByTier: Record<string, number>;
		recentOrganisations: Array<{
			id: string;
			name: string;
			slug: string;
			status: string;
			subscriptionTier: string;
			createdAt: Date;
		}>;
	}

	let stats = $state<Stats | null>(null);
	let loading = $state(true);
	let error = $state<string | null>(null);

	onMount(async () => {
		try {
			stats = await getSuperAdminStats();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load stats';
		} finally {
			loading = false;
		}
	});

	// formatDate imported from '$lib/utils/formatting'

	function getTierBadgeClass(tier: string): string {
		switch (tier) {
			case 'free':
				return 'badge-ghost';
			case 'starter':
				return 'badge-info';
			case 'growth':
				return 'badge-success';
			case 'enterprise':
				return 'badge-primary';
			default:
				return 'badge-ghost';
		}
	}
</script>

<div>
	<div class="mb-6">
		<h1 class="text-2xl font-bold">Dashboard</h1>
		<p class="text-base-content/70">Platform overview and recent activity</p>
	</div>

	{#if loading}
		<div class="flex items-center justify-center py-12">
			<span class="loading loading-spinner loading-lg"></span>
		</div>
	{:else if error}
		<div class="alert alert-error">
			<span>{error}</span>
		</div>
	{:else if stats}
		<!-- Stats Cards -->
		<div class="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
			<div class="card bg-base-100 border border-base-300">
				<div class="card-body">
					<div class="flex items-center gap-3">
						<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
							<Building2 class="h-5 w-5 text-primary" />
						</div>
						<div>
							<p class="text-sm text-base-content/60">Total Organisations</p>
							<p class="text-2xl font-bold">{stats.organisations.total}</p>
						</div>
					</div>
					<div class="mt-2 text-sm text-base-content/60">
						<span class="text-success">{stats.organisations.active} active</span>
						{#if stats.organisations.suspended > 0}
							<span class="ml-2 text-warning">{stats.organisations.suspended} suspended</span>
						{/if}
					</div>
				</div>
			</div>

			<div class="card bg-base-100 border border-base-300">
				<div class="card-body">
					<div class="flex items-center gap-3">
						<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary/10">
							<Users class="h-5 w-5 text-secondary" />
						</div>
						<div>
							<p class="text-sm text-base-content/60">Total Users</p>
							<p class="text-2xl font-bold">{stats.users.total}</p>
						</div>
					</div>
				</div>
			</div>

			<div class="card bg-base-100 border border-base-300">
				<div class="card-body">
					<div class="flex items-center gap-3">
						<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-error/10">
							<Shield class="h-5 w-5 text-error" />
						</div>
						<div>
							<p class="text-sm text-base-content/60">Super Admins</p>
							<p class="text-2xl font-bold">{stats.users.superAdmins}</p>
						</div>
					</div>
				</div>
			</div>

			<div class="card bg-base-100 border border-base-300">
				<div class="card-body">
					<div class="flex items-center gap-3">
						<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
							<Clock class="h-5 w-5 text-accent" />
						</div>
						<div>
							<p class="text-sm text-base-content/60">Recent Signups</p>
							<p class="text-2xl font-bold">{stats.recentOrganisations.length}</p>
						</div>
					</div>
					<p class="mt-2 text-sm text-base-content/60">Last 10 organisations</p>
				</div>
			</div>
		</div>

		<div class="grid gap-6 lg:grid-cols-2">
			<!-- Organisations by Tier -->
			<div class="card bg-base-100 border border-base-300">
				<div class="card-body">
					<h2 class="card-title text-lg">Organisations by Subscription</h2>
					<div class="mt-4 space-y-3">
						{#each Object.entries(stats.organisationsByTier) as [tier, count]}
							<div class="flex items-center justify-between">
								<span class="badge {getTierBadgeClass(tier)} badge-lg capitalize">{tier}</span>
								<span class="font-medium">{count}</span>
							</div>
						{/each}
						{#if Object.keys(stats.organisationsByTier).length === 0}
							<p class="text-base-content/60 text-center py-4">No organisations yet</p>
						{/if}
					</div>
				</div>
			</div>

			<!-- Recent Organisations -->
			<div class="card bg-base-100 border border-base-300">
				<div class="card-body">
					<div class="flex items-center justify-between">
						<h2 class="card-title text-lg">Recent Organisations</h2>
						<a href="/super-admin/organisations" class="btn btn-ghost btn-sm">View All</a>
					</div>
					<div class="mt-4">
						{#if stats.recentOrganisations.length > 0}
							<div class="space-y-2">
								{#each stats.recentOrganisations.slice(0, 5) as organisation (organisation.id)}
									<a
										href="/super-admin/organisations/{organisation.id}"
										class="flex items-center justify-between gap-3 rounded-lg p-2 transition-colors hover:bg-base-200"
									>
										<div class="min-w-0 flex-1">
											<p class="font-medium truncate">{organisation.name}</p>
											<p class="text-sm text-base-content/60 truncate">/{organisation.slug}</p>
										</div>
										<div class="text-right shrink-0">
											<span class="badge {getTierBadgeClass(organisation.subscriptionTier)} badge-sm capitalize">
												{organisation.subscriptionTier}
											</span>
											<p class="mt-1 text-xs text-base-content/60">
												{formatDate(organisation.createdAt)}
											</p>
										</div>
									</a>
								{/each}
							</div>
						{:else}
							<p class="text-base-content/60 text-center py-4">No organisations yet</p>
						{/if}
					</div>
				</div>
			</div>
		</div>

		<!-- Quick Actions -->
		<div class="mt-6">
			<h2 class="mb-4 text-lg font-semibold">Quick Actions</h2>
			<div class="flex flex-wrap gap-3">
				<a href="/super-admin/organisations" class="btn btn-outline gap-2">
					<Building2 class="h-4 w-4" />
					Manage Organisations
				</a>
				<a href="/super-admin/users" class="btn btn-outline gap-2">
					<Users class="h-4 w-4" />
					Manage Users
				</a>
				<a href="/super-admin/audit-log" class="btn btn-outline gap-2">
					<Clock class="h-4 w-4" />
					View Audit Log
				</a>
			</div>
		</div>
	{/if}
</div>
