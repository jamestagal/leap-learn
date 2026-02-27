import * as Sentry from "@sentry/sveltekit";
import { logger, perf } from "./lib/server/logger";
import { error, redirect, type Handle } from "@sveltejs/kit";
import { sequence } from "@sveltejs/kit/hooks";
import { building } from "$app/environment";
import { verifyJWT } from "./lib/server/jwt";
import { refresh, TokenRefreshError } from "./lib/server/refresh";
import type { Session, User } from "./lib/types";

/**
 * Check if this is a remote function (RPC) request.
 * Remote functions don't support redirect() - they need HTTP errors instead.
 */
function isRemoteFunctionRequest(event: { request: Request; url: URL }): boolean {
	// Remote functions use POST and go through SvelteKit's RPC mechanism
	if (event.request.method === "POST") {
		// Check for common RPC patterns
		const contentType = event.request.headers.get("content-type") || "";
		if (contentType.includes("application/json")) {
			return true;
		}
	}
	return false;
}

// --- Public route rate limiting ---
const PUBLIC_ROUTE_PREFIXES = ["/p/", "/c/", "/i/", "/f/", "/q/"];
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 60;
const rateLimitMap = new Map<string, number[]>();

// Clean up stale entries every 5 minutes
setInterval(() => {
	const now = Date.now();
	for (const [ip, timestamps] of rateLimitMap) {
		const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
		if (recent.length === 0) {
			rateLimitMap.delete(ip);
		} else {
			rateLimitMap.set(ip, recent);
		}
	}
}, 300_000);

function isRateLimited(ip: string): boolean {
	const now = Date.now();
	const timestamps = rateLimitMap.get(ip) ?? [];
	const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
	recent.push(now);
	rateLimitMap.set(ip, recent);
	return recent.length > RATE_LIMIT_MAX_REQUESTS;
}

const authHandle: Handle = async ({ event, resolve }) => {
	const end = perf("handle");

	// Suppress noisy HMR/polling paths from debug logs
	const isNoisyPath =
		event.url.pathname === "/__webpack_hmr" ||
		event.url.pathname.startsWith("/__vite") ||
		event.url.pathname === "/login";
	if (!isNoisyPath) {
		logger.debug(event.url.pathname);
	}
	if (building) {
		return await resolve(event);
	}

	// Skip auth for internal dev/framework paths
	if (
		event.url.pathname.startsWith("/__") ||
		event.url.pathname.startsWith("/@") ||
		event.url.pathname.startsWith("/node_modules")
	) {
		return await resolve(event);
	}

	// Rate limit public routes
	if (PUBLIC_ROUTE_PREFIXES.some((prefix) => event.url.pathname.startsWith(prefix))) {
		const ip = event.getClientAddress();
		if (isRateLimited(ip)) {
			return new Response("Too Many Requests", { status: 429 });
		}
	}

	event.locals.user = {
		id: "",
		email: "",
		access: 0,
		avatar: "",
		subscription_active: false,
		phone: "",
	};

	// Public routes that don't require authentication
	const isPublicRoute =
		event.url.pathname === "/" ||
		event.url.pathname === "/login" ||
		event.url.pathname === "/sitemap.xml" ||
		event.url.pathname.startsWith("/invite/");

	// Allow public routes without authentication
	if (isPublicRoute) {
		if (!isNoisyPath && event.url.pathname !== "/login") {
			logger.debug(`Public route: ${event.url.pathname}`);
		}
		return await resolve(event);
	}

	// Check if we are on the 2FA login page
	if (event.url.pathname === "/login/phone" || event.url.pathname === "/login/verify") {
		const session_token = event.cookies.get("session_token");
		if (!session_token) {
			throw redirect(302, "/login");
		}
		const session = await verifyJWT<Session>(session_token);
		if (!session) {
			throw redirect(302, "/login");
		}
		event.locals.session = session_token;
		event.locals.user.phone = session.phone;
		return await resolve(event);
	}

	// Check if we have a token. If not, redirect to the auth page
	let access_token = event.cookies.get("access_token") ?? "";
	const refresh_token = event.cookies.get("refresh_token") ?? "";

	// Debug logging for auth flow (helps diagnose production session issues)
	logger.debug(
		`Auth check: path=${event.url.pathname}, hasAccessToken=${!!access_token}, hasRefreshToken=${!!refresh_token}`,
	);

	if (!refresh_token) {
		logger.debug("No refresh_token cookie found - redirecting to login");
		throw redirect(302, "/login");
	}

	let user = await verifyJWT<User>(access_token);
	// If the token is invalid, refresh the token
	// JWT token holds the information about subscription status, so we need to refresh it
	if (!user) {
		logger.debug(`Access token invalid/expired for path=${event.url.pathname}, attempting refresh`);
		try {
			access_token = await refresh(event, access_token, refresh_token);
			user = await verifyJWT(access_token);
			if (!user) {
				logger.error("Token verification failed after successful refresh");
				if (isRemoteFunctionRequest(event)) {
					throw error(401, "Session expired. Please log in again.");
				}
				throw redirect(302, "/login");
			}
			logger.debug("Token refresh successful");
		} catch (e) {
			if (e instanceof TokenRefreshError) {
				logger.error(`Token refresh failed for path=${event.url.pathname}: ${e.message}`);
				// For remote functions (commands), throw HTTP error instead of redirect
				if (isRemoteFunctionRequest(event)) {
					throw error(401, e.message);
				}
				throw redirect(302, "/login");
			}
			throw e; // Re-throw other errors (including redirects)
		}
	}

	event.locals.user = user;
	event.locals.token = access_token;

	// Last check to make sure we have a user
	if (!event.locals.user.id) {
		logger.error("No user found");
		throw redirect(302, "/login");
	}
	logger.debug("User: %O", event.locals.user);

	end();
	return await resolve(event, {
		preload: ({ type }) => type === "js" || type === "css" || type === "font",
	});
};

export const handle = sequence(Sentry.sentryHandle(), authHandle);

export const handleError = Sentry.handleErrorWithSentry((e: { error: unknown }) => {
	logger.error("Unhandled error", e.error);
});
