#!/usr/bin/env bash
# Starts a new client site from this template: a private repo next to the kit
# on disk, a `production` branch for Vercel to track, dependencies installed,
# and the remaining one-time steps printed.
#
#   scripts/new-client.sh <repo-name>
#   OWNER=gaia-digital scripts/new-client.sh villa-x-site     # repo in an organisation
#   VISIBILITY=public scripts/new-client.sh demo-resort-site  # public repo (default: private)
#
# Run it from a terminal, inside a clone of the kit. Needs gh, pnpm and Node 24.
set -euo pipefail

name=${1:?usage: scripts/new-client.sh <repo-name>}
kit_dir=$(cd "$(dirname "$0")/.." && pwd)
template=$(cd "$kit_dir" && gh repo view --json nameWithOwner --jq .nameWithOwner)
owner=${OWNER:-$(gh api user --jq .login)}

cd "$(dirname "$kit_dir")"
gh repo create "$owner/$name" --"${VISIBILITY:-private}" --template "$template" --clone
cd "$name"

# Vercel's production branch must exist before it can be selected in the dashboard.
# It starts at the template commit; the first release moves it forward.
gh api "repos/$owner/$name/git/refs" -X POST -f ref=refs/heads/production \
  -f sha="$(gh api "repos/$owner/$name/git/ref/heads/main" --jq .object.sha)" > /dev/null

pnpm install --silent
pnpm exec playwright install chromium > /dev/null

cat <<EOF

Created $owner/$name in $(pwd)

Next (details in PLAYBOOK.md):
  1. Put the client's notes in client/notes/, then in Claude Code: /intake client/notes/
  2. Vercel: import the repo, set the production branch to "production", add the
     production domain and a staging domain on the "main" branch.
  3. DNS: CNAME both hostnames to the target Vercel shows.
  4. GitHub: gh variable set STAGING_URL --body https://staging.<domain>
             gh secret set CLAUDE_CODE_OAUTH_TOKEN   (value from: claude setup-token)
             gh secret set DISCORD_WEBHOOK_URL
     and install the Claude GitHub app on this repo: https://github.com/apps/claude
EOF
