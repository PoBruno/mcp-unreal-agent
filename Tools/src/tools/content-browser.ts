import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ensureUE, uePost } from "../ue-bridge.js";
import { toMcp, wrapRaw, autoRefs, fail } from "../types.js";

export function registerContentBrowserTools(server: McpServer): void {
  server.tool(
    "navigate_content_browser",
    "Navigate the Content Browser to a specific folder path. Useful for browsing assets in a particular directory. Requires editor mode.",
    {
      path: z.string().describe("Content path to navigate to, e.g. '/Game/Blueprints' or '/Game/Materials'"),
    },
    async ({ path }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      try {
        const data = await uePost("/api/navigate-content-browser", { path });
        return toMcp(wrapRaw(data, {
          refs: autoRefs(data),
          nextSteps: [
            "use list_blueprints to see assets in this folder",
            "use open_asset_editor to open a specific asset",
          ],
        }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  server.tool(
    "open_asset_editor",
    "Open an asset in its dedicated editor (Blueprint editor, Material editor, etc.). Requires editor mode.",
    {
      assetPath: z.string().describe("Asset name or full package path (e.g. 'BP_MyActor' or '/Game/Blueprints/BP_MyActor')"),
    },
    async ({ assetPath }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      try {
        const data = await uePost("/api/open-asset-editor", { assetPath });
        return toMcp(wrapRaw(data, {
          refs: autoRefs(data),
          nextSteps: [
            "use get_blueprint to inspect the asset's contents",
            "use navigate_content_browser to browse related assets",
          ],
        }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );
}
