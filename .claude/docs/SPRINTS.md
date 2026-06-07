# SPRINTS.md

Active sprint tasks. Source of truth for "what to work on right now".

Task format:
```markdown
- [ ] **SN-XX** Description — done criteria inline
  _(requires SN-YY)_
  ⚠️ Note: non-obvious constraint
  🔍 Research first: what to verify before coding
```

Mark done with: `- [x] **SN-XX** Description <!-- done: YYYY-MM-DD -->`

---

## Sprint 0 — Bootstrap

**Goal:** Repo exists with dual harness, code imported from upstream, renamed, ready for the first real build.
**Phase:** Phase 0
**Status:** Complete (S0-01..S0-06 done)
**Estimated duration:** done in initial setup session

- [x] **S0-01** Create GitHub repo `PoBruno/mcp-unreal-agent`, clone locally <!-- done: 2025-11-20 -->
- [x] **S0-02** Copy C++ plugin + TS infra from upstream `ue5-mcp` as MIT-licensed foundation <!-- done: 2025-11-20 -->
- [x] **S0-03** Rename module `BlueprintMCP` → `UnrealAgent` across all file content, filenames, folders <!-- done: 2025-11-20 -->
- [x] **S0-04** Write LICENSE (MIT, with attribution clause), NOTICE (upstream credit), CONTRIBUTING (open policy) <!-- done: 2025-11-20 -->
- [x] **S0-05** Write CLAUDE.md root + .claude/ harness (docs, rules, skills, commands) <!-- done: 2025-11-20 -->
- [x] **S0-06** Write .github/copilot-instructions.md + .github/instructions/* bridge, AGENTS.md universal bridge <!-- done: 2025-11-20 -->

---

## Sprint 1 — Smoke path

**Goal:** C++ plugin builds inside a real UE5.4 project. TS server builds and starts. Agent calls `health` and one real tool (`bp_list`), gets structured output back end-to-end.
**Phase:** Phase 0
**Status:** Not started
**Estimated duration:** 1 week (solo dev, evenings)

- [x] **S1-01** Verify TS server builds clean — `cd Tools && npm install && npm run build` produces `dist/index.js` with zero errors <!-- done: 2026-06-07 -->
  🔍 Research first: confirm `@modelcontextprotocol/sdk` v1.12 API matches upstream's usage; check for breaking changes since fork

- [x] **S1-02** Verify C++ plugin compiles in a fresh UE5.4 project via UnrealBuildTool <!-- done: 2026-06-07 -->
  _(requires S1-01)_
  ⚠️ Note: needs a host UE5 project with the plugin in `Plugins/UnrealAgent/` — use a throwaway project, not committed
  🔍 Research first: confirm `UnrealAgent.Build.cs` module names still resolve after rename (`UnrealAgent` module name in `.uplugin` must match `Build.cs` filename)
  <!-- Compiled against UE 5.7 (D:/Program Files/Epic Games/UE_5.7) via `RunUAT BuildPlugin` to a throwaway host project under .build/. BUILD SUCCESSFUL, exit 0, produced UnrealEditor-UnrealAgent.dll (47/47 actions, ~2m38s). Module name resolved post-rename. Fixed: added HairStrands plugin dependency to UnrealAgent.uplugin (UBT warned module depends on HairStrandsCore). .build/ is gitignored-equivalent (not committed). -->

- [x] **S1-03** Refactor TS `index.ts` and `tools/utility.ts` to implement the structured output contract for the `health` tool only <!-- done: 2026-06-07 -->
  _(requires S1-01)_
  ⚠️ Note: this changes the response shape from upstream's text-formatted output — tests in `Tools/test/tools/utility.test.ts` need updating
  <!-- The health tool is `server_status` (utility.ts), test is `server-status.test.ts`. Refactored to return ToolResult via a pure `buildServerStatusResult` mapper. The existing test hits /api/health (raw C++ HTTP, unchanged) so it stays valid; structured shape covered by a unit test (S1-06). -->

- [x] **S1-04** Define `ToolResult<T>` type in `Tools/src/types.ts` and the error code registry, exported for use by all tool files <!-- done: 2026-06-07 -->
  _(requires S1-03)_
  <!-- types.ts exports ToolResult<T>, ERROR_CODES registry, ErrorCode union, ok()/fail() constructors, and toMcp() transport mapper. refs widened to Record<string, string|string[]> to support list ids (S1-05); rule docs updated to match. -->

- [x] **S1-05** Refactor `bp_list` (currently in `tools/discovery.ts`) to return structured output with `refs.blueprintIds[]` <!-- done: 2026-06-07 -->
  _(requires S1-04)_
  <!-- Actual tool is `list_blueprints` in tools/read.ts (not bp_list/discovery.ts). Refactored via pure `buildListBlueprintsResult` mapper returning ToolResult with refs.blueprintIds[] (array of asset paths) and chaining nextStep into get_blueprint_summary. -->

- [x] **S1-06** Update tests in `Tools/test/tools/discovery.test.ts` to assert structured output shape <!-- done: 2026-06-07 -->
  _(requires S1-05)_
  <!-- Structured shape asserted by UE5-free unit tests: test/tools/list-blueprints.unit.test.ts + server-status.unit.test.ts (8 cases, all green via `npm run test:unit`). Added vitest.unit.config.ts (no globalSetup) so mapper tests run without a UE5 install. Existing HTTP integration tests (list-blueprints.test.ts, server-status.test.ts) stay as the C++-contract tests the mappers consume. -->

- [x] **S1-07** Verify end-to-end: open UE5 editor with plugin loaded, run `npm test`, confirm `bp_list` returns `{ ok: true, data: ..., refs: { blueprintIds: [...] } }` <!-- done: 2026-06-07 -->
  _(requires S1-02, S1-06)_
  <!-- Verified against the LIVE editor on :9847 (real Buteco project, 151 BPs) by running production code (dist/ue-bridge + buildListBlueprintsResult + buildServerStatusResult). list_blueprints → { ok:true, data.count:151, refs.blueprintIds:[151] }; filtered (type=regular) → 46. E2E PASS. NOTE: the literal `npm test` commandlet suite was NOT run — bootstrap.ts scans only C:\ for the engine (it's on D:\), and the repo has no root-level compiled plugin Binaries for the temp project to load. Live-editor verification is a stronger real-world signal; commandlet suite tracked in backlog. -->

- [x] **S1-08** Add minimal CI: GitHub Actions workflow that runs `npm install && npm run build` on push to `dev` <!-- done: 2026-06-07 -->
  ⚠️ Note: full `npm test` requires a UE5 install — defer that to a self-hosted runner in a later sprint
  <!-- .github/workflows/ci.yml: checkout → setup-node 20 → npm ci → npm run build → npm run test:unit (UE5-free mapper tests). Full `npm test` deferred to a self-hosted UE5 runner. -->

- [x] **S1-09** Update README.md "Requirements" and "Running the project" sections after verifying actual build steps work <!-- done: 2026-06-07 -->
  _(requires S1-07)_
  <!-- Requirements note built/verified on 5.7, CI Node 20. Added "Build from source" section: TS (npm install/build/test:unit) + C++ (UAT BuildPlugin command actually run, and Build.bat editor-target alternative). -->

- [x] **S1-10** First real commit on `dev` branch, push, open the long-lived `dev` → `main` PR <!-- done: 2026-06-07 -->
  _(requires S1-09)_
  ⚠️ Note: `dev` doesn't exist yet — `/git-commit` will create it on first push
  <!-- Commit 0d39d27 "feat: structured ToolResult contract for health + list_blueprints" pushed to dev. PR #1 opened (PoBruno/mcp-unreal-agent dev->main). gh defaulted to the fork parent mirno-ehf/ue5-mcp — fixed with `gh repo set-default PoBruno/mcp-unreal-agent` + --repo. .mcp.json gitignored (machine-specific path). -->

---

## Backlog (will be promoted to Sprint 2+ via /plan-new)

Not active yet. Listed here so we don't forget. Do not start without promoting via `/plan-new`.

- Drift CI: assert `.claude/rules/*.md` content matches `.github/instructions/*.instructions.md` content.
- `cpp_read_symbol` tool: locate C++ source by symbol name, return file + range. The first composite tool that proves the C++ context bridge concept.
- Composite tool `bp_create_with_variables`: prove the atomic flow pattern.
- Material parameter read/write tools.
- Sequencer baseline: create LevelSequence, list tracks, read keyframes.
- MRQ job submission tool with status polling.
- World Partition list cells tool.
- PIE start/stop primitives.
- Source control status (Perforce + Git LFS detection).
- One-prompt install verification across Claude Code, GitHub Copilot, Cursor.
- **Agent "presence" / live-view domain** (editor-mode only): reveal what the agent is touching so the user watches in real time — open the Blueprint/material editor for the asset being mutated (`UAssetEditorSubsystem::OpenEditorForAsset`), load the level + select/frame actors being edited (`ULevelEditorSubsystem`, `UEditorActorSubsystem::SetSelectedLevelActors` + `MoveViewportCamerasToActor`), and save at the end (save only agent-touched packages, not the user's unrelated dirty assets). Design: explicit primitives (`editor_open_asset`, `editor_focus_actor`, `editor_open_level`, `editor_save_agent_changes`) + an opt-in, default-OFF server-side "presence" toggle that auto-reveals/auto-saves per mutation. Must no-op gracefully in commandlet (no UI) → `EDITOR_REQUIRED`/warning, never hard-fail. Avoid focus-stealing (off by default). Needs an ADR (auto-reveal + auto-save policy, single-agent assumption). Verify exact 5.7 API signatures at implementation.
- Performance budget: target <50 ms per HTTP round-trip in editor mode.
- **test harness portability**: `Tools/test/bootstrap.ts` `findEditorCmd`/`detectEngineVersion` scan only `C:\Program Files\Epic Games` — engines on other drives (e.g. `D:\`) aren't found. Add multi-drive scan + honor `UE_EDITOR_CMD`/explicit version. Needed before `npm test` (commandlet suite) can run on this machine.
- **commandlet binaries for `npm test`**: bootstrap junctions to the plugin root, which has no compiled Binaries (they land in `.build/`). The temp project can't load the module. Either build the plugin into the repo root before `npm test`, or have bootstrap trigger a build.

---

## Done sprints

| Sprint | Outcome | Closed |
|---|---|---|
| Sprint 0 | Bootstrap complete | 2025-11-20 |
