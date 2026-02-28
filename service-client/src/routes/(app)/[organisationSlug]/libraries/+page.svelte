<script lang="ts">
	import type { PageProps } from "./$types";
	import LibraryManager from "$lib/components/library/LibraryManager.svelte";

	let { data }: PageProps = $props();
</script>

<LibraryManager
	contentTypes={data.contentTypes}
	installedLibraries={data.installedLibraries}
	hasAdminPermission={data.hasAdminPermission}
/>
