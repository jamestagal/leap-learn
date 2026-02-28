/**
 * H5P API Proxy Route
 *
 * Forwards all /api/h5p/* requests to the Go backend.
 * The H5P editor JS makes AJAX calls here (same-origin).
 * SvelteKit reads the httpOnly access_token cookie and
 * adds a Bearer header before forwarding — no CORS issues.
 */

import { env } from "$env/dynamic/private";
import type { RequestHandler } from "./$types";

export const fallback: RequestHandler = async ({ request, params, cookies }) => {
	const accessToken = cookies.get("access_token");
	const url = new URL(request.url);
	const targetUrl = `${env.CORE_URL}/api/v1/h5p/${params.path}${url.search}`;

	// Forward Content-Type EXACTLY as-is (critical for multipart/form-data
	// which includes boundary string — never override with 'application/json')
	const headers: Record<string, string> = {};
	const contentType = request.headers.get("Content-Type");
	if (contentType) headers["Content-Type"] = contentType;
	if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;

	// Stream body through — do NOT call request.json() or request.formData()
	// as that consumes the body. duplex: 'half' enables streaming.
	const response = await fetch(targetUrl, {
		method: request.method,
		headers,
		body:
			request.method !== "GET" && request.method !== "HEAD"
				? request.body
				: undefined,
		// @ts-expect-error — duplex: 'half' is valid in Node but not in TS DOM types
		duplex: "half",
	});

	// Stream response back with original headers
	const responseHeaders: Record<string, string> = {
		"Content-Type":
			response.headers.get("Content-Type") || "application/octet-stream",
	};
	const cacheControl = response.headers.get("Cache-Control");
	if (cacheControl) responseHeaders["Cache-Control"] = cacheControl;

	return new Response(response.body, {
		status: response.status,
		headers: responseHeaders,
	});
};
