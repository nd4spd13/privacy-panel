import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    // Exclude Playwright e2e tests — those run via `npx playwright test`
    exclude: ["tests/e2e/**", "tests/core/extraction.test.ts", "node_modules/**", ".claude/**"],
  },
  resolve: {
    alias: {
      "@": resolve(root, "src"),
      // server-only throws in non-Next.js environments (tests, CLI).
      // Mock it with a no-op so server-side modules can be unit-tested directly.
      "server-only": resolve(root, "tests/__mocks__/server-only.ts"),
    },
  },
});
