import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ensureUE, uePost } from "../ue-bridge.js";
import { toMcp, wrapRaw, autoRefs, fail } from "../types.js";

export function registerCameraTools(server: McpServer): void {
  server.tool(
    "get_viewport_camera",
    "Get the current viewport camera position, rotation, FOV, and speed. Requires editor mode.",
    {},
    async () => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      try {
        const data = await uePost("/api/get-viewport-camera", {});
        return toMcp(wrapRaw(data, {
          refs: autoRefs(data),
          nextSteps: [
            "use set_viewport_camera to reposition the camera",
            "use take_screenshot to capture this view",
          ],
        }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  server.tool(
    "set_viewport_camera",
    "Set the viewport camera position, rotation, and/or FOV. All parameters are optional — only provided values are changed. Requires editor mode.",
    {
      location: z.object({
        x: z.number().describe("X coordinate"),
        y: z.number().describe("Y coordinate"),
        z: z.number().describe("Z coordinate"),
      }).optional().describe("Camera world position"),
      rotation: z.object({
        pitch: z.number().describe("Pitch in degrees (up/down)"),
        yaw: z.number().describe("Yaw in degrees (left/right)"),
        roll: z.number().optional().describe("Roll in degrees (default: 0)"),
      }).optional().describe("Camera rotation in degrees"),
      fov: z.number().optional().describe("Field of view in degrees (typical: 60-120)"),
    },
    async ({ location, rotation, fov }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      const body: Record<string, any> = {};
      if (location) body.location = location;
      if (rotation) body.rotation = { pitch: rotation.pitch, yaw: rotation.yaw, roll: rotation.roll ?? 0 };
      if (fov !== undefined) body.fov = fov;

      try {
        const data = await uePost("/api/set-viewport-camera", body);
        return toMcp(wrapRaw(data, {
          refs: autoRefs(data),
          nextSteps: [
            "use get_viewport_camera to verify the position",
            "use take_screenshot to capture this view",
          ],
        }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );
}
