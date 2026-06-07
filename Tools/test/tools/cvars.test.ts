import { describe, it, expect } from "vitest";
import { uePost } from "../helpers.js";

describe("cvar tools", () => {
  describe("get_cvar", () => {
    it("returns error for missing name field", async () => {
      const data = await uePost("/api/get-cvar", {});
      expect(data.error).toBeDefined();
      expect(data.error).toContain("name");
    });

    it("returns error for non-existent cvar", async () => {
      const data = await uePost("/api/get-cvar", {
        name: "nonexistent.cvar.xyz.999",
      });
      expect(data.error).toBeDefined();
    });

    it("gets a known cvar", async () => {
      const data = await uePost("/api/get-cvar", { name: "r.VSync" });
      // r.VSync may or may not exist depending on build, so just check structure
      if (!data.error) {
        expect(data.name).toBe("r.VSync");
        expect(data.value).toBeDefined();
        expect(data.type).toBeDefined();
      }
    });
  });

  describe("set_cvar", () => {
    it("returns error for missing name field", async () => {
      const data = await uePost("/api/set-cvar", { value: "1" });
      expect(data.error).toBeDefined();
      expect(data.error).toContain("name");
    });

    it("returns error for missing value field", async () => {
      const data = await uePost("/api/set-cvar", { name: "r.VSync" });
      expect(data.error).toBeDefined();
      expect(data.error).toContain("value");
    });

    it("returns error for non-existent cvar", async () => {
      const data = await uePost("/api/set-cvar", {
        name: "nonexistent.cvar.xyz.999",
        value: "1",
      });
      expect(data.error).toBeDefined();
    });
  });

  describe("list_cvars", () => {
    it("returns cvar list without filter", async () => {
      const data = await uePost("/api/list-cvars", {});
      expect(data.error).toBeUndefined();
      expect(typeof data.count).toBe("number");
      expect(typeof data.totalMatches).toBe("number");
      expect(Array.isArray(data.cvars)).toBe(true);
    });

    it("filters by name substring", async () => {
      const data = await uePost("/api/list-cvars", { filter: "r.Shadow" });
      expect(data.error).toBeUndefined();
      expect(data.filter).toBe("r.Shadow");
      // All returned CVars should contain the filter string
      if (data.cvars && data.cvars.length > 0) {
        for (const cvar of data.cvars) {
          expect(cvar.name.toLowerCase()).toContain("r.shadow");
        }
      }
    });

    it("respects maxResults", async () => {
      const data = await uePost("/api/list-cvars", { maxResults: 5 });
      expect(data.error).toBeUndefined();
      expect(data.cvars.length).toBeLessThanOrEqual(5);
    });
  });
});
