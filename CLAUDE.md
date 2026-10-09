# CLAUDE.md

This repo is one client website, started from the agency site kit. Static Astro 7 + Tailwind 4, deployed on
Vercel. Read this file before changing anything; read `PLAYBOOK.md` for the team workflow around it.

## The one rule

**Facts come from `client/facts.yaml`. Copy comes from you. Never mix them.**

Anything a guest could check against reality (prices, times, sizes, distances, phone, address, amenities,
policies, treatment descriptions) is read from `facts` in code, never typed into a page. If a sentence needs
a fact that is not in `client/facts.yaml` or `client/brief.md`, do not write the sentence. Add `TODO` to
`client/facts.yaml` and list the question in the PR body. A TODO fails the gate (or the build, in a typed
field), so it cannot reach production by accident.

Things you are likely to invent and must not: distances and drive times ("10 minutes from Ubud centre"),
awards, rankings ("best", "#1"), guest reviews or ratings, "family-run since", chef or therapist names,
sustainability claims, health or medical outcomes for spa and wellness clients.

## Where things are

| Path | What it is |
| --- | --- |
| `client/facts.yaml` | The client's facts. Validated by the schema in `src/lib/facts.ts` on every build |
| `client/brief.md` | Audience, voice, pages, search queries, "Must not say" list |
| `src/lib/pages.ts` | Every public page: path, title, meta description, nav label |
| `src/lib/schema.ts` | JSON-LD builders. Built from facts only |
| `src/styles/tokens.css` | The client's colours, fonts, radii. The only file with raw colour values |
| `src/components/sections/` | Page sections. See them all at `/kit` |
| `src/pages/` | Pages compose sections and pass copy as props or slot content |
| `gate.config.mjs`, `scripts/gate/` | The quality gate. Humans change these, you do not |

## Building pages

- Compose pages from existing sections. Look at `/kit` (`pnpm dev`, then open `/kit`) before writing markup.
- Add a new section only when no existing one fits, in `src/components/sections/`, following the same
  pattern: typed `Props`, a doc comment saying when to use it, token utilities only (`bg-base`, `text-ink`,
  `bg-brand`, `rounded-card`...), no raw hex, no arbitrary colour values.
- Each page: one `<h1>` (the Hero), sections use `h2`, items inside them `h3`.
- Register every new page in `src/lib/pages.ts` with a unique title (under 50 characters before the
  business-name suffix) and a unique meta description (70 to 160 characters) that says what is on that page.
- Pass `breadcrumbs` to `BaseLayout` on every page except home. Pass `jsonLd` for page entities:
  `restaurantNode()` on dining, `spaNode()` on spa, `faqNode(facts.faq)` where the FAQ section renders,
  `business={roomOffers()}` on rooms.
- Images: put files in `src/assets/client/`, reference them through `clientImage()` and render with
  `<Image>` from `astro:assets`. Never a raw `<img>`, never a file in `public/` for content photos. Only
  the Hero image loads eagerly.
- No client-side JavaScript unless the page cannot work without it. Say why in the PR if you add any.

## Copy

- Voice, audience and banned words are in `client/brief.md`. Follow them over your own defaults.
- Write the specific thing: the room has a plunge pool facing the rice field, not "a serene sanctuary".
  If you only have adjectives, you do not have the fact yet. Ask.
- No em dashes. No "nestled", "hidden gem", "oasis", "tranquil haven", "unparalleled", "elevate",
  "curated", "immerse yourself", "whether you're... or...".
- Headings say what the section is about. Buttons say what happens ("Check availability", not "Learn more").

## Design handoff from Claude Design

A Claude Design handoff arrives as a message in the session. Use `/apply-design`. Do not paste the
handoff's HTML into pages: map its colours, fonts and radii onto `src/styles/tokens.css` and the `fonts`
block in `astro.config.mjs`, and its layouts onto existing sections.

## Commands

```bash
pnpm dev                      # http://localhost:4321
pnpm build                    # also validates client/facts.yaml
pnpm check                    # TypeScript and Astro diagnostics
pnpm preview --background     # serve the build on :4321; stop with `pnpm astro preview stop`
pnpm gate                     # quality gate against :4321. Writes reports/gate.md
```

Before you say a change is done: `pnpm check`, `pnpm build`, `pnpm preview --background`, `pnpm gate`. Report the gate
result as it is. Fix gate errors with `/fix-gate`; never by editing `gate.config.mjs` or `scripts/gate/`.

## Git

- Work on a branch named `site/<what>` or `fix/<what>`. Never commit to `main` or `production`.
- Open a PR with `gh pr create` using the template. Fill "What changed" and "How it was made"; leave the
  **Human review** boxes unticked. They are for the person who reviews, not for you.
- Releases to production are done by a person from the Actions tab. You never push to `production` and
  never run `vercel --prod`.
