import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ensureUE, uePost } from "../ue-bridge.js";
import { toMcp, wrapRaw, autoRefs, fail } from "../types.js";

export function registerActorStateTools(server: McpServer): void {
  server.tool(
    "set_actor_mobility",
    "Set an actor's mobility type (Static, Stationary, or Movable). This affects whether the actor can move at runtime and what lighting features are available. Requires editor mode.",
    {
      actorLabel: z.string().describe("Label of the actor in the World Outliner"),
      mobility: z.enum(["Static", "Stationary", "Movable"])
        .describe("Mobility type: Static (best perf, no movement), Stationary (some movement), Movable (full movement)"),
    },
    async ({ actorLabel, mobility }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));
      try {
        const data = await uePost("/api/set-actor-mobility", { actorLabel, mobility });
        return toMcp(wrapRaw(data, {
          refs: autoRefs(data),
          nextSteps: [
            "use list_actors to verify the change",
            "static actors cannot move at runtime — use Movable if the actor needs to move",
          ],
        }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  server.tool(
    "set_actor_visibility",
    "Show or hide an actor in the level. Sets both editor visibility and in-game visibility. Optionally propagates to attached child actors. Requires editor mode.",
    {
      actorLabel: z.string().describe("Label of the actor in the World Outliner"),
      visible: z.boolean().describe("true to show the actor, false to hide it"),
      propagateToChildren: z.boolean().optional()
        .describe("Whether to also show/hide attached child actors (default: true)"),
    },
    async ({ actorLabel, visible, propagateToChildren }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      const body: Record<string, any> = { actorLabel, visible };
      if (propagateToChildren !== undefined) body.propagateToChildren = propagateToChildren;

      try {
        const data = await uePost("/api/set-actor-visibility", body);
        return toMcp(wrapRaw(data, {
          refs: autoRefs(data),
          nextSteps: [
            "use list_actors to see all actors and their visibility state",
            "use set_actor_visibility again to toggle back",
          ],
        }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  server.tool(
    "set_actor_physics",
    "Enable or disable physics simulation on an actor's primitive component. Automatically sets mobility to Movable when enabling physics. Requires editor mode.",
    {
      actorLabel: z.string().describe("Label of the actor in the World Outliner"),
      simulatePhysics: z.boolean().describe("true to enable physics simulation, false to disable"),
      enableGravity: z.boolean().optional()
        .describe("Whether gravity affects this actor (default: true)"),
    },
    async ({ actorLabel, simulatePhysics, enableGravity }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      const body: Record<string, any> = { actorLabel, simulatePhysics };
      if (enableGravity !== undefined) body.enableGravity = enableGravity;

      try {
        const data = await uePost("/api/set-actor-physics", body);
        return toMcp(wrapRaw(data, {
          refs: autoRefs(data),
          nextSteps: [
            "use set_actor_mobility to change mobility if needed",
            "physics requires a collision-enabled primitive component (StaticMesh, etc.)",
          ],
        }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );
}
