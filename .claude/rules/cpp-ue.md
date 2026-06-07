---
applyTo: "Source/**/*.cpp, Source/**/*.h, Source/**/*.cs"
---

# Unreal C++ rules

These rules apply to all C++ files under `Source/`. They are loaded automatically by Claude Code when editing matching files. The matching Copilot version lives at [`.github/instructions/cpp-ue.instructions.md`](../../.github/instructions/cpp-ue.instructions.md) — keep both in sync.

## API choices

- **Subsystem APIs only.** Use `UEditorAssetSubsystem`, `UEditorActorSubsystem`, `ULevelEditorSubsystem`, `UAssetEditorSubsystem`. Never `UEditorAssetLibrary`, `UEditorLevelLibrary`, `UEditorAssetLibrary` — deprecated in 5.4+, may disappear in 5.6+.
- **Editing libraries are fine** where no Subsystem exists: `UMaterialEditingLibrary`, `UPhysicsAssetEditorLibrary`, `UAnimGraphNode_*` static helpers.
- **For Blueprints:** `FBlueprintEditorUtils`, `FKismetEditorUtilities`, `UEdGraphSchema_K2`.
- **For materials:** `UMaterialEditingLibrary` for parameter set/get, `UMaterialExpression*` for graph mutations.
- **For sequencer:** `UMovieSceneSequence`, `UMovieSceneSection`, `IMovieSceneTracksModule`.
- **For World Partition:** `UWorldPartitionSubsystem`, `FWorldPartitionActorDescUtils`.
- **For MRQ:** `UMoviePipelineQueueSubsystem`, `UMoviePipelineExecutorBase`, `UMoviePipelineMasterConfig`.

## Transactions and undo

Every mutation must be undoable.

```cpp
FScopedTransaction Transaction(LOCTEXT("ChangeDesc", "Human-readable description"));
Asset->Modify();
// mutation code
```

If a tool performs multiple related mutations, wrap them all in **one** `FScopedTransaction` so Ctrl+Z reverses the entire logical action. This is the C++ analogue of the composite atomic flow principle — see [.claude/docs/ARCHITECTURE.md#composite-atomic-flows](../docs/ARCHITECTURE.md).

## SEH wrapping

Native UE5 calls can crash with structured exceptions (access violations, stack overflows). Wrap these in `__try` / `__except`:

- `FKismetEditorUtilities::CompileBlueprint`
- `UPackage::SavePackage`
- `UPackageTools::SavePackages`
- Material compile / cook operations

```cpp
bool TryCompileBlueprintSEH(UBlueprint* BP, FString& OutError)
{
    __try
    {
        FKismetEditorUtilities::CompileBlueprint(BP);
        return true;
    }
    __except (EXCEPTION_EXECUTE_HANDLER)
    {
        OutError = TEXT("CompileBlueprint raised SEH exception");
        return false;
    }
}
```

SEH blocks cannot unwind C++ destructors. Keep them minimal and call a separate function for cleanup.

## Logging

Use `UE_LOG(LogUnrealAgent, Display, TEXT("..."))`. Category declared in `UnrealAgentModule.h`. Never use `UE_LOG(LogTemp, ...)` — noise.

## HTTP handler patterns

Shape:

1. Parse request body with `ParseBodyJson(Request, OutJson)`.
2. Validate required fields. Failure → `MakeErrorJson("ErrorCode", "Message")`.
3. Load target with `LoadBlueprintByName` / `LoadAssetByPath`.
4. Apply mutations inside `FScopedTransaction`.
5. Save with `SaveBlueprintPackage` / `SavePackageSEH`.
6. Return JSON via `JsonToString` with camelCase field names matching the TS contract.

Reference: `Source/UnrealAgent/Private/UnrealAgentHandlers_Mutation.cpp`.

## Threading

- HTTP processing runs on background thread.
- UE5 editor API calls run on **game thread**.
- Marshal with `AsyncTask(ENamedThreads::GameThread, [...]() { ... })`.
- Block on result with `TPromise<TJsonValue>` if needed.

## Build hygiene

- Add module deps to `Source/UnrealAgent/UnrealAgent.Build.cs`.
- After ANY code change: build with UnrealBuildTool. Don't claim done before build passes.

  ```powershell
  & "C:\Program Files\Epic Games\UE_5.4\Engine\Build\BatchFiles\Build.bat" `
    <Project>Editor Win64 Development "<.uproject>" -waitmutex
  ```

## What not to do

- No `#include` without adding the module to dependency list.
- No large UStruct on stack — they live in GC.
- No `GarbageCollect()` from a handler — stalls the editor for seconds.
- No `FPlatformProcess::Sleep` on game thread.
- No swallowed errors — fail loudly with `errorCode`.
