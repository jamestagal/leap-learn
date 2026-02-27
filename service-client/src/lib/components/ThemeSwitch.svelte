<script>
	import { onMount } from "svelte";
	import { Moon, Sun, Palette, Loader2 } from "lucide-svelte";
	import { getContext } from "svelte";

	let mounted = $state(false);
	let theme = getContext("theme");

	onMount(() => {
		mounted = true;
	});

	function toggleTheme() {
		theme.set(theme.current === "dark" ? "light" : "dark");
	}
</script>

<div class="flex h-[26px] w-[40px] items-center justify-center">
	{#if mounted}
		<button
			type="button"
			name="theme-switch"
			onclick={toggleTheme}
			class="bg-primary-3 relative m-0 h-full w-full scale-100 cursor-pointer rounded-full p-0
     transition-all duration-100 focus:outline-none active:scale-90"
		>
			<div
				class="absolute h-[20px] w-[20px] transform transition-transform duration-200 ease-in-out {theme.current ===
				'dark'
					? 'translate-x-[16px]'
					: 'translate-x-[4px]'} bg-main top-[3px] flex items-center justify-center overflow-hidden rounded-full shadow-md"
			>
				{#if theme.current !== "light" && theme.current !== "dark"}
					<Palette
						size={14}
						class="text-secondary-3 absolute opacity-100 transition-opacity duration-200"
					/>
				{/if}
				<Sun
					size={14}
					class="text-primary-accent absolute transition-opacity duration-200 {theme.current ===
					'light'
						? 'opacity-100'
						: 'opacity-0'}"
				/>
				<Moon
					size={14}
					class="text-primary-accent absolute transition-opacity duration-200 {theme.current ===
					'dark'
						? 'opacity-100'
						: 'opacity-0'}"
				/>
			</div>
		</button>
	{:else}
		<Loader2
			size={18}
			strokeWidth={3}
			class="text-primary-accent animate-spin transition-opacity duration-200"
		/>
	{/if}
</div>
