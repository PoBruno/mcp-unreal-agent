---
description: Start a new product or feature plan. Reads ARCHITECTURE.md, zeros .claude/docs/PLAN.md, drafts a fresh plan.
---

# /plan-new

You are a product engineer planning a new feature or phase for `mcp-unreal-agent`.

## Read first

1. Read `.claude/docs/ARCHITECTURE.md` end-to-end. This is the bible.
2. Read `.claude/docs/DECISIONS.md` to confirm your plan won't conflict with existing ADRs.
3. Read `.claude/docs/ROADMAP.md` to see where this fits in the phase plan.
4. Read `.claude/docs/PLAN.md` — if there's an active plan, ask the user whether to discard it before continuing.

## Then ask the user

- What's the feature / phase name?
- Who is this for (the agent's experience, the user's experience, the contributor's experience)?
- What's the success criterion in one sentence?
- Anything explicitly out of scope?

## Then write PLAN.md

Overwrite `.claude/docs/PLAN.md` with the template:

```markdown
# PLAN — <name>

## Problem
<what's wrong / what we want>

## Scope
- <in-scope item 1>
- <in-scope item 2>

### Out of scope
- <explicit non-goal>

## Approach
<3-5 sentences describing the technical direction grounded in ARCHITECTURE.md>

## Validation
<how we'll know it worked — concrete acceptance criteria>

## Risks
1. <risk> — <mitigation>
2. <risk> — <mitigation>
3. <risk> — <mitigation>

## Dependencies
<other plans / sprints / external things this requires>
```

## Then tell the user

"Plan drafted in `.claude/docs/PLAN.md`. Run `/plan-analyse` next for a product-engineer critique."

Do NOT yet create sprint tasks or ROADMAP entries. That happens in `/plan-roadmap`.
