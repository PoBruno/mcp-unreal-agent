# MCP live review — 2026-06-07

Hands-on sweep of the `unreal-agent` MCP tools against a live UE 5.7 editor (the
`test/test` First Person project, our `UnrealAgent` plugin loaded, port 9847).
Goal: map bugs / limitations / improvements. All test assets created under
`/Game/_AgentTest/`.

## Implementation status

**Round 1 — TypeScript (done, `npm run build` + `test:unit` green; takes effect on MCP server reconnect):**
- 🟡 R-01 — TS layer only: registered all 17 groups in `index.ts`. NOT functional yet — the C++ server lacks `BindRoute` + `HandlerMap` entries, so the new endpoints 404 (see corrected R-01 below). Needs a C++ wiring pass + rebuild.
- ✅ R-02 — `connect_pins` single-mode fields now `.optional()` (batch works).
- ✅ R-03 — health timeout 2s→8s (+20s re-confirm before spawn); `findEditorCmd` scans all drives + `UE_HEALTH_TIMEOUT_MS` env.
- ✅ R-06 — `describe_graph` now treats `OverrideEvent`/event-class nodes as entry points.

**Round 2 — C++ (done + VERIFIED LIVE after autonomous rebuild/reinstall/editor-restart):**
- ✅ R-01 (real fix) — wired ~60 routes (`BindRoute`) + dispatch (`HandlerMap`) in
  `UnrealAgentServer.cpp`. Verified live: `get_current_level` (Lvl_FirstPerson,
  69 actors), `list_actors`, `spawn_actor` (AgentLight + AgentCube), `focus_actor`,
  `get_dirty_packages`, `save_all`, and **`open_asset_editor`** (BP opened on
  screen — the live-view payoff). All previously 404.
- ✅ R-09 — `connect_material_pins` `targetNodeId:"Result"` sentinel: verified
  live (`Output → Metallic` succeeded).

**Round 3 — C++ (done + verified):**
- ✅ Live-view docking: `open_asset_editor` forces `EAssetEditorOpenLocation::MainWindow`
  so assets open as a **docked tab in the main window, never a floating window**
  (restores the user's pref after). User-confirmed visually ("tab ok"). This is the
  blueprint live-view: opening a BP shows it as a tab the user watches.
- ✅ R-05 `python_exec` — new tool + `/api/python-exec` handler via
  `IPythonScriptPlugin::ExecPythonCommandEx` (+ PythonScriptPlugin in Build.cs and
  .uplugin). Verified live: `print(...)` → captured output; expression → result
  (`get_engine_version()` → "5.7.4..."). exec_command stays for console commands.
- 🟡 R-04 screenshot — robustness fixed (valid dims, file written, camera/realtime
  control works) but scene content blank when editor not foregrounded (needs the
  SceneCapture2D offscreen path — tracked).
- Note: the `python_exec` MCP *tool* needs an MCP server reconnect to appear; the
  `/api/python-exec` endpoint works now.

**Still pending C++:**
- ⏳ R-04 screenshots (STILL broken — "invalid dimensions" even with a focused
  level viewport; needs offscreen/explicit-resolution capture), R-05 exec output
  / `python_exec`, R-07 state-machine name, R-08 anim Output Pose, R-10 material
  param name.
- Note: material graph node GUIDs regenerate across editor sessions — agents must
  re-fetch via `get_material_graph` each session (not a bug, document it).

**Round 3+ —** R-11 contract migration (Workstream C), live-view (Workstream D).

---

## Severity: critical / high

### R-01 — actor/level/scene/etc. surface is unwired on THREE layers (corrected)
Originally diagnosed as a TS-only gap. Live testing after registering the TS
tools proved deeper: `spawn_actor`, `list_actors`, `open_asset_editor`,
`current-level`, `focus_actor`, `save_all`, etc. all return **HTTP 404**. In
`UnrealAgentServer.cpp` these endpoints are **neither `BindRoute`'d (no HTTP
route) nor added to `RegisterHandlers()`/`HandlerMap`** — `HandleSpawnActor` /
`HandleListActors` / etc. don't appear in the server file at all. The handler
functions exist (compiled in `UnrealAgentHandlers_ActorState.cpp` etc.) and are
declared in the header, but were never wired. So the full fix is THREE layers:
1. ✅ TS: register the 17 groups in `index.ts` (done this session).
2. ❌ C++: add `BindRoute(...)` in `Start()` for each endpoint (~60 routes).
3. ❌ C++: add `HandlerMap.Add("key", ...)` in `RegisterHandlers()` for each.
Then rebuild + reinstall + restart. Only `pie-lifecycle` (start/stop/is-pie)
among the 17 was actually route-bound; the rest 404. **The earlier "Workstream A
done" was premature — TS half only.**

### R-01-orig — 17 of 36 tool groups are never registered in `index.ts`
`Tools/src/index.ts` calls 19 `register*Tools()`; there are 36 TS tool files (and
matching C++ handlers). Unregistered → unreachable via MCP:
`actor-query, actor-state, level, level-actors, sublevels, selection, spatial,
camera, view-mode, pie-lifecycle, pie-runtime, cvars, content-browser,
editor-utils, output-log, undo-redo, widgets`.
Impact: no scene/level authoring, no actor spawn/select/transform, no PIE, no
content-browser, no undo/redo, no widgets — despite the code existing on both
sides. **Fix:** add the imports + `register*Tools(server)` calls. Cheap, huge.

### R-02 — `connect_pins` batch mode is unusable
Passing `batch:[...]` fails Zod: the single-mode fields (`blueprint`,
`sourceNodeId`, `sourcePinName`, `targetNodeId`, `targetPinName`) are still
`required`, so a batch-only call is rejected. `set_pin_default` batch works —
use its schema as the template (single-mode fields `.optional()` when `batch`
present). Workaround today: call connect_pins once per edge.

### R-12 — `BuildPlugin` breaks when a UE project lives inside the repo
The plugin root IS the repo root, so `RunUAT BuildPlugin` copies the entire repo
tree into its temp HostProject. With the dogfood project at `test/test/`, it
tries to copy the editor's locked `Saved/webcache/.../Cookies` and fails
(`BUILD FAILED`, file in use). The first build succeeded only because `test/`
didn't exist yet. Fixes: (a) for iteration, compile in place with direct UBT
(`Build.bat UnrealEditor Win64 Development -Project=<proj> -plugin=<uplugin>`) —
no tree copy; (b) keep dogfood projects out of the plugin root, or add a
packaging filter / build from a clean exported plugin dir. Also argues for the
plugin not being at the repo root long-term.

### R-03 — aggressive 2s health check + broken spawn fallback
Mid-session, while the editor was busy compiling a freshly created anim BP, a
tool call returned `Could not find UnrealEditor-Cmd.exe`. Root cause chain:
`getUEHealth()` uses `AbortSignal.timeout(2000)`; a busy game thread misses it →
`ensureUE()` concludes "not running" → tries to spawn a commandlet →
`findEditorCmd()` only scans `C:\Program Files\Epic Games` (engine here is on
`D:\`) → error. Three fixes: (a) raise the health timeout (≥10s) or retry; (b)
don't spawn when we connected successfully moments ago; (c) scan all drives /
honor `UE_EDITOR_CMD`; (d) better error text. Same C:-only scan bug exists in
`Tools/test/bootstrap.ts` (already in SPRINTS backlog).

## Severity: medium

### R-04 — screenshots: robustness fixed; scene capture needs offscreen render
**Round-2 status:** the hard failure is fixed. `HandleTakeScreenshot`/`HandleTakeHighResScreenshot`
now pick the active viewport (`GCurrentLevelEditingViewportClient`, then any client
with size>0), force `RedrawLevelEditingViewports` + `FlushRenderingCommands`, and
fall back to 1920x1080 when unrealized. Added `RenderCore` to `Build.cs` (for
`FlushRenderingCommands`). Result: valid dimensions (1281x495), a PNG is written,
and `set_realtime_rendering` / `set_viewport_camera` / `focus_actor` all verified
working. **BUT** when the editor is driven autonomously (window not foreground /
UE background-throttles rendering), the captured image is **blank/white** — the
on-screen viewport doesn't composite the 3D scene into the readback buffer.
`AppActivate` + realtime + camera did not resolve it. Proper fix for headless/
autonomous capture = a `SceneCaptureComponent2D` → `UTextureRenderTarget2D` →
PNG export path (renders the scene offscreen, independent of the on-screen
viewport), or disabling editor background-throttle. Tracked as a follow-up feature.
In a focused interactive editor session the current path should capture real content.

### R-04-orig — screenshots non-functional
`take_screenshot` → `Error: Viewport has invalid dimensions`.
`take_high_res_screenshot` → reports `Estimated size: 0x0` and writes no file
(no `Saved/Screenshots/` created). The active level viewport isn't realized/
focused (editor may show a BP/material tab, or window backgrounded). Needs to
locate a valid level viewport, or render offscreen with an explicit resolution.
Directly blocks the user's "see what the agent is doing" goal.

### R-05 — `exec_command` returns success but no output
`py print("Agent Python OK", 2+2)` → `Success: true` but empty `output`. Python
runs (the `py` command is recognized), but stdout / command output / Output Log
is not captured, so results can't be verified. Add a `python_exec` tool that
returns stdout + the last expression value, and/or capture Output Log lines
during `exec_command`.

### R-06 — `describe_graph` ignores OVERRIDE event entry nodes
On `BP_AgentDemo` EventGraph (BeginPlay → SET Health → PrintString, compiles
clean) `describe_graph` printed `(No event/entry nodes found)` and listed nodes
flat instead of tracing the exec chain. The pseudo-code walker doesn't treat
`OVERRIDE`/event nodes as roots. (Contrast: `describe_material` is excellent.)

### R-07 — `add_state_machine` ignores the `name` param
Passed `name:"Locomotion"`; the created sub-graph is always `New State Machine`.
Downstream calls must use the literal `New State Machine`, which is surprising.

### R-08 — state machine not wired to AnimGraph Output Pose
After `add_state_machine` + states + transition, `validate_blueprint` warns
`Output Pose / AnimGraph: Result was visible but ignored`. The state machine
output isn't connected to the final pose and there's no exposed tool to wire
AnimGraph result pins (`connect_pins` targets BP graphs). The ABP is "valid" but
functionally does nothing.

## Severity: low / polish

### R-09 — `connect_material_pins` rough edges
- Documented `targetNodeId:'Result'` sentinel for the output node is **not**
  recognized (`Target node 'Result' not found`); must use the root node GUID
  from `get_material_graph`.
- Empty `sourcePinName` is rejected as "Missing required fields" — misleading;
  the primary outputs are actually named (`RGB`/`RGBA` for VectorParameter,
  `Output` for ScalarParameter).
- Result input pins contain spaces (`Base Color`, `Emissive Color`) — not
  discoverable without `get_material_graph`.

### R-10 — new material params default to name "Param"
`add_material_expression(VectorParameter)` and `(ScalarParameter)` both create
parameters named `Param` → collision-prone. No name arg on creation (must follow
with `set_expression_value` + `parameterName`). Accept an optional name.

### R-11 — output contract inconsistency (expected, tracking)
Only `server_status` and `list_blueprints` return the structured
`{ok,data,refs,nextSteps,...}` contract; every other tool still returns upstream
text. Known (migration in progress per Sprint 1) — tracked so it isn't lost.

## What works well (regression baseline)

- Blueprints: `create_blueprint`, `add_variable`, `add_component`, `add_node`
  (idempotent on existing BeginPlay), `connect_pins` (single), `set_pin_default`
  (incl. batch), `validate_blueprint`, `list_components`, `get_blueprint_summary`.
- Materials: `create_material`, `add_material_expression`, `connect_material_pins`,
  `set_expression_value`, `create_material_instance`, `get_material_graph`,
  `describe_material` (clean, readable).
- Data types: `create_struct` (+initial props), `create_enum`.
- Animation: `create_anim_blueprint` (resolves the skeleton from a skeletal
  mesh path), `get_skeleton` (full bone tree + sockets — excellent),
  `add_state_machine`, `add_anim_state`, `add_anim_transition`.
- Discovery: `list_blueprints`, `list_materials`, `list_classes`, `list_functions`.
- Concurrency: parallel `add_node` / `add_anim_state` calls serialized cleanly.

## Test assets created (cleanup pending)

Under `/Game/_AgentTest/`: `BP_AgentDemo`, `S_AgentData`, `E_AgentMode`,
`M_AgentDemo`, `MI_AgentDemo`, `ABP_AgentDemo`.
