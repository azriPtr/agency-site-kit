---
description: Build the client's pages from client/brief.md and client/facts.yaml using the kit's sections, check them with the quality gate, and open a pull request for human review.
disable-model-invocation: true
---

# /build-from-brief

Build the site the brief describes, on a branch, and hand it to a human as a pull request. You draft; a
person reviews and releases.

## Before writing anything

1. Read `CLAUDE.md`, `client/brief.md`, `client/facts.yaml`, `src/lib/pages.ts`, and every file in
   `src/components/sections/`.
2. If `client/facts.yaml` has a `TODO` in a field a page needs, stop and list it. Do not work around it.
3. If `docs/design-mapping.md` exists, follow it. If it does not and no design handoff is in the session,
   build with the current tokens and say so in the PR.
4. If the current branch starts with `site/`, keep working on it (intake and design usually happened there).
   Otherwise `git switch -c site/build-from-brief`.

## Build

1. **Pages.** One `.astro` file per page in the brief's page list. Replace the kit's example `index.astro`.
   Compose from sections; pass copy as props or slot content; read facts from `facts`.
2. **Register** each page in `src/lib/pages.ts` with its title, description and nav label. Remove the
   example entry. Write titles and descriptions for the search queries in the brief, one page per query
   intent, no two pages competing for the same query.
3. **Structured data** per page as `CLAUDE.md` describes.
4. **Images** from `src/assets/client/`, alt text describing what is in the photo.
5. **Copy** in the brief's voice. Before moving on from a page, check every sentence: could a competitor
   publish it unchanged? Is every fact in it from facts or the brief?

## Check

1. `pnpm check` and `pnpm build`. Fix every error.
2. `pnpm preview --background`, then `pnpm gate`. Fix errors with the approach in `/fix-gate`. Do not edit the gate.
3. Ask the `fact-checker` subagent to check every page file you wrote. Fix what it finds.
4. Stop the preview server: `pnpm astro preview stop`.

## Hand off

1. Commit in logical steps (pages, structured data, copy fixes), each message saying what and why.
2. `git push -u origin <branch>`, then `gh pr create` with the template:
   - **What changed**: pages built, sections used, any new section and why.
   - **How it was made**: "Drafted with /build-from-brief", the gate result (paste the summary table from
     `reports/gate.md`), what the fact-checker caught and what you changed, and every TODO or open
     question.
   - Leave every **Human review** box unticked.
3. Report the PR URL and the gate result as they are, including warnings you chose not to fix and why.
