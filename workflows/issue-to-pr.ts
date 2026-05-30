import { createAgent, type FlueContext } from '@flue/runtime';
import { local } from '@flue/runtime/node';
import * as v from 'valibot';
import { readFileSync } from 'node:fs';
import { load } from 'js-yaml';

/**
 * Issue → PR automation.
 *
 * Triggered from CI (`flue run issue-to-pr --payload '{"issueNumber": N}'`)
 * whenever a GitHub issue is opened. This module stays intentionally thin:
 * all the real behavior lives in `bot.config.yml` (rules) and the
 * `resolve-issue` skill (the step-by-step logic). To add a capability,
 * add a skill + (optionally) another workflow/trigger — not more code here.
 */

interface BotConfig {
  model?: string;
  repo?: string;
}

export async function run({ init, payload }: FlueContext<{ issueNumber: number }>) {
  // Read config first — the model must be known before we build the agent.
  const cfg = load(readFileSync('bot.config.yml', 'utf8')) as BotConfig;

  // `local()` gives the agent direct filesystem + shell access. In CI the
  // runner is the isolation boundary and `gh`, `git`, `npm` are on $PATH.
  // We expose GH_TOKEN so the agent's bash tool can talk to GitHub.
  // Skills and AGENTS.md are discovered from process.cwd() (the repo root).
  const agent = createAgent(() => ({
    sandbox: local({
      env: { GH_TOKEN: process.env.GH_TOKEN },
    }),
    model: cfg.model ?? 'openai/gpt-5.5',
  }));

  const harness = await init(agent);
  const session = await harness.session();

  // The skill reads bot.config.yml itself for labels / PR rules / limits,
  // so it stays the single source of truth. We only pass what identifies
  // the work to do.
  const { data } = await session.skill('resolve-issue', {
    args: {
      issueNumber: payload.issueNumber,
      repo: cfg.repo || process.env.GITHUB_REPOSITORY,
    },
    result: v.object({
      action_taken: v.picklist(['pr_created', 'comment_only', 'skipped']),
      labels_applied: v.array(v.string()),
      branch: v.optional(v.string()),
      pr_url: v.optional(v.string()),
      summary: v.string(),
    }),
  });

  return data;
}
