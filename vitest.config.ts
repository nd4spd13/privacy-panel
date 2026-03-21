import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    // Exclude Playwright e2e tests — those run via `npx playwright test`
    exclude: ["tests/e2e/**", "node_modules/**"],
  },
  resolve: {
    alias: {
      "@": "/Users/csb/Documents/GitHub/privacy-scorer/src",
      // server-only throws in non-Next.js environments (tests, CLI).
      // Mock it with a no-op so server-side modules can be unit-tested directly.
      "server-only": "/Users/csb/Documents/GitHub/privacy-scorer/tests/__mocks__/server-only.ts",
    },
  },
});
