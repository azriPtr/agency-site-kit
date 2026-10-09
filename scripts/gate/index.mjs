#!/usr/bin/env node
/**
 * pnpm gate: the quality gate every change passes before a human reviews it.
 *
 *   pnpm gate                                   # against http://localhost:4321 (pnpm preview --background)
 *   pnpm gate --url https://staging.example.com --expect noindex
 *   pnpm gate --url https://example.com --expect indexable --only seo
 *
 * Options
 *   --url <base>          Site to test. Default http://localhost:4321
 *   --pages /,/rooms      Test these paths instead of the sitemap
 *   --only seo,a11y,lh    Run a subset (seo, a11y, lh)
 *   --lh-runs <n>         Lighthouse runs per page, median kept. Default from gate.config.mjs
 *   --expect <mode>       indexable (production) or noindex (staging): checks the live headers
 *   --allow-placeholders  Skip the banned-text rule (the kit's own example client)
 *   --no-shots            Skip screenshots
 *
 * Writes reports/gate.json and reports/gate.md, and exits 1 if any check has an error.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import config from '../../gate.config.mjs';
import { checkInBrowser } from './browser.mjs';
import { discoverPages } from './http.mjs';
import { checkLighthouse } from './lighthouse.mjs';
import { toMarkdown } from './report.mjs';
import { checkSeo } from './seo.mjs';

const { values: args } = parseArgs({
  options: {
    url: { type: 'string', default: 'http://localhost:4321' },
    pages: { type: 'string' },
    only: { type: 'string', default: 'seo,a11y,lh' },
    'lh-runs': { type: 'string' },
    expect: { type: 'string' },
    'allow-placeholders': { type: 'boolean', default: false },
    'no-shots': { type: 'boolean', default: false },
    out: { type: 'string', default: 'reports' },
  },
});

const base = args.url.replace(/\/$/, '');
const only = new Set(args.only.split(','));
const started = Date.now();
const log = (msg) => console.log(`[gate] ${msg}`);

if (args.expect && !['indexable', 'noindex'].includes(args.expect)) {
  console.error('--expect must be "indexable" or "noindex"');
  process.exit(2);
}

try {
  await fetch(base);
} catch {
  console.error(`[gate] Cannot reach ${base}. Run \`pnpm build && pnpm preview --background\` first, or pass --url.`);
  process.exit(2);
}

const discovered = await discoverPages(base);
const pages = args.pages ? args.pages.split(',') : discovered.pages;
log(`${base}: ${pages.length} page(s) ${args.pages ? 'from --pages' : `from ${discovered.sitemap ?? 'fallback'}`}`);

const report = { base, pages, startedAt: new Date(started).toISOString(), findings: [], seo: null, lighthouse: null, screenshots: [] };

if (only.has('seo')) {
  log('SEO and AI readability');
  const seo = await checkSeo({
    base,
    pages,
    sitemap: discovered.sitemap,
    config,
    allowPlaceholders: args['allow-placeholders'],
    expect: args.expect,
  });
  report.findings.push(...seo.findings);
  report.seo = seo.pages;
}

if (only.has('a11y')) {
  log('Accessibility, layout and screenshots');
  const browser = await checkInBrowser({ base, pages, config, outDir: args.out, shots: !args['no-shots'] });
  report.findings.push(...browser.findings);
  report.screenshots = browser.screenshots;
}

if (only.has('lh')) {
  const runs = Number(args['lh-runs'] ?? config.lighthouse.runs);
  log(`Lighthouse (${config.lighthouse.formFactor}, ${runs} run${runs > 1 ? 's' : ''} per page)`);
  const lh = await checkLighthouse({ base, pages, config, runs, expect: args.expect });
  report.findings.push(...lh.findings);
  report.lighthouse = lh.results;
}

report.durationMs = Date.now() - started;
const errors = report.findings.filter((f) => f.level === 'error');
const warnings = report.findings.filter((f) => f.level === 'warn');

await mkdir(args.out, { recursive: true });
await writeFile(`${args.out}/gate.json`, JSON.stringify(report, null, 2));
await writeFile(`${args.out}/gate.md`, toMarkdown(report, config));

for (const f of errors) console.log(`  ✗ ${f.page} ${f.check}/${f.rule}: ${f.message}`);
for (const f of warnings) console.log(`  ! ${f.page} ${f.check}/${f.rule}: ${f.message}`);
log(`${errors.length} error(s), ${warnings.length} warning(s) in ${(report.durationMs / 1000).toFixed(1)}s. Report: ${args.out}/gate.md`);

process.exit(errors.length ? 1 : 0);
