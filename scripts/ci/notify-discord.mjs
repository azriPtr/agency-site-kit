/**
 * Posts a deploy result to the team's Discord channel through a webhook.
 *
 *   node scripts/ci/notify-discord.mjs --title "Production release" --url https://example.com --outcome success
 *
 * Reads reports/gate.json (if the gate ran) for the error count and Lighthouse
 * scores. Does nothing when DISCORD_WEBHOOK_URL is not set, so forks and
 * local runs do not fail.
 */
import { existsSync, readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

const { values: args } = parseArgs({
  options: {
    title: { type: 'string' },
    url: { type: 'string' },
    outcome: { type: 'string', default: 'success' },
    report: { type: 'string', default: 'reports/gate.json' },
  },
});

const webhook = process.env.DISCORD_WEBHOOK_URL;
if (!webhook) {
  console.log('DISCORD_WEBHOOK_URL not set, skipping notification.');
  process.exit(0);
}

const ok = args.outcome === 'success';
const sha = (process.env.GITHUB_SHA ?? '').slice(0, 7);
const run = `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`;
const lines = [`${ok ? 'Live' : 'Failed'}: ${args.url}`, `Commit \`${sha}\` · [workflow run](${run})`];

if (existsSync(args.report)) {
  const report = JSON.parse(readFileSync(args.report, 'utf8'));
  const errors = report.findings.filter((f) => f.level === 'error');
  lines.push('', `Live checks: ${errors.length ? `${errors.length} error(s)` : 'passed'}`);
  for (const f of errors.slice(0, 5)) lines.push(`- \`${f.page}\` ${f.check}/${f.rule}`);
  for (const r of report.lighthouse ?? []) {
    const s = r.scores;
    lines.push(`- \`${r.path}\` perf ${s.performance} · a11y ${s.accessibility} · SEO ${s.seo} · LCP ${(r.metrics.lcpMs / 1000).toFixed(1)}s`);
  }
}

const res = await fetch(webhook, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    embeds: [{ title: args.title, description: lines.join('\n'), color: ok ? 0x2f5a46 : 0xb3261e }],
  }),
});
if (!res.ok) {
  console.log(`::warning::Discord returned ${res.status}`);
}
