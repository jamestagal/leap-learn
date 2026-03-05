<script lang="ts">
	let scrolled = $state(false);

	$effect(() => {
		const onScroll = () => {
			scrolled = window.scrollY > 20;
		};
		window.addEventListener('scroll', onScroll, { passive: true });
		return () => window.removeEventListener('scroll', onScroll);
	});
</script>

<nav
	class="fixed top-0 left-0 right-0 z-50 transition-all duration-300
		   {scrolled
		? 'bg-base-100/80 backdrop-blur-xl border-b border-base-300/50 shadow-sm'
		: 'bg-transparent'}"
>
	<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
		<div class="flex items-center justify-between h-16">
			<a href="/" class="font-zodiak text-xl font-bold text-base-content tracking-tight">
				LeapLearn
			</a>

			<a
				href="/login"
				class="btn btn-sm btn-primary transition-all duration-150 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]"
			>
				Sign In
			</a>
		</div>
	</div>
</nav>
