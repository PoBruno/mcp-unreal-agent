import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { ueGet, createTestBlueprint, deleteTestBlueprint, uniqueName } from "../helpers.js";

describe("create_blueprint", () => {
  const bpName = uniqueName("BP_CreateTest");
  const packagePath = "/Game/Test";
  let createResult: any;

  beforeAll(async () => {
    createResult = await createTestBlueprint({ name: bpName });
  });

  afterAll(async () => {
    await deleteTestBlueprint(`${packagePath}/${bpName}`);
  });

  it("returns success fields", () => {
    expect(createResult.error).toBeUndefined();
    expect(createResult.blueprintName).toBe(bpName);
    expect(createResult.packagePath).toBe(packagePath);
    expect(createResult.assetPath).toContain(bpName);
    expect(createResult.parentClass).toBe("Actor");
    expect(createResult.blueprintType).toBe("Normal");
    expect(createResult.saved).toBe(true);
  });

  it("creates at least one graph (EventGraph)", () => {
    expect(createResult.graphs).toBeDefined();
    expect(createResult.graphs.length).toBeGreaterThanOrEqual(1);
  });

  it("rejects duplicate creation", async () => {
    const dup = await createTestBlueprint({ name: bpName });
    expect(dup.error).toBeDefined();
    expect(dup.error).toContain("already exists");
  });

  it("appears in list_blueprints", async () => {
    const list = await ueGet("/api/list", { filter: bpName });
    expect(list.count).toBeGreaterThanOrEqual(1);
    const names = list.blueprints.map((b: any) => b.name);
    expect(names).toContain(bpName);
  });

  it("rejects invalid packagePath", async () => {
    const bad = await createTestBlueprint({
      name: uniqueName("BP_BadPath"),
      packagePath: "/Invalid/Path",
    });
    expect(bad.error).toBeDefined();
    expect(bad.error).toContain("/Game");
  });

  it("rejects unknown parent class", async () => {
    const bad = await createTestBlueprint({
      name: uniqueName("BP_BadParent"),
      parentClass: "NonExistentClass_XYZ",
    });
    expect(bad.error).toBeDefined();
    expect(bad.error).toContain("Could not find parent class");
  });
});
