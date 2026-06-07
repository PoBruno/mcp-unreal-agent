import { describe, it, expect } from "vitest";
import { ueGet } from "../helpers.js";

describe("server_status", () => {
  it("returns health information", async () => {
    const data = await ueGet("/api/health");
    expect(data.status).toBe("ok");
    expect(typeof data.blueprintCount).toBe("number");
    expect(typeof data.mapCount).toBe("number");
    expect(data.mode).toBeDefined();
  });

  it("reports commandlet mode in test environment", async () => {
    const data = await ueGet("/api/health");
    expect(data.mode).toBe("commandlet");
  });
});
