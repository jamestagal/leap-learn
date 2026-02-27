<script>
	import { env } from "$env/dynamic/public";
</script>

<main class="flex h-full place-items-center">
	<form
		method="POST"
		action={env.PUBLIC_CORE_URL + "/login-phone"}
		class="mx-auto flex w-full max-w-sm flex-col p-4"
	>
		<input type="hidden" name="return_url" value={env.PUBLIC_CLIENT_URL} />
		<h1 class="mb-4 text-center text-lg font-semibold">Add your phone number for 2FA</h1>
		<label class="floating-label">
			<span>Your Phone Number</span>
			<input
				type="text"
				name="phone"
				placeholder="+1234567890"
				required
				class="input validator w-full"
			/>
			<div class="validator-hint">Enter valid phone number (e.g. +1234567890)</div>
		</label>
		<button type="submit" class="btn btn-primary btn-soft mt-2 w-full">Send Code</button>
	</form>
</main>
