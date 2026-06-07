import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { uePost, ueGet, createTestBlueprint, deleteTestBlueprint, uniqueName } from "../helpers.js";

describe("rename_asset", () => {
  const bpName = uniqueName("BP_RenameTest");
  const packagePath = "/Game/Test";
  const newName = uniqueName("BP_Renamed");

  beforeAll(async () => {
    const bp = await createTestBlueprint({ name: bpName });
    expect(bp.error).toBeUndefined();
  });

  afterAll(async () => {
    // Clean up the renamed asset (or original if rename failed)
    await deleteTestBlueprint(`${packagePath}/${newName}`);
    await deleteTestBlueprint(`${packagePath}/${bpName}`);
  });

  it("renames a Blueprint asset", async () => {
    const data = await uePost("/api/rename-asset", {
      assetPath: `${packagePath}/${bpName}`,
      newPath: `${packagePath}/${newName}`,
    });
    expect(data.error).toBeUndefined();
    expect(data.success).toBe(true);
    expect(data.oldPath).toBe(`${packagePath}/${bpName}`);
    expect(data.newPath).toBe(`${packagePath}/${newName}`);
  });

  it("verifies renamed asset exists under new name", async () => {
    const list = await ueGet("/api/list", { filter: newName });
    expect(list.count).toBeGreaterThanOrEqual(1);
  });

  it("returns error for non-existent source asset", async () => {
    const data = await uePost("/api/rename-asset", {
      assetPath: "/Game/Test/BP_DoesNotExist_XYZ_999",
      newPath: "/Game/Test/BP_Whatever",
    });
    expect(data.error).toBeDefined();
  });

  it("rejects missing required fields", async () => {
    const data = await uePost("/api/rename-asset", {});
    expect(data.error).toBeDefined();
  });
});
