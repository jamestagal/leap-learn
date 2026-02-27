<script lang="ts">
	import { goto } from '$app/navigation';
	import { Building2, Plus, Star, ChevronRight, AlertTriangle } from 'lucide-svelte';
	import { setDefaultOrganisation } from '$lib/api/organisation.remote';

	let { data } = $props();

	let settingDefault = $state<string | null>(null);

	async function handleSetDefault(organisationId: string) {
		settingDefault = organisationId;
		try {
			await setDefaultOrganisation(organisationId);
			// Refresh the page to update the default indicator
			window.location.reload();
		} catch (err) {
			console.error('Failed to set default organisation:', err);
		} finally {
			settingDefault = null;
		}
	}

	function handleSelectOrganisation(slug: string) {
		goto(`/${slug}`);
	}
</script>

<svelte:head>
	<title>Your Organisations</title>
</svelte:head>

<div class="mx-auto max-w-4xl">
	<!-- Header -->
	<div class="mb-8">
		<h1 class="text-2xl font-bold">Your Organisations</h1>
		<p class="text-base-content/70 mt-1">Select an organisation to continue or create a new one.</p>
	</div>

	<!-- Access revoked warning -->
	{#if data.reason === 'access_revoked'}
		<div class="alert alert-warning mb-6">
			<AlertTriangle class="h-5 w-5" />
			<span>Your access to the previous organisation was revoked. Please select another organisation.</span>
		</div>
	{/if}

	<!-- No organisations prompt -->
	{#if data.showCreatePrompt}
		<div class="card bg-base-200 text-center py-12">
			<div class="card-body items-center">
				<Building2 class="h-16 w-16 text-base-content/30 mb-4" />
				<h2 class="card-title">No Organisations Yet</h2>
				<p class="text-base-content/70 max-w-md">
					You don't belong to any organisations yet. Create your first organisation to get started with
					consultations and proposals.
				</p>
				<div class="card-actions mt-6">
					<a href="/organisations/create" class="btn btn-primary">
						<Plus class="h-5 w-5" />
						Create Your First Organisation
					</a>
				</div>
			</div>
		</div>
	{:else}
		<!-- Organisation list -->
		<div class="space-y-3">
			{#each data.organisations as organisation (organisation.id)}
				<div
					class="card bg-base-100 hover:bg-base-200 transition-colors cursor-pointer border border-base-300"
				>
					<div class="card-body p-4">
						<div class="flex items-center gap-4">
							<!-- Organisation Logo/Initial -->
							{#if organisation.logoUrl}
								<img
									src={organisation.logoUrl}
									alt={organisation.name}
									class="h-12 w-12 rounded-lg object-cover"
								/>
							{:else}
								<div
									class="flex h-12 w-12 items-center justify-center rounded-lg text-white text-xl font-bold"
									style="background-color: {organisation.primaryColor}"
								>
									{organisation.name.charAt(0).toUpperCase()}
								</div>
							{/if}

							<!-- Organisation Info -->
							<div class="flex-1 min-w-0">
								<div class="flex items-center gap-2">
									<h3 class="font-semibold truncate">{organisation.name}</h3>
									{#if data.defaultOrganisationId === organisation.id}
										<span class="badge badge-sm badge-primary">Default</span>
									{/if}
								</div>
								<p class="text-sm text-base-content/60 capitalize">{organisation.role}</p>
							</div>

							<!-- Actions -->
							<div class="flex items-center gap-2">
								<!-- Set as default button -->
								{#if data.defaultOrganisationId !== organisation.id}
									<button
										class="btn btn-ghost btn-sm tooltip"
										data-tip="Set as default"
										onclick={() => handleSetDefault(organisation.id)}
										disabled={settingDefault === organisation.id}
									>
										{#if settingDefault === organisation.id}
											<span class="loading loading-spinner loading-xs"></span>
										{:else}
											<Star class="h-4 w-4" />
										{/if}
									</button>
								{/if}

								<!-- Select button -->
								<button
									class="btn btn-primary btn-sm"
									onclick={() => handleSelectOrganisation(organisation.slug)}
								>
									Open
									<ChevronRight class="h-4 w-4" />
								</button>
							</div>
						</div>
					</div>
				</div>
			{/each}
		</div>

		<!-- Create new organisation button -->
		<div class="mt-6">
			<a href="/organisations/create" class="btn btn-outline w-full">
				<Plus class="h-5 w-5" />
				Create New Organisation
			</a>
		</div>
	{/if}
</div>
