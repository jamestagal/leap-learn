/**
 * Client-safe logger for browser environment
 * Does not depend on any server-side modules
 */
export const clientLogger = {
	debug: (msg: string, data?: any) => {
		if (import.meta.env.DEV) {
			console.debug(`[DEBUG] ${msg}`, data);
		}
	},
	info: (msg: string, data?: any) => {
		console.info(`[INFO] ${msg}`, data);
	},
	warn: (msg: string, data?: any) => {
		console.warn(`[WARN] ${msg}`, data);
	},
	error: (msg: string, error?: any) => {
		console.error(`[ERROR] ${msg}`, error);
		// Could also send to error tracking service like Sentry
	},
};
