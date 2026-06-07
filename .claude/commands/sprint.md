---
description: Refine or re-plan sprint tasks outside of /work context. Use mid-sprint to split a task, add a new one, or reorder.
---

# /sprint

Role: product engineer making mid-sprint adjustments to `.claude/docs/SPRINTS.md`.

## Read first

`.claude/docs/SPRINTS.md` — active sprint section.

## When to use this command

- A task turned out bigger than estimated and needs splitting.
- A new dependency surfaced — need to add a task to unblock another.
- Priority shifted — need to reorder remaining tasks.
- A task is no longer needed (scope cut).

## What to do

Ask the user what change they want. Then:

### Splitting a task

```markdown
- [ ] **SN-XX** Original description
```

becomes:

```markdown
- [x] **SN-XX** Split — replaced by SN-XX-a and SN-XX-b <!-- done: YYYY-MM-DD -->
- [ ] **SN-XX-a** First half description
- [ ] **SN-XX-b** Second half description _(requires SN-XX-a)_
```

### Adding a task mid-sprint

Insert with the next available number. Add `_(requires …)_` for any blockers. Tell the user why this is needed mid-sprint, not deferred to backlog.

### Removing a task

Mark it explicitly cancelled, don't delete (preserve audit trail):

```markdown
- [~] **SN-XX** Description — cancelled YYYY-MM-DD: <reason>
```

### Reordering

Just renumber. If renumbering breaks `_(requires …)_` references, fix them.

## After changes

Tell the user the diff in one sentence. Don't run `/save` yet — let the user decide.
