import { describe, it, expect } from "vitest";
import { uePost } from "../helpers.js";

describe("analyze_rebuild_impact", () => {
  it("analyzes impact for the Engine module", async () => {
    const data = await uePost("/api/analyze-rebuild-impact", {
      moduleName: "Engine",
    });
    expect(data.error).toBeUndefined();
    expect(data.summary).toBeDefined();
    expect(typeof data.summary.totalBlueprints).toBe("number");
    expect(typeof data.summary.totalBreakMakeNodes).toBe("number");
    expect(typeof data.summary.totalConnectionsAtRisk).toBe("number");
  });

  it("analyzes impact with specific struct names", async () => {
    const data = await uePost("/api/analyze-rebuild-impact", {
      moduleName: "Engine",
      structNames: ["Vector"],
    });
    expect(data.error).toBeUndefined();
    expect(data.summary).toBeDefined();
  });

  it("handles non-existent module gracefully", async () => {
    const data = await uePost("/api/analyze-rebuild-impact", {
      moduleName: "NonExistentModule_XYZ_999",
    });
    // Should succeed with zero affected (module name is used as a package name filter)
    expect(data.error).toBeUndefined();
    expect(data.summary).toBeDefined();
    expect(data.summary.totalBlueprints).toBe(0);
  });

  it("rejects missing required fields", async () => {
    const data = await uePost("/api/analyze-rebuild-impact", {});
    expect(data.error).toBeDefined();
  });
});
