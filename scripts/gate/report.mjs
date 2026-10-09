/**
 * Turns a gate run into the markdown posted on the pull request.
 * The first line is a hidden marker so CI can update one comment instead of
 * adding a new one on every push.
 */
const checks = [
  ['seo', 'SEO and AI readability'],
  ['a11y', 'Accessibility (axe, WCAG 2.2 AA)'],
  ['layout', 'Mobile layout'],
  ['lighthouse', 'Lighthouse'],
];

export function toMarkdown(report, config) {
  const errors = report.findings.filter((f) => f.level === 'error');
  const warnings = report.findings.filter((f) => f.level === 'warn');
  const status = errors.length ? `❌ ${errors.length} error${errors.length > 1 ? 's' : ''}` : '✅ passed';
  const lines = [
    '<!-- quality-gate -->',
    `## Quality gate: ${status}`,
    '',
    `Tested ${report.pages.length} page(s) at \`${report.base}\` in ${(report.durationMs / 1000).toFixed(0)}s.`,
    '',
    '| Check | Errors | Warnings |',
    '| --- | ---: | ---: |',
  ];
  for (const [id, name] of checks) {
    const e = errors.filter((f) => f.check === id).length;
    const w = warnings.filter((f) => f.check === id).length;
    lines.push(`| ${name} | ${e} | ${w} |`);
  }

  if (report.lighthouse?.length) {
    const lh = config.lighthouse;
    lines.push(
      '',
      `### Lighthouse (${lh.formFactor}, median of ${report.lighthouse[0].runs})`,
      '',
      '| Page | Perf | A11y | Best practices | SEO | LCP | CLS | TBT |',
      '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
    );
    for (const r of report.lighthouse) {
      const s = r.scores;
      const m = r.metrics;
      lines.push(
        `| \`${r.path}\` | ${s.performance} | ${s.accessibility} | ${s['best-practices']} | ${s.seo} | ${(m.lcpMs / 1000).toFixed(1)} s | ${m.cls} | ${m.tbtMs} ms |`,
      );
    }
  }

  if (report.seo?.length) {
    lines.push('', '### Structured data found', '', '| Page | Title | JSON-LD types |', '| --- | --- | --- |');
    for (const p of report.seo) lines.push(`| \`${p.path}\` | ${p.title} | ${p.types.join(', ') || 'none'} |`);
  }

  if (errors.length) {
    lines.push('', '### Errors', '');
    for (const f of errors) lines.push(`- \`${f.page}\` **${f.check}/${f.rule}**: ${f.message}`);
  }
  if (warnings.length) {
    lines.push('', '<details><summary>Warnings</summary>', '');
    for (const f of warnings) lines.push(`- \`${f.page}\` **${f.check}/${f.rule}**: ${f.message}`);
    lines.push('', '</details>');
  }
  if (report.screenshots.length) {
    lines.push('', `Screenshots (${report.screenshots.length}) are in the \`gate-report\` artifact of this run, for the design review.`);
  }
  return lines.join('\n') + '\n';
}
