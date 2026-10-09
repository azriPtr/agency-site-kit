#!/usr/bin/env bash
# Posts a PR comment, or updates the earlier one that contains the same marker,
# so each push refreshes one comment instead of stacking new ones.
#
#   scripts/ci/upsert-comment.sh <pr-number> <marker> <body-file>
set -euo pipefail
pr=$1 marker=$2 file=$3

id=$(gh api "repos/$GITHUB_REPOSITORY/issues/$pr/comments" --paginate \
  --jq ".[] | select(.body | contains(\"$marker\")) | .id" | tail -1)

if [ -n "$id" ]; then
  gh api -X PATCH "repos/$GITHUB_REPOSITORY/issues/comments/$id" -F body=@"$file" > /dev/null
else
  gh api -X POST "repos/$GITHUB_REPOSITORY/issues/$pr/comments" -F body=@"$file" > /dev/null
fi
