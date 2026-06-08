# ARCHITECTURE.md

The product bible for `mcp-unreal-agent`. Every architectural decision must be consistent with this document. When something changes here, update [DECISIONS.md](DECISIONS.md) with an ADR.

---

## 1. What we are building

An MCP server that gives AI coding agents (Claude Code, GitHub Copilot, Cursor, anything that speaks MCP) **complete control** of an Unreal Engine 5 editor session.

Not just inspection. Not just Blueprint metadata. The agent should be able to:

- Read and mutate **any asset**: Blueprints, materials, meshes, animations, sequences, MRQ configs, world partition cells, source-control state.
- **Execute composite flows atomically** — e.g. "create a BP, add a variable, compile, save" is one transaction the agent calls once, not four primitives chained by hand.
- **Bridge C++ context** — when a BP references a native class or function, the agent gets the source file path + extracted symbol so it can read and reason about C++ logic without leaving the chat.
- **Build, cook, package** — full game lifecycle, including UAT calls for shipping builds.
- **Test the game** — spawn PIE, drive input, read viewport / log, validate runtime behaviour.

The agent's experience is the first-class concern. The C++ surface area is the lever.

---

## 2. Two-process system

```
┌──────────────────────────────────┐
│ Coding agent (Claude / Copilot)  │
│  ─────────────────────────────── │
│  speaks MCP over stdio           │
└────────────┬─────────────────────┘
             │ MCP JSON-RPC
             ▼
┌──────────────────────────────────┐
│ unreal-agent (Node.js)           │
│  Tools/dist/index.js             │
│  ─────────────────────────────── │
│  - registers MCP tools           │
│  - validates input (Zod)         │
│  - calls plugin HTTP             │
│  - shapes structured output      │
└────────────┬─────────────────────┘
             │ HTTP localhost:9847
             ▼
┌──────────────────────────────────┐
│ UnrealAgent plugin (C++)         │
│  Source/UnrealAgent/             │
│  ─────────────────────────────── │
│  Mode A: editor subsystem        │
│   (auto-starts when UE opens)    │
│  Mode B: headless commandlet     │
│   (spawned by Node if no editor) │
│  ─────────────────────────────── │
│  - HTTP listener on 9847         │
│  - per-domain handler files      │
│  - marshals to game thread       │
│  - SEH-wraps faulty calls        │
└──────────────────────────────────┘
```

### Why two processes

- **MCP servers are tiny and stateless.** The Node side has no UE5 dependency, starts in <100 ms, is restartable.
- **The C++ plugin owns the editor.** UE5 APIs only exist inside a UE5 process. The plugin is where the actual work happens.
- **HTTP between them is the right boundary.** Same machine, localhost, low latency. JSON serializable. Trivial to debug with curl. Survives Node restarts without restarting UE.

### Why HTTP, not a custom IPC

UE5 has good HTTP support out of the box. Adding a custom binary protocol would save ~5 ms per call and cost weeks of complexity. Not worth it. Re-evaluate only if profiling shows the boundary is a real bottleneck for high-fanout tool sequences.

---

## 3. Two serving modes for the plugin

### Mode A: Editor Subsystem (preferred)

`UUnrealAgentEditorSubsystem` derives from `UEditorSubsystem`. UE5 auto-instantiates it when the editor starts. It owns:

- The HTTP listener (started in `Initialize()`).
- A shutdown handler that fires on `Deinitialize()`.

The user opens their UE project → the subsystem boots → the agent can call immediately. Zero overhead, no extra process.

This is the path for **every interactive workflow** (level design, BP editing, material tweaking, sequencer authoring, PIE testing).

### Mode B: Commandlet (headless)

`UUnrealAgentCommandlet` derives from `UCommandlet`. Spawned by the TS server as:

```
UnrealEditor-Cmd.exe <Project>.uproject -run=UnrealAgent
```

It boots a minimal UE process (~60 s startup, 2-4 GB RAM), opens the HTTP listener, and waits. Used for:

- **CI / build pipelines.** No interactive editor available.
- **Batch asset operations.** Re-saving thousands of assets after engine upgrade.
- **First-time install verification.** Detect that the plugin works before asking the user to open the editor.

The TS server detects which mode is live via `/health` and never spawns a duplicate. If both an editor subsystem and a commandlet are running on the same port → port collision → caller error.

### Shutdown

- Editor mode: never shut down by the agent. The user closes the editor.
- Commandlet mode: shut down via `POST /shutdown` (or process kill). The TS server's `gracefulShutdown` does this on `SIGINT`/`SIGTERM`.

---

## 4. The HTTP bridge

Port `9847` by default (override with `UE_PORT` env var). Localhost only. No TLS. No auth. This is a developer tool — the threat model is "the developer's own machine".

If you ever expose this beyond localhost, you must add auth. Don't.

### Request shape

```
POST /<domain>/<verb>
Content-Type: application/json

{ "param1": ..., "param2": ... }
```

Examples:
- `POST /bp/create` { name, parentClass, packagePath }
- `POST /bp/compile` { blueprintId }
- `GET /bp/list?package=/Game/MyAssets`
- `POST /material/setParameter` { materialId, parameterName, value }
- `POST /sequencer/addKeyframe` { sequenceId, trackId, time, value }

### Response shape

Every response is JSON with this envelope (the TS layer maps it to the public `ToolResult` contract):

```json
{
  "ok": true,
  "data": { ... },
  "refs": { "blueprintId": "/Game/Foo.BP_Foo" },
  "nextSteps": ["call bp_compile with this blueprintId"],
  "warnings": [],
  "errorCode": null
}
```

On error: `ok=false`, `errorCode` set, `warnings` populated with details, `data` may be partial or null.

### Routing

`UUnrealAgentServer::Start()` binds routes. New handlers register themselves with `BindRoute("/path", &Handler)`. Dispatch table is plain `TMap<FString, FRouteHandler>`. No regex, no middleware — straight match-and-call.

---

## 5. Tool design — the agent contract

This is the most important section. The whole project's value is in **how the tools chain**, not in how many there are.

### 5.1 Structured output contract

Every tool returns:

```ts
{
  ok: boolean,
  data?: T,
  refs?: { [k: string]: string },
  nextSteps?: string[],
  warnings?: string[],
  errorCode?: string,
}
```

Defined in [`.claude/rules/mcp-tools.md`](../rules/mcp-tools.md).

### 5.2 ID chaining

When a tool creates or locates an entity, it returns the ID in `refs`. The next tool accepts it as a string param. Naming convention:

- `blueprintId` — `/Game/Path/BP_Name` or `BP_Name`
- `materialId` — `/Game/Path/M_Name`
- `actorId` — actor guid in the loaded level
- `sequenceId` — `/Game/Path/LS_Name`
- `mrqJobId` — opaque UUID from MovieRenderQueue subsystem

Agents don't need to understand the format. They pass the string back. This makes multi-step workflows feel like dataflow, not orchestration.

### 5.3 Composite atomic flows

A common workflow is **multiple primitive calls in one transaction**. Instead of forcing the agent to:

1. `bp_begin_transaction`
2. `bp_create`
3. `bp_add_variable`
4. `bp_set_default`
5. `bp_compile`
6. `bp_save`
7. `bp_end_transaction`

We expose **one composite tool**:

```
bp_create_with_variables({
  name, parentClass, packagePath,
  variables: [{ name, type, default }, ...]
})
```

The C++ handler does all of the above inside a single `FScopedTransaction`. Ctrl+Z reverses the whole thing.

**Rule:** if the agent would naturally chain N primitives that all belong in one undoable unit, expose a single composite tool. Primitives stay available for advanced cases.

### 5.4 C++ context bridge

When a Blueprint references a native class, function, or variable, the agent needs to read the C++ source to reason about behaviour.

Tool: `cpp_read_symbol`

Input:
- `symbolName` (e.g. `UMyComponent::HandleHit`)
- `bpContext` (optional — blueprintId to scope the search)

Output:
- `data.filePath` — absolute path to the `.cpp` / `.h`
- `data.lineStart`, `data.lineEnd`
- `data.snippet` — the relevant source range with N lines of context
- `data.kind` — `class | function | variable | enum | struct`

Implementation: the plugin uses UE's reflection (`FProperty`, `UFunction`, `UClass`) to locate the source file via the C++ module's `Build.cs` `IncludePaths`, then reads the file.

Failure modes:
- Symbol not in any loaded module → `SYMBOL_NOT_FOUND`.
- Module sources not on disk (shipping build, plugin not in dev) → `SOURCE_UNAVAILABLE`.

### 5.5 Build / cook / package tools

For full-game testing:

- `cpp_build_project` — runs UnrealBuildTool, returns logs.
- `project_cook` — cooks for a target platform.
- `project_package` — packages an executable, returns artifact path.
- `pie_start` / `pie_stop` / `pie_step` — Play-in-Editor lifecycle.

These can be long-running (cook + package = minutes). The handler returns immediately with a `jobId`, and the agent polls with `job_status(jobId)` until `state == "done"`. The plugin keeps a per-job log buffer the agent can `tail` via `job_log(jobId, fromLine)`.

---

## 6. Threading model

| Thread | What runs here |
|---|---|
| Game thread | All UE5 editor API calls. UObject access. World queries. Asset I/O. |
| HTTP listener thread | Accept loop. Reads request bytes. |
| Worker thread pool | Per-request processing up to the point of UE API call. JSON parsing, validation. |
| `AsyncTask(GameThread, ...)` | The marshalling primitive. Posts work to the game thread, waits on `TPromise` for the result. |

**Rule:** if you touch a UObject, you are on the game thread. No exceptions.

The C++ handler signature:

```cpp
TFuture<TSharedPtr<FJsonObject>> HandleBPCreate(TSharedPtr<FJsonObject> Request);
```

Returns a future. The HTTP listener awaits it (with a timeout — default 30 s) and writes the response.

---

## 7. Install architecture

The install flow is part of the product, not a side concern. It's documented for the agent, executed by the agent, and **adaptive** — it analyses the user's harness, flags conflicts, and asks before destructive changes.

### 7.1 Install harness layout

```
install/
├── AGENT-INSTALL.md           # adaptive installer brain (detect → plan → ask → execute → inject → verify → uninstall)
├── INSTALL.md                 # human-only manual reference
├── PROMPT-TEMPLATES.md        # copy-paste prompts per agent (Claude / Copilot / Cursor / Desktop / generic)
├── claude-mcp-config.json     # template MCP config snippet
└── context-skill/             # the passive context pack injected into the user's harness
    ├── README.md
    ├── SKILL.md               # Claude-format passive skill
    ├── instructions.md        # Copilot-format *.instructions.md variant
    ├── FLOWS.md               # canonical UE5 flows (debug, edit-any, create, observe, PIE…)
    ├── TOOLS.md               # GENERATED catalog of every registered MCP tool
    └── MANAGED-BLOCK.md       # the delimited block injected into the user's main instruction file
```

`TOOLS.md` is regenerated from the actual `server.tool(…)` calls in `Tools/src/tools/*.ts` via `npm run digest` (script at `Tools/scripts/generate-tools-digest.mjs`). This guarantees the skill never drifts from the implementation.

### 7.2 The seven phases

1. **Confirm scope** — one-paragraph preview, get user nod.
2. **Detect** (read-only) — `.uproject` + engine version + harness type(s) + existing MCP servers (flag conflicts) + existing instructions + prereqs (node/git/VS).
3. **Plan** (adaptive) — primary harness, skill placement, MCP-config target, conflict resolution recommendations, build-now vs editor-compile.
4. **Ask** (structured, `AskUserQuestion`-style) — only the decisions that aren't obvious. Conflicts and skill placement always shown.
5. **Execute** — clone / git pull → `npm install && npm run build` → enable plugins in `.uproject` → enable `bRemoteExecution=True` → remove conflicting MCP entries (if approved) → merge `unreal-agent` into the right MCP config.
6. **Inject** — copy `context-skill/{SKILL|instructions, FLOWS, TOOLS}.md` into the harness location; insert the delimited managed block into the primary instruction file (`CLAUDE.md` / `copilot-instructions.md` / `AGENTS.md`).
7. **Verify** — editor restart + agent restart prompt, `health` tool call, confirmation prompt that the skill loaded, sample prompts.

### 7.3 The passive context skill (headline deliverable)

The skill is **always-on** and **referenced from the user's main instruction file** via a delimited managed block (`<!-- BEGIN unreal-agent --> … <!-- END unreal-agent -->`). In every interaction touching the UE5 project — analyse a bug, observe state, create/edit/adjust assets — the agent already knows the MCP tools exist and reaches for them.

Content: precedence rule (user's instructions win), trigger principle, three rules of thumb (inspect-before-mutate, compile-after-mutate, `get_node_properties`→`set_node_property` for any detail), pointer to canonical flows and generated tool catalog.

### 7.4 Uninstall / repair

Same delimiters → clean removal. `Phase 7 — UNINSTALL / REPAIR` in `AGENT-INSTALL.md` walks the reverse path: strip the managed block, remove the skill files, remove only the `unreal-agent` MCP entry, remove the plugin, revert the `.uproject` plugin entry. Leaves the user's `Config/DefaultEngine.ini` Python setting alone (harmless without the plugin) and never touches content outside the delimiters.

The full playbook lives at [`install/AGENT-INSTALL.md`](../../install/AGENT-INSTALL.md).

---

## 8. Dual harness rationale

We support **two coding agents** (Claude Code and GitHub Copilot) from the same instruction set:

- **Source of truth:** `CLAUDE.md` + `.claude/`.
- **Copilot bridge:** `.github/copilot-instructions.md` + `.github/instructions/*.instructions.md`.
- **Universal bridge:** `AGENTS.md` (for Cursor, Aider, Continue, etc.).

Why bother?

1. **Reach.** Many UE5 devs use Copilot inside Rider / VS / VS Code. Forcing them to switch to Claude Code blocks adoption.
2. **Honesty.** The harness is the product. Showing how dual-agent harness layering works is itself a demo of agent tooling competence.
3. **Cheap.** The Copilot bridge is ~40 lines that re-point at `.claude/`. The instructions in `.github/instructions/*.instructions.md` are paste-and-trim copies of `.claude/rules/*.md`. We document the sync rule and enforce it via PR review.

Cost: when a rule changes, we update both files. Mitigation: a CI check (TODO Sprint 1+) that diffs the two and fails on drift.

---

## 9. Test architecture

Vitest with self-bootstrapping commandlet. Pattern lifted intact from upstream — it works.

`Tools/test/bootstrap.ts`:
1. Generates a temporary UE project (just a `.uproject` + the plugin via symlink) at OS temp dir.
2. Spawns `UnrealEditor-Cmd.exe -run=UnrealAgent` against that project.
3. Waits for `/health` to respond.
4. Exposes the port to tests via `globalSetup`.
5. Tears down the commandlet on suite exit.

Per-tool tests in `Tools/test/tools/<name>.test.ts` follow the existing pattern: `createTestBlueprint` / `deleteTestBlueprint` / `uePost` / `ueGet` helpers from `Tools/test/helpers.ts`.

No `.uasset` fixtures committed to the repo — every test creates what it needs and cleans up.

CI runs `npm test` against a UE5 install. Self-hosted runner (UE5 install + 60 s commandlet boot per suite is too heavy for hosted runners). TODO: document runner setup in [SPRINTS.md](SPRINTS.md).

---

## 10. What is explicitly out of scope

- **Runtime gameplay introspection from a shipping build.** Tools target the editor. If you want telemetry from a packaged game, that's a different MCP server.
- **Generic Slate UI scripting.** We don't expose `SWidget` mutation tools. Use `UMG` (`UUserWidget`) — that we do support.
- **Direct file system access.** The agent's host already has file tools. We don't re-expose them.
- **Multi-user editor session sync.** One agent, one editor instance.
- **Cloud / remote UE5 sessions.** Localhost only. If you want remote, run an SSH tunnel.
