import type { PageServerLoad } from "./$types";
import { validateInviteToken, getInviteByToken } from "$lib/api/beta-invites.remote";

export const load: PageServerLoad = async ({ params, cookies }) => {
	const { token } = params;

	// Validate the invite token
	const validation = await validateInviteToken(token);

	if (!validation.valid) {
		return {
			valid: false,
			reason: validation.reason,
			email: null,
			expiresAt: null,
		};
	}

	// Get full invite details for display
	const invite = await getInviteByToken(token);

	// Store token in cookie for OAuth redirect survival
	cookies.set("beta_invite_token", token, {
		path: "/",
		maxAge: 60 * 60 * 24 * 7, // 7 days
		httpOnly: true,
		sameSite: "lax",
	});

	return {
		valid: true,
		reason: null,
		email: validation.email,
		expiresAt: invite?.expiresAt || null,
	};
};
