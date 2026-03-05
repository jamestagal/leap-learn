import { importSPKI, jwtVerify } from 'jose';

let cachedKey: CryptoKey | null = null;

export async function verifyJWT(
	token: string,
	publicKeyPem: string
): Promise<{ userId: string; email: string } | null> {
	try {
		if (!cachedKey) {
			// LeapLearn JWTs use EdDSA (Ed25519), NOT RS256
			// Handle escaped newlines from env vars (e.g. "-----BEGIN...-----\nMCow...\n-----END...-----")
			const pem = publicKeyPem.replace(/\\n/g, '\n');
			cachedKey = await importSPKI(pem, 'EdDSA');
		}

		const { payload } = await jwtVerify(token, cachedKey);
		return {
			// Go backend puts user ID in 'id' claim (not 'sub')
			// See: app/pkg/auth/auth.go AccessTokenClaims
			userId: payload.id as string,
			email: payload.email as string,
		};
	} catch {
		return null;
	}
}
