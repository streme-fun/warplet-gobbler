import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Mirror tsconfig's "@/*" -> "./src/*" so lib modules under test can use it.
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    // Pure logic only — no DOM/React needed for the lib suite.
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
