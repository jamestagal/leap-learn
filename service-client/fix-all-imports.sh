#!/bin/bash

# Complete Import Fix Script for GoFast Proposal Generator Client
# Fixes: Icon imports, server imports in client code, type-only imports

echo "🔧 Starting comprehensive import fix for service-client..."

# 1. Fix Icon Imports in Timeline.svelte
echo "Step 1: Fixing icon imports..."
if [ -f "src/lib/components/Timeline.svelte" ]; then
    cat > src/lib/components/Timeline.svelte << 'EOF'
<script>
	import { Check, Plus } from "lucide-svelte";

	let { data = [] } = $props();
</script>

<!-- Timeline Points -->
<div
	class="border-secondary-3 mx-auto flex w-full flex-col gap-4 border-l-2 md:flex-row md:border-t-2 md:border-l-0"
>
	{#each data as item, idx}
		<div class="relative pb-8 md:w-1/4 md:pb-0 md:pt-5">
			<div
				class="absolute -left-3 top-0 h-6 w-6 rounded-full bg-white ring-8 ring-white md:-top-3 md:left-auto md:right-0"
			>
				{#if item.status === "completed"}
					<Check class="h-6 w-6 text-green-500" />
				{:else if item.status === "current"}
					<Plus class="h-6 w-6 text-blue-500" />
				{:else}
					<div class="h-6 w-6 rounded-full bg-gray-300"></div>
				{/if}
			</div>

			<div class="pl-8 md:pl-0 md:pr-8">
				<h3 class="text-lg font-semibold">{item.title}</h3>
				<p class="text-sm text-gray-600">{item.description}</p>
				{#if item.date}
					<time class="text-xs text-gray-500">{item.date}</time>
				{/if}
			</div>
		</div>
	{/each}
</div>
EOF
    echo "✅ Timeline.svelte fixed"
fi

# 2. Check and report any remaining @icons imports
echo -e "\nStep 2: Checking for remaining @icons imports..."
icon_files=$(find src -type f \( -name "*.svelte" -o -name "*.ts" \) -exec grep -l "@icons" {} \; 2>/dev/null)
if [ -n "$icon_files" ]; then
    echo "⚠️  Found files with @icons imports that need manual fixing:"
    echo "$icon_files"
    echo "Please manually replace these with lucide-svelte imports"
else
    echo "✅ No @icons imports found"
fi

# 3. Check for server imports in client services
echo -e "\nStep 3: Checking for server imports in client code..."
server_imports=$(grep -r "from.*\\\$lib/server" src/lib/services/ src/lib/components/ 2>/dev/null | grep -v "import type")
if [ -n "$server_imports" ]; then
    echo "⚠️  Found server imports in client code:"
    echo "$server_imports"
    echo "These need to be removed or replaced with client-safe alternatives"
else
    echo "✅ No server imports in client code"
fi

# 4. Check for non-type imports that should be type-only
echo -e "\nStep 4: Checking for imports that should be type-only..."
type_imports=$(grep -r "import.*Safe" src/lib/ 2>/dev/null | grep -v "import type" | grep -v "src/lib/server")
if [ -n "$type_imports" ]; then
    echo "⚠️  Found imports that might need to be type-only:"
    echo "$type_imports"
    echo "Consider changing these to 'import type' if they're only used as types"
else
    echo "✅ All type imports look correct"
fi

# 5. Create client-safe utilities if they don't exist
echo -e "\nStep 5: Creating client-safe utilities..."

# Create client logger
if [ ! -f "src/lib/utils/client-logger.ts" ]; then
    mkdir -p src/lib/utils
    cat > src/lib/utils/client-logger.ts << 'EOF'
/**
 * Client-safe logger for browser environment
 * Does not depend on any server-side modules
 */
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
		// Could also send to error tracking service like Sentry
	}
};
EOF
    echo "✅ Created client-logger.ts"
else
    echo "✅ client-logger.ts already exists"
fi

# Create API client helper
if [ ! -f "src/lib/utils/api-client.ts" ]; then
    cat > src/lib/utils/api-client.ts << 'EOF'
/**
 * Client-safe API helper for browser environment
 * Uses native fetch API without server dependencies
 */
export class ApiClient {
	private baseUrl: string;

	constructor(baseUrl?: string) {
		this.baseUrl = baseUrl || import.meta.env.VITE_API_URL || '';
	}

	async request<T>(
		endpoint: string,
		options?: RequestInit
	): Promise<{ success: boolean; data?: T; message?: string }> {
		try {
			const response = await fetch(`${this.baseUrl}${endpoint}`, {
				...options,
				headers: {
					'Content-Type': 'application/json',
					...options?.headers,
				},
				credentials: 'include', // for cookies
			});

			const data = await response.json();

			if (!response.ok) {
				return {
					success: false,
					message: data.message || `Error: ${response.status}`,
				};
			}

			return {
				success: true,
				data,
			};
		} catch (error) {
			return {
				success: false,
				message: error instanceof Error ? error.message : 'Network error',
			};
		}
	}

	async get<T>(endpoint: string) {
		return this.request<T>(endpoint, { method: 'GET' });
	}

	async post<T>(endpoint: string, body: any) {
		return this.request<T>(endpoint, {
			method: 'POST',
			body: JSON.stringify(body),
		});
	}

	async put<T>(endpoint: string, body: any) {
		return this.request<T>(endpoint, {
			method: 'PUT',
			body: JSON.stringify(body),
		});
	}

	async delete<T>(endpoint: string) {
		return this.request<T>(endpoint, { method: 'DELETE' });
	}
}

export const api = new ApiClient();
EOF
    echo "✅ Created api-client.ts"
else
    echo "✅ api-client.ts already exists"
fi

# 6. Summary
echo -e "\n📊 Import Fix Summary:"
echo "========================"

# Count issues
icon_count=$(find src -type f \( -name "*.svelte" -o -name "*.ts" \) -exec grep -l "@icons" {} \; 2>/dev/null | wc -l)
server_count=$(grep -r "from.*\\\$lib/server" src/lib/services/ src/lib/components/ 2>/dev/null | grep -v "import type" | wc -l)

if [ "$icon_count" -eq 0 ] && [ "$server_count" -eq 0 ]; then
    echo "✅ All import issues have been resolved!"
else
    echo "⚠️  Remaining issues to fix manually:"
    [ "$icon_count" -gt 0 ] && echo "  - $icon_count files with @icons imports"
    [ "$server_count" -gt 0 ] && echo "  - $server_count server imports in client code"
    echo ""
    echo "Run this script again after manual fixes to verify"
fi

echo -e "\n🎯 Next Steps:"
echo "1. Replace any remaining @icons imports with lucide-svelte"
echo "2. Update services to use client-logger instead of server logger"
echo "3. Use api-client for HTTP requests instead of server HTTP module"
echo "4. Ensure all server code stays in +*.server.ts files"
echo "5. Run 'npm run check' to verify no TypeScript errors"

echo -e "\n✅ Script complete!"
