---
applyTo: "Tools/src/tools/**/*.ts"
---

# MCP tool contract

Apply to every file under `Tools/src/tools/`. This is the **agent-facing API contract**. Mirror of [`.github/instructions/mcp-tools.instructions.md`](../../.github/instructions/mcp-tools.instructions.md) — keep in sync.

## Required output shape

```ts
export type ToolResult<T = unknown> = {
  ok: boolean;
  data?: T;
  refs?: Record<string, string | string[]>;
  nextSteps?: string[];
  warnings?: string[];
  errorCode?: string;
};
```

| Field | Meaning |
|---|---|
| `ok` | `true` if operation succeeded. `false` → caller must inspect `errorCode`. |
| `data` | Tool-specific result payload. Type-parameterized. |
| `refs` | Map of named IDs the agent passes to subsequent tools. Single id (`<entity>Id`: `blueprintId`, `materialId`, …) or an id list for enumerations (`<entity>Ids`: `blueprintIds`). |
| `nextSteps` | Free-form hints. Never imperative — phrased as "you can call X next" or "consider Y if Z". |
| `warnings` | Non-fatal issues. Operation succeeded but something deserves attention. |
| `errorCode` | Stable code from the registry. Always set when `ok=false`. Never invent codes without adding to registry. |

## Error code registry

| Code | When |
|---|---|
| `UE_NOT_RUNNING` | Plugin HTTP server unreachable. Caller should try `ensureUE()`. |
| `UE_HTTP_FAILED` | HTTP call to plugin returned non-2xx or threw. |
| `BP_NOT_FOUND` | Blueprint asset missing. |
| `BP_COMPILE_FAILED` | Compile produced errors. Errors in `data.errors`. |
| `BP_SAVE_FAILED` | Save returned false (read-only, source control lock). |
| `ASSET_NOT_FOUND` | Non-BP asset missing. |
| `MAT_PARAM_NOT_FOUND` | Named material parameter doesn't exist. |
| `SEQ_TRACK_NOT_FOUND` | Named sequencer track doesn't exist. |
| `MRQ_JOB_FAILED` | MovieRenderQueue job exited with error. |
| `INVALID_PARAMS` | Input failed Zod validation (registration wrapper, not your handler). |
| `EDITOR_REQUIRED` | Operation needs live editor (PIE start, etc.). Commandlet can't do it. |
| `TRANSACTION_FAILED` | C++ couldn't begin or commit transaction. |
| `SEH_EXCEPTION` | Native code raised structured exception. Asset state may be inconsistent — caller should reload. |

Add new codes here AND in [`.github/instructions/mcp-tools.instructions.md`](../../.github/instructions/mcp-tools.instructions.md). Keep both in sync.

## Input validation with Zod

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
  async ({ blueprintId, variableName, value }) => { /* impl */ }
);
```

- Every parameter `.describe()`d with what the agent needs to know.
- Optional via `.optional()`, never `| undefined`.
- IDs as opaque strings — never tightly typed.

## ID chaining convention

`refs` are emitted under the EXACT key the consuming tool accepts as input (ADR-009),
so `refs.blueprint` feeds the next tool's `blueprint` param verbatim. The `<entity>Id`
convention name is kept as an alias for the same value.

| Tool returns (primary key) | + alias | Consumed by param |
|---|---|---|
| `refs.blueprint` (path/name) | `blueprintId` | `blueprint` |
| `refs.material` | `materialId` | `material` |
| `refs.actorLabel` / `refs.label` | `actorId` | `actorLabel` / `label` |
| `refs.graph` | `graphId` | `graph` |
| `refs.nodeId` | — | `nodeId` |
| `refs.assetPath` | `assetId` | `assetPath` |
| `refs.blueprintIds[]` / `refs.materialIds[]` | — | list enumerations |

When designing a tool, work backwards from the chain:
1. What does the agent know before calling? (inputs)
2. What does the agent need next? (refs + nextSteps)

## Tool descriptions

Written for the LLM agent:

- ✅ "Compile a Blueprint and return any errors. Call after mutations that change the graph or class layout."
- ❌ "Compiles BP" (too terse)
- ❌ "This tool uses FKismetEditorUtilities::CompileBlueprint via SEH-wrapped handler returning errors as structured payload" (noise, wastes tokens)

Under 200 chars for simple tools. Multi-line structured for complex tools with modes (`dryRun`, etc.).

## Tests are mandatory

Every new tool → integration test at `Tools/test/tools/<tool-name>.test.ts`. Bootstrap from `Tools/test/bootstrap.ts` spawns temp UE project + commandlet. Helpers in `Tools/test/helpers.ts`.

Required cases:
- Happy path.
- Each `errorCode` branch reachable.
- Idempotency where applicable.
- Cleanup — no leaked assets in temp project state.
