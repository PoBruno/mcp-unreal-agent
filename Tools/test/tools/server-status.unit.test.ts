// Unit tests for the server_status (health tool) structured-output mapper.
// UE5-free: exercises buildServerStatusResult against mock raw payloads.
import { describe, it, expect } from "vitest";
import { buildServerStatusResult } from "../../src/tools/utility.js";

describe("buildServerStatusResult (structured output contract)", () => {
  it("maps a healthy commandlet payload to ok + data", () => {
    const raw = { status: "ok", mode: "commandlet", blueprintCount: 12, mapCount: 3 };
    const result = buildServerStatusResult(raw, false);

    expect(result.ok).toBe(true);
    expect(result.data).toEqual({
      status: "ok",
      mode: "commandlet",
      blueprintCount: 12,
      mapCount: 3,
    });
    expect(result.nextSteps?.length).toBeGreaterThan(0);
  });

  it("falls back to editorMode when raw.mode is absent", () => {
    const result = buildServerStatusResult({ status: "ok", blueprintCount: 0 }, true);

    expect(result.ok).toBe(true);
    expect(result.data?.mode).toBe("editor");
    expect(result.data?.mapCount).toBeNull();
  });

  it("maps a raw error payload to ok=false + UE_HTTP_FAILED", () => {
    const result = buildServerStatusResult({ error: "unreachable" }, false);

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe("UE_HTTP_FAILED");
    expect(result.warnings).toContain("unreachable");
  });
});
