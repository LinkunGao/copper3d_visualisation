import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts"],
    // *.bench.ts are benchmarks, not tests -- they are run by `vitest bench`.
    exclude: ["**/node_modules/**", "**/dist/**", "**/*.bench.ts"],
    setupFiles: [
      "./src/__tests__/setup.ts",
      "./src/Utils/segmentation/core/__tests__/setup.ts",
    ],
  },
});
