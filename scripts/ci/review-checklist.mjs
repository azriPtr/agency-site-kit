/**
 * The "Human review" check. Reads the PR body and fails while any box under
 * "## Human review" is unticked. It re-runs when the PR body is edited, so
 * ticking the last box turns the check green.
 *
 * It cannot prove someone looked. It makes skipping the review a visible,
 * deliberate act instead of a default, and the release workflow refuses to
 * ship a commit whose PR never passed it.
 */
import { appendFileSync } from 'node:fs';

const body = process.env.PR_BODY ?? '';
const section = body.split(/^## /m).find((s) => s.trimStart().startsWith('Human review'));

const summary = (text) => process.env.GITHUB_STEP_SUMMARY && appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${text}\n`);

if (!section) {
  console.log('::error::The PR body has no "## Human review" section. Start the PR from the template.');
  summary('### Human review: missing\nThe PR body has no `## Human review` section.');
  process.exit(1);
}

const items = [...section.matchAll(/^\s*- \[( |x|X)\] (.+)$/gm)].map((m) => ({ done: m[1] !== ' ', text: m[2].trim() }));
const open = items.filter((i) => !i.done);

if (!items.length) {
  console.log('::error::The "Human review" section has no checklist.');
  process.exit(1);
}

summary(`### Human review: ${items.length - open.length} of ${items.length} done`);
for (const i of items) summary(`- [${i.done ? 'x' : ' '}] ${i.text}`);

if (open.length) {
  for (const i of open) console.log(`::error::Not reviewed yet: ${i.text.replace(/\*\*/g, '')}`);
  process.exit(1);
}
console.log(`All ${items.length} review items ticked.`);
