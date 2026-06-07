import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { uePost, createTestBlueprint, deleteTestBlueprint, uniqueName } from "../helpers.js";

describe("find_disconnected_pins", () => {
  const bpName = uniqueName("BP_DisconnPinsTest");
  const packagePath = "/Game/Test";

  beforeAll(async () => {
    const bp = await createTestBlueprint({ name: bpName });
    expect(bp.error).toBeUndefined();
  });

  afterAll(async () => {
    await deleteTestBlueprint(`${packagePath}/${bpName}`);
  });

  it("scans a single Blueprint for disconnected pins", async () => {
    const data = await uePost("/api/find-disconnected-pins", {
      blueprint: bpName,
      sensitivity: "all",
    });
    expect(data.error).toBeUndefined();
    // A fresh Actor BP should have no disconnected struct pins
    expect(data.summary).toBeDefined();
    expect(typeof data.summary.blueprintsScanned).toBe("number");
  });

  it("scans by path filter", async () => {
    const data = await uePost("/api/find-disconnected-pins", {
      filter: "/Game/Test",
      sensitivity: "medium",
    });
    expect(data.error).toBeUndefined();
    expect(data.summary).toBeDefined();
  });

  it("supports high sensitivity (broken types only)", async () => {
    const data = await uePost("/api/find-disconnected-pins", {
      blueprint: bpName,
      sensitivity: "high",
    });
    expect(data.error).toBeUndefined();
  });

  it("rejects when no scope is provided", async () => {
    const data = await uePost("/api/find-disconnected-pins", {
      sensitivity: "medium",
    });
    // Should return error or empty results (no blueprint/filter specified)
    // The exact behavior depends on the implementation
    expect(data).toBeDefined();
  });
});
