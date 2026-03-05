import { DurableObject } from 'cloudflare:workers';

export interface Env {
	CONTENT_STATE: DurableObjectNamespace;
	GO_BACKEND_URL: string;
	STATE_SERVICE_TOKEN: string;
	PUBLIC_KEY_PEM: string;
}

export class ContentStateObject extends DurableObject<Env> {
	private userId: string = '';
	private contentId: string = '';
	private entries: Map<string, string> = new Map();
	private preloadFlags: Map<string, boolean> = new Map();
	private dirty: boolean = false;
	private lastFlush: number = 0;
	private retryCount: number = 0;

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);

		ctx.blockConcurrencyWhile(async () => {
			const stored = await ctx.storage.get([
				'userId',
				'contentId',
				'entries',
				'preloadFlags',
				'lastFlush',
			]);

			this.userId = (stored.get('userId') as string) || '';
			this.contentId = (stored.get('contentId') as string) || '';
			this.lastFlush = (stored.get('lastFlush') as number) || 0;

			const rawEntries = stored.get('entries') as Record<string, string> | undefined;
			if (rawEntries) {
				this.entries = new Map(Object.entries(rawEntries));
			}

			const rawPreload = stored.get('preloadFlags') as Record<string, boolean> | undefined;
			if (rawPreload) {
				this.preloadFlags = new Map(Object.entries(rawPreload));
			}
		});
	}

	// ─── GET: Read state ─────────────────────────────────────
	async getState(subContentId: string, dataType: string): Promise<Response> {
		const key = `${subContentId}:${dataType}`;
		const value = this.entries.get(key);

		if (value === undefined) {
			// No state saved — return false (NOT null, see gotchas)
			return Response.json({ success: true, data: false });
		}

		return Response.json({ success: true, data: value });
	}

	// ─── POST: Write state ────────────────────────────────────
	async setState(params: {
		subContentId: string;
		dataType: string;
		data: string;
		preload: boolean;
		invalidate: boolean;
		userId: string;
		contentId: string;
	}): Promise<Response> {
		// Initialise identity on first write
		if (!this.userId) {
			this.userId = params.userId;
			this.contentId = params.contentId;
			await this.ctx.storage.put({ userId: this.userId, contentId: this.contentId });
		}

		const key = `${params.subContentId}:${params.dataType}`;

		// Handle invalidate + empty data = DELETE
		if (params.invalidate && (params.data === '' || params.data === '0')) {
			this.entries.delete(key);
			this.preloadFlags.delete(key);
		} else {
			this.entries.set(key, params.data);
			this.preloadFlags.set(key, params.preload);
		}

		// Persist to DO storage (survives eviction)
		await this.ctx.storage.put({
			entries: Object.fromEntries(this.entries),
			preloadFlags: Object.fromEntries(this.preloadFlags),
		});

		// Mark dirty and schedule alarm if not already set
		this.dirty = true;
		const currentAlarm = await this.ctx.storage.getAlarm();
		if (!currentAlarm) {
			await this.ctx.storage.setAlarm(Date.now() + 30_000); // 30 seconds
		}

		return Response.json({ success: true });
	}

	// ─── GET ALL: Preload states for initial page render ──────
	async getPreloadStates(): Promise<Response> {
		const result: Record<string, Record<string, string>> = {};

		for (const [key, value] of this.entries) {
			const preload = this.preloadFlags.get(key);
			if (!preload) continue;

			const [subContentId, dataType] = key.split(':');
			if (!result[subContentId]) result[subContentId] = {};
			result[subContentId][dataType] = value;
		}

		return Response.json({ success: true, data: result });
	}

	// ─── DEBUG: Dump all state for inspection ────────────────
	async debugDump(): Promise<Response> {
		return Response.json({
			userId: this.userId,
			contentId: this.contentId,
			dirty: this.dirty,
			lastFlush: this.lastFlush,
			retryCount: this.retryCount,
			entryCount: this.entries.size,
			entries: Object.fromEntries(this.entries),
			preloadFlags: Object.fromEntries(this.preloadFlags),
		});
	}

	// ─── ALARM: Flush dirty state to Go backend ───────────────
	async alarm(): Promise<void> {
		if (!this.dirty || this.entries.size === 0) return;

		try {
			// Flush each entry to Go's existing endpoint
			for (const [key, value] of this.entries) {
				const [subContentId, dataType] = key.split(':');
				const preload = this.preloadFlags.get(key) ? '1' : '0';

				const url = `${this.env.GO_BACKEND_URL}/api/v1/h5p/content-user-data/${this.contentId}/${dataType}/${subContentId}`;

				const body = new URLSearchParams({
					data: value,
					preload: preload,
					invalidate: '0',
				});

				const res = await fetch(url, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/x-www-form-urlencoded',
						'X-Api-Key': this.env.STATE_SERVICE_TOKEN,
						'X-User-Id': this.userId,
					},
					body: body.toString(),
				});

				if (!res.ok) {
					throw new Error(`Flush failed: ${res.status} ${await res.text()}`);
				}
			}

			this.dirty = false;
			this.lastFlush = Date.now();
			await this.ctx.storage.put({ lastFlush: this.lastFlush });
		} catch (err) {
			// Retry with exponential backoff (max 5 min)
			const delay = Math.min(30_000 * Math.pow(2, Math.min(this.retryCount, 4)), 300_000);
			await this.ctx.storage.setAlarm(Date.now() + delay);
			this.retryCount = this.retryCount + 1;
			console.error('State flush failed, retrying in', delay, 'ms:', err);
			return;
		}

		// Reset retry counter on success
		this.retryCount = 0;
	}
}
