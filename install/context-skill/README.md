# `install/context-skill/` — the passive context pack

This folder is **what gets installed into the end user's project** by `install/AGENT-INSTALL.md`. It is a self-contained, harness-agnostic context pack that teaches the user's coding agent how to use the `unreal-agent` MCP server in **every** interaction with their UE5 project.

The installer **adapts** placement to the user's harness:

| Harness | Skill file path inside user project | Reference injected into |
| --- | --- | --- |
| Claude Code | `.claude/skills/unreal-agent/SKILL.md` + `FLOWS.md` + `TOOLS.md` | `CLAUDE.md` (managed block) |
| GitHub Copilot | `.github/instructions/unreal-agent.instructions.md` + `unreal-agent/FLOWS.md` + `unreal-agent/TOOLS.md` | `.github/copilot-instructions.md` (managed block) |
| Cursor / generic | `unreal-agent/SKILL.md` (project root or wherever) | `AGENTS.md` (managed block) |

## Files in this folder

| File | Purpose | Source of truth |
| --- | --- | --- |
| [`SKILL.md`](SKILL.md) | The Claude-style passive skill (frontmatter + when-to-use). The agent's primary entry point. | Hand-written, stable. |
| [`instructions.md`](instructions.md) | The Copilot-style `*.instructions.md` variant. Same content shape, Copilot frontmatter (`applyTo`). | Hand-written, stable. |
| [`FLOWS.md`](FLOWS.md) | Canonical UE5 flows (debug-a-bug, edit-anything, create-from-scratch, observe). Referenced from `SKILL.md`. | Hand-written, stable. |
| [`TOOLS.md`](TOOLS.md) | **Generated** catalog of every registered MCP tool with its description. | `npm run digest` from `Tools/` — regenerates from the actual `server.tool(...)` calls. |
| [`MANAGED-BLOCK.md`](MANAGED-BLOCK.md) | The exact delimited block the installer injects into the user's main instruction file. Idempotent and removable. | Hand-written, stable. |

## Precedence rule (hard, restated in every file)

The user's own project instructions **take precedence** over this skill. This pack only **adds** know-how about Unreal Engine + the `unreal-agent` tools; it never overrides the user's conventions, naming, workflow, or other rules.

## Why a passive skill (not a slash command)

The agent should **already know** about these tools when the user says "fix this bug", "add a variable to BP_Player", or "why does this material look wrong" — without having to invoke an explicit command. A passive skill loaded by the harness gives that ambient context in every interaction.
