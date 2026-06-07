---
applyTo: "Tools/src/tools/**/*.ts"
---

# MCP tool contract

Apply to any file under `Tools/src/tools/`. Mirror of [`.claude/rules/mcp-tools.md`](../../.claude/rules/mcp-tools.md). This is the **tool contract** — it is the agent-facing API.

## Required output shape

```ts
export type ToolResult<T = unknown> = {
  ok: boolean;
  data?: T;
  refs?: Record<string, string>;
  nextSteps?: string[];
  warnings?: string[];
  errorCode?: string;
};
```

| Field | Meaning |
|---|---|
| `ok` | `true` if the operation succeeded as intended. `false` means the caller must check `errorCode`. |
| `data` | Tool-specific result payload. Type-parameterized. |
| `refs` | Map of named IDs the agent can pass to other tools. Names follow `<entityType>Id` convention: `blueprintId`, `materialId`, `actorId`, `sequenceId`, `mrqJobId`. |
| `nextSteps` | Free-form hints for the agent. Never imperative. Phrased as "you can call X next" or "consider Y if Z". |
| `warnings` | Non-fatal issues. The operation succeeded but something deserves attention (deprecated input field, asset was dirty before save, etc.). |
| `errorCode` | Stable machine-readable code from the registry below. Always set when `ok=false`. Never invent new codes without adding them here. |

## Error code registry

| Code | When |
|---|---|
| `UE_NOT_RUNNING` | Plugin HTTP server unreachable. Caller should try `ensureUE()`. |
| `UE_HTTP_FAILED` | HTTP call to plugin returned non-2xx or threw. |
| `BP_NOT_FOUND` | Blueprint asset doesn't exist at given path. |
| `BP_COMPILE_FAILED` | Compile produced errors. Errors in `data.errors`. |
| `BP_SAVE_FAILED` | Save returned false (read-only file, source control lock, etc.). |
| `ASSET_NOT_FOUND` | Any non-BP asset missing. |
| `MAT_PARAM_NOT_FOUND` | Named material parameter doesn't exist on target material. |
| `SEQ_TRACK_NOT_FOUND` | Named sequencer track doesn't exist on sequence. |
| `MRQ_JOB_FAILED` | MovieRenderQueue job exited with error. |
| `INVALID_PARAMS` | Input failed Zod validation (this comes from the registration wrapper, not your handler). |
| `EDITOR_REQUIRED` | Operation needs a live editor (e.g. PIE start). Commandlet mode can't do it. |
| `TRANSACTION_FAILED` | C++ side could not begin or commit transaction. |
| `SEH_EXCEPTION` | Native code raised structured exception (compile, save). Asset state may be inconsistent — caller should reload. |

Add new codes here AND in [`.claude/rules/mcp-tools.md`](../../.claude/rules/mcp-tools.md). Keep both files in sync.

## Input validation with Zod

Every tool registers with a Zod schema:

```ts
import { z } from "zod";

server.tool(
  "bp_set_variable",
  "Set a variable's default value on a Blueprint class. Returns the updated value and signals if a recompile is needed.",
  {
    blueprintId: z.string().describe("Blueprint asset path or ID from refs"),
    variableName: z.string(),
    value: z.union([z.string(), z.number(), z.boolean()]),
  },
  async ({ blueprintId, variableName, value }) => {
    // implementation
  }
);
```

- Every parameter gets `.describe()` with what the agent needs to know.
- Optional parameters use `.optional()`, never `| undefined` in the type.
- IDs accepted as opaque strings — never tightly typed as `BlueprintId<"uuid">`. The agent passes back whatever `refs` it got.

## ID chaining

Tools that create or locate something put the ID in `refs`. Tools that consume it accept it as a string param. Convention:

| Tool returns | Other tools consume as |
|---|---|
| `refs.blueprintId` | `blueprintId` param |
| `refs.materialId` | `materialId` param |
| `refs.actorId` | `actorId` param |
| `refs.sequenceId` | `sequenceId` param |
| `refs.mrqJobId` | `jobId` param (legacy name kept) |

When designing a new tool, look at the call site flow:

1. What does the agent know before calling this? (those are inputs)
2. What does the agent need next? (those become `refs` + `nextSteps`)

## Tool descriptions

The description string is what the agent reads when deciding to call the tool. Write for the agent:

- ✅ "Compile a Blueprint and return any errors. Call after mutations that change the graph or class layout."
- ❌ "Compiles BP" (too terse)
- ❌ "This tool will compile a Blueprint asset using FKismetEditorUtilities::CompileBlueprint via SEH-wrapped C++ handler returning errors as structured payload" (implementation noise, wastes tokens)

Keep under 200 chars for simple tools. Use multi-line structured descriptions for complex tools with multiple modes (`dryRun`, etc.).

## Tests are mandatory

Every new tool gets an integration test at `Tools/test/tools/<tool-name>.test.ts`. Use the bootstrap from `Tools/test/bootstrap.ts` which spawns a temp UE project + commandlet. Patterns at `Tools/test/helpers.ts`.

Test cases required:
- Happy path with valid inputs.
- Each `errorCode` branch reachable from input validation or domain failure.
- Idempotency where applicable (calling twice yields same result).
- Cleanup — tests must not leak assets to the temp project's persistent state.
