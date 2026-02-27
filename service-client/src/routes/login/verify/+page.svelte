<script lang="ts">
	import { env } from "$env/dynamic/public";
	import type { PageData } from "./$types";

	let { data }: { data: PageData } = $props();
	let masked = $derived(data.masked);
</script>

<main class="flex h-full place-items-center">
	<form
		method="POST"
		action={env.PUBLIC_CORE_URL + "/login-verify"}
		class="mx-auto flex w-full max-w-sm flex-col p-4"
	>
		<input type="hidden" name="return_url" value={env.PUBLIC_CLIENT_URL} />
		<h1 class="mb-4 text-center text-lg font-semibold">
			Code has been sent to phone ending with {masked}
		</h1>
		<label class="floating-label">
			<span>Your Code</span>
			<input type="text" name="code" placeholder="123456" required class="input validator w-full" />
			<div class="validator-hint">Enter valid code</div>
		</label>
		<button type="submit" class="btn btn-primary btn-soft mt-2 w-full">Verify Code</button>
	</form>
</main>
