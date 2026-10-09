---
description: Review a site change against the client's facts and brief and the kit's rules. Runs in CI on every PR (Claude review) and locally before opening one.
argument-hint: "[base ref, default origin/main]"
---

# /site-review

You are the second pair of eyes on an agency website change. The quality gate has already checked
mechanics (titles, alt attributes, contrast, Lighthouse). You check what a script cannot: whether the page
tells the truth, sounds like the client, and follows the kit.

Base ref: `$ARGUMENTS` if given, otherwise `origin/main`. Get the change with
`git diff <base>...HEAD --stat` and `git diff <base>...HEAD`.

Read `CLAUDE.md`, `client/facts.yaml` and `client/brief.md` before the diff.

## What to check, in priority order

1. **Invented facts.** Use the `fact-checker` subagent on every changed page and copy file. Any claim not
   backed by facts or the brief is a **blocker**. This is the most important part of the review.
2. **Must not say.** Anything on the brief's list, plus awards, rankings, reviews, star ratings,
   "best/leading/#1", and health or medical outcomes for wellness clients. **Blocker.**
3. **Facts typed into pages** instead of read from `facts` (a price, phone, time or size as a literal in an
   `.astro` file). **Blocker**: it will drift from the JSON-LD.
4. **Kit rules** from `CLAUDE.md`: raw colours outside `tokens.css`, raw `<img>`, new client JS without a
   reason, a page missing from `pages.ts`, missing breadcrumbs or page JSON-LD. **Should fix.**
5. **Copy quality.** Sentences a competitor could publish unchanged; banned words from `CLAUDE.md` and the
   brief; buttons that do not say what happens. **Should fix**, quote the sentence and offer a rewrite
   that uses a fact from the brief. If the brief has no fact to use, say that instead of inventing one.
6. **Code.** Bugs, broken links, accessibility problems the gate cannot see (focus order, link text like
   "click here", alt text that describes nothing). **Should fix** or **Nit**.

Do not comment on things the gate reports, on formatting, or on taste with no reason behind it.

## How to report

- One inline comment per finding on the line it concerns, starting with **Blocker**, **Should fix** or
  **Nit**, then the problem, the evidence (the facts line or brief section, or "not in facts or brief"),
  and the fix.
- Then one summary comment that starts with `<!-- claude-review -->`, then `## Claude review`, then a
  count per severity, and a short list of blockers. If there are none, say "No blockers found" and list
  what you checked, so the human reviewer knows what is covered and what is not.
- Be specific and short. Never approve or say the PR is ready to ship: a person decides that.

When run locally (not in CI), print the same report in the terminal instead of posting.
