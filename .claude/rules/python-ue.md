---
applyTo: "**/*.py"
---

# Python (UE5 editor scripting) rules

For Python scripts used via UE5's `PythonScriptPlugin`. Mirror of [`.github/instructions/python-ue.instructions.md`](../../.github/instructions/python-ue.instructions.md).

## Subsystem-first

```python
import unreal

asset_subsystem  = unreal.get_editor_subsystem(unreal.EditorAssetSubsystem)
actor_subsystem  = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
level_subsystem  = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
```

**Never** use:
- `unreal.EditorAssetLibrary` — deprecated, use `EditorAssetSubsystem`
- `unreal.EditorLevelLibrary` — deprecated, use `EditorActorSubsystem` / `LevelEditorSubsystem`
- `unreal.EditorFilterLibrary` — replaced by per-Subsystem methods

## Composite atomic mutations

```python
with unreal.ScopedEditorTransaction("Add ten lights to level"):
    for i in range(10):
        actor = actor_subsystem.spawn_actor_from_class(
            unreal.PointLight, location=(i*100, 0, 200)
        )
        actor.set_actor_label(f"AgentLight_{i}")
```

`with` handles exit. For scripts that can throw `unreal.SystemLibrary` errors, add a `try`/`finally` to ensure clean transaction close.

## Asset paths

UE format: `/Game/Path/AssetName.AssetName`. Most subsystems accept either form. Be explicit when iterating:

```python
all_bps = asset_subsystem.list_assets(
    "/Game/Blueprints", recursive=True, include_folder=False
)
```

## Don't

- No `print()` — output goes to wrong place in editor. Use `unreal.log()`.
- No `import _unreal_core` — internal.
- No >5s scripts on game thread — editor locks up. Chunk or use `unreal.Tickable`.
- No direct `.uasset` writes from Python — corruption. Go through SavePackage.
