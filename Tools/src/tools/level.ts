import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ensureUE, ueGet, uePost } from "../ue-bridge.js";
import { toMcp, wrapRaw, autoRefs, fail } from "../types.js";

export function registerLevelTools(server: McpServer): void {
  server.tool(
    "get_selected_actors",
    "Returns all actors currently selected in the Unreal Editor viewport, including their label, class, folder, location, rotation, and scale. Use this to operate on whatever the user has selected without needing to know actor labels in advance.",
    {},
    async () => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));
      try {
        const data = await ueGet("/api/selected-actors", {});
        return toMcp(wrapRaw(data, {
          refs: autoRefs(data),
          nextSteps: ["call get_actor_properties for a selected actor to inspect properties"],
        }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  server.tool(
    "get_current_level",
    "Get information about the currently open level in the Unreal Editor, including its name, package path, and actor count.",
    {},
    async () => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));
      try {
        const data = await ueGet("/api/current-level", {});
        return toMcp(wrapRaw(data, { refs: autoRefs(data) }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  server.tool(
    "list_actors",
    "List actors placed in the currently open level. Supports optional filtering by class name, actor label, or outliner folder. Returns label, class, folder, and location for each actor.",
    {
      classFilter: z.string().optional().describe("Substring filter on class name (e.g. 'StaticMesh', 'Light', 'Camera')"),
      nameFilter:  z.string().optional().describe("Substring filter on actor label (display name in world outliner)"),
      folder:      z.string().optional().describe("Outliner folder prefix to filter by (e.g. 'Lights', 'Environment/Props')"),
    },
    async ({ classFilter, nameFilter, folder }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      const params: Record<string, string> = {};
      if (classFilter) params.classFilter = classFilter;
      if (nameFilter)  params.nameFilter  = nameFilter;
      if (folder)      params.folder      = folder;

      try {
        const data = await ueGet("/api/list-actors", params);
        return toMcp(wrapRaw(data, { refs: autoRefs(data) }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  server.tool(
    "get_actor_properties",
    "Get all editable (CPF_Edit) properties of a placed actor in the current level, identified by its display label. Returns property name, C++ type, current value, and whether the value is at its class default. Complex struct properties are automatically expanded into individual sub-fields so no values are silently omitted. Pass 'component' to inspect a specific component's properties (e.g. 'StaticMeshComponent0'). Without 'component', also returns a 'components' list for discovery.",
    {
      label:     z.string().describe("Actor display label as shown in the world outliner (case-insensitive)"),
      component: z.string().optional().describe("Component name to inspect (e.g. 'StaticMeshComponent0'). Omit to list actor-level properties and discover available components."),
    },
    async ({ label, component }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      const params: Record<string, string> = { label };
      if (component) params.component = component;

      try {
        const data = await ueGet("/api/actor-properties", params);
        return toMcp(wrapRaw(data, {
          refs: autoRefs(data),
          nextSteps: [`set_actor_property(label="${label}", property="...", value="...") to change a property`],
        }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  server.tool(
    "set_actor_transform",
    "Move, rotate, and/or scale a placed actor in the current level. All fields are optional — only provided fields are applied. Location/scale are in centimeters; rotation is in degrees (pitch/yaw/roll).",
    {
      label:    z.string().describe("Actor display label (case-insensitive)"),
      location: z.object({
        x: z.number().optional(),
        y: z.number().optional(),
        z: z.number().optional(),
      }).optional().describe("New world location in cm (partial updates supported)"),
      rotation: z.object({
        pitch: z.number().optional(),
        yaw:   z.number().optional(),
        roll:  z.number().optional(),
      }).optional().describe("New world rotation in degrees (partial updates supported)"),
      scale: z.object({
        x: z.number().optional(),
        y: z.number().optional(),
        z: z.number().optional(),
      }).optional().describe("New world scale (partial updates supported)"),
    },
    async ({ label, location, rotation, scale }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      const body: Record<string, any> = { label };
      if (location) body.location = location;
      if (rotation) body.rotation = rotation;
      if (scale)    body.scale    = scale;

      try {
        const data = await uePost("/api/set-actor-transform", body);
        return toMcp(wrapRaw(data, {
          refs: autoRefs(data),
          nextSteps: [
            `list_actors(nameFilter="${label}") — verify the new position`,
            `get_actor_properties(label="${label}") — inspect other properties`,
          ],
        }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  server.tool(
    "set_actor_property",
    "Set a named property on a placed actor using UE5 reflection. Supports actor-level properties ('bHidden', 'Mobility') and component sub-properties using dot notation ('StaticMeshComponent0.StaticMesh'). Values use UE import-text format (e.g. '1.0', 'true', '/Engine/BasicShapes/Cube.Cube').",
    {
      label:    z.string().describe("Actor display label (case-insensitive)"),
      property: z.string().describe("C++ property name on the actor ('bHidden') or component sub-property ('StaticMeshComponent0.StaticMesh')"),
      value:    z.string().describe("Value in UE text-import format (e.g. '1.0', 'true', '/Engine/BasicShapes/Cube.Cube', '(R=1,G=0,B=0,A=1)')"),
    },
    async ({ label, property, value }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      try {
        const data = await uePost("/api/set-actor-property", { label, property, value });
        return toMcp(wrapRaw(data, {
          refs: autoRefs(data),
          nextSteps: [`get_actor_properties(label="${label}") — verify all properties`],
        }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  server.tool(
    "spawn_actor",
    "Spawn a new actor in the currently open level. The class can be a C++ class name (e.g. 'StaticMeshActor', 'PointLight', 'DirectionalLight') or a Blueprint class name (e.g. 'BP_MyActor'). Location defaults to world origin if not specified.",
    {
      class:    z.string().describe("Actor class name — C++ (e.g. 'StaticMeshActor') or Blueprint (e.g. 'BP_MyActor')"),
      label:    z.string().optional().describe("Display label for the new actor in the world outliner"),
      location: z.object({
        x: z.number().optional().default(0),
        y: z.number().optional().default(0),
        z: z.number().optional().default(0),
      }).optional().describe("Spawn location in world space (cm)"),
      rotation: z.object({
        pitch: z.number().optional().default(0),
        yaw:   z.number().optional().default(0),
        roll:  z.number().optional().default(0),
      }).optional().describe("Spawn rotation in degrees"),
      folder: z.string().optional().describe("Outliner folder path to place the actor in (e.g. 'Enemies/Ground')"),
    },
    async ({ class: actorClass, label, location, rotation, folder }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      const body: Record<string, any> = { class: actorClass };
      if (label)    body.label    = label;
      if (location) body.location = location;
      if (rotation) body.rotation = rotation;
      if (folder)   body.folder   = folder;

      try {
        const data = await uePost("/api/spawn-actor", body);
        return toMcp(wrapRaw(data, {
          refs: autoRefs(data),
          nextSteps: [
            "set_actor_property(...) — configure the actor",
            "set_actor_transform(...) — reposition the actor",
            "delete_actor(...) — remove it if no longer needed",
          ],
        }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  server.tool(
    "delete_actor",
    "Delete a placed actor from the current level by its display label. This operation is undoable (Ctrl+Z in the editor). The actor must exist in the level.",
    {
      label: z.string().describe("Actor display label to delete (case-insensitive)"),
    },
    async ({ label }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      try {
        const data = await uePost("/api/delete-actor", { label });
        return toMcp(wrapRaw(data, {
          refs: autoRefs(data),
          nextSteps: ["list_actors() — verify the actor was removed"],
        }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );
}
