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
}
