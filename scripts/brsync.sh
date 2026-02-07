#!/usr/bin/env bash
set -euo pipefail

git fetch --prune
for branch in $(git branch -r --no-merged origin/main | grep -v '\->'); do
  local_branch="${branch#origin/}"
  if ! git show-ref --verify --quiet "refs/heads/$local_branch"; then
    git branch --track "$local_branch" "$branch"
  fi
done
