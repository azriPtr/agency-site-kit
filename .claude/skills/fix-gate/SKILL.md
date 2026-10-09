---
description: Fix the errors in the last quality gate run (reports/gate.json) at their cause, then re-run the gate. Use when pnpm gate fails or the Quality gate check on a PR is red.
---

# /fix-gate

Read `reports/gate.json` (run `pnpm gate` first if it is missing or older than your last change). Fix every
finding with `"level": "error"`, one at a time, at its cause.

## How to fix, by rule

| Rule | Usual cause | Fix |
| --- | --- | --- |
| `seo/title`, `title-length`, `description*`, `duplicate-*` | Page entry in `src/lib/pages.ts` | Rewrite for that page's search intent |
| `seo/h1`, `heading-order` | Two Heroes, or a section heading level | One Hero per page; sections `h2`, items `h3` |
| `seo/canonical` | Page not in `pages.ts`, or wrong `path` | Fix the entry |
| `seo/nap` | Phone or address typed into a page | Read it from `facts` |
| `seo/banned-text` | Leftover TODO, placeholder or example text | Replace with real copy, or the fact. If the fact is unknown, remove the sentence and add a TODO to `client/facts.yaml` |
| `seo/broken-link` | Link to a page that does not exist | Link to an existing page, or build the page |
| `seo/img-alt` | Raw `<img>` | Use `<Image>` with alt from facts |
| `a11y/color-contrast` | Token pair under 4.5:1 | Darken the token in `tokens.css`, not one element |
| `a11y/*` other | Markup | Fix the markup; the axe rule id names the problem |
| `layout/horizontal-scroll` | Fixed widths, long words, wide tables | Find the element wider than 390px and constrain it |
| `lighthouse/lcpMs`, `score-performance` | Hero image too large or lazy, render-blocking font | Hero `<Image>` eager with `widths`/`sizes`; fewer font weights |
| `lighthouse/cls` | Image or font without reserved space | `<Image>` sets width/height; check web fonts have fallbacks |

## Never

- Edit `gate.config.mjs` or anything in `scripts/gate/`. If a rule is wrong for this client, stop and say
  why; a person decides.
- Hide content to pass a check (`display:none` text, empty alt on a meaningful photo).
- Add `--allow-placeholders` or other flags to make the gate pass.

## Finish

Re-run `pnpm build`, `pnpm preview --background`, `pnpm gate`. Report what each error was, what you changed, and the
new result. If an error remains, say which and why.
