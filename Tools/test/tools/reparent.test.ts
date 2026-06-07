import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { uePost, ueGet, createTestBlueprint, deleteTestBlueprint, uniqueName } from "../helpers.js";

describe("reparent_blueprint", () => {
  const bpName = uniqueName("BP_ReparentTest");
  const packagePath = "/Game/Test";

  beforeAll(async () => {
    // Create an Actor-based BP
    const bp = await createTestBlueprint({ name: bpName, parentClass: "Actor" });
    expect(bp.error).toBeUndefined();
  });

  afterAll(async () => {
    await deleteTestBlueprint(`${packagePath}/${bpName}`);
  });

  it("reparents a Blueprint to a new parent class", async () => {
    const data = await uePost("/api/reparent-blueprint", {
      blueprint: bpName,
      newParentClass: "Pawn",
    });
    expect(data.error).toBeUndefined();
    expect(data.success).toBe(true);
    expect(data.blueprint).toBe(bpName);
    expect(data.newParentClass).toContain("Pawn");
    expect(data.saved).toBe(true);
  });

  it("verifies parent class changed via get_blueprint", async () => {
    const info = await ueGet("/api/blueprint", { name: bpName });
    expect(info.error).toBeUndefined();
    expect(info.parentClass).toContain("Pawn");
  });

  it("returns error for non-existent blueprint", async () => {
    const data = await uePost("/api/reparent-blueprint", {
      blueprint: "BP_DoesNotExist_XYZ_999",
      newParentClass: "Pawn",
    });
    expect(data.error).toBeDefined();
  });

  it("returns error for non-existent parent class", async () => {
    const data = await uePost("/api/reparent-blueprint", {
      blueprint: bpName,
      newParentClass: "NonExistentClass_XYZ_999",
    });
    expect(data.error).toBeDefined();
  });

  it("rejects missing required fields", async () => {
    const data = await uePost("/api/reparent-blueprint", {
      blueprint: bpName,
    });
    expect(data.error).toBeDefined();
  });
});
