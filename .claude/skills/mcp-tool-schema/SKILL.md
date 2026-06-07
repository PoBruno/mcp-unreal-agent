---
name: mcp-tool-schema
description: How to design and register a new MCP tool — input schema (Zod), output contract, descriptions, tests. Read before adding any new tool to Tools/src/tools/.
---

# MCP tool schema

This skill is the checklist for adding a new tool. Read it end-to-end before writing the tool file.

## Checklist

- [ ] Tool belongs in a tool group file under `Tools/src/tools/<group>.ts`. Pick an existing one if the domain matches; create a new file if it doesn't.
- [ ] Tool name follows `<domain>_<verb>[<_qualifier>]`: `bp_create`, `bp_create_with_variables`, `mat_set_param`, `seq_add_keyframe`.
- [ ] Zod schema for every input parameter, with `.describe()` on each.
- [ ] Return type is `Promise<ToolResult<T>>` where `T` is the success payload shape.
- [ ] On success: populate `data`, `refs`, optionally `nextSteps`, optionally `warnings`.
- [ ] On failure: `ok: false`, `errorCode` from the registry, `warnings` with detail.
- [ ] Description string written for the LLM consuming the tool — under 200 chars for simple, structured multi-line for complex.
- [ ] Integration test in `Tools/test/tools/<tool-name>.test.ts` covering happy path, every `errorCode` branch, idempotency where applicable.
- [ ] C++ handler exists if needed, registered in `UnrealAgentServer::Start()`, follows the handler pattern from `.claude/rules/cpp-ue.md`.
- [ ] If a new `errorCode` is introduced: added to both `.claude/rules/mcp-tools.md` and `.github/instructions/mcp-tools.instructions.md`.
- [ ] If a new entity type is introduced: added to the ref naming table in `.claude/skills/tool-chains/SKILL.md`.

## Tool file template

```ts
// Tools/src/tools/my-domain.ts
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { uePost, ueGet } from "../ue-bridge.js";
import type { ToolResult } from "../types.js";

const SetParamInput = {
  materialId: z.string().describe("Material asset path or ID from refs"),
  parameterName: z.string().describe("Exact parameter name on the material"),
  value: z.union([z.number(), z.array(z.number()).length(4)])
    .describe("Scalar or RGBA (4-float array)"),
};

type SetParamData = {
  materialId: string;
  parameterName: string;
  appliedValue: number | number[];
};

export function registerMyDomainTools(server: McpServer) {
  server.tool(
    "mat_set_param",
    "Set a scalar or vector parameter on a material. Returns the applied value (echoed back so you can confirm coercion).",
    SetParamInput,
    async ({ materialId, parameterName, value }): Promise<ToolResult<SetParamData>> => {
      try {
        const data = await uePost<SetParamData>("/material/setParameter", {
          materialId, parameterName, value,
        });
        return {
          ok: true,
          data,
          refs: { materialId: data.materialId },
          nextSteps: [
            "Call mat_save to persist the change to disk.",
            "Call mat_get_param to verify the value round-trips.",
          ],
        };
      } catch (err: any) {
        const code = err.code ?? "UE_HTTP_FAILED";
        return {
          ok: false,
          errorCode: code,
          warnings: [String(err.message ?? err)],
        };
      }
    }
  );
}
```

Then register the group in `Tools/src/index.ts`:

```ts
import { registerMyDomainTools } from "./tools/my-domain.js";
// ...
registerMyDomainTools(server);
```

## Description writing rules

**Audience:** the LLM agent (Claude, Copilot, etc.) deciding whether to call this tool.

**Pattern:**
```
<verb> <object>. <result statement>. <when to use, optional>.
```

Examples:
- ✅ "Compile a Blueprint and return any errors. Call after mutations that change graph structure or class layout."
- ✅ "List all Blueprints under a content browser folder. Returns ids and class names."
- ✅ "Create a Blueprint with variables in one atomic step. Use when you know all variables up front; use bp_create + bp_add_variable when discovering variables as you go."
- ❌ "Compiles BP" (terse, no result info)
- ❌ "Uses FKismetEditorUtilities to compile" (implementation noise)
- ❌ "This tool will compile your blueprint asset using the C++ handler over HTTP" (verbose noise)

**Length budget:**
- Simple tool: under 200 chars.
- Tool with modes (`dryRun`, multiple input variants): use a multi-line description with bullet points for each mode.

## Test file template

```ts
// Tools/test/tools/mat_set_param.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { uePost, ueGet, createTestMaterial, deleteTestMaterial, uniqueName } from "../helpers.js";

describe("mat_set_param", () => {
  const matName = uniqueName("M_TestSetParam");
  const matPath = `/Game/Test/${matName}`;

  beforeAll(async () => {
    const created = await createTestMaterial({
      name: matName,
      package: "/Game/Test",
      scalarParams: [{ name: "TestScalar", default: 0.5 }],
    });
    expect(created.error).toBeUndefined();
  });

  afterAll(async () => {
    await deleteTestMaterial(matPath);
  });

  it("sets a scalar parameter and returns the applied value", async () => {
    const result = await uePost("/material/setParameter", {
      materialId: matPath,
      parameterName: "TestScalar",
      value: 0.75,
    });
    expect(result.ok).toBe(true);
    expect(result.data.appliedValue).toBe(0.75);
    expect(result.refs.materialId).toBe(matPath);
  });

  it("returns MAT_PARAM_NOT_FOUND for unknown parameter", async () => {
    const result = await uePost("/material/setParameter", {
      materialId: matPath,
      parameterName: "DoesNotExist",
      value: 1.0,
    });
    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe("MAT_PARAM_NOT_FOUND");
  });

  it("is idempotent — setting same value twice has no warnings on second call", async () => {
    await uePost("/material/setParameter", { materialId: matPath, parameterName: "TestScalar", value: 0.42 });
    const result = await uePost("/material/setParameter", { materialId: matPath, parameterName: "TestScalar", value: 0.42 });
    expect(result.ok).toBe(true);
    expect(result.warnings ?? []).toHaveLength(0);
  });
});
```

## Common mistakes

- **Forgetting `.describe()` on Zod schema fields.** The agent can't tell what a field means without it. Required.
- **Returning success with `data: null`.** If the operation succeeded with no data, return `data: {}` or skip `data`. Never `null`.
- **Using `nextSteps` as documentation.** They're operational hints for the next call, not general docs.
- **Catching errors in JS but losing the C++ `errorCode`.** Bridge it: `err.code` from `ue-bridge.ts` carries the C++ side's `errorCode`. Don't overwrite with `UE_HTTP_FAILED` if `err.code` is set.
- **Creating refs the agent can't use.** Every ref should be something another tool actually accepts. Check the ref naming table in `tool-chains/SKILL.md`.
