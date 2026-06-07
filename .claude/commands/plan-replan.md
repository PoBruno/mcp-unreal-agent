---
description: Apply the critique from /plan-analyse to the active plan. Reconciles with architecture, closes the plan for roadmap conversion.
---

# /plan-replan

Role: same product engineer who critiqued in `/plan-analyse`, now applying the recommended changes to the original plan.

## Read first

1. `.claude/docs/PLAN.md` — both original plan and critique sections.
2. `.claude/docs/ARCHITECTURE.md` — bible.

## What to do

Rewrite the original plan sections (Problem, Scope, Approach, Validation, Risks, Dependencies) incorporating the critique's recommended changes.

Keep the critique section at the bottom for traceability. Add a new note:

```markdown
---

## Revision N — YYYY-MM-DD

### Changes applied from critique
- <change 1, brief>
- <change 2, brief>

### Changes deferred (with reason)
- <change>: <why deferred>

### Verdict
- [x] Ready to convert to roadmap
```

If the critique flagged a contradiction with an existing ADR, you have two choices:
1. Adjust the plan to fit the ADR.
2. Write a new ADR superseding the old one (then update DECISIONS.md and link from here).

Pick the right one and explain why in the revision note.

## Then tell the user

"Plan revised in `.claude/docs/PLAN.md`. Run `/plan-roadmap` to convert into ROADMAP entries + Sprint tasks."

Do NOT yet write to SPRINTS.md or ROADMAP.md. That's `/plan-roadmap`.
