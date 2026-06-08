---
name: unreal-agent
description: Use this skill whenever the user's request touches the UE5 project this skill is installed in — analyzing a bug, observing editor/scene/runtime state, reading or editing Blueprints/materials/animation/widgets/levels/sequencer/MRQ, spawning or modifying actors, running PIE, taking screenshots, or anything that would otherwise require manually opening the Unreal Editor. The `unreal-agent` MCP server gives you live, structured, editor-accurate access to the project — prefer it over guessing from source files alone.
---

# Unreal Agent — passive context skill

You are working in a project that has the **`unreal-agent` MCP server** connected. The server runs inside the Unreal Editor (or as a headless commandlet when the editor is closed) and exposes ~187 tools across 38 groups: Blueprint authoring, materials, animation, widgets, actors, levels, PIE, screenshots, output log, source control, undo/redo, validation, and more.

## Precedence — read first

The user's own project instructions (everything else in their `CLAUDE.md` / `copilot-instructions.md` / `AGENTS.md` / `.cursor/rules` / etc.) **take precedence** over this skill. This skill **adds** Unreal Engine know-how. It never overrides:

- the user's naming conventions, asset folder layout, or coding style;
- the user's commit / PR / branch policy;
- other rules and instructions installed in this project.

If there is a conflict, do what the user's project says, not what this skill says.

## When to reach for these tools (the trigger principle)

For **any** task touching this UE5 project, prefer the `unreal-agent` MCP tools over manual guesswork or static-file inspection alone. They give live, editor-accurate, structured results.

Concrete triggers:

| User says… | First MCP move |
| --- | --- |
| "Why is this Blueprint broken?" / "Fix the compile error in X" | `inspect target=X` → `compile_blueprint blueprint=X` → read errors |
| "Add a Health variable to BP_Player" | `inspect target=BP_Player` → `add_variable` → `compile_blueprint save=true` |
| "What's selected in the editor?" / "What's at coords X,Y,Z?" | `get_selected_actors` / `find_actors_in_radius` |
| "What does this material look like?" / "Change the roughness" | `get_material` → `set_material_property` / `set_expression_value` → `compile_blueprint` not needed (material recompiles on save) |
| "Why is my anim state broken?" | `inspect target=ABP_X` → `describe_graph` → state machine tools |
| "Open the Output Log and tell me the last error" | `get_output_log` |
| "Take a screenshot of the viewport" / "Show me the level" | `take_screenshot` / `take_high_res_screenshot` |
| "Start PIE and check the player position" | `start_pie` → `pie_get_player_transform` |
| "Where is BP_Player referenced?" | `find_asset_references` |

If you're not sure whether a tool exists, scan [`TOOLS.md`](TOOLS.md) — it's the generated catalog of every registered tool with its purpose.

## The contract every tool returns

```ts
type ToolResult<T> = {
  ok: boolean;
  data?: T;                                  // tool-specific payload
  refs?: Record<string, string | string[]>;  // IDs the next tool consumes
  nextSteps?: string[];                      // hints, not commands
  warnings?: string[];
  errorCode?: string;                        // set when ok=false
};
```

Behaviors that follow from this:

1. **`refs.<key>` feeds the next tool's `<key>` parameter verbatim** (ADR-009). Example: `list_blueprints` returns `refs.blueprintIds`, each of which is a valid input to `get_blueprint_summary`, `compile_blueprint`, `inspect`, etc. Treat them as opaque — never invent IDs.
2. **`nextSteps` are hints, not commands.** Use them when they fit the user's goal; ignore them when they don't.
3. **`ok=false` means inspect `errorCode`** before retrying. Common codes: `UE_NOT_RUNNING`, `UE_HTTP_FAILED`, `BP_NOT_FOUND`, `BP_COMPILE_FAILED`, `MAT_PARAM_NOT_FOUND`, `EDITOR_REQUIRED`, `TRANSACTION_FAILED`, `SEH_EXCEPTION`. Retrying a `BP_NOT_FOUND` with the same arg won't help — rescan or rename the target.

## Three rules of thumb that prevent 90% of mistakes

### 1. Inspect before you mutate

Before changing a Blueprint, a material, a graph node, or an actor — call `inspect target=<thing>` (depth=summary by default, ~1–3K chars). It returns a budgeted MAP of the target plus `refs` to drill down. You'll know the real names, real types, real graph structure, and you won't paste a wrong identifier into a mutation tool.

### 2. After mutating a Blueprint, compile

`compile_blueprint blueprint=<...>` is the editor's "Compile" button. Call it after any graph/variable/pin change. It returns structured Compiler Results with errors keyed by `nodeId` (so you can jump to the broken node). Pass `save:true` to persist if it compiles clean. Pass `refreshNodes:true` if you changed an upstream signature/struct.

### 3. Use `get_node_properties` → `set_node_property` to edit *any* node detail

The Details panel of any graph node is exposed via these two tools — including anim node embedded settings, K2 node options, function-entry flags. Call `get_node_properties` first to learn the real property name (use the dotted `Struct.Sub` path for sub-properties); then `set_node_property`. Saves an enormous amount of guessing.

## Canonical flows

The full step-by-step flows live in [`FLOWS.md`](FLOWS.md). Quick index:

- **Debug a Blueprint compile error** → `inspect` → `compile_blueprint` → walk errors by `nodeId` → fix → `compile_blueprint save:true`
- **Edit any property anywhere** → `get_node_properties` → `set_node_property` (dotted path)
- **Create a Blueprint from scratch** → `create_blueprint` → `add_variable` / `add_component` / `add_node` / `connect_pins` → `compile_blueprint save:true`
- **Author a material** → `create_material` → `add_material_expression` → `connect_material_pins` → `set_expression_value` → `save_all`
- **Observe live state** → `inspect target=level` / `get_editor_selection` / `take_screenshot` / `get_output_log`
- **Play-in-Editor** → `start_pie` → `pie_query_actors` / `pie_get_player_transform` / `pie_teleport_player` → `stop_pie`

## What this skill is not

- It is **not** a replacement for reading the user's instructions, their `.uproject`, their existing rules, or their existing code.
- It is **not** a license to start mutating without checking — `inspect` is cheap and accurate; use it.
- It is **not** a substitute for the user's source control workflow — it never commits, pushes, or merges for them.

## Server status & first call

If a tool returns `errorCode: UE_NOT_RUNNING`, the plugin's HTTP server is unreachable. Most likely the editor is closed and the commandlet hasn't been spawned, or the plugin failed to load. Tell the user; do not silently retry forever. The TypeScript bridge will spawn a commandlet on the first tool call if no editor is detected.

## The catalog

[`TOOLS.md`](TOOLS.md) is the full machine-generated catalog. Skim the group headers when you need a capability you don't already know about — it's the single source of truth for what the server can do.
