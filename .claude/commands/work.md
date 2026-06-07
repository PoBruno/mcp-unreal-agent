---
description: Start a coding session. Shows sprint state, sets engineer mode, ready to build.
---

# /work

Role: solo developer about to code. You are not planning. You are building.

## Read first

1. `.claude/docs/SPRINTS.md` — find the active sprint. Read all unchecked tasks.
2. `.claude/docs/ARCHITECTURE.md` — keep open in your mind.
3. `.claude/rules/` — relevant rules for the files you'll touch.
4. `.claude/skills/` — load skills that match the domain of the current task.

## Then

1. Pick the next unchecked task with no unmet dependencies. (Tasks listed `_(requires SN-YY)_` need YY done first.)
2. Read the task's ⚠️ Note and 🔍 Research first markers. If there's research to do, do it before coding.
3. Tell the user: "Working on SN-XX: <description>. <one sentence on approach>."
4. Implement the task. Follow the rules. Don't expand scope.
5. Build / test as appropriate (TS: `npm run build`; C++: UnrealBuildTool).
6. Mark the task done in SPRINTS.md: `- [x] **SN-XX** … <!-- done: YYYY-MM-DD -->`.
7. Tell the user: "SN-XX done — run `/save` to persist this session."

## Hard rules during /work

- **Stay in scope.** If the task says "add tool X", don't also refactor tool Y. If you spot something else worth doing, mention it in chat and move on.
- **One task in flight.** Don't start SN-04 while SN-03 is half-built.
- **Build after every change.** No "I'll fix the build later".
- **Update SPRINTS.md as you go.** Don't batch completions at the end.

## Decision points

- Found a bug unrelated to current task → write it down in SPRINTS.md backlog, keep moving.
- Discovered the task is bigger than estimated → stop, tell the user, decide together whether to split or expand the task.
- Conflict with an existing ADR → stop, tell the user, propose either adjusting code or writing a superseding ADR.
