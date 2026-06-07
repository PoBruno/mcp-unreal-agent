import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { ueGet, createTestBlueprint, deleteTestBlueprint, uniqueName } from "../helpers.js";

describe("find_asset_references", () => {
  const bpName = uniqueName("BP_RefTest");
  const packagePath = "/Game/Test";
  const assetPath = `${packagePath}/${bpName}`;

  beforeAll(async () => {
    const res = await createTestBlueprint({ name: bpName });
    expect(res.error).toBeUndefined();
  });

  afterAll(async () => {
    await deleteTestBlueprint(assetPath);
  });

  it("returns reference data for an existing asset", async () => {
    const data = await ueGet("/api/references", { assetPath });
    expect(data.error).toBeUndefined();
    expect(data.assetPath).toBe(assetPath);
    expect(typeof data.totalReferencers).toBe("number");
  });

  it("returns zero referencers for an isolated test asset", async () => {
    const data = await ueGet("/api/references", { assetPath });
    expect(data.totalReferencers).toBe(0);
  });

  it("returns zero referencers for non-existent asset path", async () => {
    // The API queries the asset registry which returns empty for unknown paths
    // (it does not validate asset existence — it just reports zero refs)
    const data = await ueGet("/api/references", {
      assetPath: "/Game/Test/NonExistent_XYZ_999",
    });
    expect(data.error).toBeUndefined();
    expect(data.totalReferencers).toBe(0);
  });
});
