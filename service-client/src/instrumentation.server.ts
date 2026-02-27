import * as Sentry from "@sentry/sveltekit";
import { env } from "$env/dynamic/public";

Sentry.init({
	dsn: env["PUBLIC_SENTRY_DSN"],
	environment: env["PUBLIC_APP_DOMAIN"] === "leaplearn.au" ? "production" : "development",
	tracesSampleRate: 0.2,
	profilesSampleRate: 0,
	beforeSend(event) {
		// Skip expected auth redirects
		const status = event.contexts?.response?.status_code;
		if (status === 401 || status === 403) return null;
		return event;
	},
});
