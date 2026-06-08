// Unit tests for the ID-chain cohesion fix (ADR-009): autoRefs must emit ref keys
// that MATCH the consuming tools' input param names. UE5-free.
import { describe, it, expect } from "vitest";
import { autoRefs, wrapRaw, mapErrorCode } from "../../src/types.js";

describe("autoRefs — refs match consuming input param names (ADR-009)", () => {
  it("emits 'blueprint' (input name) + 'blueprintId' alias for a BP response", () => {
    const r = autoRefs({ blueprintPath: "/Game/BP_X" });
    expect(r.blueprint).toBe("/Game/BP_X");   // feeds the `blueprint` param
    expect(r.blueprintId).toBe("/Game/BP_X"); // convention alias
  });

  it("emits 'material' + 'materialId' for a material response", () => {
    const r = autoRefs({ materialPath: "/Game/M_X" });
    expect(r.material).toBe("/Game/M_X");
    expect(r.materialId).toBe("/Game/M_X");
  });

  it("emits 'actorLabel' and 'label' (both consumed) + 'actorId' for an actor", () => {
    const r = autoRefs({ label: "Hero" });
    expect(r.actorLabel).toBe("Hero");
    expect(r.label).toBe("Hero");
    expect(r.actorId).toBe("Hero");
  });

  it("emits 'nodeId' verbatim (already matched pre-fix)", () => {
    expect(autoRefs({ nodeId: "GUID", newNodeId: "x" }).nodeId).toBe("GUID");
    // newNodeId is the fallback when nodeId absent
    expect(autoRefs({ newNodeId: "GUID2" }).nodeId).toBe("GUID2");
  });

  it("emits 'graph' for a graph response", () => {
    expect(autoRefs({ graph: "EventGraph" }).graph).toBe("EventGraph");
  });

  it("emits blueprintIds[] for a list response", () => {
    const r = autoRefs({ blueprints: [{ path: "/Game/A" }, { path: "/Game/B" }, { name: "noPath" }] });
    expect(r.blueprintIds).toEqual(["/Game/A", "/Game/B"]);
  });

  it("returns empty refs for a payload with no chainable ids", () => {
    expect(autoRefs({ success: true, count: 3 })).toEqual({});
  });
});

describe("wrapRaw + mapErrorCode", () => {
  it("wraps a success payload as ok with data", () => {
    const r = wrapRaw({ success: true, value: 1 }, { refs: { blueprint: "/Game/X" } });
    expect(r.ok).toBe(true);
    expect((r.data as any).value).toBe(1);
    expect(r.refs?.blueprint).toBe("/Game/X");
  });

  it("treats error / success:false as failure with a mapped code", () => {
    expect(wrapRaw({ error: "Blueprint not found" }).errorCode).toBe("BP_NOT_FOUND");
    expect(wrapRaw({ error: "compile failed" }).errorCode).toBe("BP_COMPILE_FAILED");
    expect(wrapRaw({ success: false, error: "requires editor mode" }).errorCode).toBe("EDITOR_REQUIRED");
    expect(wrapRaw({ error: "totally unknown" }).errorCode).toBe("UE_HTTP_FAILED");
  });

  it("maps null/undefined to UE_HTTP_FAILED", () => {
    expect(wrapRaw(null).ok).toBe(false);
    expect(mapErrorCode({ error: "thing not found" })).toBe("ASSET_NOT_FOUND");
  });
});
