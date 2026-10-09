#!/usr/bin/env bash
# Refuses a production release unless the commit went through the whole flow:
#   1. it is on main
#   2. the Quality gate passed on it
#   3. the Staging check passed on it (live checks against the staging URL)
#   4. every commit since the last release came from a PR whose Human review passed
#
# GitHub branch protection could enforce some of this, but not on a private
# repo on the free plan, and not "was it on staging first". This script works
# on any plan.
#
#   scripts/ci/release-preflight.sh <sha>
set -euo pipefail
sha=$1
repo=$GITHUB_REPOSITORY
fail() { echo "::error::$1"; exit 1; }

check() {
  # Latest conclusion of a check run with this name on a commit
  gh api "repos/$repo/commits/$1/check-runs?check_name=$(jq -rn --arg n "$2" '$n|@uri')" \
    --jq '.check_runs | sort_by(.completed_at) | last | .conclusion // "missing"'
}

git fetch --quiet origin main
git merge-base --is-ancestor "$sha" origin/main || fail "$sha is not on main."
echo "✓ $sha is on main"

[ "$(check "$sha" 'Quality gate')" = success ] || fail "Quality gate has not passed on $sha."
echo "✓ Quality gate passed"

[ "$(check "$sha" 'Staging check')" = success ] || fail "Staging check has not passed on $sha. Wait for staging, or fix it."
echo "✓ Staging check passed"

# Every commit that production does not have yet must come from a reviewed PR,
# not only the newest one.
if git fetch --quiet origin production 2>/dev/null; then
  commits=$(git rev-list --first-parent "origin/production..$sha")
else
  commits=$sha # first release
fi
[ -n "$commits" ] || fail "Production already has $sha. Nothing to release."

for c in $commits; do
  pr=$(gh api "repos/$repo/commits/$c/pulls" --jq '[.[] | select(.merged_at != null)][0].number // empty')
  [ -n "$pr" ] || fail "${c:0:7} did not come from a merged pull request. Production changes go through a reviewed PR."
  head=$(gh api "repos/$repo/pulls/$pr" --jq .head.sha)
  [ "$(check "$head" 'Human review')" = success ] || fail "PR #$pr was merged without a passing Human review."
  echo "✓ ${c:0:7} from PR #$pr, Human review passed"
done
