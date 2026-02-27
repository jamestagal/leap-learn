#!/usr/bin/env npx tsx
/**
 * One-time migration script: encrypt existing plaintext banking data.
 *
 * Usage:
 *   cd /path/to/webkit
 *   ENCRYPTION_KEY=<base64-key> DATABASE_URL=postgres://user:pass@host:5432/db npx tsx scripts/encrypt-existing-data.ts
 *
 * Or with individual env vars:
 *   ENCRYPTION_KEY=<base64-key> POSTGRES_HOST=localhost POSTGRES_PORT=5432 POSTGRES_DB=postgres POSTGRES_USER=postgres POSTGRES_PASSWORD=postgres npx tsx scripts/encrypt-existing-data.ts
 *
 * The script is idempotent — it detects already-encrypted values and skips them.
 */

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import pg from "pg";

// ---------------------------------------------------------------------------
// Encryption helpers (duplicated from crypto.ts to avoid SvelteKit imports)
// ---------------------------------------------------------------------------

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function getKey(): Buffer {
	const key = process.env.ENCRYPTION_KEY;
	if (!key) {
		console.error("ERROR: ENCRYPTION_KEY environment variable is required");
		process.exit(1);
	}
	const buf = Buffer.from(key, "base64");
	if (buf.length !== 32) {
		console.error("ERROR: ENCRYPTION_KEY must be 32 bytes (base64-encoded)");
		process.exit(1);
	}
	return buf;
}

function encrypt(plaintext: string): string {
	if (!plaintext) return "";
	const key = getKey();
	const iv = randomBytes(IV_LENGTH);
	const cipher = createCipheriv(ALGORITHM, key, iv);
	let encrypted = cipher.update(plaintext, "utf8");
	encrypted = Buffer.concat([encrypted, cipher.final()]);
	const authTag = cipher.getAuthTag();
	return Buffer.concat([iv, encrypted, authTag]).toString("base64");
}

function tryDecrypt(value: string): string {
	if (!value) return "";
	try {
		const key = getKey();
		const data = Buffer.from(value, "base64");
		if (data.length < IV_LENGTH + AUTH_TAG_LENGTH + 1) return value;
		const iv = data.subarray(0, IV_LENGTH);
		const authTag = data.subarray(data.length - AUTH_TAG_LENGTH);
		const encrypted = data.subarray(IV_LENGTH, data.length - AUTH_TAG_LENGTH);
		const decipher = createDecipheriv(ALGORITHM, key, iv);
		decipher.setAuthTag(authTag);
		let decrypted = decipher.update(encrypted);
		decrypted = Buffer.concat([decrypted, decipher.final()]);
		return decrypted.toString("utf8");
	} catch {
		return value; // Not encrypted — return as-is
	}
}

function isAlreadyEncrypted(value: string): boolean {
	if (!value) return false;
	const decrypted = tryDecrypt(value);
	// If tryDecrypt returns something different, the value was encrypted
	return decrypted !== value;
}

// ---------------------------------------------------------------------------
// Database connection
// ---------------------------------------------------------------------------

function getPool(): pg.Pool {
	const databaseUrl = process.env.DATABASE_URL;
	if (databaseUrl) {
		return new pg.Pool({ connectionString: databaseUrl });
	}
	return new pg.Pool({
		host: process.env.POSTGRES_HOST || "localhost",
		port: parseInt(process.env.POSTGRES_PORT || "5432"),
		database: process.env.POSTGRES_DB || "postgres",
		user: process.env.POSTGRES_USER || "postgres",
		password: process.env.POSTGRES_PASSWORD || "postgres",
	});
}

// ---------------------------------------------------------------------------
// Main migration
// ---------------------------------------------------------------------------

async function main() {
	console.log("Starting banking data encryption migration...\n");

	const pool = getPool();

	try {
		// Fetch all profiles with non-empty banking/tax fields
		const { rows } = await pool.query<{
			id: string;
			agency_id: string;
			bsb: string;
			account_number: string;
			tax_file_number: string;
		}>(
			`SELECT id, agency_id, bsb, account_number, tax_file_number
			 FROM agency_profiles
			 WHERE bsb != '' OR account_number != '' OR tax_file_number != ''`,
		);

		console.log(`Found ${rows.length} profile(s) with banking/tax data.\n`);

		let encrypted = 0;
		let skipped = 0;

		for (const row of rows) {
			const updates: string[] = [];
			const values: string[] = [];
			let paramIdx = 1;

			// Process each field
			for (const [col, field] of [
				["bsb", row.bsb],
				["account_number", row.account_number],
				["tax_file_number", row.tax_file_number],
			] as const) {
				if (!field) continue;
				if (isAlreadyEncrypted(field)) {
					continue; // Already encrypted, skip
				}
				updates.push(`${col} = $${paramIdx}`);
				values.push(encrypt(field));
				paramIdx++;
			}

			if (updates.length === 0) {
				skipped++;
				continue;
			}

			values.push(row.id);
			await pool.query(
				`UPDATE agency_profiles SET ${updates.join(", ")}, updated_at = NOW() WHERE id = $${paramIdx}`,
				values,
			);

			encrypted++;
			console.log(`  Encrypted profile for agency ${row.agency_id} (${updates.length} field(s))`);
		}

		console.log(`\nDone. Encrypted: ${encrypted}, Already encrypted/skipped: ${skipped}`);
	} finally {
		await pool.end();
	}
}

main().catch((err) => {
	console.error("Migration failed:", err);
	process.exit(1);
});
