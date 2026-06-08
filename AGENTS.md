# AGENTS.md

Universal entry point for AI coding agents (Cursor, Aider, Continue, Cline, Windsurf, anything that reads `AGENTS.md`).

**The full instruction set lives in [CLAUDE.md](CLAUDE.md). Read it.**

This file exists so that agents which look for `AGENTS.md` by convention land at the same harness used by Claude Code and GitHub Copilot.

## What this project is

`mcp-unreal-agent` — an MCP server giving AI agents complete control of Unreal Engine 5: Blueprints, materials, sequencer, MRQ, World Partition, source control, cook/package.

Two parts:
- **`UnrealAgent` C++ plugin** at [Source/UnrealAgent/](Source/UnrealAgent/) — runs an HTTP server inside the UE5 editor on port `9847`.
- **`unreal-agent` MCP server** at [Tools/](Tools/) — TypeScript bridge from MCP protocol to plugin HTTP.

## What you need to know to start work

1. Read [CLAUDE.md](CLAUDE.md) — full conventions, tech stack, doc index.
2. Read [.claude/docs/ARCHITECTURE.md](.claude/docs/ARCHITECTURE.md) — system bible.
3. Check [.claude/docs/SPRINTS.md](.claude/docs/SPRINTS.md) — current task list.
4. Domain rules in [.claude/rules/](.claude/rules/) load per-file by glob.
5. Skills (loadable domain knowledge) in [.claude/skills/](.claude/skills/).

## Hard rules

- Never commit directly to `main`. Work goes on `dev` or a topic branch off `dev`.
- After C++ changes: run UnrealBuildTool, fix errors, then report done.
- After TS changes: `cd Tools && npm run build`, then run tests.
- Every new MCP tool needs an integration test in `Tools/test/tools/`.
- Tool outputs must follow the structured contract in [.claude/rules/mcp-tools.md](.claude/rules/mcp-tools.md).

## Install for end users

If a user asks you to install this MCP into their UE5 project, follow [install/AGENT-INSTALL.md](install/AGENT-INSTALL.md) end to end. It is the adaptive installer brain: detect → plan → ask → execute → inject the passive context skill → verify → (optional) uninstall.
