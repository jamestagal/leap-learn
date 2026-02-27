<script lang="ts">
	/**
	 * PasswordField - Password input with visibility toggle
	 */
	import Eye from "lucide-svelte/icons/eye";
	import EyeOff from "lucide-svelte/icons/eye-off";

	interface Props {
		id: string;
		name: string;
		label: string;
		description?: string | undefined;
		placeholder?: string | undefined;
		required?: boolean | undefined;
		disabled?: boolean | undefined;
		error?: string | undefined;
		value?: string | undefined;
		minLength?: number | undefined;
		onchange: (value: string) => void;
	}

	let {
		id,
		name,
		label,
		description,
		placeholder = "Enter password",
		required = false,
		disabled = false,
		error,
		value = "",
		minLength = 8,
		onchange,
	}: Props = $props();

	let showPassword = $state(false);

	function handleInput(e: Event): void {
		const target = e.target as HTMLInputElement;
		onchange(target.value);
	}

	function toggleVisibility(): void {
		showPassword = !showPassword;
	}
</script>

<div class="form-control w-full">
	<label class="label" for={id}>
		<span class="label-text">
			{label}
			{#if required}
				<span class="text-error ml-1">*</span>
			{/if}
		</span>
	</label>

	{#if description}
		<p class="text-xs text-base-content/60 mb-1">{description}</p>
	{/if}

	<div class="relative">
		<input
			{id}
			{name}
			type={showPassword ? "text" : "password"}
			class="input input-bordered w-full pr-10"
			class:input-error={!!error}
			{placeholder}
			{disabled}
			{value}
			minlength={minLength}
			{required}
			oninput={handleInput}
		/>
		<button
			type="button"
			class="absolute right-3 top-1/2 -translate-y-1/2 text-base-content/50 hover:text-base-content"
			onclick={toggleVisibility}
			tabindex={-1}
		>
			{#if showPassword}
				<EyeOff class="h-4 w-4" />
			{:else}
				<Eye class="h-4 w-4" />
			{/if}
		</button>
	</div>

	{#if error}
		<label class="label">
			<span class="label-text-alt text-error">{error}</span>
		</label>
	{/if}
</div>
