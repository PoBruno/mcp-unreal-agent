import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ensureUE, uePost } from "../ue-bridge.js";
import { toMcp, wrapRaw, autoRefs, fail } from "../types.js";

export function registerViewModeTools(server: McpServer): void {
  server.tool(
    "set_view_mode",
    "Change the viewport rendering mode (Lit, Unlit, Wireframe, etc.). Requires editor mode.",
    {
      mode: z.enum(["Lit", "Unlit", "Wireframe", "DetailLighting", "LightingOnly", "LightComplexity", "ShaderComplexity", "PathTracing"])
        .describe("Viewport rendering mode"),
    },
    async ({ mode }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      try {
        const data = await uePost("/api/set-view-mode", { mode });
        return toMcp(wrapRaw(data, { refs: autoRefs(data) }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  server.tool(
    "set_show_flags",
    "Toggle viewport show flags (Grid, Fog, Collision, etc.). Requires editor mode.",
    {
      flag: z.string().describe("Show flag name (e.g. Grid, Fog, Volumes, BSP, Collision, Navigation, Bounds, StaticMeshes, Lighting, PostProcessing)"),
      enabled: z.boolean().optional().describe("true to enable, false to disable (default: true)"),
    },
    async ({ flag, enabled }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      const body: Record<string, any> = { flag };
      if (enabled !== undefined) body.enabled = enabled;

      try {
        const data = await uePost("/api/set-show-flags", body);
        return toMcp(wrapRaw(data, { refs: autoRefs(data) }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  server.tool(
    "set_viewport_type",
    "Switch the viewport between Perspective and orthographic views (Top, Front, Left, etc.). Requires editor mode.",
    {
      type: z.enum(["Perspective", "Top", "Bottom", "Left", "Right", "Front", "Back"])
        .describe("Viewport projection type"),
    },
    async ({ type }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      try {
        const data = await uePost("/api/set-viewport-type", { type });
        return toMcp(wrapRaw(data, { refs: autoRefs(data) }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  server.tool(
    "set_realtime_rendering",
    "Enable or disable realtime rendering in the viewport. When disabled, the viewport only updates on interaction. Requires editor mode.",
    {
      enabled: z.boolean().describe("true to enable realtime, false to disable"),
    },
    async ({ enabled }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      try {
        const data = await uePost("/api/set-realtime-rendering", { enabled });
        return toMcp(wrapRaw(data, { refs: autoRefs(data) }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  server.tool(
    "set_game_view",
    "Toggle game view mode, which hides editor-only visuals (icons, wireframes, selection outlines) to preview the scene as it appears in-game. Requires editor mode.",
    {
      enabled: z.boolean().describe("true to enable game view, false to show editor visuals"),
    },
    async ({ enabled }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      try {
        const data = await uePost("/api/set-game-view", { enabled });
        return toMcp(wrapRaw(data, { refs: autoRefs(data) }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );
}
