import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ensureUE, uePost } from "../ue-bridge.js";
import { toMcp, wrapRaw, autoRefs, fail } from "../types.js";

export function registerEditorUtilityTools(server: McpServer): void {
  server.tool(
    "focus_actor",
    "Focus the viewport camera on a specific actor, centering it in view and selecting it. Requires editor mode.",
    {
      actorLabel: z.string().describe("Label of the actor to focus on in the World Outliner"),
    },
    async ({ actorLabel }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      try {
        const data = await uePost("/api/focus-actor", { actorLabel });
        return toMcp(wrapRaw(data, {
          refs: autoRefs(data),
          nextSteps: [
            "the actor is now selected and centered in the viewport",
            "use take_screenshot to capture the current view",
          ],
        }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  server.tool(
    "editor_notification",
    "Show a toast notification in the UE5 editor. Useful for providing feedback to the user during long operations. Requires editor mode.",
    {
      message: z.string().describe("Notification message text"),
      severity: z.enum(["none", "success", "fail", "pending"]).optional()
        .describe("Visual style: none (default), success (green check), fail (red X), pending (spinner)"),
      duration: z.number().optional()
        .describe("How long to show the notification in seconds (default: 5)"),
    },
    async ({ message, severity, duration }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      const body: Record<string, any> = { message };
      if (severity) body.severity = severity;
      if (duration !== undefined) body.duration = duration;

      try {
        const data = await uePost("/api/editor-notification", body);
        return toMcp(wrapRaw(data, { refs: autoRefs(data) }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  server.tool(
    "save_all",
    "Save all dirty (unsaved) packages in the editor, including maps and content. Requires editor mode.",
    {},
    async () => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      try {
        const data = await uePost("/api/save-all", {});
        return toMcp(wrapRaw(data, {
          refs: autoRefs(data),
          nextSteps: [
            "use get_dirty_packages to verify no unsaved changes remain",
          ],
        }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  server.tool(
    "get_dirty_packages",
    "List all packages with unsaved changes. Useful for checking what needs saving before closing. Requires editor mode.",
    {},
    async () => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      try {
        const data = await uePost("/api/get-dirty-packages", {});
        return toMcp(wrapRaw(data, {
          refs: autoRefs(data),
          nextSteps: [
            "use save_all to save all dirty packages",
          ],
        }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );
}
