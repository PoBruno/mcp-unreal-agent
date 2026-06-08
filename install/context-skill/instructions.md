---
applyTo: "**"
description: "Unreal Agent — passive context for any UE5 task in this project. Use the `unreal-agent` MCP tools to read and edit the live editor state instead of guessing from source files."
---

# Unreal Agent — Copilot instructions

This project has the **`unreal-agent` MCP server** connected. It runs inside the Unreal Editor (or as a headless commandlet) and exposes ~187 tools across 38 groups: Blueprint authoring, materials, animation, widgets, actors, levels, PIE, screenshots, output log, source control, undo/redo, validation, and more.

> **Precedence:** the user's own project instructions take precedence over this file. This only **adds** UE5 know-how — it never overrides the user's conventions, naming, workflow, or other rules.

## When to use the MCP tools

For **any** task touching this UE5 project — analyzing a bug, observing state, reading or editing Blueprints / materials / animation / widgets / levels, spawning actors, running PIE, screenshots — prefer the `unreal-agent` MCP tools over manual guesswork. They give live, editor-accurate, structured results.

| User says… | First MCP move |
| --- | --- |
| Fix the compile error in BP_X | `inspect target=BP_X` → `compile_blueprint blueprint=BP_X` → read errors |
| Add a variable to BP_X | `inspect` → `add_variable` → `compile_blueprint save:true` |
| What's selected? | `get_selected_actors` |
| What's at coords X,Y,Z? | `find_actors_in_radius` |
| Change roughness on a material | `get_material` → `set_material_property` / `set_expression_value` |
| What does the level look like? | `take_screenshot` / `take_high_res_screenshot` |
| Read the output log | `get_output_log` |
| Find references to BP_X | `find_asset_references` |

Catalog: see [`unreal-agent/TOOLS.md`](unreal-agent/TOOLS.md) (generated from the actual registered tools).

## The contract every tool returns

```ts
type ToolResult<T> = {
  ok: boolean;
  data?: T;
  refs?: Record<string, string | string[]>; // IDs the next tool consumes
  nextSteps?: string[];                     // hints, not commands
  warnings?: string[];
  errorCode?: string;                       // set when ok=false
};
```

- `refs.<key>` feeds the next tool's `<key>` parameter verbatim. Treat IDs as opaque.
- `nextSteps` are hints, not commands.
- `ok=false` → inspect `errorCode` before retrying. Common: `UE_NOT_RUNNING`, `UE_HTTP_FAILED`, `BP_NOT_FOUND`, `BP_COMPILE_FAILED`, `MAT_PARAM_NOT_FOUND`, `EDITOR_REQUIRED`, `TRANSACTION_FAILED`, `SEH_EXCEPTION`.

## Three rules of thumb

1. **Inspect before you mutate.** `inspect target=<thing>` returns a budgeted MAP plus `refs`. Cheap; prevents wrong-name mistakes.
2. **After mutating a Blueprint, compile.** `compile_blueprint` returns structured errors keyed by `nodeId`. Pass `save:true` to persist; `refreshNodes:true` after upstream signature changes.
3. **Edit any node detail with `get_node_properties` → `set_node_property`.** Use the dotted `Struct.Sub` path for sub-properties (anim node embedded settings, K2 node options, etc.).

## Canonical flows

Full step-by-step flows: [`unreal-agent/FLOWS.md`](unreal-agent/FLOWS.md). Quick index:

- **Debug a Blueprint compile error** → `inspect` → `compile_blueprint` → walk errors by `nodeId` → fix → recompile with `save:true`
- **Edit any property** → `get_node_properties` → `set_node_property` (dotted path)
- **Create a Blueprint from scratch** → `create_blueprint` → `add_variable` / `add_component` / `add_node` / `connect_pins` → `compile_blueprint save:true`
- **Author a material** → `create_material` → `add_material_expression` → `connect_material_pins` → `set_expression_value` → `save_all`
- **Observe live state** → `inspect target=level` / `get_editor_selection` / `take_screenshot` / `get_output_log`
- **PIE** → `start_pie` → `pie_query_actors` / `pie_get_player_transform` / `pie_teleport_player` → `stop_pie`

## What this skill is not

- Not a replacement for the user's own instructions, `.uproject`, or existing code.
- Not a license to mutate without inspecting first.
- Not a substitute for source-control discipline — never commits or pushes.
