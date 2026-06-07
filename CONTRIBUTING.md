# Contributing

Open to humans and AI coding agents. There is no AI-only rule and no human-only rule — what matters is whether the change is correct, in scope, and follows the conventions in [CLAUDE.md](CLAUDE.md).

## Before you start

1. Read [CLAUDE.md](CLAUDE.md) — it's the agent and human entry point. Same conventions for both.
2. Read [.claude/docs/ARCHITECTURE.md](.claude/docs/ARCHITECTURE.md) — the system design bible. Do not propose changes that contradict it without first opening an issue.
3. Check [.claude/docs/SPRINTS.md](.claude/docs/SPRINTS.md) — work in the active sprint is preferred. Other contributions are welcome but expect longer review.
4. Check [.claude/docs/DECISIONS.md](.claude/docs/DECISIONS.md) — your design call might already have an ADR.

## Workflow

We run a `dev` integration branch and a release-only `main`.

- All work commits to `dev` (or a topic branch off `dev`).
- `main` advances only via a long-lived PR from `dev` → `main` when we cut a release.
- Never commit directly to `main`.

```bash
git checkout dev
git pull
git checkout -b feature/short-description
# work, commit, push
gh pr create --base dev --title "feat: short description"
```

## Commit format

```
type: short description
```

- Types: `feat`, `fix`, `wip`, `refactor`, `chore`, `docs`, `test`
- Max 72 chars on the subject line
- Body is optional — use it for the WHY when non-obvious
- No AI attribution trailers, no "Generated with Claude", no co-author markers added by tooling

## Code rules

C++ (Unreal):
- See [.claude/rules/cpp-ue.md](.claude/rules/cpp-ue.md)
- Use UE5.4+ Subsystem APIs, not deprecated `EditorAssetLibrary`
- Wrap mutations in `ScopedEditorTransaction` for undo support
- SEH-wrap any compile or save that can fault

TypeScript (MCP server):
- See [.claude/rules/typescript.md](.claude/rules/typescript.md)
- Every tool returns the structured output contract documented in [.claude/rules/mcp-tools.md](.claude/rules/mcp-tools.md)
- Zod schemas for every input
- Integration tests required for every new tool — `Tools/test/tools/<your-tool>.test.ts`

## Testing

```bash
cd Tools
npm install
npm run build
npm test
```

Tests boot a temporary UE5 project and spawn a headless commandlet — no committed `.uasset` fixtures.

## Disclosure for AI agents

If an AI agent made the change, say so in the PR body. It is not a disqualifier, it is just useful information for reviewers. Example:

> Drafted by Claude Code, reviewed and adjusted by @yourhandle.

That is enough.

## Conduct

Be direct, be technical, be kind. Drive-by hostility wastes reviewer time and gets PRs closed regardless of code quality.
