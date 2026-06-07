# ROADMAP.md

High-level plan. Five phases. Each phase has a single user-visible outcome.

Source of truth for "what to work on" is [SPRINTS.md](SPRINTS.md). This roadmap exists to set direction; sprints execute it.

---

## Phase 0 — Foundation (current)

**Outcome:** repo bootstrapped with dual harness, upstream code imported and renamed, end-to-end "agent calls a tool, plugin responds" smoke path working.

**Sprints:** Sprint 0 (bootstrap), Sprint 1 (smoke path + structured output contract).

**Done when:**
- `npm run build` succeeds in `Tools/`.
- C++ plugin compiles in a UE5.4 project via UnrealBuildTool.
- Health tool returns `{ ok: true, data: { mode: "editor", version: "0.1.0" } }`.
- One non-trivial tool (`bp_list`) works end-to-end and returns the structured contract shape.
- Test suite runs against the commandlet.
- CI configured (initially `npm run build` + lint only).

---

## Phase 1 — Asset pipeline

**Outcome:** the agent can read, mutate, and validate every common asset type with composite atomic tools.

**Scope:**
- Blueprints (create, mutate variables / functions / components / graphs, compile, save).
- Materials (read graph, set parameters, mutate expressions, create material instances).
- Static / Skeletal meshes (read metadata, LOD info, collision, sockets).
- Animations (read sequences, mutate notify tracks, manage anim BPs).
- Data assets (DataTable, CurveTable, PrimaryDataAsset).
- Content browser (list, search, move, delete with source control awareness).

**Done when:**
- ~50 tools across the above domains, each with structured output and integration tests.
- Composite tools for the top 10 multi-step flows (e.g. `bp_create_with_variables`, `mat_create_instance_with_overrides`).
- `cpp_read_symbol` works for any UCLASS / UFUNCTION / UPROPERTY referenced from a BP.

---

## Phase 2 — Composite Blueprint authoring + Level work

**Outcome:** the agent can author non-trivial Blueprints end-to-end (graph nodes, wires, custom events) and manipulate levels (actors, components, sublevels, transforms, visibility).

**Scope:**
- BP graph authoring: spawn nodes by class, wire pins by name, manage user-defined enums and structs.
- Actor manipulation: spawn, select, transform, attach, modify components.
- Sublevels and World Composition.
- Layers, folders, tags.
- Snapshot / restore: capture graph state before mutation, restore on failure (validates the pattern documented in upstream's TODO.md about the USTRUCT rebuild incident).
- Selection / spatial queries.

**Done when:**
- The agent can complete the upstream USTRUCT-rebuild repair scenario end-to-end (rebuild a struct, detect the 13 broken Break nodes across 6 BPs, restore the 80+ wires) using composite tools + snapshot/restore.

---

## Phase 3 — Cinematic, MRQ, World Partition

**Outcome:** the agent can author cinematic content (Level Sequences, sections, keyframes), drive MovieRenderQueue jobs end-to-end, and manage World Partition cells / HLODs.

**Scope:**
- Sequencer: create LevelSequence, add tracks (transform, property, audio, camera cuts), keyframe authoring, section manipulation.
- Movie Render Queue: create job, configure settings (resolution, output, anti-aliasing, console vars), submit, poll status, fetch output paths.
- World Partition: list cells, force load / unload regions, edit per-cell settings, run HLOD builds.
- Light baking lifecycle (start, monitor, cancel).

**Done when:**
- The agent can drive a full "create sequence → keyframe camera → submit MRQ render → return MP4 path" workflow from one composite tool.

---

## Phase 4 — Build, cook, package, PIE, source control

**Outcome:** the agent can compile C++, cook content for a target, package an executable, run PIE for runtime validation, and interact with source control state.

**Scope:**
- `cpp_build_project` — UnrealBuildTool wrapper with progress streaming.
- `project_cook` — cook for Win64 / Mac / Linux / consoles.
- `project_package` — UAT wrapper, returns artifact path.
- `pie_start / stop / step` — Play-in-Editor lifecycle.
- `pie_input` — synthetic input injection.
- `pie_read_log` / `pie_read_viewport` — runtime observability.
- Source control: `sc_status`, `sc_checkout`, `sc_submit`, `sc_revert` (initially Perforce + Git LFS).

**Done when:**
- The agent can take a fresh project, modify a C++ class, rebuild, run PIE, validate the behaviour in the log, then submit the change to source control — as a single intent expressed in chat.

---

## Phase 5 — Polish, performance, distribution

**Outcome:** the project is ready for non-developer users. Install is one prompt. Documentation is complete. Performance is profiled and acceptable.

**Scope:**
- One-prompt install verified across Claude Code + GitHub Copilot + Cursor.
- Marketplace plugin entry (if Epic allows).
- Sample UE5 project demonstrating the agent's capabilities.
- Performance profiling: tool latency budget per category, optimisations where >100 ms.
- Drift CI: enforce `.claude/rules/*.md` and `.github/instructions/*.instructions.md` stay in sync.
- Video walkthroughs.

**Done when:**
- A first-time user with zero UE5 experience can install the MCP, open a sample project, and ask the agent to "add a red cube that rotates" — and watch it happen.

---

## Beyond Phase 5

Possible directions (not committed):
- Multi-instance editor support (one agent driving N editors in parallel).
- Niagara VFX authoring tools.
- Chaos physics scene authoring.
- Audio (MetaSounds) authoring.
- Custom plugin scaffolding tools.
- Marketplace asset import / migration.
