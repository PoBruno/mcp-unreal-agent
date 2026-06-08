# PLAN — onboarding / install + passive context skill

**Status:** IMPLEMENTED — see `install/AGENT-INSTALL.md`, `install/context-skill/`, and `Tools/scripts/generate-tools-digest.mjs`.
**Date:** 2026-06-07
**Goal:** when a user installs `mcp-unreal-agent` into their UE5 project, the install is
**harness-aware and adaptive**: it analyzes the agent setup the user already has, detects
conflicts, proposes the right changes, and — the headline — installs a **passive context
skill** that is referenced from the user's *main* instruction file so that in **any**
interaction (analyze a bug, observe state, create/edit/adjust assets) the agent already
knows the UE tools exist and reaches for them. The user's own project instructions always
take precedence.

---

## Reference studied: `mirno-ehf/ue5-mcp`

- README is one line ("Set up <repo> in my project"); the installer **is the agent**
  reading the repo's `CLAUDE.md ## Setup`.
- Clones whole repo into `Plugins/BlueprintMCP/`, `npm install && build`, writes
  `.mcp.json` at project root, **editor auto-compiles the C++** on first open.
- Asks the user **nothing**. Documents only Claude Code + Claude Desktop. Conflict
  handling = "merge the `mcpServers` key". **No context/skill injected into the user's
  harness** — their agent gets the tools but no know-how on how to use them.

## Where we already are (ahead of the reference)

`install/` already has: `AGENT-PLAYBOOK.md` (10 steps with user-confirmation gates,
`.uproject` editing, Python remote-exec, multi-client config, failure recovery),
`INSTALL.md` (human manual), `PROMPT-TEMPLATES.md` (per-client entry prompts),
`claude-mcp-config.json`. We already cover Claude Code / Copilot / Cursor / Desktop.

## Gaps this plan closes

1. Detection→ask is prose, not adaptive. No detection of **competing MCP servers** (e.g.
   upstream `ue5-mcp`/`blueprint-mcp`), no "disable & centralize" proposal.
2. **No passive context skill** injected into the harness the user already has — so the
   user's agent never learns our flows/tools/contract, and doesn't reach for them
   automatically.
3. The two-scenario matrix (Claude / Copilot × harness present / absent) isn't explicit.
4. Logic is spread across files; no single "brain" doc.

---

## The headline deliverable: the passive context skill

A **user-facing** context pack (distinct from this repo's *dev* `.claude/`). It is
**always-on** and **referenced from the user's main instruction file** so the agent
carries it in every interaction. It contains:

- **What the plugin/MCP does** — the domains and the ~190 tools, summarized.
- **The architecture schema** — the tool contract (`{ok,data,refs,nextSteps,warnings,
  errorCode}`), the `refs`→input ID-chain, the `compile_blueprint` loop, `inspect`/
  `get_edit_context` before mutating, the live-view (open-as-tab) behavior.
- **The canonical flows** — BP authoring, material authoring, anim setup, actor/level,
  *debug-a-bug* (compile → read errors by nodeId → fix → recompile), *observe* (screenshot/
  capture), *edit any property* (`get_node_properties`→`set_node_property`).
- **A precedence rule (hard):** "The user's own project instructions take precedence.
  This skill only ADDS Unreal Engine tool know-how; it never overrides the user's
  conventions, workflow, or other instructions."
- **A trigger principle:** "For ANY task touching this UE project — analyzing a bug,
  observing state, creating/editing/adjusting assets — prefer these MCP tools over manual
  guesswork; they give live, structured, editor-accurate results."

### Accuracy: generate it from the source of truth
To stop the skill drifting from reality, the tool/flow/schema catalog is **generated from
the actual registered Zod tool schemas** (a build step emits a `TOOLS-DIGEST.md`), and the
skill embeds/references that digest. Curated flows + generated tool schema = always-correct.

### Per-harness shape (decided ADAPTIVELY at install — see below)
- **Claude Code:** `.claude/skills/unreal-agent/SKILL.md` (passive skill, frontmatter
  `name`/`description`/when-to-use) + a delimited managed block in the user's `CLAUDE.md`
  pointing to it.
- **GitHub Copilot:** `.github/instructions/unreal-agent.instructions.md` (with `applyTo`
  globs for UE files) + a delimited managed block in `copilot-instructions.md`.
- **Cursor / other:** pointer in `AGENTS.md`.

---

## The installer: adaptive, harness-aware (the user's key refinement)

The injection method is **not a fixed choice** — the installer **analyzes the user's
harness and plans the best placement**, then proposes it. Phases:

### Phase 1 — DETECT (read-only, build a picture)
- Agent/harness type: Claude Code (`.claude/`, `CLAUDE.md`, `.mcp.json`), Copilot
  (`.github/copilot-instructions.md`, `.github/instructions/`, `.vscode/mcp.json`),
  Cursor (`AGENTS.md`/`.cursor`), Claude Desktop.
- The `.uproject` + `EngineAssociation` (5.4+); whether the plugin is already present.
- **Existing MCP servers** in every config it finds — and flag any that **overlap**
  (UE/Blueprint MCPs, anything binding port 9847).
- Prereqs: Node 18+, git, VS C++ workload, PythonScriptPlugin.
- **The user's existing instructions/rules/skills** — so we can plan placement that
  respects and complements them, never clobbers.

### Phase 2 — PLAN (decide the adaptive injection)
From the detected state, compute the proposal:
- Where the passive skill file goes + how it's referenced from the main instruction.
- Which conflicting MCP servers to propose disabling (centralize on `unreal-agent`).
- How to merge MCP config + `.uproject` + `DefaultEngine.ini` without overwriting.
- Whether to build C++ now or rely on editor auto-compile.

### Phase 3 — ASK (structured, via AskUserQuestion)
Present the detected picture + the proposed plan and get approval/edits. Likely questions:
- "Detected agent = X. Correct, or pick another?"
- "Found overlapping MCP servers [Y, Z]. Disable them and centralize on unreal-agent /
  keep all / replace?"
- "I'll add the unreal-agent context skill and reference it from <your CLAUDE.md /
  copilot-instructions>. OK, or place it elsewhere?"
- "Build the C++ plugin now, or let the editor compile it on first open?"

### Phase 4 — EXECUTE
Clone/place plugin → `npm install && build` → enable plugin + Python remote-exec → write/
merge MCP config → **install the passive skill + wire the managed reference** → (optional
C++ build). All edits idempotent + reversible (delimited managed blocks).

### Phase 5 — VERIFY + first run
Health check (`mode == editor`), confirm the skill/reference is in place, suggest 2–3
sample prompts that exercise the flows.

### Two-scenario matrix
| | Harness present | No harness |
|---|---|---|
| **Claude Code** | analyze `.claude/`+`CLAUDE.md`; add skill + managed pointer block | create minimal `CLAUDE.md` whose core is the pointer to the skill |
| **Copilot** | analyze `.github/`; add `*.instructions.md` + managed block in `copilot-instructions.md` | create minimal `copilot-instructions.md` + the instructions file |

---

## File/structure changes (proposed — for review)

1. **`install/AGENT-INSTALL.md`** — the single "brain": Detect → Plan → Ask → Execute →
   Inject → Verify. Absorbs `AGENT-PLAYBOOK.md` (kept as legacy or removed). `INSTALL.md`
   stays as the human manual.
2. **Passive skill template** shipped in the repo (the thing that gets installed into the
   user's project), e.g. `install/context-skill/SKILL.md` + `instructions.md` variants,
   parameterized for the detected harness.
3. **`TOOLS-DIGEST.md` generator** — a `Tools/` script that emits the tool/schema catalog
   from the Zod registry, consumed by the skill so it never drifts.
4. **`PROMPT-TEMPLATES.md`** — updated entry prompts that point at `AGENT-INSTALL.md`.
5. Optional: a Claude `/install` skill in this repo's dev harness that runs the flow for
   Claude Code users (Copilot/others use the markdown playbook). *(Open question — see
   below; user leaned toward "passive skill referenced in main instruction", not a
   command-style installer.)*

## Decisions locked from review
- **Injection = adaptive**: analyze harness, detect conflicts, propose placement. Not a
  fixed method.
- **Deliverable = passive context skill** (flows + tools + full architecture schema),
  **cited directly in the main instruction**, so the agent has the context in *every*
  interaction (analyze / observe / create / edit / adjust).
- **Scope now = plan only**; user reviews this doc before any implementation.

## Open questions — resolved on implementation
1. **TOOLS.md = sibling file**, generated via `Tools/scripts/generate-tools-digest.mjs` (`npm run digest`). The skill (`SKILL.md`) stays small and stable; the catalog lives next to it.
2. **`AGENT-PLAYBOOK.md` removed**; fully folded into `install/AGENT-INSTALL.md` (the seven-phase brain: Confirm → Detect → Plan → Ask → Execute → Inject → Verify → Uninstall).
3. **No `/install` convenience skill** in the dev harness. The installer is the markdown brain; the only thing the user's harness gets is the **passive context skill** in `install/context-skill/`.
4. **Uninstall/repair** is Phase 7 of `AGENT-INSTALL.md` — managed delimiters make the skill injection and managed block surgically removable.
