import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ensureUE, uePost } from "../ue-bridge.js";
import { toMcp, wrapRaw, autoRefs, fail } from "../types.js";

export function registerLevelActorTools(server: McpServer): void {
  server.tool(
    "attach_actor",
    "Attach a child actor to a parent actor in the current level. Requires editor mode.",
    {
      childActor: z.string().describe("Label of the child actor to attach"),
      parentActor: z.string().describe("Label of the parent actor to attach to"),
      socketName: z.string().optional().describe("Optional socket name on the parent"),
      attachmentRule: z.enum(["KeepWorld", "KeepRelative", "SnapToTarget"]).optional()
        .describe("How to handle the child's transform on attach (default: KeepWorld)"),
    },
    async ({ childActor, parentActor, socketName, attachmentRule }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));
      const body: Record<string, any> = { childActor, parentActor };
      if (socketName) body.socketName = socketName;
      if (attachmentRule) body.attachmentRule = attachmentRule;
      try {
        const data = await uePost("/api/attach-actor", body);
        return toMcp(wrapRaw(data, {
          refs: autoRefs(data),
          nextSteps: [
            "use list_actors to verify the attachment hierarchy",
            "use detach_actor to undo the attachment",
          ],
        }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  server.tool(
    "detach_actor",
    "Detach an actor from its parent in the current level. Requires editor mode.",
    {
      actorLabel: z.string().describe("Label of the actor to detach"),
      detachmentRule: z.enum(["KeepWorld", "KeepRelative"]).optional()
        .describe("How to handle transform on detach (default: KeepWorld)"),
    },
    async ({ actorLabel, detachmentRule }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));
      const body: Record<string, any> = { actorLabel };
      if (detachmentRule) body.detachmentRule = detachmentRule;
      try {
        const data = await uePost("/api/detach-actor", body);
        return toMcp(wrapRaw(data, {
          refs: autoRefs(data),
          nextSteps: [
            "use list_actors to verify",
            "use set_actor_transform to reposition if needed",
          ],
        }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  server.tool(
    "duplicate_actor",
    "Duplicate an actor in the current level. Requires editor mode.",
    {
      actorLabel: z.string().describe("Label of the actor to duplicate"),
      newLabel: z.string().optional().describe("Optional label for the new actor"),
      offset: z.object({
        x: z.number().optional(),
        y: z.number().optional(),
        z: z.number().optional(),
      }).optional().describe("Optional position offset from the source actor"),
    },
    async ({ actorLabel, newLabel, offset }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));
      const body: Record<string, any> = { actorLabel };
      if (newLabel) body.newLabel = newLabel;
      if (offset) body.offset = offset;
      try {
        const data = await uePost("/api/duplicate-actor", body);
        return toMcp(wrapRaw(data, {
          refs: autoRefs(data),
          nextSteps: [
            "use set_actor_transform to reposition the duplicate",
            "use rename_actor to give it a meaningful name",
          ],
        }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  server.tool(
    "rename_actor",
    "Rename an actor's label in the current level (World Outliner name). Requires editor mode.",
    {
      actorLabel: z.string().describe("Current label of the actor"),
      newLabel: z.string().describe("New label for the actor"),
    },
    async ({ actorLabel, newLabel }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));
      try {
        const data = await uePost("/api/rename-actor", { actorLabel, newLabel });
        return toMcp(wrapRaw(data, {
          refs: autoRefs(data),
          nextSteps: ["use list_actors to verify"],
        }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );
}
