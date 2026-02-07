#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  prsync.sh

Fetches the PR title+body for the PR associated with the current branch and
updates docs/history/pr_<N>_<subject>.md accordingly.

Rules:
- Subject is parsed from PR title "type: subject" (anything after the first colon).
- File path is docs/history/pr_<N>_<slug(subject)>.md
- If subject changed and docs/history/pr_<N>_<old_slug>.md exists (or any docs/history/pr_<N>_*.md exists),
  the file is renamed to the new name before updating.
- Writes the PR body into the file (overwrites).
- Stages changes (git add) and commits.
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

# --- Guard: repo must be clean (no unstaged changes, no staged changes) ---
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Error: not inside a git repository." >&2
  exit 2
fi

if ! git diff --quiet; then
  echo "Error: working tree has unstaged changes. Commit/stash them first." >&2
  exit 1
fi

if ! git diff --cached --quiet; then
  echo "Error: index has staged changes. Commit/stash them first." >&2
  exit 1
fi
# ------------------------------------------------------------------------

# Identify PR for current branch and fetch fields.
PR_NUMBER="$(gh pr view --json number --jq .number)"
PR_TITLE="$(gh pr view --json title  --jq .title)"
PR_BODY="$(gh pr view --json body   --jq .body)"

if [[ -z "${PR_NUMBER}" || "${PR_NUMBER}" == "null" ]]; then
  echo "Error: could not determine PR number for current branch (is there an open PR?)." >&2
  exit 1
fi

# Extract subject from title "type: subject" (anything after first ':').
SUBJECT="$(printf '%s' "$PR_TITLE" | sed -E 's/^[^:]+:[[:space:]]*//')"
if [[ -z "${SUBJECT}" || "$SUBJECT" == "$PR_TITLE" ]]; then
  echo "Error: PR title does not match expected 'type: subject' format: '$PR_TITLE'" >&2
  exit 1
fi

slugify() {
  printf '%s' "$1" \
    | tr '[:upper:]' '[:lower:]' \
    | sed -E 's/[^a-z0-9]+/_/g; s/^_+//; s/_+$//; s/_+/_/g'
}

SLUG="$(slugify "$SUBJECT")"
if [[ -z "$SLUG" ]]; then
  SLUG="pr"
fi

DEST_DIR="docs/history"
NEW_PATH="${DEST_DIR}/pr_${PR_NUMBER}_${SLUG}.md"

mkdir -p "$DEST_DIR"

# Find any existing file(s) for this PR number.
# This covers "docs/history/pr_N_old_subject.md exists" and also the general case.
shopt -s nullglob
matches=("${DEST_DIR}/pr_${PR_NUMBER}_"*.md)
shopt -u nullglob

OLD_PATH=""
if (( ${#matches[@]} > 0 )); then
  # Prefer a single non-new match for rename; if only NEW_PATH exists, no rename needed.
  for p in "${matches[@]}"; do
    if [[ "$p" != "$NEW_PATH" ]]; then
      OLD_PATH="$p"
      break
    fi
  done
fi

# Rename if subject changed AND an old file exists.
if [[ -n "$OLD_PATH" && "$OLD_PATH" != "$NEW_PATH" ]]; then
  if git ls-files --error-unmatch "$OLD_PATH" >/dev/null 2>&1; then
    git mv "$OLD_PATH" "$NEW_PATH"
  else
    mv "$OLD_PATH" "$NEW_PATH"
  fi
fi

TMP="$(mktemp)"
{
  printf '# %s\n\n' "$PR_TITLE"
  printf '%s\n' "$PR_BODY"
} > "$TMP"

mv "$TMP" "$NEW_PATH"
git add "$NEW_PATH"

git commit -m "docs(history): update PR ${PR_NUMBER} notes"

echo "Updated: $NEW_PATH"
echo "PR #${PR_NUMBER}: ${PR_TITLE}"
