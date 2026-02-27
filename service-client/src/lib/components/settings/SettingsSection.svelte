<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		title: string;
		description?: string;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		icon?: any;
		children: Snippet;
	}

	let { title, description, icon: Icon, children }: Props = $props();
</script>

<div class="card bg-base-100 border border-base-300">
	<div class="card-body">
		<div class="flex items-start gap-3 mb-4">
			{#if Icon}
				<div
					class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
				>
					<Icon class="h-5 w-5" />
				</div>
			{/if}
			<div>
				<h3 class="text-lg font-semibold">{title}</h3>
				{#if description}
					<p class="text-sm text-base-content/60">{description}</p>
				{/if}
			</div>
		</div>
		{@render children()}
	</div>
</div>
