---
applyTo: "Source/**/*.cpp,Source/**/*.h,Source/**/*.cs"
---

# Unreal C++ rules

These rules apply when editing any C++ file under `Source/`. They mirror [`.claude/rules/cpp-ue.md`](../../.claude/rules/cpp-ue.md).

## API choices

- **Subsystem APIs only.** Use `UEditorAssetSubsystem`, `UEditorActorSubsystem`, `ULevelEditorSubsystem`, `UAssetEditorSubsystem`. Never use `UEditorAssetLibrary`, `UEditorLevelLibrary`, `UEditorAssetLibrary` — they are deprecated in 5.4+ and will trigger build warnings, and may be removed in 5.6+.
- **Editing libraries are fine** when no Subsystem exists: `UMaterialEditingLibrary`, `UPhysicsAssetEditorLibrary`, `UAnimGraphNode_*` static helpers. These remain supported.
- **For Blueprints:** `FBlueprintEditorUtils`, `FKismetEditorUtilities`, `UEdGraphSchema_K2`.
- **For materials:** `UMaterialEditingLibrary` for parameter set/get, `UMaterialExpression*` for graph mutations.
- **For sequencer:** `UMovieSceneSequence`, `UMovieSceneSection`, `IMovieSceneTracksModule`.

## Transactions and undo

Every mutation must be undoable. Wrap mutations in:

```cpp
FScopedTransaction Transaction(LOCTEXT("ChangeDesc", "Human-readable description"));
Asset->Modify();
// mutation code
```

If a tool performs multiple related mutations, wrap them all in **one** `FScopedTransaction` so Ctrl+Z reverses the entire logical action.

## SEH wrapping

Native UE5 calls can crash with structured exceptions (access violations, stack overflows) — particularly:

- `FKismetEditorUtilities::CompileBlueprint`
- `UPackage::SavePackage`
- `UPackageTools::SavePackages`
- Material compile / cook operations

Wrap these in `__try` / `__except`:

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

Helpers for this pattern live in `Source/UnrealAgent/Private/UnrealAgentServer.cpp` (see `TryCompileBlueprintSEH`, `TrySavePackageSEH`). Reuse them.

Note: SEH handlers cannot contain unwind-requiring code (no destructors with non-trivial work, no `try`/`catch`). Keep the protected block minimal and call a separate function that does the cleanup.

## Logging

Use `UE_LOG(LogUnrealAgent, Display, TEXT("..."))`. The category is declared in `UnrealAgentModule.h`. Never use `UE_LOG(LogTemp, ...)` — it's noise.

Levels:
- `Display` — normal operation
- `Warning` — recoverable issue
- `Error` — operation failed
- `Verbose` — diagnostic detail (off in shipping)

## HTTP handler patterns

Every handler follows this shape:

1. Parse request body with `ParseBodyJson(Request, OutJson)`.
2. Validate required fields. On failure, return `MakeErrorJson("ErrorCode", "Message")`.
3. Load target asset with the project's helpers (`LoadBlueprintByName`, `LoadAssetByPath`).
4. Apply mutations inside `FScopedTransaction`.
5. Save with `SaveBlueprintPackage` / `SavePackageSEH`.
6. Return JSON via `JsonToString`, consistent field naming (`camelCase` from C++ → matches TS contract).

Look at `Source/UnrealAgent/Private/UnrealAgentHandlers_Mutation.cpp` for a reference example.

## Threading

- All HTTP request processing runs on a background thread.
- All UE5 editor API calls must run on the **game thread**.
- Use `AsyncTask(ENamedThreads::GameThread, [...]() { ... })` to marshal.
- Wait for completion with a `TPromise<TJsonValue>` if the response needs the result.

## Build hygiene

- Add new module dependencies to `Source/UnrealAgent/UnrealAgent.Build.cs` `PublicDependencyModuleNames` or `PrivateDependencyModuleNames`.
- After any code change: build with UnrealBuildTool. Do not claim done before the build passes.

  ```powershell
  & "C:\Program Files\Epic Games\UE_5.4\Engine\Build\BatchFiles\Build.bat" `
    <Project>Editor Win64 Development "<.uproject>" -waitmutex
  ```

## What not to do

- Don't add new `#include`s without checking they're in the module's dependency list.
- Don't allocate large UStruct objects on the stack — they live in GC.
- Don't call `GarbageCollect()` from a handler — it can stall the editor for seconds.
- Don't use `FPlatformProcess::Sleep` on the game thread.
- Don't catch all errors and return success — fail loudly with `errorCode`.
