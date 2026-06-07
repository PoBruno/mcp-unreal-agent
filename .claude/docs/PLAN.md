# PLAN — Agent context & tool cohesion

Goal: give the agent the *right* context cheaply, and make the ~120 tools actually
chain. Driven by the question "should we have a tool that returns complete context?"
— answer: yes, but as a **layered, budgeted, ref-returning `inspect`**, not a full dump.

## Problem

1. **Context is all-or-nothing.** The agent either calls many granular tools (high
   orchestration overhead, easy to miss a piece) or — tempting — wants "everything"
   (token bomb: a raw BP dump is 300K+ chars, dilutes attention, goes stale). There's
   no single, *budgeted* "give me a map of X" entry point.
2. **The ID-chain contract (ADR-003) is broken in practice.** `refs` keys don't match
   the consuming tools' input param names, so the agent can't blindly feed a ref into
   the next call. Audit (autoRefs vs input schemas):
   | ref out | input in | chains? |
   |---|---|---|
   | `nodeId` | `nodeId` | ✅ |
   | `blueprintId` | `blueprint` | ❌ name mismatch |
   | `materialId` | `material` | ❌ |
   | `actorId` | `actorLabel` / `label` | ❌ |
   | `graphId` | `graph` | ❌ |
   Only `nodeId` chains cleanly. The promise of "pass refs.X to param X" mostly fails.
3. **Migration regression.** The contract sweep wrapped `get_blueprint_summary`,
   `describe_graph`, `describe_material` in `wrapRaw` → they now return the *raw*
   payload in `data` instead of their compact human/agent summary. The very tools whose
   job was token-efficient context now dump raw JSON. (Flagged by the migration agents.)
4. **Capability gaps found while building the character flow & the 114-endpoint sweep:**
   - No generic asset listing — only `list_blueprints` / `list_materials`. Can't list
     skeletons, meshes, textures, anim sequences, data assets (had to scan the filesystem).
   - No clean way to set a **Blueprint component's default** (had to use `python_exec`
     to set the Character mesh + anim class).
   - Anim **state-machine entry isn't connected** to the first state; no tool to do it.
   - `set_blueprint_default` + a following compile crashes (R-13).
   - Material node GUIDs regenerate per session (must re-`get_material_graph`).

## Scope

### A. `inspect` — the layered context tool (the headline)
One tool, target + `include[]` + `depth`. Returns a **structured, budgeted map**, not a dump.
- `inspect({ target, include?, depth?, tokenBudget? })`
  - `target`: asset path/name, actor label, or `"level"`.
  - `include`: subset of `["overview","variables","components","graphs","interfaces",
    "dispatchers","cdo-defaults","functions","usages","material-params","skeleton"]`
    (auto-picked by target type when omitted).
  - `depth`: `"summary"` (default) | `"full"`.
  - `tokenBudget`: soft cap; output truncates with explicit `"…N more, call <tool>"`.
- Returns the structured contract with: a compact `data` map (counts + names +
  one-line summaries) and **`refs` the agent drills into** (graphIds, componentIds,
  variableIds). Default `summary` stays ~1–3K chars; `full` opts into the big payload
  per-section, never the whole thing at once.
- Internally it composes the existing read tools (it's an aggregator, not new C++).

### B. `get_edit_context(target, operation)` — task-scoped context
"What's relevant *before this edit*", not everything. e.g. before `change_variable_type`:
the variable + its Break/Make usages + dependent Blueprints (compose
`find_asset_references` + `search_by_type` + `analyze_rebuild_impact`). Far higher
signal than a blind dump; this is what "context before mutating" actually means.

### C. Fix the ID-chain contract (make refs == input params)
- Add **aliased input params** so every consuming tool accepts BOTH the human name and
  the ref id: `blueprint` ⇄ `blueprintId`, `material` ⇄ `materialId`, `label` ⇄
  `actorId`. Cheapest path: widen Zod + normalize in the handler wrapper. Then the
  ID-chain promise holds for real.
- Make `autoRefs` emit the SAME keys the inputs accept; document the canonical set in
  `mcp-tools.md` + `tool-chains/SKILL.md` ref table.

### D. Un-regress the summary tools
- `get_blueprint_summary` / `describe_graph` / `describe_material` must put their
  **compact summary** in `data` (not the raw payload). These are `inspect`'s building
  blocks — they should be the canonical "summary depth" renderers.

### E. New capabilities worth giving the agent
- `list_assets({ classFilter?, pathFilter? })` — generic asset browse (skeletons,
  meshes, textures, anims, data assets). Removes the filesystem-scan crutch.
- `set_component_default` — set a default property on a BP component (incl. inherited,
  e.g. Character `Mesh` skeletal mesh / anim class) without `python_exec`.
- `connect_anim_entry` (or auto-connect in `add_anim_state` for the first state) so a
  state machine actually outputs a pose.
- `describe_level` — budgeted scene context (actor counts by class, key actors, bounds).
- (Stretch) `get_class_api(class)` — unify `list_functions`/`list_properties` into one
  introspection call the agent uses before authoring nodes.

### Out of scope
- The naive "one giant JSON of everything" tool (rejected — token/attention cost).
- Re-architecting the C++ HTTP layer.

## Approach

`inspect` and `get_edit_context` are **TS-side aggregators** over existing endpoints —
no new C++ for the common cases. They enforce the token budget in TS and return the
structured contract (summaries in `data`, ids in `refs`). The ref-alias fix is a small
normalization layer applied at tool registration. The summary un-regression restores
the original renderers (`summarizeBlueprint`/`describeGraph`/`describeMaterial`) into
`data`. New C++ is only needed for `set_component_default`, `connect_anim_entry`,
`list_assets`, `describe_level` (small handlers). An ADR records the "layered/budgeted,
not full-dump" decision.

## Validation

- `inspect("BP_X")` default ≤ ~3K chars, returns counts + refs; `depth:"full"` returns
  per-section detail on request; never the whole 300K blob unprompted.
- Every `refs.<x>` produced by a tool is accepted as an input by the tool it's meant to
  feed (round-trip test per ref type).
- `get_blueprint_summary` returns the compact summary again (regression test).
- `get_edit_context("BP_X","change_variable_type:V")` returns the variable + usages +
  dependents, nothing else.
- Cohesion sweep: for each of the canonical flows (BP authoring, material authoring,
  anim setup, actor/level, live-view) the output of step N feeds step N+1 with no
  manual id translation.

## Risks

1. `inspect` re-becomes a dump if `include`/budget aren't enforced — make budget +
   truncation markers mandatory, default `summary`.
2. Ref aliasing could mask real "wrong id" errors — normalize, but still validate the
   resolved target exists and return a clear errorCode.
3. Aggregators add latency (N internal calls) — parallelize the internal reads; cache
   within a single `inspect` call.

## Dependencies

- Structured contract (ADR-003) — done; this plan *fixes* its ref half.
- Existing read tools (`get_blueprint_summary`, `find_asset_references`,
  `analyze_rebuild_impact`, `get_material_graph`, `get_skeleton`) — the composition base.
- New ADR: "context bundles are layered/budgeted, not full dumps."
- Complements the live-view plan (revealing what the agent inspects/edits).
