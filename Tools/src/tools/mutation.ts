import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ensureUE, uePost } from "../ue-bridge.js";
import { TYPE_NAME_DOCS } from "../helpers.js";
import { toMcp, wrapRaw, autoRefs, fail } from "../types.js";

export function registerMutationTools(server: McpServer): void {
  server.tool(
    "replace_function_calls",
    "In a Blueprint, redirect all function call nodes from one function library class to another (matched by function name). Reports which pin connections were broken due to type changes. Use this for migrating Blueprints from one function library to another. Pass dryRun=true to preview changes without saving.",
    {
      blueprint: z.string().describe("Blueprint name or package path (e.g. 'BP_PatientJson')"),
      oldClass: z.string().describe("Current function library class name (e.g. 'FL_StateParsers')"),
      newClass: z.string().describe("New function library class name (e.g. 'StateParsersLibrary')"),
      dryRun: z.boolean().optional().describe("If true, preview changes without modifying the Blueprint"),
    },
    async ({ blueprint, oldClass, newClass, dryRun }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      const body: Record<string, any> = { blueprint, oldClass, newClass };
      if (dryRun) body.dryRun = true;

      try {
        const data = await uePost("/api/replace-function-calls", body);
        return toMcp(wrapRaw(data, {
          refs: autoRefs(data),
          nextSteps: dryRun ? undefined : [
            "verify with get_blueprint_graph to inspect the updated graphs",
            "run refresh_all_nodes to propagate pin type changes",
          ],
        }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  server.tool(
    "delete_asset",
    "Delete a .uasset file after confirming no remaining references. By default refuses to delete if the asset is still referenced. Use force=true to delete anyway (references become stale). Use find_asset_references first to check dependencies.",
    {
      assetPath: z.string().describe("Full asset path to delete (e.g. '/Game/Blueprints/WebUI/S_Vitals')"),
      force: z.boolean().optional().describe("If true, force-delete even if references exist. Stale references will remain and must be cleaned up manually."),
      batch: z.array(z.object({
        assetPath: z.string(),
        force: z.boolean().optional(),
      })).optional().describe("Batch mode: array of {assetPath, force?} objects. When provided, single params are ignored."),
    },
    async ({ assetPath, force, batch }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      const body: Record<string, any> = batch
        ? { batch }
        : { assetPath };
      if (force && !batch) body.force = true;

      try {
        const data = await uePost("/api/delete-asset", body);
        return toMcp(wrapRaw(data, {
          refs: autoRefs(data),
          nextSteps: ["verify no orphaned references remain with find_asset_references"],
        }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  server.tool(
    "connect_pins",
    "Wire two pins together in a Blueprint graph. Uses type-validated connection (TryCreateConnection) so incompatible types will fail with details. Get node IDs and pin names from get_blueprint_graph first.",
    {
      blueprint: z.string().optional().describe("Blueprint name or package path (e.g. 'BP_PatientJson'). Required in single mode; omit when using batch."),
      sourceNodeId: z.string().optional().describe("GUID of the source node (from get_blueprint_graph node 'id' field). Required in single mode."),
      sourcePinName: z.string().optional().describe("Name of the output pin on the source node. Required in single mode."),
      targetNodeId: z.string().optional().describe("GUID of the target node. Required in single mode."),
      targetPinName: z.string().optional().describe("Name of the input pin on the target node. Required in single mode."),
      batch: z.array(z.object({
        blueprint: z.string(),
        sourceNodeId: z.string(),
        sourcePinName: z.string(),
        targetNodeId: z.string(),
        targetPinName: z.string(),
      })).optional().describe("Batch mode: array of connection objects. When provided, single params are ignored."),
    },
    async ({ blueprint, sourceNodeId, sourcePinName, targetNodeId, targetPinName, batch }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      const body: Record<string, any> = batch
        ? { batch }
        : { blueprint, sourceNodeId, sourcePinName, targetNodeId, targetPinName };

      try {
        const data = await uePost("/api/connect-pins", body);
        return toMcp(wrapRaw(data, { refs: autoRefs(data) }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  server.tool(
    "disconnect_pin",
    "Break connections on a specific pin. By default breaks ALL connections on the pin. Optionally specify targetNodeId + targetPinName to break only a single specific link.",
    {
      blueprint: z.string().describe("Blueprint name or package path"),
      nodeId: z.string().describe("GUID of the node containing the pin"),
      pinName: z.string().describe("Name of the pin to disconnect"),
      targetNodeId: z.string().optional().describe("GUID of a specific connected node to disconnect from (optional)"),
      targetPinName: z.string().optional().describe("Pin name on the target node to disconnect from (optional, required if targetNodeId is set)"),
    },
    async ({ blueprint, nodeId, pinName, targetNodeId, targetPinName }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      const body: Record<string, any> = { blueprint, nodeId, pinName };
      if (targetNodeId) body.targetNodeId = targetNodeId;
      if (targetPinName) body.targetPinName = targetPinName;

      try {
        const data = await uePost("/api/disconnect-pin", body);
        return toMcp(wrapRaw(data, { refs: autoRefs(data) }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  server.tool(
    "change_struct_node_type",
    `Change a BreakStruct or MakeStruct node to use a different struct type. Reconstructs the node and attempts to reconnect pins by matching property names. Get node IDs from get_blueprint_graph first. ${TYPE_NAME_DOCS}`,
    {
      blueprint: z.string().describe("Blueprint name or package path (e.g. 'BP_PatientJson')"),
      nodeId: z.string().describe("GUID of the BreakStruct or MakeStruct node"),
      newType: z.string().describe("New struct type name with F prefix (e.g. 'FVitals', 'FSkinState')"),
    },
    async ({ blueprint, nodeId, newType }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      try {
        const data = await uePost("/api/change-struct-node-type", { blueprint, nodeId, newType });
        return toMcp(wrapRaw(data, {
          refs: autoRefs(data),
          nextSteps: ["run refresh_all_nodes to propagate type changes throughout the Blueprint"],
        }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  server.tool(
    "refresh_all_nodes",
    "Refresh all nodes in a Blueprint to update pin types and connections after modifications (e.g. after replace_function_calls or change_variable_type). Recompiles and saves the Blueprint.",
    {
      blueprint: z.string().describe("Blueprint name or package path (e.g. 'BP_PatientManager')"),
    },
    async ({ blueprint }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      try {
        const data = await uePost("/api/refresh-all-nodes", { blueprint });
        return toMcp(wrapRaw(data, { refs: autoRefs(data) }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  server.tool(
    "delete_node",
    "Remove a node from a Blueprint graph. Disconnects all pins and removes the node. Use get_blueprint_graph to find node IDs first. Entry/root nodes (FunctionEntry, Event, CustomEvent) cannot be deleted as this would leave the graph uncompilable.",
    {
      blueprint: z.string().describe("Blueprint name or package path"),
      nodeId: z.string().describe("GUID of the node to delete (from get_blueprint_graph node 'id' field)"),
    },
    async ({ blueprint, nodeId }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      try {
        const data = await uePost("/api/delete-node", { blueprint, nodeId });
        return toMcp(wrapRaw(data, { refs: autoRefs(data) }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  server.tool(
    "add_node",
    "Add a new node to a Blueprint graph. Supports: BreakStruct, MakeStruct, CallFunction, VariableGet, VariableSet, DynamicCast, OverrideEvent, CallParentFunction, Branch, Sequence, CustomEvent, ForEachLoop, ForLoop, ForLoopWithBreak, WhileLoop, SpawnActorFromClass, Select, Comment, Reroute. For Delay/IsValid/PrintString, use CallFunction with className 'KismetSystemLibrary'.",
    {
      blueprint: z.string().describe("Blueprint name or package path"),
      graph: z.string().describe("Graph name (e.g. 'EventGraph')"),
      nodeType: z.enum([
        "BreakStruct", "MakeStruct", "CallFunction", "VariableGet", "VariableSet",
        "DynamicCast", "OverrideEvent", "CallParentFunction",
        "Branch", "Sequence", "CustomEvent",
        "ForEachLoop", "ForLoop", "ForLoopWithBreak", "WhileLoop",
        "SpawnActorFromClass", "Select", "Comment", "Reroute"
      ]).describe("Type of node to add"),
      typeName: z.string().optional().describe("Struct type name for BreakStruct/MakeStruct (e.g. 'FVitals')"),
      functionName: z.string().optional().describe("Function name for CallFunction, OverrideEvent, or CallParentFunction (e.g. 'PrintString')"),
      className: z.string().optional().describe("Class name for CallFunction (e.g. 'KismetSystemLibrary')"),
      variableName: z.string().optional().describe("Variable name for VariableGet/VariableSet"),
      castTarget: z.string().optional().describe("Target class name for DynamicCast (e.g. 'BP_PatientJson')"),
      eventName: z.string().optional().describe("Event name for CustomEvent (e.g. 'OnDataReady')"),
      actorClass: z.string().optional().describe("Actor class for SpawnActorFromClass (e.g. 'BP_Patient_Base'). Optional — can also be set via the class pin."),
      comment: z.string().optional().describe("Comment text for Comment node type"),
      width: z.number().optional().describe("Width for Comment node (default: 400)"),
      height: z.number().optional().describe("Height for Comment node (default: 200)"),
      posX: z.number().optional().describe("X position in the graph (optional)"),
      posY: z.number().optional().describe("Y position in the graph (optional)"),
    },
    async ({ blueprint, graph, nodeType, typeName, functionName, className, variableName, castTarget, eventName, actorClass, comment, width, height, posX, posY }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      const body: Record<string, any> = { blueprint, graph, nodeType };
      if (typeName) body.typeName = typeName;
      if (functionName) body.functionName = functionName;
      if (className) body.className = className;
      if (variableName) body.variableName = variableName;
      if (castTarget) body.castTarget = castTarget;
      if (eventName) body.eventName = eventName;
      if (actorClass) body.actorClass = actorClass;
      if (comment) body.comment = comment;
      if (width !== undefined) body.width = width;
      if (height !== undefined) body.height = height;
      if (posX !== undefined) body.posX = posX;
      if (posY !== undefined) body.posY = posY;

      try {
        const data = await uePost("/api/add-node", body);
        return toMcp(wrapRaw(data, { refs: autoRefs(data) }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  server.tool(
    "rename_asset",
    "Rename or move an asset (Blueprint, Material, Material Instance, or Material Function) and update all references.",
    {
      assetPath: z.string().describe("Current full asset path (e.g. '/Game/Blueprints/Old/BP_MyActor' or '/Game/Materials/MI_Skin')"),
      newPath: z.string().describe("New full asset path (e.g. '/Game/Blueprints/New/BP_MyRenamedActor')"),
    },
    async ({ assetPath, newPath }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      try {
        const data = await uePost("/api/rename-asset", { assetPath, newPath });
        return toMcp(wrapRaw(data, { refs: autoRefs(data) }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  server.tool(
    "set_pin_default",
    "Set the default value of an input pin on a Blueprint node. Supports batch mode for setting multiple pins at once. Use this to set literal/constant values on pins that are not connected to other nodes.",
    {
      blueprint: z.string().optional().describe("Blueprint name or package path (required for single mode)"),
      nodeId: z.string().optional().describe("Node GUID (required for single mode)"),
      pinName: z.string().optional().describe("Pin name (required for single mode)"),
      value: z.string().optional().describe("Default value to set (required for single mode)"),
      batch: z.array(z.object({
        blueprint: z.string(),
        nodeId: z.string(),
        pinName: z.string(),
        value: z.string(),
      })).optional().describe("Batch mode: array of {blueprint, nodeId, pinName, value} objects. When provided, single params are ignored."),
    },
    async ({ blueprint, nodeId, pinName, value, batch }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      const body: Record<string, any> = batch
        ? { batch }
        : { blueprint, nodeId, pinName, value };

      try {
        const data = await uePost("/api/set-pin-default", body);
        return toMcp(wrapRaw(data, { refs: autoRefs(data) }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  server.tool(
    "move_node",
    "Reposition one or more nodes in a Blueprint graph by setting their X/Y coordinates. Use batch mode with 'nodes' array for multiple moves in one call.",
    {
      blueprint: z.string().describe("Blueprint name or package path"),
      nodeId: z.string().optional().describe("Node GUID (for single-node mode)"),
      x: z.number().optional().describe("New X position (for single-node mode)"),
      y: z.number().optional().describe("New Y position (for single-node mode)"),
      nodes: z.array(z.object({
        nodeId: z.string(),
        x: z.number(),
        y: z.number(),
      })).optional().describe("Batch mode: array of {nodeId, x, y} objects"),
    },
    async ({ blueprint, nodeId, x, y, nodes }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      const body: Record<string, any> = { blueprint };
      if (nodes) {
        body.nodes = nodes;
      } else {
        if (nodeId) body.nodeId = nodeId;
        if (x !== undefined) body.x = x;
        if (y !== undefined) body.y = y;
      }

      try {
        const data = await uePost("/api/move-node", body);
        return toMcp(wrapRaw(data, { refs: autoRefs(data) }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  server.tool(
    "set_blueprint_default",
    "Set a default property value on a Blueprint's Class Default Object (CDO). Supports TSubclassOf (class references), object references, and simple types (bool, int, float, string, enum). For class/object values, provide the Blueprint asset name (e.g. 'MyWidget') or C++ class name.",
    {
      blueprint: z.string().describe("Blueprint name or package path (e.g. 'HUD_WebUIInterface')"),
      property: z.string().describe("Property name as declared in C++ or Blueprint (e.g. 'WebUIWidgetClass')"),
      value: z.string().describe("Value to set. For class properties: Blueprint name or C++ class name. For simple types: the literal value (e.g. 'true', '42', '0.5')"),
    },
    async ({ blueprint, property, value }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      try {
        const data = await uePost("/api/set-blueprint-default", { blueprint, property, value });
        return toMcp(wrapRaw(data, { refs: autoRefs(data) }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  server.tool(
    "duplicate_nodes",
    "Duplicate one or more nodes within a Blueprint graph. Creates copies at an offset from the originals. The duplicated nodes are not connected to anything — use connect_pins to wire them up.",
    {
      blueprint: z.string().describe("Blueprint name or package path"),
      graph: z.string().describe("Graph name (e.g. 'EventGraph')"),
      nodeIds: z.array(z.string()).describe("Array of node GUIDs to duplicate"),
      offsetX: z.number().optional().describe("X offset for duplicated nodes (default: 50)"),
      offsetY: z.number().optional().describe("Y offset for duplicated nodes (default: 50)"),
    },
    async ({ blueprint, graph, nodeIds, offsetX, offsetY }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      const body: Record<string, any> = { blueprint, graph, nodeIds };
      if (offsetX !== undefined) body.offsetX = offsetX;
      if (offsetY !== undefined) body.offsetY = offsetY;

      try {
        const data = await uePost("/api/duplicate-nodes", body);
        return toMcp(wrapRaw(data, {
          refs: autoRefs(data),
          nextSteps: ["connect_pins to wire the duplicated nodes to other nodes"],
        }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  server.tool(
    "get_node_comment",
    "Read the comment text (comment bubble) on a Blueprint node.",
    {
      blueprint: z.string().describe("Blueprint name or package path"),
      nodeId: z.string().describe("Node GUID"),
    },
    async ({ blueprint, nodeId }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      try {
        const data = await uePost("/api/get-node-comment", { blueprint, nodeId });
        return toMcp(wrapRaw(data, { refs: autoRefs(data) }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  server.tool(
    "set_node_comment",
    "Set or clear the comment text (comment bubble) on a Blueprint node. When setting a non-empty comment, the comment bubble is automatically made visible and pinned.",
    {
      blueprint: z.string().describe("Blueprint name or package path"),
      nodeId: z.string().describe("Node GUID"),
      comment: z.string().describe("Comment text to set (empty string to clear)"),
    },
    async ({ blueprint, nodeId, comment }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      try {
        const data = await uePost("/api/set-node-comment", { blueprint, nodeId, comment });
        return toMcp(wrapRaw(data, { refs: autoRefs(data) }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );
}
