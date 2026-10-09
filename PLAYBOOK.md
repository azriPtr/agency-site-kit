# Playbook

How a client website goes from the client's notes to production with this kit. Written for a developer
on their first day; a project manager or designer can read the first two sections and skip the rest.

## The flow

| Step | Who | Tool | What comes out |
| --- | --- | --- | --- |
| 1. Intake | PM collects, developer runs | `/intake client/notes/` | `client/facts.yaml`, `client/brief.md`, `client/QUESTIONS.md` |
| 2. Design | Designer | Claude Design, then Send to Claude Code, then `/apply-design` | `src/styles/tokens.css`, fonts, `docs/design-mapping.md` |
| 3. Build | Developer | `/build-from-brief` | Pages on a `site/` branch and a pull request |
| 4. Checks | CI, automatic | Quality gate, Claude review | A gate report on the PR, Claude's comments |
| 5. Review | A person who did not write it | The PR checklist | **Human review** check turns green |
| 6. Staging | Automatic after merge | Vercel, Staging check | `staging.<domain>` live, checked again for real |
| 7. Production | Lead developer | Actions → Release to production | `<domain>` live, checked, team told on Discord |

The AI drafts steps 1 to 3. People decide at steps 5 and 7. Every step between is a check that runs
the same way every time.

## Two rules everyone works by

**Facts live in one file.** Prices, hours, sizes, phone, address: `client/facts.yaml`, and only what the
client confirmed in writing. An unknown is written as `TODO`, never guessed. The site reads the file;
nobody types a price into a page. That is how the price on the page, in Google's structured data and in
`llms.txt` stay the same.

**Nothing reaches production without a person.** The agent can build and open a PR. It cannot merge,
cannot push to `main` or `production`, and cannot change the gate that checks its work.

Two layers enforce this. `.claude/settings.json` denies the agent's usual commands, but it matches
command text, so it is a guardrail: during the Demo Resort build a plain `git push` from `main` got past
it. The lock is on GitHub: rulesets (in `scripts/rulesets/`, added by `new-client.sh`) reject any push
to `main` that is not a merged PR with a passing Quality gate and Human review, and any rewrite or
deletion of `production`. Nobody bypasses them, admins included.

## Setting up a new client

You need, once per laptop: Node 24, pnpm, GitHub CLI (`gh auth login`), Vercel CLI (`vercel login`),
Claude Code (`claude auth login`), and a clone of this kit. Then, from a terminal inside the kit:

```bash
git pull
OWNER=<github-org> scripts/new-client.sh <client>-site
```

Leave out `OWNER` to create the repo under your own account. Add `VISIBILITY=public` for a public repo.

This creates the repo from the template next to the kit, creates the `production` branch Vercel will
track, adds the branch rulesets, installs dependencies and the browser the gate uses, and prints the steps
below. Rulesets need a public repo or a paid GitHub plan; on a private repo under a free plan the script
says so and the release preflight is the only check.

1. **Notes.** Put everything the client sent into `client/notes/` (emails, WhatsApp exports, call notes,
   old website text). Open Claude Code in the repo and run `/intake client/notes/`. Send
   `client/QUESTIONS.md` to the client. When they answer, save the reply in `client/notes/` and update
   the facts.
2. **Photos.** Put them in `src/assets/client/` and record the source and licence in
   `src/assets/client/CREDITS.md`. `/intake` picks photos for the business and each room and writes alt
   text from what is in each photo.
3. **Vercel.** `vercel link --yes --project <client>-site` creates the project and connects the repo.
   In the dashboard, set Settings → Environments → Production → Branch Tracking to `production` (the
   API cannot change it, and the branch must already exist). Add the domains:
   ```bash
   vercel api /v10/projects/<client>-site/domains -X POST -f name=<domain>
   vercel api /v10/projects/<client>-site/domains -X POST -f name=staging.<domain> -f gitBranch=main
   ```
   The staging domain can only be added after the production branch is changed. The first deployment of
   a new project is marked Production whatever its branch; the first release replaces it.
4. **DNS.** At the client's DNS host, add a CNAME for each hostname. Vercel shows the target in the
   project's Domains page. SSL is issued automatically once DNS resolves.
5. **Secrets and variables.**
   ```bash
   gh variable set STAGING_URL --body https://staging.<domain>
   gh secret set CLAUDE_CODE_OAUTH_TOKEN      # from: claude setup-token
   gh secret set DISCORD_WEBHOOK_URL          # the team's #deploys channel
   vercel env add ENQUIRY_WEBHOOK_URL production
   ```
   Install the Claude GitHub app on the repo: https://github.com/apps/claude. Secrets are typed into the
   prompt, never pasted into a file, a chat or a commit.

## Building the site

Start the design in Claude Design from the brief. When it is ready, Share → Send to Claude Code into a
session opened in the client repo, and run `/apply-design`. It maps colours, type and radii onto
`src/styles/tokens.css` and each design block onto an existing section, and writes down every place it
departed from the design and why. It does not paste the design's HTML or its placeholder copy.

Then `/build-from-brief`. It builds the pages from the kit's sections, writes the copy in the brief's
voice, runs the gate, has the `fact-checker` subagent check every claim, and opens a PR with the
**Human review** boxes unticked.

Look at every section in `/kit` (`pnpm dev`, then `localhost:4321/kit`) before asking for a new one. A new
client rarely needs a new section; it needs the same section with its own tokens.

## Reviewing AI output

The gate checks what a script can: titles, alt attributes, contrast, broken links, Lighthouse. Claude's
review checks claims against the facts and the brief. Neither replaces reading the page. In the PR:

- **Facts.** Every price, time, distance and claim on a changed page is in `client/facts.yaml` or
  `client/brief.md`. The usual inventions: drive times to landmarks the client never named, "award
  winning", review scores, "family-run", health effects of spa treatments.
- **Must not say.** Nothing from the brief's list.
- **Design.** Compare the gate's mobile and desktop screenshots (in the run's `gate-report` artifact)
  with the Claude Design file.
- **Copy.** Read it out loud. A sentence any resort in Bali could publish ("a tranquil escape") tells
  the guest nothing. Replace it with a fact from the brief, or cut it.
- **Claude review.** Every comment fixed or answered in its thread. Claude can be wrong; say why.
- **Preview.** Open the Vercel preview on a phone and use the main call to action.

Tick a box only after you did the thing. If a later push changes something you reviewed, untick it.

## When a check fails

Run `/fix-gate` in the PR branch, or read the gate comment on the PR. The rule name says what is wrong.

| Check | Read | Usual fix |
| --- | --- | --- |
| Quality gate | The PR comment, then the `gate-report` artifact | `/fix-gate` |
| Human review | The run's summary: which boxes are open | Do the review, tick the boxes |
| Claude review | Its inline comments | Fix, or answer in the thread |
| Staging check | The run log; Discord says it failed | Usually a header or a live-only issue: test with `pnpm gate --url <staging>` |
| Release preflight | The first ✗ line | It names the step that was skipped |

Never fix a gate failure by changing `gate.config.mjs` to pass. If a threshold is wrong for a client,
change it in its own PR and say why in the description.

## Releasing

Actions → **Release to production** → Run workflow. It checks that the commit is on `main`, passed the
gate, passed the live staging check, and that every commit since the last release came from a PR that
passed Human review. Then it moves the `production` branch to that commit, waits until the live domain
serves it, runs the gate against production, and posts the result to Discord.

To undo a release: Vercel dashboard → Deployments → the previous production deployment → Instant
Rollback. Then fix forward with a PR. The release workflow only moves forward.

## Costs and limits

- **Vercel Hobby is for personal, non-commercial projects.** Client sites belong on the agency's Vercel
  Pro team.
- **GitHub Actions** on private repos uses the account's included minutes. One gate run on the kit takes
  about 1.5 minutes.
- **Claude review** runs on every push to a PR and uses the Claude plan whose token is in
  `CLAUDE_CODE_OAUTH_TOKEN`.
- **Enquiry form** has a honeypot against bots, no rate limiting and no CAPTCHA. A client with real
  traffic needs one of the two before launch.
- **Not in the kit:** a CMS, multi-language routing, booking engine integration, WordPress builds. The
  gate does run against any URL, a WordPress staging site included.
