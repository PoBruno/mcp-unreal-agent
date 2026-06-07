---
name: cpp-context-bridge
description: How the C++ context bridge works — when a Blueprint references a C++ class / function / variable, how the agent locates and reads the source. Read when implementing or debugging tools that surface C++ source to the agent.
---

# C++ context bridge

When a Blueprint references native code (a parent class, a `UFUNCTION(BlueprintCallable)`, a `UPROPERTY(EditAnywhere)`), the agent needs to read the C++ source to reason about behaviour.

This skill explains the bridge.

## The problem

An agent reading a BP graph sees nodes like:
- `Cast To MyComponent` — `MyComponent` is a UCLASS in `Source/MyGame/MyComponent.h`.
- `OnHit` event — declared via `UFUNCTION(BlueprintImplementableEvent)` on a parent C++ class.
- `Health` variable on `BP_Enemy` — actually a `UPROPERTY(VisibleAnywhere)` on the C++ parent.

The BP graph alone doesn't tell the agent what these do. The agent needs to **read the C++ source** to reason.

## The tool

`cpp_read_symbol` — locates a C++ symbol and returns its source range.

### Input
- `symbolName: string` — fully qualified or short name (`MyComponent`, `UMyComponent::HandleHit`, `MyGameModule.UMyComponent`).
- `bpContext?: string` — optional `blueprintId` to scope the search (helps disambiguate when multiple modules declare same-named symbols).
- `kind?: "class" | "function" | "variable" | "enum" | "struct"` — optional hint.
- `linesOfContext?: number` — default 5. How many lines before/after the symbol to include.

### Output (`data`)
- `filePath: string` — absolute path to `.h` or `.cpp`.
- `lineStart: number` — 1-indexed start line of the symbol declaration.
- `lineEnd: number` — 1-indexed end of the declaration (close brace for class/function, semicolon for variable).
- `snippet: string` — the source range with `linesOfContext` lines on each side.
- `kind: string` — what we found (`class`, `function`, `variable`, etc.).
- `module: string` — the UE module that declares the symbol.
- `references: Array<{ blueprintId, kind }>` — BPs that reference this symbol (when discoverable).

## How the plugin locates the symbol

Implementation in `Source/UnrealAgent/Private/UnrealAgentHandlers_CppBridge.cpp`:

1. **UClass lookup** by name through UE's reflection (`UClass::FindClass`).
2. From the UClass, get the **owning module** (`GetOuter()->GetFName()`).
3. Look up the module's source path from `IPluginManager` (for plugins) or `FPaths::EngineSourceDir() / FPaths::ProjectSourceDir()` (for engine/project code).
4. For class declarations: read the `.h` of the module that exposes the class — use the class's `GENERATED_BODY()` macro to find the file (UHT registers each generated class with its source path in `IntermediateGeneratedHeaders`).
5. For functions: locate by `UFunction*` from `UClass::FindFunctionByName`. The function's metadata may contain `ModuleRelativePath`.
6. For variables: locate by `FProperty*` from `UClass::FindPropertyByName`. Same metadata path.

Then read the file from disk and slice the range.

## Failure modes

| Code | Cause |
|---|---|
| `SYMBOL_NOT_FOUND` | Reflection lookup returned null. Either wrong name, wrong module not loaded, or symbol doesn't exist. |
| `SOURCE_UNAVAILABLE` | Module is loaded but its source isn't on disk (shipping build, marketplace plugin compiled-only). |
| `AMBIGUOUS_SYMBOL` | Multiple modules expose a symbol of this name and no `bpContext` was provided to disambiguate. `data.candidates` lists them. |
| `RANGE_PARSE_FAILED` | We located the file but couldn't determine the line range (rare — usually means the file uses non-standard formatting that confuses the simple parser). |

## When this matters most

- **BP-to-C++ refactoring.** Agent is asked to rename a UPROPERTY — needs to find the C++ declaration to edit it, then `bp_compile_all_dependents` to refresh BPs.
- **Cast / interface debugging.** Agent sees a `Cast To` failing at runtime — reads the C++ class to confirm inheritance.
- **Custom event understanding.** Agent inherits a BP from a C++ class with `BlueprintImplementableEvent` and needs to know the expected signature.
- **Performance reasoning.** Agent profiling a BP — sees a call to a C++ function and reads its implementation to estimate cost.

## Caching

The `Source/Public/Private` file tree is stable during an editor session. We cache `(symbolName, kind) → (filePath, lineStart, lineEnd)` lookups in-memory in the plugin and invalidate on `FCoreUObjectDelegates::OnAssetLoaded` or explicit `/cpp/invalidateCache` HTTP call.

Don't cache the source content itself — re-read on each call to pick up live edits.

## Edge cases

- **Header-only definitions** (templates, inline functions in `.h`): `filePath` is the `.h`, no separate `.cpp`.
- **`UENUM()` and `USTRUCT()`**: found via `UEnum::FindEnumByName` and `UScriptStruct::FindStructByName` respectively.
- **Engine source unavailable**: when querying `UObject` or other engine classes, source might not be on the user's disk (binary-installed Engine). Return `SOURCE_UNAVAILABLE` rather than failing — the agent can still proceed with reflection-derived info.
- **Plugin sources excluded**: marketplace plugins shipped as `Binaries` only. Same handling as engine source unavailable.

## Future extensions (not yet implemented)

- `cpp_find_callers(symbolName)` — find C++ callers across loaded modules.
- `cpp_find_bp_references(symbolName)` — find BPs that reference this symbol (uses the `FAssetRegistryModule` reference graph).
- `cpp_grep_module(moduleName, pattern)` — grep within a module's source tree, returning hits with file:line.
