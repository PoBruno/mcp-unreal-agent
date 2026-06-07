// Unit tests for the list_blueprints structured-output mapper.
// UE5-free: exercises buildListBlueprintsResult against mock raw payloads.
import { describe, it, expect } from "vitest";
import { buildListBlueprintsResult } from "../../src/tools/read.js";

describe("buildListBlueprintsResult (structured output contract)", () => {
  it("maps a populated list to ok + data + refs.blueprintIds", () => {
    const raw = {
      count: 2,
      total: 5,
      blueprints: [
        { name: "BP_A", path: "/Game/BP_A", parentClass: "Actor" },
        { name: "BP_B", path: "/Game/BP_B", parentClass: "Pawn", isLevelBlueprint: false },
      ],
    };
    const result = buildListBlueprintsResult(raw);

    expect(result.ok).toBe(true);
    expect(result.errorCode).toBeUndefined();
    expect(result.data).toEqual(raw);
    expect(result.refs?.blueprintIds).toEqual(["/Game/BP_A", "/Game/BP_B"]);
    expect(result.nextSteps?.length).toBeGreaterThan(0);
  });

  it("returns ok with empty refs and a broaden-filter hint for no matches", () => {
    const result = buildListBlueprintsResult({ count: 0, total: 5, blueprints: [] });

    expect(result.ok).toBe(true);
    expect(result.refs?.blueprintIds).toEqual([]);
    expect(result.nextSteps?.[0]).toMatch(/broaden the filter/i);
  });

  it("maps a raw error payload to ok=false + UE_HTTP_FAILED", () => {
    const result = buildListBlueprintsResult({ error: "boom" });

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe("UE_HTTP_FAILED");
    expect(result.warnings).toContain("boom");
  });

  it("tolerates a missing blueprints array (defaults to empty)", () => {
    const result = buildListBlueprintsResult({});

    expect(result.ok).toBe(true);
    expect(result.data?.blueprints).toEqual([]);
    expect(result.data?.count).toBe(0);
    expect(result.refs?.blueprintIds).toEqual([]);
  });

  it("drops entries without a path when building blueprintIds", () => {
    const raw = {
      count: 2,
      total: 2,
      blueprints: [
        { name: "BP_A", path: "/Game/BP_A" },
        { name: "BP_NoPath" },
      ],
    };
    const result = buildListBlueprintsResult(raw);

    expect(result.refs?.blueprintIds).toEqual(["/Game/BP_A"]);
  });
});
