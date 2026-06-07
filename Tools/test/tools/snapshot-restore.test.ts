import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { uePost, createTestBlueprint, deleteTestBlueprint, uniqueName } from "../helpers.js";

describe("snapshot_graph / diff_graph / restore_graph", () => {
  const bpName = uniqueName("BP_SnapshotTest");
  const packagePath = "/Game/Test";
  let snapshotId: string;

  beforeAll(async () => {
    const bp = await createTestBlueprint({ name: bpName });
    expect(bp.error).toBeUndefined();

    // Add a PrintString node so there's some graph content
    await uePost("/api/add-node", {
      blueprint: bpName,
      graph: "EventGraph",
      nodeType: "CallFunction",
      functionName: "PrintString",
    });
  });

  afterAll(async () => {
    await deleteTestBlueprint(`${packagePath}/${bpName}`);
  });

  describe("snapshot_graph", () => {
    it("creates a snapshot of EventGraph", async () => {
      const data = await uePost("/api/snapshot-graph", {
        blueprint: bpName,
        graph: "EventGraph",
      });
      expect(data.error).toBeUndefined();
      expect(data.snapshotId).toBeDefined();
      expect(data.blueprint).toBe(bpName);
      expect(data.totalConnections).toBeDefined();
      snapshotId = data.snapshotId;
    });

    it("creates a snapshot of all graphs when graph is omitted", async () => {
      const data = await uePost("/api/snapshot-graph", {
        blueprint: bpName,
      });
      expect(data.error).toBeUndefined();
      expect(data.snapshotId).toBeDefined();
      expect(Array.isArray(data.graphs)).toBe(true);
    });

    it("returns error for non-existent blueprint", async () => {
      const data = await uePost("/api/snapshot-graph", {
        blueprint: "BP_DoesNotExist_XYZ_999",
      });
      expect(data.error).toBeDefined();
    });
  });

  describe("diff_graph", () => {
    it("diffs current state against snapshot (no changes)", async () => {
      expect(snapshotId).toBeDefined();
      const data = await uePost("/api/diff-graph", {
        blueprint: bpName,
        snapshotId,
      });
      expect(data.error).toBeUndefined();
      expect(data.summary).toBeDefined();
      // No changes since snapshot
      expect(data.summary.severedConnections).toBe(0);
      expect(data.summary.missingNodes).toBe(0);
    });

    it("returns error for invalid snapshot ID", async () => {
      const data = await uePost("/api/diff-graph", {
        blueprint: bpName,
        snapshotId: "invalid-snapshot-id-xyz",
      });
      expect(data.error).toBeDefined();
    });
  });

  describe("restore_graph", () => {
    it("restores from snapshot in dry-run mode", async () => {
      expect(snapshotId).toBeDefined();
      const data = await uePost("/api/restore-graph", {
        blueprint: bpName,
        snapshotId,
        dryRun: true,
      });
      expect(data.error).toBeUndefined();
      expect(data.status).toBe("ok");
      expect(typeof data.reconnected).toBe("number");
      expect(typeof data.failed).toBe("number");
    });

    it("restores from snapshot (actual)", async () => {
      expect(snapshotId).toBeDefined();
      const data = await uePost("/api/restore-graph", {
        blueprint: bpName,
        snapshotId,
      });
      expect(data.error).toBeUndefined();
      expect(data.status).toBe("ok");
      expect(typeof data.reconnected).toBe("number");
    });

    it("returns error for invalid snapshot ID", async () => {
      const data = await uePost("/api/restore-graph", {
        blueprint: bpName,
        snapshotId: "invalid-snapshot-id-xyz",
      });
      expect(data.error).toBeDefined();
    });
  });
});
