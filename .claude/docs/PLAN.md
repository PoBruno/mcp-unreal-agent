# PLAN — Agent context & tool cohesion

## Execution status — DONE (2026-06-07)

All workstreams implemented, built, and verified live:
- ✅ **A `inspect`** + **B `get_edit_context`** — layered/budgeted aggregators (TS); `inspect("level")` covers describe_level.
- ✅ **C ID-chain fix** — `autoRefs` emits input-matching keys (`refs.blueprint`→`blueprint`, etc.); verified live. ADR-009.
- ✅ **D summary un-regression** — `get_blueprint_summary`/`describe_graph`/`describe_material` return the compact summary in `data` again (163 vs 1830 chars confirmed). ADR-008.
- ✅ **E capabilities** — `list_assets` (97 anim seqs / 2 skel meshes found live), `set_component_default` (SCS), `connect_anim_entry` (entry-not-connected warning gone), `get_class_api` (TS). All committed; new C++ routes verified.

### Follow-up gaps surfaced (anim authoring) — CLOSED (2026-06-07)
- ✅ `add_anim_state(animationAsset=…)` now wires the sequence player into the state's
  inner Output Pose (`WireAnimNodeToStateResult`); response carries `poseWiring` diag.
  Verified live: both states report `wired`, "Result ignored" warnings gone.
- ✅ `add_anim_transition(bBidirectional)` now emits two one-way transitions (Idle→Run +
  Run→Idle) instead of the unsupported UE5.7 Bidirectional flag. Verified live.
- ✅ Transitions without a rule warn "will never be taken" — `set_transition_rule` gains
  `alwaysTrue` which authors a `MakeLiteralBool(true)` node wired to the TransitionResult.
  Full state machine (2 states + 2 transitions + rules + entry) validates **0 warnings/0 errors**.
- ✅ `add_anim_state` with an unresolved `animationAsset` no longer silently succeeds —
  emits `poseWiring:"anim-asset-not-found"` → TS warning pointing to `list_assets`.

### Editor-parity additions (2026-06-07) — DONE
Researched the real BP-editor workflow (Compile button + Compiler Results, Details panel,
shortcuts, logs) and closed the biggest parity gaps. ADR-010.
- ✅ `compile_blueprint` — first-class Compile returning structured Compiler Results
  (status, error/warning counts, per-message graph+nodeId+title, compileTimeMs, needsSave,
  errorNodeIds refs); options save/refreshNodes/retryOnError. Verified live (UpToDate, 5ms).
- ✅ `get_node_properties` — list ALL properties+values of any node (Details panel),
  with enum allowedValues, numeric UIMin/UIMax/ClampMin/ClampMax, object allowedClass,
  one-level struct expansion. Verified: SequencePlayer → 21 subProps incl PlayRate.
- ✅ `set_node_property` — edit any property incl dotted `Struct.Sub` paths. Verified:
  `Node.PlayRate=1.5` stuck.
- ✅ `set_variable_metadata` + blueprintReadOnly, sliderMin/Max, clampMin/Max. Verified: 5 changes.

### Remaining (not blocking)
- `set_component_default` covers SCS components only; inherited components (Character
  Mesh) still need `python_exec`.
- Unify `set_node_property` with the actor/widget/CDO setters under one object-property surface.
- Surface graph-level (non-node) compiler messages via `FCompilerResultsLog` if needed.

---

# PLAN — Agent context & tool cohesion (design, as executed)

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
