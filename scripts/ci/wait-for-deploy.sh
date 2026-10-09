#!/usr/bin/env bash
# Waits until <url> serves the build of <sha>, read from <meta name="build">.
# This is how a workflow knows Vercel finished deploying the commit it cares
# about, without calling the Vercel API or needing a Vercel token.
#
#   scripts/ci/wait-for-deploy.sh https://staging.example.com 1a2b3c...
set -euo pipefail
url=$1 sha=$2

for _ in $(seq 1 60); do
  if curl -fsS "$url" 2>/dev/null | grep -q "content=\"$sha\""; then
    echo "$url is serving $sha"
    exit 0
  fi
  sleep 10
done

echo "::error::$url did not serve $sha within 10 minutes. Check the deployment in Vercel."
exit 1
