import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ensureUE, uePost } from "../ue-bridge.js";
import { ok, fail, toMcp, wrapRaw, autoRefs } from "../types.js";

export function registerCapabilityTools(server: McpServer): void {
  server.tool(
    "list_assets",
    "List ANY asset in the project (skeletons, skeletal/static meshes, textures, anim sequences, data assets, …) via the Asset Registry — not just Blueprints/Materials. Filter by class-name substring and/or path substring. Returns name/path/class for each.",
    {
      classFilter: z.string().optional().describe("Substring of the asset class name (e.g. 'SkeletalMesh', 'AnimSequence', 'Texture2D', 'Skeleton', 'BlendSpace')"),
      pathFilter: z.string().optional().describe("Substring of the asset path (e.g. '/Game/Characters')"),
      limit: z.number().optional().describe("Max results (default 200, max 1000)"),
    },
    async ({ classFilter, pathFilter, limit }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));
      const body: Record<string, any> = {};
      if (classFilter) body.classFilter = classFilter;
      if (pathFilter) body.pathFilter = pathFilter;
      if (limit !== undefined) body.limit = limit;
      try {
        const data = await uePost("/api/list-assets", body);
        return toMcp(wrapRaw(data, { refs: autoRefs(data), nextSteps: ["pass an asset path to inspect, open_asset_editor, or a domain tool"] }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    },
  );

  server.tool(
    "set_component_default",
    "Set a default property on a Blueprint component that was added via add_component (Simple Construction Script). E.g. set 'StaticMesh' on an added StaticMeshComponent or 'Intensity' on a PointLightComponent. (Inherited components like the Character Mesh need python_exec.)",
    {
      blueprint: z.string().describe("Blueprint name or path"),
      componentName: z.string().describe("Component name as added (e.g. 'DemoMesh')"),
      property: z.string().describe("Property name on the component (e.g. 'StaticMesh', 'Intensity', 'AttenuationRadius')"),
      value: z.string().describe("Value — asset path for object/asset props (e.g. '/Game/.../SM_Cube'), or literal for simple types"),
    },
    async ({ blueprint, componentName, property, value }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));
      try {
        const data = await uePost("/api/set-component-default", { blueprint, componentName, property, value });
        return toMcp(wrapRaw(data, { refs: autoRefs(data) }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    },
  );

  server.tool(
    "connect_anim_entry",
    "Connect a state machine's ENTRY to a state, making it the initial/default state so the machine actually outputs a pose. Use after add_anim_state — the entry isn't auto-connected, so an otherwise-complete state machine produces nothing without this.",
    {
      blueprint: z.string().describe("Animation Blueprint name or path"),
      graph: z.string().describe("State machine graph name (e.g. 'Locomotion')"),
      stateName: z.string().describe("State to make the entry/initial state (e.g. 'Idle')"),
    },
    async ({ blueprint, graph, stateName }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));
      try {
        const data = await uePost("/api/connect-anim-entry", { blueprint, graph, stateName });
        return toMcp(wrapRaw(data, { refs: autoRefs(data) }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    },
  );

  server.tool(
    "get_class_api",
    "Get a class's Blueprint-callable API in ONE call: functions (signatures) + properties (types/flags). Use before authoring nodes so you know exact names. Composes list_functions + list_properties.",
    {
      className: z.string().describe("Class name (e.g. 'KismetSystemLibrary', 'Actor', 'CharacterMovementComponent')"),
      filter: z.string().optional().describe("Optional substring to match function/property names"),
    },
    async ({ className, filter }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));
      try {
        const fnBody: Record<string, any> = { className };
        const propBody: Record<string, any> = { className };
        if (filter) { fnBody.filter = filter; propBody.filter = filter; }
        const [fns, props] = await Promise.all([
          uePost("/api/list-functions", fnBody),
          uePost("/api/list-properties", propBody),
        ]);
        if (fns?.error) return toMcp(wrapRaw(fns));
        return toMcp(ok({
          className,
          functionCount: (fns?.functions ?? []).length,
          functions: fns?.functions ?? [],
          propertyCount: (props?.properties ?? []).length,
          properties: props?.properties ?? [],
        }, { nextSteps: ["use a function name with add_node(CallFunction)"] }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    },
  );
}
