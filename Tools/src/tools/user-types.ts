import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ensureUE, uePost } from "../ue-bridge.js";
import { TYPE_NAME_DOCS } from "../helpers.js";
import { toMcp, wrapRaw, autoRefs, fail } from "../types.js";

export function registerUserTypeTools(server: McpServer): void {
  server.tool(
    "create_struct",
    `Create a new UserDefinedStruct asset. Optionally provide initial properties.\n\nType names for properties:\n${TYPE_NAME_DOCS}`,
    {
      assetPath: z.string().describe("Full asset path (e.g. '/Game/DataTypes/S_MyStruct')"),
      properties: z.array(z.object({
        name: z.string().describe("Property name"),
        type: z.string().describe("Property type (e.g. 'bool', 'int', 'float', 'string', 'FVector', 'FRotator')"),
      })).optional().describe("Initial properties to add"),
    },
    async ({ assetPath, properties }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      const body: Record<string, any> = { assetPath };
      if (properties) body.properties = properties;

      try {
        const data = await uePost("/api/create-struct", body);
        return toMcp(wrapRaw(data, {
          refs: autoRefs(data),
          nextSteps: [
            "add_struct_property to add more properties",
            "search_by_type to find usages of this struct",
          ],
        }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  server.tool(
    "create_enum",
    "Create a new UserDefinedEnum asset with the given values.",
    {
      assetPath: z.string().describe("Full asset path (e.g. '/Game/DataTypes/E_MyEnum')"),
      values: z.array(z.string()).describe("Enum value display names (e.g. ['Low', 'Medium', 'High'])"),
    },
    async ({ assetPath, values }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      try {
        const data = await uePost("/api/create-enum", { assetPath, values });
        return toMcp(wrapRaw(data, { refs: autoRefs(data) }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  server.tool(
    "add_struct_property",
    `Add a property to an existing UserDefinedStruct.\n\nType names:\n${TYPE_NAME_DOCS}`,
    {
      assetPath: z.string().describe("Struct asset path (e.g. '/Game/DataTypes/S_MyStruct')"),
      name: z.string().describe("Property name"),
      type: z.string().describe("Property type (e.g. 'bool', 'int', 'float', 'string', 'FVector')"),
    },
    async ({ assetPath, name, type }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      try {
        const data = await uePost("/api/add-struct-property", { assetPath, name, type });
        return toMcp(wrapRaw(data, { refs: autoRefs(data) }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  server.tool(
    "remove_struct_property",
    "Remove a property from an existing UserDefinedStruct.",
    {
      assetPath: z.string().describe("Struct asset path (e.g. '/Game/DataTypes/S_MyStruct')"),
      name: z.string().describe("Property name to remove"),
    },
    async ({ assetPath, name }) => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      try {
        const data = await uePost("/api/remove-struct-property", { assetPath, name });
        return toMcp(wrapRaw(data, { refs: autoRefs(data) }));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );
}
