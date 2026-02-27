/**
 * Tests for Valibot schemas used in content-social.remote.ts
 *
 * The schemas are private to the .remote.ts file, so we mirror them here
 * to validate the schema constraints work correctly.
 */
import { describe, it, expect } from "vitest";
import * as v from "valibot";

// Mirror schemas from content-social.remote.ts
const GenerateSocialSchema = v.object({
	clientId: v.pipe(v.string(), v.uuid()),
	pageId: v.optional(v.pipe(v.string(), v.uuid())),
	platform: v.string(),
	topic: v.string(),
	postGoal: v.optional(v.string()),
	toneOverride: v.optional(v.string()),
});

const GetSocialSchema = v.object({
	clientId: v.pipe(v.string(), v.uuid()),
	platform: v.optional(v.string()),
	pageId: v.optional(v.pipe(v.string(), v.uuid())),
	status: v.optional(v.string()),
	limit: v.optional(v.number()),
	offset: v.optional(v.number()),
});

const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";

describe("GenerateSocialSchema", () => {
	it("accepts valid input with all fields", () => {
		const input = {
			clientId: VALID_UUID,
			pageId: "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
			platform: "twitter",
			topic: "Product launch announcement",
			postGoal: "engagement",
			toneOverride: "professional",
		};
		const result = v.safeParse(GenerateSocialSchema, input);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.output).toEqual(input);
		}
	});

	it("accepts valid input with only required fields", () => {
		const input = {
			clientId: VALID_UUID,
			platform: "linkedin",
			topic: "Industry insights",
		};
		const result = v.safeParse(GenerateSocialSchema, input);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.output.clientId).toBe(VALID_UUID);
			expect(result.output.pageId).toBeUndefined();
			expect(result.output.postGoal).toBeUndefined();
			expect(result.output.toneOverride).toBeUndefined();
		}
	});

	it("rejects missing clientId", () => {
		const input = {
			platform: "twitter",
			topic: "Test topic",
		};
		const result = v.safeParse(GenerateSocialSchema, input);
		expect(result.success).toBe(false);
	});

	it("rejects invalid UUID for clientId", () => {
		const input = {
			clientId: "not-a-uuid",
			platform: "twitter",
			topic: "Test topic",
		};
		const result = v.safeParse(GenerateSocialSchema, input);
		expect(result.success).toBe(false);
	});

	it("rejects invalid UUID for pageId when provided", () => {
		const input = {
			clientId: VALID_UUID,
			pageId: "invalid-uuid",
			platform: "twitter",
			topic: "Test topic",
		};
		const result = v.safeParse(GenerateSocialSchema, input);
		expect(result.success).toBe(false);
	});

	it("rejects missing platform", () => {
		const input = {
			clientId: VALID_UUID,
			topic: "Test topic",
		};
		const result = v.safeParse(GenerateSocialSchema, input);
		expect(result.success).toBe(false);
	});

	it("rejects missing topic", () => {
		const input = {
			clientId: VALID_UUID,
			platform: "twitter",
		};
		const result = v.safeParse(GenerateSocialSchema, input);
		expect(result.success).toBe(false);
	});

	it("allows empty strings for platform and topic (validation at Go layer)", () => {
		const input = {
			clientId: VALID_UUID,
			platform: "",
			topic: "",
		};
		const result = v.safeParse(GenerateSocialSchema, input);
		expect(result.success).toBe(true);
	});

	it("rejects non-string clientId", () => {
		const input = {
			clientId: 123,
			platform: "twitter",
			topic: "Test",
		};
		const result = v.safeParse(GenerateSocialSchema, input);
		expect(result.success).toBe(false);
	});
});

describe("GetSocialSchema", () => {
	it("accepts minimal input (just clientId)", () => {
		const input = { clientId: VALID_UUID };
		const result = v.safeParse(GetSocialSchema, input);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.output.clientId).toBe(VALID_UUID);
			expect(result.output.platform).toBeUndefined();
			expect(result.output.pageId).toBeUndefined();
			expect(result.output.status).toBeUndefined();
			expect(result.output.limit).toBeUndefined();
			expect(result.output.offset).toBeUndefined();
		}
	});

	it("accepts all optional filters", () => {
		const input = {
			clientId: VALID_UUID,
			platform: "instagram",
			pageId: "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
			status: "draft",
			limit: 25,
			offset: 10,
		};
		const result = v.safeParse(GetSocialSchema, input);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.output).toEqual(input);
		}
	});

	it("rejects invalid UUID for clientId", () => {
		const input = { clientId: "bad-uuid" };
		const result = v.safeParse(GetSocialSchema, input);
		expect(result.success).toBe(false);
	});

	it("rejects empty string for clientId", () => {
		const input = { clientId: "" };
		const result = v.safeParse(GetSocialSchema, input);
		expect(result.success).toBe(false);
	});

	it("rejects invalid UUID for pageId when provided", () => {
		const input = {
			clientId: VALID_UUID,
			pageId: "not-valid",
		};
		const result = v.safeParse(GetSocialSchema, input);
		expect(result.success).toBe(false);
	});

	it("rejects non-number limit", () => {
		const input = {
			clientId: VALID_UUID,
			limit: "50",
		};
		const result = v.safeParse(GetSocialSchema, input);
		expect(result.success).toBe(false);
	});

	it("rejects non-number offset", () => {
		const input = {
			clientId: VALID_UUID,
			offset: "0",
		};
		const result = v.safeParse(GetSocialSchema, input);
		expect(result.success).toBe(false);
	});

	it("rejects missing clientId", () => {
		const input = { platform: "twitter" };
		const result = v.safeParse(GetSocialSchema, input);
		expect(result.success).toBe(false);
	});
});
