import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { uePost, createTestBlueprint, deleteTestBlueprint, uniqueName } from "../helpers.js";

/**
 * Tests for mutation tools that operate on variables, function parameters,
 * and struct node types. These tools require pre-existing variables/functions
 * that can't be created via the current API, so we primarily test error cases
 * and verify the response structure.
 */

describe("replace_function_calls", () => {
  const bpName = uniqueName("BP_ReplaceFnTest");
  const packagePath = "/Game/Test";

  beforeAll(async () => {
    const bp = await createTestBlueprint({ name: bpName });
    expect(bp.error).toBeUndefined();
  });

  afterAll(async () => {
    await deleteTestBlueprint(`${packagePath}/${bpName}`);
  });

  it("returns error when newClass does not exist", async () => {
    // The API validates newClass exists before scanning — returns error if not found
    const data = await uePost("/api/replace-function-calls", {
      blueprint: bpName,
      oldClass: "FakeOldLibrary_XYZ",
      newClass: "FakeNewLibrary_XYZ",
    });
    expect(data.error).toBeDefined();
    expect(data.error).toContain("FakeNewLibrary_XYZ");
  });

  it("returns error in dryRun mode when newClass does not exist", async () => {
    const data = await uePost("/api/replace-function-calls", {
      blueprint: bpName,
      oldClass: "FakeOldLibrary_XYZ",
      newClass: "FakeNewLibrary_XYZ",
      dryRun: true,
    });
    expect(data.error).toBeDefined();
  });

  it("returns error for non-existent blueprint", async () => {
    const data = await uePost("/api/replace-function-calls", {
      blueprint: "BP_DoesNotExist_XYZ_999",
      oldClass: "SomeClass",
      newClass: "OtherClass",
    });
    expect(data.error).toBeDefined();
  });

  it("rejects missing required fields", async () => {
    const data = await uePost("/api/replace-function-calls", {
      blueprint: bpName,
    });
    expect(data.error).toBeDefined();
  });
});

describe("change_variable_type", () => {
  const bpName = uniqueName("BP_ChangeVarTest");
  const packagePath = "/Game/Test";
  const testVarName = "TestVar";

  beforeAll(async () => {
    const bp = await createTestBlueprint({ name: bpName });
    expect(bp.error).toBeUndefined();
    // Add a test variable to the blueprint
    const addVar = await uePost("/api/add-variable", {
      blueprint: bpName,
      variableName: testVarName,
      variableType: "bool",
    });
    expect(addVar.error).toBeUndefined();
  });

  afterAll(async () => {
    await deleteTestBlueprint(`${packagePath}/${bpName}`);
  });

  it("returns error for non-existent variable", async () => {
    const data = await uePost("/api/change-variable-type", {
      blueprint: bpName,
      variable: "NonExistentVar_XYZ",
      newType: "FVector",
      typeCategory: "struct",
    });
    expect(data.error).toBeDefined();
  });

  it("returns error for non-existent blueprint", async () => {
    const data = await uePost("/api/change-variable-type", {
      blueprint: "BP_DoesNotExist_XYZ_999",
      variable: "SomeVar",
      newType: "FVector",
      typeCategory: "struct",
    });
    expect(data.error).toBeDefined();
  });

  it("rejects missing required fields", async () => {
    const data = await uePost("/api/change-variable-type", {
      blueprint: bpName,
    });
    expect(data.error).toBeDefined();
  });

  it("changes variable to object:Actor via colon syntax", async () => {
    const data = await uePost("/api/change-variable-type", {
      blueprint: bpName,
      variable: testVarName,
      newType: "object:Actor",
    });
    expect(data.error).toBeUndefined();
    expect(data.success).toBe(true);
    expect(data.typeCategory).toBe("object");
    expect(data.updatedVariable).toBeDefined();
    expect(data.updatedVariable.type).toBe("object");
    expect(data.updatedVariable.subtype).toBe("Actor");
  });

  it("changes variable to object:Actor via typeCategory param", async () => {
    const data = await uePost("/api/change-variable-type", {
      blueprint: bpName,
      variable: testVarName,
      newType: "Actor",
      typeCategory: "object",
    });
    expect(data.error).toBeUndefined();
    expect(data.success).toBe(true);
    expect(data.typeCategory).toBe("object");
  });

  it("changes variable to class:Actor (TSubclassOf)", async () => {
    const data = await uePost("/api/change-variable-type", {
      blueprint: bpName,
      variable: testVarName,
      newType: "class:Actor",
    });
    expect(data.error).toBeUndefined();
    expect(data.success).toBe(true);
    expect(data.typeCategory).toBe("class");
  });

  it("changes variable to softobject:Actor", async () => {
    const data = await uePost("/api/change-variable-type", {
      blueprint: bpName,
      variable: testVarName,
      newType: "softobject:Actor",
    });
    expect(data.error).toBeUndefined();
    expect(data.success).toBe(true);
    expect(data.typeCategory).toBe("softobject");
  });

  it("auto-detects struct type without typeCategory", async () => {
    const data = await uePost("/api/change-variable-type", {
      blueprint: bpName,
      variable: testVarName,
      newType: "FVector",
    });
    expect(data.error).toBeUndefined();
    expect(data.success).toBe(true);
    expect(data.typeCategory).toBe("struct");
  });

  it("returns error for non-existent class in object reference", async () => {
    const data = await uePost("/api/change-variable-type", {
      blueprint: bpName,
      variable: testVarName,
      newType: "object:NonExistentClass_XYZ_999",
    });
    expect(data.error).toBeDefined();
    expect(data.error).toContain("NonExistentClass_XYZ_999");
  });

  it("dry run with object reference type", async () => {
    const data = await uePost("/api/change-variable-type", {
      blueprint: bpName,
      variable: testVarName,
      newType: "object:Actor",
      dryRun: true,
    });
    expect(data.error).toBeUndefined();
    expect(data.dryRun).toBe(true);
    expect(data.typeCategory).toBe("object");
  });
});

describe("change_function_parameter_type", () => {
  const bpName = uniqueName("BP_ChangeFnParamTest");
  const packagePath = "/Game/Test";
  const funcName = "TestFunc";
  const paramName = "TestParam";

  beforeAll(async () => {
    const bp = await createTestBlueprint({ name: bpName });
    expect(bp.error).toBeUndefined();
    // Create a function graph with a parameter to test type changes
    const graph = await uePost("/api/create-graph", {
      blueprint: bpName,
      graphName: funcName,
      graphType: "function",
    });
    expect(graph.error).toBeUndefined();
    const param = await uePost("/api/add-function-parameter", {
      blueprint: bpName,
      functionName: funcName,
      paramName: paramName,
      paramType: "bool",
    });
    expect(param.error).toBeUndefined();
  });

  afterAll(async () => {
    await deleteTestBlueprint(`${packagePath}/${bpName}`);
  });

  it("returns error for non-existent function", async () => {
    const data = await uePost("/api/change-function-param-type", {
      blueprint: bpName,
      functionName: "NonExistentFunc_XYZ",
      paramName: "SomeParam",
      newType: "FVector",
    });
    expect(data.error).toBeDefined();
    expect(data.availableFunctionsAndEvents).toBeDefined();
  });

  it("returns error for non-existent blueprint", async () => {
    const data = await uePost("/api/change-function-param-type", {
      blueprint: "BP_DoesNotExist_XYZ_999",
      functionName: "SomeFunc",
      paramName: "SomeParam",
      newType: "FVector",
    });
    expect(data.error).toBeDefined();
  });

  it("rejects missing required fields", async () => {
    const data = await uePost("/api/change-function-param-type", {
      blueprint: bpName,
    });
    expect(data.error).toBeDefined();
  });

  it("changes param to object:Actor", async () => {
    const data = await uePost("/api/change-function-param-type", {
      blueprint: bpName,
      functionName: funcName,
      paramName: paramName,
      newType: "object:Actor",
    });
    expect(data.error).toBeUndefined();
    expect(data.success).toBe(true);
  });

  it("changes param to class:Actor (TSubclassOf)", async () => {
    const data = await uePost("/api/change-function-param-type", {
      blueprint: bpName,
      functionName: funcName,
      paramName: paramName,
      newType: "class:Actor",
    });
    expect(data.error).toBeUndefined();
    expect(data.success).toBe(true);
  });

  it("changes param to enum type", async () => {
    const data = await uePost("/api/change-function-param-type", {
      blueprint: bpName,
      functionName: funcName,
      paramName: paramName,
      newType: "ECollisionChannel",
    });
    expect(data.error).toBeUndefined();
    expect(data.success).toBe(true);
  });

  it("returns error for non-existent class in object reference", async () => {
    const data = await uePost("/api/change-function-param-type", {
      blueprint: bpName,
      functionName: funcName,
      paramName: paramName,
      newType: "object:NonExistentClass_XYZ_999",
    });
    expect(data.error).toBeDefined();
    expect(data.error).toContain("NonExistentClass_XYZ_999");
  });
});

describe("remove_function_parameter", () => {
  const bpName = uniqueName("BP_RemoveParamTest");
  const packagePath = "/Game/Test";

  beforeAll(async () => {
    const bp = await createTestBlueprint({ name: bpName });
    expect(bp.error).toBeUndefined();
  });

  afterAll(async () => {
    await deleteTestBlueprint(`${packagePath}/${bpName}`);
  });

  it("returns error for non-existent function", async () => {
    const data = await uePost("/api/remove-function-parameter", {
      blueprint: bpName,
      functionName: "NonExistentFunc_XYZ",
      paramName: "SomeParam",
    });
    expect(data.error).toBeDefined();
  });

  it("returns error for non-existent blueprint", async () => {
    const data = await uePost("/api/remove-function-parameter", {
      blueprint: "BP_DoesNotExist_XYZ_999",
      functionName: "SomeFunc",
      paramName: "SomeParam",
    });
    expect(data.error).toBeDefined();
  });

  it("rejects missing required fields", async () => {
    const data = await uePost("/api/remove-function-parameter", {
      blueprint: bpName,
    });
    expect(data.error).toBeDefined();
  });
});

describe("change_struct_node_type", () => {
  const bpName = uniqueName("BP_ChangeStructTest");
  const packagePath = "/Game/Test";

  beforeAll(async () => {
    const bp = await createTestBlueprint({ name: bpName });
    expect(bp.error).toBeUndefined();
  });

  afterAll(async () => {
    await deleteTestBlueprint(`${packagePath}/${bpName}`);
  });

  it("returns error for non-existent node", async () => {
    const data = await uePost("/api/change-struct-node-type", {
      blueprint: bpName,
      nodeId: "00000000-0000-0000-0000-000000000000",
      newType: "FVector",
    });
    expect(data.error).toBeDefined();
  });

  it("returns error for non-existent blueprint", async () => {
    const data = await uePost("/api/change-struct-node-type", {
      blueprint: "BP_DoesNotExist_XYZ_999",
      nodeId: "some-node-id",
      newType: "FVector",
    });
    expect(data.error).toBeDefined();
  });

  it("rejects missing required fields", async () => {
    const data = await uePost("/api/change-struct-node-type", {
      blueprint: bpName,
    });
    expect(data.error).toBeDefined();
  });
});
