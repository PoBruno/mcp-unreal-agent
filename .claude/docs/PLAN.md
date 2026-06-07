# PLAN — MCP completeness + live view (consolidated)

Folds together: (a) the live-view / agent-presence feature, (b) every finding from
the 2026-06-07 live review (see [REVIEW-mcp-2026-06-07.md](REVIEW-mcp-2026-06-07.md),
R-01..R-11), and (c) the gaps needed to call the editor-control surface "complete".

## Problem

The plugin has far more implemented than the agent can reach: **17 of 36 tool
groups aren't registered**, so scene/level/actor/PIE/selection/camera/widget
control is dead on arrival. Several reachable tools have correctness/robustness
bugs (batch connect, health-check flakiness, screenshots, exec output). The
output contract is migrated for only 2 tools. And there's no way for the user to
**watch** what the agent does in the open editor — the feature that makes the
whole thing feel alive — which must be added without ever conflicting with UE's
own save/edit state.

Empirical note from the review: mutating an asset via MCP while its editor is
open did **not** conflict (BP/material/anim BP all edited live on :9847, saved,
editor stayed healthy). The no-conflict premise for asset-editor reveal holds;
remaining risk is focus-stealing and save scoping, addressed below.

## Scope (workstreams)

### A. Surface completeness — expose what already exists (R-01)
- Register the 17 missing groups in `Tools/src/index.ts`: actor-query,
  actor-state, level, level-actors, sublevels, selection, spatial, camera,
  view-mode, pie-lifecycle, pie-runtime, cvars, content-browser, editor-utils,
  output-log, undo-redo, widgets.
- Smoke-test each group against the live editor; fix any that error on first call.
- Add the structured-output contract as each is touched (don't regress).

### B. Robustness / correctness bug fixes (review findings)
- R-02 `connect_pins` batch: make single-mode fields optional when `batch` given
  (mirror `set_pin_default`).
- R-03 health/spawn: raise health timeout (≥10s) + retry; don't spawn when
  recently connected; `findEditorCmd` (and `bootstrap.ts`) scan all drives +
  honor `UE_EDITOR_CMD`; clearer error text.
- R-04 screenshots: locate a valid level viewport (or render offscreen with an
  explicit resolution) so `take_screenshot` / `take_high_res_screenshot` produce
  a real file. (Also a prerequisite for "watch the agent".)
- R-05 `exec_command`: capture Output Log; add `python_exec` returning stdout +
  last expression value.
- R-06 `describe_graph`: treat OVERRIDE/event nodes as entry points.
- R-07 `add_state_machine`: honor the `name` param for the sub-graph.
- R-08 anim: auto-wire (or expose a tool to wire) the state machine to the
  AnimGraph Output Pose; validate the ABP actually outputs a pose.
- R-09 `connect_material_pins`: accept the `'Result'` sentinel for the output
  node; allow the named default outputs; document/return pin names.
- R-10 material params: optional name on `add_material_expression`.

### C. Output contract migration (R-11)
- Migrate all reachable tools to `{ ok, data, refs, nextSteps, warnings,
  errorCode }` via the `types.ts` helpers; one entity-ref per tool. Make the C++
  HTTP envelope carry it where practical (ARCHITECTURE §4).

### D. Live view / agent presence (the feature)
- Reveal primitives (editor-only): `editor_open_asset`, `editor_focus_actor`
  (select + frame), `editor_open_level`.
- Scoped save: `editor_save_agent_changes` — save only packages the agent
  dirtied this session; compile BPs first; never the user's unrelated dirty
  assets.
- Opt-in `agent_set_presence({ enabled, autoReveal, autoSave })`, **default OFF**;
  when on, mutation handlers reveal their target *after* the mutation completes
  (same game-thread queue → no race, confirmed by the review).
- Tool-by-tool safety matrix: classify each mutation tool (what to reveal, when,
  what package it dirties). First deliverable of this workstream.
- ADR for the auto-reveal + auto-save policy (single-agent assumption).
- Depends on R-04 (working viewport/screenshot) for visual confirmation.

### Out of scope (separate ROADMAP phases, not this plan)
- Sequencer / MRQ / World Partition (Phase 3), cook/package/PIE-driven shipping
  (Phase 4 beyond exposing existing PIE tools), `cpp_read_symbol` C++ bridge,
  source control. These are tracked in ROADMAP.md and are not part of
  "complete the editor-control surface + live view".
- Multi-agent / multi-editor, remote sessions (ARCHITECTURE §10).

## Approach

Sequence: **A → B → C → D**, but interleave B-fixes as each A-group is smoke
tested (a group that errors on first call is a B-fix). Each newly registered
group is validated live in the `test/test` project and gets the structured
contract. Live-view (D) lands last because it depends on a working viewport
(R-04) and on the actor/level tools (A) it reveals. Every editor-only tool gates
on `/health` `mode==editor` and SEH-wraps native calls (ARCHITECTURE §6,
cpp-ue rules). The presence toggle is server-side state in the editor subsystem;
reveal is best-effort, idempotent, default OFF.

## Validation

- All 36 tool groups reachable; each has ≥1 green live call in `test/test`.
- R-02..R-10 each have a regression check (unit where pure, live where editor).
- `npm run build` + `npm run test:unit` green; structured contract on every
  migrated tool.
- Live view: presence ON → editing BP_X opens BP_X, moving an actor frames it,
  editing a level opens it; presence OFF → nothing opens unless asked.
- Scoped save: agent edits A, user hand-dirties B → save persists A, leaves B.
- No corruption: mutate → reveal → save → reload round-trips intact; reveal
  during an in-flight mutation serializes (no AV) — re-confirm under load.
- Screenshots produce a real non-zero PNG.

## Risks

1. Registering 17 groups surfaces latent bugs in long-unused handlers — mitigate
   by smoke-testing each on registration, fixing before moving on.
2. Focus-stealing from auto-reveal — default OFF, opt-in, idempotent, never on
   read-only tools.
3. Save scope leakage (saving the user's unrelated dirty assets) — track touched
   packages explicitly; compile BPs before save; ADR documents the policy.
4. Editor-only tools crashing the commandlet — gate on `mode==editor`, SEH-wrap,
   return `EDITOR_REQUIRED`.
5. Contract migration churn across ~120 tools — migrate per group as it's touched,
   not in one big-bang pass.

## Dependencies

- Sprint 1 (structured contract + types.ts) — done.
- Live editor on 9847 in `test/test` for live validation — working.
- New ADR: auto-reveal + auto-save policy.
- R-04 (viewport/screenshot) before D's visual confirmation.
- No conflict with existing ADRs; extends ADR-003 (contract) and ADR-004
  (composite flows); complements ROADMAP Phase 5 "watch it happen".
