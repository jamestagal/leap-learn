import { verifyJWT } from './auth';
import type { ContentStateObject } from './content-state';

export { ContentStateObject } from './content-state';

interface Env {
	CONTENT_STATE: DurableObjectNamespace<ContentStateObject>;
	GO_BACKEND_URL: string;
	STATE_SERVICE_TOKEN: string;
	PUBLIC_KEY_PEM: string;
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);

		// Debug: GET /debug/:userId/:contentId — dump all DO state
		const debugMatch = url.pathname.match(/^\/debug\/([^/]+)\/([^/]+)$/);
		if (debugMatch && request.method === 'GET') {
			const [, userId, contentId] = debugMatch;
			const doId = env.CONTENT_STATE.idFromName(`${userId}:${contentId}`);
			const stub = env.CONTENT_STATE.get(doId);
			return stub.debugDump();
		}

		// Route: /content-user-data/:contentId/:dataType/:subContentId
		const match = url.pathname.match(/^\/content-user-data\/([^/]+)\/([^/]+)\/([^/]+)$/);
		if (!match) {
			return new Response('Not found', { status: 404 });
		}

		const [, contentId, dataType, subContentId] = match;

		// Auth: verify JWT from Authorization header
		const authHeader = request.headers.get('Authorization');
		const token = authHeader?.replace('Bearer ', '');
		if (!token) {
			return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
		}

		const user = await verifyJWT(token, env.PUBLIC_KEY_PEM);
		if (!user) {
			return Response.json({ success: false, error: 'Invalid token' }, { status: 401 });
		}

		// Route to DO instance (one per user+content)
		const doId = env.CONTENT_STATE.idFromName(`${user.userId}:${contentId}`);
		const stub = env.CONTENT_STATE.get(doId);

		if (request.method === 'GET') {
			return stub.getState(subContentId, dataType);
		} else if (request.method === 'POST') {
			// H5P sends form-encoded data
			const formData = await request.formData();

			return stub.setState({
				subContentId,
				dataType,
				data: (formData.get('data') as string) || '',
				preload: formData.get('preload') === '1',
				invalidate: formData.get('invalidate') === '1',
				userId: user.userId,
				contentId,
			});
		}

		return new Response('Method not allowed', { status: 405 });
	},
};
