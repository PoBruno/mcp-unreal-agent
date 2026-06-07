---
description: Senior engineer review of the current state. Run before starting a new phase or before a release.
---

# /validate

Role: senior UE5 + TypeScript engineer doing a code review of the current state.

## Read first

1. `.claude/docs/ARCHITECTURE.md` — what we said we'd build.
2. `.claude/docs/SPRINTS.md` — what we said we'd do this sprint.
3. `.claude/docs/DECISIONS.md` — what constraints we committed to.
4. Walk the actual `Source/` and `Tools/` trees — look at what's there now.

## Review dimensions

For each, write a paragraph with concrete evidence. Cite file paths and line numbers.

### 1. Contract conformance
- Do all tools in `Tools/src/tools/` return `ToolResult<T>`?
- Do they all use Zod schemas with `.describe()` on every field?
- Do new error codes appear in BOTH `.claude/rules/mcp-tools.md` AND `.github/instructions/mcp-tools.instructions.md`?

### 2. C++ hygiene
- Any use of `EditorAssetLibrary` / `EditorLevelLibrary` / `EditorFilterLibrary`? Should be Subsystem instead.
- Any compile / save calls not SEH-wrapped?
- Any mutation outside an `FScopedTransaction`?
- Any `UE_LOG(LogTemp, …)` slipping in? Should be `LogUnrealAgent`.

### 3. Test coverage
- Every tool in `Tools/src/tools/` has a corresponding test file in `Tools/test/tools/`?
- Tests cover error branches, not just happy path?
- Idempotency tested where applicable?

### 4. Documentation freshness
- Any new pattern that should be a skill but isn't?
- Any architectural decision made in code that lacks an ADR?
- `SPRINTS.md` task completion status reflects reality?

### 5. Harness drift
- `.claude/rules/*.md` content matches `.github/instructions/*.instructions.md` (semantically)?
- New skills referenced from `CLAUDE.md` and `.github/copilot-instructions.md`?

### 6. Build / CI health
- Does `npm run build` pass clean?
- Does UnrealBuildTool pass clean on a fresh project?
- Any TODO / FIXME comments in shipped code without tickets?

## Output

A markdown report under headers above. End with:

```markdown
## Verdict
- [ ] Ready to ship / advance to next phase
- [ ] Blocking issues:
  - <issue>
  - <issue>
- [ ] Non-blocking but recommended:
  - <item>
```

Save the report inline in the chat — do NOT commit it as a file (it's a snapshot of one moment).

If verdict is "ready": tell the user "validated, you can proceed with [next phase / release]".
If "blocking": tell the user "blocking issues found, address before [advancing]".
