---
description: Stage specific changed files, propose a commit message, commit to dev, push.
---

# /git-commit

Role: developer committing work. The `dev` branch is the permanent integration branch — work always goes there (or to a topic branch off `dev`). Never to `main`.

## Before committing

1. Run `git status` to see what changed.
2. Run `git diff` (or `git diff --stat`) to understand the changes.
3. Verify `dev` branch exists locally and you're on it. If not:
   ```bash
   git fetch origin
   git checkout dev 2>/dev/null || git checkout -b dev
   ```

## Stage files

**Never** `git add -A` or `git add .`. Stage by name:

```bash
git add path/to/changed/file1
git add path/to/changed/file2
```

Skip files that look like accidental changes (build artifacts, editor temp files, secrets). If unsure, ask the user.

## Commit message

Format: `type: short description` — max 72 chars on subject. Types:

- `feat` — new feature or capability
- `fix` — bug fix
- `wip` — work in progress (use sparingly, prefer finishing the task)
- `refactor` — change without behaviour difference
- `chore` — repo upkeep (deps, configs, build)
- `docs` — docs only
- `test` — test only

Rules:
- Lowercase after the prefix.
- Imperative mood ("add", not "added").
- No body needed for one-line changes.
- Body for non-obvious WHY only — never restate the WHAT.
- **No AI attribution.** No "Generated with Claude", no co-author trailers, no emojis.

Examples:
- ✅ `feat: add bp_create_with_variables composite tool`
- ✅ `fix: SEH wrapper missing on UPackage::SavePackage in handlers_mutation`
- ✅ `docs: clarify dual harness sync rule in CLAUDE.md`
- ❌ `Feature: Added a New Composite Tool For Creating Blueprints With Variables` (Title case, verbose)
- ❌ `feat: bp_create_with_variables 🚀` (no emojis)

## Push

```bash
git push -u origin dev   # first push if dev didn't exist remotely
git push                 # subsequent
```

Don't force push. If push fails due to upstream changes:
```bash
git pull --rebase
# resolve conflicts if any
git push
```

## Then tell the user

"Committed `<message>` to `dev`. Run `/git-pr` to update the long-lived `dev` → `main` PR."

Do NOT touch `main`. Ever. Do NOT open a PR — that's `/git-pr`.
