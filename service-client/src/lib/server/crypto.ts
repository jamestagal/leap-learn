import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { env } from '$env/dynamic/private';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 12 bytes for GCM (recommended)
const AUTH_TAG_LENGTH = 16;

function getKey(): Buffer {
	const key = env.ENCRYPTION_KEY;
	if (!key) throw new Error('ENCRYPTION_KEY environment variable is required');
	const buf = Buffer.from(key, 'base64');
	if (buf.length !== 32) throw new Error('ENCRYPTION_KEY must be 32 bytes (base64-encoded)');
	return buf;
}

/** Encrypt plaintext. Returns base64(iv + ciphertext + authTag). Empty string passthrough. */
export function encrypt(plaintext: string): string {
	if (!plaintext) return '';
	const key = getKey();
	const iv = randomBytes(IV_LENGTH);
	const cipher = createCipheriv(ALGORITHM, key, iv);
	let encrypted = cipher.update(plaintext, 'utf8');
	encrypted = Buffer.concat([encrypted, cipher.final()]);
	const authTag = cipher.getAuthTag();
	return Buffer.concat([iv, encrypted, authTag]).toString('base64');
}

/** Decrypt base64 encrypted string. Empty string passthrough. Graceful fallback for legacy plaintext values. */
export function decrypt(encryptedBase64: string): string {
	if (!encryptedBase64) return '';
	try {
		const key = getKey();
		const data = Buffer.from(encryptedBase64, 'base64');
		if (data.length < IV_LENGTH + AUTH_TAG_LENGTH + 1) return encryptedBase64; // too short to be encrypted
		const iv = data.subarray(0, IV_LENGTH);
		const authTag = data.subarray(data.length - AUTH_TAG_LENGTH);
		const encrypted = data.subarray(IV_LENGTH, data.length - AUTH_TAG_LENGTH);
		const decipher = createDecipheriv(ALGORITHM, key, iv);
		decipher.setAuthTag(authTag);
		let decrypted = decipher.update(encrypted);
		decrypted = Buffer.concat([decrypted, decipher.final()]);
		return decrypted.toString('utf8');
	} catch {
		// Graceful fallback: return original value (handles legacy unencrypted data)
		return encryptedBase64;
	}
}

/** Decrypt banking fields on a profile object. Returns new object with decrypted fields. */
export function decryptProfileFields<T extends { bsb: string; accountNumber: string; taxFileNumber: string }>(profile: T): T {
	return {
		...profile,
		bsb: decrypt(profile.bsb),
		accountNumber: decrypt(profile.accountNumber),
		taxFileNumber: decrypt(profile.taxFileNumber),
	};
}
