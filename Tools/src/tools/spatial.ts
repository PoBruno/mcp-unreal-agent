import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ensureUE, uePost } from "../ue-bridge.js";
import { toMcp, wrapRaw, autoRefs, fail } from "../types.js";

const Vec3Schema = z.object({
  x: z.number().describe("X coordinate"),
  y: z.number().describe("Y coordinate"),
  z: z.number().describe("Z coordinate"),
});

export function registerSpatialTools(server: McpServer): void {
  server.tool(
    "raycast",
    "Perform a line trace (raycast) from point A to point B in the editor world. Returns hit information including the actor, component, impact point, and surface normal. Supports single and multi-hit modes. Requires editor mode.",
    {
      start: Vec3Schema.describe("Start point of the ray (world coordinates)"),
      end: Vec3Schema.describe("End point of the ray (world coordinates)"),
      channel: z.enum(["Visibility", "Camera", "WorldStatic", "WorldDynamic", "Pawn", "PhysicsBody"]).optional()
        .describe("Collision channel to trace against (default: Visibility)"),
      traceComplex: z.boolean().optional()
        .describe("Whether to trace against complex collision geometry (default: false)"),
      multi: z.boolean().optional()
        .describe("Whether to return all hits along the ray, not just the first (default: false)"),
    },
    async ({ start, end, channel, traceComplex, multi }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      const body: Record<string, any> = { start, end };
      if (channel) body.channel = channel;
      if (traceComplex !== undefined) body.traceComplex = traceComplex;
      if (multi !== undefined) body.multi = multi;

      try {
        const data = await uePost("/api/raycast", body);
        return toMcp(wrapRaw(data, {
          refs: autoRefs(data),
          nextSteps: [
            "use the impact point coordinates for spawning actors or setting transforms",
            "use multi mode to find all actors along a path",
          ],
        }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );
}
