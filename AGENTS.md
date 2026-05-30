# AGENTS.md

Context for any agent working in this repository. The automations (issue → PR and
PR review) read this file at runtime — keep it accurate and add project-specific
guidance here as the project grows.

## What this project is

A [Flue](https://flueframework.com) agent project (TypeScript, ESM, `"type": "module"`).
Flue runs agents headlessly; **most logic lives in Markdown** (skills + this file),
with thin TypeScript glue.

## Layout (root layout)

- `workflows/` — bounded jobs run once via `flue run <name>`. Each workflow
  defines its own agent inline (via `createAgent`). Standalone agent modules,
  if ever needed, live under `agents/`.
  `workflows/issue-to-pr.ts` (issue → PR) and `workflows/review-pr.ts` (PR review)
  are the automation orchestrators.
- `.agents/skills/<name>/SKILL.md` — the actual step-by-step logic, discovered at
  runtime from the working directory. `resolve-issue` powers the issue → PR flow;
  `review-pr` powers automated pull-request reviews.
- `bot.config.yml` — **single source of truth** for automation rules (model, repo,
  allowed labels, PR settings, guardrails). Tune behavior here, not in code.
- `.github/workflows/` — CI triggers.

## Conventions

- TypeScript ESM only. Match the style of existing files; keep modules small.
- Workflows stay thin — push real behavior into skills and `bot.config.yml`.
- Don't add dependencies unless necessary. Never commit secrets; `.env` is gitignored.
- Model specifiers are exact Flue strings (e.g. `openai/gpt-5.5`).

## Build & validate

- Install: `npm ci`
- Build (also the fastest correctness check): `npx flue build --target node`
- Run a workflow locally: `npx flue run <workflow> --target node --env .env --payload '<json>'`

Note: the Flue CLI does not auto-load `.env` for `connect`/`run`/`dev` in this
version — pass `--env .env` (or export the vars first).

## Making a change for an issue (for the resolve-issue skill)

- Keep changes minimal and focused on the issue; respect `limits.maxFilesChanged`
  in `bot.config.yml`.
- Ensure `npx flue build --target node` still succeeds before opening a PR.
- Reference the issue in the commit and PR (`Closes #<n>`).

## Extending the automation

Add a capability by adding a new `.agents/skills/<name>/SKILL.md` (+ a `workflows/`
module and a `.github/workflows/` trigger if it responds to a new event). The core
workflow does not need to change.
