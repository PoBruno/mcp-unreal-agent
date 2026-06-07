---
name: ue5-api-cheat
description: UE5 editor API cheat sheet for AI agents — Subsystem map, deprecated→modern translations, transaction patterns, where Python reaches and where C++ is required. Read when picking the right API for a tool implementation or when porting deprecated code.
---

# UE5 API cheat sheet

The right API for the right job, organized by domain.

## Subsystem map (use these)

All accessed via `GEditor->GetEditorSubsystem<U...>()` in C++ or `unreal.get_editor_subsystem(unreal.X)` in Python.

| Subsystem | Use for |
|---|---|
| `UEditorAssetSubsystem` | Asset CRUD (load, save, duplicate, delete, rename), folder ops, asset registry queries. Replaces `UEditorAssetLibrary`. |
| `UEditorActorSubsystem` | Spawn / destroy actors, get selected, get all by class, transform operations. Replaces `UEditorLevelLibrary` actor methods. |
| `ULevelEditorSubsystem` | Open / save level, get current level, sublevel ops, PIE start. Replaces `UEditorLevelLibrary` level methods. |
| `UAssetEditorSubsystem` | Open / close asset editors (the windows). Useful for tools that want to surface results to a human. |
| `UEditorUtilitySubsystem` | Run Editor Utility Widgets / Blueprints from code. |
| `UWorldPartitionSubsystem` | List / load / unload WP cells, query HLOD. |
| `UMoviePipelineQueueSubsystem` | Submit MRQ jobs, query state. |
| `USelection` (via `GEditor`) | Selected actors / components. Not a Subsystem but lives next door. |

## Editing libraries (still supported, no Subsystem replacement)

| Library | Use for |
|---|---|
| `UMaterialEditingLibrary` | Material parameter get/set, expression creation, MI overrides. |
| `UPhysicsAssetEditorLibrary` | Physics asset body / constraint ops. |
| `UAnimSequencerExtensionBPLibrary` | Sequencer animation helpers. |

## Deprecated → modern translations

| Deprecated | Replacement |
|---|---|
| `UEditorAssetLibrary::LoadAsset` | `UEditorAssetSubsystem::LoadAsset` |
| `UEditorAssetLibrary::SaveAsset` | `UEditorAssetSubsystem::SaveAsset` |
| `UEditorAssetLibrary::DuplicateAsset` | `UEditorAssetSubsystem::DuplicateAsset` |
| `UEditorAssetLibrary::DeleteAsset` | `UEditorAssetSubsystem::DeleteAsset` |
| `UEditorAssetLibrary::ListAssets` | `UEditorAssetSubsystem::ListAssets` |
| `UEditorLevelLibrary::SpawnActorFromClass` | `UEditorActorSubsystem::SpawnActorFromClass` |
| `UEditorLevelLibrary::GetSelectedLevelActors` | `UEditorActorSubsystem::GetSelectedLevelActors` |
| `UEditorLevelLibrary::EditorPlaySimulate` | `ULevelEditorSubsystem::EditorPlaySimulate` |
| `EditorAssetLibrary` (Python) | `unreal.EditorAssetSubsystem` |
| `EditorLevelLibrary` (Python) | `unreal.EditorActorSubsystem` / `unreal.LevelEditorSubsystem` |

Find these in code with grep: `EditorAssetLibrary|EditorLevelLibrary|EditorFilterLibrary` — anything matching is a rewrite candidate.

## Transactions and undo

C++:
```cpp
FScopedTransaction Trans(LOCTEXT("MyOp", "My operation"));
Asset->Modify();  // mark for undo
// mutate
```

Python:
```python
with unreal.ScopedEditorTransaction("My operation"):
    # mutate
```

One scope per logical operation. Nesting is allowed but flattened by the undo system. If the mutation can fail partway and you want to roll back, call `Trans.Cancel()` before the scope exits.

## Asset paths

UE5 path format: `/Game/Path/AssetName.AssetName`. The trailing `.AssetName` (the object name within the package) is required when loading. Most subsystem methods accept either form and normalize internally.

Soft references: `TSoftObjectPtr<UFoo>(FSoftObjectPath("/Game/..."))`.

Object lookup at runtime: `LoadObject<UFoo>(nullptr, TEXT("/Game/Path/Asset.Asset"))`.

## Blueprint API

| Goal | API |
|---|---|
| Load BP by path | `LoadObject<UBlueprint>(nullptr, TEXT("/Game/Foo.BP_Foo"))` |
| Create BP | `FKismetEditorUtilities::CreateBlueprint(ParentClass, Outer, Name, BPTYPE_Normal, UBlueprint::StaticClass(), UBlueprintGeneratedClass::StaticClass())` |
| Compile | `FKismetEditorUtilities::CompileBlueprint(BP)` — **SEH-wrap this** |
| Add variable | `FBlueprintEditorUtils::AddMemberVariable(BP, Name, PinType, DefaultValue)` |
| Add function | `FBlueprintEditorUtils::AddFunctionGraph(BP, Graph, /*bIsUserCreated=*/true, nullptr)` |
| Get graphs | `BP->FunctionGraphs`, `BP->UbergraphPages`, `BP->MacroGraphs` |
| Spawn node | `UEdGraphSchema_K2::SpawnNodeFromTemplate(Graph, Template, Location)` |
| Wire pins | `UEdGraphSchema_K2::TryCreateConnection(PinA, PinB)` |
| Save package | `UPackage::SavePackage(Pkg, BP, SaveFlags, *Filename)` — **SEH-wrap this** |

## Material API

```cpp
UMaterialEditingLibrary::CreateMaterialExpression(Material, UMaterialExpressionConstant::StaticClass());
UMaterialEditingLibrary::ConnectMaterialExpressions(FromExpr, FromOutput, ToExpr, ToInput);
UMaterialEditingLibrary::SetMaterialInstanceScalarParameterValue(MI, ParamName, Value);
UMaterialEditingLibrary::UpdateMaterialFunction(MaterialFn, PreviewMat);
```

For MaterialInstances, get override map: `MI->ScalarParameterValues`, `MI->VectorParameterValues`, `MI->TextureParameterValues`.

## Sequencer API

```cpp
ULevelSequence* Seq = LoadObject<ULevelSequence>(nullptr, *Path);
UMovieScene* Scene = Seq->GetMovieScene();

// Add track to a binding
FGuid Binding = Scene->AddSpawnable(/*...*/);
UMovieScene3DTransformTrack* Track = Scene->AddTrack<UMovieScene3DTransformTrack>(Binding);
UMovieScene3DTransformSection* Section = NewObject<UMovieScene3DTransformSection>(Track);
Track->AddSection(*Section);

// Add keyframe
TArrayView<FMovieSceneFloatChannel*> Channels = Section->GetChannelProxy().GetChannels<FMovieSceneFloatChannel>();
Channels[0]->GetData().AddKey(Time, Value);
```

## MovieRenderQueue API

```cpp
UMoviePipelineQueueSubsystem* MRQ = GEditor->GetEditorSubsystem<UMoviePipelineQueueSubsystem>();
UMoviePipelineQueue* Queue = MRQ->GetQueue();
UMoviePipelineExecutorJob* Job = Queue->AllocateNewJob(UMoviePipelinePIEExecutor::StaticClass());
Job->Sequence = LevelSequence;
Job->Map = WorldAsset;
Job->SetConfiguration(LoadObject<UMoviePipelineMasterConfig>(nullptr, *ConfigPath));

UMoviePipelinePIEExecutor* Exec = Cast<UMoviePipelinePIEExecutor>(MRQ->RenderQueueWithExecutor(UMoviePipelinePIEExecutor::StaticClass()));
Exec->OnExecutorFinished().AddLambda([](UMoviePipelineExecutorBase* InExec, bool bSuccess) { /* ... */ });
```

## World Partition API

```cpp
UWorld* World = GEditor->GetEditorWorldContext().World();
UWorldPartitionSubsystem* WP = World->GetSubsystem<UWorldPartitionSubsystem>();
TArray<FWorldPartitionStreamingQuerySource> Sources;
Sources.Add(FWorldPartitionStreamingQuerySource(Location, Radius));
WP->IsStreamingCompleted(EWorldPartitionRuntimeCellState::Activated, Sources, /*bExactState=*/false);
```

For per-cell ops:
```cpp
UWorldPartition* Partition = World->GetWorldPartition();
Partition->LoadCells(CellsToLoad);
Partition->UnloadCells(CellsToUnload);
```

## What Python reaches vs what needs C++

Python `unreal` module exposes:
- All Subsystems (`get_editor_subsystem`).
- Most `UFUNCTION(BlueprintCallable, Category=...)` methods of editing libraries.
- UObject property get/set via reflection.
- `ScopedEditorTransaction`.

Python does **not** reach:
- Slate widget construction (`SWidget` derivatives).
- Direct EdGraph node spawning (use `K2_SpawnNode` C++ helpers or work via `BlueprintFunctionLibrary` wrappers).
- Low-level rendering hooks.
- Custom Tickable creation (workaround: use `unreal.SystemLibrary.delay`).
- SEH wrapping (Python catches Python exceptions only).

For these, write a C++ handler. For everything else, Python is fine for scripting and prototyping; for production tools, prefer C++ for type safety.

## Source paths for further reading

| Engine API | Source path |
|---|---|
| `EditorAssetSubsystem` | `Engine/Source/Editor/UnrealEd/Public/EditorAssetLibrary.h` (legacy name, has subsystem class) |
| `FKismetEditorUtilities` | `Engine/Source/Editor/UnrealEd/Public/Kismet2/KismetEditorUtilities.h` |
| `FBlueprintEditorUtils` | `Engine/Source/Editor/UnrealEd/Public/Kismet2/BlueprintEditorUtils.h` |
| `UMaterialEditingLibrary` | `Engine/Source/Editor/UnrealEd/Public/MaterialEditingLibrary.h` |
| `UMovieSceneSection` | `Engine/Source/Runtime/MovieScene/Public/MovieSceneSection.h` |
| `UMoviePipelineQueueSubsystem` | `Engine/Plugins/MovieScene/MovieRenderPipeline/Source/MovieRenderPipelineCore/Public/MoviePipelineQueueSubsystem.h` |
| `UWorldPartitionSubsystem` | `Engine/Source/Runtime/Engine/Public/WorldPartition/WorldPartitionSubsystem.h` |
