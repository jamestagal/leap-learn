import { env } from "$env/dynamic/private";
import winston from "winston";

export const logger = winston.createLogger({
	level: env.LOG_LEVEL,
	format: winston.format.combine(
		// upper case the level
		winston.format((info) => {
			info.level = info.level.toUpperCase();
			return info;
		})(),
		winston.format.splat(),
		winston.format.timestamp(),
		winston.format.colorize(),
		winston.format.printf((info) => `[${info["timestamp"]}] ${info.level}: ${info.message}`),
	),
	transports: [new winston.transports.Console()],
});

export function perf(name: string): (data?: unknown) => void {
	if (env.LOG_LEVEL !== "debug") {
		return () => {
			// do nothing
		};
	}
	const s = performance.now();

	/**
	 * Measure the performance and log the result
	 * @returns {void}
	 */
	function measure(data?: unknown): void {
		const duration = performance.now() - s;
		logger.debug(`${name}: duration ${duration.toFixed(4)}ms`);
		if (data) {
			logger.debug("data: %o", data);
		}
	}

	return measure;
}
