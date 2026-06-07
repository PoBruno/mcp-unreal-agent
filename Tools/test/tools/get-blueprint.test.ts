import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { ueGet, createTestBlueprint, deleteTestBlueprint, uniqueName } from "../helpers.js";

describe("get_blueprint / get_blueprint_graph", () => {
  const bpName = uniqueName("BP_GetTest");
  const packagePath = "/Game/Test";

  beforeAll(async () => {
    const res = await createTestBlueprint({ name: bpName });
    expect(res.error).toBeUndefined();
  });

  afterAll(async () => {
    await deleteTestBlueprint(`${packagePath}/${bpName}`);
  });

  describe("get_blueprint", () => {
    it("returns blueprint metadata", async () => {
      const data = await ueGet("/api/blueprint", { name: bpName });
      expect(data.error).toBeUndefined();
      expect(data.name).toBe(bpName);
      expect(data.parentClass).toBeDefined();
      expect(data.graphs).toBeDefined();
      expect(Array.isArray(data.graphs)).toBe(true);
    });

    it("returns error for non-existent blueprint", async () => {
      const data = await ueGet("/api/blueprint", {
        name: "BP_DoesNotExist_999999",
      });
      expect(data.error).toBeDefined();
    });
  });

  describe("get_blueprint_graph", () => {
    it("returns EventGraph with nodes and pins", async () => {
      const data = await ueGet("/api/graph", {
        name: bpName,
        graph: "EventGraph",
      });
      expect(data.error).toBeUndefined();
      expect(data.graphName || data.name).toBeDefined();
      // A fresh Actor BP should have at least default event nodes
      expect(data.nodes).toBeDefined();
      expect(Array.isArray(data.nodes)).toBe(true);
    });

    it("returns error for non-existent graph", async () => {
      const data = await ueGet("/api/graph", {
        name: bpName,
        graph: "NonExistentGraph",
      });
      expect(data.error).toBeDefined();
    });
  });
});
