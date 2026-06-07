import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ensureUE, uePost } from "../ue-bridge.js";
import { TYPE_NAME_DOCS } from "../helpers.js";
import { toMcp, wrapRaw, autoRefs, fail } from "../types.js";

export function registerSnapshotTools(server: McpServer): void {
  server.tool(
    "snapshot_graph",
    "Create a backup snapshot of a Blueprint graph's state (all nodes, pins, and connections). Use BEFORE any destructive operation (C++ rebuild, change_struct_node_type, bulk edits). Returns a snapshot ID for later use with diff_graph or restore_graph. Snapshots are stored server-side and persist to disk.",
    {
      blueprint: z.string().describe("Blueprint name or package path"),
      graph: z.string().optional().describe("Specific graph name. If omitted, snapshots ALL graphs in the Blueprint"),
    },
    async (params) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      try {
        const data = await uePost("/api/snapshot-graph", {
          blueprint: params.blueprint,
          graph: params.graph,
        });
        const refs = autoRefs(data);
        if (typeof data?.snapshotId === "string") refs.snapshotId = data.snapshotId;
        return toMcp(wrapRaw(data, {
          refs,
          nextSteps: [
            "make your changes, then call diff_graph with refs.snapshotId to see what changed",
            "call restore_graph with refs.snapshotId to reconnect severed pins",
          ],
        }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  server.tool(
    "diff_graph",
    "Compare current Blueprint graph state against a snapshot. Shows severed connections, new connections, type changes, and missing nodes. Use AFTER a potentially destructive operation to assess damage before restoring.",
    {
      blueprint: z.string().describe("Blueprint name or package path"),
      snapshotId: z.string().describe("Snapshot ID from snapshot_graph"),
      graph: z.string().optional().describe("Specific graph to diff. If omitted, diffs all graphs in the snapshot"),
    },
    async (params) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      try {
        const data = await uePost("/api/diff-graph", {
          blueprint: params.blueprint,
          snapshotId: params.snapshotId,
          graph: params.graph,
        });
        return toMcp(wrapRaw(data, {
          refs: autoRefs(data),
          nextSteps: [
            "call restore_graph to reconnect severed pins, or change_struct_node_type to fix type changes first",
            "call validate_blueprint to verify clean compilation",
          ],
        }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  server.tool(
    "restore_graph",
    "Reconnect severed pin connections from a snapshot. Use after diff_graph shows damage. Can restore an entire graph, a single node (nodeId), or use an explicit pin map. For Break/Make struct nodes that lost connections after change_struct_node_type or C++ rebuild, this bulk-reconnects all pins in one call instead of individual connect_pins calls.",
    {
      blueprint: z.string().describe("Blueprint name or package path"),
      snapshotId: z.string().describe("Snapshot ID from snapshot_graph"),
      graph: z.string().optional().describe("Specific graph to restore. If omitted, restores all graphs"),
      nodeId: z.string().optional().describe("Scope restore to a single node (e.g. a Break struct node). Useful after change_struct_node_type"),
      pinMap: z.record(z.string(), z.object({
        targetNodeId: z.string(),
        targetPinName: z.string(),
      })).optional().describe("Explicit pin mapping override: {outputPinName: {targetNodeId, targetPinName}}. Use when no snapshot exists or snapshot is stale"),
      dryRun: z.boolean().optional().describe("Preview reconnections without making changes"),
    },
    async (params) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      try {
        const data = await uePost("/api/restore-graph", {
          blueprint: params.blueprint,
          snapshotId: params.snapshotId,
          graph: params.graph,
          nodeId: params.nodeId,
          pinMap: params.pinMap,
          dryRun: params.dryRun ?? false,
        });
        return toMcp(wrapRaw(data, {
          refs: autoRefs(data),
          nextSteps: params.dryRun
            ? ["re-run restore_graph without dryRun to apply changes"]
            : [
                "call validate_blueprint to verify clean compilation",
                "call find_disconnected_pins to verify no pins were missed",
              ],
        }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  server.tool(
    "find_disconnected_pins",
    "Scan Blueprint(s) for pins that should be connected but aren't. Detects Break/Make struct nodes with broken types (HIGH confidence) or zero connections (MEDIUM confidence). Use after C++ rebuilds, change_struct_node_type, or refresh_all_nodes. Catches silent data flow breaks that validate_blueprint misses. Provide at least one of: blueprint, filter, or snapshotId.",
    {
      blueprint: z.string().optional().describe("Blueprint name or path. If omitted, scans multiple BPs using filter"),
      filter: z.string().optional().describe("Path filter when scanning multiple BPs (e.g. '/Game/Blueprints/Patients/'). Ignored when blueprint is specified"),
      snapshotId: z.string().optional().describe("Compare against snapshot for definite break detection. Without this, uses heuristics only"),
      sensitivity: z.enum(["high", "medium", "all"]).optional().describe("Detection sensitivity: 'high' = only broken types, 'medium' (default) = broken types + zero-connection Break nodes, 'all' = include partially connected Break nodes"),
    },
    async (params) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      try {
        const data = await uePost("/api/find-disconnected-pins", {
          blueprint: params.blueprint,
          filter: params.filter,
          snapshotId: params.snapshotId,
          sensitivity: params.sensitivity ?? "medium",
        });
        return toMcp(wrapRaw(data, {
          refs: autoRefs(data),
          nextSteps: [
            "call change_struct_node_type to restore struct types on HIGH-confidence issues",
            "call restore_graph (if a snapshot exists) or connect_pins to reconnect severed pins",
            "call validate_blueprint to verify compilation",
          ],
        }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  server.tool(
    "analyze_rebuild_impact",
    "Predict which Blueprints will be affected by a C++ module rebuild. Scans for Break/Make struct nodes, variables, and function parameters that reference USTRUCTs/UENUMs defined in the specified module. Use BEFORE rebuilding to know what to snapshot. " + TYPE_NAME_DOCS,
    {
      moduleName: z.string().describe("C++ module name (e.g. 'MyGame'). Finds all Blueprints using types from this module"),
      structNames: z.array(z.string()).optional().describe("Specific struct/enum names to check (e.g. ['FVitals', 'FSkinState']). If omitted, checks ALL types from the module"),
    },
    async (params) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      try {
        const data = await uePost("/api/analyze-rebuild-impact", {
          moduleName: params.moduleName,
          structNames: params.structNames,
        });
        return toMcp(wrapRaw(data, {
          refs: autoRefs(data),
          nextSteps: [
            "call snapshot_graph on each HIGH-risk Blueprint before rebuilding",
            "after rebuild, call find_disconnected_pins to assess damage, then restore_graph to reconnect",
          ],
        }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );
}
