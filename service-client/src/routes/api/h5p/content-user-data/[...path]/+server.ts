/**
 * H5P Content User State Proxy — Feature-Flagged
 *
 * Routes content-user-data requests to either Go backend or CF Worker
 * based on STATE_SAVE_TARGET env var:
 *   - "go"     (default): All traffic to Go backend
 *   - "shadow": GETs from Go, POSTs to both Go + Worker in parallel
 *   - "worker": All traffic to CF Worker
 *
 * This more-specific route takes precedence over the catch-all
 * api/h5p/[...path]/+server.ts for content-user-data paths.
 */

import { env } from "$env/dynamic/private";
import type { RequestHandler } from "./$types";

const GO_URL = env.CORE_URL;
const WORKER_URL = env.H5P_STATE_WORKER_URL;
const TARGET = env.STATE_SAVE_TARGET || "go";

async function proxyToGo(
	path: string,
	request: Request,
	token: string | undefined,
): Promise<Response> {
	const url = `${GO_URL}/api/v1/h5p/content-user-data/${path}`;
	const headers: Record<string, string> = {};
	const contentType = request.headers.get("Content-Type");
	if (contentType) headers["Content-Type"] = contentType;
	if (token) headers["Authorization"] = `Bearer ${token}`;

	return fetch(url, {
		method: request.method,
		headers,
		body:
			request.method !== "GET" && request.method !== "HEAD"
				? request.body
				: undefined,
		// @ts-expect-error — duplex: 'half' is valid in Node but not in TS DOM types
		duplex: "half",
	});
}

async function proxyToWorker(
	path: string,
	request: Request,
	token: string | undefined,
	body?: string,
): Promise<Response> {
	const url = `${WORKER_URL}/content-user-data/${path}`;
	const headers: Record<string, string> = {};
	const contentType = request.headers.get("Content-Type");
	if (contentType) headers["Content-Type"] = contentType;
	if (token) headers["Authorization"] = `Bearer ${token}`;

	const init: RequestInit = { method: request.method, headers };
	if (request.method === "POST" && body) init.body = body;

	return fetch(url, init);
}

function wrapResponse(response: Response): Response {
	const responseHeaders: Record<string, string> = {
		"Content-Type":
			response.headers.get("Content-Type") || "application/json",
	};
	return new Response(response.body, {
		status: response.status,
		headers: responseHeaders,
	});
}

export const GET: RequestHandler = async ({ params, request, cookies }) => {
	const token = cookies.get("access_token");
	const path = params.path;

	if (TARGET === "worker" && WORKER_URL) {
		try {
			const res = await proxyToWorker(path, request, token);
			return wrapResponse(res);
		} catch (err) {
			console.error("Worker GET proxy error:", err);
			return Response.json(
				{ success: true, data: false },
				{ status: 200 },
			);
		}
	}

	// 'go' and 'shadow' both read from Go
	const res = await proxyToGo(path, request, token);
	return wrapResponse(res);
};

export const POST: RequestHandler = async ({ params, request, cookies }) => {
	const token = cookies.get("access_token");
	const path = params.path;

	if (TARGET === "go" || !WORKER_URL) {
		const res = await proxyToGo(path, request, token);
		return wrapResponse(res);
	}

	if (TARGET === "shadow") {
		// Read body once, send to both targets
		const bodyText = await request.text();

		const [goRes] = await Promise.all([
			fetch(`${GO_URL}/api/v1/h5p/content-user-data/${path}`, {
				method: "POST",
				headers: {
					"Content-Type": "application/x-www-form-urlencoded",
					...(token ? { Authorization: `Bearer ${token}` } : {}),
				},
				body: bodyText,
			}),
			proxyToWorker(path, request, token, bodyText).catch((err) => {
				console.error("Shadow write to Worker failed:", err);
				return null; // Never fail the primary write
			}),
		]);

		return wrapResponse(goRes);
	}

	// TARGET === 'worker'
	try {
		const bodyText = await request.text();
		const res = await proxyToWorker(path, request, token, bodyText);
		if (!res.ok) {
			const errText = await res.clone().text();
			console.error(
				`Worker POST failed: ${res.status} ${errText} path=${path}`,
			);
		}
		return wrapResponse(res);
	} catch (err) {
		console.error("Worker POST proxy error:", err);
		return Response.json(
			{ success: false, error: "State save failed" },
			{ status: 502 },
		);
	}
};
