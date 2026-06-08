import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ensureUE, uePost } from "../ue-bridge.js";
import { TYPE_NAME_DOCS } from "../helpers.js";
import { toMcp, wrapRaw, autoRefs, fail } from "../types.js";

export function registerVariableTools(server: McpServer): void {
  server.tool(
    "change_variable_type",
    `Change a Blueprint member variable's type. Supports structs, enums, and object reference types. Compiles and saves the Blueprint. Downstream Make/Break nodes using the old type will need manual fixing. ${TYPE_NAME_DOCS} For object references, either use colon syntax in newType (e.g. 'object:Actor') or pass typeCategory + class name in newType. Pass dryRun=true to preview changes without saving.`,
    {
      blueprint: z.string().describe("Blueprint name or package path (e.g. 'BP_PatientManager')"),
      variable: z.string().describe("Variable name (e.g. 'Vitals')"),
      newType: z.string().describe("New type name: struct ('FVitals'), enum ('ELungSound'), or colon syntax for references ('object:Actor', 'class:Actor', 'softobject:Actor', 'softclass:Actor', 'interface:MyInterface')"),
      typeCategory: z.enum(["struct", "enum", "object", "softobject", "class", "softclass", "interface"]).optional().describe("Type category. Optional — auto-detected from newType when using colon syntax or F/E prefix."),
      dryRun: z.boolean().optional().describe("If true, preview changes without modifying the Blueprint"),
      batch: z.array(z.object({
        blueprint: z.string(),
        variable: z.string(),
        newType: z.string(),
        typeCategory: z.enum(["struct", "enum", "object", "softobject", "class", "softclass", "interface"]).optional(),
      })).optional().describe("Batch mode: array of {blueprint, variable, newType, typeCategory?} objects. When provided, single params are ignored."),
    },
    async ({ blueprint, variable, newType, typeCategory, dryRun, batch }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      const body: Record<string, any> = batch
        ? { batch }
        : { blueprint, variable, newType, typeCategory };
      if (dryRun) body.dryRun = true;

      try {
        const data = await uePost("/api/change-variable-type", body);
        return toMcp(wrapRaw(data, {
          refs: autoRefs(data),
          nextSteps: dryRun ? undefined : [
            "run refresh_all_nodes to update all nodes in the Blueprint",
            "check Break/Make struct nodes \u2014 they may need change_struct_node_type",
          ],
        }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  server.tool(
    "add_variable",
    `Add a new member variable to a Blueprint. Supports simple types (bool, int, float, string, name, text, byte), built-in structs (vector, rotator, transform), and custom struct/enum types. ${TYPE_NAME_DOCS}`,
    {
      blueprint: z.string().describe("Blueprint name or package path"),
      variableName: z.string().describe("Name for the new variable (e.g. 'Health', 'bIsActive')"),
      variableType: z.string().describe("Type: 'bool', 'int', 'float', 'string', 'name', 'text', 'byte', 'vector', 'rotator', 'transform', or struct/enum name (e.g. 'FVitals', 'EMyEnum')"),
      category: z.string().optional().describe("Variable category for organization in the Blueprint editor"),
      isArray: z.boolean().optional().describe("Create as an array variable (default: false)"),
      defaultValue: z.string().optional().describe("Default value as a string (e.g. 'true', '42', '0.5')"),
    },
    async ({ blueprint, variableName, variableType, category, isArray, defaultValue }) => {
      const err = await ensureUE();
      if (err) return { content: [{ type: "text" as const, text: err }] };

      const body: Record<string, any> = { blueprint, variableName, variableType };
      if (category) body.category = category;
      if (isArray !== undefined) body.isArray = isArray;
      if (defaultValue !== undefined) body.defaultValue = defaultValue;

      try {
        const data = await uePost("/api/add-variable", body);
        return toMcp(wrapRaw(data, {
          refs: autoRefs(data),
          nextSteps: [
            `add_node(blueprint="${blueprint}", nodeType="VariableGet", variableName="${variableName}") to read it`,
            `add_node(blueprint="${blueprint}", nodeType="VariableSet", variableName="${variableName}") to write it`,
          ],
        }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  server.tool(
    "remove_variable",
    "Remove a member variable from a Blueprint. Also cleans up any VariableGet/VariableSet nodes referencing it.",
    {
      blueprint: z.string().describe("Blueprint name or package path"),
      variableName: z.string().describe("Name of the variable to remove"),
    },
    async ({ blueprint, variableName }) => {
      const err = await ensureUE();
      if (err) return { content: [{ type: "text" as const, text: err }] };

      try {
        const data = await uePost("/api/remove-variable", { blueprint, variableName });
        return toMcp(wrapRaw(data, { refs: autoRefs(data) }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  server.tool(
    "set_variable_metadata",
    "Set variable properties beyond type: category, tooltip, replication, exposeOnSpawn, editability, isPrivate, blueprintReadOnly, and slider/clamp ranges. Provide any combination of fields to update.",
    {
      blueprint: z.string().describe("Blueprint name or package path"),
      variable: z.string().describe("Variable name"),
      category: z.string().optional().describe("Variable category for organization in the editor"),
      tooltip: z.string().optional().describe("Tooltip text shown in the editor"),
      replication: z.enum(["none", "replicated", "repNotify"]).optional().describe("Replication mode"),
      exposeOnSpawn: z.boolean().optional().describe("Whether to expose the variable as a pin on SpawnActor"),
      editability: z.enum(["editAnywhere", "editDefaultsOnly", "editInstanceOnly", "none"]).optional()
        .describe("Edit visibility: editAnywhere (CDO + instances), editDefaultsOnly (CDO only), editInstanceOnly (instances only), none"),
      isPrivate: z.boolean().optional().describe("Mark variable as private (only accessible within this Blueprint)"),
      blueprintReadOnly: z.boolean().optional().describe("Blueprint Read Only — readable in graphs but not settable (CPF_BlueprintReadOnly)"),
      sliderMin: z.number().optional().describe("Details-panel slider minimum (UIMin metadata)"),
      sliderMax: z.number().optional().describe("Details-panel slider maximum (UIMax metadata)"),
      clampMin: z.number().optional().describe("Hard clamp minimum on the value (ClampMin metadata)"),
      clampMax: z.number().optional().describe("Hard clamp maximum on the value (ClampMax metadata)"),
    },
    async ({ blueprint, variable, category, tooltip, replication, exposeOnSpawn, editability, isPrivate, blueprintReadOnly, sliderMin, sliderMax, clampMin, clampMax }) => {
      const err = await ensureUE();
      if (err) return { content: [{ type: "text" as const, text: err }] };

      const body: Record<string, any> = { blueprint, variable };
      if (category !== undefined) body.category = category;
      if (tooltip !== undefined) body.tooltip = tooltip;
      if (replication !== undefined) body.replication = replication;
      if (exposeOnSpawn !== undefined) body.exposeOnSpawn = exposeOnSpawn;
      if (editability !== undefined) body.editability = editability;
      if (isPrivate !== undefined) body.isPrivate = isPrivate;
      if (blueprintReadOnly !== undefined) body.blueprintReadOnly = blueprintReadOnly;
      if (sliderMin !== undefined) body.sliderMin = sliderMin;
      if (sliderMax !== undefined) body.sliderMax = sliderMax;
      if (clampMin !== undefined) body.clampMin = clampMin;
      if (clampMax !== undefined) body.clampMax = clampMax;

      try {
        const data = await uePost("/api/set-variable-metadata", body);
        return toMcp(wrapRaw(data, { refs: autoRefs(data) }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );
}
