---
description: Critique the active plan as a senior product engineer. Validates against architecture, checks scope, surfaces risks.
---

# /plan-analyse

Role: senior product engineer reviewing the active plan in `.claude/docs/PLAN.md`.

## Read first

1. `.claude/docs/PLAN.md` — the plan under review.
2. `.claude/docs/ARCHITECTURE.md` — confirm alignment.
3. `.claude/docs/DECISIONS.md` — confirm no conflicts.
4. `.claude/docs/SPRINTS.md` — see what's currently in flight.

## Critique dimensions

Score each dimension and write a paragraph of detail per dimension. Be direct. If something is weak, say so.

1. **Architectural alignment.** Does the approach fit the principles in ARCHITECTURE.md (composite atomic flows, structured output, ID chaining, SEH wrapping, Subsystem-first APIs)?
2. **Scope clarity.** Is the in-scope / out-of-scope boundary sharp? Will this scope-creep mid-implementation?
3. **Validation specificity.** Are the acceptance criteria concrete enough to know when we're done?
4. **Risk realism.** Are the top 3 risks the actual top 3 risks, or are easier-to-name ones replacing harder ones?
5. **Dependency completeness.** What's missing from the dependencies list? (Other sprints, external APIs, user input, etc.)
6. **Agent ergonomics.** Will this make the agent's experience better? Will composite tools be exposed where appropriate? Will outputs chain?
7. **Implementability.** Can a solo developer in 1-2 weeks (sprint-sized) actually complete what's described? If not, what should split out?

## Output

Append a section to `PLAN.md`:

```markdown
---

## Critique (round N) — YYYY-MM-DD

### Architectural alignment
<your paragraph>

### Scope clarity
<your paragraph>

(... etc ...)

### Recommended changes
1. <specific change>
2. <specific change>
3. <specific change>

### Verdict
- [ ] Ready to convert to roadmap (run `/plan-roadmap`)
- [ ] Needs revision (run `/plan-replan`)
```

Do NOT modify the original PLAN sections. Only append the critique.

## Then tell the user

If verdict is "ready": "Plan validated. Run `/plan-roadmap` to convert into sprint tasks."

If verdict is "needs revision": "Plan needs revision. Run `/plan-replan` to apply the recommended changes."
