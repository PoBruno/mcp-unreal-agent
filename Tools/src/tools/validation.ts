import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ensureUE, uePost } from "../ue-bridge.js";
import { toMcp, wrapRaw, autoRefs, fail } from "../types.js";

export function registerValidationTools(server: McpServer): void {
  server.tool(
    "validate_blueprint",
    "Compile a Blueprint and report errors/warnings without saving. Captures both node-level compiler messages AND log-level messages (e.g. 'Can\\'t connect pins', 'Fixed up function'). Use after making changes to verify correctness.",
    {
      blueprint: z.string().describe("Blueprint name or package path (e.g. 'BP_PatientManager')"),
    },
    async ({ blueprint }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      try {
        const data = await uePost("/api/validate-blueprint", { blueprint });
        return toMcp(wrapRaw(data, { refs: autoRefs(data) }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  server.tool(
    "validate_all_blueprints",
    "Bulk-validate all Blueprints (or a filtered subset) by compiling each one and reporting errors. Use after reparenting, C++ changes, or any operation that could cause cascading breakage. Returns only failed Blueprints to keep output manageable. Sends progress notifications during validation.",
    {
      filter: z.string().optional().describe("Optional path or name filter (e.g. '/Game/Blueprints/WebUI/' or 'HUD'). If omitted, validates ALL blueprints."),
      batchSize: z.number().optional().describe("Number of blueprints to validate per batch (default 50). Smaller batches give more frequent progress updates."),
    },
    async ({ filter, batchSize: batchSizeParam }, extra) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      const batchSize = batchSizeParam ?? 50;

      try {
        // Step 1: Get total count (fast, no compilation)
        const countBody: Record<string, unknown> = { countOnly: true };
        if (filter) countBody.filter = filter;

        const countData = await uePost("/api/validate-all-blueprints", countBody);
        if (countData.error) return toMcp(wrapRaw(countData));

        const totalMatching: number = countData.totalMatching ?? 0;

        if (totalMatching === 0) {
          return toMcp(wrapRaw({ totalMatching: 0, totalChecked: 0, totalPassed: 0, totalFailed: 0, failed: [] }));
        }

        // Extract progress token from MCP request metadata
        const progressToken = extra._meta?.progressToken;

        // Step 2: Iterate in batches
        let totalChecked = 0;
        let totalPassed = 0;
        let totalFailed = 0;
        let totalCrashed = 0;
        const allFailed: any[] = [];

        for (let offset = 0; offset < totalMatching; offset += batchSize) {
          const body: Record<string, unknown> = { offset, limit: batchSize };
          if (filter) body.filter = filter;

          const data = await uePost("/api/validate-all-blueprints", body);
          if (data.error) return toMcp(wrapRaw(data));

          totalChecked += data.totalChecked ?? 0;
          totalPassed += data.totalPassed ?? 0;
          totalFailed += data.totalFailed ?? 0;
          totalCrashed += (data.totalCrashed ?? 0);

          if (data.failed?.length) {
            allFailed.push(...data.failed);
          }

          // Send MCP progress notification if client requested it
          if (progressToken !== undefined) {
            try {
              await extra.sendNotification({
                method: "notifications/progress",
                params: {
                  progressToken,
                  progress: Math.min(offset + batchSize, totalMatching),
                  total: totalMatching,
                  message: `Validated ${totalChecked}/${totalMatching} blueprints (${totalFailed} failed)`,
                },
              });
            } catch {
              // Progress notifications are best-effort per MCP spec
            }
          }
        }

        return toMcp(wrapRaw({
          filter: filter ?? null,
          totalMatching,
          totalChecked,
          totalPassed,
          totalFailed,
          totalCrashed,
          failed: allFailed,
        }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  // ---------------------------------------------------------------------------
  // compile_blueprint — first-class Compile (the toolbar Compile button)
  // ---------------------------------------------------------------------------
  server.tool(
    "compile_blueprint",
    [
      "Compile a Blueprint (the editor's Compile button) and return structured Compiler Results.",
      "This is the canonical 'finish my edits' step: after mutating a graph/variables/pins, call this to verify the class is valid.",
      "Returns status (UpToDate/UpToDateWithWarnings/Error/Dirty), errorCount/warningCount, each message with its graph + nodeId + nodeTitle (so you can jump to/fix the node), compileTimeMs, and needsSave.",
      "Options: save (persist if it compiles clean), refreshNodes (run Refresh Nodes first — fixes stale pins after upstream signature/struct changes), retryOnError (one auto-retry after a refresh for transient cross-dependency errors).",
    ].join(" "),
    {
      blueprint: z.string().describe("Blueprint name or package path. Accepts refs.blueprint."),
      save: z.boolean().optional().describe("Save the package if compile produced no errors (default false)."),
      refreshNodes: z.boolean().optional().describe("Run Refresh All Nodes before compiling — fixes 'stale pin'/orphaned-pin errors after a parent/struct/function-signature change."),
      retryOnError: z.boolean().optional().describe("If the first compile has errors, refresh nodes and compile once more (handles transient cross-Blueprint dependency errors)."),
    },
    async ({ blueprint, save, refreshNodes, retryOnError }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      const body: Record<string, unknown> = { blueprint };
      if (save !== undefined) body.save = save;
      if (refreshNodes !== undefined) body.refreshNodes = refreshNodes;
      if (retryOnError !== undefined) body.retryOnError = retryOnError;

      try {
        const data = await uePost("/api/compile-blueprint", body);
        if ((data as { error?: string })?.error) return toMcp(wrapRaw(data));

        const errorCount = (data as { errorCount?: number }).errorCount ?? 0;
        const warningCount = (data as { warningCount?: number }).warningCount ?? 0;
        const needsSave = (data as { needsSave?: boolean }).needsSave ?? false;
        const crashed = (data as { crashed?: boolean }).crashed ?? false;
        const errorNodeIds = (data as { errorNodeIds?: string[] }).errorNodeIds ?? [];

        if (crashed) {
          return toMcp({ ok: false, errorCode: "SEH_EXCEPTION", data, warnings: ["compile raised an SEH exception; reload the asset"] });
        }
        if (errorCount > 0) {
          const nextSteps = [
            "inspect data.errors — each has graph + nodeId + message",
            "if errors mention stale/orphaned pins, call compile_blueprint with refreshNodes:true",
            "fix the named nodes, then compile_blueprint again",
          ];
          return toMcp({ ok: false, errorCode: "BP_COMPILE_FAILED", data, refs: { ...autoRefs(data), errorNodeIds }, nextSteps });
        }

        const nextSteps: string[] = [];
        if (warningCount > 0) nextSteps.push("review data.warnings — the class is usable but flagged");
        if (needsSave) nextSteps.push("call save_all (or compile_blueprint save:true) to persist");
        return toMcp(wrapRaw(data, { refs: autoRefs(data), nextSteps: nextSteps.length ? nextSteps : undefined }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  // ---------------------------------------------------------------------------
  // get_node_properties — list ALL properties+values of a graph node (Details panel)
  // ---------------------------------------------------------------------------
  server.tool(
    "get_node_properties",
    [
      "List every editable property of a Blueprint graph node with its current value — the equivalent of selecting the node and reading its Details panel.",
      "Enumerates the node's reflected FProperties: name, type, category, editable/readOnly flags, and value.",
      "Enrichment: enum properties include allowedValues (the dropdown options); numeric properties include UIMin/UIMax/ClampMin/ClampMax when set; object/asset properties include allowedClass; struct properties (e.g. an anim node's embedded settings) expand one level into subProperties.",
      "Use before set_node_property so you know the exact property name (use the dotted 'Struct.Sub' path for sub-properties) and the legal values.",
    ].join(" "),
    {
      blueprint: z.string().describe("Blueprint name or path. Accepts refs.blueprint."),
      nodeId: z.string().describe("Node GUID (from refs.nodeId / get_blueprint_graph)."),
      filter: z.string().optional().describe("Case-insensitive substring filter on property name."),
      editableOnly: z.boolean().optional().describe("Only return EditAnywhere properties (what the Details panel shows). Default false = all reflected properties."),
    },
    async ({ blueprint, nodeId, filter, editableOnly }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      const body: Record<string, unknown> = { blueprint, nodeId };
      if (filter !== undefined) body.filter = filter;
      if (editableOnly !== undefined) body.editableOnly = editableOnly;

      try {
        const data = await uePost("/api/get-node-properties", body);
        return toMcp(wrapRaw(data, {
          refs: autoRefs(data),
          nextSteps: ["use set_node_property to change any value (dotted path for sub-properties, e.g. 'Node.PlayRate')"],
        }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  // ---------------------------------------------------------------------------
  // set_node_property — edit any property on a graph node
  // ---------------------------------------------------------------------------
  server.tool(
    "set_node_property",
    [
      "Set a property on a Blueprint graph node — the equivalent of editing a field in the node's Details panel.",
      "Resolves the property by name (use a dotted path like 'Node.PlayRate' for a sub-property inside a struct, e.g. an anim node's embedded settings), parses the value, reconstructs the node's pins, and marks the Blueprint for recompile.",
      "Call get_node_properties first to learn the exact property name and legal values. Pass save:true to compile+save in one step.",
    ].join(" "),
    {
      blueprint: z.string().describe("Blueprint name or path. Accepts refs.blueprint."),
      nodeId: z.string().describe("Node GUID (from refs.nodeId)."),
      propertyName: z.string().describe("Property name, or dotted 'Struct.Sub' path for a struct sub-property."),
      value: z.string().describe("New value as text (ImportText format — e.g. '1.5', 'true', an enum name, '/Game/Path/Asset.Asset')."),
      save: z.boolean().optional().describe("Compile and save after setting (default false — just marks dirty)."),
    },
    async ({ blueprint, nodeId, propertyName, value, save }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      const body: Record<string, unknown> = { blueprint, nodeId, propertyName, value };
      if (save !== undefined) body.save = save;

      try {
        const data = await uePost("/api/set-node-property", body);
        return toMcp(wrapRaw(data, {
          refs: autoRefs(data),
          nextSteps: ["call compile_blueprint to verify the change is valid"],
        }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );
}
