<script lang="ts">
	import { env } from '$env/dynamic/public';
	import { page } from '$app/state';
	import { formatDate } from '$lib/utils/formatting';

	let { data } = $props();

	let showOAuthOptions = $state(false);

	// Check if we're returning from a magic link send (Core redirects back with ?send=true)
	let magicLinkSent = $derived(page.url.searchParams.get('send') === 'true');
</script>

<svelte:head>
	<title>{data.valid ? "You're Invited to WebKit Beta!" : 'Invalid Invite'} | WebKit</title>
</svelte:head>

<main class="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-indigo-50 to-purple-50 p-6">
	<div class="w-full max-w-md">
		{#if data.valid}
			<!-- Valid invite -->
			<div class="rounded-2xl bg-white p-8 shadow-xl">
				<div class="mb-6 text-center">
					<div
						class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-500"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="h-8 w-8 text-white"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
							/>
						</svg>
					</div>
					<h1 class="mb-2 text-2xl font-bold text-gray-900">You're Invited!</h1>
					<p class="text-gray-600">Welcome to the WebKit beta program</p>
				</div>

				<div class="mb-6 rounded-xl bg-indigo-50 p-4">
					<p class="text-sm text-gray-600">Invite for:</p>
					<p class="font-semibold text-indigo-700">{data.email}</p>
				</div>

				<div class="mb-6 space-y-3">
					<div class="flex items-start gap-3">
						<div class="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-green-100">
							<svg class="h-4 w-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
								<path
									fill-rule="evenodd"
									d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
									clip-rule="evenodd"
								/>
							</svg>
						</div>
						<div>
							<p class="font-medium text-gray-900">Full Enterprise Access</p>
							<p class="text-sm text-gray-500">Unlimited consultations, proposals, and contracts</p>
						</div>
					</div>
					<div class="flex items-start gap-3">
						<div class="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-green-100">
							<svg class="h-4 w-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
								<path
									fill-rule="evenodd"
									d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
									clip-rule="evenodd"
								/>
							</svg>
						</div>
						<div>
							<p class="font-medium text-gray-900">Completely Free</p>
							<p class="text-sm text-gray-500">No payment required as a thank you for your feedback</p>
						</div>
					</div>
					<div class="flex items-start gap-3">
						<div class="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-green-100">
							<svg class="h-4 w-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
								<path
									fill-rule="evenodd"
									d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
									clip-rule="evenodd"
								/>
							</svg>
						</div>
						<div>
							<p class="font-medium text-gray-900">Priority Support</p>
							<p class="text-sm text-gray-500">Direct access to the founding team</p>
						</div>
					</div>
				</div>

				{#if magicLinkSent}
					<!-- Magic link sent state -->
					<div class="rounded-xl bg-green-50 p-6 text-center">
						<div class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
							<svg class="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
							</svg>
						</div>
						<h3 class="font-semibold text-green-800">Check your email!</h3>
						<p class="mt-1 text-sm text-green-700">We sent a magic link to <strong>{data.email}</strong></p>
						<p class="mt-2 text-xs text-green-600">Click the link in your email to complete sign up</p>
					</div>
				{:else}
					<!-- Primary action: Magic Link (since we know the email) -->
					<div class="space-y-4">
						<form
							method="post"
							action={env.PUBLIC_CORE_URL + '/login'}
						>
							<input type="hidden" name="provider" value="email" />
							<input type="hidden" name="email" value={data.email} />
							<input type="hidden" name="return_url" value={env.PUBLIC_CLIENT_URL + '/organisations/create?invite=true'} />
							<button class="btn btn-primary w-full">
								<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
								</svg>
								Get Started with Magic Link
							</button>
						</form>

						<p class="text-center text-xs text-gray-500">
							We'll send a secure login link to {data.email}
						</p>

						<!-- OAuth alternatives (collapsible) -->
						<div class="pt-2">
							{#if showOAuthOptions}
								<div class="relative">
									<div class="absolute inset-0 flex items-center" aria-hidden="true">
										<div class="w-full border-b border-gray-200"></div>
									</div>
									<div class="relative flex justify-center text-xs">
										<span class="bg-white px-3 text-gray-500">Or use a linked account</span>
									</div>
								</div>

								<div class="mt-4 grid grid-cols-2 gap-3">
									<form method="post" action={env.PUBLIC_CORE_URL + '/login'}>
										<input type="hidden" name="provider" value="google" />
										<input type="hidden" name="return_url" value={env.PUBLIC_CLIENT_URL + '/organisations/create?invite=true'} />
										<button class="btn btn-outline btn-sm w-full">
											<svg class="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
												<path
													d="M12 2a9.96 9.96 0 0 1 6.29 2.226a1 1 0 0 1 .04 1.52l-1.51 1.362a1 1 0 0 1 -1.265 .06a6 6 0 1 0 2.103 6.836l.001 -.004h-3.66a1 1 0 0 1 -.992 -.883l-.007 -.117v-2a1 1 0 0 1 1 -1h6.945a1 1 0 0 1 .994 .89c.04 .367 .061 .737 .061 1.11c0 5.523 -4.477 10 -10 10s-10 -4.477 -10 -10s4.477 -10 10 -10z"
												/>
											</svg>
											Google
										</button>
									</form>

									<form method="post" action={env.PUBLIC_CORE_URL + '/login'}>
										<input type="hidden" name="provider" value="github" />
										<input type="hidden" name="return_url" value={env.PUBLIC_CLIENT_URL + '/organisations/create?invite=true'} />
										<button class="btn btn-outline btn-sm w-full">
											<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
												<path
													d="M9 19c-4.3 1.4 -4.3 -2.5 -6 -3m12 5v-3.5c0 -1 .1 -1.4 -.5 -2c2.8 -.3 5.5 -1.4 5.5 -6a4.6 4.6 0 0 0 -1.3 -3.2a4.2 4.2 0 0 0 -.1 -3.2s-1.1 -.3 -3.5 1.3a12.3 12.3 0 0 0 -6.2 0c-2.4 -1.6 -3.5 -1.3 -3.5 -1.3a4.2 4.2 0 0 0 -.1 3.2a4.6 4.6 0 0 0 -1.3 3.2c0 4.6 2.7 5.7 5.5 6c-.6 .6 -.6 1.2 -.5 2v3.5"
												/>
											</svg>
											GitHub
										</button>
									</form>
								</div>
							{:else}
								<button
									type="button"
									class="mx-auto block text-sm text-indigo-600 hover:text-indigo-700"
									onclick={() => showOAuthOptions = true}
								>
									Use Google or GitHub instead
								</button>
							{/if}
						</div>
					</div>
				{/if}

				{#if data.expiresAt}
					<p class="mt-6 text-center text-sm text-gray-500">
						This invite expires on {formatDate(data.expiresAt, 'long')}
					</p>
				{/if}
			</div>
		{:else}
			<!-- Invalid invite -->
			<div class="rounded-2xl bg-white p-8 shadow-xl">
				<div class="mb-6 text-center">
					<div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="h-8 w-8 text-red-500"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
							/>
						</svg>
					</div>
					<h1 class="mb-2 text-2xl font-bold text-gray-900">Invalid Invite</h1>
					<p class="text-gray-600">{data.reason || 'This invite link is not valid.'}</p>
				</div>

				<div class="rounded-xl bg-gray-50 p-4">
					<p class="text-sm text-gray-600">
						If you believe this is a mistake, please contact the person who sent you the invite or reach out to our
						support team.
					</p>
				</div>

				<div class="mt-6">
					<a href="/" class="btn btn-outline w-full"> Go to Homepage </a>
				</div>
			</div>
		{/if}

		<p class="mt-6 text-center text-sm text-gray-500">
			<a href="https://leaplearn.au" class="hover:text-indigo-600">LeapLearn</a> - Interactive learning made simple
		</p>
	</div>
</main>
