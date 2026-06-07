import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // All tests share one commandlet process — run sequentially
    fileParallelism: false,
    // Commandlet startup can take minutes; individual tests are fast
    testTimeout: 30_000,
    hookTimeout: 60_000,
    // Global setup boots the commandlet before any test file runs
    globalSetup: "./test/setup.ts",
    // Test file location — exclude *.unit.test.ts (those run UE5-free via vitest.unit.config.ts)
    include: ["test/**/*.test.ts"],
    exclude: ["test/**/*.unit.test.ts", "node_modules/**"],
  },
});
