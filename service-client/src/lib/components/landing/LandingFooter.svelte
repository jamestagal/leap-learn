<script lang="ts">
	const year = new Date().getFullYear();
</script>

<footer class="border-t border-base-300/50 bg-base-100">
	<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
		<div class="flex flex-col sm:flex-row items-center justify-between gap-6">
			<div class="text-center sm:text-left">
				<p class="font-zodiak text-xl font-bold text-base-content tracking-tight">LeapLearn</p>
				<p class="text-sm text-base-content/40 mt-1">Interactive learning, simplified.</p>
			</div>
			<div class="flex items-center gap-6 text-sm">
				<a
					href="/login"
					class="text-base-content/50 hover:text-primary transition-colors duration-200"
				>
					Sign In
				</a>
				<span class="text-base-content/15">|</span>
				<span class="text-base-content/40">&copy; {year} LeapLearn</span>
			</div>
		</div>
	</div>
</footer>
