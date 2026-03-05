<script lang="ts">
	const steps = [
		{
			title: 'Create Your Organisation',
			description:
				'Pick a name, set your brand colours, and invite your team. Done in under two minutes.'
		},
		{
			title: 'Author Interactive Content',
			description:
				'Browse 40+ H5P content types. Build quizzes, activities, and presentations with the visual editor. Group them into courses.'
		},
		{
			title: 'Share and Deliver',
			description:
				'Give learners a link. They open it in the browser. Content plays, state saves automatically, progress tracked.'
		}
	];

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

<section bind:this={sectionEl} id="how-it-works" class="py-16 md:py-24 bg-base-100">
	<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
		<div
			class="text-center max-w-2xl mx-auto mb-14"
			class:animate-fade-up={visible}
			style:opacity={visible ? undefined : '0'}
		>
			<h2
				class="font-zodiak text-2xl md:text-3xl lg:text-4xl font-bold text-base-content tracking-tight"
			>
				From Sign-Up to<br /><span class="text-primary">First Course in Minutes</span>
			</h2>
		</div>

		<div class="max-w-xl mx-auto">
			{#each steps as step, i}
				<div
					class="flex gap-6 relative"
					class:animate-fade-up={visible && i === 0}
					class:animate-fade-up-delay-1={visible && i === 1}
					class:animate-fade-up-delay-2={visible && i === 2}
					style:opacity={visible ? undefined : '0'}
				>
					<!-- Vertical connector line -->
					{#if i < steps.length - 1}
						<div
							class="absolute left-5 top-12 w-px h-[calc(100%-12px)] bg-gradient-to-b from-primary/30 to-primary/5"
						></div>
					{/if}

					<div class="flex-shrink-0 relative z-10">
						<div
							class="w-10 h-10 rounded-full bg-primary text-primary-content flex items-center justify-center font-bold text-sm shadow-sm"
						>
							{i + 1}
						</div>
					</div>

					<div class="pb-10">
						<h3 class="font-semibold text-base-content text-lg">{step.title}</h3>
						<p class="text-base-content/60 mt-1.5 leading-relaxed text-sm">
							{step.description}
						</p>
					</div>
				</div>
			{/each}
		</div>
	</div>
</section>
