import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ensureUE, uePost } from "../ue-bridge.js";

export function registerCVarTools(server: McpServer): void {
  server.tool(
    "get_cvar",
    "Get the current value of a console variable (CVar). Returns the value, type, and help text. Works in both editor and commandlet mode.",
    {
      name: z.string().describe("Console variable name (e.g., 'r.ScreenPercentage', 'r.VSync')"),
    },
    async ({ name }) => {
      const err = await ensureUE();
      if (err) return { content: [{ type: "text" as const, text: err }] };

      const data = await uePost("/api/get-cvar", { name });
      if (data.error) return { content: [{ type: "text" as const, text: `Error: ${data.error}` }] };

      const lines = [
        `${data.name} = ${data.value}`,
        `Type: ${data.type}`,
      ];
      if (data.help) lines.push(`Help: ${data.help}`);
      lines.push(`\nNext steps:`);
      lines.push(`  1. Use set_cvar to change the value`);
      lines.push(`  2. Use list_cvars to find related variables`);

      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    }
  );

  server.tool(
    "set_cvar",
    "Set a console variable (CVar) to a new value. Returns the previous and new values. Works in both editor and commandlet mode.",
    {
      name: z.string().describe("Console variable name"),
      value: z.union([z.string(), z.number(), z.boolean()])
        .describe("New value for the CVar (string, number, or boolean)"),
    },
    async ({ name, value }) => {
      const err = await ensureUE();
      if (err) return { content: [{ type: "text" as const, text: err }] };

      const data = await uePost("/api/set-cvar", { name, value: String(value) });
      if (data.error) return { content: [{ type: "text" as const, text: `Error: ${data.error}` }] };

      const lines = [
        `${data.name}: ${data.previousValue} -> ${data.newValue}`,
        `\nNext steps:`,
        `  1. Use get_cvar to verify the change`,
        `  2. Note: some CVars require editor restart to take effect`,
      ];

      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    }
  );

  server.tool(
    "list_cvars",
    "Search and list console variables (CVars). Filter by name substring. Returns name, value, and help text. Works in both editor and commandlet mode.",
    {
      filter: z.string().optional()
        .describe("Substring filter for CVar names (e.g., 'r.Shadow' to find shadow-related CVars)"),
      maxResults: z.number().optional()
        .describe("Maximum number of results to return (default: 50, max: 500)"),
    },
    async ({ filter, maxResults }) => {
      const err = await ensureUE();
      if (err) return { content: [{ type: "text" as const, text: err }] };

      const body: Record<string, any> = {};
      if (filter) body.filter = filter;
      if (maxResults !== undefined) body.maxResults = maxResults;

      const data = await uePost("/api/list-cvars", body);
      if (data.error) return { content: [{ type: "text" as const, text: `Error: ${data.error}` }] };

      const lines: string[] = [];
      if (data.filter) {
        lines.push(`CVars matching '${data.filter}': ${data.totalMatches} total, showing ${data.count}`);
      } else {
        lines.push(`CVars: ${data.totalMatches} total, showing ${data.count}`);
      }

      if (data.cvars && data.cvars.length > 0) {
        for (const cvar of data.cvars) {
          lines.push(`  ${cvar.name} = ${cvar.value}`);
          if (cvar.help) lines.push(`    ${cvar.help}`);
        }
      }

      if (data.totalMatches > data.count) {
        lines.push(`\n  ... and ${data.totalMatches - data.count} more. Use a more specific filter or increase maxResults.`);
      }

      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    }
  );
}
