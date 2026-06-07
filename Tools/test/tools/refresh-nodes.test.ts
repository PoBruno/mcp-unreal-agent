import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { uePost, createTestBlueprint, deleteTestBlueprint, uniqueName } from "../helpers.js";

describe("refresh_all_nodes", () => {
  const bpName = uniqueName("BP_RefreshTest");
  const packagePath = "/Game/Test";

  beforeAll(async () => {
    const bp = await createTestBlueprint({ name: bpName });
    expect(bp.error).toBeUndefined();
  });

  afterAll(async () => {
    await deleteTestBlueprint(`${packagePath}/${bpName}`);
  });

  it("refreshes all nodes in a Blueprint", async () => {
    const data = await uePost("/api/refresh-all-nodes", {
      blueprint: bpName,
    });
    expect(data.error).toBeUndefined();
    expect(data.success).toBe(true);
    expect(data.blueprint).toBe(bpName);
    expect(typeof data.graphCount).toBe("number");
    expect(typeof data.nodeCount).toBe("number");
    expect(data.saved).toBe(true);
  });

  it("returns error for non-existent blueprint", async () => {
    const data = await uePost("/api/refresh-all-nodes", {
      blueprint: "BP_DoesNotExist_XYZ_999",
    });
    expect(data.error).toBeDefined();
  });

  it("rejects missing required fields", async () => {
    const data = await uePost("/api/refresh-all-nodes", {});
    expect(data.error).toBeDefined();
  });
});
