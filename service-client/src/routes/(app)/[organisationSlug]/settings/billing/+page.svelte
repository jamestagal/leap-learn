<script lang="ts">
	import { page } from '$app/state';
	import { invalidateAll } from '$app/navigation';
	import {
		CreditCard,
		Crown,
		Sparkles,
		Users,
		Zap,
		Check,
		ExternalLink
	} from 'lucide-svelte';
	import { getToast } from '$lib/ui/toast_store.svelte';
	import {
		createCheckoutSession,
		createPortalSession,
		upgradeSubscription
	} from '$lib/api/billing.remote';
	import { formatDate } from '$lib/utils/formatting';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const toast = getToast();
	let organisationSlug = $derived(data.organisation.slug);
	let billingInfo = $derived(data.billingInfo);
	let usageStats = $derived(data.usageStats);

	// Check if we just completed checkout (server already synced via idempotent endpoint)
	let hasShownCheckoutResult = $state(false);

	$effect(() => {
		if (hasShownCheckoutResult) return;

		const urlParams = page.url.searchParams;
		const success = urlParams.get('success') === 'true';
		const canceled = urlParams.get('canceled') === 'true';

		if (success) {
			hasShownCheckoutResult = true;
			// Server-side load already synced via idempotent getBillingInfo with sessionId
			// Just show success message and clean up URL
			const tier = billingInfo?.tier || 'your new plan';
			toast.success(`Successfully upgraded to ${tier.charAt(0).toUpperCase() + tier.slice(1)}!`);
			history.replaceState(null, '', `/${organisationSlug}/settings/billing`);
		} else if (canceled) {
			hasShownCheckoutResult = true;
			toast.info('Checkout was canceled');
			history.replaceState(null, '', `/${organisationSlug}/settings/billing`);
		}
	});

	// Billing interval toggle
	let billingInterval = $state<'month' | 'year'>('year');

	// Loading states
	let isUpgrading = $state<string | null>(null);
	let isOpeningPortal = $state(false);

	// Pricing data
	const tiers = [
		{
			id: 'starter',
			name: 'Starter',
			description: 'Perfect for individual educators and small teams',
			monthlyPrice: 29,
			yearlyPrice: 290,
			features: [
				'3 team members',
				'25 AI generations/month',
				'5 templates',
				'100 MB storage',
				'H5P content creation',
				'Basic analytics'
			]
		},
		{
			id: 'growth',
			name: 'Growth',
			description: 'For growing organisations with more learners',
			monthlyPrice: 79,
			yearlyPrice: 790,
			popular: true,
			features: [
				'10 team members',
				'100 AI generations/month',
				'20 templates',
				'10 GB storage',
				'Custom branding',
				'Analytics',
				'White label',
				'API access'
			]
		},
		{
			id: 'enterprise',
			name: 'Enterprise',
			description: 'For large organisations with advanced needs',
			monthlyPrice: 199,
			yearlyPrice: 1990,
			features: [
				'Unlimited team members',
				'Unlimited AI generations',
				'Unlimited templates',
				'Unlimited storage',
				'Priority support',
				'Custom domain',
				'SSO integration',
				'Everything in Growth'
			]
		}
	];

	// Get current tier from billing info or usage stats
	let currentTier = $derived(billingInfo?.tier || usageStats.tier || 'free');
	let isFreemium = $derived(billingInfo?.isFreemium || false);
	// Check if organisation has an actual Stripe subscription (not just manually set tier)
	let hasActiveSubscription = $derived(!!billingInfo?.subscriptionId);

	// Format price based on interval
	function formatPrice(tier: (typeof tiers)[0]) {
		const price = billingInterval === 'month' ? tier.monthlyPrice : tier.yearlyPrice;
		return new Intl.NumberFormat('en-AU', {
			style: 'currency',
			currency: 'AUD',
			minimumFractionDigits: 0
		}).format(price);
	}

	// Check if tier is an upgrade
	function isUpgrade(tierId: string): boolean {
		const tierOrder = ['free', 'starter', 'growth', 'enterprise'];
		const currentIndex = tierOrder.indexOf(currentTier);
		const targetIndex = tierOrder.indexOf(tierId);
		return targetIndex > currentIndex;
	}

	// Handle upgrade click
	async function handleUpgrade(tierId: string) {
		if (isUpgrading) return;

		isUpgrading = tierId;
		try {
			// If user has no active subscription, use checkout (need to capture payment method)
			// If user already has a paid subscription, use upgrade API (proration)
			if (!hasActiveSubscription) {
				const result = await createCheckoutSession({
					tier: tierId as 'starter' | 'growth' | 'enterprise',
					interval: billingInterval
				});

				if (result.url) {
					window.location.href = result.url;
				}
			} else {
				// Existing subscriber - upgrade with proration
				await upgradeSubscription({
					tier: tierId as 'starter' | 'growth' | 'enterprise',
					interval: billingInterval
				});

				toast.success('Plan upgraded! Your card will be charged the prorated amount.');
				// Refresh page data to show new tier (webhook will update DB)
				await invalidateAll();
			}
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Failed to upgrade plan');
		} finally {
			isUpgrading = null;
		}
	}

	// Handle manage billing click
	async function handleManageBilling() {
		if (isOpeningPortal) return;

		isOpeningPortal = true;
		try {
			const result = await createPortalSession();

			if (result.url) {
				window.location.href = result.url;
			}
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Failed to open billing portal');
		} finally {
			isOpeningPortal = false;
		}
	}

	// Format usage display
	function formatUsage(current: number, limit: number): string {
		if (limit === -1) return `${current} / Unlimited`;
		return `${current} / ${limit}`;
	}
</script>

<svelte:head>
	<title>Billing & Subscription | {data.organisation.name}</title>
</svelte:head>

<div class="space-y-6">
	<div>
		<h1 class="text-2xl font-bold">Billing & Subscription</h1>
		<p class="text-base-content/70 mt-1">Manage your LeapLearn subscription and billing</p>
	</div>

	<!-- Freemium Banner -->
	{#if isFreemium}
		<div class="alert alert-info">
			<Sparkles class="h-5 w-5" />
			<div>
				<h3 class="font-bold">Beta Access</h3>
				<p class="text-sm">
					You have free access to all features during the beta period.
					{#if billingInfo?.freemiumExpiresAt}
						Beta access expires on {formatDate(billingInfo.freemiumExpiresAt, 'long')}.
					{/if}
				</p>
			</div>
		</div>
	{/if}

	<!-- Current Plan -->
	<div class="card bg-base-100 border border-base-300">
		<div class="card-body">
			<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
				<div>
					<h2 class="card-title text-lg">
						<Crown class="h-5 w-5 text-primary" />
						Current Plan
					</h2>
					<div class="mt-2 flex items-center gap-2">
						<span class="badge badge-lg badge-primary capitalize">{currentTier}</span>
						{#if isFreemium}
							<span class="badge badge-info">Beta</span>
						{/if}
					</div>
					{#if billingInfo?.subscriptionEnd && !isFreemium}
						<p class="text-sm text-base-content/60 mt-2">
							{currentTier === 'free' ? 'Free forever' : `Renews on ${formatDate(billingInfo.subscriptionEnd)}`}
						</p>
					{/if}
				</div>

				{#if billingInfo?.stripeCustomerId && currentTier !== 'free'}
					<button
						type="button"
						class="btn btn-outline"
						onclick={handleManageBilling}
						disabled={isOpeningPortal}
					>
						{#if isOpeningPortal}
							<span class="loading loading-spinner loading-sm"></span>
						{:else}
							<ExternalLink class="h-4 w-4" />
						{/if}
						Manage Billing
					</button>
				{/if}
			</div>
		</div>
	</div>

	<!-- Usage Stats -->
	<div class="card bg-base-100 border border-base-300">
		<div class="card-body">
			<h2 class="card-title text-lg mb-4">Usage This Month</h2>

			<div class="grid gap-4 sm:grid-cols-2">
				<!-- Members -->
				<div class="space-y-2">
					<div class="flex items-center justify-between text-sm">
						<span class="flex items-center gap-2">
							<Users class="h-4 w-4 text-base-content/60" />
							Team Members
						</span>
						<span class="font-medium">
							{formatUsage(usageStats.usage.members.current, usageStats.usage.members.limit)}
						</span>
					</div>
					<progress
						class="progress progress-primary w-full"
						value={usageStats.usage.members.percentage}
						max="100"
					></progress>
				</div>

				<!-- AI Generations -->
				<div class="space-y-2">
					<div class="flex items-center justify-between text-sm">
						<span class="flex items-center gap-2">
							<Zap class="h-4 w-4 text-base-content/60" />
							AI Generations
						</span>
						<span class="font-medium">
							{formatUsage(
								usageStats.usage.aiGenerationsThisMonth.current,
								usageStats.usage.aiGenerationsThisMonth.limit
							)}
						</span>
					</div>
					<progress
						class="progress progress-primary w-full"
						value={usageStats.usage.aiGenerationsThisMonth.percentage}
						max="100"
					></progress>
				</div>
			</div>
		</div>
	</div>

	<!-- Pricing Plans -->
	{#if currentTier !== 'enterprise' && !isFreemium}
		<div class="card bg-base-100 border border-base-300">
			<div class="card-body">
				<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
					<h2 class="card-title text-lg">Upgrade Your Plan</h2>

					<!-- Billing Interval Toggle -->
					<div class="flex items-center gap-2 bg-base-200 rounded-lg p-1">
						<button
							type="button"
							class="btn btn-sm {billingInterval === 'month' ? 'btn-primary' : 'btn-ghost'}"
							onclick={() => (billingInterval = 'month')}
						>
							Monthly
						</button>
						<button
							type="button"
							class="btn btn-sm {billingInterval === 'year' ? 'btn-primary' : 'btn-ghost'}"
							onclick={() => (billingInterval = 'year')}
						>
							Yearly
							<span class="badge badge-success badge-sm ml-1">Save 17%</span>
						</button>
					</div>
				</div>

				<div class="grid gap-4 lg:grid-cols-3">
					{#each tiers as tier (tier.id)}
						{@const isCurrent = tier.id === currentTier}
						{@const canUpgrade = isUpgrade(tier.id)}

						<div
							class="card border {tier.popular
								? 'border-primary'
								: 'border-base-300'} {isCurrent ? 'bg-base-200/50' : 'bg-base-100'}"
						>
							{#if tier.popular}
								<div class="absolute -top-3 left-1/2 -translate-x-1/2">
									<span class="badge badge-primary">Most Popular</span>
								</div>
							{/if}

							<div class="card-body">
								<h3 class="font-bold text-lg">{tier.name}</h3>
								<p class="text-sm text-base-content/60">{tier.description}</p>

								<div class="mt-4">
									<span class="text-3xl font-bold">{formatPrice(tier)}</span>
									<span class="text-base-content/60">
										/{billingInterval === 'month' ? 'mo' : 'yr'}
									</span>
								</div>

								<ul class="mt-4 space-y-2">
									{#each tier.features as feature}
										<li class="flex items-center gap-2 text-sm">
											<Check class="h-4 w-4 text-success flex-shrink-0" />
											{feature}
										</li>
									{/each}
								</ul>

								<div class="mt-6">
									{#if isCurrent}
										<button type="button" class="btn btn-disabled w-full" disabled>
											Current Plan
										</button>
									{:else if canUpgrade}
										<button
											type="button"
											class="btn {tier.popular ? 'btn-primary' : 'btn-outline'} w-full"
											onclick={() => handleUpgrade(tier.id)}
											disabled={isUpgrading !== null}
										>
											{#if isUpgrading === tier.id}
												<span class="loading loading-spinner loading-sm"></span>
											{:else}
												<CreditCard class="h-4 w-4" />
											{/if}
											Upgrade
										</button>
									{:else}
										<button type="button" class="btn btn-ghost w-full" disabled>
											<Check class="h-4 w-4" />
											Included
										</button>
									{/if}
								</div>
							</div>
						</div>
					{/each}
				</div>
			</div>
		</div>
	{/if}

	<!-- FAQ / Help -->
	<div class="card bg-base-100 border border-base-300">
		<div class="card-body">
			<h2 class="card-title text-lg">Billing FAQ</h2>

			<div class="mt-4 space-y-4">
				<div>
					<h3 class="font-medium">Can I cancel anytime?</h3>
					<p class="text-sm text-base-content/60 mt-1">
						Yes, you can cancel your subscription at any time. You'll continue to have access until
						the end of your billing period.
					</p>
				</div>

				<div>
					<h3 class="font-medium">What happens if I exceed my limits?</h3>
					<p class="text-sm text-base-content/60 mt-1">
						You won't be able to use AI generations until your limits reset
						at the start of the next month, or until you upgrade your plan.
					</p>
				</div>

				<div>
					<h3 class="font-medium">Do you offer refunds?</h3>
					<p class="text-sm text-base-content/60 mt-1">
						We offer a 14-day money-back guarantee for all paid plans. Contact support if you're
						not satisfied.
					</p>
				</div>

				<div>
					<h3 class="font-medium">Need help?</h3>
					<p class="text-sm text-base-content/60 mt-1">
						Contact us at <a href="mailto:support@leaplearn.au" class="link">support@leaplearn.au</a> for
						any billing questions.
					</p>
				</div>
			</div>
		</div>
	</div>
</div>
