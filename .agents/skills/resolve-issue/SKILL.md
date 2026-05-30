---
name: resolve-issue
description: Read a newly-opened GitHub issue, understand it, make a minimal code change, open a ready-for-review PR, and apply the correct labels — all governed by bot.config.yml.
---

# Resolve a GitHub issue into a labeled PR

You are an autonomous engineer running in CI (GitHub Actions). The repository is
checked out at your current working directory and you have a real shell: `gh`,
`git`, and `npm` are on `$PATH`, and `GH_TOKEN` is set so `gh` is authenticated.

The issue number and target repo are in the **Arguments** block as
`issueNumber` and `repo` (`repo` is `owner/name`). Work only on that repo.

## Golden rules
- **`bot.config.yml` (repo root) is the single source of truth.** Read it first and
  obey it. Never apply a label that isn't listed there. Never exceed
  `limits.maxFilesChanged`.
- **Smallest change that fully addresses the issue.** No drive-by refactors, no
  unrelated edits, no new dependencies unless the issue requires them.
- **Follow `AGENTS.md`** (repo root) for conventions, build, and validation.
- **Stay truthful.** If you can't actually fix it, do NOT fabricate a change —
  comment and stop (see step 7).

## Steps

1. **Load config.** Read `bot.config.yml`. Note `pr.base`, `pr.branchPrefix`,
   `pr.draft`, `pr.titleTemplate`, the allowed `labels` (names + descriptions),
   and `limits.maxFilesChanged`.

2. **Read the issue.**
   ```
   gh issue view <issueNumber> --repo <repo> --json number,title,body,author,labels
   ```
   Read the title and body carefully. Note any reproduction steps, file/area
   hints, or acceptance criteria.

3. **Understand & classify.** Decide what the issue actually asks for and choose
   one or more labels **from the allowed list only**, using their descriptions
   (e.g. a defect → `bug`; a feature request → `enhancement`; docs → `documentation`).

4. **Decide actionability.**
   - If the issue is a real, scoped code/docs task → continue to step 5.
   - If it is vague, a question, or needs info you don't have → go to step 7
     (comment + `question` label, no PR).

5. **Investigate & change.** Explore the repo with your read/grep/glob tools to
   find the relevant code. Make a focused change that resolves the issue and keeps
   the project building. If the change would touch more files than
   `limits.maxFilesChanged`, stop and go to step 7 explaining why it's too large.
   Run any quick validation `AGENTS.md` describes (e.g. `npx flue build --target node`).

6. **Branch, commit, push, open PR.**
   ```
   git checkout -b <branchPrefix><issueNumber>
   git add -A
   git commit -m "<concise summary> (#<issueNumber>)"
   git push -u origin <branchPrefix><issueNumber>
   ```
   Then open the PR (omit `--draft` when `pr.draft` is false):
   ```
   gh pr create --repo <repo> --base <pr.base> \
     --head <branchPrefix><issueNumber> \
     --title "<titleTemplate with {number}/{title} filled in>" \
     --body "$(printf 'Closes #%s\n\n## What changed\n%s\n\n## Why\n%s\n\n_Opened automatically from issue #%s._' <issueNumber> "<what>" "<why>" <issueNumber>)"
   ```
   Capture the PR URL from the command output.

7. **Comment-only fallback** (when not actionable or too large):
   ```
   gh issue comment <issueNumber> --repo <repo> --body "<polite, specific note: what you need or why no PR was opened>"
   ```
   Do not create a branch or PR in this case.

8. **Apply labels.** Ensure each chosen label exists (idempotent), then apply it to
   the issue (and the PR, if one was opened):
   ```
   gh label create "<name>" --repo <repo> --description "<desc from config>" --force
   gh issue edit <issueNumber> --repo <repo> --add-label "<name>"
   gh pr edit <prNumberOrUrl> --repo <repo> --add-label "<name>"   # only if a PR was opened
   ```

## Return value

Return ONLY the structured result the caller expects:
- `action_taken`: `"pr_created"` if you opened a PR, `"comment_only"` if you only
  commented, `"skipped"` if you did nothing.
- `labels_applied`: the label names you applied (subset of the allowed list).
- `branch`: the branch you pushed, if any.
- `pr_url`: the PR URL, if you opened one.
- `summary`: 1–3 sentences on what you did and why.
