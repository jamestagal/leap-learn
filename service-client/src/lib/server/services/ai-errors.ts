/**
 * AI Service Error Handling (Server-side)
 *
 * Server-specific error handling for AI proposal generation.
 * For shared error codes and messages, see $lib/constants/ai-errors.ts
 */

// Re-export shared constants for server-side use
export {
	AIErrorCode,
	ERROR_MESSAGES,
	getErrorMessage,
	isRetryableError,
	type ErrorMessageInfo,
} from "$lib/constants/ai-errors";

import { AIErrorCode } from "$lib/constants/ai-errors";

/**
 * Custom error class for AI service errors (server-side only)
 */
export class AIServiceError extends Error {
	constructor(
		message: string,
		public code: AIErrorCode,
		public retryable: boolean = false,
		public details?: Record<string, unknown>,
	) {
		super(message);
		this.name = "AIServiceError";
	}

	/**
	 * Create a serialisable version for client
	 */
	toJSON() {
		return {
			name: this.name,
			message: this.message,
			code: this.code,
			retryable: this.retryable,
		};
	}
}

/**
 * Create an AIServiceError from an Anthropic API error
 */
export function fromAnthropicError(error: { status?: number; message?: string }): AIServiceError {
	const status = error.status;
	const message = error.message || "Unknown AI API error";

	if (status === 401) {
		return new AIServiceError(message, AIErrorCode.API_KEY_INVALID, false);
	}
	if (status === 429) {
		return new AIServiceError(message, AIErrorCode.API_RATE_LIMITED, true);
	}
	if (status === 529) {
		return new AIServiceError(message, AIErrorCode.API_OVERLOADED, true);
	}
	if (status === 408 || status === 504) {
		return new AIServiceError(message, AIErrorCode.API_TIMEOUT, true);
	}

	return new AIServiceError(message, AIErrorCode.API_TIMEOUT, false);
}
