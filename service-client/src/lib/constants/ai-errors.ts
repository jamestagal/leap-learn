/**
 * AI Error Codes and Messages
 *
 * Shared constants for AI error handling that can be used in both
 * client and server code.
 */

/**
 * Error codes for AI service errors
 */
export enum AIErrorCode {
	// API Errors
	API_KEY_MISSING = "API_KEY_MISSING",
	API_KEY_INVALID = "API_KEY_INVALID",
	API_RATE_LIMITED = "API_RATE_LIMITED",
	API_OVERLOADED = "API_OVERLOADED",
	API_TIMEOUT = "API_TIMEOUT",

	// Response Errors
	RESPONSE_EMPTY = "RESPONSE_EMPTY",
	RESPONSE_INVALID_JSON = "RESPONSE_INVALID_JSON",
	RESPONSE_MISSING_FIELDS = "RESPONSE_MISSING_FIELDS",
	RESPONSE_SCHEMA_MISMATCH = "RESPONSE_SCHEMA_MISMATCH",

	// Context Errors
	CONTEXT_INSUFFICIENT = "CONTEXT_INSUFFICIENT",
	CONTEXT_TOO_LARGE = "CONTEXT_TOO_LARGE",

	// Business Errors
	RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED",
	SUBSCRIPTION_REQUIRED = "SUBSCRIPTION_REQUIRED",

	// Fallback
	UNKNOWN = "UNKNOWN",
}

/**
 * Error message details for each error code
 */
export interface ErrorMessageInfo {
	title: string;
	description: string;
	action?:
		| "Retry"
		| "Upgrade Plan"
		| "Contact Support"
		| "Edit Consultation"
		| "View Partial Results";
}

/**
 * User-friendly error messages for each error code
 */
export const ERROR_MESSAGES: Record<AIErrorCode, ErrorMessageInfo> = {
	[AIErrorCode.API_KEY_MISSING]: {
		title: "Configuration Error",
		description: "AI service is not configured. Please contact support.",
		action: "Contact Support",
	},
	[AIErrorCode.API_KEY_INVALID]: {
		title: "Authentication Error",
		description: "AI service credentials are invalid. Please contact support.",
		action: "Contact Support",
	},
	[AIErrorCode.API_RATE_LIMITED]: {
		title: "Service Busy",
		description: "Too many requests. Please try again in a few seconds.",
		action: "Retry",
	},
	[AIErrorCode.API_OVERLOADED]: {
		title: "Service Temporarily Unavailable",
		description: "The AI service is experiencing high demand. Please try again shortly.",
		action: "Retry",
	},
	[AIErrorCode.API_TIMEOUT]: {
		title: "Request Timeout",
		description: "The request took too long. Please try again.",
		action: "Retry",
	},
	[AIErrorCode.RESPONSE_EMPTY]: {
		title: "Empty Response",
		description: "No content was generated. Please try again.",
		action: "Retry",
	},
	[AIErrorCode.RESPONSE_INVALID_JSON]: {
		title: "Generation Failed",
		description: "The AI response was malformed. This is usually temporary.",
		action: "Retry",
	},
	[AIErrorCode.RESPONSE_MISSING_FIELDS]: {
		title: "Partial Generation",
		description: "Some sections could not be generated. You can edit manually or retry.",
		action: "View Partial Results",
	},
	[AIErrorCode.RESPONSE_SCHEMA_MISMATCH]: {
		title: "Invalid Response Format",
		description: "The generated content did not match expected format.",
		action: "Retry",
	},
	[AIErrorCode.CONTEXT_INSUFFICIENT]: {
		title: "More Information Needed",
		description: "Please complete more consultation fields before generating.",
		action: "Edit Consultation",
	},
	[AIErrorCode.CONTEXT_TOO_LARGE]: {
		title: "Content Too Large",
		description: "The consultation data exceeds processing limits.",
		action: "Contact Support",
	},
	[AIErrorCode.RATE_LIMIT_EXCEEDED]: {
		title: "Monthly Limit Reached",
		description: "You have used all your AI generations for this month.",
		action: "Upgrade Plan",
	},
	[AIErrorCode.SUBSCRIPTION_REQUIRED]: {
		title: "Subscription Required",
		description: "AI generation requires an active subscription.",
		action: "Upgrade Plan",
	},
	[AIErrorCode.UNKNOWN]: {
		title: "Unexpected Error",
		description: "Something went wrong. Please try again.",
		action: "Retry",
	},
};

/**
 * Get error message info for an error code
 */
export function getErrorMessage(code: AIErrorCode): ErrorMessageInfo {
	return ERROR_MESSAGES[code];
}

/**
 * Check if an error is retryable
 */
export function isRetryableError(code: AIErrorCode): boolean {
	const retryableCodes = [
		AIErrorCode.API_RATE_LIMITED,
		AIErrorCode.API_OVERLOADED,
		AIErrorCode.API_TIMEOUT,
		AIErrorCode.RESPONSE_EMPTY,
		AIErrorCode.RESPONSE_INVALID_JSON,
		AIErrorCode.RESPONSE_SCHEMA_MISMATCH,
	];
	return retryableCodes.includes(code);
}
