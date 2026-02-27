<script lang="ts">
	import { page } from "$app/state";
	import Loading from "../loading.svelte";
	import { getToast } from "$lib/ui/toast_store.svelte";
	import { env } from "$env/dynamic/public";
	import SvelteSeo from "svelte-seo";

	const toast = getToast();

	let loading = $state(false);
	const error = page.url.searchParams.get("error");
	const send = page.url.searchParams.get("send");

	$effect(() => {
		if (error) {
			if (error === "unauthorized") {
				toast.error("Unauthorized", "You are not authorized to access");
			} else {
				toast.error("Error", "Something went wrong");
			}
		}
		if (send) {
			toast.success("Success", "Check your email for the magic link");
		}
		loading = false;
	});
</script>

<SvelteSeo
	title="Log In — LeapLearn"
	description="Sign in to your LeapLearn organisation account."
	noindex={true}
	nofollow={true}
/>

{#if loading}
	<Loading />
{/if}

<main class="flex min-h-full flex-col items-center justify-center p-10">
	<h2 class="text-center text-2xl font-semibold">Log in to LeapLearn</h2>

	<div class="mx-auto mt-10 flex w-full max-w-sm flex-col gap-4">
		<!-- TODO: Re-enable when GitHub OAuth is configured in .env
		<form method="post" action={env.PUBLIC_CORE_URL + "/login"}>
			<input type="hidden" name="provider" value="github" />
			<input type="hidden" name="return_url" value={env.PUBLIC_CLIENT_URL} />
			<button class="btn btn-primary btn-soft w-full">
				<svg
					width="24"
					height="24"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					class="icon icon-tabler icons-tabler-outline icon-tabler-brand-github"
				>
					<path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
					<path
						d="M9 19c-4.3 1.4 -4.3 -2.5 -6 -3m12 5v-3.5c0 -1 .1 -1.4 -.5 -2c2.8 -.3 5.5 -1.4 5.5 -6a4.6 4.6 0 0 0 -1.3 -3.2a4.2 4.2 0 0 0 -.1 -3.2s-1.1 -.3 -3.5 1.3a12.3 12.3 0 0 0 -6.2 0c-2.4 -1.6 -3.5 -1.3 -3.5 -1.3a4.2 4.2 0 0 0 -.1 3.2a4.6 4.6 0 0 0 -1.3 3.2c0 4.6 2.7 5.7 5.5 6c-.6 .6 -.6 1.2 -.5 2v3.5"
					></path>
				</svg>
				Continue with GitHub
			</button>
		</form>
		-->
		<form method="post" action={env.PUBLIC_CORE_URL + "/login"}>
			<input type="hidden" name="provider" value="google" />
			<input type="hidden" name="return_url" value={env.PUBLIC_CLIENT_URL} />
			<button class="btn btn-primary btn-soft w-full">
				<svg
					width="24"
					height="24"
					viewBox="0 0 24 24"
					fill="currentColor"
					class="icon icon-tabler icons-tabler-filled icon-tabler-brand-google"
				>
					<path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
					<path
						d="M12 2a9.96 9.96 0 0 1 6.29 2.226a1 1 0 0 1 .04 1.52l-1.51 1.362a1 1 0 0 1 -1.265 .06a6 6 0 1 0 2.103 6.836l.001 -.004h-3.66a1 1 0 0 1 -.992 -.883l-.007 -.117v-2a1 1 0 0 1 1 -1h6.945a1 1 0 0 1 .994 .89c.04 .367 .061 .737 .061 1.11c0 5.523 -4.477 10 -10 10s-10 -4.477 -10 -10s4.477 -10 10 -10z"
					></path>
				</svg>
				Continue with Google
			</button>
		</form>
		<div class="relative mt-10">
			<div class="absolute inset-0 flex items-center" aria-hidden="true">
				<div class="border-base-300 w-full border-b"></div>
			</div>
			<div class="relative flex justify-center text-sm font-medium">
				<span class="bg-base-100 px-6">Or continue with email</span>
			</div>
		</div>
		<form method="post" action={env.PUBLIC_CORE_URL + "/login"} class="flex flex-col gap-6">
			<input type="hidden" name="provider" value="email" />
			<input type="hidden" name="return_url" value={env.PUBLIC_CLIENT_URL} />

			<label class="floating-label col-span-2">
				<span>Email</span>
				<input
					name="email"
					type="email"
					autocomplete="email"
					placeholder="Email"
					class="input validator w-full"
					required
					maxlength={100}
				/>
				<div class="validator-hint">Enter valid email</div>
			</label>
			<button class="btn btn-soft w-full">Send Magic Link</button>
		</form>
	</div>
</main>
