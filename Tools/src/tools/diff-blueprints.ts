import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ensureUE, uePost } from "../ue-bridge.js";
import { toMcp, wrapRaw, autoRefs, fail } from "../types.js";

export function registerDiffBlueprintsTools(server: McpServer): void {
  server.tool(
    "diff_blueprints",
    "Structural diff between two different Blueprints. Compares nodes, connections, and variables across graphs. Use for comparing patient variants, finding divergence after copy-paste, or auditing consistency.",
    {
      blueprintA: z.string().describe("First Blueprint name or package path"),
      blueprintB: z.string().describe("Second Blueprint name or package path"),
      graph: z.string().optional().describe("Specific graph to compare (e.g. 'EventGraph'). If omitted, compares all graphs."),
    },
    async ({ blueprintA, blueprintB, graph }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      const body: Record<string, any> = { blueprintA, blueprintB };
      if (graph) body.graph = graph;

      try {
        const data = await uePost("/api/diff-blueprints", body);
        return toMcp(wrapRaw(data, { refs: autoRefs(data) }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );
}
