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

- [ ] **S1-01** Verify TS server builds clean — `cd Tools && npm install && npm run build` produces `dist/index.js` with zero errors
  🔍 Research first: confirm `@modelcontextprotocol/sdk` v1.12 API matches upstream's usage; check for breaking changes since fork

- [ ] **S1-02** Verify C++ plugin compiles in a fresh UE5.4 project via UnrealBuildTool
  _(requires S1-01)_
  ⚠️ Note: needs a host UE5 project with the plugin in `Plugins/UnrealAgent/` — use a throwaway project, not committed
  🔍 Research first: confirm `UnrealAgent.Build.cs` module names still resolve after rename (`UnrealAgent` module name in `.uplugin` must match `Build.cs` filename)

- [ ] **S1-03** Refactor TS `index.ts` and `tools/utility.ts` to implement the structured output contract for the `health` tool only
  _(requires S1-01)_
  ⚠️ Note: this changes the response shape from upstream's text-formatted output — tests in `Tools/test/tools/utility.test.ts` need updating

- [ ] **S1-04** Define `ToolResult<T>` type in `Tools/src/types.ts` and the error code registry, exported for use by all tool files
  _(requires S1-03)_

- [ ] **S1-05** Refactor `bp_list` (currently in `tools/discovery.ts`) to return structured output with `refs.blueprintIds[]`
  _(requires S1-04)_

- [ ] **S1-06** Update tests in `Tools/test/tools/discovery.test.ts` to assert structured output shape
  _(requires S1-05)_

- [ ] **S1-07** Verify end-to-end: open UE5 editor with plugin loaded, run `npm test`, confirm `bp_list` returns `{ ok: true, data: ..., refs: { blueprintIds: [...] } }`
  _(requires S1-02, S1-06)_

- [ ] **S1-08** Add minimal CI: GitHub Actions workflow that runs `npm install && npm run build` on push to `dev`
  ⚠️ Note: full `npm test` requires a UE5 install — defer that to a self-hosted runner in a later sprint

- [ ] **S1-09** Update README.md "Requirements" and "Running the project" sections after verifying actual build steps work
  _(requires S1-07)_

- [ ] **S1-10** First real commit on `dev` branch, push, open the long-lived `dev` → `main` PR
  _(requires S1-09)_
  ⚠️ Note: `dev` doesn't exist yet — `/git-commit` will create it on first push

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
- Performance budget: target <50 ms per HTTP round-trip in editor mode.

---

## Done sprints

| Sprint | Outcome | Closed |
|---|---|---|
| Sprint 0 | Bootstrap complete | 2025-11-20 |
