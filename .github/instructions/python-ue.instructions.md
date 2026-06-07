---
applyTo: "**/*.py"
---

# Python (UE5 editor scripting) rules

Apply to Python scripts (typically used via UE5's `PythonScriptPlugin` for composite editor operations the C++ side hasn't wrapped yet). Mirror of [`.claude/rules/python-ue.md`](../../.claude/rules/python-ue.md).

## Subsystem-first

```python
import unreal

asset_subsystem = unreal.get_editor_subsystem(unreal.EditorAssetSubsystem)
actor_subsystem = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
level_subsystem = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
```

**Never** use:
- `unreal.EditorAssetLibrary` — deprecated, use `EditorAssetSubsystem`
- `unreal.EditorLevelLibrary` — deprecated, use `EditorActorSubsystem` / `LevelEditorSubsystem`
- `unreal.EditorFilterLibrary` — replaced by per-Subsystem filter methods

## Composite atomic mutations

Wrap multi-step mutations in `ScopedEditorTransaction` so Ctrl+Z reverses the entire logical action:

```python
with unreal.ScopedEditorTransaction("Add ten lights to level") as trans:
    for i in range(10):
        actor = actor_subsystem.spawn_actor_from_class(unreal.PointLight, location=(i*100, 0, 200))
        actor.set_actor_label(f"AgentLight_{i}")
```

If the script can fault, also wrap with try/finally to ensure the transaction closes cleanly. The `with` statement handles this in normal exits — but `unreal.SystemLibrary` calls can throw on missing assets.

## Asset paths

UE uses `/Game/Path/AssetName.AssetName` format. Most subsystem methods accept either `/Game/Path/Asset` or the full `.AssetName` suffix. Be explicit when iterating:

```python
all_bps = asset_subsystem.list_assets("/Game/Blueprints", recursive=True, include_folder=False)
```

## Don't

- Don't `print()` in scripts run inside the editor — output goes to the wrong place. Use `unreal.log()`.
- Don't `import` PythonScriptPlugin internals from outside it (no `import _unreal_core`).
- Don't run scripts that take >5s on the game thread without yielding — the editor locks up. Either chunk the work or run async via `unreal.Tickable`.
- Don't write to `.uasset` files from Python without going through the SavePackage path — you'll corrupt the package.
