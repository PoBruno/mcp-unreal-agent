# mcp-unreal-agent

Complete UE5 agent runtime — MCP server giving AI coding agents (Claude Code, GitHub Copilot, Cursor, anything that speaks MCP) full control of an Unreal Engine 5 editor: Blueprints, materials, sequencer, MRQ, World Partition, source control, cook/package, C++ context.

This file is the **agent entry point**. Both Claude Code and GitHub Copilot read it (Copilot via [.github/copilot-instructions.md](.github/copilot-instructions.md) which delegates here). Cursor and other agents read it via [AGENTS.md](AGENTS.md).

---

## What this project does

Two processes:

- **`UnrealAgent` C++ plugin** — runs inside UE5 editor (or as headless commandlet). Hosts an HTTP server on port `9847`. Calls UE5 editor APIs directly: `UEditorAssetSubsystem`, `UMaterialEditingLibrary`, `UMovieScene*`, `UWorldPartitionSubsystem`, `FScopedEditorTransaction`, etc.
- **`unreal-agent` TypeScript MCP server** — translates MCP tool calls from agents into HTTP calls to the plugin. Ships ~38 tools today, expanding to ~120 across 12 domains.

Two serving modes:
- **Editor subsystem** (preferred): auto-starts when editor opens. Zero overhead.
- **Commandlet**: spawned by the TS server when no editor is detected. Used for CI, asset batch ops, headless cook.

Agents call tools like `bp_read_graph`, `material_set_param`, `sequencer_add_keyframe`, `mrq_render`, `cook_project`. Every response includes IDs that chain into the next call.

---

## Tech stack

| Layer | Tech |
|---|---|
| Unreal Engine | 5.4+ |
| Plugin language | C++ (UE5 modules: `UnrealEd`, `BlueprintGraph`, `KismetCompiler`, `MaterialEditor`, `MovieSceneTools`, `WorldPartitionEditor`, `MovieRenderPipelineCore`, `SourceControl`) |
| HTTP server | Custom socket listener inside plugin (no third-party HTTP dep) |
| MCP server | TypeScript on Node.js 18+, `@modelcontextprotocol/sdk` v1.12+ |
| Schema validation | Zod |
| Tests | Vitest with self-bootstrapping commandlet harness |
| Bridge | HTTP localhost:9847 (JSON in, JSON out) |
| Python escape hatch | `PythonScriptPlugin` enabled in `.uproject`, `unreal.ScopedEditorTransaction` available for composite mutations |

---

## Architecture principles

1. **Subsystem-first, deprecated APIs banned.** Use `UEditorAssetSubsystem`, `UEditorActorSubsystem`, `ULevelEditorSubsystem`. Never `UEditorAssetLibrary`, `UEditorLevelLibrary`. Detect at PR review time.
2. **Composite atomic flows.** A single high-level tool wraps `BeginTransaction` → mutations → `EndTransaction`. Agents shouldn't have to orchestrate transactions manually. See [.claude/skills/tool-chains/SKILL.md](.claude/skills/tool-chains/SKILL.md).
3. **Structured output contract.** Every tool returns `{ ok, data, refs, nextSteps, warnings, errorCode }`. `refs` are IDs the agent can pass to the next tool. `nextSteps` are hints (not commands). See [.claude/rules/mcp-tools.md](.claude/rules/mcp-tools.md).
4. **C++ context bridge.** When a Blueprint references a C++ class, function, or variable, the agent gets the source file path + extracted symbol. Tool: `cpp_read_symbol`. See [.claude/docs/ARCHITECTURE.md](.claude/docs/ARCHITECTURE.md#c-context-bridge).
5. **SEH-wrap fault-prone calls.** Compile and save can crash native UE code on Windows. Every C++ handler that calls `FKismetEditorUtilities::CompileBlueprint` or `UPackage::SavePackage` runs inside `__try`/`__except`.
6. **Editor mode is the default.** The commandlet exists for CI and batch ops, not for normal agent work. If the editor is open, the TS server detects it and never spawns a duplicate.
7. **Dual harness, single source of truth.** All conventions live in `CLAUDE.md` and `.claude/`. The `.github/copilot-instructions.md` is a thin bridge that re-exports them. No drift allowed.

---

## Project documentation

All living docs are in [.claude/docs/](.claude/docs/). **`ARCHITECTURE.md` is the bible** — read it before touching any domain, keep it current via `/save`.

| File | Purpose |
|---|---|
| [.claude/docs/ARCHITECTURE.md](.claude/docs/ARCHITECTURE.md) | System design bible — components, threading, IPC, tool contract, C++ bridge, install flow |
| [.claude/docs/DECISIONS.md](.claude/docs/DECISIONS.md) | ADRs — why we chose X over Y |
| [.claude/docs/PLAN.md](.claude/docs/PLAN.md) | Single active plan, zeroed by `/plan-new` |
| [.claude/docs/ROADMAP.md](.claude/docs/ROADMAP.md) | 5-phase plan, milestones |
| [.claude/docs/SPRINTS.md](.claude/docs/SPRINTS.md) | Active sprint tasks — source of truth for what to work on |
| [.claude/docs/HISTORY.md](.claude/docs/HISTORY.md) | Session snapshots — grown by `/save` |

Domain rules in [.claude/rules/](.claude/rules/) (loaded per-file by `applyTo` glob):

| File | applyTo |
|---|---|
| [.claude/rules/cpp-ue.md](.claude/rules/cpp-ue.md) | `Source/**/*.cpp, Source/**/*.h` |
| [.claude/rules/typescript.md](.claude/rules/typescript.md) | `Tools/**/*.ts` |
| [.claude/rules/mcp-tools.md](.claude/rules/mcp-tools.md) | `Tools/src/tools/**/*.ts` |
| [.claude/rules/python-ue.md](.claude/rules/python-ue.md) | `**/*.py` |

Skills in [.claude/skills/](.claude/skills/) — domain knowledge packaged for the agent to load on demand:

| Skill | When to load |
|---|---|
| `tool-chains` | Designing a new composite tool, or chaining existing tools |
| `ue5-api-cheat` | Need the right Subsystem / library / method for a UE5 operation |
| `mcp-tool-schema` | Defining a new MCP tool's input/output shape |
| `install` | Working on or executing the install playbook |
| `cpp-context-bridge` | Implementing tools that read C++ source referenced from BPs |

---

## Passive behaviors (always active)

These apply in every conversation without invoking a command.

**Before implementing any feature:**
- Check [.claude/docs/SPRINTS.md](.claude/docs/SPRINTS.md) — confirm the task is in the active sprint. If not, ask before starting.
- Check [.claude/docs/DECISIONS.md](.claude/docs/DECISIONS.md) — your design might already have an ADR.

**Before any architecture or tech decision:**
- Read [.claude/docs/ARCHITECTURE.md](.claude/docs/ARCHITECTURE.md). It is the source of truth.
- If it's a genuinely new call, add an ADR (problem / decision / rationale / alternatives).
- If your idea conflicts with an existing ADR, surface the conflict before writing code.

**After completing a sprint task:**
- Mark it `[x]` in SPRINTS.md with `<!-- done: YYYY-MM-DD -->`.
- Say: "SN-XX done — run `/save` to persist this session."

**When touching C++ plugin code:**
- Use UE5.4+ Subsystem APIs. Never use deprecated `EditorAssetLibrary` / `EditorLevelLibrary`.
- Wrap any compile / save / package call in SEH (`__try`/`__except`) — these can crash native code.
- Mutations must run inside `FScopedTransaction` for undo support.
- After ANY C++ change you must build and verify with UnrealBuildTool. Do not ask the user to build — run it yourself.

**When touching TypeScript MCP server code:**
- Every tool returns the structured contract (see [.claude/rules/mcp-tools.md](.claude/rules/mcp-tools.md)).
- Zod schema for every input — no `any`.
- Integration test required: add to `Tools/test/tools/<your-tool>.test.ts`.
- After ANY TS change run `npm run build`. Sub-agents do not build — the parent agent does.

**When writing MCP tool descriptions:**
- They are read by the LLM consuming them. Write for that audience: what it does, when to use it, inputs, outputs.
- Under 200 chars for simple tools; structured multiline for complex ones.

**When writing anything external (commits, PRs, README, docs outside `.claude/`):**
- Write as a developer, not as an AI — short, direct, lowercase after the prefix.
- Banned words: "ensure", "leverage", "facilitate", "utilize", "implement", "comprehensive", "robust", "seamless", "straightforward".
- No AI attribution markers, no "Generated with Claude", no co-author trailers.
- Commit: `fix race in HTTP shutdown` not `fixed the race condition that was occurring during HTTP server shutdown`.

---

## Available commands (Claude Code slash commands)

Live in [.claude/commands/](.claude/commands/). All are designed to be chained.

### Planning

| Command | When to use |
|---|---|
| `/plan-new` | Start of any feature or phase. Reads ARCHITECTURE.md, zeros current plan, drafts a fresh one. |
| `/plan-analyse` | After `/plan-new`. Product-engineer critique, validates against architecture. |
| `/plan-replan` | After `/plan-analyse`. Applies critique, reconciles with architecture, closes the plan. |
| `/plan-roadmap` | After `/plan-replan`. Converts final plan into ROADMAP.md + Sprint 1 tasks. |

### Execution

| Command | When to use |
|---|---|
| `/work` | Start of a coding session — shows sprint state, sets engineer mode, ready to build. |
| `/sprint` | Refine or re-plan sprint tasks outside `/work`. |
| `/validate` | Before starting a new phase — senior UE5 + TS engineer review of current state. |

### Persistence & delivery

| Command | When to use |
|---|---|
| `/save` | End of any meaningful session. Updates ARCHITECTURE, DECISIONS, HISTORY, marks tasks done. |
| `/git-commit` | After `/save`. Stages specific files, proposes commit message, pushes. |
| `/git-pr` | After `/git-commit`. Creates / updates the long-lived `dev` → `main` PR. |

GitHub Copilot users: these are not slash commands in Copilot, they are conventions. Reference them in chat as "follow /plan-new" and the agent executes the same sequence.

---

## Git workflow

Permanent `dev` integration branch. `main` is release-only.

- **`dev` is permanent.** All day-to-day work commits to `dev` (or a topic branch off `dev`). Never deleted, never merged away.
- **`main` is release-only.** Advances only via a long-lived PR from `dev` → `main`. `/git-pr` creates or updates that single PR.
- **Never** commit directly to `main`.
- **Never** use `git add -A` — always stage specific files.
- Commit format: `type: short description` (max 72 chars). Types: `feat`, `fix`, `wip`, `refactor`, `chore`, `docs`, `test`.

---

## Repository structure

```
mcp-unreal-agent/
├── CLAUDE.md                       # this file — agent entry point
├── AGENTS.md                       # universal bridge for Cursor / others
├── README.md                       # human entry point + one-prompt install
├── LICENSE                         # MIT
├── NOTICE                          # upstream attribution
├── CONTRIBUTING.md                 # open to humans and AI agents
├── UnrealAgent.uplugin             # UE5 plugin descriptor
│
├── Source/
│   └── UnrealAgent/                # C++ plugin
│       ├── UnrealAgent.Build.cs
│       ├── Public/                 # headers
│       └── Private/                # implementations
│           ├── UnrealAgentServer.cpp           # HTTP listener
│           ├── UnrealAgentEditorSubsystem.cpp  # editor-mode host
│           ├── UnrealAgentCommandlet.cpp       # headless host
│           └── UnrealAgentHandlers_*.cpp       # one file per domain
│
├── Tools/                          # TypeScript MCP server
│   ├── package.json
│   ├── tsconfig.json
│   ├── vitest.config.ts
│   ├── src/
│   │   ├── index.ts                # MCP server entry
│   │   ├── ue-bridge.ts            # HTTP client + commandlet lifecycle
│   │   ├── tools/                  # one file per tool group
│   │   └── resources/              # MCP resources (workflows, listings)
│   └── test/
│       ├── bootstrap.ts            # spawns temp UE project + commandlet
│       └── tools/                  # one test file per tool group
│
├── install/                        # install harness for end users
│   ├── AGENT-PLAYBOOK.md           # agent-executable install steps
│   ├── PROMPT-TEMPLATES.md         # copy-paste prompts for Claude / Copilot
│   └── claude-mcp-config.json      # MCP config snippet template
│
├── .claude/                        # dev harness — Claude + Copilot read this
│   ├── docs/                       # living architecture / roadmap / sprint
│   ├── rules/                      # domain rules (applyTo globs)
│   ├── skills/                     # domain knowledge skills
│   └── commands/                   # slash commands
│
└── .github/
    ├── copilot-instructions.md     # bridge: delegates to CLAUDE.md
    └── instructions/               # applyTo-scoped instructions for Copilot
```

---

## Coding conventions

- **No comments unless the WHY is non-obvious.** Names should explain the what.
- **One responsibility per file.** Handler files split by domain. TS tool files split by feature group.
- **Never `Task.Result` or `.Wait()` in TS.** Always `await`. Same applies to C++ `Future::Wait()` — use callbacks or polling.
- **Zod schemas at the boundary.** No `any`, no untyped responses.
- **`record`/`interface` types for data transfer.** Immutable, structurally typed.
- **JSON in/out via `JsonObjectConverter` (C++) and `JSON.stringify` (TS).** No hand-rolled parsing.

---

## Running the project

```powershell
# TypeScript MCP server — build
cd Tools
npm install
npm run build

# Test suite (boots temp UE project + commandlet)
npm test

# C++ plugin — build via UnrealBuildTool
# from your UE project root (where the .uproject lives):
& "C:\Program Files\Epic Games\UE_5.4\Engine\Build\BatchFiles\Build.bat" `
  <YourProject>Editor Win64 Development `
  "<path\to\YourProject.uproject>" -waitmutex
```

---

## Claude Code config

```json
{
  "mcpServers": {
    "unreal-agent": {
      "command": "node",
      "args": ["Plugins/UnrealAgent/Tools/dist/index.js"],
      "env": { "UE_PROJECT_DIR": "." }
    }
  }
}
```

Lives at `.mcp.json` in your project root (next to the `.uproject`).

## GitHub Copilot / VS Code config

```json
{
  "mcp": {
    "servers": {
      "unreal-agent": {
        "command": "node",
        "args": ["Plugins/UnrealAgent/Tools/dist/index.js"],
        "env": { "UE_PROJECT_DIR": "." }
      }
    }
  }
}
```

In `.vscode/mcp.json` or User Settings → `mcp`.

---

## Sprint task format

Every task in SPRINTS.md follows this exact format.

### Task ID
```
SN-XX   where N = sprint number, XX = zero-padded task number (01, 02, …)
```

### Task line
```markdown
- [ ] **SN-XX** One-line description — include done criteria inline
  _(requires SN-YY)_
  ⚠️ Note: one-line warning about a non-obvious constraint
  🔍 Research first: one-line of what to verify before writing code
```

### Marking done
```markdown
- [x] **SN-XX** Description <!-- done: YYYY-MM-DD -->
```

### Estimates
30 min – 4 h per task. Larger = split.

---

## Tool output contract — quick reference

Every MCP tool must return:

```ts
type ToolResult<T> = {
  ok: boolean;
  data?: T;                    // shape varies per tool
  refs?: Record<string, string>; // IDs other tools can consume
  nextSteps?: string[];        // hints, not commands
  warnings?: string[];
  errorCode?: string;          // when ok=false
};
```

See [.claude/rules/mcp-tools.md](.claude/rules/mcp-tools.md) for the full contract, error code table, and ID-chain conventions.

---

## When in doubt

1. Search [.claude/docs/ARCHITECTURE.md](.claude/docs/ARCHITECTURE.md) and [.claude/docs/DECISIONS.md](.claude/docs/DECISIONS.md) first.
2. Check the active sprint in [.claude/docs/SPRINTS.md](.claude/docs/SPRINTS.md).
3. Read the relevant skill in [.claude/skills/](.claude/skills/).
4. Then ask.
