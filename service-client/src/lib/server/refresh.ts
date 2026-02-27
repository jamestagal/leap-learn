import { env } from "$env/dynamic/private";
import { type RequestEvent } from "@sveltejs/kit";
import { logger, perf } from "./logger";

export type AuthResponse = {
	access_token: string;
	refresh_token: string;
};

/**
 * Custom error for token refresh failures.
 * This is thrown instead of redirect() to allow proper handling in different contexts:
 * - Page requests: hooks.server.ts converts this to a redirect
 * - Remote function commands: error propagates and client handles it
 */
export class TokenRefreshError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "TokenRefreshError";
	}
}

export async function refresh(
	event: RequestEvent,
	access_token: string,
	refresh_token: string,
): Promise<string> {
	const end = perf("refresh");
	try {
		logger.debug(`Attempting token refresh to ${env.CORE_URL}/refresh`);

		const r = await fetch(`${env.CORE_URL}/refresh`, {
			headers: { Cookie: `refresh_token=${refresh_token}; access_token=${access_token}` },
		});

		if (!r.ok) {
			const body = await r.text().catch(() => "");
			logger.error(`Refresh failed: status=${r.status}, body=${body}`);
			throw new Error(`Error refreshing token: ${r.status}`);
		}

		// Use getSetCookie() for proper handling of multiple Set-Cookie headers
		// This is the standard way in Node 18.15+ and works correctly with proxies
		let cookieHeaders: string[];
		if (typeof r.headers.getSetCookie === "function") {
			cookieHeaders = r.headers.getSetCookie();
		} else {
			// Fallback for older environments - get raw header
			const raw = r.headers.get("set-cookie");
			cookieHeaders = raw ? [raw] : [];
		}

		logger.debug(`Received ${cookieHeaders.length} Set-Cookie header(s)`);

		if (cookieHeaders.length === 0) {
			throw new Error("No Set-Cookie headers in refresh response");
		}

		// Parse cookies from all headers
		let newAccessToken = "";
		let newRefreshToken = "";

		for (const cookie of cookieHeaders) {
			const accessMatch = cookie.match(/access_token=([^;]+)/);
			const refreshMatch = cookie.match(/refresh_token=([^;]+)/);

			if (accessMatch?.[1]) {
				newAccessToken = accessMatch[1];
			}
			if (refreshMatch?.[1]) {
				newRefreshToken = refreshMatch[1];
			}
		}

		// Validate we got both tokens
		if (!newAccessToken) {
			logger.error("No access_token in refresh response cookies");
			throw new Error("Missing access_token in refresh response");
		}
		if (!newRefreshToken) {
			logger.error("No refresh_token in refresh response cookies");
			throw new Error("Missing refresh_token in refresh response");
		}

		logger.debug("Successfully parsed new tokens from refresh response");

		// Token expiration constants (must match Go backend config/config.go)
		const ACCESS_TOKEN_MAX_AGE = 15 * 60; // 15 minutes in seconds
		const REFRESH_TOKEN_MAX_AGE = 30 * 24 * 60 * 60; // 30 days in seconds

		// Use secure cookies only in production (HTTPS)
		const isProduction = env.DOMAIN !== "localhost";

		event.cookies.set("access_token", newAccessToken, {
			path: "/",
			sameSite: "lax",
			secure: isProduction,
			httpOnly: true,
			domain: env.DOMAIN,
			maxAge: ACCESS_TOKEN_MAX_AGE,
		});
		event.cookies.set("refresh_token", newRefreshToken, {
			path: "/",
			sameSite: "lax",
			secure: isProduction,
			httpOnly: true,
			domain: env.DOMAIN,
			maxAge: REFRESH_TOKEN_MAX_AGE,
		});

		logger.debug(
			`Cookies set with domain=${env.DOMAIN}, access_maxAge=${ACCESS_TOKEN_MAX_AGE}s, refresh_maxAge=${REFRESH_TOKEN_MAX_AGE}s`,
		);

		end();
		return newAccessToken;
	} catch (e) {
		logger.error(`Error refreshing token: ${e}`);
		throw new TokenRefreshError("Session expired. Please log in again.");
	}
}
