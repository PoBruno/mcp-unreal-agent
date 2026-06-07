import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ensureUE, ueGet, uePost } from "../ue-bridge.js";
import { ok, fail, toMcp, wrapRaw, autoRefs, type ToolResult } from "../types.js";
import { summarizeBlueprint, describeGraph } from "../graph-describe.js";

export type BlueprintEntry = {
  name: string;
  path: string;
  parentClass?: string;
  isLevelBlueprint?: boolean;
};

export type ListBlueprintsData = {
  count: number;
  total: number;
  blueprints: BlueprintEntry[];
};

/** Pure mapper from the raw /api/list payload to the structured contract. */
export function buildListBlueprintsResult(raw: any): ToolResult<ListBlueprintsData> {
  if (raw?.error) return fail("UE_HTTP_FAILED", String(raw.error));

  const blueprints: BlueprintEntry[] = Array.isArray(raw?.blueprints) ? raw.blueprints : [];
  const data: ListBlueprintsData = {
    count: raw?.count ?? blueprints.length,
    total: raw?.total ?? blueprints.length,
    blueprints,
  };

  const blueprintIds = blueprints.map((bp) => bp.path).filter((p): p is string => Boolean(p));

  return ok(data, {
    refs: { blueprintIds },
    nextSteps: blueprintIds.length
      ? ["call get_blueprint_summary with one of refs.blueprintIds to inspect a Blueprint"]
      : ["no Blueprints matched — broaden the filter or call rescan_assets if assets were just created"],
  });
}

export function registerReadTools(server: McpServer): void {
  server.tool(
    "list_blueprints",
    "List all Blueprint assets in the UE5 project, including level blueprints from .umap files. Optionally filter by name/path substring, parent class, or type (regular vs level). Returns refs.blueprintIds[] for chaining into get_blueprint_summary.",
    {
      filter: z.string().optional().describe("Substring to match against Blueprint name or path"),
      parentClass: z.string().optional().describe("Filter by parent class name"),
      type: z.enum(["all", "regular", "level"]).optional().default("all").describe("Filter by blueprint type: 'all' (default), 'regular' (standard BPs only), 'level' (level blueprints only)"),
    },
    async ({ filter, parentClass, type: bpType }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      try {
        const raw = await ueGet("/api/list", {
          filter: filter || "",
          parentClass: parentClass || "",
          type: bpType || "all",
        });
        return toMcp(buildListBlueprintsResult(raw));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  server.tool(
    "get_blueprint",
    "Get full details of a specific Blueprint: variables, interfaces, and all graphs with nodes and connections. Also supports level blueprints from .umap files (e.g. 'MAP_Ward').",
    {
      name: z.string().describe("Blueprint name or package path (e.g. 'BP_Patient_Base', 'MAP_Ward')"),
    },
    async ({ name }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      try {
        const data = await ueGet("/api/blueprint", { name });
        return toMcp(wrapRaw(data, { refs: autoRefs(data) }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  server.tool(
    "get_blueprint_graph",
    "Get a specific named graph from a Blueprint (e.g. 'EventGraph', a function name). Graph names are URL-encoded automatically.",
    {
      name: z.string().describe("Blueprint name or package path"),
      graph: z.string().describe("Graph name (e.g. 'EventGraph')"),
    },
    async ({ name, graph }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      try {
        // ueGet uses URL.searchParams.set which handles encoding via encodeURIComponent (#8)
        const data = await ueGet("/api/graph", { name, graph });
        return toMcp(wrapRaw(data, { refs: autoRefs(data) }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  server.tool(
    "search_blueprints",
    "Search across Blueprints for nodes matching a query (function calls, events, variables). Loads BPs on demand so use 'path' filter to scope large searches.",
    {
      query: z.string().describe("Search term to match against node titles, function names, event names, variable names"),
      path: z.string().optional().describe("Filter to Blueprints whose path contains this substring (e.g. '/Game/Blueprints/Patients/')"),
      maxResults: z.number().optional().default(50).describe("Maximum results to return"),
    },
    async ({ query, path: pathFilter, maxResults }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      try {
        const data = await ueGet("/api/search", {
          query,
          path: pathFilter || "",
          maxResults: String(maxResults),
        });
        return toMcp(wrapRaw(data, { refs: autoRefs(data) }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  server.tool(
    "get_blueprint_summary",
    "Get a concise human-readable summary of a Blueprint: variables with types, graphs with node counts, events, and function calls. Returns ~1-2K chars instead of 300K+ raw JSON. Use this first to understand a Blueprint before diving into specific graphs.",
    {
      name: z.string().describe("Blueprint name or package path (e.g. 'BPC_3LeadECG')"),
    },
    async ({ name }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      try {
        const data = await ueGet("/api/blueprint", { name });
        if (data?.error) return toMcp(wrapRaw(data));
        // Return the COMPACT summary (~1-2K chars) in data, not the 300K raw payload.
        return toMcp(ok({ summary: summarizeBlueprint(data) }, { refs: autoRefs(data) }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  server.tool(
    "describe_graph",
    "Get a pseudo-code description of a specific Blueprint graph by walking execution pin chains. Shows the control flow as readable pseudo-code (IF/CALL/SET/SEQUENCE etc) with data flow annotations showing where each node gets its inputs. Use after get_blueprint_summary to understand a specific graph's logic. Graph names are URL-encoded automatically.",
    {
      name: z.string().describe("Blueprint name or package path"),
      graph: z.string().describe("Graph name (e.g. 'EventGraph', 'Set Connection Progress')"),
    },
    async ({ name, graph }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      try {
        // ueGet uses URL.searchParams.set which handles encoding via encodeURIComponent (#8)
        const data = await ueGet("/api/graph", { name, graph });
        if (data?.error) return toMcp(wrapRaw(data));
        return toMcp(ok({ pseudocode: describeGraph(data) }, { refs: autoRefs(data) }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  server.tool(
    "find_asset_references",
    "Find all Blueprints (and other assets) that reference a given asset path. Equivalent to the editor's Reference Viewer. Use this to check dependencies before deleting assets or to map out which Blueprints use a specific struct, function library, or enum.",
    {
      assetPath: z.string().describe("Full asset path, e.g. '/Game/Blueprints/WebUI/S_Vitals'"),
    },
    async ({ assetPath }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      try {
        const data = await ueGet("/api/references", { assetPath });
        return toMcp(wrapRaw(data, { refs: autoRefs(data) }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  server.tool(
    "search_by_type",
    "Find all usages of a specific type across Blueprints: variables, function/event parameters, Break/Make struct nodes. More granular than find_asset_references.",
    {
      typeName: z.string().describe("Type name to search for (e.g. 'FVitals', 'S_Vitals', 'ELungSound')"),
      filter: z.string().optional().describe("Optional path filter to scope the search (e.g. '/Game/Blueprints/')"),
    },
    async ({ typeName, filter }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      const params: Record<string, string> = { typeName };
      if (filter) params.filter = filter;

      try {
        const data = await ueGet("/api/search-by-type", params);
        return toMcp(wrapRaw(data, { refs: autoRefs(data) }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  server.tool(
    "get_skeleton",
    "Inspect a USkeleton asset: dumps the full bone hierarchy (with parent index, ref-pose transform), all sockets, and the curve metadata name list. Use the package path (e.g. '/Game/Characters/CC/Backend/CC4/CC5_Rig'). Useful for diffing rigs across characters.",
    {
      path: z.string().describe("Package path of the USkeleton asset, e.g. '/Game/Characters/CC/Backend/CC4/CC5_Rig'"),
      tree: z.boolean().optional().default(true).describe("If true (default), format bones as an indented hierarchy tree. If false, return raw JSON."),
      includeTransforms: z.boolean().optional().default(false).describe("Include ref-pose location in tree output (off by default to keep it compact)."),
    },
    async ({ path }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      try {
        const data = await ueGet("/api/skeleton", { path });
        return toMcp(wrapRaw(data, { refs: autoRefs(data) }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  server.tool(
    "add_skeleton_socket",
    "Add (or update) a single socket on a USkeleton asset. The skeleton .uasset is saved to disk; the read-only attribute is cleared automatically. Wrapped in an undo transaction. Use 'overwrite=false' to refuse if a socket with the same name already exists. Use 'dryRun=true' to preview without saving.",
    {
      path: z.string().describe("Package path of the USkeleton, e.g. '/Game/Characters/CC/Backend/CC4/CC5New_Rig'"),
      socketName: z.string().describe("Socket name (FName) to create or update"),
      bone: z.string().describe("Bone name the socket is parented to. Must exist on the skeleton."),
      locX: z.number().optional().default(0),
      locY: z.number().optional().default(0),
      locZ: z.number().optional().default(0),
      rotPitch: z.number().optional().default(0),
      rotYaw: z.number().optional().default(0),
      rotRoll: z.number().optional().default(0),
      scaleX: z.number().optional().default(1),
      scaleY: z.number().optional().default(1),
      scaleZ: z.number().optional().default(1),
      overwrite: z.boolean().optional().default(true).describe("If true (default), update an existing socket with the same name; if false, error out instead."),
      dryRun: z.boolean().optional().default(false).describe("Validate without modifying the asset."),
    },
    async (args) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      try {
        const data = await uePost("/api/add-skeleton-socket", args);
        return toMcp(wrapRaw(data, { refs: autoRefs(data) }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  server.tool(
    "remove_skeleton_socket",
    "Remove a socket by name from a USkeleton asset. The skeleton is saved to disk. Wrapped in an undo transaction.",
    {
      path: z.string().describe("Package path of the USkeleton"),
      socketName: z.string().describe("Socket name to remove"),
      dryRun: z.boolean().optional().default(false),
    },
    async (args) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      try {
        const data = await uePost("/api/remove-skeleton-socket", args);
        return toMcp(wrapRaw(data, { refs: autoRefs(data) }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  server.tool(
    "copy_skeleton_sockets",
    "Copy all sockets from one USkeleton to another, preserving name, bone, and relative transform. Sockets whose target bone doesn't exist on the destination skeleton are skipped and reported under 'missingBones'. Use 'only' to restrict to a subset of socket names. Use 'overwrite=false' to skip sockets that already exist on the destination.",
    {
      fromPath: z.string().describe("Source USkeleton package path"),
      toPath: z.string().describe("Destination USkeleton package path"),
      only: z.array(z.string()).optional().describe("If provided, only copy sockets whose name is in this list (case-insensitive)."),
      overwrite: z.boolean().optional().default(true),
      dryRun: z.boolean().optional().default(false),
    },
    async (args) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      try {
        const data = await uePost("/api/copy-skeleton-sockets", args);
        return toMcp(wrapRaw(data, { refs: autoRefs(data) }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );
}
