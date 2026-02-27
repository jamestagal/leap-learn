import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { db } from "$lib/server/db";
import { betaInvites } from "$lib/server/schema";
import { eq, and, isNull, gt } from "drizzle-orm";

export const load: PageServerLoad = async ({ url, cookies }) => {
	// Check if this is a redirect from magic link send (?send=true)
	const isMagicLinkSent = url.searchParams.get("send") === "true";

	if (isMagicLinkSent) {
		// Check if user came from beta invite flow
		const inviteToken = cookies.get("beta_invite_token");

		if (inviteToken) {
			// Validate the invite is still valid before redirecting
			const [invite] = await db
				.select({ id: betaInvites.id })
				.from(betaInvites)
				.where(
					and(
						eq(betaInvites.token, inviteToken),
						isNull(betaInvites.usedAt),
						gt(betaInvites.expiresAt, new Date()),
					),
				)
				.limit(1);

			if (invite) {
				// Redirect back to invite page with send=true so they see the "check email" message
				throw redirect(302, `/invite/${inviteToken}?send=true`);
			}
		}
	}

	// Normal login page - no special handling needed
	return {};
};
