# AGENT-INSTALL.md — the brain

You are an AI coding agent (Claude Code, GitHub Copilot agent mode, Cursor, anything that speaks MCP + has shell + file-system tools). The user asked you to install `mcp-unreal-agent` into their UE5 project. **You are the installer.** Follow this playbook end to end. Don't skip phases.

This file is the single source of truth for the install. It absorbs the older `AGENT-PLAYBOOK.md`. For a human-only manual reference, see [`INSTALL.md`](INSTALL.md). For copy-paste entry prompts, see [`PROMPT-TEMPLATES.md`](PROMPT-TEMPLATES.md). For what gets injected, see [`context-skill/`](context-skill/).

Repo: https://github.com/PoBruno/mcp-unreal-agent.

---

## Phases

1. **DETECT** — read-only sweep. Build a picture of the user's project, their harness, conflicting MCP servers, and existing instructions.
2. **PLAN** — given the picture, decide placement of the context skill, which conflicting MCPs to propose disabling, whether to build C++ now, and what to write where.
3. **ASK** — surface the picture + the plan to the user with `AskUserQuestion`-style structured questions. Get their decisions.
4. **EXECUTE** — clone, build, enable plugin, write/merge MCP config.
5. **INJECT** — install the passive context skill files into the user's harness and add the delimited managed block to their main instruction file.
6. **VERIFY** — restart prompt, health check, sample prompts, confirm the skill loaded.
7. **UNINSTALL / REPAIR** — documented reverse path. Same delimiters → clean removal.

Each phase has gates. **Stop at a gate** if information is missing or anything looked unexpected. Don't improvise.

---

## Phase 0 — Confirm scope

Say (adapt to the harness, English or pt-BR depending on the user):

> I'll install `mcp-unreal-agent` into your UE5 project. I'll do this in 6 phases:
> 1. **Detect** what you already have (project, agent, MCPs, instructions) — read-only.
> 2. **Plan** the install adaptively based on what I find.
> 3. **Ask** you to confirm any decisions that aren't obvious.
> 4. **Execute** — clone + build + enable plugin + merge MCP config.
> 5. **Inject** the passive context skill into your harness so your agent has UE5 know-how in every interaction.
> 6. **Verify** with a health check and sample prompts.
>
> Total time: 2–5 minutes plus editor compile (~30–60s on first open). Proceed?

Wait for confirmation.

---

## Phase 1 — DETECT (read-only)

Do all of this without modifying anything. Collect a JSON-shaped picture you'll use in Phase 2.

### 1.1 — UE5 project

Find the nearest `.uproject` by walking up from CWD:

```powershell
$dir = Get-Location
while ($dir) {
    $uproject = Get-ChildItem -Path $dir -Filter "*.uproject" -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($uproject) { break }
    $dir = Split-Path $dir -Parent
}
```

- None found → ask the user for the project root before continuing.
- Multiple in nested dirs → ask which one.

Read `EngineAssociation` from the `.uproject`. Validate `5.4` or later. If `5.3` or older, surface the options (upgrade / different project / cancel) and wait.

Note whether `Plugins/UnrealAgent/UnrealAgent.uplugin` already exists (re-install path).

### 1.2 — Harness type

Look for these markers (read, never write):

| Harness | Markers |
| --- | --- |
| **Claude Code** | `.claude/` directory and/or `CLAUDE.md` at project root, `.mcp.json` |
| **GitHub Copilot** | `.github/copilot-instructions.md`, `.github/instructions/*.instructions.md`, `.vscode/mcp.json`, `.vscode/settings.json` with `mcp` key |
| **Cursor** | `AGENTS.md`, `.cursor/` directory, `.cursor/rules/` |
| **Claude Desktop** | none in-repo — flag as a candidate; ask the user |

A project may have several. **Record all that are present** — the user might use more than one.

### 1.3 — Existing MCP servers

Read every MCP config file found in 1.2 and list each registered server. Flag any whose `command` or `args` look UE-related (substring match on `unreal`, `ue5`, `blueprint-mcp`, `ue-mcp`). Flag any binding port `9847`. These are **candidates to centralize** in Phase 3.

### 1.4 — Existing instructions / rules / skills

Walk these read-only and record paths only (not contents):

- `CLAUDE.md`, `.claude/rules/**`, `.claude/skills/**`, `.claude/commands/**`
- `.github/copilot-instructions.md`, `.github/instructions/**`, `.github/prompts/**`
- `AGENTS.md`, `.cursor/rules/**`

This tells you **where the passive skill should go** so it doesn't collide with the user's content and so its reference can be added to the right primary instruction file.

### 1.5 — Prereqs

```powershell
node --version       # need 18+
git --version
where.exe code        # VS Code present?
# Visual Studio: probe for a vswhere or fall back to asking
```

Record `node`, `git`, VS C++ workload (best-effort), Python (PythonScriptPlugin is bundled with UE, but record python.exe presence).

### 1.6 — Build the picture

End of Phase 1, you should have something like:

```json
{
  "project": { "root": "C:/.../MyGame", "uproject": "MyGame.uproject", "engine": "5.4", "pluginAlreadyInstalled": false },
  "harness": ["claude-code", "copilot"],
  "mcpConfigs": {
    "claude": { "path": ".mcp.json", "servers": ["my-other-mcp"] },
    "copilot": { "path": ".vscode/mcp.json", "servers": ["ue5-mcp"] }
  },
  "conflicts": [{ "server": "ue5-mcp", "in": ".vscode/mcp.json", "reason": "overlaps with unreal-agent (UE5 MCP)" }],
  "instructions": {
    "claude": ["CLAUDE.md", ".claude/rules/python.md"],
    "copilot": [".github/copilot-instructions.md", ".github/instructions/cpp.instructions.md"]
  },
  "prereqs": { "node": "20.10.0", "git": "2.43", "vs": "unknown", "python": "3.11" }
}
```

Hold this picture in working memory for Phase 2.

---

## Phase 2 — PLAN (adaptive placement)

Derive the proposal from the detected picture. Don't ask anything yet.

### 2.1 — Pick a primary harness

If multiple harnesses were detected, default order: **Claude Code → Copilot → Cursor → Claude Desktop**. If only one, that's the primary. The user will confirm in Phase 3.

### 2.2 — Decide skill placement

| Primary harness | Skill files go to | Managed block goes into |
| --- | --- | --- |
| Claude Code | `.claude/skills/unreal-agent/SKILL.md` + `FLOWS.md` + `TOOLS.md` | `CLAUDE.md` |
| Copilot | `.github/instructions/unreal-agent.instructions.md` + `.github/instructions/unreal-agent/{FLOWS,TOOLS}.md` | `.github/copilot-instructions.md` |
| Cursor / generic | `unreal-agent/{SKILL,FLOWS,TOOLS}.md` at project root | `AGENTS.md` |

If a primary instruction file doesn't exist, the plan **creates a minimal one** whose body is the managed block (so the skill is reachable). The user will confirm.

### 2.3 — Decide MCP config target

- Claude Code → `.mcp.json` at project root (`mcpServers.unreal-agent`).
- Copilot → `.vscode/mcp.json` (`servers.unreal-agent`).
- Cursor → `.mcp.json` like Claude Code.
- Claude Desktop → `%APPDATA%/Claude/claude_desktop_config.json` with **absolute paths**. **Always ask** before touching this one (global).

### 2.4 — Conflict proposal

For each conflict from 1.3, decide a default recommendation:

- **Overlapping UE/Blueprint MCP** → recommend `disable & centralize`.
- **Port 9847 bound by another server** → recommend `disable that one or change its port` (we can't move ours at runtime currently).
- **Unrelated MCP** (`tavily`, `github`, etc.) → recommend `keep both`.

### 2.5 — Build step

- `pluginAlreadyInstalled` and `Tools/dist/index.js` exists → recommend `update via git pull + npm install + npm run build`.
- Fresh → recommend `clone + build`.
- For the C++ side, default to **let the editor compile on first open**. Offer the explicit `UnrealBuildTool` path as an option only if the user wants it.

End of Phase 2: you have a proposal you can show.

---

## Phase 3 — ASK (structured)

Surface the picture + proposal in one batch with `AskUserQuestion` (or your harness's equivalent). Ask each question only if it has more than one reasonable answer. If only one harness was detected, no MCPs conflict, and no instruction file collisions exist, you can skip straight to confirming the whole plan as a single question.

Recommended questions:

1. **Confirm harness.** "I detected `<list>`. Which is your primary?" *(options: each detected + "all of them"; recommended = first in order)*
2. **Conflicting MCPs.** *(only if `conflicts.length > 0`)* "I found `<server-name>` in `<config-path>` — it overlaps with `unreal-agent`. What do you want to do?" *(options: `Disable it and centralize on unreal-agent (recommended)`, `Keep both — let me pick later`, `Replace it (remove that server's config entry)`)*
3. **Context skill placement.** "I'll install the passive UE5 context skill at `<path>` and reference it from `<primary instruction file>` via a delimited managed block. OK?" *(options: `OK`, `Place skill elsewhere — let me specify`)*
4. **Build the C++ now?** "Do you want me to build the plugin's C++ now via UnrealBuildTool, or let the editor compile it on first open?" *(options: `Editor on first open (recommended)`, `Build now via UnrealBuildTool`)*
5. **Claude Desktop?** *(only if Claude Desktop is a candidate but not the primary in-repo harness)* "I won't touch `%APPDATA%/Claude/claude_desktop_config.json` unless you say so. Want me to add the entry there too?" *(options: `No`, `Yes, with absolute paths`)*

For every "yes" option that involves a destructive action (disable a server, overwrite a file), preview the diff before applying in Phase 4.

---

## Phase 4 — EXECUTE

Each substep is idempotent. If something fails, **stop** and tell the user — don't try to "fix" the project.

### 4.1 — Clone or update the plugin

```powershell
$pluginsDir = Join-Path $project.root "Plugins"
New-Item -ItemType Directory -Force -Path $pluginsDir | Out-Null
$pluginPath = Join-Path $pluginsDir "UnrealAgent"

if (Test-Path $pluginPath) {
    Push-Location $pluginPath
    git pull --ff-only
    Pop-Location
} else {
    git clone https://github.com/PoBruno/mcp-unreal-agent.git $pluginPath
}
```

If `git pull` fails because the user has local changes in the plugin, surface and stop.

### 4.2 — Build the TS server

```powershell
Push-Location (Join-Path $pluginPath "Tools")
npm install
npm run build
Pop-Location
```

Verify `Tools/dist/index.js`. If `npm install` fails because Node is < 18, surface and stop — don't try to upgrade Node for the user.

### 4.3 — Enable plugins in `.uproject`

Edit the `.uproject` JSON. **Preserve every other field.** Ensure both `UnrealAgent` and `PythonScriptPlugin` are in `Plugins` with `Enabled = true`. If a `Plugins` array doesn't exist, create it. Don't drop `Modules`, `EngineAssociation`, etc.

### 4.4 — Enable Python remote execution

Append to `Config/DefaultEngine.ini` only if missing — never overwrite:

```ini
[/Script/PythonScriptPlugin.PythonScriptPluginSettings]
bRemoteExecution=True
```

If the `[/Script/PythonScriptPlugin...]` section exists but `bRemoteExecution=True` is missing or `False`, **stop and tell the user**; don't edit mid-section without their say-so.

### 4.5 — Disable conflicting MCP servers (if approved in Phase 3)

For each `disable & centralize` decision, **remove the conflicting server's entry** from its MCP config file. Preserve every other entry. If the user said `Keep both`, leave them alone.

### 4.6 — Merge our MCP config

Per primary harness (and any extra approved in Phase 3):

**Claude Code — `.mcp.json`**
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

**Copilot — `.vscode/mcp.json`**
```json
{
  "servers": {
    "unreal-agent": {
      "command": "node",
      "args": ["Plugins/UnrealAgent/Tools/dist/index.js"],
      "env": { "UE_PROJECT_DIR": "." }
    }
  }
}
```

**Cursor — same as Claude Code**.

**Claude Desktop** — `%APPDATA%/Claude/claude_desktop_config.json` (Windows) or `~/Library/Application Support/Claude/claude_desktop_config.json` (Mac). Use **absolute paths** in `args` and `env.UE_PROJECT_DIR`.

Always merge — never overwrite. If `unreal-agent` already exists, replace its entry only.

### 4.7 — Optional: C++ build now

Only if the user picked "Build now via UnrealBuildTool" in Phase 3:

```powershell
& "C:\Program Files\Epic Games\UE_5.4\Engine\Build\BatchFiles\Build.bat" `
  "<ProjectName>Editor" Win64 Development `
  "<absolute path to .uproject>" -waitmutex
```

Surface the exit code. If it fails, stop and tell the user — they probably need the VS C++ workload.

---

## Phase 5 — INJECT (the passive context skill)

This phase is the headline. It's why the user gets value in every subsequent interaction, not just when they explicitly ask the agent to "use unreal-agent".

### 5.1 — Copy the skill files

From the plugin's `install/context-skill/` directory **into the user's harness location** picked in Phase 2:

**Claude Code:**
- `install/context-skill/SKILL.md`       → `.claude/skills/unreal-agent/SKILL.md`
- `install/context-skill/FLOWS.md`       → `.claude/skills/unreal-agent/FLOWS.md`
- `install/context-skill/TOOLS.md`       → `.claude/skills/unreal-agent/TOOLS.md`

**Copilot:**
- `install/context-skill/instructions.md` → `.github/instructions/unreal-agent.instructions.md`
- `install/context-skill/FLOWS.md`        → `.github/instructions/unreal-agent/FLOWS.md`
- `install/context-skill/TOOLS.md`        → `.github/instructions/unreal-agent/TOOLS.md`

**Cursor / generic:**
- `install/context-skill/SKILL.md` + `FLOWS.md` + `TOOLS.md` → `unreal-agent/` at project root

Files are copied **as-is**. Don't edit them — they're the canonical source.

### 5.2 — Inject the managed block

Open the primary instruction file (`CLAUDE.md` / `.github/copilot-instructions.md` / `AGENTS.md`).

- If a managed block already exists (look for the delimiters `<!-- BEGIN unreal-agent` / `<!-- END unreal-agent -->`), **replace the region between them** with the new block.
- If no managed block exists, **append** the new block to the end of the file (with a leading blank line).

Use the exact block from [`context-skill/MANAGED-BLOCK.md`](context-skill/MANAGED-BLOCK.md) for the user's primary harness. **Do not modify content outside the delimiters.**

If the primary instruction file doesn't exist, create a minimal one whose only content is the managed block (with a one-line preface like `# Project instructions`).

### 5.3 — Verify injection

Re-read the file. Confirm both delimiters are present exactly once. If you see two `BEGIN`s, you have a bug — surface to the user.

---

## Phase 6 — VERIFY + first run

### 6.1 — Restart prompt

Say:

> Configuration complete. Now please:
> 1. Close the UE5 editor if it's open.
> 2. Re-open `<UEProject>/<Name>.uproject`.
> 3. The plugin will compile on first open (~30–60s — a "Missing modules?" prompt may appear; click **Yes**).
> 4. When the editor is loaded, tell me — I'll run a health check.
>
> Also: restart your coding agent so it picks up the new MCP config (Claude Code: close & re-open. VS Code: Reload Window).

Wait.

### 6.2 — Health check

Once the user confirms, call the `server_status` MCP tool (it pings `/api/health` and starts the server if needed). Expected:

```json
{ "ok": true, "data": { "mode": "editor", "version": "0.1.0", "pluginVersion": "1.0" } }
```

If `mode == "editor"` → install succeeded.

Diagnostics:

- `UE_NOT_RUNNING` → check editor Output Log for `LogUnrealAgent`. If absent, plugin didn't load (Edit → Plugins → UnrealAgent enabled?). If present and bind failed, another process holds `:9847` — close the old `ue5-mcp` / change ports (currently requires source edit; open an issue).
- Tool isn't available in the agent at all → the MCP config wasn't reloaded. Have them restart the agent / reload VS Code.

### 6.3 — Confirm the skill loaded

Ask the agent (in the user's chat, not via MCP):

- Claude Code: *"What does the unreal-agent skill say about when to call `compile_blueprint`?"*
- Copilot: *"What does my `unreal-agent.instructions.md` say about the `inspect` tool?"*

A correct answer means the skill is in context. A blank/"I don't know" answer means the managed block isn't in the right file or the harness didn't reload.

### 6.4 — Sample prompts

Suggest 2–3 concrete prompts:

> Try one of these to confirm full control:
> 1. *"List all my Blueprints in `/Game`."*
> 2. *"Create a Blueprint `BP_TestActor` in `/Game/Test` inheriting from `Actor`, add a `Health` float defaulting to 100, compile and save."*
> 3. *"Take a screenshot of the editor viewport and tell me what's selected."*

Install complete.

---

## Phase 7 — UNINSTALL / REPAIR

The whole install is reversible. Use this when the user asks to remove or when something corrupted partway and they want a clean slate.

### 7.1 — Remove the managed block

For each harness the install touched, open the primary instruction file and **remove the region between (and including) the `<!-- BEGIN unreal-agent` / `<!-- END unreal-agent -->` delimiters**. If the only thing left in a file the installer created is whitespace, remove that file too. **Never touch content outside the delimiters.**

### 7.2 — Remove the skill files

```powershell
# Claude Code
Remove-Item -Recurse -Force "$root/.claude/skills/unreal-agent" -ErrorAction SilentlyContinue
# Copilot
Remove-Item -Force "$root/.github/instructions/unreal-agent.instructions.md" -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force "$root/.github/instructions/unreal-agent" -ErrorAction SilentlyContinue
# Cursor / generic
Remove-Item -Recurse -Force "$root/unreal-agent" -ErrorAction SilentlyContinue
```

### 7.3 — Remove the MCP config entry

Open each MCP config the installer wrote and **remove only the `unreal-agent` key**. Preserve everything else.

### 7.4 — Remove the plugin

```powershell
Remove-Item -Recurse -Force "$root/Plugins/UnrealAgent"
```

### 7.5 — Revert `.uproject`

Remove `UnrealAgent` from the `Plugins` array. Leave `PythonScriptPlugin` — the user may want it independently.

### 7.6 — Leave `Config/DefaultEngine.ini` alone

The Python setting is harmless without the plugin. Don't touch it.

### 7.7 — Report

Tell the user exactly what was removed and what wasn't, and remind them to restart their agent so the MCP config reload sticks.

### Repair (partial install)

If a previous install failed mid-flow: run Phase 7 first to clear stale state, then Phase 1 → 6 fresh.

---

## Hard rules across all phases

- **Never** delete or rewrite a file the installer didn't create unless removing exactly the delimited managed block.
- **Never** use `git add -A` or any wildcard write outside of paths under `Plugins/UnrealAgent`, the user's MCP config files, the user's primary instruction file, and the skill output paths.
- **Never** modify the user's `.uproject` `Modules` array or `EngineAssociation`.
- **Never** silently change a setting that already exists with a different value — surface to the user.
- **If you don't know, ask.** Use `AskUserQuestion` — never guess at a project root, an engine version, an agent type, or a path to a global config file.
- **Stop on first hard failure.** Surface exact output. Don't auto-retry a non-transient error.
