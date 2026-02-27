# Testing Patterns

**Analysis Date:** 2026-01-22

## Test Framework

**Runner:**
- Vitest 3.0.0 with workspace configuration
- Config: `service-client/vite.config.ts`
- Environments: jsdom (client), node (server)

**Assertion Library:**
- Vitest built-in expect API
- `@testing-library/svelte` for component testing
- `@testing-library/jest-dom` for DOM matchers
- Playwright for E2E testing

**Run Commands:**
```bash
npm run test              # Run all tests (e2e + unit)
npm run test:unit        # Unit tests only (client + server)
npm run test:unit -- --run     # Run once (non-watch)
npm run test:e2e         # End-to-end tests
npm run lint             # Linter and prettier check
npm run check            # Type check and svelte-check
```

## Test File Organization

**Location - Workspace Configuration:**
Tests are organized by environment in Vitest workspaces (`vite.config.ts`):

```javascript
test: {
  workspace: [
    {
      name: "client",
      environment: "jsdom",
      include: ["src/**/*.svelte.{test,spec}.{js,ts}"],
      exclude: ["src/lib/server/**"],
      setupFiles: ["./vitest-setup-client.ts"],
    },
    {
      name: "server",
      environment: "node",
      include: ["src/**/*.{test,spec}.{js,ts}"],
      exclude: ["src/**/*.svelte.{test,spec}.{js,ts}"],
      setupFiles: ["./src/lib/tests/setup.ts"],
    },
  ],
}
```

**File Naming:**
- Client component tests: `ComponentName.svelte.test.ts`
- Server function tests: `module.test.ts` or `module.spec.ts`
- Remote function tests: `filename.remote.test.ts`

**Directory Structure:**
```
src/
├── lib/
│   ├── components/
│   │   └── consultation/
│   │       ├── ClientInfoForm.svelte
│   │       └── ClientInfoForm.svelte.test.ts
│   ├── api/
│   │   ├── consultation.remote.ts
│   │   └── consultation.remote.test.ts
│   ├── types/
│   │   └── consultation.test.ts
│   └── tests/
│       ├── setup.ts
│       ├── consultation-forms.test.ts
│       └── consultation-workflow.test.ts
├── routes/
│   └── [agencySlug]/
│       └── consultation/
│           └── +page.svelte
└── e2e/
    ├── consultation-flow.test.ts
    └── demo.test.ts
```

## Test Structure

**Suite Organization - Describe/It Pattern:**

Client-side example from `consultation-forms.test.ts`:
```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/svelte";

describe("Consultation Form Components", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("ClientInfoForm", () => {
    it("should render all required form fields", () => {
      let data = {};
      render(ClientInfoForm, { data });

      expect(screen.getByLabelText(/business name/i)).toBeInTheDocument();
    });

    it("should validate email format", async () => {
      let data = {};
      render(ClientInfoForm, { data });

      const emailInput = screen.getByLabelText(/email address/i);
      await fireEvent.input(emailInput, { target: { value: "invalid-email" } });

      await waitFor(() => {
        expect(screen.getByText(/please enter a valid email address/i)).toBeInTheDocument();
      });
    });
  });
});
```

Server-side example from `consultation.remote.test.ts`:
```typescript
describe("Consultation Remote Functions", () => {
  let mockFetch: ReturnType<typeof vi.fn>;
  let mockCookies: { get: ReturnType<typeof vi.fn>; set: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockFetch = vi.fn();
    mockCookies = {
      get: vi.fn().mockReturnValue("123e4567-e89b-12d3-a456-426614174000"),
      set: vi.fn(),
    };

    const mockRequestEvent = {
      fetch: mockFetch,
      cookies: mockCookies,
    } as unknown as RequestEvent;

    setRequestEvent(mockRequestEvent);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("getOrCreateConsultation", () => {
    it("should create new consultation with POST request", async () => {
      const { getOrCreateConsultation } = await import("./consultation.remote");

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockConsultation,
      });

      const result = await getOrCreateConsultation();

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:4001/consultations",
        expect.objectContaining({
          method: "POST",
          credentials: "include",
        }),
      );

      expect(result).toEqual(mockConsultation);
    });
  });
});
```

**Patterns:**
- Setup: Use `beforeEach` to initialize test state, clear mocks
- Teardown: Use `afterEach` to clean up resources
- Assertions: Test both success and error paths
- Async: Use `await waitFor()` for async operations

## Mocking

**Framework:** Vitest with `vi.fn()` and `vi.mock()`

**Mock Setup Examples:**

Store mocking in client tests:
```typescript
vi.mock("$lib/stores/consultation.svelte", () => ({
  consultationStore: {
    formState: {
      isAutoSaving: false,
      lastSaved: undefined,
    },
    updateSectionData: vi.fn(),
  },
}));
```

Environment variables in server tests:
```typescript
vi.mock("$env/static/public", () => ({
  PUBLIC_CORE_URL: "http://localhost:4001",
  PUBLIC_CLIENT_URL: "http://localhost:3000",
}));

vi.mock("$app/environment", () => ({
  browser: true,
}));
```

Fetch mocking for remote functions:
```typescript
mockFetch = vi.fn();
mockFetch.mockResolvedValueOnce({
  ok: true,
  json: async () => mockConsultation,
});
```

localStorage mocking (`vitest-setup-client.ts`):
```typescript
const localStorageMock = {
  getItem: vi.fn((key: string) => localStorageMock.store[key] || null),
  setItem: vi.fn((key: string, value: string) => {
    localStorageMock.store[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete localStorageMock.store[key];
  }),
  clear: vi.fn(() => {
    localStorageMock.store = {};
  }),
  store: {} as Record<string, string>,
};

Object.defineProperty(global, "localStorage", {
  value: localStorageMock,
});
```

MediaQuery mocking (`vitest-setup-client.ts`):
```typescript
Object.defineProperty(window, "matchMedia", {
  writable: true,
  enumerable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});
```

**What to Mock:**
- External HTTP calls (fetch requests)
- Store state and methods
- Environment variables
- Browser APIs (localStorage, matchMedia)
- SvelteKit modules ($app/*, $env/*)

**What NOT to Mock:**
- Component rendering logic (test actual behavior)
- Validation schemas (test actual validation)
- Database interactions in integration tests (use test fixtures)
- Core business logic (test actual logic flow)

## Fixtures and Factories

**Test Data Fixtures:**

Mock data defined at top of test files:
```typescript
const mockConsultation = {
  id: "123e4567-e89b-12d3-a456-426614174000",
  user_id: "223e4567-e89b-12d3-a456-426614174000",
  contact_info: {},
  business_context: {},
  pain_points: {},
  goals_objectives: {},
  status: "draft" as const,
  completion_percentage: 0,
  created_at: "2025-10-24T10:00:00Z",
  updated_at: "2025-10-24T10:00:00Z",
};

const mockDraft = {
  id: "323e4567-e89b-12d3-a456-426614174000",
  consultation_id: "123e4567-e89b-12d3-a456-426614174000",
  user_id: "223e4567-e89b-12d3-a456-426614174000",
  contact_info: { business_name: "Test Corp" },
  business_context: {},
  pain_points: {},
  goals_objectives: {},
  created_at: "2025-10-24T10:00:00Z",
  updated_at: "2025-10-24T10:00:00Z",
};
```

**Location:**
- Co-located with test files at top or in separate fixture directory
- Test setup files in `src/lib/tests/setup.ts` for global fixtures

## Coverage

**Requirements:** Not enforced (no minimum target configured)

**View Coverage:**
```bash
npm run test:unit -- --coverage
```

Coverage reports output to terminal with line/branch/function breakdown.

## Test Types

**Unit Tests:**
- **Scope:** Individual functions, components, utilities
- **Approach:** Isolated with mocks, fast execution
- **Examples:**
  - Component rendering: `ClientInfoForm.svelte.test.ts`
  - Form validation: `consultation-forms.test.ts`
  - Schema validation: `consultation.test.ts`
  - Utility functions: `debounce`, `perf`

**Integration Tests:**
- **Scope:** Multiple components or modules working together
- **Approach:** Test real data flow, mock external dependencies
- **Examples:**
  - Form submission workflow: `consultation-workflow.test.ts`
  - API integration: `api-integration.test.ts`
  - Store updates: `consultation-store.test.ts`
  - Consultation flow from creation to completion

**E2E Tests:**
- **Framework:** Playwright 1.49.1
- **Config:** `playwright.config.ts`
- **Run:** `npm run test:e2e`
- **Test Dir:** `e2e/` directory
- **Examples:**
  - Complete consultation form flow: `consultation-flow.test.ts`
  - Multi-step user workflows
  - Network request tracking

**E2E Test Structure:**
```typescript
import { expect, test } from "@playwright/test";

test.describe("Consultation Form Flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/${TEST_AGENCY_SLUG}/consultation`);
  });

  test("complete consultation form flow with all 4 steps", async ({ page }) => {
    // Track network requests
    const apiCalls: Array<{ url: string; method: string }> = [];
    page.on("request", (request) => {
      if (request.url().includes("/consultations")) {
        apiCalls.push({
          url: request.url().replace(/^.*\/consultations/, "/consultations"),
          method: request.method(),
        });
      }
    });

    // Step 1: Fill and submit
    await expect(page.locator('h2:has-text("Contact Information")')).toBeVisible();
    await page.fill('input[name="business_name"]', "Test Company LLC");
    await page.click('button:has-text("Next")');

    // Step 2: Verify navigation
    await expect(page.locator('h2:has-text("Business Context")')).toBeVisible();

    // Verify API calls
    const contactInfoCall = apiCalls.find(
      (call) => call.method === "PUT" && call.url.match(/\/consultations\/[a-f0-9-]+$/),
    );
    expect(contactInfoCall).toBeTruthy();
  });
});
```

## Common Patterns

**Async Testing - waitFor Pattern:**
```typescript
it("should validate email format", async () => {
  let data = {};
  render(ClientInfoForm, { data });

  const emailInput = screen.getByLabelText(/email address/i);
  await fireEvent.input(emailInput, { target: { value: "invalid-email" } });

  // Wait for async validation to complete
  await waitFor(() => {
    expect(screen.getByText(/please enter a valid email address/i)).toBeInTheDocument();
  });
});
```

**Error Testing - Rejection Pattern:**
```typescript
it("should handle 401 Unauthorized error", async () => {
  const { getOrCreateConsultation } = await import("./consultation.remote");

  mockFetch.mockResolvedValueOnce({
    ok: false,
    status: 401,
    statusText: "Unauthorized",
    json: async () => ({ message: "Invalid token" }),
  });

  await expect(getOrCreateConsultation()).rejects.toThrow("Invalid token");
});
```

**Validation Error Testing - Schema Validation:**
```typescript
it("should validate email format with Zod schema", async () => {
  const { saveContactInfo } = await import("./consultation.remote");

  const invalidData = {
    email: "not-an-email", // Invalid email format
  };

  // Zod validation should fail before API call
  await expect(saveContactInfo(invalidData as any)).rejects.toThrow();
  expect(mockFetch).not.toHaveBeenCalled();
});
```

**Flow Integration Testing - Multi-Step Verification:**
```typescript
describe("Form Submission Flow Integration", () => {
  it("should complete full 4-step consultation flow", async () => {
    const { saveContactInfo, saveBusinessContext, savePainPoints, saveGoalsObjectives } =
      await import("./consultation.remote");

    // Step 1: Contact Info
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ...mockConsultation, completion_percentage: 25 }),
    });

    const step1Result = await saveContactInfo({
      business_name: "Acme Corp",
      email: "contact@acme.com",
    });

    expect(step1Result.completion_percentage).toBe(25);

    // Step 2: Business Context (similar pattern)
    // Step 3: Pain Points (similar pattern)
    // Step 4: Goals & Objectives (similar pattern)

    // Verify all 4 PUT requests were made
    expect(mockFetch).toHaveBeenCalledTimes(4);
  });
});
```

**Network Error Testing - Mock Rejection:**
```typescript
it("should handle network errors", async () => {
  const { getConsultation } = await import("./consultation.remote");

  mockFetch.mockRejectedValueOnce(new Error("Network error"));

  const consultationId = "123e4567-e89b-12d3-a456-426614174000";
  await expect(getConsultation(consultationId)).rejects.toThrow("Network error");
});
```

**Query String Verification - Multiple Filters:**
```typescript
it("should include status filter in query string", async () => {
  const { listConsultations } = await import("./consultation.remote");

  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      consultations: [],
      total: 0,
      page: 1,
      limit: 20,
      has_more: false,
    }),
  });

  await listConsultations({
    page: 1,
    limit: 20,
    status: "completed",
  });

  expect(mockFetch).toHaveBeenCalledWith(
    "http://localhost:4001/consultations?page=1&limit=20&status=completed",
    expect.any(Object),
  );
});
```

**Component Prop Testing - Accessibility:**
```typescript
it("should have proper ARIA labels", () => {
  let data = {};
  render(ClientInfoForm, { data });

  const emailInput = screen.getByLabelText(/email address/i);
  expect(emailInput).toHaveAttribute("type", "email");
  expect(emailInput).toHaveAttribute("autocomplete", "email");
});
```

---

*Testing analysis: 2026-01-22*
