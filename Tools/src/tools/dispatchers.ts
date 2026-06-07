import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ensureUE, uePost } from "../ue-bridge.js";
import { TYPE_NAME_DOCS } from "../helpers.js";
import { toMcp, wrapRaw, autoRefs, fail } from "../types.js";

export function registerDispatcherTools(server: McpServer): void {
  server.tool(
    "add_event_dispatcher",
    `Create an event dispatcher (multicast delegate) on a Blueprint. Optionally include typed parameters in the dispatcher signature. ${TYPE_NAME_DOCS}`,
    {
      blueprint: z.string().describe("Blueprint name or package path"),
      dispatcherName: z.string().describe("Name for the event dispatcher (e.g. 'OnHealthChanged')"),
      parameters: z.array(z.object({
        name: z.string().describe("Parameter name"),
        type: z.string().describe("Parameter type (e.g. 'float', 'bool', 'string', 'FVector', 'object')"),
      })).optional().describe("Optional array of typed parameters for the dispatcher signature"),
    },
    async ({ blueprint, dispatcherName, parameters }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      const body: Record<string, any> = { blueprint, dispatcherName };
      if (parameters?.length) body.parameters = parameters;

      try {
        const data = await uePost("/api/add-event-dispatcher", body);
        return toMcp(wrapRaw(data, {
          refs: autoRefs(data),
          nextSteps: [
            `list_event_dispatchers(blueprint="${blueprint}") to verify the dispatcher was created`,
            `add_function_parameter(blueprint="${blueprint}", functionName="${dispatcherName}", ...) to add more parameters`,
            `add_node(blueprint="${blueprint}", graph="EventGraph", nodeType="CallFunction", functionName="<dispatcherName>_Event") to bind to it`,
          ],
        }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  server.tool(
    "list_event_dispatchers",
    "List all event dispatchers (multicast delegates) on a Blueprint, including their parameter signatures.",
    {
      blueprint: z.string().describe("Blueprint name or package path"),
    },
    async ({ blueprint }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      try {
        const data = await uePost("/api/list-event-dispatchers", { blueprint });
        return toMcp(wrapRaw(data, { refs: autoRefs(data) }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );
}
