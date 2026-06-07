import { describe, it, expect } from "vitest";
import { uePost } from "../helpers.js";

describe("output log tools", () => {
  describe("get_output_log", () => {
    it("returns log entries without errors", async () => {
      const data = await uePost("/api/get-output-log", {});
      expect(data.error).toBeUndefined();
      expect(typeof data.count).toBe("number");
      expect(typeof data.totalCaptured).toBe("number");
      expect(Array.isArray(data.entries)).toBe(true);
      expect(data.capturing).toBe(true);
    });

    it("respects maxLines", async () => {
      const data = await uePost("/api/get-output-log", { maxLines: 5 });
      expect(data.error).toBeUndefined();
      expect(data.entries.length).toBeLessThanOrEqual(5);
    });

    it("filters by text", async () => {
      const data = await uePost("/api/get-output-log", { filter: "UnrealAgent" });
      expect(data.error).toBeUndefined();
      // All entries should contain the filter text
      if (data.entries && data.entries.length > 0) {
        for (const entry of data.entries) {
          const combined = (entry.message + entry.category).toLowerCase();
          expect(combined).toContain("unrealagent");
        }
      }
    });
  });

  describe("clear_output_log", () => {
    it("clears log without errors", async () => {
      const data = await uePost("/api/clear-output-log", {});
      expect(data.error).toBeUndefined();
      expect(data.success).toBe(true);
      expect(typeof data.clearedEntries).toBe("number");
    });

    it("results in empty log after clear", async () => {
      await uePost("/api/clear-output-log", {});
      const data = await uePost("/api/get-output-log", {});
      expect(data.error).toBeUndefined();
      // May have some entries from the get_output_log call itself
      expect(data.count).toBeLessThanOrEqual(5);
    });
  });
});
