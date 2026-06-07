import { defineConfig } from "vitest/config";

// Unit tests for pure mappers / shaping logic. No UE5 — no commandlet boot,
// no globalSetup. Runs anywhere (CI, dev box without an engine install).
export default defineConfig({
  test: {
    include: ["test/**/*.unit.test.ts"],
  },
});
