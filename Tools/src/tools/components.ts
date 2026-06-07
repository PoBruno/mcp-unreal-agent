import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ensureUE, uePost } from "../ue-bridge.js";
import { toMcp, wrapRaw, autoRefs, fail } from "../types.js";

export function registerComponentTools(server: McpServer): void {
  server.tool(
    "list_components",
    "List all components in a Blueprint's component hierarchy (Simple Construction Script). Shows component class, name, and parent-child relationships. Only works on Actor-based Blueprints.",
    {
      blueprint: z.string().describe("Blueprint name or package path (e.g. 'BP_Patient_Base')"),
    },
    async ({ blueprint }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      try {
        const data = await uePost("/api/list-components", { blueprint });
        return toMcp(wrapRaw(data, { refs: autoRefs(data) }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  server.tool(
    "add_component",
    "Add a component to a Blueprint's component hierarchy (Simple Construction Script). Only works on Actor-based Blueprints. Common component classes: StaticMeshComponent, SkeletalMeshComponent, AudioComponent, SceneComponent, BoxCollisionComponent, SphereCollisionComponent, CapsuleComponent, ArrowComponent, ChildActorComponent, SpotLightComponent, PointLightComponent, WidgetComponent, BillboardComponent.",
    {
      blueprint: z.string().describe("Blueprint name or package path"),
      componentClass: z.string().describe("Component class name (e.g. 'StaticMeshComponent', 'AudioComponent')"),
      name: z.string().describe("Name for the new component (e.g. 'MyMesh')"),
      parentComponent: z.string().optional().describe("Name of the parent component to attach to (optional, defaults to root set)"),
    },
    async ({ blueprint, componentClass, name, parentComponent }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      const body: Record<string, any> = { blueprint, componentClass, name };
      if (parentComponent) body.parentComponent = parentComponent;

      try {
        const data = await uePost("/api/add-component", body);
        return toMcp(wrapRaw(data, {
          refs: autoRefs(data),
          nextSteps: [
            `list_components(blueprint="${blueprint}") to verify the component hierarchy`,
            `set_blueprint_default(blueprint="${blueprint}", ...) to configure component properties`,
          ],
        }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  server.tool(
    "remove_component",
    "Remove a component from a Blueprint's component hierarchy (Simple Construction Script). Cannot remove a root component that has children — remove or re-parent children first. Children of non-root removed components are promoted to the removed component's parent.",
    {
      blueprint: z.string().describe("Blueprint name or package path"),
      name: z.string().describe("Name of the component to remove"),
    },
    async ({ blueprint, name }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      try {
        const data = await uePost("/api/remove-component", { blueprint, name });
        return toMcp(wrapRaw(data, {
          refs: autoRefs(data),
          nextSteps: [`list_components(blueprint="${blueprint}") to verify the component was removed`],
        }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );
}
