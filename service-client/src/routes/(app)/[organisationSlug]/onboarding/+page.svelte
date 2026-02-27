<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { getToast } from '$lib/ui/toast_store.svelte';
	import { updateOrganisationProfile, ensureOrganisationProfile } from '$lib/api/organisation-profile.remote';
	import {
		Building2, Palette, Rocket,
		ChevronRight, ChevronLeft, Check, ExternalLink, ArrowRight,
		BookOpen, GraduationCap, Users
	} from 'lucide-svelte';

	let { data } = $props();

	const toast = getToast();
	let currentStep = $state(0);
	let isSaving = $state(false);

	const steps = [
		{ label: 'Business', icon: Building2 },
		{ label: 'Branding', icon: Palette },
		{ label: 'Explore', icon: Rocket },
	];

	// Step 1: Business Profile fields
	let legalEntityName = $state(data.profile?.legalEntityName ?? '');
	let tradingName = $state(data.profile?.tradingName ?? '');
	let abn = $state(data.profile?.abn ?? '');
	let addressLine1 = $state(data.profile?.addressLine1 ?? '');
	let city = $state(data.profile?.city ?? '');
	let stateField = $state(data.profile?.state ?? '');
	let postcode = $state(data.profile?.postcode ?? '');

	// Step 2: Branding fields
	let tagline = $state(data.profile?.tagline ?? '');

	async function saveBusinessProfile() {
		isSaving = true;
		try {
			await ensureOrganisationProfile({});
			await updateOrganisationProfile({
				legalEntityName,
				tradingName,
				abn,
				addressLine1,
				city,
				state: stateField,
				postcode,
			});
			toast.success('Business profile saved');
			currentStep = 1;
		} catch (err) {
			toast.error('Failed to save profile');
			console.error(err);
		} finally {
			isSaving = false;
		}
	}

	async function saveBranding() {
		isSaving = true;
		try {
			await updateOrganisationProfile({ tagline });
			toast.success('Branding saved');
			currentStep = 2;
		} catch (err) {
			toast.error('Failed to save branding');
			console.error(err);
		} finally {
			isSaving = false;
		}
	}

	async function completeOnboarding() {
		isSaving = true;
		try {
			const { markOnboardingComplete } = await import('$lib/api/organisation-profile.remote');
			await markOnboardingComplete({});
			toast.success('Welcome aboard! Your organisation is ready.');
			await invalidateAll();
			goto(`/${data.organisation.slug}`);
		} catch (err) {
			toast.error('Failed to complete onboarding');
			console.error(err);
		} finally {
			isSaving = false;
		}
	}
</script>

<svelte:head>
	<title>Set Up Your Organisation - {data.organisation.name}</title>
</svelte:head>

<div class="max-w-2xl mx-auto py-8 space-y-8">
	<!-- Header -->
	<div class="text-center">
		<h1 class="text-2xl font-bold">Set Up Your Organisation</h1>
		<p class="text-base-content/60 mt-1">Let's get everything configured so you can start creating content.</p>
	</div>

	<!-- Step indicator -->
	<ul class="steps steps-horizontal w-full">
		{#each steps as step, i}
			<li class="step" class:step-primary={i <= currentStep}>
				<span class="text-xs">{step.label}</span>
			</li>
		{/each}
	</ul>

	<!-- Step Content -->
	<div class="card bg-base-100 border border-base-300">
		<div class="card-body">
			{#if currentStep === 0}
				<!-- Step 1: Business Profile -->
				<div class="flex items-center gap-2 mb-4">
					<Building2 class="h-5 w-5 text-primary" />
					<h2 class="card-title text-lg">Business Profile</h2>
				</div>
				<p class="text-sm text-base-content/60 mb-4">Basic details about your organisation.</p>

				<div class="space-y-4">
					<div class="grid gap-4 sm:grid-cols-2">
						<label class="form-control w-full">
							<div class="label"><span class="label-text">Legal Entity Name</span></div>
							<input type="text" class="input input-bordered w-full" bind:value={legalEntityName} placeholder="Your Pty Ltd" />
						</label>
						<label class="form-control w-full">
							<div class="label"><span class="label-text">Trading Name</span></div>
							<input type="text" class="input input-bordered w-full" bind:value={tradingName} placeholder="Your Organisation" />
						</label>
					</div>
					<label class="form-control w-full">
						<div class="label"><span class="label-text">ABN</span></div>
						<input type="text" class="input input-bordered w-full" bind:value={abn} placeholder="12 345 678 901" />
					</label>
					<label class="form-control w-full">
						<div class="label"><span class="label-text">Street Address</span></div>
						<input type="text" class="input input-bordered w-full" bind:value={addressLine1} placeholder="123 Main Street" />
					</label>
					<div class="grid gap-4 sm:grid-cols-3">
						<label class="form-control w-full">
							<div class="label"><span class="label-text">City</span></div>
							<input type="text" class="input input-bordered w-full" bind:value={city} placeholder="Sydney" />
						</label>
						<label class="form-control w-full">
							<div class="label"><span class="label-text">State</span></div>
							<input type="text" class="input input-bordered w-full" bind:value={stateField} placeholder="NSW" />
						</label>
						<label class="form-control w-full">
							<div class="label"><span class="label-text">Postcode</span></div>
							<input type="text" class="input input-bordered w-full" bind:value={postcode} placeholder="2000" />
						</label>
					</div>
				</div>

				<div class="card-actions justify-end mt-6">
					<button class="btn btn-primary gap-1" onclick={saveBusinessProfile} disabled={isSaving}>
						{#if isSaving}<span class="loading loading-spinner loading-xs"></span>{/if}
						Next <ChevronRight class="h-4 w-4" />
					</button>
				</div>

			{:else if currentStep === 1}
				<!-- Step 2: Branding -->
				<div class="flex items-center gap-2 mb-4">
					<Palette class="h-5 w-5 text-primary" />
					<h2 class="card-title text-lg">Branding</h2>
				</div>
				<p class="text-sm text-base-content/60 mb-4">Customize how your organisation looks to learners.</p>

				<div class="space-y-4">
					<div class="flex items-center gap-4 p-4 bg-base-200 rounded-lg">
						{#if data.organisationDetails?.logoUrl}
							<img src={data.organisationDetails.logoUrl} alt="Organisation logo" class="h-12 w-12 rounded-lg object-cover" />
							<div>
								<p class="text-sm font-medium">Logo uploaded</p>
								<a href="/{data.organisation.slug}/settings/branding" class="text-xs text-primary hover:underline">Change logo</a>
							</div>
						{:else}
							<div class="h-12 w-12 rounded-lg bg-base-300 flex items-center justify-center">
								<Palette class="h-6 w-6 text-base-content/30" />
							</div>
							<div>
								<p class="text-sm font-medium">No logo yet</p>
								<a href="/{data.organisation.slug}/settings/branding" class="text-xs text-primary hover:underline flex items-center gap-1">
									Upload in settings <ExternalLink class="h-3 w-3" />
								</a>
							</div>
						{/if}
					</div>

					<label class="form-control w-full">
						<div class="label"><span class="label-text">Tagline</span></div>
						<input type="text" class="input input-bordered w-full" bind:value={tagline} placeholder="Your organisation's tagline" />
					</label>

					<div class="flex items-center gap-2 p-3 bg-base-200/50 rounded-lg">
						<div class="h-6 w-6 rounded-full" style="background-color: {data.organisation.primaryColor}"></div>
						<span class="text-sm">Brand color: {data.organisation.primaryColor}</span>
						<a href="/{data.organisation.slug}/settings/branding" class="text-xs text-primary hover:underline ml-auto">Customize</a>
					</div>
				</div>

				<div class="card-actions justify-between mt-6">
					<button class="btn btn-ghost gap-1" onclick={() => currentStep = 0}>
						<ChevronLeft class="h-4 w-4" /> Back
					</button>
					<button class="btn btn-primary gap-1" onclick={saveBranding} disabled={isSaving}>
						{#if isSaving}<span class="loading loading-spinner loading-xs"></span>{/if}
						Next <ChevronRight class="h-4 w-4" />
					</button>
				</div>

			{:else if currentStep === 2}
				<!-- Step 3: Explore -->
				<div class="flex items-center gap-2 mb-4">
					<Rocket class="h-5 w-5 text-primary" />
					<h2 class="card-title text-lg">You're All Set!</h2>
				</div>
				<p class="text-sm text-base-content/60 mb-4">Your organisation is configured. Here's what you can do next:</p>

				<div class="grid gap-3 sm:grid-cols-2">
					<a href="/{data.organisation.slug}/content" class="flex items-center gap-3 p-3 rounded-lg border border-base-300 hover:bg-base-200 transition-colors">
						<BookOpen class="h-5 w-5 text-indigo-500" />
						<div>
							<p class="text-sm font-medium">Create Content</p>
							<p class="text-xs text-base-content/50">Build interactive H5P content</p>
						</div>
						<ArrowRight class="h-4 w-4 ml-auto text-base-content/30" />
					</a>
					<a href="/{data.organisation.slug}/courses" class="flex items-center gap-3 p-3 rounded-lg border border-base-300 hover:bg-base-200 transition-colors">
						<GraduationCap class="h-5 w-5 text-violet-500" />
						<div>
							<p class="text-sm font-medium">Create a Course</p>
							<p class="text-xs text-base-content/50">Organise content into courses</p>
						</div>
						<ArrowRight class="h-4 w-4 ml-auto text-base-content/30" />
					</a>
					<a href="/{data.organisation.slug}/settings" class="flex items-center gap-3 p-3 rounded-lg border border-base-300 hover:bg-base-200 transition-colors">
						<Users class="h-5 w-5 text-emerald-500" />
						<div>
							<p class="text-sm font-medium">Invite Team Members</p>
							<p class="text-xs text-base-content/50">Collaborate with your team</p>
						</div>
						<ArrowRight class="h-4 w-4 ml-auto text-base-content/30" />
					</a>
				</div>

				<div class="card-actions justify-between mt-6">
					<button class="btn btn-ghost gap-1" onclick={() => currentStep = 1}>
						<ChevronLeft class="h-4 w-4" /> Back
					</button>
					<button class="btn btn-primary gap-1" onclick={completeOnboarding} disabled={isSaving}>
						{#if isSaving}<span class="loading loading-spinner loading-xs"></span>{/if}
						Complete Setup <Check class="h-4 w-4" />
					</button>
				</div>
			{/if}
		</div>
	</div>
</div>
