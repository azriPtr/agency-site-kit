import { mkdir } from 'node:fs/promises';
import { AxeBuilder } from '@axe-core/playwright';
import { chromium } from 'playwright';

/**
 * Checks that need a real browser, run once per page per viewport:
 *  - accessibility with axe-core against WCAG 2.2 AA
 *  - horizontal overflow (the page scrolls sideways on a phone)
 *  - a full-page screenshot for the human design review
 */
export async function checkInBrowser({ base, pages, config, outDir, shots = true }) {
  const findings = [];
  const screenshots = [];
  const add = (level, page, rule, message) => findings.push({ check: 'a11y', level, page, rule, message });

  if (shots) await mkdir(`${outDir}/screenshots`, { recursive: true });
  const browser = await chromium.launch();

  try {
    for (const vp of config.screenshots.viewports) {
      const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
      const page = await context.newPage();

      for (const path of pages) {
        await page.goto(new URL(path, base).href, { waitUntil: 'networkidle' });

        const results = await new AxeBuilder({ page }).withTags(config.a11y.tags).analyze();
        for (const v of results.violations) {
          const level = config.a11y.failOn.includes(v.impact) ? 'error' : 'warn';
          const where = v.nodes[0]?.target?.join(' ') ?? '';
          add(level, path, v.id, `${v.help} (${v.nodes.length}× at ${vp.name}, e.g. \`${where}\`)`);
        }

        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        if (overflow > 1) {
          findings.push({ check: 'layout', level: 'error', page: path, rule: 'horizontal-scroll', message: `Page is ${overflow}px wider than a ${vp.width}px screen` });
        }

        if (shots) {
          // Lazy images only load near the viewport. Scroll through the page and wait for them, so the
          // full-page screenshot shows every photo instead of empty boxes.
          await page.evaluate(async () => {
            for (let y = 0; y < document.documentElement.scrollHeight; y += window.innerHeight / 2) {
              window.scrollTo(0, y);
              await new Promise((r) => setTimeout(r, 80));
            }
            window.scrollTo(0, 0);
            const pending = [...document.images].filter((img) => !img.complete);
            await Promise.all(
              pending.map((img) => new Promise((r) => {
                img.addEventListener('load', r);
                img.addEventListener('error', r);
              })),
            );
          });
          const file = `${outDir}/screenshots/${vp.name}${path === '/' ? '-home' : path.replace(/\//g, '-')}.png`;
          await page.screenshot({ path: file, fullPage: true });
          screenshots.push(file);
        }
      }
      await context.close();
    }
  } finally {
    await browser.close();
  }

  return { findings: dedupe(findings), screenshots };
}

/** The same violation on mobile and desktop is one finding, not two. */
function dedupe(findings) {
  const seen = new Set();
  return findings.filter((f) => {
    const key = `${f.page}|${f.rule}|${f.message.replace(/ at (mobile|desktop)/, '')}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
