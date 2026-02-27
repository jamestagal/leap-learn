import type { PageServerLoad } from "./$types";
import { getOrganisationProfile } from "$lib/api/organisation-profile.remote";

export const load: PageServerLoad = async () => {
	const profileData = await getOrganisationProfile();

	return {
		profile: profileData.profile,
		organisation: profileData.organisation,
	};
};
