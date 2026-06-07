import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { uePost, ueGet, createTestBlueprint, deleteTestBlueprint, uniqueName } from "../helpers.js";

describe("delete_node", () => {
  const bpName = uniqueName("BP_DeleteNodeTest");
  const packagePath = "/Game/Test";
  let printNodeId: string;

  beforeAll(async () => {
    const bp = await createTestBlueprint({ name: bpName });
    expect(bp.error).toBeUndefined();

    // Add a PrintString node to delete later
    const res = await uePost("/api/add-node", {
      blueprint: bpName,
      graph: "EventGraph",
      nodeType: "CallFunction",
      functionName: "PrintString",
    });
    expect(res.success).toBe(true);
    printNodeId = res.nodeId;
  });

  afterAll(async () => {
    await deleteTestBlueprint(`${packagePath}/${bpName}`);
  });

  it("deletes a function call node", async () => {
    const data = await uePost("/api/delete-node", {
      blueprint: bpName,
      nodeId: printNodeId,
    });
    expect(data.error).toBeUndefined();
    expect(data.blueprint).toBe(bpName);
    expect(data.nodeId).toBe(printNodeId);
    expect(data.nodeClass).toBeDefined();
    expect(data.saved).toBe(true);
  });

  it("verifies node is gone from graph", async () => {
    const graph = await ueGet("/api/graph", {
      name: bpName,
      graph: "EventGraph",
    });
    expect(graph.error).toBeUndefined();
    const found = graph.nodes.find((n: any) => n.id === printNodeId);
    expect(found).toBeUndefined();
  });

  it("rejects deletion of non-existent node", async () => {
    const data = await uePost("/api/delete-node", {
      blueprint: bpName,
      nodeId: "00000000-0000-0000-0000-000000000000",
    });
    expect(data.error).toBeDefined();
  });

  it("rejects missing required fields", async () => {
    const data = await uePost("/api/delete-node", {
      blueprint: bpName,
    });
    expect(data.error).toBeDefined();
  });

  it("protects entry/event nodes from deletion", async () => {
    // Get the EventGraph to find the entry node
    const graph = await ueGet("/api/graph", {
      name: bpName,
      graph: "EventGraph",
    });
    expect(graph.error).toBeUndefined();

    // Find an event node (ReceiveBeginPlay or similar)
    const eventNode = graph.nodes.find(
      (n: any) =>
        n.class?.includes("Event") || n.class?.includes("FunctionEntry"),
    );
    if (eventNode) {
      const data = await uePost("/api/delete-node", {
        blueprint: bpName,
        nodeId: eventNode.id,
      });
      expect(data.error).toBeDefined();
      expect(data.error).toContain("Cannot delete");
    }
  });
});
