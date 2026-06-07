import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ensureUE, uePost } from "../ue-bridge.js";

export function registerOutputLogTools(server: McpServer): void {
  server.tool(
    "get_output_log",
    "Get recent output log entries from the UE5 editor/commandlet. Captures log messages in a ring buffer. Supports filtering by text and verbosity level. The first call starts log capture automatically.",
    {
      maxLines: z.number().optional()
        .describe("Maximum number of log lines to return (default: 100, max: 1000)"),
      filter: z.string().optional()
        .describe("Text filter \u2014 only entries whose message or category contains this string"),
      verbosity: z.enum(["Error", "Warning"]).optional()
        .describe("Filter by verbosity level: Error (errors+fatals only), Warning (warnings only)"),
    },
    async ({ maxLines, filter, verbosity }) => {
      const err = await ensureUE();
      if (err) return { content: [{ type: "text" as const, text: err }] };

      const body: Record<string, any> = {};
      if (maxLines !== undefined) body.maxLines = maxLines;
      if (filter) body.filter = filter;
      if (verbosity) body.verbosity = verbosity;

      const data = await uePost("/api/get-output-log", body);
      if (data.error) return { content: [{ type: "text" as const, text: `Error: ${data.error}` }] };

      const lines: string[] = [];
      lines.push(`Output log: ${data.count} entries (${data.totalCaptured} total captured)`);

      if (data.entries && data.entries.length > 0) {
        for (const entry of data.entries) {
          const prefix = entry.verbosity === "Error" || entry.verbosity === "Fatal"
            ? "[ERR]"
            : entry.verbosity === "Warning"
            ? "[WRN]"
            : "[LOG]";
          lines.push(`${prefix} [${entry.category}] ${entry.message}`);
        }
      } else {
        lines.push("No log entries matching the filter.");
      }

      lines.push(`\nNext steps:`);
      lines.push(`  1. Use filter parameter to search for specific messages`);
      lines.push(`  2. Use verbosity='Error' to see only errors`);
      lines.push(`  3. Use clear_output_log to reset the capture buffer`);

      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    }
  );

  server.tool(
    "clear_output_log",
    "Clear the captured output log buffer. Does not affect the actual UE5 Output Log window.",
    {},
    async () => {
      const err = await ensureUE();
      if (err) return { content: [{ type: "text" as const, text: err }] };

      const data = await uePost("/api/clear-output-log", {});
      if (data.error) return { content: [{ type: "text" as const, text: `Error: ${data.error}` }] };

      return {
        content: [{
          type: "text" as const,
          text: `Cleared ${data.clearedEntries} log entries from capture buffer.`,
        }],
      };
    }
  );
}
