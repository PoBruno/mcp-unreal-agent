# GitHub Copilot instructions

This repo is dual-harness: Claude Code and GitHub Copilot work from the same conventions. The source of truth is [`CLAUDE.md`](../CLAUDE.md) and [`.claude/`](../.claude/). This file is a thin bridge so Copilot lands at the same place.

## Read these first

1. [`CLAUDE.md`](../CLAUDE.md) — project entry point: tech stack, architecture principles, doc index, commands, conventions. Read it in full before any non-trivial change.
2. [`.claude/docs/ARCHITECTURE.md`](../.claude/docs/ARCHITECTURE.md) — system bible. Read before touching any domain.
3. [`.claude/docs/SPRINTS.md`](../.claude/docs/SPRINTS.md) — active sprint tasks. Confirm your work is in scope.
4. [`.claude/docs/DECISIONS.md`](../.claude/docs/DECISIONS.md) — ADRs. Your design might already exist here.

## File-scoped rules

Copilot loads per-file rules from [`.github/instructions/`](instructions/) automatically when their `applyTo` glob matches. They mirror the rules in [`.claude/rules/`](../.claude/rules/) — same content, different harness location.

| Glob | Rule file |
|---|---|
| `Source/**/*.cpp, Source/**/*.h` | [`instructions/cpp-ue.instructions.md`](instructions/cpp-ue.instructions.md) |
| `Tools/**/*.ts` | [`instructions/typescript.instructions.md`](instructions/typescript.instructions.md) |
| `Tools/src/tools/**/*.ts` | [`instructions/mcp-tools.instructions.md`](instructions/mcp-tools.instructions.md) |
| `**/*.py` | [`instructions/python-ue.instructions.md`](instructions/python-ue.instructions.md) |

## Skills

Skills are domain knowledge packs in [`.claude/skills/`](../.claude/skills/). Each has a `SKILL.md` you load when relevant:

- `tool-chains/SKILL.md` — designing composite tools and chaining existing ones
- `ue5-api-cheat/SKILL.md` — Subsystem map, deprecated→new translations
- `mcp-tool-schema/SKILL.md` — input/output shape for new tools
- `install/SKILL.md` — install playbook execution
- `cpp-context-bridge/SKILL.md` — reading C++ symbols referenced from BPs

When the user's request matches a skill's topic, read the corresponding `SKILL.md` before writing code.

## Hard rules (Copilot-relevant subset)

- **Build after every change.** TS: `cd Tools && npm run build`. C++: UnrealBuildTool from the project root. Do not declare done before the build passes.
- **Integration test per new tool.** New TS tool → new file in `Tools/test/tools/`. New C++ handler → covered by the TS tool's test.
- **Subsystem APIs only.** Never use `UEditorAssetLibrary` / `UEditorLevelLibrary`. Use `UEditorAssetSubsystem` / `UEditorActorSubsystem` / `ULevelEditorSubsystem`.
- **Wrap mutations in transactions.** C++: `FScopedTransaction`. TS: composite tools call begin/end transaction handlers automatically.
- **Structured output contract.** Every tool returns `{ ok, data, refs, nextSteps, warnings, errorCode }`. See [`.claude/rules/mcp-tools.md`](../.claude/rules/mcp-tools.md).
- **No commits to `main`.** Work goes on `dev` or a topic branch off `dev`.
- **No AI attribution in commits / PRs.** Write as a developer.

## When proposing tool calls

Copilot agent mode: prefer using the MCP tools this project itself exposes (`unreal-agent` server) when the work is about manipulating a UE5 project. Don't shell out to UE APIs when an MCP tool already exists.

When unsure whether a tool exists, list available `unreal-agent` tools first.
