export const load: import("./$types").PageServerLoad = async ({ locals }) => {
	const phone = locals.user.phone;
	const lastFour = phone.slice(-4);

	return {
		masked: lastFour,
	};
};
