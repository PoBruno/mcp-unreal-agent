# Unreal Agent — Tool Digest

> **Generated** from the registered MCP tool schemas in `Tools/src/tools/*.ts`. Do not edit by hand — re-run `npm run digest` from `Tools/`. This catalog is the agent-facing source of truth: ~187 tools across 38 groups.

All tools return the structured contract:

```ts
type ToolResult<T> = {
  ok: boolean;
  data?: T;                         // tool-specific payload
  refs?: Record<string, string | string[]>; // IDs the next tool consumes
  nextSteps?: string[];             // hints, not commands
  warnings?: string[];
  errorCode?: string;               // set when ok=false
};
```

`refs.<key>` feeds directly into the next tool's parameter named `<key>` (ADR-009 ID-chain). Treat them as opaque — do not synthesize new IDs.

## Groups

- [Actor query](#actor-query-tools-ts-5) — 5
- [Actor state (transform / physics / tags)](#actor-state-tools-ts-3) — 3
- [Animation Blueprint authoring](#animation-mutation-tools-ts-13) — 13
- [Viewport camera](#camera-tools-ts-2) — 2
- [Capabilities / asset registry / misc](#capabilities-tools-ts-4) — 4
- [Blueprint components](#components-tools-ts-3) — 3
- [Content browser](#content-browser-tools-ts-2) — 2
- [Console variables (CVars)](#cvars-tools-ts-3) — 3
- [Blueprint diff](#diff-blueprints-tools-ts-1) — 1
- [Reflection / discovery](#discovery-tools-ts-5) — 5
- [Event dispatchers](#dispatchers-tools-ts-2) — 2
- [Editor utility](#editor-utils-tools-ts-4) — 4
- [Blueprint graph management](#graphs-tools-ts-5) — 5
- [Groom (hair) bindings](#groom-tools-ts-3) — 3
- [Inspect (budgeted context)](#inspect-tools-ts-2) — 2
- [Blueprint interfaces](#interfaces-tools-ts-3) — 3
- [Level actor lifecycle (spawn / delete / duplicate)](#level-actors-tools-ts-4) — 4
- [Level / map](#level-tools-ts-8) — 8
- [Material graph authoring](#material-mutation-tools-ts-17) — 17
- [Material read / describe](#material-read-tools-ts-8) — 8
- [Blueprint authoring (variables / nodes / pins)](#mutation-tools-ts-15) — 15
- [Editor output log](#output-log-tools-ts-2) — 2
- [Function parameters](#params-tools-ts-3) — 3
- [Play-in-Editor lifecycle](#pie-lifecycle-tools-ts-4) — 4
- [Play-in-Editor runtime](#pie-runtime-tools-ts-3) — 3
- [Blueprint read](#read-tools-ts-12) — 12
- [Screenshots / capture](#screenshot-tools-ts-3) — 3
- [Editor selection](#selection-tools-ts-3) — 3
- [Graph snapshots / restore](#snapshot-tools-ts-5) — 5
- [Spatial queries (raycast)](#spatial-tools-ts-1) — 1
- [Sublevels / streaming](#sublevels-tools-ts-4) — 4
- [Undo / redo / transactions](#undo-redo-tools-ts-4) — 4
- [User types (structs / enums)](#user-types-tools-ts-4) — 4
- [Utility (save / rescan / open editor)](#utility-tools-ts-6) — 6
- [Blueprint / material validation](#validation-tools-ts-5) — 5
- [Blueprint variables](#variables-tools-ts-4) — 4
- [Viewport view mode / show flags](#view-mode-tools-ts-5) — 5
- [UMG widgets](#widgets-tools-ts-7) — 7

### Actor query `(actor-query.ts, 5)`

| Tool | Purpose |
| --- | --- |
| `find_actors_by_tag` | Find all actors in the current level that have a specific tag. Requires editor mode. |
| `find_actors_by_class` | Find all actors of a specific class in the current level. Requires editor mode. |
| `find_actors_in_radius` | Find all actors within a radius of a point in the current level. Requires editor mode. |
| `get_actor_bounds` | Get the bounding box of an actor (origin + extent). Requires editor mode. |
| `set_actor_tags` | Set tags on an actor (replaces existing tags). Requires editor mode. |

### Actor state (transform / physics / tags) `(actor-state.ts, 3)`

| Tool | Purpose |
| --- | --- |
| `set_actor_mobility` | Set an actor's mobility type (Static, Stationary, or Movable). This affects whether the actor can move at runtime and what lighting features are available. Requires editor mode. |
| `set_actor_visibility` | Show or hide an actor in the level. Sets both editor visibility and in-game visibility. Optionally propagates to attached child actors. Requires editor mode. |
| `set_actor_physics` | Enable or disable physics simulation on an actor's primitive component. Automatically sets mobility to Movable when enabling physics. Requires editor mode. |

### Animation Blueprint authoring `(animation-mutation.ts, 13)`

| Tool | Purpose |
| --- | --- |
| `create_anim_blueprint` | Create a new Animation Blueprint asset with a target skeleton. |
| `add_anim_state` | Add a state to a state machine graph in an Animation Blueprint. |
| `remove_anim_state` | Remove a state and its connected transitions from a state machine graph. |
| `add_anim_transition` | Add a transition between two states in a state machine graph. |
| `set_transition_rule` | Update properties on an existing transition between two states. |
| `add_anim_node` | Add an animation node (sequence player, blend space, state machine) to an AnimGraph. |
| `add_state_machine` | Add a new state machine to the root AnimGraph of an Animation Blueprint. |
| `set_state_animation` | Set or replace the animation sequence played by a state in a state machine. |
| `create_blend_space` | Create a new 2D Blend Space asset with a target skeleton. |
| `set_blend_space_samples` | Add animation samples to a 2D Blend Space at specific X/Y coordinates. Replaces all existing samples. |
| `set_state_blend_space` | Place a BlendSpacePlayer node inside an anim state, connect it to the Output Animation Pose, and optionally wire X/Y input pins to named variables. |
| `list_anim_slots` | List all montage slot names used in an Animation Blueprint. |
| `list_sync_groups` | List all sync group names used in an Animation Blueprint. |

### Viewport camera `(camera.ts, 2)`

| Tool | Purpose |
| --- | --- |
| `get_viewport_camera` | Get the current viewport camera position, rotation, FOV, and speed. Requires editor mode. |
| `set_viewport_camera` | Set the viewport camera position, rotation, and/or FOV. All parameters are optional — only provided values are changed. Requires editor mode. |

### Capabilities / asset registry / misc `(capabilities.ts, 4)`

| Tool | Purpose |
| --- | --- |
| `list_assets` | List ANY asset in the project (skeletons, skeletal/static meshes, textures, anim sequences, data assets, …) via the Asset Registry — not just Blueprints/Materials. Filter by class-name substring and/or path substring. Returns name/path/class for each. |
| `set_component_default` | Set a default property on a Blueprint component that was added via add_component (Simple Construction Script). E.g. set 'StaticMesh' on an added StaticMeshComponent or 'Intensity' on a PointLightComponent. (Inherited components like the Character Mesh need python_exec.) |
| `connect_anim_entry` | Connect a state machine's ENTRY to a state, making it the initial/default state so the machine actually outputs a pose. Use after add_anim_state — the entry isn't auto-connected, so an otherwise-complete state machine produces nothing without this. |
| `get_class_api` | Get a class's Blueprint-callable API in ONE call: functions (signatures) + properties (types/flags). Use before authoring nodes so you know exact names. Composes list_functions + list_properties. |

### Blueprint components `(components.ts, 3)`

| Tool | Purpose |
| --- | --- |
| `list_components` | List all components in a Blueprint's component hierarchy (Simple Construction Script). Shows component class, name, and parent-child relationships. Only works on Actor-based Blueprints. |
| `add_component` | Add a component to a Blueprint's component hierarchy (Simple Construction Script). Only works on Actor-based Blueprints. Common component classes: StaticMeshComponent, SkeletalMeshComponent, AudioComponent, SceneComponent, BoxCollisionComponent, SphereCollisionComponent, CapsuleComponent, ArrowComponent, ChildActorComponent, SpotLightComponent, PointLightComponent, WidgetComponent, BillboardComponent. |
| `remove_component` | Remove a component from a Blueprint's component hierarchy (Simple Construction Script). Cannot remove a root component that has children — remove or re-parent children first. Children of non-root removed components are promoted to the removed component's parent. |

### Content browser `(content-browser.ts, 2)`

| Tool | Purpose |
| --- | --- |
| `navigate_content_browser` | Navigate the Content Browser to a specific folder path. Useful for browsing assets in a particular directory. Requires editor mode. |
| `open_asset_editor` | Open an asset in its dedicated editor (Blueprint editor, Material editor, etc.). Requires editor mode. |

### Console variables (CVars) `(cvars.ts, 3)`

| Tool | Purpose |
| --- | --- |
| `get_cvar` | Get the current value of a console variable (CVar). Returns the value, type, and help text. Works in both editor and commandlet mode. |
| `set_cvar` | Set a console variable (CVar) to a new value. Returns the previous and new values. Works in both editor and commandlet mode. |
| `list_cvars` | Search and list console variables (CVars). Filter by name substring. Returns name, value, and help text. Works in both editor and commandlet mode. |

### Blueprint diff `(diff-blueprints.ts, 1)`

| Tool | Purpose |
| --- | --- |
| `diff_blueprints` | Structural diff between two different Blueprints. Compares nodes, connections, and variables across graphs. Use for comparing patient variants, finding divergence after copy-paste, or auditing consistency. |

### Reflection / discovery `(discovery.ts, 5)`

| Tool | Purpose |
| --- | --- |
| `get_pin_info` | Get detailed information about a specific pin on a Blueprint node, including type details, container type (array/set/map), default value, and current connections. |
| `check_pin_compatibility` | Check whether two pins can be connected before attempting connect_pins. Returns compatibility status, connection type (direct, requires conversion, etc.), and any UE5 schema messages. |
| `list_classes` | List available UE5 classes. Filter by name substring and/or parent class. Useful for discovering class names to use with add_node(CallFunction), add_node(DynamicCast), add_node(SpawnActorFromClass), etc. |
| `list_functions` | List Blueprint-callable functions on a UE5 class, including parameter signatures and return types. Use this to discover function names for add_node(CallFunction, functionName=...). |
| `list_properties` | List properties on a UE5 class, including types and property flags (BlueprintVisible, EditAnywhere, etc.). |

### Event dispatchers `(dispatchers.ts, 2)`

| Tool | Purpose |
| --- | --- |
| `add_event_dispatcher` | Create an event dispatcher (multicast delegate) on a Blueprint. Optionally include typed parameters in the dispatcher signature. Type name formats: C++ USTRUCTs use F-prefixed name (e.g. 'FVitals', 'FDeviceState'), BP structs (UserDefinedStruct) use asset name (e.g. 'S_Vitals'), enums use enum name (e.g. 'ELungSound'). Object references use colon syntax: 'object:Actor', 'softobject:Actor', 'class:Actor' (TSubclassOf), 'softclass:Actor', 'interface:MyInterface'. |
| `list_event_dispatchers` | List all event dispatchers (multicast delegates) on a Blueprint, including their parameter signatures. |

### Editor utility `(editor-utils.ts, 4)`

| Tool | Purpose |
| --- | --- |
| `focus_actor` | Focus the viewport camera on a specific actor, centering it in view and selecting it. Requires editor mode. |
| `editor_notification` | Show a toast notification in the UE5 editor. Useful for providing feedback to the user during long operations. Requires editor mode. |
| `save_all` | Save all dirty (unsaved) packages in the editor, including maps and content. Requires editor mode. |
| `get_dirty_packages` | List all packages with unsaved changes. Useful for checking what needs saving before closing. Requires editor mode. |

### Blueprint graph management `(graphs.ts, 5)`

| Tool | Purpose |
| --- | --- |
| `reparent_blueprint` | Change a Blueprint's parent class. Can reparent to a C++ class (e.g. 'WebUIHUD') or another Blueprint. Compiles, refreshes all nodes, and saves. |
| `create_blueprint` | Create a new Blueprint asset. Specify a parent class (C++ or Blueprint) and package path. |
| `create_graph` | Create a new function graph, macro graph, or custom event in a Blueprint. For function/macro, creates a new named graph with entry/exit nodes. For customEvent, adds a CustomEvent node to the EventGraph. |
| `delete_graph` | Delete an entire function or macro graph from a Blueprint. Cannot delete EventGraph (Ubergraph pages). All nodes in the graph are removed. Use get_blueprint to see available graphs first. |
| `rename_graph` | Rename a function or macro graph in a Blueprint. Cannot rename EventGraph (Ubergraph pages). Updates all internal references. |

### Groom (hair) bindings `(groom.ts, 3)`

| Tool | Purpose |
| --- | --- |
| `list_groom_bindings` | List all Groom Binding assets (UGroomBindingAsset) in the project. |
| `duplicate_groom_binding` | Duplicate a Groom Binding asset (.uasset) and give it a new name. |
| `set_groom_binding_target_mesh` | Change the Target Skeletal Mesh (and optionally the Source Skeletal Mesh) reference inside a |

### Inspect (budgeted context) `(inspect.ts, 2)`

| Tool | Purpose |
| --- | --- |
| `inspect` | One-call structured CONTEXT for an asset, actor, or the level: a budgeted MAP (counts, names, one-line summaries) plus refs to drill into — NOT a raw dump. Use this BEFORE editing to understand a target without pulling 300K of raw JSON. depth='summary' (default) stays compact (~1-3K chars); depth='full' adds per-section detail. Auto-detects whether the target is a Blueprint, Material, Actor, or the level. |
| `get_edit_context` | Task-scoped context BEFORE a mutation: returns only what's relevant to the edit — the target plus what references/depends on it — not everything. Use before risky edits (type changes, deletes, reparents) so you know the blast radius. |

### Blueprint interfaces `(interfaces.ts, 3)`

| Tool | Purpose |
| --- | --- |
| `list_interfaces` | List all Blueprint Interfaces implemented by a Blueprint. Shows interface name, class path, and function graphs for each. |
| `add_interface` | Add a Blueprint Interface implementation to a Blueprint. The interface must be a Blueprint Interface asset (e.g. 'BPI_MyInterface') or a native UInterface class. Automatically creates function stub graphs for the interface's methods. |
| `remove_interface` | Remove a Blueprint Interface implementation from a Blueprint. Optionally preserve the function graphs as regular functions. |

### Level actor lifecycle (spawn / delete / duplicate) `(level-actors.ts, 4)`

| Tool | Purpose |
| --- | --- |
| `attach_actor` | Attach a child actor to a parent actor in the current level. Requires editor mode. |
| `detach_actor` | Detach an actor from its parent in the current level. Requires editor mode. |
| `duplicate_actor` | Duplicate an actor in the current level. Requires editor mode. |
| `rename_actor` | Rename an actor's label in the current level (World Outliner name). Requires editor mode. |

### Level / map `(level.ts, 8)`

| Tool | Purpose |
| --- | --- |
| `get_selected_actors` | Returns all actors currently selected in the Unreal Editor viewport, including their label, class, folder, location, rotation, and scale. Use this to operate on whatever the user has selected without needing to know actor labels in advance. |
| `get_current_level` | Get information about the currently open level in the Unreal Editor, including its name, package path, and actor count. |
| `list_actors` | List actors placed in the currently open level. Supports optional filtering by class name, actor label, or outliner folder. Returns label, class, folder, and location for each actor. |
| `get_actor_properties` | Get all editable (CPF_Edit) properties of a placed actor in the current level, identified by its display label. Returns property name, C++ type, current value, and whether the value is at its class default. Complex struct properties are automatically expanded into individual sub-fields so no values are silently omitted. Pass 'component' to inspect a specific component's properties (e.g. 'StaticMeshComponent0'). Without 'component', also returns a 'components' list for discovery. |
| `set_actor_transform` | Move, rotate, and/or scale a placed actor in the current level. All fields are optional — only provided fields are applied. Location/scale are in centimeters; rotation is in degrees (pitch/yaw/roll). |
| `set_actor_property` | Set a named property on a placed actor using UE5 reflection. Supports actor-level properties ('bHidden', 'Mobility') and component sub-properties using dot notation ('StaticMeshComponent0.StaticMesh'). Values use UE import-text format (e.g. '1.0', 'true', '/Engine/BasicShapes/Cube.Cube'). |
| `spawn_actor` | Spawn a new actor in the currently open level. The class can be a C++ class name (e.g. 'StaticMeshActor', 'PointLight', 'DirectionalLight') or a Blueprint class name (e.g. 'BP_MyActor'). Location defaults to world origin if not specified. |
| `delete_actor` | Delete a placed actor from the current level by its display label. This operation is undoable (Ctrl+Z in the editor). The actor must exist in the level. |

### Material graph authoring `(material-mutation.ts, 17)`

| Tool | Purpose |
| --- | --- |
| `create_material` | Create a new Material asset. |
| `set_material_property` | Set a top-level property on a Material. Supported properties: domain, blendMode, twoSided, shadingModel, opacity/opacityMaskClipValue, bUsedWithSkeletalMesh, bUsedWithMorphTargets, bUsedWithNiagaraSprites, ditheredLODTransition, bAllowNegativeEmissiveColor. |
| `add_material_expression` | Add a new expression node to a Material or Material Function graph. Supports any UMaterialExpression subclass — use the class name without the 'MaterialExpression' prefix (e.g. 'Constant', 'Add', 'Subtract', 'Fresnel', 'Comment', 'If', 'Lerp'). |
| `delete_material_expression` | Delete an expression node from a Material or Material Function graph. |
| `connect_material_pins` | Connect two pins in a Material or Material Function graph. |
| `disconnect_material_pin` | Disconnect all links from a specific pin in a Material or Material Function graph. |
| `set_expression_value` | Set the value of a material expression (constants, parameter defaults, custom code, etc.) in a Material or Material Function. |
| `move_material_expression` | Move a material expression node to a new position in the graph editor of a Material or Material Function. |
| `create_material_instance` | Create a new Material Instance asset with a specified parent material. |
| `set_material_instance_parameter` | Override a parameter value in a Material Instance. |
| `get_material_instance_parameters` | Get all parameters of a Material Instance, showing which are overridden vs inherited from parent. |
| `reparent_material_instance` | Change the parent of a Material Instance to a different Material or Material Instance. |
| `create_material_function` | Create a new Material Function asset. |
| `snapshot_material_graph` | Take a snapshot of a Material's graph for later comparison or restoration. |
| `diff_material_graph` | Compare a Material's current graph against a previously taken snapshot. |
| `restore_material_graph` | Restore severed connections in a Material's graph from a snapshot. |
| `validate_material` | Force-recompile a Material and check for compilation errors. Returns valid/invalid status with error details. |

### Material read / describe `(material-read.ts, 8)`

| Tool | Purpose |
| --- | --- |
| `list_materials` | List all Material and Material Instance assets in the UE5 project. Filter by name/path and type. |
| `get_material` | Get full details of a Material or Material Instance: domain, blend mode, shading model, parameters, expressions, referenced textures, usage flags, opacity clip value, texture sample count. |
| `get_material_graph` | Get the material editor graph for a Material, with all expression nodes and connections. |
| `describe_material` | Get a human-readable description of a Material's graph, showing what feeds into each material input (BaseColor, Roughness, Normal, etc.). |
| `search_materials` | Search across Materials for expressions matching a query (parameter names, expression types). |
| `find_material_references` | Find all assets that reference a given Material or Material Instance. |
| `list_material_functions` | List all Material Function assets in the project. |
| `get_material_function` | Get details of a Material Function: description, inputs, outputs, expressions. |

### Blueprint authoring (variables / nodes / pins) `(mutation.ts, 15)`

| Tool | Purpose |
| --- | --- |
| `replace_function_calls` | In a Blueprint, redirect all function call nodes from one function library class to another (matched by function name). Reports which pin connections were broken due to type changes. Use this for migrating Blueprints from one function library to another. Pass dryRun=true to preview changes without saving. |
| `delete_asset` | Delete a .uasset file after confirming no remaining references. By default refuses to delete if the asset is still referenced. Use force=true to delete anyway (references become stale). Use find_asset_references first to check dependencies. |
| `connect_pins` | Wire two pins together in a Blueprint graph. Uses type-validated connection (TryCreateConnection) so incompatible types will fail with details. Get node IDs and pin names from get_blueprint_graph first. |
| `disconnect_pin` | Break connections on a specific pin. By default breaks ALL connections on the pin. Optionally specify targetNodeId + targetPinName to break only a single specific link. |
| `change_struct_node_type` | Change a BreakStruct or MakeStruct node to use a different struct type. Reconstructs the node and attempts to reconnect pins by matching property names. Get node IDs from get_blueprint_graph first. Type name formats: C++ USTRUCTs use F-prefixed name (e.g. 'FVitals', 'FDeviceState'), BP structs (UserDefinedStruct) use asset name (e.g. 'S_Vitals'), enums use enum name (e.g. 'ELungSound'). Object references use colon syntax: 'object:Actor', 'softobject:Actor', 'class:Actor' (TSubclassOf), 'softclass:Actor', 'interface:MyInterface'. |
| `refresh_all_nodes` | Refresh all nodes in a Blueprint to update pin types and connections after modifications (e.g. after replace_function_calls or change_variable_type). Recompiles and saves the Blueprint. |
| `delete_node` | Remove a node from a Blueprint graph. Disconnects all pins and removes the node. Use get_blueprint_graph to find node IDs first. Entry/root nodes (FunctionEntry, Event, CustomEvent) cannot be deleted as this would leave the graph uncompilable. |
| `add_node` | Add a new node to a Blueprint graph. Supports: BreakStruct, MakeStruct, CallFunction, VariableGet, VariableSet, DynamicCast, OverrideEvent, CallParentFunction, Branch, Sequence, CustomEvent, ForEachLoop, ForLoop, ForLoopWithBreak, WhileLoop, SpawnActorFromClass, Select, Comment, Reroute. For Delay/IsValid/PrintString, use CallFunction with className 'KismetSystemLibrary'. |
| `rename_asset` | Rename or move an asset (Blueprint, Material, Material Instance, or Material Function) and update all references. |
| `set_pin_default` | Set the default value of an input pin on a Blueprint node. Supports batch mode for setting multiple pins at once. Use this to set literal/constant values on pins that are not connected to other nodes. |
| `move_node` | Reposition one or more nodes in a Blueprint graph by setting their X/Y coordinates. Use batch mode with 'nodes' array for multiple moves in one call. |
| `set_blueprint_default` | Set a default property value on a Blueprint's Class Default Object (CDO). Supports TSubclassOf (class references), object references, and simple types (bool, int, float, string, enum). For class/object values, provide the Blueprint asset name (e.g. 'MyWidget') or C++ class name. |
| `duplicate_nodes` | Duplicate one or more nodes within a Blueprint graph. Creates copies at an offset from the originals. The duplicated nodes are not connected to anything — use connect_pins to wire them up. |
| `get_node_comment` | Read the comment text (comment bubble) on a Blueprint node. |
| `set_node_comment` | Set or clear the comment text (comment bubble) on a Blueprint node. When setting a non-empty comment, the comment bubble is automatically made visible and pinned. |

### Editor output log `(output-log.ts, 2)`

| Tool | Purpose |
| --- | --- |
| `get_output_log` | Get recent output log entries from the UE5 editor/commandlet. Captures log messages in a ring buffer. Supports filtering by text and verbosity level. The first call starts log capture automatically. |
| `clear_output_log` | Clear the captured output log buffer. Does not affect the actual UE5 Output Log window. |

### Function parameters `(params.ts, 3)`

| Tool | Purpose |
| --- | --- |
| `change_function_parameter_type` | Change a function or custom event parameter's type. Supports all types: primitives (bool, int, float, string), structs, enums, and object references. Works with both Blueprint functions (K2Node_FunctionEntry) and custom events (K2Node_CustomEvent). Reconstructs the node to update output pins. Call refresh_all_nodes afterwards to propagate changes to downstream Break nodes. Type name formats: C++ USTRUCTs use F-prefixed name (e.g. 'FVitals', 'FDeviceState'), BP structs (UserDefinedStruct) use asset name (e.g. 'S_Vitals'), enums use enum name (e.g. 'ELungSound'). Object references use colon syntax: 'object:Actor', 'softobject:Actor', 'class:Actor' (TSubclassOf), 'softclass:Actor', 'interface:MyInterface'. Pass dryRun=true to preview changes without saving. |
| `remove_function_parameter` | Remove a parameter from a Blueprint function, custom event, or event dispatcher delegate. Works by finding the FunctionEntry/CustomEvent node in the function/delegate signature graph and removing the UserDefinedPin. Reconstructs the node and saves. Use this to remove delegate parameters that reference deleted types. |
| `add_function_parameter` | Add a typed parameter to an existing function, custom event, or event dispatcher signature. Works with all three — specify the function/event/dispatcher name in functionName. Type name formats: C++ USTRUCTs use F-prefixed name (e.g. 'FVitals', 'FDeviceState'), BP structs (UserDefinedStruct) use asset name (e.g. 'S_Vitals'), enums use enum name (e.g. 'ELungSound'). Object references use colon syntax: 'object:Actor', 'softobject:Actor', 'class:Actor' (TSubclassOf), 'softclass:Actor', 'interface:MyInterface'. |

### Play-in-Editor lifecycle `(pie-lifecycle.ts, 4)`

| Tool | Purpose |
| --- | --- |
| `start_pie` | Start a Play In Editor (PIE) session. Launches the game in the editor viewport for testing. Requires editor mode and no active PIE session. |
| `stop_pie` | Stop the active Play In Editor (PIE) session. Returns the editor to edit mode. Requires a running PIE session. |
| `is_pie_running` | Check whether a Play In Editor (PIE) session is currently active and whether it is paused. Requires editor mode. |
| `pie_pause` | Pause or unpause the active PIE session. Useful for inspecting game state at a specific moment. Requires a running PIE session. |

### Play-in-Editor runtime `(pie-runtime.ts, 3)`

| Tool | Purpose |
| --- | --- |
| `pie_get_player_transform` | Get the player pawn's current location, rotation, velocity, and class during PIE. Requires an active PIE session. |
| `pie_teleport_player` | Teleport the player pawn to a new location during PIE. Optionally set rotation. Requires an active PIE session. |
| `pie_query_actors` | Query actors in the PIE game world. Filter by class name and/or tag. Requires an active PIE session. |

### Blueprint read `(read.ts, 12)`

| Tool | Purpose |
| --- | --- |
| `list_blueprints` | List all Blueprint assets in the UE5 project, including level blueprints from .umap files. Optionally filter by name/path substring, parent class, or type (regular vs level). Returns refs.blueprintIds[] for chaining into get_blueprint_summary. |
| `get_blueprint` | Get full details of a specific Blueprint: variables, interfaces, and all graphs with nodes and connections. Also supports level blueprints from .umap files (e.g. 'MAP_Ward'). |
| `get_blueprint_graph` | Get a specific named graph from a Blueprint (e.g. 'EventGraph', a function name). Graph names are URL-encoded automatically. |
| `search_blueprints` | Search across Blueprints for nodes matching a query (function calls, events, variables). Loads BPs on demand so use 'path' filter to scope large searches. |
| `get_blueprint_summary` | Get a concise human-readable summary of a Blueprint: variables with types, graphs with node counts, events, and function calls. Returns ~1-2K chars instead of 300K+ raw JSON. Use this first to understand a Blueprint before diving into specific graphs. |
| `describe_graph` | Get a pseudo-code description of a specific Blueprint graph by walking execution pin chains. Shows the control flow as readable pseudo-code (IF/CALL/SET/SEQUENCE etc) with data flow annotations showing where each node gets its inputs. Use after get_blueprint_summary to understand a specific graph's logic. Graph names are URL-encoded automatically. |
| `find_asset_references` | Find all Blueprints (and other assets) that reference a given asset path. Equivalent to the editor's Reference Viewer. Use this to check dependencies before deleting assets or to map out which Blueprints use a specific struct, function library, or enum. |
| `search_by_type` | Find all usages of a specific type across Blueprints: variables, function/event parameters, Break/Make struct nodes. More granular than find_asset_references. |
| `get_skeleton` | Inspect a USkeleton asset: dumps the full bone hierarchy (with parent index, ref-pose transform), all sockets, and the curve metadata name list. Use the package path (e.g. '/Game/Characters/CC/Backend/CC4/CC5_Rig'). Useful for diffing rigs across characters. |
| `add_skeleton_socket` | Add (or update) a single socket on a USkeleton asset. The skeleton .uasset is saved to disk; the read-only attribute is cleared automatically. Wrapped in an undo transaction. Use 'overwrite=false' to refuse if a socket with the same name already exists. Use 'dryRun=true' to preview without saving. |
| `remove_skeleton_socket` | Remove a socket by name from a USkeleton asset. The skeleton is saved to disk. Wrapped in an undo transaction. |
| `copy_skeleton_sockets` | Copy all sockets from one USkeleton to another, preserving name, bone, and relative transform. Sockets whose target bone doesn't exist on the destination skeleton are skipped and reported under 'missingBones'. Use 'only' to restrict to a subset of socket names. Use 'overwrite=false' to skip sockets that already exist on the destination. |

### Screenshots / capture `(screenshot.ts, 3)`

| Tool | Purpose |
| --- | --- |
| `take_screenshot` | Capture a screenshot of the active viewport. Saves as PNG to the project's Saved/Screenshots folder. Requires editor mode. |
| `take_high_res_screenshot` | Capture a high-resolution screenshot of the active viewport with configurable resolution multiplier. Requires editor mode. |
| `capture_scene` | Render the scene OFFSCREEN via a SceneCapture2D and save a PNG. Works even when the editor window isn't focused (unlike take_screenshot, which depends on the on-screen viewport). Specify camera location/rotation to frame what you want. Use this to see the actual 3D scene. |

### Editor selection `(selection.ts, 3)`

| Tool | Purpose |
| --- | --- |
| `get_editor_selection` | Get the currently selected actors in the editor. Returns labels, classes, and locations. Requires editor mode. |
| `set_editor_selection` | Select specific actors by label. Clears the current selection first. Requires editor mode. |
| `clear_selection` | Deselect all currently selected actors in the editor. Requires editor mode. |

### Graph snapshots / restore `(snapshot.ts, 5)`

| Tool | Purpose |
| --- | --- |
| `snapshot_graph` | Create a backup snapshot of a Blueprint graph's state (all nodes, pins, and connections). Use BEFORE any destructive operation (C++ rebuild, change_struct_node_type, bulk edits). Returns a snapshot ID for later use with diff_graph or restore_graph. Snapshots are stored server-side and persist to disk. |
| `diff_graph` | Compare current Blueprint graph state against a snapshot. Shows severed connections, new connections, type changes, and missing nodes. Use AFTER a potentially destructive operation to assess damage before restoring. |
| `restore_graph` | Reconnect severed pin connections from a snapshot. Use after diff_graph shows damage. Can restore an entire graph, a single node (nodeId), or use an explicit pin map. For Break/Make struct nodes that lost connections after change_struct_node_type or C++ rebuild, this bulk-reconnects all pins in one call instead of individual connect_pins calls. |
| `find_disconnected_pins` | Scan Blueprint(s) for pins that should be connected but aren't. Detects Break/Make struct nodes with broken types (HIGH confidence) or zero connections (MEDIUM confidence). Use after C++ rebuilds, change_struct_node_type, or refresh_all_nodes. Catches silent data flow breaks that validate_blueprint misses. Provide at least one of: blueprint, filter, or snapshotId. |
| `analyze_rebuild_impact` | Predict which Blueprints will be affected by a C++ module rebuild. Scans for Break/Make struct nodes, variables, and function parameters that reference USTRUCTs/UENUMs defined in the specified module. Use BEFORE rebuilding to know what to snapshot. |

### Spatial queries (raycast) `(spatial.ts, 1)`

| Tool | Purpose |
| --- | --- |
| `raycast` | Perform a line trace (raycast) from point A to point B in the editor world. Returns hit information including the actor, component, impact point, and surface normal. Supports single and multi-hit modes. Requires editor mode. |

### Sublevels / streaming `(sublevels.ts, 4)`

| Tool | Purpose |
| --- | --- |
| `get_level_info` | Get information about the current editor world including persistent level details and all streaming sublevels. Requires editor mode. |
| `list_sublevels` | List all streaming sublevels in the current world with their load/visibility status, streaming class, and actor counts. Requires editor mode. |
| `load_sublevel` | Load a streaming sublevel by name. Optionally make it visible immediately. Requires editor mode. |
| `unload_sublevel` | Unload a streaming sublevel by name. Hides and unloads the sublevel. Requires editor mode. |

### Undo / redo / transactions `(undo-redo.ts, 4)`

| Tool | Purpose |
| --- | --- |
| `undo` | Undo the last editor action. Returns the description of the undone action and remaining undo/redo counts. Requires editor mode. |
| `redo` | Redo the last undone editor action. Returns the description of the redone action and remaining undo/redo counts. Requires editor mode. |
| `begin_transaction` | Begin a named undo transaction. All modifications between begin_transaction and end_transaction will be grouped as a single undoable action. Requires editor mode. |
| `end_transaction` | End the current undo transaction. All modifications since the matching begin_transaction will be grouped as a single undoable action. Requires editor mode. |

### User types (structs / enums) `(user-types.ts, 4)`

| Tool | Purpose |
| --- | --- |
| `create_struct` | Create a new UserDefinedStruct asset. Optionally provide initial properties. Type names for properties: Type name formats: C++ USTRUCTs use F-prefixed name (e.g. 'FVitals', 'FDeviceState'), BP structs (UserDefinedStruct) use asset name (e.g. 'S_Vitals'), enums use enum name (e.g. 'ELungSound'). Object references use colon syntax: 'object:Actor', 'softobject:Actor', 'class:Actor' (TSubclassOf), 'softclass:Actor', 'interface:MyInterface'. |
| `create_enum` | Create a new UserDefinedEnum asset with the given values. |
| `add_struct_property` | Add a property to an existing UserDefinedStruct. Type names: Type name formats: C++ USTRUCTs use F-prefixed name (e.g. 'FVitals', 'FDeviceState'), BP structs (UserDefinedStruct) use asset name (e.g. 'S_Vitals'), enums use enum name (e.g. 'ELungSound'). Object references use colon syntax: 'object:Actor', 'softobject:Actor', 'class:Actor' (TSubclassOf), 'softclass:Actor', 'interface:MyInterface'. |
| `remove_struct_property` | Remove a property from an existing UserDefinedStruct. |

### Utility (save / rescan / open editor) `(utility.ts, 6)`

| Tool | Purpose |
| --- | --- |
| `server_status` | Check UE5 server status (the health tool). Starts the server if not running (blocks until ready). Returns the structured contract with mode and indexed asset counts. |
| `rescan_assets` | Re-scan the UE5 asset registry and refresh the server's cached asset lists. Use this if newly created assets are not appearing in list_blueprints/list_materials, or if the server started before the editor finished loading assets. |
| `exec_command` | Execute an editor console command and return its output. Requires editor mode (not commandlet). Useful for: saving assets ("Asset.SaveAll"), running automation tests ("Automation RunTests <filter>"), triggering Live Coding, etc. |
| `python_exec` | Run a Python statement or script inside the UE editor and return its captured output and result. Use this (not exec_command) when you need the print output or an evaluated value back. Single expressions are evaluated (value returned in 'result'); multi-line or assignments are executed. Requires editor mode + the Python Editor Script Plugin. |
| `set_presence` | Toggle live-view presence. When enabled (default), editing a Blueprint auto-opens its editor as a docked tab in the main window so the user can watch the agent work. Disable to avoid opening editors during bulk operations. |
| `shutdown_server` | Shut down the UE5 Blueprint server to free memory (~2-4 GB). The server will auto-restart on the next blueprint tool call. Use this when done with blueprint analysis. Cannot shut down the editor — only the standalone commandlet. |

### Blueprint / material validation `(validation.ts, 5)`

| Tool | Purpose |
| --- | --- |
| `validate_blueprint` | Compile a Blueprint and report errors/warnings without saving. Captures both node-level compiler messages AND log-level messages (e.g. 'Can\'t connect pins', 'Fixed up function'). Use after making changes to verify correctness. |
| `validate_all_blueprints` | Bulk-validate all Blueprints (or a filtered subset) by compiling each one and reporting errors. Use after reparenting, C++ changes, or any operation that could cause cascading breakage. Returns only failed Blueprints to keep output manageable. Sends progress notifications during validation. |
| `compile_blueprint` | Compile a Blueprint (the editor's Compile button) and return structured Compiler Results. This is the canonical 'finish my edits' step: after mutating a graph/variables/pins, call this to verify the class is valid. Returns status (UpToDate/UpToDateWithWarnings/Error/Dirty), errorCount/warningCount, each message with its graph + nodeId + nodeTitle (so you can jump to/fix the node), compileTimeMs, and needsSave. Options: save (persist if it compiles clean), refreshNodes (run Refresh Nodes first — fixes stale pins after upstream signature/struct changes), retryOnError (one auto-retry after a refresh for transient cross-dependency errors). |
| `get_node_properties` | List every editable property of a Blueprint graph node with its current value — the equivalent of selecting the node and reading its Details panel. Enumerates the node's reflected FProperties: name, type, category, editable/readOnly flags, and value. Enrichment: enum properties include allowedValues (the dropdown options); numeric properties include UIMin/UIMax/ClampMin/ClampMax when set; object/asset properties include allowedClass; struct properties (e.g. an anim node's embedded settings) expand one level into subProperties. Use before set_node_property so you know the exact property name (use the dotted 'Struct.Sub' path for sub-properties) and the legal values. |
| `set_node_property` | Set a property on a Blueprint graph node — the equivalent of editing a field in the node's Details panel. Resolves the property by name (use a dotted path like 'Node.PlayRate' for a sub-property inside a struct, e.g. an anim node's embedded settings), parses the value, reconstructs the node's pins, and marks the Blueprint for recompile. Call get_node_properties first to learn the exact property name and legal values. Pass save:true to compile+save in one step. |

### Blueprint variables `(variables.ts, 4)`

| Tool | Purpose |
| --- | --- |
| `change_variable_type` | Change a Blueprint member variable's type. Supports structs, enums, and object reference types. Compiles and saves the Blueprint. Downstream Make/Break nodes using the old type will need manual fixing. Type name formats: C++ USTRUCTs use F-prefixed name (e.g. 'FVitals', 'FDeviceState'), BP structs (UserDefinedStruct) use asset name (e.g. 'S_Vitals'), enums use enum name (e.g. 'ELungSound'). Object references use colon syntax: 'object:Actor', 'softobject:Actor', 'class:Actor' (TSubclassOf), 'softclass:Actor', 'interface:MyInterface'. For object references, either use colon syntax in newType (e.g. 'object:Actor') or pass typeCategory + class name in newType. Pass dryRun=true to preview changes without saving. |
| `add_variable` | Add a new member variable to a Blueprint. Supports simple types (bool, int, float, string, name, text, byte), built-in structs (vector, rotator, transform), and custom struct/enum types. Type name formats: C++ USTRUCTs use F-prefixed name (e.g. 'FVitals', 'FDeviceState'), BP structs (UserDefinedStruct) use asset name (e.g. 'S_Vitals'), enums use enum name (e.g. 'ELungSound'). Object references use colon syntax: 'object:Actor', 'softobject:Actor', 'class:Actor' (TSubclassOf), 'softclass:Actor', 'interface:MyInterface'. |
| `remove_variable` | Remove a member variable from a Blueprint. Also cleans up any VariableGet/VariableSet nodes referencing it. |
| `set_variable_metadata` | Set variable properties beyond type: category, tooltip, replication, exposeOnSpawn, editability, isPrivate, blueprintReadOnly, and slider/clamp ranges. Provide any combination of fields to update. |

### Viewport view mode / show flags `(view-mode.ts, 5)`

| Tool | Purpose |
| --- | --- |
| `set_view_mode` | Change the viewport rendering mode (Lit, Unlit, Wireframe, etc.). Requires editor mode. |
| `set_show_flags` | Toggle viewport show flags (Grid, Fog, Collision, etc.). Requires editor mode. |
| `set_viewport_type` | Switch the viewport between Perspective and orthographic views (Top, Front, Left, etc.). Requires editor mode. |
| `set_realtime_rendering` | Enable or disable realtime rendering in the viewport. When disabled, the viewport only updates on interaction. Requires editor mode. |
| `set_game_view` | Toggle game view mode, which hides editor-only visuals (icons, wireframes, selection outlines) to preview the scene as it appears in-game. Requires editor mode. |

### UMG widgets `(widgets.ts, 7)`

| Tool | Purpose |
| --- | --- |
| `list_widget_tree` | List the full widget hierarchy of a Widget Blueprint (UMG). Shows widget names, classes, parents, slots, and panel/child relationships. Only works on Widget Blueprints. |
| `get_widget_properties` | Get all editable properties of a specific widget in a Widget Blueprint, including slot properties (anchors, alignment, padding, etc.). Use this to inspect current values before calling set_widget_property. |
| `add_widget` | Add a widget to a Widget Blueprint's designer hierarchy. Common widget classes: TextBlock, Button, Image, VerticalBox, HorizontalBox, Overlay, CanvasPanel, Border, SizeBox, ScaleBox, ScrollBox, Spacer, ProgressBar, Slider, CheckBox. If no parent is specified, adds to the root panel. |
| `remove_widget` | Remove a widget from a Widget Blueprint's designer hierarchy. Cannot remove panel widgets that have children — remove or move the children first. |
| `set_widget_property` | Set a property on a widget or its slot (layout) in a Widget Blueprint. Properties are searched on the widget first, then on its slot. For FText properties, bare strings are automatically wrapped in INVTEXT(). Use get_widget_properties to discover available properties. |
| `move_widget` | Move a widget from its current parent to a different panel widget in the same Widget Blueprint. Includes cycle detection to prevent moving a widget into its own descendant. |
| `create_widget_blueprint` | Create a new empty Widget Blueprint (UMG). The new blueprint will have an empty widget tree ready for adding widgets. |

---

If a tool you expected is missing, the source has changed since this digest was last generated. Re-run `npm run digest` in `Tools/` to refresh.
