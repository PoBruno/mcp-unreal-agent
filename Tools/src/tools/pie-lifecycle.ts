import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ensureUE, uePost } from "../ue-bridge.js";
import { toMcp, wrapRaw, autoRefs, fail } from "../types.js";

export function registerPIELifecycleTools(server: McpServer): void {
  server.tool(
    "start_pie",
    "Start a Play In Editor (PIE) session. Launches the game in the editor viewport for testing. Requires editor mode and no active PIE session.",
    {},
    async () => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      try {
        const data = await uePost("/api/start-pie", {});
        return toMcp(wrapRaw(data, {
          refs: autoRefs(data),
          nextSteps: [
            "use is_pie_running to check when the session is fully active",
            "use pie_pause to pause/unpause execution",
            "use stop_pie to end the session",
          ],
        }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  server.tool(
    "stop_pie",
    "Stop the active Play In Editor (PIE) session. Returns the editor to edit mode. Requires a running PIE session.",
    {},
    async () => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      try {
        const data = await uePost("/api/stop-pie", {});
        return toMcp(wrapRaw(data, { refs: autoRefs(data) }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  server.tool(
    "is_pie_running",
    "Check whether a Play In Editor (PIE) session is currently active and whether it is paused. Requires editor mode.",
    {},
    async () => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      try {
        const data = await uePost("/api/is-pie-running", {});
        return toMcp(wrapRaw(data, { refs: autoRefs(data) }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  server.tool(
    "pie_pause",
    "Pause or unpause the active PIE session. Useful for inspecting game state at a specific moment. Requires a running PIE session.",
    {
      paused: z.boolean().describe("true to pause, false to unpause"),
    },
    async ({ paused }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      try {
        const data = await uePost("/api/pie-pause", { paused });
        return toMcp(wrapRaw(data, { refs: autoRefs(data) }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );
}
