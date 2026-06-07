import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { uePost, ueGet, createTestBlueprint, deleteTestBlueprint, uniqueName } from "../helpers.js";

describe("connect_pins / disconnect_pin", () => {
  const bpName = uniqueName("BP_ConnectTest");
  const packagePath = "/Game/Test";
  let eventNodeId: string;
  let printNodeId: string;

  beforeAll(async () => {
    // Create Blueprint
    const bp = await createTestBlueprint({ name: bpName });
    expect(bp.error).toBeUndefined();

    // Add an event override node (BeginPlay)
    const eventRes = await uePost("/api/add-node", {
      blueprint: bpName,
      graph: "EventGraph",
      nodeType: "OverrideEvent",
      functionName: "ReceiveBeginPlay",
    });
    expect(eventRes.success).toBe(true);
    eventNodeId = eventRes.nodeId;

    // Add a PrintString call
    const printRes = await uePost("/api/add-node", {
      blueprint: bpName,
      graph: "EventGraph",
      nodeType: "CallFunction",
      functionName: "PrintString",
    });
    expect(printRes.success).toBe(true);
    printNodeId = printRes.nodeId;
  });

  afterAll(async () => {
    await deleteTestBlueprint(`${packagePath}/${bpName}`);
  });

  it("connects execution pins between two nodes", async () => {
    const data = await uePost("/api/connect-pins", {
      blueprint: bpName,
      sourceNodeId: eventNodeId,
      sourcePinName: "then",
      targetNodeId: printNodeId,
      targetPinName: "execute",
    });
    expect(data.error).toBeUndefined();
    expect(data.success).toBe(true);
    expect(data.saved).toBe(true);
    expect(data.updatedSourceNode).toBeDefined();
    expect(data.updatedTargetNode).toBeDefined();
  });

  it("rejects connection to non-existent pin", async () => {
    const data = await uePost("/api/connect-pins", {
      blueprint: bpName,
      sourceNodeId: eventNodeId,
      sourcePinName: "FakePin",
      targetNodeId: printNodeId,
      targetPinName: "execute",
    });
    expect(data.error).toBeDefined();
    expect(data.availablePins).toBeDefined();
  });

  it("disconnects a pin", async () => {
    const data = await uePost("/api/disconnect-pin", {
      blueprint: bpName,
      nodeId: eventNodeId,
      pinName: "then",
    });
    expect(data.error).toBeUndefined();
    expect(data.success).toBe(true);
    expect(data.saved).toBe(true);
  });

  it("rejects disconnect on non-existent node", async () => {
    const data = await uePost("/api/disconnect-pin", {
      blueprint: bpName,
      nodeId: "00000000-0000-0000-0000-000000000000",
      pinName: "then",
    });
    expect(data.error).toBeDefined();
  });
});
