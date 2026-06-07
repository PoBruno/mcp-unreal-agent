import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ensureUE, uePost, ueGet } from "../ue-bridge.js";
import { toMcp, wrapRaw, autoRefs, fail } from "../types.js";

export function registerMaterialMutationTools(server: McpServer): void {
  // ---------------------------------------------------------------------------
  // Phase 2: Material Mutations
  // ---------------------------------------------------------------------------

  server.tool(
    "create_material",
    "Create a new Material asset.",
    {
      name: z.string().describe("Material asset name (e.g. 'M_MyMaterial')"),
      packagePath: z.string().default("/Game").describe("Package path to create the material in (e.g. '/Game/Materials')"),
      domain: z.enum(["Surface", "DeferredDecal", "LightFunction", "Volume", "PostProcess", "UI"]).optional().describe("Material domain"),
      blendMode: z.enum(["Opaque", "Masked", "Translucent", "Additive", "Modulate"]).optional().describe("Blend mode"),
      twoSided: z.boolean().optional().describe("Whether the material is two-sided"),
    },
    async ({ name, packagePath, domain, blendMode, twoSided }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      const body: Record<string, any> = { name, packagePath };
      if (domain) body.domain = domain;
      if (blendMode) body.blendMode = blendMode;
      if (twoSided !== undefined) body.twoSided = twoSided;

      try {
        const data = await uePost("/api/create-material", body);
        return toMcp(wrapRaw(data, {
          refs: autoRefs(data),
          nextSteps: [
            "use add_material_expression to add nodes to the material graph",
            "use connect_material_pins to wire expressions together",
            "use set_material_property to adjust material settings",
          ],
        }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  server.tool(
    "set_material_property",
    "Set a top-level property on a Material. Supported properties: domain, blendMode, twoSided, shadingModel, opacity/opacityMaskClipValue, bUsedWithSkeletalMesh, bUsedWithMorphTargets, bUsedWithNiagaraSprites, ditheredLODTransition, bAllowNegativeEmissiveColor.",
    {
      material: z.string().describe("Material name or package path (e.g. 'M_MyMaterial')"),
      property: z.string().describe("Property name to set"),
      value: z.union([z.string(), z.number(), z.boolean()]).describe("New value for the property (string for enums, number for floats, boolean for flags)"),
      dryRun: z.boolean().optional().describe("If true, preview changes without modifying the Material"),
    },
    async ({ material, property, value, dryRun }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      const body: Record<string, any> = { material, property, value };
      if (dryRun) body.dryRun = true;

      try {
        const data = await uePost("/api/set-material-property", body);
        return toMcp(wrapRaw(data, {
          refs: autoRefs(data),
          nextSteps: dryRun ? undefined : ["use get_material_graph to verify the changes"],
        }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  server.tool(
    "add_material_expression",
    "Add a new expression node to a Material or Material Function graph. Supports any UMaterialExpression subclass — use the class name without the 'MaterialExpression' prefix (e.g. 'Constant', 'Add', 'Subtract', 'Fresnel', 'Comment', 'If', 'Lerp').",
    {
      material: z.string().optional().describe("Material name or package path (e.g. 'M_MyMaterial'). Provide either material or materialFunction."),
      materialFunction: z.string().optional().describe("Material Function name or package path (e.g. 'MF_MyFunction'). Provide either material or materialFunction."),
      expressionClass: z.string().describe("Expression class name without the 'MaterialExpression' prefix. Any UMaterialExpression subclass is supported (e.g. 'Constant', 'ScalarParameter', 'Add', 'Subtract', 'Fresnel', 'Comment', 'If', 'Lerp')."),
      posX: z.number().default(0).describe("X position in the graph editor"),
      posY: z.number().default(0).describe("Y position in the graph editor"),
      name: z.string().optional().describe("For parameter expressions (ScalarParameter, VectorParameter, etc.): the parameter name. Avoids the default 'Param' collision when adding multiple."),
      dryRun: z.boolean().optional().describe("If true, preview changes without modifying the asset"),
    },
    async ({ material, materialFunction, expressionClass, posX, posY, name, dryRun }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      if (!material && !materialFunction) return toMcp(fail("INVALID_PARAMS", "Provide either 'material' or 'materialFunction'"));
      if (material && materialFunction) return toMcp(fail("INVALID_PARAMS", "Provide either 'material' or 'materialFunction', not both"));

      const body: Record<string, any> = { expressionClass, posX, posY };
      if (material) body.material = material;
      if (materialFunction) body.materialFunction = materialFunction;
      if (name) body.name = name;
      if (dryRun) body.dryRun = true;

      try {
        const data = await uePost("/api/add-material-expression", body);
        return toMcp(wrapRaw(data, {
          refs: autoRefs(data),
          nextSteps: dryRun ? undefined : [
            "use set_expression_value to configure the expression",
            "use connect_material_pins to wire it to other nodes",
          ],
        }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  server.tool(
    "delete_material_expression",
    "Delete an expression node from a Material or Material Function graph.",
    {
      material: z.string().optional().describe("Material name or package path. Provide either material or materialFunction."),
      materialFunction: z.string().optional().describe("Material Function name or package path. Provide either material or materialFunction."),
      nodeId: z.string().describe("GUID of the expression node to delete"),
      dryRun: z.boolean().optional().describe("If true, preview changes without modifying the asset"),
    },
    async ({ material, materialFunction, nodeId, dryRun }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      if (!material && !materialFunction) return toMcp(fail("INVALID_PARAMS", "Provide either 'material' or 'materialFunction'"));

      const body: Record<string, any> = { nodeId };
      if (material) body.material = material;
      if (materialFunction) body.materialFunction = materialFunction;
      if (dryRun) body.dryRun = true;

      try {
        const data = await uePost("/api/delete-material-expression", body);
        return toMcp(wrapRaw(data, {
          refs: autoRefs(data),
          nextSteps: dryRun ? undefined : ["use get_material_graph to verify the changes"],
        }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  server.tool(
    "connect_material_pins",
    "Connect two pins in a Material or Material Function graph.",
    {
      material: z.string().optional().describe("Material name or package path. Provide either material or materialFunction."),
      materialFunction: z.string().optional().describe("Material Function name or package path. Provide either material or materialFunction."),
      sourceNodeId: z.string().describe("GUID of the source expression node"),
      sourcePinName: z.string().describe("Name of the output pin on the source node"),
      targetNodeId: z.string().describe("GUID of the target expression node (or 'Result' for the material result node)"),
      targetPinName: z.string().describe("Name of the input pin on the target node"),
      dryRun: z.boolean().optional().describe("If true, preview changes without modifying the asset"),
    },
    async ({ material, materialFunction, sourceNodeId, sourcePinName, targetNodeId, targetPinName, dryRun }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      if (!material && !materialFunction) return toMcp(fail("INVALID_PARAMS", "Provide either 'material' or 'materialFunction'"));

      const body: Record<string, any> = { sourceNodeId, sourcePinName, targetNodeId, targetPinName };
      if (material) body.material = material;
      if (materialFunction) body.materialFunction = materialFunction;
      if (dryRun) body.dryRun = true;

      try {
        const data = await uePost("/api/connect-material-pins", body);
        return toMcp(wrapRaw(data, {
          refs: autoRefs(data),
          nextSteps: dryRun ? undefined : ["use get_material_graph to verify the connection"],
        }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  server.tool(
    "disconnect_material_pin",
    "Disconnect all links from a specific pin in a Material or Material Function graph.",
    {
      material: z.string().optional().describe("Material name or package path. Provide either material or materialFunction."),
      materialFunction: z.string().optional().describe("Material Function name or package path. Provide either material or materialFunction."),
      nodeId: z.string().describe("GUID of the expression node containing the pin"),
      pinName: z.string().describe("Name of the pin to disconnect"),
      dryRun: z.boolean().optional().describe("If true, preview changes without modifying the asset"),
    },
    async ({ material, materialFunction, nodeId, pinName, dryRun }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      if (!material && !materialFunction) return toMcp(fail("INVALID_PARAMS", "Provide either 'material' or 'materialFunction'"));

      const body: Record<string, any> = { nodeId, pinName };
      if (material) body.material = material;
      if (materialFunction) body.materialFunction = materialFunction;
      if (dryRun) body.dryRun = true;

      try {
        const data = await uePost("/api/disconnect-material-pin", body);
        return toMcp(wrapRaw(data, {
          refs: autoRefs(data),
          nextSteps: dryRun ? undefined : ["use get_material_graph to verify the changes"],
        }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  server.tool(
    "set_expression_value",
    "Set the value of a material expression (constants, parameter defaults, custom code, etc.) in a Material or Material Function.",
    {
      material: z.string().optional().describe("Material name or package path. Provide either material or materialFunction."),
      materialFunction: z.string().optional().describe("Material Function name or package path. Provide either material or materialFunction."),
      nodeId: z.string().describe("GUID of the expression node"),
      value: z.union([
        z.number(),
        z.object({ r: z.number(), g: z.number(), b: z.number(), a: z.number().optional() }),
        z.string(),
      ]).describe("Value to set: number (for scalar), {r,g,b,a?} (for vector/color), or string"),
      parameterName: z.string().optional().describe("Parameter name override (for parameter expressions)"),
      code: z.string().optional().describe("Custom HLSL code (for Custom expression nodes)"),
      dryRun: z.boolean().optional().describe("If true, preview changes without modifying the Material"),
    },
    async ({ material, materialFunction, nodeId, value, parameterName, code, dryRun }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      if (!material && !materialFunction) return toMcp(fail("INVALID_PARAMS", "Provide either 'material' or 'materialFunction'"));

      const body: Record<string, any> = { nodeId, value };
      if (material) body.material = material;
      if (materialFunction) body.materialFunction = materialFunction;
      if (parameterName) body.parameterName = parameterName;
      if (code) body.code = code;
      if (dryRun) body.dryRun = true;

      try {
        const data = await uePost("/api/set-expression-value", body);
        return toMcp(wrapRaw(data, {
          refs: autoRefs(data),
          nextSteps: dryRun ? undefined : ["use get_material_graph to verify the changes"],
        }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  server.tool(
    "move_material_expression",
    "Move a material expression node to a new position in the graph editor of a Material or Material Function.",
    {
      material: z.string().optional().describe("Material name or package path. Provide either material or materialFunction."),
      materialFunction: z.string().optional().describe("Material Function name or package path. Provide either material or materialFunction."),
      nodeId: z.string().describe("GUID of the expression node to move"),
      posX: z.number().describe("New X position"),
      posY: z.number().describe("New Y position"),
      dryRun: z.boolean().optional().describe("If true, preview changes without modifying the asset"),
    },
    async ({ material, materialFunction, nodeId, posX, posY, dryRun }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      if (!material && !materialFunction) return toMcp(fail("INVALID_PARAMS", "Provide either 'material' or 'materialFunction'"));

      const body: Record<string, any> = { nodeId, posX, posY };
      if (material) body.material = material;
      if (materialFunction) body.materialFunction = materialFunction;
      if (dryRun) body.dryRun = true;

      try {
        const data = await uePost("/api/move-material-expression", body);
        return toMcp(wrapRaw(data, { refs: autoRefs(data) }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  // ---------------------------------------------------------------------------
  // Phase 3: Material Instances
  // ---------------------------------------------------------------------------

  server.tool(
    "create_material_instance",
    "Create a new Material Instance asset with a specified parent material.",
    {
      name: z.string().describe("Material Instance asset name (e.g. 'MI_MyMaterial')"),
      packagePath: z.string().default("/Game").describe("Package path to create the instance in (e.g. '/Game/Materials')"),
      parentMaterial: z.string().describe("Parent material name or package path (e.g. 'M_MyMaterial')"),
    },
    async ({ name, packagePath, parentMaterial }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      const body: Record<string, any> = { name, packagePath, parentMaterial };

      try {
        const data = await uePost("/api/create-material-instance", body);
        return toMcp(wrapRaw(data, {
          refs: autoRefs(data),
          nextSteps: [
            "use set_material_instance_parameter to override parameter values",
            "use get_material_instance_parameters to inspect available parameters",
          ],
        }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  server.tool(
    "set_material_instance_parameter",
    "Override a parameter value in a Material Instance.",
    {
      materialInstance: z.string().describe("Material Instance name or package path (e.g. 'MI_MyMaterial')"),
      parameterName: z.string().describe("Name of the parameter to override"),
      value: z.union([
        z.number(),
        z.object({ r: z.number(), g: z.number(), b: z.number(), a: z.number().optional() }),
        z.string(),
        z.boolean(),
      ]).describe("Value to set: number (scalar), {r,g,b,a?} (vector/color), string (texture path), or boolean (static switch)"),
      type: z.enum(["scalar", "vector", "texture", "staticSwitch"]).optional().describe("Parameter type hint (auto-detected if omitted)"),
      dryRun: z.boolean().optional().describe("If true, preview changes without modifying the Material Instance"),
    },
    async ({ materialInstance, parameterName, value, type, dryRun }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      const body: Record<string, any> = { materialInstance, parameterName, value };
      if (type) body.type = type;
      if (dryRun) body.dryRun = true;

      try {
        const data = await uePost("/api/set-material-instance-parameter", body);
        return toMcp(wrapRaw(data, {
          refs: autoRefs(data),
          nextSteps: dryRun ? undefined : ["use get_material_instance_parameters to verify all overrides"],
        }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  server.tool(
    "get_material_instance_parameters",
    "Get all parameters of a Material Instance, showing which are overridden vs inherited from parent.",
    {
      name: z.string().describe("Material Instance name or package path (e.g. 'MI_MyMaterial')"),
    },
    async ({ name }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      try {
        const data = await ueGet("/api/material-instance-params", { name });
        return toMcp(wrapRaw(data, { refs: autoRefs(data) }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  server.tool(
    "reparent_material_instance",
    "Change the parent of a Material Instance to a different Material or Material Instance.",
    {
      materialInstance: z.string().describe("Material Instance name or package path (e.g. 'MI_MyMaterial')"),
      newParent: z.string().describe("New parent material name or package path (e.g. 'M_NewParent')"),
      dryRun: z.boolean().optional().describe("If true, preview changes without modifying the Material Instance"),
    },
    async ({ materialInstance, newParent, dryRun }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      const body: Record<string, any> = { materialInstance, newParent };
      if (dryRun) body.dryRun = true;

      try {
        const data = await uePost("/api/reparent-material-instance", body);
        return toMcp(wrapRaw(data, {
          refs: autoRefs(data),
          nextSteps: dryRun ? undefined : [
            "use get_material_instance_parameters to check parameter compatibility",
            "use set_material_instance_parameter to update overrides if needed",
          ],
        }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  // ---------------------------------------------------------------------------
  // Phase 4: Create Material Function
  // ---------------------------------------------------------------------------

  server.tool(
    "create_material_function",
    "Create a new Material Function asset.",
    {
      name: z.string().describe("Material Function asset name (e.g. 'MF_MyFunction')"),
      packagePath: z.string().default("/Game").describe("Package path to create the function in (e.g. '/Game/Materials/Functions')"),
      description: z.string().optional().describe("Description of the material function"),
    },
    async ({ name, packagePath, description }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      const body: Record<string, any> = { name, packagePath };
      if (description) body.description = description;

      try {
        const data = await uePost("/api/create-material-function", body);
        return toMcp(wrapRaw(data, {
          refs: autoRefs(data),
          nextSteps: [
            "use add_material_expression to add expression nodes to the function",
            "use connect_material_pins to wire expressions together",
          ],
        }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  // ---------------------------------------------------------------------------
  // Phase 5: Snapshot/Diff/Restore
  // ---------------------------------------------------------------------------

  server.tool(
    "snapshot_material_graph",
    "Take a snapshot of a Material's graph for later comparison or restoration.",
    {
      material: z.string().describe("Material name or package path (e.g. 'M_MyMaterial')"),
    },
    async ({ material }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      try {
        const data = await uePost("/api/snapshot-material-graph", { material });
        return toMcp(wrapRaw(data, {
          refs: autoRefs(data),
          nextSteps: [
            "make your changes to the material",
            "use diff_material_graph to see what changed",
            "use restore_material_graph to reconnect severed pins",
          ],
        }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  server.tool(
    "diff_material_graph",
    "Compare a Material's current graph against a previously taken snapshot.",
    {
      material: z.string().describe("Material name or package path (e.g. 'M_MyMaterial')"),
      snapshotId: z.string().describe("Snapshot ID from snapshot_material_graph"),
    },
    async ({ material, snapshotId }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      try {
        const data = await uePost("/api/diff-material-graph", { material, snapshotId });
        return toMcp(wrapRaw(data, {
          refs: autoRefs(data),
          nextSteps: data?.severedConnections?.length
            ? ["use restore_material_graph to reconnect severed pins"]
            : undefined,
        }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  server.tool(
    "restore_material_graph",
    "Restore severed connections in a Material's graph from a snapshot.",
    {
      material: z.string().describe("Material name or package path (e.g. 'M_MyMaterial')"),
      snapshotId: z.string().describe("Snapshot ID from snapshot_material_graph"),
      dryRun: z.boolean().optional().describe("If true, preview reconnections without making changes"),
    },
    async ({ material, snapshotId, dryRun }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      const body: Record<string, any> = { material, snapshotId };
      if (dryRun) body.dryRun = true;

      try {
        const data = await uePost("/api/restore-material-graph", body);
        const nextSteps: string[] = [];
        if (dryRun) nextSteps.push("re-run restore_material_graph without dryRun to apply changes");
        if ((data?.failed ?? 0) > 0) nextSteps.push("fix failed reconnection(s) manually with connect_material_pins");
        nextSteps.push("use get_material_graph to verify the final state");
        return toMcp(wrapRaw(data, { refs: autoRefs(data), nextSteps }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  // ---------------------------------------------------------------------------
  // Material Validation
  // ---------------------------------------------------------------------------

  server.tool(
    "validate_material",
    "Force-recompile a Material and check for compilation errors. Returns valid/invalid status with error details.",
    {
      material: z.string().describe("Material name or package path (e.g. 'M_MyMaterial')"),
    },
    async ({ material }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      try {
        const data = await uePost("/api/validate-material", { material });
        return toMcp(wrapRaw(data, {
          refs: autoRefs(data),
          nextSteps: data?.valid ? undefined : [
            "use get_material_graph to inspect the graph",
            "fix the errors and re-validate",
          ],
        }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );
}
