import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ensureUE, uePost } from "../ue-bridge.js";
import { toMcp, wrapRaw, autoRefs, fail } from "../types.js";

export function registerSelectionTools(server: McpServer): void {
  server.tool(
    "get_editor_selection",
    "Get the currently selected actors in the editor. Returns labels, classes, and locations. Requires editor mode.",
    {},
    async () => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));
      try {
        const data = await uePost("/api/get-editor-selection", {});
        return toMcp(wrapRaw(data, {
          refs: autoRefs(data),
          nextSteps: [
            "use set_editor_selection to change the selection",
            "use clear_selection to deselect all",
          ],
        }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  server.tool(
    "set_editor_selection",
    "Select specific actors by label. Clears the current selection first. Requires editor mode.",
    {
      actorLabels: z.array(z.string()).describe("Array of actor labels to select"),
    },
    async ({ actorLabels }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));
      try {
        const data = await uePost("/api/set-editor-selection", { actorLabels });
        return toMcp(wrapRaw(data, {
          refs: autoRefs(data),
          nextSteps: [
            "use get_editor_selection to verify the selection",
            "use focus_actor to focus on a selected actor",
          ],
        }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  server.tool(
    "clear_selection",
    "Deselect all currently selected actors in the editor. Requires editor mode.",
    {},
    async () => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));
      try {
        const data = await uePost("/api/clear-selection", {});
        return toMcp(wrapRaw(data, {
          refs: autoRefs(data),
          nextSteps: ["use set_editor_selection to select new actors"],
        }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );
}
