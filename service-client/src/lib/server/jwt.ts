import * as jose from "jose";
import { readFileSync, existsSync } from "fs";
import { logger } from "./logger";
import path from "path";

// Load public key - check env var first, then fall back to file
function getPublicKeyContent(): string {
	// Check env var first (production)
	const envKey = process.env["JWT_PUBLIC_KEY"];
	if (envKey) {
		return envKey;
	}
	// Check Docker path
	if (existsSync("/public.pem")) {
		return readFileSync("/public.pem", "utf-8");
	}
	// Fall back to relative path for local development
	return readFileSync(path.resolve(process.cwd(), "public.pem"), "utf-8");
}

// Verify a JWT token using EdDSA
export async function verifyJWT<T>(token: string): Promise<T | undefined> {
	// Empty token is not an error, just means user isn't authenticated
	if (!token) {
		return undefined;
	}

	try {
		const publicKey = getPublicKeyContent();
		const p = await jose.importSPKI(publicKey, "EdDSA");
		const { payload } = await jose.jwtVerify<T>(token, p);
		return payload;
	} catch (e) {
		// Token expiration is normal (triggers refresh), only log actual errors
		if (e instanceof jose.errors.JWTExpired) {
			logger.debug("JWT token expired - refresh will be attempted");
		} else {
			logger.error("Error verifying JWT", e);
		}
		return undefined;
	}
}
