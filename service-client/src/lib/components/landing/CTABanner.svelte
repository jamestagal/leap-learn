<script lang="ts">
	let sectionEl: HTMLElement | undefined = $state();
	let visible = $state(false);

	$effect(() => {
		if (!sectionEl) return;
		const obs = new IntersectionObserver(
			(entries) => {
				if (entries[0]?.isIntersecting) visible = true;
			},
			{ threshold: 0.15 }
		);
		obs.observe(sectionEl);
		return () => obs.disconnect();
	});
</script>

<section bind:this={sectionEl} class="py-16 md:py-24 px-4 sm:px-6 lg:px-8">
	<div
		class="max-w-4xl mx-auto rounded-3xl bg-primary text-primary-content p-10 md:p-14 text-center relative overflow-hidden"
		class:animate-fade-up={visible}
		style:opacity={visible ? undefined : '0'}
	>
		<!-- Subtle radial glow overlay -->
		<div
			class="absolute inset-0 pointer-events-none"
			style="background: radial-gradient(ellipse at 50% 0%, oklch(1 0 0 / 0.08) 0%, transparent 60%)"
		></div>

		<div class="relative">
			<h2 class="font-zodiak text-2xl md:text-4xl font-bold tracking-tight">
				Start Building Interactive Courses Today
			</h2>
			<p class="mt-5 opacity-75 max-w-lg mx-auto leading-relaxed">
				Free to get started. No credit card required.
			</p>
			<a
				href="/login"
				class="btn mt-8 px-8 border-0 transition-all duration-150 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]"
				style="background-color: var(--color-base-100); color: var(--color-base-content); opacity: 0.95"
			>
				Create Your Free Account
			</a>
		</div>
	</div>
</section>
