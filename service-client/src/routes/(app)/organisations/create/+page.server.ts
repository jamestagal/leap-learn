import type { PageServerLoad } from "./$types";
import { validateInviteToken } from "$lib/api/beta-invites.remote";

export const load: PageServerLoad = async ({ cookies }) => {
	// Check for invite token in cookie
	const inviteToken = cookies.get("beta_invite_token");

	if (!inviteToken) {
		return {
			hasInvite: false,
			inviteToken: null,
			inviteEmail: null,
			inviteValid: false,
		};
	}

	// Validate the token
	const validation = await validateInviteToken(inviteToken);

	if (!validation.valid) {
		// Clear invalid token
		cookies.delete("beta_invite_token", { path: "/" });

		return {
			hasInvite: false,
			inviteToken: null,
			inviteEmail: null,
			inviteValid: false,
		};
	}

	return {
		hasInvite: true,
		inviteToken,
		inviteEmail: validation.email,
		inviteValid: true,
	};
};
