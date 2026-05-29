import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Pure logic only — no DOM/React needed for the lib suite.
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
