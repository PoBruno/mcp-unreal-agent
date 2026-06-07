---
name: tool-chains
description: Designing composite UE5 tools and chaining existing ones via the ID-passing contract. Use when adding a new tool, designing a multi-step flow, or refactoring primitives into a composite atomic flow.
---

# Tool chains

This skill captures how MCP tools in `unreal-agent` chain together to form workflows. Read it before designing any new tool or composite.

## The chaining model

Every tool returns `refs` (named IDs) and `nextSteps` (hints). The agent consumes them as inputs to the next call. This makes multi-step workflows feel like dataflow:

```
bp_create({ name, parentClass })
   → refs: { blueprintId }
       ↓
bp_add_variable({ blueprintId, variable: { name, type } })
   → refs: { blueprintId, variableName }
       ↓
bp_compile({ blueprintId })
   → refs: { blueprintId }
   → warnings: ["compile took 2.3s"]
```

The agent never has to parse text. It passes IDs forward.

## When to write a composite (vs. a primitive)

Write a **composite** if all of these are true:
- The flow is at least 3 primitives.
- All primitives belong in one undoable unit.
- A failure mid-flow should roll back, not leave a half-mutated state.
- Agents will commonly want the whole flow, not parts of it.

Write a **primitive** if:
- The operation is a single conceptual mutation.
- Agents might want to interleave it with other domain operations.
- Composing on the agent side gives meaningful flexibility.

Both can coexist. `bp_create_with_variables` is a composite; the underlying `bp_add_variable` stays as a primitive.

## Composite implementation pattern (C++ side)

```cpp
TSharedPtr<FJsonObject> UUnrealAgentServer::HandleBPCreateWithVariables(TSharedPtr<FJsonObject> Req)
{
    FScopedTransaction Trans(LOCTEXT("CreateBPWithVars", "Create BP with variables"));

    // Step 1: create
    UBlueprint* BP = CreateBlueprintInternal(Req);
    if (!BP) { Trans.Cancel(); return MakeErrorJson("BP_CREATE_FAILED", "..."); }

    // Step 2: add each variable (no separate transactions)
    for (auto& VarSpec : ExtractVariables(Req)) {
        if (!AddVariableInternal(BP, VarSpec)) {
            Trans.Cancel();
            return MakeErrorJson("BP_VAR_ADD_FAILED", VarSpec.Name);
        }
    }

    // Step 3: compile + save (still in same transaction)
    FString CompileErr;
    if (!TryCompileBlueprintSEH(BP, CompileErr)) {
        Trans.Cancel();
        return MakeErrorJson("BP_COMPILE_FAILED", CompileErr);
    }
    if (!SaveBlueprintPackage(BP)) {
        Trans.Cancel();
        return MakeErrorJson("BP_SAVE_FAILED", "");
    }

    // Build response with all refs
    return MakeSuccessJson({
        { "blueprintId", BP->GetPathName() },
        { "variables", BuildVariableList(BP) },
    });
}
```

Key points:
- One `FScopedTransaction` wraps the whole flow.
- Each step's failure cancels the transaction explicitly.
- The response gathers refs from the entire flow.

## Composite implementation pattern (TS side)

```ts
server.tool(
  "bp_create_with_variables",
  "Create a Blueprint with initial variables in one atomic step. Returns the new blueprintId and the created variable list. Use when you know all variables up front; use bp_create + bp_add_variable when discovering variables as you go.",
  {
    name: z.string(),
    parentClass: z.string(),
    packagePath: z.string(),
    variables: z.array(z.object({
      name: z.string(),
      type: z.string(),
      default: z.unknown().optional(),
    })),
  },
  async (args): Promise<ToolResult<{ blueprintId: string; variables: string[] }>> => {
    try {
      const data = await uePost<{ blueprintId: string; variables: string[] }>(
        "/bp/createWithVariables", args
      );
      return {
        ok: true,
        data,
        refs: { blueprintId: data.blueprintId },
        nextSteps: [
          "Inspect the new BP with bp_read_class",
          "Add components with bp_add_component if needed",
        ],
      };
    } catch (err: any) {
      return {
        ok: false,
        errorCode: err.code || "UE_HTTP_FAILED",
        warnings: [String(err.message ?? err)],
      };
    }
  }
);
```

## Ref naming convention

| Entity | Ref name | Format |
|---|---|---|
| Blueprint asset | `blueprintId` | `/Game/Path/BP_Name` |
| Material asset | `materialId` | `/Game/Path/M_Name` |
| Material instance | `materialInstanceId` | `/Game/Path/MI_Name` |
| Static mesh | `meshId` | `/Game/Path/SM_Name` |
| Skeletal mesh | `skeletalMeshId` | `/Game/Path/SK_Name` |
| Animation sequence | `animSequenceId` | `/Game/Path/A_Name` |
| Level sequence | `sequenceId` | `/Game/Path/LS_Name` |
| Sequencer section | `sectionId` | guid in sequence |
| Sequencer track | `trackId` | guid in sequence |
| Actor in level | `actorId` | actor guid |
| MRQ job | `mrqJobId` | opaque UUID |
| Async job (cook, package) | `jobId` | opaque UUID |
| C++ symbol | `symbolPath` | `Module.UClassName::FunctionName` |

If you add a new entity type, add it to this table.

## nextSteps writing guide

- Phrase as suggestions, never imperatives.
- ✅ "You can compile with bp_compile to verify the graph is valid."
- ✅ "Consider running bp_validate if the BP references nodes from external modules."
- ❌ "Call bp_compile now." (imperative — the agent decides timing)
- ❌ "Make sure to compile." (vague — name the tool)

Keep nextSteps to 1-3 items. More than that is noise.

## warnings vs errorCode

- **warnings:** operation succeeded but something deserves attention. Examples: "asset was dirty before save", "deprecated field 'X' was used".
- **errorCode:** operation failed. Always paired with `ok: false`.

Never use `warnings` to signal failure. Never use `errorCode` to signal a success caveat.

## When to refactor primitives into a composite

Trigger conditions, any one of which justifies the refactor:
- Agents repeatedly chain the same N primitives in the same order.
- The chain has failure modes that leave bad state.
- The agent burns >2k tokens orchestrating the chain.
- The flow needs to be atomic for undo.

Process:
1. Add the composite as a new tool. Don't remove the primitives.
2. Add an integration test that proves the composite is atomic (mid-flow error → no asset mutations persisted).
3. Update the relevant tool's description to point at the composite for the common case.
4. Document the composite in the skill that owns its domain.
