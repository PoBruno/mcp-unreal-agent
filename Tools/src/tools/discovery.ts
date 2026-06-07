import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ensureUE, uePost } from "../ue-bridge.js";
import { toMcp, wrapRaw, autoRefs, fail } from "../types.js";

export function registerDiscoveryTools(server: McpServer): void {
  server.tool(
    "get_pin_info",
    "Get detailed information about a specific pin on a Blueprint node, including type details, container type (array/set/map), default value, and current connections.",
    {
      blueprint: z.string().describe("Blueprint name or package path"),
      nodeId: z.string().describe("Node GUID"),
      pinName: z.string().describe("Pin name"),
    },
    async ({ blueprint, nodeId, pinName }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      try {
        const data = await uePost("/api/get-pin-info", { blueprint, nodeId, pinName });
        return toMcp(wrapRaw(data, { refs: autoRefs(data) }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  server.tool(
    "check_pin_compatibility",
    "Check whether two pins can be connected before attempting connect_pins. Returns compatibility status, connection type (direct, requires conversion, etc.), and any UE5 schema messages.",
    {
      blueprint: z.string().describe("Blueprint name or package path"),
      sourceNodeId: z.string().describe("Source node GUID"),
      sourcePinName: z.string().describe("Source pin name"),
      targetNodeId: z.string().describe("Target node GUID"),
      targetPinName: z.string().describe("Target pin name"),
    },
    async ({ blueprint, sourceNodeId, sourcePinName, targetNodeId, targetPinName }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      try {
        const data = await uePost("/api/check-pin-compatibility", {
          blueprint, sourceNodeId, sourcePinName, targetNodeId, targetPinName,
        });
        return toMcp(wrapRaw(data, { refs: autoRefs(data) }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  server.tool(
    "list_classes",
    "List available UE5 classes. Filter by name substring and/or parent class. Useful for discovering class names to use with add_node(CallFunction), add_node(DynamicCast), add_node(SpawnActorFromClass), etc.",
    {
      filter: z.string().optional().describe("Substring to match against class name (case-insensitive)"),
      parentClass: z.string().optional().describe("Only show classes that inherit from this class (e.g. 'Actor', 'ActorComponent')"),
      limit: z.number().optional().default(100).describe("Maximum number of results (default: 100, max: 500)"),
    },
    async ({ filter, parentClass, limit }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      const body: Record<string, any> = {};
      if (filter) body.filter = filter;
      if (parentClass) body.parentClass = parentClass;
      if (limit !== undefined) body.limit = limit;

      try {
        const data = await uePost("/api/list-classes", body);
        return toMcp(wrapRaw(data, { refs: autoRefs(data) }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  server.tool(
    "list_functions",
    "List Blueprint-callable functions on a UE5 class, including parameter signatures and return types. Use this to discover function names for add_node(CallFunction, functionName=...).",
    {
      className: z.string().describe("Class name (e.g. 'KismetSystemLibrary', 'KismetMathLibrary', 'Actor')"),
      filter: z.string().optional().describe("Substring to match against function name (case-insensitive)"),
    },
    async ({ className, filter }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      const body: Record<string, any> = { className };
      if (filter) body.filter = filter;

      try {
        const data = await uePost("/api/list-functions", body);
        return toMcp(wrapRaw(data, { refs: autoRefs(data) }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  server.tool(
    "list_properties",
    "List properties on a UE5 class, including types and property flags (BlueprintVisible, EditAnywhere, etc.).",
    {
      className: z.string().describe("Class name (e.g. 'Actor', 'CharacterMovementComponent')"),
      filter: z.string().optional().describe("Substring to match against property name (case-insensitive)"),
    },
    async ({ className, filter }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      const body: Record<string, any> = { className };
      if (filter) body.filter = filter;

      try {
        const data = await uePost("/api/list-properties", body);
        return toMcp(wrapRaw(data, { refs: autoRefs(data) }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );
}
