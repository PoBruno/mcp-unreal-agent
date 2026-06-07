/**
 * setup.ts — Vitest globalSetup.
 *
 * Before any test file runs:
 *   1. Generate a temp UE5 project with a junction to the real plugin
 *   2. Spawn a commandlet on port 19847 and wait until healthy
 *
 * After all tests complete:
 *   3. Shut down the commandlet
 *   4. Remove the junction and temp directory
 */

import {
  generateTempProject,
  spawnCommandlet,
  shutdownCommandlet,
  cleanupTempProject,
} from "./bootstrap.js";

export async function setup(): Promise<void> {
  console.log("[setup] Generating temp project...");
  const projectDir = generateTempProject();

  console.log("[setup] Spawning commandlet...");
  await spawnCommandlet(projectDir);
  console.log("[setup] Ready.");
}

export async function teardown(): Promise<void> {
  console.log("[teardown] Shutting down commandlet...");
  await shutdownCommandlet();

  console.log("[teardown] Cleaning up temp project...");
  cleanupTempProject();
  console.log("[teardown] Done.");
}
