# Coding Conventions

**Analysis Date:** 2026-01-22

## Naming Patterns

**Files:**
- Components: PascalCase with `.svelte` extension (e.g., `ClientInfoForm.svelte`, `BusinessContext.svelte`)
- Remote functions: kebab-case with `.remote.ts` suffix (e.g., `consultation.remote.ts`, `agency-profile.remote.ts`)
- Type definitions: kebab-case with `.types.ts` suffix (e.g., `questionnaire.types.ts`)
- Server utilities: kebab-case with `.ts` extension in `src/lib/server/` (e.g., `permissions.ts`, `logger.ts`)
- Store files: kebab-case with `.svelte.ts` suffix (e.g., `consultation.svelte.ts`, `agency-config.svelte.ts`)
- Test files: Original name with `.test.ts` or `.spec.ts` suffix (e.g., `consultation.remote.test.ts`)
- Routes: Directory structure follows `src/routes/[agencySlug]/consultation/+page.svelte`

**Functions:**
- camelCase (e.g., `getConsultation`, `saveContactInfo`, `createConsultation`)
- Query functions: `get*` prefix (e.g., `getExistingDraftConsultation`, `getAgencyConsultations`)
- Command functions: `create*`, `update*`, `save*`, `complete*`, `delete*` (e.g., `createConsultation`, `autoSaveDraft`)
- Handler functions: `handle*` prefix (e.g., `handleClick`, `handleUnload`)
- Service methods: Action verbs (e.g., `debounce`, `perf`, `validateSchema`)

**Variables:**
- Local state and props: camelCase (e.g., `currentStep`, `isDirty`, `isAutoSaving`)
- Constants: UPPER_SNAKE_CASE (e.g., `AUTO_SAVE_DELAY`, `MAX_RETRIES`)
- Boolean flags: `is*` or `has*` prefix (e.g., `isDirty`, `isAutoSaving`, `hasErrors`)
- Query parameters: snake_case (e.g., `business_name`, `contact_person`, `primary_goals`)
- Database columns: snake_case (e.g., `created_at`, `updated_at`, `completion_percentage`)

**Types:**
- Interfaces: PascalCase, no "I" prefix (e.g., `Props`, `ValidationResult`, `ConsultationFormState`)
- Type definitions: PascalCase (e.g., `Consultation`, `ContactInfo`, `BusinessContext`)
- Enums: PascalCase (e.g., `UrgencyLevel`, `ConsultationStatus`)
- Generic types: Single letter (e.g., `T`, `E`) or descriptive (e.g., `TData`)

## Code Style

**Formatting:**
- Tool: Prettier with custom plugins
- Tab width: Tabs (2-space equivalent via `useTabs: true`)
- Quote style: Double quotes (`"`)
- Trailing comma: Always (`trailingComma: "all"`)
- Print width: 100 characters
- HTML whitespace: `ignore` mode

**Prettier Configuration** (`service-client/.prettierrc`):
```json
{
  "useTabs": true,
  "singleQuote": false,
  "trailingComma": "all",
  "printWidth": 100,
  "htmlWhitespaceSensitivity": "ignore",
  "plugins": ["prettier-plugin-svelte", "prettier-plugin-tailwindcss"]
}
```

**Linting:**
- Tool: ESLint 9 with TypeScript support
- Config: `service-client/eslint.config.js` (flat config)
- Key rules:
  - `@typescript-eslint/explicit-function-return-type` - Required for all functions (except expressions)
  - TypeScript strict mode enabled
  - Svelte plugin with prettier compatibility
  - No `undefined` globals (custom rule)

**TypeScript Strict Settings** (`tsconfig.json`):
- `strict: true` - All strict type-checking options enabled
- `noImplicitAny: true` - No implicit `any` types
- `strictNullChecks: true` - Strict null/undefined checking
- `noUnusedLocals: true` - Error on unused variables
- `noUnusedParameters: true` - Error on unused function parameters
- `noImplicitReturns: true` - All code paths must return
- `exactOptionalPropertyTypes: true` - Optional properties must be `PropertyName: Type | undefined`

## Import Organization

**Order:**
1. External packages (npm imports)
2. Svelte/SvelteKit imports (`svelte`, `$app/*`)
3. Relative imports from `$lib/`
4. Type imports (`import type { ... }`)

**Example from source:**
```typescript
import { query, command } from "$app/server";
import * as v from "valibot";
import { db } from "$lib/server/db";
import { consultations, users, agencyMemberships } from "$lib/server/schema";
import type { PerformanceData } from "$lib/server/schema";
```

**Path Aliases:**
- `$lib/` - Points to `src/lib/`
- `$app/` - SvelteKit internal modules
- `$env/` - Environment variables (dynamic/static)

## Error Handling

**Patterns:**
- Server-side errors thrown as `Error` instances with descriptive messages:
  ```typescript
  if (!consultation) {
    throw new Error("Consultation not found");
  }
  ```

- HTTP error responses use standard status codes:
  - 400: Bad Request (validation failures)
  - 401: Unauthorized (auth failures)
  - 404: Not Found (resource doesn't exist)
  - 500: Internal Server Error

- Validation errors returned as `ValidationResult<T>`:
  ```typescript
  interface ValidationResult<T> {
    success: boolean;
    data?: T;
    errors?: string[];
  }
  ```

- Schema validation with Valibot:
  ```typescript
  export const getConsultation = query(
    v.pipe(v.string(), v.uuid()),
    async (id: string) => { ... }
  );
  ```

- Network errors in tests use mock fetch with `rejects.toThrow()`

## Logging

**Framework:** Winston logger with console transport

**Configuration** (`src/lib/server/logger.ts`):
```typescript
const logger = winston.createLogger({
  level: env.LOG_LEVEL,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.colorize(),
    winston.format.printf((info) => `[${info["timestamp"]}] ${info.level.toUpperCase()}: ${info.message}`)
  ),
  transports: [new winston.transports.Console()]
});
```

**Usage Patterns:**
- Debug logs: `logger.debug("message", data)`
- Info logs: `logger.info("message", data)`
- Error logs: `logger.error("message", error)`
- Warn logs: `logger.warn("message", data)`

**Performance Logging:**
```typescript
const measure = perf("operation-name");
// ... do work ...
measure(optionalData);
```

Only logs if `LOG_LEVEL` is "debug".

## Comments

**When to Comment:**
- Complex business logic or multi-step processes
- Non-obvious algorithm decisions
- Critical sections that need context (e.g., auth flows)
- TODO items for incomplete work
- Integration points between services

**JSDoc/TSDoc:**
- Used in remote functions for parameter/return documentation:
  ```typescript
  /**
   * Get existing draft consultation for the current agency.
   * Returns null if no draft exists.
   */
  export const getExistingDraftConsultation = query(async () => { ... });
  ```

- Used in test files for suite descriptions:
  ```typescript
  /**
   * Integration Tests for Consultation Remote Functions
   * Tests cover:
   * - Successful API calls with valid data
   * - HTTP error handling
   * - Cookie-based authentication
   */
  ```

## Function Design

**Size:** Functions should be focused and single-purpose. Database queries and API calls kept compact.

**Parameters:**
- Remote functions accept schema-validated parameters as first argument:
  ```typescript
  export const getConsultation = query(
    v.pipe(v.string(), v.uuid()),
    async (id: string) => { ... }
  );
  ```

- Complex data passed as objects:
  ```typescript
  await autoSaveDraft({
    consultationId,
    data: draftData,
  });
  ```

- Optional filters use `v.optional()` wrapper:
  ```typescript
  const ContractFiltersSchema = v.optional(
    v.object({
      status: v.optional(ContractStatusSchema),
      limit: v.optional(v.pipe(v.number(), v.minValue(1), v.maxValue(100))),
    })
  );
  export const getContracts = query(ContractFiltersSchema, async (filters) => {
    const { status, limit = 50, offset = 0 } = filters || {};
  });
  ```

**Return Values:**
- Query functions: Return data directly or throw error
- Command functions: Return mutated data or throw error
- Service methods: Return typed objects or null
- Remote functions: Schema validation on return data (via Valibot)

## Module Design

**Exports:**
- Remote functions ONLY export `query()`, `command()`, `form()`, or `prerender()` wrapped functions
- Type exports go in separate `.types.ts` files
- Server utilities export regular functions prefixed with context (e.g., `validateSchema`, `perf`)

**Barrel Files:**
- Use index exports for convenience (e.g., `src/lib/index.ts`)
- Don't create barrel files that re-export everything (prefer explicit imports)

**Example Separation:**
```typescript
// questionnaire.types.ts
export type QuestionnaireResponses = { ... };

// questionnaire.remote.ts
import type { QuestionnaireResponses } from './questionnaire.types';
export const getQuestionnaire = query(...);
```

## Svelte 5 Component Patterns

**Props Declaration:**
```typescript
<script lang="ts">
  interface Props {
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
  }

  let { value, onChange, disabled = false }: Props = $props();
</script>
```

**State and Reactivity:**
- State: Use `$state()` rune
- Derived: Use `$derived()` for computed values
- Effects: Use `$effect()` for side effects
- Snippets: Use `Snippet` type for named slots

**Event Handling:**
- Event handlers use `onclick`, `onchange`, not `on:click`, `on:change`
- Keyboard events: `onkeydown`, `onkeyup`, `onkeypress`
- Window events: `<svelte:window onbeforeunload={fn} />`

## Database and Schema

**Naming:**
- Tables: snake_case (e.g., `consultations`, `agency_memberships`)
- Columns: snake_case (e.g., `created_at`, `contact_person`)
- Foreign keys: `{table}_id` format (e.g., `consultation_id`)

**Patterns:**
- Use Drizzle ORM with TypeScript schema definitions in `src/lib/server/schema.ts`
- All queries use `withAgencyScope()` helper for multi-tenancy isolation:
  ```typescript
  const consultations = await withAgencyScope(agencyId, async (id) => {
    return db.query.consultations.findMany({
      where: eq(consultations.agencyId, id)
    });
  });
  ```

---

*Convention analysis: 2026-01-22*
