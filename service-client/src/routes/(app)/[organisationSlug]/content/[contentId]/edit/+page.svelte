<script lang="ts">
	import type { PageProps } from "./$types";
	import { goto } from "$app/navigation";
	import H5PEditor from "$lib/components/h5p/H5PEditor.svelte";
	import { TriangleAlert } from "lucide-svelte";

	let { data }: PageProps = $props();
</script>

{#if data.courseUsageCount > 1}
	<div class="alert alert-warning mb-4">
		<TriangleAlert class="h-5 w-5" />
		<span>This content is used in <strong>{data.courseUsageCount} courses</strong>. Changes will affect all of them.</span>
	</div>
{/if}

<H5PEditor
	contentId={data.contentId}
	organisationId={data.organisationId}
	contentParams={data.contentParams}
	onSave={() => goto(`/${data.organisation.slug}/content`)}
/>
