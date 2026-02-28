<script lang="ts">
	import type { PageProps } from "./$types";
	import { goto } from "$app/navigation";
	import H5PEditor from "$lib/components/h5p/H5PEditor.svelte";

	let { data }: PageProps = $props();
</script>

<H5PEditor
	contentId={data.contentId}
	organisationId={data.organisationId}
	contentParams={data.contentParams}
	onSave={() => goto(`/${data.organisation.slug}/content`)}
/>
