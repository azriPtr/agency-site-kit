/**
 * Quality gate thresholds. `pnpm gate` reads this file locally and in CI, so
 * the bar a developer checks on their laptop is the bar the PR is held to.
 *
 * Tune per client in the PR that needs it, with the reason in the PR body.
 * Lowering a threshold is a review item, not a quiet edit.
 */
export default {
  seo: {
    titleMax: 60,
    descriptionMin: 70,
    descriptionMax: 160,
    /** Text that must never reach a live page. Matched case-insensitively against visible text. */
    bannedText: ['TODO', 'lorem ipsum', 'placeholder', 'example.com'],
  },

  a11y: {
    tags: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'],
    /** axe impact levels that fail the gate. Lower impacts are reported as warnings. */
    failOn: ['critical', 'serious'],
  },

  lighthouse: {
    /** Mobile with Lighthouse's default throttling: the conservative case for guests on hotel Wi-Fi or 4G. */
    formFactor: 'mobile',
    /** Runs per page; the median is kept. CI passes --lh-runs 3. */
    runs: 1,
    minScores: { performance: 90, accessibility: 95, 'best-practices': 95, seo: 95 },
    maxMetrics: { lcpMs: 2500, cls: 0.1, tbtMs: 200 },
  },

  screenshots: {
    viewports: [
      { name: 'mobile', width: 390, height: 844 },
      { name: 'desktop', width: 1440, height: 900 },
    ],
  },
};
