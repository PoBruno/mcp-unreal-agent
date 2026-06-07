import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { ueGet, uePost, createTestBlueprint, deleteTestBlueprint, uniqueName } from "../helpers.js";

describe("get_blueprint_summary / describe_graph", () => {
  const bpName = uniqueName("BP_InfoTest");
  const packagePath = "/Game/Test";

  beforeAll(async () => {
    const bp = await createTestBlueprint({ name: bpName });
    expect(bp.error).toBeUndefined();
    // Add a PrintString node for describe_graph to walk
    await uePost("/api/add-node", {
      blueprint: bpName,
      graph: "EventGraph",
      nodeType: "CallFunction",
      functionName: "PrintString",
    });
  });

  afterAll(async () => {
    await deleteTestBlueprint(`${packagePath}/${bpName}`);
  });

  describe("get_blueprint_summary (via /api/blueprint)", () => {
    it("returns blueprint data with graphs and variables", async () => {
      const data = await ueGet("/api/blueprint", { name: bpName });
      expect(data.error).toBeUndefined();
      expect(data.name).toBe(bpName);
      expect(data.parentClass).toBeDefined();
      expect(Array.isArray(data.graphs)).toBe(true);
      expect(data.graphs.length).toBeGreaterThanOrEqual(1);
    });

    it("returns error for non-existent blueprint", async () => {
      const data = await ueGet("/api/blueprint", {
        name: "BP_Nonexistent_XYZ_999",
      });
      expect(data.error).toBeDefined();
    });
  });

  describe("describe_graph (via /api/graph)", () => {
    it("returns graph data with nodes", async () => {
      const data = await ueGet("/api/graph", {
        name: bpName,
        graph: "EventGraph",
      });
      expect(data.error).toBeUndefined();
      expect(Array.isArray(data.nodes)).toBe(true);
      // Should have at least the PrintString node and default event nodes
      expect(data.nodes.length).toBeGreaterThanOrEqual(1);
    });

    it("nodes have expected structure", async () => {
      const data = await ueGet("/api/graph", {
        name: bpName,
        graph: "EventGraph",
      });
      expect(data.error).toBeUndefined();
      for (const node of data.nodes) {
        expect(node.id).toBeDefined();
        expect(Array.isArray(node.pins)).toBe(true);
      }
    });
  });
});
