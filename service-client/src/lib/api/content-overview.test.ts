/**
 * Tests for Valibot schema used in content-overview.remote.ts
 *
 * The ClientIdSchema is private to the .remote.ts file, so we mirror it here
 * to validate the UUID constraint works correctly.
 */
import { describe, it, expect } from "vitest";
import * as v from "valibot";

// Mirror schema from content-overview.remote.ts
const ClientIdSchema = v.pipe(v.string(), v.uuid());

describe("ClientIdSchema", () => {
	it("accepts valid UUID v4", () => {
		const result = v.safeParse(
			ClientIdSchema,
			"550e8400-e29b-41d4-a716-446655440000",
		);
		expect(result.success).toBe(true);
	});

	it("accepts another valid UUID format", () => {
		const result = v.safeParse(
			ClientIdSchema,
			"6ba7b810-9dad-11d1-80b4-00c04fd430c8",
		);
		expect(result.success).toBe(true);
	});

	it("rejects non-UUID string", () => {
		const result = v.safeParse(ClientIdSchema, "not-a-uuid");
		expect(result.success).toBe(false);
	});

	it("rejects empty string", () => {
		const result = v.safeParse(ClientIdSchema, "");
		expect(result.success).toBe(false);
	});

	it("rejects number input", () => {
		const result = v.safeParse(ClientIdSchema, 12345);
		expect(result.success).toBe(false);
	});

	it("rejects null input", () => {
		const result = v.safeParse(ClientIdSchema, null);
		expect(result.success).toBe(false);
	});

	it("rejects undefined input", () => {
		const result = v.safeParse(ClientIdSchema, undefined);
		expect(result.success).toBe(false);
	});

	it("rejects UUID-like string with wrong length", () => {
		const result = v.safeParse(
			ClientIdSchema,
			"550e8400-e29b-41d4-a716-44665544000",
		); // one char short
		expect(result.success).toBe(false);
	});
});
