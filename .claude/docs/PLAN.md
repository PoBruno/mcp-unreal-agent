# PLAN.md

Single active plan. Created and zeroed by `/plan-new`. Validated by `/plan-analyse`. Closed and converted to roadmap entries + sprint tasks by `/plan-roadmap`.

---

**Status:** No active plan.

When a new plan starts, this file is overwritten with:

```markdown
# PLAN — <name>

## Problem
<what's wrong / what we want>

## Scope
<bullet list of in-scope items, with explicit out-of-scope items below>

## Approach
<3-5 sentences describing the technical direction>

## Validation
<how we'll know it worked>

## Risks
<top 3 risks + mitigations>

## Dependencies
<other plans / sprints / external things this requires>
```

When `/plan-roadmap` runs, the plan's items get split into:
- ROADMAP.md entries (if multi-sprint)
- SPRINTS.md tasks (if fits in one sprint)

After `/plan-roadmap`, this file is zeroed back to this template.
