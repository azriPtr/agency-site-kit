import { launch } from 'chrome-launcher';
import lighthouse from 'lighthouse';
import { chromium } from 'playwright';

/**
 * Lighthouse per page, on Playwright's Chromium so the laptop and CI run the
 * same browser build. Scores vary run to run, so with --lh-runs > 1 the
 * median run (by performance score) is kept.
 */
export async function checkLighthouse({ base, pages, config, runs, expect }) {
  const cfg = config.lighthouse;
  const findings = [];
  const results = [];
  const add = (level, page, rule, message) => findings.push({ check: 'lighthouse', level, page, rule, message });

  const chrome = await launch({ chromePath: chromium.executablePath(), chromeFlags: ['--headless=new', '--no-sandbox'] });
  try {
    for (const path of pages) {
      const reports = [];
      for (let i = 0; i < runs; i++) {
        const { lhr } = await lighthouse(new URL(path, base).href, {
          port: chrome.port,
          output: 'json',
          logLevel: 'error',
          formFactor: cfg.formFactor,
          screenEmulation:
            cfg.formFactor === 'desktop'
              ? { mobile: false, width: 1350, height: 940, deviceScaleFactor: 1, disabled: false }
              : undefined,
          onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
        });
        reports.push(lhr);
      }
      reports.sort((a, b) => a.categories.performance.score - b.categories.performance.score);
      const lhr = reports[Math.floor(reports.length / 2)];

      const scores = Object.fromEntries(Object.entries(lhr.categories).map(([k, c]) => [k, Math.round(c.score * 100)]));
      // Staging (and a demo) is noindex on purpose. Lighthouse marks that as an SEO failure; the gate
      // checks the noindex itself (--expect noindex), so score SEO on everything else.
      if (expect === 'noindex') scores.seo = scoreWithout(lhr, 'seo', ['is-crawlable']);
      const metrics = {
        lcpMs: Math.round(lhr.audits['largest-contentful-paint'].numericValue),
        cls: Number(lhr.audits['cumulative-layout-shift'].numericValue.toFixed(3)),
        tbtMs: Math.round(lhr.audits['total-blocking-time'].numericValue),
      };
      results.push({ path, scores, metrics, runs });

      for (const [cat, min] of Object.entries(cfg.minScores)) {
        if (scores[cat] < min) add('error', path, `score-${cat}`, `${cat} ${scores[cat]} (min ${min})${topIssues(lhr, cat)}`);
      }
      for (const [metric, max] of Object.entries(cfg.maxMetrics)) {
        if (metrics[metric] > max) add('error', path, metric, `${metric} ${metrics[metric]} (max ${max})`);
      }
    }
  } finally {
    chrome.kill();
  }

  return { findings, results };
}

/** The failing audits that cost the most in a category, so the finding says what to fix. */
function topIssues(lhr, category) {
  const refs = lhr.categories[category].auditRefs.filter((r) => r.weight > 0);
  const failing = refs
    .map((r) => ({ ...r, audit: lhr.audits[r.id] }))
    .filter((r) => r.audit.score !== null && r.audit.score < 0.9)
    .sort((a, b) => b.weight * (1 - b.audit.score) - a.weight * (1 - a.audit.score))
    .slice(0, 3)
    .map((r) => r.audit.title);
  return failing.length ? `. Top issues: ${failing.join('; ')}` : '';
}

/** A category score recomputed without some audits, the way Lighthouse weights it. */
function scoreWithout(lhr, category, skip) {
  const refs = lhr.categories[category].auditRefs.filter((r) => r.weight > 0 && !skip.includes(r.id));
  const scored = refs.filter((r) => lhr.audits[r.id].score !== null);
  const total = scored.reduce((sum, r) => sum + r.weight, 0);
  return Math.round((scored.reduce((sum, r) => sum + r.weight * lhr.audits[r.id].score, 0) / total) * 100);
}
