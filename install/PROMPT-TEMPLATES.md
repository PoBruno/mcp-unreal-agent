# PROMPT-TEMPLATES.md

Copy-paste prompts for installing `mcp-unreal-agent`. Pick the one for your coding agent. Paste it into the agent's chat from **inside your UE5 project directory** (the folder with the `.uproject`).

Every prompt points the agent at [`install/AGENT-INSTALL.md`](AGENT-INSTALL.md), which is the single installer brain. The installer is **adaptive** — it detects your harness, scans for conflicting MCP servers, and asks before doing anything irreversible.

---

## Claude Code

```
Install https://github.com/PoBruno/mcp-unreal-agent in this UE5 project.
Follow install/AGENT-INSTALL.md from that repo end-to-end. Detect my harness,
flag conflicting MCP servers, and ask me before any destructive step. After
install, inject the passive context skill into .claude/skills/unreal-agent/
and add the managed block to my CLAUDE.md.
```

---

## GitHub Copilot (VS Code, Agent Mode)

```
Install https://github.com/PoBruno/mcp-unreal-agent into this UE5 project.
Read install/AGENT-INSTALL.md from that repo and run every phase.
Write the MCP config to .vscode/mcp.json, install the passive context skill
at .github/instructions/unreal-agent.instructions.md (+ .github/instructions/unreal-agent/),
and add the managed block to .github/copilot-instructions.md. Use
AskUserQuestion before anything destructive.
```

---

## Cursor

```
Install https://github.com/PoBruno/mcp-unreal-agent in this UE5 project.
Follow install/AGENT-INSTALL.md from that repo. Cursor uses .mcp.json (same
as Claude Code). Drop the passive context skill at unreal-agent/ at project
root and add the managed block to AGENTS.md.
```

---

## Claude Desktop

```
Install the unreal-agent MCP in my UE5 project, following
https://github.com/PoBruno/mcp-unreal-agent/blob/main/install/AGENT-INSTALL.md.
I'm on Claude Desktop — write the MCP config to
%APPDATA%\Claude\claude_desktop_config.json with ABSOLUTE paths, and confirm
with me before editing that file (it's a global config).
```

---

## Generic (any MCP-capable agent)

```
Install the MCP server at https://github.com/PoBruno/mcp-unreal-agent into my
UE5 project. Read its install/AGENT-INSTALL.md and run every phase. Detect
which harness I'm using (Claude Code, Copilot, Cursor, Claude Desktop),
which MCP servers I already have, and ask me before any destructive change.
End by injecting the passive context skill into my harness so my agent has
UE5 know-how in every future interaction.
```

---

## What the installer does (one-paragraph summary)

It **detects** your project + harness + existing MCPs + existing instructions, **plans** an adaptive placement, **asks** you to confirm anything non-obvious, **executes** the clone+build+config merge, **injects** the passive context skill (so your agent reaches for these tools in every interaction without being told), then **verifies** with a health check and sample prompts. Reversible end-to-end via the `Phase 7 — UNINSTALL / REPAIR` section of `AGENT-INSTALL.md`.

## What happens after install

Your agent now has, in every interaction touching this UE5 project:

- a passive context skill that triggers on UE5 work (analyze bugs, observe state, create/edit/adjust assets);
- a generated catalog of all ~187 MCP tools at `…/unreal-agent/TOOLS.md`;
- canonical flows at `…/unreal-agent/FLOWS.md`.

Try:
- *"List all my Blueprints in `/Game`."*
- *"Create a Blueprint `BP_TestActor` in `/Game/Test` inheriting from `Actor`, add a `Health` float defaulting to 100, compile and save."*
- *"Take a screenshot of the editor viewport and tell me what's selected."*

See the [README](../README.md) and full tool source at [Tools/src/tools/](../Tools/src/tools/).
