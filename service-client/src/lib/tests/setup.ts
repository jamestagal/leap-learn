import { vi, beforeEach } from "vitest";

// Mock localStorage for testing
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

// Dynamic private env mock removed - not using in client code

vi.mock("$env/static/public", () => ({
	PUBLIC_CORE_URL: "http://localhost:4001",
	PUBLIC_CLIENT_URL: "http://localhost:3000",
}));

// Mock SvelteKit modules
vi.mock("$app/environment", () => ({
	browser: true, // Set to true for localStorage tests
}));

vi.mock("$app/navigation", () => ({
	goto: vi.fn(),
}));

// JWT verification mock removed - not using server JWT in client code

// Setup global test environment
beforeEach(() => {
	localStorageMock.clear();
	vi.clearAllMocks();
});

export { localStorageMock };
