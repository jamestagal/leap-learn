<script lang="ts">
	import LandingNav from './LandingNav.svelte';
	import HeroSection from './HeroSection.svelte';
	import FeaturesGrid from './FeaturesGrid.svelte';
	import HowItWorks from './HowItWorks.svelte';
	import CTABanner from './CTABanner.svelte';
	import LandingFooter from './LandingFooter.svelte';
</script>

<div class="min-h-screen bg-base-100 font-poppins">
	<LandingNav />

	<main>
		<HeroSection />
		<FeaturesGrid />
		<HowItWorks />
		<CTABanner />
	</main>

	<LandingFooter />
</div>
