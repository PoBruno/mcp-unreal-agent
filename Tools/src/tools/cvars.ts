import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ensureUE, uePost } from "../ue-bridge.js";
import { toMcp, wrapRaw, autoRefs, fail } from "../types.js";

export function registerCVarTools(server: McpServer): void {
  server.tool(
    "get_cvar",
    "Get the current value of a console variable (CVar). Returns the value, type, and help text. Works in both editor and commandlet mode.",
    {
      name: z.string().describe("Console variable name (e.g., 'r.ScreenPercentage', 'r.VSync')"),
    },
    async ({ name }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      try {
        const data = await uePost("/api/get-cvar", { name });
        return toMcp(wrapRaw(data, {
          refs: autoRefs(data),
          nextSteps: [
            "use set_cvar to change the value",
            "use list_cvars to find related variables",
          ],
        }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
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
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      try {
        const data = await uePost("/api/set-cvar", { name, value: String(value) });
        return toMcp(wrapRaw(data, {
          refs: autoRefs(data),
          nextSteps: [
            "use get_cvar to verify the change",
            "some CVars require editor restart to take effect",
          ],
        }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
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
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      const body: Record<string, any> = {};
      if (filter) body.filter = filter;
      if (maxResults !== undefined) body.maxResults = maxResults;

      try {
        const data = await uePost("/api/list-cvars", body);
        return toMcp(wrapRaw(data, { refs: autoRefs(data) }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );
}
