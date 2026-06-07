import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ensureUE, uePost } from "../ue-bridge.js";

export function registerCameraTools(server: McpServer): void {
  server.tool(
    "get_viewport_camera",
    "Get the current viewport camera position, rotation, FOV, and speed. Requires editor mode.",
    {},
    async () => {
      const err = await ensureUE();
      if (err) return { content: [{ type: "text" as const, text: err }] };

      const data = await uePost("/api/get-viewport-camera", {});
      if (data.error) return { content: [{ type: "text" as const, text: `Error: ${data.error}` }] };

      const lines = [
        `Viewport Camera:`,
        `  Location: (${data.location.x.toFixed(1)}, ${data.location.y.toFixed(1)}, ${data.location.z.toFixed(1)})`,
        `  Rotation: pitch=${data.rotation.pitch.toFixed(1)}, yaw=${data.rotation.yaw.toFixed(1)}, roll=${data.rotation.roll.toFixed(1)}`,
        `  FOV: ${data.fov.toFixed(1)}`,
        `  Camera speed: ${data.cameraSpeed}`,
        `\nNext steps:`,
        `  1. Use set_viewport_camera to reposition the camera`,
        `  2. Use take_screenshot to capture this view`,
      ];

      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    }
  );

  server.tool(
    "set_viewport_camera",
    "Set the viewport camera position, rotation, and/or FOV. All parameters are optional \u2014 only provided values are changed. Requires editor mode.",
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
      if (err) return { content: [{ type: "text" as const, text: err }] };

      const body: Record<string, any> = {};
      if (location) body.location = location;
      if (rotation) body.rotation = { pitch: rotation.pitch, yaw: rotation.yaw, roll: rotation.roll ?? 0 };
      if (fov !== undefined) body.fov = fov;

      const data = await uePost("/api/set-viewport-camera", body);
      if (data.error) return { content: [{ type: "text" as const, text: `Error: ${data.error}` }] };

      const lines = [
        `Camera updated:`,
        `  Location: (${data.location.x.toFixed(1)}, ${data.location.y.toFixed(1)}, ${data.location.z.toFixed(1)})`,
        `  Rotation: pitch=${data.rotation.pitch.toFixed(1)}, yaw=${data.rotation.yaw.toFixed(1)}, roll=${data.rotation.roll.toFixed(1)}`,
        `  FOV: ${data.fov.toFixed(1)}`,
        `\nNext steps:`,
        `  1. Use get_viewport_camera to verify the position`,
        `  2. Use take_screenshot to capture this view`,
      ];

      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    }
  );
}
