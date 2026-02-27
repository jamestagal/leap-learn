<script lang="ts">
	let { crumbs }: { crumbs: { label: string; href?: string }[] } = $props();
</script>

<div class="breadcrumbs text-sm hidden md:block">
	<ul>
		{#each crumbs as crumb}
			<li>
				{#if crumb.href}
					<a href={crumb.href}>{crumb.label}</a>
				{:else}
					<span>{crumb.label}</span>
				{/if}
			</li>
		{/each}
	</ul>
</div>
