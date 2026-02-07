#!/usr/bin/env bash
set -euo pipefail

git fetch --prune
for branch in $(git for-each-ref --format='%(refname:short)' --no-merged=origin/main refs/remotes/origin); do
  if [[ "$branch" == "origin/HEAD" ]]; then
    continue
  fi
  local_branch="${branch#origin/}"
  if ! git show-ref --verify --quiet "refs/heads/$local_branch"; then
    git branch --track "$local_branch" "$branch"
  fi
done
