# Agency site kit

A template repo for hotel, restaurant and wellness client websites. A new client starts as a copy of this
repo plus their notes, and goes live only after an automated gate and a person have both checked it.

```bash
scripts/new-client.sh <client>-site
```

## What is in it

- **One file of facts per client.** `client/facts.yaml` holds the address, phone, hours, room sizes and
  prices. Pages, the JSON-LD, `llms.txt` and the footer all read it, and a schema check fails the build if
  a fact is missing or malformed. AI writes the sentences around the facts; it does not type the facts.
- **Claude Code skills for each step.** `/intake` turns client notes into the facts file and a question
  list. `/apply-design` maps a Claude Design handoff onto design tokens. `/build-from-brief` builds the
  pages and opens a PR. `/fix-gate` fixes gate errors. `/site-review` reviews a change against the brief.
- **`pnpm gate`.** Technical SEO and AI readability, accessibility (axe, WCAG 2.2 AA), mobile layout,
  Lighthouse and screenshots. It tests a URL, not the source, so it runs the same against a local build,
  Vercel staging, production, or a WordPress site.
- **GitHub Actions.** The gate and a Claude review on every PR, a Human review checklist, a live check on
  staging after each merge, and a release button that refuses to ship anything that skipped a step.

## What it does not do

No CMS, no multi-language routing, no booking engine integration. Content changes go through a PR. The
release flow assumes one production domain per repo.

## Docs

- [PLAYBOOK.md](PLAYBOOK.md): the team workflow, from client notes to production
- [CLAUDE.md](CLAUDE.md): the rules Claude Code follows in this repo
