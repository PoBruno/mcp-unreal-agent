import { describe, it, expect, beforeAll } from "vitest";
import { ueGet, createTestBlueprint, deleteTestBlueprint, uniqueName } from "../helpers.js";

describe("delete_asset", () => {
  it("deletes a Blueprint that was just created", async () => {
    const bpName = uniqueName("BP_DeleteTest");
    const packagePath = "/Game/Test";
    const assetPath = `${packagePath}/${bpName}`;

    // Create
    const created = await createTestBlueprint({ name: bpName });
    expect(created.error).toBeUndefined();
    expect(created.saved).toBe(true);

    // Verify it exists in the list
    const listBefore = await ueGet("/api/list", { filter: bpName });
    expect(listBefore.count).toBeGreaterThanOrEqual(1);

    // Delete
    const deleted = await deleteTestBlueprint(assetPath);
    expect(deleted.error).toBeUndefined();
    expect(deleted.success).toBe(true);
    expect(deleted.assetPath).toBe(assetPath);
  });

  it("returns error for non-existent asset", async () => {
    const data = await deleteTestBlueprint("/Game/Test/BP_DoesNotExist_999999");
    expect(data.error).toBeDefined();
  });

  it("requires assetPath field", async () => {
    const { uePost } = await import("../helpers.js");
    const data = await uePost("/api/delete-asset", {});
    expect(data.error).toBeDefined();
    expect(data.error).toContain("assetPath");
  });
});
