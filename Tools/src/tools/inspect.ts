import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ensureUE, ueGet, uePost } from "../ue-bridge.js";
import { ok, fail, toMcp, autoRefs, type RefValue } from "../types.js";
import { summarizeBlueprint } from "../graph-describe.js";
import { describeMaterial } from "../material-describe.js";

const MAX_LIST = 40;

function cap<T>(arr: T[] | undefined): { items: T[]; truncated?: string } {
  if (!Array.isArray(arr)) return { items: [] };
  if (arr.length <= MAX_LIST) return { items: arr };
  return { items: arr.slice(0, MAX_LIST), truncated: `${arr.length - MAX_LIST} more not shown — narrow the target or use the domain tool` };
}

async function tryGet(path: string, params: Record<string, string>): Promise<any> {
  try { const d = await ueGet(path, params); return d?.error ? null : d; } catch { return null; }
}
async function tryPost(path: string, body: Record<string, any>): Promise<any> {
  try { const d = await uePost(path, body); return d?.error ? null : d; } catch { return null; }
}

export function registerInspectTools(server: McpServer): void {
  server.tool(
    "inspect",
    "One-call structured CONTEXT for an asset, actor, or the level: a budgeted MAP (counts, names, one-line summaries) plus refs to drill into — NOT a raw dump. Use this BEFORE editing to understand a target without pulling 300K of raw JSON. depth='summary' (default) stays compact (~1-3K chars); depth='full' adds per-section detail. Auto-detects whether the target is a Blueprint, Material, Actor, or the level.",
    {
      target: z.string().describe("Asset name/path, actor label, or the literal 'level'"),
      include: z.array(z.enum(["overview", "variables", "components", "graphs", "interfaces", "material", "actor", "level"]))
        .optional().describe("Sections to include; auto-picked by target type when omitted"),
      depth: z.enum(["summary", "full"]).optional().default("summary").describe("'summary' (default, compact) or 'full' (per-section detail)"),
    },
    async ({ target, include, depth }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));
      const want = (s: string) => !include || include.includes(s as any);
      const refs: Record<string, RefValue> = {};
      const data: Record<string, any> = { target };

      try {
        // --- level ---
        if (target.toLowerCase() === "level") {
          const lvl = (await tryPost("/api/get-level-info", {})) || (await tryGet("/api/current-level", {}));
          const actors = await tryGet("/api/list-actors", {});
          data.kind = "level";
          if (lvl) data.level = lvl.level || lvl.name || lvl;
          const list: any[] = actors?.actors || [];
          const byClass: Record<string, number> = {};
          for (const a of list) byClass[a.class] = (byClass[a.class] || 0) + 1;
          data.actorCount = list.length;
          data.actorsByClass = byClass;
          if (depth === "full") data.actors = cap(list).items;
          return toMcp(ok(data, { refs }));
        }

        // --- blueprint ---
        const bp = await tryGet("/api/blueprint", { name: target });
        if (bp && (bp.variables || bp.graphs || bp.name)) {
          data.kind = "blueprint";
          Object.assign(refs, autoRefs({ blueprintPath: bp.path || target, blueprint: target }));
          if (want("overview")) data.summary = summarizeBlueprint(bp);
          if (want("variables") && Array.isArray(bp.variables)) {
            const c = cap(bp.variables);
            data.variables = c.items.map((v: any) => ({ name: v.name, type: v.type, category: v.category }));
            if (c.truncated) data.variablesTruncated = c.truncated;
          }
          if (want("components")) {
            const comps = await tryPost("/api/list-components", { blueprint: target });
            if (comps?.components) data.components = cap(comps.components).items;
          }
          if (want("interfaces")) {
            const ifaces = await tryPost("/api/list-interfaces", { blueprint: target });
            if (ifaces?.interfaces) data.interfaces = ifaces.interfaces;
          }
          if (want("graphs") && Array.isArray(bp.graphs)) {
            data.graphs = bp.graphs.map((g: any) => ({ name: g.name, nodeCount: (g.nodes || []).length }));
            if (bp.graphs[0]?.name) refs.graph = bp.graphs[0].name;
            if (depth === "full") data.nextSteps = ["call describe_graph(name, graph) to get a graph's pseudo-code"];
          }
          return toMcp(ok(data, {
            refs,
            nextSteps: ["use refs.blueprint with mutation tools (add_variable, add_node, …)", "call describe_graph for a specific graph's logic"],
          }));
        }

        // --- material ---
        const mat = await tryPost("/api/describe-material", { material: target });
        if (mat) {
          data.kind = "material";
          Object.assign(refs, autoRefs({ materialPath: target, material: target }));
          data.description = describeMaterial(mat);
          return toMcp(ok(data, { refs, nextSteps: ["use refs.material with material tools; call get_material_graph for node ids"] }));
        }

        // --- actor ---
        const act = await tryGet("/api/actor-properties", { label: target });
        if (act) {
          data.kind = "actor";
          Object.assign(refs, autoRefs({ label: target, actorLabel: target }));
          data.actor = depth === "full" ? act : { label: act.label ?? target, class: act.class, location: act.location, folder: act.folder };
          return toMcp(ok(data, { refs, nextSteps: ["use refs.actorLabel with set_actor_* / focus_actor"] }));
        }

        return toMcp(fail("ASSET_NOT_FOUND", `Could not resolve '${target}' as a blueprint, material, actor, or the level. Use list_blueprints / list_materials / list_actors to find a target.`));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    },
  );

  server.tool(
    "get_edit_context",
    "Task-scoped context BEFORE a mutation: returns only what's relevant to the edit — the target plus what references/depends on it — not everything. Use before risky edits (type changes, deletes, reparents) so you know the blast radius.",
    {
      target: z.string().describe("Asset path/name about to be edited"),
      operation: z.string().optional().describe("What you're about to do (e.g. 'change_variable_type', 'delete', 'reparent') — for the response's guidance only"),
    },
    async ({ target, operation }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));
      try {
        const data: Record<string, any> = { target, operation };
        const refsData = await tryGet("/api/references", { assetPath: target });
        if (refsData) {
          data.totalReferencers = refsData.totalReferencers;
          data.blueprintReferencers = cap(refsData.blueprintReferencers).items;
          data.otherReferencers = cap(refsData.otherReferencers).items;
          data.safeToDelete = (refsData.totalReferencers ?? 0) === 0;
        } else {
          data.referencers = "unavailable";
        }
        const refs = autoRefs({ assetPath: target });
        return toMcp(ok(data, {
          refs,
          nextSteps: [
            "if changing a type, run search_by_type to find Break/Make usages",
            "if reparenting/C++ changes, run analyze_rebuild_impact",
          ],
        }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    },
  );
}
