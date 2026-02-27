/**
 * Handle form submission
 */
export function submit({ formElement }: { formElement: HTMLFormElement }) {
	const submitBtn = formElement.querySelector("button[type=submit]") as HTMLButtonElement;
	const loading = formElement.querySelector("#loading");
	const icon = formElement.querySelector("#icon");

	// Disable submit btn
	submitBtn.disabled = true;
	// show loading only if it takes more than 500ms
	const timeout = setTimeout(() => {
		loading?.classList.remove("hidden");
		icon?.classList.add("hidden");
	}, 500);
	return async ({
		update,
	}: {
		update: (options?: { reset?: boolean; invalidateAll?: boolean }) => void;
	}) => {
		submitBtn.disabled = false;
		loading?.classList.add("hidden");
		icon?.classList.remove("hidden");
		if (timeout) {
			clearTimeout(timeout);
		}
		update();
	};
}
