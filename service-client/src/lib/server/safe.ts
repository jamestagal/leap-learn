export type Safe<T> =
	| {
			success: true;
			data: T;
			message: string;
	  }
	| {
			success: false;
			message: string;
			code: number;
	  };

export async function safe<T>(promise: Promise<T>): Promise<Safe<T>> {
	try {
		const data = await promise;
		return { data, success: true, message: "Success" };
	} catch (e) {
		if (e instanceof Error) {
			return { success: false, message: e.message, code: 500 };
		}
		return { success: false, message: "Something went wrong", code: 500 };
	}
}

export function safeSync<T>(func: () => T): Safe<T> {
	try {
		const data = func();
		return { data, success: true, message: "Success" };
	} catch (e) {
		if (e instanceof Error) {
			return { success: false, message: e.message, code: 500 };
		}
		return { success: false, message: "Something went wrong", code: 500 };
	}
}
