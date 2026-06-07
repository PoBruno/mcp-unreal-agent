import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ensureUE, uePost } from "../ue-bridge.js";
import { toMcp, wrapRaw, autoRefs, fail } from "../types.js";

export function registerPIERuntimeTools(server: McpServer): void {
  server.tool(
    "pie_get_player_transform",
    "Get the player pawn's current location, rotation, velocity, and class during PIE. Requires an active PIE session.",
    {},
    async () => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      try {
        const data = await uePost("/api/pie-get-player-transform", {});
        return toMcp(wrapRaw(data, {
          refs: autoRefs(data),
          nextSteps: [
            "use pie_teleport_player to move the player",
            "use pie_query_actors to find nearby actors",
          ],
        }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  server.tool(
    "pie_teleport_player",
    "Teleport the player pawn to a new location during PIE. Optionally set rotation. Requires an active PIE session.",
    {
      location: z.object({
        x: z.number().describe("X coordinate"),
        y: z.number().describe("Y coordinate"),
        z: z.number().describe("Z coordinate"),
      }).describe("Target world position"),
      rotation: z.object({
        pitch: z.number().describe("Pitch in degrees"),
        yaw: z.number().describe("Yaw in degrees"),
        roll: z.number().optional().describe("Roll in degrees (default: 0)"),
      }).optional().describe("Target rotation (optional, keeps current if omitted)"),
    },
    async ({ location, rotation }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      const body: Record<string, any> = { location };
      if (rotation) body.rotation = { pitch: rotation.pitch, yaw: rotation.yaw, roll: rotation.roll ?? 0 };

      try {
        const data = await uePost("/api/pie-teleport-player", body);
        return toMcp(wrapRaw(data, { refs: autoRefs(data) }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  server.tool(
    "pie_query_actors",
    "Query actors in the PIE game world. Filter by class name and/or tag. Requires an active PIE session.",
    {
      classFilter: z.string().optional()
        .describe("Filter actors whose class name contains this string (case-insensitive)"),
      tagFilter: z.string().optional()
        .describe("Filter actors that have a tag containing this string (case-insensitive)"),
      maxResults: z.number().optional()
        .describe("Maximum number of results (default: 100, max: 1000)"),
    },
    async ({ classFilter, tagFilter, maxResults }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      const body: Record<string, any> = {};
      if (classFilter) body.classFilter = classFilter;
      if (tagFilter) body.tagFilter = tagFilter;
      if (maxResults !== undefined) body.maxResults = maxResults;

      try {
        const data = await uePost("/api/pie-query-actors", body);
        return toMcp(wrapRaw(data, { refs: autoRefs(data) }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );
}
