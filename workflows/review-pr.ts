import { createAgent, type FlueContext } from '@flue/runtime';
import { local } from '@flue/runtime/node';
import * as v from 'valibot';
import { readFileSync } from 'node:fs';
import { load } from 'js-yaml';

/**
 * PR review automation — the second capability, added without touching the
 * first. Triggered from CI (`flue run review-pr --payload '{"prNumber": N}'`)
 * whenever a pull request is opened/updated. Same shape as issue-to-pr:
 * thin glue here, rules in `bot.config.yml` (`review:`), logic in the
 * `review-pr` skill.
 */

interface BotConfig {
  model?: string;
  review?: { model?: string };
}

export async function run({ init, payload }: FlueContext<{ prNumber: number }>) {
  const cfg = load(readFileSync('bot.config.yml', 'utf8')) as BotConfig;

  const agent = createAgent(() => ({
    sandbox: local({
      env: { GH_TOKEN: process.env.GH_TOKEN },
    }),
    // Reviews can use a dedicated model; otherwise reuse the project default.
    model: cfg.review?.model || cfg.model || 'openai/gpt-5.5',
  }));

  const harness = await init(agent);
  const session = await harness.session();

  // Repo is implicit — `gh` operates on the current checkout (GH_REPO is set
  // in the GitHub Action). We only pass what identifies the work.
  const { data } = await session.skill('review-pr', {
    args: {
      prNumber: payload.prNumber,
    },
    result: v.object({
      verdict: v.picklist(['approve', 'comment', 'request_changes']),
      labels_applied: v.array(v.string()),
      findings_count: v.number(),
      summary: v.string(),
    }),
  });

  return data;
}
