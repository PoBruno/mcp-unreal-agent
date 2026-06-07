import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ensureUE, uePost } from "../ue-bridge.js";

export function registerPIERuntimeTools(server: McpServer): void {
  server.tool(
    "pie_get_player_transform",
    "Get the player pawn's current location, rotation, velocity, and class during PIE. Requires an active PIE session.",
    {},
    async () => {
      const err = await ensureUE();
      if (err) return { content: [{ type: "text" as const, text: err }] };

      const data = await uePost("/api/pie-get-player-transform", {});
      if (data.error) return { content: [{ type: "text" as const, text: `Error: ${data.error}` }] };

      const lines = [
        `Player Pawn (${data.pawnClass}):`,
        `  Location: (${data.location.x.toFixed(1)}, ${data.location.y.toFixed(1)}, ${data.location.z.toFixed(1)})`,
        `  Rotation: pitch=${data.rotation.pitch.toFixed(1)}, yaw=${data.rotation.yaw.toFixed(1)}, roll=${data.rotation.roll.toFixed(1)}`,
        `  Velocity: (${data.velocity.x.toFixed(1)}, ${data.velocity.y.toFixed(1)}, ${data.velocity.z.toFixed(1)})`,
        `  Speed: ${data.speed.toFixed(1)}`,
        `\nNext steps:`,
        `  1. Use pie_teleport_player to move the player`,
        `  2. Use pie_query_actors to find nearby actors`,
      ];

      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
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
      if (err) return { content: [{ type: "text" as const, text: err }] };

      const body: Record<string, any> = { location };
      if (rotation) body.rotation = { pitch: rotation.pitch, yaw: rotation.yaw, roll: rotation.roll ?? 0 };

      const data = await uePost("/api/pie-teleport-player", body);
      if (data.error) return { content: [{ type: "text" as const, text: `Error: ${data.error}` }] };

      const lines = [
        `${data.success ? "Teleported" : "Teleport failed"}:`,
        `  Location: (${data.location.x.toFixed(1)}, ${data.location.y.toFixed(1)}, ${data.location.z.toFixed(1)})`,
        `  Rotation: pitch=${data.rotation.pitch.toFixed(1)}, yaw=${data.rotation.yaw.toFixed(1)}, roll=${data.rotation.roll.toFixed(1)}`,
      ];

      if (data.warning) lines.push(`  Warning: ${data.warning}`);

      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
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
      if (err) return { content: [{ type: "text" as const, text: err }] };

      const body: Record<string, any> = {};
      if (classFilter) body.classFilter = classFilter;
      if (tagFilter) body.tagFilter = tagFilter;
      if (maxResults !== undefined) body.maxResults = maxResults;

      const data = await uePost("/api/pie-query-actors", body);
      if (data.error) return { content: [{ type: "text" as const, text: `Error: ${data.error}` }] };

      const lines = [`Found ${data.count} actors in PIE world:`];
      if (data.classFilter) lines.push(`  Class filter: ${data.classFilter}`);
      if (data.tagFilter) lines.push(`  Tag filter: ${data.tagFilter}`);
      lines.push("");

      for (const actor of data.actors.slice(0, 20)) {
        const loc = actor.location;
        lines.push(`  ${actor.label || actor.name} (${actor.class}) at (${loc.x.toFixed(0)}, ${loc.y.toFixed(0)}, ${loc.z.toFixed(0)})`);
      }

      if (data.count > 20) {
        lines.push(`  ... and ${data.count - 20} more`);
      }

      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    }
  );
}
