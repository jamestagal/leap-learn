import * as Sentry from "@sentry/sveltekit";
import { env } from "$env/dynamic/public";

Sentry.init({
	dsn: env["PUBLIC_SENTRY_DSN"],
	environment: "browser",
	tracesSampleRate: 0.1,
	replaysSessionSampleRate: 0,
	replaysOnErrorSampleRate: 0,
	integrations: [Sentry.browserTracingIntegration()],
	beforeSend(event, _hint) {
		// Filter out auth-related fetch errors that occur during session expiry/redirects
		// These happen when SvelteKit client-side navigation tries to fetch __data.json
		// but gets redirected to login (returns HTML instead of JSON)
		const errorMessage = event.exception?.values?.[0]?.value;
		const requestUrl = event.request?.url;

		if (errorMessage?.includes('Failed to fetch') &&
		    (requestUrl?.includes('__data.json') || requestUrl?.includes('/api/'))) {
			// Likely an auth redirect - don't report to Sentry
			return null;
		}

		return event;
	},
});

export const handleError = Sentry.handleErrorWithSentry();
