---
description: Create or update the long-lived dev → main PR. Monitors CI.
---

# /git-pr

Role: developer maintaining the single long-lived PR from `dev` to `main`. There is exactly one such PR at a time. It's never closed by us — it's merged when we cut a release.

## Check existing PR

```bash
gh pr list --base main --head dev --state open --json number,title,url
```

## If no PR exists

Create one:

```bash
gh pr create \
  --base main \
  --head dev \
  --title "release: dev → main" \
  --body-file <(cat <<EOF
## What's in this PR

Long-lived integration PR. Every commit on \`dev\` is candidate for the next release. Merged when we cut a release tag.

## Highlights since last merge

<bulleted list of feat/fix from \`git log main..dev --oneline\` — group by type>

## Validation

- [ ] \`npm run build\` passes in Tools/
- [ ] Plugin compiles in a fresh UE5.4 project
- [ ] Integration tests pass (\`npm test\`)
- [ ] No drift between \`.claude/rules/\` and \`.github/instructions/\`

## Notes

This PR is updated by every \`/git-pr\` run. Do not close — merge when releasing.
EOF
)
```

## If a PR exists

Update its body with the latest commit summary:

```bash
PR_NUMBER=$(gh pr list --base main --head dev --state open --json number -q '.[0].number')

# Regenerate the body with current commits
NEW_BODY=$(cat <<EOF
## What's in this PR

Long-lived integration PR. Merged when we cut a release tag.

## Highlights since last merge

$(git log main..dev --oneline --no-merges | head -30)

## Validation

- [ ] \`npm run build\` passes in Tools/
- [ ] Plugin compiles in a fresh UE5.4 project
- [ ] Integration tests pass
- [ ] No drift between \`.claude/rules/\` and \`.github/instructions/\`

## Notes

This PR is updated by every \`/git-pr\` run. Do not close — merge when releasing.
EOF
)

gh pr edit $PR_NUMBER --body "$NEW_BODY"
```

## Monitor CI

```bash
gh pr checks $PR_NUMBER
```

If checks are failing: read the logs (`gh run view <run-id> --log-failed`), summarise the failure, propose a fix. Do NOT auto-fix without telling the user.

If checks are passing: tell the user "PR #<n> green — ready to merge when you cut the next release."

## Hard rules

- **Never** merge the PR yourself. Releases are a human decision.
- **Never** close the PR. It's long-lived.
- **Never** force push to `dev` from `/git-pr`.
- **Never** open a second PR with the same base/head.

## Then tell the user

"PR #<n> updated: <count> commits ahead of main. CI: <status>. URL: <url>"
