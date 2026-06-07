import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ensureUE, uePost } from "../ue-bridge.js";

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
      if (err) return { content: [{ type: "text" as const, text: err }] };

      const data = await uePost("/api/set-view-mode", { mode });
      if (data.error) return { content: [{ type: "text" as const, text: `Error: ${data.error}` }] };

      return { content: [{ type: "text" as const, text: `View mode set to: ${data.mode}` }] };
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
      if (err) return { content: [{ type: "text" as const, text: err }] };

      const body: Record<string, any> = { flag };
      if (enabled !== undefined) body.enabled = enabled;

      const data = await uePost("/api/set-show-flags", body);
      if (data.error) return { content: [{ type: "text" as const, text: `Error: ${data.error}` }] };

      return { content: [{ type: "text" as const, text: `Show flag '${data.flag}' ${data.enabled ? "enabled" : "disabled"}` }] };
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
      if (err) return { content: [{ type: "text" as const, text: err }] };

      const data = await uePost("/api/set-viewport-type", { type });
      if (data.error) return { content: [{ type: "text" as const, text: `Error: ${data.error}` }] };

      return { content: [{ type: "text" as const, text: `Viewport type set to: ${data.type}` }] };
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
      if (err) return { content: [{ type: "text" as const, text: err }] };

      const data = await uePost("/api/set-realtime-rendering", { enabled });
      if (data.error) return { content: [{ type: "text" as const, text: `Error: ${data.error}` }] };

      return { content: [{ type: "text" as const, text: `Realtime rendering: ${data.realtime ? "enabled" : "disabled"}` }] };
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
      if (err) return { content: [{ type: "text" as const, text: err }] };

      const data = await uePost("/api/set-game-view", { enabled });
      if (data.error) return { content: [{ type: "text" as const, text: `Error: ${data.error}` }] };

      return { content: [{ type: "text" as const, text: `Game view: ${data.gameView ? "enabled" : "disabled"}` }] };
    }
  );
}
