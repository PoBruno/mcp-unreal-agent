import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ensureUE, uePost } from "../ue-bridge.js";
import { toMcp, wrapRaw, autoRefs, fail } from "../types.js";

export function registerUndoRedoTools(server: McpServer): void {
  server.tool(
    "undo",
    "Undo the last editor action. Returns the description of the undone action and remaining undo/redo counts. Requires editor mode.",
    {},
    async () => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      try {
        const data = await uePost("/api/undo", {});
        return toMcp(wrapRaw(data, {
          refs: autoRefs(data),
          nextSteps: [
            "use redo to re-apply the undone action",
            "use undo again to undo further",
          ],
        }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  server.tool(
    "redo",
    "Redo the last undone editor action. Returns the description of the redone action and remaining undo/redo counts. Requires editor mode.",
    {},
    async () => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      try {
        const data = await uePost("/api/redo", {});
        return toMcp(wrapRaw(data, {
          refs: autoRefs(data),
          nextSteps: [
            "use undo to undo the redone action",
            "use redo again to redo further",
          ],
        }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  server.tool(
    "begin_transaction",
    "Begin a named undo transaction. All modifications between begin_transaction and end_transaction will be grouped as a single undoable action. Requires editor mode.",
    {
      description: z.string().describe("Human-readable description of the transaction (shown in Edit > Undo)"),
    },
    async ({ description }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      try {
        const data = await uePost("/api/begin-transaction", { description });
        return toMcp(wrapRaw(data, {
          refs: autoRefs(data),
          nextSteps: [
            "make your modifications (set_actor_transform, set_actor_property, etc.)",
            "call end_transaction to close the transaction",
            "the entire group can then be undone with a single undo call",
          ],
        }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  server.tool(
    "end_transaction",
    "End the current undo transaction. All modifications since the matching begin_transaction will be grouped as a single undoable action. Requires editor mode.",
    {},
    async () => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      try {
        const data = await uePost("/api/end-transaction", {});
        return toMcp(wrapRaw(data, {
          refs: autoRefs(data),
          nextSteps: [
            "use undo to undo the entire transaction as one action",
          ],
        }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );
}
