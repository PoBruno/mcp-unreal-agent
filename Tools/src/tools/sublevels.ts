import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ensureUE, uePost } from "../ue-bridge.js";
import { toMcp, wrapRaw, autoRefs, fail } from "../types.js";

export function registerSublevelTools(server: McpServer): void {
  server.tool(
    "get_level_info",
    "Get information about the current editor world including persistent level details and all streaming sublevels. Requires editor mode.",
    {},
    async () => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));
      try {
        const data = await uePost("/api/get-level-info", {});
        return toMcp(wrapRaw(data, {
          refs: autoRefs(data),
          nextSteps: [
            "use list_sublevels for detailed sublevel information",
            "use load_sublevel / unload_sublevel to manage streaming levels",
          ],
        }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  server.tool(
    "list_sublevels",
    "List all streaming sublevels in the current world with their load/visibility status, streaming class, and actor counts. Requires editor mode.",
    {},
    async () => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));
      try {
        const data = await uePost("/api/list-sublevels", {});
        return toMcp(wrapRaw(data, {
          refs: autoRefs(data),
          nextSteps: [
            "use load_sublevel to load an unloaded sublevel",
            "use unload_sublevel to unload a loaded sublevel",
          ],
        }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  server.tool(
    "load_sublevel",
    "Load a streaming sublevel by name. Optionally make it visible immediately. Requires editor mode.",
    {
      levelName: z.string().describe("Package name or short name of the sublevel to load"),
      makeVisible: z.boolean().optional()
        .describe("Whether to also make the sublevel visible after loading (default: true)"),
    },
    async ({ levelName, makeVisible }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      const body: Record<string, any> = { levelName };
      if (makeVisible !== undefined) body.makeVisible = makeVisible;

      try {
        const data = await uePost("/api/load-sublevel", body);
        return toMcp(wrapRaw(data, {
          refs: autoRefs(data),
          nextSteps: [
            "use list_actors to see actors in the loaded sublevel",
            "use unload_sublevel to unload it when no longer needed",
          ],
        }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  server.tool(
    "unload_sublevel",
    "Unload a streaming sublevel by name. Hides and unloads the sublevel. Requires editor mode.",
    {
      levelName: z.string().describe("Package name or short name of the sublevel to unload"),
    },
    async ({ levelName }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));
      try {
        const data = await uePost("/api/unload-sublevel", { levelName });
        return toMcp(wrapRaw(data, {
          refs: autoRefs(data),
          nextSteps: [
            "use load_sublevel to reload the sublevel",
            "use list_sublevels to verify the status",
          ],
        }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );
}
