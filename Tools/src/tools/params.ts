import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ensureUE, uePost } from "../ue-bridge.js";
import { TYPE_NAME_DOCS } from "../helpers.js";
import { toMcp, wrapRaw, autoRefs, fail } from "../types.js";

export function registerParamTools(server: McpServer): void {
  server.tool(
    "change_function_parameter_type",
    `Change a function or custom event parameter's type. Supports all types: primitives (bool, int, float, string), structs, enums, and object references. Works with both Blueprint functions (K2Node_FunctionEntry) and custom events (K2Node_CustomEvent). Reconstructs the node to update output pins. Call refresh_all_nodes afterwards to propagate changes to downstream Break nodes. ${TYPE_NAME_DOCS} Pass dryRun=true to preview changes without saving.`,
    {
      blueprint: z.string().describe("Blueprint name or package path (e.g. 'BP_PatientManager')"),
      functionName: z.string().describe("Function or custom event name (e.g. 'UpdateVitals', 'SetSkinState')"),
      paramName: z.string().describe("Parameter name to change (e.g. 'Vitals', 'SkinState')"),
      newType: z.string().describe("New type: primitive ('bool', 'float'), struct ('FVitals'), enum ('EMyEnum'), or reference ('object:Actor', 'class:Actor', 'softobject:Actor')"),
      dryRun: z.boolean().optional().describe("If true, preview changes without modifying the Blueprint"),
      batch: z.array(z.object({
        blueprint: z.string(),
        functionName: z.string(),
        paramName: z.string(),
        newType: z.string(),
      })).optional().describe("Batch mode: array of {blueprint, functionName, paramName, newType} objects. When provided, single params are ignored."),
    },
    async ({ blueprint, functionName, paramName, newType, dryRun, batch }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      const body: Record<string, any> = batch
        ? { batch }
        : { blueprint, functionName, paramName, newType };
      if (dryRun) body.dryRun = true;

      try {
        const data = await uePost("/api/change-function-param-type", body);
        return toMcp(wrapRaw(data, {
          refs: autoRefs(data),
          nextSteps: dryRun ? undefined : [
            "check delegate graphs that bind to this function/event",
            "run refresh_all_nodes to propagate pin changes downstream",
          ],
        }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  server.tool(
    "remove_function_parameter",
    "Remove a parameter from a Blueprint function, custom event, or event dispatcher delegate. Works by finding the FunctionEntry/CustomEvent node in the function/delegate signature graph and removing the UserDefinedPin. Reconstructs the node and saves. Use this to remove delegate parameters that reference deleted types.",
    {
      blueprint: z.string().describe("Blueprint name or package path (e.g. 'BPC_DeviceController')"),
      functionName: z.string().describe("Function, custom event, or event dispatcher name (e.g. 'OnDeviceStateChanged')"),
      paramName: z.string().describe("Parameter name to remove (e.g. 'DeviceState')"),
    },
    async ({ blueprint, functionName, paramName }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      try {
        const data = await uePost("/api/remove-function-parameter", {
          blueprint, functionName, paramName,
        });
        return toMcp(wrapRaw(data, { refs: autoRefs(data) }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  server.tool(
    "add_function_parameter",
    `Add a typed parameter to an existing function, custom event, or event dispatcher signature. Works with all three — specify the function/event/dispatcher name in functionName. ${TYPE_NAME_DOCS}`,
    {
      blueprint: z.string().describe("Blueprint name or package path"),
      functionName: z.string().describe("Name of the function, custom event, or event dispatcher to add the parameter to"),
      paramName: z.string().describe("Name for the new parameter"),
      paramType: z.string().describe("Type for the new parameter (e.g. 'float', 'bool', 'string', 'FVector', 'object')"),
    },
    async ({ blueprint, functionName, paramName, paramType }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      try {
        const data = await uePost("/api/add-function-parameter", {
          blueprint, functionName, paramName, paramType,
        });
        return toMcp(wrapRaw(data, {
          refs: autoRefs(data),
          nextSteps: [
            "get_blueprint_graph to inspect the updated signature",
            "add_function_parameter to add another parameter",
          ],
        }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );
}
