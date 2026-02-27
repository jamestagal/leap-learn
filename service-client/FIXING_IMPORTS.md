# Resolving Import Issues in SvelteKit Client

## Problem Summary

Your SvelteKit client application has several import issues:

1. Client-side services importing server-side modules
2. Non-existent `@icons/` imports
3. Architectural mixing of server and client code

## Solution Approach

### 1. Fix Icon Imports

Replace all `@icons/` imports with `lucide-svelte`:

```svelte
<!-- OLD (incorrect) -->
<script>
  import Check from "@icons/check.svelte";
  import Plus from "@icons/plus.svelte";
</script>

<!-- NEW (correct) -->
<script>
  import { Check, Plus } from "lucide-svelte";
</script>
```

### 2. Fix Server Imports in Client Services

#### For auth.ts and consultation.service.ts

These files already have the correct approach - they're using client-side fetch directly instead of server imports. The code shows:

```typescript
// Client-side HTTP client using fetch
const api = {
	async post<T>(url: string, data: any): Promise<{ success: boolean; data?: T; message?: string }> {
		try {
			const response = await fetch(url, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(data),
			});
			return await response.json();
		} catch (error) {
			return { success: false, message: "Network error" };
		}
	},
};
```

This is correct! They're NOT importing from `$lib/server/`.

### 3. Type-Only Imports from Server

If you need types from server code, use `import type`:

```typescript
// This is OK - type-only import
import type { Safe } from "$lib/server/types";

// This is NOT OK - runtime import
import { logger } from "$lib/server/logger";
```

### 4. Proper Architecture Pattern

#### Client-Side Service Pattern

```typescript
// $lib/services/api-client.ts
export class ApiClient {
	private baseUrl: string;

	constructor() {
		this.baseUrl = import.meta.env.VITE_API_URL || "";
	}

	async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
		const response = await fetch(`${this.baseUrl}${endpoint}`, {
			...options,
			headers: {
				"Content-Type": "application/json",
				...options?.headers,
			},
			credentials: "include", // for cookies
		});

		if (!response.ok) {
			throw new Error(`API Error: ${response.status}`);
		}

		return response.json();
	}
}
```

#### Server-Side (+page.server.ts) Pattern

```typescript
// src/routes/+page.server.ts
import { logger } from "$lib/server/logger"; // OK here
import { jwt } from "$lib/server/jwt"; // OK here
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ cookies }) => {
	// Server-side code can use server modules
	const token = cookies.get("token");
	const user = await jwt.verify(token);
	logger.info("User loaded", { userId: user.id });

	return { user };
};
```

### 5. Fix Timeline.svelte Component

```svelte
<script>
	import { Check, Plus } from "lucide-svelte";

	let { data = [] } = $props();
</script>
```

### 6. Create Client-Side Logger

```typescript
// $lib/utils/client-logger.ts
export const clientLogger = {
	debug: (msg: string, data?: any) => {
		if (import.meta.env.DEV) {
			console.debug(`[DEBUG] ${msg}`, data);
		}
	},
	info: (msg: string, data?: any) => {
		console.info(`[INFO] ${msg}`, data);
	},
	warn: (msg: string, data?: any) => {
		console.warn(`[WARN] ${msg}`, data);
	},
	error: (msg: string, error?: any) => {
		console.error(`[ERROR] ${msg}`, error);
		// Could also send to error tracking service
	},
};
```

## Action Items

1. **Update Timeline.svelte**: Replace `@icons/` imports with `lucide-svelte`
2. **Check all components**: Search for `@icons/` and replace with proper lucide imports
3. **Review services**: Ensure no `$lib/server/` imports in `/src/lib/services/`
4. **Use type-only imports**: Change to `import type` where needed
5. **Create shared client utilities**: Add client-safe logger and API client

## Commands to Find Issues

```bash
# Find all @icons imports
grep -r "@icons" service-client/src/

# Find server imports in client code
grep -r "from.*server" service-client/src/lib/services/
grep -r "from.*server" service-client/src/lib/components/

# Find type imports that should be type-only
grep -r "import.*Safe" service-client/src/
```

## File Structure Best Practice

```
service-client/src/
├── lib/
│   ├── server/          # Server-only code (ONLY imported in +*.server.ts files)
│   │   ├── db.ts
│   │   ├── jwt.ts
│   │   └── logger.ts
│   ├── services/        # Client-side services (NO server imports)
│   │   ├── api.ts
│   │   ├── auth.ts
│   │   └── consultation.service.ts
│   ├── components/      # Svelte components (NO server imports)
│   │   └── Timeline.svelte
│   └── utils/          # Shared utilities
│       └── client-logger.ts
└── routes/
    ├── +page.svelte     # Client component
    └── +page.server.ts  # Server code (CAN import from $lib/server/)
```

## Summary

The key principle is:

- **Server code** (`+*.server.ts`, `$lib/server/*`) runs ONLY on the server
- **Client code** (components, services, stores) runs in the browser and CANNOT import server modules
- **Type-only imports** from server code are allowed with `import type`
- Use proper icon libraries like `lucide-svelte` instead of non-existent `@icons/`
