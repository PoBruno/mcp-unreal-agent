import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ensureUE, uePost } from "../ue-bridge.js";
import { toMcp, wrapRaw, autoRefs, fail } from "../types.js";

export function registerActorQueryTools(server: McpServer): void {
  server.tool(
    "find_actors_by_tag",
    "Find all actors in the current level that have a specific tag. Requires editor mode.",
    { tag: z.string().describe("Tag to search for") },
    async ({ tag }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));
      try {
        const data = await uePost("/api/find-actors-by-tag", { tag });
        return toMcp(wrapRaw(data, { refs: autoRefs(data) }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  server.tool(
    "find_actors_by_class",
    "Find all actors of a specific class in the current level. Requires editor mode.",
    { className: z.string().describe("Class name to filter by (e.g. 'StaticMeshActor', 'PointLight')") },
    async ({ className }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));
      try {
        const data = await uePost("/api/find-actors-by-class", { className });
        return toMcp(wrapRaw(data, { refs: autoRefs(data) }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  server.tool(
    "find_actors_in_radius",
    "Find all actors within a radius of a point in the current level. Requires editor mode.",
    {
      origin: z.object({
        x: z.number().describe("X coordinate of center point"),
        y: z.number().describe("Y coordinate of center point"),
        z: z.number().describe("Z coordinate of center point"),
      }).describe("Center point for the search"),
      radius: z.number().positive().describe("Search radius in Unreal units"),
    },
    async ({ origin, radius }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));
      try {
        const data = await uePost("/api/find-actors-in-radius", { origin, radius });
        return toMcp(wrapRaw(data, { refs: autoRefs(data) }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  server.tool(
    "get_actor_bounds",
    "Get the bounding box of an actor (origin + extent). Requires editor mode.",
    { actorLabel: z.string().describe("Label of the actor") },
    async ({ actorLabel }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));
      try {
        const data = await uePost("/api/get-actor-bounds", { actorLabel });
        return toMcp(wrapRaw(data, { refs: autoRefs(data) }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  server.tool(
    "set_actor_tags",
    "Set tags on an actor (replaces existing tags). Requires editor mode.",
    {
      actorLabel: z.string().describe("Label of the actor"),
      tags: z.array(z.string()).describe("Array of tag strings to set"),
    },
    async ({ actorLabel, tags }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));
      try {
        const data = await uePost("/api/set-actor-tags", { actorLabel, tags });
        return toMcp(wrapRaw(data, {
          refs: autoRefs(data),
          nextSteps: ["use find_actors_by_tag to verify"],
        }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );
}
