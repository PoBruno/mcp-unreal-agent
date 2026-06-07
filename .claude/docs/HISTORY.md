# HISTORY.md

Session snapshots. Each entry is what was decided, what was built, what we learned. Append-only. Grown by `/save`.

---

## 2025-11-20 — Bootstrap session

### Context
Started from a UE5 contribution research session inside the `wincontrol-mcp` workspace. Originally aimed to land a v3 contribution plan into upstream `mirno-ehf/ue5-mcp`. Pivoted mid-session: upstream is intentionally tight, AI-only, BP-only. Our scope (asset pipeline + cinematic + MRQ + WP + cook/package + C++ context bridge) doesn't fit. Decision: fork (not GitHub-fork — fresh repo with attribution).

### What was built
- GitHub repo `PoBruno/mcp-unreal-agent` created.
- Local clone at `D:\repo\mcp-unreal-agent`.
- C++ plugin + TS server lifted from upstream as starting foundation.
- Full rename `BlueprintMCP` → `UnrealAgent` across 155 files (case-sensitive, including filenames and folders).
- Dual harness: `CLAUDE.md` (root, source of truth), `.claude/` (docs, rules, skills, commands), `.github/copilot-instructions.md` + `.github/instructions/*` (Copilot bridge), `AGENTS.md` (universal).
- `install/` folder with `AGENT-PLAYBOOK.md` (agent-executable steps) and `PROMPT-TEMPLATES.md` (copy-paste prompts for Claude / Copilot).
- 6 ADRs in DECISIONS.md covering: fork rationale, rename, structured output contract, composite atomic flows, dual harness, HTTP IPC, open contribution policy.
- 5-phase roadmap (Foundation → Asset pipeline → Composite BP + Level → Cinematic + MRQ + WP → Build + Cook + PIE + SC → Polish).
- Sprint 0 (bootstrap) marked complete. Sprint 1 (smoke path) drafted with 10 tasks.

### Decisions made
- ADR-001: fork upstream rather than contribute.
- ADR-002: full rename to UnrealAgent.
- ADR-003: structured output contract.
- ADR-004: composite atomic flows over primitive chains.
- ADR-005: dual harness from one source of truth.
- ADR-006: HTTP on localhost:9847.
- ADR-007: open contribution policy.

### What we learned
- Mechanical renames are cheap when done before the first build. Doing it later compounds.
- Dual harness from one source of truth (`.claude/`) with Copilot as a thin bridge (`.github/copilot-instructions.md` + paste-and-trim instructions) keeps drift bounded but visible.
- The install playbook works best as a single agent-executable document — not a script — because the agent already has shell tools and benefits from understanding the *why* of each step.

### Open follow-ups
- Sprint 1 not started. First action: verify `npm install && npm run build` succeeds, then verify C++ compiles in a real UE5.4 project.
- No CI yet. Sprint 1 adds the minimal "build TS" workflow.
- No tests run yet against the renamed code — needs a UE5 install.
