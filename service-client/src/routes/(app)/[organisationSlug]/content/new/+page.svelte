<script lang="ts">
	import type { PageProps } from "./$types";
	import { goto } from "$app/navigation";
	import H5PEditor from "$lib/components/h5p/H5PEditor.svelte";

	let { data }: PageProps = $props();
	let contentId = crypto.randomUUID();
</script>

<H5PEditor
	{contentId}
	organisationId={data.organisationId}
	onSave={() => goto(`/${data.organisation.slug}/content`)}
/>
