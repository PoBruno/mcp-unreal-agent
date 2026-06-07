import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ensureUE, uePost } from "../ue-bridge.js";
import { toMcp, wrapRaw, autoRefs, fail } from "../types.js";

export function registerGraphTools(server: McpServer): void {
  server.tool(
    "reparent_blueprint",
    "Change a Blueprint's parent class. Can reparent to a C++ class (e.g. 'WebUIHUD') or another Blueprint. Compiles, refreshes all nodes, and saves.",
    {
      blueprint: z.string().describe("Blueprint name or package path (e.g. 'HUD_WebUIInterface')"),
      newParentClass: z.string().describe("New parent class name — C++ class (e.g. 'WebUIHUD') or Blueprint name"),
    },
    async ({ blueprint, newParentClass }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      try {
        const data = await uePost("/api/reparent-blueprint", { blueprint, newParentClass });
        return toMcp(wrapRaw(data, { refs: autoRefs(data) }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  server.tool(
    "create_blueprint",
    "Create a new Blueprint asset. Specify a parent class (C++ or Blueprint) and package path.",
    {
      blueprintName: z.string().describe("Name for the new Blueprint (e.g. 'BP_MyActor')"),
      packagePath: z.string().describe("Package path (e.g. '/Game/Blueprints/Actors')"),
      parentClass: z.string().describe("Parent class — C++ class (e.g. 'Actor', 'Pawn') or Blueprint name"),
      blueprintType: z.enum(["Normal", "Interface", "FunctionLibrary", "MacroLibrary"])
        .optional().default("Normal")
        .describe("Blueprint type (default: Normal)"),
    },
    async ({ blueprintName, packagePath, parentClass, blueprintType }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      try {
        const data = await uePost("/api/create-blueprint", { blueprintName, packagePath, parentClass, blueprintType });
        return toMcp(wrapRaw(data, {
          refs: autoRefs(data),
          nextSteps: [
            "get_blueprint to inspect the new Blueprint",
            "add_node to add logic",
          ],
        }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  server.tool(
    "create_graph",
    "Create a new function graph, macro graph, or custom event in a Blueprint. For function/macro, creates a new named graph with entry/exit nodes. For customEvent, adds a CustomEvent node to the EventGraph.",
    {
      blueprint: z.string().describe("Blueprint name or package path"),
      graphName: z.string().describe("Name for the new graph or custom event"),
      graphType: z.enum(["function", "macro", "customEvent"]).describe("Type of graph to create: 'function' (new function graph), 'macro' (new macro graph), 'customEvent' (CustomEvent node in EventGraph)"),
    },
    async ({ blueprint, graphName, graphType }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      try {
        const data = await uePost("/api/create-graph", { blueprint, graphName, graphType });
        return toMcp(wrapRaw(data, {
          refs: autoRefs(data),
          nextSteps: [
            "add_node to add nodes to the new graph",
            "get_blueprint_graph to inspect the graph",
          ],
        }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  server.tool(
    "delete_graph",
    "Delete an entire function or macro graph from a Blueprint. Cannot delete EventGraph (Ubergraph pages). All nodes in the graph are removed. Use get_blueprint to see available graphs first.",
    {
      blueprint: z.string().describe("Blueprint name or package path"),
      graphName: z.string().describe("Name of the function or macro graph to delete"),
    },
    async ({ blueprint, graphName }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      try {
        const data = await uePost("/api/delete-graph", { blueprint, graphName });
        return toMcp(wrapRaw(data, { refs: autoRefs(data) }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  server.tool(
    "rename_graph",
    "Rename a function or macro graph in a Blueprint. Cannot rename EventGraph (Ubergraph pages). Updates all internal references.",
    {
      blueprint: z.string().describe("Blueprint name or package path"),
      graphName: z.string().describe("Current name of the function or macro graph"),
      newName: z.string().describe("New name for the graph"),
    },
    async ({ blueprint, graphName, newName }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      try {
        const data = await uePost("/api/rename-graph", { blueprint, graphName, newName });
        return toMcp(wrapRaw(data, {
          refs: autoRefs(data),
          nextSteps: ["get_blueprint_graph to inspect the renamed graph"],
        }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );
}
