# mcp-unreal-agent

> Give AI coding agents complete control of Unreal Engine 5 — Blueprints, materials, sequencer, MRQ, World Partition, cook/package — via MCP.

Built as a dual-harness project: ships first-class instructions for both **Claude Code** and **GitHub Copilot**, so you can drive UE5 from either coding assistant with the same tools.

---

## What this is

A two-part system:

1. **`UnrealAgent` plugin** (C++) — an editor plugin that runs an HTTP server inside UE5 and exposes the editor's full API surface (asset pipeline, BP graphs, material editor, sequencer, MRQ, World Partition, level streaming, undo/redo, content browser, source control, cook/package).
2. **`unreal-agent` MCP server** (TypeScript) — translates MCP tool calls from your AI agent into HTTP calls to the plugin.

Two serving modes:
- **Editor subsystem** (preferred): auto-starts on port `9847` when the UE5 editor is open. Zero overhead.
- **Headless commandlet**: spawns `UnrealEditor-Cmd.exe` (~2-4 GB RAM, ~60s startup). Use for CI, scripted asset operations, or when the editor isn't open.

---

## One-prompt install

Open a UE5 project in your IDE, then paste this into your agent:

### Claude Code

```
Install https://github.com/PoBruno/mcp-unreal-agent in this UE5 project.
Follow install/AGENT-INSTALL.md from that repo end to end. Detect my harness,
flag conflicting MCP servers, and ask me before any destructive step.
```

### GitHub Copilot

```
Install https://github.com/PoBruno/mcp-unreal-agent into this UE5 project.
Read install/AGENT-INSTALL.md from that repo and run every phase. Write the
MCP config to .vscode/mcp.json and inject the passive context skill into
.github/instructions/. Use AskUserQuestion before anything destructive.
```

The installer is **adaptive**: it detects your `.uproject`, your harness, and any conflicting MCP servers (e.g. an old `ue5-mcp` already installed); plans the placement; asks you to confirm anything non-obvious; executes the clone + build + config merge; injects a **passive context skill** into your harness so your agent has UE5 know-how in every future interaction; then verifies with a health check.

Both prompts work because the installer is the same — it lives at [install/AGENT-INSTALL.md](install/AGENT-INSTALL.md). See [install/PROMPT-TEMPLATES.md](install/PROMPT-TEMPLATES.md) for Cursor / Claude Desktop variants.

---

## Requirements

| Requirement | Version |
|---|---|
| Unreal Engine | 5.4+ (built and verified against 5.7) |
| Node.js | 18+ (CI runs 20) |
| Visual Studio | 2022 with C++ Game Dev workload (for plugin compile) |
| OS | Windows 10/11 (other platforms not yet tested) |

---

## Build from source

### TypeScript MCP server

```powershell
cd Tools
npm install
npm run build      # tsc -> Tools/dist/index.js
npm run test:unit  # UE5-free mapper tests (no engine needed)
```

Full integration suite (`npm test`) boots a UE5 commandlet and needs an engine install on a self-hosted runner — see [.claude/docs/SPRINTS.md](.claude/docs/SPRINTS.md) backlog.

### C++ plugin

Compile the plugin standalone against your engine with UAT `BuildPlugin`:

```powershell
& "C:\Program Files\Epic Games\UE_5.7\Engine\Build\BatchFiles\RunUAT.bat" `
  BuildPlugin -Plugin="<path>\UnrealAgent.uplugin" `
  -Package="<out-dir>" -TargetPlatforms=Win64
```

Or, with the plugin in a host project's `Plugins/UnrealAgent/`, build the editor target:

```powershell
& "C:\Program Files\Epic Games\UE_5.7\Engine\Build\BatchFiles\Build.bat" `
  <Project>Editor Win64 Development "<path>\<Project>.uproject" -waitmutex
```

Produces `UnrealEditor-UnrealAgent.dll`. Open the project (or restart the editor) to load it — the editor subsystem starts the HTTP server on port 9847.

---

## How it differs from upstream `ue5-mcp`

`ue5-mcp` (https://github.com/mirno-ehf/ue5-mcp) is a tight, focused Blueprint inspector. We forked and expanded.

| | upstream `ue5-mcp` | `mcp-unreal-agent` |
|---|---|---|
| Scope | Blueprints only | Full editor: BP + materials + sequencer + MRQ + WP + cook/package + C++ context bridge |
| Tool count | ~38 | Expanding to ~120 across 12 domains |
| Output format | text + JSON | Structured `{ ok, data, refs, nextSteps, warnings, errorCode }` with ID chaining |
| Contribution policy | AI-only PRs | Open to humans and AI agents |
| Harness | Claude Code | Claude Code **and** GitHub Copilot — same docs power both |
| Install | manual setup | one-prompt adaptive installer (`install/AGENT-INSTALL.md`) + passive context skill injected into your harness |

If you only need Blueprint inspection, use upstream — it stays small on purpose. If you want a complete UE5 agent runtime, you're in the right place.

---

## Documentation

- **[CLAUDE.md](CLAUDE.md)** — agent entry point: tech stack, conventions, doc index, commands. Also read by GitHub Copilot via `.github/copilot-instructions.md`.
- **[AGENTS.md](AGENTS.md)** — universal bridge for Cursor and other agents.
- **[.claude/docs/ARCHITECTURE.md](.claude/docs/ARCHITECTURE.md)** — system design, the source of truth for every architectural decision.
- **[.claude/docs/ROADMAP.md](.claude/docs/ROADMAP.md)** — phases and milestones.
- **[.claude/docs/SPRINTS.md](.claude/docs/SPRINTS.md)** — current sprint tasks.
- **[install/AGENT-INSTALL.md](install/AGENT-INSTALL.md)** — agent-executable adaptive installer (detect → plan → ask → execute → inject → verify → uninstall).
- **[install/context-skill/](install/context-skill/)** — the passive context skill that gets injected into the user's harness.

---

## Built with

This project was bootstrapped and is being developed with Claude Code and GitHub Copilot. Both agents read the same instruction harness in [CLAUDE.md](CLAUDE.md) and [.claude/](.claude/), with Copilot bridged via [.github/copilot-instructions.md](.github/copilot-instructions.md). The dual-harness pattern itself is a deliverable of this repo — see [.claude/docs/DECISIONS.md](.claude/docs/DECISIONS.md) for why.

---

## Credits

- Upstream foundation: [mirno-ehf/ue5-mcp](https://github.com/mirno-ehf/ue5-mcp) (MIT)
- See [NOTICE](NOTICE) for full attribution

## License

MIT — see [LICENSE](LICENSE).
