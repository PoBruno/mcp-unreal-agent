import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ensureUE, ueGet, uePost } from "../ue-bridge.js";
import { toMcp, wrapRaw, autoRefs, fail } from "../types.js";

export function registerGroomTools(server: McpServer): void {
  // ------------------------------------------------------------------
  // list_groom_bindings
  // ------------------------------------------------------------------
  server.tool(
    "list_groom_bindings",
    "List all Groom Binding assets (UGroomBindingAsset) in the project. " +
    "Returns each binding's asset path, groom asset reference, target skeletal mesh, and source skeletal mesh. " +
    "Use the optional 'query' parameter to filter by name substring.",
    {
      query: z.string().optional().describe(
        "Optional name filter — returns only bindings whose name contains this string (case-insensitive)"
      ),
    },
    async ({ query }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      const params: Record<string, string> = {};
      if (query) params.query = query;

      try {
        const data = await ueGet("/api/list-groom-bindings", params);
        return toMcp(wrapRaw(data, {
          refs: autoRefs(data),
          nextSteps: [
            "use duplicate_groom_binding to copy a binding for a new character",
            "use set_groom_binding_target_mesh to change which skeletal mesh a binding targets",
          ],
        }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  // ------------------------------------------------------------------
  // duplicate_groom_binding
  // ------------------------------------------------------------------
  server.tool(
    "duplicate_groom_binding",
    "Duplicate a Groom Binding asset (.uasset) and give it a new name. " +
    "Useful when retargeting hair from one character to another — duplicate the original binding, " +
    "then call set_groom_binding_target_mesh on the copy to point it at the new skeletal mesh. " +
    "The copy retains the same groom (hair) asset reference as the original.",
    {
      assetPath: z.string().describe(
        "Full asset path or package path of the source groom binding " +
        "(e.g. '/Game/Characters/Hair/GB_Samir_Hair')"
      ),
      newName: z.string().describe(
        "Name for the duplicated asset — just the asset name, no slashes " +
        "(e.g. 'GB_Regina_Hair')"
      ),
      newFolder: z.string().optional().describe(
        "Destination package folder. Defaults to the same folder as the source. " +
        "Example: '/Game/Characters/Regina/Hair'"
      ),
    },
    async ({ assetPath, newName, newFolder }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      const body: Record<string, any> = { assetPath, newName };
      if (newFolder) body.newFolder = newFolder;

      try {
        const data = await uePost("/api/duplicate-groom-binding", body);
        return toMcp(wrapRaw(data, {
          refs: autoRefs(data),
          nextSteps: [
            "call set_groom_binding_target_mesh to point the new binding at the correct skeletal mesh",
            "open the binding in the editor and click 'Rebuild Binding' to bake the new binding data",
          ],
        }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  // ------------------------------------------------------------------
  // set_groom_binding_target_mesh
  // ------------------------------------------------------------------
  server.tool(
    "set_groom_binding_target_mesh",
    "Change the Target Skeletal Mesh (and optionally the Source Skeletal Mesh) reference inside a " +
    "Groom Binding asset. After calling this tool the binding's geometry data will be stale — " +
    "open the asset in the Unreal Editor and click 'Rebuild Binding' to regenerate the binding data " +
    "for the new mesh. Typical workflow: duplicate_groom_binding → set_groom_binding_target_mesh → rebuild in editor.",
    {
      assetPath: z.string().describe(
        "Full asset path or package path of the groom binding to modify " +
        "(e.g. '/Game/Characters/Hair/GB_Regina_Hair')"
      ),
      targetMeshPath: z.string().describe(
        "Full object path to the new target Skeletal Mesh asset " +
        "(e.g. '/Game/Characters/Regina/SKM_Regina.SKM_Regina')"
      ),
      sourceMeshPath: z.string().optional().describe(
        "Optional full object path to the source Skeletal Mesh (used for retargeting). " +
        "Pass this when the groom was originally created for a different skeleton than the target."
      ),
    },
    async ({ assetPath, targetMeshPath, sourceMeshPath }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      const body: Record<string, any> = { assetPath, targetMeshPath };
      if (sourceMeshPath) body.sourceMeshPath = sourceMeshPath;

      try {
        const data = await uePost("/api/set-groom-binding-target-mesh", body);
        return toMcp(wrapRaw(data, {
          refs: autoRefs(data),
          nextSteps: [
            "open the asset in the editor and click 'Rebuild Binding' to regenerate the binding data for the new mesh",
          ],
        }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );
}
