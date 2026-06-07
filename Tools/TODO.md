# Blueprint MCP TODO

> **Note:** The original feature roadmap (force delete, delete_node, search_by_type, add_node, rename_asset, validate_blueprint, batch operations, dry run, URL encoding fix, workflow recipes, tool chaining hints, summary parameter types, describe_graph data flow, write tool updated state, actionable error messages, type name docs) has been fully implemented.

---

## Implemented: Blueprint Safety Tools (Feb 2025)

The following features from the incident post-mortem have been implemented as 5 new MCP tools:

### `snapshot_graph` / `diff_graph` / `restore_graph` — Graph State Backup & Restore

Snapshot a Blueprint's full graph state before destructive operations, diff against the snapshot after, and bulk-restore severed connections. Snapshots persist to disk at `Saved/UnrealAgent/Snapshots/`. `restore_graph` also absorbs the originally-planned `reconnect_break_node` feature via optional `nodeId` and `pinMap` parameters.

### `find_disconnected_pins` — Detect Broken Wiring

Scans Blueprints for Break/Make struct nodes with broken types (HIGH confidence) or zero data connections (MEDIUM confidence). Also supports snapshot-based definite-break detection. Catches the "compile clean but broken data flow" problem that `validate_blueprint` misses.

### `analyze_rebuild_impact` — Pre-Rebuild Impact Analysis

Given a C++ module name, enumerates all USTRUCTs/UENUMs via UE5 reflection, scans all Blueprints for Break/Make nodes, variables, and function parameters referencing those types, and classifies risk as HIGH/MEDIUM/LOW with connection-at-risk counts.

See **Recipe 3: C++ Rebuild Safety** in the workflow-recipes resource for the full before/after rebuild workflow.

---
---

# Incident Report: C++ USTRUCT Rebuild Broke Break Nodes (2025-02)

## What Happened

The `StateParsers` C++ function library was rewritten to accept `FJsonLibraryObject` (from the JsonLibrary marketplace plugin) instead of `FJsonObjectWrapper` (UE5 built-in). After the C++ module was rebuilt and hot-reloaded in the editor, **13 `Break <struct>` nodes across 6 Blueprints** lost their struct type association and became `Break <unknown struct>`. This silently severed **all output data pin connections** on those nodes — roughly **80+ data wires** were destroyed.

### Affected Blueprints and Node Counts

| Blueprint | Break Nodes Affected | Data Connections Lost |
|-----------|---------------------|----------------------|
| BP_Patient_Base | 5 (FSkinState, FDisabilityState, FExposureState, FExaminationState, FCirculationState) | ~45 |
| BP_PatientManager | 3 (FVitals x2, FCirculationState) | ~9 |
| BPC_BreathingController | 3 (FBreathingSoundState, FWorkOfBreathingState, FLungSoundState) | ~16 |
| BPC_HybridTheory | 1 (FHybridControlState) | ~3 |
| BPC_DeviceController | 1 (FDeviceState — type survived but pins disconnected) | ~12 |

### Root Cause

When the C++ module containing the USTRUCT definitions is recompiled, UE5 invalidates and reloads the struct metadata. Break/Make struct nodes that reference those structs lose their type binding. The node reverts to `<unknown struct>` and all output pins (which are dynamically generated from the struct's UPROPERTY fields) are destroyed along with their connections.

This is a known UE5 behavior — the struct definitions themselves were unchanged, but the module reload triggered the invalidation anyway.

### Why It Was Hard to Detect

1. **No compiler errors initially** — Blueprints with orphaned Break nodes don't always produce compile errors if the exec chain still flows (the Break node just becomes a no-op with no outputs).
2. **Silent data loss** — The data wires were destroyed, not just disconnected. There's no "undo" and no log of what was connected before.
3. **Scattered across many BPs** — The Break nodes were in 6 different Blueprints across different subsystems.
4. **BPC_DeviceController was missed** — The initial search found 4 affected BPs. BPC_DeviceController wasn't caught until a second pass because its Break node retained the correct type but had disconnected pins (a subtler failure mode).

### How It Was Fixed

1. `search_by_type` (if it had existed) or manual `get_blueprint_graph` calls to find all Break nodes with `<unknown struct>` types
2. `change_struct_node_type` to reassign the correct struct type to each broken Break node
3. `refresh_all_nodes` on each affected Blueprint
4. Manual analysis of each graph to determine what each Break output pin should connect to
5. ~80 individual `connect_pins` calls to rewire all data connections
6. `validate_blueprint` on each BP to confirm clean compilation

Total effort: ~3 hours of tedious graph inspection and pin-by-pin reconnection.

## Prevention Checklist for Future C++ Rebuilds

When modifying C++ USTRUCT definitions or the module containing them:

1. **Before rebuild**: Use `get_blueprint_graph` on all Blueprints that use Break/Make nodes for structs in the module. Save the JSON output as a reference for reconnection.
2. **After rebuild**: Immediately check all Break/Make nodes — run `validate_blueprint` on every affected BP.
3. **If nodes are broken**: Use `change_struct_node_type` to restore types, then manually reconnect pins using the saved graph state as reference.
4. **Don't trust "compiles clean"**: A Blueprint can compile cleanly while having completely disconnected data flow. Always verify data pin connections, not just compilation status.
