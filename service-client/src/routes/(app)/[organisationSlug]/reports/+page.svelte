<script lang="ts">
	import { BarChart3, Users, Lock } from 'lucide-svelte';
	import BarChart from '$lib/components/charts/BarChart.svelte';
	let { data } = $props();
</script>

<svelte:head>
	<title>{data.organisation.name} - Reports</title>
</svelte:head>

{#if data.gated}
	<!-- Upgrade prompt for Free/Starter tiers -->
	<div class="flex flex-col items-center justify-center py-16 text-center">
		<div class="flex h-16 w-16 items-center justify-center rounded-full bg-warning/10 mb-4">
			<Lock class="h-8 w-8 text-warning" />
		</div>
		<h1 class="text-2xl font-bold">Reports & Analytics</h1>
		<p class="text-base-content/60 mt-2 max-w-md">
			Upgrade to the Growth plan to access detailed reports and team
			performance insights.
		</p>
		<a href="/{data.organisation.slug}/settings/billing" class="btn btn-primary mt-6">
			Upgrade Plan
		</a>
	</div>
{:else}
	<div class="space-y-6">
		<div>
			<h1 class="text-2xl font-bold">Reports & Analytics</h1>
			<p class="text-base-content/60 mt-1">Track your organisation's activity and engagement.</p>
		</div>

		<!-- Team Activity (full width) -->
		<div class="card bg-base-100 border border-base-300">
			<div class="card-body">
				<h2 class="card-title text-base flex items-center gap-2">
					<Users class="h-5 w-5 text-info" />
					Team Activity
					<span class="text-xs font-normal text-base-content/50">(last 30 days)</span>
				</h2>
				{#if data.teamActivity.length > 0}
					<BarChart
						labels={data.teamActivity.map((t) => t.name)}
						datasets={[
							{
								label: 'Actions',
								data: data.teamActivity.map((t) => t.actions),
								backgroundColor: '#3b82f6',
							},
						]}
						height={160}
					/>
				{:else}
					<div class="h-48 flex items-center justify-center text-base-content/40">
						<p class="text-sm">No team activity recorded yet</p>
					</div>
				{/if}
			</div>
		</div>

		<!-- Placeholder for future LMS reports -->
		<div class="grid gap-6 lg:grid-cols-2">
			<div class="card bg-base-100 border border-base-300 border-dashed">
				<div class="card-body items-center justify-center text-center py-12">
					<BarChart3 class="h-8 w-8 text-base-content/20 mb-2" />
					<p class="text-sm text-base-content/40">Course completion reports coming soon</p>
				</div>
			</div>
			<div class="card bg-base-100 border border-base-300 border-dashed">
				<div class="card-body items-center justify-center text-center py-12">
					<BarChart3 class="h-8 w-8 text-base-content/20 mb-2" />
					<p class="text-sm text-base-content/40">Learner progress analytics coming soon</p>
				</div>
			</div>
		</div>
	</div>
{/if}
