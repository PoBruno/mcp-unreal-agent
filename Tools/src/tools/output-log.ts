import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ensureUE, uePost } from "../ue-bridge.js";
import { toMcp, wrapRaw, autoRefs, fail } from "../types.js";

export function registerOutputLogTools(server: McpServer): void {
  server.tool(
    "get_output_log",
    "Get recent output log entries from the UE5 editor/commandlet. Captures log messages in a ring buffer. Supports filtering by text and verbosity level. The first call starts log capture automatically.",
    {
      maxLines: z.number().optional()
        .describe("Maximum number of log lines to return (default: 100, max: 1000)"),
      filter: z.string().optional()
        .describe("Text filter — only entries whose message or category contains this string"),
      verbosity: z.enum(["Error", "Warning"]).optional()
        .describe("Filter by verbosity level: Error (errors+fatals only), Warning (warnings only)"),
    },
    async ({ maxLines, filter, verbosity }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      const body: Record<string, any> = {};
      if (maxLines !== undefined) body.maxLines = maxLines;
      if (filter) body.filter = filter;
      if (verbosity) body.verbosity = verbosity;

      try {
        const data = await uePost("/api/get-output-log", body);
        return toMcp(wrapRaw(data, {
          refs: autoRefs(data),
          nextSteps: [
            "use filter parameter to search for specific messages",
            "use verbosity='Error' to see only errors",
            "use clear_output_log to reset the capture buffer",
          ],
        }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  server.tool(
    "clear_output_log",
    "Clear the captured output log buffer. Does not affect the actual UE5 Output Log window.",
    {},
    async () => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      try {
        const data = await uePost("/api/clear-output-log", {});
        return toMcp(wrapRaw(data, { refs: autoRefs(data) }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );
}
