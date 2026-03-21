import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
  },
  resolve: {
    alias: {
      "@": "/Users/csb/Documents/GitHub/privacy-scorer/src",
    },
  },
});
