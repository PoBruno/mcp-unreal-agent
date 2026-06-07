import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { uePost, ueGet, createTestBlueprint, deleteTestBlueprint, uniqueName } from "../helpers.js";

describe("set_blueprint_default", () => {
  const bpName = uniqueName("BP_SetDefaultTest");
  const packagePath = "/Game/Test";

  beforeAll(async () => {
    const bp = await createTestBlueprint({ name: bpName });
    expect(bp.error).toBeUndefined();
  });

  afterAll(async () => {
    await deleteTestBlueprint(`${packagePath}/${bpName}`);
  });

  it("returns error for non-existent property", async () => {
    const data = await uePost("/api/set-blueprint-default", {
      blueprint: bpName,
      property: "NonExistentProperty_XYZ",
      value: "true",
    });
    expect(data.error).toBeDefined();
  });

  it("returns error for non-existent blueprint", async () => {
    const data = await uePost("/api/set-blueprint-default", {
      blueprint: "BP_DoesNotExist_XYZ_999",
      property: "SomeProperty",
      value: "true",
    });
    expect(data.error).toBeDefined();
  });

  it("rejects missing required fields", async () => {
    const data = await uePost("/api/set-blueprint-default", {
      blueprint: bpName,
    });
    expect(data.error).toBeDefined();
  });
});

describe("set_pin_default", () => {
  const bpName = uniqueName("BP_SetPinTest");
  const packagePath = "/Game/Test";
  let printNodeId: string;

  beforeAll(async () => {
    const bp = await createTestBlueprint({ name: bpName });
    expect(bp.error).toBeUndefined();

    // Add a PrintString node — it has an "InString" pin with a default value
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

  it("sets a pin default value on PrintString's InString pin", async () => {
    const data = await uePost("/api/set-pin-default", {
      blueprint: bpName,
      nodeId: printNodeId,
      pinName: "InString",
      value: "Hello Test",
    });
    expect(data.error).toBeUndefined();
    expect(data.success).toBe(true);
    expect(data.newValue).toBe("Hello Test");
    expect(data.saved).toBe(true);
  });

  it("returns error for non-existent pin", async () => {
    const data = await uePost("/api/set-pin-default", {
      blueprint: bpName,
      nodeId: printNodeId,
      pinName: "FakePin_XYZ",
      value: "test",
    });
    expect(data.error).toBeDefined();
  });

  it("returns error for non-existent node", async () => {
    const data = await uePost("/api/set-pin-default", {
      blueprint: bpName,
      nodeId: "00000000-0000-0000-0000-000000000000",
      pinName: "InString",
      value: "test",
    });
    expect(data.error).toBeDefined();
  });

  it("rejects missing required fields", async () => {
    const data = await uePost("/api/set-pin-default", {
      blueprint: bpName,
    });
    expect(data.error).toBeDefined();
  });
});
