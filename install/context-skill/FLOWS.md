# Unreal Agent — canonical flows

Step-by-step recipes for the things that come up over and over when working in a UE5 project. Every flow assumes you have the `unreal-agent` MCP tools available; see [`SKILL.md`](SKILL.md) for the umbrella rules and [`TOOLS.md`](TOOLS.md) for the full catalog.

> **Precedence:** the user's own project instructions take precedence over these flows. Adapt to their naming, asset paths, and conventions.

---

## Flow A — Debug a Blueprint compile error

1. **Locate** — if the user only named the symptom (`"the patient BP is broken"`), call `list_blueprints filter=<...>` to find the asset path.
2. **Inspect** — `inspect target=<blueprint>` (default `depth=summary`, ~1–3K chars). You get variable counts, graph names, parent class, components. Note the `refs.blueprint` it returns; pass that into the next call.
3. **Compile** — `compile_blueprint blueprint=<refs.blueprint>`. Returns `status` (`UpToDate` / `Error` / `Dirty`), `errorCount`, `warningCount`, and per-message `{ graph, nodeId, nodeTitle, severity, message }` (plus `errorNodeIds` in `refs`).
4. **Diagnose each error** — for each error/warning message, use its `graph` and `nodeId` to drill in:
   - `describe_graph blueprint=... graph=...` for pseudo-code of the graph.
   - `get_node_properties blueprint=... nodeId=...` for the node's Details.
5. **Fix** with the right mutation: `set_pin_default`, `connect_pins`, `disconnect_pin`, `change_function_parameter_type`, `replace_function_calls`, `delete_node`, `set_node_property`, etc.
6. **Refresh + recompile** — if the cause was an upstream signature change, `compile_blueprint blueprint=... refreshNodes:true retryOnError:true save:true`. Otherwise `compile_blueprint ... save:true`.
7. **Verify** — `compile_blueprint` again with no save and confirm `status=UpToDate`.

When stuck: `validate_blueprint` for a richer diagnostic and `diff_blueprints` against a known-good version (use `snapshot_graph` to capture state before changes).

---

## Flow B — Edit any property anywhere

The Details panel of any graph node is exposed via two tools. Use them instead of guessing property names.

1. `get_node_properties blueprint=... nodeId=...` → lists every editable FProperty with current value, allowed values (for enums), min/max (for numerics), and one-level sub-property expansion (for embedded structs like anim node settings).
2. `set_node_property blueprint=... nodeId=... propertyName=... value=...` → applies the change.
   - For a sub-property inside a struct, use a dotted path: `propertyName="Node.PlayRate"`, `propertyName="Settings.BlendTime"`.
   - Pass `save:true` to compile+save in one step.

This is the same pattern for:

- **Blueprint variables** — `set_variable_metadata`, `set_blueprint_default` for class-level defaults.
- **Components** — `set_component_default` for components added via SCS; `python_exec` for inherited components like the Character mesh.
- **Material expressions** — `set_expression_value` (typed) or `set_material_property` (any property on the material asset).
- **Actors** — `set_actor_property` for any UPROPERTY on an actor instance.
- **Widgets** — `set_widget_property` for any UPROPERTY on a UMG widget.

---

## Flow C — Create a Blueprint from scratch

1. `create_blueprint name=BP_Foo parentClass=Actor path=/Game/Path` — returns `refs.blueprint` (the package path).
2. Add structure (each step optional, all use `refs.blueprint`):
   - `add_variable` (with `category` and `type` — see `TYPE_NAME_DOCS` in the schema)
   - `add_component` for SCS components (StaticMeshComponent, PointLightComponent, …)
   - `add_function_parameter` for inputs to functions / custom events / dispatchers
   - `add_event_dispatcher`
   - `add_interface`
3. Graph work:
   - `create_graph` for a new function graph
   - `add_node` to drop a node (see `discovery` group to look up the right `nodeClass`)
   - `connect_pins` / `set_pin_default` for wiring
4. `compile_blueprint blueprint=<...> save:true` — verifies, saves the package.
5. (Optional) `open_asset_editor assetPath=<refs.assetPath>` so the user can review it.

---

## Flow D — Author a material from scratch

1. `create_material name=M_Foo path=/Game/Materials` — returns `refs.material`.
2. `add_material_expression material=<...> expressionClass=MaterialExpressionScalarParameter parameterName=Roughness` → returns `refs.expression`.
3. `set_expression_value material=<...> expression=<refs.expression> property=DefaultValue value=0.5`
4. `connect_material_pins material=<...> fromExpression=<...> fromOutput=... toExpression=MaterialOutput toInput=Roughness`
5. Use `get_material_graph` / `describe_material` to inspect the current state if you need to debug.
6. `save_all` (or `save_all type=material`) — materials recompile on save; no separate compile step.

To create a Material Instance: `create_material_instance parent=<refs.material>` → then `set_material_instance_parameter` for each override.

---

## Flow E — Observe live editor state (no mutation)

When the user asks what's happening in the editor or level:

- `inspect target=level` — actor counts grouped by class, current level name, optional full actor list (`depth=full`).
- `get_current_level` / `get_level_info` — just the level metadata.
- `get_editor_selection` / `get_selected_actors` — what's currently selected.
- `find_actors_by_class` / `find_actors_by_tag` / `find_actors_in_radius` — directed queries.
- `get_actor_properties` / `get_actor_bounds` — per-actor detail.
- `take_screenshot` — quick viewport capture (returns a path; some clients can render it).
- `take_high_res_screenshot` — for hi-res renders.
- `get_output_log` — recent editor log lines.
- `get_viewport_camera` / `set_viewport_camera` — camera state.
- `is_pie_running` — PIE status.

These are read-only. Reach for them freely; they don't dirty anything.

---

## Flow F — Play-in-Editor (PIE)

1. `start_pie mode=Selected|PlayerStart` — boots PIE. Returns when ready.
2. While in PIE:
   - `pie_query_actors` — like `list_actors` but for the PIE world (the gameplay world, not the editor world).
   - `pie_get_player_transform` — current pawn location/rotation.
   - `pie_teleport_player location=... rotation=...` — move the pawn.
   - `pie_pause` — pause the simulation (still in PIE).
3. `stop_pie` — back to the editor world.

If you need to test something that only exists at runtime (overlap events, BP `BeginPlay` logic), do it inside a PIE session.

---

## Flow G — Refactor: rename a variable / function / asset

1. `inspect target=<blueprint>` to verify the name you have is real.
2. `find_asset_references assetPath=<...>` to scope the impact.
3. The mutation:
   - Rename a variable: `add_variable` of the new name + `replace_function_calls` to migrate references is one approach; `python_exec` with the proper `FBlueprintEditorUtils::RenameMemberVariable` call is more direct.
   - Rename a function: `replace_function_calls fromName=Old toName=New` covers call-sites.
   - Rename an asset: `rename_asset oldPath=... newPath=...` — updates references via the asset registry.
4. `validate_all_blueprints` to make sure nothing downstream broke.

---

## Flow H — Source control / save / cleanup

- `get_dirty_packages` — what's modified and unsaved.
- `save_all` — saves everything dirty. Pass `type=blueprint|material|...` to scope.
- `rescan_assets` — refreshes the Asset Registry after external file changes.

Never assume saving is automatic. Mutation tools save when they say they do (look for `save:true` flag); otherwise call `save_all` at the end.

---

## Failure modes and what to do

| `errorCode` | Likely cause | What to do |
| --- | --- | --- |
| `UE_NOT_RUNNING` | Editor closed and commandlet not yet spawned, or plugin failed to load | Tell the user. Don't silently retry. Suggest opening the editor or checking the Output Log for `LogUnrealAgent`. |
| `UE_HTTP_FAILED` | Network/socket hiccup on localhost:9847 | Retry once. Then surface to the user. |
| `BP_NOT_FOUND` / `ASSET_NOT_FOUND` | Wrong path or name | `list_blueprints filter=...` / `list_assets pathFilter=...` to find the real one. |
| `BP_COMPILE_FAILED` | Real graph error | Read `data.errors`, fix via Flow A. |
| `MAT_PARAM_NOT_FOUND` | Parameter doesn't exist on the material | `describe_material` to list real parameters. |
| `EDITOR_REQUIRED` | Tool needs a live editor (e.g. PIE) | Ask the user to open the editor. Commandlet can't help here. |
| `TRANSACTION_FAILED` | Couldn't begin/commit transaction | Retry once; if persistent, tell the user — usually editor in weird state. |
| `SEH_EXCEPTION` | Native UE code threw a structured exception | Asset state may be inconsistent. Re-`inspect` the target before doing anything else. |
| `INVALID_PARAMS` | Zod validation failed on your input | Check the schema in `TOOLS.md` for the tool you called. |
