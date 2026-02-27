<script lang="ts">
	type Props = {
		name: string;
		label: string;
		accept: string;
		error?: string;
		helper?: string;
		required?: boolean;
	};

	let { name, label, accept, error, helper, required }: Props = $props();
</script>

<div class="w-full">
	<label for={name} class="mb-2 block text-sm font-medium">
		{label}
	</label>
	<input
		{name}
		id={name}
		{accept}
		{required}
		type="file"
		multiple={true}
		class={" block w-full cursor-pointer rounded-sm border-0 bg-gray-800 text-sm shadow-md focus:ring-2 focus:ring-gray-600 focus:ring-inset " +
			" file:mr-3 file:cursor-pointer file:rounded-l file:border-0 file:bg-gray-600 file:px-3 file:py-1.5 file:text-white file:transition file:hover:bg-gray-500 " +
			(error ? "ring-2 ring-red-600" : "")}
		aria-invalid={!!error}
		aria-describedby={`${name}-description`}
	/>
	{#if helper}
		<p id={`${name}-description`} class="mt-2 block text-sm text-gray-400">
			{helper}
		</p>
	{/if}
	{#if error}
		<p class="mt-2 block text-sm text-red-600">{error}</p>
	{/if}
</div>
